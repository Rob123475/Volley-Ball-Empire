/**
 * R-42 — trophies are written at the season boundary, from what happened.
 *
 * Before: nothing in the game inserted a trophy, so the Trophy Cabinet, "Titles
 * Won", trophy news and the Hall of Fame's trophy count were empty forever.
 * Rule: utils/seasonTrophies.ts.
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 *   fresh      a new career has no trophies: the table and every cabinet row
 *   season     established careers play season 1 for real; at the boundary each
 *              gets exactly the rows its season earned — World Champions /
 *              runner-up / semi-finalist from the World Finals, plus a Silver or
 *              Gold tier from its ranking points — no more, no fewer
 *   champion   at least one of those seasons is a champion season, and it
 *              produces exactly "World Champions 2026" plus its tier
 *   shown      the season review and the cabinet show the same rows
 *
 * Usage: node harness/trophies.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healSquad, maxOutSquad } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-trophies-"));
const PORT = 4760;
const BASE = `http://localhost:${PORT}/api`;
const YEAR = 2026;
const MAX_CAREERS = 8;

// Mirrors utils/tierQualification.ts on purpose (R-54: Silver 55, Gold 63).
const tierFor = (points) => (points >= 63 ? "Gold" : points >= 55 ? "Silver" : "Bronze");
function expectedRows(finals, points) {
  const rows = [];
  if (finals === "champion") rows.push({ type: "world_championship", name: `World Champions ${YEAR}` });
  if (finals === "runner-up") rows.push({ type: "runner_up", name: `World Final runner-up ${YEAR}` });
  if (finals === "semi-finalist") rows.push({ type: "bronze", name: `World Finals semi-finalist ${YEAR}` });
  const tier = tierFor(points);
  if (tier !== "Bronze") rows.push({ type: "world_tour_tier", name: `World Tour ${tier} tier ${YEAR}` });
  return rows;
}
const key = (rows) => rows.map((r) => `${r.type}:${r.name}`).sort().join(" | ");

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log("  R-42 TROPHIES ARE WRITTEN AT THE SEASON BOUNDARY");
console.log("=".repeat(72));

console.log("\n0. THE CODE PATHS");
const rollover = fs.readFileSync(path.join(REPO, "artifacts/api-server/src/utils/seasonRollover.ts"), "utf8");
const dialog = fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/components/season-review-dialog.tsx"), "utf8");
const cabinet = fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/pages/trophy-cabinet.tsx"), "utf8");
check("the season rollover awards the season's trophies", /awardSeasonTrophiesTx\(tx, careerSaveId, season\.year, current, teamId\)/.test(rollover));
check("the season review shows the honours won", /data-testid="season-review-trophies"/.test(dialog));
check("the club's trophy cabinet shows tier seasons and World Finals placings",
  /honours\.worldTourTiers/.test(cabinet) && /honours\.worldChampionships/.test(cabinet) && /honours\.runnerUps/.test(cabinet) && /honours\.bronzes/.test(cabinet));

if (!fs.existsSync(SERVER)) { console.error(`[trophies] FAILED: ${SERVER} not built.`); process.exit(1); }
const dbFile = path.join(WORK, "trophies.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "trophies-secret" },
});
{
  const deadline = Date.now() + 60000;
  let up = false;
  while (Date.now() < deadline) { try { await fetch(`${BASE}/health`); up = true; break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  if (!up) { console.error("[trophies] server never came up"); console.error(fs.readFileSync(path.join(WORK, "server.log"), "utf8").slice(-3000)); process.exit(1); }
}

function session() {
  let cookie = "";
  return async function api(method, p, body) {
    const res = await fetch(BASE + p, {
      method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    const text = await res.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data };
  };
}
function read(sqlText, ...args) {
  const d = new DatabaseSync(dbFile, { readOnly: true });
  const rows = d.prepare(sqlText).all(...args);
  d.close();
  return rows;
}
async function newCareer(api, label) {
  const prof = await api("POST", "/profiles", { name: label });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const c = await api("POST", "/careers", {
    slotNumber: 1, managerName: label, managerNationality: "Australia", clubName: `${label} FC`, originalClubName: `${label} FC`,
    season: "Season 1", budget: "500000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a", difficulty: "established",
  });
  return { careerSaveId: c.data?.id, teamId: c.data?.teamId };
}
/**
 * R-80 (R-78): `fit` is called before each match. Injuries could empty this
 * two-player club, R-48 would forfeit, and a season full of forfeits cannot
 * reach the World Finals - which is what left "no champion in 8 seasons"
 * to chance. Injuries are R-50's own suite's business. The database is this
 * run's own throwaway copy.
 */
async function playSeason(api, fit = null) {
  for (let i = 0; i < 500; i++) {
    const r = await api("POST", "/calendar/advance", {});
    if (r.status >= 400) return { error: r.data };
    if (r.data?.blocked === "pending_match") {
      if (fit) fit();
      const sim = await api("POST", `/matches/${r.data.pendingMatchId}/simulate`, {});
      if (sim.status >= 400) await api("POST", `/matches/${r.data.pendingMatchId}/forfeit`, {});
      continue;
    }
    if (r.data?.seasonRollover && r.data.seasonRollover.kind !== "none") return { roll: r.data.seasonRollover };
  }
  return { error: "no boundary" };
}

