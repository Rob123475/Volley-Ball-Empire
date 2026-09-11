/**
 * Every harness, in one command, wired into `pnpm build`.
 *
 * The migration and fresh-install fixtures are load-bearing forever now that the
 * starter database ships clean: the repair path they cover only ever runs for
 * players upgrading from an older build — a small population, impossible to
 * debug remotely, and the one that will hit it years from now. Code like that
 * bit-rots unless something runs it on every build.
 *
 * Each suite boots the real server binary itself, so there is nothing to start
 * by hand and nothing to remember.
 *
 * Usage: node harness/run-all.mjs
 * Exits non-zero if any suite fails.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);

if (!fs.existsSync(SERVER)) {
  console.error(`[harness] FAILED: ${SERVER} not built. Run the api-server build first.`);
  process.exit(1);
}

const results = [];

function runSuite(name, file) {
  const started = Date.now();
  const r = spawnSync(process.execPath, [file], { stdio: "inherit", cwd: REPO });
  results.push({ name, ok: r.status === 0, secs: ((Date.now() - started) / 1000).toFixed(1) });
  return r.status === 0;
}

// The guards run FIRST. If a guard has gone inert, every check after it is
// reporting on a net with a hole in it, and the run should say so before
// anything else claims to have passed.
console.log("\n########## 1/18  GUARD SELF-TEST ##########");
runSuite("guard self-test", path.join(REPO, "harness", "guard-selftest.mjs"));

// Schema drift runs before the data migrations, for the same reason
// ensureSchema runs before them at boot: every migration below assumes its
// columns exist. A save that has fallen behind the code fails here first, with
// the column named, rather than three suites later as a confusing data error.
console.log("\n########## 2/18  SCHEMA DRIFT (R-01) ##########");
runSuite("schema drift", path.join(REPO, "harness", "schema-drift.mjs"));

// Same reasoning, one layer down: ensureReferenceData() runs right after
// ensureSchema() at boot, so its own drift check belongs right after schema
// drift's here too — a save missing reference ROWS (not columns) fails here
// first, with the row named, rather than as a confusing FK error later.
console.log("\n########## 3/18  REFERENCE DATA BACKFILL (R-28) ##########");
runSuite("reference data backfill", path.join(REPO, "harness", "reference-data-backfill.mjs"));

// Same boot-time pass, the other half of it: R-28 inserts missing rows, R-33
// updates stale ones. Sits right next to R-28's suite for the same reason.
console.log("\n########## 4/18  REFERENCE DATA UPDATE (R-33) ##########");
runSuite("reference data update", path.join(REPO, "harness", "reference-data-update.mjs"));

// Same boot-time pass again: R-28/R-33 only touch rows a save already has —
// this is what happens when the starter DB has a player row the save has
// never seen at all.
console.log("\n########## 5/18  REFERENCE DATA NEW PLAYERS (R-34) ##########");
runSuite("reference data new players", path.join(REPO, "harness", "reference-data-new-players.mjs"));

// One layer up from all of the above: this is the only suite that boots
// electron/main.js itself rather than just the server, because the R-23
// save-folder rename migration is main.js's own logic, running before
// ensureSchema/ensureReferenceData ever see the moved DB.
console.log("\n########## 6/18  SAVE FOLDER MOVES WITH THE RENAME (R-23) ##########");
runSuite("save folder migration", path.join(REPO, "harness", "save-folder-migration.mjs"));

// The other end of the same process lifecycle R-23 touches at boot: this one
// is shutdown. A real fork(), not spawn() — the IPC channel the shutdown
// message travels over only exists on a forked child.
console.log("\n########## 7/18  CHECKPOINT AND CLOSE ON QUIT (R-31) ##########");
runSuite("wal checkpoint on shutdown", path.join(REPO, "harness", "wal-checkpoint-shutdown.mjs"));

console.log("\n########## 8/18  UNITY PAYLOAD SKIN TONE / KIT COLOUR (R-22) ##########");
runSuite("unity match-state payload", path.join(REPO, "harness", "unity-match-state-payload.mjs"));

// The same endpoint, one layer up: R-22 made the payload carry the right values,
// R-38 made it possible to ASK for them at all. /unity/match-state read the
// career from the session, which neither a WebGL iframe nor Editor Play mode has,
// so the loader it exists to feed could never call it.
console.log("\n########## 9/18  UNITY MATCH-STATE CAREER SCOPING (R-38) ##########");
runSuite("unity career scoping", path.join(REPO, "harness", "unity-career-scoping.mjs"));

// Same freeAgents/isActive contradiction R-22 fixed in the Unity payload,
// found in the live match-simulation engine's own fallback roster lookup.
console.log("\n########## 10/18  LIVE MATCH TICK FALLBACK ROSTER (R-32) ##########");
runSuite("match tick fallback roster", path.join(REPO, "harness", "match-tick-fallback-roster.mjs"));

console.log("\n########## 11/18  MIGRATION FIXTURES ##########");
runSuite("migration fixtures", path.join(REPO, "harness", "migration-fixtures.mjs"));

console.log("\n########## 12/18  FRESH INSTALL CHAIN ##########");
runSuite("fresh install", path.join(REPO, "harness", "fresh-install.mjs"));

console.log("\n########## 13/18  FIXTURE GENERATION IS ONE TRANSACTION (R-05) ##########");
runSuite("fixture transaction", path.join(REPO, "harness", "fixture-transaction.mjs"));

// Own throwaway DB + server: creates one career of each difficulty in the
// same session and diffs their starting budget, ranking points and squad —
// there is no "correct number" to check against (the design doc gives none),
// only that the two starts are actually different.
console.log("\n########## 14/18  CAREER DIFFICULTY (R-11) ##########");
runSuite("career difficulty", path.join(REPO, "harness", "career-difficulty.mjs"));

// Own throwaway DB + server, same reasoning as fixture-transaction.mjs: the
// ladder's stage boundaries are read-time arithmetic, so direct-DB sabotage
// (not RNG-driven match simulation) is what actually proves each boundary.
console.log("\n########## 15/18  BOARD CONFIDENCE ESCALATION LADDER (R-09) ##########");
runSuite("board confidence ladder", path.join(REPO, "harness", "board-confidence-ladder.mjs"));

// R-29: two careers, a dozen real World Tour rounds each, every AI result and
// ranking point reconciled against its fixtures, plus sabotaged copies the
// checks must fail on. Own DB and server.
console.log("\n########## 16/18  WORLD TOUR COMPETITORS (R-29) ##########");
runSuite("world tour competitors", path.join(REPO, "harness", "world-tour-competitors.mjs"));

// ── Smoke needs a server; boot one on a throwaway copy of the shipped DB ─────
console.log("\n########## 17/18  GAMEPLAY SMOKE ##########");
{
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-smoke-"));
  const db = path.join(work, "smoke.sqlite");
  fs.copyFileSync(SHIPPED, db);
  const port = 4455;
  const logFile = path.join(work, "server.log");
  const out = fs.openSync(logFile, "w");
  const child = forkServer({
    server: SERVER,
    electron: ELECTRON,
    out,
    env: {
      ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: db, PORT: String(port),
      NODE_ENV: "development", SESSION_SECRET: "harness-smoke-secret",
    },
  });

  const started = Date.now();
  let up = false;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try { await fetch(`http://localhost:${port}/api/health`); up = true; break; }
    catch { await new Promise((r) => setTimeout(r, 250)); }
  }

  if (!up) {
    console.error("[harness] smoke server never came up");
    console.error(fs.readFileSync(logFile, "utf8").slice(-2000));
    results.push({ name: "gameplay smoke", ok: false, secs: "-" });
  } else {
    const r = spawnSync(
      process.execPath,
      [path.join(REPO, "harness", "smoke.mjs"), `http://localhost:${port}`],
      { stdio: "inherit", cwd: REPO },
    );
    results.push({
      name: "gameplay smoke", ok: r.status === 0,
      secs: ((Date.now() - started) / 1000).toFixed(1),
    });

    // Rollover reuses the same server: it walks a fresh career through all five
    // season boundaries, which is slow but is the only way to prove the arc
    // actually completes rather than compiling.
    console.log("\n########## 18/18  SEASON ROLLOVER ##########");
    const rollStart = Date.now();
    const rr = spawnSync(
      process.execPath,
      [path.join(REPO, "harness", "rollover.mjs"), `http://localhost:${port}`],
      { stdio: "inherit", cwd: REPO },
    );
    results.push({
      name: "season rollover", ok: rr.status === 0,
      secs: ((Date.now() - rollStart) / 1000).toFixed(1),
    });
  }

  // R-36: quit through R-31's shutdown path rather than SIGKILL, so the
  // database is left checkpointed with no -wal sidecar. The settle sleep
  // that used to follow the kill was only covering for that.
  await stopServer(child);
  try { fs.closeSync(out); } catch {}
  try { fs.rmSync(work, { recursive: true, force: true }); } catch {}
}

// ── Summary ─────────────────────────────────────────────────────────────────
const bar = "=".repeat(72);
console.log("\n" + bar);
for (const r of results) {
  console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(24)} ${r.secs}s`);
}
const failed = results.filter((r) => !r.ok);
console.log(bar);
if (failed.length > 0) {
  console.log(`  HARNESS FAILED: ${failed.map((f) => f.name).join(", ")}`);
  console.log(bar);
  process.exit(1);
}
console.log("  ALL HARNESSES PASSED");
console.log(bar);
