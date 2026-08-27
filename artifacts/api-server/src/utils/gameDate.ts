import { db, calendarStateTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * The current in-game date for a team, as `YYYY-MM-DD`.
 *
 * `finance_transactions.date` holds in-game dates, and the finances and
 * dashboard pages filter it by an in-game month prefix. Several routes were
 * stamping new rows with `new Date()` — the machine's real clock — so those
 * transactions could never match the month filter and monthly income/expenses
 * always showed $0. Use this for anything written into a dated game table.
 */
export async function getGameDate(teamId: number): Promise<string> {
  const [state] = await db
    .select({ currentDate: calendarStateTable.currentDate })
    .from(calendarStateTable)
    .where(eq(calendarStateTable.teamId, teamId))
    .limit(1);

  // A team with no calendar row yet has not started its season; fall back to
  // the season start rather than the real-world date.
  return state?.currentDate ?? "2026-01-01";
}
