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
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { requireElectronBinary } from "./electron-binary.mjs";

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
console.log("\n########## 1/6  GUARD SELF-TEST ##########");
runSuite("guard self-test", path.join(REPO, "harness", "guard-selftest.mjs"));

// Schema drift runs before the data migrations, for the same reason
// ensureSchema runs before them at boot: every migration below assumes its
// columns exist. A save that has fallen behind the code fails here first, with
// the column named, rather than three suites later as a confusing data error.
console.log("\n########## 2/6  SCHEMA DRIFT (R-01) ##########");
runSuite("schema drift", path.join(REPO, "harness", "schema-drift.mjs"));

console.log("\n########## 3/6  MIGRATION FIXTURES ##########");
runSuite("migration fixtures", path.join(REPO, "harness", "migration-fixtures.mjs"));

console.log("\n########## 4/6  FRESH INSTALL CHAIN ##########");
runSuite("fresh install", path.join(REPO, "harness", "fresh-install.mjs"));

// ── Smoke needs a server; boot one on a throwaway copy of the shipped DB ─────
console.log("\n########## 5/6  GAMEPLAY SMOKE ##########");
{
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-smoke-"));
  const db = path.join(work, "smoke.sqlite");
  fs.copyFileSync(SHIPPED, db);
  const port = 4455;
  const logFile = path.join(work, "server.log");
  const out = fs.openSync(logFile, "w");
  const child = spawn(ELECTRON, [SERVER], {
    env: {
      ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: db, PORT: String(port),
      NODE_ENV: "development", SESSION_SECRET: "harness-smoke-secret",
    },
    stdio: ["ignore", out, out],
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
    console.log("\n########## 6/6  SEASON ROLLOVER ##########");
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

  try { child.kill("SIGKILL"); } catch {}
  await new Promise((r) => setTimeout(r, 600));
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
