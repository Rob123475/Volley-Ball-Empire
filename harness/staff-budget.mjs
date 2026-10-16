/**
 * 1.1.1, Part 11 (Rob, SB-1 to SB-5): the staff budget (api-server
 * utils/staffBudget.ts; STAFF_BUDGET in lib/db schema/staff-budget.ts).
 *
 *   1. SB-3: the first season's budget, measured on the shipped staff: a good
 *      Head Coach, a good medic and two average staff fit; the two highest-paid
 *      together don't
 *   2. SB-2: on Day 1, beside the draft, three main sponsor offers: a staff
 *      budget and a different bonus each (name and type: sponsors have no logos)
 *   3. choosing one sets the budget; a second choice is refused
 *   4. SB-1: a hire that goes over is refused in plain words with the amount to
 *      free up; staff and medical share the budget
 *   5. SB-4: staff already hired keep their jobs; over the budget, no renewing
 *      until back under
 *   6. the bonus is paid (a win), on its ledger line, and counted as paid
 *   7. AI clubs choose too, and their Jan 8 hiring stays under their budget
 *   8. the offers grow with success and money (the level, by the constants)
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { createWorld, REPO } from "./night2-world.mjs";

const W = createWorld("staff-budget", 4978);
const { check, info } = W;
const { STAFF_BUDGET, nextStaffBudgetLevel, mainSponsorTerms } = await import(pathToFileURL(path.join(REPO, "lib", "db", "src", "schema", "staff-budget.ts")).href);
console.log("=".repeat(72));
console.log("  1.1.1 PART 11: THE STAFF BUDGET");
console.log("=".repeat(72));
const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;

try {
  // ── 1. The first season's budget, on the real wages ────────────────────────
  console.log("\n1. SB-3: THE FIRST SEASON'S BUDGET, MEASURED");
  const shipped = new DatabaseSync(path.join(REPO, "lib", "db", "volleyball-empire.sqlite"), { readOnly: true });
  const staff = shipped.prepare(`SELECT role, base_salary s, skill_level k FROM staff`).all();
  shipped.close();
  const median = (l) => { const s = [...l].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
  const of = (role) => staff.filter((r) => r.role === role);
  const goodCoach = of("Head Coach").filter((r) => r.k >= 79).sort((a, b) => a.s - b.s)[0];
  const goodMedic = of("Physiotherapist").filter((r) => r.k >= 81).sort((a, b) => a.s - b.s)[0];
  const avg = median(of("Fitness Trainer").map((r) => r.s)) + median(of("Massage Therapist").map((r) => r.s));
  const top2 = staff.map((r) => r.s).sort((a, b) => b - a).slice(0, 2).reduce((a, b) => a + b, 0);
  const set = goodCoach.s + goodMedic.s + avg;
  check(`a good Head Coach (skill ${goodCoach.k}, ${money(goodCoach.s)}) + a good Physio (skill ${goodMedic.k}, ${money(goodMedic.s)}) + two average staff (${money(avg)}) fit the first season's ${money(STAFF_BUDGET.firstSeason)}`,
    set <= STAFF_BUDGET.firstSeason, money(set));
  check(`the two highest-paid staff together (${money(top2)}) don't`, top2 > STAFF_BUDGET.firstSeason,
    `${(STAFF_BUDGET.firstSeason / top2 * 100).toFixed(2)}% of ${money(top2)}`);
  info(`first season ${money(STAFF_BUDGET.firstSeason)} = ${(STAFF_BUDGET.firstSeason / top2 * 100).toFixed(2)}% of the two highest wages combined`);

  // ── 2. Day 1 ──────────────────────────────────────────────────────────────
  console.log("\n2. SB-2: DAY 1, THREE MAIN SPONSOR OFFERS");
  await W.boot({ VBE_STAFF_BUDGET: "on" });   // run-all turns the budget's refusals off for the other suites
  const { teamId, cid } = await W.newCareer("Staff Budget");
  let ms = (await W.api("GET", "/finances/main-sponsor")).data;
  check("three offers, each a staff budget and a different bonus (a win, prize money, the World Finals)",
    ms?.offers?.length === 3 && new Set(ms.offers.map((o) => o.bonus.replace(/[$\d,%.]/g, ""))).size === 3 && ms.offers.every((o) => o.staffBudget > 0 && o.sponsor && o.type),
    JSON.stringify(ms?.offers?.map((o) => [o.sponsor, o.type, o.staffBudget, o.bonus])));
  check(`the first season's budgets: ${mainSponsorTerms(STAFF_BUDGET.firstSeason).map((t) => money(t.staffBudget)).join(", ")}`,
    JSON.stringify(ms.offers.map((o) => o.staffBudget).sort((a, b) => b - a)) === JSON.stringify(mainSponsorTerms(STAFF_BUDGET.firstSeason).map((t) => t.staffBudget).sort((a, b) => b - a)));
  check("before choosing, the budget is the first season's level", ms.budget === STAFF_BUDGET.firstSeason && ms.sponsor === null, `${ms.budget}`);
  const page = fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", "pages", "day1-draft.tsx"), "utf8");
  check("(source) the Day 1 draft page shows the choice beside the draft", /<MainSponsorCard \/>/.test(page));

  // ── 3. Choosing ───────────────────────────────────────────────────────────
  console.log("\n3. CHOOSING SETS THE BUDGET");
  const perWin = ms.offers.find((o) => /a win/.test(o.bonus));
  const chose = await W.api("POST", `/finances/main-sponsor/${perWin.id}/choose`);
  ms = (await W.api("GET", "/finances/main-sponsor")).data;
  check("chosen: the budget is its staff budget, and its name, type and bonus show", chose.status === 200 && ms.budget === perWin.staffBudget && ms.sponsor?.name === perWin.sponsor
    && ms.sponsor.bonus === perWin.bonus && ms.offers.length === 0, JSON.stringify(ms.sponsor));
  const again = await W.api("POST", `/finances/main-sponsor/${perWin.id}/choose`);
  check("a second choice is refused", again.status === 409, again.data?.error);
  await W.day();

  // ── 4. The cap ────────────────────────────────────────────────────────────
  console.log("\n4. SB-1: A HIRE OVER THE BUDGET IS REFUSED");
  const market = (role) => W.q(`SELECT st.id, st.name, s.salary FROM career_staff_state s JOIN staff st ON st.id = s.staff_id
    WHERE s.career_save_id = ? AND s.team_id IS NULL AND s.pool_team_id IS NULL AND st.role = ? ORDER BY s.salary DESC`, cid, role);
  const wagesNow = () => W.q(`SELECT COALESCE(SUM(salary), 0) n FROM career_staff_state WHERE career_save_id = ? AND team_id = ?`, cid, teamId)[0].n;
  const hc = market("Head Coach")[0];
  const h1 = await W.api("POST", "/staff", { staffId: hc.id, length: "1s" });
  check(`a Head Coach at ${money(hc.salary)} fits`, h1.status === 201, `HTTP ${h1.status} ${h1.data?.error ?? ""}`);
  const hc2 = market("Head Coach")[0];
  const before = wagesNow();
  const h2 = await W.api("POST", "/staff", { staffId: hc2.id, length: "1s" });
  const need = before + hc2.salary - perWin.staffBudget;
  check(`a second at ${money(hc2.salary)} goes over: refused, naming the ${money(need)} to free up`,
    h2.status === 422 && h2.data?.staffBudget === true && h2.data.error.includes(money(need)) && h2.data.error.includes(money(perWin.staffBudget)), h2.data?.error);
  const room = perWin.staffBudget - wagesNow();
  const medic = W.q(`SELECT st.id, st.name, s.salary FROM career_staff_state s JOIN staff st ON st.id = s.staff_id
    WHERE s.career_save_id = ? AND s.team_id IS NULL AND s.pool_team_id IS NULL AND st.role IN ('Doctor', 'Physiotherapist') AND s.salary <= ? ORDER BY s.salary DESC`, cid, room)[0];
  const m1 = await W.api("POST", "/medical-staff", { staffId: medic.id, length: "1s" });
  const bigMedic = W.q(`SELECT st.id, s.salary FROM career_staff_state s JOIN staff st ON st.id = s.staff_id
    WHERE s.career_save_id = ? AND s.team_id IS NULL AND s.pool_team_id IS NULL AND st.role IN ('Doctor', 'Physiotherapist', 'Medical Specialist') ORDER BY s.salary DESC`, cid)[0];
  const m2 = await W.api("POST", "/medical-staff", { staffId: bigMedic.id, length: "1s" });
  check("medical hires share it: one that fits goes, one that doesn't is refused", m1.status === 201 && m2.status === 422 && m2.data?.staffBudget === true, `${m1.status} / ${m2.status} ${m2.data?.error ?? ""}`);
  const view = (await W.api("GET", "/finances/main-sponsor")).data;
  check("Finances: staff wages of the budget, and the room left", view.wages === wagesNow() && view.room === perWin.staffBudget - wagesNow(), `${view.wages} of ${view.budget}, ${view.room} left`);
  const fe = (f) => fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", ...f.split("/")), "utf8");
  check("(source) the Staff and Medical markets show the room left; Finances shows the card", /<StaffBudgetLine \/>/.test(fe("pages/staff-market.tsx")) && /<StaffBudgetLine \/>/.test(fe("pages/medical-market.tsx")) && /<MainSponsorCard \/>/.test(fe("pages/finances.tsx")));

  // ── 5. Over the budget ────────────────────────────────────────────────────
  console.log("\n5. SB-4: STAFF KEEP THEIR JOBS; OVER, NO RENEWING");
  W.w(`UPDATE career_staff_state SET salary = salary + 30000 WHERE career_save_id = ? AND staff_id = ?`, cid, hc.id);
  const staffAfter = (await W.api("GET", "/staff")).data;
  const renew = await W.api("POST", `/staff/${hc.id}/renew`, { length: "1s" });
  check("a club over its budget keeps its staff, and a renewal is refused until it is back under", staffAfter.some((s) => s.id === hc.id) && renew.status === 422 && /until|Free up/.test(renew.data?.error ?? ""), renew.data?.error);
  W.w(`UPDATE career_staff_state SET salary = salary - 30000 WHERE career_save_id = ? AND staff_id = ?`, cid, hc.id);

  // ── 6. The bonus ──────────────────────────────────────────────────────────
  console.log("\n6. THE BONUS IS PAID");
  let won = 0;
  for (let i = 0; i < 60 && won === 0; i++) {
    await W.day();
    won = W.q(`SELECT COUNT(*) n FROM finance_transactions WHERE team_id = ? AND description LIKE 'Main sponsor bonus%'`, teamId)[0].n;
  }
  const paid = W.q(`SELECT COALESCE(SUM(amount), 0) n FROM finance_transactions WHERE team_id = ? AND description LIKE 'Main sponsor bonus%'`, teamId)[0].n;
  const shown = (await W.api("GET", "/finances/main-sponsor")).data.sponsor.paid;
  check("a win pays the bonus on its own ledger line, and Finances shows what it has paid", won > 0 && paid > 0 && paid % perWin.staffBudget !== -1 && shown === paid, `${won} bonus line(s), ${money(paid)}; shown ${money(shown)}`);

  // ── 7. AI clubs ───────────────────────────────────────────────────────────
  console.log("\n7. AI CLUBS CHOOSE TOO, AND HIRE WITHIN THEIR BUDGET");
  const ai = W.q(`SELECT pool_team_id id, main_sponsor m, staff_budget b, sponsor_bonus_type t FROM career_pool_team_state WHERE career_save_id = ? AND taken_over_at IS NULL`, cid);
  check("every AI club has a main sponsor, a staff budget and a bonus", ai.length > 0 && ai.every((c) => c.m && c.b > 0 && c.t), `${ai.filter((c) => c.m).length} of ${ai.length}`);
  while ((await W.api("GET", "/calendar")).data.currentDate < "2026-01-09") await W.day();
  const aiWages = W.q(`SELECT s.pool_team_id id, SUM(s.salary) w FROM career_staff_state s WHERE s.career_save_id = ? AND s.pool_team_id IS NOT NULL GROUP BY s.pool_team_id`, cid);
  const over = aiWages.filter((r) => r.w > (ai.find((c) => c.id === r.id)?.b ?? Infinity));
  check("after Jan 8, no AI club's staff wages are over its staff budget", aiWages.length > 0 && over.length === 0, `${aiWages.length} clubs hired; over: ${over.length}`);

  // ── 8. Growth ─────────────────────────────────────────────────────────────
  console.log("\n8. THE OFFERS GROW WITH SUCCESS AND MONEY");
  let level = STAFF_BUDGET.firstSeason; const path3 = [level];
  for (let s = 0; s < 3; s++) { level = nextStaffBudgetLevel(level, 4, 3_000_000); path3.push(level); }
  const poor = nextStaffBudgetLevel(STAFF_BUDGET.firstSeason, null, 0);
  const topStaff = median(of("Head Coach").filter((r) => r.k >= 85).map((r) => r.s));
  check("three top-4 seasons with $3M in the bank: the level climbs, and it never drops below the first season's",
    path3[1] > path3[0] && path3[2] > path3[1] && path3[3] <= STAFF_BUDGET.max && poor === STAFF_BUDGET.firstSeason, path3.map(money).join(" -> "));
  info(`with top staff at about ${money(topStaff)} a month: ${path3.map((l) => `${money(l)} buys ${Math.floor(l / topStaff)}`).join(", ")}`);
} catch (err) {
  W.fail(err);
} finally {
  await W.stop();
}
W.finish();
