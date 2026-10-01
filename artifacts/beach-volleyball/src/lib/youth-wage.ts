/**
 * Overnight brief 1 Oct, N-33: a youth's wage in one unit everywhere: a month,
 * with the week the academy bills in brackets ("$433 a month ($100 a week)").
 * The contract box, the market card and the Youth Loans tab all use this; the
 * loan list showed weeks and the contract box months.
 */
const WEEKS_PER_MONTH = 52 / 12;
const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** From a monthly figure (a stored salary). */
export function youthWageText(monthly: number): string {
  return `${dollars(monthly)} a month (${dollars(monthly / WEEKS_PER_MONTH)} a week)`;
}

/** From a weekly figure (what the academy bills, the loans' halves). */
export function youthWageTextFromWeekly(weekly: number): string {
  return youthWageText(weekly * WEEKS_PER_MONTH);
}
