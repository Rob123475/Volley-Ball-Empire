import { Router } from "express";
import { potentialMultiplier as potentialOf } from "../utils/potential.js";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { db } from "@workspace/db";
import { trainingSessionsTable, playersTable, teamsTable, staffTable, facilitiesTable } from "@workspace/db";
import type { StaffMember } from "@workspace/db";
import { normaliseRole, TRAINING_PROGRAM_DAYS } from "@workspace/db";
import { INJURY_CARE_ROLE_KEYS } from "../utils/condition.js";
import { trainingStaffBonuses } from "../utils/staffBonuses.js";
import { eq, and } from "drizzle-orm";
import { loadPlayers, loadPlayer, requireCareerSaveId, updatePlayerState, type CareerPlayerFields, type StatKey, loadStaff, careerSaveIdForTeamOrThrow } from "../lib/playerDto.js";
import type { TrainingSession, TrainingSessionResult } from "@workspace/db";
import { getGameDate } from "../utils/gameDate.js";

const router = Router();

const serializeSession = (s: TrainingSession) => ({ ...s, durationHours: Number(s.durationHours) });

/** Item 19: a session's length, finish date, days left and progress on the game date `today`. */
function sessionTiming(s: TrainingSession, today: string) {
  const lengthDays = PROGRAM_DAYS[resolveProgram(s.type)] ?? 5;
  const finishesOn = s.finishesOn ?? addGameDays(s.scheduledAt, lengthDays);
  const daysLeft = s.status === "scheduled" ? Math.max(0, dayGap(today, finishesOn)) : 0;
  const progressPct = s.status === "completed" ? 100 : Math.min(100, Math.max(0, Math.round(((lengthDays - daysLeft) / lengthDays) * 100)));
  return { lengthDays, finishesOn, daysLeft, progressPct };
}
const serializePlayer  = (p: any) => ({ ...p, height: Number(p.height), salary: Number(p.salary) });


