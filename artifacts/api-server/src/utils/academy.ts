/**
 * R-63 — the academy: how many it holds and what it costs.
 *
 * Rob's decisions (15 Sep):
 *   cap     12 academy players. The signing rule (utils/squadRules.ts), the
 *           season intake (utils/youthIntake.ts) and the Team page banner (through
 *           GET /team/roster's `academy.cap`) all read ACADEMY_CAP.
 *   wages   billed ONCE, in the weekly wage run (routes/calendar.ts). They used to
 *           be charged a second time after every match (utils/academyDevelopment.ts).
 *
 * An academy player is a youth player this career has not promoted
 * (playerClassification.isYouthPlayer) — the same test everywhere.
 */
import { isYouthPlayer, type ClassifiablePlayer } from "./playerClassification.js";

export { ACADEMY_CAP } from "./squadRules.js";

/** An academy player's weekly wage, by potential. The one copy of this table. */
export const ACADEMY_WEEKLY_WAGE: Record<string, number> = {
  Low: 50, Average: 75, High: 100, Elite: 150, Generational: 250,
};

export function academyWeeklyWage(potential: string | null | undefined): number {
  return ACADEMY_WEEKLY_WAGE[potential ?? ""] ?? ACADEMY_WEEKLY_WAGE.Average!;
}

const WEEKS_PER_MONTH = 52 / 12;

/**
 * The salary to store for a new academy player. Stored salaries are MONTHLY
 * (routes/calendar.ts bills them weekly as salary / (52/12)), so an academy
 * player's is the monthly figure of the academy wage — and a graduate, once
 * promoted and billed as a senior, keeps being paid the same.
 */
export function academyMonthlySalary(potential: string | null | undefined): number {
  return academyWeeklyWage(potential) * WEEKS_PER_MONTH;
}

/** How many of these players are in the academy. */
export function academySize(players: readonly ClassifiablePlayer[]): number {
  return players.filter((p) => isYouthPlayer(p) && !p.isRetired).length;
}
