/**
 * Unity match brief (29 Sep), item 18 — Training and Youth Academy.
 *
 * Rob, 29 Sep (game date 4 Mar 2026):
 *   - Training Plan said Fitness 80%, the top bar 98% FIT, the players 100/98/97.
 *     The plan's "fitness" was the squad's average STAMINA stat.
 *   - Schedule Training offered the PC's date and time (UTC) as "Scheduled At".
 *   - The Youth Player Database read data/players_youth.json (60 entries, 24
 *     male, roles like "Server"), not the save.
 *   - Old saves kept the starter DB's old youth rows (Katarina Novak, Marco
 *     Ricci... "Croatian"): the reference sync never touches a player's name.
 *   - A 1-month scouting mission said "Advance seasons to complete": it ran 3
 *     REAL days on the PC's clock.
 *
 * Asserted:
 *   A (starter-DB copy): the plan's fitness is the top bar's; a session is dated
 *     on the game date whatever the caller sends; the youth list is the Player
 *     Market's (API), the JSON is gone; every youth position is one of the five;
 *     a 1-month mission completes one game month after it is sent, and says when.
 *   B (a copy of Rob's save, Downloads/volleyball-empire-backup-29sep-1136.sqlite,
 *     skipped with a note when not on this machine): on boot every youth row
 *     still holding an old starter name becomes today's (name, nationality,
 *     position, continent); a name the player typed stays; a second boot has
 *     nothing left to do.
 *
 * Usage: node harness/training-youth.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healAllSquads } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const ROB = path.join(os.homedir(), "Downloads", "volleyball-empire-backup-29sep-1136.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-training-youth-"));
const PORT = 4926;
const BASE = `http://localhost:${PORT}/api`;
const FIVE = new Set(["setter", "spiker", "defender", "blocker", "all_rounder"]);

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  UNITY 18: TRAINING AND YOUTH ACADEMY");
console.log("=".repeat(72));
if (!fs.existsSync(SERVER)) { console.error(`[training-youth] FAILED: ${SERVER} not built.`); process.exit(1); }

let cookie = "";
async function api(method, p, body) {
  const res = await fetch(BASE + p, {
    method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const text = await res.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}
async function boot(dbFile, log, extraEnv = {}) {
  const out = fs.openSync(path.join(WORK, log), "w");
  const child = forkServer({
    server: SERVER, electron: ELECTRON, out,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "training-youth", ...extraEnv },
  });
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return { child, close: async () => { try { await stopServer(child); } catch { /* stopped */ } try { fs.closeSync(out); } catch { /* closed */ } } };
}

