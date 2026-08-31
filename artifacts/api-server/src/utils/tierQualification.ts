/**
 * Tier qualification.
 *
 * Clubs earn Ranking Points from results; tour tiers gate on that ranking.
 * Decided and modelled in docs/economy-design.md:
 *
 *   - Thresholds Silver 15, Gold 40. Checked against alternatives: Silver 20 /
 *     Gold 55 never reaches Gold across the whole arc, which fails I8.
 *   - CUMULATIVE eligibility. Clearing a tier keeps the ones below it, so the
 *     calendar grows as a club rises (32 -> 48 -> 62 events). The exclusive
 *     alternative FAILS I5: a club climbing to Silver earned less than it had in
 *     Bronze, because promotion traded 32 Bronze events for 18 Silver ones.
 *   - Ranking RESETS each season, so qualification is re-earned annually.
 *
 * Because eligibility is cumulative, a club is never above a tier it has
 * cleared, so D4(b)'s push-out has nothing to bite on in normal play. It is
 * still implemented: the rule is "above your band scores nothing", and it is
 * what would apply if a threshold were ever raised mid-arc.
 */

export const TIER_THRESHOLDS: Record<string, number> = {
  "Bronze": 0,
  "Silver": 15,
  "Gold":   40,
};

/** Ranking-gated tiers, weakest first. Finals are NOT here — see below. */
export const GATED_TIERS = ["Bronze", "Silver", "Gold"] as const;

/**
 * Finals qualify from end-of-season standings, not from ranking points, so they
 * are never ranking-gated. `bracketBlockReason` in matches.ts already enforces
 * the semi-before-final ordering.
 */
const QUALIFICATION_TIERS = new Set([
  "Continental Final", "World Semi Final", "World Final",
]);

/** Exhibition: no prize, no ranking, no gate. */
const EXHIBITION_TIERS = new Set(["All-Star Match"]);

export type EligibilityReason =
  | "open"              // this tier is unlocked
  | "below_threshold"   // not enough ranking points yet
  | "above_tier"        // pushed out: D4(b), scores nothing
  | "qualification"     // finals — decided by standings, not ranking
  | "exhibition";

export type Eligibility = {
  eligible: boolean;
  reason: EligibilityReason;
  /** What this tier requires, when it is ranking-gated. */
  threshold: number | null;
  /** What the club has right now. */
  currentPoints: number;
  /** How far away, when below. Null when eligible or not applicable. */
  gap: number | null;
  /** Whether a win here scores ranking points and a full purse. */
  scores: boolean;
};

/**
 * The single place a fixture's eligibility is decided.
 *
 * Returned WITH every fixture rather than only on rejection: "why a club did or
 * did not qualify must be legible, never silent", and a rejection on click is
 * too late — by then the player has already chosen.
 */
export function eligibilityFor(tier: string | null | undefined, points: number): Eligibility {
  const t = tier ?? "";

  if (EXHIBITION_TIERS.has(t)) {
    return { eligible: true, reason: "exhibition", threshold: null, currentPoints: points, gap: null, scores: false };
  }
  if (QUALIFICATION_TIERS.has(t)) {
    return { eligible: true, reason: "qualification", threshold: null, currentPoints: points, gap: null, scores: true };
  }

  const threshold = TIER_THRESHOLDS[t];
  if (threshold === undefined) {
    // An unknown tier is treated as open rather than silently blocked — a
    // typo in the schedule must not make a fixture unenterable with no reason.
    return { eligible: true, reason: "open", threshold: null, currentPoints: points, gap: null, scores: true };
  }

  if (points < threshold) {
    return {
      eligible: false, reason: "below_threshold", threshold,
      currentPoints: points, gap: threshold - points, scores: false,
    };
  }

  return { eligible: true, reason: "open", threshold, currentPoints: points, gap: null, scores: true };
}

/** The tiers a club has unlocked, weakest first. */
export function unlockedTiers(points: number): string[] {
  return GATED_TIERS.filter((t) => points >= (TIER_THRESHOLDS[t] ?? 0));
}

/** The highest tier unlocked — what a UI would call the club's current tier. */
export function currentTier(points: number): string {
  return unlockedTiers(points).at(-1) ?? "Bronze";
}

/** Points still needed for the next tier, or null at the top. */
export function nextTierGap(points: number): { tier: string; threshold: number; gap: number } | null {
  for (const t of GATED_TIERS) {
    const threshold = TIER_THRESHOLDS[t] ?? 0;
    if (points < threshold) return { tier: t, threshold, gap: threshold - points };
  }
  return null;
}

/**
 * D4(b): a club above a tier may still enter, but the purse is sharply reduced
 * and no ranking points are awarded. Kept rather than making the fixture
 * ineligible so the calendar stays full and the penalty is legible on the card.
 */
export const PUSHED_OUT_PRIZE_MULTIPLIER = 0.1;
