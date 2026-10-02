/**
 * Daytime brief 2 Oct, U-3 ("have a crack", branch feat-job-market): a real
 * manager job market.
 *
 * Asserted, on a copy of the starter DB with a new Sydney Riptide career:
 *   1. Every AI club has an AI manager; no job is open at the start.
 *   2. At a season's end the AI boards judge their managers by the player's
 *      board's bands (strength rank in the field, finish): a second failed
 *      season running is a sacking, and the job is vacant, with the reason.
 *      (Every manager is planted on one failed season first, so one season is
 *      enough to see it; the grading itself is the game's.)
 *   3. The Job Market lists the real vacancies: club, rating, budget, tier,
 *      board expectation, and why the job is open.
 *   4. Applying: turned down with the reason when his level is short; offered
 *      the job when it is not; a manager in a job must resign to take it.
 *   5. Taken: the career goes on at the new club (same manager, achievements,
 *      record), with that club's own players and bank balance; the Manager
 *      History names both clubs.
 *   6. A season later the jobs nobody took are filled by new AI managers.
 *   7. Resigning with no vacancy anywhere is refused (he would have nowhere to
 *      go); with one, he is seeking a club; retiring there ends the career.
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

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
const $ = (n) => "$" + Math.round(Number(n)).toLocaleString("en-US");
console.log("=".repeat(72));
console.log("  DAYTIME 2 OCT, U-3: A REAL MANAGER JOB MARKET");
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

/** One game day, as harness/economy.mjs plays it. */
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
/** Play to the season's end (the rollover). */
let lastReply = null;
async function playSeason() {
  await keepSideFielded(api);
  await renewExpiringContracts(api);
  for (let i = 0; i < 900; i++) {
    healAllSquads(DB);
    const r = await day();
    lastReply = { status: r.status, data: r.data };
    if (r.data?.seasonRollover && r.data.seasonRollover.kind !== "none") return r.data.seasonRollover;
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

  console.log("\n2. THE AI BOARDS SACK ON A SECOND FAILED SEASON");
  w(`UPDATE career_pool_team_state SET manager_failed_seasons = 1 WHERE career_save_id = ?`, cid);
  const before = new Map(q(`SELECT pool_team_id AS id, manager_name AS m FROM career_pool_team_state WHERE career_save_id = ?`, cid).map((r) => [r.id, r.m]));
  const year1 = q(`SELECT year FROM seasons WHERE career_save_id = ? AND status = 'active'`, cid)[0].year;
  // The season's World Tour field: the AI clubs with a ranking row for it.
  const fieldOf = (y) => new Set(q(`SELECT c.pool_team_id AS id FROM competitor_rankings r JOIN competitors c ON c.id = r.competitor_id WHERE r.career_save_id = ? AND r.season_year = ? AND c.pool_team_id IS NOT NULL`, cid, y).map((r) => r.id));
  const roll1 = await playSeason();
  const field1 = fieldOf(year1);
  check("season 1 played to its end", !!roll1, roll1?.kind);
  const after = q(`SELECT pool_team_id AS id, manager_name AS m, manager_failed_seasons AS f, vacant_since AS v, vacancy_reason AS why FROM career_pool_team_state WHERE career_save_id = ?`, cid);
  const sacked = after.filter((r) => r.v != null);
  check("AI managers on a second failed season were sacked, with the reason", sacked.length > 0 && sacked.every((r) => r.m == null && /sacked after 2 failed seasons running/.test(r.why ?? "")),
    `${sacked.length} sacked; e.g. "${sacked[0]?.why}"`);
  check("only World Tour clubs are judged: a club outside the field keeps its manager and its count", after.filter((r) => !field1.has(r.id)).every((r) => r.v == null && r.f === 1 && r.m === before.get(r.id)),
    `${after.filter((r) => !field1.has(r.id)).length} clubs outside the field`);
  check("a field club that did not fail starts again from nought", after.filter((r) => field1.has(r.id) && r.v == null).every((r) => r.f === 0),
    `${after.filter((r) => field1.has(r.id) && r.v == null).length} kept their manager`);

  console.log("\n3. THE JOB MARKET LISTS THEM");
  let jm = (await api("GET", "/job-market")).data;
  check("the Job Market lists exactly the real vacancies", jm.vacancies.length === sacked.length && jm.vacancies.every((v) => sacked.some((s) => s.id === v.poolTeamId)),
    `${jm.vacancies.length} listed`);
  const v0 = jm.vacancies[0];
  check("each with club, rating, budget, tier, board expectation and why it is open",
    jm.vacancies.every((v) => v.name && v.rating > 0 && Number.isFinite(v.budget) && v.tier && v.expectation && v.reason),
    `${v0?.name}: rating ${v0?.rating}, ${$(v0?.budget)}, ${v0?.tier}, expects ${v0?.expectation}`);

  console.log("\n4. APPLYING");
  // One club outside this season's World Tour field to take (a planted vacancy
  // when the season's sackings all went to clubs back in the field).
  const year2 = q(`SELECT year FROM seasons WHERE career_save_id = ? AND status = 'active'`, cid)[0].year;
  let target = jm.vacancies.find((v) => !v.inWorldTourNow && v.levelNeeded >= 2);
  let planted = false;
  if (!target) {
    const fieldNow = new Set(q(`SELECT pool_team_id AS id FROM world_tour_qualifications WHERE career_save_id = ? AND season_year = 2`, cid).map((r) => r.id));
    const strong = q(`SELECT s.pool_team_id AS id FROM career_pool_team_state s JOIN continental_pool_teams t ON t.id = s.pool_team_id
      WHERE s.career_save_id = ? AND s.vacant_since IS NULL ORDER BY t.rating DESC`, cid).find((r) => !fieldNow.has(r.id));
    w(`UPDATE career_pool_team_state SET manager_name = NULL, vacant_since = ?, vacancy_reason = 'planted by the suite' WHERE career_save_id = ? AND pool_team_id = ?`, `${year2}-01-01`, cid, strong.id);
    planted = true;
    jm = (await api("GET", "/job-market")).data;
    target = jm.vacancies.find((v) => v.poolTeamId === strong.id);
  }
  w(`UPDATE teams SET manager_rep_points = 0 WHERE id = ?`, team.id);
  const no = await api("POST", "/job-market/apply", { poolTeamId: target.poolTeamId });
  check("turned down, with the reason, when his level is short", no.data?.accepted === false && /turn Rob Bonner down.*Level/.test(no.data?.reason ?? ""), no.data?.reason);
  const noTake = await api("POST", "/job-market/accept", { poolTeamId: target.poolTeamId, resign: true });
  check("and he cannot take it anyway", noTake.status === 409, `HTTP ${noTake.status}`);
  w(`UPDATE teams SET manager_rep_points = 1500 WHERE id = ?`, team.id);
  const yes = await api("POST", "/job-market/apply", { poolTeamId: target.poolTeamId });
  check("offered the job when his level is enough", yes.data?.accepted === true && /offer Rob Bonner the job/.test(yes.data?.reason ?? ""), `${yes.data?.reason}${planted ? " (planted vacancy)" : ""}`);
  const mustResign = await api("POST", "/job-market/accept", { poolTeamId: target.poolTeamId });
  check("a manager in a job must resign to take it", mustResign.status === 409 && mustResign.data?.needsResign === true, mustResign.data?.error);

  console.log("\n5. TAKEN: THE CAREER GOES ON AT THE NEW CLUB");
  const theirs = q(`SELECT player_id AS id FROM career_player_state WHERE career_save_id = ? AND pool_team_id = ? AND team_id IS NULL AND is_retired = 0`, cid, target.poolTeamId).map((r) => r.id);
  const theirBalance = Number(q(`SELECT balance AS b FROM career_pool_team_state WHERE career_save_id = ? AND pool_team_id = ?`, cid, target.poolTeamId)[0].b);
  const achBefore = q(`SELECT COUNT(*) AS n FROM achievements WHERE team_id = ?`, team.id)[0].n;
  const oldName = team.name;
  const took = await api("POST", "/job-market/accept", { poolTeamId: target.poolTeamId, resign: true });
  check("he resigns and takes it", took.status === 201 && took.data?.clubName === target.name, `HTTP ${took.status} ${took.data?.clubName ?? took.data?.error}`);
  team = (await api("GET", "/team")).data;
  const save = q(`SELECT * FROM career_saves WHERE id = ?`, cid)[0];
  check("same career, same manager, now at the new club", save.team_id === team.id && team.name === target.name && save.manager_name === "Rob Bonner" && save.retired_at == null, `${save.manager_name} at ${team.name}`);
  const squad = q(`SELECT player_id AS id, squad_role AS r FROM career_player_state WHERE career_save_id = ? AND team_id = ?`, cid, team.id);
  check("with the club's own players, its academy too", theirs.length > 0 && theirs.every((id) => squad.some((s) => s.id === id)) && squad.filter((s) => s.r === "starter").length === 2,
    `${theirs.length} of theirs (seniors and academy); ${squad.length} in the squad`);
  check("and its own bank balance", Math.abs(Number(team.budget) - Math.round(theirBalance)) <= 1, `${$(team.budget)} (theirs ${$(theirBalance)})`);
  check("his achievements and standing came with him", q(`SELECT COUNT(*) AS n FROM achievements WHERE team_id = ?`, team.id)[0].n === achBefore && q(`SELECT manager_rep_points AS p FROM teams WHERE id = ?`, team.id)[0].p === 1500,
    `${achBefore} achievements`);
  const history = (await api("GET", "/careers/history")).data ?? [];
  check("the Manager History names both clubs", history.some((h) => h.clubName === oldName && h.type === "resignation") && history.some((h) => h.clubName === target.name && h.type === "joined_club"),
    history.slice(0, 3).map((h) => `${h.type}: ${h.clubName}`).join(" · "));

  console.log("\n6. A SEASON LATER, THE JOBS NOBODY TOOK ARE FILLED");
  const openBefore = q(`SELECT pool_team_id AS id FROM career_pool_team_state WHERE career_save_id = ? AND vacant_since IS NOT NULL AND taken_over_at IS NULL AND vacant_since <= ?`, cid, `${year2}-01-01`).map((r) => r.id);
  const roll2 = await playSeason();
  check("season 2 played to its end", !!roll2, roll2?.kind ?? JSON.stringify(lastReply).slice(0, 300));
  const filled = q(`SELECT pool_team_id AS id, manager_name AS m, vacant_since AS v FROM career_pool_team_state WHERE career_save_id = ?`, cid).filter((r) => openBefore.includes(r.id));
  check("each of last season's open jobs has a new AI manager", filled.length === openBefore.length && filled.every((r) => r.m && r.v == null && r.m !== before.get(r.id)),
    filled.slice(0, 3).map((r) => `${before.get(r.id)} -> ${r.m}`).join(", ") || "none open");

  console.log("\n7. RESIGNING, AND RETIRING");
  const openNow = q(`SELECT pool_team_id AS id, vacant_since AS v, vacancy_reason AS r FROM career_pool_team_state WHERE career_save_id = ? AND vacant_since IS NOT NULL AND taken_over_at IS NULL`, cid);
  w(`UPDATE career_pool_team_state SET vacant_since = NULL WHERE career_save_id = ? AND vacant_since IS NOT NULL`, cid);
  const refused = await api("POST", "/careers/resign", {});
  check("resigning with no vacancy anywhere is refused, and says why", refused.status === 409 && /no club has a vacancy/i.test(refused.data?.error ?? ""), refused.data?.error);
  for (const o of openNow) w(`UPDATE career_pool_team_state SET vacant_since = ? WHERE career_save_id = ? AND pool_team_id = ?`, o.v, cid, o.id);
  if (openNow.length === 0) w(`UPDATE career_pool_team_state SET manager_name = NULL, vacant_since = '2099-01-01', vacancy_reason = 'planted by the suite' WHERE career_save_id = ? AND pool_team_id = (SELECT MIN(pool_team_id) FROM career_pool_team_state WHERE career_save_id = ? AND taken_over_at IS NULL)`, cid, cid);
  const resigned = await api("POST", "/careers/resign", {});
  const jm2 = (await api("GET", "/job-market")).data;
  check("with one, resigning leaves him seeking a club, the career going on", resigned.status === 200 && resigned.data?.seekingClub === true && jm2?.seeking === true && jm2.vacancies.length > 0,
    `HTTP ${resigned.status}; seeking ${jm2?.seeking}, ${jm2?.vacancies?.length} vacancies`);
  const retired = await api("POST", "/job-market/retire", {});
  check("retiring there ends the career", retired.status < 300 && q(`SELECT retired_at AS r FROM career_saves WHERE id = ?`, cid)[0].r != null, `HTTP ${retired.status}`);
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  if (child) await stopServer(child);
}
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else fs.rmSync(WORK, { recursive: true, force: true });
process.exit(failures > 0 ? 1 : 0);
