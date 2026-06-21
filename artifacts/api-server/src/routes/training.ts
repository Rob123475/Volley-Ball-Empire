import { Router } from "express";
import { db } from "@workspace/db";
import { trainingSessionsTable, playersTable, teamsTable, staffTable } from "@workspace/db";
import type { StaffMember } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

const serializeSession = (s: any) => ({ ...s, durationHours: Number(s.durationHours) });
const serializePlayer  = (p: any) => ({ ...p, height: Number(p.height), salary: Number(p.salary) });

const getTeamForUser = async (userId: string) =>
  db.query.teamsTable.findFirst({ where: eq(teamsTable.userId, userId) });

const typeToStat: Record<string, string> = {
  strength: "power", agility: "speed", serving: "serve",
  blocking: "block", defense: "defense", teamplay: "stamina", recovery: "stamina",
};

const MEDICAL_ROLES = ["physio", "physiotherapist", "fitness_trainer"];

async function getBestMedicalSkill(teamId: number): Promise<number> {
  const staff = await db.select().from(staffTable).where(eq(staffTable.teamId, teamId));
  const medics = staff.filter(s => MEDICAL_ROLES.includes(s.role));
  return medics.length > 0 ? Math.max(...medics.map(s => s.skillLevel)) : 0;
}

// ── Coach effect calculation ───────────────────────────────────────────────
// Exported so the training complete route can include it in the response.

export type CoachEffect = {
  coachName: string;
  coachSpeciality: string;
  personality: string;
  overallRating: number;
  specialityMultiplier: number;  // boost applied to XP for this session type
  personalityMultiplier: number; // XP scale factor from personality
  ratingMultiplier: number;      // scale factor from overall rating
  totalMultiplier: number;       // product of all three
  moraleEffect: number;          // +/- applied to player morale after session
  extraFatigueRecovery: number;  // extra fatigue reduction (recovery sessions only)
};

/** Maps training type to the specialities that give it a bonus and by how much */
const SPECIALITY_BONUSES: Record<string, { speciality: string; multiplier: number }[]> = {
  serving:  [{ speciality: "Technical",         multiplier: 1.10 }],
  blocking: [{ speciality: "Technical",         multiplier: 1.10 }],
  strength: [{ speciality: "Athletic",          multiplier: 1.10 }],
  agility:  [{ speciality: "Athletic",          multiplier: 1.10 }],
  defense:  [{ speciality: "Defensive",         multiplier: 1.10 }],
  recovery: [{ speciality: "Conditioning",      multiplier: 1.15 }],
  teamplay: [{ speciality: "Youth Development", multiplier: 1.00 }], // handled per player age
};

const PERSONALITY_CONFIG: Record<string, { xpMultiplier: number; moraleEffect: number; extraFatigueRecovery: number }> = {
  "Motivator":       { xpMultiplier: 1.05, moraleEffect:  2, extraFatigueRecovery: 0  },
  "Demanding":       { xpMultiplier: 1.15, moraleEffect: -2, extraFatigueRecovery: 0  },
  "Player Friendly": { xpMultiplier: 0.90, moraleEffect:  3, extraFatigueRecovery: 0  },
  "Disciplinarian":  { xpMultiplier: 1.00, moraleEffect: -1, extraFatigueRecovery: 8  },
};

function computeCoachEffect(coach: StaffMember, sessionType: string, playerAge?: number): CoachEffect {
  // Rating multiplier: 1.0 at rating 75; ±0.01 per point above/below
  const ratingMultiplier = Math.round((1 + (coach.overallRating - 75) / 100) * 100) / 100;

  // Speciality multiplier
  const bonusEntry = (SPECIALITY_BONUSES[sessionType] ?? []).find(b => b.speciality === coach.coachSpeciality);
  let specialityMultiplier = bonusEntry ? bonusEntry.multiplier : 1.0;

  // Youth Development special case: +20% XP for players under 21
  if (coach.coachSpeciality === "Youth Development" && playerAge !== undefined && playerAge < 21) {
    specialityMultiplier = 1.20;
  }

  // Personality multiplier
  const personalityConf = PERSONALITY_CONFIG[coach.personality] ?? PERSONALITY_CONFIG["Motivator"];

  const totalMultiplier = Math.round(specialityMultiplier * personalityConf.xpMultiplier * ratingMultiplier * 100) / 100;

  return {
    coachName: coach.name,
    coachSpeciality: coach.coachSpeciality,
    personality: coach.personality,
    overallRating: coach.overallRating,
    specialityMultiplier,
    personalityMultiplier: personalityConf.xpMultiplier,
    ratingMultiplier,
    totalMultiplier,
    moraleEffect: personalityConf.moraleEffect,
    extraFatigueRecovery: personalityConf.extraFatigueRecovery,
  };
}

// ── Training XP accumulation ──────────────────────────────────────────────────
// Each session adds XP to the player's persistent trainingPoints bank.
// Every 100 points crossed = +1 to the targeted stat.
// Points never reset between seasons — they carry over until retirement/draft exit.
// Coach bonuses: speciality × personality × rating multipliers scale XP.
const POINTS_PER_SESSION_MIN = 25;
const POINTS_PER_SESSION_MAX = 35;
const POINTS_THRESHOLD = 100;

