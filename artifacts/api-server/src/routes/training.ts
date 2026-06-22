import { Router } from "express";
import { db } from "@workspace/db";
import { trainingSessionsTable, playersTable, teamsTable, staffTable, facilitiesTable } from "@workspace/db";
import type { StaffMember } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

const serializeSession = (s: any) => ({ ...s, durationHours: Number(s.durationHours) });
const serializePlayer  = (p: any) => ({ ...p, height: Number(p.height), salary: Number(p.salary) });

const getTeamForUser = async (userId: string) =>
  db.query.teamsTable.findFirst({ where: eq(teamsTable.userId, userId) });

const MEDICAL_ROLES = ["physio", "physiotherapist", "fitness_trainer"];

async function getBestMedicalSkill(teamId: number): Promise<number> {
  const staff = await db.select().from(staffTable).where(eq(staffTable.teamId, teamId));
  const medics = staff.filter(s => MEDICAL_ROLES.includes(s.role));
  return medics.length > 0 ? Math.max(...medics.map(s => s.skillLevel)) : 0;
}

// ── Training Programs ─────────────────────────────────────────────────────────
// primaryStat   — gains +1 every 100 XP
// secondaryStat — gains +1 every 200 XP (half the rate of primary)
// fatigueEffect — positive adds fatigue, negative removes it
// xpModifier    — scales total session XP
// moraleBonus   — flat morale change per session
// fitnessBonus  — flat fitness boost per session
// injuryHealing — true = ticks injury weeks down (only meaningful for Recovery)

interface ProgramConfig {
  primaryStat:   string | null;
  secondaryStat: string | null;
  fatigueEffect: number;
  xpModifier:    number;
  moraleBonus:   number;
  fitnessBonus:  number;
  injuryHealing: boolean;
}

const PROGRAM_CONFIG: Record<string, ProgramConfig> = {
  "Power Camp":        { primaryStat: "power",   secondaryStat: "block",   fatigueEffect: 26,  xpModifier: 1.00, moraleBonus: 0, fitnessBonus: 0,  injuryHealing: false },
  "Agility Camp":      { primaryStat: "speed",   secondaryStat: "defense", fatigueEffect: 18,  xpModifier: 1.00, moraleBonus: 0, fitnessBonus: 0,  injuryHealing: false },
  "Serving Academy":   { primaryStat: "serve",   secondaryStat: null,      fatigueEffect: 18,  xpModifier: 1.00, moraleBonus: 2, fitnessBonus: 0,  injuryHealing: false },
  "Defensive Systems": { primaryStat: "defense", secondaryStat: "stamina", fatigueEffect: 20,  xpModifier: 0.95, moraleBonus: 0, fitnessBonus: 0,  injuryHealing: false },
  "Conditioning":      { primaryStat: "stamina", secondaryStat: null,      fatigueEffect: 12,  xpModifier: 0.85, moraleBonus: 0, fitnessBonus: 10, injuryHealing: false },
  "Recovery Program":  { primaryStat: null,      secondaryStat: null,      fatigueEffect: -30, xpModifier: 0.15, moraleBonus: 1, fitnessBonus: 18, injuryHealing: true  },
};

// Backward-compat: map old type values to new program names
const LEGACY_TYPE_MAP: Record<string, string> = {
  strength: "Power Camp",
  agility:  "Agility Camp",
  serving:  "Serving Academy",
  blocking: "Power Camp",
  defense:  "Defensive Systems",
  teamplay: "Conditioning",
  recovery: "Recovery Program",
};

const resolveProgram = (type: string): string =>
  PROGRAM_CONFIG[type] ? type : (LEGACY_TYPE_MAP[type] ?? "Conditioning");

// ── Philosophy bonuses ────────────────────────────────────────────────────────

