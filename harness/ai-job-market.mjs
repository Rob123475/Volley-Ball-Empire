/**
 * Afternoon brief 2 Oct, item 7 (Rob's J-2, J-3, J-4; branch feat-job-market):
 * the manager job market, on Rob's timing.
 *
 * Asserted, on a copy of the starter DB with a new Sydney Riptide career:
 *   1. Every AI club has an AI manager; no job is open at the start.
 *   2. Mid-season: no moves. Resign and Break Contract say "You can leave once
 *      your season is over (penalties apply if you break your contract)".
 *   3. At the season's end the AI boards sack a manager on her second failed
 *      season running (every manager planted on one failed season first, so
 *      one season shows it), with the reason.
 *   4. The off-season window opens when the club's last match is played: AI
 *      clubs make offers (poaching) on his level and season; one declined,
 *      one accepted; the move takes effect at the start of the next season, at
 *      the new club, with his record and achievements, and the club he took is
 *      not also in the season's World Tour field.
 *   5. His own board sacks him after two failed seasons running (planted: last
 *      season failed, and this one projected failed), announced in the window;
 *      with no club he qualifies for, the open club with the lowest rating
 *      takes him at the season's start, and says so.
 *   6. In the next window he breaks his contract (the penalty is paid) and
 *      retires: the career ends.
 *
 * Usage: node harness/ai-job-market.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healAllSquads, renewExpiringContracts, keepSideFielded } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-ai-job-market-"));
const DB = path.join(WORK, "save.sqlite");
const PORT = 4947;
const BASE = `http://localhost:${PORT}/api`;
const MID = "You can leave once your season is over (penalties apply if you break your contract).";

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
const $ = (n) => "$" + Math.round(Number(n)).toLocaleString("en-US");
console.log("=".repeat(72));
console.log("  AFTERNOON 2 OCT, J-2/J-3/J-4: THE JOB MARKET ON ROB'S TIMING");
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

async function day() {
  const r = await api("POST", "/calendar/advance", {});
  if (r.data?.blocked === "pending_match") {
    await api("POST", `/matches/${r.data.pendingMatchId}/simulate`, {});
    await api("POST", "/calendar/skip-match", {});
    return r;
  }
  const id = r.data?.matchDay?.matchId;
  if (id) { await api("POST", `/matches/${id}/simulate`, {}); await api("POST", "/calendar/dismiss-match", {}); }
  return r;
}
/** Play until the off-season window opens (the club's last match played). */
async function toWindow() {
  await keepSideFielded(api);
  await renewExpiringContracts(api);
  for (let i = 0; i < 900; i++) {
    healAllSquads(DB);
    const r = await day();
    if (r.data?.seasonRollover && r.data.seasonRollover.kind !== "none") return { rolledEarly: true, reply: r.data };
    if (i % 3 === 0 && (await api("GET", "/job-market")).data?.window) return { rolledEarly: false };
  }
  return null;
}
/** Play from the window to the season's start; the advance reply carries the move. */
async function toRollover() {
  for (let i = 0; i < 200; i++) {
    healAllSquads(DB);
    const r = await day();
    if (r.data?.seasonRollover && r.data.seasonRollover.kind !== "none") return r.data;
  }
  return null;
}