const applyFatigueAndStats = async (
  playerId: number,
  type: string,
  coach?: StaffMember | null,
) => {
  const player = await db.query.playersTable.findFirst({ where: eq(playersTable.id, playerId) });
  if (!player) return null;

  // Base XP for this session
  const baseXp = Math.floor(Math.random() * (POINTS_PER_SESSION_MAX - POINTS_PER_SESSION_MIN + 1)) + POINTS_PER_SESSION_MIN;

  // Apply coach multiplier (default 1.0 if no coach)
  let coachEffect: CoachEffect | null = null;
  let xpMultiplier = 1.0;

  if (coach) {
    coachEffect = computeCoachEffect(coach, type, player.age);
    xpMultiplier = coachEffect.totalMultiplier;
  }

  const sessionXp = Math.round(baseXp * xpMultiplier);
  const prevPoints = player.trainingPoints;
  const newPoints  = prevPoints + sessionXp;

  // How many full 100-point thresholds were crossed this session
  const prevMilestone = Math.floor(prevPoints / POINTS_THRESHOLD);
  const newMilestone  = Math.floor(newPoints  / POINTS_THRESHOLD);
  const statGain = newMilestone - prevMilestone; // 0 or 1 (rarely 2 on a big session)

  const stat = typeToStat[type] || "stamina";
  const statGains: Record<string, number> = statGain > 0 ? { [stat]: statGain } : {};

  const updates: Record<string, unknown> = { trainingPoints: newPoints };

  if (statGain > 0) {
    if (stat === "power")   updates.power   = Math.min(99, player.power   + statGain);
    if (stat === "speed")   updates.speed   = Math.min(99, player.speed   + statGain);
    if (stat === "serve")   updates.serve   = Math.min(99, player.serve   + statGain);
    if (stat === "block")   updates.block   = Math.min(99, player.block   + statGain);
    if (stat === "defense") updates.defense = Math.min(99, player.defense + statGain);
    if (stat === "stamina") updates.stamina = Math.min(99, player.stamina + statGain);
  }

  // Apply coach morale / fatigue effects
  if (coachEffect) {
    if (coachEffect.moraleEffect !== 0) {
      updates.morale = Math.min(100, Math.max(0, player.morale + coachEffect.moraleEffect));
    }
  }

  if (type === "recovery") {
    const baseRecovery = 25 + (coachEffect?.extraFatigueRecovery ?? 0);
    updates.fatigue  = Math.max(0, player.fatigue - baseRecovery);
    updates.fitness  = Math.min(100, ((player.fitness as number) ?? 100) + 12 + Math.floor(Math.random() * 9));
    updates.consecutiveMatchesPlayed = 0;

    // Tick injury weeks down (physio skill adds a chance of an extra week's healing)
    const weeksLeft = (player.injuryWeeksRemaining as number) ?? 0;
    if (weeksLeft > 0 && player.teamId) {
      const physioSkill = await getBestMedicalSkill(player.teamId);
      const extraTick   = Math.random() < physioSkill / 250 ? 1 : 0;
      const newWeeks    = Math.max(0, weeksLeft - 1 - extraTick);
      updates.injuryWeeksRemaining = newWeeks;
      if (newWeeks === 0) {
        updates.injuryStatus = "Healthy";
        updates.isInjured    = false;
      }
    }
  } else {
    updates.fatigue = Math.min(100, player.fatigue + 18);
  }

  const [newPlayer] = await db.update(playersTable).set(updates).where(eq(playersTable.id, playerId)).returning();
  return {
    newPlayer: serializePlayer(newPlayer),
    statGains,
    xpGained: sessionXp,
    baseXp,
    totalXp: newPoints,
    nextThreshold: (newMilestone + 1) * POINTS_THRESHOLD,
    xpToNextStat: (newMilestone + 1) * POINTS_THRESHOLD - newPoints,
    coachEffect,
  };
};

router.get("/training", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.json([]); return; }
  const sessions = await db.select().from(trainingSessionsTable)
    .where(eq(trainingSessionsTable.teamId, team.id));
  const withPlayers = await Promise.all(sessions.map(async (s) => {
    const player = await db.query.playersTable.findFirst({ where: eq(playersTable.id, s.playerId) });
    const coach  = s.coachId ? await db.query.staffTable.findFirst({ where: eq(staffTable.id, s.coachId) }) : null;
    return {
      ...serializeSession(s),
      player: player ? serializePlayer(player) : null,
      coach: coach ?? null,
    };
  }));
  res.json(withPlayers);
});

router.post("/training", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const { playerId, type, focus, durationHours, scheduledAt, coachId } = req.body;
  const [session] = await db.insert(trainingSessionsTable).values({
    teamId: team.id,
    playerId: Number(playerId),
    type,
    focus,
    durationHours: String(durationHours),
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

  const activePlayers = await db.select().from(playersTable)
    .where(and(eq(playersTable.teamId, team.id), eq(playersTable.isActive, true)));

  if (activePlayers.length === 0) { res.status(400).json({ error: "No active players" }); return; }

  const sessions = await Promise.all(activePlayers.map(player =>
    db.insert(trainingSessionsTable).values({
      teamId: team.id,
      playerId: player.id,
      type,
      focus: focus || "Team Training",
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

  // Look up the assigned coach to apply coaching bonuses
  const coach = session.coachId
    ? await db.query.staffTable.findFirst({ where: eq(staffTable.id, session.coachId) })
    : null;

  const result = await applyFatigueAndStats(session.playerId, session.type, coach ?? null);
  if (result) {
    const { newPlayer, statGains, xpGained, baseXp, totalXp, xpToNextStat, coachEffect } = result;
    res.json({
      session: { ...serializeSession(updatedSession), player: newPlayer },
      statGains,
      newStats: newPlayer,
      xpGained,
      baseXp,
      totalXp,
      xpToNextStat,
      coachEffect,
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