const PHILOSOPHY_BONUSES: Record<string, Record<string, number>> = {
  "Power Volleyball":     { "Power Camp": 1.15, "Serving Academy": 1.05 },
  "Fast Volleyball":      { "Agility Camp": 1.15, "Serving Academy": 1.10 },
  "Defensive Volleyball": { "Defensive Systems": 1.15, "Conditioning": 1.10 },
};

// ── Age-based development modifier ───────────────────────────────────────────

function getAgeModifier(age: number): number {
  if (age <= 20) return 1.25;
  if (age <= 25) return 1.10;
  if (age <= 29) return 1.00;
  if (age <= 33) return 0.90;
  return 0.80;
}

// ── Coach effect ─────────────────────────────────────────────────────────────

export type CoachEffect = {
  coachName: string;
  coachSpeciality: string;
  personality: string;
  overallRating: number;
  specialityMultiplier: number;
  personalityMultiplier: number;
  ratingMultiplier: number;
  totalMultiplier: number;
  moraleEffect: number;
  extraFatigueRecovery: number;
};

const SPECIALITY_BONUSES: Record<string, { program: string; multiplier: number }[]> = {
  "Technical":         [
    { program: "Serving Academy",    multiplier: 1.10 },
    { program: "Power Camp",         multiplier: 1.05 },
  ],
  "Athletic":          [
    { program: "Power Camp",         multiplier: 1.10 },
    { program: "Agility Camp",       multiplier: 1.10 },
  ],
  "Defensive":         [
    { program: "Defensive Systems",  multiplier: 1.10 },
  ],
  "Conditioning":      [
    { program: "Recovery Program",   multiplier: 1.15 },
    { program: "Conditioning",       multiplier: 1.10 },
  ],
  "Youth Development": [],
  "General":           [],
};

const PERSONALITY_CONFIG: Record<string, { xpMultiplier: number; moraleEffect: number; extraFatigueRecovery: number }> = {
  "Motivator":       { xpMultiplier: 1.05, moraleEffect:  2, extraFatigueRecovery: 0 },
  "Demanding":       { xpMultiplier: 1.15, moraleEffect: -2, extraFatigueRecovery: 0 },
  "Player Friendly": { xpMultiplier: 0.90, moraleEffect:  3, extraFatigueRecovery: 0 },
  "Disciplinarian":  { xpMultiplier: 1.00, moraleEffect: -1, extraFatigueRecovery: 8 },
};

function computeCoachEffect(coach: StaffMember, programName: string, playerAge?: number): CoachEffect {
  const ratingMultiplier = Math.round((1 + (coach.overallRating - 75) / 100) * 100) / 100;
  const bonusEntry = (SPECIALITY_BONUSES[coach.coachSpeciality] ?? []).find(b => b.program === programName);
  let specialityMultiplier = bonusEntry ? bonusEntry.multiplier : 1.0;
  if (coach.coachSpeciality === "Youth Development" && playerAge !== undefined && playerAge < 21) {
    specialityMultiplier = 1.20;
  }
  const pc = PERSONALITY_CONFIG[coach.personality] ?? PERSONALITY_CONFIG["Motivator"];
  return {
    coachName: coach.name,
    coachSpeciality: coach.coachSpeciality,
    personality: coach.personality,
    overallRating: coach.overallRating,
    specialityMultiplier,
    personalityMultiplier: pc.xpMultiplier,
    ratingMultiplier,
    totalMultiplier: Math.round(specialityMultiplier * pc.xpMultiplier * ratingMultiplier * 100) / 100,
    moraleEffect: pc.moraleEffect,
    extraFatigueRecovery: pc.extraFatigueRecovery,
  };
}

// ── Training XP + stat update ─────────────────────────────────────────────────

// ── Potential multipliers (uses true `potential` from DB, never sent to client) ──

const POTENTIAL_MULTIPLIERS: Record<string, number> = {
  "Generational": 1.30,
  "Elite":        1.15,
  "High":         1.00,
  "Average":      0.90,
  "Low":          0.80,
};

