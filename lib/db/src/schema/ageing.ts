/**
 * Update 1, overnight brief part 4 (Rob, 14 Oct, B-1 and B-2): players develop
 * differently, and age and injuries shape them. Every number in one block, for
 * the server (utils/trainingXp.ts, utils/condition.ts, the season rollover) and
 * the Training page's preview alike.
 *
 * Pure data and arithmetic, no imports: the client aliases this exact file.
 *
 * B-1, the development profile (players.development):
 *   - the average of workEthic and coachability scales training XP from
 *     `profileXp.atLow` (at 40) to `profileXp.atHigh` (at 100);
 *   - injuryProneness scales a match's injury risk from `proneness.atLow` (at
 *     1) to `proneness.atHigh` (at 100);
 *   - consistency and leadership stay unused.
 *
 * B-2, age (staff and medical never change; players do). Each stat has an age
 * it grows best before (XP x`xp.grows`), holds to (x`xp.holds`), and fades
 * from (x`xp.fades`, and points lost at each season's end). Every player has a
 * hidden peak shift of -`peakShiftMax` to +`peakShiftMax` years, rolled once,
 * that moves all her ages (+2: she peaks two years later). A workEthic of
 * `workEthicHalvesFade` or more halves the season-end loss.
 *
 * B-2, injuries: an injury that keeps her out MONEY.salaryCap.injuredLongWeeks
 * (4, money.ts: one number for "serious", the wage share's and this) or more
 * takes 1 point off speed and stamina when it happens, and knocks
 * `seriousInjuryXpCut` off her training XP for good, at most
 * `seriousInjuryXpCutMax` in all.
 */
export type AgeingStat = "speed" | "power" | "stamina" | "defense" | "serve" | "block";

export type StatAge = {
  /** Grows best while her (shifted) age is below this. */
  growsBefore: number;
  /** Fades from this (shifted) age. Holds in between. */
  fadesFrom: number;
  /** Points lost at a season's end while fading: the lower and upper bound (a random whole number between). */
  loss: readonly [number, number];
  /** From this (shifted) age the loss is `heavyLoss` instead (speed: -2 a season from 30). */
  heavyFrom?: number;
  heavyLoss?: number;
};

export const AGEING = {
  /** B-2's table, Rob 14 Oct. */
  stats: {
    speed:   { growsBefore: 22, fadesFrom: 26, loss: [1, 1], heavyFrom: 30, heavyLoss: 2 },
    power:   { growsBefore: 25, fadesFrom: 31, loss: [1, 2] },
    stamina: { growsBefore: 24, fadesFrom: 30, loss: [1, 2] },
    defense: { growsBefore: 28, fadesFrom: 33, loss: [1, 1] },
    serve:   { growsBefore: 28, fadesFrom: 33, loss: [1, 1] },
    block:   { growsBefore: 28, fadesFrom: 33, loss: [1, 1] },
  } as Record<AgeingStat, StatAge>,
  xp: { grows: 1.25, holds: 1, fades: 0.5 },
  peakShiftMax: 2,
  workEthicHalvesFade: 80,
  seriousInjuryXpCut: 0.05,
  seriousInjuryXpCutMax: 0.20,
  /** B-1. */
  profileXp: { low: 40, high: 100, atLow: 0.8, atHigh: 1.2 },
  proneness: { low: 1, high: 100, atLow: 0.7, atHigh: 1.3 },
  /** B-1: a senior who has no potential (an AI club's original) gets one, weighted. */
  potentialWeights: { Average: 60, High: 28, Elite: 10, Generational: 2 } as Record<string, number>,
} as const;

/** The development profile, as stored on players.development. peakShift was added by part 4. */
export type DevelopmentProfile = {
  workEthic: number; coachability: number; consistency: number; leadership: number; injuryProneness: number;
  peakShift?: number;
};

const lerp = (x: number, x0: number, x1: number, y0: number, y1: number) =>
  y0 + (Math.min(x1, Math.max(x0, x)) - x0) / (x1 - x0) * (y1 - y0);

export type AgePhase = "grows" | "holds" | "fades";

/** Where her age puts this stat: growing, holding or fading. */
export function agePhase(stat: AgeingStat, age: number, peakShift = 0): AgePhase {
  const s = AGEING.stats[stat];
  const a = age - peakShift;
  return a < s.growsBefore ? "grows" : a >= s.fadesFrom ? "fades" : "holds";
}

/** The XP multiplier her age gives a session that trains `stat` (a session that trains nothing: holds). */
export function ageXpMultiplier(stat: string | null | undefined, age: number, peakShift = 0): number {
  if (!stat || !(stat in AGEING.stats)) return AGEING.xp.holds;
  return AGEING.xp[agePhase(stat as AgeingStat, age, peakShift)];
}

/** B-1: workEthic and coachability's average, x0.8 at 40 to x1.2 at 100; no profile: x1. */
export function profileXpMultiplier(dev: DevelopmentProfile | null | undefined): number {
  if (!dev) return 1;
  const p = AGEING.profileXp;
  return lerp((Number(dev.workEthic) + Number(dev.coachability)) / 2, p.low, p.high, p.atLow, p.atHigh);
}

/** B-1: injuryProneness, x0.7 at 1 to x1.3 at 100; no profile: x1. */
export function pronenessFactor(dev: DevelopmentProfile | null | undefined): number {
  if (!dev) return 1;
  const p = AGEING.proneness;
  return lerp(Number(dev.injuryProneness), p.low, p.high, p.atLow, p.atHigh);
}

/** B-2: her training XP after her serious injuries (5% each, at most 20%). */
export function seriousInjuryXpFactor(seriousInjuries: number | null | undefined): number {
  return 1 - Math.min(AGEING.seriousInjuryXpCutMax, AGEING.seriousInjuryXpCut * Math.max(0, Number(seriousInjuries ?? 0)));
}

/**
 * B-2: the points `stat` loses at this season's end, at her new age: 0 unless
 * it is fading; a workEthic of 80 or more halves it (a half point is a coin flip).
 */
export function seasonFade(stat: AgeingStat, age: number, dev: DevelopmentProfile | null | undefined, random: () => number = Math.random): number {
  const shift = Number(dev?.peakShift ?? 0);
  if (agePhase(stat, age, shift) !== "fades") return 0;
  const s = AGEING.stats[stat];
  const [lo, hi] = s.loss;
  let loss = s.heavyFrom != null && age - shift >= s.heavyFrom ? (s.heavyLoss ?? hi) : lo + Math.floor(random() * (hi - lo + 1));
  if (dev && Number(dev.workEthic) >= AGEING.workEthicHalvesFade) {
    const half = loss / 2;
    loss = Math.floor(half) + (random() < half - Math.floor(half) ? 1 : 0);
  }
  return loss;
}

/** A peak shift, -2 to +2, rolled once for a player. */
export function rollPeakShift(random: () => number = Math.random): number {
  return Math.floor(random() * (2 * AGEING.peakShiftMax + 1)) - AGEING.peakShiftMax;
}

/** B-1: a potential for a senior who never had one: mostly Average, some High, few Elite, rare Generational. */
export function rollPotential(random: () => number = Math.random): string {
  const w = AGEING.potentialWeights;
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  let at = random() * total;
  for (const [tier, weight] of Object.entries(w)) { if (at < weight) return tier; at -= weight; }
  return "Average";
}
