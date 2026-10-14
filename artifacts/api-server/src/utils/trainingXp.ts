/**
 * Update 1, item 3 (Rob, 14 Oct): the one training XP rule, shared.
 *
 * A session's XP and the stats it moves, for any senior or youth in any club:
 * a base of 25-35 XP, times the programme's own modifier and every multiplier
 * that applies (the coach, the staff, age, the club's philosophy, potential,
 * facilities, the academy's youth bonus, the manager's Coach speciality); the
 * programme's primary stat +1 every 100 XP and its secondary +1 every 200 XP,
 * capped at 99. The player's training (routes/training.ts applyFatigueAndStats)
 * and the AI clubs' weekly training (utils/aiTraining.ts) both call it; only
 * the player's adds fatigue, morale, focus and injury care around it.
 */
import { potentialMultiplier as potentialOf } from "./potential.js";
import { isYouthPlayer } from "./playerClassification.js";
import type { PlayerDTO } from "../lib/playerDto.js";

// ── Training Programs ─────────────────────────────────────────────────────────
// primaryStat   — gains +1 every 100 XP
// secondaryStat — gains +1 every 200 XP (half the rate of primary)
// fatigueEffect — positive adds fatigue, negative removes it
// xpModifier    — scales total session XP
// moraleBonus   — flat morale change per session
// fitnessBonus  — flat fitness boost per session
// injuryHealing — true = ticks injury weeks down (only meaningful for Recovery)

export interface ProgramConfig {
  primaryStat:   string | null;
  secondaryStat: string | null;
  fatigueEffect: number;
  xpModifier:    number;
  moraleBonus:   number;
  fitnessBonus:  number;
  injuryHealing: boolean;
}

export const PROGRAM_CONFIG: Record<string, ProgramConfig> = {
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

export const resolveProgram = (type: string): string =>
  PROGRAM_CONFIG[type] ? type : (LEGACY_TYPE_MAP[type] ?? "Conditioning");

// ── Age-based development modifier ───────────────────────────────────────────

export function getAgeModifier(age: number): number {
  if (age <= 20) return 1.25;
  if (age <= 25) return 1.10;
  if (age <= 29) return 1.00;
  if (age <= 33) return 0.90;
  return 0.80;
}

// Potential multipliers: utils/potential.ts (the true `potential`, never sent to the client).

const POINTS_PER_SESSION_MIN = 25;
const POINTS_PER_SESSION_MAX = 35;
export const PRIMARY_THRESHOLD   = 100;
const SECONDARY_THRESHOLD = 200;

type TrainedStat = "power" | "speed" | "defense" | "serve" | "block" | "stamina";

/** Who trains: her age, true potential, XP so far, whether she is a youth, and the stats a programme can move. */
export type TraineeXpState = Pick<PlayerDTO, "age" | "potential" | "trainingPoints" | "playerType" | "isPromoted" | "isRetired" | TrainedStat>;

/** The multipliers that come from outside her: each 1 when it does not apply (an AI club has no coach, staff, philosophy or facilities). */
export type XpMultipliers = {
  coach?: number;
  staff?: number;
  philosophy?: number;
  facility?: number;
  /** The manager's Coach speciality (seniors only; a youth trains at 1). */
  manager?: number;
};

export type SessionXp = {
  baseXp: number;
  sessionXp: number;
  newPoints: number;
  ageModifier: number;
  potentialMultiplier: number;
  managerXpMultiplier: number;
  statGains: Record<string, number>;
  /** The stats to write: each moved stat's new value, capped at 99. */
  statUpdates: Partial<Record<TrainedStat, number>>;
  /** The XP at which her primary stat next goes up. */
  nextThreshold: number;
};

/** One session of `programName` for `p`: the XP and the stats it moves (nothing else). */
export function trainingSessionXp(p: TraineeXpState, programName: string, m: XpMultipliers = {}, random: () => number = Math.random): SessionXp {
  const program = PROGRAM_CONFIG[programName]!;

  const baseXp = Math.floor(
    random() * (POINTS_PER_SESSION_MAX - POINTS_PER_SESSION_MIN + 1)
  ) + POINTS_PER_SESSION_MIN;

  const ageModifier = getAgeModifier(p.age);
  const potentialMultiplier = potentialOf(p.potential as string);

  // Youth Academy bonus: players aged 14–18 develop 20% faster than the standard
  // age modifier already gives them. This stacks with getAgeModifier (1.25×) for a
  // combined 1.50× rate. After senior promotion (age 19+) the bonus drops away —
  // senior development rates are completely unchanged.
  const youthAcademyMultiplier = (p.age >= 14 && p.age <= 18) ? 1.20 : 1.0;

  // Update 1, item 2: a Coach's club's seniors gain 10% more XP (utils/managerFaces.ts).
  const managerXp = isYouthPlayer(p) ? 1 : (m.manager ?? 1);
  const totalMultiplier = program.xpModifier * (m.coach ?? 1) * (m.staff ?? 1) * ageModifier * (m.philosophy ?? 1) * potentialMultiplier * (m.facility ?? 1) * youthAcademyMultiplier * managerXp;
  const sessionXp = Math.round(baseXp * totalMultiplier);

  const prevPoints = p.trainingPoints;
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

  const statUpdates: Partial<Record<TrainedStat, number>> = {};
  const applyStatGain = (stat: string, gain: number) => {
    const key = stat as TrainedStat;
    statUpdates[key] = Math.min(99, p[key] + gain);
  };
  if (program.primaryStat   && primaryGain   > 0) applyStatGain(program.primaryStat,   primaryGain);
  if (program.secondaryStat && secondaryGain > 0) applyStatGain(program.secondaryStat, secondaryGain);

  return {
    baseXp, sessionXp, newPoints, ageModifier, potentialMultiplier, managerXpMultiplier: managerXp,
    statGains, statUpdates, nextThreshold: (newPrimaryMilestone + 1) * PRIMARY_THRESHOLD,
  };
}