const POINTS_PER_SESSION_MIN = 25;
const POINTS_PER_SESSION_MAX = 35;
const PRIMARY_THRESHOLD   = 100;
const SECONDARY_THRESHOLD = 200;

const applyFatigueAndStats = async (
  playerId: number,
  programType: string,
  coach?: StaffMember | null,
  teamPhilosophy?: string | null,
  facilityMultiplier = 1.0,
  psychLevel = 1,
  medCentreLevel = 1,
) => {
  const player = await db.query.playersTable.findFirst({ where: eq(playersTable.id, playerId) });
  if (!player) return null;

  const programName = resolveProgram(programType);
  const program     = PROGRAM_CONFIG[programName];

  const baseXp = Math.floor(
    Math.random() * (POINTS_PER_SESSION_MAX - POINTS_PER_SESSION_MIN + 1)
  ) + POINTS_PER_SESSION_MIN;

  let coachEffect: CoachEffect | null = null;
  let coachXpMultiplier = 1.0;
  if (coach) {
    coachEffect       = computeCoachEffect(coach, programName, player.age);
    coachXpMultiplier = coachEffect.totalMultiplier;
  }

  const ageModifier = getAgeModifier(player.age);
  const philosophyMultiplier = teamPhilosophy
    ? (PHILOSOPHY_BONUSES[teamPhilosophy]?.[programName] ?? 1.0)
    : 1.0;
  const potentialMultiplier = POTENTIAL_MULTIPLIERS[(player.potential as string) ?? "Average"] ?? 1.0;

  const totalMultiplier = program.xpModifier * coachXpMultiplier * ageModifier * philosophyMultiplier * potentialMultiplier * facilityMultiplier;
  const sessionXp = Math.round(baseXp * totalMultiplier);

  const prevPoints = player.trainingPoints;
  const newPoints  = prevPoints + sessionXp;

  // Primary stat — crosses a threshold every 100 XP
  const prevPrimaryMilestone = Math.floor(prevPoints / PRIMARY_THRESHOLD);
  const newPrimaryMilestone  = Math.floor(newPoints  / PRIMARY_THRESHOLD);
  const primaryGain = newPrimaryMilestone - prevPrimaryMilestone;

  // Secondary stat — crosses a threshold every 200 XP (half rate)
  const prevSecondaryMilestone = Math.floor(prevPoints / SECONDARY_THRESHOLD);
  const newSecondaryMilestone  = Math.floor(newPoints  / SECONDARY_THRESHOLD);
  const secondaryGain = newSecondaryMilestone - prevSecondaryMilestone;

  const statGains: Record<string, number> = {};
  if (program.primaryStat   && primaryGain   > 0) statGains[program.primaryStat]   = primaryGain;
  if (program.secondaryStat && secondaryGain > 0) {
    statGains[program.secondaryStat] = (statGains[program.secondaryStat] ?? 0) + secondaryGain;
  }

  const updates: Record<string, unknown> = { trainingPoints: newPoints };

  // Apply stat gains
  const applyStatGain = (stat: string, gain: number) => {
    const cur = player[stat as keyof typeof player] as number;
    updates[stat] = Math.min(99, cur + gain);
  };
  if (program.primaryStat   && primaryGain   > 0) applyStatGain(program.primaryStat,   primaryGain);
  if (program.secondaryStat && secondaryGain > 0) applyStatGain(program.secondaryStat, secondaryGain);

  // Morale (program + coach + Psychology Centre)
  // Psychology Centre: +0 bonus at L1, +2 extra morale per session at L10
  const psychMoraleBonus = Math.round((psychLevel - 1) * (2 / 9));
  const totalMorale = program.moraleBonus + (coachEffect?.moraleEffect ?? 0) + psychMoraleBonus;
  if (totalMorale !== 0) {
    updates.morale = Math.min(100, Math.max(0, player.morale + totalMorale));
  }

  // Fatigue / fitness / injury
  if (program.fatigueEffect < 0) {
    const recovery = Math.abs(program.fatigueEffect) + (coachEffect?.extraFatigueRecovery ?? 0);
    updates.fatigue = Math.max(0, player.fatigue - recovery);
    updates.fitness = Math.min(100, ((player.fitness as number) ?? 100) + program.fitnessBonus);
    updates.consecutiveMatchesPlayed = 0;

    if (program.injuryHealing) {
      const weeksLeft = (player.injuryWeeksRemaining as number) ?? 0;
      if (weeksLeft > 0 && player.teamId) {
        const physioSkill = await getBestMedicalSkill(player.teamId);
        const extraTick   = Math.random() < physioSkill / 250 ? 1 : 0;
        // Medical Centre: +0 at L1, −1 extra week per Recovery session at L10
        const facilityReduction = (medCentreLevel - 1) * (1.0 / 9);
        const newWeeks    = Math.max(0, weeksLeft - 1 - extraTick - facilityReduction);
        updates.injuryWeeksRemaining = newWeeks;
        if (newWeeks === 0) { updates.injuryStatus = "Healthy"; updates.isInjured = false; }
      }
    }
  } else {
    updates.fatigue = Math.min(100, player.fatigue + program.fatigueEffect);
    if (program.fitnessBonus > 0) {
      updates.fitness = Math.min(100, ((player.fitness as number) ?? 100) + program.fitnessBonus);
    }
  }

  const [newPlayer] = await db.update(playersTable).set(updates)
    .where(eq(playersTable.id, playerId)).returning();

  const nextMilestone = (newPrimaryMilestone + 1) * PRIMARY_THRESHOLD;
  return {
    newPlayer: serializePlayer(newPlayer),
    statGains,
    xpGained: sessionXp,
    baseXp,
    totalXp: newPoints,
    nextThreshold: nextMilestone,
    xpToNextStat: nextMilestone - newPoints,
    coachEffect,
    ageModifier,
    philosophyMultiplier,
    potentialMultiplier,
    programName,
  };
};

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/training", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.json([]); return; }
  const sessions = await db.select().from(trainingSessionsTable)
    .where(eq(trainingSessionsTable.teamId, team.id));
  const withPlayers = await Promise.all(sessions.map(async (s) => {
    const player = await db.query.playersTable.findFirst({ where: eq(playersTable.id, s.playerId) });
    const coach  = s.coachId ? await db.query.staffTable.findFirst({ where: eq(staffTable.id, s.coachId) }) : null;
    return { ...serializeSession(s), player: player ? serializePlayer(player) : null, coach: coach ?? null };
  }));
  res.json(withPlayers);
});

