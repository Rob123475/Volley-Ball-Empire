import app from "./app";
import { logger } from "./lib/logger";
import { normaliseContinentsOnce } from "./utils/normaliseContinents";

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

// Data migration: collapse the three continent spellings onto the canonical
// six and backfill players that never had one. Idempotent, so it is safe on
// every boot — and existing saves need it as much as the shipped database.
try {
  const migrated = normaliseContinentsOnce();
  const touched = Object.values(migrated).reduce((a, b) => a + b, 0);
  if (touched > 0) logger.info(migrated, "continent normalisation applied");
  if (migrated.playersUnresolved > 0) {
    logger.warn(
      { unresolved: migrated.playersUnresolved },
      "players still have no continent — nationality not in the lookup",
    );
  }
} catch (err) {
  // Never block startup on a data migration; the game is still playable.
  logger.error({ err }, "continent normalisation failed");
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
