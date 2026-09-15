/**
 * R-63 — the academy's cap and its wages.
 *
 * Rob's decisions (15 Sep): the academy holds 12. The intake takes up to 3 a
 * season but never past the cap; the Team page banner and the signing rule read
 * the same cap constant. An academy player's wage is billed ONCE, in the weekly
 * wage run — the per-match charge is removed.
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 *   code     ACADEMY_CAP = 12 is the only academy number: the signing rule, the
 *            scouting sign route, the intake and GET /team/roster read it, and the
 *            Team page has no number of its own; the academy wage table exists
 *            once; the match route and the contract tick charge nothing
 *   signing  12 youth players sign; the 13th is refused, naming 12/12; the roster
 *            reports the academy's size and cap
 *   intake   an academy of 11 takes exactly 1 at the next boundary and Club News
 *            says it is now full; an academy of 12 takes no one and Club News says
 *            it is full
 *   wages    every salary week of a season bills once: seniors' monthly salaries /
 *            (52/12) plus each academy player's weekly academy wage; no match
 *            writes a wage row, and no match moves the budget by anything but its
 *            own ledger rows
 *   report   what a full academy costs a season
 *
 * Usage: node harness/academy-cap-wages.mjs
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
const SRC = path.join(REPO, "artifacts", "api-server", "src");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-academy-"));
const PORT = 4830;
const BASE = `http://localhost:${PORT}/api`;
const CAP = 12;
const WEEKS_PER_MONTH = 52 / 12;
const SALARY_CATEGORIES = ["salaries", "player_salary"];

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log("  R-63 ACADEMY CAP AND WAGES");
console.log("=".repeat(72));

// ── 0. Code ─────────────────────────────────────────────────────────────────
console.log("\n0. THE CODE");
const src = (p) => fs.readFileSync(path.join(REPO, p), "utf8");
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}
const serverFiles = walk(SRC).map((f) => ({ f: path.relative(REPO, f).split(path.sep).join("/"), text: fs.readFileSync(f, "utf8") }));
const squadRules = src("artifacts/api-server/src/utils/squadRules.ts");
const academy = src("artifacts/api-server/src/utils/academy.ts");
const contracts = src("artifacts/api-server/src/routes/contracts.ts");
const scouting = src("artifacts/api-server/src/routes/youth-scouting.ts");
const intake = src("artifacts/api-server/src/utils/youthIntake.ts");
const teamRoute = src("artifacts/api-server/src/routes/team.ts");
const teamPage = src("artifacts/beach-volleyball/src/pages/team.tsx");
const matches = src("artifacts/api-server/src/routes/matches.ts");
const tick = src("artifacts/api-server/src/utils/academyDevelopment.ts");
const calendar = src("artifacts/api-server/src/routes/calendar.ts");

check("the cap is one constant, 12, and the signing rule, the scouting sign route, the intake and the roster read it",
  /export const ACADEMY_CAP = 12;/.test(squadRules) && /counts\.youth >= ACADEMY_CAP/.test(squadRules)
    && !serverFiles.some((x) => /MAX_YOUTH/.test(x.text))
    && /refusalReason\(/.test(contracts) && /refusalReason\(/.test(scouting) && !/\b6\/6\b|>= 6\b/.test(scouting)
    && /ACADEMY_CAP - sizeBefore/.test(intake) && /cap: ACADEMY_CAP/.test(teamRoute));
check("the Team page has no academy number of its own: its banner and text read the roster's cap",
  /roster\?\.academy\?\.cap/.test(teamPage) && !/YOUTH_MAX/.test(teamPage) && !/up to 6/.test(teamPage)
    && /\{youthCount\} \/ \{academyCap\}/.test(teamPage));
const wageTables = serverFiles.filter((x) => /Generational:\s*250/.test(x.text)).map((x) => x.f);
check("the academy wage table exists once", wageTables.length === 1 && wageTables[0].endsWith("utils/academy.ts"), wageTables.join(", "));
check("the match route and the contract tick charge no wages; the weekly wage run bills the academy",
  !/Academy wages/.test(matches) && !/budget|financeTransactionsTable/.test(tick)
    && /academyWeeklyWage\(p\.potential\)/.test(calendar));
const WAGE = Object.fromEntries([...(/ACADEMY_WEEKLY_WAGE[^=]*=\s*\{([^}]*)\}/.exec(academy)?.[1] ?? "").matchAll(/(\w+):\s*(\d+)/g)]
  .map((m) => [m[1], Number(m[2])]));

if (!fs.existsSync(SERVER)) { console.error(`[academy] FAILED: ${SERVER} not built.`); process.exit(1); }
const dbFile = path.join(WORK, "academy.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "academy-secret" },
});
{
  const deadline = Date.now() + 60000;
  let up = false;
  while (Date.now() < deadline) { try { await fetch(`${BASE}/health`); up = true; break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  if (!up) { console.error("[academy] server never came up"); process.exit(1); }
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

async function newCareer(name) {
  const api = session();
  const prof = await api("POST", "/profiles", { name });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const c = await api("POST", "/careers", {
    slotNumber: 1, managerName: name, managerNationality: "Brazil", clubName: `${name} FC`, originalClubName: `${name} FC`,
    season: "Season 1", budget: "500000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a", difficulty: "established",
  });
  if (c.status >= 400) throw new Error(`career ${name}: ${c.status} ${JSON.stringify(c.data)}`);
  // Test setup, on this harness's own DB copy: the seeded squad is made the best
  // in the world so the board has no reason to end a season this suite needs.
  const w = new DatabaseSync(dbFile);
  w.prepare(`UPDATE career_player_state SET speed = 99, power = 99, defense = 99, serve = 99, block = 99, stamina = 99
             WHERE career_save_id = ? AND team_id = ?`).run(c.data.id, c.data.teamId);
  w.close();
  return { api, careerSaveId: c.data.id, teamId: c.data.teamId, name };
}

/** Sign `n` academy players through POST /contracts: youth free agents aged 14-15, so none is promoted at the next boundary. */
async function signYouth(career, n) {
  const { api } = career;
  const season = (await api("GET", "/seasons/current")).data;
  const pool = ((await api("GET", "/players/youth-pool")).data ?? []).filter((p) => p.age <= 15).sort((a, b) => a.id - b.id);
  const signed = [];
  for (const p of pool.slice(0, n)) {
    const r = await api("POST", "/contracts", { playerId: p.id, salary: p.salary ?? 0, endDate: season.endDate, bonusPerWin: 0, squadRole: "reserve" });
    if (r.status >= 400) throw new Error(`signing ${p.name}: ${r.status} ${JSON.stringify(r.data)}`);
    signed.push(p);
  }
  return { signed, next: pool[n] };
}

