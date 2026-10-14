/**
 * Update 1, overnight brief part 4 (Rob, 14 Oct, B-3): watching players.
 *
 *   1. a star on a card puts her on the Watch list (any club or none); again takes it off
 *   2. an AI club's player can be scouted: 5 days on she is revealed, with one dated report
 *   3. once a report is in she can be scouted again (same price, 5 days); the card keeps the
 *      old report until the new one is in; then two reports, oldest first
 *   4. a second scout while one is out is refused
 *   5. a scouted free agent who moves to an AI club keeps her report
 *   6. (source) lapseMarketScouting and its call are gone
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healAllSquads, startCareer, keepClubSolvent } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-scouting-history-"));
const DB = path.join(WORK, "save.sqlite");
const PORT = 4989;
const BASE = `http://localhost:${PORT}/api`;
const SRC = (p) => fs.readFileSync(path.join(REPO, "artifacts", "api-server", "src", p), "utf8");

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  UPDATE 1, OVERNIGHT PART 4 (B-3): THE WATCH LIST AND SCOUTING HISTORY");
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
async function day() {
  healAllSquads(DB);
  keepClubSolvent(DB, teamId);
  const r = await api("POST", "/calendar/advance", {});
  const id = r.data?.blocked === "pending_match" ? r.data.pendingMatchId : r.data?.matchDay?.matchId;
  if (id) { await api("POST", `/matches/${id}/simulate`); await api("POST", r.data?.blocked === "pending_match" ? "/calendar/skip-match" : "/calendar/dismiss-match"); }
  return r;
}
const market = async () => (await api("GET", "/players/market-all")).data ?? [];
const card = async (id) => (await market()).find((p) => p.id === id);

let child = null;
try {
  fs.copyFileSync(SHIPPED, DB);
  const out = fs.openSync(path.join(WORK, "server.log"), "w");
  child = forkServer({ server: SERVER, electron: ELECTRON, out,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: DB, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "scouting-history", STARTER_DB_PATH: SHIPPED } });
  for (let i = 0; i < 360; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }

  const prof = await api("POST", "/profiles", { name: "Scouting History" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? [])[0];
  await startCareer(api, { managerFaceId: 8, slotNumber: 1, managerName: "Scouting History", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  teamId = (await api("GET", "/team")).data?.id;
  cid = q(`SELECT id FROM career_saves WHERE team_id = ?`, teamId)[0].id;
  const scout = ((await api("GET", "/staff/market")).data ?? []).find((s) => s.role === "Scout");
  const hired = await api("POST", "/staff", { staffId: scout?.id, length: "1s" });
  check("(set-up) a Scout is hired", hired.status === 201, `${hired.status}`);
  await day(); await day();   // the AI clubs' seniors become career players at the first weekly block
  for (let i = 0; i < 8 && !(await market()).some((p) => p.status === "ai_club"); i++) await day();

  // ── 1. The Watch list ──────────────────────────────────────────────────────
  console.log("\n1. A STAR PUTS HER ON THE WATCH LIST");
  let all = await market();
  const aiPlayer = all.find((p) => p.status === "ai_club");
  const freeAgent = all.find((p) => p.status === "free_agent");
  await api("POST", `/players/${aiPlayer.id}/watch`, { watch: true });
  await api("POST", `/players/${freeAgent.id}/watch`, { watch: true });
  const list = (await api("GET", "/watch-list")).data?.playerIds ?? [];
  all = await market();
  check("an AI club's player and a free agent are on the Watch list, and their cards say so",
    list.includes(aiPlayer.id) && list.includes(freeAgent.id) && all.find((p) => p.id === aiPlayer.id)?.watched === true, `${list.length} watched`);
  await api("POST", `/players/${freeAgent.id}/watch`, { watch: false });
  check("the star again takes her off", !((await api("GET", "/watch-list")).data?.playerIds ?? []).includes(freeAgent.id));

  // ── 2. An AI club's player ─────────────────────────────────────────────────
  console.log("\n2. AN AI CLUB'S PLAYER CAN BE SCOUTED");
  const sent = await api("POST", `/players/${aiPlayer.id}/scout`, {});
  check("the scout is sent", sent.status === 200 && sent.data?.rescout === false, `${sent.status} ${sent.data?.error ?? ""}`);
  for (let i = 0; i < 5; i++) await day();
  let c = await card(aiPlayer.id);
  check("5 days on she is revealed, with one dated report (her rating, the scout's potential reading)",
    c?.revealed === true && c?.scoutHistory?.length === 1 && c.scoutHistory[0].rating > 0 && !!c.scoutHistory[0].potential && !!c.scoutHistory[0].on,
    JSON.stringify(c?.scoutHistory));

  // ── 3 and 4. Scout her again ───────────────────────────────────────────────
  console.log("\n3. SCOUT HER AGAIN, SAME PRICE AND 5 DAYS; EVERY REPORT KEPT");
  const before = q(`SELECT budget FROM teams WHERE id = ?`, teamId)[0].budget;
  const again = await api("POST", `/players/${aiPlayer.id}/scout`, {});
  const after = q(`SELECT budget FROM teams WHERE id = ?`, teamId)[0].budget;
  check("a re-scout is allowed once a report is in, for the same price ($1,500)", again.status === 200 && again.data?.rescout === true && Math.round(before - after) === 1500,
    `${again.status}, charged ${Math.round(before - after)}`);
  const twice = await api("POST", `/players/${aiPlayer.id}/scout`, {});
  check("4. a second scout while one is out is refused", twice.status === 409, `${twice.status}`);
  await day();
  c = await card(aiPlayer.id);
  check("while it is out her card keeps the old report (still revealed) and says the new one is coming",
    c?.revealed === true && c?.scoutHistory?.length === 1 && c?.rescouting?.daysLeft > 0, `rescouting ${JSON.stringify(c?.rescouting)}`);
  for (let i = 0; i < 5; i++) await day();
  c = await card(aiPlayer.id);
  check("5 days on there are two reports, oldest first, and the newest is her report",
    c?.scoutHistory?.length === 2 && c.scoutHistory[0].on < c.scoutHistory[1].on && c.rescouting == null
      && c.scoutedPotential === c.scoutHistory[1].potential, JSON.stringify(c?.scoutHistory));

  // ── 5. A moved player ──────────────────────────────────────────────────────
  console.log("\n5. A SCOUTED PLAYER WHO MOVES CLUB KEEPS HER REPORT");
  const fa = (await market()).find((p) => p.status === "free_agent" && p.id !== freeAgent.id);
  await api("POST", `/players/${fa.id}/scout`, {});
  for (let i = 0; i < 5; i++) await day();
  const someClub = q(`SELECT pool_team_id AS c FROM career_pool_team_state WHERE career_save_id = ? AND taken_over_at IS NULL LIMIT 1`, cid)[0].c;
  w(`UPDATE career_player_state SET pool_team_id = ?, contract_end_date = '2027-12-31' WHERE career_save_id = ? AND player_id = ?`, someClub, cid, fa.id);
  c = await card(fa.id);
  check("she is at an AI club now, still revealed, her report still there", c?.status === "ai_club" && c?.revealed === true && c?.scoutHistory?.length === 1,
    `${c?.status}, revealed ${c?.revealed}, ${c?.scoutHistory?.length} report(s)`);
  check("(source) an AI club's signing no longer clears her scouting", !/scoutStartedOn: null, scoutReportBy: null/.test(SRC("utils/aiSquads.ts")));

  // ── 6. No lapse ────────────────────────────────────────────────────────────
  console.log("\n6. REPORTS NO LONGER LAPSE");
  check("(source) lapseMarketScouting is deleted, and the rollover no longer calls it",
    !/lapseMarketScouting/.test(SRC("lib/playerDto.ts")) && !/lapseMarketScouting/.test(SRC("utils/seasonRollover.ts")));
} catch (err) {
  failures++;
  console.log(`  FAIL  the suite threw: ${err?.stack ?? err}`);
} finally {
  if (child) await stopServer(child);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
