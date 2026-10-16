/**
 * Update 1, item 4c (Rob, 14 Oct; docs/UPDATE1-SALARY-CAP-BRIEF.md and the
 * overnight brief parts 1b and 2): AI clubs field a full squad, get injured,
 * and injured players come cheap.
 *
 *   1. after a week every AI club holds 3 seniors, or cannot afford or fit a
 *      third under its cap (each such club is checked: no free agent it could sign)
 *   2. over the first months of a season AI players pick up injuries, at about
 *      the rate the shared roll gives (utils/condition.ts matchInjuryRoll)
 *   3. injured AI players heal on the weekly clock and are not picked: a club
 *      with two of three hurt forfeits its matches (a walkover)
 *   4. an AI Fitness Guru's club runs the roll at x0.8 (source: the one roll)
 *   5. a long-injured AI senior (4+ weeks) at renewal is released, is on the
 *      market at 50% of her wage, and signs at that wage for the whole contract
 *   6. a short injury (under 4 weeks) shows 75%
 *   7. a full AI club may buy a player AI_BUY_GAP better than its weakest
 *      senior, releasing its weakest to the market (source and the week's moves)
 *   8. no AI club that signed anyone is over the cap
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { startCareer, makeCapRoom, freeSquadPlace } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-ai-injuries-"));
const DB = path.join(WORK, "save.sqlite");
const PORT = 4988;
const BASE = `http://localhost:${PORT}/api`;
const SRC = (p) => fs.readFileSync(path.join(REPO, "artifacts", "api-server", "src", p), "utf8");
const mod = (p) => import(pathToFileURL(path.join(REPO, "artifacts", "api-server", "src", p)).href);
const { overallRating } = await mod("utils/overallRating.ts");

const { MONEY, playerWageRise } = await import(pathToFileURL(path.join(REPO, "lib", "db", "src", "schema", "money.ts")).href);
const CAP = MONEY.salaryCap.monthlyCap;
const LONG_WEEKS = MONEY.salaryCap.injuredLongWeeks;
// utils/clubFinances.ts monthlySalaryFor: the wage for a rating (the AI clubs' rule), as harness/salary-cap.mjs states it.
const monthlySalaryFor = (r) => Math.max(6_500, Math.min(14_500, Math.round((5_224 * r - 257_448) / 12))) + playerWageRise(r);

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
const info = (s) => console.log(`  INFO  ${s}`);
console.log("=".repeat(72));
console.log("  UPDATE 1, ITEM 4c: AI CLUBS FIELD THREE, GET INJURED, AND INJURED PLAYERS COME CHEAP");
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
const lastSalary = () => q(`SELECT last_salary_date AS d FROM calendar_state WHERE team_id = ?`, teamId)[0]?.d;
/** Only the player's own club is healed (harness-club's healAllSquads would heal the AI clubs too). */
const healMine = () => w(`UPDATE career_player_state SET injury_status = 'Healthy', injury_weeks_remaining = 0, is_injured = 0 WHERE team_id = ?`, teamId);
async function day() {
  healMine();
  const r = await api("POST", "/calendar/advance", {});
  const id = r.data?.blocked === "pending_match" ? r.data.pendingMatchId : r.data?.matchDay?.matchId;
  if (id) { await api("POST", `/matches/${id}/simulate`); await api("POST", r.data?.blocked === "pending_match" ? "/calendar/skip-match" : "/calendar/dismiss-match"); }
  return r;
}
async function toNextWeek() {
  const was = lastSalary();
  for (let i = 0; i < 10 && lastSalary() === was; i++) await day();
}
/** Every AI club's seniors (career players; by now every pool player is one). */
const aiSeniors = () => q(`SELECT s.player_id AS id, s.pool_team_id AS club, s.salary, s.contract_end_date AS ends, s.pool_joined_on AS joined,
    s.is_injured AS inj, s.injury_status AS status, s.injury_weeks_remaining AS weeks, s.injury_base_weeks_left AS base,
    (p.player_type = 'youth' AND s.is_promoted = 1) AS promotedYouth,
    s.speed, s.power, s.defense, s.serve, s.block, s.stamina
  FROM career_player_state s JOIN players p ON p.id = s.player_id
  WHERE s.career_save_id = ? AND s.pool_team_id IS NOT NULL AND s.team_id IS NULL AND s.is_retired = 0
    AND (p.player_type = 'senior' OR s.is_promoted = 1)`, cid);
