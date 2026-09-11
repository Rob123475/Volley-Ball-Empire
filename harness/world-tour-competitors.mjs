/**
 * R-29 — the World Tour is a real competition, per career.
 *
 * ── The bug this exists for ─────────────────────────────────────────────────
 * World Tour Standings read "1 teams" while the fixtures screen promised "18
 * qualified teams". The player's opponents were ten name strings; "AI results"
 * were a 55% coin flip written onto every OTHER team's scheduled matches in the
 * database, other careers' included; the World Finals were seeded from every
 * team in the database padded with nine hardcoded rival names.
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 * Two careers, A and B, in one fresh database. Each is played through the
 * regional period and ROUNDS World Tour rounds by the calendar, every player
 * match through POST /matches/:id/simulate. Then:
 *
 *   field      each career's World Tour field is its own 18 qualifiers
 *              (3 per continent, all carrying its career_save_id) + its club
 *   played     after N rounds every AI club has played exactly N minus its
 *              scheduled rests, with exactly one rest per round (the field is
 *              19, so one club must sit out — see docs/WEEKEND-STATUS.md Q1)
 *   real       every result is 2-0 or 2-1 with legal set scores
 *   records    each club's ranking row wins/losses equal its fixture results
 *   points     each club's ranking points equal an INDEPENDENT recomputation
 *              from its fixtures, in round order, with the tier table and gate
 *   order      the ladder endpoint is ordered by the standings rule
 *   isolation  B's ladder holds nothing of A's; B's play wrote nothing of A's
 *   sabotage   the "whole field" and "points reconcile" checks are run again on
 *              deliberately broken copies — the old one-row ladder, one AI
 *              club's points nudged by 1 — and must FAIL there, so a pass above
 *              cannot be a check that passes whatever it is given
 *
 * Usage: node harness/world-tour-competitors.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-world-tour-"));
const PORT = 4670;
const BASE = `http://localhost:${PORT}/api`;

const SEASON = 2026;
const FIRST_WT_ROUND = 11;
const ROUNDS = 12;
const LAST_ROUND = FIRST_WT_ROUND + ROUNDS - 1;
const QUALIFIERS = 3 * 6;              // rules page: 3 qualifiers from each of 6 regions
const FIELD = QUALIFIERS + 1;          // + the player's club

// Mirrors utils/rankingPoints.ts (TIER_RANKING_POINTS) and
// utils/tierQualification.ts (TIER_THRESHOLDS, finals ungated). Recomputed here
// on purpose rather than imported: a harness that calls the code it checks
// agrees with any bug in it.
const TIER_POINTS = {
  "Bronze": 1, "Silver": 2, "Gold": 4, "Continental Final": 6,
  "World Semi Final": 8, "World Final": 15, "All-Star Match": 0,
};
const TIER_THRESHOLD = { "Bronze": 0, "Silver": 15, "Gold": 40 };
function awarded(tier, won, pointsBefore) {
  if (!won) return 0;
  const threshold = TIER_THRESHOLD[tier];
  if (threshold !== undefined && pointsBefore < threshold) return 0;
  return TIER_POINTS[tier] ?? 0;
}

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

if (!fs.existsSync(SERVER)) {
  console.error(`[world-tour-competitors] FAILED: ${SERVER} not built.`);
  process.exit(1);
}

// ── server ───────────────────────────────────────────────────────────────────

function boot(dbFile, label) {
  const out = fs.openSync(path.join(WORK, `${label}.log`), "w");
  return forkServer({
    server: SERVER, electron: ELECTRON, out,
    env: {
      ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT),
      NODE_ENV: "development", SESSION_SECRET: "world-tour-competitors-secret",
    },
  });
}

async function waitUp(label) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { await fetch(`${BASE}/health`); return; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  console.error(`[world-tour-competitors] ${label}: server never came up`);
  console.error(fs.readFileSync(path.join(WORK, `${label}.log`), "utf8").slice(-3000));
  process.exit(1);
}

function session() {
  let cookie = "";
  return async function api(method, p, body) {
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
}

async function makeCareer(api, label, slot) {
  const r = await api("POST", "/profiles", { name: label });
  await api("POST", `/profiles/${r.data.id}/select`);
  const c = await api("POST", "/careers", {
    slotNumber: slot, managerName: label, managerNationality: "Australia",
    clubName: `${label} FC`, originalClubName: `${label} FC`, season: "Season 1",
    budget: "500000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a",
  });
  if (c.status >= 400) throw new Error(`career creation failed: ${JSON.stringify(c.data)}`);
  const ranking = await api("GET", "/seasons/ranking");
  return { careerSaveId: c.data.id, teamId: c.data.teamId, initialPoints: ranking.data?.rankingPoints ?? 0 };
}

/** Advance the calendar, playing every pending match, until `round` is fully played. */
async function playThroughRound(api, round, maxDays = 400) {
  for (let day = 0; day < maxDays; day++) {
    const r = await api("POST", "/calendar/advance", {});
    if (r.status >= 400) throw new Error(`advance failed ${r.status}: ${JSON.stringify(r.data)}`);
    const pending = r.data?.blocked === "pending_match" ? r.data.pendingMatchId : r.data?.matchDay?.matchId;
    if (pending) {
      const sim = await api("POST", `/matches/${pending}/simulate`, {});
      if (sim.status >= 400) throw new Error(`simulate ${pending} failed ${sim.status}: ${JSON.stringify(sim.data)}`);
      await api("POST", "/calendar/dismiss-match", {});
    }
    const fx = await api("GET", `/world-tour/fixtures?round=${round}`);
    if (fx.status === 200 && fx.data.fixtures.length > 0 && fx.data.fixtures.every((f) => f.status === "completed")) {
      return day + 1;
    }
  }
  return null;
}

