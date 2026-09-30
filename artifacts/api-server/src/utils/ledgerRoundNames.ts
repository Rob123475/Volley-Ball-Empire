/**
 * Overnight brief 30 Sep, item 27: one round numbering players see. Prize
 * lines on the ledger named the schedule slot ("Prize money: Round 15 vs
 * Barcelona") while the Match Day box said "World Tour R5" for the same match.
 * They are now written with the event's round (utils/seasonPhase.ts); lines
 * already in a save are renamed at boot the same way. Idempotent: a renamed
 * line has no "Round <n>" left.
 */
import { sqlite } from "@workspace/db";
import { seasonPhase } from "./seasonPhase.js";

export function renameLedgerRounds(): number {
  const rows = sqlite.prepare(
    `SELECT id, description FROM finance_transactions WHERE category = 'prize_money' AND description GLOB '*: Round [0-9]* vs *'`,
  ).all() as { id: number; description: string }[];
  const update = sqlite.prepare(`UPDATE finance_transactions SET description = ? WHERE id = ?`);
  sqlite.transaction(() => {
    for (const r of rows) {
      update.run(r.description.replace(/: Round (\d+) vs /, (_m, n: string) => `: ${seasonPhase(Number(n)).name} vs `), r.id);
    }
  })();
  return rows.length;
}
