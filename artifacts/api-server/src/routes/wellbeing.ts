import { Router } from "express";
import { db } from "@workspace/db";
import { teamsTable, playersTable, facilitiesTable, wellbeingEffectsTable, financeTransactionsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";

const router = Router();

const getTeamForUser = async (userId: string) =>
  db.query.teamsTable.findFirst({ where: eq(teamsTable.userId, userId) });

type CampDef = {
  name: string;
  cost: number;
  effectType?: string;
  baseDuration?: number;
  morale?: number;
  fatigue?: number;
  fitness?: number;
  trainingPoints?: number;
};

const CAMPS: Record<string, CampDef> = {
  team_retreat:       { name: "Team Retreat",             cost: 15_000, morale: 15, fatigue: -8 },
  sports_psychology:  { name: "Sports Psychology Camp",   cost: 30_000, morale: 10, effectType: "psych_camp",     baseDuration: 8 },
  recovery_retreat:   { name: "Recovery Retreat",         cost: 25_000, fatigue: -20, fitness: 5, effectType: "recovery_camp", baseDuration: 6 },
  holiday_break:      { name: "Holiday Break",            cost: 10_000, morale: 25, fitness: -5 },
  intensive_training: { name: "Intensive Training Block", cost: 20_000, trainingPoints: 50, fatigue: 12, morale: -5 },
};

const serializeEffect = (e: { id: number; effectType: string; matchesRemaining: number; createdAt: Date }) => ({
  id:               e.id,
  effectType:       e.effectType,
  matchesRemaining: e.matchesRemaining,
  createdAt:        e.createdAt.toISOString(),
});

router.get("/wellbeing/status", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team" }); return; }

  const activeEffects = await db.select().from(wellbeingEffectsTable).where(
    and(eq(wellbeingEffectsTable.teamId, team.id), gt(wellbeingEffectsTable.matchesRemaining, 0))
  );

  res.json({
    teamBudget: Number(team.budget ?? 0),
    activeEffects: activeEffects.map(serializeEffect),
  });
});

router.post("/wellbeing/run", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team" }); return; }

  const { campType } = req.body as { campType: string };
  const camp = CAMPS[campType];
  if (!camp) { res.status(400).json({ error: "Unknown camp type" }); return; }

  const budget = Number(team.budget ?? 0);
  if (budget < camp.cost) {
    res.status(400).json({
      error: `Insufficient funds. Need $${camp.cost.toLocaleString()}, have $${Math.round(budget).toLocaleString()}`,
    });
    return;
  }

  // Load facility levels for bonuses
  const facilityRows = await db.select().from(facilitiesTable).where(eq(facilitiesTable.teamId, team.id));
  const fl: Record<string, number> = Object.fromEntries(facilityRows.map(f => [f.type, f.level]));
  const psychLevel    = fl.psychology_centre  ?? 1;
  const trainingLevel = fl.training_complex   ?? 1;
  const medLevel      = fl.medical_centre     ?? 1;
  const labLevel      = fl.sports_science_lab ?? 1;

  let moraleBonus     = camp.morale         ?? 0;
  let fatigueChange   = camp.fatigue        ?? 0;
  let fitnessChange   = camp.fitness        ?? 0;
  let trainingPtBonus = camp.trainingPoints ?? 0;
  let duration        = camp.baseDuration   ?? 0;

  // Psychology Centre: improves morale from Team Retreat + Sports Psychology Camp (+0→+5 at L10)
  if (campType === "team_retreat" || campType === "sports_psychology") {
    moraleBonus += Math.round((psychLevel - 1) * (5 / 9));
  }
  // Psychology Centre: extends Sports Psychology Camp duration (+0→+4 matches at L10)
  if (campType === "sports_psychology") {
    duration += Math.round((psychLevel - 1) * (4 / 9));
  }
  // Training Complex: more XP from Intensive Training Block (+0→+25 at L10)
  if (campType === "intensive_training") {
    trainingPtBonus += Math.round((trainingLevel - 1) * (25 / 9));
  }
  // Medical Centre + Sports Science Lab: improve Recovery Retreat fatigue reduction and duration
  if (campType === "recovery_retreat") {
    fatigueChange -= Math.round((medLevel - 1) * (5 / 9));
    fatigueChange -= Math.round((labLevel  - 1) * (5 / 9));
    duration      += Math.round((medLevel  - 1) * (2 / 9));
  }

  // Apply stat changes to all active players
  const activePlayers = await db.select().from(playersTable).where(
    and(eq(playersTable.teamId, team.id), eq(playersTable.isActive, true))
  );

  for (const player of activePlayers) {
    const updates: Record<string, unknown> = {};
    if (moraleBonus !== 0)     updates.morale         = Math.min(100, Math.max(0, player.morale + moraleBonus));
    if (fatigueChange !== 0)   updates.fatigue        = Math.min(100, Math.max(0, player.fatigue + fatigueChange));
    if (fitnessChange !== 0)   updates.fitness        = Math.min(100, Math.max(0, (player.fitness as number ?? 100) + fitnessChange));
    if (trainingPtBonus > 0)   updates.trainingPoints = (player.trainingPoints ?? 0) + trainingPtBonus;
    if (Object.keys(updates).length > 0) {
      await db.update(playersTable).set(updates).where(eq(playersTable.id, player.id));
    }
  }

  // Store temporary effects, replacing any existing one of the same type
  if (camp.effectType && duration > 0) {
    await db.delete(wellbeingEffectsTable).where(
      and(eq(wellbeingEffectsTable.teamId, team.id), eq(wellbeingEffectsTable.effectType, camp.effectType))
    );
    await db.insert(wellbeingEffectsTable).values({
      teamId: team.id,
      effectType: camp.effectType,
      matchesRemaining: duration,
    });
  }

  // Deduct cost and record finance transaction
  await db.update(teamsTable)
    .set({ budget: String(budget - camp.cost) })
    .where(eq(teamsTable.id, team.id));

  await db.insert(financeTransactionsTable).values({
    teamId:      team.id,
    type:        "expense",
    amount:      String(-camp.cost),
    description: camp.name,
    category:    "wellbeing",
    date:        new Date().toISOString().split("T")[0]!,
  });

  const activeEffects = await db.select().from(wellbeingEffectsTable).where(
    and(eq(wellbeingEffectsTable.teamId, team.id), gt(wellbeingEffectsTable.matchesRemaining, 0))
  );

  res.json({
    message:        `${camp.name} completed`,
    updatedPlayers: activePlayers.length,
    activeEffects:  activeEffects.map(serializeEffect),
  });
});

export default router;
