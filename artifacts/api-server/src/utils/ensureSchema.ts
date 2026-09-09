import { db, sqlite } from "@workspace/db";
import * as dbExports from "@workspace/db";
import { sql, is } from "drizzle-orm";
import {
  getTableConfig,
  SQLiteTable,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";
import Database from "better-sqlite3";
import fs from "node:fs";

/**
 * Bring an older save up to the schema the running code expects.
 *
 * There is no migration runner in this project. The shipped .sqlite file IS the
 * schema, and electron/main.js copies it to userData ONLY when no save exists
 * there (main.js:145-156) — so an upgrading player keeps their old database
 * forever and never receives a table or column added after they first ran the
 * game. This is the only schema-repair step there is.
 *
 * ── Why this was rebuilt (R-01) ─────────────────────────────────────────────
 * It used to apply a HAND-TYPED list of exactly 7 columns. `teams.crest_shape_index`
 * was never added to that list, so every save made before that column existed
 * crashed on GET /api/team until someone added the line by hand on 1 Sep. The
 * player saw a title screen stuck on RETRY and "Could not load your career",
 * with a save that was perfectly intact on disk and simply unreadable.
 *
 * A hand-typed list cannot fix that class of bug, because the list is the bug:
 * it only ever contains what someone remembered to add. So it is gone. Nothing
 * here is enumerated by hand any more — tables, columns and indexes are all
 * DERIVED from the drizzle schema in lib/db/src/schema at boot, which is the
 * same declaration the code queries through. If the code can read a column, the
 * repair knows the column exists, because they are the same source.
 *
 * ── How it works ────────────────────────────────────────────────────────────
 * For every table the schema declares:
 *   - table missing            -> CREATE TABLE from the derived definition
 *   - column missing           -> ALTER TABLE ADD COLUMN from the derived one
 *   - index missing            -> CREATE INDEX (drizzle declares all 7)
 * Everything is IF NOT EXISTS or guarded, so it is a no-op on a current
 * database and safe on every boot.
 *
 * ── The NOT NULL problem, handled loudly ────────────────────────────────────
 * SQLite cannot ADD COLUMN with NOT NULL and no default to a table that already
 * has rows — there would be nothing to put in the existing ones. 159 columns in
 * this schema are NOT NULL without a default. If one of those is ever missing
 * from a real save, this supplies a zero-value for the type and logs it as a
 * WARNING naming the column, because a silently invented value is exactly the
 * kind of thing that surfaces months later as a wrong number on a screen.
 *
 * A column the repair genuinely cannot add (a PRIMARY KEY, which SQLite forbids
 * adding at all) is reported in `problems` rather than skipped in silence.
 */

// ── Reading the schema ───────────────────────────────────────────────────────

type DeclaredTable = ReturnType<typeof getTableConfig>;

/**
 * Every table the drizzle schema declares. Read from the package's own exports
 * rather than a list, so a table added to the schema is covered the moment it
 * is exported — which is the entire point of R-01.
 */
function declaredTables(): DeclaredTable[] {
  const out: DeclaredTable[] = [];
  for (const value of Object.values(dbExports)) {
    if (is(value, SQLiteTable)) out.push(getTableConfig(value));
  }
  return out;
}

// ── Rendering DDL from a declared column ─────────────────────────────────────

/**
 * The column's default as a SQL literal, or null if it has none we can inline.
 *
 * `defaultFn` defaults (timestamps, uuids) are computed in JS on insert and
 * have no SQL representation, so they count as "no default" here — which is
 * correct: the column is nullable-or-defaulted from SQLite's point of view.
 */
function literalDefault(c: AnySQLiteColumn): string | null {
  if (!c.hasDefault) return null;
  const d = (c as { default?: unknown }).default;
  if (d === undefined || d === null) return null;
  if (typeof d === "boolean") return d ? "1" : "0";
  if (typeof d === "number") return Number.isFinite(d) ? String(d) : null;
  if (typeof d === "string") return `'${d.replace(/'/g, "''")}'`;
  return null;
}

/** A zero-value for a type, used only for the loud NOT NULL case above. */
function fallbackDefault(sqlType: string): string {
  const t = sqlType.toLowerCase();
  if (t.includes("int") || t.includes("real") || t.includes("numeric")) return "0";
  if (t.includes("blob")) return "x''";
  return "''";
}

function isAutoIncrementPk(c: AnySQLiteColumn): boolean {
  return Boolean(c.primary && (c as { autoIncrement?: boolean }).autoIncrement);
}

/** `name` TYPE [PRIMARY KEY AUTOINCREMENT] [NOT NULL] [DEFAULT x] */
function renderColumn(c: AnySQLiteColumn): string {
  const parts = [`\`${c.name}\``, c.getSQLType()];
  if (isAutoIncrementPk(c)) parts.push("PRIMARY KEY AUTOINCREMENT");
  else if (c.primary) parts.push("PRIMARY KEY");
  if (c.notNull) parts.push("NOT NULL");
  const d = literalDefault(c);
  if (d !== null) parts.push(`DEFAULT ${d}`);
  return parts.join(" ");
}

function renderCreateTable(t: DeclaredTable): string {
  const lines = t.columns.map(renderColumn);

  // Composite primary keys, declared separately from the columns.
  for (const pk of t.primaryKeys) {
    const cols = pk.columns.map((c) => `\`${c.name}\``).join(", ");
    lines.push(`PRIMARY KEY (${cols})`);
  }

  for (const fk of t.foreignKeys) {
    const ref = fk.reference();
    const local = ref.columns.map((c) => `\`${c.name}\``).join(", ");
    const target = getTableConfig(ref.foreignTable).name;
    const foreign = ref.foreignColumns.map((c) => `\`${c.name}\``).join(", ");
    let line = `FOREIGN KEY (${local}) REFERENCES \`${target}\`(${foreign})`;
    if (fk.onDelete) line += ` ON DELETE ${fk.onDelete}`;
    if (fk.onUpdate) line += ` ON UPDATE ${fk.onUpdate}`;
    lines.push(line);
  }

  return `CREATE TABLE IF NOT EXISTS \`${t.name}\` (\n  ${lines.join(",\n  ")}\n)`;
}

/**
 * Every index the schema implies, from BOTH places drizzle keeps them.
 *
 * `uniqueIndex(...)` in a table's extra config lands in `cfg.indexes` — there
 * are 7 of those. A column-level `.unique()` does NOT: it sets `isUnique` and
 * `uniqueName` on the column itself, and there are 8 more of those
 * (users.email, calendar_state.team_id, ...). Reading only `cfg.indexes`
 * silently produced a database missing 8 uniqueness constraints, which the
 * schema-drift harness caught by comparing against the shipped file.
 */
function renderIndexes(t: DeclaredTable): string[] {
  const fromColumns = t.columns
    .filter((c) => c.isUnique)
    .map((c) => {
      const name = c.uniqueName ?? `${t.name}_${c.name}_unique`;
      return `CREATE UNIQUE INDEX IF NOT EXISTS \`${name}\` ON \`${t.name}\` (\`${c.name}\`)`;
    });

  const fromConfig = t.indexes.map((idx) => {
    const cfg = idx.config as {
      name: string;
      unique?: boolean;
      columns: ReadonlyArray<{ name?: string }>;
    };
    const cols = cfg.columns
      .map((c) => (c?.name ? `\`${c.name}\`` : null))
      .filter((c): c is string => c !== null)
      .join(",");
    const unique = cfg.unique ? "UNIQUE " : "";
    return `CREATE ${unique}INDEX IF NOT EXISTS \`${cfg.name}\` ON \`${t.name}\` (${cols})`;
  });

  return [...fromColumns, ...fromConfig];
}

// ── Reading what the database actually has ───────────────────────────────────

function tableExists(name: string): boolean {
  const rows = db.all<{ n: number }>(
    sql.raw(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='${name}'`),
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

function existingColumns(table: string): Set<string> {
  const rows = db.all<{ name: string }>(sql.raw(`PRAGMA table_info(\`${table}\`)`));
  return new Set(rows.map((r) => r.name));
}

function indexExists(name: string): boolean {
  const rows = db.all<{ n: number }>(
    sql.raw(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type='index' AND name='${name}'`),
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

// ── The repair ───────────────────────────────────────────────────────────────

export type EnsureSchemaResult = {
  /** How much was actually inspected, so a clean boot can prove it ran. */
  tablesChecked: number;
  columnsChecked: number;
  tablesCreated: string[];
  columnsAdded: string[];
  indexesCreated: string[];
  /** Columns that could not be added, and NOT NULL columns given a stand-in. */
  problems: string[];
};

export function ensureSchema(): EnsureSchemaResult {
  const tablesCreated: string[] = [];
  const columnsAdded: string[] = [];
  const indexesCreated: string[] = [];
  const problems: string[] = [];

  const tables = declaredTables();
  let columnsChecked = 0;

  for (const t of tables) {
    columnsChecked += t.columns.length;
    // ── the table itself ─────────────────────────────────────────────────────
    if (!tableExists(t.name)) {
      db.run(sql.raw(renderCreateTable(t)));
      tablesCreated.push(t.name);
    } else {
      // ── columns it is missing ──────────────────────────────────────────────
      const have = existingColumns(t.name);
      for (const c of t.columns) {
        if (have.has(c.name)) continue;

        // SQLite cannot ADD COLUMN a primary key. Nothing to do but say so.
        if (c.primary) {
          problems.push(
            `${t.name}.${c.name} is a PRIMARY KEY and is missing — SQLite cannot ` +
              `add one with ALTER TABLE. The table needs rebuilding by hand.`,
          );
          continue;
        }

        const type = c.getSQLType();
        let def = literalDefault(c);
        if (c.notNull && def === null) {
          // Legal only with a default, and existing rows need a value.
          def = fallbackDefault(type);
          problems.push(
            `${t.name}.${c.name} is NOT NULL with no schema default — added with ` +
              `${def} so existing rows remain valid. Check that this is the value you want.`,
          );
        }

        const ddl =
          `ALTER TABLE \`${t.name}\` ADD COLUMN \`${c.name}\` ${type}` +
          (c.notNull ? " NOT NULL" : "") +
          (def !== null ? ` DEFAULT ${def}` : "");
        db.run(sql.raw(ddl));
        columnsAdded.push(`${t.name}.${c.name}`);
      }
    }

    // ── indexes ──────────────────────────────────────────────────────────────
    for (const ddl of renderIndexes(t)) {
      const name = /INDEX IF NOT EXISTS `([^`]+)`/.exec(ddl)?.[1];
      // Checked BEFORE creating, not after. `IF NOT EXISTS` succeeds silently on
      // an index that is already there, so creating first and reporting after
      // would claim all seven were created on every single boot.
      if (name && indexExists(name)) continue;
      // An index on a column this repair could not add would throw; that is not
      // worth failing a boot over, and `problems` already names the real cause.
      try {
        db.run(sql.raw(ddl));
        if (name) indexesCreated.push(name);
      } catch {
        /* its table could not be built — see problems */
      }
    }
  }

  return {
    tablesChecked: tables.length,
    columnsChecked,
    tablesCreated,
    columnsAdded,
    indexesCreated,
    problems,
  };
}

// ── R-28: reference data falls behind the starter DB too ────────────────────
//
// The above derives TABLES, COLUMNS and INDEXES from the drizzle schema — but
// a schema declaration has no idea what ROWS a reference table is supposed to
// contain. The live save's `locations` table had only 8 rows; the shipped
// starter DB has 11. Venues 9-11 were added to the starter DB at some point
// (see R-05's note "venues 9-11 exist now") and nothing ever backfilled that
// into a save someone already had. World Tour fixture data references
// location id 11, so on that save both POST /careers and GET /dashboard
// 500'd with a bare FOREIGN KEY constraint failed the moment fixture
// generation ran — the code was correct, checked against the shipped DB
// (which has all 11 locations); the save's own reference data just never
// caught up.
//
// ── Which tables ──────────────────────────────────────────────────────────
// Not derivable from the schema either — nothing there says "this table is
// pure reference data with no per-career shadow state". Chosen from
// scripts/src/make-starter-db.ts's own KEEP_TABLES (rows kept as-is across a
// starter-DB rebuild — the authoritative "this is reference data" list,
// already hand-maintained there for a different reason, with a drift check
// of its own ensuring every schema table is categorized KEEP or CLEAR):
//
//   KEEP_TABLES = players, staff, locations, club_templates, outfits
//
// `players` and `staff` are excluded here despite being in that list: both
// ARE written by gameplay (updatePlayerReference / updateStaffReference in
// lib/playerDto.ts — real UPDATE call sites, not hypothetical), and — more
// importantly — a missing player/staff row needs a matching
// career_player_state/career_staff_state row for every EXISTING career save,
// which only seedCareerState() creates, only at career creation. Backfilling
// the reference row alone would leave a player who exists nowhere any
// existing career can see them: not in the market, not signable. That is a
// different, larger problem than "a row is missing" and is not attempted
// here. `locations`, `club_templates` and `outfits` have no such per-career
// shadow — a missing row is simply missing, and inserting it by primary key
// is completely self-contained.
const REFERENCE_TABLES = ["locations", "club_templates", "outfits"] as const;

// ── R-33: reference-data UPDATES never reach an existing save ──────────────
//
// R-28 (above) only ever INSERTs a row this save is missing. It never asked
// whether a row the save ALREADY HAS has since been corrected in the starter
// DB — so when players 51 and 187 were renamed (Novi Anggraini -> Dewi
// Lestari, Elena Papadopoulou -> Eleni Papadopoulou; the caption-audit fixes),
// every existing save kept showing the old, wrong name forever. This is that
// second half: for columns confirmed never written by gameplay, bring an
// existing row's VALUES forward to match the starter DB too.
//
// ── locations / club_templates / outfits: zero runtime writes, full sync ───
// Grepping the whole api-server for `update(locationsTable)`,
// `update(clubTemplatesTable)`, `update(outfitsTable)` finds exactly one
// call site each: seed.ts, a one-time seed script, never a route. No player
// action can ever change a row in these three tables, so every shared column
// is safe to sync, the same set REFERENCE_TABLES already inserts with.
//
// ── players / staff: NOT a full sync — some columns ARE gameplay-writable ──
// `players` and `staff` were deliberately excluded from REFERENCE_TABLES
// above (see the comment on it) because unlike locations/club_templates/
// outfits, a MISSING row needs career-scoped state too, which this file does
// not attempt. But R-33 only asks about UPDATING rows that already exist,
// which has a different, narrower danger: `lib/playerDto.ts`'s
// updatePlayerReference()/updateStaffReference() are "the ONLY sanctioned
// write" to these reference rows (enforced by scripts/check-write-boundaries.cjs),
// so grepping their call sites in routes/ is exhaustive, not a guess:
//
//   PATCH /players/:id (pages/team.tsx's "Edit" and "Change Nationality"
//   buttons on every roster player — a real, always-visible, unguarded
//   feature, not a debug tool) writes: name, nationality, continent,
//   position, potential.
//
//   PATCH /staff/:id (pages/staff.tsx's own "Edit") writes: name,
//   nationality, attributes, personality, specialty, specialTrait.
//
// Those columns are EXCLUDED here — syncing them from the starter DB would
// silently overwrite a manager's own in-game rename/re-nationalisation the
// next time the app boots. Concretely, this means the register's own
// motivating example — players 51/187's `name` — is NOT fixed by this
// mechanism, because `name` fails "columns gameplay never writes." That is
// reported, not routed around: forcing `name` through anyway would reopen
// exactly the failure mode this filter exists to prevent, on every existing
// save that has ever used the Edit-Player feature. A `name`-specific
// correction (if still wanted for 51/187 specifically) needs a separate,
// one-off, targeted fix — not a blanket reference-sync rule.
//
// Every other column on both tables is written ONLY by seed/import scripts
// (scripts/src/*.ts) or by routes/dev.ts (dev-only, gated off in production,
// and itself in check-write-boundaries.cjs's ALLOWED list) — never by a
// route a real player can reach. Those are exactly what's listed below.
const REFERENCE_UPDATE_ONLY: Record<string, readonly string[]> = {
  players: [
    "base_age", "height", "speed", "power", "defense", "serve", "block", "stamina",
    "image_url", "player_type", "asking_price", "is_draft_player", "elite_event_type",
    "career_seasons", "career_titles", "continental_titles", "world_titles",
    "olympic_medals_count", "peak_overall_rating", "years_active", "legend_score",
    "development", "player_v4",
  ],
  staff: [
    "role", "base_salary", "skill_level", "image_url", "base_age", "overall_rating",
    "coach_speciality", "scouting_rating",
  ],
};

export type EnsureReferenceDataResult = {
  starterDbPath: string | null;
  /** Why nothing was compared — no starter DB reference available. */
  skipped?: string;
  /** table name -> primary keys of the rows inserted. */
  inserted: Record<string, Array<string | number>>;
  /** table name -> primary keys of the rows updated (R-33). */
  updated: Record<string, Array<string | number>>;
};

function primaryKeyColumn(table: string): string | null {
  const rows = db.all<{ name: string; pk: number }>(sql.raw(`PRAGMA table_info(\`${table}\`)`));
  const pk = rows.filter((r) => r.pk > 0).sort((a, b) => a.pk - b.pk);
  // Every REFERENCE_TABLES member has a single-column integer primary key.
  // A composite key would need per-column matching this does not attempt —
  // reported as skipped for that table rather than guessed at.
  return pk.length === 1 ? pk[0]!.name : null;
}

