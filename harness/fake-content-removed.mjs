/**
 * R-43 — invented content is deleted, not stubbed.
 *
 * Before: the dashboard's World Tour News was mostly a day-seeded generator of
 * invented names and tournaments; Manager Movements was twelve invented clubs
 * ticking at random; the youth league was a hardcoded AI ladder with
 * Math.random results, a coin-flip championship and a form strip hashed from a
 * club name; the Job Market was hardcoded listings; poaching offers came from a
 * hardcoded club pool; the leaderboard carried a "Reputation Bonus" card backed
 * by nothing; the Olympic schedule re-rolled its results on every read.
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 *   source     none of it is left in the api, frontend, spec, schema or scripts
 *              (and the scan is real: a planted line of each is caught); the
 *              built bundle carries none of the removed screens' text
 *   starter    the shipped database has none of the removed tables or columns
 *   migrated   an older save that still has them (with rows) loses them at boot,
 *              and its profile can still be deleted
 *   gone       every removed endpoint answers 404
 *   news       every news item names a real row: a completed match, a signed
 *              contract, a trophy, a board review or a World Final
 *   olympics   the schedule is a projected draw — no scores, identical on every
 *              read
 *
 * Usage: node harness/fake-content-removed.mjs
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
const PUBLIC = path.join(REPO, "artifacts", "api-server", "dist", "public");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-fake-content-"));
const PORT = 4770;
const BASE = `http://localhost:${PORT}/api`;

const REMOVED_TABLES = [
  "youth_league_results", "youth_ladder", "youth_championship_trophies",
  "poaching_offers", "ai_managers", "ai_manager_events",
];

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log("  R-43 INVENTED CONTENT IS DELETED, NOT STUBBED");
console.log("=".repeat(72));

// ── 0. Source ───────────────────────────────────────────────────────────────
console.log("\n0. NONE OF IT IS LEFT IN THE SOURCE");
const PATTERNS = [
  ["the invented World Tour news generator", /generateWorldNews|news\/world-tour|WorldTourNews/, "function generateWorldNews(seed: number): NewsItem[] {"],
  ["Manager Movements (invented AI managers)", /aiManager|ai_manager|ai-managers|AiManager|ManagerMovements/, "router.get(\"/ai-managers/feed\", async (req, res) => {"],
  ["the youth league's results, ladder and championship", /youthLeague|youth-league|youth_league|youthLadder|youth_ladder|youthChampionship|youth_championship|YouthLeague|YouthLadder|YouthChampionship|AI_LADDER_TEAMS|OPPOSITION_NAMES/, "const AI_LADDER_TEAMS = [\"Valley Smashers\"];"],
  ["the youth form strip hashed from a club name", /mockForm/, "const form = mockForm(entry.competitorName, entry.wins, entry.losses);"],
  ["poaching offers from a hardcoded club pool", /POACHING_POOL|poaching|Poaching/, "const POACHING_POOL = [{ clubName: \"Rio Praia SC\" }];"],
  ["the hardcoded Job Market", /JOB_OFFERS|apply-job|applyJob|ApplyJob|JobMarket|job-market/, "const JOB_OFFERS: JobOffer[] = [];"],
  ["the leaderboard's Reputation Bonus card", /Reputation Bonus/, "label=\"Reputation Bonus\""],
  ["Olympic results rolled on every read", /simResult/, "const [hs, as_] = simResult(70, 70, 200 + i);"],
  ["the youth result carried into season summaries", /youthResult|youth_result/, "youthResult: text(\"youth_result\"),"],
];
// The boot migration that drops the old tables has to name them. It is the one
// file allowed to, and it is read below to prove it drops exactly those.
const ALLOWED = new Set([path.join(REPO, "artifacts/api-server/src/utils/removedContent.ts")]);
const ROOTS = [
  "artifacts/api-server/src", "artifacts/beach-volleyball/src", "lib/api-spec/openapi.yaml",
  "lib/db/src", "scripts/src", "lib/api-client-react/src/generated", "lib/api-zod/src/generated",
].map((r) => path.join(REPO, r));
function walk(p, out = []) {
  if (!fs.existsSync(p)) return out;
  const st = fs.statSync(p);
  if (st.isFile()) { if (/\.(ts|tsx|yaml|mjs|cjs|js)$/.test(p)) out.push(p); return out; }
  for (const e of fs.readdirSync(p)) { if (e !== "node_modules" && e !== "dist") walk(path.join(p, e), out); }
  return out;
}
const scan = (text) => PATTERNS.filter(([, re]) => re.test(text)).map(([label]) => label);
const files = ROOTS.flatMap((r) => walk(r)).filter((f) => !ALLOWED.has(f));
const hits = [];
for (const f of files) {
  const lines = fs.readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => { for (const label of scan(line)) hits.push(`${path.relative(REPO, f)}:${i + 1} ${label}`); });
}
check(`none of the invented content remains in ${files.length} api, frontend, spec, schema, script and generated files`,
  hits.length === 0, hits.length ? hits.slice(0, 12).join(" | ") : "clean");
const planted = PATTERNS.map(([label, , line], i) => ({ label, caught: scan(line).includes(label), i }));
check("the scan is real: a planted line of each is caught", planted.every((p) => p.caught),
  planted.map((p) => `#${p.i + 1} ${p.caught ? "caught" : "MISSED"}`).join(" | "));

const migration = fs.readFileSync([...ALLOWED][0], "utf8");
const declared = [...(/REMOVED_TABLES = \[([\s\S]*?)\]/.exec(migration)?.[1] ?? "").matchAll(/"([a-z_]+)"/g)].map((m) => m[1]).sort();
check("the boot migration drops exactly the six removed tables",
  JSON.stringify(declared) === JSON.stringify([...REMOVED_TABLES].sort()),
  `REMOVED_TABLES = [${declared.join(", ")}]`);

const BUNDLE_TEXT = ["World Tour News", "Live circuit updates", "Manager Movements", "Development League", "Youth League", "Reputation Bonus", "Job Market", "Poaching Approach"];
const bundleFiles = walk(PUBLIC).filter((f) => f.endsWith(".js"));
const bundleHits = [];
for (const f of bundleFiles) {
  const text = fs.readFileSync(f, "utf8");
  for (const s of BUNDLE_TEXT) if (text.includes(s)) bundleHits.push(`${path.basename(f)}: ${s}`);
}
check(`the built frontend (${bundleFiles.length} js files) shows none of the removed screens`,
  bundleFiles.length > 0 && bundleHits.length === 0, bundleHits.join(" | ") || "clean");

// ── 1. Starter database ─────────────────────────────────────────────────────
console.log("\n1. THE SHIPPED DATABASE HAS NONE OF IT");
function tablesOf(file) {
  const d = new DatabaseSync(file, { readOnly: true });
  const t = d.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
  const cols = d.prepare("PRAGMA table_info(manager_season_summaries)").all().map((c) => c.name);
  d.close();
  return { tables: new Set(t), summaryCols: new Set(cols) };
}
{
  const s = tablesOf(SHIPPED);
  const left = REMOVED_TABLES.filter((t) => s.tables.has(t));
  check("no removed table and no youth_result column in the starter", left.length === 0 && !s.summaryCols.has("youth_result"),
    `tables left [${left.join(", ")}], youth_result ${s.summaryCols.has("youth_result")}`);
}

if (!fs.existsSync(SERVER)) { console.error(`[fake-content] FAILED: ${SERVER} not built.`); process.exit(1); }
const dbFile = path.join(WORK, "migrated.sqlite");
fs.copyFileSync(SHIPPED, dbFile);

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
async function boot(label) {
  const out = fs.openSync(path.join(WORK, `${label}.log`), "w");
  const child = forkServer({
    server: SERVER, electron: ELECTRON, out,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "fake-content-secret" },
  });
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { await fetch(`${BASE}/health`); return { child, out }; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  console.error(`[fake-content] ${label} server never came up`);
  console.error(fs.readFileSync(path.join(WORK, `${label}.log`), "utf8").slice(-3000));
  process.exit(1);
}
async function shutdown(s) { await stopServer(s.child); try { fs.closeSync(s.out); } catch { /* closed */ } }
function read(sqlText, ...args) {
  const d = new DatabaseSync(dbFile, { readOnly: true });
  const rows = d.prepare(sqlText).all(...args);
  d.close();
  return rows;
}
async function newCareer(api, name) {
  const prof = await api("POST", "/profiles", { name });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const c = await api("POST", "/careers", {
    slotNumber: 1, managerName: name, managerNationality: "Australia", clubName: `${name} FC`, originalClubName: `${name} FC`,
    season: "Season 1", budget: "500000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a", difficulty: "established",
  });
  return { userId: prof.data.id, careerSaveId: c.data?.id, teamId: c.data?.teamId };
}

