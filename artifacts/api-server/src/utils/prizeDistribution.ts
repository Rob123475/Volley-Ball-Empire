/**
 * How an event's purse is split between the two finishers.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 *
 * The purse used to be winner-takes-all: `prizeEarned = won ? purse : 0`. That
 * one line was the mechanical cause of two failed invariants.
 *
 * I4 PREDICTABILITY asks that the same squad's season income vary by less than
 * about +/-25%, so the player can plan. Under winner-takes-all every event's
 * entire value is decided by a single coin flip, and the measured deviation was
 * 41.5% across five runs of the same schedule ($380,500 to $896,500). No amount
 * of re-pricing fixes that, because the spread is a property of the payout
 * SHAPE, not of the numbers being paid.
 *
 * I3 NO SINGLE-MATCH LOTTERY asks that no one match be worth more than ~15% of
 * a season. The purse re-scale brought the World Final from 35.0% to 11.8% of
 * the season's prize money, but a 11.8% event that pays all-or-nothing is still
 * an 11.8% swing. Splitting it makes the swing 30% of that.
 *
 * ── Why paying the loser is the DESIGN, not a softening ────────────────────
 *
 * docs/economy-design.md sec 2 states the intent directly: "Prize scales steeply
 * by tier, so tier ACCESS - not win rate within a tier - is the dominant income
 * lever." Winner-takes-all makes win rate the dominant lever, which is the
 * opposite. Runner-up money moves income differences off the coin flip and onto
 * which events a club is eligible to enter at all - the thing the tier gate
 * already controls.
 *
 * It is also how real tour purses work. Beach volleyball events pay down the
 * finishing order; only an exhibition pays nothing for turning up.
 *
 * ── The cost, stated up front ──────────────────────────────────────────────
 *
 * This COMPRESSES the income gap between a strong squad and a weak one, because
 * the weak squad now banks something when it loses. Income per event goes from
 *
 *     purse * w                       (winner-takes-all)
 * to  purse * (0.30 + 0.40 * w)       (with a runner-up share)
 *
 * so a squad winning 70% against one winning 55% earns 1.27x as much before and
 * only 1.12x after. That works AGAINST I1 MONOTONIC RETURN, which needs income
 * to rise with squad quality faster than wages do.
 *
 * The split is set at 70/30 rather than an even-handed 65/35 for exactly this
 * reason: both land I4 comfortably (a 0.40 spread against the old 1.00 leaves
 * roughly 40% of the original variance), so the shallower runner-up share is
 * chosen because it gives back the most win-rate separation for the least cost
 * to predictability.
 *
 * The design's answer is that the separation is supposed to come from tier
 * access, not from win rate - a better squad clears thresholds sooner, enters
 * richer events, and the steep per-tier pricing does the rest. That only pays
 * off once the thresholds actually separate the squads, which today they do not
 * (I5 measures all four test squads finishing in the same band). So this change
 * is expected to move I3 and I4 and NOT to fix I1 on its own. Measured, not
 * assumed - see the Phase 3 numbers in docs/economy-design.md.
 *
 * ── Single source of truth ─────────────────────────────────────────────────
 *
 * harness/invariants.mjs imports these shares rather than restating them. A
 * model that recomputes the payout formula stops measuring the game the moment
 * one of the two copies moves.
 */

/** Share of the purse taken by the winner of an event. */
export const WINNER_SHARE = 0.70;

/** Share of the purse taken by the losing finalist. */
export const RUNNER_UP_SHARE = 0.30;

/**
 * The two shares must account for the whole purse. A split that quietly summed
 * to less than 1 would drain money out of the economy on every event, and the
 * shortfall would show up as an unexplained drift in I9 rather than as a bug.
 */
const TOTAL = WINNER_SHARE + RUNNER_UP_SHARE;
if (Math.abs(TOTAL - 1) > 1e-9) {
  throw new Error(
    `Prize shares must sum to 1, got ${TOTAL} ` +
      `(winner ${WINNER_SHARE} + runner-up ${RUNNER_UP_SHARE}).`,
  );
}

/** The fraction of an event's purse a finisher takes, by result. */
export function placementShare(won: boolean): number {
  return won ? WINNER_SHARE : RUNNER_UP_SHARE;
}

/**
 * What a club actually banks from one event.
 *
 * @param purse       the event's full prize pot
 * @param won         whether the club won the match
 * @param multiplier  tier-eligibility multiplier (see PUSHED_OUT_PRIZE_MULTIPLIER)
 */
export function prizeFor(purse: number, won: boolean, multiplier = 1): number {
  if (!Number.isFinite(purse) || purse <= 0) return 0;
  return Math.round(purse * placementShare(won) * multiplier);
}
