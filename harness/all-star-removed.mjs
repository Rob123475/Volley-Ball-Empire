/**
 * R-45 — the All-Star events are gone.
 *
 * ── Rob's decision ───────────────────────────────────────────────────────────
 * Delete every remnant of the All-Star events: fixture generation, events,
 * tables/columns used only for them, UI references. "All-Star events" is parked
 * in docs/triage.md under V2 ideas.
 *
 * No All-Star event was on the schedule when this was decided, so what came out
 * was every special case for a match that could not exist, the page that waited
 * for it forever, and a player stat (career_stats.all_star_selections, 0 for all
 * 276 players) that nothing could ever raise. The season is 59 matches: 57 World
 * Tour rounds (R-44), the World Semi Final and the World Final.
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 *   fixture   a fresh career's season holds zero All-Star fixtures and exactly
 *             59 matches — 57 Bronze/Silver/Gold, 1 World Semi Final, 1 World
 *             Final, no other tier — read through GET /matches/fixture AND from
 *             the database
 *   source    no file the game is built from (server, frontend, schema, OpenAPI
 *             spec, generated clients, scripts, harness) mentions an All-Star,
 *             and the All-Star page file no longer exists
 *   shipped   the built server bundle and the frontend assets it serves carry no
 *             All-Star text, so the app has no All-Star route, tab or nav item
 *   database  no table, column or value in the shipped starter database mentions
 *             an All-Star; and a save made before R-45 (every player still
 *             carrying the stat) loses it on its next launch through the R-33
 *             reference update, with every player's player_v4 then byte-identical
 *             to the shipped one — nothing else touched
 *   sabotage  the fixture check, the file scanner and the database scanner are
 *             re-run on inputs with an All-Star planted in them and must FAIL
 *
 * Usage: node harness/all-star-removed.mjs
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
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-all-star-removed-"));
const PORT = 4690;
const BASE = `http://localhost:${PORT}/api`;

const REGULAR_TIERS = new Set(["Bronze", "Silver", "Gold"]);
const FINALS_TIERS = new Set(["World Semi Final", "World Final"]);
const EXPECTED_REGULAR = 57;   // R-44: three full 19-round cycles
const EXPECTED_FINALS = 2;     // World Semi Final + World Final
const EXPECTED_SEASON = EXPECTED_REGULAR + EXPECTED_FINALS;

// "All-Star", "All-Star Match", "all_star_selections", "allStar", "ALL_STAR"
// — but not a word that merely ends in "all" ("overallStars").
const ALL_STAR = /(?<![a-z])all[_-]?star/i;

// The two harness files that have to name this item: this suite, and run-all's
// line registering it. Nothing else is exempt.
const SCAN_EXEMPT = new Set([
  path.resolve(import.meta.filename),
  path.resolve(REPO, "harness", "run-all.mjs"),
]);

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

// ── the checks, as pure functions so sabotage can re-run them ────────────────

/** Everything wrong with a season fixture, or [] when it is the 59-match season. */
function fixtureProblems(rows) {
  const problems = [];
  const allStar = rows.filter((r) =>
    [r.tier, r.homeTeamName, r.awayTeamName, r.locationName].some((v) => ALL_STAR.test(String(v ?? ""))));
  if (allStar.length > 0) problems.push(`${allStar.length} All-Star fixture(s)`);
  if (rows.length !== EXPECTED_SEASON) problems.push(`${rows.length} fixtures, expected ${EXPECTED_SEASON}`);
  const regular = rows.filter((r) => REGULAR_TIERS.has(r.tier)).length;
  if (regular !== EXPECTED_REGULAR) problems.push(`${regular} World Tour fixtures, expected ${EXPECTED_REGULAR}`);
  const finals = rows.filter((r) => FINALS_TIERS.has(r.tier)).length;
  if (finals !== EXPECTED_FINALS) problems.push(`${finals} finals fixtures, expected ${EXPECTED_FINALS}`);
  const other = [...new Set(rows.map((r) => r.tier).filter((t) => !REGULAR_TIERS.has(t) && !FINALS_TIERS.has(t)))];
  if (other.length > 0) problems.push(`unexpected tier(s): ${other.join(", ")}`);
  return problems;
}

const SCAN_EXT = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|json|ya?ml|html|css)$/i;

/** Every line under `roots` that mentions an All-Star. */
function scan(roots) {
  const hits = [];
  const walk = (p) => {
    let st;
    try { st = fs.statSync(p); } catch { return; }
    if (st.isDirectory()) {
      if (["node_modules", ".git"].includes(path.basename(p))) return;
      for (const e of fs.readdirSync(p)) walk(path.join(p, e));
      return;
    }
    if (!SCAN_EXT.test(p) || SCAN_EXEMPT.has(path.resolve(p))) return;
    fs.readFileSync(p, "utf8").split(/\r?\n/).forEach((text, i) => {
      if (ALL_STAR.test(text)) {
        const at = text.search(ALL_STAR);
        hits.push(`${path.relative(REPO, p)}:${i + 1}: ${text.slice(Math.max(0, at - 40), at + 40).trim()}`);
      }
    });
  };
  for (const r of roots) walk(r);
  return hits;
}

