/**
 * Overnight brief 1 Oct, N-41 (Rob's decisions, 1 Oct): the money pass, every
 * number in one place so Rob can tune it. Change a figure here and the server,
 * the AI clubs and the screens all follow; nothing restates these elsewhere.
 *
 *   managerSalaryMonthly    every manager (Rob's, and each AI club's AI manager)
 *                           is paid a monthly salary in this range, weekly from
 *                           the club's budget like staff wages; the ledger line
 *                           is "Manager salary". Each manager's figure is fixed
 *                           inside the range (a hash of the career or the club).
 *   headCoachSalaryMonthlyMax
 *                           a head coach's monthly salary is capped here (the
 *                           market, hired coaches, new coaches).
 *   playerWageRiseMonthly   every senior player's monthly wage rises by this
 *                           much, AI clubs included, existing contracts and new
 *                           ones; youth are not included. The rise is the
 *                           minimum for a player rated `atRating.min` or less,
 *                           the maximum at `atRating.max` or more, in between
 *                           in proportion (the shipped seniors span 66-77).
 *   sponsorWeeklyBonus      every club's sponsor income rises by this much a
 *                           week, AI clubs included (on top of what its sponsor
 *                           reputation earns, about $10,000 a week at 50).
 */
export const MONEY = {
  managerSalaryMonthly: { min: 16_000, max: 20_000 },
  headCoachSalaryMonthlyMax: 20_000,
  playerWageRiseMonthly: { min: 5_000, max: 10_000, atRating: { min: 66, max: 77 } },
  sponsorWeeklyBonus: 10_000,
} as const;

/** A fixed number in [0, 1) for a key (FNV-1a), so a manager's salary never re-rolls. */
function unit(key: string): number {
  let h = 0x811c9dc5;
  for (const ch of key) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h / 0x100000000;
}

/** A manager's monthly salary, fixed inside the range for this key, on $100 steps. */
export function managerSalaryFor(key: string): number {
  const { min, max } = MONEY.managerSalaryMonthly;
  return Math.round((min + (max - min) * unit(`manager-salary:${key}`)) / 100) * 100;
}

/** The monthly wage rise for a senior player of this overall rating, on $100 steps. */
export function playerWageRise(overallRating: number): number {
  const { min, max, atRating } = MONEY.playerWageRiseMonthly;
  const t = Math.max(0, Math.min(1, (overallRating - atRating.min) / (atRating.max - atRating.min)));
  return Math.round((min + (max - min) * (Number.isFinite(t) ? t : 0)) / 100) * 100;
}

/** A head coach's monthly salary, held to the cap. */
export function cappedHeadCoachSalary(monthly: number): number {
  return Math.min(Number(monthly) || 0, MONEY.headCoachSalaryMonthlyMax);
}
