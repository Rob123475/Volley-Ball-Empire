/**
 * Overnight brief 30 Sep, item 26: scouting missions were filed on the ledger
 * as "youth_academy"; they are scouting (routes/continental-scouting.ts and
 * the old youth scouting trip now write "scouting"). Lines already written in
 * a save are refiled at boot, by the words those routes always wrote.
 * Idempotent: a refiled line no longer matches.
 */
import { sqlite } from "@workspace/db";

export function refileScoutingLines(): number {
  const r = sqlite.prepare(
    `UPDATE finance_transactions SET category = 'scouting'
      WHERE category = 'youth_academy' AND (description LIKE 'Continental scouting — %' OR description LIKE 'Youth scouting — %')`,
  ).run();
  return Number(r.changes);
}
