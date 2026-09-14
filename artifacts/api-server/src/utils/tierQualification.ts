/**
 * Tiers (R-54).
 *
 * A club's tier is where its season's World Tour ranking points put it, so it
 * follows what the player can see: the standings. Every win scores its event's
 * points from the first round (Bronze 1, Silver 2, Gold 4, World Semi Final 8,
 * World Final 15 — utils/rankingPoints.ts), every club starts the season at 0,
 * and the ranking resets each season.
 *
 * ── The thresholds, derived from real seasons ─────────────────────────────
 * Re-derived on 14 Sep 2026 from 10 complete season-1 World Tour fields: 190
 * club-seasons of 57 events plus finals against real drawn opponents, every win
 * scored (docs/REPAIR-REGISTER.md R-54).
 *
 *   finish   season points, median (range)
 *   #1       91   (75-99)
 *   #4       65   (63-71)
 *   #5       62   (58-67)
 *   #10      55.5 (51-58)
 *   #11      53   (50-56)
 *   #19      36   (31-39)
 *
 *   Gold 63    every sampled top-4 club reached it (40 of 40); the median #5 did not
 *   Silver 55  the median #10 reached it; the median #11 did not
 *
 * The pair agrees with "top 4 Gold, 5-10 Silver, 11-19 Bronze" for 92.1% of the
 * 190 club-seasons. Gold 64 agrees for 92.6% but left one sampled #4 at Silver.
 *
 * They replace Silver 15 / Gold 40, which were modelled on a 62-event season
 * against tier-rated opponents, before real fields, the 57-event season and
 * R-11's established head start existed. On top of those, a Silver or Gold win
 * scored nothing until the club already held 15 or 40 points, so the tier
 * measured when a club crossed a gate rather than how good it was: a club
 * finishing #3-4 could end Silver or Bronze.
 *
 * ── What a tier does ──────────────────────────────────────────────────────
 * Purse access (Rob, R-54): the tier a club finished LAST season is the highest
 * tier whose purses it is paid in full this season. Above it, an event is still
 * played and still scores its points, but pays LOCKED_PURSE_MULTIPLIER of its
 * purse. Season 1 has no last season: difficulty stands in for it
 * (utils/careerDifficulty.ts SEASON_ONE_PURSE_TIER). The World Finals qualify
 * from the standings and always pay in full.
 */

export type Tier = "Bronze" | "Silver" | "Gold";

/** Weakest first. */
export const TIERS: readonly Tier[] = ["Bronze", "Silver", "Gold"];

export const TIER_THRESHOLDS: Record<Tier, number> = {
  Bronze: 0,
  Silver: 55,
  Gold:   63,
};

/** What an event above the club's purse access pays, as a share of its purse. */
export const LOCKED_PURSE_MULTIPLIER = 0.1;

/** The finals qualify from the standings, not from a tier. */
const FINALS_TIERS = new Set(["Continental Final", "World Semi Final", "World Final"]);

export function isTier(value: unknown): value is Tier {
  return typeof value === "string" && (TIERS as readonly string[]).includes(value);
}

/** The tier a season's ranking points reach. */
export function tierForPoints(points: number): Tier {
  if (points >= TIER_THRESHOLDS.Gold) return "Gold";
  if (points >= TIER_THRESHOLDS.Silver) return "Silver";
  return "Bronze";
}

export type PurseAccess = {
  /** The event's tier, as scheduled. */
  eventTier: string | null;
  /** The highest tier this club is paid in full this season. */
  accessTier: Tier;
  fullPurse: boolean;
  /** The share of the purse this club is paid: 1, or LOCKED_PURSE_MULTIPLIER. */
  multiplier: number;
  /** open: at or below access; finals: always full; above_access: 10% until the club finishes a season at this tier. */
  reason: "open" | "finals" | "above_access";
};

/**
 * The single place a fixture's purse is decided. Returned WITH every fixture so
 * the player sees what an event pays before playing it, not after.
 */
export function purseAccessFor(eventTier: string | null | undefined, accessTier: Tier): PurseAccess {
  const tier = eventTier ?? null;
  if (tier != null && FINALS_TIERS.has(tier)) {
    return { eventTier: tier, accessTier, fullPurse: true, multiplier: 1, reason: "finals" };
  }
  // An unknown or absent tier (a friendly) is open rather than silently cut.
  if (!isTier(tier) || TIERS.indexOf(tier) <= TIERS.indexOf(accessTier)) {
    return { eventTier: tier, accessTier, fullPurse: true, multiplier: 1, reason: "open" };
  }
  return { eventTier: tier, accessTier, fullPurse: false, multiplier: LOCKED_PURSE_MULTIPLIER, reason: "above_access" };
}
