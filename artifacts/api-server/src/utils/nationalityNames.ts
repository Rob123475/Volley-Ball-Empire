/**
 * Overnight brief 30 Sep, item 11: nationality is the COUNTRY everywhere
 * ("United Kingdom", "Australia", "Germany"), never the demonym ("British",
 * "Australian", "German"). Rob's save showed doctors as "British" and
 * "Australian" beside everyone else's "Germany": the staff and medical market
 * generators wrote demonyms, and so did the AI clubs' pool players, whose
 * nationality academy players inherit.
 *
 * New rows: the generators now write country names, and the one sanctioned
 * write for a new player or staff member (lib/playerDto.ts) stores the country
 * whatever it is handed. Existing saves: this boot pass rewrites every stored
 * nationality that is a known alias of a country to that country's name
 * (continents.ts nationName, the game's one table of nations and their
 * spellings). A value it does not know is left as it is. Idempotent: a country
 * name maps to itself.
 */
import { sqlite, nationName } from "@workspace/db";

/** The nationality columns a save holds, and the table each lives in. */
const COLUMNS: ReadonlyArray<[table: string, column: string]> = [
  ["staff", "nationality"],
  ["players", "nationality"],
  ["continental_pool_players", "nationality"],
  ["youth_prospects", "nationality"],
  ["player_retirements", "nationality"],
  ["career_saves", "manager_nationality"],
];

export function convertNationalitiesToCountries(): Record<string, number> {
  const converted: Record<string, number> = {};
  const tables = new Set((sqlite.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[]).map((t) => t.name));
  sqlite.transaction(() => {
    for (const [table, column] of COLUMNS) {
      if (!tables.has(table)) continue;
      const cols = (sqlite.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]).map((c) => c.name);
      if (!cols.includes(column)) continue;
      const values = sqlite.prepare(`SELECT DISTINCT "${column}" AS v FROM "${table}" WHERE "${column}" IS NOT NULL`).all() as { v: string }[];
      for (const { v } of values) {
        const country = nationName(v);
        if (!country || country === v) continue;
        const r = sqlite.prepare(`UPDATE "${table}" SET "${column}" = ? WHERE "${column}" = ?`).run(country, v);
        converted[`${table}: ${v} -> ${country}`] = Number(r.changes);
      }
    }
  })();
  return converted;
}
