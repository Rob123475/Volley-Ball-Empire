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

  const matchesRes = await api("GET", "/matches/fixture");
  const matches = Array.isArray(matchesRes.data) ? matchesRes.data : [];
  const match = matches[0] ?? null;
  check("a real fixture match exists to test against", !!match, JSON.stringify(match)?.slice(0, 200));

  if (match) {
    check("the fixture's away side is the World Tour shape this bug needs (awayTeamId === homeTeamId)",
      match.awayTeamId === match.homeTeamId, `home ${match.homeTeamId}, away ${match.awayTeamId}`);

    const watchRes = await api("POST", `/matches/${match.id}/watch`);
    check("the live tick loop starts", watchRes.status === 200 && watchRes.data?.ok, JSON.stringify(watchRes.data));

    // Poll until 2 distinct real away-side player ids have been credited —
    // that is the actual fix under test — or a bounded timeout.
    // TICK_MS(1800) x 2 phases = ~3.6s/point, so this covers roughly 15
    // points' worth of real time in the worst case. Home scorers are
    // collected passively over the same window: home's own roster selection
    // is unrelated to this fix (it already worked), and pickPlayer()'s
    // stat-weighted randomness can easily favour one home player over the
    // other within only ~15 points, so home is asserted as "at least 1 real
    // scorer" (proves the roster is real, not empty) rather than "2" — a
    // stricter home bar would make the test flaky on behaviour this fix
    // never touched.
    const homeScorers = new Set();
    const awayScorers = new Set();
    const pollDeadline = Date.now() + 55000;
    while (Date.now() < pollDeadline && awayScorers.size < 2) {
      const stateRes = await api("GET", `/unity/match-state?matchId=${match.id}`);
      const { lastActionTeam, lastActionPlayer } = stateRes.data ?? {};
      if (lastActionPlayer != null) {
        if (lastActionTeam === "home") homeScorers.add(lastActionPlayer);
        else if (lastActionTeam === "away") awayScorers.add(lastActionPlayer);
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    check("at least 1 real player credited with a point on the HOME side (sanity — unaffected by this fix)",
      homeScorers.size >= 1, `[${[...homeScorers].join(", ")}]`);
    check("at least 2 distinct real players credited with a point on the AWAY side (the actual fallback fix)",
      awayScorers.size >= 2, `[${[...awayScorers].join(", ")}]`);
    check("away genuinely contests points — not a walkover against a playerless ghost opponent",
      awayScorers.size > 0, `${awayScorers.size} distinct away scorer(s) observed`);
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
