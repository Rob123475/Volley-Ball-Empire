/**
 * What it costs to be a club for a week.
 *
 * ── Rob's rule (22 Sep, final) ──────────────────────────────────────────────
 * "Money means something": a club that finishes last goes backwards every
 * season, and five seasons of it sends the club broke. A Gold-tier club goes
 * forwards, modestly. Prize money and sponsors are the income.
 *
 * ── What was here before ────────────────────────────────────────────────────
 * One line: `weeklyStaff = Math.round(weeklySalary * 0.2)`, described in the
 * ledger as "Weekly staff & operational costs". A club with a small wage bill
 * therefore had small running costs, which is backwards — the beach, the gym,
 * the medical room, the flights and the entry fees do not get cheaper because
 * the squad is cheap. Measured over thirty seasons, a club that finished 19th
 * of 19 for nine years running still banked $440,000 a season and ended on
 * $20.3 million. Nothing it could buy cost it anything.
 *
 * ── The shape ───────────────────────────────────────────────────────────────
 * Three parts, each of which is a thing a club actually pays for:
 *
 *   base     the club exists — ground, insurance, admin, the office. It is
 *            there whether anyone plays or not, and it is why a club with no
 *            income cannot simply sit still and survive.
 *   squad    per person on the books, senior and academy alike: kit, food,
 *            physio, a seat on the plane.
 *   the tour where the World Tour goes that season. Bronze events are close to
 *            home and cheap to enter; the Gold circuit is a year of long-haul
 *            flights, long stays and the entry fees to match.
 *
 * The tour line is the one that stops a Gold season being a fortune. A Gold
 * club earns far more — richer purses in full (data/worldTour.ts) and a
 * reputation that pays twice the sponsor income — and it spends most of that
 * difference chasing the circuit that pays it. What is left over is real, and
 * modest, and has to be earned again next season.
 *
 * These are the numbers L-04 tuned against harness/economy.mjs, which prints
 * the season-by-season table they produce. Change one and that suite will say
 * what it did.
 */
import type { Tier } from "./tierQualification.js";

/**
 * A week of simply being a club.
 *
 * This carries most of the weight, and the per-player line carries little, for
 * a measured reason: with it the other way round a brand-new club — three
 * seniors, no academy — finished last in its first season and came out within
 * a few thousand either side of nought, which is a coin flip, not a rule. A
 * club's costs are mostly the club, not the size of its squad.
 */
export const RUNNING_COST_BASE = 5_000;

/** Per person on the books that week — senior, graduate or academy. */
export const RUNNING_COST_PER_PLAYER = 100;

/**
 * A week of chasing the tour the club has access to.
 *
 * Bronze is a domestic season; Gold is fifty-odd long-haul events. The gap is
 * deliberately wide: tier access is the dominant income lever by design
 * (docs/economy-design.md sec 2), so it has to be the dominant cost lever too,
 * or the top tier is free money.
 */
export const TOUR_COST_BY_TIER: Record<Tier, number> = {
  Bronze: 2_500,
  Silver: 4_500,
  Gold: 10_000,
};

/**
 * Why the tour line is the big one and the squad line is small: a club enters
 * and travels to fifty-odd events whether it takes three players or sixteen.
 * With the weight the other way round, a brand-new club — three seniors and no
 * academy — was cheap enough to finish last in its first season and still make
 * money, which is the one thing this rule exists to stop.
 */

export function weeklyRunningCost(squadSize: number, tier: Tier): number {
  return (
    RUNNING_COST_BASE +
    RUNNING_COST_PER_PLAYER * Math.max(0, squadSize) +
    (TOUR_COST_BY_TIER[tier] ?? TOUR_COST_BY_TIER.Bronze)
  );
}

/** What the ledger line says, so a player can see where the money went. */
export function runningCostDescription(squadSize: number, tier: Tier): string {
  return (
    `Weekly running costs — club ${RUNNING_COST_BASE.toLocaleString()}, ` +
    `squad of ${squadSize} ${(RUNNING_COST_PER_PLAYER * squadSize).toLocaleString()}, ` +
    `${tier} tour ${(TOUR_COST_BY_TIER[tier] ?? TOUR_COST_BY_TIER.Bronze).toLocaleString()}`
  );
}
