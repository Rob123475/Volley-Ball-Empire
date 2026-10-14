/**
 * R-50 — injuries and fitness decide who plays, and how well.
 *
 * Before this, a player's injury, fitness and fatigue were written after every
 * match and read by nothing that picked a side or rated it. Every contracted,
 * active player (starters and interchange alike) was "the side", rated on full
 * stats, and every one of them "played" every match — so injured players never
 * rested and never healed. R-48's diagnosis found all three of a club's players
 * injured at fitness 0, still playing at full rating.
 *
 * Now:
 *   selection  a pair of AVAILABLE players: contracted, active, not injured.
 *              A manager's stored lineup comes first where its players are
 *              available; then starters, then the interchange, then anyone
 *              else, each by fitness-scaled rating. One function picks the side
 *              for /simulate, the live tick engine, the Unity payload, match
 *              setup, the R-48 forfeit rule and the board's unfieldable check.
 *   fitness    scales a player's contribution linearly:
 *                factor = 0.6 + 0.4 × fitness / 100
 *                100 → 1.00, 75 → 0.90, 50 → 0.80, 25 → 0.70, 0 → 0.60
 *              applied to each of her six stats before the side is rated. The
 *              line meets Rob's anchors exactly (100 → 1.0, 50 → ~0.8,
 *              0 → ~0.6) and is simple to show on screen ("plays at 88%").
 *   a match    costs only the two who played: fitness −4 to −7, fatigue +12
 *              to +18 (more in extreme weather), and an injury roll.
 *   rest       every game day: fitness +2, fatigue −5; injured players +1, −3.
 *              A World Tour round falls every ~4.7 days, so a pair that plays
 *              every round recovers most of each match's cost before the next.
 *              The old rule (+1 fitness a day, and only below 30 fatigue) could
 *              never keep up, which is how fitness drained to 0.
 *   injuries   heal a week every 7 game days — on the calendar, off-season
 *              included, not per match rested. Shorter and rarer than before,
 *              because an injured player now cannot play through it and a
 *              three-player squad with two out forfeits: 3% base risk a match;
 *              Minor 1 week (65%), Major 3 weeks (30%), Unavailable 6 weeks (5%).
 */
import { INJURY_WEEKS, staffOnDuty } from "@workspace/db";
import {
  facilitiesTable, careerPlayerStateTable, careerPoolTeamStateTable, playersTable, normaliseRole, type StaffRoleKey,
  MONEY, pronenessFactor, type DevelopmentProfile,
} from "@workspace/db";
import { and, eq, isNotNull, isNull, ne, or } from "drizzle-orm";
import { sideRating, type RatedPlayer } from "./matchEngine.js";
import { MAX_STARTERS } from "./squadRules.js";
import { loadStaffTx, withCareerStateTx, type CareerStateTx } from "../lib/playerDto.js";

/** Two players on the sand. */
export const PAIR_SIZE = MAX_STARTERS;

export const FITNESS_FLOOR_FACTOR = 0.6;

