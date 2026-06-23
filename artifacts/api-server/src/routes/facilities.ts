import { Router } from "express";
import { db } from "@workspace/db";
import { facilitiesTable, teamsTable, playersTable, staffTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

const MEDICAL_ROLES = ["team_doctor", "medical_specialist", "physiotherapist", "nutritionist", "sports_chemist"];

const FACILITY_TYPES = [
  "training_complex",
  "medical_centre",
  "gymnasium",
  "nutrition_centre",
  "youth_academy",
  "scouting_department",
  "sports_science_lab",
  "commercial_department",
  "beach_resort",
  "psychology_centre",
  "olympic_performance_centre",
] as const;

const MAIN_FACILITY_TYPES = [
  "training_complex",
  "medical_centre",
  "gymnasium",
  "nutrition_centre",
  "youth_academy",
  "scouting_department",
  "sports_science_lab",
  "commercial_department",
  "beach_resort",
] as const;

const MAX_LEVEL = 10;

function upgradeCost(currentLevel: number): number {
  return currentLevel * 20000;
}

const getTeamForUser = async (userId: string) =>
  db.query.teamsTable.findFirst({ where: eq(teamsTable.userId, userId) });

async function ensureFacilities(teamId: number) {
  const existing = await db.select().from(facilitiesTable).where(eq(facilitiesTable.teamId, teamId));
  const existingTypes = new Set(existing.map((f) => f.type));

  const missing = FACILITY_TYPES.filter((t) => !existingTypes.has(t));
  if (missing.length > 0) {
    await db.insert(facilitiesTable).values(
      missing.map((type) => ({ teamId, type, level: 1 })),
    );
    return db.select().from(facilitiesTable).where(eq(facilitiesTable.teamId, teamId));
  }
  return existing;
}

router.get("/facilities", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }
  const facilities = await ensureFacilities(team.id);
  res.json(facilities);
});

router.post("/facilities/:type/upgrade", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { type } = req.params;
  if (!FACILITY_TYPES.includes(type as any)) {
    res.status(400).json({ error: "Unknown facility type" });
    return;
  }

  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }

  await ensureFacilities(team.id);

  const facility = await db.query.facilitiesTable.findFirst({
    where: and(eq(facilitiesTable.teamId, team.id), eq(facilitiesTable.type, type)),
  });
  if (!facility) { res.status(404).json({ error: "Facility not found" }); return; }

  if (facility.level >= MAX_LEVEL) {
    res.status(400).json({ error: "Facility is already at maximum level" });
    return;
  }

  const cost = upgradeCost(facility.level);
  const budget = Number(team.budget);

  if (budget < cost) {
    res.status(400).json({ error: `Insufficient budget. Upgrade costs $${cost.toLocaleString()}` });
    return;
  }

  await db.update(teamsTable).set({
    budget:           String(budget - cost),
    managerRepPoints: (team.managerRepPoints ?? 0) + 5,
  }).where(eq(teamsTable.id, team.id));

  const [upgraded] = await db
    .update(facilitiesTable)
    .set({ level: facility.level + 1, updatedAt: new Date() })
    .where(eq(facilitiesTable.id, facility.id))
    .returning();

  res.json(upgraded);
});

router.get("/club-rating", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }

  const [facilities, allPlayers, allStaff] = await Promise.all([
    ensureFacilities(team.id),
    db.select().from(playersTable).where(and(eq(playersTable.teamId, team.id), eq(playersTable.isActive, true))),
    db.select().from(staffTable).where(eq(staffTable.teamId, team.id)),
  ]);

  const facilityMap = Object.fromEntries(facilities.map(f => [f.type, f.level]));

  const coachingStaff = allStaff.filter(s => !MEDICAL_ROLES.includes(s.role));
  const medicalStaff  = allStaff.filter(s => MEDICAL_ROLES.includes(s.role));

  const playerScore = allPlayers.length > 0
    ? Math.round(allPlayers.reduce((sum, p) => {
        const ovr = Math.round((p.speed + p.power + p.defense + p.serve + p.block) / 5);
        return sum + ovr;
      }, 0) / allPlayers.length)
    : 0;

  const staffScore = coachingStaff.length > 0
    ? Math.round(coachingStaff.reduce((s, m) => s + (m.overallRating ?? 70), 0) / coachingStaff.length)
    : 0;

  const medicalScore = medicalStaff.length > 0
    ? Math.round(medicalStaff.reduce((s, m) => s + (m.overallRating ?? 70), 0) / medicalStaff.length)
    : 0;

  const mainLevels = MAIN_FACILITY_TYPES.map(t => facilityMap[t] ?? 1);
  const facilityScore = Math.round(mainLevels.reduce((s, l) => s + l, 0) / mainLevels.length / 10 * 100);

  const youthLevel = facilityMap["youth_academy"] ?? 1;
  const youthScore = Math.round(youthLevel / 10 * 100);

  const weights = { players: 30, staff: 15, medical: 15, facilities: 25, youthAcademy: 15 };
  const totalRating = Math.round(
    (playerScore  * weights.players    / 100) +
    (staffScore   * weights.staff      / 100) +
    (medicalScore * weights.medical    / 100) +
    (facilityScore * weights.facilities / 100) +
    (youthScore   * weights.youthAcademy / 100)
  );

  const label =
    totalRating >= 90 ? "World Class Club" :
    totalRating >= 80 ? "Elite Club" :
    totalRating >= 70 ? "Professional Club" :
    totalRating >= 60 ? "Established Club" :
    totalRating >= 50 ? "Developing Club" :
    totalRating >= 35 ? "Amateur Club" :
                        "Startup Club";

  res.json({
    totalRating,
    label,
    breakdown: {
      players:     { score: playerScore,   weight: weights.players,     contribution: Math.round(playerScore  * weights.players    / 100), detail: `Avg OVR ${playerScore} across ${allPlayers.length} player${allPlayers.length !== 1 ? "s" : ""}` },
      staff:       { score: staffScore,    weight: weights.staff,       contribution: Math.round(staffScore   * weights.staff      / 100), detail: coachingStaff.length > 0 ? `Avg OVR ${staffScore} across ${coachingStaff.length} coach${coachingStaff.length !== 1 ? "es" : ""}` : "No coaching staff hired" },
      medical:     { score: medicalScore,  weight: weights.medical,     contribution: Math.round(medicalScore * weights.medical    / 100), detail: medicalStaff.length > 0 ? `Avg OVR ${medicalScore} across ${medicalStaff.length} medical staff` : "No medical staff hired" },
      facilities:  { score: facilityScore, weight: weights.facilities,  contribution: Math.round(facilityScore * weights.facilities / 100), detail: `Avg level ${(mainLevels.reduce((s, l) => s + l, 0) / mainLevels.length).toFixed(1)}/10 across 9 facilities` },
      youthAcademy:{ score: youthScore,    weight: weights.youthAcademy,contribution: Math.round(youthScore   * weights.youthAcademy / 100), detail: `Youth Academy Level ${youthLevel}/10` },
    },
  });
});

export default router;
