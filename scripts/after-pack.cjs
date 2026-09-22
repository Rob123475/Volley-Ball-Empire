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

  // ── ACH: steam_appid.txt must not ship ────────────────────────────────────
  //
  // Steam gives a launched game its app id. A steam_appid.txt beside the exe
  // overrides that, which is exactly what it is for in development (running
  // the game outside Steam and still connecting), and exactly what must not be
  // in a player's install: a shipped file that names an app id is a file that
  // can name the WRONG app id after a depot change, and the game would then
  // unlock achievements against something else.
  for (const dir of [context.appOutDir, path.join(context.appOutDir, "resources")]) {
    const stray = path.join(dir, "steam_appid.txt");
    if (fs.existsSync(stray)) {
      throw new Error(
        `[after-pack] Aborting - ${stray} must never ship. It is a development ` +
        "file: Steam gives a launched game its app id, and a shipped override " +
        "can only ever be wrong. Remove it from the repo root before packaging.",
      );
    }
  }
  console.log("[after-pack] OK - no steam_appid.txt in the package (development file only).");

  // ── ACH: steamworks.js must ship, unpacked ────────────────────────────────
  //
  // package.json build.files lists `electron/**/*`, which REPLACES
  // electron-builder's default and takes node_modules with it; steamworks.js is
  // named there explicitly, and asarUnpack keeps it outside app.asar so
  // steam_api64.dll can be loaded by the OS loader. If either is dropped, Steam
  // silently never connects in a packaged build and every achievement stops at
  // the game's own screen — which nobody would notice until a player asked.
  const steamDir = path.join(context.appOutDir, "resources", "app.asar.unpacked", "node_modules", "steamworks.js");
  const dll = path.join(steamDir, "dist", "win64", "steam_api64.dll");
  const node = path.join(steamDir, "dist", "win64", "steamworksjs.win32-x64-msvc.node");
  const missing = [steamDir, dll, node].filter((f) => !fs.existsSync(f));
  if (missing.length > 0) {
    throw new Error(
      "[after-pack] Aborting - steamworks.js is not in the package, unpacked: " +
      `missing ${missing.join(", ")}. Check package.json build.files and build.asarUnpack.`,
    );
  }
  console.log(`[after-pack] OK - steamworks.js unpacked at ${path.relative(context.appOutDir, steamDir)} (dll and .node present).`);
}

module.exports = afterPack;