router.post("/training", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const { playerId, type, focus, durationHours, scheduledAt, coachId } = req.body;
  const programName = resolveProgram(type);
  const [session] = await db.insert(trainingSessionsTable).values({
    teamId: team.id,
    playerId: Number(playerId),
    type: programName,
    focus: focus || programName,
    durationHours: String(durationHours || 2),
    scheduledAt,
    coachId: coachId ? Number(coachId) : null,
  }).returning();
  res.status(201).json(serializeSession(session));
});

router.post("/training/team", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const { type, focus, durationHours, scheduledAt, coachId } = req.body;
  const programName = resolveProgram(type);

  const activePlayers = await db.select().from(playersTable)
    .where(and(eq(playersTable.teamId, team.id), eq(playersTable.isActive, true)));
  if (activePlayers.length === 0) { res.status(400).json({ error: "No active players" }); return; }

  const sessions = await Promise.all(activePlayers.map(player =>
    db.insert(trainingSessionsTable).values({
      teamId: team.id,
      playerId: player.id,
      type: programName,
      focus: focus || programName,
      durationHours: String(durationHours || 2),
      scheduledAt,
      coachId: coachId ? Number(coachId) : null,
    }).returning()
  ));
  res.status(201).json(sessions.flat().map(serializeSession));
});