let child = null;
try {
  fs.copyFileSync(SHIPPED, DB);
  const out = fs.openSync(path.join(WORK, "server.log"), "w");
  child = forkServer({ server: SERVER, electron: ELECTRON, out,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: DB, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "ai-job-market", STARTER_DB_PATH: SHIPPED } });
  for (let i = 0; i < 360; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }

  const prof = await api("POST", "/profiles", { name: "Job Market" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", { slotNumber: 1, managerName: "Rob Bonner", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  let team = (await api("GET", "/team")).data;
  const cid = q(`SELECT id FROM career_saves WHERE team_id = ?`, team.id)[0].id;

  console.log("\n1. EVERY AI CLUB HAS A MANAGER");
  const jm0 = (await api("GET", "/job-market")).data;
  const managers = q(`SELECT pool_team_id AS id, manager_name AS m FROM career_pool_team_state WHERE career_save_id = ?`, cid);
  check("every AI club has a named AI manager", managers.length === 60 && managers.every((r) => r.m), `${managers.length} clubs, e.g. ${managers[0]?.m}`);
  check("and no job is open at the start", jm0?.vacancies?.length === 0, `${jm0?.vacancies?.length} vacancies`);

  console.log("\n2. MID-SEASON: NO MOVES");
  for (let i = 0; i < 20; i++) await day();
  const budget0 = Number((await api("GET", "/team")).data.budget);
  const r1 = await api("POST", "/careers/resign", {});
  const r2 = await api("POST", "/careers/break-contract", {});
  check("resigning mid-season is refused, in Rob's words", r1.status === 409 && r1.data?.error === MID, r1.data?.error);
  check("so is breaking the contract, and nothing is charged", r2.status === 409 && r2.data?.error === MID && Number((await api("GET", "/team")).data.budget) === budget0, r2.data?.error);
  check("the Job Market says moves wait for the season's end", (await api("GET", "/job-market")).data?.window === false);

  console.log("\n3. THE AI BOARDS SACK ON A SECOND FAILED SEASON");
  w(`UPDATE career_pool_team_state SET manager_failed_seasons = 1 WHERE career_save_id = ?`, cid);
  w(`UPDATE teams SET manager_rep_points = 1500 WHERE id = ?`, team.id);
  const win1 = await toWindow();
  check("the off-season window opens once the club's last match is played, before the season ends", win1 && !win1.rolledEarly, JSON.stringify(win1)?.slice(0, 120));
  const year1 = q(`SELECT year FROM seasons WHERE career_save_id = ? AND status = 'active'`, cid)[0].year;
  const sackedNow = q(`SELECT vacancy_reason AS why FROM career_pool_team_state WHERE career_save_id = ? AND vacant_since IS NOT NULL`, cid);
  check("when the window opens the AI boards' sackings are announced, with the reason", sackedNow.length > 0 && sackedNow.every((r) => /sacked after 2 failed seasons running/.test(r.why ?? "")),
    `${sackedNow.length} sacked; e.g. "${sackedNow[0]?.why}"`);
  // His season is a good one (planted), so clubs come for him.
  w(`UPDATE board_seasons SET projected_grade = 'met' WHERE career_save_id = ? AND season_year = ? AND team_id = ?`, cid, year1, team.id);
  const jmW = (await api("GET", "/job-market")).data;
  check("the Job Market lists the open jobs in the window", (jmW?.vacancies ?? []).length === sackedNow.length, `${jmW?.vacancies?.length} listed`);
  check("in the window, AI clubs make offers on his level and season (poaching)", (jmW?.offers ?? []).length > 0,
    (jmW?.offers ?? []).map((o) => `${o.name}: ${o.why}`).slice(0, 2).join(" | "));
  const [first, second] = jmW?.offers ?? [];
  if (second) {
    const no = await api("POST", `/job-market/offers/${second.poolTeamId}/decline`, {});
    check("an offer declined is not made again", no.data?.declined === true && !(await api("GET", "/job-market")).data.offers.some((o) => o.poolTeamId === second.poolTeamId), second.name);
  }
  const yes = first ? await api("POST", `/job-market/offers/${first.poolTeamId}/accept`, {}) : { data: null };
  check("an offer accepted is a move agreed for the start of next season", yes.data?.accepted === true && (await api("GET", "/job-market")).data.pending?.poolTeamId === first?.poolTeamId, `${first?.name}: ${yes.data?.takesEffect}`);
  const achBefore = q(`SELECT COUNT(*) AS n FROM achievements WHERE team_id = ?`, team.id)[0].n;
  const oldName = team.name;
  const roll1 = await toRollover();

  console.log("\n4. THE MOVE TAKES EFFECT AT THE START OF THE NEXT SEASON");
  team = (await api("GET", "/team")).data;
  check("the season rolled and he moved, as agreed", !!first && roll1?.jobMove?.to === first.name && team?.name === first.name, roll1?.jobMove?.why);
  const save = q(`SELECT * FROM career_saves WHERE id = ?`, cid)[0];
  check("same career, same manager, no 'seeking a club' state", save.team_id === team.id && save.manager_name === "Rob Bonner" && save.retired_at == null && save.seeking_club_since == null);
  check("his achievements and level came with him", q(`SELECT COUNT(*) AS n FROM achievements WHERE team_id = ?`, team.id)[0].n >= achBefore && q(`SELECT manager_rep_points AS p FROM teams WHERE id = ?`, team.id)[0].p >= 1500, `${achBefore} before, ${q(`SELECT COUNT(*) AS n FROM achievements WHERE team_id = ?`, team.id)[0].n} now (the season's end may add one)`);
  check("with two starters at the new club", q(`SELECT COUNT(*) AS n FROM career_player_state WHERE career_save_id = ? AND team_id = ? AND squad_role = 'starter'`, cid, team.id)[0].n === 2);
  const history = (await api("GET", "/careers/history")).data ?? [];
  check("the Manager History names both clubs", history.some((h) => h.clubName === oldName) && history.some((h) => h.clubName === first?.name && h.type === "joined_club"),
    history.slice(0, 3).map((h) => `${h.type}: ${h.clubName}`).join(" · "));
  const year2 = q(`SELECT year FROM seasons WHERE career_save_id = ? AND status = 'active'`, cid)[0].year;
  const fieldNow = q(`SELECT pool_team_id AS id FROM world_tour_qualifications WHERE career_save_id = ? AND season_year = (SELECT MAX(season_year) FROM world_tour_qualifications WHERE career_save_id = ?)`, cid, cid).map((r) => r.id);
  const inLeague = q(`SELECT is_active_in_league AS a FROM career_pool_team_state WHERE career_save_id = ? AND pool_team_id = ?`, cid, first?.poolTeamId ?? -1)[0]?.a;
  check("the club he took is in no World Tour field nor regional league as an AI club (no club twice)", !!first && !fieldNow.includes(first.poolTeamId) && !inLeague, `${fieldNow.length} in the latest field; it among them: ${fieldNow.includes(first?.poolTeamId)}; in a regional league: ${inLeague}`);

  console.log("\n5. HIS OWN BOARD SACKS HIM AFTER TWO FAILED SEASONS");
  // Planted: last season failed at this club.
  w(`UPDATE board_seasons SET grade = 'failed', team_id = ? WHERE career_save_id = ? AND season_year = ?`, team.id, cid, year2 - 1);
  w(`UPDATE teams SET manager_rep_points = 0 WHERE id = ?`, team.id);
  const win2 = await toWindow();
  // And this season, a failed one (the board's review of it, planted).
  w(`UPDATE board_seasons SET strength_rank = 1, grade = 'failed', projected_grade = 'failed', outcome = 'sacked', reviewed_on = ? WHERE career_save_id = ? AND season_year = ? AND team_id = ?`, `${year2}-12-31`, cid, year2, team.id);
  const jm2 = (await api("GET", "/job-market")).data;
  check("in the window the board's verdict is announced", !!win2 && /sacks you/.test(jm2?.verdict ?? ""), jm2?.verdict);
  const roll2 = await toRollover();
  const tookIt = roll2?.jobMove;
  team = (await api("GET", "/team")).data;
  check("at the season's start he is sacked", tookIt?.type === "dismissal", JSON.stringify(tookIt)?.slice(0, 200));
  check("with no club he qualifies for, the open club with the lowest rating takes him, and says so",
    !!tookIt?.to && team?.name === tookIt.to && /lowest rating|lowest-rated/.test(tookIt?.why ?? ""), tookIt?.why);

  console.log("\n6. BREAKING THE CONTRACT, AND RETIRING");
  const win3 = await toWindow();
  const b0 = Number((await api("GET", "/team")).data.budget);
  const broke = await api("POST", "/careers/break-contract", {});
  const b1 = Number((await api("GET", "/team")).data.budget);
  check("in the window he can break his contract, and the penalty is paid", !!win3 && broke.status === 200 && broke.data?.leavingAtSeasonEnd === true && Math.round(b0 - b1) === broke.data?.feePaid,
    `HTTP ${broke.status}: ${$(b0)} -> ${$(b1)} (fee ${$(broke.data?.feePaid)})`);
  const retired = await api("POST", "/job-market/retire", {});
  check("and retire: the career ends", retired.status === 200 && q(`SELECT retired_at AS r FROM career_saves WHERE id = ?`, cid)[0].r != null, `HTTP ${retired.status} ${retired.data?.error ?? ""}`);
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  if (child) await stopServer(child);
}
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else fs.rmSync(WORK, { recursive: true, force: true });
process.exit(failures > 0 ? 1 : 0);
