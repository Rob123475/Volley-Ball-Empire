/**
 * Update 1, item 4a (Rob, 14 Oct; C-2 to C-5; docs/UPDATE1-SALARY-CAP-BRIEF.md):
 * the salary cap, $60,000 a month of SENIOR wages, one rule for every club.
 *
 *   1. the figure: "Senior wages $X of $60,000" is the sum of the seniors' wages
 *   2. a signing that fits works; one that doesn't is refused, in Rob's words
 *   3. a Contracts Expert's club gets 10% more room (her ask is 10% lower)
 *   4. a renewal re-priced to her rating over the cap is refused, and the
 *      Contracts page says so before it is tried
 *   5. an AI club can't refill past its cap; one that can't fit a renewal lets
 *      her go to the market (and one that can renews her at the new wage)
 *   6. a career loaded over the cap keeps everyone, but can't sign or raise;
 *      a youth promoted into the seniors is never blocked
 *
 * The suite sets wages in its own throwaway database to put a club exactly
 * where a case needs it (harness-club.mjs explains why a harness edits its file).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healAllSquads, startCareer, freeSquadPlace } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-salary-cap-"));
const DB = path.join(WORK, "save.sqlite");
const PORT = 4985;
const BASE = `http://localhost:${PORT}/api`;
const { MONEY, playerWageRise } = await import(pathToFileURL(path.join(REPO, "lib", "db", "src", "schema", "money.ts")).href);
const { overallRating } = await import(pathToFileURL(path.join(REPO, "artifacts", "api-server", "src", "utils", "overallRating.ts")).href);
const MANIFEST = JSON.parse(fs.readFileSync(path.join(REPO, "artifacts", "api-server", "src", "data", "manager-faces.json"), "utf8"));
const CAP = MONEY.salaryCap.monthlyCap;
// utils/clubFinances.ts monthlySalaryFor: the wage for a rating (the AI clubs' rule, and a renewal's).
const monthlySalaryFor = (r) => Math.max(6_500, Math.min(14_500, Math.round((5_224 * r - 257_448) / 12))) + playerWageRise(r);
const $ = (n) => "$" + Math.round(Number(n)).toLocaleString("en-US");
const refusal = (after) => `That takes your wages to ${$(after)}. The cap is ${$(CAP)}. Free up ${$(after - CAP)} first.`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  UPDATE 1, ITEM 4a: THE SALARY CAP");
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
/** The player's seniors on the books (C-2 A), as the database holds them. */
const mySeniors = () => q(`SELECT s.player_id AS id, s.squad_role AS role, s.salary, s.power, s.speed, s.defense, s.serve, s.block, s.stamina FROM career_player_state s JOIN players p ON p.id = s.player_id
  WHERE s.career_save_id = ? AND s.team_id = ? AND s.is_retired = 0 AND (p.player_type = 'senior' OR s.is_promoted = 1)`, cid, teamId);
const setWage = (playerId, wage) => {
  w(`UPDATE career_player_state SET salary = ? WHERE career_save_id = ? AND player_id = ?`, wage, cid, playerId);
  w(`UPDATE contracts SET salary = ? WHERE player_id = ? AND team_id = ? AND status = 'active'`, wage, playerId, teamId);
};
const freeAgents = async () => ((await api("GET", "/players/market-all")).data ?? []).filter((p) => p.status === "free_agent" && p.age >= 19 && p.priceRange);
// Update 1, item 4b: the drafted squad has its interchange; a signing here plays (a starter) unless told otherwise.
const sign = (p, salary = p.salary, squadRole = "starter") => api("POST", "/contracts", { playerId: p.id, salary, bonusPerWin: 0, squadRole, length: "1s", confirm: true });
const lastSalary = () => q(`SELECT last_salary_date AS d FROM calendar_state WHERE team_id = ?`, teamId)[0]?.d;
async function toNextWeek() {
  const was = lastSalary();
  for (let i = 0; i < 10 && lastSalary() === was; i++) {
    healAllSquads(DB);
    const r = await api("POST", "/calendar/advance", {});
    const id = r.data?.blocked === "pending_match" ? r.data.pendingMatchId : r.data?.matchDay?.matchId;
    if (id) { await api("POST", `/matches/${id}/simulate`); await api("POST", r.data?.blocked === "pending_match" ? "/calendar/skip-match" : "/calendar/dismiss-match"); }
  }
  return lastSalary() !== was;
}
/** An AI club's career seniors. */
const aiSquad = (club) => q(`SELECT s.player_id AS id, s.salary, s.contract_end_date AS ends, s.power, s.speed, s.defense, s.serve, s.block, s.stamina FROM career_player_state s JOIN players p ON p.id = s.player_id
  WHERE s.career_save_id = ? AND s.pool_team_id = ? AND s.team_id IS NULL AND s.is_retired = 0 AND (p.player_type = 'senior' OR s.is_promoted = 1)`, cid, club);

