// electron-builder "afterPack" hook (package.json build.afterPack). Runs once
// the app folder (win-unpacked) is assembled and BEFORE the NSIS installer is
// built from it, so a failure here stops both.
//
// R-65: the packaged starter database must be exactly one file. SQLite keeps a
// WAL-mode database's recent writes in `-wal` / `-shm` sidecars beside it, and
// the repo's lib/db/volleyball-empire.sqlite regularly has them — every harness
// suite that boots a server against it leaves a pair behind. The extraResources
// entry names the single .sqlite file, so a sidecar cannot be picked up today;
// this makes that a checked fact rather than an assumption, for any future
// change to that entry (a directory form, a glob) that would sweep them in.
//
// A sidecar in the package would also be copied into a new player's save
// folder on first launch, and Steam's depot would ship it.
const fs = require("fs");
const path = require("path");

const EXPECTED = ["volleyball-empire.sqlite"];

async function afterPack(context) {
  const dir = path.join(context.appOutDir, "resources", "starter-db");
  const entries = fs.existsSync(dir) ? fs.readdirSync(dir).sort() : null;
  if (!entries || JSON.stringify(entries) !== JSON.stringify(EXPECTED)) {
    throw new Error(
      `[after-pack] Aborting - ${dir} must hold exactly ${EXPECTED.join(", ")}; ` +
      `found ${entries ? (entries.join(", ") || "nothing") : "no folder"}. ` +
      "A -wal/-shm sidecar must never ship: check package.json build.extraResources.",
    );
  }
  console.log("[after-pack] OK - resources/starter-db holds only volleyball-empire.sqlite (no -wal/-shm).");
}

module.exports = afterPack;
