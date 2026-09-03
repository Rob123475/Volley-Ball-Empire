import { db } from "@workspace/db";
import * as schema from "@workspace/db";
import { sql, is, isTable, getTableColumns, getTableName, SQL } from "drizzle-orm";
import { logger } from "../lib/logger";
import { RENAME_MANAGED_COLUMNS } from "./migrateCareerState";

/**
 * Create tables and columns that a save predating them will not have.
 *
 * There is no migration runner in this project. The shipped .sqlite file IS the
 * schema, and electron/main.js copies it to userData ONLY when no save exists
 * there — so an upgrading player keeps their old database forever and never
 * receives a table added after they first ran the game.
 *
 * Without this step, a save from before the per-career split has no
 * career_player_state at all: migrateCareerStateOnce() throws, the boot handler
 * logs it and carries on, and the player gets a game that launches with an
 * empty squad and an empty transfer market. A black window is at least
 * obviously broken; that is worse, because it looks like lost progress.
 *
 * Everything here is CREATE ... IF NOT EXISTS or a guarded ADD COLUMN, so it is
 * a no-op on a current database and safe to run on every boot.
 *
 * Tables are still hand-written DDL, copied verbatim from the shipped
 * database's sqlite_master (which drizzle-kit push generated) — deriving a
 * full CREATE TABLE (constraints, FKs, composite indexes) from the drizzle
 * schema at runtime is a real migration-generator, not boot-time repair, so
 * that stays out of scope here. Columns are the part that actually broke a
 * save in production (teams.crest_shape_index, added by hand on 1 Sep because
 * this file didn't know about it) and are derived below instead of hand-typed,
 * so the next column the schema grows doesn't repeat that.
 */

