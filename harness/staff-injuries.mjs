/**
 * Final brief 5 Oct, Part B: staff and medical staff fall ill or get hurt.
 *
 *   "Proof: a harness suite covering the rates over a long run (about half the
 *    players' rate), the recovery times, bonuses dropping off and coming back,
 *    and the news lines."
 *
 *   1. THE RATE    a new career with nine staff (four staff, four medical and
 *      a Scout) plays STAFF_RUN_SEASONS seasons (default 6), every match
 *      simmed, the squad as the game leaves it. Staff off per staff-day on the
 *      books against players injured per player-day (the game's measured
 *      figure; this run's players are checked against it): about half
 *      (0.30-0.80 on one run; the design figure is 0.50).
 *   2. THE TIME    the causes' average time off is half the players' injury
 *      table's (within 10%); illness and accidents both; every absence that
 *      ended in the run lasted exactly its cause's days.
 *   3. BONUSES     on a second career (the random roll off, absences planted):
 *      the Promotions Manager off: the week's sponsor income has no bonus;
 *      back: it has it again. The physio off: an injured player heals one week
 *      a week; on duty (skill 250, so her extra week always comes): two. The
 *      Scout off: no player scouting, in words; back: scouting works.
 *   4. NEWS        Club News says when each went off and when they came back;
 *      the Staff and Medical lists carry what the badge shows.
 *   5. OLD SAVES   a copy of Rob's 2 Oct save boots: the new columns and table
 *      are added, everyone on duty, the Staff list loads.
 *
 * Usage: node harness/staff-injuries.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { keepSideFielded, renewExpiringContracts, keepClubSolvent } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-staff-injuries-"));
const PORT = 4975;
const BASE = `http://localhost:${PORT}/api`;
const SEASONS = Number(process.env.STAFF_RUN_SEASONS ?? 6);
const ROB_BACKUP = process.env.VBE_ROB_BACKUP ?? path.join(os.homedir(), "Downloads", "volleyball-empire-backup-02oct-0845.sqlite");

// READ, not restated: the rules this suite checks are the game's own.
const ILL_SRC = fs.readFileSync(path.join(REPO, "lib/db/src/schema/staff-illness.ts"), "utf8");
const INJ_SRC = fs.readFileSync(path.join(REPO, "lib/db/src/schema/injuries.ts"), "utf8");
const COND_SRC = fs.readFileSync(path.join(REPO, "artifacts/api-server/src/utils/condition.ts"), "utf8");
const CAUSES = [...ILL_SRC.matchAll(/key: "(\w+)",\s+kind: "(\w+)",\s+short: "([^"]+)",\s+news: "([^"]+)",\s+days: (\d+),\s+weight: (\d+)/g)]
  .map((m) => ({ key: m[1], kind: m[2], short: m[3], news: m[4], days: Number(m[5]), weight: Number(m[6]) }));
const WEEKS = Object.fromEntries([...INJ_SRC.matchAll(/"?([\w ]+)"?:\s+(\d+),/g)].map((m) => [m[1].trim(), Number(m[2])]));
const ODDS = { minor: Number(/roll < ([\d.]+)\) return \{ status: "Minor Injury"/.exec(COND_SRC)?.[1]),
  majorTo: Number(/roll < ([\d.]+)\) return \{ status: "Major Injury"/.exec(COND_SRC)?.[1]) };

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  PART B: STAFF AND MEDICAL STAFF OFF ILL OR HURT");
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
const boot = (db, log, rolls) => forkServer({ server: SERVER, electron: ELECTRON, out: fs.openSync(path.join(WORK, log), "w"),
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: db, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "staff-injuries",
    VBE_STAFF_ABSENCES: rolls ? "on" : "off" } });
const up = async () => { for (let i = 0; i < 240; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) return true; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); } return false; };
const dbq = (file) => (sql, ...a) => { const d = new DatabaseSync(file, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
const dbw = (file) => (sql, ...a) => { const d = new DatabaseSync(file); try { return d.prepare(sql).run(...a); } finally { d.close(); } };

/** A new Sydney Riptide career and its eight staff, hired by a direct write (the market and its budget are not this suite's subject). */
async function newCareer(file, name) {
  const q = dbq(file), w = dbw(file);
  cookie = "";
  const prof = await api("POST", "/profiles", { name });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", { slotNumber: 1, managerName: "Rob Bonner", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  const team = (await api("GET", "/team")).data;
  const cid = q(`SELECT id FROM career_saves WHERE team_id = ?`, team.id)[0].id;
  const want = [/^head coach$/i, /^assistant coach$/i, /^fitness trainer$/i, /^promotion/i, /^physio/i, /doctor/i, /^massage/i, /^nutrition/i, /^scout$/i];
  const staff = q(`SELECT id, name, role, skill_level AS skill FROM staff ORDER BY skill_level DESC`);
  const hired = {};
  for (const re of want) {
    const s = staff.find((x) => re.test(x.role) && !Object.values(hired).some((h) => h.id === x.id));
    if (!s) continue;
    hired[re.source] = s;
    w(`UPDATE career_staff_state SET team_id = ?, is_available = 0, salary = 1000, contract_term = '2s', contract_start_date = '2026-01-01', contract_end_date = '2099-12-31'
       WHERE career_save_id = ? AND staff_id = ?`, team.id, cid, s.id);
  }
  return { team, cid, hired };
}
async function day(file, teamId) {
  keepClubSolvent(file, teamId);
  const r = await api("POST", "/calendar/advance", {});
  if (r.data?.blocked === "pending_match") { await api("POST", `/matches/${r.data.pendingMatchId}/simulate`, {}); await api("POST", "/calendar/skip-match", {}); return r; }
  const mid = r.data?.matchDay?.matchId;
  if (mid) { await api("POST", `/matches/${mid}/simulate`, {}); await api("POST", "/calendar/dismiss-match", {}); }
  return r;
}