/** Every table, column and text value in a database that mentions an All-Star. */
function scanDb(file) {
  const d = new DatabaseSync(file, { readOnly: true });
  const hits = new Map();
  const add = (k) => hits.set(k, (hits.get(k) ?? 0) + 1);
  for (const { name } of d.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()) {
    if (ALL_STAR.test(name)) add(`${name} (table)`);
    for (const c of d.prepare(`PRAGMA table_info("${name}")`).all()) {
      if (ALL_STAR.test(c.name)) add(`${name}.${c.name} (column)`);
    }
    for (const row of d.prepare(`SELECT * FROM "${name}"`).all()) {
      for (const [col, v] of Object.entries(row)) {
        if (typeof v === "string" && ALL_STAR.test(v)) add(`${name}.${col}`);
      }
    }
  }
  d.close();
  return [...hits].map(([k, n]) => `${k}: ${n}`);
}

// ── server ───────────────────────────────────────────────────────────────────

if (!fs.existsSync(SERVER)) {
  console.error(`[all-star-removed] FAILED: ${SERVER} not built.`);
  process.exit(1);
}

function boot(dbFile, label, extraEnv = {}) {
  const logFile = path.join(WORK, `${label}.log`);
  const out = fs.openSync(logFile, "w");
  const child = forkServer({
    server: SERVER, electron: ELECTRON, out,
    env: {
      ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT),
      NODE_ENV: "development", SESSION_SECRET: "all-star-removed-secret", ...extraEnv,
    },
  });
  return { child, out, logFile };
}

