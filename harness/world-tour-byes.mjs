/**
 * R-44 — World Tour byes.
 *
 * ── Rob's decision ───────────────────────────────────────────────────────────
 * Keep the 19-club World Tour field (18 regional qualifiers + the player). The
 * resting club each round gets an explicit BYE: it appears in that club's fixture
 * list and in the round view as "Bye", never as a missing match, and it earns 0
 * points. If the player's club has the bye, the dashboard's Next Match card says
 * so and Advance still works.
 *
 * Every club playing exactly the same number of matches AND having exactly one bye
 * per 19 rounds is only possible when the season is a whole number of 19-round
 * cycles, so the regular World Tour became 57 rounds (three Bronze events came off).
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 * One career walked through the entire regular World Tour by the calendar, every
 * player match played through POST /matches/:id/simulate. Then:
 *
 *   schedule   57 event rounds; the removed slots (41, 51, 61) hold nothing
 *   rounds     every event round is 9 matches + exactly 1 bye row
 *   equality   every one of the 19 clubs: exactly 54 matches and exactly 3 byes,
 *              one bye in each 19-round cycle
 *   zero       a bye has no score, and each club's ranking row counts exactly its
 *              54 matches: W+L = 54, points = an independent recomputation from
 *              its completed matches only
 *   visible    the player's byes are on GET /matches/fixture as status "bye",
 *              "Bye", no purse; the round view shows a Bye entry for the club
 *   dashboard  when the player's next round is a bye, GET /dashboard says so
 *   advance    the calendar walks straight through the player's byes: no pending
 *              match ever points at a bye, and the rest of the field plays those
 *              rounds
 *
 * Usage: node harness/world-tour-byes.mjs
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
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-world-tour-byes-"));
const PORT = 4680;
const BASE = `http://localhost:${PORT}/api`;

const SEASON = 2026;
const FIELD = 19;
const CYCLE = 19;
const EVENT_ROUNDS = 57;
const MATCHES_EACH = 54;
const BYES_EACH = 3;
const REMOVED_ROUNDS = [41, 51, 61];
const LAST_EVENT_ROUND = 70;

// Mirrors utils/rankingPoints.ts and utils/tierQualification.ts on purpose.
const TIER_POINTS = { "Bronze": 1, "Silver": 2, "Gold": 4, "World Semi Final": 8, "World Final": 15 };
const TIER_THRESHOLD = { "Bronze": 0, "Silver": 15, "Gold": 40 };
function awarded(tier, won, before) {
  if (!won) return 0;
  const t = TIER_THRESHOLD[tier];
  if (t !== undefined && before < t) return 0;
  return TIER_POINTS[tier] ?? 0;
}

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

if (!fs.existsSync(SERVER)) {
  console.error(`[world-tour-byes] FAILED: ${SERVER} not built.`);
  process.exit(1);
}

const dbFile = path.join(WORK, "byes.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: {
    ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT),
    NODE_ENV: "development", SESSION_SECRET: "world-tour-byes-secret",
  },
});

{
  const deadline = Date.now() + 60000;
  let up = false;
  while (Date.now() < deadline) {
    try { await fetch(`${BASE}/health`); up = true; break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  if (!up) {
    console.error("[world-tour-byes] server never came up");
    console.error(fs.readFileSync(path.join(WORK, "server.log"), "utf8").slice(-3000));
    process.exit(1);
  }
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

console.log("=".repeat(72));
console.log("  R-44 WORLD TOUR BYES — A FULL REGULAR SEASON");
console.log("=".repeat(72));

let teamId = null, careerSaveId = null, initialPoints = 0;
let dashboardBye = null;
let pendingOnBye = [];
let advanceErrors = [];
let playerFixtureRows = [];
let roundViewBye = null;

try {
  const prof = await api("POST", "/profiles", { name: "ByeSeason" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const c = await api("POST", "/careers", {
    slotNumber: 1, managerName: "ByeSeason", managerNationality: "Australia",
    clubName: "Bye Season FC", originalClubName: "Bye Season FC", season: "Season 1",
    budget: "500000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a",
  });
  check("career created", c.status === 200, `HTTP ${c.status}`);
  teamId = c.data.teamId;
  careerSaveId = c.data.id;
  initialPoints = (await api("GET", "/seasons/ranking")).data?.rankingPoints ?? 0;

  let seasonDone = false;
  for (let day = 0; day < 520 && !seasonDone; day++) {
    const adv = await api("POST", "/calendar/advance", {});
    if (adv.status >= 400) { advanceErrors.push(`${adv.status} ${JSON.stringify(adv.data)}`); break; }
    const pending = adv.data?.blocked === "pending_match" ? adv.data.pendingMatchId : adv.data?.matchDay?.matchId;
    if (pending) {
      const m = await api("GET", `/matches/${pending}`);
      if (m.data?.status === "bye") pendingOnBye.push(m.data.round);
      const sim = await api("POST", `/matches/${pending}/simulate`, {});
      if (sim.status >= 400) { advanceErrors.push(`simulate ${pending}: ${sim.status} ${JSON.stringify(sim.data)}`); break; }
      await api("POST", "/calendar/dismiss-match", {});
    }

    // Once the draw exists: the first time the player's next round is a bye, the
    // dashboard's Next Match card must say so.
    if (!dashboardBye) {
      const fx = await api("GET", "/matches/fixture");
      const rows = (Array.isArray(fx.data) ? fx.data : []).filter((r) => r.round <= LAST_EVENT_ROUND)
        .sort((a, b) => a.round - b.round);
      const next = rows.find((r) => ["scheduled", "in_progress", "bye"].includes(r.status));
      if (next?.status === "bye") {
        const dash = await api("GET", "/dashboard");
        dashboardBye = { expected: next.round, got: dash.data?.nextBye?.round ?? null, nextMatchRound: dash.data?.nextMatch?.round ?? null };
      }
    }

    const last = await api("GET", `/world-tour/fixtures?round=${LAST_EVENT_ROUND}`);
    seasonDone = last.status === 200 && last.data.fixtures.length > 0
      && last.data.fixtures.every((f) => f.status === "completed" || f.status === "bye");
  }
  check("the calendar walked the whole regular World Tour with no error", advanceErrors.length === 0 && seasonDone,
    advanceErrors.join(" | ") || `last round ${LAST_EVENT_ROUND} decided`);

  const fx = await api("GET", "/matches/fixture");
  playerFixtureRows = Array.isArray(fx.data) ? fx.data : [];
  const firstPlayerBye = playerFixtureRows.find((r) => r.status === "bye");
  if (firstPlayerBye) {
    const view = await api("GET", `/world-tour/fixtures?round=${firstPlayerBye.round}`);
    roundViewBye = (view.data?.fixtures ?? []).find((f) => f.bye && f.home.isPlayer) ?? null;
  }
} finally {
  await stopServer(child);
  try { fs.closeSync(out); } catch { /* closed */ }
}

