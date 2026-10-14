/**
 * The game date a schedule round falls on: rounds spread evenly from a
 * season's first day to its last. Moved here from routes/calendar.ts (Update 1,
 * overnight part 5) so the pre-season camp can find the club's first match of
 * the next season by the same rule (utils/preseasonCamp.ts).
 */
export function roundToDate(
  startDate: string,
  endDate: string,
  round: number,
  totalRounds: number,
): string {
  const start = new Date(startDate + "T00:00:00Z");
  const end   = new Date(endDate   + "T00:00:00Z");
  const totalDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000));
  const offset = totalRounds <= 1 ? 0 : Math.floor((round - 1) * totalDays / (totalRounds - 1));
  const d = new Date(start.getTime() + offset * 86400000);
  return d.toISOString().split("T")[0]!;
}
