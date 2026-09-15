/**
 * R-61 — a real Olympic tournament.
 *
 * Rob's decisions (15 Sep): Olympic years only; the 12 nations qualified under
 * R-46 play 4 groups of 3, the top two to quarter-finals, knockout to a final and
 * a bronze match, on the World Tour's match engine; each nation's pair is its two
 * highest-rated players at any club, never invented; results feed Club News and
 * trophies (medals for the players' clubs, a medal on each player's record).
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 *   code       the draw-only schedule and the manager-picked squads are gone; the
 *              tournament uses sideRating / pointProbability / simulateMatch; the
 *              rules page says what the tournament does
 *   years      a career starting 2026 plays none in 2026 or 2027, one in 2028
 *   when       played after every regular World Tour fixture, before the World
 *              Finals semi-finals are seeded, dated between round 70 and round 71
 *   field      12 nations in qualifying order, skipping only nations that cannot
 *              field two; every pair is that nation's current national pair
 *   matches    12 group matches (each group a round robin of its 3) and 8
 *              knockout (4 QF, 2 SF, bronze, gold) — the brief's harness line said
 *              16; this format plays 8; every score a real best-of-three
 *   bracket    the quarter-finalists are each group's top two, the semi-finalists
 *              the quarter-final winners, bronze the semi-final losers, gold the
 *              semi-final winners
 *   medals     exactly one gold, one silver, one bronze nation; a medal row for
 *              each of the six medallists; the player's club's medallists carry the
 *              medal; its trophies are exactly the medals and appearance it earned
 *   news       Club News reports the Games
 *
 * Usage: node harness/olympics-tournament.mjs
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
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-olympics-"));
const PORT = 4810;
const BASE = `http://localhost:${PORT}/api`;
const OLYMPIC_YEAR = 2028;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log("  R-61 A REAL OLYMPIC TOURNAMENT");
console.log("=".repeat(72));

// ── 0. Code ─────────────────────────────────────────────────────────────────
console.log("\n0. THE CODE");
const src = (p) => fs.readFileSync(path.join(REPO, p), "utf8");
const route = src("artifacts/api-server/src/routes/olympics.ts");
const engine = src("artifacts/api-server/src/utils/olympics.ts");
const schedulePage = src("artifacts/beach-volleyball/src/pages/competition/olympic-schedule.tsx");
const schema = src("lib/db/src/schema/game.ts");
const rules = src("artifacts/beach-volleyball/src/pages/rules.tsx");
check("the draw-only schedule and the manager-picked squads are gone",
  !/projected/i.test(route) && !/\/olympics\/selection|\/olympics\/countries/.test(route) && !/projected/i.test(schedulePage)
    && !/olympic_selections|olympicSelectionsTable/.test(schema)
    && !fs.existsSync(path.join(REPO, "artifacts/beach-volleyball/src/pages/locations.tsx")));
check("the tournament plays on the World Tour's engine",
  /sideRating\(/.test(engine) && /pointProbability\(home\.rating, away\.rating, \{ homeAdvantage: false \}\)/.test(engine) && /simulateMatch\(/.test(engine));
check("the rules page says what the tournament does",
  /Played in Olympic years only/.test(rules) && /two highest-rated players at any club/.test(rules)
    && /4 groups of 3/.test(rules) && /top two of each group reach the quarter-finals/.test(rules)
    && /bronze medal match and the gold medal match/.test(rules));

if (!fs.existsSync(SERVER)) { console.error(`[olympics] FAILED: ${SERVER} not built.`); process.exit(1); }
const dbFile = path.join(WORK, "olympics.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "olympics-secret" },
});
{
  const deadline = Date.now() + 60000;
  let up = false;
  while (Date.now() < deadline) { try { await fetch(`${BASE}/health`); up = true; break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  if (!up) { console.error("[olympics] server never came up"); process.exit(1); }
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

/**
 * Renew every contract that ends within the current season through the real
 * route (POST /contracts/:id/renew), as rollover.mjs does (R-48). A starting
 * squad is signed for one season; without this the club has no contracted pair
 * on the first day of 2027 and is sacked for abandonment long before 2028.
 */