console.log("\n1. THE SCHEDULE");
const dbh = new DatabaseSync(dbFile, { readOnly: true });
const fixtures = dbh.prepare(
  `SELECT * FROM world_tour_fixtures WHERE career_save_id = ? AND season_year = ? AND round <= ? ORDER BY round, id`,
).all(careerSaveId, SEASON, LAST_EVENT_ROUND);
const rounds = [...new Set(fixtures.map((f) => f.round))].sort((a, b) => a - b);
check(`${EVENT_ROUNDS} World Tour event rounds were drawn`, rounds.length === EVENT_ROUNDS, `${rounds.length} rounds`);
const onRemoved = fixtures.filter((f) => REMOVED_ROUNDS.includes(f.round)).length
  + dbh.prepare(`SELECT COUNT(*) AS n FROM matches WHERE home_team_id = ? AND round IN (41, 51, 61)`).get(teamId).n;
check("the three removed slots (41, 51, 61) hold no fixture and no player match", onRemoved === 0, `${onRemoved} rows`);

console.log("\n2. EVERY ROUND IS 9 MATCHES AND ONE BYE");
const badRounds = rounds.filter((r) => {
  const inRound = fixtures.filter((f) => f.round === r);
  return inRound.filter((f) => f.status !== "bye").length !== (FIELD - 1) / 2
    || inRound.filter((f) => f.status === "bye").length !== 1;
});
check("every event round: 9 matches + exactly 1 bye", badRounds.length === 0,
  badRounds.length ? `wrong: ${badRounds.join(", ")}` : `${rounds.length} rounds`);
const byeRows = fixtures.filter((f) => f.status === "bye");
check("a bye row is one club, unscored", byeRows.every((f) =>
  f.home_competitor_id === f.away_competitor_id && f.home_sets == null && f.away_sets == null && f.sets == null),
  `${byeRows.length} bye rows`);
const matchRows = fixtures.filter((f) => f.status !== "bye");
check("every match in the regular season is completed", matchRows.every((f) => f.status === "completed"),
  `${matchRows.length} matches`);

