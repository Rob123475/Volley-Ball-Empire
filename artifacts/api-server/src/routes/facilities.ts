import { Router } from "express";
import { db } from "@workspace/db";
import { facilitiesTable, teamsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

const FACILITY_TYPES = [
  "training_complex",
  "medical_centre",
  "sports_science_lab",
  "psychology_centre",
  "youth_academy",
  "olympic_performance_centre",
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

  await db.update(teamsTable).set({ budget: String(budget - cost) }).where(eq(teamsTable.id, team.id));

  const [upgraded] = await db
    .update(facilitiesTable)
    .set({ level: facility.level + 1, updatedAt: new Date() })
    .where(eq(facilitiesTable.id, facility.id))
    .returning();

  res.json(upgraded);
});

export default router;
