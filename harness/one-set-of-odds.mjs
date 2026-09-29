/**
 * Unity match brief (29 Sep), item 1 — one set of odds.
 *
 * The 3D court and the game's own engine must agree on how likely a point is,
 * and play the same format (Rob, 29 Sep: best of 3 sets, each to 11, win by 2).
 *
 *   chance   GET /unity/match-state sends `pointChanceHome`, the per-point
 *            chance the game's engine uses for this match (matchPointChance in
 *            routes/matches.ts); Sim Result reports the chance it played at,
 *            and the two are the same number.
 *   format   2,000 matches through the Unity project's own point model
 *            (Assets/Scripts/PointModel.cs, compiled and run from the Unity
 *            repo by harness/unity-point-model) and 2,000 through the game's
 *            engine (utils/matchEngine.ts simulateMatch), at the same chances:
 *            match win rates within 2 percentage points, and every set and
 *            match score legal in both.
 *
 * Usage: node harness/one-set-of-odds.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { simulateMatch } from "../artifacts/api-server/src/utils/matchEngine.ts";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const RUNNER = path.join(REPO, "harness", "unity-point-model");
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-odds-"));
const PORT = 4917;
const BASE = `http://localhost:${PORT}/api`;
const N = 2000;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log("  UNITY 1: ONE SET OF ODDS, ONE FORMAT");
console.log("=".repeat(72));

/** Rob's format: to 11, win by 2 (exactly 2 once past 10-10). */
function legalSet(h, a) {
  const w = Math.max(h, a), l = Math.min(h, a);
  if (w < 11) return false;
  if (w === 11) return l <= 9;
  return w - l === 2;
}
function legalMatch(sets) {
  let hs = 0, as = 0;
  for (let i = 0; i < sets.length; i++) {
    const [h, a] = sets[i];
    if (!legalSet(h, a)) return false;
    if (hs === 2 || as === 2) return false; // a set after the match was decided
    if (h > a) hs++; else as++;
  }
  return (hs === 2 && as <= 1) || (as === 2 && hs <= 1);
}

// ── 1. The chance the game sends is the chance it plays ─────────────────────
console.log("\n1. THE CHANCE SENT TO UNITY IS THE CHANCE SIM RESULT PLAYS");
if (!fs.existsSync(SERVER)) { console.error(`[one-set-of-odds] FAILED: ${SERVER} not built.`); process.exit(1); }
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
const dbFile = path.join(WORK, "odds.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "odds" },
});
const chances = [0.5];
try {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  const prof = await api("POST", "/profiles", { name: "Odds" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", {
    slotNumber: 1, managerName: "Odds", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0,
  });
  const careerSaveId = ((await api("GET", "/careers")).data?.saves ?? []).find((s) => s.slotNumber === 1)?.id;
  const nm = await api("POST", "/calendar/next-match");
  const matchId = nm.data?.matchDay?.matchId;
  check("a new career reaches its first match day", !!matchId, `match ${matchId}`);

  const state = (await api("GET", `/unity/match-state?careerSaveId=${careerSaveId}&matchId=${matchId}`)).data;
  const sent = state?.pointChanceHome;
  check("/unity/match-state sends the home pair's per-point chance", typeof sent === "number" && sent > 0 && sent < 1, JSON.stringify(sent));
  const sim = await api("POST", `/matches/${matchId}/simulate`);
  const played = sim.data?.pointChanceHome;
  check("Sim Result plays at exactly that chance", typeof played === "number" && played === sent, `sent ${sent}, played ${played}`);
  const sets = sim.data?.sets ?? sim.data?.match?.sets;
  check("and records a legal best-of-3-to-11 score", Array.isArray(sets) && legalMatch(sets.map((s) => [s.home, s.away])), JSON.stringify(sets));
  if (typeof sent === "number") chances.push(Number(sent.toFixed(6)));
} catch (err) {
  check("the career run completed", false, String(err?.stack ?? err));
} finally {
  try { await stopServer(child); } catch { /* stopped */ }
  try { fs.closeSync(out); } catch { /* closed */ }
}
for (const c of [0.45, 0.55, 0.58]) if (!chances.includes(c)) chances.push(c);

// ── 2. Unity's model and the game's engine, same chance, same format ────────
// Both are fed ONE stream of random numbers (mulberry32, seed 29 + the chance's
// index; the same generator in C# and here), so the comparison measures the two
// models, not two sets of dice: the same logic must give the same matches.
console.log(`\n2. ${N} MATCHES EACH, UNITY'S POINT MODEL AND THE GAME'S ENGINE, ONE STREAM OF DRAWS`);
const SEED = 29;
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const args = chances.map((c) => String(c));
const run = spawnSync("dotnet", ["run", "-c", "Release", "--", String(N), String(SEED), ...args], { cwd: RUNNER, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
let unity = null;
try { unity = JSON.parse(run.stdout.trim().split("\n").pop()); } catch { /* reported below */ }
check("the Unity project's PointModel.cs compiles and runs", run.status === 0 && unity != null, run.status === 0 ? "" : (run.stderr || run.stdout).slice(-400));

const realRandom = Math.random;
for (const [k, c] of chances.entries()) {
  const u = unity?.runs?.[k];
  // Unity's sets list: [h,a] pairs, each match closed by a "|h-a" marker.
  const uMatches = []; let cur = [];
  for (const x of u?.sets ?? []) { if (typeof x === "string") { uMatches.push(cur); cur = []; } else cur.push(x); }
  const uLegal = uMatches.length === N && uMatches.every(legalMatch);

  Math.random = mulberry32(SEED + k);
  const gMatches = [];
  let gWins = 0;
  try {
    for (let i = 0; i < N; i++) {
      const r = simulateMatch(Number(args[k]));
      if (r.homeWon) gWins++;
      gMatches.push(r.sets.map((s) => [s.home, s.away]));
    }
  } finally { Math.random = realRandom; }
  const gLegal = gMatches.every(legalMatch);
  const same = gMatches.filter((m, i) => JSON.stringify(m) === JSON.stringify(uMatches[i])).length;

  const uRate = (u?.homeWins ?? NaN) / N * 100, gRate = gWins / N * 100;
  check(`chance ${c.toFixed(4)}: match win rates within 2 points`, Math.abs(uRate - gRate) <= 2,
    `Unity ${uRate.toFixed(1)}%, game ${gRate.toFixed(1)}%, gap ${Math.abs(uRate - gRate).toFixed(1)}`);
  check(`chance ${c.toFixed(4)}: every score legal in both (${N} matches each)`, uLegal && gLegal, `Unity ${uLegal}, game ${gLegal}`);
  check(`chance ${c.toFixed(4)}: from the same draws, the same ${N} matches point for point`, same === N, `${same}/${N} identical`);
}

// For the record, on fresh dice: what the format does to a favourite.
console.log("  REPORT  match win rate at a per-point chance, best of 3 to 11 (game engine, 20,000 matches each):");
for (const c of [0.5, 0.52, 0.54, 0.56, 0.58]) {
  let w = 0; for (let i = 0; i < 20000; i++) if (simulateMatch(c).homeWon) w++;
  console.log(`          ${c.toFixed(2)} -> ${(w / 200).toFixed(1)}%`);
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
