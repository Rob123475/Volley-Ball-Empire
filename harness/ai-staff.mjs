/**
 * Update 1, overnight brief part 1a (Rob, 14 Oct): the AI clubs take staff on
 * Day 8 (utils/aiStaff.ts).
 *
 *   1. before Day 8 no AI club has staff; on Day 8 every club that can gets one
 *      coach (Head or Assistant) and one medical member (Doctor, Physio,
 *      Massage Therapist, Medical Specialist), never more than one of each;
 *      the medic is a doctor or physio while one is spare (Rob, 16 Oct)
 *   2. at least 5 of every role stay on the market for the player
 *   3. each AI hire is a normal contract (6m / 1s / 2s, an end date), its
 *      signing fee (one month's salary) came off the club's balance, and the
 *      salary cap's senior wage bill does not count staff
 *   4. an AI club's staff are not on the Staff or Medical Market and cannot be
 *      hired by the player
 *   5. an AI contract that ends puts them back on the market at their wage, and
 *      the gap stays: nobody is hired the next day (Rob, 16 Oct)
 *   6. the player's own staff contract ending keeps the wage (it was set to $0)
 *   7. an older career (no deal dates) is dealt once at boot
 *   8. part 3: their bonuses go through the player's own functions (training
 *      XP, healing, off ill gives nothing)
 *   9. Rob, 16 Oct: AI clubs hire staff on Jan 8 of every season and on no
 *      other day: a gap made mid-season (and every contract that ends during
 *      the season) stays empty until the next Jan 8; on that Jan 8 every AI
 *      club that can pay has a coach and a medic
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healAllSquads, startCareer, keepSideFielded, renewExpiringContracts, keepClubSolvent } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-ai-staff-"));
const DB = path.join(WORK, "save.sqlite");
const PORT = 4987;
const BASE = `http://localhost:${PORT}/api`;
const SRC = (p) => fs.readFileSync(path.join(REPO, "artifacts", "api-server", "src", p), "utf8");

const COACHING = ["Head Coach", "Assistant Coach"];
const MEDICAL = ["Doctor", "Physiotherapist", "Massage Therapist", "Medical Specialist"];
const FLOOR = 5;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
const info = (s) => console.log(`  INFO  ${s}`);
console.log("=".repeat(72));
console.log("  UPDATE 1, OVERNIGHT PART 1a: THE AI CLUBS' STAFF");
console.log("=".repeat(72));

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
const q = (sql, ...a) => { const d = new DatabaseSync(DB, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
const w = (sql, ...a) => { const d = new DatabaseSync(DB); try { return d.prepare(sql).run(...a); } finally { d.close(); } };

let teamId = null, cid = null;
const today = () => q(`SELECT "current_date" AS d FROM calendar_state WHERE team_id = ?`, teamId)[0]?.d;
async function day() {
  healAllSquads(DB);
  const r = await api("POST", "/calendar/advance", {});
  const id = r.data?.blocked === "pending_match" ? r.data.pendingMatchId : r.data?.matchDay?.matchId;
  if (id) { await api("POST", `/matches/${id}/simulate`); await api("POST", r.data?.blocked === "pending_match" ? "/calendar/skip-match" : "/calendar/dismiss-match"); }
  return r;
}
const aiStaff = () => q(`SELECT s.staff_id AS id, s.pool_team_id AS club, st.role, s.salary, s.contract_term AS term, s.contract_end_date AS ends
  FROM career_staff_state s JOIN staff st ON st.id = s.staff_id WHERE s.career_save_id = ? AND s.pool_team_id IS NOT NULL`, cid);
const marketByRole = () => {
  const m = {};
  for (const r of q(`SELECT st.role FROM career_staff_state s JOIN staff st ON st.id = s.staff_id
    WHERE s.career_save_id = ? AND s.team_id IS NULL AND s.pool_team_id IS NULL`, cid)) m[r.role] = (m[r.role] ?? 0) + 1;
  return m;
};
const balances = () => new Map(q(`SELECT pool_team_id AS club, balance FROM career_pool_team_state WHERE career_save_id = ?`, cid).map((r) => [r.club, r.balance]));

async function boot(secret) {
  const out = fs.openSync(path.join(WORK, `server-${secret}.log`), "w");
  const child = forkServer({ server: SERVER, electron: ELECTRON, out,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: DB, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "ai-staff", STARTER_DB_PATH: SHIPPED } });
  for (let i = 0; i < 360; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }
  return child;
}

let child = null;
try {
  fs.copyFileSync(SHIPPED, DB);
  child = await boot("a");

  const prof = await api("POST", "/profiles", { name: "AI Staff" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? [])[0];
  await startCareer(api, { managerFaceId: 8, slotNumber: 1, managerName: "AI Staff", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  teamId = (await api("GET", "/team")).data?.id;
  cid = q(`SELECT id FROM career_saves WHERE team_id = ?`, teamId)[0].id;
  const dealOn = q(`SELECT ai_staff_deal_on AS d, ai_staff_dealt_at AS at FROM career_saves WHERE id = ?`, cid)[0];

  // ── 1. Day 8 ───────────────────────────────────────────────────────────────
  console.log("\n1. BEFORE DAY 8 NO AI CLUB HAS STAFF; ON DAY 8 EACH GETS A COACH AND A MEDICAL MEMBER");
  check("a new career's deal date is Day 8 (7 days after its first day) and it has not been dealt", dealOn.d === "2026-01-08" && dealOn.at == null, `deal on ${dealOn.d}`);
  let guard = 0;
  while ((today() ?? "") < "2026-01-07" && guard++ < 20) await day();
  check("on Day 7 no AI club has staff", aiStaff().length === 0, `${aiStaff().length} at AI clubs on ${today()}`);
  while ((today() ?? "") < "2026-01-08" && guard++ < 30) await day();
  const dealt = aiStaff();
  const clubs = q(`SELECT pool_team_id AS club FROM career_pool_team_state WHERE career_save_id = ? AND taken_over_at IS NULL`, cid).map((r) => r.club);
  const per = new Map(clubs.map((c) => [c, dealt.filter((s) => s.club === c)]));
  const coaching = dealt.filter((s) => COACHING.includes(s.role)), medical = dealt.filter((s) => MEDICAL.includes(s.role));
  check("on Day 8 the AI clubs took staff, only coaches and the four medical roles", dealt.length > 0 && coaching.length + medical.length === dealt.length,
    `${coaching.length} coaches, ${medical.length} medical, on ${today()}`);
  check("no AI club has more than one coach or more than one medical member",
    [...per.values()].every((l) => l.filter((s) => COACHING.includes(s.role)).length <= 1 && l.filter((s) => MEDICAL.includes(s.role)).length <= 1));
  // Night 2: each role's own number in this career (Rob's portraits made 10 into 20-35), not a fixed 10.
  const ofRole = (r) => q(`SELECT COUNT(*) n FROM career_staff_state s JOIN staff st ON st.id = s.staff_id WHERE s.career_save_id = ? AND st.role = ?`, cid, r)[0].n;
  const mineOfRole = (r) => q(`SELECT COUNT(*) n FROM career_staff_state s JOIN staff st ON st.id = s.staff_id WHERE s.career_save_id = ? AND s.team_id IS NOT NULL AND st.role = ?`, cid, r)[0].n;
  const spareCoach = COACHING.reduce((t, r) => t + Math.max(0, ofRole(r) - FLOOR - mineOfRole(r)), 0);
  check("every spare coach went to a club (Head and Assistant down to 5 each, or every club has one)",
    coaching.length === Math.min(clubs.length, spareCoach), `${coaching.length} dealt of ${spareCoach} spare, ${clubs.length} clubs`);
  const spareMed = MEDICAL.reduce((t, r) => t + Math.max(0, ofRole(r) - FLOOR - mineOfRole(r)), 0);
  check("medical likewise", medical.length === Math.min(clubs.length, spareMed), `${medical.length} dealt of ${spareMed} spare`);
  // Rob, 16 Oct: the medic is a doctor or physio while one is spare; a massage therapist or specialist only after.
  const FIRST = ["Doctor", "Physiotherapist"];
  const spareFirst = FIRST.reduce((t, r) => t + Math.max(0, ofRole(r) - FLOOR - mineOfRole(r)), 0);
  const firstDealt = medical.filter((s) => FIRST.includes(s.role)).length;
  check("the medic is a doctor or physio while one is spare: a massage therapist or specialist only once both are down to 5",
    firstDealt === Math.min(clubs.length, spareFirst) && (firstDealt === medical.length || firstDealt === spareFirst),
    `${firstDealt} doctors and physios of ${spareFirst} spare, ${medical.length - firstDealt} massage therapists and specialists`);

  // 1.1.3 (brief A1): Rob's 17 Oct portraits (the 49 that pass the logo check, ids from 10161) are in the
  // pool the AI clubs hire from on Day 8, and with them every AI club gets a doctor or physio.
  const A1_FROM = 10161;
  const newFaces = q(`SELECT COUNT(*) n FROM career_staff_state s WHERE s.career_save_id = ? AND s.staff_id >= ?`, cid, A1_FROM)[0].n;
  const newHired = dealt.filter((s) => s.id >= A1_FROM);
  check("(1.1.3) the Day 8 pool includes the 49 new faces, and AI clubs hired some of them", newFaces === 49 && newHired.length > 0,
    `${newFaces} new faces in the career, ${newHired.length} at AI clubs on Day 8 (${[...new Set(newHired.map((s) => s.role))].join(", ")})`);
  const shortOfMedic = clubs.filter((c) => !(per.get(c) ?? []).some((s) => FIRST.includes(s.role)));
  check("(1.1.3) on Day 8 no AI club is short of a doctor or physio", shortOfMedic.length === 0, `${shortOfMedic.length} of ${clubs.length} without one`);

  // ── 2. The market keeps 5 of every role ────────────────────────────────────
  console.log("\n2. AT LEAST 5 OF EVERY ROLE STAY ON THE MARKET");
  const market = marketByRole();
  check("every role still has 5 or more on the market", Object.keys(market).length === 12 && Object.values(market).every((n) => n >= FLOOR), JSON.stringify(market));

  // ── 3. Contracts and money ─────────────────────────────────────────────────
  console.log("\n3. NORMAL CONTRACTS, THE SIGNING FEE FROM THE CLUB'S BALANCE, NOT THE CAP");
  check("every AI hire is on 6m, 1s or 2s with an end date after today",
    dealt.every((s) => ["6m", "1s", "2s"].includes(s.term) && s.ends > today()), `${new Set(dealt.map((s) => s.term)).size} lengths used`);
  check("(source) the weekly AI charge pays staff wages from the balance; the cap's senior wage bill reads players only",
    /staffWages = weeklyWageBill\(staff\.get\(st\.poolTeamId\)/.test(SRC("utils/poolClubFinances.ts")) && !/careerStaffStateTable/.test(SRC("utils/salaryCap.ts")));

  // ── 4. Not on the market ───────────────────────────────────────────────────
  console.log("\n4. AN AI CLUB'S STAFF ARE NOT ON THE MARKET AND CANNOT BE HIRED");
  const ids = new Set(dealt.map((s) => s.id));
  const staffMarket = (await api("GET", "/staff/market")).data ?? [];
  const medMarket = (await api("GET", "/medical-staff/market")).data ?? [];
  check("neither the Staff Market nor the Medical Market lists anyone at an AI club",
    staffMarket.length > 0 && medMarket.length > 0 && ![...staffMarket, ...medMarket].some((s) => ids.has(s.id)), `${staffMarket.length} + ${medMarket.length} listed`);
  const takenCoach = coaching[0], takenMed = medical[0];
  const hire = await api("POST", "/staff", { staffId: takenCoach.id, length: "1s" });
  const hireMed = await api("POST", "/medical-staff", { staffId: takenMed.id, length: "1s" });
  check("hiring an AI club's coach or medical member is refused", hire.status === 400 && hireMed.status === 400, `${hire.status} / ${hireMed.status}`);

  // ── 5. An AI contract ends ─────────────────────────────────────────────────
  // Rob, 16 Oct: the gap stays until the next Jan 8 (section 9 runs to it).
  console.log("\n5. AN AI CONTRACT THAT ENDS: BACK ON THE MARKET, AND THE GAP STAYS");
  const leaving = takenMed;
  w(`UPDATE career_staff_state SET contract_end_date = ? WHERE career_save_id = ? AND staff_id = ?`, "2026-01-01", cid, leaving.id);
  const medBefore = aiStaff().filter((s) => MEDICAL.includes(s.role));
  await day();
  const back = q(`SELECT team_id AS t, pool_team_id AS p, salary, contract_start_date AS d FROM career_staff_state WHERE career_save_id = ? AND staff_id = ?`, cid, leaving.id)[0];
  const medAfter = aiStaff().filter((s) => MEDICAL.includes(s.role));
  check("her contract ended: she is back on the market with her wage as it was",
    back.p == null && back.t == null && back.d == null && back.salary === leaving.salary, `pool club ${back.p}, wage ${back.salary}`);
  check("the gap stays: her club has no medical member and nobody was hired the day after Jan 8",
    medAfter.length === medBefore.length - 1 && !medAfter.some((s) => s.club === leaving.club)
      && q(`SELECT COUNT(*) n FROM career_staff_state WHERE career_save_id = ? AND pool_team_id IS NOT NULL AND contract_start_date = ?`, cid, today())[0].n === 0,
    `${medAfter.length} medical at AI clubs (${medBefore.length} before), today ${today()}`);
  check("the market still has 5 of every role", Object.values(marketByRole()).every((n) => n >= FLOOR));

  // ── 6. The player's own expiry keeps the wage ──────────────────────────────
  console.log("\n6. THE PLAYER'S OWN STAFF CONTRACT ENDS: THE WAGE STAYS");
  const pick = staffMarket.find((s) => s.role === "Fitness Trainer") ?? staffMarket[0];
  const hired = await api("POST", "/staff", { staffId: pick.id, length: "6m" });
  const wage = q(`SELECT salary FROM career_staff_state WHERE career_save_id = ? AND staff_id = ?`, cid, pick.id)[0].salary;
  w(`UPDATE career_staff_state SET contract_end_date = ? WHERE career_save_id = ? AND staff_id = ?`, "2026-01-01", cid, pick.id);
  await day();
  const after = q(`SELECT team_id AS t, pool_team_id AS p, salary FROM career_staff_state WHERE career_save_id = ? AND staff_id = ?`, cid, pick.id)[0];
  check("the hire worked, and on expiry she is off the club with her wage unchanged",
    hired.status === 201 && after.t == null && after.salary === wage && wage > 0, `wage ${wage} -> ${after.salary}`);

  // ── 7. An older career, at boot ────────────────────────────────────────────
  console.log("\n7. AN OLDER CAREER IS DEALT ONCE AT BOOT");
  await stopServer(child); child = null;
  w(`UPDATE career_staff_state SET pool_team_id = NULL, is_available = 1, contract_term = NULL, contract_start_date = NULL, contract_end_date = NULL WHERE career_save_id = ? AND pool_team_id IS NOT NULL`, cid);
  w(`UPDATE career_saves SET ai_staff_deal_on = NULL, ai_staff_dealt_at = NULL WHERE id = ?`, cid);
  child = await boot("b");
  const reDealt = aiStaff();
  const marked = q(`SELECT ai_staff_deal_on AS d, ai_staff_dealt_at AS at FROM career_saves WHERE id = ?`, cid)[0];
  check("at boot the career was dealt (coaches and medical) and marked with its game date",
    reDealt.filter((s) => COACHING.includes(s.role)).length > 0 && reDealt.filter((s) => MEDICAL.includes(s.role)).length > 0 && marked.at === today(), `${reDealt.length} dealt, marked ${marked.at}`);
  await stopServer(child); child = null;
  child = await boot("c");
  check("a second boot deals nothing more", aiStaff().length === reDealt.length, `${aiStaff().length}`);
  info(`portraits: ${coaching.length} of ${clubs.length} clubs got a coach, ${medical.length} a medical member (see the morning report)`);

  // ── 8. Part 3: their bonuses, through the player's own functions ───────────
  console.log("\n8. AN AI CLUB'S STAFF GIVE ITS BONUSES THROUGH THE PLAYER'S OWN FUNCTIONS (PART 3)");
  // Night 2 (O-6, O-7): the healer chance is gone; an AI club's injuries are treated by its own doctor and
  // physio (the treatment factor), and its sports scientist cuts its risk, through the player's functions.
  const aiSrc = SRC("utils/aiSquads.ts"), injSrc = SRC("utils/injuries.ts"), illSrc = SRC("utils/staffIllness.ts");
  check("(source) AI training XP takes its staff through trainingStaffBonuses, read like the player's staff",
    /trainingStaffBonuses\(loadStaffTx\(w\.tx, careerSaveId, \{ poolTeamId: club \}\)\)/.test(aiSrc) && /staff: bonus\.xpMultiplier, statStaff: bonus\.statXp/.test(aiSrc));
  check("(source) AI players heal on the one weekly clock, at their club's own treatment factor (on duty only)",
    /injuryRecoveryWeekTx\(w, careerSaveId, \{ poolTeamId: id \}\)/.test(injSrc) && /medicalTeam\(staffOfTx\(w, careerSaveId, club\)\)/.test(injSrc)
      && /staffOnDuty\(s\)/.test(SRC("utils/staffBonuses.ts")) && !/healingBonus/.test(SRC("utils/condition.ts")));
  check("(source) an AI club's injuries start with its own medical staff, and its sports scientist cuts its match injury risk",
    /startInjuryTx\(w, careerSaveId, \{ poolTeamId \}/.test(aiSrc)
      && /staffFactor = injuryRiskStaffFactor\(loadStaffTx\(w\.tx, careerSaveId, \{ poolTeamId \}\)\)/.test(aiSrc));
  check("(source) an AI club's staff go off ill on the same odds, so one off gives nothing (staffOnDuty in every bonus)",
    /export function aiStaffAbsenceDayTx/.test(illSrc) && /aiStaffAbsenceDayTx\(w, careerSaveId, calendar\.currentDate\)/.test(SRC("routes/calendar.ts"))
      && /staffOnDuty\(s\)/.test(SRC("utils/staffBonuses.ts")));

  // ── 9. Jan 8, every season, and only then ──────────────────────────────────
  console.log("\n9. A GAP MID-SEASON WAITS FOR THE NEXT JAN 8; ON JAN 8 EVERY AI CLUB THAT CAN PAY HIRES");
  const myTeam = () => q(`SELECT team_id AS t FROM career_saves WHERE id = ?`, cid)[0].t;
  const nowDate = () => q(`SELECT "current_date" AS d FROM calendar_state WHERE team_id = ?`, myTeam())[0]?.d;
  // A gap made today: an AI club's coach whose contract has ended.
  const coachNow = aiStaff().find((s) => COACHING.includes(s.role));
  w(`UPDATE career_staff_state SET contract_end_date = ? WHERE career_save_id = ? AND staff_id = ?`, "2026-01-01", cid, coachNow.id);
  const gapClub = coachNow.club, gapMadeOn = nowDate();
  let offDayHires = 0, ended = 0, guard9 = 0, lastStaff = new Set(aiStaff().map((s) => `${s.id}@${s.club}`));
  const offDays = [];
  while ((nowDate() ?? "") < "2027-01-07" && guard9++ < 800) {
    keepClubSolvent(DB, myTeam());
    await keepSideFielded(api);
    await renewExpiringContracts(api);
    const r = await day();
    if (r.data?.seasonRollover && r.data.seasonRollover.kind !== "none") w(`UPDATE board_seasons SET grade = 'met' WHERE career_save_id = ? AND grade = 'failed'`, cid);
    const d = nowDate();
    const hiredToday = q(`SELECT COUNT(*) n FROM career_staff_state WHERE career_save_id = ? AND pool_team_id IS NOT NULL AND contract_start_date = ?`, cid, d)[0].n;
    if (hiredToday > 0 && d.slice(5) !== "01-08") { offDayHires += hiredToday; offDays.push(d); }
    const nowStaff = new Set(aiStaff().map((s) => `${s.id}@${s.club}`));
    for (const k of lastStaff) if (!nowStaff.has(k)) ended++;
    lastStaff = nowStaff;
  }
  const onJan7 = aiStaff();
  check("the calendar reached Jan 7 of the next season", nowDate() === "2027-01-07", `${nowDate()} after ${guard9} days`);
  check(`the gap made on ${gapMadeOn} (a coach) is still empty on Jan 7`, !onJan7.some((s) => s.club === gapClub && COACHING.includes(s.role)));
  check("no AI club hired staff on any day but Jan 8", offDayHires === 0, `${offDayHires} hire(s)${offDays.length ? " on " + offDays.slice(0, 5).join(", ") : ""}; ${ended} AI staff contracts ended during the season`);
  const before8 = new Set(onJan7.map((s) => s.id));
  await day();
  const jan8 = nowDate(), after8 = aiStaff();
  const hired8 = after8.filter((s) => !before8.has(s.id));
  check("on Jan 8 the AI clubs with a gap hired", jan8 === "2027-01-08" && hired8.length > 0, `${hired8.length} hired on ${jan8}`);
  check("the club with the mid-season gap has a coach again", after8.some((s) => s.club === gapClub && COACHING.includes(s.role)));
  // Every AI club has a coach and a medic, or that group's market was down to its floor, or it couldn't pay.
  const liveClubs = q(`SELECT pool_team_id AS club, balance FROM career_pool_team_state WHERE career_save_id = ? AND taken_over_at IS NULL`, cid);
  const market8 = q(`SELECT st.role, s.salary FROM career_staff_state s JOIN staff st ON st.id = s.staff_id WHERE s.career_save_id = ? AND s.team_id IS NULL AND s.pool_team_id IS NULL`, cid);
  const spareIn = (group) => group.some((role) => market8.filter((m) => m.role === role).length > FLOOR);
  const cheapestIn = (group) => Math.min(...market8.filter((m) => group.includes(m.role)).map((m) => m.salary));
  const unexplained = [];
  for (const c of liveClubs) for (const [group, name] of [[COACHING, "coach"], [MEDICAL, "medic"]]) {
    if (after8.some((s) => s.club === c.club && group.includes(s.role))) continue;
    if (!spareIn(group) || c.balance < cheapestIn(group)) continue;
    unexplained.push(`club ${c.club} no ${name}`);
  }
  check("on Jan 8 every AI club that can pay has a coach and a medic (the rest: the market at its floor, or no money)",
    unexplained.length === 0, unexplained.slice(0, 5).join(", ") || `${liveClubs.length} clubs`);
  const withBoth = liveClubs.filter((c) => after8.some((s) => s.club === c.club && COACHING.includes(s.role)) && after8.some((s) => s.club === c.club && MEDICAL.includes(s.role))).length;
  info(`on ${jan8}: ${withBoth} of ${liveClubs.length} AI clubs have a coach and a medic`);
  check("the market still has 5 of every role", Object.values(marketByRole()).every((n) => n >= FLOOR));
} catch (err) {
  failures++;
  console.log(`  FAIL  the suite threw: ${err?.stack ?? err}`);
} finally {
  if (child) await stopServer(child);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
