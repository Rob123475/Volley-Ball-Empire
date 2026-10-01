/**
 * Overnight brief 1 Oct, N-36 (Rob, 1 Oct): Workload Monitoring says "last 14
 * days" but counted the whole season (8, 5, 3 when the last 14 days were 4, 4,
 * 0). It compared each row's createdAt (the PC's clock) with the PC's today,
 * and every fixture of a season is created at the same moment.
 *
 * Asserted on a copy of Rob's 1 Oct save (the starter save with a few matches
 * played when it is absent): every player's match and session counts are the
 * completed matches she played and the completed sessions she trained in the
 * last 14 GAME days (today and the 13 before, by each match's scheduled date and
 * each session's finish date), counted straight from the copy; the status
 * follows those counts; and on this save they differ from the season's.
 *
 * Usage: node harness/workload-window.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const ROB = path.join(os.homedir(), "Downloads", "volleyball-empire-backup-01oct-1225.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-workload-"));
const PORT = 4567;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  OVERNIGHT 1 OCT, N-36: WORKLOAD = THE LAST 14 GAME DAYS");
console.log("=".repeat(72));

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
fs.copyFileSync(usingRob ? ROB : SHIPPED, dbFile);
console.log(`  save: ${usingRob ? "a copy of " + ROB : "the starter save"}`);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development",
    SESSION_SECRET: "workload", STARTER_DB_PATH: SHIPPED },
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
    const prof = await api("POST", "/profiles", { name: "Workload" });
    await api("POST", `/profiles/${prof.data.id}/select`);
    const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
    await api("POST", "/careers", { slotNumber: 1, managerName: "Workload", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
      budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
    for (let i = 0; i < 6; i++) {
      const r = await api("POST", "/calendar/next-match", {});
      const id = r.data?.matchDay?.matchId; if (!id) break;
      await api("POST", `/matches/${id}/simulate`, {}); await api("POST", "/calendar/dismiss-match", {});
    }
  }
  const team = (await api("GET", "/team")).data;
  const rows = (await api("GET", "/medical/workload")).data ?? [];
  const d = new DatabaseSync(dbFile, { readOnly: true });
  const today = d.prepare(`SELECT * FROM calendar_state WHERE team_id = ?`).get(team.id).current_date;
  const fromD = new Date(`${today}T00:00:00Z`); fromD.setUTCDate(fromD.getUTCDate() - 13);
  const from = fromD.toISOString().slice(0, 10);
  const matches = d.prepare(`SELECT lineup, scheduled_at AS on_ FROM matches WHERE home_team_id = ? AND status = 'completed'`).all(team.id)
    .map((m) => ({ lineup: JSON.parse(m.lineup ?? "[]"), day: String(m.on_ ?? "").slice(0, 10) }));
  const sessions = d.prepare(`SELECT player_id AS p, COALESCE(finishes_on, scheduled_at) AS day FROM training_sessions WHERE team_id = ? AND status = 'completed'`).all(team.id)
    .map((s) => ({ p: s.p, day: String(s.day ?? "").slice(0, 10) }));
  d.close();
  const within = (day) => day >= from && day <= today;
  const want = rows.map((r) => {
    const m = matches.filter((x) => within(x.day) && x.lineup.includes(r.id)).length;
    const season = matches.filter((x) => x.lineup.includes(r.id)).length;
    const t = sessions.filter((x) => x.p === r.id && within(x.day)).length;
    const status = m >= 4 || t >= 6 ? "Overworked" : m >= 2 || t >= 3 ? "Heavy Load" : "Fresh";
    return { name: r.name, got: [r.matchesPlayed, r.trainingSessions, r.status], want: [m, t, status], season };
  });
  check("every player's matches and sessions are the last 14 game days' (by the match's date and the session's finish date)",
    rows.length > 0 && want.every((x) => x.got[0] === x.want[0] && x.got[1] === x.want[1]),
    `${from} to ${today}: ` + want.map((x) => `${x.name} ${x.got[0]} (season ${x.season})`).join(", "));
  check("and the status follows them", want.every((x) => x.got[2] === x.want[2]), want.map((x) => `${x.name}: ${x.got[2]}`).join(", "));
  check("on this save the window is not the season (what the page showed before)", want.some((x) => x.season !== x.want[0]),
    want.map((x) => `${x.name} ${x.want[0]} of ${x.season}`).join(", "));
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  await stopServer(child);
}
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else fs.rmSync(WORK, { recursive: true, force: true });
process.exit(failures > 0 ? 1 : 0);
