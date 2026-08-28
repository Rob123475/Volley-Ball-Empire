/**
 * Boot-migration fixture tests.
 *
 * dropMovedColumns() mutates schema on databases we will never see, on players'
 * machines, before the game window appears. A single happy-path run against one
 * copy is not evidence. This boots the REAL server binary against deliberately
 * damaged and out-of-date databases and asserts on what actually happens —
 * including that a failure degrades into a running game rather than a black
 * window.
 *
 * Nothing here re-implements the migration. Every case runs the shipped bundle.
 *
 * Usage: node harness/migration-fixtures.mjs
 * Exits non-zero on any failed assertion.
 */
import { DatabaseSync } from "node:sqlite";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = path.join(REPO, "node_modules", "electron", "dist", "electron.exe");
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-migration-"));

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

// ── fixture construction ─────────────────────────────────────────────────────

/** Columns the split moved off `players`, with the types they had before it. */
const OLD_PLAYER_COLUMNS = [
  ["team_id", "INTEGER"],
  ["squad_role", "TEXT NOT NULL DEFAULT 'reserve'"],
  ["is_active", "INTEGER NOT NULL DEFAULT 1"],
  ["salary", "REAL NOT NULL DEFAULT 5000"],
  ["contract_end_date", "TEXT"],
  ["academy_contract_years", "REAL"],
  ["fitness", "INTEGER NOT NULL DEFAULT 100"],
  ["fatigue", "INTEGER NOT NULL DEFAULT 0"],
  ["morale", "INTEGER NOT NULL DEFAULT 80"],
  ["injury_status", "TEXT NOT NULL DEFAULT 'Healthy'"],
  ["injury_weeks_remaining", "INTEGER NOT NULL DEFAULT 0"],
  ["is_injured", "INTEGER NOT NULL DEFAULT 0"],
  ["consecutive_matches_played", "INTEGER NOT NULL DEFAULT 0"],
  ["doctor_quality", "INTEGER NOT NULL DEFAULT 3"],
  ["training_points", "INTEGER NOT NULL DEFAULT 0"],
  ["training_focus", "TEXT"],
  ["focus_xp", "INTEGER NOT NULL DEFAULT 0"],
  ["scouted_potential", "TEXT"],
  ["discovered_by", "TEXT"],
];

function copyShipped(name) {
  const file = path.join(WORK, `${name}.sqlite`);
  fs.copyFileSync(SHIPPED, file);
  for (const suffix of ["-wal", "-shm"]) {
    const s = SHIPPED + suffix;
    if (fs.existsSync(s)) fs.rmSync(s.replace(SHIPPED, file), { force: true });
  }
  return file;
}

/**
 * A save with a career someone has actually played.
 *
 * The shipped database is pristine — no users, no teams, no careers — so every
 * fixture built straight from it exercises the migration against nothing and
 * passes vacuously. The career here is created through the REAL API rather than
 * hand-written INSERTs, so it matches the schema by construction instead of by
 * my guess at it. (The first version of this guessed, and guessed wrong:
 * career_saves has manager_name/club_name/slot_number, not name.)
 */
let PLAYED_SAVE = null;