// ── the checks, as pure functions so sabotage can re-run them ────────────────

/** The one-club ladder bug: the ladder must be the whole field, with one player row. */
function ladderIsWholeField(ladder, fieldSize) {
  return Array.isArray(ladder)
    && ladder.length === FIELD
    && fieldSize === ladder.length
    && ladder.filter((e) => e.isPlayer).length === 1;
}

/** Recompute every competitor's record and points from its fixtures, in round order. */
function reconcile(dbh, careerSaveId, playerCompetitorId, initialPlayerPoints) {
  const fixtures = dbh.prepare(
    `SELECT * FROM world_tour_fixtures
     WHERE career_save_id = ? AND season_year = ? AND status = 'completed'
     ORDER BY round, id`).all(careerSaveId, SEASON);
  const points = new Map([[playerCompetitorId, initialPlayerPoints]]);
  const wins = new Map(), losses = new Map();
  const get = (m, k) => m.get(k) ?? 0;
  for (const f of fixtures) {
    const homeWon = f.home_sets > f.away_sets;
    for (const [c, won] of [[f.home_competitor_id, homeWon], [f.away_competitor_id, !homeWon]]) {
      points.set(c, get(points, c) + awarded(f.tier, won, get(points, c)));
      if (won) wins.set(c, get(wins, c) + 1); else losses.set(c, get(losses, c) + 1);
    }
  }
  const rows = dbh.prepare(
    `SELECT competitor_id, ranking_points, wins, losses FROM competitor_rankings
     WHERE career_save_id = ? AND season_year = ?`).all(careerSaveId, SEASON);
  const pointMismatch = [], recordMismatch = [];
  for (const r of rows) {
    if (r.ranking_points !== get(points, r.competitor_id)) {
      pointMismatch.push(`competitor ${r.competitor_id}: table ${r.ranking_points}, recomputed ${get(points, r.competitor_id)}`);
    }
    if (r.wins !== get(wins, r.competitor_id) || r.losses !== get(losses, r.competitor_id)) {
      recordMismatch.push(`competitor ${r.competitor_id}: table ${r.wins}-${r.losses}, fixtures ${get(wins, r.competitor_id)}-${get(losses, r.competitor_id)}`);
    }
  }
  return { rows: rows.length, fixtures: fixtures.length, pointMismatch, recordMismatch };
}

