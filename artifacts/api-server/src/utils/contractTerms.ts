/**
 * How long a contract can run, and when it ends.
 *
 * ── Rob's rule (22 Sep), as Rob himself narrowed it on 24 Oct 2026 ───────────
 * EVERY player, staff member and medical staff member has a contract. The
 * lengths that exist are 6 months, 1 season and 2 seasons, and who may use
 * which is (1.1.3 rebuild brief, Part B; the game's creator amending his own
 * 22 Sep rule on purpose, so do NOT restore the old "all three, everywhere"):
 *
 *     players at the club the career controls   6 months · 1 season · 2 seasons
 *     players at every other club (the AI)      1 season · 2 seasons
 *     staff and medical, at every club          1 season · 2 seasons
 *
 * The 6-month option belongs to the manager's club and follows him: it is
 * gated on "is this the career's current club" (playerContractParty), so when
 * he moves the new club gains it and the club he left loses it. A contract
 * stays with the club that signed it: a 6-month deal he signed at a former
 * club runs on there.
 *
 * Nothing else, anywhere: signing, renewal, youth promotion, staff hire,
 * medical hire. There are no 5-season contracts in this game.
 *
 * ── Staff and medical contracts end on 7 January ────────────────────────────
 * DELIBERATELY unlike players, whose contracts end on the season boundary from
 * the season rows: every staff and medical contract ends on 7 January, the day
 * before the AI clubs' staff deal day (AI_STAFF_DEAL_DAY = 8, lib/db
 * staff-roles.ts; utils/aiStaff.ts). A contract ends, and the market opens the
 * next day. "1 season" runs to the 7 January after the season it is signed in
 * (a season is the year of the season rows, 1 January to 31 December), "2
 * seasons" to the 7 January after that. A mid-season hire on "1 season" gets a
 * short deal, as a late player signing does; one made in the first week of
 * January runs the whole year (a new career's first week is when the player is
 * told to hire); the AI clubs hire only on 8 January, so theirs always run a
 * full year. This split from players is intended: it is not a bug to be
 * tidied up later.
 *   Why (Rob, 24 Oct): the AI clubs picked a staff length at random from all
 * three, so one in three got 6 months, expired mid-season, and left a gap until
 * the next 8 January: the soak's 10 to 31 of 60 clubs short of a doctor or physio.
 *   Saves from before: a staff member on 6 months expires mid-season once more,
 * then renews onto a season contract; an AI player on 6 months expires once and
 * re-signs on a season deal. No migration.
 *
 * ── Why a season, not a year ────────────────────────────────────────────────
 * A season is the end of a year's World Tour, and it is NOT 365 days: the
 * rollover harness measures 418-421 depending on the year. The old code added a
 * calendar year (`addOneYear`) and capped every contract at one year from the
 * game date, so a "season" contract drifted away from the season it was meant
 * to cover. A contract length is therefore resolved against the real season
 * rows, not against arithmetic on the signing date.
 *
 *     6m   six months from the signing date (the career's club's players only)
 *     1s   players: the end of the season being played when it is signed;
 *          staff and medical: the next 7 January
 *     2s   players: the end of the season after that one;
 *          staff and medical: the 7 January after that
 *
 * "12 months" means 1s, never 365 days: no calendar arithmetic for players.
 *
 * Signing a "1 season" deal in the last week of a season gives a short deal.
 * That is deliberate and it is how the real thing behaves: you are buying the
 * rest of this season. The UI shows the end date before the deal is agreed.
 *
 * This module owns the rule for the server. The frontend keeps its own copy of
 * the three lists for its dropdowns, because lib/db cannot be imported by a
 * browser (its index opens a SQLite connection), and
 * `harness/contract-terms.mjs` asserts each of the three is identical to this
 * one so they cannot drift apart.
 */

/** Every length a stored contract can carry (an older save's 6-month staff deal included). */
export const CONTRACT_LENGTHS = ["6m", "1s", "2s"] as const;

export type ContractLength = (typeof CONTRACT_LENGTHS)[number];

