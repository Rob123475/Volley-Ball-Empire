/**
 * 1.1.3 (Rob, 23 Oct; brief A4): the Empire Nations Cup played over days, and
 * the player's national coach job. Every number of it, once, for the server
 * (api-server utils/nationsCup.ts, utils/nationalCoach.ts) and the pages (the
 * National Team page, the Rules). Pure data, no imports: the client aliases
 * this exact file (vite.config.ts "@shared/national-coach").
 */

/**
 * The Cup's days, counted from the last regular World Tour round's day (round
 * 70). Only three days lie between round 70 and the World Finals' semi-finals
 * (round 71), so the medal day is round 71's own day: the Cup's bronze and gold
 * are played that morning, before the World Finals' semi-finals.
 */
export const NATIONS_CUP_DAYS = [
  { stage: "group",         label: "Group day",       daysAfterLastRound: 1 },
  { stage: "quarter_final", label: "Quarter-finals",  daysAfterLastRound: 2 },
  { stage: "semi_final",    label: "Semi-finals",     daysAfterLastRound: 3 },
  { stage: "medal",         label: "Medal day",       daysAfterLastRound: 4 },
] as const;
export type NationsCupDayStage = (typeof NATIONS_CUP_DAYS)[number]["stage"];

/**
 * The national coach job (on top of his club job).
 *
 *   offers        whenever he has no national job: in the `offerWindowMonths`
 *                 before a Cup, and as soon as a national contract ends. 1 to 3
 *                 nations offer (`offersMin`..`offersMax`); he accepts one or
 *                 declines them all.
 *   who offers    nations that can field a pair, ranked by strength (their best
 *                 two fit players' average rating; 0 = the strongest, 1 = the
 *                 weakest). His manager level (1 Local Coach .. 5 Legend) picks
 *                 the band of that ranking the offers come from: a better record,
 *                 better nations.
 *   contract      `contractYears`, his only choice. Pay is fixed (not
 *                 negotiable) and against the nation's strength: NATIONAL_COACH_PAY.
 *                 It goes to the manager's own salary line, never the club's books.
 */
export const NATIONAL_COACH = {
  offerWindowMonths: 6,
  offersMin: 1,
  offersMax: 3,
  contractYears: [3, 5] as const,
  /** A nation needs this many fit players at clubs to offer (a pair). */
  minEligible: 2,
  levelBands: {
    1: [0.6, 1.0],
    2: [0.45, 0.9],
    3: [0.3, 0.75],
    4: [0.15, 0.55],
    5: [0.0, 0.4],
  } as Readonly<Record<number, readonly [number, number]>>,
} as const;

/**
 * Rob (23 Oct): the weakest nations pay the most and the strongest the least:
 * weak nations are desperate, strong ones back their players and think any
 * coach will do. By the nation's strength share (0 strongest, 1 weakest), a month.
 */
export const NATIONAL_COACH_PAY: ReadonlyArray<{ upToShare: number; monthly: number }> = [
  { upToShare: 0.2, monthly: 3_000 },
  { upToShare: 0.4, monthly: 4_500 },
  { upToShare: 0.6, monthly: 6_000 },
  { upToShare: 0.8, monthly: 7_500 },
  { upToShare: 1.0, monthly: 9_000 },
];

/** The monthly pay for a nation of this strength share (0 strongest .. 1 weakest). */
export function nationalCoachPay(strengthShare: number): number {
  const s = Math.max(0, Math.min(1, strengthShare));
  return (NATIONAL_COACH_PAY.find((b) => s <= b.upToShare) ?? NATIONAL_COACH_PAY[NATIONAL_COACH_PAY.length - 1]!).monthly;
}

/**
 * The short pre-Cup camp (modelled on the pre-season camp, its effect limited
 * to the Cup): chosen on the National Team page before the Cup's first day.
 *   training  the pair plays the Cup `trainingBonus` better, and comes out of
 *             the camp with `trainingFatigue` more fatigue
 *   recovery  the pair starts the Cup at fitness `recoveryFitness`, fatigue 0
 */
export const NATIONAL_CAMP = { trainingBonus: 2, trainingFatigue: 10, recoveryFitness: 100 } as const;
export type NationalCampChoice = "training" | "recovery";