async function waitUp(srv, label) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { await fetch(`${BASE}/health`); return; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  console.error(`[all-star-removed] ${label}: server never came up`);
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

console.log("=".repeat(72));
console.log("  R-45 THE ALL-STAR EVENTS ARE GONE");
console.log("=".repeat(72));

// ── 1. a fresh career's season ───────────────────────────────────────────────
const dbFile = path.join(WORK, "all-star.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
let apiRows = [], teamId = null;
{
  const srv = boot(dbFile, "fresh-career");
  await waitUp(srv, "fresh-career");
  try {
    const prof = await api("POST", "/profiles", { name: "NoAllStar" });
    await api("POST", `/profiles/${prof.data.id}/select`);
    const c = await api("POST", "/careers", {
      slotNumber: 1, managerName: "NoAllStar", managerNationality: "Australia",
      clubName: "No All Star FC", originalClubName: "No All Star FC", season: "Season 1",
      budget: "500000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a",
    });
    check("fresh career created", c.status === 200, `HTTP ${c.status}`);
    teamId = c.data?.teamId;
    const fx = await api("GET", "/matches/fixture");
    apiRows = Array.isArray(fx.data) ? fx.data : [];
  } finally {
    await shutdown(srv);
  }
}

console.log("\n1. A FRESH CAREER'S SEASON");
const apiProblems = fixtureProblems(apiRows);
check(`GET /matches/fixture: zero All-Star fixtures, exactly ${EXPECTED_SEASON} matches (${EXPECTED_REGULAR} World Tour + ${EXPECTED_FINALS} finals)`,
  apiProblems.length === 0, apiProblems.join("; ") || `${apiRows.length} fixtures`);

{
  const dbh = new DatabaseSync(dbFile, { readOnly: true });
  const dbRows = dbh.prepare(
    `SELECT tier, home_team_name AS homeTeamName, away_team_name AS awayTeamName, location_name AS locationName
     FROM matches WHERE home_team_id = ?`).all(teamId);
  dbh.close();
  const dbProblems = fixtureProblems(dbRows);
  check(`database: the career's match rows are the same ${EXPECTED_SEASON}, none of them All-Star`,
    dbProblems.length === 0, dbProblems.join("; ") || `${dbRows.length} rows`);
}

console.log("\n2. NOTHING THE GAME IS BUILT FROM MENTIONS AN ALL-STAR");
const SOURCE_ROOTS = [
  path.join(REPO, "artifacts", "api-server", "src"),
  path.join(REPO, "artifacts", "beach-volleyball", "src"),
  path.join(REPO, "lib", "db", "src"),
  path.join(REPO, "lib", "api-spec"),
  path.join(REPO, "lib", "api-client-react", "src"),
  path.join(REPO, "lib", "api-zod", "src"),
  path.join(REPO, "scripts"),
  path.join(REPO, "harness"),
];
const sourceHits = scan(SOURCE_ROOTS);
check("no source, schema, spec, generated client, script or harness line mentions an All-Star",
  sourceHits.length === 0, sourceHits.slice(0, 8).join(" | ") || `${SOURCE_ROOTS.length} roots scanned`);
check("the All-Star page file is gone",
  !fs.existsSync(path.join(REPO, "artifacts", "beach-volleyball", "src", "pages", "competition", "all-star.tsx")));

console.log("\n3. NOR DOES WHAT SHIPS");
const DIST = path.join(REPO, "artifacts", "api-server", "dist");
const shippedHits = scan([DIST]);
const servedAssets = fs.existsSync(path.join(DIST, "public", "assets"))
  ? fs.readdirSync(path.join(DIST, "public", "assets")).filter((f) => f.endsWith(".js")).length : 0;
check("the built server bundle and the served frontend carry no All-Star text",
  servedAssets > 0 && shippedHits.length === 0,
  shippedHits.slice(0, 5).join(" | ") || `${servedAssets} frontend script(s) scanned`);

console.log("\n4. THE SHIPPED DATABASE, AND A SAVE MADE BEFORE R-45");
const shippedDbHits = scanDb(SHIPPED);
check("no table, column or value in the shipped starter database mentions an All-Star",
  shippedDbHits.length === 0, shippedDbHits.join(" | ") || "every table and row scanned");

// A save made before R-45: the same players, each still carrying the stat key
// exactly where it used to sit (last in career_stats).
const legacy = path.join(WORK, "legacy-save.sqlite");
fs.copyFileSync(SHIPPED, legacy);
{
  const d = new DatabaseSync(legacy);
  d.prepare("UPDATE players SET player_v4 = json_set(player_v4, '$.career_stats.all_star_selections', 0)").run();
  d.close();
}
const legacyBefore = scanDb(legacy);
{
  const srv = boot(legacy, "legacy-save", { STARTER_DB_PATH: SHIPPED });
  await waitUp(srv, "legacy-save");
  await shutdown(srv);
}
const legacyLog = fs.readFileSync(path.join(WORK, "legacy-save.log"), "utf8");
const shippedV4 = (() => {
  const d = new DatabaseSync(SHIPPED, { readOnly: true });
  const m = new Map(d.prepare("SELECT id, player_v4 FROM players").all().map((r) => [r.id, r.player_v4]));
  d.close();
  return m;
})();
const legacyV4 = (() => {
  const d = new DatabaseSync(legacy, { readOnly: true });
  const rows = d.prepare("SELECT id, player_v4 FROM players").all();
  d.close();
  return rows;
})();
const differ = legacyV4.filter((r) => r.player_v4 !== shippedV4.get(r.id));
const legacyAfter = scanDb(legacy);
check("a save made before R-45 loses the stat on its next launch, every player_v4 byte-identical to the shipped one",
  legacyV4.length === shippedV4.size && legacyV4.length > 0 && differ.length === 0 && legacyAfter.length === 0,
  `${legacyV4.length} players, ${differ.length} differ; after boot: ${legacyAfter.join(" | ") || "no All-Star anywhere"}`);
check("the boot log names the R-33 reference update that did it",
  /reference data backfilled/.test(legacyLog) && /players/.test(legacyLog),
  /reference data backfilled/.test(legacyLog) ? "" : "log never mentions the reference update");

console.log("\n5. SABOTAGE — the checks above must catch what they exist for");
const planted = [...apiRows, {
  tier: "All-Star Match", homeTeamName: "Europe / Asia / Oceania All-Stars", awayTeamName: "TBD", locationName: "x",
}];
check("S1: a season with an All-Star fixture planted in it FAILS the fixture check",
  fixtureProblems(planted).some((p) => /All-Star/.test(p)), fixtureProblems(planted).join("; "));
const plantDir = path.join(WORK, "planted");
fs.mkdirSync(plantDir);
fs.writeFileSync(path.join(plantDir, "tiers.ts"), `export const T = ["Bronze", "All-Star Match"];\n`);
fs.writeFileSync(path.join(plantDir, "stats.json"), `{"mvp_awards": 0, "all_star_selections": 0}\n`);
fs.writeFileSync(path.join(plantDir, "overall.ts"), `export const overallStars = 3;\n`);
const plantedHits = scan([plantDir]);
check("S2: the file scanner finds both planted All-Stars and ignores \"overallStars\"",
  plantedHits.length === 2, plantedHits.join(" | "));
check("S3: the database scanner found the stat in the pre-R-45 save before it booted",
  legacyBefore.some((h) => h.startsWith(`players.player_v4: ${shippedV4.size}`)), legacyBefore.join(" | "));

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
