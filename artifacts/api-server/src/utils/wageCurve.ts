/**
 * The wage curve.
 *
 * `players.asking_price` is reference data — what an athlete COSTS — and the
 * monthly wage was simply asking_price / 12. Measured across the shipped
 * roster that curve is steep and narrow at the same time:
 *
 *   asking price   $66,000 -> $180,000   (2.7x)
 *   overall rating    66.2 ->      76.3  (1.15x, ten points)
 *
 * So price rises 2.7x for a 15% capability gain, while expected income rises
 * only 1.39x across the same span. That is the I1 inversion: the best squad
 * grosses the most and nets the least, because the wage bill eats the entire
 * prize delta and more.
 *
 * §1's escape clause put the wage curve in scope once gating alone failed to
 * fix I1, and it does fail — gating narrowed the inversion from a 1.69x spread
 * to 1.08x but did not reverse it.
 *
 * This flattens the TOP END only. Below the knee nothing changes, so the
 * cheap end of the market keeps its shape and a budget club still faces real
 * prices; above it, each additional dollar of asking price buys a smaller
 * increment of wage. Elite players stay the most expensive — they just stop
 * costing multiples of what they return.
 *
 * Deliberately NOT done here: raising prize scaling at Gold and above. That
 * would worsen I3, which is already at 35% against a 15% target — the single
 * World Final is 35% of the season's prize money. Prizes are Phase 3.
 */

/** Asking price below which the curve is untouched. */
export const WAGE_KNEE = 100_000;

/**
 * How much of each dollar above the knee reaches the wage.
 * 1.0 restores the old linear curve; 0 makes every elite player cost the knee.
 */
export const WAGE_COMPRESSION = 0.4;

/**
 * The asking price a wage is actually derived from.
 *
 * Kept separate from the division by 12 so the compression is legible on its
 * own and can be measured without a magic number buried in a seeder.
 */
export function effectiveAskingPrice(
  askingPrice: number,
  knee = WAGE_KNEE,
  compression = WAGE_COMPRESSION,
): number {
  if (!Number.isFinite(askingPrice) || askingPrice <= knee) return Math.max(0, askingPrice || 0);
  return knee + (askingPrice - knee) * compression;
}

/** Monthly wage for an athlete with this asking price. */
export function monthlyWage(
  askingPrice: number | null | undefined,
  knee = WAGE_KNEE,
  compression = WAGE_COMPRESSION,
): number {
  return Math.round(effectiveAskingPrice(Number(askingPrice ?? 0), knee, compression) / 12);
}
