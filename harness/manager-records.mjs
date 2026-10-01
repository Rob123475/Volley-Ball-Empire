/**
 * Overnight brief 30 Sep, item 1 — Career > Records shows the manager's own records.
 *
 * Rob, 30 Sep: Career > Records opened the Trophy Cabinet (Club Honours). Its
 * API, GET /history/records, also read every completed match in the database
 * (every career's) and counted every decisive match as a win.
 *
 * Asserted on a copy of Rob's save (Downloads/volleyball-empire-backup-30sep-0921.sqlite;
 * the starter save with a few matches when it is absent): the records are the
 * manager's: matches, won-lost, win rate and best streak equal a direct count
 * of this club's completed fixtures (the club is the home side; won = more
 * sets); seasons and titles are the career's own counters; Career > Records
 * renders the Manager Records page, not the Trophy Cabinet.
 *
 * Usage: node harness/manager-records.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healSquadByTeam } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const ROB = path.join(os.homedir(), "Downloads", "volleyball-empire-backup-30sep-0921.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-manager-records-"));
const PORT = 4930;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  OVERNIGHT 30 SEP, 1: CAREER > RECORDS IS THE MANAGER'S RECORD");
console.log("=".repeat(72));
if (!fs.existsSync(SERVER)) { console.error(`[manager-records] FAILED: ${SERVER} not built.`); process.exit(1); }

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
const usingRob = fs.existsSync(ROB);
const dbFile = path.join(WORK, "save.sqlite");
fs.copyFileSync(usingRob ? ROB : SHIPPED, dbFile);   // Rob's file is only copied, never opened
console.log(`  save: ${usingRob ? "a copy of " + ROB : "the starter save (Rob's backup is not on this machine)"}`);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development",
    SESSION_SECRET: "manager-records", STARTER_DB_PATH: SHIPPED },
});

try {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  if (usingRob) {
    const profiles = (await api("GET", "/profiles")).data?.profiles ?? [];
    await api("POST", `/profiles/${profiles[0].id}/select`);
    const save = ((await api("GET", "/careers")).data?.saves ?? []).find((s) => s.teamId != null);
    await api("POST", `/careers/${save.id}/load`);
  } else {
    const prof = await api("POST", "/profiles", { name: "Records Test" });
    await api("POST", `/profiles/${prof.data.id}/select`);
    const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
    await api("POST", "/careers", {
      slotNumber: 1, managerName: "Records Test", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
      budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0,
    });
    const tid = (await api("GET", "/team")).data?.id;
    for (let i = 0; i < 4; i++) {
      const id = (await api("POST", "/calendar/next-match")).data?.matchDay?.matchId;
      healSquadByTeam(dbFile, tid);
      await api("POST", `/matches/${id}/simulate`); await api("POST", "/calendar/dismiss-match");
    }
  }
  const team = (await api("GET", "/team")).data;
  const rec = (await api("GET", "/history/records")).data;
  const d = new DatabaseSync(dbFile, { readOnly: true });
  const mine = d.prepare(`SELECT home_score AS h, away_score AS a FROM matches WHERE home_team_id = ? AND status = 'completed' ORDER BY season, round`).all(team.id);
  const all = d.prepare(`SELECT COUNT(*) AS n FROM matches WHERE status = 'completed'`).get().n;
  d.close();
  let wins = 0, best = 0, run = 0;
  for (const m of mine) { if ((m.h ?? 0) > (m.a ?? 0)) { wins++; run++; best = Math.max(best, run); } else run = 0; }
  check("matches managed = this club's completed fixtures (not every match in the database)",
    rec?.matches === mine.length, `records ${rec?.matches}; club ${mine.length}; database ${all}`);
  check("won-lost and win rate from those fixtures (won = more sets)",
    rec.wins === wins && rec.losses === mine.length - wins && rec.winRate === (mine.length ? Math.round((wins / mine.length) * 100) : 0),
    `${rec.wins}-${rec.losses}, ${rec.winRate}%; counted ${wins}-${mine.length - wins}`);
  check("best winning streak in played order", rec.bestStreak === best, `${rec.bestStreak} (counted ${best})`);
  const cs = (await api("GET", "/achievements/career-stats")).data ?? {};
  check("seasons and titles are the career's own counters", rec.seasonsCompleted === cs.seasonsCompleted && rec.worldFinalsWon === cs.championshipsWon,
    `seasons ${rec.seasonsCompleted}, World Finals ${rec.worldFinalsWon}`);
  check("the record names the manager and her club", !!rec.managerName && rec.clubs.includes(team.name), `${rec.managerName}, ${rec.clubs.join(", ")}`);
  const hub = fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/pages/career-hub.tsx"), "utf8");
  check("Career > Records renders Manager Records, not the Trophy Cabinet",
    /tab === "records"\s+&& <ManagerRecords \/>/.test(hub) && !/TrophyCabinet/.test(hub));
  // Overnight 1 Oct, N-39: "Rob Bonner's record as a manager" (it read "Rob Bonner record").
  const recPage = fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/pages/manager-records.tsx"), "utf8");
  check("the heading is possessive: \"<name>'s record as a manager\" (\"Your record\" with no name)",
    recPage.includes("{r.managerName ? `${r.managerName}'s` : \"Your\"} record as a manager"), `here: "${rec.managerName}'s record as a manager"`);
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  try { await stopServer(child); } catch { /* stopped */ }
  try { fs.closeSync(out); } catch { /* closed */ }
}
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
