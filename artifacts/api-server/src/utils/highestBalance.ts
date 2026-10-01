/**
 * Overnight brief 1 Oct, N-45 (Rob, 1 Oct): "Making Money" read a highest
 * balance of $396,045 for a club that started on $500,000. The career stat only
 * noted the balance when the achievements were checked (after a match), so the
 * starting balance and every balance between matches were never counted.
 *
 * The highest balance a club has had is now read from its books: the balance it
 * started on (today's balance less everything the ledger moved) and the running
 * balance after every ledger line, in game-date order, and today's. Every
 * movement of money is on the ledger (overnight 30 Sep, item 13 made it
 * reconcile), so this is every balance the club has had.
 */
import { db, financeTransactionsTable, teamsTable, careerSavesTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { getCareerStats } from "./check-achievements.js";

/** The highest balance this club has had, by its ledger (the start included). */
export function ledgerBalanceHigh(teamId: number): number {
  const team = db.select({ budget: teamsTable.budget }).from(teamsTable).where(eq(teamsTable.id, teamId)).get();
  if (!team) return 0;
  const rows = db.select({ type: financeTransactionsTable.type, amount: financeTransactionsTable.amount })
    .from(financeTransactionsTable).where(eq(financeTransactionsTable.teamId, teamId))
    .orderBy(asc(financeTransactionsTable.date), asc(financeTransactionsTable.id)).all();
  // Some older rows store an expense as a negative amount: the sign comes from the type.
  const moves = rows.map((r) => (r.type === "income" ? 1 : -1) * Math.abs(Number(r.amount)));
  const now = Number(team.budget);
  let balance = now - moves.reduce((a, b) => a + b, 0);
  let high = balance;
  for (const m of moves) { balance += m; if (balance > high) high = balance; }
  return Math.round(Math.max(high, now));
}

/**
 * Boot, for saves made before the fix: every career's highest balance is at
 * least its clubs' (current and former) ledger high. Idempotent: it only rises.
 */
export function raiseHighestBalances(): number {
  const saves = db.select({ id: careerSavesTable.id, teamId: careerSavesTable.teamId, formerTeamId: careerSavesTable.formerTeamId, careerStats: careerSavesTable.careerStats })
    .from(careerSavesTable).all();
  let raised = 0;
  for (const s of saves) {
    const teams = [s.teamId, s.formerTeamId].filter((t): t is number => t != null);
    // A save whose record still sits on the club's row is migrated by careerStatsFor
    // the first time it is read, and the achievement check takes the ledger high then.
    if (teams.length === 0 || !s.careerStats) continue;
    const stats = getCareerStats(s.careerStats);
    const high = Math.max(...teams.map(ledgerBalanceHigh));
    if (high <= stats.highestBalanceReached) continue;
    db.update(careerSavesTable).set({ careerStats: { ...stats, highestBalanceReached: high } })
      .where(eq(careerSavesTable.id, s.id)).run();
    raised++;
  }
  return raised;
}