let child = null;
try {
  fs.copyFileSync(SHIPPED, DB);
  const out = fs.openSync(path.join(WORK, "server.log"), "w");
  child = forkServer({ server: SERVER, electron: ELECTRON, out,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: DB, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "salary-cap", STARTER_DB_PATH: SHIPPED } });
  for (let i = 0; i < 360; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }

  const prof = await api("POST", "/profiles", { name: "Salary Cap" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? [])[0];
  await startCareer(api, { managerFaceId: 8, slotNumber: 1, managerName: "Salary Cap", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  teamId = (await api("GET", "/team")).data?.id;
  cid = q(`SELECT id FROM career_saves WHERE team_id = ?`, teamId)[0].id;
  w(`UPDATE teams SET budget = 5000000 WHERE id = ?`, teamId);

  // ── 1. The figure ──────────────────────────────────────────────────────────
  console.log("\n1. \"SENIOR WAGES $X OF $60,000\" IS THE SUM OF THE SENIORS' WAGES");
  const view0 = (await api("GET", "/contracts/wage-cap")).data;
  const sum0 = mySeniors().reduce((s, p) => s + Number(p.salary), 0);
  check("the Team and Finances figure is the seniors' wages, against a $60,000 cap, with the room left",
    view0?.seniorWages === Math.round(sum0) && view0?.cap === 60_000 && CAP === 60_000 && view0?.room === Math.max(0, 60_000 - Math.round(sum0)),
    `${$(view0?.seniorWages)} of ${$(view0?.cap)} (${$(view0?.room)} room); database sum ${$(sum0)}`);
  const src = (p) => fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", p), "utf8");
  check("(source) Team, Finances and Contracts show it; the signing box shows the room and won't offer a deal over the cap",
    ["pages/team.tsx", "pages/finances.tsx", "pages/contracts.tsx"].every((p) => /<WageCapLine/.test(src(p)))
      && /disabled=\{isPending \|\| !!overCap\}/.test(src("components/contract-offer-dialog.tsx")));
  // Academy youths, staff and the manager are not in it.
  const youth = q(`SELECT s.player_id AS id FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.career_save_id = ? AND s.team_id = ? AND p.player_type = 'youth' AND s.is_promoted = 0 LIMIT 1`, cid, teamId)[0];
  if (youth) {
    w(`UPDATE career_player_state SET salary = 9999 WHERE career_save_id = ? AND player_id = ?`, cid, youth.id);
    check("an academy youth's wage is not in it (C-2 A)", (await api("GET", "/contracts/wage-cap")).data?.seniorWages === Math.round(sum0));
  }

  // ── 2. A signing that fits, and one that doesn't ───────────────────────────
  console.log("\n2. A SIGNING THAT FITS GOES THROUGH; ONE THAT DOESN'T IS REFUSED");
  // One senior kept, on $30,000; the rest leave (1.1.1, no dumping: freed in this suite's own database).
  const keep = mySeniors().find((p) => p.role === "starter") ?? mySeniors()[0];
  for (const p of mySeniors().filter((x) => x.id !== keep.id)) freeSquadPlace(DB, p.id, teamId);
  setWage(keep.id, 30_000);
  const fas = (await freeAgents()).sort((a, b) => a.salary - b.salary);
  const cheap = fas.find((p) => p.salary <= 20_000);
  const fits = await sign(cheap, cheap.salary, "interchange");
  const billNow = 30_000 + cheap.salary;
  check("a signing that fits under the cap goes through", fits.status === 201 && (await api("GET", "/contracts/wage-cap")).data?.seniorWages === billNow,
    `${cheap.name} at ${$(cheap.salary)}: HTTP ${fits.status} ${fits.data?.error ?? ""}, wages ${$(billNow)}`);
  const dear = fas.find((p) => p.id !== cheap.id && p.salary > CAP - billNow);
  const refused = await sign(dear);
  check("one that doesn't is refused, in Rob's words, and nothing changes",
    refused.status === 422 && refused.data?.error === refusal(billNow + dear.salary) && (await api("GET", "/contracts/wage-cap")).data?.seniorWages === billNow,
    `${dear.name} at ${$(dear.salary)}: "${refused.data?.error}"`);

  // ── 3. A Contracts Expert's 10% ────────────────────────────────────────────
  console.log("\n3. A CONTRACTS EXPERT'S CLUB GETS 10% MORE ROOM");
  // Room set between 90% and 100% of her ask: refused without, signed with.
  const target = fas.find((p) => p.id !== cheap.id && p.id !== dear.id && p.salary >= 15_000);
  setWage(keep.id, CAP - cheap.salary - Math.round(target.salary * 0.95));
  const bill3 = CAP - Math.round(target.salary * 0.95);
  const noCE = await sign(target);
  check("without one: her ask is over the room, refused", noCE.status === 422 && noCE.data?.error === refusal(bill3 + target.salary), `room ${$(CAP - bill3)}, she asks ${$(target.salary)}`);
  w(`UPDATE career_saves SET manager_face_id = ? WHERE id = ?`, MANIFEST.faces.find((f) => f.speciality === "Contracts Expert").id, cid);
  const askCE = ((await freeAgents()).find((p) => p.id === target.id))?.salary;
  const withCE = await sign(target, askCE);
  check("with one: she asks 10% less, it fits, she signs on that wage", askCE === Math.round(target.salary * 0.9) && withCE.status === 201
    && Number(q(`SELECT salary FROM contracts WHERE player_id = ? AND team_id = ? AND status = 'active'`, target.id, teamId)[0]?.salary) === askCE,
    `${$(target.salary)} -> ${$(askCE)}: HTTP ${withCE.status}`);
  w(`UPDATE career_saves SET manager_face_id = 8 WHERE id = ?`, cid);

  // ── 4. A renewal re-priced over the cap ────────────────────────────────────
  console.log("\n4. A RENEWAL ASKS THE WAGE FOR HER RATING NOW; OVER THE CAP IT IS REFUSED");
  const her = mySeniors().find((p) => p.id === keep.id);
  const herAsk = monthlySalaryFor(overallRating(her));
  setWage(her.id, 5_000);                                  // on far less than her rating asks
  // The others' wages set so that her renewal ask takes the club $2,000 over.
  const otherIds = mySeniors().filter((p) => p.id !== her.id).map((p) => p.id);
  for (const id of otherIds.slice(1)) setWage(id, 0);
  setWage(otherIds[0], CAP - herAsk + 2_000);
  const others = mySeniors().filter((p) => p.id !== her.id).reduce((t, p) => t + Number(p.salary), 0);
  const listed = ((await api("GET", "/contracts")).data ?? []).find((c) => c.playerId === her.id);
  const wantAfter = others + herAsk;
  check("the Contracts page shows what she asks to renew and that it breaks the cap, before it is tried",
    listed?.renewal?.wage === herAsk && (wantAfter > CAP ? listed?.renewal?.capRefusal === refusal(wantAfter) : listed?.renewal?.capRefusal === null),
    `asks ${$(listed?.renewal?.wage)} (rating ${overallRating(her)}); ${listed?.renewal?.capRefusal ?? "fits"}`);
  const ren = await api("POST", `/contracts/${listed?.id}/renew`, { length: "1s" });
  check("renewing her is refused with the same words (the wages would be over the cap)", wantAfter > CAP && ren.status === 422 && ren.data?.error === refusal(wantAfter),
    `HTTP ${ren.status} "${ren.data?.error}"`);
  check("an offer below her ask is refused too (rule B)", (await api("POST", `/contracts/${listed?.id}/renew`, { length: "1s", salary: herAsk - 100 })).status === 422);

  // ── 5. AI clubs ────────────────────────────────────────────────────────────
  console.log("\n5. AN AI CLUB OBEYS THE CAP");
  await toNextWeek();   // the AI clubs' players are career seniors now
  const clubs = q(`SELECT pool_team_id AS club FROM career_pool_team_state WHERE career_save_id = ? AND taken_over_at IS NULL ORDER BY pool_team_id`, cid).map((r) => r.club);
  const [X, Y, Z] = clubs.filter((c) => aiSquad(c).length >= 2);
  // X: one senior left, on $55,000: no free agent (the cheapest asks $10,500+) fits.
  const [x1, ...xRest] = aiSquad(X);
  for (const p of xRest) w(`UPDATE career_player_state SET pool_team_id = NULL, contract_end_date = NULL WHERE career_save_id = ? AND player_id = ?`, cid, p.id);
  w(`UPDATE career_player_state SET salary = 55000 WHERE career_save_id = ? AND player_id = ?`, cid, x1.id);
  // Y: its best, out of contract, who no longer fits once re-priced (her club's other wages fill the cap).
  // (1.1.3, Rob 25 Oct: an AI club renews only its best, so the subjects here are each club's best.)
  const best = (club) => [...aiSquad(club)].sort((a, b) => overallRating(b) - overallRating(a) || a.id - b.id);
  const [y1, y2] = best(Y);
  const yAsk = monthlySalaryFor(overallRating(y1));
  w(`UPDATE career_player_state SET contract_end_date = '2026-01-02', salary = 1000 WHERE career_save_id = ? AND player_id = ?`, cid, y1.id);
  w(`UPDATE career_player_state SET salary = ? WHERE career_save_id = ? AND player_id = ?`, CAP - 1000, cid, y2.id);
  // Z: its best, out of contract, who still fits: renewed at the wage for her rating.
  const [z1] = best(Z);
  const zAsk = monthlySalaryFor(overallRating(z1));
  w(`UPDATE career_player_state SET contract_end_date = '2026-01-02' WHERE career_save_id = ? AND player_id = ?`, cid, z1.id);
  for (const p of aiSquad(Z).filter((m) => m.id !== z1.id)) w(`UPDATE career_player_state SET salary = 10000 WHERE career_save_id = ? AND player_id = ?`, cid, p.id);
  await toNextWeek();
  const joinedX = q(`SELECT s.player_id AS id, p.player_type AS type, s.is_promoted AS promoted FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.pool_team_id = ? AND s.team_id IS NULL AND s.player_id <> ?`, cid, X, x1.id).filter((r) => r.type === "senior");
  check("an AI club below two, with no room, signs no free agent (it may only promote its own youth)", joinedX.length === 0, `${joinedX.length} free agents joined club ${X}`);
  const yNow = q(`SELECT pool_team_id AS club, team_id AS team, salary, contract_end_date AS ends FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, y1.id)[0];
  const onMarket = ((await api("GET", "/players/market-all")).data ?? []).find((p) => p.id === y1.id);
  // Item 4c: AI clubs refill to three, so another AI club may sign her at once, on the same wage for her rating.
  check("an AI club that can't fit a renewal (re-priced to her rating) lets her go: a free agent asking that wage (or signed straight away by another AI club on it)",
    yNow.club !== Y && yNow.team == null && Number(yNow.salary) === yAsk
      && (yNow.club == null ? onMarket?.status === "free_agent" : onMarket?.status === "ai_club"),
    `club ${yNow.club}, ${$(yNow.salary)} (rating asks ${$(yAsk)}), market: ${onMarket?.status}`);
  const zNow = q(`SELECT pool_team_id AS club, salary, contract_end_date AS ends FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, z1.id)[0];
  check("one that fits renews, re-priced to the wage for her rating (not her old wage for ever)",
    zNow.club === Z && Number(zNow.salary) === zAsk && zNow.ends > "2026-01-02", `${$(z1.salary)} -> ${$(zNow.salary)}, to ${zNow.ends}`);
  const aiSrc = fs.readFileSync(path.join(REPO, "artifacts", "api-server", "src", "utils", "aiSquads.ts"), "utf8");
  // 1.1.1: an AI club's buy is a bid (utils/aiSquads.ts aiTransfersWeekTx): it must have the fee above its reserve
  // and room under its cap on her arrival date, its weakest's wage gone if it lets her go.
  check("(source) an AI club only bids for a player who fits on her arrival date; refilling picks the best affordable who fits (one picker); selling counts the departing wage",
    /\.filter\(\(\{ fee \}\) => balance >= fee \+ AI_BUY_RESERVE\)/.test(aiSrc)
      // (the weakest's wage counts as gone only if her contract still runs on the arrival date; the soak, 16 Oct)
      && /const freeing = weakest && \(!weakest\.contractEndDate \|\| weakest\.contractEndDate >= arrivesOn\) \? weakest\.salary : 0;/.test(aiSrc)
      // (the soak, 17 Oct: a contract ending before then is room only for a player it can do without; it counts
      // the cheaper way to field two until she comes: its cheapest such players kept, or the cheapest free agents)
      && /const keep = mine\.filter\(\(m\) => m !== weakest && !runsPast\(m\)\)\.sort\(\(a, b\) => a\.salary - b\.salary\)\.slice\(0, Math\.max\(0, AI_MIN_SQUAD - staying\)\);/.test(aiSrc)
      && /SALARY_CAP - \(seniorWageBillTx\(w\.tx, careerSaveId, \{ poolTeamId: buyer \}, arrivesOn, squads\) - freeing \+ Math\.min\(keepCost, fillCost\)\) - wage;\s*if \(room < 0\) continue;/.test(aiSrc)
      // Item 4c: the wage is her asking wage (an injured free agent's is less).
      && /const wage = askingWage\(monthlySalaryFor\(f\.rating\), 1, f\.injuryWeeks\);\s*return balance >= 3 \* wage && fitsUnderCap\(bill, wage\);/.test(aiSrc)
      && (aiSrc.match(/function bestAffordableFreeAgent/g) ?? []).length === 1
      // (1.1.3, Rob 25 Oct: AI clubs no longer buy from each other; the player's buy from an AI club still counts her wage leaving.)
      && /canSellTx\(tx, requireCareerSaveId\(req\.activeCareerSaveId\), aiSeller, aiSellerName!, Number\(player\.salary\)\)/
        .test(fs.readFileSync(path.join(REPO, "artifacts", "api-server", "src", "routes", "contracts.ts"), "utf8")));
  const overAi = clubs.filter((c) => {
    const bill = aiSquad(c).reduce((s, p) => s + Number(p.salary), 0);
    return bill > CAP && !(c === Y);
  });
  console.log(`  INFO  AI clubs over the cap after the week: ${overAi.length} (C-5: a club that started over keeps its players)`);

  // ── 6. Loaded over the cap ─────────────────────────────────────────────────
  console.log("\n6. A CAREER OVER THE CAP KEEPS EVERYONE, BUT CAN'T SIGN OR RAISE");
  const squadIds = mySeniors().map((p) => p.id);
  for (const p of mySeniors()) setWage(p.id, 31_000);   // two or more on $31,000: over $60,000
  const over = (await api("GET", "/contracts/wage-cap")).data;
  check("(set-up) the club is over the cap, and the figure says so", over?.seniorWages > CAP && over?.room === 0, `${$(over?.seniorWages)}`);
  await toNextWeek();
  check("nobody is forced out: every senior is still there a week later", squadIds.every((id) => mySeniors().some((p) => p.id === id)), `${squadIds.length} seniors`);
  const fa6 = (await freeAgents()).sort((a, b) => a.salary - b.salary)[0];
  if (mySeniors().length >= 3) freeSquadPlace(DB, squadIds.at(-1), teamId);   // a squad place for her (1.1.1: no release outside the window)
  const billAfterRelease = mySeniors().reduce((t, p) => t + Number(p.salary), 0);
  const s6 = await sign(fa6);
  check("it can't sign anyone, not even the cheapest free agent, while over", billAfterRelease > CAP && s6.status === 422 && s6.data?.error === refusal(billAfterRelease + fa6.salary),
    `wages ${$(billAfterRelease)}; HTTP ${s6.status} "${s6.data?.error}"`);
  const youth6 = q(`SELECT s.player_id AS id, s.age FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.career_save_id = ? AND s.team_id = ? AND p.player_type = 'youth' AND s.is_promoted = 0 ORDER BY s.age DESC LIMIT 1`, cid, teamId)[0];
  if (youth6) {
    w(`UPDATE career_player_state SET age = 19 WHERE career_save_id = ? AND player_id = ?`, cid, youth6.id);
    if (mySeniors().length >= 3) freeSquadPlace(DB, mySeniors().at(-1).id, teamId);
    const promo = await api("PATCH", `/team/roster/${youth6.id}/role`, { role: "interchange", length: "1s" });
    check("a youth promoted into the seniors is never blocked (she then counts)", promo.status === 200 && mySeniors().some((p) => p.id === youth6.id), `HTTP ${promo.status} ${promo.data?.error ?? ""}`);
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