async function renewExpiringContracts(api) {
  const season = (await api("GET", "/seasons/current")).data;
  const contracts = (await api("GET", "/contracts")).data;
  if (!season?.endDate || !Array.isArray(contracts)) return;
  for (const c of contracts.filter((k) => k.endDate <= season.endDate)) await api("POST", `/contracts/${c.id}/renew`);
}

/** Play a career day by day until its Olympic tournament exists. A sacked career is replaced. */
async function careerToOlympics() {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const api = session();
    const name = `Olympian${attempt}`;
    const prof = await api("POST", "/profiles", { name });
    await api("POST", `/profiles/${prof.data.id}/select`);
    const c = await api("POST", "/careers", {
      slotNumber: 1, managerName: name, managerNationality: "Australia", clubName: `${name} FC`, originalClubName: `${name} FC`,
      season: "Season 1", budget: "500000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a", difficulty: "established",
    });
    const careerSaveId = c.data.id, teamId = c.data.teamId;
    // Test setup, so the club's side of the honours (medal on the player,
    // trophies for the club) is exercised rather than checked against nothing.
    // The seeded squad is released and Australia's three free-agent seniors are
    // signed through the real routes (Australia qualified in every run so far, on
    // its pool players' points alone; USA's seniors are all in the draft pool, so
    // not free agents); then, on this harness's own copy of the database, they are
    // made the best players in the world so two of them are Australia's pair.
    {
      const season = (await api("GET", "/seasons/current")).data;
      for (const p of (await api("GET", "/team/roster")).data?.starters ?? []) await api("POST", `/players/${p.id}/release`, {});
      for (const p of (await api("GET", "/team/roster")).data?.interchanges ?? []) await api("POST", `/players/${p.id}/release`, {});
      const aus = ((await api("GET", "/players/free-agents")).data ?? []).filter((p) => p.nationality === "Australia").slice(0, 3);
      if (aus.length < 3) throw new Error(`only ${aus.length} Australian free-agent seniors to sign`);
      for (const [i, p] of aus.entries()) {
        const s = await api("POST", "/contracts", { playerId: p.id, salary: p.salary ?? 8000, endDate: season.endDate, bonusPerWin: 0, squadRole: i < 2 ? "starter" : "interchange" });
        if (s.status >= 400) throw new Error(`signing ${p.name}: ${s.status} ${JSON.stringify(s.data)}`);
      }
      const w = new DatabaseSync(dbFile);
      w.prepare(`UPDATE career_player_state SET speed = 99, power = 99, defense = 99, serve = 99, block = 99, stamina = 99
                 WHERE career_save_id = ? AND team_id = ?`).run(careerSaveId, teamId);
      w.close();
    }
    let sacked = false;
    await renewExpiringContracts(api);
    for (let day = 0; day < 1400 && !sacked; day++) {
      const r = await api("POST", "/calendar/advance", {});
      if (r.status >= 400) throw new Error(`advance ${r.status} ${JSON.stringify(r.data)}`);
      if (r.data?.fired) { sacked = true; break; }
      if (r.data?.blocked === "pending_match") {
        let sim = await api("POST", `/matches/${r.data.pendingMatchId}/simulate`, {});
        if (sim.status >= 400) sim = await api("POST", `/matches/${r.data.pendingMatchId}/forfeit`, {});
        if (sim.data?.fired) { sacked = true; break; }
        continue;
      }
      if (read(`SELECT COUNT(*) AS n FROM olympic_tournaments WHERE career_save_id = ?`, careerSaveId)[0].n > 0) {
        return { api, careerSaveId, teamId, attempt };
      }
      const roll = r.data?.seasonRollover?.kind;
      if (roll === "sacked") { sacked = true; break; }
      if (roll === "career-complete") throw new Error("the career completed without an Olympic tournament");
      if (roll && roll !== "none") await renewExpiringContracts(api);
    }
    console.log(`  (career ${attempt} was sacked before ${OLYMPIC_YEAR}; starting another)`);
  }
  throw new Error("four careers were sacked before reaching the Olympics");
}