let child = null;
try {
  // ── 1. The rate, over a long run ──────────────────────────────────────────
  console.log(`\n1. THE RATE: ${SEASONS} SEASONS, PLAYERS AGAINST STAFF`);
  const RUN = path.join(WORK, "run.sqlite");
  fs.copyFileSync(SHIPPED, RUN);
  child = boot(RUN, "server-run.log", true);
  if (!(await up())) throw new Error("server never came up");
  const q = dbq(RUN);
  const run = await newCareer(RUN, "Staff Rate");
  const nStaff = Object.keys(run.hired).length;
  check("(set-up) the club has its staff: four staff, four medical and a Scout", nStaff === 9,
    Object.values(run.hired).map((h) => `${h.role}`).join(", "));
  // Person-days are counted once per game date the calendar played (a match
  // day is advanced to twice: once to the match, once past it).
  const gameDate = () => q(`SELECT "current_date" AS d FROM calendar_state WHERE team_id = ?`, run.team.id)[0]?.d ?? null;
  let seasons = 0, playerDays = 0, staffDays = 0, days = 0, calls = 0;
  for (let i = 0; i < 4000 && seasons < SEASONS; i++) {
    if (i % 20 === 0) { await keepSideFielded(api); await renewExpiringContracts(api); }
    const before = gameDate();
    const players = q(`SELECT COUNT(*) AS n FROM career_player_state s JOIN players p ON p.id = s.player_id
      WHERE s.career_save_id = ? AND s.team_id = ? AND s.is_retired = 0 AND (p.player_type = 'senior' OR s.is_promoted = 1)`, run.cid, run.team.id)[0].n;
    const staffNow = q(`SELECT COUNT(*) AS n FROM career_staff_state WHERE career_save_id = ? AND team_id = ?`, run.cid, run.team.id)[0].n;
    const r = await day(RUN, run.team.id);
    calls++;
    if (gameDate() !== before) { playerDays += players; staffDays += staffNow; days++; }
    if (r.data?.seasonRollover && r.data.seasonRollover.kind !== "none") seasons++;
  }
  const playerInjuries = q(`SELECT COUNT(*) AS n FROM injury_history WHERE team_id = ?`, run.team.id)[0].n;
  const absences = q(`SELECT * FROM staff_absences WHERE career_save_id = ?`, run.cid);
  const pRate = playerInjuries / playerDays, sRate = absences.length / staffDays;
  const designPlayer = Number(/PLAYER_INJURIES_PER_PLAYER_DAY = (\d+) \/ (\d+)/.exec(ILL_SRC)?.slice(1).reduce((a, b) => a / b));
  console.log(`  (info) ${days} game days played (${calls} advances): players ${playerInjuries} injuries in ${playerDays} player-days (${(pRate * 1000).toFixed(2)} per 1,000); ` +
    `staff ${absences.length} absences in ${staffDays} staff-days (${(sRate * 1000).toFixed(2)} per 1,000); the game's player figure ${(designPlayer * 1000).toFixed(2)} per 1,000`);
  check(`${SEASONS} seasons played`, seasons === SEASONS, `${seasons}`);
  // The players' rate is the game's own measured figure (164 injuries in about 48,100
  // player game-days, four runs pooled): one run's own count is too small to divide
  // by without a coin's worth of noise. This run's own players are reported beside it.
  check("staff go off about half as often as players are injured (0.30-0.80 on one run; designed 0.50)",
    absences.length > 0 && sRate / designPlayer >= 0.30 && sRate / designPlayer <= 0.80,
    `staff ${(sRate * 1000).toFixed(2)} per 1,000 staff-days against players' ${(designPlayer * 1000).toFixed(2)} per 1,000 player-days: ${(sRate / designPlayer).toFixed(2)} x ` +
      `(this run's own players: ${(pRate * 1000).toFixed(2)}, so ${(sRate / pRate).toFixed(2)} x)`);
  // Players' injuries swing a lot from run to run (fatigue, who plays, the
  // weather): reported, not asserted.
  console.log(`  (info) this run's players against the game's figure: ${(pRate * 1000).toFixed(2)} vs ${(designPlayer * 1000).toFixed(2)} per 1,000 player-days`);

  // ── 2. The time off ───────────────────────────────────────────────────────
  console.log("\n2. THE TIME OFF");
  const tw = CAUSES.reduce((s, c) => s + c.weight, 0);
  const staffMean = CAUSES.reduce((s, c) => s + c.days * c.weight, 0) / tw;
  const playerMean = 7 * (ODDS.minor * WEEKS["Minor Injury"] + (ODDS.majorTo - ODDS.minor) * WEEKS["Major Injury"] + (1 - ODDS.majorTo) * WEEKS.Unavailable);
  check("the causes' average time off is half the players' injury table's (within 10%)",
    Math.abs(staffMean / playerMean - 0.5) <= 0.05, `${staffMean.toFixed(2)} days against ${playerMean.toFixed(2)}: ${(staffMean / playerMean).toFixed(3)} x`);
  check("real-life causes, illness and accidents both, each with its own days",
    CAUSES.length >= 6 && CAUSES.some((c) => c.kind === "illness") && CAUSES.some((c) => c.kind === "accident"),
    CAUSES.map((c) => `${c.short} ${c.days}d`).join(", "));
  const ended = absences.filter((a) => a.returned_on);
  const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
  // Counted on the game calendar; a return due on a date the calendar does not
  // play (the turn of the season) comes on the next day it does.
  const wrong = ended.filter((a) => {
    const d = dayDiff(a.started_on, a.returned_on);
    return CAUSES.find((c) => c.key === a.cause)?.days !== a.days || !(d === a.days || (d === a.days + 1 && a.started_on.slice(5, 7) === "12"));
  });
  check("every absence that ended lasted exactly its cause's days (on the game calendar)", ended.length > 0 && wrong.length === 0,
    `${ended.length} ended, ${wrong.length} wrong; e.g. ${ended.slice(0, 3).map((a) => `${a.staff_name} ${a.cause} ${a.started_on} -> ${a.returned_on}`).join(" · ")}`);
  const causesSeen = [...new Set(absences.map((a) => a.cause))];
  console.log(`  (info) causes in the run: ${causesSeen.map((k) => `${k} ${absences.filter((a) => a.cause === k).length}`).join(", ")}`);
  const runNews = ((await api("GET", "/news")).data?.items ?? []).filter((n) => n.type === "staff");
  await stopServer(child); child = null;

  // ── 3. Bonuses drop off and come back ─────────────────────────────────────
  console.log("\n3. BONUSES DROP OFF AND COME BACK");
  const B = path.join(WORK, "bonus.sqlite");
  fs.copyFileSync(SHIPPED, B);
  child = boot(B, "server-bonus.log", false);
  if (!(await up())) throw new Error("server never came up");
  const qb = dbq(B), wb = dbw(B);
  const car = await newCareer(B, "Staff Bonus");
  const promo = car.hired["^promotion"], physio = car.hired["^physio"], scout = car.hired["^scout$"];
  const others = Object.values(car.hired).filter((h) => h.id !== promo.id && h.id !== physio.id && h.id !== scout.id);
  // Only the three under test do anything medical or commercial: the others are let go.
  for (const o of others) wb(`UPDATE career_staff_state SET team_id = NULL, is_available = 1 WHERE career_save_id = ? AND staff_id = ?`, car.cid, o.id);
  wb(`UPDATE staff SET skill_level = 250 WHERE id = ?`, physio.id);
  const today = (await api("GET", "/calendar")).data?.currentDate;
  const plantOff = (s, cause, days) => {
    wb(`UPDATE career_staff_state SET off_cause = ?, off_since = ?, off_days_left = ? WHERE career_save_id = ? AND staff_id = ?`, cause, today, days, car.cid, s.id);
    wb(`INSERT INTO staff_absences (career_save_id, team_id, staff_id, staff_name, role, cause, days, started_on, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      car.cid, car.team.id, s.id, s.name, s.role, cause, days, today);
  };
  const sponsorWeek = async () => {
    const seen = new Set(((await api("GET", "/finances")).data ?? []).map((t) => t.id));
    for (let d = 0; d < 10; d++) {
      await day(B, car.team.id);
      const tx = ((await api("GET", "/finances")).data ?? []).find((t) => !seen.has(t.id) && t.category === "sponsorship" && /^Weekly sponsor & commercial income/.test(t.description));
      if (tx) return tx;
    }
    return null;
  };
  const injure = (weeks) => {
    const p = qb(`SELECT player_id AS id FROM career_player_state WHERE career_save_id = ? AND team_id = ? AND squad_role = 'interchange'`, car.cid, car.team.id)[0]
      ?? qb(`SELECT player_id AS id FROM career_player_state WHERE career_save_id = ? AND team_id = ? LIMIT 1`, car.cid, car.team.id)[0];
    wb(`UPDATE career_player_state SET injury_status = 'Major Injury', injury_weeks_remaining = ?, is_injured = 1 WHERE career_save_id = ? AND player_id = ?`, weeks, car.cid, p.id);
    return p.id;
  };
  const weeksLeft = (id) => qb(`SELECT injury_weeks_remaining AS w FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, car.cid, id)[0].w;

  // Off: the promotions manager and the physio, for 9 days (longer than a week).
  // Planted with the causes' own days, so the countdown (on the game calendar,
  // from the day they went off) brings them back when the game would.
  check("(set-up) the game date to plant the absences on", /^\d{4}-\d{2}-\d{2}$/.test(today ?? ""), today);
  plantOff(promo, "flu", 9); plantOff(physio, "back", 9); plantOff(scout, "cold", 3);
  const hurt = injure(4);
  const staffList = (await api("GET", "/staff")).data ?? [];
  const medList = (await api("GET", "/medical-staff")).data ?? [];
  const promoDto = staffList.find((s) => s.id === promo.id), physioDto = medList.find((s) => s.id === physio.id);
  check("the Staff and Medical lists say who is off, with what, and for how long (the badge reads them)",
    promoDto?.offCause === "flu" && promoDto?.offDaysLeft === 9 && physioDto?.offCause === "back" && physioDto?.offDaysLeft === 9,
    `Staff: ${promoDto?.name} ${promoDto?.offCause} ${promoDto?.offDaysLeft} -> "Off: flu, back in 9 days"; Medical: ${physioDto?.name} ${physioDto?.offCause} ${physioDto?.offDaysLeft} -> "Off: a bad back, back in 9 days"`);
  const scoutTry = await api("POST", `/players/${qb(`SELECT player_id AS id FROM career_player_state WHERE career_save_id = ? AND team_id IS NULL LIMIT 1`, car.cid)[0].id}/scout`, {});
  check("the Scout off: no player scouting, and it says why", scoutTry.status === 409 && /off/.test(scoutTry.data?.error ?? ""), `HTTP ${scoutTry.status}: ${scoutTry.data?.error}`);
  const before = weeksLeft(hurt);
  const offWeek = await sponsorWeek();
  const afterOffWeek = weeksLeft(hurt);
  check("the Promotions Manager off: that week's sponsor income carries no bonus",
    !!offWeek && !/Promotions Manager bonus/.test(offWeek.description), offWeek?.description);
  check("the physio off: the injured player heals only the week itself (no extra week)",
    before - afterOffWeek === 1, `${before} -> ${afterOffWeek} weeks`);
  // Play on until they are back.
  for (let d = 0; d < 12 && (qb(`SELECT off_days_left AS n FROM career_staff_state WHERE career_save_id = ? AND staff_id = ?`, car.cid, promo.id)[0].n > 0); d++) await day(B, car.team.id);
  const back = qb(`SELECT staff_id AS id, off_days_left AS n, off_cause AS c FROM career_staff_state WHERE career_save_id = ? AND staff_id IN (?, ?, ?)`, car.cid, promo.id, physio.id, scout.id);
  check("after their days they are back on duty", back.every((b) => b.n === 0 && b.c == null), back.map((b) => `${b.id}: ${b.n}`).join(", "));
  wb(`UPDATE career_player_state SET injury_status = 'Major Injury', injury_weeks_remaining = 4, is_injured = 1 WHERE career_save_id = ? AND player_id = ?`, car.cid, hurt);
  const onWeek = await sponsorWeek();
  const afterOnWeek = weeksLeft(hurt);
  check("the Promotions Manager back: the sponsor income carries the bonus again",
    !!onWeek && /Promotions Manager bonus/.test(onWeek.description), onWeek?.description);
  check("the physio back (skill 250, so her extra week always comes): the injured player heals two weeks in one",
    4 - afterOnWeek === 2, `4 -> ${afterOnWeek} weeks`);
  const scoutAgain = await api("POST", `/players/${qb(`SELECT player_id AS id FROM career_player_state WHERE career_save_id = ? AND team_id IS NULL AND scout_started_on IS NULL LIMIT 1`, car.cid)[0].id}/scout`, {});
  check("the Scout back: player scouting works again", scoutAgain.status === 200, `HTTP ${scoutAgain.status} ${scoutAgain.data?.error ?? ""}`);

  // ── 4. Club News ──────────────────────────────────────────────────────────
  console.log("\n4. CLUB NEWS");
  const news = ((await api("GET", "/news")).data?.items ?? []).filter((n) => n.type === "staff");
  const offLine = news.find((n) => n.headline.startsWith(promo.name) && /caught the flu/.test(n.headline));
  const backLine = news.find((n) => n.headline.startsWith(promo.name) && /back at work/.test(n.headline));
  check("Club News says when a member of staff went off, with the cause", !!offLine, offLine ? `${offLine.date}: ${offLine.headline} — ${offLine.detail}` : JSON.stringify(news.slice(0, 2)));
  const gap = backLine && offLine ? Math.round((Date.parse(backLine.date) - Date.parse(offLine.date)) / 86400000) : null;
  check("and when they came back, the cause's days later", !!backLine && gap === 9, backLine ? `${backLine.date} (${gap} days later): ${backLine.headline} — ${backLine.detail}` : "none");
  // The long run's own lines, from absences the game rolled itself (read before its server stopped).
  check("the long run's own absences are in its Club News too", runNews.length > 0 || absences.length === 0,
    runNews.slice(0, 2).map((n) => `${n.date}: ${n.headline}`).join(" · "));
  await stopServer(child); child = null;

  // ── 5. An older save ──────────────────────────────────────────────────────
  console.log("\n5. AN OLDER SAVE: A COPY OF ROB'S 2 OCT SAVE");
  if (!fs.existsSync(ROB_BACKUP)) {
    check("Rob's 2 Oct backup is on this machine", false, ROB_BACKUP);
  } else {
    const OLD = path.join(WORK, "rob.sqlite");
    fs.copyFileSync(ROB_BACKUP, OLD);
    const qo = dbq(OLD);
    const hadCols = qo(`PRAGMA table_info(career_staff_state)`).some((c) => c.name === "off_days_left");
    child = boot(OLD, "server-rob.log", false);
    const booted = await up();
    await stopServer(child); child = null;
    const cols = qo(`PRAGMA table_info(career_staff_state)`).map((c) => c.name);
    const table = qo(`SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'staff_absences'`)[0].n;
    const hiredOld = qo(`SELECT COUNT(*) AS n, SUM(off_days_left) AS off FROM career_staff_state WHERE team_id IS NOT NULL`)[0];
    check("it boots; the new columns and table are added; everyone is on duty",
      booted && !hadCols && ["off_cause", "off_since", "off_days_left"].every((c) => cols.includes(c)) && table === 1 && Number(hiredOld.off ?? 0) === 0,
      `columns before: ${hadCols}, after: ${cols.filter((c) => c.startsWith("off_")).join(", ")}; staff_absences: ${table}; ${hiredOld.n} hired, ${hiredOld.off ?? 0} days off`);
  }
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  if (child) await stopServer(child);
}
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else fs.rmSync(WORK, { recursive: true, force: true });
process.exit(failures > 0 ? 1 : 0);