const injured = (s) => s.inj === 1 || (s.status ?? "Healthy") !== "Healthy";
const clubs = () => q(`SELECT pool_team_id AS club, balance FROM career_pool_team_state WHERE career_save_id = ? AND taken_over_at IS NULL`, cid);
const freeAgents = () => q(`SELECT s.player_id AS id, s.salary, s.is_injured AS inj, s.injury_status AS status, s.injury_weeks_remaining AS weeks,
    s.speed, s.power, s.defense, s.serve, s.block, s.stamina
  FROM career_player_state s JOIN players p ON p.id = s.player_id
  WHERE s.career_save_id = ? AND s.team_id IS NULL AND s.pool_team_id IS NULL AND s.is_retired = 0
    AND (p.player_type = 'senior' OR s.is_promoted = 1)`, cid);

let child = null;
try {
  fs.copyFileSync(SHIPPED, DB);
  const out = fs.openSync(path.join(WORK, "server.log"), "w");
  child = forkServer({ server: SERVER, electron: ELECTRON, out,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: DB, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "ai-injuries", STARTER_DB_PATH: SHIPPED } });
  for (let i = 0; i < 360; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }

  const prof = await api("POST", "/profiles", { name: "AI Injuries" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? [])[0];
  await startCareer(api, { managerFaceId: 8, slotNumber: 1, managerName: "AI Injuries", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  teamId = (await api("GET", "/team")).data?.id;
  cid = q(`SELECT id FROM career_saves WHERE team_id = ?`, teamId)[0].id;

  // ── 1. Three seniors ───────────────────────────────────────────────────────
  console.log("\n1. AFTER A WEEK EVERY AI CLUB HOLDS 3 SENIORS, OR CANNOT AFFORD OR FIT ONE MORE");
  await toNextWeek();
  {
    const by = new Map(clubs().map((c) => [c.club, { ...c, squad: [] }]));
    for (const s of aiSeniors()) by.get(s.club)?.squad.push(s);
    const three = [...by.values()].filter((c) => c.squad.length === 3);
    const over = [...by.values()].filter((c) => c.squad.length > 3);
    const short = [...by.values()].filter((c) => c.squad.length < 3);
    const fas = freeAgents().filter((f) => !injured(f));
    const explained = short.filter((c) => {
      const bill = c.squad.reduce((t, s) => t + s.salary, 0);
      return c.squad.length >= 2 && !fas.some((f) => { const wage = monthlySalaryFor(overallRating(f)); return c.balance >= 3 * wage && bill + wage <= CAP; });
    });
    check("no AI club holds more than 3, and every one holds at least 2", over.length === 0 && short.every((c) => c.squad.length >= 2), `${three.length} with 3, ${short.length} with 2`);
    check("each club with only 2 has no fit free agent it can afford (3 months' wage) and fit under the cap", explained.length === short.length,
      `${explained.length} of ${short.length} explained`);
    info(`${short.length} of ${by.size} AI clubs can't take a third senior (the cap or the bank); ${fas.length} fit free agents left`);
  }

  // ── 2 and 3. A few months of matches ───────────────────────────────────────
  console.log("\n2. AI PLAYERS ARE INJURED IN THEIR MATCHES, AT ABOUT THE SHARED ROLL'S RATE");
  // Club X: two of its three hurt for 6 weeks: it must forfeit while they are out.
  const byClub = new Map();
  for (const s of aiSeniors()) byClub.set(s.club, [...(byClub.get(s.club) ?? []), s]);
  const regionalClubs = new Set(q(`SELECT DISTINCT f.home_pool_team_id AS c FROM regional_league_fixtures f WHERE f.career_save_id = ? AND f.status = 'scheduled'`, cid).map((r) => r.c));
  const [xClub, xSquad] = [...byClub.entries()].find(([c, l]) => l.length === 3 && regionalClubs.has(c)) ?? [null, []];
  for (const s of xSquad.slice(0, 2)) w(`UPDATE career_player_state SET is_injured = 1, injury_status = 'Unavailable', injury_weeks_remaining = 6 WHERE career_save_id = ? AND player_id = ?`, cid, s.id);
  const xHurt = new Set(xSquad.slice(0, 2).map((s) => s.id));
  const xResultsBefore = new Set(q(`SELECT r.id FROM regional_league_results r WHERE r.career_save_id = ?`, cid).map((r) => r.id));
  const startDate = today();
  let prev = new Map(aiSeniors().map((s) => [s.id, s]));
  let newInjuries = 0, healedSteps = 0, healChecks = 0, longRelease = 0;
  // A regional walkover is 2-0 in sets and 42-0 in points; anything else was played.
  const regionalPlayedSoFar = () => q(`SELECT COUNT(*) n FROM regional_league_results r
    WHERE r.career_save_id = ? AND NOT ((r.home_sets = 0 OR r.away_sets = 0) AND (r.home_match_points = 0 OR r.away_match_points = 0))`, cid)[0].n;
  const regionalBefore = regionalPlayedSoFar();
  const wtBefore = q(`SELECT COUNT(*) n FROM world_tour_fixtures WHERE career_save_id = ? AND status = 'completed' AND match_id IS NULL`, cid)[0].n;
  for (let i = 0; i < 120; i++) {
    const wasSalary = lastSalary();
    await day();
    const now = aiSeniors();
    const weekTicked = lastSalary() !== wasSalary;
    for (const s of now) {
      const p = prev.get(s.id);
      if (!p) continue;
      if (injured(s) && (!injured(p) || s.weeks > p.weeks)) newInjuries++;
      // Night 2 (O-7): her weeks out follow her club's medical staff live (a medic off ill puts them up),
      // so the clock is her base weeks still to heal: each week it falls, or she is fit.
      if (weekTicked && injured(p) && !xHurt.has(s.id)) { healChecks++; if (!injured(s) || s.base < p.base || (p.base === 0 && s.weeks < p.weeks)) healedSteps++; }
    }
    prev = new Map(now.map((s) => [s.id, s]));
  }
  const regionalPlayed = regionalPlayedSoFar() - regionalBefore;
  const wtPlayed = q(`SELECT COUNT(*) n FROM world_tour_fixtures WHERE career_save_id = ? AND status = 'completed' AND match_id IS NULL`, cid)[0].n - wtBefore;
  const playerMatches = 4 * (regionalPlayed + wtPlayed);   // two players a side, two sides
  const rate = playerMatches > 0 ? newInjuries / playerMatches : 0;
  // The shared roll for a fresh AI player: 3% base + (100 - stamina) x 0.04%, x1 weather (regional) or the beach's.
  const stam = [...prev.values()].map((s) => s.stamina);
  const expected = 0.03 + stam.reduce((t, x) => t + (100 - x) / 100 * 0.04, 0) / stam.length;
  check("AI players were injured in their matches", newInjuries > 0, `${newInjuries} injuries in ${playerMatches} player-matches (${regionalPlayed} regional, ${wtPlayed} World Tour), ${startDate} to ${today()}`);
  check("at about the shared roll's rate (between half and double its mean for their stamina)", rate >= expected / 2 && rate <= expected * 2,
    `${(rate * 100).toFixed(2)}% a player-match against ${(expected * 100).toFixed(2)}%`);

  console.log("\n3. INJURED AI PLAYERS HEAL ON THE WEEKLY CLOCK AND ARE NOT PICKED");
  check("each week every injured AI player was nearer fit (her base weeks still to heal fell, at her club's treatment factor)", healChecks > 0 && healedSteps === healChecks, `${healedSteps} of ${healChecks}`);
  const xResults = xClub == null ? [] : q(`SELECT r.id, r.home_sets AS hs, r.away_sets AS as_, f.home_pool_team_id AS home, f.away_pool_team_id AS away, f.round
    FROM regional_league_results r JOIN regional_league_fixtures f ON f.id = r.fixture_id
    WHERE r.career_save_id = ? AND (f.home_pool_team_id = ? OR f.away_pool_team_id = ?) ORDER BY f.round`, cid, xClub, xClub);
  // Only the matches played after the two were hurt (one may already have been played that day).
  const xEarly = xResults.filter((r) => !xResultsBefore.has(r.id)).slice(0, 4);
  check("a club with two of its three out 6 weeks forfeited its next matches (0 sets, a walkover)",
    xEarly.length > 0 && xEarly.every((r) => (r.home === xClub ? r.hs : r.as_) === 0), `${xEarly.map((r) => `${r.hs}-${r.as_}`).join(" ")}`);
  const xNow = aiSeniors().filter((s) => xHurt.has(s.id));
  check("and its two healed on the clock (6 weeks, about 42 days on)", xNow.every((s) => !injured(s) || s.weeks < 6), xNow.map((s) => s.weeks).join(", "));

  // ── 4. Fitness Guru ────────────────────────────────────────────────────────
  console.log("\n4. AN AI FITNESS GURU'S CLUB RUNS THE ROLL AT x0.8");
  const aiSrc = SRC("utils/aiSquads.ts");
  check("(source) the AI roll is the player's roll, with the club's manager's Fitness Guru, and Fitness Guru counts for AI clubs",
    /const fitnessGuru = specialityFactor\(\{ careerSaveId, poolTeamId \}, "Fitness Guru"\);/.test(aiSrc)
      // 15 Oct and night 2: the club's own staff factor (now its sports scientist) rides in the same roll.
      && aiSrc.includes("matchInjuryRoll({ stamina: m.stamina, development: m.development }, { weatherMultiplier, fitnessGuru, staffFactor }, random)")
      && /AI_CLUB_SPECIALITIES: readonly Speciality\[\] = \[[^\]]*"Fitness Guru"/.test(SRC("utils/managerFaces.ts")));

  // ── 5. A long injury at renewal ────────────────────────────────────────────
  console.log("\n5. A LONG-INJURED AI SENIOR AT RENEWAL IS RELEASED, AND ON THE MARKET AT HALF HER WAGE");
  const nowByClub = new Map();
  for (const s of aiSeniors()) nowByClub.set(s.club, [...(nowByClub.get(s.club) ?? []), s]);
  const pick = aiSeniors().find((s) => !injured(s) && nowByClub.get(s.club)?.length === 3);
  w(`UPDATE career_player_state SET is_injured = 1, injury_status = 'Unavailable', injury_weeks_remaining = 6, contract_end_date = ? WHERE career_save_id = ? AND player_id = ?`, "2026-01-02", cid, pick.id);
  await toNextWeek();
  const gone = q(`SELECT team_id AS t, pool_team_id AS p, salary, injury_weeks_remaining AS weeks,
    speed, power, defense, serve, block, stamina FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, pick.id)[0];
  const wage = monthlySalaryFor(overallRating(gone));   // her rating now (the week's AI training ran first)
  // Released, she may be signed at once by another AI club taking the injured gamble (4c-5), at her injured wage.
  const freeNow = gone.t == null && gone.p == null && gone.salary === wage;
  // The gamble (4c-5) may be taken by any AI club with room, her old club included (it released her,
  // then its refill picked the best free agent it could fit: her, at half her wage).
  const gambled = gone.t == null && gone.p != null && gone.salary === Math.round(wage * 0.5);
  check("her club did not renew her: she is a free agent on the wage for her rating, or an AI club took the gamble at half of it",
    freeNow || gambled, `club ${gone.p} (was ${pick.club}), wage ${gone.salary} (rating wage ${wage})`);
  // The market's half wage, on a free agent hurt for 6 weeks.
  const hurtFa = freeAgents().find((f) => !injured(f));
  w(`UPDATE career_player_state SET is_injured = 1, injury_status = 'Unavailable', injury_weeks_remaining = 6 WHERE career_save_id = ? AND player_id = ?`, cid, hurtFa.id);
  const market = (await api("GET", "/players/market-all")).data ?? [];
  const card = market.find((p) => p.id === hurtFa.id);
  check("the Player Market shows an injured free agent (6 weeks out) at 50% of her wage", card && card.salary === Math.round(hurtFa.salary * 0.5) && card.injuryWeeksRemaining >= LONG_WEEKS,
    card ? `asks ${card.salary} of ${hurtFa.salary}, out ${card.injuryWeeksRemaining} weeks` : "not listed");
  makeCapRoom(DB, teamId);
  // A place for her: the player's interchange goes (three seniors is the most a club holds).
  const mine = q(`SELECT s.player_id AS id FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.team_id = ? AND (p.player_type = 'senior' OR s.is_promoted = 1) ORDER BY s.squad_role = 'interchange' DESC`, teamId);
  if (mine.length >= 3) freeSquadPlace(DB, mine[0].id, teamId);   // 1.1.1 (no dumping): freed in this suite's own database
  const lowball = await api("POST", "/contracts", { playerId: market.find((p) => p.status === "free_agent" && !p.isInjured && (p.injuryStatus ?? "Healthy") === "Healthy")?.id, salary: 1, bonusPerWin: 0, squadRole: "interchange", length: "1s", confirm: true });
  check("(a fit free agent still refuses less than her full asking wage)", lowball.status === 422, `${lowball.status}`);
  const signed = await api("POST", "/contracts", { playerId: hurtFa.id, salary: card?.salary, bonusPerWin: 0, squadRole: "interchange", length: "1s", confirm: true });
  const after = q(`SELECT s.salary, c.salary AS contract FROM career_player_state s JOIN contracts c ON c.player_id = s.player_id AND c.status = 'active'
    WHERE s.career_save_id = ? AND s.player_id = ?`, cid, hurtFa.id)[0];
  check("she signs at that wage, and the contract keeps it", signed.status === 201 && after?.salary === card?.salary && after?.contract === card?.salary,
    `${signed.status}: ${after?.salary} / contract ${after?.contract}`);

  // ── 6. A short injury ──────────────────────────────────────────────────────
  console.log("\n6. A SHORT INJURY (UNDER 4 WEEKS) SHOWS 75%");
  const fa = freeAgents().find((f) => !injured(f));
  w(`UPDATE career_player_state SET is_injured = 1, injury_status = 'Minor Injury', injury_weeks_remaining = 2 WHERE career_save_id = ? AND player_id = ?`, cid, fa.id);
  const card2 = ((await api("GET", "/players/market-all")).data ?? []).find((p) => p.id === fa.id);
  check("a free agent out 2 weeks asks 75% of her wage", card2 && card2.salary === Math.round(fa.salary * 0.75), card2 ? `${card2.salary} of ${fa.salary}` : "not listed");
  check("(source) the one asking-wage path takes the share (MONEY.salaryCap.injuredLongWeeks = 4)",
    /injuredLongWeeks: 4/.test(fs.readFileSync(path.join(REPO, "lib", "db", "src", "schema", "money.ts"), "utf8"))
      && /askingWage\(view\.salary, contractsExpert, freeAgentInjuryWeeks\(p\)\)/.test(SRC("routes/players.ts"))
      && /freeAgentInjuryWeeks\(player\)\)/.test(SRC("routes/contracts.ts")));

  // ── 7. A full club buys ────────────────────────────────────────────────────
  console.log("\n7. A FULL AI CLUB MAY BUY, RELEASING ITS WEAKEST");
  check("(source) a full club's bar is its weakest senior + AI_BUY_GAP; she is released when the one it buys arrives; the cap counts her wage gone",
    /const weakest = mine\.length >= AI_MAX_SQUAD \? mine\[mine\.length - 1\]! : null;/.test(aiSrc)
      && /const bar = \(weakest \?\? mine\[AI_MIN_SQUAD - 1\]!\)\.rating \+ AI_BUY_GAP;/.test(aiSrc)
      // 1.1.1: she goes the day the bought player arrives (utils/transfers.ts transfersDayTx -> aiTrimSquadsTx).
      && /const weakest = spare\.shift\(\)!;[\s\S]{0,120}releaseToMarket\(w, careerSaveId, weakest\.id/.test(aiSrc)
      && /else if \(aiBuyers\.size > 0\) aiTrimSquadsTx\(w, careerSaveId, aiBuyers\);/.test(fs.readFileSync(path.join(REPO, "artifacts", "api-server", "src", "utils", "transfers.ts"), "utf8"))
      && /- \(weakest\?\.salary \?\? 0\)/.test(aiSrc));

  // ── 8. The cap ─────────────────────────────────────────────────────────────
  console.log("\n8. NO AI CLUB THAT SIGNED ANYONE IS OVER THE CAP");
  const bills = new Map();
  for (const s of aiSeniors()) bills.set(s.club, [...(bills.get(s.club) ?? []), s]);
  // Night 2 (O-10): a promoted academy youth is never blocked by the cap (C-5), and an AI club now covers an
  // injured-list place from its academy first; so only a club that SIGNED someone else must be under the cap.
  // A club is over the cap by its own signings when its bill without the promoted youths is over it.
  const overSigners = [...bills.entries()].filter(([, l]) => l.filter((s) => !s.promotedYouth).reduce((t, s) => t + s.salary, 0) > CAP && l.some((s) => s.joined != null && !s.promotedYouth));
  const overByPromotion = [...bills.entries()].filter(([, l]) => l.reduce((t, s) => t + s.salary, 0) > CAP && l.some((s) => s.joined != null && s.promotedYouth)).length;
  check("every AI club that signed a senior (not an academy promotion, C-5) is under the cap", overSigners.length === 0,
    `${overSigners.length} over; ${overByPromotion} over through an academy promotion` + overSigners.slice(0, 3).map(([club, l]) =>
      ` | club ${club}: $${l.reduce((t, s) => t + s.salary, 0)} (${l.map((s) => `${s.id}${s.joined ? ` joined ${s.joined}` : ""}${s.promotedYouth ? " promoted" : ""}${injured(s) ? " injured" : ""} $${s.salary}`).join(", ")})`).join(""));
} catch (err) {
  failures++;
  console.log(`  FAIL  the suite threw: ${err?.stack ?? err}`);
} finally {
  if (child) await stopServer(child);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
