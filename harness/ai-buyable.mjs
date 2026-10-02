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
 *      play (it signed a free agent).
 *   4. An AI club that would be left without two and cannot sign anyone does
 *      not sell, and says why in plain words.
 *   5. The AI clubs buy from each other: a few moves a week at most, every
 *      club between two and three players, and no player moved on again
 *      within the season she joined (no back-and-forth).
 *   6. A whole season played: no AI club is ever short of two.
 *
 * Usage: node harness/ai-buyable.mjs
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
function squadSizes(cid) {
  const sizes = new Map(q(`SELECT pool_team_id AS id FROM career_pool_team_state WHERE career_save_id = ? AND taken_over_at IS NULL`, cid).map((r) => [r.id, 0]));
  for (const r of q(`SELECT ppc.pool_team_id AS id, COUNT(*) AS n FROM pool_player_contracts ppc WHERE ppc.career_save_id = ? AND ppc.status = 'active' GROUP BY ppc.pool_team_id`, cid)) sizes.set(r.id, (sizes.get(r.id) ?? 0) + r.n);
  for (const r of q(`SELECT cps.pool_team_id AS id, COUNT(*) AS n FROM career_player_state cps JOIN players p ON p.id = cps.player_id
      WHERE cps.career_save_id = ? AND cps.pool_team_id IS NOT NULL AND cps.team_id IS NULL AND cps.is_retired = 0
        AND (p.player_type = 'senior' OR cps.is_promoted = 1) GROUP BY cps.pool_team_id`, cid)) sizes.set(r.id, (sizes.get(r.id) ?? 0) + r.n);
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
  await api("POST", "/careers", { slotNumber: 1, managerName: "AI Buyable", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  const team = (await api("GET", "/team")).data;
  const cid = q(`SELECT id FROM career_saves WHERE team_id = ?`, team.id)[0].id;

  console.log("\n1. THE MARKET LISTS THEM, AND THE WORLD IS UNCHANGED");
  const before = q(`SELECT pool_player_id AS pp, pool_team_id AS club, salary FROM pool_player_contracts WHERE career_save_id = ? AND status = 'active' ORDER BY pool_player_id`, cid);
  const market = (await api("GET", "/players/market-all")).data;
  const ai = market.filter((p) => p.status === "ai_club");
  check("the Player Market lists the AI clubs' seniors, each with her club", ai.length === before.length && ai.every((p) => p.currentTeamName && p.aiClubId),
    `${ai.length} at AI clubs (e.g. ${ai[0]?.name} at ${ai[0]?.currentTeamName})`);
  const after = q(`SELECT cps.pool_player_id AS pp, cps.pool_team_id AS club, cps.salary FROM career_player_state cps WHERE cps.career_save_id = ? AND cps.pool_player_id IS NOT NULL ORDER BY cps.pool_player_id`, cid);
  check("listing them changed nothing: the same players at the same clubs on the same wages",
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
  for (const p of (await api("GET", "/players")).data.filter((p) => p.squadRole === "interchange")) await api("POST", `/players/${p.id}/release`, {});
  const seller = seen.aiClubId;
  const sellerBefore = balanceOf(cid, seller), robBefore = Number((await api("GET", "/team")).data.budget);
  const noConfirm = await api("POST", "/contracts", { playerId: target.id, salary: wage, bonusPerWin: 0, squadRole: "interchange", length: "1s" });
  check("the confirm box first: her price to confirm", noConfirm.status === 400 && noConfirm.data?.needsConfirm && noConfirm.data?.price === seen.price, noConfirm.data?.error);
  const bought = await api("POST", "/contracts", { playerId: target.id, salary: wage, bonusPerWin: 0, squadRole: "interchange", length: "1s", confirm: true });
  check("she signs for this club, as Interchange, on the box's wage and length", bought.status === 201, `HTTP ${bought.status} ${bought.data?.error ?? ""}`);
  const st = q(`SELECT team_id, pool_team_id, salary, squad_role, contract_end_date FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, target.id)[0];
  check("her wage is on this club's books, and she is no longer at the AI club", st.team_id === team.id && st.pool_team_id == null && Math.abs(st.salary - wage) < 0.01 && st.squad_role === "interchange",
    `team ${st.team_id}, wage ${$(st.salary)}, to ${st.contract_end_date}`);
  const fee = bought.data?.fee;
  check("the fee goes to the selling AI club", Math.round(balanceOf(cid, seller) - sellerBefore) === fee, `${seen.currentTeamName}: ${$(sellerBefore)} -> ${$(balanceOf(cid, seller))} (+${$(fee)})`);
  const robAfter = Number((await api("GET", "/team")).data.budget);
  const line = q(`SELECT description, amount FROM finance_transactions WHERE team_id = ? AND category = 'signing_fee' ORDER BY id DESC LIMIT 1`, team.id)[0];
  check("this club pays it, on the ledger", Math.round(robBefore - robAfter) === fee && line?.amount === fee && line.description.includes(seen.currentTeamName), `"${line?.description}" ${$(line?.amount)}`);
  const sz = squadSizes(cid);
  const refill = q(`SELECT p.name FROM career_player_state cps JOIN players p ON p.id = cps.player_id WHERE cps.career_save_id = ? AND cps.pool_team_id = ? AND cps.pool_player_id IS NULL AND cps.team_id IS NULL`, cid, seller);
  check("the AI club still has two to play: it signed a free agent", sz.get(seller) >= 2 && refill.length >= 1, `${seen.currentTeamName}: ${sz.get(seller)} players (signed ${refill.map((r) => r.name).join(", ")})`);

  console.log("\n4. AN AI CLUB THAT CANNOT PLAY WITHOUT HER DOES NOT SELL");
  const poorClub = [...squadSizes(cid)].find(([id, n]) => n === 2 && id !== seller)[0];
  w(`UPDATE career_pool_team_state SET balance = 0 WHERE career_save_id = ? AND pool_team_id = ?`, cid, poorClub);
  const hers = q(`SELECT player_id AS id FROM career_player_state WHERE career_save_id = ? AND pool_team_id = ? AND team_id IS NULL LIMIT 1`, cid, poorClub)[0].id;
  for (const p of (await api("GET", "/players")).data.filter((p) => p.squadRole === "interchange")) await api("POST", `/players/${p.id}/release`, {});
  const refused = await api("POST", "/contracts", { playerId: hers, salary: 10000, bonusPerWin: 0, squadRole: "interchange", length: "1s", confirm: true });
  check("refused, in plain words", refused.status === 409 && /won't sell.*two players/i.test(refused.data?.error ?? ""), `HTTP ${refused.status}: ${refused.data?.error}`);
  check("and she is still at her club", q(`SELECT pool_team_id AS c FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, hers)[0].c === poorClub);
  w(`UPDATE career_pool_team_state SET balance = 500000 WHERE career_save_id = ? AND pool_team_id = ?`, cid, poorClub);

  console.log("\n5. THE AI CLUBS BUY FROM EACH OTHER");
  const clubOf = () => new Map(q(`SELECT player_id AS id, pool_team_id AS c FROM career_player_state WHERE career_save_id = ? AND pool_team_id IS NOT NULL AND team_id IS NULL AND pool_player_id IS NOT NULL`, cid).map((r) => [r.id, r.c]));
  const start = clubOf();
  // Moves by week: counted against the weekly tick they came in (the club's
  // last salary date, which the tick moves on).
  const perWeek = new Map(), timesMoved = new Map();
  let minSize = 99, maxSize = 0, last = start;
  for (let i = 0; i < 70; i++) {
    await day();
    const now = clubOf();
    // A move is from one AI club to another (not a free agent signed to refill).
    const changed = [...now].filter(([id, c]) => last.get(id) != null && last.get(id) !== c);
    for (const [id] of changed) timesMoved.set(id, (timesMoved.get(id) ?? 0) + 1);
    const movedNow = changed.length;
    const tick = q(`SELECT last_salary_date AS t FROM calendar_state WHERE team_id = ?`, team.id)[0]?.t;
    perWeek.set(tick, (perWeek.get(tick) ?? 0) + movedNow);
    for (const n of squadSizes(cid).values()) { minSize = Math.min(minSize, n); maxSize = Math.max(maxSize, n); }
    last = now;
  }
  const movedTotal = [...last].filter(([id, c]) => start.get(id) != null && start.get(id) !== c).length;
  const worstWeek = Math.max(0, ...perWeek.values());
  check("AI clubs bought each other's players over ten weeks", movedTotal > 0, `${movedTotal} players at a different AI club than they started, over ${perWeek.size} weeks (${[...perWeek.values()].join(" ")})`);
  check("a few moves a week at most (two)", worstWeek <= 2, `most in one week: ${worstWeek}`);
  check("no player moved on again within the season she joined", Math.max(0, ...timesMoved.values()) <= 1, `${timesMoved.size} moved, most moves for one player: ${Math.max(0, ...timesMoved.values())}`);
  check("every AI club kept two or three players throughout", minSize >= 2 && maxSize <= 3, `smallest ${minSize}, largest ${maxSize}`);

  console.log("\n6. A WHOLE SEASON: NO AI CLUB LEFT SHORT");
  const year0 = q(`SELECT year FROM seasons WHERE career_save_id = ? AND status = 'active'`, cid)[0]?.year;
  let shortest = 99, steps = 0, rolled = false, lastReply = null;
  // Rob's own side kept fielded and fit, as harness/economy.mjs keeps it, so
  // the calendar is never held up by his squad.
  await keepSideFielded(api);
  await renewExpiringContracts(api);
  for (; steps < 900 && !rolled; steps++) {
    healAllSquads(DB);
    const r = await day();
    lastReply = r.data;
    for (const n of squadSizes(cid).values()) shortest = Math.min(shortest, n);
    if (r.data?.seasonRollover && r.data.seasonRollover.kind !== "none") rolled = true;
  }
  check("the season ran to the next one", rolled, `${steps} steps, ${year0} -> ${q(`SELECT year FROM seasons WHERE career_save_id = ? AND status = 'active'`, cid)[0]?.year}${rolled ? "" : `; last reply ${JSON.stringify(lastReply).slice(0, 200)}`}`);
  check("no AI club was ever short of two", shortest >= 2, `smallest squad seen: ${shortest}`);
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  if (child) await stopServer(child);
}
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else fs.rmSync(WORK, { recursive: true, force: true });
process.exit(failures > 0 ? 1 : 0);