console.log(`\n3. EVERY CLUB: ${MATCHES_EACH} MATCHES, ${BYES_EACH} BYES, ONE BYE PER ${CYCLE} ROUNDS`);
const clubs = [...new Set(fixtures.flatMap((f) => [f.home_competitor_id, f.away_competitor_id]))];
check(`${FIELD} clubs in the field`, clubs.length === FIELD, `${clubs.length}`);
const perClub = clubs.map((id) => {
  const matches = matchRows.filter((f) => f.home_competitor_id === id || f.away_competitor_id === id).length;
  const byeIdx = byeRows.filter((f) => f.home_competitor_id === id).map((f) => rounds.indexOf(f.round));
  const perCycle = [0, 1, 2].map((c) => byeIdx.filter((i) => Math.floor(i / CYCLE) === c).length);
  return { id, matches, byes: byeIdx.length, perCycle };
});
const unequal = perClub.filter((c) => c.matches !== MATCHES_EACH || c.byes !== BYES_EACH);
check(`every club has exactly ${MATCHES_EACH} matches and exactly ${BYES_EACH} byes`, unequal.length === 0,
  unequal.length ? unequal.map((c) => `#${c.id}: ${c.matches}m/${c.byes}b`).join(", ")
    : `matches ${Math.min(...perClub.map((c) => c.matches))}-${Math.max(...perClub.map((c) => c.matches))}`);
const offCycle = perClub.filter((c) => c.perCycle.some((n) => n !== 1));
check(`every club has exactly one bye in each ${CYCLE}-round cycle`, offCycle.length === 0,
  offCycle.length ? offCycle.map((c) => `#${c.id}: ${c.perCycle.join("/")}`).join(", ") : "3 cycles × 19 clubs");

console.log("\n4. A BYE EARNS NOTHING");
const playerCompetitor = dbh.prepare(`SELECT id FROM competitors WHERE team_id = ?`).get(teamId).id;
const rankings = dbh.prepare(
  `SELECT competitor_id, ranking_points, wins, losses FROM competitor_rankings WHERE career_save_id = ? AND season_year = ?`,
).all(careerSaveId, SEASON);
const wlWrong = rankings.filter((r) => clubs.includes(r.competitor_id) && r.wins + r.losses !== MATCHES_EACH);
check(`every club's ranking row counts exactly its ${MATCHES_EACH} matches (a bye is no W or L)`, wlWrong.length === 0,
  wlWrong.map((r) => `#${r.competitor_id}: ${r.wins + r.losses}`).join(", ") || `${rankings.length} rows`);
const pts = new Map([[playerCompetitor, initialPoints]]);
for (const f of matchRows) {
  const homeWon = f.home_sets > f.away_sets;
  for (const [cId, won] of [[f.home_competitor_id, homeWon], [f.away_competitor_id, !homeWon]]) {
    const before = pts.get(cId) ?? 0;
    pts.set(cId, before + awarded(f.tier, won, before));
  }
}
const ptsWrong = rankings.filter((r) => clubs.includes(r.competitor_id) && r.ranking_points !== (pts.get(r.competitor_id) ?? 0));
check("every club's points equal a recomputation from its matches alone", ptsWrong.length === 0,
  ptsWrong.map((r) => `#${r.competitor_id}: ${r.ranking_points} vs ${pts.get(r.competitor_id)}`).join(", ") || "19 clubs");

console.log("\n5. THE PLAYER'S BYE IS VISIBLE, AND ADVANCE GOES THROUGH IT");
const playerByes = playerFixtureRows.filter((r) => r.status === "bye");
check(`the player's fixture list shows its ${BYES_EACH} byes as "Bye" with no purse`,
  playerByes.length === BYES_EACH && playerByes.every((r) => r.awayTeamName === "Bye" && Number(r.prizeAmount ?? 0) === 0),
  playerByes.map((r) => `R${r.round} ${r.awayTeamName} $${r.prizeAmount}`).join(", "));
const playerByeFixtures = byeRows.filter((f) => f.home_competitor_id === playerCompetitor);
check("each player bye row is linked to that bye on the club's own match list",
  playerByeFixtures.length === BYES_EACH && playerByeFixtures.every((f) =>
    playerByes.some((r) => r.id === f.match_id)), `${playerByeFixtures.length} linked`);
check("the round view shows the player's club as a Bye, not as a missing match",
  !!roundViewBye && roundViewBye.home.isPlayer && roundViewBye.bye === true,
  roundViewBye ? `R${roundViewBye.round}: ${roundViewBye.home.name} bye` : "no bye entry found");
check("the dashboard's Next Match card reports the player's upcoming bye",
  !!dashboardBye && dashboardBye.got === dashboardBye.expected
    && (dashboardBye.nextMatchRound == null || dashboardBye.nextMatchRound > dashboardBye.expected),
  JSON.stringify(dashboardBye));
check("no pending match ever pointed at a bye (Advance walks through it)", pendingOnBye.length === 0,
  pendingOnBye.length ? `pending on bye rounds ${pendingOnBye.join(", ")}` : "none");
const byeRoundsPlayed = playerByeFixtures.every((b) =>
  matchRows.filter((f) => f.round === b.round).every((f) => f.status === "completed"));
check("the rest of the field played every round the player had a bye", byeRoundsPlayed,
  playerByeFixtures.map((b) => `R${b.round}`).join(", "));
dbh.close();

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