/**
 * Compare REFERENCE_TABLES against the shipped starter DB (path supplied via
 * STARTER_DB_PATH — set by electron/main.js's startServer(), the same
 * "resolve it in the process that actually knows, pass it down" pattern
 * already used for serverEntry/publicDir, because process.resourcesPath
 * resolves inconsistently inside this forked child). Absent in any context
 * that doesn't set it (a bare `node dist/index.mjs`, most harness suites) —
 * that is not an error, just nothing to compare against, and is reported as
 * `skipped` rather than thrown.
 *
 * Two passes now (R-33 added the second):
 *   1. INSERT — every row the starter DB has that this save doesn't, for
 *      REFERENCE_TABLES (locations/club_templates/outfits). Unchanged from
 *      R-28.
 *   2. UPDATE — for a row BOTH sides already have, bring forward whichever
 *      columns are safe to (see REFERENCE_UPDATE_ONLY's comment above for
 *      exactly which, and why players/staff are a narrower list than
 *      locations/club_templates/outfits). Only columns that actually differ
 *      are written, and only when the value differs — a table with nothing
 *      to update runs zero UPDATE statements.
 *
 * Run after ensureSchema() so every table involved is guaranteed to exist and
 * have every declared column before rows are compared.
 */
export function ensureReferenceData(): EnsureReferenceDataResult {
  const starterDbPath = process.env["STARTER_DB_PATH"];
  const inserted: Record<string, Array<string | number>> = {};
  const updated: Record<string, Array<string | number>> = {};

  if (!starterDbPath) {
    return { starterDbPath: null, skipped: "STARTER_DB_PATH not set", inserted, updated };
  }
  if (!fs.existsSync(starterDbPath)) {
    return { starterDbPath, skipped: `starter DB not found at ${starterDbPath}`, inserted, updated };
  }

  const starter = new Database(starterDbPath, { readonly: true, fileMustExist: true });
  try {
    // ── Pass 1: insert missing rows (R-28, unchanged) — locations/club_templates/outfits only ──
    for (const table of REFERENCE_TABLES) {
      if (!tableExists(table)) continue; // ensureSchema() above already creates it if wholly missing

      const pkCol = primaryKeyColumn(table);
      if (!pkCol) continue;

      const starterCols = new Set(
        (starter.prepare(`PRAGMA table_info(\`${table}\`)`).all() as { name: string }[]).map((r) => r.name),
      );
      // Only columns both sides actually have. ensureSchema() already brought
      // the live table's columns forward to match the drizzle schema; this
      // does not also try to add columns, only rows.
      const sharedCols = [...starterCols].filter((c) => existingColumns(table).has(c));
      if (sharedCols.length === 0) continue;

      const livePks = new Set(
        db.all<Record<string, unknown>>(sql.raw(`SELECT \`${pkCol}\` AS pk FROM \`${table}\``)).map((r) => r.pk),
      );

      const starterRows = starter.prepare(`SELECT * FROM \`${table}\``).all() as Record<string, unknown>[];
      const missing = starterRows.filter((r) => !livePks.has(r[pkCol]));

      if (missing.length > 0) {
        const colList = sharedCols.map((c) => `\`${c}\``).join(", ");
        const placeholders = sharedCols.map(() => "?").join(", ");
        const insertStmt = sqlite.prepare(`INSERT INTO \`${table}\` (${colList}) VALUES (${placeholders})`);

        for (const row of missing) {
          const values = sharedCols.map((c) => (row[c] === undefined ? null : row[c]));
          insertStmt.run(...values);
          inserted[table] = [...(inserted[table] ?? []), row[pkCol] as string | number];
        }
      }

      // ── Pass 2 (R-33), same table: update rows both sides already have ──
      // Safe here for every shared column — nothing ever writes these three
      // tables outside a one-time seed script (see REFERENCE_UPDATE_ONLY's
      // comment above).
      updateExistingRows(table, pkCol, sharedCols, starterRows, updated);
    }

    // ── Pass 2 (R-33): players/staff — update-only, whitelisted columns only ──
    for (const [table, updateCols] of Object.entries(REFERENCE_UPDATE_ONLY)) {
      if (!tableExists(table)) continue;

      const pkCol = primaryKeyColumn(table);
      if (!pkCol) continue;

      const starterCols = new Set(
        (starter.prepare(`PRAGMA table_info(\`${table}\`)`).all() as { name: string }[]).map((r) => r.name),
      );
      const live = existingColumns(table);
      // Intersect the whitelist with what both DBs actually have — same
      // caution R-28 already applies, so a column renamed or dropped on
      // either side is silently skipped rather than throwing.
      const sharedCols = updateCols.filter((c) => starterCols.has(c) && live.has(c));
      if (sharedCols.length === 0) continue;

      const starterRows = starter.prepare(`SELECT * FROM \`${table}\``).all() as Record<string, unknown>[];
      updateExistingRows(table, pkCol, sharedCols, starterRows, updated);
    }
  } finally {
    starter.close();
  }

  return { starterDbPath, inserted, updated };
}

