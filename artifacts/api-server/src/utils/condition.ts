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
import { db, facilitiesTable, normaliseRole, type StaffRoleKey } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sideRating, type RatedPlayer } from "./matchEngine.js";
import { MAX_STARTERS } from "./squadRules.js";
import { loadPlayers, loadStaff, updatePlayerState } from "../lib/playerDto.js";

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

/** Probability (0-0.60) that a player who plays this match is injured. */
export function injuryRisk(
  fatigue: number, stamina: number, consecutive: number, sportsLabLevel = 1, hasRecoveryCamp = false,
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
  return Math.min(risk * labFactor * campFactor, 0.60);
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

/**
 * A week of injury recovery, run every 7 game days by the calendar. The best
 * medic can take an extra week off; the Medical Centre up to one more at L10.
 * Returns the names of players who are fit again.
 */
export async function applyWeeklyInjuryRecovery(careerSaveId: number, teamId: number): Promise<string[]> {
  const [players, staff, facilities] = await Promise.all([
    loadPlayers(careerSaveId, { teamId }),
    loadStaff(careerSaveId, { teamId }),
    db.select().from(facilitiesTable).where(eq(facilitiesTable.teamId, teamId)),
  ]);
  // Final brief 5 Oct, Part B: a medic who is off ill or hurt treats nobody.
  const medics = staff.filter((s) => INJURY_CARE_ROLE_KEYS.has(normaliseRole(s.role)!) && staffOnDuty(s));
  const medicSkill = medics.length > 0 ? Math.max(...medics.map((s) => s.skillLevel)) : 0;
  const medCentreLevel = facilities.find((f) => f.type === "medical_centre")?.level ?? 1;

  const recovered: string[] = [];
  for (const p of players) {
    const weeks = Number(p.injuryWeeksRemaining ?? 0);
    const injured = p.isInjured || (p.injuryStatus ?? "Healthy") !== "Healthy";
    if (!injured) continue;
    const extraWeek = Math.random() < medicSkill / 250 ? 1 : 0;
    const facilityWeeks = (medCentreLevel - 1) * (1 / 9);
    const next = Math.max(0, weeks - 1 - extraWeek - facilityWeeks);
    if (next <= 0) {
      await updatePlayerState(careerSaveId, p.id, { injuryWeeksRemaining: 0, injuryStatus: "Healthy", isInjured: false });
      recovered.push(p.name);
    } else {
      await updatePlayerState(careerSaveId, p.id, { injuryWeeksRemaining: Math.round(next * 100) / 100 });
    }
  }
  return recovered;
}
