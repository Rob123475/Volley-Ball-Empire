/**
 * How long a contract can run, and when it ends.
 *
 * ── Rob's rule (22 Sep, final) ──────────────────────────────────────────────
 * EVERY player, staff member and medical staff member has a contract, and the
 * only allowed lengths are:
 *
 *     6 months · 1 season · 2 seasons
 *
 * Nothing else, anywhere: signing, renewal, youth promotion, staff hire,
 * medical hire. There are no 5-season contracts in this game.
 *
 * ── Why a season, not a year ────────────────────────────────────────────────
 * A season is the end of a year's World Tour, and it is NOT 365 days: the
 * rollover harness measures 418-421 depending on the year. The old code added a
 * calendar year (`addOneYear`) and capped every contract at one year from the
 * game date, so a "season" contract drifted away from the season it was meant
 * to cover. A contract length is therefore resolved against the real season
 * rows, not against arithmetic on the signing date.
 *
 *     6m   six months from the signing date
 *     1s   the end of the season being played when it is signed
 *     2s   the end of the season after that one
 *
 * Signing a "1 season" deal in the last week of a season gives a short deal.
 * That is deliberate and it is how the real thing behaves: you are buying the
 * rest of this season. The UI shows the end date before the deal is agreed.
 *
 * This module owns the rule for the server. The frontend keeps its own copy of
 * the three options for its dropdowns, because lib/db cannot be imported by a
 * browser (its index opens a SQLite connection), and
 * `harness/contract-terms.mjs` asserts the two lists are identical so they
 * cannot drift apart.
 */

/** The only contract lengths that exist. */
export const CONTRACT_LENGTHS = ["6m", "1s", "2s"] as const;

export type ContractLength = (typeof CONTRACT_LENGTHS)[number];

/** What the player is shown. The UI must not invent its own wording. */
export const CONTRACT_LENGTH_LABELS: Record<ContractLength, string> = {
  "6m": "6 months",
  "1s": "1 season",
  "2s": "2 seasons",
};

/** The length a backfill or an unspecified signing gets. Rob: 1 season. */
export const DEFAULT_CONTRACT_LENGTH: ContractLength = "1s";

export function isContractLength(v: unknown): v is ContractLength {
  return typeof v === "string" && (CONTRACT_LENGTHS as readonly string[]).includes(v);
}

/**
 * The length a request asked for, or the reason it is not one of the three.
 *
 * Every route that starts or renews a contract reads its body through this, so
 * a player deal, a staff deal and a medical deal cannot end up with different
 * ideas of what is allowed.
 */
export function readContractLength(body: unknown): { length: ContractLength } | { error: string } {
  const raw = (body as { length?: unknown } | null)?.length;
  if (raw == null) return { length: DEFAULT_CONTRACT_LENGTH };
  if (!isContractLength(raw)) {
    return {
      error: `Contract length must be one of ${CONTRACT_LENGTHS.join(", ")} ` +
             `(${CONTRACT_LENGTHS.map((l) => CONTRACT_LENGTH_LABELS[l]).join(", ")}).`,
    };
  }
  return { length: raw };
}

/** Six months on, clamped to the end of the month (31 Aug + 6m = 28/29 Feb). */
export function addSixMonths(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  let year = y!;
  let month = m! + 6;
  if (month > 12) { month -= 12; year += 1; }
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(d!, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * The date a contract of `length` signed on `today` ends.
 *
 * `seasonEnds` is the end date of the season being played, then each following
 * season, in order — whatever the caller could find. A "2s" deal signed in the
 * last season a save has generated falls back to the last known end rather than
 * inventing a date; the rollover extends it on the next boundary if it must.
 */
export function contractEndDate(
  length: ContractLength,
  today: string,
  seasonEnds: readonly string[],
): string {
  if (length === "6m") return addSixMonths(today);

  const wanted = length === "1s" ? 0 : 1;
  const future = seasonEnds.filter((e) => e >= today);
  if (future.length === 0) {
    // No season row reaches past today — only possible on a malformed save.
    // Six months is the shortest legal deal, so it is the safe floor.
    return addSixMonths(today);
  }
  if (wanted < future.length) return future[wanted]!;

  // A 2-season deal signed before the next season exists.
  //
  // Seasons are created one at a time, inside the rollover that opens them
  // (R-35), so in season 1 there is exactly one season row and the season after
  // it has no end date yet. Clamping to the last known end would quietly make
  // every "2 seasons" deal a 1-season deal — which is what the first run of
  // harness/contract-terms.mjs caught. The season boundary is the turn of the
  // year, so each further season is projected a year on from the last known
  // end; the rollover writes the real row later and it lands on the same date.
  const last = future[future.length - 1]!;
  const beyond = wanted - (future.length - 1);
  const [y, m, d] = last.split("-");
  return `${Number(y) + beyond}-${m}-${d}`;
}

/**
 * What is still owed on a contract terminated early, paid from the club balance.
 *
 * Rob's rule: "Club ends a contract early → the remainder of the contract is
 * paid out from the club balance." The remainder is the whole of the salary
 * that would have been paid between today and the end date — no discount, no
 * negotiated settlement. Salary is a MONTHLY figure (R-67), so the remainder is
 * months remaining × salary, never less than zero.
 */
export function terminationPayout(monthlySalary: number, today: string, endDate: string): number {
  if (!endDate || endDate <= today) return 0;
  const days = (Date.parse(endDate) - Date.parse(today)) / 86_400_000;
  if (!Number.isFinite(days) || days <= 0) return 0;
  // Part of a month is paid as a month: the club broke the deal, so it does not
  // get to round the last month down.
  const months = Math.ceil(days / 30.44);
  return Math.max(0, Math.round(monthlySalary * months));
}

/** 4 weeks, in game days: how long before an end date the warning appears. */
/**
 * Where a RENEWAL ends: the same three lengths, measured on from the day the
 * old contract ends rather than from today.
 *
 * Kept apart from contractEndDate for two reasons the renewal route got wrong
 * by reusing it:
 *
 *   - a contract may only be renewed in its final season, so its end date is
 *     usually the current season's end — and a season list that still contains
 *     that date made a 1-season renewal end on the day it already ended. The
 *     renewal returned 200, changed nothing, and the player left at the
 *     boundary. A thirty-season run lost its squad and the manager was sacked
 *     for abandonment (R-48).
 *   - the season being renewed INTO has no row yet. Seasons are created one at
 *     a time by the rollover (R-35), so the next end date is unknown at the
 *     moment of renewal and has to be projected: the boundary is the turn of
 *     the year, and the rollover writes the real row on the same date later.
 */
export function renewalEndDate(
  length: ContractLength,
  currentEnd: string,
  seasonEnds: readonly string[],
): string {
  if (length === "6m") return addSixMonths(currentEnd);

  const need = length === "1s" ? 1 : 2;
  const ends = [...seasonEnds].filter((e) => e > currentEnd).sort();
  while (ends.length < need) {
    const base = ends[ends.length - 1] ?? currentEnd;
    const [y, m, d] = base.split("-");
    ends.push(`${Number(y) + 1}-${m}-${d}`);
  }
  return ends[need - 1]!;
}

export const CONTRACT_WARNING_DAYS = 28;

/** Whether an end date is inside the warning window from `today`. */
export function isExpiringSoon(endDate: string | null | undefined, today: string): boolean {
  if (!endDate) return false;
  if (endDate < today) return false;
  const ms = Date.parse(endDate) - Date.parse(today);
  if (Number.isNaN(ms)) return false;
  return ms / 86_400_000 <= CONTRACT_WARNING_DAYS;
}