async function buildPlayedSave() {
  if (PLAYED_SAVE) return PLAYED_SAVE;
  const file = copyShipped("played-base");
  const port = portCounter++;
  const logFile = path.join(WORK, `seed-${port}.log`);
  const out = fs.openSync(logFile, "w");
  const child = spawn(ELECTRON, [SERVER], {
    env: {
      ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: file,
      PORT: String(port), NODE_ENV: "development",
      SESSION_SECRET: "migration-fixture-secret",
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
    let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data };
  };

  const deadline = Date.now() + 25000;
  for (;;) {
    if (Date.now() > deadline) throw new Error("seed server never came up");
    try { await fetch(`${base}/health`); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }

  const prof = await api("POST", "/profiles", { name: "FixtureMgr" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const car = await api("POST", "/careers", {
    slotNumber: 1, managerName: "FixtureMgr", managerNationality: "Australia",
    clubName: "Fixture FC", originalClubName: "Fixture FC", season: "Season 1",
    budget: "500000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a",
  });
  if (car.status >= 400) throw new Error(`career creation failed: ${JSON.stringify(car.data)}`);

  // Sign someone, so the save has state worth losing.
  const mk = await api("GET", "/players/market-all?playerType=senior");
  const all = Array.isArray(mk.data) ? mk.data : (mk.data?.players ?? []);
  const target = all.filter((p) => !p.teamId && !p.currentTeamId)[0];
  if (target) {
    await api("POST", "/contracts", {
      playerId: target.id, salary: target.salary ?? 8000,
      endDate: "2026-12-31", bonusPerWin: 0, squadRole: "starter",
    });
  }

  child.kill("SIGKILL");
  await new Promise((r) => setTimeout(r, 600));
  fs.closeSync(out);

  const chk = new DatabaseSync(file);
  chk.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  const careers = chk.prepare("SELECT COUNT(*) n FROM career_saves").get().n;
  const signed = chk.prepare("SELECT COUNT(*) n FROM career_player_state WHERE team_id IS NOT NULL").get().n;
  chk.close();
  if (careers === 0) throw new Error("played save has no career — fixture is vacuous");
  console.log(`  built played save: ${careers} career(s), ${signed} signed player(s)\n`);

  PLAYED_SAVE = file;
  return file;
}

function copyPlayed(name) {
  const file = path.join(WORK, `${name}.sqlite`);
  fs.copyFileSync(PLAYED_SAVE, file);
  return file;
}

const cols = (db, t) => db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);

/**
 * Rebuild the pre-split schema: every moved column back on `players`, carrying
 * plausible data, and no career-state tables at all. This is what a save from
 * before any of this work looks like.
 */
function makePreSplit(name) {
  const file = copyPlayed(name);
  const db = new DatabaseSync(file);
  const have = cols(db, "players");
  for (const [col, decl] of OLD_PLAYER_COLUMNS) {
    if (!have.includes(col)) db.exec(`ALTER TABLE players ADD COLUMN ${col} ${decl}`);
  }
  // Give the columns real values so a lossy migration would be visible, and
  // put the signed squad back on the reference row the way a pre-split save
  // held it — that is the data the snapshot has to carry across.
  db.exec(`UPDATE players SET salary = COALESCE(asking_price, 60000) / 12`);
  db.exec(`UPDATE players SET morale = 77, fatigue = 12, fitness = 88`);
  db.exec(`UPDATE players SET team_id = (
             SELECT team_id FROM career_player_state s
             WHERE s.player_id = players.id AND s.team_id IS NOT NULL LIMIT 1)`);
  db.exec(`UPDATE players SET squad_role = 'starter' WHERE team_id IS NOT NULL`);
  // A pre-split save has no per-career state tables whatsoever.
  db.exec(`DROP TABLE IF EXISTS career_player_state`);
  db.exec(`DROP TABLE IF EXISTS career_staff_state`);
  db.close();
  return file;
}

/**
 * A save with a career that genuinely has no player state AND no way to build
 * it — the state the drop guard exists to refuse.
 *
 * The first version of this just deleted the state rows, but with the legacy
 * columns restored the snapshot simply rebuilt them and the drop then ran
 * legitimately. That is correct behaviour and made the fixture prove nothing.
 *
 * This is a half-migrated save, which is a real historical state: `team_id`
 * already dropped from `players` (so the snapshot's legacy-players branch is
 * off and cannot rebuild the rows) while `salary` is still there waiting to go.
 * A career with no state in that window must stop the drop.
 */
function makeCareerWithoutState(name) {
  const file = copyPlayed(name);
  const db = new DatabaseSync(file);
  for (const [col, decl] of OLD_PLAYER_COLUMNS) {
    // squad_role is the sentinel migrateCareerStateOnce keys its "is this save
    // pre-split?" check on — it was team_id until team_id turned out to be
    // FK-bound and undroppable. Leaving it out is what makes the snapshot
    // decline to rebuild, which is the state this fixture is for.
    if (col === "squad_role") continue;
    if (!cols(db, "players").includes(col)) {
      db.exec(`ALTER TABLE players ADD COLUMN ${col} ${decl}`);
    }
  }
  db.exec(`DELETE FROM career_player_state`);
  const careers = db.prepare("SELECT COUNT(*) n FROM career_saves").get().n;
  const state = db.prepare("SELECT COUNT(*) n FROM career_player_state").get().n;
  const hasSalary = cols(db, "players").includes("salary");
  const hasSquadRole = cols(db, "players").includes("squad_role");
  db.close();
  if (careers === 0 || state !== 0 || !hasSalary || hasSquadRole) {
    throw new Error(
      `fixture invalid: ${careers} careers, ${state} state, salary=${hasSalary}, squad_role=${hasSquadRole}`);
  }
  return file;
}

// ── running the real server ──────────────────────────────────────────────────

let portCounter = 4310;

function bootServer(dbFile, { killAfterMs = null } = {}) {
  const port = portCounter++;
  const logFile = path.join(WORK, `boot-${port}.log`);
  const out = fs.openSync(logFile, "w");
  const child = spawn(ELECTRON, [SERVER], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      DB_PATH: dbFile,
      PORT: String(port),
      NODE_ENV: "development",
      SESSION_SECRET: "migration-fixture-secret",
    },
    stdio: ["ignore", out, out],
  });

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      // Read the log while the process is STILL RUNNING, then kill.
      //
      // pino writes through a worker thread, so killing first discards whatever
      // is still buffered. Windows has no graceful signal — child.kill("SIGTERM")
      // terminates as abruptly as SIGKILL — so waiting for a clean exit does not
      // help either. Both of those made "logged the drop" flaky, and neither had
      // anything to do with the migration. Let the live process flush, take the
      // log, and only then stop it.
      let last = -1, stableFor = 0;
      const settle = () => {
        let size = 0;
        try { size = fs.statSync(logFile).size; } catch {}
        if (size === last && size > 0) stableFor += 120; else { stableFor = 0; last = size; }
        if (stableFor >= 600) {
          let log = "";
          try { log = fs.readFileSync(logFile, "utf8"); } catch {}
          try { child.kill("SIGKILL"); } catch {}
          setTimeout(() => {
            try { fs.closeSync(out); } catch {}
            resolve({ ...result, log, port });
          }, 250);
        } else setTimeout(settle, 120);
      };
      settle();
    };

    if (killAfterMs !== null) {
      setTimeout(() => finish({ listening: false, killed: true }), killAfterMs);
      return;
    }

    const deadline = Date.now() + 25000;
    const poll = async () => {
      if (Date.now() > deadline) return finish({ listening: false, timedOut: true });
      try {
        await fetch(`http://localhost:${port}/api/health`);
        return finish({ listening: true });
      } catch {
        setTimeout(poll, 250);
      }
    };
    setTimeout(poll, 300);
  });
}

