/**
 * Daytime brief 2 Oct, U-6 ("have a crack", branch feat-ai-buyable): Rob can
 * buy a senior under contract at an AI club, through the same Player Market
 * rules as everyone else.
 *
 * Asserted, on a copy of the starter DB with a new Sydney Riptide career:
 *   1. The market lists the AI clubs' seniors ("ai_club", her club named), and
 *      listing them changed nothing about the world: the same 120 players at
 *      the same 60 clubs on the same wages.
 *   2. Her price is "?" (a range) until scouted ($1,500, 5 game days, by the
 *      hired Scout), exact after, and within one month of her wage ±15%.
 *   3. Bought (confirm box, the contract box's wage and length, Interchange):
 *      the fee goes to the selling AI club's balance, Rob's budget and ledger
 *      pay it, her wage is on Rob's books, and the AI club still has two to
 *      play (it signed a free agent). 1.1.1: a buy is a bid, agreed now and
 *      paid now; she joins on her arrival day (the window, or the day after
 *      her contract ends), and her club refills that day.
 *   4. An AI club that would be left without two and cannot sign anyone does
 *      not sell, and says why in plain words.
 *   5. 1.1.3 (Rob, 25 Oct): the AI clubs trade on the market, not with each
 *      other. Over ten weeks they scout it for next season's places (a club
 *      with a contract ending this season), no AI club bids for another's
 *      player, and every club keeps two or three players.
 *   6. A whole season played: no AI club is ever short of two; and in the
 *      transfer window the AI clubs trade: every club with a contract ending
 *      that season (seen on 6 December) signs a replacement for each place it
 *      has to fill, or records the place open and why. This fails when AI
 *      clubs don't trade (it used to hope for an AI-to-AI bid in ten weeks,
 *      and passed on luck).
 *   7. A club retirement leaves with nobody, no youth and $0 signs the
 *      cheapest free agents on credit at the week's turn; with nobody in the
 *      world to sign, it forfeits and the game goes on (final brief 5 Oct).
 *
 * Usage: node harness/ai-buyable.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healAllSquads, renewExpiringContracts, keepSideFielded, startCareer, makeCapRoom, freeSquadPlace } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-ai-buyable-"));
const DB = path.join(WORK, "save.sqlite");
const PORT = 4945;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
const $ = (n) => "$" + Math.round(Number(n)).toLocaleString("en-US");
console.log("=".repeat(72));
console.log("  DAYTIME 2 OCT, U-6: AI CLUBS' PLAYERS ARE BUYABLE");
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

/** Every AI club's squad size in the career, from the tables (the suite's own reading). */
function squadSizes(cid, includeListed = false) {
  const sizes = new Map(q(`SELECT pool_team_id AS id FROM career_pool_team_state WHERE career_save_id = ? AND taken_over_at IS NULL`, cid).map((r) => [r.id, 0]));
  for (const r of q(`SELECT ppc.pool_team_id AS id, COUNT(*) AS n FROM pool_player_contracts ppc WHERE ppc.career_save_id = ? AND ppc.status = 'active' GROUP BY ppc.pool_team_id`, cid)) sizes.set(r.id, (sizes.get(r.id) ?? 0) + r.n);
  for (const r of q(`SELECT cps.pool_team_id AS id, COUNT(*) AS n FROM career_player_state cps JOIN players p ON p.id = cps.player_id
      WHERE cps.career_save_id = ? AND cps.pool_team_id IS NOT NULL AND cps.team_id IS NULL AND cps.is_retired = 0
        AND (? OR cps.on_injured_list = 0)
        AND (p.player_type = 'senior' OR cps.is_promoted = 1) GROUP BY cps.pool_team_id`, cid, includeListed ? 1 : 0)) sizes.set(r.id, (sizes.get(r.id) ?? 0) + r.n);
  // Night 2 (O-10): a senior on the injured list doesn't hold a place (her cover does), so she isn't counted.
  return sizes;
}
const balanceOf = (cid, poolTeamId) => Number(q(`SELECT balance AS b FROM career_pool_team_state WHERE career_save_id = ? AND pool_team_id = ?`, cid, poolTeamId)[0]?.b);
/** One game day, as harness/economy.mjs plays it: a match that day is simulated. */
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

