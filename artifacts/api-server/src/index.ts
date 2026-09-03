import app from "./app";
import { logger } from "./lib/logger";
import { normaliseContinentsOnce } from "./utils/normaliseContinents";
import { ensurePoolCompetitors, ensureTeamCompetitors } from "./utils/competitors";
import {
  migrateCareerStateOnce, migratePoolTeamStateOnce,
  attributeRegionalLeagueOnce, dropMovedColumns,
} from "./utils/migrateCareerState";
import { ensureSchema } from "./utils/ensureSchema";

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
