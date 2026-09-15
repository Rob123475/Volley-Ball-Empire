/**
 * R-67 — a wizard-created career starts on the design's numbers, and staff are
 * paid monthly salaries dripped weekly.
 *
 * Rob's play-through of the 0.9.0 installer: a new career created through the
 * wizard showed $5,000 and a Head Coach costing $33,462 a week against $20K of
 * monthly income. What happened, from his save: the underdog career started on
 * $150,000 as designed; hiring Sofia Andersen (Head Coach) then took $145,000 —
 * her base_salary, an ANNUAL figure like all 118 staff the content scripts
 * seeded, charged as "one month". Every reader treats staff salary as monthly.
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 *   data     every staff salary in the starter DB is a monthly figure; the seed
 *            scripts divide their annual figures by 12 where they insert
 *   wizard   a career created with exactly the wizard's payload starts on the
 *            difficulty's budget (underdog $150,000, established $500,000 —
 *            utils/careerDifficulty.ts, R-11)
 *   hire     hiring the Head Coach costs one month's salary ($12,083)
 *   weekly   the first salary week bills her once, at salary / (52/12) — the
 *            design's rule for wages (docs/economy-design.md §3) — and the
 *            Finances wage bill shows the same numbers
 *   repair   a save made before the fix (annual base_salary, annual live wages)
 *            is brought to monthly figures on boot
 *
 * Usage: node harness/wizard-career-economy.mjs
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
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-wizard-economy-"));
const PORT = 4850;
const BASE = `http://localhost:${PORT}/api`;
const WEEKS_PER_MONTH = 52 / 12;
const SEED_BATCHES = [1787112097, 1787112098, 1787113528, 1787114270, 1787114271];
const DESIGN_BUDGET = { underdog: 150000, established: 500000 };
const HEAD_COACH = "Sofia Andersen";
const HEAD_COACH_ANNUAL = 145000;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log("  R-67 WIZARD CAREER ECONOMY AND STAFF WAGES");
console.log("=".repeat(72));

// ── 0. Data ─────────────────────────────────────────────────────────────────
console.log("\n0. THE STAFF DATA");
{
  const d = new DatabaseSync(SHIPPED, { readOnly: true });
  const all = d.prepare("SELECT name, role, base_salary FROM staff").all();
  const seeded = d.prepare(`SELECT base_salary FROM staff WHERE created_at IN (${SEED_BATCHES.join(",")})`).all();
  const coach = d.prepare("SELECT base_salary FROM staff WHERE name = ?").get(HEAD_COACH);
  d.close();
  const max = Math.max(...all.map((r) => r.base_salary));
  check("every staff salary in the starter DB is a monthly figure (none above $25,000)",
    all.length === 120 && max <= 25000 && all.every((r) => r.base_salary > 0),
    `${all.length} staff, $${Math.min(...all.map((r) => r.base_salary)).toLocaleString()}-$${max.toLocaleString()}; seeded ${seeded.length}`);
  check(`${HEAD_COACH}'s salary is her annual $${HEAD_COACH_ANNUAL.toLocaleString()} over 12`,
    coach?.base_salary === Math.round(HEAD_COACH_ANNUAL / 12), `$${coach?.base_salary}/month`);
  const seedSrc = (f) => fs.readFileSync(path.join(REPO, "scripts", "src", f), "utf8");
  const medical = ["seed-doctors.ts", "seed-physiotherapists.ts", "seed-nutritionists.ts", "seed-medical-specialists.ts", "seed-sports-scientists.ts"];
  check("the seed scripts write monthly figures (annual / 12 where they insert)",
    /Math\.round\(member\.salary \/ 12\)/.test(seedSrc("seed-staff.ts"))
      && medical.every((f) => /Math\.round\(\(Math\.round\(\(100000 \+ t \* 100000\) \/ 1000\) \* 1000\) \/ 12\)/.test(seedSrc(f))));
}

if (!fs.existsSync(SERVER)) { console.error(`[wizard-economy] FAILED: ${SERVER} not built.`); process.exit(1); }

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

async function boot(dbFile, label, extraEnv = {}) {
  const logFile = path.join(WORK, `${label}.log`);
  const out = fs.openSync(logFile, "w");
  const child = forkServer({
    server: SERVER, electron: ELECTRON, out,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "wizard-economy", ...extraEnv },
  });
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return { child, out, logFile, async stop() { await stopServer(child); try { fs.closeSync(out); } catch { /* closed */ } } };
}

