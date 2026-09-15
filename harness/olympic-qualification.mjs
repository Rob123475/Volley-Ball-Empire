/**
 * R-46 — Olympic qualification is national, on this season's World Tour points.
 *
 * ── Rob's decision ───────────────────────────────────────────────────────────
 * The Olympics are NATIONAL teams. A country qualifies on the World Tour ranking
 * points its players earned THIS SEASON (sum across that country's players,
 * whichever club they play for) — top 12 countries, ties broken by best
 * single-player total. Player ratings play no part in qualifying.
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 *   earned     playing World Tour rounds 11-16 through the calendar credits the
 *              players who played: each AI club's two players hold exactly the
 *              club's points and matches, the player's two starters hold what the
 *              club earned, nobody else holds any
 *   nations    every player resolves to one nation whatever the column's spelling
 *              ("German" pool players and "Germany" seniors are one country)
 *   season A   a high-rated country H earns few points and a low-rated country L
 *              many, split across two clubs: L qualifies and H does not; L is in
 *              only because its players are summed across clubs; a country tied
 *              on points with 12th place loses on best single-player total; the
 *              schedule draws exactly the 12 qualified nations
 *   ratings    H's players set to 99 in every stat and L's to 40: the table is
 *              identical
 *   season B   the next season starts from zero: L (no points now) is out, a
 *              different low-rated country L2 earning many is in, H is out
 *   rules      the rules page source and the shipped bundle carry the new wording,
 *              and the rating-era line is gone from both
 *   sabotage   under the old rule (ranking by rating) H would have beaten L, so
 *              the season checks cannot pass by accident
 *
 * Seasons A and B's point rows are written directly into a copy of the database:
 * it is the only way to make "a high-rated country earns few points" exact. The
 * "earned" section proves real play writes those same rows.
 *
 * Usage: node harness/olympic-qualification.mjs
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
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-olympic-qualification-"));
const PORT = 4700;
const BASE = `http://localhost:${PORT}/api`;

const PLAY_THROUGH = 16;
const SEASON_A = 2026;
const SEASON_B = 2027;
const SPOTS = 12;
const RULE_LINES = [
  "The Olympics are for national teams, not clubs",
  "A country qualifies on the World Tour ranking points its players earned this season: the sum across all of that country's players, whichever club they play for",
  "The top 12 countries qualify; ties are broken by the best single-player total",
  "Player ratings play no part in qualifying",
];
const OLD_RULE = "Top 12 World Tour teams qualify";

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

if (!fs.existsSync(SERVER)) {
  console.error(`[olympic-qualification] FAILED: ${SERVER} not built.`);
  process.exit(1);
}

// ── server ───────────────────────────────────────────────────────────────────

function boot(dbFile, label) {
  const logFile = path.join(WORK, `${label}.log`);
  const out = fs.openSync(logFile, "w");
  const child = forkServer({
    server: SERVER, electron: ELECTRON, out,
    env: {
      ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT),
      NODE_ENV: "development", SESSION_SECRET: "olympic-qualification-secret",
    },
  });
  return { child, out, logFile };
}

async function waitUp(srv, label) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { await fetch(`${BASE}/health`); return; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  console.error(`[olympic-qualification] ${label}: server never came up`);
  console.error(fs.readFileSync(srv.logFile, "utf8").slice(-3000));
  process.exit(1);
}

async function shutdown(srv) {
  await stopServer(srv.child);
  try { fs.closeSync(srv.out); } catch { /* closed */ }
}

let cookie = "";
async function api(method, p, body) {
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
}

/** Boot on the database as it stands, read qualifying and the schedule, stop. */
async function readOlympics(dbFile, label) {
  const srv = boot(dbFile, label);
  await waitUp(srv, label);
  try {
    const q = await api("GET", "/olympics/qualifiers");
    const sched = await api("GET", "/olympics/schedule");
    return { q, sched };
  } finally {
    await shutdown(srv);
  }
}

console.log("=".repeat(72));
console.log("  R-46 OLYMPIC QUALIFICATION: NATIONAL, ON THIS SEASON'S WORLD TOUR POINTS");
console.log("=".repeat(72));

