/**
 * R-77 — a match watched in 3D counts, and the achievements say what unlocks them.
 *
 * Traced: POST /matches/:id/watch starts the point-tick engine
 * (utils/match-tick-engine.ts), which writes each point to match_live_state and
 * stopped at rallyState "finished". The match stayed "in_progress". The engine's
 * own note said the page would then call POST /matches/:id/simulate with the
 * real score; no page, and nothing in the Unity build, ever did. So a watched
 * match earned no win, purse, ranking points, career stats or achievements, and
 * the calendar stayed blocked on it. The engine now completes the match itself
 * through completeMatch (routes/matches.ts), the same code "Sim Result" runs.
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 *   list      GET /achievements serves exactly the honest list: the deleted
 *             keys gone, no description mentioning loans, "Play matches on N
 *             continents"
 *   watched   on real match days, a watched match completes on its own; wins or
 *             losses move by exactly one; career stats and the purse follow the
 *             score it played; the live row is cleared and the calendar freed;
 *             the first watched win unlocks First Steps
 *   simulated a simulated match moves the same counters the same way
 *   once      a match watched and then simulated mid-play counts once
 *
 * MATCH_TICK_MS=5 makes a watched match play in seconds instead of minutes.
 *
 * Usage: node harness/watched-match.mjs
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
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-watched-match-"));
const PORT = 4900;
const BASE = `http://localhost:${PORT}/api`;

const EXPECTED_KEYS = [
  "first_steps", "battle_hardened", "century_wins", "perfect_season",
  "tournament_winner", "champion", "world_champion", "dynasty_begins", "olympic_gold",
  "making_money", "millionaires_club", "debt_free", "financially_secure",
  "talent_spotter", "youth_pipeline", "youth_graduate", "youth_factory", "future_superstar", "star_factory",
  "local_legend", "world_traveller", "globe_trotter",
];
const DELETED_KEYS = [
  "first_pay_day", "continental_champion", "decade_in_sand", "veteran_coach", "hall_of_fame",
  "volleyball_empire", "mr_loyalty", "double_olympic_gold",
];

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log("  R-77 WATCHED MATCHES COUNT; ACHIEVEMENTS SAY WHAT UNLOCKS THEM");
console.log("=".repeat(72));

if (!fs.existsSync(SERVER)) { console.error(`[watched-match] FAILED: ${SERVER} not built.`); process.exit(1); }

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dbFile = path.join(WORK, "watched.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development",
    SESSION_SECRET: "watched-match", MATCH_TICK_MS: "5" },
});
for (let i = 0; i < 240; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ } await sleep(250); }

const read = (q, ...a) => { const d = new DatabaseSync(dbFile, { readOnly: true }); const r = d.prepare(q).all(...a); d.close(); return r; };

try {
  const api = session();
  const prof = await api("POST", "/profiles", { name: "Watcher" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const clubs = (await api("GET", "/club-templates")).data;
  const club = (Array.isArray(clubs) ? clubs : clubs?.clubs ?? [])[0];
  await api("POST", "/careers", {
    slotNumber: 1, managerName: "Watcher", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#224466", secondaryColor: "#FFFFFF", crestShapeIndex: 0,
  });
  const teamId = (await api("GET", "/team")).data.id;

  // ── 0. The list ───────────────────────────────────────────────────────────
  console.log("\n0. THE ACHIEVEMENTS LIST");
  const list = (await api("GET", "/achievements")).data ?? [];
  const keys = list.map((a) => a.key);
  check(`exactly the ${EXPECTED_KEYS.length} honest achievements are served`,
    keys.length === EXPECTED_KEYS.length && EXPECTED_KEYS.every((k) => keys.includes(k)), `${keys.length}: ${keys.join(", ")}`);
  check("no deleted achievement is served", DELETED_KEYS.every((k) => !keys.includes(k)));
  const byKey = Object.fromEntries(list.map((a) => [a.key, a]));
  check("no description mentions loans; the continent ones say where matches were played",
    list.every((a) => !/loan/i.test(a.description))
      && byKey.world_traveller?.description === "Play matches on 6 continents."
      && byKey.globe_trotter?.description === "Play matches on 4 continents.",
    `${byKey.world_traveller?.description} / ${byKey.globe_trotter?.description}`);

  // Play the calendar to the next match day and return its match id.
  async function nextMatchDay(maxDays = 120) {
    for (let d = 0; d < maxDays; d++) {
      const adv = await api("POST", "/calendar/advance", {});
      const id = adv.data?.blocked === "pending_match" ? adv.data.pendingMatchId : adv.data?.matchDay?.matchId;
      if (id) return id;
    }
    return null;
  }
  const snapshot = async () => {
    const team = (await api("GET", "/team")).data;
    const stats = (await api("GET", "/achievements/career-stats")).data;
    const prizes = read("SELECT COUNT(*) AS n FROM finance_transactions WHERE team_id = ? AND category = 'prize_money'", teamId)[0].n;
    return { wins: team.wins, losses: team.losses, matchesWon: stats.matchesWon, losses2: stats.currentSeasonLosses, prizes };
  };

  // ── 1. Watched ────────────────────────────────────────────────────────────
  console.log("\n1. A WATCHED MATCH COMPLETES AND COUNTS");
  let watchedWin = null;
  const watched = [];
  for (let n = 0; n < 12 && !watchedWin; n++) {
    const matchId = await nextMatchDay();
    if (!matchId) break;
    const before = await snapshot();
    const w = await api("POST", `/matches/${matchId}/watch`, {});
    if (w.status !== 200) { watched.push({ matchId, error: `watch HTTP ${w.status} ${JSON.stringify(w.data)}` }); break; }
    let m = null;
    for (let i = 0; i < 600; i++) { m = (await api("GET", `/matches/${matchId}`)).data; if (m?.status === "completed") break; await sleep(100); }
    await sleep(300);
    const after = await snapshot();
    const live = read("SELECT COUNT(*) AS n FROM match_live_state WHERE match_id = ?", matchId)[0].n;
    const cal = (await api("GET", "/calendar")).data;
    const homeWon = m?.homeScore > m?.awayScore;
    watched.push({ matchId, status: m?.status, score: `${m?.homeScore}-${m?.awayScore}`, homeWon, before, after, live, pending: cal?.pendingMatchId });
    if (homeWon && m?.status === "completed") watchedWin = watched[watched.length - 1];
  }
  const done = watched.filter((w) => w.status === "completed");
  check("every watched match completed on its own, with a finished score", done.length === watched.length && done.length > 0
    && done.every((w) => /^(2-[01]|[01]-2)$/.test(w.score)), watched.map((w) => `${w.matchId} ${w.status ?? w.error} ${w.score ?? ""}`).join(" | "));
  check("each moved wins or losses by exactly one, the way its score went",
    done.every((w) => (w.homeWon ? w.after.wins - w.before.wins === 1 && w.after.losses === w.before.losses
      : w.after.losses - w.before.losses === 1 && w.after.wins === w.before.wins)));
  check("each moved the career stats the same way (matches won, or the season's losses)",
    done.every((w) => (w.homeWon ? w.after.matchesWon - w.before.matchesWon === 1 : w.after.losses2 - w.before.losses2 === 1)));
  check("each paid its purse, cleared its live row and freed the calendar",
    done.every((w) => w.after.prizes - w.before.prizes === 1 && w.live === 0 && w.pending == null));
  const firstSteps = read("SELECT season_unlocked FROM achievements WHERE team_id = ? AND achievement_key = 'first_steps'", teamId);
  check("a completed watched match increments wins, and the first watched win unlocks First Steps",
    !!watchedWin && watchedWin.after.wins === watchedWin.before.wins + 1 && firstSteps.length === 1,
    watchedWin ? `match ${watchedWin.matchId} ${watchedWin.score}: wins ${watchedWin.before.wins} -> ${watchedWin.after.wins}; First Steps ${firstSteps.length ? "unlocked" : "missing"}` : "no watched win in 12 matches");
  console.log(`  REPORT  ${done.length} watched matches, ${done.filter((w) => w.homeWon).length} won`);

  // ── 2. Simulated ──────────────────────────────────────────────────────────
  console.log("\n2. A SIMULATED MATCH COUNTS THE SAME WAY");
  {
    const matchId = await nextMatchDay();
    const before = await snapshot();
    const r = await api("POST", `/matches/${matchId}/simulate`, {});
    const after = await snapshot();
    const won = r.data?.homeScore > r.data?.awayScore;
    check("wins or losses, career stats and the purse move by one",
      r.status === 200 && (won ? after.wins - before.wins === 1 && after.matchesWon - before.matchesWon === 1
        : after.losses - before.losses === 1 && after.losses2 - before.losses2 === 1) && after.prizes - before.prizes === 1,
      `HTTP ${r.status} ${r.data?.homeScore}-${r.data?.awayScore}`);
  }

  // ── 3. Once ───────────────────────────────────────────────────────────────
  console.log("\n3. WATCHED, THEN SIMULATED MID-PLAY, COUNTS ONCE");
  {
    const matchId = await nextMatchDay();
    const before = await snapshot();
    await api("POST", `/matches/${matchId}/watch`, {});
    const sim = await api("POST", `/matches/${matchId}/simulate`, {});
    await sleep(4000); // the watch loop finishes and finds the match already completed
    const after = await snapshot();
    const played = (after.wins - before.wins) + (after.losses - before.losses);
    check("one result, one purse", sim.status === 200 && played === 1 && after.prizes - before.prizes === 1,
      `simulate HTTP ${sim.status}; wins+losses moved ${played}; purses ${after.prizes - before.prizes}`);
  }
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  await stopServer(child);
  try { fs.closeSync(out); } catch { /* closed */ }
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
