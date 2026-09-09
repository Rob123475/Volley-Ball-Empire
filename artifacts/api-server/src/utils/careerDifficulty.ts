/**
 * R-11 — career difficulty (docs/economy-design.md: "Difficulty is chosen at
 * career start: UNDERDOG or ESTABLISHED", and "What the player should feel").
 *
 * The doc gives no NUMBERS for starting budget or ranking points — only
 * qualitative descriptions:
 *
 *   UNDERDOG:    "money is tight from the first week... Bronze-locked."
 *   ESTABLISHED: "comfortable but not rich, competing in Silver/Gold...
 *                 starts roughly one tier further along, not with more time."
 *
 * The four constants below are PICKED, not derived from the doc — flagged
 * here and in the register (R-11) so they are the one place to retune if a
 * different number is wanted, not a magic literal buried in a route.
 */

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
 * Ranking points ESTABLISHED starts a season with — enough to already clear
 * the Silver threshold (15, utils/tierQualification.ts's TIER_THRESHOLDS)
 * without also clearing Gold (40), matching "starts roughly one tier further
 * along." UNDERDOG starts at the column default, 0 — naturally Bronze-only
 * against the same thresholds, which is exactly "Bronze-locked" with no
 * extra gating code: the tier system already does this for free once the
 * starting number is right.
 */
export const ESTABLISHED_STARTING_RANKING_POINTS = 20;

export function startingBudgetFor(difficulty: CareerDifficulty): number {
  return difficulty === "underdog" ? UNDERDOG_STARTING_BUDGET : ESTABLISHED_STARTING_BUDGET;
}

export function startingRankingPointsFor(difficulty: CareerDifficulty): number {
  return difficulty === "underdog" ? 0 : ESTABLISHED_STARTING_RANKING_POINTS;
}