try {
  console.log("\n1. A NEW CAREER HAS NO TROPHIES");
  const F = session();
  const fresh = await newCareer(F, "TrophyFresh");
  const freshRows = read(`SELECT COUNT(*) AS n FROM trophies WHERE team_id = ?`, fresh.teamId)[0].n;
  const freshCabinet = (await F("GET", "/trophies/cabinet")).data?.honours ?? {};
  const rowsInCabinet = Object.values(freshCabinet).filter(Array.isArray).reduce((s, a) => s + a.length, 0);
  check("no trophy rows, and every cabinet row is empty", freshRows === 0 && rowsInCabinet === 0 && Array.isArray(freshCabinet.worldTourTiers),
    `${freshRows} rows; cabinet ${JSON.stringify(Object.fromEntries(Object.entries(freshCabinet).map(([k, v]) => [k, Array.isArray(v) ? v.length : v])))}`);

  console.log("\n2. EACH SEASON EARNS EXACTLY WHAT HAPPENED IN IT");
  //
  // R-80 (R-78): this section used to emit two checks PER CAREER and stop as
  // soon as a champion turned up, so the number of checks it printed changed
  // with the dice - 10 one run, 16 the next - and it failed outright with "no
  // champion in 8 seasons" when the dice never obliged. Both are fixed here:
  // every season played is collected and then asserted in ONE check, so the
  // count is the same every run, and the club is put at the engine's ceiling
  // (maxOutSquad) so it reaches the World Finals every season instead of
  // scraping in. Winning the final itself cannot be forced - the opponent is
  // rated 86 and clampRating caps everyone at 99 - so the loop still plays up
  // to MAX_CAREERS looking for one, but it now starts from a club that makes
  // the final every time rather than one that often missed it.
  //
  // Nothing is weakened: every season still has to produce EXACTLY the trophy
  // rows it earned, and the champion season still has to produce exactly the
  // title plus its tier.
  const seasons = [];
  let champion = null;
  for (let k = 1; k <= MAX_CAREERS && !champion; k++) {
    const api = session();
    const c = await newCareer(api, `Trophy${k}`);
    maxOutSquad(dbFile, c.careerSaveId, c.teamId);
    const played = await playSeason(api, () => healSquad(dbFile, c.careerSaveId, c.teamId));
    if (played.error) { seasons.push({ k, boundary: false, why: JSON.stringify(played.error) }); continue; }
    const review = (await api("GET", `/seasons/${YEAR}/review`)).data;
    const finals = review?.worldFinals?.playerResult ?? null;
    const points = review?.ranking?.rankingPoints ?? 0;
    const expected = expectedRows(finals, points);
    const dbRows = read(`SELECT type, name, year, season FROM trophies WHERE team_id = ?`, c.teamId);
    seasons.push({
      k, boundary: true, finals, points,
      rowsMatch: key(dbRows) === key(expected) && dbRows.every((r) => r.year === YEAR && r.season === 1),
      reviewMatch: key(review?.trophies ?? []) === key(expected),
      expected, dbRows,
    });
    if (finals === "champion") {
      champion = { k, expected, dbRows, honours: (await api("GET", "/trophies/cabinet")).data?.honours };
    }
  }

  const summary = seasons.map((s) => s.boundary ? `T${s.k} ${s.finals}/${s.points}` : `T${s.k} NO BOUNDARY`).join(", ");
  check("every season played reached its boundary", seasons.every((s) => s.boundary),
    seasons.filter((s) => !s.boundary).map((s) => `T${s.k}: ${s.why}`).join("; ") || summary);
  check("every season wrote exactly the trophy rows it earned, dated to that season",
    seasons.length > 0 && seasons.filter((s) => s.boundary).every((s) => s.rowsMatch),
    seasons.filter((s) => s.boundary && !s.rowsMatch)
      .map((s) => `T${s.k} expected [${key(s.expected) || "none"}] got [${key(s.dbRows) || "none"}]`)
      .join("; ") || summary);
  check("every season review showed the same rows as the database",
    seasons.length > 0 && seasons.filter((s) => s.boundary).every((s) => s.reviewMatch),
    summary);
  check("a champion season was played and produced exactly World Champions 2026 plus its tier",
    champion != null && champion.dbRows.filter((r) => r.type === "world_championship").length === 1
      && champion.dbRows.some((r) => r.name === `World Champions ${YEAR}`)
      && champion.dbRows.length === champion.expected.length,
    champion ? `Trophy${champion.k}: ${key(champion.dbRows)}` : `no champion in ${seasons.length} seasons`);
  check("the champion's trophy cabinet shows the title and its tier season",
    champion != null && champion.honours?.worldChampionships?.length === 1
      && champion.honours.worldChampionships[0].name === `World Champions ${YEAR}`
      && champion.honours.worldTourTiers.length === champion.dbRows.filter((r) => r.type === "world_tour_tier").length,
    champion ? JSON.stringify({ titles: champion.honours?.worldChampionships?.map((t) => t.name), tiers: champion.honours?.worldTourTiers?.map((t) => t.name) }) : "no champion");
} finally {
  await stopServer(child);
  try { fs.closeSync(out); } catch { /* closed */ }
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