/** A best-of-three beach volleyball result: 21, 21, 15, win by two. */
function legalResult(f) {
  let sets;
  try { sets = JSON.parse(f.sets ?? "null"); } catch { return false; }
  if (!Array.isArray(sets) || sets.length < 2 || sets.length > 3) return false;
  let home = 0, away = 0;
  for (let i = 0; i < sets.length; i++) {
    const target = i === 2 ? 15 : 21;
    const s = sets[i];
    const hi = Math.max(s.home, s.away), lo = Math.min(s.home, s.away);
    if (hi < target || hi - lo < 2 || (hi > target && hi - lo !== 2)) return false;
    if (s.home > s.away) home++; else away++;
  }
  return Math.max(home, away) === 2 && home === f.home_sets && away === f.away_sets;
}

function orderedByStandingsRule(ladder) {
  const key = (e) => [-e.points, -e.wins, -(e.goalsFor - e.goalsAgainst), e.losses, e.competitorId];
  for (let i = 1; i < ladder.length; i++) {
    const a = key(ladder[i - 1]), b = key(ladder[i]);
    const cmp = a.findIndex((v, j) => v !== b[j]);
    if (cmp !== -1 && a[cmp] > b[cmp]) return false;
  }
  return ladder.every((e, i) => e.rank === i + 1);
}

// ── run ──────────────────────────────────────────────────────────────────────

const dbFile = path.join(WORK, "world-tour.sqlite");
fs.copyFileSync(SHIPPED, dbFile);

console.log("=".repeat(72));
console.log("  R-29 THE WORLD TOUR IS A REAL COMPETITION, PER CAREER");
console.log("=".repeat(72));

let child = boot(dbFile, "main");
await waitUp("main");

const A = session(), B = session();
const careerA = await makeCareer(A, "WorldTourA", 1);
const careerB = await makeCareer(B, "WorldTourB", 1);
check("two careers in one database", careerA.careerSaveId !== careerB.careerSaveId,
  `A=${careerA.careerSaveId} (team ${careerA.teamId}), B=${careerB.careerSaveId} (team ${careerB.teamId})`);

const daysA = await playThroughRound(A, LAST_ROUND);
check(`career A played through World Tour round ${LAST_ROUND}`, daysA !== null, `${daysA} calendar days`);

const fixturesA11 = await A("GET", `/world-tour/fixtures?round=${FIRST_WT_ROUND}`);
const ladderA = (await A("GET", `/seasons/${(await A("GET", "/seasons/current")).data.id}/ladder`)).data;
const leaderboardA = (await A("GET", "/leaderboard")).data;

// Snapshot A's own rows before B plays: the old coin flip wrote OTHER careers'
// matches, so B's play is exactly what would have touched them.
child && await stopServer(child);
let dbh = new DatabaseSync(dbFile);
const aBefore = {
  matches: dbh.prepare(`SELECT id, status, home_score, away_score FROM matches WHERE home_team_id = ? ORDER BY id`).all(careerA.teamId),
  fixtures: dbh.prepare(`SELECT COUNT(*) AS n FROM world_tour_fixtures WHERE career_save_id = ? AND status = 'completed'`).get(careerA.careerSaveId).n,
};
dbh.close();

child = boot(dbFile, "main-b");
await waitUp("main-b");
const daysB = await playThroughRound(B, LAST_ROUND);
check(`career B played through World Tour round ${LAST_ROUND}`, daysB !== null, `${daysB} calendar days`);

const fixturesB11 = await B("GET", `/world-tour/fixtures?round=${FIRST_WT_ROUND}`);
const ladderB = (await B("GET", `/seasons/${(await B("GET", "/seasons/current")).data.id}/ladder`)).data;
const qualsB = (await B("GET", "/regional-league/qualifications")).data;
await stopServer(child);

