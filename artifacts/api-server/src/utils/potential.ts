/**
 * A player's development potential (her true tier, never sent to the client;
 * a scout's report shows his reading of it). One table for how much it speeds
 * or slows her growth, used by training sessions (routes/training.ts) and,
 * since overnight 30 Sep item 12, by the academy's weekly development
 * (utils/academyDevelopment.ts), which ignored it: two youths with the same
 * stats grew exactly alike whatever their potential.
 */
export const POTENTIAL_MULTIPLIERS: Record<string, number> = {
  "Generational": 1.30,
  "Elite":        1.15,
  "High":         1.00,
  "Average":      0.90,
  "Low":          0.80,
};

/** The growth multiplier for a potential tier (an unknown tier grows as Average). */
export function potentialMultiplier(potential: string | null | undefined): number {
  return POTENTIAL_MULTIPLIERS[potential ?? "Average"] ?? POTENTIAL_MULTIPLIERS["Average"]!;
}
