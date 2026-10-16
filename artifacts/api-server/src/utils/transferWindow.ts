/**
 * 1.1.1, Part 2 (Rob, 16 Oct): the transfer window is the off-season, the
 * calendar's own Off-Season dates: the season's holiday slots (HOLIDAY_START to
 * HOLIDAY_END, utils/calendarSlots.ts) on the season's dates (roundToDate, the
 * rule GET /calendar/annual draws them by). Seasons run Jan 1 to Dec 31, so in
 * 2026 the window is 7 Dec to 31 Dec. It runs alongside anything else then.
 */
import { roundToDate } from "./roundDates.js";
import { HOLIDAY_START, HOLIDAY_END, TOTAL_SLOTS } from "./calendarSlots.js";
import { contractEndDate, type ContractLength } from "./contractTerms.js";

const yearOf = (date: string) => Number(date.slice(0, 4));

/** A season's transfer window: the first and last day of its Off-Season. */
export function transferWindowFor(year: number): { opens: string; closes: string } {
  const start = `${year}-01-01`, end = `${year}-12-31`;
  return { opens: roundToDate(start, end, HOLIDAY_START, TOTAL_SLOTS), closes: roundToDate(start, end, HOLIDAY_END, TOTAL_SLOTS) };
}

export function inTransferWindow(today: string): boolean {
  const w = transferWindowFor(yearOf(today));
  return today >= w.opens && today <= w.closes;
}

/** Today in the window; else the day the next window opens. */
export function nextWindowOpening(today: string): string {
  const w = transferWindowFor(yearOf(today));
  if (today < w.opens) return w.opens;
  if (today <= w.closes) return today;
  return transferWindowFor(yearOf(today) + 1).opens;
}

/**
 * The end date of a contract that starts on `startsOn`. A contract starting in
 * the transfer window (the off-season) is for the next season: its length runs
 * from Jan 1 (a "1 season" deal signed on 10 Dec ends the next Dec 31, not
 * three weeks later).
 */
export function contractEndFrom(length: ContractLength, startsOn: string, seasonEnds: readonly string[]): string {
  if (!inTransferWindow(startsOn)) return contractEndDate(length, startsOn, seasonEnds);
  const next = yearOf(startsOn) + 1;
  return contractEndDate(length, `${next}-01-01`, [`${next}-12-31`]);
}