console.log("\n1. THE FIELD");
check(`A's ladder is the whole field of ${FIELD}, one player row (was 1 row)`,
  ladderIsWholeField(ladderA, fixturesA11.data?.fieldSize), `${ladderA?.length} rows, fieldSize ${fixturesA11.data?.fieldSize}`);
check(`B's ladder is the whole field of ${FIELD}, one player row`,
  ladderIsWholeField(ladderB, fixturesB11.data?.fieldSize), `${ladderB?.length} rows, fieldSize ${fixturesB11.data?.fieldSize}`);
check(`A's leaderboard is the same ${FIELD} clubs`, Array.isArray(leaderboardA) && leaderboardA.length === FIELD,
  `${leaderboardA?.length} rows`);
const r11 = fixturesA11.data;
check(`a World Tour round is ${(FIELD - 1) / 2} fixtures, one of them the player's, with one club resting`,
  r11?.fixtures.length === (FIELD - 1) / 2 && r11.fixtures.filter((f) => f.home.isPlayer || f.away.isPlayer).length === 1
    && r11.resting.length === 1,
  `${r11?.fixtures.length} fixtures, resting: ${r11?.resting.map((x) => x.name).join(", ")}`);

dbh = new DatabaseSync(dbFile);
for (const [label, career] of [["A", careerA], ["B", careerB]]) {
  const quals = dbh.prepare(`SELECT continent, COUNT(*) AS n FROM world_tour_qualifications
    WHERE career_save_id = ? AND season_year = 1 GROUP BY continent`).all(career.careerSaveId);
  check(`${label}: ${QUALIFIERS} regional qualifiers, 3 per continent, all carrying its career_save_id`,
    quals.length === 6 && quals.every((q) => q.n === 3), JSON.stringify(quals));
}
const unscoped = dbh.prepare(`SELECT COUNT(*) AS n FROM world_tour_qualifications WHERE career_save_id IS NULL`).get().n;
check("no qualification row is written without a career", unscoped === 0, `${unscoped} unscoped`);
check("GET /regional-league/qualifications returns only this career's qualifiers",
  (qualsB?.qualifications?.length ?? 0) === QUALIFIERS
    && qualsB.qualifications.every((q) =>
      dbh.prepare(`SELECT career_save_id FROM world_tour_qualifications WHERE id = ?`).get(q.id)?.career_save_id === careerB.careerSaveId),
  `${qualsB?.qualifications?.length} rows`);