// ── 2. An older save that still has the tables ──────────────────────────────
console.log("\n2. AN OLDER SAVE LOSES THE TABLES AT BOOT, AND ITS PROFILE CAN STILL BE DELETED");
let legacy;
{
  const s = await boot("create");
  try { legacy = await newCareer(session(), "Legacy"); } finally { await shutdown(s); }
}
{
  // The tables exactly as the model declared them before R-43, with a row each
  // pointing at this profile's team, save and user — the rows that would block
  // the profile's deletion if they survived.
  const d = new DatabaseSync(dbFile);
  const playerId = d.prepare("SELECT id FROM players LIMIT 1").get().id;
  d.exec(`
    CREATE TABLE youth_league_results (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, team_id integer NOT NULL REFERENCES teams(id), player_id integer NOT NULL REFERENCES players(id), player_name text NOT NULL, week_number integer NOT NULL, result text NOT NULL, opposition_name text NOT NULL, xp_gained integer DEFAULT 0 NOT NULL, dev_points_gained integer DEFAULT 0 NOT NULL, morale_change integer DEFAULT 0 NOT NULL, player_rating_at_time integer DEFAULT 0 NOT NULL, created_at integer NOT NULL);
    CREATE TABLE youth_ladder (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, team_id integer NOT NULL REFERENCES teams(id), season integer DEFAULT 1 NOT NULL, competitor_name text NOT NULL, is_player integer DEFAULT false NOT NULL, wins integer DEFAULT 0 NOT NULL, losses integer DEFAULT 0 NOT NULL, points integer DEFAULT 0 NOT NULL, created_at integer NOT NULL);
    CREATE TABLE youth_championship_trophies (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, team_id integer NOT NULL REFERENCES teams(id), season integer NOT NULL, year integer, winning_team_name text NOT NULL, is_player_win integer DEFAULT false NOT NULL, created_at integer NOT NULL);
    CREATE TABLE poaching_offers (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, user_id text NOT NULL REFERENCES users(id), career_save_id integer NOT NULL REFERENCES career_saves(id), club_name text NOT NULL, continent text NOT NULL, country text NOT NULL, logo_color text NOT NULL, salary integer NOT NULL, contract_length integer NOT NULL, transfer_budget real NOT NULL, season_expectation text NOT NULL, club_reputation integer NOT NULL, status text DEFAULT 'pending' NOT NULL, created_at integer NOT NULL);
    CREATE TABLE ai_managers (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, career_save_id integer REFERENCES career_saves(id), name text NOT NULL, reputation integer DEFAULT 50 NOT NULL, current_club text, current_club_reputation integer, status text DEFAULT 'active' NOT NULL, hired_at integer, created_at integer NOT NULL);
    CREATE TABLE ai_manager_events (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, manager_name text NOT NULL, event_type text NOT NULL, from_club text, to_club text, description text NOT NULL, occurred_at integer NOT NULL);
    ALTER TABLE manager_season_summaries ADD COLUMN youth_result text;
  `);
  const now = Date.now();
  d.prepare("INSERT INTO youth_league_results (team_id, player_id, player_name, week_number, result, opposition_name, created_at) VALUES (?, ?, 'Old', 1, 'win', 'Valley Smashers', ?)").run(legacy.teamId, playerId, now);
  d.prepare("INSERT INTO youth_ladder (team_id, competitor_name, created_at) VALUES (?, 'Valley Smashers', ?)").run(legacy.teamId, now);
  d.prepare("INSERT INTO youth_championship_trophies (team_id, season, winning_team_name, created_at) VALUES (?, 1, 'Valley Smashers', ?)").run(legacy.teamId, now);
  d.prepare("INSERT INTO poaching_offers (user_id, career_save_id, club_name, continent, country, logo_color, salary, contract_length, transfer_budget, season_expectation, club_reputation, created_at) VALUES (?, ?, 'Rio Praia SC', 'South America', 'Brazil', '#000', 1, 1, 1, 'x', 50, ?)").run(legacy.userId, legacy.careerSaveId, now);
  d.prepare("INSERT INTO ai_managers (career_save_id, name, created_at) VALUES (?, 'Invented', ?)").run(legacy.careerSaveId, now);
  d.prepare("INSERT INTO ai_manager_events (manager_name, event_type, description, occurred_at) VALUES ('Invented', 'hired', 'x', ?)").run(now);
  d.close();
}
const main = await boot("main");
try {
  const after = tablesOf(dbFile);
  const left = REMOVED_TABLES.filter((t) => after.tables.has(t));
  check("boot drops all six tables and the youth_result column", left.length === 0 && !after.summaryCols.has("youth_result"),
    `tables left [${left.join(", ")}], youth_result ${after.summaryCols.has("youth_result")}`);
  const del = await session()("DELETE", `/profiles/${legacy.userId}`);
  const userLeft = read("SELECT COUNT(*) AS n FROM users WHERE id = ?", legacy.userId)[0].n;
  check("the older save's profile, which had rows in every one of them, deletes cleanly", del.status === 200 && userLeft === 0,
    `HTTP ${del.status} ${del.status !== 200 ? JSON.stringify(del.data) : ""}; users left ${userLeft}`);

  // ── 3. Removed endpoints ──────────────────────────────────────────────────
  console.log("\n3. EVERY REMOVED ENDPOINT IS GONE");
  const api = session();
  const career = await newCareer(api, "Honest");
  const gone = [
    ["GET", "/news/world-tour"], ["GET", "/ai-managers/feed"], ["GET", "/poaching/offers"],
    ["POST", "/poaching/offers/1/accept"], ["POST", "/careers/apply-job"],
    ["GET", "/youth-league/results"], ["GET", "/youth-league/ladder"], ["GET", "/youth-league/stars"], ["GET", "/youth-league/championship"],
  ];
  const answers = [];
  for (const [m, p] of gone) answers.push([`${m} ${p}`, (await api(m, p, m === "POST" ? {} : undefined)).status]);
  check("each answers 404", answers.every(([, s]) => s === 404), answers.map(([k, s]) => `${k} ${s}`).join(" | "));

  // ── 4. News from real rows ────────────────────────────────────────────────
  console.log("\n4. EVERY NEWS ITEM NAMES A REAL ROW");
  let played = 0;
  for (let i = 0; i < 200 && played < 6; i++) {
    const r = await api("POST", "/calendar/advance", {});
    if (r.data?.blocked === "pending_match") {
      const sim = await api("POST", `/matches/${r.data.pendingMatchId}/simulate`, {});
      if (sim.status >= 400) await api("POST", `/matches/${r.data.pendingMatchId}/forfeit`, {});
      played++;
    }
  }
  const news = await api("GET", "/news");
  const items = news.data?.items ?? [];
  const today = read("SELECT current_date AS d FROM calendar_state WHERE team_id = ?", career.teamId)[0]?.d ?? "";
  const bad = [];
  for (const it of items) {
    const m = /^(result|signing|trophy|board|champion|olympic)-(\d+)$/.exec(it.id ?? "");
    if (!m || m[1] !== it.type) { bad.push(`${it.id}: unknown kind`); continue; }
    const id = Number(m[2]);
    if (!(typeof it.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(it.date) && it.date <= today.slice(0, 10))) bad.push(`${it.id}: date ${it.date} vs today ${today}`);
    if (m[1] === "result") {
      const row = read("SELECT status, home_team_id, away_team_id, home_score, away_score, scheduled_at FROM matches WHERE id = ?", id)[0];
      const mine = row && (row.home_team_id === career.teamId || row.away_team_id === career.teamId);
      const my = row && (row.home_team_id === career.teamId ? row.home_score : row.away_score);
      const opp = row && (row.home_team_id === career.teamId ? row.away_score : row.home_score);
      if (!row || row.status !== "completed" || !mine || !it.headline.includes(`${my}–${opp}`) || row.scheduled_at.slice(0, 10) !== it.date) bad.push(`${it.id}: ${JSON.stringify(row)} vs "${it.headline}" ${it.date}`);
    } else if (m[1] === "signing") {
      const row = read("SELECT team_id, start_date FROM contracts WHERE id = ?", id)[0];
      if (!row || row.team_id !== career.teamId || row.start_date.slice(0, 10) !== it.date) bad.push(`${it.id}: ${JSON.stringify(row)} vs ${it.date}`);
    } else if (m[1] === "trophy") {
      if (read("SELECT COUNT(*) AS n FROM trophies WHERE id = ? AND team_id = ?", id, career.teamId)[0].n !== 1) bad.push(`${it.id}: no such trophy`);
    } else if (m[1] === "board") {
      if (read("SELECT COUNT(*) AS n FROM board_seasons WHERE id = ? AND career_save_id = ? AND outcome IS NOT NULL", id, career.careerSaveId)[0].n !== 1) bad.push(`${it.id}: no such review`);
    } else if (m[1] === "olympic") {
      if (read("SELECT COUNT(*) AS n FROM olympic_tournaments WHERE career_save_id = ? AND season_year = ?", career.careerSaveId, id)[0].n !== 1) bad.push(`${it.id}: no Olympic tournament played`);
    } else if (m[1] === "champion") {
      if (read("SELECT COUNT(*) AS n FROM world_tour_fixtures WHERE career_save_id = ? AND season_year = ? AND round = 72 AND status = 'completed'", career.careerSaveId, id)[0].n !== 1) bad.push(`${it.id}: no World Final played`);
    }
  }
  const results = items.filter((i) => i.type === "result").length;
  const signings = items.filter((i) => i.type === "signing").length;
  check(`after ${played} match days the feed has real results and signings`, news.status === 200 && results > 0 && signings > 0,
    `HTTP ${news.status}; ${items.length} items: ${results} results, ${signings} signings`);
  check("every item traces to its row, with that row's own game date", bad.length === 0 && items.length > 0, bad.slice(0, 5).join(" | ") || `${items.length} items checked`);

  // ── 5. Olympics ───────────────────────────────────────────────────────────
  // R-61 replaced the projected draw with a real tournament, played in Olympic
  // years only (harness/olympics-tournament.mjs). A career's first season is not
  // one, so there is nothing to show — and nothing is invented to fill the gap.
  console.log("\n5. THE OLYMPIC SCHEDULE INVENTS NOTHING");
  const s1 = await api("GET", "/olympics/schedule");
  const s2 = await api("GET", "/olympics/schedule");
  check("outside an Olympic year there is no tournament, and two reads are identical",
    s1.status === 200 && s1.data?.tournament === null && s1.data?.isOlympicYear === false
      && JSON.stringify(s1.data) === JSON.stringify(s2.data),
    `HTTP ${s1.status}; ${JSON.stringify({ isOlympicYear: s1.data?.isOlympicYear, olympicsYear: s1.data?.olympicsYear, tournament: s1.data?.tournament })}`);
} finally {
  await shutdown(main);
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
