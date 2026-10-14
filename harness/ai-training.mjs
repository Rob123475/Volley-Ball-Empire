/**
 * Update 1, item 3 (Rob, 14 Oct; docs/UPDATE1-AI-TRAINING-BRIEF.md): AI clubs
 * train and develop.
 *
 *   1. the player's training, through the shared rule (utils/trainingXp.ts),
 *      gives exactly what it gave before: XP = round(base x every multiplier),
 *      the primary stat +1 per 100 XP, the secondary +1 per 200
 *   2. after a week every AI senior's training points rose, by the programme
 *      for her lowest stat; no AI player's fatigue, morale, fitness or injury moved
 *   3. a Coach-managed AI club's seniors gain about 10% more XP; a Youth
 *      Developer's academy exactly 15% more; a Negotiator gets nothing extra
 *   4. AI_TRAIN_EVERY_WEEKS = 4 trains in 1 week of 4
 *   5. no stat goes above 99
 *   6. balance report (numbers, not pass/fail): three seasons of the AI world's
 *      average senior rating and club strength, next to the player's squad
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healAllSquads, renewExpiringContracts, keepSideFielded, keepClubSolvent, trainThroughCalendar, startCareer } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-ai-training-"));
const DB = path.join(WORK, "save.sqlite");
const PORT = 4983;
const BASE = `http://localhost:${PORT}/api`;
const SRC = (p) => fs.readFileSync(path.join(REPO, "artifacts", "api-server", "src", p), "utf8");
const MANIFEST = JSON.parse(SRC("data/manager-faces.json"));
const mod = (p) => import(pathToFileURL(path.join(REPO, "artifacts", "api-server", "src", p)).href);
// Rules-only modules (no imports): Node strips their types.
const { potentialMultiplier } = await mod("utils/potential.ts");
const { RESERVE_COURT_SHARE } = await mod("utils/squadRules.ts");
const { aiProgrammeFor, aiTrainsThisWeek, AI_TRAIN_EVERY_WEEKS } = await mod("utils/aiTraining.ts");
const { overallRating } = await mod("utils/overallRating.ts");

// The rule's own numbers, as the oracle (utils/trainingXp.ts; before item 3, routes/training.ts).
const PROGRAMMES = {
  "Power Camp":        { primary: "power",   secondary: "block",   xp: 1.00 },
  "Agility Camp":      { primary: "speed",   secondary: "defense", xp: 1.00 },
  "Serving Academy":   { primary: "serve",   secondary: null,      xp: 1.00 },
  "Defensive Systems": { primary: "defense", secondary: "stamina", xp: 0.95 },
};
const ageModifier = (age) => (age <= 20 ? 1.25 : age <= 25 ? 1.10 : age <= 29 ? 1.00 : age <= 33 ? 0.90 : 0.80);
const academyXpFor = (rating) => (rating >= 75 ? 21 : rating >= 60 ? 19 : 16);
const STATS = ["power", "speed", "defense", "serve", "block", "stamina"];

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
const info = (s) => console.log(`  INFO  ${s}`);
console.log("=".repeat(72));
console.log("  UPDATE 1, ITEM 3: AI CLUBS TRAIN AND DEVELOP");
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

/** Every AI club's career senior, by player id (what aiSquadsTx reads for "player" members). */
function aiSeniors(cid) {
  return new Map(q(`SELECT s.player_id AS id, s.pool_team_id AS club, s.age, s.training_points AS tp, p.potential,
      s.power, s.speed, s.defense, s.serve, s.block, s.stamina, s.fatigue, s.morale, s.fitness, s.injury_status AS inj,
      s.injury_weeks_remaining AS injWeeks, s.is_injured AS injured, s.focus_xp AS focus
    FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.pool_team_id IS NOT NULL AND s.team_id IS NULL AND s.is_retired = 0
      AND (p.player_type = 'senior' OR s.is_promoted = 1)`, cid).map((r) => [r.id, r]));
}
/** Every AI academy youth, by player id. */
function aiYouths(cid) {
  return new Map(q(`SELECT s.player_id AS id, s.pool_team_id AS club, s.training_points AS tp, s.academy_role AS role, p.potential,
      s.power, s.speed, s.defense, s.serve, s.block
    FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.pool_team_id IS NOT NULL AND s.team_id IS NULL AND s.is_retired = 0
      AND p.player_type = 'youth' AND s.is_promoted = 0`, cid).map((r) => [r.id, r]));
}
const faceOf = (speciality) => MANIFEST.faces.find((f) => f.speciality === speciality);
const specialityOf = (faceId) => MANIFEST.faces.find((f) => f.id === faceId)?.speciality ?? null;

