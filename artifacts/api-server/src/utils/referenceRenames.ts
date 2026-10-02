/**
 * Rob, 2 Oct (add-on): corrections to the AI clubs' reference data, in the
 * starter DB and in every existing save at boot.
 *
 *   - Aoife O'Sullivan (Ireland, EUR_09_P2) plays for Dublin Emerald Spikers
 *     (EUR_10); Yasmin Grech (Malta, EUR_10_P2) for Lisbon Atlantic Blaze
 *     (EUR_09). Her contract, wage and stats move with her.
 *   - Siosaia Taufa (AUS_08_P2, Tonga Polynesian Power) is Salote Taufa.
 *   - Honolulu Hula Warriors (AUS_04) is Maui Hula Warriors, everywhere it is
 *     shown: fixtures and results already stored, ladders, ledger lines,
 *     history and medals keep showing the club under its new name.
 *
 * The reference rows themselves (a pool player's club and name, a pool club's
 * name) reach a save through ensureReferenceData (utils/ensureSchema.ts,
 * REFERENCE_UPDATE_ONLY). This pass moves what each career stored: the two
 * players' pool contracts, and the names written into its rows. Every step
 * only changes what still says the old thing, so a second boot changes nothing.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export const MOVED_POOL_PLAYERS = [
  { player: "EUR_09_P2", from: "EUR_09", to: "EUR_10" },
  { player: "EUR_10_P2", from: "EUR_10", to: "EUR_09" },
] as const;
export const RENAMED_POOL_PLAYERS = [{ player: "AUS_08_P2", from: "Siosaia Taufa", to: "Salote Taufa" }] as const;
export const RENAMED_POOL_CLUBS = [{ club: "AUS_04", from: "Honolulu Hula Warriors", to: "Maui Hula Warriors" }] as const;

/** The stored club-name columns, and the free-text ones a club name is written into. */
const CLUB_NAME_COLUMNS = [
  ["matches", "home_team_name"], ["matches", "away_team_name"],
  ["season_final_standings", "competitor_name"], ["olympic_medals", "club_name"],
] as const;
const CLUB_TEXT_COLUMNS = [["finance_transactions", "description"], ["career_history_entries", "description"]] as const;

function hasColumn(table: string, column: string): boolean {
  return db.all<{ name: string }>(sql.raw(`PRAGMA table_info(\`${table}\`)`)).some((c) => c.name === column);
}
const changes = (r: unknown) => Number((r as { changes?: number }).changes ?? 0);

export function applyReferenceRenames(): { contractsMoved: number; namesChanged: number } {
  let contractsMoved = 0, namesChanged = 0;
  const idOf = (table: string, stable: string) =>
    db.get<{ id: number }>(sql.raw(`SELECT id FROM ${table} WHERE stable_id = '${stable}'`))?.id ?? null;
  // Her live pool contract goes with her, on its wage and to its date.
  for (const m of MOVED_POOL_PLAYERS) {
    const player = idOf("continental_pool_players", m.player), from = idOf("continental_pool_teams", m.from), to = idOf("continental_pool_teams", m.to);
    if (player == null || from == null || to == null) continue;
    contractsMoved += changes(db.run(sql`UPDATE pool_player_contracts SET pool_team_id = ${to}
      WHERE pool_player_id = ${player} AND pool_team_id = ${from} AND status = 'active'`));
  }
  for (const c of RENAMED_POOL_CLUBS) {
    for (const [table, column] of CLUB_NAME_COLUMNS) {
      if (!hasColumn(table, column)) continue;
      namesChanged += changes(db.run(sql.raw(`UPDATE ${table} SET ${column} = '${c.to}' WHERE ${column} = '${c.from}'`)));
    }
    for (const [table, column] of CLUB_TEXT_COLUMNS) {
      if (!hasColumn(table, column)) continue;
      namesChanged += changes(db.run(sql.raw(`UPDATE ${table} SET ${column} = REPLACE(${column}, '${c.from}', '${c.to}') WHERE ${column} LIKE '%${c.from}%'`)));
    }
  }
  for (const p of RENAMED_POOL_PLAYERS) {
    const player = idOf("continental_pool_players", p.player);
    if (player == null || !hasColumn("olympic_medals", "player_name")) continue;
    namesChanged += changes(db.run(sql`UPDATE olympic_medals SET player_name = ${p.to} WHERE pool_player_id = ${player} AND player_name = ${p.from}`));
  }
  return { contractsMoved, namesChanged };
}
