import { db, calendarStateTable, careerSavesTable } from "@workspace/db";
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

/**
 * Night 2: a career's game date inside a transaction (its club's calendar), for
 * the AI clubs' match steps, which have no club of the player's to hand.
 */
export function careerGameDateTx(tx: Pick<typeof db, "select">, careerSaveId: number): string {
  const row = tx.select({ d: calendarStateTable.currentDate }).from(careerSavesTable)
    .innerJoin(calendarStateTable, eq(calendarStateTable.teamId, careerSavesTable.teamId))
    .where(eq(careerSavesTable.id, careerSaveId)).get();
  return row?.d ?? "2026-01-01";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Overnight brief 1 Oct, N-37: a game date in the game's style, "22 Sep 2026",
 * for text the server writes (news, Club News, the ledger, refusals). Built
 * from the YYYY-MM-DD part alone, so no time zone can move it a day.
 */
export function gameDateText(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  if (!m) return String(iso ?? "");
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}
