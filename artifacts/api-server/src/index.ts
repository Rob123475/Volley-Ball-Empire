import app from "./app";
import { logger } from "./lib/logger";
import { sqlite } from "@workspace/db";
import { normaliseContinentsOnce } from "./utils/normaliseContinents";
import { ensurePoolCompetitors, ensureTeamCompetitors } from "./utils/competitors";
import {
  migrateCareerStateOnce, migratePoolTeamStateOnce,
  attributeRegionalLeagueOnce, dropMovedColumns,
} from "./utils/migrateCareerState";
import { ensureSchema, ensureReferenceData } from "./utils/ensureSchema";

// R-31: electron/main.js forks this process and already has a live IPC
// channel to it (confirmed by its own pre-existing child.disconnect() call
// at shutdown) — the same pattern every other cross-process signal in this
// app already uses, so this reuses it rather than adding a second mechanism
// (a localhost admin endpoint would also need to dodge NODE_ENV=production
// gating devRouter, for no benefit over a channel that already exists).
//
// Registered first, before anything else in this file, so it is live for
// the whole process lifetime — a WAL-mode database's true state is split
// across the .sqlite and .sqlite-wal files, and Steam Cloud only syncs
// whatever it's told to sync. Without this, main.js's before-quit just
// killed the process and whatever was still sitting in the WAL at that
// moment shipped nowhere. main.js still force-kills after its existing 2s
// grace period if this message is never sent, never received, or never
// finishes.
process.on("message", (msg) => {
  if (!(msg && typeof msg === "object" && "type" in msg && (msg as { type: unknown }).type === "shutdown")) return;
  try {
    sqlite.pragma("wal_checkpoint(TRUNCATE)");
    sqlite.close();
    logger.info("WAL checkpointed and database closed for shutdown");
  } catch (err) {
    logger.error({ err }, "checkpoint/close on shutdown failed");
  } finally {
    process.exit(0);
  }
});

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// FIRST: create anything a save predating it will not have. There is no
// migration runner here and electron/main.js never overwrites an existing save,
// so an upgrading player's database is whatever schema they first installed.
// Every migration below assumes its tables exist, so this has to lead.
try {
  const s = ensureSchema();
  if (s.tablesCreated.length > 0 || s.columnsAdded.length > 0 || s.indexesCreated.length > 0) {
    logger.info(s, "schema brought forward for an older save");
  } else {
    // Said on every clean boot on purpose. R-01's failure mode was a schema
    // repair that ran and quietly did not cover the missing column, so "it ran
    // and found nothing" has to be visible, not inferred from silence.
    logger.info(
      { tablesChecked: s.tablesChecked, columnsChecked: s.columnsChecked },
      "schema check: save is up to date, 0 missing columns",
    );
  }
  // Never folded into the line above: a stand-in value for a NOT NULL column is
  // a decision the repair made on someone's behalf and must be seen.
  for (const p of s.problems) logger.warn({ schemaRepair: p }, "schema repair needs a human");
} catch (err) {
  logger.error({ err }, "schema ensure failed");
}

// R-28/R-33: a save's own reference rows (locations, club_templates, outfits,
// and — R-33 — the reference-only columns of players/staff) can also fall
// behind the shipped starter DB — a schema check has no notion of this, since
// row data isn't part of the schema declaration at all. Rows missing by
// primary key are inserted (locations/club_templates/outfits only — R-28);
// rows both sides already have get their stale, gameplay-never-writes
// columns brought forward to the starter DB's value (R-33). No-ops (skipped,
// logged) when STARTER_DB_PATH isn't set — most harness suites and a bare
// `node dist/index.mjs` don't set it.
try {
  const r = ensureReferenceData();
  const totalInserted = Object.values(r.inserted).reduce((n, ids) => n + ids.length, 0);
  const totalUpdated  = Object.values(r.updated).reduce((n, ids) => n + ids.length, 0);
  if (r.skipped) {
    logger.info({ starterDbPath: r.starterDbPath, reason: r.skipped }, "reference data backfill skipped");
  } else if (totalInserted > 0 || totalUpdated > 0) {
    logger.info(
      { starterDbPath: r.starterDbPath, inserted: r.inserted, updated: r.updated },
      "reference data backfilled from starter DB",
    );
  } else {
    logger.info({ starterDbPath: r.starterDbPath }, "reference data check: save is up to date, 0 rows missing, 0 rows stale");
  }
} catch (err) {
  logger.error({ err }, "reference data backfill failed");
}

// Data migration: move every continent column onto the canonical KEYS and
// backfill players that never had one. Idempotent, so it is safe on every
// boot — and existing saves need it as much as the shipped database.
try {
  const migrated = normaliseContinentsOnce();
  const touched = migrated.valuesNormalised + migrated.playersBackfilled;
  if (touched > 0) {
    logger.info(
      {
        columnsScanned:    migrated.columnsScanned,
        valuesNormalised:  migrated.valuesNormalised,
        playersBackfilled: migrated.playersBackfilled,
        after:             migrated.after,
      },
      "continent normalisation applied",
    );
  }
  if (migrated.playersUnresolved > 0) {
    logger.warn(
      { unresolved: migrated.playersUnresolved },
      "players still have no continent — nationality not in the lookup",
    );
  }
  // An unknown spelling is left in the data on purpose. It must be loud:
  // it will fail the build gate and show up in the picker's unrecognised
  // bucket, and neither is any use if the server said nothing about it.
  if (migrated.unresolved.length > 0) {
    logger.error(
      { unresolved: migrated.unresolved },
      "continent values outside the canonical set — rows will surface as unrecognised",
    );
  }
} catch (err) {
  // Never block startup on a data migration; the game is still playable.
  logger.error({ err }, "continent normalisation failed");
}

// Competitor identity rows for the 60 AI pool clubs and any existing player
// clubs. Idempotent, and cheap when there is nothing to do.
try {
  const pools = ensurePoolCompetitors();
  const teams = ensureTeamCompetitors();
  if (pools + teams > 0) {
    logger.info({ poolCompetitors: pools, teamCompetitors: teams }, "competitor rows created");
  }
} catch (err) {
  logger.error({ err }, "competitor backfill failed");
}

// Snapshot global player/staff state into per-career state. Must run before the
// mutable columns are dropped from players/staff. Idempotent.
try {
  const m = migrateCareerStateOnce();
  if (m.careersMigrated > 0) {
    logger.info(m, "career state snapshot taken");
  }
  // Only now that every career owns its state can the source columns go.
  const pool = migratePoolTeamStateOnce();
  if (pool.careersMigrated > 0) {
    logger.info(pool, "pool team state snapshot taken");
  }
  const league = attributeRegionalLeagueOnce();
  if (league.careersAttributed > 0) {
    logger.info(league, "regional league attributed to careers");
  }
  const d = dropMovedColumns();
  if (d.dropped.length > 0) {
    logger.info({ dropped: d.dropped }, "moved columns dropped from reference tables");
  }
} catch (err) {
  logger.error({ err }, "career state migration failed");
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