const NEW_TABLES: ReadonlyArray<readonly [string, string]> = [
  ["career_player_state", `
    CREATE TABLE IF NOT EXISTS \`career_player_state\` (
      \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      \`career_save_id\` integer NOT NULL,
      \`player_id\` integer NOT NULL,
      \`team_id\` integer,
      \`squad_role\` text DEFAULT 'reserve' NOT NULL,
      \`is_active\` integer DEFAULT false NOT NULL,
      \`salary\` real DEFAULT 0 NOT NULL,
      \`contract_end_date\` text,
      \`academy_contract_years\` integer,
      \`age\` integer NOT NULL,
      \`fitness\` integer DEFAULT 100 NOT NULL,
      \`fatigue\` integer DEFAULT 0 NOT NULL,
      \`morale\` integer DEFAULT 75 NOT NULL,
      \`injury_status\` text DEFAULT 'Healthy' NOT NULL,
      \`injury_weeks_remaining\` integer DEFAULT 0 NOT NULL,
      \`is_injured\` integer DEFAULT false NOT NULL,
      \`consecutive_matches_played\` integer DEFAULT 0 NOT NULL,
      \`training_points\` integer DEFAULT 0 NOT NULL,
      \`training_focus\` text,
      \`focus_xp\` integer DEFAULT 0 NOT NULL,
      \`scouted_potential\` text,
      \`discovered_by\` text,
      \`is_retired\` integer DEFAULT false NOT NULL,
      \`retired_season_year\` integer,
      \`career_wins\` integer DEFAULT 0 NOT NULL,
      \`is_draft_player\` integer DEFAULT false NOT NULL,
      \`is_promoted\` integer DEFAULT false NOT NULL,
      \`outfit_id\` integer,
      \`updated_at\` integer NOT NULL,
      \`speed\` integer DEFAULT 70 NOT NULL,
      \`power\` integer DEFAULT 70 NOT NULL,
      \`defense\` integer DEFAULT 70 NOT NULL,
      \`serve\` integer DEFAULT 70 NOT NULL,
      \`block\` integer DEFAULT 70 NOT NULL,
      \`stamina\` integer DEFAULT 70 NOT NULL,
      \`career_seasons\` integer DEFAULT 0 NOT NULL,
      \`career_titles\` integer DEFAULT 0 NOT NULL,
      \`continental_titles\` integer DEFAULT 0 NOT NULL,
      \`world_titles\` integer DEFAULT 0 NOT NULL,
      \`olympic_medals_count\` integer DEFAULT 0 NOT NULL,
      \`peak_overall_rating\` integer DEFAULT 0 NOT NULL,
      \`years_active\` text,
      \`legend_score\` integer DEFAULT 0 NOT NULL,
      FOREIGN KEY (\`career_save_id\`) REFERENCES \`career_saves\`(\`id\`),
      FOREIGN KEY (\`player_id\`) REFERENCES \`players\`(\`id\`),
      FOREIGN KEY (\`team_id\`) REFERENCES \`teams\`(\`id\`)
    )`],
  ["career_staff_state", `
    CREATE TABLE IF NOT EXISTS \`career_staff_state\` (
      \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      \`career_save_id\` integer NOT NULL,
      \`staff_id\` integer NOT NULL,
      \`team_id\` integer,
      \`salary\` real DEFAULT 0 NOT NULL,
      \`is_available\` integer DEFAULT true NOT NULL,
      \`contract_length\` integer DEFAULT 12 NOT NULL,
      \`is_scout_revealed\` integer DEFAULT false NOT NULL,
      \`updated_at\` integer NOT NULL,
      FOREIGN KEY (\`career_save_id\`) REFERENCES \`career_saves\`(\`id\`),
      FOREIGN KEY (\`staff_id\`) REFERENCES \`staff\`(\`id\`),
      FOREIGN KEY (\`team_id\`) REFERENCES \`teams\`(\`id\`)
    )`],
  ["career_pool_team_state", `
    CREATE TABLE IF NOT EXISTS \`career_pool_team_state\` (
      \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      \`career_save_id\` integer NOT NULL,
      \`pool_team_id\` integer NOT NULL,
      \`is_active_in_league\` integer DEFAULT false NOT NULL,
      \`promotion_count\` integer DEFAULT 0 NOT NULL,
      \`relegation_count\` integer DEFAULT 0 NOT NULL,
      \`updated_at\` integer NOT NULL,
      FOREIGN KEY (\`career_save_id\`) REFERENCES \`career_saves\`(\`id\`),
      FOREIGN KEY (\`pool_team_id\`) REFERENCES \`continental_pool_teams\`(\`id\`)
    )`],
  ["competitors", `
    CREATE TABLE IF NOT EXISTS \`competitors\` (
      \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      \`team_id\` integer,
      \`pool_team_id\` integer,
      \`created_at\` integer NOT NULL,
      FOREIGN KEY (\`team_id\`) REFERENCES \`teams\`(\`id\`),
      FOREIGN KEY (\`pool_team_id\`) REFERENCES \`continental_pool_teams\`(\`id\`),
      CONSTRAINT "competitor_exactly_one_parent"
        CHECK(("competitors"."team_id" IS NULL) <> ("competitors"."pool_team_id" IS NULL))
    )`],
  ["competitor_rankings", `
    CREATE TABLE IF NOT EXISTS \`competitor_rankings\` (
      \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      \`competitor_id\` integer NOT NULL,
      \`career_save_id\` integer NOT NULL,
      \`season_year\` integer NOT NULL,
      \`ranking_points\` integer DEFAULT 0 NOT NULL,
      \`events_entered\` integer DEFAULT 0 NOT NULL,
      \`wins\` integer DEFAULT 0 NOT NULL,
      \`losses\` integer DEFAULT 0 NOT NULL,
      \`updated_at\` integer NOT NULL,
      FOREIGN KEY (\`competitor_id\`) REFERENCES \`competitors\`(\`id\`),
      FOREIGN KEY (\`career_save_id\`) REFERENCES \`career_saves\`(\`id\`)
    )`],
];

const NEW_INDEXES: readonly string[] = [
  "CREATE UNIQUE INDEX IF NOT EXISTS `career_player_state_unique` ON `career_player_state` (`career_save_id`,`player_id`)",
  "CREATE UNIQUE INDEX IF NOT EXISTS `career_staff_state_unique` ON `career_staff_state` (`career_save_id`,`staff_id`)",
  "CREATE UNIQUE INDEX IF NOT EXISTS `career_pool_team_state_unique` ON `career_pool_team_state` (`career_save_id`,`pool_team_id`)",
  "CREATE UNIQUE INDEX IF NOT EXISTS `competitors_team_id_unique` ON `competitors` (`team_id`)",
  "CREATE UNIQUE INDEX IF NOT EXISTS `competitors_pool_team_id_unique` ON `competitors` (`pool_team_id`)",
  "CREATE UNIQUE INDEX IF NOT EXISTS `competitor_rankings_unique` ON `competitor_rankings` (`competitor_id`,`career_save_id`,`season_year`)",
];

/** The runtime shape drizzle exposes for one column, for the fields this file reads. */
interface SchemaColumn {
  name: string;
  notNull: boolean;
  hasDefault: boolean;
  default: unknown;
  defaultFn: unknown;
  columnType: string;
  mode?: string;
  getSQLType(): string;
  mapToDriverValue(value: unknown): unknown;
}

function sqlLiteral(value: unknown): string {
  if (value === null) return "NULL";
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
  throw new Error(`ensureSchema: don't know how to render a SQL literal for a ${typeof value}: ${JSON.stringify(value)}`);
}