let child = null;
try {
  fs.copyFileSync(SHIPPED, DB);
  const out = fs.openSync(path.join(WORK, "server.log"), "w");
  child = forkServer({ server: SERVER, electron: ELECTRON, out,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: DB, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "ai-buyable", STARTER_DB_PATH: SHIPPED } });
  for (let i = 0; i < 360; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }

  const prof = await api("POST", "/profiles", { name: "AI Buyable" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
  await startCareer(api, { managerFaceId: 8, slotNumber: 1, managerName: "AI Buyable", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  const team = (await api("GET", "/team")).data;
  const cid = q(`SELECT id FROM career_saves WHERE team_id = ?`, team.id)[0].id;

  console.log("\n1. THE MARKET LISTS THEM, AND THE WORLD IS UNCHANGED");
  // Update 1, item 4b: the Day 1 draft makes the AI clubs' pool players career seniors when the career
  // opens (their pool contracts read "moved", with the club and wage they were on); the AI clubs then
  // fill to three from the free agents.
  const before = q(`SELECT pool_player_id AS pp, pool_team_id AS club, salary FROM pool_player_contracts WHERE career_save_id = ? AND status = 'moved' ORDER BY pool_player_id`, cid);
  const aiSeniorsNow = q(`SELECT COUNT(*) AS n FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.career_save_id = ? AND s.pool_team_id IS NOT NULL AND s.team_id IS NULL AND s.is_retired = 0 AND (p.player_type = 'senior' OR s.is_promoted = 1)`, cid)[0].n;
  const market = (await api("GET", "/players/market-all")).data;
  const ai = market.filter((p) => p.status === "ai_club");
  check("the Player Market lists the AI clubs' seniors, each with her club", ai.length === aiSeniorsNow && ai.every((p) => p.currentTeamName && p.aiClubId),
    `${ai.length} at AI clubs (e.g. ${ai[0]?.name} at ${ai[0]?.currentTeamName})`);
  const after = q(`SELECT cps.pool_player_id AS pp, cps.pool_team_id AS club, cps.salary FROM career_player_state cps WHERE cps.career_save_id = ? AND cps.pool_player_id IS NOT NULL ORDER BY cps.pool_player_id`, cid);
  check("becoming career seniors changed nothing: the same players at the same clubs on the same wages",
    after.length === before.length && after.every((a, i) => a.pp === before[i].pp && a.club === before[i].club && Math.abs(a.salary - before[i].salary) < 0.01),
    `${after.length} of ${before.length}; their pool contracts now read "moved": ${q(`SELECT COUNT(*) AS n FROM pool_player_contracts WHERE career_save_id = ? AND status = 'moved'`, cid)[0].n}`);
  const free = market.filter((p) => p.status === "free_agent" || p.status === "player_pool");
  check("the free agents are still free agents (no AI club's player among them)", free.length > 0 && free.every((p) => p.aiClubId == null), `${free.length} free agents`);

  console.log("\n2. HER PRICE: \"?\" UNTIL SCOUTED, THEN EXACT");
  w(`UPDATE teams SET budget = 5000000 WHERE id = ?`, team.id);
  const target = [...ai].sort((a, b) => (b.priceRange?.high ?? 0) - (a.priceRange?.high ?? 0))[0];
  const wage = q(`SELECT salary FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, target.id)[0].salary;
  check("unscouted: a price range and no exact price", target.priceRange && target.price == null && target.speed == null,
    `${target.name}: ${$(target.priceRange?.low)}-${$(target.priceRange?.high)} (her wage at ${target.currentTeamName} ${$(wage)} a month)`);
  const offer = ((await api("GET", "/staff/market?role=scout")).data ?? []).find((m) => /scout/i.test(m.role));
  await api("POST", "/staff", { staffId: offer.id, length: "1s" });
  const budget0 = Number((await api("GET", "/team")).data.budget);
  const sc = await api("POST", `/players/${target.id}/scout`, {});
  const budget1 = Number((await api("GET", "/team")).data.budget);
  check("scouting her costs $1,500, by the hired Scout", sc.status < 300 && Math.round(budget0 - budget1) === 1500, `HTTP ${sc.status}, ${$(budget0 - budget1)}`);
  for (let i = 0; i < 6; i++) await day();
  const seen = (await api("GET", "/players/market-all")).data.find((p) => p.id === target.id);
  check("five game days later her exact price is known, within one month of her wage ±15%",
    seen?.price != null && seen.price >= wage * 0.85 - 500 && seen.price <= wage * 1.15 + 500, `${$(seen?.price)} against ${$(wage)}`);

  console.log("\n3. BOUGHT FROM HER AI CLUB");
  // 1.1.1 (no dumping): the interchange's place is freed in this suite's own database.
  for (const p of (await api("GET", "/players")).data.filter((p) => p.squadRole === "interchange")) freeSquadPlace(DB, p.id, team.id);
  makeCapRoom(DB, team.id);   // item 4a: room under the cap, which is not this suite's subject
  const seller = seen.aiClubId;
  const sellerBefore = balanceOf(cid, seller), robBefore = Number((await api("GET", "/team")).data.budget);
  const noConfirm = await api("POST", "/contracts", { playerId: target.id, salary: wage, bonusPerWin: 0, squadRole: "interchange", length: "1s" });
  check("the confirm box first: her price to confirm", noConfirm.status === 400 && noConfirm.data?.needsConfirm && noConfirm.data?.price === seen.price, noConfirm.data?.error);
  // 1.1.1: a bid well over her wage, so her club's counter (at most 10% over her worth) can't keep her.
  const offered = Math.round(wage * 1.5);
  const bought = await api("POST", "/contracts", { playerId: target.id, salary: offered, bonusPerWin: 0, squadRole: "interchange", length: "1s", confirm: true });
  check("she agrees to join this club, as Interchange, on the box's wage and length", bought.status === 201 && bought.data?.transfer?.outcome === "agreed",
    `HTTP ${bought.status} ${bought.data?.error ?? ""} ${bought.data?.transfer?.outcome ?? ""}, arrives ${bought.data?.transfer?.arrivesOn}`);
  const fee = bought.data?.fee;
  check("the fee goes to the selling AI club", Math.round(balanceOf(cid, seller) - sellerBefore) === fee, `${seen.currentTeamName}: ${$(sellerBefore)} -> ${$(balanceOf(cid, seller))} (+${$(fee)})`);
  const robAfter = Number((await api("GET", "/team")).data.budget);
  // 1.1.1: a buy from a club is a transfer fee on the buyer's ledger.
  const line = q(`SELECT description, amount FROM finance_transactions WHERE team_id = ? AND category = 'transfer_fee' ORDER BY id DESC LIMIT 1`, team.id)[0];
  check("this club pays it, on the ledger", Math.round(robBefore - robAfter) === fee && line?.amount === fee && line.description.includes(seen.currentTeamName), `"${line?.description}" ${$(line?.amount)}`);
  // Her arrival day brought forward to tomorrow (it is the window, or the day after her contract ends).
  const tomorrow = new Date(`${q(`SELECT "current_date" AS d FROM calendar_state WHERE team_id = ?`, team.id)[0].d}T00:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  w(`UPDATE transfer_deals SET arrives_on = ? WHERE id = ?`, tomorrow.toISOString().slice(0, 10), bought.data?.transfer?.id);
  await day();
  const st = q(`SELECT team_id, pool_team_id, salary, squad_role, contract_end_date FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, target.id)[0];
  check("the day she arrives her wage is on this club's books, and she is no longer at the AI club", st.team_id === team.id && st.pool_team_id == null && Math.abs(st.salary - offered) < 0.01 && st.squad_role === "interchange",
    `team ${st.team_id}, wage ${$(st.salary)}, to ${st.contract_end_date}`);
  const sz = squadSizes(cid);
  const refill = q(`SELECT p.name FROM career_player_state cps JOIN players p ON p.id = cps.player_id WHERE cps.career_save_id = ? AND cps.pool_team_id = ? AND cps.pool_player_id IS NULL AND cps.team_id IS NULL`, cid, seller);
  check("the AI club still has two to play: it signed a free agent", sz.get(seller) >= 2 && refill.length >= 1, `${seen.currentTeamName}: ${sz.get(seller)} players (signed ${refill.map((r) => r.name).join(", ")})`);

  console.log("\n4. AN AI CLUB THAT CANNOT PLAY WITHOUT HER DOES NOT SELL");
  // A club with two seniors on its books (one on the injured list counts: she is still its, utils/aiSquadPolicy.ts canSellTx).
  // 1.1.3 (25 Oct, item 4): AI clubs hold three now, so one with two is rare; with none, one is made here (its third
  // released to the free agents).
  const seniorsAt = (c) => q(`SELECT s.player_id AS id, s.salary FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.pool_team_id = ? AND s.team_id IS NULL AND s.is_retired = 0 AND (p.player_type = 'senior' OR s.is_promoted = 1) ORDER BY s.salary`, cid, c);
  let poorClub = [...squadSizes(cid, true)].find(([id, n]) => n === 2 && id !== seller)?.[0];
  if (poorClub == null) {
    poorClub = [...squadSizes(cid, true)].find(([id, n]) => n === 3 && id !== seller)[0];
    w(`UPDATE career_player_state SET pool_team_id = NULL, contract_end_date = NULL WHERE career_save_id = ? AND player_id = ?`, cid, seniorsAt(poorClub)[0].id);
  }
  w(`UPDATE career_pool_team_state SET balance = 0 WHERE career_save_id = ? AND pool_team_id = ?`, cid, poorClub);
  const her = seniorsAt(poorClub)[0];
  const hers = her.id;
  for (const p of (await api("GET", "/players")).data.filter((p) => p.squadRole === "interchange")) freeSquadPlace(DB, p.id, team.id);
  const refused = await api("POST", "/contracts", { playerId: hers, salary: Math.round(Number(her.salary) * 1.5), bonusPerWin: 0, squadRole: "interchange", length: "1s", confirm: true });
  check("refused, in plain words", refused.status === 409 && /won't sell.*two players/i.test(refused.data?.error ?? ""), `HTTP ${refused.status}: ${refused.data?.error}`);
  check("and she is still at her club", q(`SELECT pool_team_id AS c FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, hers)[0].c === poorClub);
  w(`UPDATE career_pool_team_state SET balance = 500000 WHERE career_save_id = ? AND pool_team_id = ?`, cid, poorClub);

  console.log("\n5. THE AI CLUBS SCOUT THE MARKET, AND DON'T BUY FROM EACH OTHER");
  const clubOf = () => new Map(q(`SELECT player_id AS id, pool_team_id AS c FROM career_player_state WHERE career_save_id = ? AND pool_team_id IS NOT NULL AND team_id IS NULL AND pool_player_id IS NOT NULL`, cid).map((r) => [r.id, r.c]));
  const scoutRows0 = q(`SELECT COUNT(*) AS n FROM ai_market_moves WHERE career_save_id = ? AND kind = 'scout'`, cid)[0].n;
  const start = clubOf();
  // Moves by week: counted against the weekly tick they came in (the club's
  // last salary date, which the tick moves on).
  const perWeek = new Map(), timesMoved = new Map();
  let minSize = 99, maxSize = 0, last = start;
  for (let i = 0; i < 70; i++) {
    // Night 2 (O-10): a club with a fit senior still on its injured list releases its weakest that day
    // to make room, and another club may sign her the same day: a release, not a transfer.
    const releasing = new Set(q(`SELECT pool_team_id AS c FROM career_player_state WHERE career_save_id = ? AND on_injured_list = 1 AND injury_status = 'Healthy' AND pool_team_id IS NOT NULL`, cid).map((r) => r.c));
    // Longer injuries (night 2) mean more seniors out 4+ weeks at renewal, released (4c) and maybe
    // signed by another club the same day: her contract had run out, so that is not a transfer either.
    const endsBefore = new Map(q(`SELECT player_id AS id, contract_end_date AS e FROM career_player_state WHERE career_save_id = ? AND pool_team_id IS NOT NULL`, cid).map((r) => [r.id, r.e]));
    await day();
    const todayNow = q(`SELECT "current_date" AS d FROM calendar_state WHERE team_id = ?`, team.id)[0]?.d;
    const now = clubOf();
    // A move is from one AI club to another (not a free agent signed to refill, nor a release picked up the same day).
    const changed = [...now].filter(([id, c]) => last.get(id) != null && last.get(id) !== c && !releasing.has(last.get(id))
      && !(endsBefore.get(id) != null && endsBefore.get(id) <= todayNow));
    for (const [id] of changed) timesMoved.set(id, (timesMoved.get(id) ?? 0) + 1);
    const movedNow = changed.length;
    const tick = q(`SELECT last_salary_date AS t FROM calendar_state WHERE team_id = ?`, team.id)[0]?.t;
    perWeek.set(tick, (perWeek.get(tick) ?? 0) + movedNow);
    // Night 2 (O-10): "short of two" counts every senior on the books (one on the injured list included);
    // "at most three" counts the seniors holding a place (not one on the list, whose cover holds hers).
    for (const n of squadSizes(cid, true).values()) minSize = Math.min(minSize, n);
    for (const n of squadSizes(cid).values()) maxSize = Math.max(maxSize, n);
    last = now;
  }
  const movedTotal = [...last].filter(([id, c]) => start.get(id) != null && start.get(id) !== c).length;
  // 1.1.3 (Rob, 25 Oct): a club with a contract ending this season scouts the market for next season's places (a free
  // agent, or a player whose contract with another AI club ends and who is not its best).
  const marketScouts = q(`SELECT m.target_pool_team_id AS p, m.target_team_id AS t FROM ai_market_moves m WHERE m.career_save_id = ? AND m.kind = 'scout' ORDER BY m.id`, cid).slice(scoutRows0);
  check("AI clubs scouted the market for next season's places over ten weeks", marketScouts.filter((r) => r.t == null).length > 0,
    `${marketScouts.length} reports (${marketScouts.filter((r) => r.t == null && r.p == null).length} on free agents, ${marketScouts.filter((r) => r.p != null).length} on players leaving other AI clubs)`);
  const aiDeals = q(`SELECT COUNT(*) AS n FROM transfer_deals WHERE career_save_id = ? AND from_pool_team_id IS NOT NULL AND to_pool_team_id IS NOT NULL AND COALESCE(squad_role, '') <> 'academy'`, cid)[0].n;
  check("no AI club bid for another AI club's senior (they buy on the market)", aiDeals === 0, `${aiDeals} AI-to-AI senior bids; ${movedTotal} players now at a different AI club (released, and signed off the market), over ${perWeek.size} weeks`);
  check("every AI club kept two or three players throughout", minSize >= 2 && maxSize <= 3, `smallest ${minSize}, largest ${maxSize}`);

  console.log("\n6. A WHOLE SEASON: NO AI CLUB LEFT SHORT");
  const year0 = q(`SELECT year FROM seasons WHERE career_save_id = ? AND status = 'active'`, cid)[0]?.year;
  let shortest = 99, steps = 0, rolled = false, lastReply = null;
  // Rob's own side kept fielded and fit, as harness/economy.mjs keeps it, so
  // the calendar is never held up by his squad.
  await keepSideFielded(api);
  await renewExpiringContracts(api);
  let snap = null;   // 6 December: each AI club's seniors, before the window
  const seniorsNow = () => q(`SELECT s.player_id AS id, s.pool_team_id AS c, s.contract_end_date AS e, s.on_injured_list AS listed FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.pool_team_id IS NOT NULL AND s.team_id IS NULL AND s.is_retired = 0 AND (p.player_type = 'senior' OR s.is_promoted = 1)`, cid);
  for (; steps < 900 && !rolled; steps++) {
    healAllSquads(DB);
    if (q(`SELECT "current_date" AS d FROM calendar_state WHERE team_id = ?`, team.id)[0]?.d === `${year0}-12-06`) snap = seniorsNow();
    const r = await day();
    lastReply = r.data;
    for (const n of squadSizes(cid, true).values()) shortest = Math.min(shortest, n);   // night 2: listed seniors are still on the books
    if (r.data?.seasonRollover && r.data.seasonRollover.kind !== "none") rolled = true;
  }
  check("the season ran to the next one", rolled, `${steps} steps, ${year0} -> ${q(`SELECT year FROM seasons WHERE career_save_id = ? AND status = 'active'`, cid)[0]?.year}${rolled ? "" : `; last reply ${JSON.stringify(lastReply).slice(0, 200)}`}`);
  check("no AI club was ever short of two", shortest >= 2, `smallest squad seen: ${shortest}`);
  // 1.1.3 (Rob, 25 Oct): in the window the AI clubs trade. Each club's contracts ending this season, less the one it
  // renewed, are its leavers; it fills its places for next season (three, less those staying) from the market.
  const moves = q(`SELECT pool_team_id AS c, kind, player_id AS id, on_date AS d FROM ai_market_moves WHERE career_save_id = ? AND season_year = ?`, cid, year0);
  const short = [];
  let leaving = 0, clubsLeaving = 0;
  const snapBy = new Map(); for (const r of snap ?? []) snapBy.set(r.c, [...(snapBy.get(r.c) ?? []), r]);
  for (const [c, l] of snapBy) {
    const renewed = new Set(moves.filter((x) => x.c === c && x.kind === "renew").map((x) => x.id));
    const leavers = l.filter((m) => m.e != null && m.e <= `${year0}-12-31` && !renewed.has(m.id));
    if (leavers.length === 0) continue;
    clubsLeaving++; leaving += leavers.length;
    const staying = l.filter((m) => !m.listed && (m.e == null || m.e > `${year0}-12-31` || renewed.has(m.id))).length;
    const required = Math.min(leavers.length, Math.max(0, 3 - staying));
    const filled = moves.filter((x) => x.c === c && x.d >= `${year0}-12-07` && ["sign", "promote", "refill"].includes(x.kind)).length;
    const open = moves.filter((x) => x.c === c && x.kind.startsWith("open:")).length;
    if (filled + open < required) short.push(`club ${c}: ${leavers.length} leaving, ${required} places, ${filled} filled, ${open} open`);
  }
  const inWindow = (kind) => moves.filter((x) => x.kind === kind && x.d >= `${year0}-12-07`).length;
  check("in the window the AI clubs traded: every club with a contract ending replaced it from the market (or recorded the place open, with why)",
    snap != null && clubsLeaving > 0 && inWindow("sign") > 0 && short.length === 0,
    `${clubsLeaving} clubs, ${leaving} leaving; ${inWindow("sign")} signed from the free agents, ${inWindow("promote")} promoted, ${moves.filter((x) => x.kind.startsWith("open:")).length} places open${short.length ? `; SHORT ${short.slice(0, 5).join("; ")}` : ""}`);

  // Final brief 5 Oct, found by the full harness: in season 20 of a long
  // career retirement left a broke AI club with nobody and no youth, and the
  // regional league stopped the game ("has a club with no rated players").
  console.log("\n7. A CLUB RETIREMENT LEAVES WITH NOBODY");
  const fx = q(`SELECT f.id, f.home_pool_team_id AS h, f.away_pool_team_id AS a FROM regional_league_fixtures f
      JOIN career_pool_team_state s ON s.career_save_id = f.career_save_id AND s.pool_team_id = f.home_pool_team_id AND s.taken_over_at IS NULL
      WHERE f.career_save_id = ? AND f.status = 'scheduled' ORDER BY f.round, f.id LIMIT 1`, cid)[0];
  check("a regional fixture is still to play this season", !!fx, fx ? `fixture ${fx.id}` : "none scheduled");
  const empty = fx.h;
  const emptyName = q(`SELECT team_name AS n FROM continental_pool_teams WHERE id = ?`, empty)[0].n;
  const retireClub = () => {
    w(`UPDATE career_player_state SET is_retired = 1 WHERE career_save_id = ? AND pool_team_id = ? AND team_id IS NULL`, cid, empty);
    w(`UPDATE pool_player_contracts SET status = 'moved' WHERE career_save_id = ? AND pool_team_id = ? AND status = 'active'`, cid, empty);
  };
  retireClub();
  w(`UPDATE career_pool_team_state SET balance = 0 WHERE career_save_id = ? AND pool_team_id = ?`, cid, empty);
  check("set up: every player and youth of the club retired, and its bank at $0", (squadSizes(cid).get(empty) ?? 0) === 0 && balanceOf(cid, empty) === 0, emptyName);
  const tickNow = () => q(`SELECT last_salary_date AS t FROM calendar_state WHERE team_id = ?`, team.id)[0]?.t;
  const tick0 = tickNow();
  let errors = [];
  for (let i = 0; i < 10 && tickNow() === tick0; i++) {
    const r = await day();
    if (r.status >= 400) errors.push(`HTTP ${r.status}`);
  }
  const signedNow = q(`SELECT p.name, cps.salary FROM career_player_state cps JOIN players p ON p.id = cps.player_id
      WHERE cps.career_save_id = ? AND cps.pool_team_id = ? AND cps.team_id IS NULL AND cps.is_retired = 0
        AND (p.player_type = 'senior' OR cps.is_promoted = 1)`, cid, empty);
  check("at the week's turn it has two to play again: it signed the cheapest free agents, on credit", signedNow.length >= 2 && errors.length === 0,
    `${emptyName}: ${signedNow.map((s) => `${s.name} (${$(s.salary)} a month)`).join(", ")}; bank ${$(balanceOf(cid, empty))}${errors.length ? `; ${errors.join(", ")}` : ""}`);

  // Nobody at all to sign: every free agent in the world retired too, every day.
  const retireFreeAgents = () => w(`UPDATE career_player_state SET is_retired = 1 WHERE career_save_id = ? AND team_id IS NULL AND pool_team_id IS NULL
      AND is_retired = 0 AND (is_promoted = 1 OR player_id IN (SELECT id FROM players WHERE player_type = 'senior'))`, cid);
  const wtDoneBefore = new Set(q(`SELECT id FROM world_tour_fixtures WHERE career_save_id = ? AND status = 'completed'`, cid).map((r) => r.id));
  let played = null, wtForfeits = 0, wtOthers = 0;
  errors = [];
  for (let i = 0; i < 200 && !played; i++) {
    retireClub(); retireFreeAgents();
    const r = await day();
    if (r.status >= 400) errors.push(`HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 160)}`);
    played = q(`SELECT f.home_score AS hs, f.away_score AS aws, r.winner_id AS winner FROM regional_league_fixtures f
        LEFT JOIN regional_league_results r ON r.fixture_id = f.id WHERE f.id = ? AND f.status = 'completed'`, fx.id)[0] ?? null;
  }
  check("with nobody in the world to sign, the game goes on (no error on any day)", errors.length === 0, errors.slice(0, 2).join(" | ") || "every day advanced");
  check("its regional match is a forfeit, the other club winning 2-0", played?.hs === 0 && played?.aws === 2 && played?.winner === fx.a,
    played ? `${emptyName} ${played.hs}-${played.aws}` : "not played within 200 days");
  for (const f of q(`SELECT wf.id, wf.home_sets AS hs, wf.away_sets AS aws, hc.pool_team_id AS hp, ac.pool_team_id AS ap FROM world_tour_fixtures wf
      JOIN competitors hc ON hc.id = wf.home_competitor_id JOIN competitors ac ON ac.id = wf.away_competitor_id
      WHERE wf.career_save_id = ? AND wf.status = 'completed' AND (hc.pool_team_id = ? OR ac.pool_team_id = ?)`, cid, empty, empty)) {
    if (wtDoneBefore.has(f.id)) continue;
    if ((f.hp === empty && f.hs === 0 && f.aws === 2) || (f.ap === empty && f.hs === 2 && f.aws === 0)) wtForfeits++; else wtOthers++;
  }
  console.log(`  REPORT  its World Tour matches in that time: ${wtForfeits} forfeit(s), ${wtOthers} other(s)`);
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  if (child) await stopServer(child);
}
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else fs.rmSync(WORK, { recursive: true, force: true });
process.exit(failures > 0 ? 1 : 0);
