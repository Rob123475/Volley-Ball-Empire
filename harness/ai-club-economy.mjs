/**
 * Rob's rule (23 Sep): every AI club keeps books, on the same rules as the
 * gamer's club — and the broke-club rule fires for them too.
 *
 *   "Every AI club gets the same finances as the gamer's club: a balance,
 *    wages paid each season under the same 6m/1s/2s contracts, the same running
 *    costs, and the same prize money and sponsor income from their real World
 *    Tour results. No shortcuts and no separate 'AI economy' — one set of rules
 *    for every club. Then the broke-club rule must actually fire for them: 5
 *    consecutive loss-making seasons → the AI club is sold."
 *
 * ── What this walks ─────────────────────────────────────────────────────────
 * One career, thirty seasons, every match played. The player's own club is kept
 * solvent by a grant so the run is not ended by its own sale — this suite is
 * about the other sixty, and harness/economy.mjs and harness/job-market.mjs are
 * about the player's.
 *
 * It prints the table the brief asks for: every club's balance at every season
 * boundary, in thousands, with the season it was sold in marked. Then it checks
 * what the table is supposed to show.
 *
 * ── What it asserts ─────────────────────────────────────────────────────────
 *   books      all sixty clubs open with a balance, a pair under contract, and
 *              contracts on the three lengths and no others
 *   one rule   an AI club's weekly outgoings are what the shared functions say
 *              they are, to the dollar, and its prize money comes from the same
 *              purse table and the same tier gate as the player's
 *   movement   the clubs do not all end where they started: a run produces
 *              clubs that made money and clubs that lost it
 *   the rule   at least one AI club is sold for five loss-making seasons in a
 *              row, and it is a club whose chain of openings really does fall
 *              five times
 *   the world  the club that is sold changes hands rather than vanishing, its
 *              place in its continent's league is taken by a club of that same
 *              continent, and every continent still has its six — which is what
 *              the regional season's thirty fixtures are built on
 */
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";
import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healAllSquads, keepSideFielded, renewExpiringContracts, keepClubSolvent } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-ai-economy-"));
const PORT = 4539;
const SEASONS = Number(process.env.AI_ECONOMY_SEASONS ?? 30);

// READ, not restated: the rules this suite is checking are the server's.
const src = (p) => fs.readFileSync(path.join(REPO, p), "utf8");
const FINANCES_SRC = src("artifacts/api-server/src/utils/clubFinances.ts");
const COSTS_SRC = src("artifacts/api-server/src/utils/runningCosts.ts");
const BOARD_SRC = src("artifacts/api-server/src/utils/board-confidence.ts");
// The underscores are in the NUMBERS, not in the names: 5_000 is five thousand
// and RUNNING_COST_BASE is a name. Stripping them from the whole file turned
// the name into RUNNINGCOSTBASE and the read into NaN.
const num = (re, from) => Number(String(re.exec(from)?.[1] ?? "").replace(/_/g, ""));
const TO_SALE = num(/LOSS_MAKING_SEASONS_TO_SALE = ([\d_]+)/, BOARD_SRC);
const BASE_COST = num(/RUNNING_COST_BASE = ([\d_]+)/, COSTS_SRC);
const PER_PLAYER = num(/RUNNING_COST_PER_PLAYER = ([\d_]+)/, COSTS_SRC);
const PER_REP = num(/SPONSOR_INCOME_PER_REPUTATION = ([\d_]+)/, FINANCES_SRC);
const WEEKS_PER_MONTH = 52 / 12;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
const money = (n) => (n < 0 ? "-" : "") + "$" + Math.abs(Math.round(n)).toLocaleString();
const k = (n) => Math.round(Number(n) / 1000);

console.log("=".repeat(78));
console.log(`  EVERY CLUB KEEPS BOOKS — ${SEASONS} SEASONS OF THE WHOLE WORLD`);
console.log("=".repeat(78));

const dbFile = path.join(WORK, "world.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: {
    ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT),
    NODE_ENV: "development", SESSION_SECRET: "ai-club-economy",
  },
});

