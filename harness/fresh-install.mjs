/**
 * Fresh-install chain test.
 *
 * This is the path every customer takes and the one nothing was exercising.
 * make-starter-db.ts had been unbuildable for several chunks — raw SQL against
 * columns the split had removed — and nothing caught it because nothing runs it.
 *
 * Simulates a first launch faithfully: an empty userData directory, the shipped
 * starter database copied in the way electron/main.js copies it, then the real
 * server booted against that copy. Asserts the roster survives, the boot
 * migration does the right thing on a database it has never seen, and a career
 * created afterwards behaves.
 *
 * Usage: node harness/fresh-install.mjs
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
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-fresh-"));

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

const PORT = 4402;
const BASE = `http://localhost:${PORT}/api`;

function inspect(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  const n = (t) => { try { return db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n; } catch { return -1; } };
  const cols = (t) => { try { return db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name); } catch { return []; } };
  const r = {
    players: n("players"),
    staff: n("staff"),
    images: (() => {
      try { return db.prepare("SELECT COUNT(*) n FROM players WHERE image_url IS NOT NULL AND image_url <> ''").get().n; }
      catch { return -1; }
    })(),
    poolTeams: n("continental_pool_teams"),
    leagueSeasons: n("regional_league_seasons"),
    state: n("career_player_state"),
    playerCols: cols("players"),
    integrity: (() => {
      try { return db.prepare("PRAGMA integrity_check").get().integrity_check; } catch { return "unreadable"; }
    })(),
  };
  db.close();
  return r;
}

const MOVED = [
  "team_id", "squad_role", "is_active", "salary", "contract_end_date",
  "academy_contract_years", "fitness", "fatigue", "morale", "injury_status",
  "injury_weeks_remaining", "is_injured", "consecutive_matches_played",
  "doctor_quality", "training_points", "training_focus", "focus_xp",
  "scouted_potential", "discovered_by",
];

console.log(`\nworkdir ${WORK}\n`);

// ── a. Simulate what electron/main.js does on a machine with no userData ────
console.log("1. FIRST LAUNCH: empty userData, starter DB copied in");
const userData = path.join(WORK, "userData");
fs.mkdirSync(userData, { recursive: true });
const userDb = path.join(userData, "volleyball-empire.sqlite");
fs.copyFileSync(SHIPPED, userDb);           // exactly what ensureUserDb() does
for (const suffix of ["-wal", "-shm"]) {
  const src = SHIPPED + suffix;
  if (fs.existsSync(src)) fs.copyFileSync(src, userDb + suffix);
}

const before = inspect(userDb);
check("starter DB copied", fs.existsSync(userDb));
check("roster present: 268 players", before.players === 268, `${before.players}`);
check("roster present: 120 staff", before.staff === 120, `${before.staff}`);
check("every player has an image", before.images === before.players, `${before.images}/${before.players}`);
check("regional league seeded", before.poolTeams === 60 && before.leagueSeasons === 6,
  `${before.poolTeams} pool teams, ${before.leagueSeasons} seasons`);
check("no career state yet", before.state === 0, `${before.state}`);

const staleBefore = MOVED.filter((c) => before.playerCols.includes(c));
console.log(`    shipped schema carries ${staleBefore.length} moved column(s): ${staleBefore.join(", ") || "(none)"}`);

// ── b/c. Boot the real server against it, as a first-time player ────────────
console.log("\n2. BOOT (the migration meets this DB for the first time)");
const logFile = path.join(WORK, "boot.log");
const out = fs.openSync(logFile, "w");
const child = spawn(ELECTRON, [SERVER], {
  env: {
    ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: userDb,
    PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "fresh-install-secret",
  },
  stdio: ["ignore", out, out],
});

const deadline = Date.now() + 30000;
let up = false;
for (;;) {
  if (Date.now() > deadline) break;
  try { await fetch(`${BASE}/health`); up = true; break; }
  catch { await new Promise((r) => setTimeout(r, 250)); }
}
check("server started on a virgin save", up);

// Let the log settle before reading it (pino buffers through a worker thread).
let last = -1, stable = 0;
while (stable < 600) {
  let size = 0;
  try { size = fs.statSync(logFile).size; } catch {}
  if (size === last && size > 0) stable += 120; else { stable = 0; last = size; }
  await new Promise((r) => setTimeout(r, 120));
}
const bootLog = fs.readFileSync(logFile, "utf8");

const after = inspect(userDb);
const staleAfter = MOVED.filter((c) => after.playerCols.includes(c));
check("moved columns dropped at boot", staleAfter.length === 0, staleAfter.join(", ") || "none left");
check("no roster lost", after.players === before.players && after.staff === before.staff,
  `${after.players} players, ${after.staff} staff`);
check("images intact", after.images === before.images, `${after.images}`);
check("regional league intact", after.poolTeams === 60 && after.leagueSeasons === 6);
check("database integrity ok", after.integrity === "ok", after.integrity);
check("no migration error logged", !/migration failed|schema ensure failed/.test(bootLog));

// ── d. Create a career and check it works ──────────────────────────────────
console.log("\n3. CREATE A CAREER ON THE FRESH INSTALL");
let cookie = "";
const api = async (method, p, body) => {
  const res = await fetch(BASE + p, {
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

const prof = await api("POST", "/profiles", { name: "FreshInstall" });
check("profile created", prof.status < 400, `HTTP ${prof.status}`);
await api("POST", `/profiles/${prof.data?.id}/select`);
const career = await api("POST", "/careers", {
  slotNumber: 1, managerName: "FreshInstall", managerNationality: "Australia",
  clubName: "Fresh FC", originalClubName: "Fresh FC", season: "Season 1",
  budget: "500000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a",
});
check("career created", career.status < 400, `HTTP ${career.status}`);

const mk = await api("GET", "/players/market-all?playerType=senior");
const all = Array.isArray(mk.data) ? mk.data : (mk.data?.players ?? []);
const free = all.filter((p) => !p.teamId && !p.currentTeamId);
check("transfer market is populated", free.length > 100, `${free.length} free agents`);
check("free agents have a wage", free.filter((p) => Number(p.salary) > 0).length > 100,
  `${free.filter((p) => Number(p.salary) > 0).length} priced`);
check("free agents have stats", free.every((p) => Number(p.speed) > 0), "all non-zero speed");

const withState = inspect(userDb);
check("career state seeded", withState.state > 0, `${withState.state} rows`);

// The staff market is the isDraftPlayer-shaped trap for the staff split: the
// wage lives on the reference row as base_salary and is copied into career
// state at creation. Miss that and every hire in a new career is free, which
// looks like a working game rather than a bug.
const market = await api("GET", "/staff/market");
const staffMarket = Array.isArray(market.data) ? market.data : [];
check("staff market is populated", staffMarket.length > 0, `${staffMarket.length} available`);
check("every staff member has a wage",
  staffMarket.length > 0 && staffMarket.every((s) => Number(s.salary) > 0),
  `${staffMarket.filter((s) => Number(s.salary) > 0).length}/${staffMarket.length} priced`);
check("staff carry a base age",
  staffMarket.every((s) => Number(s.baseAge) > 0),
  `${staffMarket.filter((s) => Number(s.baseAge) > 0).length}/${staffMarket.length}`);

child.kill("SIGKILL");
await new Promise((r) => setTimeout(r, 600));
try { fs.closeSync(out); } catch {}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) {
  console.log(`\nLogs kept: ${WORK}`);
  console.log(bootLog.split("\n").filter((l) => /migrat|schema|drop|ERROR/i.test(l)).slice(0, 20).join("\n"));
} else {
  try { fs.rmSync(WORK, { recursive: true, force: true }); } catch {}
}
process.exit(failures > 0 ? 1 : 0);