async function getBestMedicalSkill(teamId: number): Promise<number> {
  const staff = await loadStaff(await careerSaveIdForTeamOrThrow(teamId), { teamId: teamId });
  const medics = staff.filter(s => INJURY_CARE_ROLE_KEYS.has(normaliseRole(s.role)!));
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

// Unity brief item 19: how many GAME days each programme takes (lib/db
// training-programs.ts, shared with the Training page).
const PROGRAM_DAYS = TRAINING_PROGRAM_DAYS;

function addGameDays(date: string, days: number): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const dayGap = (from: string, to: string) =>
  Math.round((Date.parse(`${to.slice(0, 10)}T00:00:00Z`) - Date.parse(`${from.slice(0, 10)}T00:00:00Z`)) / 86_400_000);

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

// Potential multipliers: utils/potential.ts (the true `potential`, never sent to the client).

const POINTS_PER_SESSION_MIN = 25;
const POINTS_PER_SESSION_MAX = 35;
const PRIMARY_THRESHOLD   = 100;
const SECONDARY_THRESHOLD = 200;

const applyFatigueAndStats = async (
  careerSaveId: number,
  playerId: number,
  programType: string,
  coach?: StaffMember | null,
  teamPhilosophy?: string | null,
  facilityMultiplier = 1.0,
  psychLevel = 1,
  medCentreLevel = 1,
  newRoleXpBonus = 1.0,
  newRoleFatigueReduction = 0,
) => {
  const player = await loadPlayer(careerSaveId, playerId);
  if (!player) return null;
  const fatigueBefore = player.fatigue;
  const moraleBefore  = player.morale;

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
  const potentialMultiplier = potentialOf(player.potential as string);

  // Youth Academy bonus: players aged 14–18 develop 20% faster than the standard
  // age modifier already gives them. This stacks with getAgeModifier (1.25×) for a
  // combined 1.50× rate. After senior promotion (age 19+) the bonus drops away —
  // senior development rates are completely unchanged.
  const youthAcademyMultiplier = (player.age >= 14 && player.age <= 18) ? 1.20 : 1.0;

  const totalMultiplier = program.xpModifier * coachXpMultiplier * newRoleXpBonus * ageModifier * philosophyMultiplier * potentialMultiplier * facilityMultiplier * youthAcademyMultiplier;
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

  const updates: Partial<CareerPlayerFields> = { trainingPoints: newPoints };

  // Apply stat gains
  const applyStatGain = (stat: string, gain: number) => {
    const key = stat as StatKey;
    const cur = player[key];
    updates[key] = Math.min(99, cur + gain);
  };
  if (program.primaryStat   && primaryGain   > 0) applyStatGain(program.primaryStat,   primaryGain);
  if (program.secondaryStat && secondaryGain > 0) applyStatGain(program.secondaryStat, secondaryGain);

  // ── Youth training focus boost (age 14–18 only; never affects senior players) ──
  // Each session accumulates 15–20 focusXp independent of the training programme.
  // Every 100 focusXp → +1 to the focus stat (Leadership gets +3 morale instead).
  const FOCUS_STAT_MAP: Record<string, string> = {
    Attack:      "power",
    Defence:     "defense",
    Serving:     "serve",
    Blocking:    "block",
    Athleticism: "speed",
  };
  const FOCUS_XP_PER_SESSION_MIN = 15;
  const FOCUS_XP_PER_SESSION_MAX = 20;
  const FOCUS_XP_THRESHOLD = 100;

  if (player.age >= 14 && player.age <= 18 && player.trainingFocus) {
    const focusXpGain = Math.floor(
      Math.random() * (FOCUS_XP_PER_SESSION_MAX - FOCUS_XP_PER_SESSION_MIN + 1)
    ) + FOCUS_XP_PER_SESSION_MIN;

    if (player.trainingFocus === "Leadership") {
      // Leadership: +3 morale per session
      const curMorale = (updates.morale as number | undefined) ?? player.morale;
      updates.morale = Math.min(100, curMorale + 3);
    } else {
      const focusStat = FOCUS_STAT_MAP[player.trainingFocus];
      if (focusStat) {
        const prevFocusXp = player.focusXp ?? 0;
        const newFocusXp  = prevFocusXp + focusXpGain;
        const focusGain   = Math.floor(newFocusXp / FOCUS_XP_THRESHOLD) - Math.floor(prevFocusXp / FOCUS_XP_THRESHOLD);
        updates.focusXp   = newFocusXp;
        if (focusGain > 0) {
          const fk = focusStat as StatKey;
          const curStat = updates[fk] ?? player[fk];
          updates[fk] = Math.min(99, curStat + focusGain);
        }
      }
    }
  }

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
    // Whole points: the fitness trainer's reduction is fractional (P-09), and
    // fatigue has only ever been stored and shown as an integer.
    updates.fatigue = Math.min(100, player.fatigue + Math.max(0, Math.round(program.fatigueEffect - newRoleFatigueReduction)));
    if (program.fitnessBonus > 0) {
      updates.fitness = Math.min(100, ((player.fitness as number) ?? 100) + program.fitnessBonus);
    }
  }

  // Training results are career state. This wrote to the reference table via an
  // untyped Record, which the compiler could not catch.
  await updatePlayerState(careerSaveId, playerId, updates);
  const newPlayer = await loadPlayer(careerSaveId, playerId);

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
    fatigueBefore,
    moraleBefore,
  };
};

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/training", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.json([]); return; }
  const today = await getGameDate(team.id);
  const sessions = await db.select().from(trainingSessionsTable)
    .where(eq(trainingSessionsTable.teamId, team.id));
  const withPlayers = await Promise.all(sessions.map(async (s) => {
    const player = await db.query.playersTable.findFirst({ where: eq(playersTable.id, s.playerId) });
    const coach  = s.coachId ? await db.query.staffTable.findFirst({ where: eq(staffTable.id, s.coachId) }) : null;
    return { ...serializeSession(s), ...sessionTiming(s, today), player: player ? serializePlayer(player) : null, coach: coach ?? null };
  }));
  res.json(withPlayers);
});

