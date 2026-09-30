/**
 * Overnight brief 30 Sep, item 4: a scout costs SCOUT_COST ($1,500) for anyone,
 * players, youth, staff and medical, charged when the scout is sent, as one
 * "scouting" line on the ledger. One place, so the price and the ledger line
 * cannot differ between the markets.
 */
import { db, teamsTable, financeTransactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SCOUT_COST } from "./marketScouting.js";

/** Refusal text when the club cannot pay, or null when it can. */
export function cannotAffordScout(budget: number | string | null | undefined): string | null {
  return Number(budget ?? 0) < SCOUT_COST
    ? `Not enough funds. A scout costs $${SCOUT_COST.toLocaleString()}.`
    : null;
}

/** Take the scout's fee from the balance and write it on the ledger, in one transaction. */
export function chargeScout(team: { id: number; budget: number | string | null }, description: string, gameDate: string): number {
  const budgetAfter = Number(team.budget ?? 0) - SCOUT_COST;
  db.transaction((tx) => {
    tx.update(teamsTable).set({ budget: budgetAfter }).where(eq(teamsTable.id, team.id)).run();
    tx.insert(financeTransactionsTable).values({
      teamId: team.id, type: "expense", amount: SCOUT_COST, category: "scouting", description, date: gameDate,
    }).run();
  });
  return budgetAfter;
}
