/**
 * Overnight brief 1 Oct, N-37: a game date in the game's style, "22 Sep 2026"
 * (the Matches page's), everywhere a date is shown; a raw "2026-09-22" was
 * printed on the Youth Loans tab and in a few other places. Built from the
 * YYYY-MM-DD part alone, so no time zone can move it a day.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function gameDateText(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  if (!m) return String(iso ?? "");
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}
