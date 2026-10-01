/**
 * Unity match brief (29 Sep), item 13 — every number on the Finances page comes
 * from the ledger, the contracts, or one labelled forecast.
 *
 * Rob, 29 Sep: the ledger (finance_transactions) reconciled to the balance to
 * the dollar, and the page around it did not: Monthly Expenses $69K against
 * $20,862 a week of charges; Player Wages $10,500/week for contracts worth
 * $5,677; breakdown percentages of 586% and 3145%; prize money from advertised
 * purses, not money paid; every transaction dated the PC's day; every sponsor
 * offer "Expires 0d".
 *
 * Runs the real server on a COPY of Rob's own save
 * (Downloads/volleyball-empire-backup-29sep-1136.sqlite; lib/db's starter save
 * when that file is not on this machine), reads every figure the finances API
 * returns, and compares each with a sum taken directly from the copy's tables.
 *
 * Usage: node harness/finances-ledger.mjs [path/to/save.sqlite]
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
// Overnight 1 Oct, N-41: the wage rise, from the one config file (Node strips the types).
import { playerWageRise } from "../lib/db/src/schema/money.ts";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const ROB = process.argv[2] ?? path.join(os.homedir(), "Downloads", "volleyball-empire-backup-29sep-1136.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-finances-ledger-"));
const PORT = 4921;
const BASE = `http://localhost:${PORT}/api`;
const WEEKS_PER_MONTH = 52 / 12;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
const $ = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
console.log("=".repeat(72));
console.log("  UNITY 13: THE FINANCES PAGE READS THE LEDGER AND THE CONTRACTS");
console.log("=".repeat(72));
if (!fs.existsSync(SERVER)) { console.error(`[finances-ledger] FAILED: ${SERVER} not built.`); process.exit(1); }

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

// The copy. Rob's file itself is only ever read (copied), never opened.
const usingRob = fs.existsSync(ROB);
const dbFile = path.join(WORK, "save.sqlite");
fs.copyFileSync(usingRob ? ROB : SHIPPED, dbFile);
console.log(`  save: ${usingRob ? "a copy of " + ROB : "the starter save (Rob's backup is not on this machine)"}`);

const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development",
    SESSION_SECRET: "finances-ledger", STARTER_DB_PATH: SHIPPED },
});

try {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }

  let careerSaveId, teamId;
  if (usingRob) {
    const profiles = (await api("GET", "/profiles")).data?.profiles ?? [];
    await api("POST", `/profiles/${profiles[0].id}/select`);
    const save = ((await api("GET", "/careers")).data?.saves ?? []).find((s) => s.teamId != null) ?? ((await api("GET", "/careers")).data?.saves ?? [])[0];
    careerSaveId = save.id;
    await api("POST", `/careers/${careerSaveId}/load`);
  } else {
    const prof = await api("POST", "/profiles", { name: "Ledger Test" });
    await api("POST", `/profiles/${prof.data.id}/select`);
    const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
    await api("POST", "/careers", {
      slotNumber: 1, managerName: "Ledger Test", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
      budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0,
    });
    careerSaveId = ((await api("GET", "/careers")).data?.saves ?? [])[0]?.id;
    for (let i = 0; i < 3; i++) { await api("POST", "/calendar/next-match"); await api("POST", "/calendar/skip-match"); }
  }
  teamId = (await api("GET", "/team")).data?.id;

  // Read everything the page reads, then read the copy directly.
  const summary = (await api("GET", "/finances/summary")).data;
  const wages   = (await api("GET", "/finances/wage-bill")).data;
  const staffW  = (await api("GET", "/finances/staff-wage-bill")).data;
  const prize   = (await api("GET", "/finances/prize-money")).data;
  const offers  = (await api("GET", "/finances/sponsor-offers")).data ?? [];
  const history = (await api("GET", "/finances/history?limit=200")).data;

  const db = new DatabaseSync(dbFile, { readOnly: true });
  // SELECT * so "current_date" is the column, not SQL's CURRENT_DATE (the PC's).
  const gd = db.prepare("SELECT * FROM calendar_state WHERE team_id = ?").get(teamId).current_date;
  const season = db.prepare("SELECT start_date FROM seasons WHERE career_save_id = ? AND status = 'active' ORDER BY year DESC LIMIT 1").get(careerSaveId);
  const seasonFrom = season?.start_date ?? `${gd.slice(0, 4)}-01-01`;
  const d = new Date(`${gd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 27);
  const fourWeeksFrom = d.toISOString().slice(0, 10);
  const sum = (sql, ...args) => Number(db.prepare(sql).get(...args)?.s ?? 0);
  const L = "SELECT COALESCE(SUM(ABS(amount)), 0) AS s FROM finance_transactions WHERE team_id = ?";
  const budget = Number(db.prepare("SELECT budget FROM teams WHERE id = ?").get(teamId).budget);
  console.log(`  career ${careerSaveId}, team ${teamId}, game date ${gd}, season from ${seasonFrom}, balance ${$(budget)}\n`);

  // 1. The ledger reconciles, and the page's totals are the ledger's.
  const allIn  = sum(`${L} AND type = 'income'`, teamId);
  const allOut = sum(`${L} AND type = 'expense'`, teamId);
  check("balance on the page = the club's budget", summary.totalBalance === budget, `${$(summary.totalBalance)} vs ${$(budget)}`);
  check("all-time income and expenses = the ledger's sums", summary.totalIncome === allIn && summary.totalExpenses === allOut,
    `income ${$(summary.totalIncome)} vs ${$(allIn)}, expenses ${$(summary.totalExpenses)} vs ${$(allOut)}`);
  if (usingRob) check("the ledger reconciles to the balance (start $500,000)", Math.round(500000 - allOut + allIn) === Math.round(budget),
    `$500,000 - ${$(allOut)} + ${$(allIn)} = ${$(500000 - allOut + allIn)}`);

  // 2. Top cards: the last 4 weeks of the ledger, and labelled so.
  const in4  = sum(`${L} AND type = 'income'  AND date >= ? AND date <= ?`, teamId, fourWeeksFrom, gd);
  const out4 = sum(`${L} AND type = 'expense' AND date >= ? AND date <= ?`, teamId, fourWeeksFrom, gd);
  check("\"Income, last 4 weeks\" = the ledger's income over the 28 game days to today", summary.monthlyIncome === in4, `${$(summary.monthlyIncome)} vs ${$(in4)} (${fourWeeksFrom} to ${gd})`);
  check("\"Expenses, last 4 weeks\" = the ledger's expenses over the same days", summary.monthlyExpenses === out4, `${$(summary.monthlyExpenses)} vs ${$(out4)}`);

  // 3. Breakdown: this season's ledger, by category; percentages of the season's total.
  const cat = (type, cats) => sum(`${L} AND type = ? AND date >= ? AND date <= ? AND category IN (${cats.map(() => "?").join(",")})`, teamId, type, seasonFrom, gd, ...cats);
  const seasonIn  = sum(`${L} AND type = 'income'  AND date >= ? AND date <= ?`, teamId, seasonFrom, gd);
  const seasonOut = sum(`${L} AND type = 'expense' AND date >= ? AND date <= ?`, teamId, seasonFrom, gd);
  const want = {
    prizeMoney: cat("income", ["prize_money"]), sponsorships: cat("income", ["sponsorship"]), promoDeals: cat("income", ["promo_deal"]),
    playerSalaries: cat("expense", ["player_salary", "salaries"]), staffSalaries: cat("expense", ["staff_salary", "staff"]),
    runningCosts: cat("expense", ["running_costs"]), trainingCosts: cat("expense", ["training_cost"]),
  };
  check("season income and expenses = the ledger's, this season", summary.seasonIncome === seasonIn && summary.seasonExpenses === seasonOut,
    `${$(summary.seasonIncome)} / ${$(summary.seasonExpenses)} vs ${$(seasonIn)} / ${$(seasonOut)}`);
  for (const k of ["prizeMoney", "sponsorships", "promoDeals"]) check(`income line ${k} = the ledger's category sum this season`, summary.incomeSources[k] === want[k], `${$(summary.incomeSources[k])} vs ${$(want[k])}`);
  for (const k of ["playerSalaries", "staffSalaries", "runningCosts", "trainingCosts"]) check(`expense line ${k} = the ledger's category sum this season`, summary.expenseBreakdown[k] === want[k], `${$(summary.expenseBreakdown[k])} vs ${$(want[k])}`);
  const inParts  = Object.values(summary.incomeSources).reduce((a, b) => a + b, 0);
  const outParts = Object.values(summary.expenseBreakdown).reduce((a, b) => a + b, 0);
  check("the income lines add up to the season's income (so no share can pass 100%)", inParts === seasonIn, `${$(inParts)} vs ${$(seasonIn)}`);
  check("the expense lines add up to the season's expenses", outParts === seasonOut, `${$(outParts)} vs ${$(seasonOut)}`);

  // 4. Player Wages: the contracts, and what the weekly run charged.
  const contracts = db.prepare(`SELECT cps.player_id AS id, cps.salary AS salary,
      cps.speed, cps.power, cps.defense, cps.serve, cps.block, cps.stamina FROM career_player_state cps JOIN players p ON p.id = cps.player_id
    WHERE cps.career_save_id = ? AND cps.team_id = ? AND (p.player_type = 'senior' OR (p.player_type = 'youth' AND COALESCE(cps.is_promoted, 0) = 1)) AND COALESCE(cps.is_retired, 0) = 0`).all(careerSaveId, teamId);
  const monthly = contracts.reduce((a, c) => a + Number(c.salary), 0);
  check("Player Wages per month = the signed contracts' monthly salaries", wages.monthlyWages === monthly && wages.playerCount === contracts.length,
    `${$(wages.monthlyWages)} for ${wages.playerCount} vs ${$(monthly)} for ${contracts.length} (${contracts.map((c) => $(c.salary)).join(" + ")})`);
  check("Player Wages per week = the month / (52/12)", wages.weeklyWages === Math.round(monthly / WEEKS_PER_MONTH), `${$(wages.weeklyWages)} vs ${$(monthly / WEEKS_PER_MONTH)}`);
  check("every player's row is her contract", (wages.players ?? []).every((p) => contracts.some((c) => c.id === p.id && Number(c.salary) === p.monthlySalary)));
  const youth = db.prepare(`SELECT COUNT(*) AS n FROM career_player_state cps JOIN players p ON p.id = cps.player_id
    WHERE cps.career_save_id = ? AND cps.team_id = ? AND p.player_type = 'youth' AND COALESCE(cps.is_promoted, 0) = 0 AND COALESCE(cps.is_retired, 0) = 0`).get(careerSaveId, teamId).n;
  const lastCharge = db.prepare("SELECT amount, date FROM finance_transactions WHERE team_id = ? AND category = 'salaries' ORDER BY date DESC, id DESC LIMIT 1").get(teamId);
  // Overnight 1 Oct, N-41: a save older than the money pass had its seniors' wages
  // raised at boot (each by playerWageRise for her rating), after its last salary
  // week; that week charged the wages before the rise.
  const passAt = db.prepare("SELECT money_pass_at AS m FROM career_saves WHERE id = ?").get(careerSaveId)?.m ?? null;
  const raisedSince = lastCharge && /^\d{4}-\d{2}-\d{2}$/.test(passAt ?? "") && lastCharge.date <= passAt;
  const rises = raisedSince ? contracts.reduce((a, c) => a + playerWageRise(Math.round((c.speed + c.power + c.defense + c.serve + c.block + c.stamina) / 6)), 0) : 0;
  if (lastCharge && youth === 0) check("the weekly figure is what the last salary week charged (before any 1 Oct rise since)",
    Math.round((monthly - rises) / WEEKS_PER_MONTH) === Math.abs(Number(lastCharge.amount)),
    `${$((monthly - rises) / WEEKS_PER_MONTH)} vs ${$(lastCharge.amount)} on ${lastCharge.date}${raisedSince ? ` (rises since: ${$(rises)} a month, money pass ${passAt})` : ""}`);
  const staffRows = db.prepare(`SELECT css.salary AS salary FROM career_staff_state css WHERE css.career_save_id = ? AND css.team_id = ?`).all(careerSaveId, teamId);
  const staffMonthly = staffRows.reduce((a, s) => a + Number(s.salary), 0);
  check("Staff wages per month = the staff contracts", Math.round(staffW.monthlyWages) === Math.round(staffMonthly), `${$(staffW.monthlyWages)} vs ${$(staffMonthly)}`);

  // 5. Prize money: paid, from the ledger.
  const prizeRows = db.prepare("SELECT amount, description, date FROM finance_transactions WHERE team_id = ? AND category = 'prize_money' AND type = 'income' AND date >= ?").all(teamId, seasonFrom);
  const prizePaid = prizeRows.reduce((a, r) => a + Math.abs(Number(r.amount)), 0);
  const runnerUp = prizeRows.filter((r) => /^Runner-up prize/i.test(r.description));
  check("Prize Money Tracker total = the prize money the ledger paid this season", prize.total === prizePaid, `${$(prize.total)} vs ${$(prizePaid)} from ${prizeRows.length} payments`);
  check("its lines: winner's and runner-up prizes, counted as payments", (prize.breakdown ?? []).reduce((a, b) => a + b.matches, 0) === prizeRows.length
    && ((prize.breakdown ?? []).find((b) => b.category === "Runner-up prizes")?.amount ?? 0) === runnerUp.reduce((a, r) => a + Math.abs(Number(r.amount)), 0),
    (prize.breakdown ?? []).map((b) => `${b.category} ${$(b.amount)} (${b.matches})`).join(", "));

  // 6. Transaction dates: the game's. The page prints t.date.
  const txs = history?.transactions ?? [];
  const inGameYear = txs.every((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.date) && t.date <= gd);
  check("every transaction carries its game date, none after today's game date", txs.length > 0 && inGameYear, `${txs.length} rows, ${txs.at(-1)?.date} to ${txs[0]?.date}`);
  const page = fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", "pages", "finances.tsx"), "utf8");
  check("the Transaction History table prints the game date (t.date), not when the row was written",
    page.includes("format(new Date(`${t.date}T00:00:00`), \"MMM d, yyyy\")") && !/new Date\(t\.createdAt\)/.test(page));

  // 7. Sponsor offers: days on the game calendar.
  const dayDiff = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
  check("every sponsor offer's days left = its expiry minus the game date", offers.length > 0 && offers.every((o) => o.daysLeft === Math.max(0, dayDiff(gd, o.expiresAt))),
    offers.map((o) => `${o.expiresAt}: ${o.daysLeft}d`).join(", "));
  check("the offer card shows the server's days left (no Date.now on the page)", !/Date\.now\(\)/.test(page) && /const daysLeft = offer\.daysLeft \?\? null;/.test(page));

  // 8. The forecast: one, labelled, and built from the same rates.
  const f = summary.forecast;
  check("one forecast: the next 4 weeks, income and expenses adding up", !!f && f.weeks === 4
    && f.income.total === f.income.sponsorIncome + f.income.contractPayments
    && f.expenses.total === f.expenses.playerWages + f.expenses.staffWages + f.expenses.runningCosts + (f.expenses.managerSalary ?? 0)
    && f.projectedBalance === budget + f.income.total - f.expenses.total,
    f ? `+${$(f.income.total)} -${$(f.expenses.total)} -> ${$(f.projectedBalance)}` : "none");
  check("its wages are four weeks of the contracts", !!f && f.expenses.playerWages >= wages.weeklyWages * 4 && f.expenses.staffWages === staffW.weeklyWages * 4,
    f ? `${$(f.expenses.playerWages)} / ${$(f.expenses.staffWages)}` : "");
  check("the page labels every period", ["Income, last 4 weeks", "Expenses, last 4 weeks", "Net, last 4 weeks", "Income Sources · this season",
    "Expense Breakdown · this season", "Forecast: next {weeks} weeks", "Per month (contracts)", "Prize money paid this season"].every((l) => page.includes(l)));
  check("the invented rating-tier wage table is gone", !/WEEKLY_SALARY|getPlayerTier/.test(fs.readFileSync(path.join(REPO, "artifacts", "api-server", "src", "routes", "finances.ts"), "utf8")));
  db.close();
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  try { await stopServer(child); } catch { /* stopped */ }
  try { fs.closeSync(out); } catch { /* closed */ }
}
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
