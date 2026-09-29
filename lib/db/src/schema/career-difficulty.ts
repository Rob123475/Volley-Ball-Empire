/**
 * D-2 — the money a career starts with, defined ONCE for server and client.
 *
 * The server opens every career on its difficulty's figure (R-11,
 * artifacts/api-server/src/utils/careerDifficulty.ts), whatever club is
 * chosen. The club picker used to print the club template's own
 * `starting_budget` ($300K-$520K) instead, which nothing has used since R-11,
 * so "Sydney Riptide · $400K budget" became a $500,000 career. Both wizards
 * now read this table, the same one the server charges from.
 *
 * Pure data, no imports: the client aliases this exact file (vite.config.ts),
 * and nothing here may pull drizzle into the browser bundle.
 */

export type StartingDifficulty = "underdog" | "established";

/** UNDERDOG: "tight from the first week." ESTABLISHED: "comfortable but not rich." */
export const STARTING_BUDGET: Record<StartingDifficulty, number> = {
  underdog:    150_000,
  established: 500_000,
};