router.post("/training", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const { playerId, type, focus, durationHours, coachId } = req.body;
  const programName = resolveProgram(type);
  // Unity brief item 18: a session is dated on the GAME calendar. The page
  // offered the PC's date and time (e.g. 29/09/2026 02:34 AM, in UTC) and sent
  // it; a player does not pick a real-world time at all.
  const scheduledAt = await getGameDate(team.id);
  const [session] = await db.insert(trainingSessionsTable).values({
    teamId: team.id,
    playerId: Number(playerId),
    type: programName,
    focus: focus || programName,
    durationHours: Number(durationHours || 2),
    scheduledAt,
    // Item 19: it runs PROGRAM_DAYS game days from today.
    finishesOn: addGameDays(scheduledAt, PROGRAM_DAYS[programName] ?? 5),
    coachId: coachId ? Number(coachId) : null,
  }).returning();
  res.status(201).json({ ...serializeSession(session), ...sessionTiming(session, scheduledAt) });
});

router.post("/training/team", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const { type, focus, durationHours, coachId } = req.body;
  const programName = resolveProgram(type);
  const scheduledAt = await getGameDate(team.id);   // item 18: the game date, not the PC's

  const activePlayers = await loadPlayers(requireCareerSaveId(req.activeCareerSaveId), { teamId: team.id, isActive: true });
  if (activePlayers.length === 0) { res.status(400).json({ error: "No active players" }); return; }

  const sessions = await Promise.all(activePlayers.map(player =>
    db.insert(trainingSessionsTable).values({
      teamId: team.id,
      playerId: player.id,
      type: programName,
      focus: focus || programName,
      durationHours: Number(durationHours || 2),
      scheduledAt,
      finishesOn: addGameDays(scheduledAt, PROGRAM_DAYS[programName] ?? 5),   // item 19
      coachId: coachId ? Number(coachId) : null,
    }).returning()
  ));
  res.status(201).json(sessions.flat().map((s) => ({ ...serializeSession(s), ...sessionTiming(s, scheduledAt) })));
});

// Item 19: a running session may be cancelled; it gives nothing. (There is no
// "Complete": the calendar finishes a session on its finish date.)
router.post("/training/:id/cancel", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const id = parseInt(req.params.id);
  const session = await db.query.trainingSessionsTable.findFirst({ where: and(eq(trainingSessionsTable.id, id), eq(trainingSessionsTable.teamId, team.id)) });
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  if (session.status !== "scheduled") { res.status(409).json({ error: `This session is ${session.status}.` }); return; }
  const [cancelled] = await db.update(trainingSessionsTable).set({ status: "cancelled" })
    .where(eq(trainingSessionsTable.id, id)).returning();
  res.json(serializeSession(cancelled));
});

/**
 * Item 19: finish every running session of this team whose finish date has come
 * (`date` is the new game date), applying its gains once, exactly as the old
 * instant "Complete" did: the programme's XP and stat milestones, morale,
 * fatigue and fitness, the coach, philosophy, facilities and staff bonuses.
 * Called by the calendar each day. Returns a line per finished session.
 */