/** Players at the club the career controls now: the only contracts that may run 6 months. */
export const PLAYER_CONTRACT_LENGTHS: readonly ContractLength[] = ["6m", "1s", "2s"];
/** Players at every other club (the AI clubs, a club the manager has left). */
export const AI_PLAYER_CONTRACT_LENGTHS: readonly ContractLength[] = ["1s", "2s"];
/** Staff and medical, at every club: to 7 January (STAFF_CONTRACT_END). */
export const STAFF_CONTRACT_LENGTHS: readonly ContractLength[] = ["1s", "2s"];

/** Who a contract is with. */
export type ContractParty = "career_player" | "other_player" | "staff";

export const CONTRACT_LENGTHS_FOR: Readonly<Record<ContractParty, readonly ContractLength[]>> = {
  career_player: PLAYER_CONTRACT_LENGTHS,
  other_player: AI_PLAYER_CONTRACT_LENGTHS,
  staff: STAFF_CONTRACT_LENGTHS,
};

/** Rob, 24 Oct (B3): a player deal may run 6 months only at the career's current club, so the option follows him. */
export function playerContractParty(isCareerClub: boolean): ContractParty {
  return isCareerClub ? "career_player" : "other_player";
}

/** The length a club that may not use 6 months takes instead (an older deal renewed, a counter to a 6-month bid). */
export function seasonLength(length: ContractLength): ContractLength {
  return length === "6m" ? "1s" : length;
}

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

const NO_SIX_MONTHS: Readonly<Record<ContractParty, string>> = {
  career_player: "",
  other_player: " Only the club the career manages can offer 6 months.",
  staff: " Staff and medical contracts run 1 or 2 seasons and end on 7 January.",
};

/**
 * The length a request asked for, or the reason it is not one its party may use.
 *
 * Every route that starts or renews a contract reads its body through this, so
 * a player deal, a staff deal and a medical deal cannot end up with different
 * ideas of what is allowed.
 */
export function readContractLength(body: unknown, party: ContractParty): { length: ContractLength } | { error: string } {
  const raw = (body as { length?: unknown } | null)?.length;
  if (raw == null) return { length: DEFAULT_CONTRACT_LENGTH };
  const allowed = CONTRACT_LENGTHS_FOR[party];
  if (!isContractLength(raw) || !allowed.includes(raw)) {
    return {
      error: `Contract length must be one of ${allowed.join(", ")} ` +
             `(${allowed.map((l) => CONTRACT_LENGTH_LABELS[l]).join(", ")}).` + (raw === "6m" ? NO_SIX_MONTHS[party] : ""),
    };
  }
  return { length: raw };
}

/** Rob, 24 Oct: the day ("MM-DD") every staff and medical contract ends, the day before AI_STAFF_DEAL_DAY (8 January). */
export const STAFF_CONTRACT_END = "01-07";

/**
 * Where a staff or medical contract of `length` ends, counted on from `from`
 * (the hiring day, or the end of the deal being renewed): the 7 January after
 * the season `from` is in for 1 season, the one after that for 2 seasons. A
 * deal renewed on its 7 January end runs to the next one.
 */
export function staffContractEndDate(length: ContractLength, from: string): string {
  const seasons = seasonLength(length) === "2s" ? 2 : 1;
  return `${Number(from.slice(0, 4)) + seasons}-${STAFF_CONTRACT_END}`;
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

/** A contract's dates, in GAME time. */
export type ContractTerm = { startDate: string; endDate: string };

/**
 * R-48: a first-season contract runs for the season, dated from that season's
 * own row (it used to be signed to a literal "2026-12-31" on the computer's
 * clock). Moved here from utils/seedStartingSquad.ts (Update 1, item 4b deleted
 * the automatic starting squad it served).
 */
export function oneSeasonContract(season: { startDate: string; endDate: string }): ContractTerm {
  return { startDate: season.startDate, endDate: season.endDate };
}

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

/** 4 weeks, in game days: how long before an end date the warning appears. */
export const CONTRACT_WARNING_DAYS = 28;

/** Whether an end date is inside the warning window from `today`. */
export function isExpiringSoon(endDate: string | null | undefined, today: string): boolean {
  if (!endDate) return false;
  if (endDate < today) return false;
  const ms = Date.parse(endDate) - Date.parse(today);
  if (Number.isNaN(ms)) return false;
  return ms / 86_400_000 <= CONTRACT_WARNING_DAYS;
}
