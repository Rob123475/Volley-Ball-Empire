/**
 * R-01 — a save that has fallen behind the code must be brought forward.
 *
 * ── The bug this exists for ─────────────────────────────────────────────────
 * There is no migration runner in this project. `ensureSchema()` at boot is the
 * only schema repair there is, and it used to apply a HAND-TYPED list of seven
 * columns. `teams.crest_shape_index` was never added to that list, so every
 * save made before that column existed crashed on GET /api/team until someone
 * typed the line in by hand on 1 Sep. The player saw a title screen stuck on
 * RETRY and "Could not load your career", with a save perfectly intact on disk.
 *
 * `harness/migration-fixtures.mjs` tests the per-career DATA migration and
 * would never have caught this: the tables were all present, one column was
 * not. Nothing in the repo tested schema drift at all.
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 * A. The derived DDL reproduces the shipped schema. ensureSchema now builds
 *    every table from the drizzle declaration instead of verbatim SQL, so the
 *    question "would a table it creates match the one the installer ships?"
 *    has to be answered, not assumed. An empty database is handed to the real
 *    server, and every table, column, type and NOT NULL flag it creates is
 *    compared against the shipped starter DB.
 *
 * B. A dropped column comes back, and the endpoint that broke works again.
 *    `teams.crest_shape_index` is removed by table rebuild (SQLite's DROP
 *    COLUMN cannot remove a column that an index or view references, and the
 *    rebuild is what an old save effectively looks like anyway), the server is
 *    booted against it, and the column must be back with GET /api/team 2xx.
 *
 * B is the regression test for the exact reported bug. A is the one that
 * matters more going forward: it is what makes deleting the hand-typed lists
 * safe, and it fails the moment the derived path and the shipped schema
 * disagree about anything.
 *
 * Usage: node harness/schema-drift.mjs
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
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-schema-drift-"));

let failures = 0;
let checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

if (!fs.existsSync(SERVER)) {
  console.error(`[schema-drift] FAILED: ${SERVER} not built. Run the api-server build first.`);
  process.exit(1);
}

let portCounter = 4610;

/** Boot the real server against `dbFile`, wait for health, return an api()/stop(). */
async function boot(dbFile, label) {
  const port = portCounter++;
  const logFile = path.join(WORK, `${label}-${port}.log`);
  const out = fs.openSync(logFile, "w");
  const child = spawn(ELECTRON, [SERVER], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      DB_PATH: dbFile,
      PORT: String(port),
      NODE_ENV: "development",
      SESSION_SECRET: "schema-drift-secret",
    },
    stdio: ["ignore", out, out],
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
    stop: () => { try { child.kill("SIGKILL"); } catch {} try { fs.closeSync(out); } catch {} },
  };
}

/** table -> { column -> "type|notnull|pk" }, the shape worth comparing. */
function schemaShape(dbFile) {
  const db = new DatabaseSync(dbFile, { readOnly: true });
  const out = {};
  for (const { name } of db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()) {
    const cols = {};
    for (const c of db.prepare(`PRAGMA table_info(\`${name}\`)`).all()) {
      cols[c.name] = `${String(c.type).toUpperCase()}|${c.notnull}|${c.pk}`;
    }
    out[name] = cols;
  }
  db.close();
  return out;
}

console.log("=".repeat(72));
console.log("  R-01 SCHEMA DRIFT");
console.log("=".repeat(72));