export async function finishDueTrainingSessions(careerSaveId: number, teamId: number, date: string): Promise<string[]> {
  const running = await db.select().from(trainingSessionsTable)
    .where(and(eq(trainingSessionsTable.teamId, teamId), eq(trainingSessionsTable.status, "scheduled")));
  const lines: string[] = [];
  for (const session of running) {
    // A session scheduled before this rule has no finish date: it runs its
    // programme's days from the day it is first seen.
    if (!session.finishesOn) {
      await db.update(trainingSessionsTable).set({ finishesOn: addGameDays(date, PROGRAM_DAYS[resolveProgram(session.type)] ?? 5) })
        .where(eq(trainingSessionsTable.id, session.id));
      continue;
    }
    if (session.finishesOn > date) continue;

    const coach = session.coachId
      ? await db.query.staffTable.findFirst({ where: eq(staffTable.id, session.coachId) })
      : null;
    const team = await db.query.teamsTable.findFirst({ where: eq(teamsTable.id, session.teamId) });
    const teamPhilosophy = team?.trainingPhilosophy ?? null;

    const facilityRows = await db.select().from(facilitiesTable).where(eq(facilitiesTable.teamId, session.teamId));
    const facilityLevels = Object.fromEntries(facilityRows.map(f => [f.type, f.level]));
    const trainingComplexMult = 1 + ((facilityLevels.training_complex ?? 1) - 1) * (0.20 / 9);
    const gymnasiumBoost      = ((facilityLevels.gymnasium ?? 1) - 1) * (0.15 / 9);
    const facilityMultiplier  = trainingComplexMult * (1 + gymnasiumBoost);
    const psychLevel          = facilityLevels.psychology_centre ?? 1;
    const medCentreLevel      = facilityLevels.medical_centre    ?? 1;
    const nutritionLevel      = facilityLevels.nutrition_centre  ?? 1;

    const teamStaffAll = await loadStaff(careerSaveId, { teamId: session.teamId });
    // P-09: head coach, assistant coach and fitness trainer (utils/staffBonuses.ts).
    const staffBonuses = trainingStaffBonuses(teamStaffAll);
    const newRoleFatigueReduction = staffBonuses.fatigueReduction + ((nutritionLevel - 1) * (3 / 9));

    // Marked finished first, so a session can never pay twice.
    const [claimed] = await db.update(trainingSessionsTable).set({ status: "completed" })
      .where(and(eq(trainingSessionsTable.id, session.id), eq(trainingSessionsTable.status, "scheduled"))).returning();
    if (!claimed) continue;

    const result = await applyFatigueAndStats(
      careerSaveId, session.playerId, session.type, coach ?? null, teamPhilosophy, facilityMultiplier,
      psychLevel, medCentreLevel, staffBonuses.xpMultiplier, newRoleFatigueReduction);
    if (!result) continue;
    const { newPlayer, statGains, xpGained, baseXp, totalXp, programName, fatigueBefore, moraleBefore } = result;
    // Young player development bonus: manager rep when a player aged 22 or under gains a stat.
    if (Object.keys(statGains).length > 0 && (newPlayer.age ?? 99) <= 22 && team) {
      await db.update(teamsTable)
        .set({ managerRepPoints: (team.managerRepPoints ?? 0) + 5 })
        .where(eq(teamsTable.id, team.id));
    }
    const record: TrainingSessionResult = {
      programName, statGains, xpGained, baseXp, totalXp,
      fatigueBefore, fatigueAfter: newPlayer.fatigue, moraleBefore, moraleAfter: newPlayer.morale,
      staffXpMultiplier: staffBonuses.xpMultiplier, staffFatigueReduction: staffBonuses.fatigueReduction,
    };
    await db.update(trainingSessionsTable).set({ result: record }).where(eq(trainingSessionsTable.id, session.id));
    const gains = Object.entries(statGains).map(([k, v]) => `+${v} ${k}`).join(", ");
    lines.push(`Training finished: ${newPlayer.name}, ${programName}${gains ? ` (${gains})` : ""}`);
  }
  return lines;
}

router.get("/training/plan", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.json({ weeklyLoad: "light", averageFitness: 80, averageMorale: 80, scheduledSessions: [], completedThisWeek: 0 }); return; }

  const sessions = await db.select().from(trainingSessionsTable).where(eq(trainingSessionsTable.teamId, team.id));
  const scheduled = sessions.filter(s => s.status === "scheduled");
  const completedThisWeek = sessions.filter(s => s.status === "completed").length;
  const load = scheduled.length > 6 ? "peak" : scheduled.length > 4 ? "intense" : scheduled.length > 2 ? "moderate" : "light";

  const players = await loadPlayers(requireCareerSaveId(req.activeCareerSaveId), { teamId: team.id });
  // Unity brief item 18: ONE fitness figure. "Fitness" here was the squad's
  // average STAMINA stat (80%) while the top bar said 98% FIT; it is now the
  // top bar's own figure: average fitness of the active squad (GET /calendar's
  // teamFitness), and fatigue likewise.
  const active = players.filter((p) => p.isActive);
  const avgFitness = active.length > 0 ? active.reduce((acc, p) => acc + p.fitness, 0) / active.length : 0;
  const avgMorale  = players.length > 0 ? players.reduce((acc, p) => acc + p.morale,  0) / players.length : 80;
  const avgFatigue = active.length > 0 ? active.reduce((acc, p) => acc + p.fatigue, 0) / active.length : 0;

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
