import { Router, type Request } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { db } from "@workspace/db";
import {
  facilitiesTable,
  teamsTable,
  playersTable,
  staffTable,
  seasonsTable,
  financeTransactionsTable,
} from "@workspace/db";
import { eq, and, isNotNull, lte, desc } from "drizzle-orm";
import { getGameDate } from "../utils/gameDate.js";
import { getActiveSeason } from "../lib/getActiveSeason.js";

const router = Router();

const MEDICAL_ROLES = ["team_doctor", "medical_specialist", "physiotherapist", "nutritionist", "sports_scientist", "Sports Scientist"];

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

const BUILD_ROUNDS: Record<number, number> = {
  1: 3,   // 2 weeks
  2: 6,   // 1 month
  3: 8,   // 6 weeks
  4: 12,  // 2 months
  5: 18,  // 3 months
  6: 24,  // 4 months
  7: 29,  // 5 months
  8: 35,  // 6 months
  9: 52,  // 9 months
};

const BUILD_LABEL: Record<number, string> = {
  1: "2 weeks",
  2: "1 month",
  3: "6 weeks",
  4: "2 months",
  5: "3 months",
  6: "4 months",
  7: "5 months",
  8: "6 months",
  9: "9 months",
};

async function getCurrentAbsoluteRound(req: Request): Promise<number> {
  const activeSeason = await getActiveSeason(req);
  if (!activeSeason) return 0;
  return (activeSeason.year - 2026) * 70 + activeSeason.currentRound;
}

async function checkAndCompleteUpgrades(teamId: number, currentRound: number): Promise<void> {
  const upgrading = await db
    .select()
    .from(facilitiesTable)
    .where(
      and(
        eq(facilitiesTable.teamId, teamId),
        isNotNull(facilitiesTable.upgradingToLevel),
        lte(facilitiesTable.upgradeCompletesAtRound, currentRound),
      ),
    );

  for (const f of upgrading) {
    if (f.upgradingToLevel == null) continue;
    await db
      .update(facilitiesTable)
      .set({
        level:                   f.upgradingToLevel,
        upgradingToLevel:        null,
        upgradeCompletesAtRound: null,
        updatedAt:               new Date(),
      })
      .where(eq(facilitiesTable.id, f.id));
  }
}

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
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }

  const currentRound = await getCurrentAbsoluteRound(req);
  await checkAndCompleteUpgrades(team.id, currentRound);

  const facilities = await ensureFacilities(team.id);
  const enriched = facilities.map(f => ({
    ...f,
    upgradeRoundsRemaining: f.upgradeCompletesAtRound != null
      ? Math.max(0, f.upgradeCompletesAtRound - currentRound)
      : null,
    upgradeBuildLabel: f.level > 0 && f.level < 10 ? (BUILD_LABEL[f.level] ?? null) : null,
  }));
  res.json(enriched);
});

router.get("/facilities/upgrade-times", async (_req, res) => {
  res.json(
    Object.entries(BUILD_ROUNDS).map(([level, rounds]) => ({
      fromLevel: Number(level),
      rounds,
      label: BUILD_LABEL[Number(level)] ?? "",
    })),
  );
});

router.post("/facilities/:type/upgrade", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { type } = req.params;
  if (!FACILITY_TYPES.includes(type as any)) {
    res.status(400).json({ error: "Unknown facility type" });
    return;
  }

  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }

  await ensureFacilities(team.id);

  const currentRound = await getCurrentAbsoluteRound(req);
  await checkAndCompleteUpgrades(team.id, currentRound);

  const facility = await db.query.facilitiesTable.findFirst({
    where: and(eq(facilitiesTable.teamId, team.id), eq(facilitiesTable.type, type)),
  });
  if (!facility) { res.status(404).json({ error: "Facility not found" }); return; }

  if (facility.level >= MAX_LEVEL) {
    res.status(400).json({ error: "Facility is already at maximum level" });
    return;
  }

  if (facility.upgradingToLevel != null) {
    const roundsLeft = (facility.upgradeCompletesAtRound ?? 0) - currentRound;
    res.status(400).json({
      error: `Upgrade already in progress — completes in ${Math.max(0, roundsLeft)} round${roundsLeft !== 1 ? "s" : ""}`,
    });
    return;
  }

  const cost = upgradeCost(facility.level);
  const budget = Number(team.budget);

  if (budget < cost) {
    res.status(400).json({ error: `Insufficient budget. Upgrade costs $${cost.toLocaleString()}` });
    return;
  }

  const buildRounds = BUILD_ROUNDS[facility.level] ?? 3;
  const completesAtRound = currentRound + buildRounds;

  await db.update(teamsTable).set({
    budget:           budget - cost,
    managerRepPoints: (team.managerRepPoints ?? 0) + 5,
  }).where(eq(teamsTable.id, team.id));

  const today = await getGameDate(team.id);
  await db.insert(financeTransactionsTable).values({
    teamId:      team.id,
    type:        "expense",
    amount:      cost,
    description: `Facility upgrade: ${type.replace(/_/g, " ")} → Level ${facility.level + 1}`,
    category:    "facilities",
    date:        today,
  });

  const [updated] = await db
    .update(facilitiesTable)
    .set({
      upgradingToLevel:        facility.level + 1,
      upgradeCompletesAtRound: completesAtRound,
      updatedAt:               new Date(),
    })
    .where(eq(facilitiesTable.id, facility.id))
    .returning();

  res.json({
    ...updated,
    buildRounds,
    buildLabel: BUILD_LABEL[facility.level] ?? "",
    completesAtRound,
    roundsRemaining: buildRounds,
  });
});

router.get("/club-rating", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const team = await getActiveTeam(req);
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