const roster = async (career) => (await career.api("GET", "/team/roster")).data;
const maxTx = () => read(`SELECT COALESCE(MAX(id), 0) AS n FROM finance_transactions`)[0].n;
const budget = (teamId) => Number(read(`SELECT budget FROM teams WHERE id = ?`, teamId)[0].budget);

/** What the weekly wage run should bill now, from the club's players. */
function expectedWeekly({ careerSaveId, teamId }) {
  const rows = read(`SELECT s.salary, s.is_promoted, p.player_type, p.potential
    FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.team_id = ? AND s.is_retired = 0`, careerSaveId, teamId);
  let monthly = 0, academyWeekly = 0, academyCount = 0;
  for (const r of rows) {
    if (r.player_type === "youth" && !r.is_promoted) { academyWeekly += WAGE[r.potential] ?? WAGE.Average; academyCount++; }
    else monthly += Number(r.salary);
  }
  return { amount: Math.round(monthly / WEEKS_PER_MONTH) + academyWeekly, academyWeekly, academyCount };
}

/**
 * Play a career day by day to its first season boundary, checking the ledger on
 * every call: a salary week bills once at the expected amount; a match writes no
 * wage row and moves the budget only by its own rows.
 */
async function playSeasonCheckingWages(career) {
  const { api, teamId } = career;
  const weeks = [], badWeeks = [], matchWageRows = [], budgetDrift = [];
  let matchesChecked = 0;
  for (let step = 0; step < 1200; step++) {
    const expected = expectedWeekly(career);
    const before = maxTx();
    const r = await api("POST", "/calendar/advance", {});
    if (r.status >= 400) throw new Error(`advance ${r.status} ${JSON.stringify(r.data)}`);
    const rows = read(`SELECT category, amount, description, date FROM finance_transactions WHERE id > ? AND team_id = ?`, before, teamId);
    const wageRows = rows.filter((x) => SALARY_CATEGORIES.includes(x.category));
    if (wageRows.length > 0) {
      weeks.push({ date: wageRows[0].date, amount: wageRows[0].amount, expected: expected.amount, academyWeekly: expected.academyWeekly, academyCount: expected.academyCount });
      if (wageRows.length !== 1 || wageRows[0].category !== "salaries" || Number(wageRows[0].amount) !== expected.amount) {
        badWeeks.push(`${wageRows[0].date}: ${wageRows.map((x) => `${x.category} ${x.amount}`).join(" + ")} vs expected ${expected.amount}`);
      }
    }
    if (r.data?.fired) throw new Error("sacked");
    if (r.data?.blocked === "pending_match") {
      const b0 = budget(teamId), t0 = maxTx();
      let sim = await api("POST", `/matches/${r.data.pendingMatchId}/simulate`, {});
      if (sim.status >= 400) sim = await api("POST", `/matches/${r.data.pendingMatchId}/forfeit`, {});
      if (sim.data?.fired) throw new Error("sacked");
      const matchRows = read(`SELECT type, category, amount, description FROM finance_transactions WHERE id > ? AND team_id = ?`, t0, teamId);
      matchesChecked++;
      const wr = matchRows.filter((x) => SALARY_CATEGORIES.includes(x.category) || /wage|salar/i.test(x.description ?? ""));
      if (wr.length > 0) matchWageRows.push(`match ${r.data.pendingMatchId}: ${wr.map((x) => `${x.description} ${x.amount}`).join("; ")}`);
      const net = matchRows.reduce((s, x) => s + (x.type === "income" ? 1 : -1) * Number(x.amount), 0);
      const delta = budget(teamId) - b0;
      if (Math.abs(delta - net) > 0.01) budgetDrift.push(`match ${r.data.pendingMatchId}: budget ${delta} vs ledger ${net}`);
      continue;
    }
    const roll = r.data?.seasonRollover;
    if (roll && roll.kind !== "none") return { roll, weeks, badWeeks, matchWageRows, budgetDrift, matchesChecked };
  }
  throw new Error("the season never ended");
}

