/**
 * Builds a fresh "starter" SQLite DB from a source save: keeps the shared
 * reference data (players, staff, locations, etc.) but wipes every
 * save-specific/career table so the result can be handed to a brand new
 * career with no leftover team/season/match state.
 *
 * Default dest: lib/db/volleyball-empire.sqlite
 *
 * REQUIRED TWO-STEP PIPELINE — running this script alone is not enough.
 * It clears continental_pool_teams/continental_pool_players (mutated by
 * promotion/relegation) and regional_league_seasons/regional_league_fixtures
 * (mutated by day-advancement) along with everything else career-specific.
 * Nothing in the api-server auto-bootstraps those tables for a new career —
 * POST /careers doesn't touch them, and the regional-league read routes have
 * no lazy-create-if-missing fallback — so without step 2 the output has a
 * non-functional regional league (no pool teams, no season, no fixtures).
 *
 *   step 1: make-starter-db.ts <live save> -> lib/db/volleyball-empire.sqlite
 *   step 2: re-run seed-regional-leagues, then seed-continental-pool-extension,
 *           against lib/db/volleyball-empire.sqlite
 *
 * (ai_managers doesn't need a step 2 — it self-bootstraps via seedIfEmpty()
 * in routes/ai-managers.ts the first time anything hits that route.)
 *
 * The shared better-sqlite3 native build in this workspace is compiled for
 * Electron's Node ABI (rebuilt via @electron/rebuild so the desktop app
 * works), not the system Node used by a plain `tsx` invocation — running
 * this with plain `pnpm exec tsx` will fail with ERR_DLOPEN_FAILED /
 * NODE_MODULE_VERSION mismatch. Run it under Electron's own bundled Node
 * runtime instead (matches the ABI the module is already built for, no
 * rebuild needed), from the `scripts` package directory:
 *
 *   ELECTRON_RUN_AS_NODE=1 \
 *     ../node_modules/electron/dist/electron.exe \
 *     ../node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs \
 *     src/make-starter-db.ts <source.sqlite> [dest.sqlite]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_DEST = path.join(REPO_ROOT, "lib", "db", "volleyball-empire.sqlite");

// Rows in these tables are kept as-is (shared reference data / roster pool).
const KEEP_TABLES = [
  "players",
  "staff",
  "locations",
  "club_templates",
  "outfits",
];

// Every other table currently in the schema — rows get deleted. Kept as an
// explicit list (rather than "everything not in KEEP_TABLES") so a table
// nobody has categorized yet trips the drift check below instead of
// silently getting wiped or silently kept.
//
// continental_pool_teams/continental_pool_players and ai_managers are CLEAR,
// not KEEP, even though they look like reference/roster pools: pool
// ranking and isActiveInLeague are mutated by promotion/relegation during a
// career (see utils/regionalSeason.ts), and ai_managers self-bootstraps via
// seedIfEmpty() in routes/ai-managers.ts. Keeping them would bake one
// career's mutated world state into every new install.
const CLEAR_TABLES = [
  "sessions",
  "users",
  "achievements",
  "active_camps",
  "ai_manager_events",
  "ai_managers",
  "calendar_state",
  "career_history_entries",
  "career_saves",
  // Career-scoped state: a starter database has no careers, so it must have no
  // state rows either. seedCareerState() builds them when a career is created.
  "career_player_state",
  "career_staff_state",
  // Competitor identity is rebuilt at boot by ensurePoolCompetitors() /
  // ensureTeamCompetitors(); rankings are career-scoped.
  "competitors",
  "competitor_rankings",
  "continental_pool_players",
  "continental_pool_teams",
  "continental_scouting_missions",
  "contracts",
  "facilities",
  "finance_transactions",
  "hall_of_fame",
  "injury_history",
  "manager_season_summaries",
  "match_live_state",
  "matches",
  "olympic_selections",
  "poaching_offers",
  "promo_deals",
  "regional_league_fixtures",
  "regional_league_results",
  "regional_league_seasons",
  "season_final_standings",
  "season_injury_stats",
  "seasons",
  "teams",
  "training_sessions",
  "trophies",
  "unity_match_stats",
  "user_profiles",
  "wellbeing_effects",
  "world_tour_qualifications",
  "youth_championship_trophies",
  "youth_ladder",
  "youth_league_results",
  "youth_prospects",
];

function checkpointAndCloseIfExists(dbPath: string) {
  if (!fs.existsSync(dbPath)) return;
  const db = new Database(dbPath);
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();
}

function removeIfExists(filePath: string) {
  if (fs.existsSync(filePath)) fs.rmSync(filePath);
}

function prepareDest(srcPath: string, destPath: string) {
  // Checkpoint + clear stale WAL sidecars on the EXISTING dest only, then
  // overwrite it outright — this script never creates a backup file.
  // The source is never opened for writing, so its own WAL is left untouched;
  // instead we copy its -wal/-shm sidecars alongside the main file (if
  // present) so any not-yet-checkpointed transactions in the source aren't
  // silently lost — SQLite will replay them automatically the first time the
  // dest is opened.
  if (fs.existsSync(destPath)) {
    checkpointAndCloseIfExists(destPath);
    removeIfExists(`${destPath}-wal`);
    removeIfExists(`${destPath}-shm`);
  }

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(srcPath, destPath);
  removeIfExists(`${destPath}-wal`);
  removeIfExists(`${destPath}-shm`);
  for (const suffix of ["-wal", "-shm"]) {
    const srcSidecar = `${srcPath}${suffix}`;
    if (fs.existsSync(srcSidecar)) {
      fs.copyFileSync(srcSidecar, `${destPath}${suffix}`);
    }
  }
  console.log(`Copied ${srcPath} -> ${destPath}`);
}

function main() {
  const srcArg = process.argv[2];
  if (!srcArg) {
    console.error("Usage: tsx make-starter-db.ts <source-sqlite-path> [dest-sqlite-path]");
    process.exit(1);
  }
  const srcPath = path.resolve(srcArg);
  const destPath = path.resolve(process.argv[3] ?? DEFAULT_DEST);

  if (!fs.existsSync(srcPath)) {
    console.error(`Source not found: ${srcPath}`);
    process.exit(1);
  }
  if (path.resolve(srcPath) === path.resolve(destPath)) {
    console.error("Source and dest resolve to the same file — refusing to run.");
    process.exit(1);
  }

  const srcMtimeBefore = fs.statSync(srcPath).mtimeMs;

  console.log("=== make-starter-db ===");
  console.log(`Source: ${srcPath}`);
  console.log(`Dest:   ${destPath}`);

  prepareDest(srcPath, destPath);

  if (fs.statSync(srcPath).mtimeMs !== srcMtimeBefore) {
    throw new Error("Source file was modified during this run — this should never happen.");
  }

  const db = new Database(destPath);
  db.pragma("journal_mode = WAL");

  const actualTables = (
    db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'",
      )
      .all() as { name: string }[]
  ).map((r) => r.name);

  const keepSet = new Set(KEEP_TABLES);
  const clearSet = new Set(CLEAR_TABLES);
  const unknown = actualTables.filter((t) => !keepSet.has(t) && !clearSet.has(t));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown table(s) not in KEEP_TABLES or CLEAR_TABLES: ${unknown.join(", ")}. ` +
        `Update make-starter-db.ts before running against this DB.`,
    );
  }

  const tablesToClear = CLEAR_TABLES.filter((t) => actualTables.includes(t));
  const missingKeep = KEEP_TABLES.filter((t) => !actualTables.includes(t));
  const missingClear = CLEAR_TABLES.filter((t) => !actualTables.includes(t));
  if (missingKeep.length) console.log(`Note: KEEP table(s) not present in this DB, skipping: ${missingKeep.join(", ")}`);
  if (missingClear.length) console.log(`Note: CLEAR table(s) not present in this DB, skipping: ${missingClear.join(", ")}`);

  const beforeCounts = new Map<string, number>();
  for (const t of tablesToClear) {
    beforeCounts.set(t, (db.prepare(`SELECT COUNT(*) as n FROM \`${t}\``).get() as { n: number }).n);
  }

  // FK enforcement must be toggled outside any transaction (SQLite no-ops
  // it otherwise). Off for the bulk clear since delete order across 37
  // tables isn't (and shouldn't need to be) topologically sorted — e.g.
  // `teams` clears while `players`/`staff` (kept) still reference it until
  // the reset UPDATEs below run in the same transaction.
  db.pragma("foreign_keys = OFF");

  const run = db.transaction(() => {
    for (const t of tablesToClear) {
      db.prepare(`DELETE FROM \`${t}\``).run();
    }

    // `players` needs no reset any more. Every column this used to clear —
    // team_id, squad_role, condition, outfit_id — moved to career_player_state,
    // which is cleared wholesale above. What is left on the reference row is
    // what a player STARTS with, and a starter database is supposed to keep it.
    //
    // This UPDATE was not merely redundant: after the columns were dropped it
    // would have thrown "no such column: team_id" and taken the whole script
    // with it. outfit_id physically survives the drop (SQLite refuses it — a
    // foreign key depends on it), so a reset here would have written to a
    // column nothing reads, which is worse than an error.

    if (actualTables.includes("staff")) {
      db.prepare(`UPDATE staff SET team_id = NULL, is_available = 1`).run();
    }

    const hasSqliteSequence = (
      db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'").get()
    ) != null;
    if (hasSqliteSequence && tablesToClear.length > 0) {
      const placeholders = tablesToClear.map(() => "?").join(", ");
      db.prepare(`DELETE FROM sqlite_sequence WHERE name IN (${placeholders})`).run(...tablesToClear);
    }
  });
  run();

  db.pragma("foreign_keys = ON");
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.exec("VACUUM");

  console.log("\n--- kept tables (row counts) ---");
  for (const t of KEEP_TABLES) {
    if (!actualTables.includes(t)) continue;
    const n = (db.prepare(`SELECT COUNT(*) as n FROM \`${t}\``).get() as { n: number }).n;
    console.log(`  ${t}: ${n}`);
  }

  console.log("\n--- cleared tables (before -> after) ---");
  for (const t of tablesToClear) {
    const after = (db.prepare(`SELECT COUNT(*) as n FROM \`${t}\``).get() as { n: number }).n;
    console.log(`  ${t}: ${beforeCounts.get(t)} -> ${after}`);
  }

  console.log("\n--- sanity checks ---");
  if (actualTables.includes("players")) {
    const playerCount = (db.prepare("SELECT COUNT(*) as n FROM players").get() as { n: number }).n;
    if (playerCount === 0) {
      console.warn("WARNING: players table is empty.");
    }

    // Squad membership is career state now, so "still on a team" is a question
    // about career_player_state, not about players.team_id — which no longer
    // exists. This used to read the reference column and threw once it went.
    const stillOnTeam = (
      db
        .prepare(
          "SELECT COUNT(*) as n FROM career_player_state WHERE team_id IS NOT NULL",
        )
        .get() as { n: number }
    ).n;
    if (stillOnTeam > 0) {
      console.warn(`WARNING: ${stillOnTeam} career-state row(s) still have a non-null team_id.`);
    }

    const noImage = (
      db
        .prepare("SELECT COUNT(*) as n FROM players WHERE image_url IS NULL OR image_url = ''")
        .get() as { n: number }
    ).n;
    if (noImage > 0) {
      console.warn(`WARNING: ${noImage} player(s) have no image_url.`);
    }

    if (playerCount > 0 && stillOnTeam === 0 && noImage === 0) {
      console.log("Players table looks clean (non-empty, no team assignments, all have images).");
    }
  } else {
    console.warn("WARNING: no players table present in this DB.");
  }

  db.close();
  console.log("\n=== Done ===");
}

main();
