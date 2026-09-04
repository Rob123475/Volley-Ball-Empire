/**
 * R-05 — fixture generation must be one transaction.
 *
 * ── The bug this exists for ─────────────────────────────────────────────────
 * `GET /matches/fixture` builds a new career's season the first time it's
 * requested: up to ~62 sequential `await db.insert(matchesTable)` calls (one
 * per World Tour round, plus the World Finals), with no transaction around
 * them. A failure partway through (a disk error, a constraint violation, the
 * process dying) left a half-built season on disk — some rounds scheduled,
 * the rest silently missing — with no error surfaced to the player and no way
 * to tell a half-built season from a complete one short of counting rows.
 *
 * The fix wraps the whole sequence in one `db.transaction(...)`, so a failure
 * anywhere in it rolls back everything the transaction attempted, not just
 * the one row that failed.
 *
 * ── How the failure is forced ───────────────────────────────────────────────
 * There is no clean way to make a single INSERT fail from outside the app:
 * `career_saves`-style FK columns declared in the schema are never actually
 * enforced by this project's better-sqlite3 connection (`PRAGMA foreign_keys`
 * is never turned on — confirmed empirically: inserting a match with a
 * deleted location's id succeeds silently), and `matches.id` is a real
 * SQLite AUTOINCREMENT column, so a row pre-inserted at some id never
 * collides with a later auto-assigned one.
 *
 * A SQL trigger does the job cleanly and portably: `BEFORE INSERT ON matches
 * WHEN NEW.round = 41` raises ABORT, which better-sqlite3 surfaces as a
 * thrown SqliteError inside the transaction callback — exactly the shape of
 * failure ("one insert fails") the register asks for, without touching
 * production code or relying on a pragma this project doesn't set. Round 41
 * lands around the 31st insert of ~62 (roughly the middle of the sequence),
 * so several inserts must have already "succeeded" inside the transaction
 * before the failure — the case that actually distinguishes a transaction
 * from sequential awaits.
 *
 * Confirmed against the OLD (un-transacted) code before this fix: the same
 * trigger left 30 orphaned rows behind. Against the fix: 0.
 *
 * Usage: node harness/fixture-transaction.mjs
 */
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { requireElectronBinary } from "./electron-binary.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-fixture-tx-"));
const PORT = 4620;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

if (!fs.existsSync(SERVER)) {
  console.error(`[fixture-transaction] FAILED: ${SERVER} not built. Run the api-server build first.`);
  process.exit(1);
}

console.log("=".repeat(72));
console.log("  R-05 FIXTURE GENERATION IS ONE TRANSACTION");
console.log("=".repeat(72));

const dbFile = path.join(WORK, "fixture-tx.sqlite");
fs.copyFileSync(SHIPPED, dbFile);

// A trigger that aborts the insert for a round comfortably inside the
// sequence (round 41 of the ~62-round season, ~31st insert), so the
// transaction must roll back inserts that already "succeeded" this run.
{
  const db = new DatabaseSync(dbFile);
  db.exec(`
    CREATE TRIGGER matches_harness_sabotage
    BEFORE INSERT ON matches
    WHEN NEW.round = 41
    BEGIN
      SELECT RAISE(ABORT, 'harness: forced mid-sequence failure');
    END;
  `);
  db.close();
}

const logFile = path.join(WORK, "server.log");
const out = fs.openSync(logFile, "w");
const child = spawn(ELECTRON, [SERVER], {
  env: {
    ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT),
    NODE_ENV: "development", SESSION_SECRET: "fixture-tx-secret",
  },
  stdio: ["ignore", out, out],
});

const base = `http://localhost:${PORT}/api`;
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
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
};

const deadline = Date.now() + 25000;
let up = false;
while (Date.now() < deadline) {
  try { await fetch(`${base}/health`); up = true; break; }
  catch { await new Promise((r) => setTimeout(r, 250)); }
}
if (!up) {
  console.error("[fixture-transaction] server never came up");
  console.error(fs.readFileSync(logFile, "utf8").slice(-2000));
  process.exit(1);
}

try {
  const profileRes = await api("POST", "/profiles", { name: "FixtureTx" });
  await api("POST", `/profiles/${profileRes.data.id}/select`);
  const careerRes = await api("POST", "/careers", {
    slotNumber: 1, managerName: "FixtureTx", managerNationality: "Australia",
    clubName: "FixtureTx FC", originalClubName: "FixtureTx FC", season: "Season 1",
    budget: "500000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a",
  });
  check("career created", careerRes.status < 300, `HTTP ${careerRes.status}`);
  const teamId = careerRes.data?.teamId;

  const fixtureRes = await api("GET", "/matches/fixture");
  check("the sabotaged fixture request fails, not succeeds",
    fixtureRes.status >= 500, `HTTP ${fixtureRes.status}`);

  child.kill("SIGKILL");
  await new Promise((r) => setTimeout(r, 600));

  const db = new DatabaseSync(dbFile, { readOnly: true });
  const { n } = db.prepare(
    "SELECT COUNT(*) as n FROM matches WHERE home_team_id = ?",
  ).get(teamId);
  db.close();

  check("zero fixture rows remain after the mid-sequence failure", n === 0, `${n} rows`);
} finally {
  try { child.kill("SIGKILL"); } catch {}
  await new Promise((r) => setTimeout(r, 300));
  try { fs.closeSync(out); } catch {}
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch {} }
process.exit(failures > 0 ? 1 : 0);
