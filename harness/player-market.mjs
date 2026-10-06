/**
 * Overnight brief 30 Sep, items 4-5: a scout costs $1,500 when sent; the
 * report comes from the hired Scout (no Scout, no player scouting).
 *
 * Unity match brief (29 Sep), item 15 — Player Market: prices, scouting and
 * buying blind (Rob's design, 29 Sep).
 *
 * Before: Player Pool cards had no price and "SIGN TO SQUAD" signed in one click
 * (a fixed 6-month deal; the stats were hidden by the page only, the API sent
 * them). Free agents showed every stat and an asking WAGE, and nothing was ever
 * charged for signing anybody. Scouting was instant, free and repeatable.
 *
 * Asserted on a starter-DB copy:
 *   - an unscouted player on the market: a price range, no exact price, rating
 *     and attributes not sent, in "Free Agents";
 *   - no signing without the confirm step (the server refuses, nothing charged);
 *   - two blind signings: each charges a price inside her range, on the ledger,
 *     and reveals her attributes;
 *   - scouting: nothing after 4 game days, everything after exactly 5: exact
 *     price inside the range (the same on every read), attributes, "Player
 *     Pool"; a second scout is refused;
 *   - season end: the report lapses for a player without a club, and she is a
 *     Free Agent again.
 *
 * Usage: node harness/player-market.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healAllSquads } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-player-market-"));
const PORT = 4923;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
const $ = (n) => `$${Math.round(Number(n)).toLocaleString("en-US")}`;
console.log("=".repeat(72));
console.log("  UNITY 15: PLAYER MARKET - PRICES, SCOUTING AND BUYING BLIND");
console.log("=".repeat(72));
if (!fs.existsSync(SERVER)) { console.error(`[player-market] FAILED: ${SERVER} not built.`); process.exit(1); }

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
const dbFile = path.join(WORK, "market.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
function read(q, ...a) { const d = new DatabaseSync(dbFile, { readOnly: true }); try { return d.prepare(q).all(...a); } finally { d.close(); } }

const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "player-market" },
});

try {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  const prof = await api("POST", "/profiles", { name: "Market Test" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", {
    slotNumber: 1, managerName: "Market Test", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0,
  });
  const team = (await api("GET", "/team")).data;
  const teamId = team.id;
  const budget = async () => Number((await api("GET", "/team")).data?.budget);
  const market = async () => (await api("GET", "/players/market-all")).data ?? [];
  const byId = async (id) => (await market()).find((p) => p.id === id);

  // 1. The unscouted card.
  const m0 = await market();
  const free = m0.filter((p) => p.currentTeamId == null && p.age >= 19);
  const unscouted = free.filter((p) => p.status === "free_agent");
  const sample = unscouted[0];
  check("an unscouted free agent: a price range, no exact price, attributes not sent",
    unscouted.length > 50 && unscouted.every((p) => p.priceRange?.low > 0 && p.priceRange.high > p.priceRange.low && p.price == null
      && p.revealed === false && [p.speed, p.power, p.defense, p.serve, p.block, p.stamina].every((v) => v == null)),
    `${unscouted.length} free agents; e.g. ${sample?.name}: ${$(sample?.priceRange?.low)} - ${$(sample?.priceRange?.high)}, speed ${sample?.speed}`);
  check("the market has no \"Available\" tab and no one-click pool signing any more",
    !/id: "available"/.test(fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/pages/players.tsx"), "utf8"))
    && !fs.existsSync(path.join(REPO, "artifacts/api-server/src/routes/draft.ts")) && (await api("POST", "/draft/pick", { draftPlayerId: sample.id })).status === 404);
  const again = await byId(sample.id);
  check("her range is the same on every read (not re-rolled)", again.priceRange.low === sample.priceRange.low && again.priceRange.high === sample.priceRange.high);

  // Room for two signings: release the interchange and one Match Player.
  const squad = read(`SELECT player_id AS id, squad_role AS role FROM career_player_state WHERE team_id = ? AND is_active = 1`, teamId);
  for (const p of squad.filter((r) => r.role !== "starter").concat(squad.filter((r) => r.role === "starter").slice(0, 1))) {
    await api("POST", `/players/${p.id}/release`, {});
  }

  // 2. No signing without the confirm step.
  const [X, Y] = unscouted;
  const b0 = await budget();
  const noConfirm = await api("POST", "/contracts", { playerId: X.id, salary: 5000, bonusPerWin: 0, squadRole: "starter", length: "1s" });
  check("signing without confirming the price is refused, and nothing is charged or signed",
    noConfirm.status === 400 && noConfirm.data?.needsConfirm === true && (await budget()) === b0 && (await byId(X.id)).currentTeamId == null,
    `${noConfirm.status}: ${noConfirm.data?.error}`);

  // 3. Two blind signings.
  for (const [P, role] of [[X, "starter"], [Y, "interchange"]]) {
    const before = await budget();
    const r = await api("POST", "/contracts", { playerId: P.id, salary: 5000, bonusPerWin: 0, squadRole: role, length: "1s", confirm: true });
    const after = await budget();
    const ledger = read(`SELECT amount FROM finance_transactions WHERE team_id = ? AND category = 'signing_fee' AND description LIKE ?`, teamId, `%${P.name}%`);
    const now = await byId(P.id);
    check(`blind signing ${P.name}: charged ${$(r.data?.fee)}, inside her range ${$(P.priceRange.low)} - ${$(P.priceRange.high)}, on the ledger`,
      r.status === 201 && r.data.fee >= P.priceRange.low && r.data.fee <= P.priceRange.high && before - after === r.data.fee
      && ledger.length === 1 && Number(ledger[0].amount) === r.data.fee && r.data.signedBlind === true,
      `HTTP ${r.status}, budget ${$(before)} -> ${$(after)}`);
    check(`...and her attributes are revealed`, r.data?.player?.speed > 0 && now?.revealed === true && now?.speed > 0,
      `speed ${r.data?.player?.speed}, power ${r.data?.player?.power}`);
  }

  // 4. Scouting takes exactly 5 game days.
  // Overnight 30 Sep, item 5: only a hired Scout scouts players; a Head Coach
  // or Assistant Coach no longer does.
  const staff = (await api("GET", "/staff")).data ?? [];
  const noScoutYet = !staff.some((s) => /^scout$/i.test(s.role));
  if (noScoutYet) {
    const refused = await api("POST", `/players/${unscouted[6].id}/scout`);
    check("with no Scout hired there is no player scouting, and it says so (no charge)",
      refused.status === 400 && refused.data?.noScout === true && /Hire a Scout/.test(refused.data?.error ?? ""),
      `${refused.status}: ${refused.data?.error}; staff: ${staff.map((s) => s.role).join(", ")}`);
    const offer = ((await api("GET", "/staff/market?role=scout")).data ?? []).find((m) => /scout/i.test(m.role));
    await api("POST", "/staff", { staffId: offer?.id, length: "6m" });
  }
  const myScout = ((await api("GET", "/staff")).data ?? []).find((s) => /^scout$/i.test(s.role));
  const Z = unscouted[5];
  const bScout = await budget();
  const sc = await api("POST", `/players/${Z.id}/scout`);
  check("scouting starts: 5 game days", sc.status === 200 && sc.data?.scouting?.state === "in_progress" && sc.data.scouting.daysLeft === 5,
    `HTTP ${sc.status} ${JSON.stringify(sc.data?.scouting ?? sc.data)}`);
  check("the report comes from the hired Scout, at her scouting rating",
    sc.data?.scoutName === myScout?.name && sc.data?.scoutRating === myScout?.scoutingRating && sc.data?.scoutReportBy === `${myScout?.name} (Scouting ${myScout?.scoutingRating})`
    && (await byId(Z.id))?.scoutReportBy === sc.data?.scoutReportBy,
    `${sc.data?.scoutReportBy}; Scout on staff: ${myScout?.name} (${myScout?.role}, scouting ${myScout?.scoutingRating})`);
  // Overnight 30 Sep, item 4: every scout costs $1,500, charged when sent, on the ledger.
  const scoutLines = ((await api("GET", "/finances")).data ?? []).filter((t) => t.category === "scouting" && t.description === `Scouting: ${Z.name}`);
  check("the scout costs $1,500, charged when sent, one scouting line on the ledger",
    bScout - (await budget()) === 1500 && sc.data?.cost === 1500 && scoutLines.length === 1 && Number(scoutLines[0].amount) === 1500,
    `balance -$${bScout - (await budget())}; ${scoutLines.map((t) => `${t.date} $${t.amount} ${t.description}`).join("; ")}`);
  const second = await api("POST", `/players/${Z.id}/scout`);
  check("a second scout while one is out is refused (no re-roll)", second.status === 409, `${second.status}: ${second.data?.error}`);
  const day = async () => {
    healAllSquads(dbFile);
    const r = await api("POST", "/calendar/advance", {});
    if (r.data?.blocked === "pending_match") { await api("POST", `/matches/${r.data.pendingMatchId}/simulate`); await api("POST", "/calendar/dismiss-match"); return day(); }
    if (r.data?.matchDay?.matchId) { await api("POST", `/matches/${r.data.matchDay.matchId}/simulate`); await api("POST", "/calendar/dismiss-match"); }
    return r;
  };
  for (let i = 0; i < 4; i++) await day();
  const z4 = await byId(Z.id);
  check("after 4 days: still unscouted on her card", z4.revealed === false && z4.speed == null && z4.price == null && z4.status === "free_agent" && z4.scouting?.daysLeft === 1,
    `status ${z4.status}, ${JSON.stringify(z4.scouting)}`);
  await day();
  const z5 = await byId(Z.id), z5b = await byId(Z.id);
  check("after the 5th day: exact price inside her range, attributes shown, in the Player Pool",
    z5.revealed === true && z5.speed > 0 && z5.price >= Z.priceRange.low && z5.price <= Z.priceRange.high && z5.status === "player_pool" && z5b.price === z5.price,
    `price ${$(z5.price)} in ${$(Z.priceRange.low)} - ${$(Z.priceRange.high)}, speed ${z5.speed}, status ${z5.status}`);
  await api("POST", `/players/${Y.id}/release`, {});   // room in the squad
  const scoutedNoConfirm = await api("POST", "/contracts", { playerId: Z.id, salary: 5000, bonusPerWin: 0, squadRole: "interchange", length: "1s" });
  check("a scouted player also needs the confirm step, which names her exact price",
    scoutedNoConfirm.status === 400 && scoutedNoConfirm.data?.price === z5.price, `${scoutedNoConfirm.status}: ${scoutedNoConfirm.data?.error}`);

  // 5. Season end: the report lapses for a player without a club.
  let rolled = false;
  for (let i = 0; i < 700 && !rolled; i++) {
    const r = await day();
    if (r.status >= 400) break;
    if (r.data?.seasonRollover && r.data.seasonRollover.kind !== "none") rolled = true;
  }
  const zNext = await byId(Z.id);
  const mine = await byId(X.id);
  check("season end: her scouting report has lapsed (she is a Free Agent again, attributes hidden)",
    // U-6 (feat-ai-buyable): an AI club may have signed her meanwhile; her report lapses all the same.
    rolled && (zNext == null || (zNext.currentTeamId != null) || (zNext.revealed === false && (zNext.status === "free_agent" || zNext.status === "ai_club") && zNext.scouting?.state === "none")),
    zNext ? `status ${zNext.status}, revealed ${zNext.revealed}, club ${zNext.currentTeamName ?? "none"}` : "retired");
  check("...while a player the club signed stays revealed", mine?.revealed === true || mine?.currentTeamId !== teamId, `${mine?.name}: revealed ${mine?.revealed}`);
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  try { await stopServer(child); } catch { /* stopped */ }
  try { fs.closeSync(out); } catch { /* closed */ }
}
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