// ── 1. real play ─────────────────────────────────────────────────────────────
const dbFile = path.join(WORK, "olympics.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
let careerSaveId = null, teamId = null, initialPoints = 0;
{
  const srv = boot(dbFile, "career");
  await waitUp(srv, "career");
  try {
    const prof = await api("POST", "/profiles", { name: "Olympics" });
    await api("POST", `/profiles/${prof.data.id}/select`);
    const c = await api("POST", "/careers", {
      slotNumber: 1, managerName: "Olympics", managerNationality: "Australia",
      clubName: "Olympic Road FC", originalClubName: "Olympic Road FC", season: "Season 1",
      budget: "500000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a",
    });
    check("career created", c.status === 200, `HTTP ${c.status}`);
    careerSaveId = c.data.id;
    teamId = c.data.teamId;
    initialPoints = (await api("GET", "/seasons/ranking")).data?.rankingPoints ?? 0;

    let decided = false, trouble = "";
    for (let day = 0; day < 400 && !decided && !trouble; day++) {
      const adv = await api("POST", "/calendar/advance", {});
      if (adv.status >= 400) { trouble = `advance ${adv.status} ${JSON.stringify(adv.data)}`; break; }
      const pending = adv.data?.blocked === "pending_match" ? adv.data.pendingMatchId : adv.data?.matchDay?.matchId;
      if (pending) {
        const sim = await api("POST", `/matches/${pending}/simulate`, {});
        if (sim.status >= 400) { trouble = `simulate ${sim.status} ${JSON.stringify(sim.data)}`; break; }
        if (sim.data?.fired) { trouble = "the career was sacked (R-47) before the round was reached"; break; }
        await api("POST", "/calendar/dismiss-match", {});
      }
      const fx = await api("GET", `/world-tour/fixtures?round=${PLAY_THROUGH}`);
      decided = fx.status === 200 && fx.data.fixtures.length > 0
        && fx.data.fixtures.every((f) => f.status === "completed" || f.bye);
    }
    check(`the calendar played the World Tour through round ${PLAY_THROUGH}`, decided && !trouble, trouble);
  } finally {
    await shutdown(srv);
  }
}

console.log("\n1. REAL PLAY CREDITS THE PLAYERS WHO EARNED THE POINTS");
let d = new DatabaseSync(dbFile);
const clubs = d.prepare(
  `SELECT r.competitor_id AS id, r.ranking_points AS points, r.wins + r.losses AS matches,
          c.team_id AS teamId, c.pool_team_id AS poolTeamId
   FROM competitor_rankings r JOIN competitors c ON c.id = r.competitor_id
   WHERE r.career_save_id = ? AND r.season_year = ?`).all(careerSaveId, SEASON_A);
const earnedRows = d.prepare(
  `SELECT * FROM player_ranking_points WHERE career_save_id = ? AND season_year = ?`).all(careerSaveId, SEASON_A);
const aiClubs = clubs.filter((c) => c.poolTeamId != null);
const aiWrong = [];
for (const c of aiClubs) {
  const pair = d.prepare(`SELECT id FROM continental_pool_players WHERE pool_team_id = ?`).all(c.poolTeamId).map((p) => p.id);
  const mine = earnedRows.filter((r) => r.competitor_id === c.id);
  const ok = pair.length === 2 && mine.length === 2 && pair.every((pid) => {
    const r = mine.find((x) => x.pool_player_id === pid);
    return r && r.ranking_points === c.points && r.matches === c.matches;
  });
  if (!ok) {
    aiWrong.push(`club ${c.id} ${c.points}pts/${c.matches}m rows ${JSON.stringify(mine.map((r) => [r.pool_player_id, r.ranking_points, r.matches]))}`);
  }
}
check(`each AI club's two players hold exactly the club's points and matches`,
  aiClubs.length === 18 && aiWrong.length === 0, aiWrong.slice(0, 3).join(" | ") || `${aiClubs.length} clubs`);

const own = clubs.find((c) => c.teamId === teamId);
const starters = d.prepare(
  `SELECT player_id FROM career_player_state WHERE career_save_id = ? AND team_id = ? AND squad_role = 'starter'`)
  .all(careerSaveId, teamId).map((r) => r.player_id);
const ownRows = earnedRows.filter((r) => r.competitor_id === own?.id);
check("the player's club: each of its two starters holds what the club earned and its matches",
  !!own && starters.length === 2 && ownRows.length === 2 && starters.every((pid) => {
    const r = ownRows.find((x) => x.player_id === pid);
    return r && r.ranking_points === own.points - initialPoints && r.matches === own.matches;
  }),
  `club ${own?.points} pts (started at ${initialPoints}), ${own?.matches} matches; rows ${JSON.stringify(ownRows.map((r) => [r.player_id, r.ranking_points, r.matches]))}`);
check("nobody else holds points: the interchange and reserves did not play",
  earnedRows.length === aiClubs.length * 2 + 2, `${earnedRows.length} rows`);
check("AI players actually earned points", earnedRows.some((r) => r.pool_player_id != null && r.ranking_points > 0));

// ── 2. every player, one nation ──────────────────────────────────────────────
const ownCompetitor = own?.id;
const now = Math.floor(Date.now() / 1000);
const poolPlayers = d.prepare(
  `SELECT id, pool_team_id, nationality, speed, power, defense, serve, block, stamina FROM continental_pool_players`).all();
const seniors = d.prepare(
  `SELECT s.player_id AS id, p.nationality, s.speed, s.power, s.defense, s.serve, s.block, s.stamina
   FROM career_player_state s JOIN players p ON p.id = s.player_id
   WHERE s.career_save_id = ? AND p.player_type = 'senior'`).all(careerSaveId);

/** A zero-point row for every pool player and senior, so every nation is listed. */
function seedZeros(db, year) {
  const ins = db.prepare(
    `INSERT INTO player_ranking_points (career_save_id, season_year, competitor_id, player_id, pool_player_id, ranking_points, matches, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, 0, ?)`);
  for (const p of poolPlayers) ins.run(careerSaveId, year, ownCompetitor, null, p.id, now);
  for (const p of seniors) ins.run(careerSaveId, year, ownCompetitor, p.id, null, now);
}
function setPoints(db, year, player, points, competitorId = ownCompetitor) {
  const col = player.kind === "pool" ? "pool_player_id" : "player_id";
  const info = db.prepare(
    `UPDATE player_ranking_points SET ranking_points = ?, matches = ?, competitor_id = ?
     WHERE career_save_id = ? AND season_year = ? AND ${col} = ?`)
    .run(points, points > 0 ? 1 : 0, competitorId, careerSaveId, year, player.id);
  if (info.changes !== 1) throw new Error(`seed: ${player.kind} ${player.id} matched ${info.changes} rows`);
}
function poolClubCompetitor(db, poolPlayerId) {
  const { pool_team_id: poolTeamId } = db.prepare(`SELECT pool_team_id FROM continental_pool_players WHERE id = ?`).get(poolPlayerId);
  let row = db.prepare(`SELECT id FROM competitors WHERE pool_team_id = ?`).get(poolTeamId);
  if (!row) {
    db.prepare(`INSERT INTO competitors (pool_team_id, created_at) VALUES (?, ?)`).run(poolTeamId, now);
    row = db.prepare(`SELECT id FROM competitors WHERE pool_team_id = ?`).get(poolTeamId);
  }
  return row.id;
}

d.prepare(`DELETE FROM player_ranking_points WHERE career_save_id = ?`).run(careerSaveId);
seedZeros(d, SEASON_A);
d.close();

console.log("\n2. EVERY PLAYER BELONGS TO ONE NATION, WHATEVER THE SPELLING");
let { q } = await readOlympics(dbFile, "nations");
check("GET /olympics/qualifiers answers", q.status === 200, `HTTP ${q.status}`);
const nations = q.data?.countries ?? [];
const unresolved = nations.filter((c) => !c.resolved);
check("every player's nationality resolves to a nation",
  nations.length > 0 && unresolved.length === 0,
  unresolved.map((c) => c.country).join(", ") || `${nations.length} nations from ${poolPlayers.length + seniors.length} players`);
check("no nation is listed twice", new Set(nations.map((c) => c.country)).size === nations.length);
const germanSpellings = new Set((nations.find((c) => c.country === "Germany")?.players ?? []).map((p) => p.nationality));
check("\"German\" pool players and \"Germany\" seniors are one country",
  germanSpellings.has("German") && germanSpellings.has("Germany"), [...germanSpellings].join(" + "));
check("Hawaii's pool players represent the USA",
  (nations.find((c) => c.country === "USA")?.players ?? []).some((p) => p.nationality === "Hawaiian"));

// Ratings, computed here the way the old rule did: mean of the best two players' six stats.
const statMean = (p) => (p.speed + p.power + p.defense + p.serve + p.block + p.stamina) / 6;
const poolById = new Map(poolPlayers.map((p) => [p.id, p]));
const seniorById = new Map(seniors.map((p) => [p.id, p]));
function rating(country) {
  const means = country.players
    .map((pl) => statMean(pl.kind === "pool" ? poolById.get(pl.id) : seniorById.get(pl.id)))
    .sort((a, b) => b - a)
    .slice(0, 2);
  return means.reduce((s, m) => s + m, 0) / means.length;
}
const rated = nations.map((c) => ({ c, r: rating(c) }));
const crossClub = rated
  .filter(({ c }) => c.players.some((p) => p.kind === "pool") && c.players.some((p) => p.kind === "player"))
  .sort((a, b) => a.r - b.r);
const L = crossClub[0].c;
const L2 = crossClub[1].c;
const H = rated.filter(({ c }) => c !== L && c !== L2).sort((a, b) => b.r - a.r)[0].c;
const others = rated.map(({ c }) => c).filter((c) => c !== L && c !== L2 && c !== H);
const T = others.find((c) => c.players.length >= 2);
const fillers = others.filter((c) => c !== T).slice(0, SPOTS - 1);
check(`the scenario is real: ${H.country} is rated above ${L.country} and ${L2.country}`,
  rating(H) > rating(L) && rating(H) > rating(L2) && fillers.length === SPOTS - 1 && !!T,
  `${H.country} ${rating(H).toFixed(1)}, ${L.country} ${rating(L).toFixed(1)}, ${L2.country} ${rating(L2).toFixed(1)}`);

// ── 3. season A ─────────────────────────────────────────────────────────────
console.log(`\n3. SEASON ${SEASON_A}: ${L.country.toUpperCase()} (LOW-RATED) EARNS MANY, ${H.country.toUpperCase()} (HIGH-RATED) FEW`);
d = new DatabaseSync(dbFile);
const lPool = L.players.find((p) => p.kind === "pool");
const lSenior = L.players.find((p) => p.kind === "player");
setPoints(d, SEASON_A, lPool, 25, poolClubCompetitor(d, lPool.id));   // at its own pool club
setPoints(d, SEASON_A, lSenior, 20);                                    // at the player's club
setPoints(d, SEASON_A, T.players[0], 20);
setPoints(d, SEASON_A, T.players[1], 20);
for (const f of fillers) setPoints(d, SEASON_A, f.players[0], 40);
setPoints(d, SEASON_A, H.players[0], 5);
d.close();

let read = await readOlympics(dbFile, "season-a");
const A = read.q.data?.countries ?? [];
const find = (list, name) => list.find((c) => c.country === name);
const aL = find(A, L.country), aH = find(A, H.country), aT = find(A, T.country);
const twelfth = A.find((c) => c.rank === SPOTS);
check(`exactly ${SPOTS} countries qualify`, A.filter((c) => c.qualified).length === SPOTS);
check(`${L.country} (low-rated) qualifies on ${aL?.points} points`, !!aL?.qualified, `rank ${aL?.rank}`);
check(`${H.country} (high-rated) does not qualify on ${aH?.points} points`, !!aH && !aH.qualified, `rank ${aH?.rank}`);
check(`${L.country} is in only because its players are summed across clubs`,
  aL?.points === 45 && aL.bestPlayerPoints === 25 && !!twelfth && aL.bestPlayerPoints < twelfth.points
    && new Set(aL.players.flatMap((p) => p.clubs)).size >= 2,
  `total ${aL?.points}, best single ${aL?.bestPlayerPoints}, 12th place ${twelfth?.points}, clubs ${JSON.stringify([...new Set((aL?.players ?? []).flatMap((p) => p.clubs))])}`);
const tiedIn = A.filter((c) => c.qualified && c.points === aT?.points);
check(`a tie on points is broken by best single-player total: ${T.country} (${aT?.points}, best ${aT?.bestPlayerPoints}) is out`,
  !!aT && !aT.qualified && tiedIn.length > 0
    && tiedIn.every((c) => c.bestPlayerPoints > aT.bestPlayerPoints && c.rank < aT.rank),
  `rank ${aT?.rank}; ${tiedIn.length} qualified on the same points with best ${tiedIn[0]?.bestPlayerPoints}`);
// R-61: the schedule no longer projects a draw. Outside an Olympic year it holds
// no tournament and names the next Games; the tournament itself is
// harness/olympics-tournament.mjs.
const sched = read.sched.data ?? {};
check("the Olympic schedule invents nothing: no tournament outside an Olympic year, and the next Games named",
  read.sched.status === 200 && sched.tournament === null && sched.isOlympicYear === false
    && sched.olympicsYear % 4 === 0 && sched.olympicsYear > sched.seasonYear,
  JSON.stringify({ seasonYear: sched.seasonYear, isOlympicYear: sched.isOlympicYear, olympicsYear: sched.olympicsYear, tournament: sched.tournament }));

// Sabotage: the old rule, ranking by rating, would have put H in and L out.
const byRating = [...A].sort((a, b) => rating(b) - rating(a)).slice(0, SPOTS).map((c) => c.country);
check(`S1: under the old rating rule ${H.country} would qualify and ${L.country} would not (the checks above discriminate)`,
  byRating.includes(H.country) && !byRating.includes(L.country));

// ── 4. ratings play no part ──────────────────────────────────────────────────
console.log("\n4. RATINGS PLAY NO PART");
d = new DatabaseSync(dbFile);
function setStats(player, v) {
  if (player.kind === "pool") {
    d.prepare(`UPDATE continental_pool_players SET speed = ?, power = ?, defense = ?, serve = ?, block = ?, stamina = ? WHERE id = ?`)
      .run(v, v, v, v, v, v, player.id);
  } else {
    d.prepare(`UPDATE career_player_state SET speed = ?, power = ?, defense = ?, serve = ?, block = ?, stamina = ? WHERE career_save_id = ? AND player_id = ?`)
      .run(v, v, v, v, v, v, careerSaveId, player.id);
    d.prepare(`UPDATE players SET speed = ?, power = ?, defense = ?, serve = ?, block = ?, stamina = ? WHERE id = ?`)
      .run(v, v, v, v, v, v, player.id);
  }
}
for (const p of H.players) setStats(p, 99);
for (const p of L.players) setStats(p, 40);
d.close();
const table = (list) => JSON.stringify(list.map((c) => [c.rank, c.country, c.points, c.bestPlayerPoints, c.qualified]));
read = await readOlympics(dbFile, "ratings-swapped");
check(`${H.country}'s players at 99 in every stat and ${L.country}'s at 40: the qualifying table is identical`,
  table(read.q.data?.countries ?? []) === table(A));

// ── 5. season B ─────────────────────────────────────────────────────────────
console.log(`\n5. SEASON ${SEASON_B} STARTS FROM ZERO`);
d = new DatabaseSync(dbFile);
d.prepare(`UPDATE seasons SET status = 'completed' WHERE career_save_id = ? AND year = ?`).run(careerSaveId, SEASON_A);
d.prepare(
  `INSERT INTO seasons (career_save_id, year, name, status, total_rounds, current_round, start_date, end_date,
     is_olympic_season, regional_rounds_processed, created_at)
   VALUES (?, ?, 'Season 2', 'active', 78, 1, '2027-01-01', '2027-12-31', 0, 0, ?)`).run(careerSaveId, SEASON_B, now);
seedZeros(d, SEASON_B);
const l2Pool = L2.players.find((p) => p.kind === "pool");
const l2Senior = L2.players.find((p) => p.kind === "player");
setPoints(d, SEASON_B, l2Pool, 30, poolClubCompetitor(d, l2Pool.id));
setPoints(d, SEASON_B, l2Senior, 30);
for (const f of fillers) setPoints(d, SEASON_B, f.players[0], 35);
setPoints(d, SEASON_B, H.players[0], 3);
d.close();

read = await readOlympics(dbFile, "season-b");
const B = read.q.data?.countries ?? [];
const bL = find(B, L.country), bL2 = find(B, L2.country), bH = find(B, H.country);
check(`qualifying reads season ${SEASON_B}`, read.q.data?.seasonYear === SEASON_B, `seasonYear ${read.q.data?.seasonYear}`);
check(`${L2.country} (low-rated) qualifies on ${bL2?.points} points earned this season`, !!bL2?.qualified, `rank ${bL2?.rank}`);
check(`${H.country} (high-rated) does not qualify on ${bH?.points} points`, !!bH && !bH.qualified, `rank ${bH?.rank}`);
check(`${L.country}'s ${SEASON_A} points do not carry: 0 this season, not qualified`,
  !!bL && bL.points === 0 && !bL.qualified, `points ${bL?.points}, rank ${bL?.rank}`);

// ── 6. the rules page ────────────────────────────────────────────────────────
console.log("\n6. THE RULES PAGE SAYS EXACTLY THIS");
const rulesSrc = fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", "pages", "rules.tsx"), "utf8");
const assetsDir = path.join(REPO, "artifacts", "api-server", "dist", "public", "assets");
const bundle = fs.readdirSync(assetsDir).filter((f) => f.endsWith(".js"))
  .map((f) => fs.readFileSync(path.join(assetsDir, f), "utf8")).join("\n");
for (const line of RULE_LINES) {
  check(`source and shipped bundle carry: "${line}"`, rulesSrc.includes(line) && bundle.includes(line),
    `source ${rulesSrc.includes(line)}, bundle ${bundle.includes(line)}`);
}
check(`the rating-era line is gone from both: "${OLD_RULE}"`, !rulesSrc.includes(OLD_RULE) && !bundle.includes(OLD_RULE));

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