/**
 * Inspect a database file.
 *
 * "corrupt" and "does not have that table yet" are different outcomes and the
 * first version of this conflated them — a missing career_player_state made
 * every assertion report a corrupt save, which was wrong and hid the real
 * result. Each count is probed independently; -1 means the table is absent,
 * which is a legitimate state for an old save.
 */
const opens = (file) => {
  let db;
  try {
    db = new DatabaseSync(file, { readOnly: true });
  } catch (err) {
    return { ok: false, error: err.message, players: -1, state: -1 };
  }
  const count = (t) => {
    try { return db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n; }
    catch { return -1; }
  };
  let ok = false;
  try { ok = db.prepare("PRAGMA integrity_check").get().integrity_check === "ok"; }
  catch { ok = false; }
  const squadInState = (() => {
    try {
      return db.prepare("SELECT COUNT(*) n FROM career_player_state WHERE team_id IS NOT NULL").get().n;
    } catch { return -1; }
  })();
  const result = {
    ok, players: count("players"), state: count("career_player_state"), squadInState,
  };
  db.close();
  return result;
};

// ── cases ────────────────────────────────────────────────────────────────────

console.log(`\nworkdir ${WORK}\n`);

console.log("0. BUILD A PLAYED SAVE (through the real API)");
await buildPlayedSave();

