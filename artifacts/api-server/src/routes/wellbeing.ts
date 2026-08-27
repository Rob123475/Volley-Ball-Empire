import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { db } from "@workspace/db";
import {
  teamsTable,
  playersTable,
  facilitiesTable,
  wellbeingEffectsTable,
  financeTransactionsTable,
  activeCampsTable,
  seasonsTable,
} from "@workspace/db";
import { eq, and, gt, lte, desc } from "drizzle-orm";
import { getGameDate } from "../utils/gameDate.js";

const router = Router();


type CampDef = {
  name: string;
  cost: number;
  durationRounds: number;
  durationLabel: string;
  effectType?: string;
  baseDuration?: number;
  morale?: number;
  fatigue?: number;
  fitness?: number;
  trainingPoints?: number;
};

const CAMPS: Record<string, CampDef> = {
  team_retreat:       { name: "Team Retreat",             cost: 15_000, durationRounds: 1, durationLabel: "3 days",   morale: 15, fatigue: -8 },
  sports_psychology:  { name: "Sports Psychology Camp",   cost: 30_000, durationRounds: 2, durationLabel: "1 week",   morale: 10, effectType: "psych_camp",     baseDuration: 8 },
  recovery_retreat:   { name: "Recovery Retreat",         cost: 25_000, durationRounds: 2, durationLabel: "1 week",   fatigue: -20, fitness: 5, effectType: "recovery_camp", baseDuration: 6 },
  holiday_break:      { name: "Holiday Break",            cost: 10_000, durationRounds: 3, durationLabel: "2 weeks",  morale: 25, fitness: -5 },
  intensive_training: { name: "Intensive Training Block", cost: 20_000, durationRounds: 3, durationLabel: "2 weeks",  trainingPoints: 50, fatigue: 12, morale: -5 },
};

const serializeEffect = (e: { id: number; effectType: string; matchesRemaining: number; createdAt: Date }) => ({
  id:               e.id,
  effectType:       e.effectType,
  matchesRemaining: e.matchesRemaining,
  createdAt:        e.createdAt.toISOString(),
});

async function getCurrentAbsoluteRound(): Promise<number> {
  const [activeSeason] = await db
    .select()
    .from(seasonsTable)
    .where(eq(seasonsTable.status, "active"))
    .orderBy(desc(seasonsTable.year))
    .limit(1);
  if (!activeSeason) return 0;
  return (activeSeason.year - 2026) * 70 + activeSeason.currentRound;
}

async function checkAndApplyCamps(teamId: number, currentRound: number): Promise<void> {
  const completedCamps = await db
    .select()
    .from(activeCampsTable)
    .where(and(eq(activeCampsTable.teamId, teamId), lte(activeCampsTable.completesAtRound, currentRound)));

  for (const camp of completedCamps) {
    const fx = camp.pendingEffects;

    const activePlayers = await db
      .select()
      .from(playersTable)
      .where(and(eq(playersTable.teamId, teamId), eq(playersTable.isActive, true)));

    for (const player of activePlayers) {
      const updates: Record<string, unknown> = {};
      if (fx.moraleBonus !== 0)     updates.morale         = Math.min(100, Math.max(0, player.morale + fx.moraleBonus));
      if (fx.fatigueChange !== 0)   updates.fatigue        = Math.min(100, Math.max(0, player.fatigue + fx.fatigueChange));
      if (fx.fitnessChange !== 0)   updates.fitness        = Math.min(100, Math.max(0, (player.fitness as number ?? 100) + fx.fitnessChange));
      if (fx.trainingPtBonus > 0)   updates.trainingPoints = (player.trainingPoints ?? 0) + fx.trainingPtBonus;
      if (Object.keys(updates).length > 0) {
        await db.update(playersTable).set(updates).where(eq(playersTable.id, player.id));
      }
    }

    if (fx.effectType && fx.duration > 0) {
      await db.delete(wellbeingEffectsTable).where(
        and(eq(wellbeingEffectsTable.teamId, teamId), eq(wellbeingEffectsTable.effectType, fx.effectType))
      );
      await db.insert(wellbeingEffectsTable).values({
        teamId,
        effectType: fx.effectType,
        matchesRemaining: fx.duration,
      });
    }

    await db.delete(activeCampsTable).where(eq(activeCampsTable.id, camp.id));
  }
}

