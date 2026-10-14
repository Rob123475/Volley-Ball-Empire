/**
 * Update 1, overnight brief part 1a (Rob, 14 Oct): the AI clubs take staff on
 * Day 8 (utils/aiStaff.ts).
 *
 *   1. before Day 8 no AI club has staff; on Day 8 every club that can gets one
 *      coach (Head or Assistant) and one medical member (Doctor, Physio,
 *      Massage Therapist, Medical Specialist), never more than one of each
 *   2. at least 5 of every role stay on the market for the player
 *   3. each AI hire is a normal contract (6m / 1s / 2s, an end date), its
 *      signing fee (one month's salary) came off the club's balance, and the
 *      salary cap's senior wage bill does not count staff
 *   4. an AI club's staff are not on the Staff or Medical Market and cannot be
 *      hired by the player
 *   5. an AI contract that ends puts them back on the market at their wage, and
 *      a club with a gap fills it (one coach, one medical, at a time)
 *   6. the player's own staff contract ending keeps the wage (it was set to $0)
 *   7. an older career (no deal dates) is dealt once at boot
 *   8. part 3: their bonuses go through the player's own functions (training
 *      XP, healing, off ill gives nothing)
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healAllSquads, startCareer } from "./harness-club.mjs";

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
  const spareCoach = COACHING.reduce((t, r) => t + Math.max(0, 10 - FLOOR - q(`SELECT COUNT(*) n FROM career_staff_state s JOIN staff st ON st.id = s.staff_id WHERE s.career_save_id = ? AND s.team_id IS NOT NULL AND st.role = ?`, cid, r)[0].n), 0);
  check("every spare coach went to a club (Head and Assistant down to 5 each, or every club has one)",
    coaching.length === Math.min(clubs.length, spareCoach), `${coaching.length} dealt of ${spareCoach} spare, ${clubs.length} clubs`);
  check("medical likewise", medical.length === Math.min(clubs.length, MEDICAL.length * (10 - FLOOR)), `${medical.length} dealt`);

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
  console.log("\n5. AN AI CONTRACT THAT ENDS: BACK ON THE MARKET, AND A GAP IS FILLED");
  const leaving = takenMed;
  w(`UPDATE career_staff_state SET contract_end_date = ? WHERE career_save_id = ? AND staff_id = ?`, "2026-01-01", cid, leaving.id);
  const medBefore = aiStaff().filter((s) => MEDICAL.includes(s.role));
  const bal0 = balances();
  await day();
  const bal1 = balances();
  const back = q(`SELECT team_id AS t, pool_team_id AS p, salary FROM career_staff_state WHERE career_save_id = ? AND staff_id = ?`, cid, leaving.id)[0];
  const medAfter = aiStaff().filter((s) => MEDICAL.includes(s.role));
  const gained = medAfter.filter((s) => !medBefore.some((b) => b.id === s.id && b.club === s.club));
  check("her contract ended: she left her club with her wage as it was", back.p !== leaving.club && back.salary === leaving.salary, `now at pool club ${back.p}, wage ${back.salary}`);
  check("the gap she left on the market was filled by one club with no medical member (one at a time)",
    medAfter.length === medBefore.length && gained.length === 1 && medBefore.filter((b) => b.club === gained[0].club && b.id !== leaving.id).length === 0,
    `${gained.length} gained, ${medAfter.length} medical at AI clubs`);
  const g = gained[0];
  check("that club paid her signing fee (one month's salary) from its balance", g && bal0.get(g.club) - bal1.get(g.club) >= g.salary - 1,
    g ? `${Math.round(bal0.get(g.club) - bal1.get(g.club))} for a ${g.salary} wage` : "");
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
  const aiSrc = SRC("utils/aiSquads.ts"), condSrc = SRC("utils/condition.ts"), illSrc = SRC("utils/staffIllness.ts");
  check("(source) AI training XP takes its Head and Assistant Coach through trainingStaffBonuses, read like the player's staff",
    /trainingStaffBonuses\(loadStaffTx\(w\.tx, careerSaveId, \{ poolTeamId: club \}\)\)\.xpMultiplier/.test(aiSrc));
  check("(source) AI players heal through the one weekly recovery, with the club's own medics (on duty only)",
    /loadStaffTx\(w\.tx, careerSaveId, club\)/.test(condSrc) && /healingBonus\(staff\)/.test(condSrc) && /staffOnDuty\(s\)/.test(SRC("utils/staffBonuses.ts")) && /injuryRecoveryWeekTx\(w, careerSaveId, \{ poolTeamId: id \}\)/.test(condSrc));
  // Update 1, 15 Oct (O-3): its doctor heals (the one healing bonus) and its medical specialist cuts its injury risk.
  check("(source) an AI club's doctor heals and its medical specialist cuts its match injury risk, through the player's functions",
    /healingBonus\(staff\)/.test(condSrc) && /"doctor"\]/.test(SRC("utils/staffBonuses.ts"))
      && /staffFactor = injuryRiskStaffFactor\(loadStaffTx\(w\.tx, careerSaveId, \{ poolTeamId \}\)\)/.test(aiSrc));
  check("(source) an AI club's staff go off ill on the same odds, so one off gives nothing (staffOnDuty in every bonus)",
    /export function aiStaffAbsenceDayTx/.test(illSrc) && /aiStaffAbsenceDayTx\(w, careerSaveId, calendar\.currentDate\)/.test(SRC("routes/calendar.ts"))
      && /staffOnDuty\(s\)/.test(SRC("utils/staffBonuses.ts")));
} catch (err) {
  failures++;
  console.log(`  FAIL  the suite threw: ${err?.stack ?? err}`);
} finally {
  if (child) await stopServer(child);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
