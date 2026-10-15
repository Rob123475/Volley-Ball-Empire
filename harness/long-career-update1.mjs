/**
 * Update 1, overnight brief part 10: a long-career soak of the whole update.
 * Not part of run-all (it is long); run by hand:
 *
 *   node harness/long-career-update1.mjs                     5 seasons, Medium
 *   SEASONS=2 DIFFICULTY=easy node harness/long-career-update1.mjs
 *   STAND_INS=1 node harness/long-career-update1.mjs          with 90 stand-in staff (below)
 *
 * Update 1, 15 Oct (day brief part 1): STAND_INS=1 adds 90 staff to the
 * throwaway database before the career starts (25 Head Coach, 25 Assistant
 * Coach, 10 each of Doctor, Physiotherapist, Massage Therapist, Medical
 * Specialist, copied from the existing ones), standing in for the portraits
 * Rob is making, so the Day 8 deal can give every AI club a coach and a medic.
 * The player's club is no longer topped up (keepClubSolvent): its real balance
 * is in the table.
 *
 * A new career through the Day 1 draft (Established), played headless: the
 * player's own club is kept healed, fielded, renewed and solvent (the AI
 * clubs are left alone: their injuries, money and squads are what is being
 * measured), the board never sacks it, and each off-season's pre-season
 * choice is made automatically (a different camp each season, one Rest).
 *
 * At every season's end it prints a table: the AI seniors' average rating and
 * top 5; the player's squad; AI clubs over the cap that added anyone (must be
 * 0); AI clubs with 3 seniors and with their 2 staff; stats outside 1-99; AI
 * injuries and long injuries released to the market; free agents left; the AI
 * clubs' balances (lowest, median, how many broke); the champion. A summary
 * flags anything that runs away. It writes the tables to SOAK_OUT (a JSON file)
 * if given.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { startCareer, keepSideFielded, renewExpiringContracts, addStandInStaff } from "./harness-club.mjs";

const SEASONS = Number(process.env.SEASONS ?? 5);
const DIFFICULTY = process.env.DIFFICULTY ?? "medium";
const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), `vbe-soak-${DIFFICULTY}-`));
const DB = path.join(WORK, "save.sqlite");
const STAND_IN_FROM = JSON.parse(fs.readFileSync(path.join(REPO, "artifacts", "api-server", "src", "data", "staff-ids.json"), "utf8")).starterOnlyFrom;
const PORT = Number(process.env.PORT_OVERRIDE ?? 4995);
const BASE = `http://localhost:${PORT}/api`;
const mod = (p) => import(pathToFileURL(path.join(REPO, "artifacts", "api-server", "src", p)).href);
const { overallRating } = await mod("utils/overallRating.ts");
const { MONEY } = await import(pathToFileURL(path.join(REPO, "lib", "db", "src", "schema", "money.ts")).href);
const CAP = MONEY.salaryCap.monthlyCap;
const COACHING = ["Head Coach", "Assistant Coach"];
const MEDICAL = ["Doctor", "Physiotherapist", "Massage Therapist", "Medical Specialist"];
// A different camp each season, one Rest (season 3).
const PLAN = [{ choice: "camp", location: "altitude" }, { choice: "camp", location: "power_house" }, { choice: "rest" },
  { choice: "camp", location: "beach_academy" }, { choice: "camp", location: "altitude" }, { choice: "camp", location: "power_house" }];

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
const median = (l) => { const s = [...l].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const mean = (l) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : 0);

let cid = null, teamId = null;
const myTeam = () => q(`SELECT team_id AS t FROM career_saves WHERE id = ?`, cid)[0]?.t ?? teamId;
const healMine = () => w(`UPDATE career_player_state SET injury_status = 'Healthy', injury_weeks_remaining = 0, is_injured = 0 WHERE team_id = ?`, myTeam());
const aiSeniors = () => q(`SELECT s.player_id AS id, p.name, s.pool_team_id AS club, s.salary, s.pool_joined_on AS joined, s.age,
    s.is_injured AS inj, s.injury_status AS status, s.injury_weeks_remaining AS weeks, s.on_injured_list AS listed, p.player_type AS ptype,
    s.speed, s.power, s.defense, s.serve, s.block, s.stamina
  FROM career_player_state s JOIN players p ON p.id = s.player_id
  WHERE s.career_save_id = ? AND s.pool_team_id IS NOT NULL AND s.team_id IS NULL AND s.is_retired = 0
    AND (p.player_type = 'senior' OR s.is_promoted = 1)`, cid);
const injured = (s) => s.inj === 1 || (s.status ?? "Healthy") !== "Healthy";

function seasonTable(season, year, counters) {
  const seniors = aiSeniors();
  const rated = seniors.map((s) => ({ ...s, r: overallRating(s) })).sort((a, b) => b.r - a.r);
  const clubs = q(`SELECT pool_team_id AS club, balance, sold_at AS sold FROM career_pool_team_state WHERE career_save_id = ? AND taken_over_at IS NULL`, cid);
  const by = new Map(clubs.map((c) => [c.club, []]));
  for (const s of seniors) by.get(s.club)?.push(s);
  const staff = q(`SELECT s.pool_team_id AS club, st.role FROM career_staff_state s JOIN staff st ON st.id = s.staff_id WHERE s.career_save_id = ? AND s.pool_team_id IS NOT NULL`, cid);
  const staffBy = new Map(); for (const s of staff) staffBy.set(s.club, [...(staffBy.get(s.club) ?? []), s.role]);
  const yearStart = `${year}-01-01`;
  // C-5: a youth promoted into the seniors is never blocked by the cap, so a club's signings are measured
  // without its promoted youths' wages; clubs over the cap only through a promotion are counted on their own.
  const signed = (l) => l.filter((s) => s.ptype === "senior");
  const overCapAdders = [...by.values()].filter((l) => signed(l).reduce((t, s) => t + s.salary, 0) > CAP && signed(l).some((s) => s.joined != null && s.joined >= yearStart)).length;
  const overCapByPromotion = [...by.values()].filter((l) => l.reduce((t, s) => t + s.salary, 0) > CAP && signed(l).reduce((t, s) => t + s.salary, 0) <= CAP).length;
  const outOfRange = q(`SELECT COUNT(*) n FROM career_player_state WHERE career_save_id = ? AND is_retired = 0 AND
    (speed > 99 OR power > 99 OR defense > 99 OR serve > 99 OR block > 99 OR stamina > 99 OR speed < 1 OR power < 1 OR defense < 1 OR serve < 1 OR block < 1 OR stamina < 1)`, cid)[0].n;
  const freeAgents = q(`SELECT COUNT(*) n FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.career_save_id = ? AND s.team_id IS NULL AND s.pool_team_id IS NULL
    AND s.is_retired = 0 AND (p.player_type = 'senior' OR s.is_promoted = 1)`, cid)[0].n;
  const mine = q(`SELECT p.name, s.age, s.speed, s.power, s.defense, s.serve, s.block, s.stamina FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.team_id = ? AND s.is_retired = 0 AND (p.player_type = 'senior' OR s.is_promoted = 1)`, myTeam()).map((p) => `${p.name} ${overallRating(p)} (${p.age})`);
  const balances = clubs.map((c) => Number(c.balance));
  const myBalance = Math.round(Number(q(`SELECT budget FROM teams WHERE id = ?`, myTeam())[0]?.budget ?? 0));
  const standInsAtAiClubs = q(`SELECT COUNT(*) n FROM career_staff_state WHERE career_save_id = ? AND staff_id >= ? AND pool_team_id IS NOT NULL`, cid, STAND_IN_FROM)[0].n;
  const originalsRetired = q(`SELECT COUNT(*) n FROM career_player_state WHERE career_save_id = ? AND pool_player_id IS NOT NULL AND is_retired = 1`, cid)[0].n;
  const champion = q(`SELECT competitor_name AS n FROM season_final_standings WHERE season_year = ? AND rank = 1 LIMIT 1`, year)[0]?.n ?? "?";
  // Night 2 (O-7 to O-10): the season's injuries, every club's, from the one history.
  const inj = q(`SELECT injury, area, weeks_out AS w, reconstruction AS r, team_id AS t, pool_team_id AS c FROM career_injuries WHERE career_save_id = ? AND game_date >= ? AND game_date <= ?`, cid, yearStart, `${year}-12-31`);
  const byType = {}; for (const i of inj) byType[i.injury] = (byType[i.injury] ?? 0) + 1;
  // Weeks out by the club's medical staff at the season's end (the history keeps no staff; an approximation).
  const medicsAt = new Map();
  for (const m of q(`SELECT s.pool_team_id AS c, s.team_id AS t, st.role FROM career_staff_state s JOIN staff st ON st.id = s.staff_id WHERE s.career_save_id = ? AND st.role IN ('Doctor', 'Physiotherapist')`, cid)) {
    const k = m.c != null ? `p${m.c}` : `t${m.t}`; medicsAt.set(k, new Set([...(medicsAt.get(k) ?? []), m.role]));
  }
  const groupOf = (i) => { const k = i.c != null ? `p${i.c}` : i.t != null ? `t${i.t}` : null; const r = k ? medicsAt.get(k) : null; return !r ? "neither" : r.size === 2 ? "both" : "one"; };
  const weeksBy = { both: [], one: [], neither: [] }; for (const i of inj.filter((x) => !x.r)) weeksBy[groupOf(i)].push(i.w);
  const avgWeeks = Object.fromEntries(Object.entries(weeksBy).map(([k, l]) => [k, l.length ? Number(mean(l).toFixed(2)) : null]));
  const injuredListed = inj.filter((i) => i.w > 6 && (i.t != null || i.c != null)).length;
  const listedNow = q(`SELECT COUNT(*) n FROM career_player_state WHERE career_save_id = ? AND on_injured_list = 1`, cid)[0].n;
  const coverPromotions = q(`SELECT COUNT(*) n FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.career_save_id = ? AND s.pool_team_id IS NOT NULL
    AND p.player_type = 'youth' AND s.is_promoted = 1 AND s.pool_joined_on >= ? AND s.pool_joined_on <= ?`, cid, yearStart, `${year}-12-31`)[0].n;
  return {
    season, year,
    aiAvg: Number(mean(rated.map((s) => s.r)).toFixed(1)),
    aiTop5: rated.slice(0, 5).map((s) => `${s.name} ${s.r}`),
    mySquad: mine,
    overCapAdders, overCapByPromotion,
    // Night 2 (O-10): seniors holding a place (one on the injured list doesn't; her cover does).
    clubsWith3: [...by.values()].filter((l) => l.filter((x) => !x.listed).length === 3).length,
    clubsWith2Staff: clubs.filter((c) => { const r = staffBy.get(c.club) ?? []; return r.some((x) => COACHING.includes(x)) && r.some((x) => MEDICAL.includes(x)); }).length,
    clubs: clubs.length,
    outOfRange,
    aiInjuries: counters.injuries, longReleased: counters.longReleased,
    freeAgents,
    balanceLowest: Math.round(Math.min(...balances)), balanceMedian: Math.round(median(balances)), broke: balances.filter((b) => b < 0).length,
    sold: clubs.filter((c) => c.sold != null).length,
    myBalance, originalsRetired, standInsAtAiClubs,
    champion,
    injuriesAll: inj.length, injuriesByType: byType, avgWeeksOut: avgWeeks, reconstructions: inj.filter((i) => i.r).length,
    injuredListed, listedNow, coverPromotions,
  };
}

function printTable(t) {
  console.log(`\n=== Season ${t.season} (${t.year}), ${DIFFICULTY} ===`);
  console.log(`  AI seniors: average rating ${t.aiAvg}; top 5: ${t.aiTop5.join(", ")}`);
  console.log(`  Player's squad: ${t.mySquad.join(", ")}`);
  console.log(`  AI clubs over the cap that signed anyone this season: ${t.overCapAdders} (must be 0); over it only through a promoted youth (C-5, allowed): ${t.overCapByPromotion}`);
  console.log(`  AI clubs with 3 seniors: ${t.clubsWith3} of ${t.clubs}; with a coach and a medic: ${t.clubsWith2Staff} of ${t.clubs}${process.env.STAND_INS ? `; stand-in staff at AI clubs: ${t.standInsAtAiClubs} of 90` : ""}`);
  console.log(`  Stats above 99 or below 1: ${t.outOfRange}`);
  console.log(`  AI injuries this season: ${t.aiInjuries}; long-injured released to the market: ${t.longReleased}`);
  console.log(`  Free agents left: ${t.freeAgents}`);
  console.log(`  AI balances: lowest $${t.balanceLowest.toLocaleString("en-US")}, median $${t.balanceMedian.toLocaleString("en-US")}, ${t.broke} below zero, ${t.sold} sold`);
  console.log(`  Champion (first in the final standings): ${t.champion}`);
  console.log(`  Player's club balance: ${t.myBalance.toLocaleString("en-US")}; AI originals retired so far: ${t.originalsRetired}`);
  console.log(`  Injuries (every club): ${t.injuriesAll}; by type: ${Object.entries(t.injuriesByType).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  console.log(`  Average weeks out (not reconstructions), by the club's doctor and physio: both ${t.avgWeeksOut.both}, one ${t.avgWeeksOut.one}, neither ${t.avgWeeksOut.neither}; reconstructions: ${t.reconstructions}`);
  console.log(`  Injured list: ${t.injuredListed} put on it this season, ${t.listedNow} on it now; AI cover promoted from academies this season: ${t.coverPromotions}`);
}

let child = null;
const tables = [];
try {
  fs.copyFileSync(SHIPPED, DB);
  if (process.env.STAND_INS) console.log(`Stand-ins: ${addStandInStaff(DB)} staff added (none once Rob's portraits are in)`);
  const out = fs.openSync(path.join(WORK, "server.log"), "w");
  child = forkServer({ server: SERVER, electron: ELECTRON, out,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: DB, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "soak", STARTER_DB_PATH: SHIPPED } });
  for (let i = 0; i < 360; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }

  const prof = await api("POST", "/profiles", { name: `Soak ${DIFFICULTY}` });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? [])[0];
  await startCareer(api, { managerFaceId: 8, slotNumber: 1, managerName: `Soak ${DIFFICULTY}`, managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", gameDifficulty: DIFFICULTY, primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  teamId = (await api("GET", "/team")).data?.id;
  cid = q(`SELECT id FROM career_saves WHERE team_id = ?`, teamId)[0].id;
  console.log(`Soak: ${SEASONS} seasons, ${DIFFICULTY}, career ${cid}, work ${WORK}`);

  let season = 1, counters = { injuries: 0, longReleased: 0 }, prev = new Map(aiSeniors().map((s) => [s.id, s]));
  let lastTable = null, chosen = 0, stopped = null;
  const started = Date.now();
  for (let i = 0; i < 500 * SEASONS && season <= SEASONS; i++) {
    healMine();
    await keepSideFielded(api);
    await renewExpiringContracts(api);
    const pre = (await api("GET", "/preseason")).data;
    if (pre?.offseason && pre.open) {
      const plan = PLAN[(season - 1) % PLAN.length];
      let body = { choice: plan.choice };
      if (plan.choice === "camp") {
        const len = [...(pre.lengths ?? [])].reverse().find((l) => l.allowed);
        body = len ? { choice: "camp", location: plan.location, length: len.length } : { choice: "skip" };
      }
      const r = await api("POST", "/preseason", body);
      console.log(`  season ${season} pre-season: ${JSON.stringify(body)} -> ${r.status}${r.status >= 400 ? " " + r.data?.error : ""}`);
      chosen++;
    }
    const today = q(`SELECT "current_date" AS d FROM calendar_state WHERE team_id = ?`, myTeam())[0]?.d ?? "";
    if (today.slice(5) >= "12-30") lastTable = seasonTable(season, Number(today.slice(0, 4)), counters);
    const r = await api("POST", "/calendar/advance", {});
    if (r.status >= 400) { stopped = `advance HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 200)}`; break; }
    const id = r.data?.blocked === "pending_match" ? r.data.pendingMatchId : r.data?.matchDay?.matchId;
    if (id) { await api("POST", `/matches/${id}/simulate`); await api("POST", r.data?.blocked === "pending_match" ? "/calendar/skip-match" : "/calendar/dismiss-match"); }
    // AI injuries and long injuries released, from yesterday to today.
    const now = aiSeniors(); const nowMap = new Map(now.map((s) => [s.id, s]));
    for (const s of now) { const p = prev.get(s.id); if (p && injured(s) && (!injured(p) || s.weeks > p.weeks)) counters.injuries++; }
    for (const [id2, p] of prev) {
      if (nowMap.has(id2) || !injured(p) || p.weeks < MONEY.salaryCap.injuredLongWeeks) continue;
      const fa = q(`SELECT team_id AS t, pool_team_id AS c FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, id2)[0];
      if (fa && fa.t == null && fa.c == null) counters.longReleased++;
    }
    prev = nowMap;
    if (r.data?.seasonRollover && r.data.seasonRollover.kind !== "none") {
      const t = lastTable ?? seasonTable(season, Number(today.slice(0, 4)), counters);
      // The season's final standings are written at the rollover, after the table was taken.
      t.champion = q(`SELECT competitor_name AS n FROM season_final_standings WHERE season_year = ? AND rank = 1 LIMIT 1`, t.year)[0]?.n ?? t.champion;
      tables.push(t); printTable(t);
      w(`UPDATE board_seasons SET grade = 'met' WHERE career_save_id = ? AND grade = 'failed'`, cid);
      season++; counters = { injuries: 0, longReleased: 0 }; lastTable = null;
      console.log(`  (${((Date.now() - started) / 60000).toFixed(1)} min so far)`);
    }
  }
  if (stopped) console.log(`STOPPED: ${stopped}`);
  console.log(`\nPre-season choices made: ${chosen}`);

  // ── Flags ────────────────────────────────────────────────────────────────
  const flags = [];
  if (tables.length >= 2) {
    const first = tables[0], last = tables.at(-1);
    if (last.aiAvg >= 90 || last.aiAvg - first.aiAvg >= 8) flags.push(`AI ratings climbing: ${first.aiAvg} -> ${last.aiAvg}`);
    if (first.aiAvg - last.aiAvg >= 8) flags.push(`AI ratings falling: ${first.aiAvg} -> ${last.aiAvg}`);
    if (last.broke >= 20) flags.push(`${last.broke} AI clubs below zero`);
    if (last.freeAgents < 10) flags.push(`the market is nearly empty: ${last.freeAgents} free agents`);
    const champs = new Set(tables.map((t) => t.champion));
    if (tables.length >= 3 && champs.size === 1) flags.push(`the same club won every season: ${[...champs][0]}`);
  }
  if (tables.some((t) => t.overCapAdders > 0)) flags.push("an AI club over the cap added a senior");
  if (tables.some((t) => t.outOfRange > 0)) flags.push("a stat went outside 1-99");
  console.log(`\nFLAGS: ${flags.length ? flags.join("; ") : "none"}`);
  if (process.env.SOAK_OUT) fs.writeFileSync(process.env.SOAK_OUT, JSON.stringify({ difficulty: DIFFICULTY, seasons: SEASONS, stopped, tables, flags }, null, 2));
  console.log(`\nSOAK ${tables.length === SEASONS && !stopped ? "COMPLETE" : "INCOMPLETE"}: ${tables.length} of ${SEASONS} seasons`);
} catch (err) {
  console.log(`SOAK THREW: ${err?.stack ?? err}`);
} finally {
  if (child) await stopServer(child);
}