// ── A. Starter-DB copy ──────────────────────────────────────────────────────
console.log("\nA. A NEW CAREER");
const dbA = path.join(WORK, "a.sqlite");
fs.copyFileSync(SHIPPED, dbA);
let srv = await boot(dbA, "a.log");
try {
  const prof = await api("POST", "/profiles", { name: "Train Test" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", {
    slotNumber: 1, managerName: "Train Test", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0,
  });
  const teamId = (await api("GET", "/team")).data?.id;
  const careerSaveId = ((await api("GET", "/careers")).data?.saves ?? [])[0]?.id;

  // Rob's three: fitness 100, 98, 97.
  const w = new DatabaseSync(dbA);
  const ids = w.prepare(`SELECT player_id AS id FROM career_player_state WHERE career_save_id = ? AND team_id = ? AND is_active = 1 ORDER BY player_id`).all(careerSaveId, teamId).map((r) => r.id);
  [100, 98, 97].forEach((f, i) => w.prepare(`UPDATE career_player_state SET fitness = ? WHERE career_save_id = ? AND player_id = ?`).run(f, careerSaveId, ids[i]));
  w.close();
  const plan = (await api("GET", "/training/plan")).data;
  const cal = (await api("GET", "/calendar")).data;
  check("one fitness figure: the Training Plan's is the top bar's", plan?.averageFitness === cal?.teamFitness?.avgFitness && plan.averageFitness === 98,
    `plan ${plan?.averageFitness}%, top bar ${cal?.teamFitness?.avgFitness}% (players 100, 98, 97)`);

  const sent = await api("POST", "/training", { playerId: ids[0], type: "Power Camp", durationHours: 2, scheduledAt: "2099-09-29T02:34" });
  const team = await api("POST", "/training/team", { type: "Recovery Program", durationHours: 2, scheduledAt: new Date().toISOString() });
  check("a session is dated on the game date, whatever date the caller sends", sent.data?.scheduledAt === cal.currentDate && (team.data ?? []).every((s) => s.scheduledAt === cal.currentDate),
    `game date ${cal.currentDate}; individual ${sent.data?.scheduledAt}; team ${(team.data ?? []).map((s) => s.scheduledAt).join(", ")}`);
  const trainingPage = fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/pages/training.tsx"), "utf8");
  check("the page has no date or time to pick (no PC clock)", !/datetime-local/.test(trainingPage) && !/new Date\(\)\.toISOString\(\)\.slice\(0, 16\)/.test(trainingPage) && /data-testid="session-starts"/.test(trainingPage));

  // The youth list.
  const youthPage = fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/pages/youth-academy.tsx"), "utf8");
  check("the Youth Player Database reads the API (the Player Market's youth list); the JSON file is gone",
    !fs.existsSync(path.join(REPO, "artifacts/beach-volleyball/src/data/players_youth.json")) && !/import .* from "@\/data\/players_youth\.json"/.test(youthPage)
    && /fetch\("\/api\/players\/youth-pool"\)/.test(youthPage) && /queryKey: \["players-youth-pool"\]/.test(youthPage));
  const pool = (await api("GET", "/players/youth-pool")).data ?? [];
  const allYouth = new DatabaseSync(SHIPPED, { readOnly: true }).prepare(`SELECT position FROM players WHERE player_type = 'youth'`).all();
  check("every youth player's position is one of the five (no \"Server\")", pool.length > 0 && pool.every((p) => FIVE.has(p.position)) && allYouth.every((p) => FIVE.has(p.position))
    && !/"Server"/.test(fs.readFileSync(path.join(REPO, "artifacts/api-server/src/routes/continental-scouting.ts"), "utf8").replace(/\/\/.*$/gm, "")),
    `${pool.length} in the list, ${allYouth.length} in the starter DB`);

  // A 1-month mission on the game calendar.
  const start = await api("POST", "/continental-scouting/start", { region: "Europe", durationMonths: 1 });
  const regions = (await api("GET", "/continental-scouting/regions")).data ?? [];
  const m = regions.find((r) => r.id === "Europe")?.activeMission;
  const expect = (() => { const d = new Date(`${cal.currentDate}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 10); })();
  const days = Math.round((Date.parse(`${expect}T00:00:00Z`) - Date.parse(`${cal.currentDate}T00:00:00Z`)) / 86400000);
  check("a 1-month mission says when it completes: one game month after it is sent", start.status === 201 && m?.completesOn === expect && m?.daysLeft === days,
    `sent ${cal.currentDate}; completes ${m?.completesOn}, ${m?.daysLeft} days left`);
  const day = async () => {
    healAllSquads(dbA);
    const r = await api("POST", "/calendar/advance", {});
    if (r.data?.blocked === "pending_match") { await api("POST", `/matches/${r.data.pendingMatchId}/simulate`); await api("POST", "/calendar/dismiss-match"); return day(); }
    if (r.data?.matchDay?.matchId) { await api("POST", `/matches/${r.data.matchDay.matchId}/simulate`); await api("POST", "/calendar/dismiss-match"); }
    return r;
  };
  for (let i = 0; i < days - 1; i++) await day();
  const before = (await api("GET", "/continental-scouting/regions")).data?.find((r) => r.id === "Europe")?.activeMission;
  await day();
  const after = (await api("GET", "/continental-scouting/regions")).data?.find((r) => r.id === "Europe")?.activeMission;
  check("it is still out the day before, and complete on that date", before?.status === "active" && before?.daysLeft === 1 && after?.status === "completed",
    `day before: ${before?.status}, ${before?.daysLeft} left; on ${expect}: ${after?.status}`);
} catch (err) {
  check("part A completed", false, String(err?.stack ?? err));
} finally {
  await srv.close();
}

// ── B. A copy of Rob's save ─────────────────────────────────────────────────
console.log("\nB. ROB'S SAVE: OLD YOUTH NAMES");
if (!fs.existsSync(ROB)) {
  console.log(`  NOTE  ${ROB} is not on this machine: part B skipped`);
} else {
  const dbB = path.join(WORK, "rob.sqlite");
  fs.copyFileSync(ROB, dbB);
  const q = (file, sql, ...a) => { const d = new DatabaseSync(file, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
  const starter = new Map(q(SHIPPED, `SELECT id, name, nationality, position, continent FROM players WHERE player_type = 'youth'`).map((r) => [r.id, r]));
  const before = q(dbB, `SELECT id, name, nationality FROM players WHERE player_type = 'youth' ORDER BY id`);
  // One name the player typed, on a row that also has history.
  const typed = before[5];
  { const d = new DatabaseSync(dbB); d.prepare(`UPDATE players SET name = 'Rob Typed This' WHERE id = ?`).run(typed.id); d.close(); }
  const stale = before.filter((r) => r.id !== typed.id && (r.name !== starter.get(r.id)?.name || r.nationality !== starter.get(r.id)?.nationality));
  check("the copy of Rob's save holds the old youth rows", stale.length >= 70, `${stale.length} stale, e.g. ${before[0].name} (${before[0].nationality})`);
  srv = await boot(dbB, "rob1.log", { STARTER_DB_PATH: SHIPPED });
  await srv.close();
  const afterRows = new Map(q(dbB, `SELECT id, name, nationality, position, continent FROM players WHERE player_type = 'youth'`).map((r) => [r.id, r]));
  const fixed = stale.filter((r) => { const a = afterRows.get(r.id), s = starter.get(r.id); return a && s && a.name === s.name && a.nationality === s.nationality && a.position === s.position && a.continent === s.continent; });
  check("on boot every old starter youth row is brought up to date (name, nationality, position, continent)", fixed.length === stale.length,
    `${fixed.length} of ${stale.length}; e.g. ${stale[0].name} -> ${afterRows.get(stale[0].id)?.name} (${afterRows.get(stale[0].id)?.nationality})`);
  check("a name the player typed is left alone", afterRows.get(typed.id)?.name === "Rob Typed This");
  const log1 = fs.readFileSync(path.join(WORK, "rob1.log"), "utf8");
  srv = await boot(dbB, "rob2.log", { STARTER_DB_PATH: SHIPPED });
  await srv.close();
  const log2 = fs.readFileSync(path.join(WORK, "rob2.log"), "utf8");
  // Dev logs are pretty-printed: one "to": line per rename.
  const renames = (log1.match(/"to": "[^"]+"/g) ?? []).length;
  check("the boot log names the renames; a second boot has nothing left to do", renames >= stale.length && /"to": "Eleni Stavrou"/.test(log1) && /save is up to date/.test(log2),
    `first boot: ${renames} renames logged (staff and youth); second boot: ${/save is up to date/.test(log2) ? "up to date" : "changed something"}`);
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