/**
 * A DB-side DEFAULT for an ADD COLUMN, or null if the column can be added
 * bare. Throws rather than guessing when a NOT NULL column has no safe value
 * to backfill existing rows with — that is "fail boot with a clear error",
 * not a silent skip; the caller in index.ts already logs and carries on.
 */
function columnDefaultSql(table: string, column: SchemaColumn): string | null {
  if (column.hasDefault && column.default !== undefined) {
    if (is(column.default, SQL)) {
      throw new Error(
        `ensureSchema: ${table}.${column.name} has a raw SQL default — extend columnDefaultSql to render it explicitly, don't guess.`,
      );
    }
    return sqlLiteral(column.mapToDriverValue(column.default));
  }

  if (column.defaultFn !== undefined) {
    // The only shape this project uses today: `.$defaultFn(() => new Date())`
    // on a timestamp column. That default is computed in JS on insert, which
    // ALTER TABLE cannot see — so a NOT NULL timestamp column needs an actual
    // DB-side stand-in or every existing row fails the constraint.
    if (column.columnType === "SQLiteTimestamp") {
      const seconds = column.mode !== "timestamp_ms";
      const value = seconds ? "(unixepoch())" : "(unixepoch() * 1000)";
      logger.warn(
        { table, column: column.name },
        "column has only a runtime default (timestamp) — backfilling existing rows with the current time",
      );
      return value;
    }
    if (!column.notNull) return null;
    throw new Error(
      `ensureSchema: ${table}.${column.name} is NOT NULL with only a runtime default (${column.columnType}) — no DB-side default to derive; add one to the schema.`,
    );
  }

  if (column.notNull) {
    throw new Error(
      `ensureSchema: ${table}.${column.name} is NOT NULL with no default at all — cannot safely add this column to an existing save.`,
    );
  }

  return null;
}

/** Every table the drizzle schema declares — the source of truth for derived columns. */
function schemaTables(): Array<{ name: string; columns: Record<string, SchemaColumn> }> {
  const tables: Array<{ name: string; columns: Record<string, SchemaColumn> }> = [];
  for (const value of Object.values(schema)) {
    if (!isTable(value)) continue;
    tables.push({
      name: getTableName(value),
      columns: getTableColumns(value) as unknown as Record<string, SchemaColumn>,
    });
  }
  return tables;
}

function tableExists(name: string): boolean {
  const rows = db.all<{ n: number }>(
    sql.raw(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='${name}'`),
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

function columnExists(table: string, column: string): boolean {
  const rows = db.all<{ name: string }>(sql.raw(`PRAGMA table_info(${table})`));
  return rows.some((r) => r.name === column);
}

export type EnsureSchemaResult = {
  tablesCreated: string[];
  columnsAdded: string[];
};

export function ensureSchema(): EnsureSchemaResult {
  const tablesCreated: string[] = [];
  const columnsAdded: string[] = [];

  for (const [name, ddl] of NEW_TABLES) {
    if (tableExists(name)) continue;
    db.run(sql.raw(ddl));
    tablesCreated.push(name);
  }

  for (const ddl of NEW_INDEXES) {
    // An index whose table is absent cannot be created; that is not an error
    // worth failing a boot over, and the table branch above will have made it.
    try { db.run(sql.raw(ddl)); } catch { /* index already present or table absent */ }
  }

  const knownNewTables = new Set(NEW_TABLES.map(([name]) => name));
  const renameManaged = new Set(RENAME_MANAGED_COLUMNS.map(([t, c]) => `${t}.${c}`));
  for (const table of schemaTables()) {
    if (!tableExists(table.name)) {
      // Created above if it's a known NEW_TABLES entry; anything else is a
      // genuine gap — a table the schema declares that no boot path creates.
      if (!knownNewTables.has(table.name)) {
        logger.error(
          { table: table.name },
          "schema declares a table that does not exist in this database and ensureSchema has no CREATE for it — add one to NEW_TABLES",
        );
      }
      continue;
    }
    for (const column of Object.values(table.columns)) {
      if (columnExists(table.name, column.name)) continue;
      // Owned by dropMovedColumns()'s rename-and-backfill logic, which must be
      // the one to create it — see RENAME_MANAGED_COLUMNS for why.
      if (renameManaged.has(`${table.name}.${column.name}`)) continue;
      const defaultSql = columnDefaultSql(table.name, column);
      const ddl = `ALTER TABLE ${table.name} ADD COLUMN ${column.name} ${column.getSQLType()}` +
        (column.notNull ? " NOT NULL" : "") +
        (defaultSql !== null ? ` DEFAULT ${defaultSql}` : "");
      db.run(sql.raw(ddl));
      columnsAdded.push(`${table.name}.${column.name}`);
    }
  }

  return { tablesCreated, columnsAdded };
}
