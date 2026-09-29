/**
 * D-3 — ledger lines written before facility names were shared.
 *
 * A facility upgrade used to be booked as "Facility upgrade: training complex
 * → Level 2", the raw key with its underscores swapped for spaces. New lines
 * use the building's own name (routes/facilities.ts). This brings the lines an
 * existing save already holds to the same text, so the Finances page never
 * shows one building under two names. Only that exact generated prefix is
 * matched; the amount, date and everything else on the line are untouched.
 *
 * Idempotent: a line already carrying the name no longer matches.
 */
import { db, financeTransactionsTable, FACILITY_NAMES } from "@workspace/db";
import { eq, like } from "drizzle-orm";

export function renameFacilityLedgerLines(): { renamed: number } {
  let renamed = 0;
  for (const [type, name] of Object.entries(FACILITY_NAMES)) {
    const oldPrefix = `Facility upgrade: ${type.replace(/_/g, " ")} → `;
    const rows = db.select({ id: financeTransactionsTable.id, description: financeTransactionsTable.description })
      .from(financeTransactionsTable)
      .where(like(financeTransactionsTable.description, `${oldPrefix}%`))
      .all();
    for (const r of rows) {
      if (!r.description.startsWith(oldPrefix)) continue; // LIKE is case-insensitive in SQLite
      db.update(financeTransactionsTable)
        .set({ description: `Facility upgrade: ${name} → ${r.description.slice(oldPrefix.length)}` })
        .where(eq(financeTransactionsTable.id, r.id))
        .run();
      renamed++;
    }
  }
  return { renamed };
}
