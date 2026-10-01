/**
 * Overnight brief 1 Oct, N-41 — the money pass (Rob's decisions, 1 Oct).
 *
 * Every number is in lib/db/src/schema/money.ts; this suite imports it (Node
 * strips the types), so it checks the game against the file Rob tunes:
 *
 *   managers     every manager is paid a monthly salary in range, weekly from
 *                the club's budget; the ledger line is "Manager salary"; the
 *                Manager Profile shows the same figure
 *   coaches      no head coach above the cap (reference data and career state)
 *   players      every senior's market wage = her asking wage + the rise for
 *                her rating; youth are not raised; every AI club's contract =
 *                the AI wage + the rise
 *   sponsors     the weekly sponsor line = reputation x $200 + the flat sum
 *   start        a new career still starts on the money the club picker shows
 *   old saves    a copy of Rob's 1 Oct backup is raised ONCE at boot: signed
 *                seniors (state and contract) by exactly their rise, free
 *                agents to the market wage, AI contracts to the new AI wage,
 *                head coaches to the cap; a second boot changes nothing
 *
 * Usage: node harness/money-pass.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { MONEY, managerSalaryFor, playerWageRise } from "../lib/db/src/schema/money.ts";
import { STARTING_BUDGET } from "../lib/db/src/schema/career-difficulty.ts";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const ROB = path.join(os.homedir(), "Downloads", "volleyball-empire-backup-01oct-1225.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-money-pass-"));
const PORT = 4547;
const BASE = `http://localhost:${PORT}/api`;
const WEEKS_PER_MONTH = 52 / 12;

// READ, not restated: the server's own wage rules.
const src = (p) => fs.readFileSync(path.join(REPO, p), "utf8");
const num = (re, from) => Number(String(re.exec(from)?.[1] ?? "").replace(/_/g, ""));
const CURVE = src("artifacts/api-server/src/utils/wageCurve.ts");
const FIN = src("artifacts/api-server/src/utils/clubFinances.ts");
const KNEE = num(/WAGE_KNEE = ([\d_]+)/, CURVE), COMPRESSION = Number(/WAGE_COMPRESSION = ([\d.]+)/.exec(CURVE)?.[1]);
const ASK_PER = num(/ASK_PER_RATING_POINT = ([\d_]+)/, FIN), ASK_INT = -num(/ASK_INTERCEPT = -([\d_]+)/, FIN);
const MIN_M = num(/MIN_MONTHLY_SALARY = ([\d_]+)/, FIN), MAX_M = num(/MAX_MONTHLY_SALARY = ([\d_]+)/, FIN);
const PER_REP = num(/SPONSOR_INCOME_PER_REPUTATION = ([\d_]+)/, FIN);
const askingWage = (ask) => { const a = Number(ask ?? 0); return Math.round((a <= KNEE ? Math.max(0, a) : KNEE + (a - KNEE) * COMPRESSION) / 12); };
const aiWage = (r) => Math.max(MIN_M, Math.min(MAX_M, Math.round((ASK_PER * r + ASK_INT) / 12))) + playerWageRise(r);
// Overnight 1 Oct, N-33: a youth's wage is the academy's for her talent (utils/academy.ts), never raised.
const ACADEMY_SRC = src("artifacts/api-server/src/utils/academy.ts");
const ACADEMY_WEEKLY = Object.fromEntries([...ACADEMY_SRC.matchAll(/(Low|Average|High|Elite|Generational): (\d+)/g)].map((m) => [m[1], Number(m[2])]));
const academyWage = (potential) => (ACADEMY_WEEKLY[potential] ?? ACADEMY_WEEKLY.Average) * WEEKS_PER_MONTH;
const ovr = (p) => Math.round((p.speed + p.power + p.defense + p.serve + p.block + p.stamina) / 6);

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
console.log("=".repeat(72));
console.log("  OVERNIGHT 1 OCT, N-41: THE MONEY PASS");
console.log("=".repeat(72));
if (!fs.existsSync(SERVER)) { console.error(`[money-pass] FAILED: ${SERVER} not built.`); process.exit(1); }
check("the harness read the server's wage rules", [KNEE, COMPRESSION, ASK_PER, ASK_INT, MIN_M, MAX_M, PER_REP].every(Number.isFinite),
  `knee ${money(KNEE)} x${COMPRESSION}; AI ${ASK_PER}r${ASK_INT} /12 in ${money(MIN_M)}-${money(MAX_M)}`);

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
let child = null;
async function boot(dbFile, tag) {
  const out = fs.openSync(path.join(WORK, `server-${tag}.log`), "w");
  child = forkServer({
    server: SERVER, electron: ELECTRON, out,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development",
      SESSION_SECRET: "money-pass", STARTER_DB_PATH: SHIPPED },
  });
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) return; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("server did not boot");
}
async function stop() { if (child) await stopServer(child); child = null; cookie = ""; }

const read = (dbFile, sql, ...a) => { const d = new DatabaseSync(dbFile, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
// A save from before C15 has no pool_team_id yet (the boot adds it): read it as NULL there.
const hasColumn = (dbFile, table, col) => read(dbFile, `PRAGMA table_info(${table})`).some((c) => c.name === col);
const playerRows = (dbFile, cid) => read(dbFile,
  `SELECT s.player_id AS id, s.team_id AS teamId, s.salary, s.is_promoted AS promoted,
          ${hasColumn(dbFile, "career_player_state", "pool_team_id") ? "s.pool_team_id" : "NULL"} AS pool,
          s.speed, s.power, s.defense, s.serve, s.block, s.stamina, p.player_type AS type, p.asking_price AS ask, p.potential
     FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.career_save_id = ?`, cid);
const poolRows = (dbFile, cid) => read(dbFile,
  `SELECT c.id, c.salary, pp.speed, pp.power, pp.defense, pp.serve, pp.block, pp.stamina
     FROM pool_player_contracts c JOIN continental_pool_players pp ON pp.id = c.pool_player_id
    WHERE c.career_save_id = ? AND c.status = 'active'`, cid);
const coachOverCap = (dbFile) => read(dbFile,
  `SELECT (SELECT COUNT(*) FROM staff WHERE role = 'Head Coach' AND base_salary > ?) +
          (SELECT COUNT(*) FROM career_staff_state WHERE salary > ? AND staff_id IN (SELECT id FROM staff WHERE role = 'Head Coach')) AS n`,
  MONEY.headCoachSalaryMonthlyMax, MONEY.headCoachSalaryMonthlyMax)[0].n;
const senior = (p) => p.type === "senior" || (p.type === "youth" && p.promoted);

try {
  // ── 1. A new career, on the starter save ──────────────────────────────────
  console.log("\n1. A NEW CAREER");
  const fresh = path.join(WORK, "fresh.sqlite");
  fs.copyFileSync(SHIPPED, fresh);
  await boot(fresh, "fresh");
  const prof = await api("POST", "/profiles", { name: "Money Pass" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", {
    slotNumber: 1, managerName: "Money Pass", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0,
  });
  const team = (await api("GET", "/team")).data;
  const cid = ((await api("GET", "/careers")).data?.saves ?? []).find((s) => s.teamId === team.id)?.id;
  check("a new career starts on the money the club picker shows", Number(team.budget) === STARTING_BUDGET.established,
    `${money(team.budget)} (picker: ${money(STARTING_BUDGET.established)})`);
  check("a new career is built on the new numbers, so no boot raises it again",
    read(fresh, `SELECT money_pass_at AS m FROM career_saves WHERE id = ?`, cid)[0].m === "new career");

  const rows = playerRows(fresh, cid).filter((p) => p.pool == null);
  const freeSeniors = rows.filter((p) => senior(p) && p.teamId == null);
  const badFree = freeSeniors.filter((p) => Number(p.salary) !== askingWage(p.ask) + playerWageRise(ovr(p)));
  const rises = freeSeniors.map((p) => playerWageRise(ovr(p)));
  check("every senior free agent asks her asking wage + the rise for her rating",
    freeSeniors.length > 0 && badFree.length === 0 && Math.min(...rises) >= MONEY.playerWageRiseMonthly.min && Math.max(...rises) <= MONEY.playerWageRiseMonthly.max,
    `${freeSeniors.length} seniors, rises ${money(Math.min(...rises))}-${money(Math.max(...rises))}, asking ${money(Math.min(...freeSeniors.map((p) => p.salary)))}-${money(Math.max(...freeSeniors.map((p) => p.salary)))}${badFree.length ? `; ${badFree.length} wrong` : ""}`);
  const youth = rows.filter((p) => p.type === "youth" && !p.promoted);
  check("youth are not raised: each asks the academy's wage for her talent (N-33)", youth.length > 0 && youth.every((p) => Math.abs(Number(p.salary) - academyWage(p.potential)) < 0.01),
    `${youth.length} youth, $${Math.round(Math.min(...youth.map((p) => p.salary)))}-$${Math.round(Math.max(...youth.map((p) => p.salary)))} a month`);
  const signed = rows.filter((p) => senior(p) && p.teamId === team.id);
  check("the starting squad signs on those wages", signed.length > 0 && signed.every((p) => Number(p.salary) === askingWage(p.ask) + playerWageRise(ovr(p))),
    signed.map((p) => money(p.salary)).join(", "));
  const pool = poolRows(fresh, cid);
  check("every AI club's contract is the AI wage + the rise", pool.length > 0 && pool.every((c) => Number(c.salary) === aiWage(ovr(c))),
    `${pool.length} contracts, ${money(Math.min(...pool.map((c) => c.salary)))}-${money(Math.max(...pool.map((c) => c.salary)))}`);
  check("no head coach above the cap", coachOverCap(fresh) === 0, `cap ${money(MONEY.headCoachSalaryMonthlyMax)}`);

  // A salary week.
  let week = null;
  for (let i = 0; i < 12 && !week; i++) {
    await api("POST", "/calendar/advance", {});
    week = read(fresh, `SELECT * FROM finance_transactions WHERE team_id = ? AND category = 'manager_salary'`, team.id)[0] ?? null;
  }
  const salary = managerSalaryFor(`career:${cid}`);
  check("the manager's salary is in Rob's range", salary >= MONEY.managerSalaryMonthly.min && salary <= MONEY.managerSalaryMonthly.max, `${money(salary)} a month`);
  check("it is paid weekly from the club's budget as \"Manager salary\"",
    week != null && week.description === "Manager salary" && week.type === "expense" && Number(week.amount) === Math.round(salary / WEEKS_PER_MONTH),
    week ? `${money(week.amount)} on ${week.date}` : "no line");
  const sponsor = read(fresh, `SELECT * FROM finance_transactions WHERE team_id = ? AND category = 'sponsorship' AND date = ?`, team.id, week?.date ?? "")[0];
  const rep = read(fresh, `SELECT sponsor_reputation AS r FROM teams WHERE id = ?`, team.id)[0].r;
  check("the sponsor line is reputation x $200 + the flat weekly sum",
    sponsor != null && Number(sponsor.amount) === Math.round(rep * PER_REP) + MONEY.sponsorWeeklyBonus,
    sponsor ? `${money(sponsor.amount)} at reputation ${rep} (${money(rep * PER_REP)} + ${money(MONEY.sponsorWeeklyBonus)})` : "no line");
  const sum = (await api("GET", "/careers/summary")).data;
  check("the Manager Profile shows that salary", sum?.managerSalary === salary, `${money(sum?.managerSalary ?? 0)}`);
  const fin = (await api("GET", "/finances/summary")).data;
  check("the Finances page names it: this season's line and the forecast",
    fin?.expenseBreakdown?.managerSalary === Number(week?.amount ?? -1) && fin?.forecast?.expenses?.managerSalary === Math.round(salary / WEEKS_PER_MONTH) * 4,
    `season ${money(fin?.expenseBreakdown?.managerSalary ?? 0)}, next 4 weeks ${money(fin?.forecast?.expenses?.managerSalary ?? 0)}`);
  await stop();

  // ── 2. An older save, raised once at boot ─────────────────────────────────
  console.log("\n2. ROB'S 1 OCT SAVE (A COPY), AT BOOT");
  if (!fs.existsSync(ROB)) {
    check("Rob's 1 Oct backup is on this machine", false, ROB);
  } else {
    const copy = path.join(WORK, "rob.sqlite");
    fs.copyFileSync(ROB, copy);
    const saves = read(copy, `SELECT id, team_id AS teamId FROM career_saves WHERE team_id IS NOT NULL`);
    const before = new Map(saves.map((s) => [s.id, playerRows(copy, s.id)]));
    const contractsBefore = new Map(read(copy, `SELECT id, player_id AS p, team_id AS t, salary FROM contracts WHERE status = 'active'`).map((c) => [c.id, c]));
    const poolBefore = saves.reduce((n, s) => n + poolRows(copy, s.id).length, 0);
    console.log(`  ${saves.length} career(s); head coaches over the cap before: ${coachOverCap(copy)}`);

    await boot(copy, "rob-1");
    await stop();
    const stamped = read(copy, `SELECT id, money_pass_at AS m FROM career_saves WHERE team_id IS NOT NULL`);
    check("every career is stamped with the game date the pass ran on", stamped.every((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.m ?? "")),
      stamped.map((s) => `${s.id}: ${s.m}`).join(", "));

    let signedOk = 0, signedBad = 0, freeOk = 0, freeBad = 0, youthBad = 0;
    for (const s of saves) {
      const after = new Map(playerRows(copy, s.id).map((p) => [p.id, p]));
      for (const p of before.get(s.id)) {
        if (p.pool != null) continue;
        const a = after.get(p.id);
        if (p.type === "youth" && !p.promoted) { if (Math.abs(Number(a.salary) - academyWage(p.potential)) >= 0.01) youthBad++; continue; }
        if (!senior(p)) continue;                                // a parked spare: neither
        const want = p.teamId != null ? Number(p.salary) + playerWageRise(ovr(p)) : askingWage(p.ask) + playerWageRise(ovr(p));
        const ok = Number(a.salary) === want;
        if (p.teamId != null) ok ? signedOk++ : signedBad++; else ok ? freeOk++ : freeBad++;
      }
    }
    check("every signed senior's wage rose by exactly her rise", signedOk > 0 && signedBad === 0, `${signedOk} raised${signedBad ? `, ${signedBad} wrong` : ""}`);
    const contractsAfter = read(copy, `SELECT id, player_id AS p, salary FROM contracts WHERE status = 'active'`);
    const robState = new Map(saves.flatMap((s) => before.get(s.id)).map((p) => [p.id, p]));
    const cBad = contractsAfter.filter((c) => {
      const b = contractsBefore.get(c.id), p = robState.get(c.p);
      return b && p && senior(p) && Number(c.salary) !== Number(b.salary) + playerWageRise(ovr(p));
    });
    check("...and her contract by the same sum", contractsAfter.length > 0 && cBad.length === 0, `${contractsAfter.length} active contract(s)${cBad.length ? `, ${cBad.length} wrong` : ""}`);
    check("every senior free agent now asks the market wage (none left on $0)", freeOk > 0 && freeBad === 0, `${freeOk} free agents${freeBad ? `, ${freeBad} wrong` : ""}`);
    check("youth not raised: each on the academy's wage for her talent (N-33)", youthBad === 0, `${youthBad} not`);
    const poolAfter = saves.flatMap((s) => poolRows(copy, s.id));
    check("every AI contract is on the new AI wage", poolAfter.length === poolBefore && poolAfter.every((c) => Number(c.salary) === aiWage(ovr(c))), `${poolAfter.length} contracts`);
    check("no head coach above the cap", coachOverCap(copy) === 0);

    const snapshot = () => JSON.stringify([
      read(copy, `SELECT career_save_id, player_id, salary FROM career_player_state ORDER BY 1, 2`),
      read(copy, `SELECT id, salary FROM contracts ORDER BY id`),
      read(copy, `SELECT id, salary FROM pool_player_contracts ORDER BY id`),
      read(copy, `SELECT id, money_pass_at FROM career_saves ORDER BY id`),
    ]);
    const once = snapshot();
    await boot(copy, "rob-2");
    const robSave = saves[0];
    const profiles = (await api("GET", "/profiles")).data?.profiles ?? [];
    await api("POST", `/profiles/${profiles[0].id}/select`);
    await api("POST", `/careers/${robSave.id}/load`);
    const robSum = (await api("GET", "/careers/summary")).data;
    await stop();
    check("a second boot changes nothing", snapshot() === once);
    check("Rob's manager is paid a salary in range", robSum?.managerSalary === managerSalaryFor(`career:${robSave.id}`)
      && robSum.managerSalary >= MONEY.managerSalaryMonthly.min && robSum.managerSalary <= MONEY.managerSalaryMonthly.max,
      `career ${robSave.id}: ${money(robSum?.managerSalary ?? 0)} a month; earned so far ${money(robSum?.careerEarnings ?? 0)}`);
  }
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  await stop();
}
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else fs.rmSync(WORK, { recursive: true, force: true });
process.exit(failures > 0 ? 1 : 0);
