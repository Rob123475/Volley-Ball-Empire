import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

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
 * The DDL is copied verbatim from the shipped database's sqlite_master, which
 * drizzle-kit push generated, so an old save converges on exactly the schema a
 * fresh install gets rather than a hand-written approximation of it.
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
  "CREATE UNIQUE INDEX IF NOT EXISTS `competitors_team_id_unique` ON `competitors` (`team_id`)",
  "CREATE UNIQUE INDEX IF NOT EXISTS `competitors_pool_team_id_unique` ON `competitors` (`pool_team_id`)",
  "CREATE UNIQUE INDEX IF NOT EXISTS `competitor_rankings_unique` ON `competitor_rankings` (`competitor_id`,`career_save_id`,`season_year`)",
];

/** Columns added to pre-existing tables after this project started shipping. */
const NEW_COLUMNS: ReadonlyArray<readonly [string, string, string]> = [
  ["seasons", "career_save_id", "integer"],
  // Scoped during the staff split while both tables were still empty.
  ["ai_managers", "career_save_id", "integer"],
  ["world_tour_qualifications", "career_save_id", "integer"],
];

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

  for (const [table, column, type] of NEW_COLUMNS) {
    if (!tableExists(table) || columnExists(table, column)) continue;
    db.run(sql.raw(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`));
    columnsAdded.push(`${table}.${column}`);
  }

  return { tablesCreated, columnsAdded };
}