try {
  // ── 1. Signing up to the cap ──────────────────────────────────────────────
  console.log("\n1. SIGNING UP TO THE CAP");
  const A = await newCareer("CapEleven");
  const r0 = await roster(A);
  check("a new club's roster reports an empty academy and its cap",
    r0?.academy?.size === 0 && r0?.academy?.cap === CAP, JSON.stringify(r0?.academy));
  const { signed, next } = await signYouth(A, CAP);
  const r12 = await roster(A);
  check(`${CAP} youth players sign into the academy`, signed.length === CAP && r12?.academy?.size === CAP && r12?.academy?.cap === CAP,
    JSON.stringify(r12?.academy));
  const season = (await A.api("GET", "/seasons/current")).data;
  const refused = await A.api("POST", "/contracts", { playerId: next.id, salary: next.salary ?? 0, endDate: season.endDate, bonusPerWin: 0, squadRole: "reserve" });
  check(`the ${CAP + 1}th is refused, naming the cap`, refused.status === 422 && /Academy is full \(12\/12\)/.test(refused.data?.error ?? ""),
    `HTTP ${refused.status} ${JSON.stringify(refused.data?.error)}`);
  await A.api("POST", `/players/${signed[CAP - 1].id}/release`, {});
  const r11 = await roster(A);
  check("releasing one leaves 11 of 12", r11?.academy?.size === CAP - 1, JSON.stringify(r11?.academy));

  // ── 2. Wages over a season ────────────────────────────────────────────────
  console.log("\n2. WAGES: ONCE A WEEK, NEVER AFTER A MATCH");
  const seasonA = await playSeasonCheckingWages(A);
  const withAcademy = seasonA.weeks.filter((w) => w.academyCount === CAP - 1);
  check("every salary week bills once: seniors' monthly / (52/12) + each academy player's weekly academy wage",
    seasonA.badWeeks.length === 0 && withAcademy.length >= 50,
    seasonA.badWeeks.slice(0, 3).join(" | ") || `${seasonA.weeks.length} salary weeks, ${withAcademy.length} with 11 in the academy (academy part $${withAcademy[0]?.academyWeekly}/week)`);
  check("no match writes a wage row", seasonA.matchWageRows.length === 0 && seasonA.matchesChecked >= 50,
    seasonA.matchWageRows.slice(0, 3).join(" | ") || `${seasonA.matchesChecked} matches`);
  check("no match moves the budget by anything but its own ledger rows", seasonA.budgetDrift.length === 0,
    seasonA.budgetDrift.slice(0, 3).join(" | ") || `${seasonA.matchesChecked} matches reconciled`);

  // ── 3. The intake stops at the cap ────────────────────────────────────────
  console.log("\n3. THE INTAKE STOPS AT 12");
  const rowA = read(`SELECT player_ids, outcome, academy_size FROM youth_intakes WHERE career_save_id = ? AND season_year = 2027`, A.careerSaveId)[0];
  const rA = await roster(A);
  check("an academy of 11 takes exactly 1, to 12",
    seasonA.roll.kind === "rolled" && !!rowA && JSON.parse(rowA.player_ids).length === 1 && rowA.outcome === "joined" && rowA.academy_size === CAP
      && seasonA.roll.intake?.players.length === 1 && rA?.academy?.size === CAP,
    rowA ? `${JSON.parse(rowA.player_ids).length} joined, outcome ${rowA.outcome}, academy ${rowA.academy_size}; roster ${JSON.stringify(rA?.academy)}` : `no intake row; roll ${seasonA.roll.kind}`);
  const newsA = ((await A.api("GET", "/news")).data?.items ?? []).find((i) => i.id === "academy-2027");
  check("Club News says one joined and the academy is now full",
    !!newsA && /^1 youth player joins the .+ academy$/.test(newsA.headline) && /The academy is now full \(12\/12\)/.test(newsA.detail),
    newsA ? `"${newsA.headline}" — ${newsA.detail}` : "no academy-2027 item");

  const B = await newCareer("CapTwelve");
  await signYouth(B, CAP);
  const seasonB = await playSeasonCheckingWages(B);
  const rowB = read(`SELECT player_ids, outcome, academy_size FROM youth_intakes WHERE career_save_id = ? AND season_year = 2027`, B.careerSaveId)[0];
  const rB = await roster(B);
  check("an academy of 12 takes no one",
    seasonB.roll.kind === "rolled" && !!rowB && JSON.parse(rowB.player_ids).length === 0 && rowB.outcome === "full" && rowB.academy_size === CAP
      && rB?.academy?.size === CAP,
    rowB ? `${JSON.parse(rowB.player_ids).length} joined, outcome ${rowB.outcome}, academy ${rowB.academy_size}` : `no intake row; roll ${seasonB.roll.kind}`);
  const newsB = ((await B.api("GET", "/news")).data?.items ?? []).find((i) => i.id === "academy-2027");
  check("Club News says the academy is full",
    !!newsB && /academy is full \(12\/12\): no intake this year$/.test(newsB.headline),
    newsB ? `"${newsB.headline}"` : "no academy-2027 item");
  check("a full academy's season bills its wages once a week too, and never after a match",
    seasonB.badWeeks.length === 0 && seasonB.matchWageRows.length === 0 && seasonB.budgetDrift.length === 0,
    [...seasonB.badWeeks, ...seasonB.matchWageRows, ...seasonB.budgetDrift].slice(0, 3).join(" | ") || `${seasonB.weeks.length} weeks, ${seasonB.matchesChecked} matches`);

  // ── 4. What a full academy costs ──────────────────────────────────────────
  console.log("\n4. WHAT A FULL ACADEMY COSTS");
  const fullWeeks = seasonB.weeks.filter((w) => w.academyCount === CAP);
  const perWeek = fullWeeks[0]?.academyWeekly ?? 0;
  const billed = fullWeeks.reduce((s, w) => s + w.academyWeekly, 0);
  const shipped = read(`SELECT potential, COUNT(*) AS n FROM players WHERE player_type = 'youth' AND origin_career_save_id IS NULL GROUP BY potential`);
  const mixWeekly = shipped.reduce((s, r) => s + (WAGE[r.potential] ?? WAGE.Average) * r.n, 0) / shipped.reduce((s, r) => s + r.n, 0);
  console.log(`  REPORT  CapTwelve's academy of 12 cost $${perWeek}/week; billed in ${fullWeeks.length} salary weeks of 2026: $${billed.toLocaleString()} for the season.`);
  console.log(`  REPORT  At the shipped youth's potential mix ($${mixWeekly.toFixed(2)}/player/week): $${Math.round(CAP * mixWeekly * fullWeeks.length).toLocaleString()} a season; ` +
    `all Average $${(CAP * WAGE.Average * fullWeeks.length).toLocaleString()}, all Elite $${(CAP * WAGE.Elite * fullWeeks.length).toLocaleString()}. ` +
    `The weekly run also charges staff at 20% of the wage bill, which adds 20% on top.`);
  check("a full academy's season was billed at 12 players' weekly academy wages",
    fullWeeks.length >= 50 && perWeek > 0, `${fullWeeks.length} weeks at $${perWeek}`);
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