/**
 * Shared by both R-33 passes: for every starter row whose primary key also
 * exists live, compare `cols` and UPDATE only the ones that differ — never a
 * blanket overwrite, so a row with nothing changed runs zero statements, and
 * a row with one changed column writes exactly one column.
 */
function updateExistingRows(
  table: string,
  pkCol: string,
  cols: readonly string[],
  starterRows: Record<string, unknown>[],
  updated: Record<string, Array<string | number>>,
): void {
  const liveRows = db.all<Record<string, unknown>>(
    sql.raw(`SELECT \`${pkCol}\`, ${cols.map((c) => `\`${c}\``).join(", ")} FROM \`${table}\``),
  );
  const liveByPk = new Map(liveRows.map((r) => [r[pkCol], r]));

  for (const starterRow of starterRows) {
    const pk = starterRow[pkCol] as string | number;
    const liveRow = liveByPk.get(pk);
    if (!liveRow) continue; // missing entirely — Pass 1's job (or not backfilled at all for players/staff), not this one

    const changedCols = cols.filter((c) => (starterRow[c] ?? null) !== (liveRow[c] ?? null));
    if (changedCols.length === 0) continue;

    const setClause = changedCols.map((c) => `\`${c}\` = ?`).join(", ");
    const values = changedCols.map((c) => (starterRow[c] === undefined ? null : starterRow[c]));
    sqlite.prepare(`UPDATE \`${table}\` SET ${setClause} WHERE \`${pkCol}\` = ?`).run(...values, pk);
    updated[table] = [...(updated[table] ?? []), pk];
  }
}