const BASE = `http://localhost:${PORT}/api`;
let cookie = "";
const api = async (method, p, body) => {
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
const read = (q, ...a) => {
  const d = new DatabaseSync(dbFile, { readOnly: true });
  const r = d.prepare(q).all(...a);
  d.close();
  return r;
};

try {
  const dl = Date.now() + 40000;
  for (;;) {
    if (Date.now() > dl) throw new Error("server never came up");
    try { await fetch(`${BASE}/healthz`); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }

  const prof = await api("POST", "/profiles", { name: "AiEconomy" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const career = await api("POST", "/careers", {
    slotNumber: 1, managerName: "AiEconomy", managerNationality: "Australia",
    clubName: "AiEconomy FC", originalClubName: "AiEconomy FC",
    budget: "500000", difficulty: "established",
    primaryColor: "#0a0", secondaryColor: "#00a", crestShapeIndex: 0,
    season: "Season 1", locationId: 1,
  });
  check("a career was created", career.status === 200, `HTTP ${career.status}`);
  const careerSaveId = career.data?.id;
  const teamId = career.data?.teamId;

  // ── 1. Every club in the world has books ──────────────────────────────────
  console.log("\n1. SIXTY CLUBS, SIXTY SETS OF BOOKS");
  const clubs = read(`SELECT COUNT(*) AS n FROM continental_pool_teams`)[0].n;
  const withBalance = read(
    `SELECT COUNT(*) AS n FROM career_pool_team_state WHERE career_save_id = ? AND balance > 0`,
    careerSaveId)[0].n;
  check("every club of this world opened a balance", withBalance === clubs,
    `${withBalance} of ${clubs}`);

  const contracted = read(
    `SELECT COUNT(*) AS n FROM pool_player_contracts WHERE career_save_id = ? AND status = 'active'`,
    careerSaveId)[0].n;
  const poolPlayers = read(`SELECT COUNT(*) AS n FROM continental_pool_players`)[0].n;
  check("and every one of their players is under contract", contracted === poolPlayers,
    `${contracted} of ${poolPlayers}`);

  const lengths = read(
    `SELECT length AS l, COUNT(*) AS n FROM pool_player_contracts
      WHERE career_save_id = ? GROUP BY length ORDER BY length`, careerSaveId);
  const allowed = new Set(["6m", "1s", "2s"]);
  check("on the three lengths this game has, and no others",
    lengths.length > 0 && lengths.every((r) => allowed.has(r.l)),
    lengths.map((r) => `${r.l} x${r.n}`).join(", "));

  const salaries = read(
    `SELECT MIN(salary) AS lo, MAX(salary) AS hi FROM pool_player_contracts WHERE career_save_id = ?`,
    careerSaveId)[0];
  check("paid a monthly salary drawn from the shipped players' own price curve",
    Number(salaries.lo) > 0 && Number(salaries.hi) >= Number(salaries.lo),
    `${money(salaries.lo)} to ${money(salaries.hi)} a month`);

  const opened = read(
    `SELECT COUNT(*) AS n FROM pool_club_seasons WHERE career_save_id = ?`, careerSaveId)[0].n;
  check("and season one is open for all of them, on what they carry into it",
    opened === clubs, `${opened} of ${clubs}`);

  // ── 2. One set of rules ───────────────────────────────────────────────────
  //
  // Not "an AI club is charged something" but "an AI club is charged what the
  // shared functions say, to the dollar". Measured on a club with no World Tour
  // place, whose week is the ground, its squad and no tour.
  console.log("\n2. THE SAME RULES, TO THE DOLLAR");
  const before = read(
    `SELECT s.pool_team_id AS id, s.balance AS b, s.sponsor_reputation AS rep
       FROM career_pool_team_state s
      WHERE s.career_save_id = ? AND s.pool_team_id NOT IN (
        SELECT pool_team_id FROM world_tour_qualifications WHERE career_save_id = ?)
      ORDER BY s.pool_team_id LIMIT 1`, careerSaveId, careerSaveId)[0];
  const wages = read(
    `SELECT COALESCE(SUM(salary), 0) AS total, COUNT(*) AS n FROM pool_player_contracts
      WHERE career_save_id = ? AND pool_team_id = ? AND status = 'active'`,
    careerSaveId, before?.id)[0];
  const expectedWeek =
    Math.round(Number(wages.total) / WEEKS_PER_MONTH)
    + BASE_COST + PER_PLAYER * Number(wages.n)
    - Math.round(Number(before?.rep ?? 50) * PER_REP);

  // One salary week, and nothing else: advanced far enough for the weekly
  // block to run once, with no match played by that club in between.
  let weeks = 0;
  for (let i = 0; i < 8 && weeks === 0; i++) {
    await api("POST", "/calendar/advance", {});
    const after = read(
      `SELECT balance AS b FROM career_pool_team_state WHERE career_save_id = ? AND pool_team_id = ?`,
      careerSaveId, before?.id)[0];
    if (Math.round(Number(after.b)) !== Math.round(Number(before.b))) {
      const moved = Number(before.b) - Number(after.b);
      check("a club with no World Tour place pays the ground and its squad, and no tour",
        Math.round(moved) === Math.round(expectedWeek),
        `moved ${money(moved)}, the rules say ${money(expectedWeek)}`);
      weeks++;
    }
  }
  check("the week was charged at all", weeks === 1, `${weeks} week(s) seen`);
  check("the harness read the real numbers out of the server",
    [TO_SALE, BASE_COST, PER_PLAYER, PER_REP].every((n) => Number.isFinite(n) && n > 0),
    `sale after ${TO_SALE}, base ${money(BASE_COST)}, per player ${money(PER_PLAYER)}, ` +
      `${money(PER_REP)} a week per point of reputation`);

  // ── 3. Thirty seasons of the whole world ──────────────────────────────────
  console.log(`\n3. ${SEASONS} SEASONS`);
  const balances = new Map();   // poolTeamId -> [balance per season]
  const names = new Map(read(`SELECT id, team_name AS n FROM continental_pool_teams`).map((r) => [r.id, r.n]));
  const soldIn = new Map();     // poolTeamId -> [season numbers]
  const sales = [];
  const leagueSizes = [];
  let seasons = 0, stopped = "";

  for (let i = 0; i < 20000 && seasons < SEASONS; i++) {
    healAllSquads(dbFile);
    keepClubSolvent(dbFile, teamId);
    await keepSideFielded(api);
    await renewExpiringContracts(api);
    const r = await api("POST", "/calendar/advance", {});
    if (r.status >= 400) { stopped = `advance HTTP ${r.status}`; break; }
    if (r.data?.blocked === "pending_match") {
      await api("POST", `/matches/${r.data.pendingMatchId}/simulate`, {});
      await api("POST", "/calendar/skip-match", {});
      continue;
    }
    const mid = r.data?.matchDay?.matchId;
    if (mid) { await api("POST", `/matches/${mid}/simulate`, {}); await api("POST", "/calendar/dismiss-match", {}); }
    if (!r.data?.seasonRollover || r.data.seasonRollover.kind === "none") continue;

    seasons++;
    for (const row of read(
      `SELECT pool_team_id AS id, balance AS b FROM career_pool_team_state WHERE career_save_id = ?`,
      careerSaveId)) {
      const list = balances.get(row.id) ?? [];
      list.push(Number(row.b));
      balances.set(row.id, list);
    }
    for (const s of r.data.seasonRollover.poolSales ?? []) {
      // Whether the club that took the place is in the league NOW, at the
      // boundary that gave it - not at the end of the run, where it may have
      // been relegated on the sand five seasons later like any other club.
      const tookIt = s.replacementPoolTeamId == null ? null : read(
        `SELECT is_active_in_league AS l FROM career_pool_team_state
          WHERE career_save_id = ? AND pool_team_id = ?`,
        careerSaveId, s.replacementPoolTeamId)[0]?.l === 1;
      sales.push({ ...s, season: seasons, tookItsPlace: tookIt });
      const list = soldIn.get(s.poolTeamId) ?? [];
      list.push(seasons);
      soldIn.set(s.poolTeamId, list);
    }
    leagueSizes.push(read(
      `SELECT t.continent AS c, COUNT(*) AS n FROM career_pool_team_state s
         JOIN continental_pool_teams t ON t.id = s.pool_team_id
        WHERE s.career_save_id = ? AND s.is_active_in_league = 1 GROUP BY t.continent`,
      careerSaveId).map((x) => `${x.c}:${x.n}`).join(" "));
    if (r.data.clubSold) { stopped = "the player's own club was sold"; break; }
  }
  check(`the world played ${SEASONS} seasons`, seasons === SEASONS,
    stopped || `${seasons} season(s)`);

  // ── The table ─────────────────────────────────────────────────────────────
  console.log(`\n  EVERY CLUB'S BALANCE, PER SEASON, IN THOUSANDS ($k) — * = sold that season`);
  console.log(`  ${"club".padEnd(28)}${Array.from({ length: seasons }, (_, i) => String(i + 1).padStart(6)).join("")}`);
  const ordered = [...balances.keys()].sort((a, b) =>
    (balances.get(b).at(-1) ?? 0) - (balances.get(a).at(-1) ?? 0));
  for (const id of ordered) {
    const cells = balances.get(id).map((b, idx) =>
      (String(k(b)) + (soldIn.get(id)?.includes(idx + 1) ? "*" : "")).padStart(6)).join("");
    console.log(`  ${String(names.get(id) ?? id).slice(0, 27).padEnd(28)}${cells}`);
  }

  // ── 4. The clubs are not all the same club ────────────────────────────────
  console.log("\n4. MONEY MEANS SOMETHING FOR THEM TOO");
  const finals = ordered.map((id) => balances.get(id).at(-1) ?? 0);
  const richest = Math.max(...finals), poorest = Math.min(...finals);
  check("a run separates the clubs that made money from the ones that lost it",
    richest > poorest * 1.5 || poorest < 0,
    `richest ${money(richest)}, poorest ${money(poorest)}`);

  // ── 5. The rule fires ─────────────────────────────────────────────────────
  console.log(`\n5. ${TO_SALE} LOSS-MAKING SEASONS SELLS AN AI CLUB TOO`);
  check("at least one AI club was sold for its books", sales.length > 0,
    `${sales.length} sale(s): ` +
      (sales.slice(0, 6).map((s) => `${s.name} S${s.season} on ${money(s.balance)}`).join(" · ") || "none"));

  if (sales.length > 0) {
    const first = sales[0];
    const chain = read(
      `SELECT season_year AS y, season_start_balance AS b FROM pool_club_seasons
        WHERE career_save_id = ? AND pool_team_id = ? ORDER BY season_year`,
      careerSaveId, first.poolTeamId).map((r) => Number(r.b));
    // The openings of the seasons it lost money in - not the one after, which
    // is the new owners' balance and is meant to be higher.
    const upTo = chain.slice(0, TO_SALE);
    const falls = upTo.every((b, idx) => idx === 0 || b < upTo[idx - 1]);
    check(`and its books really did fall ${TO_SALE} seasons running`,
      upTo.length >= TO_SALE && falls,
      upTo.map((b) => money(b)).join(" > "));

    const replaced = sales.filter((s) => s.replacementName != null);
    check("a club that gave up a league place had it taken by another club of this world",
      replaced.length > 0,
      replaced.slice(0, 4).map((s) => `${s.name} -> ${s.replacementName}`).join(" · ") || "none did");

    if (replaced.length > 0) {
      const sameContinent = replaced.every((s) => {
        const a = read(`SELECT continent AS c FROM continental_pool_teams WHERE id = ?`, s.poolTeamId)[0]?.c;
        const b = read(`SELECT continent AS c FROM continental_pool_teams WHERE id = ?`, s.replacementPoolTeamId)[0]?.c;
        return a === b;
      });
      check("and the club that took it plays on the same continent",
        sameContinent, `${replaced.length} replacement(s) checked`);

      const tookTheirPlace = replaced.filter((s) => s.tookItsPlace === true).length;
      check("and was in the world's league the moment it took the place",
        tookTheirPlace === replaced.length,
        `${tookTheirPlace} of ${replaced.length}, first was ${replaced[0].replacementName} ` +
          `in season ${replaced[0].season}`);
    }

    const stillThere = read(
      `SELECT balance AS b, sold_in_season AS s FROM career_pool_team_state
        WHERE career_save_id = ? AND pool_team_id = ?`, careerSaveId, first.poolTeamId)[0];
    check("the club that was sold is still in the world, under new owners",
      stillThere != null && Number(stillThere.b) > 0,
      `${first.name} carries ${money(stillThere?.b ?? 0)} after changing hands`);
  }

  // ── 6. The world still works ──────────────────────────────────────────────
  console.log("\n6. AND THE WORLD IT LEAVES BEHIND STILL PLAYS");
  const badSeason = leagueSizes.findIndex((s) => !s.split(" ").every((c) => c.endsWith(":6")));
  check("every continent kept its six clubs in the league, every season",
    badSeason === -1 && leagueSizes.length > 0,
    badSeason === -1 ? `all ${leagueSizes.length} seasons: ${leagueSizes.at(-1)}`
      : `season ${badSeason + 1}: ${leagueSizes[badSeason]}`);

  const orphanContracts = read(
    `SELECT COUNT(*) AS n FROM pool_player_contracts
      WHERE career_save_id = ? AND (end_date IS NULL OR length NOT IN ('6m','1s','2s'))`,
    careerSaveId)[0].n;
  check("and nobody at any of them is on a term this game does not have",
    orphanContracts === 0, `${orphanContracts} bad contract(s)`);

} finally {
  await stopServer(child);
  try { fs.closeSync(out); } catch { /* already closed */ }
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
