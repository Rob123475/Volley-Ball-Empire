/**
 * R-48 (1) — starting-squad contracts are dated from the career's own season.
 *
 * ── The bug ──────────────────────────────────────────────────────────────────
 * POST /careers signed the starting squad to a literal "2026-12-31", and dated
 * the contracts from the computer's clock. A career whose first season was any
 * year but 2026 would have begun with its whole squad already out of contract.
 * Rob: contracts must be set relative to the career's start, never a literal
 * year — fixed at the source.
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 *   dates     for a fresh established AND underdog career: every starting-squad
 *             contract starts on the career's season start date and ends on its
 *             season end date, in the contracts table and in career state
 *   source    the career-creation path (routes/careers.ts, utils/seedStartingSquad.ts)
 *             holds no quoted calendar date and no literal season year
 *   sabotage  the source scan finds a planted literal date and a literal year
 *
 * Usage: node harness/starting-contracts.mjs
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
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-starting-contracts-"));
const PORT = 4710;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

if (!fs.existsSync(SERVER)) {
  console.error(`[starting-contracts] FAILED: ${SERVER} not built.`);
  process.exit(1);
}

// ── the source check, as a pure function so sabotage can re-run it ───────────
const QUOTED_DATE = /["'`]\d{4}-\d{2}-\d{2}["'`]/;
const LITERAL_YEAR = /\byear\s*:\s*\d{4}\b|ensureCompetitorRanking\([^)]*\b20\d\d\b/;
function literalDateLines(text) {
  return text.split(/\r?\n/)
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => !/^\s*(\/\/|\*)/.test(line))       // comments may cite dates
    .filter(({ line }) => QUOTED_DATE.test(line) || LITERAL_YEAR.test(line))
    .map(({ line, n }) => `${n}: ${line.trim()}`);
}

const dbFile = path.join(WORK, "contracts.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: {
    ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT),
    NODE_ENV: "development", SESSION_SECRET: "starting-contracts-secret",
  },
});

{
  const deadline = Date.now() + 60000;
  let up = false;
  while (Date.now() < deadline) {
    try { await fetch(`${BASE}/health`); up = true; break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  if (!up) {
    console.error("[starting-contracts] server never came up");
    console.error(fs.readFileSync(path.join(WORK, "server.log"), "utf8").slice(-3000));
    process.exit(1);
  }
}

function session() {
  let cookie = "";
  return async function api(method, p, body) {
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
}

console.log("=".repeat(72));
console.log("  R-48 (1) STARTING-SQUAD CONTRACTS ARE DATED FROM THE CAREER'S SEASON");
console.log("=".repeat(72));

const careers = [];
try {
  for (const difficulty of ["established", "underdog"]) {
    const api = session();
    const label = `Contracts ${difficulty}`;
    const prof = await api("POST", "/profiles", { name: label });
    await api("POST", `/profiles/${prof.data.id}/select`);
    const c = await api("POST", "/careers", {
      slotNumber: 1, managerName: label, managerNationality: "Australia",
      clubName: `${label} FC`, originalClubName: `${label} FC`, season: "Season 1",
      budget: "500000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a", difficulty,
    });
    check(`${difficulty} career created`, c.status === 200, `HTTP ${c.status}`);
    careers.push({ difficulty, careerSaveId: c.data?.id, teamId: c.data?.teamId });
  }
} finally {
  await stopServer(child);
  try { fs.closeSync(out); } catch { /* closed */ }
}

console.log("\n1. EVERY STARTING CONTRACT RUNS FOR THE CAREER'S FIRST SEASON");
const d = new DatabaseSync(dbFile, { readOnly: true });
for (const { difficulty, careerSaveId, teamId } of careers) {
  const season = d.prepare(`SELECT year, start_date, end_date FROM seasons WHERE career_save_id = ? AND status = 'active'`).get(careerSaveId);
  const contracts = d.prepare(`SELECT player_id, start_date, end_date, status FROM contracts WHERE team_id = ?`).all(teamId);
  const state = d.prepare(`SELECT player_id, contract_end_date FROM career_player_state WHERE career_save_id = ? AND team_id = ?`).all(careerSaveId, teamId);
  check(`${difficulty}: the career has its season row`, !!season, JSON.stringify(season));
  check(`${difficulty}: the starting squad was signed (3 contracts)`, contracts.length === 3 && contracts.every((k) => k.status === "active"),
    `${contracts.length} contracts`);
  check(`${difficulty}: every contract starts on the season's start date`,
    !!season && contracts.length > 0 && contracts.every((k) => k.start_date === season.start_date),
    `season ${season?.start_date}; contracts ${[...new Set(contracts.map((k) => k.start_date))].join(", ")}`);
  check(`${difficulty}: every contract ends on the season's end date`,
    !!season && contracts.length > 0 && contracts.every((k) => k.end_date === season.end_date),
    `season ${season?.end_date}; contracts ${[...new Set(contracts.map((k) => k.end_date))].join(", ")}`);
  check(`${difficulty}: career state carries the same end date for every squad player`,
    !!season && state.length === contracts.length && state.every((p) => p.contract_end_date === season.end_date),
    `${state.length} players`);
}
d.close();

console.log("\n2. THE CAREER-CREATION PATH HOLDS NO LITERAL DATE OR YEAR");
const sources = [
  path.join(REPO, "artifacts", "api-server", "src", "routes", "careers.ts"),
  path.join(REPO, "artifacts", "api-server", "src", "utils", "seedStartingSquad.ts"),
];
for (const file of sources) {
  const hits = literalDateLines(fs.readFileSync(file, "utf8"));
  check(`${path.relative(REPO, file)}: no quoted date, no literal season year`, hits.length === 0, hits.slice(0, 4).join(" | "));
}

console.log("\n3. SABOTAGE");
const planted = [
  `  await seedStartingSquad(save.id, team.id, { startDate: "2026-01-01", endDate: "2026-12-31" });`,
  `    year:                    2026,`,
  `  await ensureCompetitorRanking(team.id, save.id, 2026, points);`,
  `  // a comment may say 2026-12-31`,
].join("\n");
const plantedHits = literalDateLines(planted);
check("S1: the source check finds a planted literal date, literal year and literal ranking year — and not a comment",
  plantedHits.length === 3, plantedHits.join(" | "));

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