export type SelectablePlayer = RatedPlayer & {
  id: number;
  isActive: boolean;
  isInjured: boolean;
  injuryStatus: string;
  fitness: number;
  squadRole: string;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** What a player at this fitness brings to a match, as a share of her full stats. */
export function fitnessFactor(fitness: number | null | undefined): number {
  const f = clamp(Number.isFinite(fitness) ? Number(fitness) : 100, 0, 100);
  return FITNESS_FLOOR_FACTOR + (1 - FITNESS_FLOOR_FACTOR) * (f / 100);
}

/**
 * Injured: either flag says so. Unity brief item 14: this is THE test. The
 * dashboard's Fitness tile and the Attention card read is_injured alone, and
 * GET /calendar and the medical count read injury_status alone, so a row where
 * the two disagreed was fit on one screen and injured on the next.
 */
export function isInjured(p: Pick<SelectablePlayer, "isInjured" | "injuryStatus">): boolean {
  return !!p.isInjured || (p.injuryStatus ?? "Healthy") !== "Healthy";
}

/** Contracted and active, and not injured: the only players who can be selected. */
export function isAvailable(p: Pick<SelectablePlayer, "isActive" | "isInjured" | "injuryStatus">): boolean {
  return p.isActive && !isInjured(p);
}

/** The player with her six stats scaled by her fitness. */
export function conditioned<T extends SelectablePlayer>(p: T): T {
  const k = fitnessFactor(p.fitness);
  return {
    ...p,
    speed: p.speed * k, power: p.power * k, defense: p.defense * k,
    serve: p.serve * k, block: p.block * k, stamina: p.stamina * k,
  };
}

export function conditionedRating(p: SelectablePlayer): number {
  return sideRating([conditioned(p)]);
}

const roleRank = (p: SelectablePlayer) => (p.squadRole === "starter" ? 0 : p.squadRole === "interchange" ? 1 : 2);

/**
 * The pair that takes the court: the stored lineup's available players first,
 * then starters, the interchange and everyone else by fitness-scaled rating.
 * Injured players are never selected. Fewer than two means the club cannot play.
 */
export function selectPair<T extends SelectablePlayer>(players: readonly T[], preferredIds: readonly number[] = []): T[] {
  const available = players.filter(isAvailable);
  const preferred = preferredIds
    .map((id) => available.find((p) => p.id === id))
    .filter((p): p is T => p != null);
  const rest = available
    .filter((p) => !preferred.includes(p))
    .sort((a, b) => roleRank(a) - roleRank(b) || conditionedRating(b) - conditionedRating(a));
  return [...preferred, ...rest].slice(0, PAIR_SIZE);
}

/** The side's rating: the engine's six-stat mean over the pair, each scaled by fitness. */
export function pairSideRating(pair: readonly SelectablePlayer[]): number {
  return sideRating(pair.map(conditioned));
}

// ── What a match costs ───────────────────────────────────────────────────────

export const INJURY_BASE_RISK = 0.03;

/** Fitness lost (a positive number) and fatigue gained by a player who played. */
export function matchCosts(extraFatigue = 0): { fitness: number; fatigue: number } {
  return {
    fitness: 4 + Math.floor(Math.random() * 4),
    fatigue: 12 + Math.floor(Math.random() * 7) + Math.max(0, extraFatigue),
  };
}

/**
 * Probability (0-0.60) that a player who plays this match is injured.
 * Update 1, overnight part 4 (B-1): `proneness` is her injuryProneness's factor
 * (x0.7 to x1.3, lib/db/src/schema/ageing.ts pronenessFactor), 1 with no profile.
 */
export function injuryRisk(
  fatigue: number, stamina: number, consecutive: number, sportsLabLevel = 1, hasRecoveryCamp = false, proneness = 1,
): number {
  let risk = INJURY_BASE_RISK;
  // Fatigue makes the body fragile
  if      (fatigue > 85) risk += 0.12;
  else if (fatigue > 70) risk += 0.06;
  else if (fatigue > 55) risk += 0.02;
  // Low stamina = poor physical resilience
  risk += ((100 - stamina) / 100) * 0.04;
  // Back-to-back matches wear the body down
  if      (consecutive >= 4) risk += 0.02;
  else if (consecutive >= 2) risk += 0.01;
  // Performance Centre (sports_science_lab): 0% at L1, -25% at L10; Recovery Retreat camp: a further -15% while active
  const labFactor  = 1 - (sportsLabLevel - 1) * (0.25 / 9);
  const campFactor = hasRecoveryCamp ? 0.85 : 1.0;
  return Math.min(risk * labFactor * campFactor * proneness, 0.60);
}

/** The most a match's injury risk can reach, after weather and a Fitness Guru. */
export const MATCH_INJURY_RISK_CAP = 0.70;

/**
 * One player's injury roll after a match she played: the base risk for her
 * fatigue, stamina and run of matches (injuryRisk), times the weather's and a
 * Fitness Guru's multipliers, capped. Item 4c: every club's, the player's
 * (routes/matches.ts) and the AI clubs' (utils/aiSquads.ts aiMatchInjuriesTx),
 * the same function and the same odds. Null: she is not hurt.
 */
export function matchInjuryRoll(
  p: { fatigue?: number | null; stamina: number; consecutiveMatchesPlayed?: number | null; development?: DevelopmentProfile | null },
  ctx: { sportsLabLevel?: number; hasRecoveryCamp?: boolean; weatherMultiplier?: number; fitnessGuru?: number } = {},
  random: () => number = Math.random,
): ReturnType<typeof rollInjury> | null {
  const risk = Math.min(
    injuryRisk(p.fatigue ?? 0, p.stamina, p.consecutiveMatchesPlayed ?? 0, ctx.sportsLabLevel ?? 1, ctx.hasRecoveryCamp ?? false, pronenessFactor(p.development))
      * (ctx.weatherMultiplier ?? 1) * (ctx.fitnessGuru ?? 1),
    MATCH_INJURY_RISK_CAP,
  );
  return random() < risk ? rollInjury() : null;
}

/**
 * What a new injury writes to her, every club's (Update 1, overnight part 4,
 * B-2): the injury, and if it keeps her out MONEY.salaryCap.injuredLongWeeks or
 * more, 1 point off speed and stamina at once (never below 1) and one more
 * serious injury on her record (each takes 5% off her training XP for good, at
 * most 20%: lib/db/src/schema/ageing.ts).
 */
export function newInjuryPatch(
  p: { speed: number; stamina: number; seriousInjuries?: number | null },
  inj: ReturnType<typeof rollInjury>,
): { injuryStatus: string; injuryWeeksRemaining: number; isInjured: true; speed?: number; stamina?: number; seriousInjuries?: number } {
  const patch = { injuryStatus: inj.status, injuryWeeksRemaining: inj.weeks, isInjured: true as const };
  if (inj.weeks < MONEY.salaryCap.injuredLongWeeks) return patch;
  return { ...patch, speed: Math.max(1, p.speed - 1), stamina: Math.max(1, p.stamina - 1), seriousInjuries: Number(p.seriousInjuries ?? 0) + 1 };
}

/** How bad a new injury is. */
export function rollInjury(): { status: "Minor Injury" | "Major Injury" | "Unavailable"; weeks: number } {
  const roll = Math.random();
  // Item 20: the weeks are lib/db injuries.ts, shared with the Medical page.
  if (roll < 0.65) return { status: "Minor Injury", weeks: INJURY_WEEKS["Minor Injury"]! };
  if (roll < 0.95) return { status: "Major Injury", weeks: INJURY_WEEKS["Major Injury"]! };
  return { status: "Unavailable", weeks: INJURY_WEEKS.Unavailable! };
}

// ── Rest ─────────────────────────────────────────────────────────────────────

/** Recovery on every game day, applied by the calendar advance. */
export const REST_RECOVERY = {
  healthy: { fitness: 2, fatigue: 5 },
  injured: { fitness: 1, fatigue: 3 },
} as const;

/**
 * Staff whose skill counts as "the best medic" for injury recovery. Compared by
 * normalised key (P-09): the rows store "Fitness Trainer", not "fitness_trainer".
 */
export const INJURY_CARE_ROLE_KEYS: ReadonlySet<StaffRoleKey> = new Set([
  "fitness_trainer", "strength_conditioner", "massage_therapist", "physiotherapist",
]);

/** Whose injured players heal: a club (the player's or an AI club's) or the free agents. */
export type InjuryClub = { teamId: number } | { poolTeamId: number } | "free agents";

/**
 * A week of injury recovery, run every 7 game days by the calendar. The best
 * medic can take an extra week off; the Medical Centre up to one more at L10.
 * Item 4c: every club's players heal on this one clock, the AI clubs' (with
 * their own medics, utils/aiStaff.ts; they have no Medical Centre) and the
 * free agents' (no medic) as well as the player's. Returns the names of
 * players who are fit again.
 */
export function injuryRecoveryWeekTx(w: CareerStateTx, careerSaveId: number, club: InjuryClub, random: () => number = Math.random): string[] {
  const s = careerPlayerStateTable;
  const at = club === "free agents" ? [isNull(s.teamId), isNull(s.poolTeamId)]
    : "teamId" in club ? [eq(s.teamId, club.teamId)] : [isNull(s.teamId), eq(s.poolTeamId, club.poolTeamId)];
  const players = w.tx.select({ id: s.playerId, name: playersTable.name, weeks: s.injuryWeeksRemaining })
    .from(s).innerJoin(playersTable, eq(playersTable.id, s.playerId))
    .where(and(eq(s.careerSaveId, careerSaveId), ...at,
      or(eq(s.isInjured, true), and(isNotNull(s.injuryStatus), ne(s.injuryStatus, "Healthy")))))
    .all();
  if (players.length === 0) return [];
  const staff = club === "free agents" ? [] : loadStaffTx(w.tx, careerSaveId, club);
  // Final brief 5 Oct, Part B: a medic who is off ill or hurt treats nobody.
  const medics = staff.filter((m) => INJURY_CARE_ROLE_KEYS.has(normaliseRole(m.role)!) && staffOnDuty(m));
  const medicSkill = medics.length > 0 ? Math.max(...medics.map((m) => m.skillLevel)) : 0;
  const medCentreLevel = club !== "free agents" && "teamId" in club
    ? w.tx.select({ level: facilitiesTable.level }).from(facilitiesTable)
      .where(and(eq(facilitiesTable.teamId, club.teamId), eq(facilitiesTable.type, "medical_centre"))).get()?.level ?? 1
    : 1;

  const recovered: string[] = [];
  for (const p of players) {
    const weeks = Number(p.weeks ?? 0);
    const extraWeek = random() < medicSkill / 250 ? 1 : 0;
    const facilityWeeks = (medCentreLevel - 1) * (1 / 9);
    const next = Math.max(0, weeks - 1 - extraWeek - facilityWeeks);
    if (next <= 0) {
      w.setPlayerState(careerSaveId, p.id, { injuryWeeksRemaining: 0, injuryStatus: "Healthy", isInjured: false });
      recovered.push(p.name);
    } else {
      w.setPlayerState(careerSaveId, p.id, { injuryWeeksRemaining: Math.round(next * 100) / 100 });
    }
  }
  return recovered;
}

/** The player's club's week of recovery (routes/calendar.ts). */
export function applyWeeklyInjuryRecovery(careerSaveId: number, teamId: number): string[] {
  return withCareerStateTx((w) => injuryRecoveryWeekTx(w, careerSaveId, { teamId }));
}

/** Item 4c: the same week for every AI club's players and for the free agents. */
export function aiInjuryRecoveryWeekTx(w: CareerStateTx, careerSaveId: number): number {
  const clubs = w.tx.select({ id: careerPoolTeamStateTable.poolTeamId }).from(careerPoolTeamStateTable)
    .where(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId)).all();
  let healed = 0;
  for (const { id } of clubs) healed += injuryRecoveryWeekTx(w, careerSaveId, { poolTeamId: id }).length;
  return healed + injuryRecoveryWeekTx(w, careerSaveId, "free agents").length;
}