router.get("/wellbeing/status", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }

  const currentRound = await getCurrentAbsoluteRound();
  await checkAndApplyCamps(team.id, currentRound);

  const [activeEffects, [runningCamp]] = await Promise.all([
    db.select().from(wellbeingEffectsTable).where(
      and(eq(wellbeingEffectsTable.teamId, team.id), gt(wellbeingEffectsTable.matchesRemaining, 0))
    ),
    db.select().from(activeCampsTable).where(eq(activeCampsTable.teamId, team.id)).limit(1),
  ]);

  const activeCamp = runningCamp
    ? {
        id:               runningCamp.id,
        campType:         runningCamp.campType,
        campName:         runningCamp.campName,
        completesAtRound: runningCamp.completesAtRound,
        roundsRemaining:  Math.max(0, runningCamp.completesAtRound - currentRound),
      }
    : null;

  res.json({
    teamBudget:   Number(team.budget ?? 0),
    activeEffects: activeEffects.map(serializeEffect),
    activeCamp,
  });
});

router.get("/wellbeing/camps", async (_req, res) => {
  res.json(
    Object.entries(CAMPS).map(([id, c]) => ({
      id,
      name:          c.name,
      cost:          c.cost,
      durationRounds: c.durationRounds,
      durationLabel: c.durationLabel,
    })),
  );
});

router.post("/wellbeing/run", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }

  const { campType } = req.body as { campType: string };
  const camp = CAMPS[campType];
  if (!camp) { res.status(400).json({ error: "Unknown camp type" }); return; }

  const currentRound = await getCurrentAbsoluteRound();
  await checkAndApplyCamps(team.id, currentRound);

  const [existingCamp] = await db
    .select()
    .from(activeCampsTable)
    .where(eq(activeCampsTable.teamId, team.id))
    .limit(1);

  if (existingCamp) {
    const roundsLeft = Math.max(0, existingCamp.completesAtRound - currentRound);
    res.status(400).json({
      error: `${existingCamp.campName} is still in progress — completes in ${roundsLeft} round${roundsLeft !== 1 ? "s" : ""}`,
    });
    return;
  }

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
  const psychLevel       = fl.psychology_centre  ?? 1;
  const trainingLevel    = fl.training_complex   ?? 1;
  const medLevel         = fl.medical_centre     ?? 1;
  const labLevel         = fl.sports_science_lab ?? 1;
  const nutritionLevel   = fl.nutrition_centre   ?? 1;
  const beachResortLevel = fl.beach_resort       ?? 1;

  let moraleBonus     = camp.morale         ?? 0;
  let fatigueChange   = camp.fatigue        ?? 0;
  let fitnessChange   = camp.fitness        ?? 0;
  let trainingPtBonus = camp.trainingPoints ?? 0;
  let duration        = camp.baseDuration   ?? 0;

  if (campType === "team_retreat" || campType === "sports_psychology") {
    moraleBonus += Math.round((psychLevel - 1) * (5 / 9));
  }
  if (campType === "sports_psychology") {
    duration += Math.round((psychLevel - 1) * (4 / 9));
  }
  if (campType === "intensive_training") {
    trainingPtBonus += Math.round((trainingLevel - 1) * (25 / 9));
  }
  if (campType === "recovery_retreat") {
    fatigueChange -= Math.round((medLevel - 1) * (5 / 9));
    fatigueChange -= Math.round((labLevel  - 1) * (5 / 9));
    duration      += Math.round((medLevel  - 1) * (2 / 9));
  }
  if (campType === "recovery_retreat") {
    fatigueChange -= Math.round((nutritionLevel - 1) * (5 / 9));
  }
  moraleBonus += Math.round((beachResortLevel - 1) * (8 / 9));

  const completesAtRound = currentRound + camp.durationRounds;

  await db.insert(activeCampsTable).values({
    teamId:           team.id,
    campType,
    campName:         camp.name,
    completesAtRound,
    pendingEffects: {
      moraleBonus,
      fatigueChange,
      fitnessChange,
      trainingPtBonus,
      duration,
      effectType: camp.effectType ?? null,
    },
  });

  await db.update(teamsTable)
    .set({ budget: budget - camp.cost })
    .where(eq(teamsTable.id, team.id));

  await db.insert(financeTransactionsTable).values({
    teamId:      team.id,
    type:        "expense",
    amount:      -camp.cost,
    description: camp.name,
    category:    "wellbeing",
    date:        await getGameDate(team.id),
  });

  const activeEffects = await db.select().from(wellbeingEffectsTable).where(
    and(eq(wellbeingEffectsTable.teamId, team.id), gt(wellbeingEffectsTable.matchesRemaining, 0))
  );

  res.json({
    message:        `${camp.name} started — effects apply in ${camp.durationRounds} round${camp.durationRounds !== 1 ? "s" : ""}`,
    activeEffects:  activeEffects.map(serializeEffect),
    activeCamp: {
      id:               -1,
      campType,
      campName:         camp.name,
      completesAtRound,
      roundsRemaining:  camp.durationRounds,
    },
  });
});

export default router;
