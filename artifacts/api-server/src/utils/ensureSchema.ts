import { db } from "@workspace/db";
import * as dbExports from "@workspace/db";
import { sql, is } from "drizzle-orm";
import {
  getTableConfig,
  SQLiteTable,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

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
