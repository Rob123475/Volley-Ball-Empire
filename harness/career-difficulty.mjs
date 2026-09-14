/**
 * R-11 — career difficulty (UNDERDOG vs ESTABLISHED), docs/economy-design.md.
 *
 * "Difficulty is chosen at career start: UNDERDOG or ESTABLISHED" and "What
 * the player should feel": UNDERDOG is tight-money with full purses only at
 * Bronze in season 1; ESTABLISHED is comfortable with full Silver purses. Both
 * start at 0 ranking points (R-54 deleted the established head start). The
 * doc gives no numbers for budget or ranking points — utils/careerDifficulty.ts
 * picks and names them; this harness proves the two starts are actually
 * different, not that any particular number is "correct" (there is no
 * correct number to check against — the doc doesn't give one).
 *
 * Usage: node harness/career-difficulty.mjs
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
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-career-difficulty-"));
const PORT = 4670;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

if (!fs.existsSync(SERVER)) {
  console.error(`[career-difficulty] FAILED: ${SERVER} not built. Run the api-server build first.`);
  process.exit(1);
}

console.log("=".repeat(72));
console.log("  R-11 CAREER DIFFICULTY — UNDERDOG vs ESTABLISHED");
console.log("=".repeat(72));

const dbFile = path.join(WORK, "career-difficulty.sqlite");
fs.copyFileSync(SHIPPED, dbFile);

const logFile = path.join(WORK, "server.log");
const out = fs.openSync(logFile, "w");
const child = forkServer({
  server: SERVER,
  electron: ELECTRON,
  out,
  env: {
    ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT),
    NODE_ENV: "development", SESSION_SECRET: "career-difficulty-secret",
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
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
};

const deadline = Date.now() + 25000;
let up = false;
while (Date.now() < deadline) {
  try { await fetch(`${base}/health`); up = true; break; }
  catch { await new Promise((r) => setTimeout(r, 250)); }
}
if (!up) {
  console.error("[career-difficulty] server never came up");
  console.error(fs.readFileSync(logFile, "utf8").slice(-2000));
  process.exit(1);
}

function squadAverage(db, teamId) {
  const rows = db.prepare(`
    SELECT s.speed, s.power, s.defense, s.serve, s.block
    FROM career_player_state s
    WHERE s.team_id = ? AND s.is_active = 1
  `).all(teamId);
  if (rows.length === 0) return null;
  const overall = (r) => (r.speed + r.power + r.defense + r.serve + r.block) / 5;
  return rows.reduce((sum, r) => sum + overall(r), 0) / rows.length;
}

try {
  const profileRes = await api("POST", "/profiles", { name: "Difficulty" });
  await api("POST", `/profiles/${profileRes.data.id}/select`);

  // ── UNDERDOG career (slot 1) ──────────────────────────────────────────────
  const underdogRes = await api("POST", "/careers", {
    slotNumber: 1, managerName: "Underdog Manager", managerNationality: "Australia",
    clubName: "Underdog FC", originalClubName: "Underdog FC", season: "Season 1",
    budget: "999999", // deliberately wrong, to prove the server overrides it by difficulty
    difficulty: "underdog",
    locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a",
  });
  check("underdog career created", underdogRes.status === 200, `HTTP ${underdogRes.status}`);
  const underdogTeamId = underdogRes.data.teamId;
  const underdogCareerSaveId = underdogRes.data.id;
  // R-54: season 1's purse access, as this career's own fixture list shows it.
  const underdogFixtures = (await api("GET", "/matches")).data;

  // ── ESTABLISHED career (slot 2), same session, same profile ─────────────────
  const establishedRes = await api("POST", "/careers", {
    slotNumber: 2, managerName: "Established Manager", managerNationality: "Australia",
    clubName: "Established FC", originalClubName: "Established FC", season: "Season 1",
    budget: "1", // deliberately wrong too
    difficulty: "established",
    locationId: 2, primaryColor: "#0a0", secondaryColor: "#00a",
  });
  check("established career created", establishedRes.status === 200, `HTTP ${establishedRes.status}`);
  const establishedTeamId = establishedRes.data.teamId;
  const establishedCareerSaveId = establishedRes.data.id;
  const establishedFixtures = (await api("GET", "/matches")).data;

  // R-36: stop through R-31's shutdown path, not SIGKILL. The kill left an
  // un-checkpointed -wal that the readOnly DatabaseSync below cannot replay,
  // and the 600ms sleep that used to sit here was only ever a race this
  // suite happened to win most of the time.
  await stopServer(child);

  const db = new DatabaseSync(dbFile, { readOnly: true });

  // ── Budget: server-decided by difficulty, not the client-sent figure ───────
  const underdogTeam    = db.prepare("SELECT budget FROM teams WHERE id = ?").get(underdogTeamId);
  const establishedTeam = db.prepare("SELECT budget FROM teams WHERE id = ?").get(establishedTeamId);
  check("underdog starting budget is the tight constant (150,000), not the client-sent figure",
    underdogTeam.budget === 150000, `got ${underdogTeam.budget}`);
  check("established starting budget is the comfortable constant (500,000), not the client-sent figure",
    establishedTeam.budget === 500000, `got ${establishedTeam.budget}`);
  check("established starts with strictly more budget than underdog",
    establishedTeam.budget > underdogTeam.budget,
    `underdog ${underdogTeam.budget} vs established ${establishedTeam.budget}`);

  // ── career_saves.difficulty stored correctly ────────────────────────────────
  const underdogSave    = db.prepare("SELECT difficulty FROM career_saves WHERE id = ?").get(underdogCareerSaveId);
  const establishedSave = db.prepare("SELECT difficulty FROM career_saves WHERE id = ?").get(establishedCareerSaveId);
  check("underdog career_saves.difficulty = 'underdog'", underdogSave.difficulty === "underdog", underdogSave.difficulty);
  check("established career_saves.difficulty = 'established'", establishedSave.difficulty === "established", establishedSave.difficulty);

  // ── R-54: no head start; difficulty sets season 1's purse access ────────────
  const underdogRanking = db.prepare(`
    SELECT r.ranking_points FROM competitor_rankings r
    JOIN competitors c ON c.id = r.competitor_id
    WHERE c.team_id = ? AND r.career_save_id = ?
  `).get(underdogTeamId, underdogCareerSaveId);
  const establishedRanking = db.prepare(`
    SELECT r.ranking_points FROM competitor_rankings r
    JOIN competitors c ON c.id = r.competitor_id
    WHERE c.team_id = ? AND r.career_save_id = ?
  `).get(establishedTeamId, establishedCareerSaveId);

  check("underdog starts at 0 ranking points",
    underdogRanking.ranking_points === 0, `got ${underdogRanking.ranking_points}`);
  check("established starts at 0 ranking points too — R-11's 20-point head start is gone",
    establishedRanking.ranking_points === 0, `got ${establishedRanking.ranking_points}`);

  const list = (fx) => (Array.isArray(fx) ? fx : []);
  const pays = (fx, tier, full) => {
    const at = list(fx).filter((m) => m.tier === tier);
    return at.length > 0 && at.every((m) => (full ? m.purse?.fullPurse === true && m.purse?.multiplier === 1
      : m.purse?.fullPurse === false && m.purse?.multiplier === 0.1));
  };
  const accessOf = (fx) => [...new Set(list(fx).map((m) => m.purse?.accessTier))].join(",");
  check("underdog's season-1 purse access is Bronze: Bronze pays in full, Silver and Gold pay 10%",
    accessOf(underdogFixtures) === "Bronze" && pays(underdogFixtures, "Bronze", true)
      && pays(underdogFixtures, "Silver", false) && pays(underdogFixtures, "Gold", false),
    `access ${accessOf(underdogFixtures)}`);
  check("established's season-1 purse access is Silver: Bronze and Silver pay in full, Gold pays 10%",
    accessOf(establishedFixtures) === "Silver" && pays(establishedFixtures, "Bronze", true)
      && pays(establishedFixtures, "Silver", true) && pays(establishedFixtures, "Gold", false),
    `access ${accessOf(establishedFixtures)}`);

  // The gate and the head start are gone from the source, not just unused.
  const walkTs = (dir, out = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walkTs(p, out); else if (e.name.endsWith(".ts")) out.push(p);
    }
    return out;
  };
  const OLD_GATE = /awardedPoints|eligibilityFor|below_threshold|ESTABLISHED_STARTING_RANKING_POINTS|startingRankingPointsFor|PUSHED_OUT_PRIZE_MULTIPLIER/;
  const gateHits = walkTs(path.join(REPO, "artifacts", "api-server", "src"))
    .filter((f) => OLD_GATE.test(fs.readFileSync(f, "utf8"))).map((f) => path.relative(REPO, f));
  check("no ranking gate or head start remains in the api source", gateHits.length === 0, gateHits.join(", ") || "clean");
  check("the scan is real: the old gate line is caught",
    OLD_GATE.test("  const points = awardedPoints(args.tier, args.won, existing?.rankingPoints ?? 0);"));

  // ── Starting squad quality: established should be strictly stronger ────────
  const underdogSquadAvg    = squadAverage(db, underdogTeamId);
  const establishedSquadAvg = squadAverage(db, establishedTeamId);
  check("both careers actually got a starting squad", underdogSquadAvg !== null && establishedSquadAvg !== null,
    `underdog=${underdogSquadAvg} established=${establishedSquadAvg}`);
  check("established's starting squad is stronger on average than underdog's",
    establishedSquadAvg > underdogSquadAvg,
    `underdog avg ${underdogSquadAvg?.toFixed(1)} vs established avg ${establishedSquadAvg?.toFixed(1)}`);

  db.close();
} finally {
  try { child.kill("SIGKILL"); } catch {}
  await new Promise((r) => setTimeout(r, 300));
  try { fs.closeSync(out); } catch {}
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch {} }
process.exit(failures > 0 ? 1 : 0);
