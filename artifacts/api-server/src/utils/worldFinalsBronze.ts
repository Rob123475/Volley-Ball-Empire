/**
 * 1.1.3 (Rob, 23 Oct; brief A5): the World Finals bronze.
 *
 * The World Finals have semi-finals and a final only. Bronze goes to the losing
 * semi-finalist HIGHER on the season's World Tour ladder, by the ladder's own
 * tie-breakers: ranking points, then wins, then set difference, then the
 * difference in rally points won and lost. Only when the two are still level
 * after all four is a third-place match played (utils/worldTour.ts
 * seedWorldFinalTx, on the final's day).
 *
 * Pure (no imports), so the harness tests it as the server runs it.
 */
export type BronzeLine = { competitorId: number; points: number; wins: number; setDiff: number; pointDiff: number };

/** Which losing semi-finalist takes bronze on the ladder, or "level" (a third-place match decides). */
export function bronzeOnLadder(a: BronzeLine, b: BronzeLine): BronzeLine | "level" {
  const order = (b.points - a.points) || (b.wins - a.wins) || (b.setDiff - a.setDiff) || (b.pointDiff - a.pointDiff);
  if (order === 0) return "level";
  return order < 0 ? a : b;
}
