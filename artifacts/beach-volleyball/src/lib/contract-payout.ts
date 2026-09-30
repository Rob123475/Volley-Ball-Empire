/**
 * Overnight brief 30 Sep, item 33b: what releasing someone early costs, for
 * the confirm boxes: the rest of the contract, the whole of it, a part month
 * paid as a month. The server's rule is utils/contractTerms.ts
 * terminationPayout; this copy exists because the browser cannot import that
 * package, and harness/staff-contracts.mjs checks the two give the same figures.
 */
export function contractPayout(monthlySalary: number, today: string, endDate: string | null | undefined): number {
  if (!endDate || !today || endDate <= today) return 0;
  const days = (Date.parse(endDate) - Date.parse(today)) / 86_400_000;
  if (!Number.isFinite(days) || days <= 0) return 0;
  return Math.max(0, Math.round(monthlySalary * Math.ceil(days / 30.44)));
}

/** Months left on a contract, a part month counted as a month (as it is paid). */
export function monthsLeft(today: string, endDate: string | null | undefined): number {
  if (!endDate || !today || endDate <= today) return 0;
  return Math.ceil((Date.parse(endDate) - Date.parse(today)) / 86_400_000 / 30.44);
}
