/**
 * R-32 — the live point-tick engine's free-agent fallback can never match.
 *
 * ── The bug this exists for ─────────────────────────────────────────────────
 * `utils/match-tick-engine.ts`'s `loadFallbackPool()` had the identical
 * `freeAgents: true, isActive: true` contradiction R-22 found and fixed in
 * `routes/unity.ts` — a free agent can never be `is_active` (only set true
 * when a player is signed to a roster). The query returned zero rows,
 * unconditionally, every time it ran.
 *
 * Traced what that actually did to a live-watched match: every match's
 * `awayTeamId` equals its own `homeTeamId` (no real opposing team row ever
 * exists — R-29), so `awayRoster` started empty and the fallback never
 * filled it. `sideRating([])` defaults to a flat 60, so the match was not a
 * numeric walkover — home played a real average-rated ghost, not a rating
 * of zero. But every point "Away" won had no real player behind it:
 * `pickPlayer([], stat)` returns `undefined`, so `lastActionPlayerId` was
 * always null for an away point. A player watching a match saw an opponent
 * that could win points but never had a name.
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 * Create a career (eager World Tour fixture — every match has
 * awayTeamId === homeTeamId, the exact shape this bug needs), start the
 * live tick loop on one of its own matches (POST /matches/:id/watch), and
 * poll GET /unity/match-state — which surfaces the tick loop's own
 * lastActionTeam/lastActionPlayer fields — until at least 2 distinct real
 * player ids have been credited with a point on EACH side, or a bounded
 * timeout elapses. Proves two real players contest each side (not a
 * playerless fallback) and that away genuinely wins points too (not a
 * one-sided contest with a ghost opponent).
 *
 * Usage: node harness/match-tick-fallback-roster.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-tick-fallback-"));
const PORT = 4660;

let failures = 0;
let checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

if (!fs.existsSync(SERVER)) {
  console.error(`[match-tick-fallback-roster] FAILED: ${SERVER} not built. Run the api-server build first.`);
  process.exit(1);
}

console.log("=".repeat(72));
console.log("  R-32 LIVE MATCH TICK FALLBACK ROSTER");
console.log("=".repeat(72));

const dbFile = path.join(WORK, "tick-fallback.sqlite");
fs.copyFileSync(SHIPPED, dbFile);

const logFile = path.join(WORK, "server.log");
const out = fs.openSync(logFile, "w");
const child = forkServer({
  server: SERVER,
  electron: ELECTRON,
  out,
  env: {
    ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT),
    NODE_ENV: "development", SESSION_SECRET: "tick-fallback-secret",
  },
});

const base = `http://localhost:${PORT}/api`;
let cookie = "";
const api = async (method, p, body) => {
  const res = await fetch(base + p, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const sc = res.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
};

const deadline = Date.now() + 25000;
let up = false;
while (Date.now() < deadline) {
  try { await fetch(`${base}/healthz`); up = true; break; }
  catch { await new Promise((r) => setTimeout(r, 250)); }
}
if (!up) {
  console.error("[match-tick-fallback-roster] server never came up");
  console.error(fs.readFileSync(logFile, "utf8").slice(-2000));
  process.exit(1);
}

try {
  const profileRes = await api("POST", "/profiles", { name: "TickFallbackTest" });
  await api("POST", `/profiles/${profileRes.data.id}/select`);
  const careerRes = await api("POST", "/careers", {
    slotNumber: 1, managerName: "TickFallbackTest", managerNationality: "Australia",
    clubName: "Tick Fallback FC", originalClubName: "Tick Fallback FC", season: "Season 1",
    budget: "500000", locationId: 1, primaryColor: "#111111", secondaryColor: "#222222",
  });
  check("career created (eager fixture generation)", careerRes.status === 200, `HTTP ${careerRes.status}`);

  // R-29: a World Tour match has no opponent until the field is drawn, which
  // happens when the calendar reaches the World Tour after the regional
  // leagues finish (round 10). Watching the first fixture straight after career
  // creation is now refused with a 409 that says exactly that, so walk the
  // calendar to the first World Tour match day and watch that match instead.
  let pendingMatchId = null;
  for (let day = 0; day < 200 && pendingMatchId == null; day++) {
    const adv = await api("POST", "/calendar/advance", {});
    if (adv.status >= 400) break;
    pendingMatchId = adv.data?.matchDay?.matchId
      ?? (adv.data?.blocked === "pending_match" ? adv.data.pendingMatchId : null);
  }
  const matchRes = pendingMatchId != null ? await api("GET", `/matches/${pendingMatchId}`) : { data: null };
  const match = matchRes.data?.id ? matchRes.data : null;
  check("the calendar reaches a real World Tour match day to test against", !!match,
    JSON.stringify(match)?.slice(0, 200));

  if (match) {
    check("the fixture's away side is the World Tour shape this bug needs (awayTeamId === homeTeamId)",
      match.awayTeamId === match.homeTeamId, `home ${match.homeTeamId}, away ${match.awayTeamId}`);

    const watchRes = await api("POST", `/matches/${match.id}/watch`);
    check("the live tick loop starts", watchRes.status === 200 && watchRes.data?.ok, JSON.stringify(watchRes.data));

    // ── What R-32 actually guarantees ─────────────────────────────────────
    //
    // R-37: this used to poll until 2 DISTINCT away player ids had each been
    // credited with a point, and that is not something R-32 guarantees. The
    // bug was `loadFallbackPool`'s `isActive: true` filter returning zero rows,
    // so `awayRoster` was empty and `pickPlayer([], stat)` returned undefined —
    // every away point carried `lastActionPlayerId: null`, a phantom opponent
    // that won points but never had a name. The fix makes the away side a real,
    // staffed pair. Which of those two players the engine credits on any given
    // point is `pickPlayer()`'s stat-weighted randomness, and it can favour one
    // of them for a long run — the suite's own note already said exactly that
    // about the home side, and set the home bar at 1 for that reason, while
    // leaving the away bar at 2 with the same exposure.
    //
    // It duly flaked: one full-harness run sat out the entire 55s poll waiting
    // for a second distinct away scorer that never came, and failed. The engine
    // was behaving correctly the whole time.
    //
    // So assert the two things the fix does guarantee, both deterministic:
    //   1. the away side has two real players to field (the pool whose query
    //      returned zero rows pre-fix), and
    //   2. away points are credited to one of them, not to null.
    //
    // The roster the tick engine builds is in-memory and never persisted, so
    // (1) is asserted against the pool it fills from, through the app's own
    // endpoint rather than a hand-copied SQL query: GET /players/free-agents
    // runs the same `loadPlayers(..., { freeAgents: true })` that
    // `loadFallbackPool` does. Pre-fix that pool was unreachable behind the
    // contradictory filter; an empty or one-player pool here means the away
    // side cannot be staffed, which is the regression this must catch.
    const freeAgentsRes = await api("GET", "/players/free-agents");
    const freeAgents = Array.isArray(freeAgentsRes.data) ? freeAgentsRes.data : [];
    const freeAgentIds = new Set(freeAgents.map((p) => p.id));
    check("the away side has two real players available to field (the fallback pool the engine fills from)",
      freeAgents.length >= 2, `${freeAgents.length} senior free agent(s) in the pool`);

    // Poll until BOTH sides have a real scorer, or a bounded timeout.
    // TICK_MS(1800) x 2 phases = ~3.6s/point, so 55s covers roughly 15 points'
    // worth of real time — ample for each side to win one.
    //
    // Waiting on both matters: an earlier version of this stopped as soon as
    // away scored, which can be the very first point of the match, and then the
    // home sanity check failed on an empty set. One stochastic flake traded for
    // another. Each side winning at least one point in ~15 is overwhelmingly
    // likely, and is a far weaker demand than the two-distinct-scorers bar this
    // replaced, which needed the engine to pick DIFFERENT players on one side.
    const homeScorers = new Set();
    const awayScorers = new Set();
    const awayNullPoints = [];
    let awayPoints = 0;
    let lastSeen = null;
    const pollDeadline = Date.now() + 55000;
    while (Date.now() < pollDeadline && (awayScorers.size < 1 || homeScorers.size < 1)) {
      const stateRes = await api("GET", `/unity/match-state?matchId=${match.id}`);
      const { lastActionTeam, lastActionPlayer, lastAction } = stateRes.data ?? {};
      // The same point stays on the endpoint across several polls; key on the
      // action text so one point is not counted many times.
      const key = `${lastActionTeam}|${lastActionPlayer}|${lastAction}`;
      if (key !== lastSeen) {
        lastSeen = key;
        if (lastActionTeam === "away") {
          awayPoints++;
          // A null scorer on an away point IS the R-32 bug, so record it
          // rather than skipping past it.
          if (lastActionPlayer == null) awayNullPoints.push(lastAction ?? "(no action text)");
          else awayScorers.add(lastActionPlayer);
        } else if (lastActionTeam === "home" && lastActionPlayer != null) {
          homeScorers.add(lastActionPlayer);
        }
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    check("at least 1 real player credited with a point on the HOME side (sanity — unaffected by this fix)",
      homeScorers.size >= 1, `[${[...homeScorers].join(", ")}]`);
    check("away scored at least one point, credited to a real named player (the actual fallback fix)",
      awayScorers.size >= 1, `${awayPoints} away point(s) seen, scorer(s) [${[...awayScorers].join(", ")}]`);
    check("no away point was credited to nobody — the pre-fix symptom was lastActionPlayerId null",
      awayNullPoints.length === 0,
      awayNullPoints.length === 0 ? "every away point had a real scorer" : `${awayNullPoints.length} nameless away point(s)`);
    // `every()` on an empty set is true, so this requires a scorer to exist as
    // well as being a real one — a check that passes when nothing happened is
    // the kind that let the original bug sit here unnoticed.
    const allFromPool = awayScorers.size >= 1
      && [...awayScorers].every((id) => freeAgentIds.has(id));
    check("the away scorer is a player from the fallback pool, not a stray id",
      allFromPool,
      awayScorers.size === 0
        ? "no away scorer to check"
        : `scorer(s) [${[...awayScorers].join(", ")}] all in the pool: ${allFromPool}`);
  }
} finally {
  // R-36: quit through R-31's shutdown path rather than SIGKILL, so the
  // database is left checkpointed with no -wal sidecar. The settle sleep
  // that used to follow the kill was only covering for that.
  await stopServer(child);
  try { fs.closeSync(out); } catch { /* already closed */ }
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch {} }
process.exit(failures > 0 ? 1 : 0);