/** A career created with exactly the fields the wizard (career-management.tsx) sends. */
async function wizardCareer(api, name, difficulty) {
  const prof = await api("POST", "/profiles", { name });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const clubs = (await api("GET", "/club-templates")).data;
  const club = (Array.isArray(clubs) ? clubs : clubs?.clubs ?? [])[0];
  const body = {
    slotNumber: 1,
    managerName: name,
    managerNationality: "Australia",
    clubName: club.name,
    originalClubName: club.name,
    budget: club.startingBudget,
    difficulty,
    primaryColor: "#1e3a8a",
    secondaryColor: "#f59e0b",
    crestShapeIndex: 0,
  };
  const c = await api("POST", "/careers", body);
  return { club, created: c };
}

const dbFile = path.join(WORK, "wizard.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
let srv = await boot(dbFile, "wizard");

try {
  // ── 1. The wizard's starting budget ───────────────────────────────────────
  console.log("\n1. A WIZARD CAREER STARTS ON THE DESIGN'S BUDGET");
  const results = {};
  for (const difficulty of ["underdog", "established"]) {
    const api = session();
    const { club, created } = await wizardCareer(api, `Wizard ${difficulty}`, difficulty);
    const team = (await api("GET", "/team")).data;
    results[difficulty] = { api, team, club };
    check(`${difficulty}: a career from the wizard's payload starts on $${DESIGN_BUDGET[difficulty].toLocaleString()}`,
      created.status < 300 && Number(team?.budget) === DESIGN_BUDGET[difficulty],
      `HTTP ${created.status}; club "${club?.name}" template budget ${club?.startingBudget}; team budget ${team?.budget}`);
  }

  // ── 2. Hiring the Head Coach ──────────────────────────────────────────────
  console.log("\n2. HIRING THE HEAD COACH");
  const { api, team } = results.underdog;
  const market = (await api("GET", `/staff/market?search=${encodeURIComponent(HEAD_COACH)}`)).data ?? [];
  const coach = market.find((s) => s.name === HEAD_COACH);
  const monthly = Math.round(HEAD_COACH_ANNUAL / 12);
  check(`${HEAD_COACH} is on the market at $${monthly.toLocaleString()} a month`, coach?.salary === monthly, `salary ${coach?.salary}`);
  const hire = await api("POST", "/staff", { staffId: coach?.id });
  const afterHire = Number((await api("GET", "/team")).data?.budget);
  check("hiring her costs one month's salary, not a year's",
    hire.status === 201 && afterHire === DESIGN_BUDGET.underdog - monthly,
    `HTTP ${hire.status}; budget $${DESIGN_BUDGET.underdog.toLocaleString()} -> $${afterHire.toLocaleString()}`);

  // ── 3. The first salary week ──────────────────────────────────────────────
  console.log("\n3. THE WEEKLY STAFF BILL");
  const read = (q, ...a) => { const d = new DatabaseSync(dbFile, { readOnly: true }); const r = d.prepare(q).all(...a); d.close(); return r; };
  let staffRows = [];
  for (let i = 0; i < 30 && staffRows.length === 0; i++) {
    const r = await api("POST", "/calendar/advance", {});
    if (r.data?.blocked === "pending_match") {
      let sim = await api("POST", `/matches/${r.data.pendingMatchId}/simulate`, {});
      if (sim.status >= 400) await api("POST", `/matches/${r.data.pendingMatchId}/forfeit`, {});
      continue;
    }
    staffRows = read("SELECT amount, description, date FROM finance_transactions WHERE team_id = ? AND category = 'staff_salary' AND description LIKE 'Weekly staff wages%'", team.id);
  }
  const designWeekly = Math.round(monthly / WEEKS_PER_MONTH);
  check(`the first salary week bills her once, at $${monthly.toLocaleString()} / (52/12) = $${designWeekly.toLocaleString()}`,
    staffRows.length === 1 && Number(staffRows[0].amount) === designWeekly,
    staffRows.map((r) => `${r.date} ${r.description} $${r.amount}`).join(" | ") || "no weekly staff wage row");
  const hireRow = read("SELECT amount, description FROM finance_transactions WHERE team_id = ? AND category = 'staff_salary' AND description LIKE 'Signed%'", team.id)[0];
  check("the hire is recorded as a one-month signing fee", !!hireRow && Number(hireRow.amount) === monthly && /signing fee, one month's salary/.test(hireRow.description),
    hireRow ? `"${hireRow.description}" $${hireRow.amount}` : "no hire row");
  const bill = (await api("GET", "/finances/staff-wage-bill")).data;
  check("the Finances staff wage bill shows the same monthly and weekly figures",
    bill?.monthlyWages === monthly && bill?.weeklyWages === designWeekly,
    `monthly $${bill?.monthlyWages}, weekly $${bill?.weeklyWages}`);
  console.log(`  REPORT  underdog wizard career: start $150,000; after hiring ${HEAD_COACH} $${afterHire.toLocaleString()} (was $5,000 in Rob's save); her wage $${monthly.toLocaleString()}/month = $${designWeekly.toLocaleString()}/week (was shown as $145,000/month = $33,462/week)`);

  // ── 4. An older save is repaired on boot ──────────────────────────────────
  console.log("\n4. A SAVE MADE BEFORE THE FIX IS REPAIRED ON BOOT");
  await srv.stop();
  const cid = read("SELECT id FROM career_saves ORDER BY id LIMIT 1")[0].id;
  {
    const w = new DatabaseSync(dbFile);
    w.exec(`UPDATE staff SET base_salary = base_salary * 12 WHERE created_at IN (${SEED_BATCHES.join(",")})`);
    w.exec(`UPDATE career_staff_state SET salary = salary * 12 WHERE staff_id IN (SELECT id FROM staff WHERE created_at IN (${SEED_BATCHES.join(",")}))`);
    w.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    w.close();
  }
  const poisoned = read(`SELECT COUNT(*) AS n FROM career_staff_state s JOIN staff st ON st.id = s.staff_id WHERE st.created_at IN (${SEED_BATCHES.join(",")}) AND s.salary >= 30000`)[0].n;
  srv = await boot(dbFile, "repair", { STARTER_DB_PATH: SHIPPED });
  await srv.stop();
  // A development-mode server logs pretty-printed, coloured, one field per line:
  // strip the colour codes and read the count on the line after the message.
  const log = fs.readFileSync(srv.logFile, "utf8").replace(/\x1b\[[0-9;]*m/g, "");
  const repairedLine = /staff salaries repaired to monthly figures\s*\n\s*repaired: (\d+)/.exec(log)
    ?? /"repaired":(\d+).*staff salaries repaired to monthly figures/.exec(log);
  const coachAfter = read("SELECT st.base_salary AS base, s.salary AS live FROM staff st JOIN career_staff_state s ON s.staff_id = st.id WHERE st.name = ? AND s.career_save_id = ?", HEAD_COACH, cid)[0];
  const stillAnnual = read("SELECT COUNT(*) AS n FROM career_staff_state WHERE salary >= 30000")[0].n;
  check("the reference data brings base_salary back to monthly and each career's live wages follow",
    poisoned > 0 && !!repairedLine && Number(repairedLine[1]) === poisoned && coachAfter?.base === monthly && coachAfter?.live === monthly && stillAnnual === 0,
    `${poisoned} annual live wages planted; log repaired ${repairedLine?.[1] ?? "none"}; ${HEAD_COACH} base $${coachAfter?.base}, live $${coachAfter?.live}; ${stillAnnual} still annual`);
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  try { await srv.stop(); } catch { /* already stopped */ }
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
