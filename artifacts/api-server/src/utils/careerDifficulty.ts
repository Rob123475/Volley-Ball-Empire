/**
 * R-11 — career difficulty (docs/economy-design.md: "Difficulty is chosen at
 * career start: UNDERDOG or ESTABLISHED", and "What the player should feel").
 *
 * The doc gives no NUMBERS for starting budget or tier — only qualitative
 * descriptions:
 *
 *   UNDERDOG:    "money is tight from the first week... Bronze-locked."
 *   ESTABLISHED: "comfortable but not rich, competing in Silver/Gold...
 *                 starts roughly one tier further along, not with more time."
 *
 * The constants below are PICKED, not derived from the doc — flagged here and
 * in the register (R-11, R-54) so they are the one place to retune if a
 * different number is wanted, not a magic literal buried in a route.
 */
import type { Tier } from "./tierQualification.js";

export const CAREER_DIFFICULTIES = ["underdog", "established"] as const;
export type CareerDifficulty = (typeof CAREER_DIFFICULTIES)[number];

export function isCareerDifficulty(value: unknown): value is CareerDifficulty {
  return typeof value === "string" && (CAREER_DIFFICULTIES as readonly string[]).includes(value);
}

/** UNDERDOG: "tight from the first week." */
export const UNDERDOG_STARTING_BUDGET = 150_000;

/** ESTABLISHED: "comfortable but not rich." Unchanged from the pre-R-11 flat default. */
export const ESTABLISHED_STARTING_BUDGET = 500_000;

/**
 * Season 1's purse access (R-54). A club is paid in full up to the tier it
 * finished last season (utils/tierQualification.ts); season 1 has no last
 * season, so difficulty stands in for it. ESTABLISHED is paid Silver purses in
 * full from day one, "one tier further along"; UNDERDOG only Bronze.
 *
 * Both start at 0 ranking points. R-11's 20-point head start is deleted: with
 * the old gate it bought Gold access in season 1 and nothing after, so a 31W 24L
 * season-1 club ended Gold and a 41W 14L season-3 club ended Silver.
 */
export const SEASON_ONE_PURSE_TIER: Record<CareerDifficulty, Tier> = {
  underdog:    "Bronze",
  established: "Silver",
};

export function startingBudgetFor(difficulty: CareerDifficulty): number {
  return difficulty === "underdog" ? UNDERDOG_STARTING_BUDGET : ESTABLISHED_STARTING_BUDGET;
}
