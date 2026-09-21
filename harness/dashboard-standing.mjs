/**
 * R-58 — the dashboard shows the club's tier and where it stands against the board.
 *
 * Rob's brief (overnight batch item 5): the club's current tier badge, and the
 * board's expectation band in plain words, e.g.
 *   "Board expects: top 4 · Currently: 3rd · On track".
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 *   screen     the dashboard renders the tier badge and the standing line from
 *              the API, not from numbers of its own
 *   draw       before the draw there is no standing; after it, before a World
 *              Tour result, the line says so
 *   live       once matches are played, the board's current finish IS the
 *              dashboard's standings rank, graded by the board's own bands, and
 *              the line says exactly that
 *   bands      moved so the same rank falls below or fails, the words follow
 *   tier       the badge's points and tier are the season's ranking row, on the
 *              R-54 thresholds (Silver 55, Gold 63), with last season's tier as
 *              the purse access
 *
 * Usage: node harness/dashboard-standing.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healAllSquads } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-dashboard-standing-"));
const PORT = 4790;
const BASE = `http://localhost:${PORT}/api`;
const FIELD = 19;

// Mirrors of the server's rules, on purpose: utils/board-confidence.ts
// (bandsFor: met within 3 places of the strength rank, failed from 8 below) and
// utils/tierQualification.ts (R-54: Silver 55, Gold 63).
const bands = (strengthRank) => {
  const metLine = Math.min(FIELD, strengthRank + 3);
  const failedFrom = strengthRank + 8 <= FIELD ? strengthRank + 8 : null;
  return { metLine, failedFrom };
};
const gradeOf = (strengthRank, finish) => {
  const b = bands(strengthRank);
  return finish <= b.metLine ? "met" : b.failedFrom != null && finish >= b.failedFrom ? "failed" : "below";
};
const WORDS = { met: "On track", below: "Below expectations", failed: "Failing expectations" };
const ordinal = (n) => {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" })[n % 10] ?? "th"}`;
};
const expectsWords = (strengthRank) => {
  const { metLine } = bands(strengthRank);
  return metLine >= FIELD ? "any finish" : `top ${metLine}`;
};
const tierFor = (points) => (points >= 63 ? "Gold" : points >= 55 ? "Silver" : "Bronze");

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log("  R-58 THE DASHBOARD SHOWS THE TIER AND THE BOARD'S STANDING");
console.log("=".repeat(72));

console.log("\n0. THE SCREEN READS IT FROM THE API");
const dash = fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/pages/dashboard.tsx"), "utf8");
check("the dashboard renders a tier badge from the dashboard's ranking",
  /data-testid="tier-badge"/.test(dash) && /ranking\.tier/.test(dash) && /ranking\.points/.test(dash));
check("the dashboard renders the board's standing line as the server wrote it",
  /data-testid="board-standing"/.test(dash) && /confidence\.standing/.test(dash));
check("the dashboard does not grade the standing itself",
  !/metLine|failedFrom\s*[<>]=?|On track/.test(dash), "no band arithmetic or verdict words in the page");

if (!fs.existsSync(SERVER)) { console.error(`[dashboard-standing] FAILED: ${SERVER} not built.`); process.exit(1); }
const dbFile = path.join(WORK, "standing.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "standing-secret" },
});
{
  const deadline = Date.now() + 60000;
  let up = false;
  while (Date.now() < deadline) { try { await fetch(`${BASE}/health`); up = true; break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  if (!up) { console.error("[dashboard-standing] server never came up"); console.error(fs.readFileSync(path.join(WORK, "server.log"), "utf8").slice(-3000)); process.exit(1); }
}

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
function read(sqlText, ...args) {
  const d = new DatabaseSync(dbFile, { readOnly: true });
  const rows = d.prepare(sqlText).all(...args);
  d.close();
  return rows;
}
function write(sqlText, ...args) {
  const d = new DatabaseSync(dbFile);
  d.prepare(sqlText).run(...args);
  d.close();
}
async function nextMatchDay() {
  for (let i = 0; i < 400; i++) {
    const r = await api("POST", "/calendar/advance", {});
    if (r.data?.blocked === "pending_match") return r.data.pendingMatchId;
  }
  return null;
}

try {
  const prof = await api("POST", "/profiles", { name: "Standing" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const c = await api("POST", "/careers", {
    slotNumber: 1, managerName: "Standing", managerNationality: "Australia", clubName: "Standing FC", originalClubName: "Standing FC",
    season: "Season 1", budget: "500000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a", difficulty: "established",
  });
  const careerSaveId = c.data.id, teamId = c.data.teamId;

  console.log("\n1. BEFORE THE DRAW, AND AT IT");
  const pre = (await api("GET", "/board-confidence")).data;
  check("before the draw: no standing, no current finish", pre?.standing === null && pre?.currentFinish === null && pre?.currentGrade === null,
    JSON.stringify({ standing: pre?.standing, currentFinish: pre?.currentFinish, currentGrade: pre?.currentGrade }));
  const preDash = (await api("GET", "/dashboard")).data;
  check("a new established career: Bronze on 0 points, paid Silver purses in season 1 (R-54)",
    preDash?.ranking?.points === 0 && preDash?.ranking?.tier === "Bronze" && preDash?.ranking?.purseAccessTier === "Silver",
    JSON.stringify(preDash?.ranking));

  let match = await nextMatchDay();
  const drawn = (await api("GET", "/board-confidence")).data;
  const drawnRank = read(`SELECT strength_rank AS r FROM board_seasons WHERE career_save_id = ?`, careerSaveId)[0]?.r;
  check("at the draw, before a World Tour result: the expectation and that nothing is played yet",
    drawn?.standing === `Board expects: ${expectsWords(drawnRank)} · No World Tour result yet` && drawn?.currentFinish === null,
    `"${drawn?.standing}" (strength #${drawnRank})`);

  console.log("\n2. PLAYED: THE BOARD'S CURRENT FINISH IS THE STANDINGS RANK");
  for (let n = 0; n < 8 && match != null; n++) {
    healAllSquads(dbFile); // R-80: a forfeit here would be measured as a played match
    const sim = await api("POST", `/matches/${match}/simulate`, {});
    if (sim.status >= 400) await api("POST", `/matches/${match}/forfeit`, {});
    match = await nextMatchDay();
  }
  const board = (await api("GET", "/board-confidence")).data;
  const dashboard = (await api("GET", "/dashboard")).data;
  const rank = dashboard?.seasonStanding?.rank;
  const strength = read(`SELECT strength_rank AS r FROM board_seasons WHERE career_save_id = ?`, careerSaveId)[0]?.r;
  const want = rank != null ? `Board expects: ${expectsWords(strength)} · Currently: ${ordinal(rank)} · ${WORDS[gradeOf(strength, rank)]}` : null;
  check("current finish = the dashboard's standings rank, graded by the board's bands",
    rank != null && board?.currentFinish === rank && board?.currentGrade === gradeOf(strength, rank),
    `rank ${rank}, board ${board?.currentFinish} ${board?.currentGrade}, strength #${strength}`);
  check("the standing line says exactly that", board?.standing === want, `"${board?.standing}" vs "${want}"`);

  console.log("\n3. THE WORDS FOLLOW THE BAND");
  // A finish can only fall below or fail the board's bands if the club sits low
  // in the standings, so this uses an underdog career played until it is 9th or
  // worse. From that finish R, a strength rank of R-4 puts it one place below the
  // met line (below expectations) and R-8 exactly on the failed line. The finish
  // itself does not move; only the rank the bands are measured from does.
  const prof2 = await api("POST", "/profiles", { name: "Standing Low" });
  await api("POST", `/profiles/${prof2.data.id}/select`);
  const low = await api("POST", "/careers", {
    slotNumber: 1, managerName: "Standing Low", managerNationality: "Australia", clubName: "Standing Low FC", originalClubName: "Standing Low FC",
    season: "Season 1", budget: "150000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a", difficulty: "underdog",
  });
  let lowMatch = await nextMatchDay();
  let lowRank = null;
  for (let n = 0; n < 40 && lowMatch != null; n++) {
    healAllSquads(dbFile); // R-80: a forfeit here would be measured as a played match
    const sim = await api("POST", `/matches/${lowMatch}/simulate`, {});
    if (sim.status >= 400) await api("POST", `/matches/${lowMatch}/forfeit`, {});
    lowMatch = await nextMatchDay();
    lowRank = (await api("GET", "/dashboard")).data?.seasonStanding?.rank ?? null;
    if (n >= 5 && lowRank != null && lowRank >= 9) break;
  }
  check("an underdog club sits 9th or worse, so there is room to move the bands", lowRank != null && lowRank >= 9, `rank ${lowRank}`);
  const cases = [];
  if (lowRank != null && lowRank >= 9) {
    for (const s of [lowRank - 4, lowRank - 8]) {
      write(`UPDATE board_seasons SET strength_rank = ? WHERE career_save_id = ?`, s, low.data.id);
      const b = (await api("GET", "/board-confidence")).data;
      cases.push({ s, grade: gradeOf(s, lowRank), got: b?.currentGrade, standing: b?.standing,
        want: `Board expects: ${expectsWords(s)} · Currently: ${ordinal(lowRank)} · ${WORDS[gradeOf(s, lowRank)]}` });
    }
  }
  check("the same finish reads below expectations, then failing, exactly as the board grades it",
    cases.length === 2 && cases[0].grade === "below" && cases[1].grade === "failed"
      && cases.every((x) => x.got === x.grade && x.standing === x.want),
    cases.map((x) => `strength #${x.s}: "${x.standing}" (board ${x.got})`).join(" | "));

  console.log("\n4. THE TIER BADGE IS THE SEASON'S RANKING ROW");
  const row = read(`SELECT cr.ranking_points AS p FROM competitor_rankings cr JOIN competitors co ON co.id = cr.competitor_id
                    WHERE co.team_id = ? AND cr.career_save_id = ? AND cr.season_year = 2026`, teamId, careerSaveId)[0];
  check("points and tier are the ranking row's, on R-54's thresholds",
    row != null && dashboard?.ranking?.points === row.p && dashboard?.ranking?.tier === tierFor(row.p),
    `row ${row?.p}, dashboard ${JSON.stringify(dashboard?.ranking)}`);
} finally {
  await stopServer(child);
  try { fs.closeSync(out); } catch { /* closed */ }
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
