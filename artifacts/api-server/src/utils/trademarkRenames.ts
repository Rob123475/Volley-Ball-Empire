/**
 * Trademark cleanup (Rob, 19 Oct): the national tournament every fourth year
 * is the Empire Nations Cup, never "Olympic". The code now writes the new
 * names; this pass rewrites what saves already stored before it — trophy
 * names like "Olympic Gold 2028 — Brazil", history and ledger lines, staff
 * traits from the starter DB, stored scouting reports.
 *
 * Only display words are touched: capitalised whole words (Olympic, Olympics,
 * Olympian, OLYMPIC...). Keys stay as they are — trophy types like
 * "olympic_gold", calendar types, table and column names are lower case, and
 * youth_prospects/players.elite_event_type ("Olympic Wonderkid", an API enum
 * value the page relabels) is not in the list below. A player named Olympia
 * is not a whole-word match. Every rewrite leaves nothing for the next boot,
 * so a second boot changes nothing.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/** Free-text columns the game shows and has written "Olympic" into. */
export const TRADEMARK_TEXT_COLUMNS = [
  ["trophies", "name"], ["trophies", "notes"],
  ["career_history_entries", "description"],
  ["finance_transactions", "description"],
  ["manager_season_summaries", "world_result"], ["manager_season_summaries", "continental_result"],
  ["staff", "specialty"], ["staff", "special_trait"], ["staff", "coach_speciality"],
  ["youth_prospects", "scouting_report_text"],
  ["continental_scouting_missions", "report"],
  ["promo_deals", "description"], ["promo_deals", "appeal_reason"],
  ["career_saves", "leaving_reason"],
  ["career_pool_team_state", "vacancy_reason"],
  ["olympic_matches", "label"],
  ["seasons", "name"],
] as const;

/** Most specific first: "Olympic Games" before "Olympic". */
const RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bOlympic Weightlifting\b/g, "Competition Weightlifting"],
  [/\ban Olympic\b/g, "a Nations Cup"],
  [/\bAn Olympic\b/g, "A Nations Cup"],
  [/\bOlympic Games\b/g, "Empire Nations Cup"],
  [/\bOlympics\b/g, "Empire Nations Cup"],
  [/\bOlympians\b/g, "Nations Cup players"],
  [/\bOlympian\b/g, "Nations Cup player"],
  [/\bOlympic\b/g, "Nations Cup"],
  [/\bOLYMPIC GAMES\b/g, "EMPIRE NATIONS CUP"],
  [/\bOLYMPICS\b/g, "EMPIRE NATIONS CUP"],
  [/\bOLYMPIANS\b/g, "NATIONS CUP PLAYERS"],
  [/\bOLYMPIAN\b/g, "NATIONS CUP PLAYER"],
  [/\bOLYMPIC\b/g, "NATIONS CUP"],
];

export function renameTrademarkText(text: string): string {
  let out = text;
  for (const [re, to] of RULES) out = out.replace(re, to);
  return out;
}

function hasColumn(table: string, column: string): boolean {
  return db.all<{ name: string }>(sql.raw(`PRAGMA table_info(\`${table}\`)`)).some((c) => c.name === column);
}

export function applyTrademarkRenames(): { rowsChanged: number; byColumn: Record<string, number> } {
  let rowsChanged = 0;
  const byColumn: Record<string, number> = {};
  for (const [table, column] of TRADEMARK_TEXT_COLUMNS) {
    if (!hasColumn(table, column)) continue;
    // LIKE is case-insensitive for ASCII: it finds candidates, the rules decide.
    const rows = db.all<{ id: number; v: string }>(sql.raw(
      `SELECT rowid AS id, \`${column}\` AS v FROM \`${table}\` WHERE \`${column}\` LIKE '%olympi%'`));
    let n = 0;
    for (const r of rows) {
      const next = renameTrademarkText(r.v);
      if (next === r.v) continue;
      db.run(sql`UPDATE ${sql.raw(`\`${table}\``)} SET ${sql.raw(`\`${column}\``)} = ${next} WHERE rowid = ${r.id}`);
      n++;
    }
    if (n > 0) byColumn[`${table}.${column}`] = n;
    rowsChanged += n;
  }
  return { rowsChanged, byColumn };
}