let teamId = null, cid = null;
const lastSalary = () => q(`SELECT last_salary_date AS d FROM calendar_state WHERE team_id = ?`, teamId)[0]?.d;
const today = () => q(`SELECT current_date AS d FROM calendar_state WHERE team_id = ?`, teamId)[0]?.d;
async function day() {
  healAllSquads(DB);
  const r = await api("POST", "/calendar/advance", {});
  const id = r.data?.blocked === "pending_match" ? r.data.pendingMatchId : r.data?.matchDay?.matchId;
  if (id) { await api("POST", `/matches/${id}/simulate`); await api("POST", r.data?.blocked === "pending_match" ? "/calendar/skip-match" : "/calendar/dismiss-match"); }
  return r;
}
/** Play to the next weekly block (the club's salary day, where the AI clubs train). */
async function toNextWeek() {
  const was = lastSalary();
  for (let i = 0; i < 10 && lastSalary() === was; i++) await day();
  return lastSalary() !== was;
}
/** One AI club's strength, the game's rule: sideRating over its best two (utils/matchEngine.ts). */
function clubStrengths(seniors) {
  const byClub = new Map();
  for (const s of seniors.values()) byClub.set(s.club, [...(byClub.get(s.club) ?? []), s]);
  return [...byClub.values()].map((l) => {
    const two = l.map((s) => ({ ...s, r: overallRating(s) })).sort((a, b) => b.r - a.r).slice(0, 2);
    return two.reduce((sum, p) => sum + STATS.reduce((t, k) => t + p[k], 0), 0) / (two.length * 6);
  });
}
const mean = (l) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : 0);

