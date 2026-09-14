/**
 * R-43 — invented content was deleted, not stubbed. This removes what it left
 * behind in a save.
 *
 * The model no longer declares these tables, and ensureSchema only ever ADDS.
 * An older save therefore still has them — and they are not harmless leftovers:
 * youth_* rows reference teams, poaching_offers references users and career
 * saves, ai_managers references career saves. deleteProfileCascade no longer
 * knows they exist, so a profile whose team or save had rows in them would fail
 * at COMMIT with a bare "FOREIGN KEY constraint failed". They are dropped here,
 * at boot, before anything can be deleted.
 *
 *   youth_league_results, youth_ladder,     the invented youth league: random
 *   youth_championship_trophies              results, an AI ladder, a coin-flip final
 *   poaching_offers                          offers from a hardcoded club pool
 *   ai_managers, ai_manager_events           invented managers moving at random
 *   manager_season_summaries.youth_result    the youth league's season result
 *
 * Safe on every boot: anything already gone is skipped. Nothing references these
 * tables, so dropping them cannot break a foreign key.
 */
import { sqlite } from "@workspace/db";

export const REMOVED_TABLES = [
  "youth_league_results",
  "youth_ladder",
  "youth_championship_trophies",
  "poaching_offers",
  "ai_managers",
  "ai_manager_events",
] as const;

const REMOVED_SUMMARY_COLUMN = "youth" + "_result";

export function dropRemovedContent(): { dropped: string[] } {
  const dropped: string[] = [];
  const tableExists = sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?");

  for (const table of REMOVED_TABLES) {
    if (!tableExists.get(table)) continue;
    sqlite.exec(`DROP TABLE "${table}"`);
    dropped.push(table);
  }

  const summaryColumns = sqlite.prepare("PRAGMA table_info(manager_season_summaries)").all() as Array<{ name: string }>;
  if (summaryColumns.some((c) => c.name === REMOVED_SUMMARY_COLUMN)) {
    sqlite.exec(`ALTER TABLE manager_season_summaries DROP COLUMN ${REMOVED_SUMMARY_COLUMN}`);
    dropped.push(`manager_season_summaries.${REMOVED_SUMMARY_COLUMN}`);
  }

  return { dropped };
}
