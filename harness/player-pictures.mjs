/**
 * Final brief 5 Oct, A4: Rob's new player pictures.
 *
 *   "Add a harness suite proving that every player who should have a picture
 *    has one, none is used twice, and every file exists."
 *
 * Graduating youth (this branch):
 *   1. THE FILES  every picture in the game's list (data/graduatePortraits.ts)
 *      exists, is a WebP, is listed once and is a different picture from every
 *      other (MD5); 21 for Africa and 20 for every other continent.
 *   2. A CAREER   on a copy of the starter DB, a new career:
 *      - the 72 youth on the market keep their flag cards (no picture);
 *      - a youth of the club's academy promoted by hand at 18 is given an
 *        unused picture of her own continent at once, and the Team page sends it;
 *      - at the season boundary, every youth who turns 19 graduates and is
 *        given one of her own continent (the club's own first), none twice;
 *      - when a continent has run out, the graduate keeps her flag card
 *        (nothing reused) and the boundary reports her;
 *      - the database refuses a picture twice in one career (unique index).
 *   3. AT BOOT    an older save is given the table and its adult graduates
 *      their pictures; a second boot changes nothing.
 *   4. AI CLUBS   (this branch) the 120 AI club players: the 96 Rob made
 *      pictures for have them (matched by continent and skin tone), the 24
 *      others keep the card his list names, no card twice, every file there;
 *      the Player Market lists every AI club player with her picture; an
 *      older save gets them at boot.
 *
 * Usage: node harness/player-pictures.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healAllSquads } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const PUBLIC = path.join(REPO, "artifacts", "beach-volleyball", "public");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-player-pictures-"));
const PORT = 4973;
const BASE = `http://localhost:${PORT}/api`;
const TEMPLATE = "/images/players/youth/player_youth_all_01_1783432743064.webp";

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  A4: ROB'S PICTURES FOR GRADUATES");
console.log("=".repeat(72));

// ── 1. The files ─────────────────────────────────────────────────────────────
console.log("\n1. THE FILES");
const LIST_SRC = fs.readFileSync(path.join(REPO, "artifacts/api-server/src/data/graduatePortraits.ts"), "utf8");
const byContinent = {};
for (const m of LIST_SRC.matchAll(/^\s+(\w+): \[\n([\s\S]*?)\n\s+\],/gm)) {
  byContinent[m[1]] = [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}
const all = Object.values(byContinent).flat();
const counts = Object.fromEntries(Object.entries(byContinent).map(([k, v]) => [k, v.length]));
check("six continents; Africa 21 pictures, every other continent 20",
  Object.keys(counts).length === 6 && counts.africa_middle_east === 21 &&
    Object.entries(counts).every(([k, n]) => k === "africa_middle_east" || n === 20),
  JSON.stringify(counts));
check("no picture is listed twice", new Set(all).size === all.length, `${all.length} listed, ${new Set(all).size} different`);
const missing = all.filter((u) => !fs.existsSync(path.join(PUBLIC, u)));
check("every file exists", missing.length === 0, missing.length ? `missing: ${missing.slice(0, 3).join(", ")}` : `${all.length} files under public/`);
const notWebp = all.filter((u) => {
  if (!fs.existsSync(path.join(PUBLIC, u))) return true;
  const b = fs.readFileSync(path.join(PUBLIC, u));
  return b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP" || b.length > 400_000;
});
check("every file is a WebP, cut down for the game (under 400 KB)", notWebp.length === 0, notWebp.slice(0, 3).join(", ") || "all");
const md5s = all.filter((u) => fs.existsSync(path.join(PUBLIC, u)))
  .map((u) => crypto.createHash("md5").update(fs.readFileSync(path.join(PUBLIC, u))).digest("hex"));
check("every picture is a different picture (no two files alike)", new Set(md5s).size === all.length, `${new Set(md5s).size} different of ${all.length}`);
const wrongFolder = Object.entries(byContinent).flatMap(([k, v]) => v.filter((u) => !u.startsWith("/images/players/graduates/")));
check("each continent's pictures are in the graduates folder", wrongFolder.length === 0, wrongFolder.slice(0, 2).join(", ") || "all");

// ── 2. A career ──────────────────────────────────────────────────────────────
const DB = path.join(WORK, "save.sqlite");
fs.copyFileSync(SHIPPED, DB);
const q = (sql, ...a) => { const d = new DatabaseSync(DB, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
const w = (sql, ...a) => { const d = new DatabaseSync(DB); try { return d.prepare(sql).run(...a); } finally { d.close(); } };
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
const boot = (db, out) => forkServer({ server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: db, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "player-pictures", STARTER_DB_PATH: SHIPPED } });
const up = async () => { for (let i = 0; i < 240; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) return true; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); } return false; };
const continentOf = (u) => Object.entries(byContinent).find(([, v]) => v.includes(u))?.[0] ?? null;

let child = null;
try {
  child = boot(DB, fs.openSync(path.join(WORK, "server.log"), "w"));
  if (!(await up())) throw new Error("server never came up");
  console.log("\n2. A CAREER");
  const prof = await api("POST", "/profiles", { name: "Pictures" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", { slotNumber: 1, managerName: "Rob Bonner", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  const team = (await api("GET", "/team")).data;
  const cid = q(`SELECT id FROM career_saves WHERE team_id = ?`, team.id)[0].id;
  const ledger = () => q(`SELECT player_id AS p, image_url AS u, continent AS c FROM career_graduate_portraits WHERE career_save_id = ?`, cid);
  const youthRows = () => q(`SELECT s.player_id AS id, p.name, p.continent, p.nationality, s.age, s.team_id AS t, s.is_promoted AS promoted, p.image_url AS img
    FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.career_save_id = ? AND p.player_type = 'youth' AND s.is_retired = 0`, cid);

  const market = youthRows().filter((y) => !y.promoted);
  check("the 72 youth on the market keep their flag cards (no picture given)",
    market.length === 72 && market.every((y) => y.img === TEMPLATE) && ledger().length === 0,
    `${market.length} youth, ${market.filter((y) => y.img === TEMPLATE).length} on the flag card, ${ledger().length} pictures given`);

  // The club's own academy: one 18-year-old promoted by hand.
  const own = market.find((y) => y.continent === "oceania") ?? market[0];
  w(`UPDATE career_player_state SET team_id = ?, age = 18, academy_contract_years = 2, squad_role = 'reserve', is_active = 0
     WHERE career_save_id = ? AND player_id = ?`, team.id, cid, own.id);
  const promote = await api("PATCH", `/team/roster/${own.id}/role`, { role: "interchange", length: "1s" });
  const mine = ledger().find((r) => r.p === own.id);
  const roster = (await api("GET", "/team/roster")).data ?? {};
  const shown = [...(roster.starters ?? []), ...(roster.interchanges ?? []), ...(roster.reserves ?? [])].find((p) => p.id === own.id);
  check("a youth of the club's academy promoted by hand at 18 is given a picture of her own continent at once",
    promote.status === 200 && !!mine && continentOf(mine.u) === own.continent && mine.c === own.continent,
    `${own.name} (${own.continent}): HTTP ${promote.status}, ${mine?.u ?? "no picture"}`);
  check("and the Team page sends it as her picture", shown?.imageUrl === mine?.u, `${shown?.imageUrl ?? "not on the roster"}`);

  // Running out: all but one of Europe's pictures are planted as given, so the
  // boundary has one left for the Europeans who graduate there.
  const europeAll = byContinent.europe;
  const planted = europeAll.slice(1);
  for (const [i, u] of planted.entries()) {
    w(`INSERT INTO career_graduate_portraits (career_save_id, player_id, image_url, continent, assigned_on, created_at) VALUES (?, ?, ?, 'europe', '2026-01-01', 0)`,
      cid, 900000 + i, u);
  }
  // The boundary's graduates: youth on the market set to 18, so they turn 19 there.
  const toGraduate = market.filter((y) => y.id !== own.id).slice(0, 30);
  const europeans = toGraduate.filter((y) => y.continent === "europe");
  for (const y of toGraduate) w(`UPDATE career_player_state SET age = 18 WHERE career_save_id = ? AND player_id = ?`, cid, y.id);
  // And one of the club's own academy, so the club's own come first.
  const own2 = market.filter((y) => !toGraduate.includes(y) && y.id !== own.id)[0];
  w(`UPDATE career_player_state SET team_id = ?, age = 18, academy_contract_years = 2, squad_role = 'reserve', is_active = 0
     WHERE career_save_id = ? AND player_id = ?`, team.id, cid, own2.id);
  check("(set-up) 31 youth turn 19 at the boundary, Europeans among them",
    toGraduate.length === 30 && europeans.length >= 2, `${europeans.length} Europeans, own academy: ${own2.name} (${own2.continent})`);

  let rolled = null;
  for (let i = 0; i < 600 && !rolled; i++) {
    healAllSquads(DB);
    const r = await api("POST", "/calendar/advance", {});
    if (r.data?.blocked === "pending_match") { await api("POST", `/matches/${r.data.pendingMatchId}/simulate`, {}); await api("POST", "/calendar/skip-match", {}); continue; }
    const mid = r.data?.matchDay?.matchId;
    if (mid) { await api("POST", `/matches/${mid}/simulate`, {}); await api("POST", "/calendar/dismiss-match", {}); }
    if (r.data?.seasonRollover && r.data.seasonRollover.kind !== "none") rolled = r.data.seasonRollover;
  }
  check("the season rolled over", !!rolled);
  const gp = rolled?.graduatePortraits ?? { given: [], ranOut: [] };
  // Every graduate now (the shipped youth who were 18 already graduate too).
  const graduated = youthRows().filter((y) => y.promoted && y.age >= 18);
  const L = ledger().filter((r) => r.p < 900000);
  const has = new Map(L.map((r) => [r.p, r.u]));
  const ranOut = new Set(gp.ranOut.map((r) => r.playerId));
  const nonEuropeans = graduated.filter((y) => y.continent !== "europe");
  check("every graduate of another continent was given a picture of her own continent",
    nonEuropeans.length > 0 && nonEuropeans.every((y) => continentOf(has.get(y.id)) === y.continent),
    `${nonEuropeans.length} graduates; ${nonEuropeans.filter((y) => continentOf(has.get(y.id)) === y.continent).length} with their continent's picture`);
  const euroGrads = graduated.filter((y) => y.continent === "europe");
  const euroGiven = euroGrads.filter((y) => has.has(y.id));
  check("Europe had one picture left: one European graduate got it, the rest keep their flag cards and are reported",
    euroGiven.length === 1 && has.get(euroGiven[0].id) === europeAll[0] &&
      euroGrads.filter((y) => !has.has(y.id)).every((y) => ranOut.has(y.id) && y.img === TEMPLATE),
    `${euroGrads.length} European graduates: ${euroGiven.length} given ${euroGiven.map((y) => has.get(y.id)).join("")}, ${gp.ranOut.length} reported as run out`);
  const ownGot = has.get(own2.id);
  check("the club's own graduate is served first", !!ownGot || (own2.continent === "europe" && euroGiven[0]?.id === own2.id),
    `${own2.name} (${own2.continent}): ${ownGot ?? "none"}`);
  const allGiven = ledger().map((r) => r.u);
  check("no picture is used twice in the career", new Set(allGiven).size === allGiven.length, `${allGiven.length} given, ${new Set(allGiven).size} different`);
  // The shipped youth not yet graduated keep their flag cards; no youth who has
  // not graduated (the new intakes and AI academies included) has a picture.
  const notGraduated = youthRows().filter((y) => !y.promoted);
  const stillMarket = notGraduated.filter((y) => market.some((m) => m.id === y.id));
  check("the youth who have not graduated keep their cards: the shipped ones their flag cards, and none has a picture",
    stillMarket.length > 0 && stillMarket.every((y) => y.img === TEMPLATE) && notGraduated.every((y) => !has.has(y.id)),
    `${stillMarket.length} shipped youth still in the academies or on the market; ${notGraduated.length} youth in all, ${notGraduated.filter((y) => has.has(y.id)).length} with a picture`);
  const dtoMarket = (await api("GET", "/players/market-all?playerType=senior")).data ?? [];
  const aGrad = (Array.isArray(dtoMarket) ? dtoMarket : []).find((p) => has.has(p.id));
  check("a graduate on the market is sent with her picture", !!aGrad && aGrad.imageUrl === has.get(aGrad.id) && aGrad.playerType === "youth" && aGrad.age >= 18,
    aGrad ? `${aGrad.name}, ${aGrad.age}: ${aGrad.imageUrl}` : "no graduate on the market");
  let refused = false;
  try { w(`INSERT INTO career_graduate_portraits (career_save_id, player_id, image_url, continent, assigned_on, created_at) VALUES (?, 999999, ?, 'oceania', '2027-01-01', 0)`, cid, mine?.u); }
  catch (e) { refused = /UNIQUE/i.test(String(e)); }
  check("the database refuses the same picture twice in one career", refused, mine?.u);

  await stopServer(child); child = null;

  // ── 3. At boot ──────────────────────────────────────────────────────────────
  console.log("\n3. AT BOOT, AN OLDER SAVE");
  const OLD = path.join(WORK, "old.sqlite");
  fs.copyFileSync(DB, OLD);
  {
    const d = new DatabaseSync(OLD);
    d.exec(`DROP TABLE career_graduate_portraits`);
    // An adult graduate from before pictures existed.
    d.prepare(`UPDATE career_player_state SET is_promoted = 1, age = 20 WHERE career_save_id = ? AND player_id = ?`).run(cid, stillMarket[0].id);
    d.close();
  }
  child = boot(OLD, fs.openSync(path.join(WORK, "server-old.log"), "w"));
  const booted = await up();
  await stopServer(child); child = null;
  const qo = (sql, ...a) => { const d = new DatabaseSync(OLD, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
  // The table was dropped, so this save has given no pictures yet: every
  // adult graduate in it is owed one of her own continent.
  const rowsOld = booted ? qo(`SELECT player_id AS p, image_url AS u FROM career_graduate_portraits WHERE career_save_id = ?`, cid) : [];
  const gradsOld = qo(`SELECT s.player_id AS id, p.continent AS c FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.is_promoted = 1 AND p.player_type = 'youth' AND s.is_retired = 0 AND s.age >= 18`, cid);
  const oldHas = new Map(rowsOld.map((r) => [r.p, r.u]));
  check("an older save is given the table, and every adult graduate in it a picture of her own continent, none twice",
    booted && gradsOld.length > 0 && gradsOld.every((g) => continentOf(oldHas.get(g.id)) === g.c) &&
      new Set(rowsOld.map((r) => r.u)).size === rowsOld.length && oldHas.has(stillMarket[0].id),
    `${rowsOld.length} pictures for ${gradsOld.length} adult graduates, the one from before pictures existed included`);
  const before2 = JSON.stringify(rowsOld);
  child = boot(OLD, fs.openSync(path.join(WORK, "server-old2.log"), "w"));
  await up(); await stopServer(child); child = null;
  check("a second boot changes nothing", JSON.stringify(qo(`SELECT player_id AS p, image_url AS u FROM career_graduate_portraits WHERE career_save_id = ?`, cid)) === before2);

// ── 4. The AI clubs' players (try branch) ────────────────────────────────────
// Rob's list (scripts/portraits/ai-senior-cards.json, made from his CSV): the
// 96 "needs card" players with his new pictures, matched by continent and skin
// tone, and the 24 others on the card the list names.
{
  console.log("\n4. THE AI CLUBS' PLAYERS");
  const list = JSON.parse(fs.readFileSync(path.join(REPO, "scripts/portraits/ai-senior-cards.json"), "utf8")).players;
  const S = new DatabaseSync(SHIPPED, { readOnly: true });
  const pool = new Map(S.prepare(`SELECT stable_id AS sid, name, image_url AS img, skin_tone AS tone FROM continental_pool_players`).all().map((r) => [r.sid, r]));
  S.close();
  const fresh = list.filter((p) => p.kind === "new"), kept = list.filter((p) => p.kind === "kept");
  check("the list: 120 AI club players, 96 with Rob's new pictures and 24 keeping their cards",
    list.length === 120 && fresh.length === 96 && kept.length === 24 && pool.size === 120, `${list.length} / ${fresh.length} / ${kept.length}; ${pool.size} in the starter DB`);
  const wrong = list.filter((p) => pool.get(p.stableId)?.img !== p.card);
  check("every one of the 120 has the card the list says, in the starter DB", wrong.length === 0,
    wrong.slice(0, 3).map((p) => `${p.name}: ${pool.get(p.stableId)?.img}`).join(" · ") || "all 120");
  const cards = list.map((p) => p.card);
  check("no card is used twice among them", new Set(cards).size === cards.length, `${new Set(cards).size} different`);
  const gone = cards.filter((u) => !fs.existsSync(path.join(PUBLIC, u)));
  check("every card file exists", gone.length === 0, gone.slice(0, 3).join(", ") || `${cards.length} files`);
  const tone = fresh.filter((p) => p.imageBand !== p.skinTone || pool.get(p.stableId)?.tone !== p.skinTone);
  check("each new picture matches her continent's folder and her skin tone", tone.length === 0 && fresh.every((p) => p.card.startsWith("/images/players/seniors/ai/")),
    tone.slice(0, 3).map((p) => `${p.name} ${p.skinTone} / picture ${p.imageBand}`).join(" · ") || "96 of 96");
  const md5 = (u) => crypto.createHash("md5").update(fs.readFileSync(path.join(PUBLIC, u))).digest("hex");
  const everyPicture = [...all, ...fresh.map((p) => p.card)];
  check("and none of Rob's 217 new pictures is the same picture as another (graduates and seniors)",
    new Set(everyPicture.map(md5)).size === everyPicture.length, `${new Set(everyPicture.map(md5)).size} different of ${everyPicture.length}`);

  // In a career: the Player Market lists them, each with her picture.
  const DB4 = path.join(WORK, "ai.sqlite");
  fs.copyFileSync(SHIPPED, DB4);
  child = boot(DB4, fs.openSync(path.join(WORK, "server-ai.log"), "w"));
  await up();
  cookie = "";
  const prof4 = await api("POST", "/profiles", { name: "AI Cards" });
  await api("POST", `/profiles/${prof4.data.id}/select`);
  const club4 = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", { slotNumber: 1, managerName: "Rob Bonner", managerNationality: "Australia", clubName: club4.name, originalClubName: club4.name,
    budget: club4.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  const market = (await api("GET", "/players/market-all")).data ?? [];
  const atAi = (Array.isArray(market) ? market : []).filter((p) => p.poolTeamId != null || p.status === "ai_club");
  const byName = new Map(list.map((p) => [p.name, p.card]));
  const noPic = atAi.filter((p) => !p.imageUrl || !fs.existsSync(path.join(PUBLIC, p.imageUrl)));
  const mismatched = atAi.filter((p) => byName.has(p.name) && byName.get(p.name) !== p.imageUrl);
  check("on the Player Market every AI club player has her picture, and it is the one on the list",
    atAi.length >= 100 && noPic.length === 0 && mismatched.length === 0,
    `${atAi.length} at AI clubs; ${noPic.length} without a picture; ${mismatched.length} with another; e.g. ${atAi.slice(0, 2).map((p) => `${p.name}: ${p.imageUrl}`).join(" · ")}`);
  await stopServer(child); child = null;

  // An older save: the pictures come in at boot, and an AI senior already made
  // a player before them is given hers.
  const DB5 = path.join(WORK, "ai-old.sqlite");
  fs.copyFileSync(DB4, DB5);
  {
    const d = new DatabaseSync(DB5);
    d.exec(`UPDATE continental_pool_players SET image_url = NULL WHERE image_url LIKE '/images/players/seniors/ai/%'`);
    d.exec(`UPDATE players SET image_url = NULL WHERE image_url LIKE '/images/players/seniors/ai/%'`);
    d.close();
  }
  child = boot(DB5, fs.openSync(path.join(WORK, "server-ai-old.log"), "w"));
  await up();
  await new Promise((r) => setTimeout(r, 1500));
  await stopServer(child); child = null;
  const d5 = new DatabaseSync(DB5, { readOnly: true });
  const poolOld = d5.prepare(`SELECT COUNT(*) AS n FROM continental_pool_players WHERE image_url LIKE '/images/players/seniors/ai/%'`).get().n;
  const playersOld = d5.prepare(`SELECT COUNT(*) AS n FROM players p JOIN career_player_state s ON s.player_id = p.id
    JOIN continental_pool_players cp ON cp.id = s.pool_player_id WHERE p.image_url IS NULL AND cp.image_url IS NOT NULL`).get().n;
  d5.close();
  check("an older save gets the 96 new pictures at boot, and her career copy too", poolOld === 96 && playersOld === 0,
    `${poolOld} pool players with the new pictures; ${playersOld} career copies still without`);
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