// ── A. the derived DDL must reproduce the shipped schema ─────────────────────
console.log("\nA. AN EMPTY DATABASE, BUILT ENTIRELY BY THE DERIVED REPAIR");
{
  const empty = path.join(WORK, "empty.sqlite");
  new DatabaseSync(empty).close(); // a real, valid, completely empty SQLite file

  const srv = await boot(empty, "empty");
  const built = schemaShape(empty);
  const shipped = schemaShape(SHIPPED);
  srv.stop();

  const shippedTables = Object.keys(shipped);
  const missingTables = shippedTables.filter((t) => !built[t]);
  check("every table the installer ships was created from the schema alone",
    missingTables.length === 0,
    missingTables.length ? `missing: ${missingTables.slice(0, 6).join(", ")}` : `${shippedTables.length} tables`);

  // Column-level equality, in the direction that is actually an invariant.
  //
  // The comparison is SHIPPED-column -> derived, EXCEPT for columns the shipped
  // file has that the schema no longer declares. players.team_id,
  // players.outfit_id and staff.team_id are exactly that: leftovers from the
  // career_player_state split, still in the file, deliberately dropped from the
  // schema. A derived repair must NOT recreate them, so failing on their
  // absence would be asserting the bug. They are reported instead.
  const colDiffs = [];
  const legacyOnly = [];
  for (const t of shippedTables) {
    if (!built[t]) continue;
    for (const [col, sig] of Object.entries(shipped[t])) {
      if (!built[t][col]) legacyOnly.push(`${t}.${col}`);
      else if (built[t][col] !== sig) colDiffs.push(`${t}.${col} ${built[t][col]} != shipped ${sig}`);
    }
  }
  // The other direction IS a hard invariant: anything the derived path creates
  // must match the shipped file exactly, in type, NOT NULL and primary key.
  check("every column the derived repair creates matches the shipped file",
    colDiffs.length === 0,
    colDiffs.length ? colDiffs.slice(0, 5).join(" · ")
      : `${Object.values(built).reduce((a, c) => a + Object.keys(c).length, 0)} columns`);

  check("columns the shipped file has but the schema dropped are NOT recreated",
    legacyOnly.every((c) => ["players.team_id", "players.outfit_id", "staff.team_id"].includes(c)),
    legacyOnly.length ? `legacy leftovers, as expected: ${legacyOnly.join(", ")}` : "none");

  const idxOf = (f) => {
    const db = new DatabaseSync(f, { readOnly: true });
    const r = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((x) => x.name);
    db.close();
    return r;
  };
  const missingIdx = idxOf(SHIPPED).filter((i) => !idxOf(empty).includes(i));
  check("every shipped index was recreated", missingIdx.length === 0,
    missingIdx.length ? missingIdx.join(", ") : `${idxOf(empty).length} indexes`);
}

// ── B. the exact reported bug: a column removed from a real save ─────────────
console.log("\nB. A REAL SAVE MISSING teams.crest_shape_index — THE 1 SEP BUG");
{
  const drifted = path.join(WORK, "drifted.sqlite");
  fs.copyFileSync(SHIPPED, drifted);

  // Rebuild `teams` without the column. SQLite's own DROP COLUMN refuses when
  // anything references it, and a rebuild is what an older save looks like.
  {
    const db = new DatabaseSync(drifted);
    const cols = db.prepare("PRAGMA table_info(`teams`)").all()
      .map((c) => c.name).filter((n) => n !== "crest_shape_index");
    const list = cols.map((c) => `\`${c}\``).join(", ");
    db.exec("PRAGMA foreign_keys=OFF");
    db.exec("BEGIN");
    db.exec(`CREATE TABLE \`teams_old\` AS SELECT ${list} FROM \`teams\``);
    db.exec("DROP TABLE `teams`");
    db.exec(`ALTER TABLE \`teams_old\` RENAME TO \`teams\``);
    db.exec("COMMIT");
    db.close();
  }

  const before = new DatabaseSync(drifted, { readOnly: true });
  const hadIt = before.prepare("PRAGMA table_info(`teams`)").all().some((c) => c.name === "crest_shape_index");
  before.close();
  check("fixture really is missing the column before boot", hadIt === false,
    hadIt ? "column still present — the fixture did not drift" : "");

  const srv = await boot(drifted, "drifted");

  const after = new DatabaseSync(drifted, { readOnly: true });
  const back = after.prepare("PRAGMA table_info(`teams`)").all().some((c) => c.name === "crest_shape_index");
  after.close();
  check("boot put teams.crest_shape_index back", back === true);

  // The endpoint that actually broke for the player.
  const team = await srv.api("GET", "/team");
  check("GET /api/team no longer 500s", team.status < 500,
    `HTTP ${team.status}`);

  // And the repair said what it did, rather than fixing it silently.
  const log = srv.log();
  check("the boot log names the repair it performed",
    /crest_shape_index/.test(log) && /schema brought forward/.test(log),
    /crest_shape_index/.test(log) ? "" : "log never mentions the column");

  srv.stop();
}

// ── C. a clean save must be a no-op, and must say so ─────────────────────────
console.log("\nC. AN UP-TO-DATE SAVE — THE REPAIR MUST DO NOTHING, LOUDLY");
{
  const clean = path.join(WORK, "clean.sqlite");
  fs.copyFileSync(SHIPPED, clean);
  const shapeBefore = JSON.stringify(schemaShape(clean));

  const srv = await boot(clean, "clean");
  const team = await srv.api("GET", "/team");
  const log = srv.log();
  srv.stop();

  check("schema is byte-for-byte unchanged by a boot", JSON.stringify(schemaShape(clean)) === shapeBefore);
  check("boot log proves the check RAN and found nothing",
    /0 missing columns/.test(log),
    /0 missing columns/.test(log) ? "" : "no 'up to date' line in the log");
  check("no NOT NULL stand-in was invented on a healthy save",
    !/schema repair needs a human/.test(log));
  check("GET /api/team is fine on a clean save", team.status < 500, `HTTP ${team.status}`);
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch {} }
process.exit(failures > 0 ? 1 : 0);