try {
  console.log(`\n1. A CAREER PLAYED TO ${OLYMPIC_YEAR}`);
  const { api, careerSaveId, teamId, attempt } = await careerToOlympics();
  const tournaments = read(`SELECT season_year, played_on, created_at FROM olympic_tournaments WHERE career_save_id = ?`, careerSaveId);
  const seasons = read(`SELECT year, is_olympic_season FROM seasons WHERE career_save_id = ? ORDER BY year`, careerSaveId);
  check(`no Games in 2026 or 2027, one in ${OLYMPIC_YEAR}`,
    tournaments.length === 1 && tournaments[0].season_year === OLYMPIC_YEAR,
    `career ${attempt}; tournaments ${JSON.stringify(tournaments.map((t) => t.season_year))}`);
  check("only the Olympic year's season row is marked Olympic",
    seasons.length === 3 && seasons.every((s) => (s.is_olympic_season === 1) === (s.year === OLYMPIC_YEAR)),
    JSON.stringify(seasons));

  console.log("\n2. WHEN IT IS PLAYED");
  const open = read(`SELECT COUNT(*) AS n FROM world_tour_fixtures WHERE career_save_id = ? AND season_year = ? AND round <= 70 AND status = 'scheduled'`, careerSaveId, OLYMPIC_YEAR)[0].n;
  const semis = read(`SELECT created_at FROM world_tour_fixtures WHERE career_save_id = ? AND season_year = ? AND round = 71`, careerSaveId, OLYMPIC_YEAR);
  check("after every regular World Tour fixture, dated between round 70 and the World Finals",
    open === 0 && tournaments[0].played_on > `${OLYMPIC_YEAR}-11-23` && tournaments[0].played_on < `${OLYMPIC_YEAR}-11-27`,
    `played ${tournaments[0].played_on}; ${open} regular fixture(s) still open`);
  check("before the World Finals semi-finals are seeded",
    semis.length === 2 && semis.every((s) => s.created_at >= tournaments[0].created_at),
    `${semis.length} semi-final fixture(s), created ${semis.map((s) => s.created_at)} vs Games ${tournaments[0].created_at}`);

  const sched = await api("GET", "/olympics/schedule");
  const sched2 = await api("GET", "/olympics/schedule");
  const t = sched.data?.tournament;
  check("the schedule shows the tournament that was played, the same on every read",
    sched.status === 200 && t?.seasonYear === OLYMPIC_YEAR && JSON.stringify(sched.data) === JSON.stringify(sched2.data));

  console.log("\n3. THE FIELD");
  const pairsBody = (await api("GET", "/olympics/pairs")).data;
  const pairs = new Map((pairsBody?.nations ?? []).map((n) => [n.nation, n]));
  const short = (pairsBody?.nations ?? []).filter((n) => n.pair.length < 2);
  console.log(`  REPORT  ${pairsBody?.canField} nations can field a pair; ${pairsBody?.cannotField} have fewer than two eligible players: ` +
    short.map((n) => `${n.nation} (${n.eligible})`).join(", "));
  const field = t.field;
  const ranks = [...field.map((e) => e.qualifyingRank), ...t.passedOver.map((p) => p.qualifyingRank)].sort((a, b) => a - b);
  check("12 nations", field.length === 12 && new Set(field.map((e) => e.nation)).size === 12, field.map((e) => e.nation).join(", "));
  check("drawn in qualifying order, skipping only nations that cannot field two",
    field.every((e, i) => e.seed === i + 1 && (i === 0 || e.qualifyingRank > field[i - 1].qualifyingRank))
      && ranks.every((r, i) => r === i + 1)
      && t.passedOver.every((p) => p.eligible < 2),
    `ranks ${field.map((e) => e.qualifyingRank).join(",")}; passed over ${JSON.stringify(t.passedOver)}`);
  const pairWrong = field.filter((e) => {
    const now = pairs.get(e.nation);
    return !now || e.pair.length !== 2 || JSON.stringify(e.pair.map((p) => `${p.kind}:${p.id}`)) !== JSON.stringify(now.pair.map((p) => `${p.kind}:${p.id}`));
  });
  check("every pair is that nation's two highest-rated real players at any club",
    pairWrong.length === 0, pairWrong.map((e) => e.nation).join(", ") || "12 pairs match");
  const clubsInField = new Set(field.flatMap((e) => e.pair.map((p) => p.club)));
  check("real players from real clubs, never invented",
    field.every((e) => e.pair.every((p) => p.kind === "pool"
      ? read(`SELECT COUNT(*) AS n FROM continental_pool_players WHERE id = ?`, p.id)[0].n === 1
      : read(`SELECT COUNT(*) AS n FROM career_player_state WHERE career_save_id = ? AND player_id = ? AND team_id = ?`, careerSaveId, p.id, teamId)[0].n === 1)),
    `${clubsInField.size} clubs`);

  console.log("\n4. THE MATCHES");
  const rows = read(`SELECT stage, label, group_name, home_nation, away_nation, home_sets, away_sets, sets, winner_nation FROM olympic_matches WHERE career_save_id = ? AND season_year = ?`, careerSaveId, OLYMPIC_YEAR);
  const byStage = (s) => rows.filter((r) => r.stage === s);
  check("12 group matches: each group a round robin of its three nations",
    byStage("group").length === 12 && t.groups.every((g) => {
      const nations = g.standings.map((s) => s.nation).sort();
      const pairsPlayed = g.matches.map((m) => [m.home.nation, m.away.nation].sort().join("|")).sort();
      const expected = [[0, 1], [0, 2], [1, 2]].map(([a, b]) => [nations[a], nations[b]].sort().join("|")).sort();
      return g.matches.length === 3 && JSON.stringify(pairsPlayed) === JSON.stringify(expected);
    }));
  const knockout = rows.filter((r) => r.stage !== "group");
  check("8 knockout matches: 4 quarter-finals, 2 semi-finals, bronze and gold (the brief's line said 16; this format plays 8)",
    knockout.length === 8 && byStage("quarter_final").length === 4 && byStage("semi_final").length === 2
      && byStage("bronze").length === 1 && byStage("gold").length === 1,
    `${knockout.length} knockout`);
  const badScores = rows.filter((r) => {
    const sets = JSON.parse(r.sets);
    const winnerSets = Math.max(r.home_sets, r.away_sets), loserSets = Math.min(r.home_sets, r.away_sets);
    const setsOk = sets.every((s, i) => {
      const target = i >= 2 ? 15 : 21;
      const hi = Math.max(s.home, s.away), lo = Math.min(s.home, s.away);
      return hi >= target && hi - lo >= 2 && (hi === target || hi - lo === 2);
    });
    const counted = sets.filter((s) => s.home > s.away).length === r.home_sets && sets.filter((s) => s.away > s.home).length === r.away_sets;
    const winnerOk = (r.home_sets > r.away_sets ? r.home_nation : r.away_nation) === r.winner_nation;
    return !(winnerSets === 2 && loserSets <= 1 && sets.length === 2 + loserSets && setsOk && counted && winnerOk);
  });
  check("every score is a real best-of-three", badScores.length === 0 && rows.length === 20,
    badScores.slice(0, 2).map((r) => `${r.label} ${r.sets}`).join(" | ") || `${rows.length} matches`);

  console.log("\n5. THE BRACKET");
  const top = Object.fromEntries(t.groups.map((g) => [g.name, g.standings.slice(0, 2).map((s) => s.nation)]));
  const qf = t.knockout.quarterFinals.map((m) => [m.home.nation, m.away.nation]);
  const expectedQf = [[top.A[0], top.C[1]], [top.B[0], top.D[1]], [top.A[1], top.C[0]], [top.B[1], top.D[0]]];
  check("the quarter-finalists are each group's top two: A1–C2, B1–D2, A2–C1, B2–D1",
    JSON.stringify(qf) === JSON.stringify(expectedQf), JSON.stringify(qf));
  const qfWin = t.knockout.quarterFinals.map((m) => m.winner);
  const sf = t.knockout.semiFinals.map((m) => [m.home.nation, m.away.nation]);
  check("the semi-finalists are the quarter-final winners", JSON.stringify(sf) === JSON.stringify([[qfWin[0], qfWin[1]], [qfWin[2], qfWin[3]]]));
  const sfWin = t.knockout.semiFinals.map((m) => m.winner);
  const sfLose = t.knockout.semiFinals.map((m) => (m.winner === m.home.nation ? m.away.nation : m.home.nation));
  check("bronze is played by the semi-final losers, gold by the winners",
    JSON.stringify([t.knockout.bronze.home.nation, t.knockout.bronze.away.nation]) === JSON.stringify(sfLose)
      && JSON.stringify([t.knockout.gold.home.nation, t.knockout.gold.away.nation]) === JSON.stringify(sfWin));

  console.log("\n6. THE MEDALS");
  const gold = t.knockout.gold, bronze = t.knockout.bronze;
  const silverNation = gold.winner === gold.home.nation ? gold.away.nation : gold.home.nation;
  const medals = read(`SELECT medal, nation, player_kind, player_id, pool_player_id, team_id FROM olympic_medals WHERE career_save_id = ? AND season_year = ?`, careerSaveId, OLYMPIC_YEAR);
  const nationOf = (m) => [...new Set(medals.filter((r) => r.medal === m).map((r) => r.nation))];
  check("exactly one gold, one silver and one bronze nation, each with its two medallists",
    medals.length === 6 && JSON.stringify(nationOf("gold")) === JSON.stringify([gold.winner])
      && JSON.stringify(nationOf("silver")) === JSON.stringify([silverNation])
      && JSON.stringify(nationOf("bronze")) === JSON.stringify([bronze.winner])
      && t.medals.gold.nation === gold.winner,
    `gold ${gold.winner}, silver ${silverNation}, bronze ${bronze.winner}`);
  const medalIds = (m) => medals.filter((r) => r.medal === m).map((r) => `${r.player_kind}:${r.player_id ?? r.pool_player_id}`).sort();
  const pairIds = (nation) => field.find((e) => e.nation === nation).pair.map((p) => `${p.kind}:${p.id}`).sort();
  check("the medallists are the medal nations' pairs",
    JSON.stringify(medalIds("gold")) === JSON.stringify(pairIds(gold.winner))
      && JSON.stringify(medalIds("silver")) === JSON.stringify(pairIds(silverNation))
      && JSON.stringify(medalIds("bronze")) === JSON.stringify(pairIds(bronze.winner)));
  const ourInField = field.flatMap((e) => e.pair.filter((p) => p.kind === "player" && p.teamId === teamId).map((p) => `${p.name} (${e.nation})`));
  check("the club's own players were in the field, so its honours path is exercised",
    ourInField.length > 0, ourInField.join(", ") || "none of the club's players made a national pair");
  const ourMedals = medals.filter((r) => r.player_kind === "player");
  const carried = ourMedals.filter((r) =>
    read(`SELECT olympic_medals_count AS n FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, careerSaveId, r.player_id)[0]?.n >= 1);
  check("a medal is on each of the career's own medallists' records", carried.length === ourMedals.length,
    `${ourMedals.length} of the club's player(s) medalled`);
  const expectedTrophies = [];
  for (const m of ["gold", "silver", "bronze"]) {
    if (medals.some((r) => r.medal === m && r.team_id === teamId)) expectedTrophies.push(`olympic_${m}`);
  }
  if (field.some((e) => e.pair.some((p) => p.kind === "player" && p.teamId === teamId))) expectedTrophies.push("olympic_appearance");
  const trophies = read(`SELECT type FROM trophies WHERE team_id = ? AND type LIKE 'olympic_%'`, teamId).map((r) => r.type).sort();
  check("the club's Olympic trophies are exactly the medals and appearance its players earned",
    JSON.stringify(trophies) === JSON.stringify(expectedTrophies.sort()),
    `expected [${expectedTrophies.join(", ")}], got [${trophies.join(", ")}]`);

  console.log("\n7. CLUB NEWS");
  const news = (await api("GET", "/news")).data?.items ?? [];
  const item = news.find((i) => i.id === `olympic-${OLYMPIC_YEAR}`);
  check("Club News reports the Games and who won gold",
    !!item && item.type === "olympic" && item.headline.includes(gold.winner) && item.date === tournaments[0].played_on,
    item ? `"${item.headline}" ${item.date}` : `no olympic-${OLYMPIC_YEAR} item in ${news.length}`);
} catch (err) {
  check("the run reached the Olympics", false, String(err?.message ?? err));
} finally {
  await stopServer(child);
  try { fs.closeSync(out); } catch { /* closed */ }
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