console.log(`\n2. AFTER ${ROUNDS} ROUNDS EVERY AI CLUB HAS PLAYED ITS MATCHES, FOR REAL`);
for (const [label, career] of [["A", careerA], ["B", careerB]]) {
  const playerCompetitor = dbh.prepare(`SELECT id FROM competitors WHERE team_id = ?`).get(career.teamId).id;
  const field = dbh.prepare(`SELECT r.competitor_id AS id FROM competitor_rankings r JOIN competitors c ON c.id = r.competitor_id
    WHERE r.career_save_id = ? AND r.season_year = ? AND c.pool_team_id IS NOT NULL`).all(career.careerSaveId, SEASON).map((r) => r.id);
  const fixtures = dbh.prepare(`SELECT * FROM world_tour_fixtures WHERE career_save_id = ? AND season_year = ?
    AND round BETWEEN ? AND ?`).all(career.careerSaveId, SEASON, FIRST_WT_ROUND, LAST_ROUND);

  const played = new Map(field.map((id) => [id, 0]));
  const rests = new Map(field.map((id) => [id, 0]));
  let restsPerRoundOk = true;
  for (let round = FIRST_WT_ROUND; round <= LAST_ROUND; round++) {
    const inRound = new Set(fixtures.filter((f) => f.round === round).flatMap((f) => [f.home_competitor_id, f.away_competitor_id]));
    const resting = field.filter((id) => !inRound.has(id));
    if (resting.length !== 1) restsPerRoundOk = false;
    for (const id of resting) rests.set(id, rests.get(id) + 1);
    for (const id of inRound) if (played.has(id)) played.set(id, played.get(id) + 1);
  }
  const wrongCount = field.filter((id) => played.get(id) !== ROUNDS - rests.get(id));
  check(`${label}: ${field.length} AI clubs in the field`, field.length === QUALIFIERS);
  check(`${label}: exactly one AI club rests in every round`, restsPerRoundOk);
  check(`${label}: every AI club played exactly ${ROUNDS} rounds minus its rests`, wrongCount.length === 0,
    `played ${Math.min(...played.values())}-${Math.max(...played.values())}, rests ${Math.min(...rests.values())}-${Math.max(...rests.values())}`);
  check(`${label}: every fixture in rounds ${FIRST_WT_ROUND}-${LAST_ROUND} is completed`,
    fixtures.length > 0 && fixtures.every((f) => f.status === "completed"), `${fixtures.length} fixtures`);
  const illegal = fixtures.filter((f) => !legalResult(f));
  check(`${label}: every result is a legal best-of-three (21/21/15, win by 2)`, illegal.length === 0,
    illegal.length ? `illegal: ${illegal.slice(0, 3).map((f) => f.id).join(", ")}` : `${fixtures.length} results`);
  check(`${label}: the player's own ${ROUNDS} matches are on the fixture list, linked to their match rows`,
    fixtures.filter((f) => f.home_competitor_id === playerCompetitor && f.match_id != null).length === ROUNDS);

  console.log(`\n3. ${label}: RECORDS AND POINTS RECONCILE`);
  const rec = reconcile(dbh, career.careerSaveId, playerCompetitor, career.initialPoints);
  check(`${label}: every ranking row's W/L equals its fixture results`, rec.recordMismatch.length === 0,
    rec.recordMismatch.slice(0, 3).join("; ") || `${rec.rows} rows`);
  check(`${label}: every ranking row's points equal the recomputation (tier table + gate, round order)`,
    rec.pointMismatch.length === 0, rec.pointMismatch.slice(0, 3).join("; ") || `${rec.rows} rows over ${rec.fixtures} fixtures`);
  const aiPoints = dbh.prepare(`SELECT MAX(r.ranking_points) AS hi, SUM(r.ranking_points) AS total FROM competitor_rankings r
    JOIN competitors c ON c.id = r.competitor_id WHERE r.career_save_id = ? AND c.pool_team_id IS NOT NULL`).get(career.careerSaveId);
  check(`${label}: AI clubs actually hold ranking points`, (aiPoints.total ?? 0) > 0, `total ${aiPoints.total}, best ${aiPoints.hi}`);
}

console.log("\n4. STANDINGS ORDER");
check("A's ladder is in standings order, ranked 1..N", orderedByStandingsRule(ladderA ?? []));
check("B's ladder is in standings order, ranked 1..N", orderedByStandingsRule(ladderB ?? []));

console.log("\n5. ISOLATION");
check("B's ladder contains nothing of A's club", (ladderB ?? []).every((e) => e.teamId !== careerA.teamId));
check("A's ladder contains nothing of B's club", (ladderA ?? []).every((e) => e.teamId !== careerB.teamId));
const aAfterMatches = dbh.prepare(`SELECT id, status, home_score, away_score FROM matches WHERE home_team_id = ? ORDER BY id`).all(careerA.teamId);
check("B's season wrote nothing to A's matches (the old coin flip did)",
  JSON.stringify(aAfterMatches) === JSON.stringify(aBefore.matches), `${aAfterMatches.length} A matches compared`);