// 1. A database from before any of this work.
console.log("1. PRE-SPLIT SAVE (oldest reconstructable schema)");
{
  const file = makePreSplit("pre-split");
  const squadBefore = (() => {
    const d = new DatabaseSync(file, { readOnly: true });
    const n = d.prepare("SELECT COUNT(*) n FROM players WHERE team_id IS NOT NULL").get().n;
    d.close(); return n;
  })();
  const before = opens(file);
  const r = await bootServer(file);
  const after = opens(file);
  check("server started", r.listening);
  check("database still opens", after.ok);
  check("no players lost", after.players === before.players, `${before.players} -> ${after.players}`);
  check("career state was created", after.state > 0, `${after.state} rows`);
  check("the signed squad survived the migration", after.squadInState === squadBefore,
    `${squadBefore} signed -> ${after.squadInState} in career state`);
  check("moved columns are gone", !new DatabaseSync(file, { readOnly: true })
    .prepare("PRAGMA table_info(players)").all().map((c) => c.name).includes("salary"));
  check("logged the drop", /moved columns dropped/.test(r.log));
  check("no unhandled error", !/career state migration failed/.test(r.log));
}

// 2. Running it again must change nothing.
console.log("\n2. ALREADY MIGRATED (second boot must be a clean no-op)");
{
  const file = makePreSplit("twice");
  await bootServer(file);
  const mid = opens(file);
  const r2 = await bootServer(file);
  const after = opens(file);
  check("second boot starts", r2.listening);
  check("no further drops logged", !/moved columns dropped/.test(r2.log));
  check("no snapshot re-taken", !/career state snapshot taken/.test(r2.log));
  check("state row count unchanged", mid.state === after.state, `${mid.state} -> ${after.state}`);
  check("player count unchanged", mid.players === after.players);
  check("no error on second boot", !/career state migration failed/.test(r2.log));
}

// 3. Killed mid-migration, at a spread of offsets, then booted again.
console.log("\n3. INTERRUPTED MID-MIGRATION (kill, then reboot)");
{
  const offsets = [150, 300, 450, 600, 900, 1400];
  let recovered = 0, corrupt = 0;
  for (const ms of offsets) {
    const file = makePreSplit(`interrupt-${ms}`);
    await bootServer(file, { killAfterMs: ms });
    const mid = opens(file);
    if (!mid.ok) { corrupt++; console.log(`    kill@${ms}ms: DB DID NOT OPEN`); continue; }
    const r = await bootServer(file);
    const after = opens(file);
    const good = r.listening && after.ok && after.players > 0;
    if (good) recovered++;
    console.log(`    kill@${ms}ms: reopened, boot ${r.listening ? "ok" : "FAILED"}, players ${after.players}, state ${after.state}`);
  }
  check("no interruption corrupted the save", corrupt === 0, `${corrupt}/${offsets.length} corrupt`);
  check("every interrupted save recovered on reboot", recovered === offsets.length,
    `${recovered}/${offsets.length}`);
}

// 4. A career with no state must block the drop, and must not block the game.
console.log("\n4. CAREER WITHOUT STATE (refuse to drop, still start)");
{
  const file = makeCareerWithoutState("no-state");
  const r = await bootServer(file);
  const after = opens(file);
  const names = new DatabaseSync(file, { readOnly: true })
    .prepare("PRAGMA table_info(players)").all().map((c) => c.name);
  check("server started anyway", r.listening);
  check("database still opens", after.ok);
  check("columns were NOT dropped", names.includes("salary"), "salary still present");
  check("no crash logged", !/career state migration failed/.test(r.log));
}

