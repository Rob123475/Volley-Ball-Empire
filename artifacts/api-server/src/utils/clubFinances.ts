/**
 * What a week costs a club, and what a week pays it — for EVERY club.
 *
 * ── Rob's rule (23 Sep, final) ──────────────────────────────────────────────
 * "Every AI club gets the same finances as the gamer's club: a balance, wages
 * paid each season under the same 6m/1s/2s contracts, the same running costs,
 * and the same prize money and sponsor income from their real World Tour
 * results. No shortcuts and no separate 'AI economy' — one set of rules for
 * every club."
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 * The numbers below were inside the weekly block of routes/calendar.ts, which
 * only ever runs for the club the player manages. Giving the other sixty clubs
 * books would have meant either writing those numbers down a second time — and
 * a second copy is a second set of rules the moment one of them is retuned —
 * or lifting them out to where both can reach them. This is the lift. Nothing
 * here is new: `routes/calendar.ts` imports these and charges the player's club
 * with the same functions that charge every AI club, so the two cannot drift.
 *
 * The one thing that is NOT here is the ledger. The player's club writes a
 * `finance_transactions` row for every line so the Finances page can show it;
 * an AI club moves its balance and nothing more. That is a difference in what
 * is WRITTEN DOWN, not in what is charged — the amounts come from these
 * functions either way.
 *
 * See also utils/runningCosts.ts (the ground, the squad and the tour) and
 * utils/poolClubFinances.ts (the same rules applied to the sixty).
 */
import { weeklyRunningCost, type RunningCostTier } from "./runningCosts.js";

/**
 * 52 weeks / 12 months — the divisor that turns a monthly salary into the
 * weekly instalment actually charged. Salaries are monthly figures (R-67).
 */
export const WEEKS_PER_MONTH = 52 / 12;

/** Sponsor reputation everyone starts on, and pulls back toward. */
export const SPONSOR_REP_BASELINE = 50;

/**
 * Sponsor reputation pulls this fraction of the way back toward the baseline
 * every salary week.
 *
 * Reputation moves +1 per win and -1 per loss with only a hard floor at 0, so
 * a club that loses more than it wins drifts down without limit and earns least
 * exactly when it needs most — reaching 0, and $0 a week, with no way back.
 * A winning club is unaffected in practice: the pull toward 50 is negligible
 * next to +1 per win once it is clear of the baseline.
 */
export const SPONSOR_REP_DECAY_PER_WEEK = 0.05;

/** Dollars of sponsor and commercial income per point of reputation, per week. */
export const SPONSOR_INCOME_PER_REPUTATION = 200;

/** This week's reputation, after the pull toward the baseline. Clamped 0-100. */
export function decayedReputation(reputation: number): number {
  const pulled = reputation + (SPONSOR_REP_BASELINE - reputation) * SPONSOR_REP_DECAY_PER_WEEK;
  return Math.max(0, Math.min(100, Math.round(pulled)));
}

/** A week of sponsor and commercial income at this reputation. */
export function sponsorWeeklyIncome(reputation: number): number {
  return Math.round(Math.max(0, reputation) * SPONSOR_INCOME_PER_REPUTATION);
}

/** The weekly instalment of a set of MONTHLY salaries. */
export function weeklyWageBill(monthlySalaries: readonly number[]): number {
  const monthly = monthlySalaries.reduce((sum, s) => sum + (Number.isFinite(s) ? s : 0), 0);
  return Math.round(monthly / WEEKS_PER_MONTH);
}

/**
 * Everything a club pays out in a week: its people and its running costs.
 *
 * `tier` is the tour the club has access to, or null for a club that is not in
 * the World Tour field this season — it plays its regional league, which is
 * close to home, so it pays the ground and the squad and no tour
 * (utils/runningCosts.ts explains why the tour line is the big one).
 */
export function weeklyClubOutgoings(args: {
  monthlySalaries: readonly number[];
  squadSize: number;
  tier: RunningCostTier;
}): { wages: number; running: number; total: number } {
  const wages = weeklyWageBill(args.monthlySalaries);
  const running = weeklyRunningCost(args.squadSize, args.tier);
  return { wages, running, total: wages + running };
}

// ── What a player is paid ────────────────────────────────────────────────────

/**
 * A monthly salary for a club's own player, from her overall rating.
 *
 * MEASURED, not picked. The 192 priced seniors in the shipped database carry an
 * `asking_price` that is exactly twelve months of salary (R-67 settled that:
 * every hand-typed player has `askingPrice === salary * 12`), so the game's own
 * data already states what a player of a given standard is worth. A least
 * squares fit through those 192 gives
 *
 *     asking price  =  ASK_PER_RATING_POINT x overall  +  ASK_INTERCEPT
 *
 * and a month of it is that over twelve. harness/economy.mjs re-measures the
 * shipped database and fails if this drifts from it, the same way
 * youthIntake.ts's SEEDED_YOUTH_STATS are held to the 72 shipped youth.
 *
 * It is used for the sixty AI clubs, whose players have no salary of their own
 * — the player's own squad keeps the salaries their contracts were signed on.
 * Clamped to what the shipped seniors actually span, so a rating outside the
 * range the fit was measured over cannot produce a number nobody has seen.
 */
export const ASK_PER_RATING_POINT = 5_224;
export const ASK_INTERCEPT = -257_448;
export const MIN_MONTHLY_SALARY = 6_500;
export const MAX_MONTHLY_SALARY = 14_500;

export function monthlySalaryFor(overallRating: number): number {
  const ask = ASK_PER_RATING_POINT * overallRating + ASK_INTERCEPT;
  const monthly = Math.round(ask / 12);
  return Math.max(MIN_MONTHLY_SALARY, Math.min(MAX_MONTHLY_SALARY, monthly));
}
