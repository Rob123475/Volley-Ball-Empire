/**
 * Unity match brief (29 Sep), item 12 — the dashboard shows the same numbers as
 * the World Tour Standings and Results, after every match.
 *
 * Rob, 4 Mar 2026 in his career, four matches played: WT Standings 2-2, 2 pts,
 * 13th; the dashboard 1-1, "1 season pts", World Rank #11, Recent Results only
 * R1 and R2, its ladder a round behind. Cause (client): the dashboard stays
 * mounted under the MATCH DAY box, window-focus refetching is off, and Sim
 * Result / Skip only refreshed the calendar's query, so nothing else on the
 * dashboard was fetched again after a match. Also its Season Record read the
 * team's win/loss counters (every season) instead of this season's standing.
 *
 * Asserted: four matches, one per way of playing them (Sim Result, Skip,
 * watched in 3D, Sim Result); after each, GET /dashboard's record, season
 * points and rank equal the player's row in the season ladder (the WT
 * Standings page's source), and its recent results are the matches just
 * played, newest first. And the client refreshes every query after a match and
 * reads the record from the standing.
 *
 * Usage: node harness/dashboard-fresh.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healSquadByTeam } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-dashboard-fresh-"));
const PORT = 4920;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  UNITY 12: THE DASHBOARD MATCHES THE STANDINGS AFTER EVERY MATCH");
console.log("=".repeat(72));
if (!fs.existsSync(SERVER)) { console.error(`[dashboard-fresh] FAILED: ${SERVER} not built.`); process.exit(1); }

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
const dbFile = path.join(WORK, "dash.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "dash-fresh" },
});

try {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  const prof = await api("POST", "/profiles", { name: "Dash Fresh" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", {
    slotNumber: 1, managerName: "Dash Fresh", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0,
  });
  const teamId = (await api("GET", "/team")).data?.id;
  const careerSaveId = ((await api("GET", "/careers")).data?.saves ?? []).find((s) => s.slotNumber === 1)?.id;
  const seasonId = (await api("GET", "/seasons/current")).data?.id;

  const ways = [
    ["Sim Result", async (id) => { await api("POST", `/matches/${id}/simulate`); await api("POST", "/calendar/dismiss-match"); }],
    ["Skip", async (id) => { await api("POST", `/matches/${id}/simulate`); await api("POST", "/calendar/skip-match"); }],
    ["watched in 3D", async (id) => {
      await api("POST", `/matches/${id}/watch`, {});
      await fetch(`${BASE}/unity/match-result`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ careerSaveId, matchId: id, sets: [{ home: 9, away: 11 }, { home: 11, away: 7 }, { home: 11, away: 5 }] }) });
    }],
    ["Sim Result", async (id) => { await api("POST", `/matches/${id}/simulate`); await api("POST", "/calendar/dismiss-match"); }],
  ];
  const played = [];
  for (const [n, [name, play]] of ways.entries()) {
    const id = (await api("POST", "/calendar/next-match")).data?.matchDay?.matchId;
    healSquadByTeam(dbFile, teamId);
    await play(id);
    await api("GET", "/calendar");
    played.unshift(id);
    const dash = (await api("GET", "/dashboard")).data;
    const ladder = (await api("GET", `/seasons/${seasonId}/ladder`)).data ?? [];
    const me = ladder.find((r) => r.isPlayer);
    const st = dash?.seasonStanding;
    check(`after match ${n + 1} (${name}): record, season points and rank are the standings'`,
      !!me && st?.wins === me.wins && st?.losses === me.losses && st?.points === me.points && st?.rank === me.rank && me.wins + me.losses === n + 1,
      `dashboard ${st?.wins}-${st?.losses}, ${st?.points} pts, #${st?.rank}; standings ${me?.wins}-${me?.losses}, ${me?.points} pts, #${me?.rank}`);
    const recent = (dash?.recentResults ?? []).map((r) => r.id ?? r.matchId);
    check(`after match ${n + 1}: recent results are the matches played, newest first`,
      JSON.stringify(recent.slice(0, played.length)) === JSON.stringify(played), `dashboard [${recent.join(", ")}] vs played [${played.join(", ")}]`);
  }

  const cal = fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", "hooks", "use-calendar.ts"), "utf8");
  const dashSrc = fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", "pages", "dashboard.tsx"), "utf8");
  check("client: after Sim Result, Skip or the MATCH DAY box closing, every query is refreshed (not only the calendar's)",
    /const refreshAfterMatch = \(\) => queryClient\.invalidateQueries\(\);/.test(cal)
    && (cal.match(/onSuccess:\s+refreshAfterMatch/g) ?? []).length === 2 && /refreshAfterMatch\(\);\s*dismissMatchMutation\.mutate\(\);/.test(cal));
  check("client: the Season Record tile reads this season's standing", /const wins\s+= dashboard\?\.seasonStanding\?\.wins \?\? 0;/.test(dashSrc));
  const wt = fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", "pages", "competition", "wt-ladder.tsx"), "utf8");
  check("WT Standings: the won:lost column is called \"Sets\"", />Sets<\/th>/.test(wt) && !/Sets \+\/−/.test(wt));
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