const aAfterFixtures = dbh.prepare(`SELECT COUNT(*) AS n FROM world_tour_fixtures WHERE career_save_id = ? AND status = 'completed'`).get(careerA.careerSaveId).n;
check("B's season played none of A's World Tour fixtures", aAfterFixtures === aBefore.fixtures,
  `${aBefore.fixtures} -> ${aAfterFixtures}`);

// Report only: the engine should let stronger clubs win more, but a dozen
// rounds is a small sample, so this is shown rather than asserted.
const strength = dbh.prepare(`SELECT t.team_name AS name, r.wins, r.losses,
    ROUND(AVG((p.speed+p.power+p.defense+p.serve+p.block+p.stamina)/6.0), 1) AS rating
  FROM competitor_rankings r JOIN competitors c ON c.id = r.competitor_id
  JOIN continental_pool_teams t ON t.id = c.pool_team_id JOIN continental_pool_players p ON p.pool_team_id = t.id
  WHERE r.career_save_id = ? GROUP BY r.id ORDER BY rating DESC`).all(careerA.careerSaveId);
const half = Math.floor(strength.length / 2);
const winRate = (rows) => rows.reduce((s, r) => s + r.wins, 0) / Math.max(1, rows.reduce((s, r) => s + r.wins + r.losses, 0));
console.log(`  (report) A's field: stronger half wins ${(winRate(strength.slice(0, half)) * 100).toFixed(1)}%, ` +
  `weaker half ${(winRate(strength.slice(half)) * 100).toFixed(1)}%`);
dbh.close();

console.log("\n6. SABOTAGE — the checks above must catch the bugs they exist for");

// S1: the old one-row ladder. Delete A's AI ranking rows and serve it again.
const sab1 = path.join(WORK, "sabotage-one-row.sqlite");
fs.copyFileSync(dbFile, sab1);
let sdb = new DatabaseSync(sab1);
sdb.prepare(`DELETE FROM competitor_rankings WHERE career_save_id = ?
  AND competitor_id IN (SELECT id FROM competitors WHERE pool_team_id IS NOT NULL)`).run(careerA.careerSaveId);
sdb.close();
child = boot(sab1, "sabotage-one-row");
await waitUp("sabotage-one-row");
const sabSeason = await A("GET", "/seasons/current");
const sabLadder = await A("GET", `/seasons/${sabSeason.data?.id}/ladder`);
const sabFixtures = await A("GET", `/world-tour/fixtures?round=${FIRST_WT_ROUND}`);
await stopServer(child);
check("S1 setup: the sabotaged server answered for career A", sabLadder.status === 200, `HTTP ${sabLadder.status}`);
check("S1: with the AI ranking rows gone, the whole-field check FAILS (it caught the one-row ladder)",
  sabLadder.status === 200 && !ladderIsWholeField(sabLadder.data, sabFixtures.data?.fieldSize),
  `sabotaged ladder has ${sabLadder.data?.length} row(s)`);

// S2: one AI club's points nudged by a single point.
const sab2 = path.join(WORK, "sabotage-points.sqlite");
fs.copyFileSync(dbFile, sab2);
sdb = new DatabaseSync(sab2);
const victim = sdb.prepare(`SELECT r.id FROM competitor_rankings r JOIN competitors c ON c.id = r.competitor_id
  WHERE r.career_save_id = ? AND c.pool_team_id IS NOT NULL LIMIT 1`).get(careerB.careerSaveId);
sdb.prepare(`UPDATE competitor_rankings SET ranking_points = ranking_points + 1 WHERE id = ?`).run(victim.id);
const playerCompetitorB = sdb.prepare(`SELECT id FROM competitors WHERE team_id = ?`).get(careerB.teamId).id;
const sabRec = reconcile(sdb, careerB.careerSaveId, playerCompetitorB, careerB.initialPoints);
sdb.close();
check("S2: with one AI club's points off by 1, the points check FAILS (it caught it)",
  sabRec.pointMismatch.length === 1, sabRec.pointMismatch.join("; "));

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ }
process.exit(failures > 0 ? 1 : 0);
