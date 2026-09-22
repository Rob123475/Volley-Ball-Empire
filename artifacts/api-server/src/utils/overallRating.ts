/**
 * A player's overall rating: the mean of her six core stats.
 *
 * This lived twice, in routes/game-api.ts and routes/unity.ts, the second copy
 * carrying the comment "mirrors game-api.ts" — which is the whole problem with
 * a mirror. L-02d needed a third caller (which graduates a club keeps when it
 * is over the cap, weakest first), and a number that decides who loses their
 * place should be the same number the screens show.
 */
export type CoreStats = {
  speed: number; power: number; defense: number;
  serve: number; block: number; stamina: number;
};

export function overallRating(p: CoreStats): number {
  return Math.round((p.speed + p.power + p.defense + p.serve + p.block + p.stamina) / 6);
}
