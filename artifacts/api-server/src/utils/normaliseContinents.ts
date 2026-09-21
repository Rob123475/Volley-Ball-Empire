import { sqlite } from "@workspace/db";
import {
  continentKeyFrom,
  continentKeyForNationality,
  isContinentKey,
} from "@workspace/db";

/**
 * Data migration: move every continent column onto the canonical KEYS defined
 * in lib/db/src/schema/continents.ts, and backfill the ones that were never set.
 *
 * Seven label vocabularies were live at once (see continents.ts for the table).
 * Because screens grouped rows by the display STRING, any row whose label the
 * screen did not recognise was dropped without a word — three Oceania clubs
 * vanished from the club picker that way. Storing an opaque key and rendering
 * the label separately removes the whole class: punctuation can drift in the
 * label without ever touching a stored value.
 *
 * ── Why the column list is DISCOVERED, not written down ─────────────────────
 * The previous version of this migration hand-listed five tables. Ten carry a
 * continent. The five it missed were empty at the time, so nothing failed and
 * nothing said anything — the same silent-success shape as the bug it was
 * fixing. So the columns are now found by reading the database's own schema:
 * every column named `continent` or `*_continent`. A table added later is
 * covered on the day it is added, with no one having to remember.
 *
 * Idempotent: rows already on a key are left alone, so this is safe to run on
 * every boot. It runs for existing player saves too, not just the shipped
 * database — a save made before this shipped needs it more, not less.
 *
 * Values it cannot resolve are LEFT ALONE and reported. Guessing would write an
 * eighth spelling; reporting lets `scripts/check-continents.cjs` fail the build
 * and lets the picker surface the row.
 */

export type ContinentColumn = { table: string; column: string };

export type UnresolvedValue = {
  table: string;
  column: string;
  value: string;
  rows: number;
};

/** table.column -> { storedValue -> rowCount }, with null counted as "(null)". */
export type ValueCensus = Record<string, Record<string, number>>;

export type ContinentMigrationResult = {
  columnsScanned: number;
  valuesNormalised: number;
  playersBackfilled: number;
  playersUnresolved: number;
  unresolved: UnresolvedValue[];
  before: ValueCensus;
  after: ValueCensus;
};

const NULL_BUCKET = "(null)";

/**
 * Values that are deliberately NOT a continent, and the column they may appear
 * on.
 *
 * ── R-80 gate 6 ────────────────────────────────────────────────────────────
 * Booting the server on Rob's real save logged, at ERROR level, "continent
 * values outside the canonical set" for 12 `matches` rows holding "world".
 * Those rows are correct. The World Finals belong to no continent, and the game
 * says so in two places of its own:
 *
 *   data/worldTour.ts   `continent: ContinentKey | "world"`, commented
 *                       "Canonical continent KEY, or 'world' for the two
 *                        events that belong to no continent"
 *   routes/matches.ts   writes it with "The World Finals are 'world', not a
 *                       continent."
 *
 * The starter database ships with no played World Finals, so
 * scripts/check-continents.cjs never met one and the build gate stayed green.
 * This only ever fired on a save that had actually played a season - which is
 * every real player, on every boot, about data the game wrote on purpose. That
 * is the noise that hides a real one, so the migration is told about the
 * sentinel rather than the log line being turned down.
 *
 * Deliberately narrow: "world" is accepted on a `continent` column and nowhere
 * else, and any other unknown spelling is still left in place and still
 * reported.
 */
const SENTINELS: ReadonlyArray<{ column: string; value: string }> = [
  { column: "continent", value: "world" },
];

function isSentinel(column: string, value: string): boolean {
  return SENTINELS.some((s) => s.column === column && s.value === value);
}

/** Every column in the live database that holds a continent. */
export function findContinentColumns(): ContinentColumn[] {
  const tables = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
    .all() as Array<{ name: string }>;

  const found: ContinentColumn[] = [];
  for (const { name } of tables) {
    const cols = sqlite.prepare(`PRAGMA table_info("${name}")`).all() as Array<{ name: string }>;
    for (const c of cols) {
      if (c.name === "continent" || c.name.endsWith("_continent")) {
        found.push({ table: name, column: c.name });
      }
    }
  }
  return found;
}

/** Distinct stored values and their row counts, for the before/after report. */
export function censusContinents(columns: ContinentColumn[]): ValueCensus {
  const census: ValueCensus = {};
  for (const { table, column } of columns) {
    const rows = sqlite
      .prepare(`SELECT "${column}" AS v, COUNT(*) AS n FROM "${table}" GROUP BY "${column}"`)
      .all() as Array<{ v: string | null; n: number }>;
    const bucket: Record<string, number> = {};
    for (const r of rows) bucket[r.v ?? NULL_BUCKET] = r.n;
    census[`${table}.${column}`] = bucket;
  }
  return census;
}

export function normaliseContinentsOnce(): ContinentMigrationResult {
  const columns = findContinentColumns();

  const result: ContinentMigrationResult = {
    columnsScanned: columns.length,
    valuesNormalised: 0,
    playersBackfilled: 0,
    playersUnresolved: 0,
    unresolved: [],
    before: censusContinents(columns),
    after: {},
  };

  const migrate = sqlite.transaction(() => {
    // ── Values that are set but are a label, or an older spelling ───────────
    for (const { table, column } of columns) {
      const distinct = sqlite
        .prepare(
          `SELECT "${column}" AS v, COUNT(*) AS n FROM "${table}"
            WHERE "${column}" IS NOT NULL GROUP BY "${column}"`,
        )
        .all() as Array<{ v: string; n: number }>;

      for (const { v, n } of distinct) {
        if (isContinentKey(v)) continue; // already a key
        if (isSentinel(column, v)) continue; // deliberately not a continent

        const key = continentKeyFrom(v);
        if (!key) {
          // Unknown spelling. Leave it in place so it stays visible to the
          // build gate and to the picker's unrecognised bucket.
          result.unresolved.push({ table, column, value: v, rows: n });
          continue;
        }

        const info = sqlite
          .prepare(`UPDATE "${table}" SET "${column}" = ? WHERE "${column}" = ?`)
          .run(key, v);
        result.valuesNormalised += info.changes;
      }
    }

    // ── Players with no continent at all — derive it from nationality ───────
    // Only players can be backfilled: they are the one table carrying a
    // country of origin to derive from. A NULL anywhere else is reported by
    // the census rather than guessed at.
    const missing = sqlite
      .prepare(`SELECT id, nationality FROM players WHERE continent IS NULL`)
      .all() as Array<{ id: number; nationality: string | null }>;

    const setContinent = sqlite.prepare(`UPDATE players SET continent = ? WHERE id = ?`);
    for (const p of missing) {
      const key = continentKeyForNationality(p.nationality);
      if (!key) {
        result.playersUnresolved++;
        continue;
      }
      setContinent.run(key, p.id);
      result.playersBackfilled++;
    }
  });

  migrate();

  result.after = censusContinents(columns);
  return result;
}