// 5. The failure path a player would actually hit.
console.log("\n5. MIGRATION THROWS (what the player sees)");
{
  const file = makePreSplit("hostile");
  const db = new DatabaseSync(file);
  // Genuinely unrepairable: career_player_state exists as a VIEW, so
  // ensureSchema's CREATE TABLE IF NOT EXISTS finds the name taken and skips
  // it, and every insert the snapshot attempts then fails. Stands in for the
  // schema state on someone else's machine that nobody predicted.
  db.exec(`DROP TABLE IF EXISTS career_player_state`);
  db.exec(`CREATE VIEW career_player_state AS SELECT id AS career_save_id, id AS player_id FROM players`);
  db.close();
  const r = await bootServer(file);
  check("server STILL listens after a migration failure", r.listening);
  check("failure was logged, not thrown to the window", /career state migration failed/.test(r.log));
  check("process did not exit", r.listening);
}

// 6. An old save that never had some of the columns the snapshot wants.
console.log("\n6. OLDER SCHEMA STILL MISSING NEWER COLUMNS");
{
  const file = makePreSplit("partial-schema");
  const db = new DatabaseSync(file);
  // Chunk 5 added five columns to the snapshot's SELECT and instantly broke
  // every save that predated them: one missing column threw and took the whole
  // snapshot with it, permanently. Drop a spread of them back out to keep that
  // from being reintroduced.
  for (const c of ["focus_xp", "discovered_by", "doctor_quality", "academy_contract_years"]) {
    try { db.exec(`ALTER TABLE players DROP COLUMN ${c}`); } catch { /* already gone */ }
  }
  const before = db.prepare("SELECT COUNT(*) n FROM players").get().n;
  db.close();

  const r = await bootServer(file);
  const after = opens(file);
  check("server started", r.listening);
  check("database still opens", after.ok);
  check("no players lost", after.players === before, `${before} -> ${after.players}`);
  check("snapshot ran despite the missing columns", after.state > 0, `${after.state} rows`);
  check("no unhandled error", !/career state migration failed/.test(r.log));
}

// 7. A save that predates the age -> base_age rename.
console.log("\n7. RENAMED COLUMN (age -> base_age)");
{
  const file = makePreSplit("age-rename");
  const db = new DatabaseSync(file);
  // Put the save back in the pre-rename shape: `age` present, `base_age` gone.
  // Unlike every other chunk this was a RENAME, so the value has nowhere to
  // land unless the migration creates the new column and copies it across
  // before dropping the old one.
  const ages = new Map(db.prepare("SELECT id, base_age FROM players").all().map((r) => [r.id, r.base_age]));
  db.exec("ALTER TABLE players ADD COLUMN age integer NOT NULL DEFAULT 0");
  db.exec("UPDATE players SET age = base_age");
  db.exec("ALTER TABLE players DROP COLUMN base_age");
  const cols = () => db.prepare("PRAGMA table_info(players)").all().map((c) => c.name);
  const preOk = cols().includes("age") && !cols().includes("base_age");
  db.close();
  check("fixture is in the pre-rename shape", preOk);

  const r = await bootServer(file);
  const after = opens(file);
  const d2 = new DatabaseSync(file, { readOnly: true });
  const names = d2.prepare("PRAGMA table_info(players)").all().map((c) => c.name);
  const rows = d2.prepare("SELECT id, base_age FROM players").all();
  d2.close();

  check("server started", r.listening);
  check("base_age created, age dropped",
    names.includes("base_age") && !names.includes("age"));
  check("no players lost", after.players === ages.size, `${ages.size} -> ${after.players}`);
  check("every starting age carried across, none defaulted",
    rows.every((row) => row.base_age === ages.get(row.id)),
    `${rows.filter((row) => row.base_age === ages.get(row.id)).length}/${rows.length} match`);
  check("career state took the age too", after.state > 0, `${after.state} rows`);
  check("no unhandled error", !/career state migration failed/.test(r.log));
}