router.post("/training/:id/complete", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const session = await db.query.trainingSessionsTable.findFirst({ where: eq(trainingSessionsTable.id, id) });
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const [updatedSession] = await db.update(trainingSessionsTable).set({ status: "completed" })
    .where(eq(trainingSessionsTable.id, id)).returning();

  const coach = session.coachId
    ? await db.query.staffTable.findFirst({ where: eq(staffTable.id, session.coachId) })
    : null;

  // Fetch team philosophy for bonus calculation
  const team = await db.query.teamsTable.findFirst({ where: eq(teamsTable.id, session.teamId) });
  const teamPhilosophy = team?.trainingPhilosophy ?? null;

  // Load all facility levels for training bonuses
  const facilityRows = await db.select().from(facilitiesTable).where(eq(facilitiesTable.teamId, session.teamId));
  const facilityLevels = Object.fromEntries(facilityRows.map(f => [f.type, f.level]));

  const facilityMultiplier = 1 + ((facilityLevels.training_complex  ?? 1) - 1) * (0.20 / 9);
  const psychLevel         = facilityLevels.psychology_centre ?? 1;
  const medCentreLevel     = facilityLevels.medical_centre    ?? 1;

  const result = await applyFatigueAndStats(session.playerId, session.type, coach ?? null, teamPhilosophy, facilityMultiplier, psychLevel, medCentreLevel);
  if (result) {
    const { newPlayer, statGains, xpGained, baseXp, totalXp, xpToNextStat, coachEffect, ageModifier, philosophyMultiplier, programName } = result;
    // Young player development bonus — award manager rep when a player aged ≤22 gains a stat
    if (Object.keys(statGains).length > 0 && (newPlayer.age ?? 99) <= 22 && team) {
      await db.update(teamsTable)
        .set({ managerRepPoints: (team.managerRepPoints ?? 0) + 5 })
        .where(eq(teamsTable.id, team.id));
    }
    res.json({
      session: { ...serializeSession(updatedSession), player: newPlayer },
      statGains,
      newStats: newPlayer,
      xpGained,
      baseXp,
      totalXp,
      xpToNextStat,
      coachEffect,
      ageModifier,
      philosophyMultiplier,
      programName,
      potentialMultiplier: result.potentialMultiplier,
    });
    return;
  }
  res.json({ session: serializeSession(updatedSession), statGains: {}, newStats: null, coachEffect: null });
});

router.get("/training/plan", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.json({ weeklyLoad: "light", averageFitness: 80, averageMorale: 80, scheduledSessions: [], completedThisWeek: 0 }); return; }

  const sessions = await db.select().from(trainingSessionsTable).where(eq(trainingSessionsTable.teamId, team.id));
  const scheduled = sessions.filter(s => s.status === "scheduled");
  const completedThisWeek = sessions.filter(s => s.status === "completed").length;
  const load = scheduled.length > 6 ? "peak" : scheduled.length > 4 ? "intense" : scheduled.length > 2 ? "moderate" : "light";

  const players = await db.select().from(playersTable).where(eq(playersTable.teamId, team.id));
  const avgFitness = players.length > 0 ? players.reduce((acc, p) => acc + p.stamina, 0) / players.length : 80;
  const avgMorale  = players.length > 0 ? players.reduce((acc, p) => acc + p.morale,  0) / players.length : 80;
  const avgFatigue = players.length > 0 ? players.reduce((acc, p) => acc + p.fatigue, 0) / players.length : 0;

  res.json({
    weeklyLoad: load,
    averageFitness: Math.round(avgFitness),
    averageMorale: Math.round(avgMorale),
    averageFatigue: Math.round(avgFatigue),
    scheduledSessions: scheduled.map(s => ({ ...s, durationHours: Number(s.durationHours), player: null })),
    completedThisWeek,
  });
});

export default router;