let child = null;
try {
  fs.copyFileSync(SHIPPED, DB);
  const out = fs.openSync(path.join(WORK, "server.log"), "w");
  child = forkServer({ server: SERVER, electron: ELECTRON, out,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: DB, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "ai-training", STARTER_DB_PATH: SHIPPED } });
  for (let i = 0; i < 360; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }

  const prof = await api("POST", "/profiles", { name: "AI Training" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? [])[0];
  await startCareer(api, { managerFaceId: 8, slotNumber: 1, managerName: "AI Training", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  teamId = (await api("GET", "/team")).data?.id;
  cid = q(`SELECT id FROM career_saves WHERE team_id = ?`, teamId)[0].id;
  const startSquad = q(`SELECT s.power, s.speed, s.defense, s.serve, s.block, s.stamina FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.team_id = ? AND p.player_type = 'senior'`, cid, teamId);
  const startPoolRatings = q(`SELECT p.power, p.speed, p.defense, p.serve, p.block, p.stamina, c.pool_team_id AS club FROM continental_pool_players p
    JOIN pool_player_contracts c ON c.pool_player_id = p.id AND c.career_save_id = ? AND c.status = 'active'`, cid);

  // ── 1. The player's training ───────────────────────────────────────────────
  console.log("\n1. THE PLAYER'S TRAINING GIVES WHAT IT GAVE BEFORE THE SHARED RULE");
  const trainingSrc = SRC("routes/training.ts");
  check("(source) applyFatigueAndStats calls the shared rule and has no XP formula of its own; the AI clubs call the same function",
    /trainingSessionXp\(player, programName, \{/.test(trainingSrc) && !/POINTS_PER_SESSION|PRIMARY_THRESHOLD|SECONDARY_THRESHOLD/.test(trainingSrc)
      && /trainingSessionXp\(s, aiProgrammeFor\(s\), \{ manager: coach\.get\(club\) \}\)/.test(SRC("utils/aiSquads.ts")));
  const senior = q(`SELECT s.player_id AS id, s.age, s.training_points AS tp, p.potential, s.power, s.block FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.team_id = ? AND p.player_type = 'senior' ORDER BY s.player_id LIMIT 1`, cid, teamId)[0];
  const session = await trainThroughCalendar(api, { playerId: senior.id, type: "Power Camp", durationHours: 2 }, DB);
  const r1 = session.result;
  const after1 = q(`SELECT training_points AS tp, power, block FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, senior.id)[0];
  const philosophy = q(`SELECT training_philosophy AS p FROM teams WHERE id = ?`, teamId)[0]?.p;
  const levels = Object.fromEntries(q(`SELECT type, level FROM facilities WHERE team_id = ?`, teamId).map((f) => [f.type, f.level]));
  const facility = (1 + ((levels.training_complex ?? 1) - 1) * (0.20 / 9)) * (1 + ((levels.gymnasium ?? 1) - 1) * (0.15 / 9));
  const m1 = 1.00 * 1 * (r1?.staffXpMultiplier ?? 1) * ageModifier(senior.age) * 1 * potentialMultiplier(senior.potential) * facility * 1 * (r1?.managerXpMultiplier ?? 1);
  const prevTp = (r1?.totalXp ?? 0) - (r1?.xpGained ?? 0);
  const wantPrimary = Math.floor((r1?.totalXp ?? 0) / 100) - Math.floor(prevTp / 100);
  const wantSecondary = Math.floor((r1?.totalXp ?? 0) / 200) - Math.floor(prevTp / 200);
  check("a Power Camp's XP is round(base x programme x staff x age x potential x facility x manager), the pre-item-3 rule",
    session.status === 200 && !philosophy && r1.xpGained === Math.round(r1.baseXp * m1) && r1.baseXp >= 25 && r1.baseXp <= 35,
    `base ${r1?.baseXp} x ${m1.toFixed(4)} = ${r1?.xpGained}`);
  check("and its stat gains are the 100 / 200 XP milestones (power, then block), written to her, capped at 99",
    (r1.statGains.power ?? 0) === wantPrimary && (r1.statGains.block ?? 0) === wantSecondary && after1.tp === r1.totalXp
      && after1.power === Math.min(99, senior.power + wantPrimary) && after1.block === Math.min(99, senior.block + wantSecondary),
    `${prevTp} -> ${r1.totalXp} XP: +${wantPrimary} power, +${wantSecondary} block`);

  // ── 2. A week of AI training ───────────────────────────────────────────────
  console.log("\n2. A WEEK: EVERY AI SENIOR TRAINS HER WEAKEST, AND NOTHING ELSE ABOUT HER MOVES");
  await toNextWeek();   // the AI clubs' pool players become career seniors (and train once)
  const faces0 = new Map(q(`SELECT pool_team_id AS club, manager_face_id AS f FROM career_pool_team_state WHERE career_save_id = ?`, cid).map((r) => [r.club, r.f]));
  const s0 = aiSeniors(cid);
  check("(set-up) the AI clubs' seniors are career players now", s0.size >= 100, `${s0.size} AI seniors`);
  const weekRan = await toNextWeek();
  const s1 = aiSeniors(cid);
  const both = [...s0.keys()].filter((id) => s1.has(id));
  const rose = both.filter((id) => s1.get(id).tp > s0.get(id).tp);
  check("after a week, every AI senior's training points went up", weekRan && both.length > 100 && rose.length === both.length, `${rose.length} of ${both.length}`);
  const coachOf = (club) => (specialityOf(faces0.get(club)) === "Coach" ? 1.1 : 1);
  const programmeOk = both.filter((id) => {
    const a = s0.get(id), b = s1.get(id), prog = PROGRAMMES[aiProgrammeFor(a)];
    const moved = STATS.filter((k) => b[k] !== a[k]);
    const m = prog.xp * ageModifier(a.age) * potentialMultiplier(a.potential) * coachOf(a.club);
    const gain = b.tp - a.tp;
    return moved.every((k) => k === prog.primary || k === prog.secondary) && gain >= Math.round(25 * m) && gain <= Math.round(35 * m);
  });
  check("each trained the programme for her lowest of power, speed, defense, serve, block (only its stats moved; XP in its range)",
    programmeOk.length === both.length, `${programmeOk.length} of ${both.length}`);
  const untouched = both.filter((id) => ["fatigue", "morale", "fitness", "inj", "injWeeks", "injured", "focus"].every((k) => s1.get(id)[k] === s0.get(id)[k]));
  check("no AI player's fatigue, morale, fitness, injury or focus changed", untouched.length === both.length, `${untouched.length} of ${both.length}`);

  // ── 3. Coach, Youth Developer, Negotiator ──────────────────────────────────
  console.log("\n3. AN AI CLUB'S OWN MANAGER: COACH +10%, YOUTH DEVELOPER +15%, NEGOTIATOR NOTHING");
  const setAll = (faceId) => w(`UPDATE career_pool_team_state SET manager_face_id = ? WHERE career_save_id = ? AND manager_name IS NOT NULL`, faceId, cid);
  async function week(faceId) {
    setAll(faceId);
    // Only clubs with a manager in post have one (a vacant club's speciality is none).
    const managed = new Set(q(`SELECT pool_team_id AS club FROM career_pool_team_state WHERE career_save_id = ? AND manager_name IS NOT NULL AND taken_over_at IS NULL`, cid).map((r) => r.club));
    const sb = aiSeniors(cid), yb = aiYouths(cid);
    await toNextWeek();
    const sa = aiSeniors(cid), ya = aiYouths(cid);
    const seniors = [...sb.keys()].filter((id) => sa.has(id) && sa.get(id).club === sb.get(id).club && managed.has(sb.get(id).club)).map((id) => ({ b: sb.get(id), gain: sa.get(id).tp - sb.get(id).tp }));
    const youths = [...yb.keys()].filter((id) => ya.has(id) && ya.get(id).club === yb.get(id).club && managed.has(yb.get(id).club)).map((id) => ({ b: yb.get(id), gain: ya.get(id).tp - yb.get(id).tp }));
    return { seniors, youths };
  }
  const inRange = (l, factor) => l.every(({ b, gain }) => {
    const m = PROGRAMMES[aiProgrammeFor(b)].xp * ageModifier(b.age) * potentialMultiplier(b.potential) * factor;
    return gain >= Math.round(25 * m) && gain <= Math.round(35 * m);
  });
  const academyExact = (l, factor) => l.every(({ b, gain }) => {
    const share = b.role === "reserve" ? RESERVE_COURT_SHARE : 1;
    const rating = Math.round((b.power + b.speed + b.defense + b.serve + b.block) / 5);
    return gain === Math.round(Math.round(academyXpFor(rating) * factor * potentialMultiplier(b.potential)) * share);
  });
  const wCoach = await week(faceOf("Coach").id);
  const wYD = await week(faceOf("Youth Developer").id);
  const wNeg = await week(faceOf("Negotiator").id);
  for (const [club, f] of faces0) w(`UPDATE career_pool_team_state SET manager_face_id = ? WHERE career_save_id = ? AND pool_team_id = ?`, f, cid, club);
  // The same players, XP per point of their age x potential x programme, Coach week against Negotiator week.
  const byId = (l) => new Map(l.map((x) => [x.b.id, x]));
  const c = byId(wCoach.seniors), n = byId(wNeg.seniors);
  const common = [...c.keys()].filter((id) => n.has(id));
  const norm = (x) => x.gain / (PROGRAMMES[aiProgrammeFor(x.b)].xp * ageModifier(x.b.age) * potentialMultiplier(x.b.potential));
  const ratio = mean(common.map((id) => norm(c.get(id)))) / mean(common.map((id) => norm(n.get(id))));
  check("Coach: every AI senior's XP is in the range for x1.1; the same seniors gain about 10% more than under a Negotiator",
    inRange(wCoach.seniors, 1.1) && common.length > 100 && ratio > 1.05 && ratio < 1.15, `x${ratio.toFixed(3)} over ${common.length} seniors`);
  check("Youth Developer: every AI academy youth's week is exactly academyXpFor x 1.15 x potential x court time",
    wYD.youths.length > 100 && academyExact(wYD.youths, 1.15), `${wYD.youths.length} youths`);
  check("and its seniors get nothing from it (the x1 range)", inRange(wYD.seniors, 1));
  check("Negotiator: nothing extra anywhere (seniors in the x1 range, academies at x1); nor does a Coach's academy",
    inRange(wNeg.seniors, 1) && academyExact(wNeg.youths, 1) && academyExact(wCoach.youths, 1));

  // ── 4. Every N weeks ───────────────────────────────────────────────────────
  console.log("\n4. AI_TRAIN_EVERY_WEEKS");
  const weeks = Array.from({ length: 12 }, (_, i) => i);
  check("with AI_TRAIN_EVERY_WEEKS = 4, AI seniors train in 1 week of 4 (weeks 0, 4, 8 of 12), not the other 3",
    weeks.filter((x) => aiTrainsThisWeek(x, 4)).join(",") === "0,4,8");
  check("as shipped it is 1: every week (as sections 2 and 3 ran)", AI_TRAIN_EVERY_WEEKS === 1 && weeks.every((x) => aiTrainsThisWeek(x)));
  check("(source) the weekly block trains them with the knob, by the career's week number",
    /aiSeniorsTrainWeekTx\(w, careerSaveId, nextDate\);/.test(SRC("routes/calendar.ts"))
      && /if \(!aiTrainsThisWeek\(careerWeekOf\(start, today\), every\)\) return 0;/.test(SRC("utils/aiSquads.ts")));

  // ── 5. The cap ─────────────────────────────────────────────────────────────
  console.log("\n5. NO STAT ABOVE 99");
  const capped = [...aiSeniors(cid).values()][0];
  w(`UPDATE career_player_state SET power = 99, speed = 99, defense = 99, serve = 99, block = 99, stamina = 99, training_points = 199 WHERE career_save_id = ? AND player_id = ?`, cid, capped.id);
  await toNextWeek();
  const capAfter = q(`SELECT power, block, training_points AS tp FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, capped.id)[0];
  check("a senior at 99 crossing 200 XP (power and block due) stays at 99", capAfter.power === 99 && capAfter.block === 99 && capAfter.tp > 199, JSON.stringify(capAfter));
  const over = q(`SELECT COUNT(*) AS n FROM career_player_state WHERE career_save_id = ? AND (power > 99 OR speed > 99 OR defense > 99 OR serve > 99 OR block > 99 OR stamina > 99)`, cid)[0].n;
  check("no player in the career has a stat above 99", over === 0, `${over}`);

  // ── 6. Balance report ──────────────────────────────────────────────────────
  console.log("\n6. BALANCE REPORT: THREE SEASONS (NUMBERS, NOT PASS/FAIL)");
  const startStrengths = clubStrengths(new Map(startPoolRatings.map((p, i) => [i, p])));
  info(`career start: AI senior average rating ${mean(startPoolRatings.map(overallRating)).toFixed(1)}, AI club strength ${mean(startStrengths).toFixed(1)}; the player's starting squad ${mean(startSquad.map(overallRating)).toFixed(1)}`);
  const snapshot = () => {
    const s = aiSeniors(cid);
    const mine = q(`SELECT s.power, s.speed, s.defense, s.serve, s.block, s.stamina FROM career_player_state s JOIN players p ON p.id = s.player_id
      WHERE s.career_save_id = ? AND s.team_id = (SELECT team_id FROM career_saves WHERE id = ?) AND (p.player_type = 'senior' OR s.is_promoted = 1)`, cid, cid);
    return `AI senior average rating ${mean([...s.values()].map(overallRating)).toFixed(1)}, AI club strength ${mean(clubStrengths(s)).toFixed(1)}; the player's squad now ${mean(mine.map(overallRating)).toFixed(1)}`;
  };
  const myTeam = () => q(`SELECT team_id AS t FROM career_saves WHERE id = ?`, cid)[0]?.t ?? teamId;
  let seasons = 0, end = null, stopped = null;
  info(`season 1, after the weeks above: ${snapshot()}`);
  for (let i = 0; i < 2000 && seasons < 3; i++) {
    healAllSquads(DB);
    keepClubSolvent(DB, myTeam());
    await keepSideFielded(api);
    await renewExpiringContracts(api);
    if ((today() ?? "").slice(5) >= "12-20") end = snapshot();
    const r = await api("POST", "/calendar/advance", {});
    if (r.status >= 400) { stopped = `advance HTTP ${r.status}`; break; }
    const id = r.data?.blocked === "pending_match" ? r.data.pendingMatchId : r.data?.matchDay?.matchId;
    if (id) { await api("POST", `/matches/${id}/simulate`); await api("POST", r.data?.blocked === "pending_match" ? "/calendar/skip-match" : "/calendar/dismiss-match"); }
    if (!r.data?.seasonRollover || r.data.seasonRollover.kind === "none") continue;
    seasons++;
    w(`UPDATE board_seasons SET grade = 'met' WHERE career_save_id = ? AND grade = 'failed'`, cid);
    info(`season ${seasons} end: ${end ?? snapshot()}`);
    if (seasons < 3) info(`season ${seasons + 1} start: ${snapshot()}`);
    end = null;
  }
  check("(report) three seasons were played", seasons === 3, stopped ?? `${seasons} seasons`);
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  if (child) await stopServer(child);
}
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else fs.rmSync(WORK, { recursive: true, force: true });
process.exit(failures > 0 ? 1 : 0);