// 8. A save that predates the staff split.
console.log("\n8. STAFF SPLIT (salary/age renamed, four columns moved)");
{
  const file = makePreSplit("staff-split");
  const db = new DatabaseSync(file);
  const wages = new Map(db.prepare("SELECT id, base_salary FROM staff").all().map((r) => [r.id, r.base_salary]));
  const ages  = new Map(db.prepare("SELECT id, base_age FROM staff").all().map((r) => [r.id, r.base_age]));
  // Put staff back in the pre-split shape.
  db.exec("ALTER TABLE staff ADD COLUMN salary real NOT NULL DEFAULT 0");
  db.exec("ALTER TABLE staff ADD COLUMN age integer NOT NULL DEFAULT 35");
  db.exec("ALTER TABLE staff ADD COLUMN is_available integer NOT NULL DEFAULT 1");
  db.exec("ALTER TABLE staff ADD COLUMN contract_length integer NOT NULL DEFAULT 12");
  db.exec("ALTER TABLE staff ADD COLUMN is_scout_revealed integer NOT NULL DEFAULT 0");
  db.exec("UPDATE staff SET salary = base_salary, age = base_age");
  db.exec("ALTER TABLE staff DROP COLUMN base_salary");
  db.exec("ALTER TABLE staff DROP COLUMN base_age");
  // career_staff_state is already gone: makePreSplit drops it, which is
  // exactly what a pre-split save looks like. ensureSchema recreates it.
  db.close();

  const r = await bootServer(file);
  const d2 = new DatabaseSync(file, { readOnly: true });
  const names = d2.prepare("PRAGMA table_info(staff)").all().map((c) => c.name);
  const rows = d2.prepare("SELECT id, base_salary, base_age FROM staff").all();
  const stateWages = d2.prepare(
    "SELECT COUNT(*) n FROM career_staff_state WHERE salary > 0").get().n;
  const stateRows = d2.prepare("SELECT COUNT(*) n FROM career_staff_state").get().n;
  d2.close();

  check("server started", r.listening);
  check("base_salary and base_age created", names.includes("base_salary") && names.includes("base_age"));
  check("four career-state columns dropped",
    !["salary", "age", "is_available", "contract_length", "is_scout_revealed"].some((c) => names.includes(c)),
    ["salary", "age", "is_available", "contract_length", "is_scout_revealed"].filter((c) => names.includes(c)).join(", ") || "all gone");
  check("no staff lost", rows.length === wages.size, `${wages.size} -> ${rows.length}`);
  check("every wage carried across, none defaulted",
    rows.every((row) => row.base_salary === wages.get(row.id)),
    `${rows.filter((row) => row.base_salary === wages.get(row.id)).length}/${rows.length}`);
  check("every age carried across",
    rows.every((row) => row.base_age === ages.get(row.id)),
    `${rows.filter((row) => row.base_age === ages.get(row.id)).length}/${rows.length}`);
  check("career staff state rebuilt with a WAGE, not zero",
    stateRows > 0 && stateWages === stateRows, `${stateWages}/${stateRows} priced`);
  check("no unhandled error", !/career state migration failed/.test(r.log));
}

// ── report ───────────────────────────────────────────────────────────────────

console.log(`\n=== ${checks - failures}/${checks} passed ===`);

if (failures > 0) {
  // Keep the evidence. Guessing at why a migration assertion failed is how you
  // end up "fixing" the assertion instead of the migration.
  console.log(`\nLogs kept for inspection: ${WORK}`);
  for (const f of fs.readdirSync(WORK).filter((f) => f.startsWith("boot-"))) {
    const body = fs.readFileSync(path.join(WORK, f), "utf8");
    const lines = body.split("\n").filter((l) =>
      /migration|migrat|dropped|schema|snapshot|ERROR|WARN|err/i.test(l));
    if (lines.length) {
      console.log(`\n--- ${f} ---`);
      console.log(lines.slice(0, 14).join("\n"));
    }
  }
} else {
  try { fs.rmSync(WORK, { recursive: true, force: true }); } catch {}
}

process.exit(failures > 0 ? 1 : 0);
