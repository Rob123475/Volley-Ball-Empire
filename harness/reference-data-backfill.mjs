/**
 * R-28 — a save's reference data can fall behind the shipped starter DB too.
 *
 * ── The bug this exists for ─────────────────────────────────────────────────
 * R-01's boot repair (ensureSchema.ts) derives every TABLE, COLUMN and INDEX
 * a save should have from the drizzle schema — but row data isn't part of a
 * schema declaration at all, so it has no notion of a reference table simply
 * being short some ROWS. The live save's `locations` table had only 8 rows
 * (ids 1-8); the shipped starter DB has 11 — venues 9-11 were added to the
 * starter DB at some point and nothing ever backfilled that into a save that
 * already existed. World Tour fixture generation (ensureSeasonFixture, called
 * eagerly from POST /careers as of R-26) picks from the full location pool,
 * so on a save actually missing those rows, career creation 500s the moment
 * fixture generation tries to insert a match referencing one of them — a bare
 * FOREIGN KEY constraint failed, on code that was never wrong: checked
 * against the shipped DB, which has all 11.
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 * A. Reference rows present in the starter DB but missing from a save are
 *    inserted at boot (locations 9-11 deleted from a copy, then restored),
 *    and the boot log names what it did.
 * B. The endpoint that actually broke — POST /careers — works again on that
 *    same save, in the same boot, once the backfill has run.
 * C. Additive only: an EXISTING row (id 1) must be byte-for-byte untouched —
 *    this is an insert-missing-rows repair, never an update-existing-rows one.
 * D. Without STARTER_DB_PATH set (no harness suite other than this one sets
 *    it, and neither does a bare `node dist/index.mjs`), the backfill is a
 *    logged no-op, not a crash — the same "absence isn't an error" contract
 *    R-01's ensureSchema() already has for a save with nothing to repair.
 *
 * Usage: node harness/reference-data-backfill.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-ref-backfill-"));

let failures = 0;
let checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

if (!fs.existsSync(SERVER)) {
  console.error(`[reference-data-backfill] FAILED: ${SERVER} not built. Run the api-server build first.`);
  process.exit(1);
}

let portCounter = 4630;

/** Boot the real server against `dbFile`, wait for health, return an api()/stop(). */
async function boot(dbFile, label, extraEnv = {}) {
  const port = portCounter++;
  const logFile = path.join(WORK, `${label}-${port}.log`);
  const out = fs.openSync(logFile, "w");
  const child = forkServer({
    server: SERVER,
    electron: ELECTRON,
    out,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      DB_PATH: dbFile,
      PORT: String(port),
      NODE_ENV: "development",
      SESSION_SECRET: "ref-backfill-secret",
      ...extraEnv,
    },
  });

  const base = `http://localhost:${port}/api`;
  let cookie = "";
  const api = async (method, p, body) => {
    const res = await fetch(base + p, {
      method,
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const sc = res.headers.get("set-cookie");
    if (sc) cookie = sc.split(";")[0];
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data };
  };

  const deadline = Date.now() + 25000;
  for (;;) {
    if (Date.now() > deadline) {
      const log = fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8").slice(-1500) : "";
      throw new Error(`${label} server never came up\n${log}`);
    }
    try { await fetch(`${base}/health`); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  return {
    api,
    log: () => (fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8") : ""),
    // R-36: quit through R-31's shutdown path so the WAL is checkpointed
    // back into the main file. A SIGKILL here left an un-checkpointed -wal,
    // and the readOnly DatabaseSync reads below then failed outright with
    // "disk I/O error" — a read-only connection cannot build the -shm index
    // a WAL replay needs.
    stop: async () => {
      await stopServer(child);
      try { fs.closeSync(out); } catch { /* already closed */ }
    },
  };
}

console.log("=".repeat(72));
console.log("  R-28 REFERENCE DATA BACKFILL AT BOOT");
console.log("=".repeat(72));

// ── A/B/C. a save missing locations 9-11 gets them back, and career creation works ──
console.log("\nA/B/C. A SAVE MISSING LOCATIONS 9-11 — THE ROOT CAUSE OF THE LIVE-SAVE 500s");
{
  const dbFile = path.join(WORK, "missing-locations.sqlite");
  fs.copyFileSync(SHIPPED, dbFile);

  const rowBefore = (() => {
    const db = new DatabaseSync(SHIPPED, { readOnly: true });
    const row = db.prepare("SELECT * FROM locations WHERE id = 1").get();
    db.close();
    return row;
  })();

  {
    const db = new DatabaseSync(dbFile);
    db.exec("DELETE FROM locations WHERE id IN (9, 10, 11)");
    db.close();
  }

  const before = new DatabaseSync(dbFile, { readOnly: true });
  const idsBefore = before.prepare("SELECT id FROM locations ORDER BY id").all().map((r) => r.id);
  before.close();
  check("fixture really is missing locations 9-11 before boot",
    !idsBefore.includes(9) && !idsBefore.includes(10) && !idsBefore.includes(11),
    `ids: ${idsBefore.join(",")}`);

  const srv = await boot(dbFile, "missing-locations", { STARTER_DB_PATH: SHIPPED });

  const after = new DatabaseSync(dbFile, { readOnly: true });
  const idsAfter = after.prepare("SELECT id FROM locations ORDER BY id").all().map((r) => r.id);
  const rowAfter = after.prepare("SELECT * FROM locations WHERE id = 1").get();
  after.close();
  check("boot put locations 9, 10 and 11 back",
    [9, 10, 11].every((id) => idsAfter.includes(id)), `ids: ${idsAfter.join(",")}`);

  const log = srv.log();
  check("the boot log names the backfill and each id it inserted",
    /reference data backfilled/.test(log) && /9/.test(log) && /10/.test(log) && /11/.test(log),
    /reference data backfilled/.test(log) ? "" : "log never mentions the backfill");

  check("an existing row (locations id 1) is byte-for-byte untouched — additive only",
    JSON.stringify(rowAfter) === JSON.stringify(rowBefore),
    JSON.stringify(rowAfter) !== JSON.stringify(rowBefore) ? "row 1 changed — this must never UPDATE" : "");

  // The endpoint that actually broke for the player: career creation, which
  // eagerly generates the season fixture (R-26) and can reference any of the
  // 11 locations, including the 3 that were just missing.
  const profileRes = await srv.api("POST", "/profiles", { name: "RefBackfill" });
  await srv.api("POST", `/profiles/${profileRes.data.id}/select`);
  const careerRes = await srv.api("POST", "/careers", {
    slotNumber: 1, managerName: "RefBackfill", managerNationality: "Australia",
    clubName: "RefBackfill FC", originalClubName: "RefBackfill FC", season: "Season 1",
    budget: "500000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a",
  });
  check("POST /careers succeeds once the missing locations are backfilled",
    careerRes.status >= 200 && careerRes.status < 300, `HTTP ${careerRes.status} ${JSON.stringify(careerRes.data).slice(0, 200)}`);

  await srv.stop();
}

// ── D. STARTER_DB_PATH unset — no starter DB to compare against, no crash ────
console.log("\nD. STARTER_DB_PATH NOT SET — MUST NO-OP, NOT CRASH");
{
  const dbFile = path.join(WORK, "no-starter-path.sqlite");
  fs.copyFileSync(SHIPPED, dbFile);
  {
    const db = new DatabaseSync(dbFile);
    db.exec("DELETE FROM locations WHERE id IN (9, 10, 11)");
    db.close();
  }

  const srv = await boot(dbFile, "no-starter-path"); // no STARTER_DB_PATH in extraEnv
  const health = await srv.api("GET", "/healthz");
  const log = srv.log();
  await srv.stop();

  check("server still boots cleanly with no STARTER_DB_PATH", health.status === 200, `HTTP ${health.status}`);
  check("the boot log says the backfill was skipped, not silent",
    /reference data backfill skipped/.test(log), log.includes("reference data") ? "" : "no reference-data line in the log at all");

  const after = new DatabaseSync(dbFile, { readOnly: true });
  const idsAfter = after.prepare("SELECT id FROM locations ORDER BY id").all().map((r) => r.id);
  after.close();
  check("locations 9-11 are still missing — nothing to compare against, nothing invented",
    !idsAfter.includes(9) && !idsAfter.includes(10) && !idsAfter.includes(11), `ids: ${idsAfter.join(",")}`);
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch {} }
process.exit(failures > 0 ? 1 : 0);
