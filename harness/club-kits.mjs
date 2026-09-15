/**
 * R-73 — the wizard's club colours reach the 3D Court, and every AI club has its own kit.
 *
 * Rob picked colours for Sydney Riptide in the wizard; the court showed red and
 * blue. Traced on a copy of his save: the wizard saves them to
 * teams.logo_color / secondary_logo_color and /unity/match-state already sent
 * them for the home pair (#AA0044/#FFFFFF, logged as applied by the WebGL build).
 * The away pair was the break: every match's away team row is the player's own,
 * so the payload filled the away side with two unsigned free agents who have no
 * club and so no kit, and Unity painted its red fallback. AI clubs had no
 * colours anywhere to send.
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 *   data     every pool club has two hexes; 60 distinct pairs; no primary
 *            shared inside a continent; primary and secondary contrast
 *   wizard   a career made with the wizard's payload: every match's home pair
 *            carries the wizard's exact hexes
 *   away     every match's away pair is the fixture's own pool club pair, in
 *            that club's kit; one club, one kit; different clubs, different kits;
 *            no kit warning logged
 *   null     a club with no kit is sent as null and the server logs a warning
 *   old save a save from before the columns gets the kits on boot
 *
 * Usage: node harness/club-kits.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-club-kits-"));
const PORT = 4880;
const BASE = `http://localhost:${PORT}/api`;
const WIZARD = { primaryColor: "#12AB34", secondaryColor: "#FEDCBA" };
const HEX = /^#[0-9A-F]{6}$/;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

console.log("=".repeat(72));
console.log("  R-73 CLUB KITS REACH THE 3D COURT");
console.log("=".repeat(72));

// ── 0. Data ─────────────────────────────────────────────────────────────────
console.log("\n0. EVERY AI CLUB HAS ITS OWN KIT");
{
  const d = new DatabaseSync(SHIPPED, { readOnly: true });
  const clubs = d.prepare("SELECT id, continent, team_name, primary_color, secondary_color FROM continental_pool_teams").all();
  d.close();
  const valid = clubs.filter((c) => HEX.test(c.primary_color ?? "") && HEX.test(c.secondary_color ?? ""));
  check("every pool club has a primary and a secondary hex", clubs.length === 60 && valid.length === 60, `${valid.length} of ${clubs.length}`);
  const pairs = new Set(clubs.map((c) => `${c.primary_color}/${c.secondary_color}`));
  check("no two clubs share a kit", pairs.size === clubs.length, `${pairs.size} distinct pairs`);
  const clash = [];
  for (const cont of new Set(clubs.map((c) => c.continent))) {
    const prim = clubs.filter((c) => c.continent === cont).map((c) => c.primary_color);
    if (new Set(prim).size !== prim.length) clash.push(cont);
  }
  check("no two clubs of one continent share a primary colour", clash.length === 0, clash.join(", ") || "6 continents clear");
  const low = Math.min(...clubs.map((c) => contrast(c.primary_color, c.secondary_color)));
  check("each kit's two colours stand apart (contrast ratio of at least 2.2)", low >= 2.2, `lowest ${low.toFixed(2)}`);
}

if (!fs.existsSync(SERVER)) { console.error(`[club-kits] FAILED: ${SERVER} not built.`); process.exit(1); }

function session() {
  let cookie = "";
  return async function api(method, p, body) {
    const res = await fetch(BASE + p, {
      method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    const text = await res.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data };
  };
}

async function boot(dbFile, label, extraEnv = {}) {
  const logFile = path.join(WORK, `${label}.log`);
  const out = fs.openSync(logFile, "w");
  const child = forkServer({
    server: SERVER, electron: ELECTRON, out,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "club-kits", ...extraEnv },
  });
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return { logFile, async stop() { await stopServer(child); try { fs.closeSync(out); } catch { /* closed */ } } };
}

const readLog = (f) => fs.readFileSync(f, "utf8").replace(/\x1b\[[0-9;]*m/g, "");
const dbFile = path.join(WORK, "kits.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
let srv = await boot(dbFile, "kits");

try {
  // ── 1. The wizard's career ────────────────────────────────────────────────
  console.log("\n1. A WIZARD CAREER'S HOME PAIR WEARS THE WIZARD'S COLOURS");
  const api = session();
  const prof = await api("POST", "/profiles", { name: "Kits" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const clubs = (await api("GET", "/club-templates")).data;
  const club = (Array.isArray(clubs) ? clubs : clubs?.clubs ?? []).find((c) => c.name === "Sydney Riptide") ?? clubs[0];
  const created = await api("POST", "/careers", {
    slotNumber: 1, managerName: "Kits", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "underdog", ...WIZARD, crestShapeIndex: 0,
  });
  check("the career is created from the wizard's payload", created.status < 300, `HTTP ${created.status}, club ${club.name}, colours ${WIZARD.primaryColor}/${WIZARD.secondaryColor}`);

  // The World Tour field is drawn when the regional leagues finish (after round
  // 10). Before that every match reads "TBD": there is no opponent to dress. A
  // match can only come due after the draw, so the calendar is played up to it.
  const draw = new DatabaseSync(dbFile, { readOnly: true });
  const cidDraw = draw.prepare("SELECT id FROM career_saves ORDER BY id DESC LIMIT 1").get().id;
  const drawn = () => draw.prepare("SELECT COUNT(*) AS n FROM world_tour_fixtures WHERE career_save_id = ? AND match_id IS NOT NULL").get(cidDraw).n;
  let days = 0;
  while (drawn() === 0 && days < 90) {
    const adv = await api("POST", "/calendar/advance", {});
    const pending = adv.data?.blocked === "pending_match" ? adv.data.pendingMatchId : null;
    if (pending) {
      const sim = await api("POST", `/matches/${pending}/simulate`, {});
      if (sim.status >= 400) await api("POST", `/matches/${pending}/forfeit`, {});
    }
    days++;
  }
  const date = (await api("GET", "/calendar")).data?.currentDate;
  check("the World Tour field is drawn by playing the calendar to it", drawn() > 0, `${days} days, ${date}, ${drawn()} fixtures linked to matches`);
  draw.close();

  const all = ((await api("GET", "/matches/fixture")).data ?? []).filter((m) => m.status !== "bye");
  const fixture = all.filter((m) => m.round >= 11 && m.round <= 70);
  const finals = all.filter((m) => m.round > 70);
  const payloads = [];
  for (const m of fixture) {
    const r = await api("GET", `/unity/match-state?matchId=${m.id}`);
    payloads.push({ match: m, status: r.status, data: r.data });
  }
  console.log(`  REPORT  ${fixture.length} World Tour matches checked; ${finals.length} World Finals matches read "${finals.map((m) => m.awayTeamName).join(", ")}" until the finals are seeded, so they are not asked for`);
  const served = payloads.filter((p) => p.status === 200 && (p.data?.players?.length ?? 0) === 4);
  check("every match of the season is served with four players", served.length === payloads.length && payloads.length > 0, `${served.length} of ${payloads.length} matches`);
  const home = served.flatMap((p) => p.data.players.slice(0, 2));
  const homeExact = home.filter((p) => p.primaryColor === WIZARD.primaryColor && p.secondaryColor === WIZARD.secondaryColor);
  check("every home player carries the wizard's exact hexes", homeExact.length === home.length && home.length > 0, `${homeExact.length} of ${home.length}`);

  // ── 2. The away side ──────────────────────────────────────────────────────
  console.log("\n2. THE AWAY PAIR IS THE CLUB THE MATCH IS AGAINST, IN ITS KIT");
  const d = new DatabaseSync(dbFile, { readOnly: true });
  const cid = d.prepare("SELECT id FROM career_saves ORDER BY id DESC LIMIT 1").get().id;
  const opponentOf = d.prepare(`
    SELECT p.id AS pool_team_id, p.team_name, p.primary_color, p.secondary_color
    FROM world_tour_fixtures f
    JOIN competitors c ON c.id IN (f.home_competitor_id, f.away_competitor_id) AND c.pool_team_id IS NOT NULL
    JOIN continental_pool_teams p ON p.id = c.pool_team_id
    WHERE f.career_save_id = ? AND f.match_id = ?`);
  const pairOf = d.prepare("SELECT name FROM continental_pool_players WHERE pool_team_id = ? ORDER BY id");
  let right = 0; const wrong = [];
  const kitByClub = new Map();
  for (const p of served) {
    const opp = opponentOf.get(cid, p.match.id);
    const away = p.data.players.slice(2);
    const names = opp ? pairOf.all(opp.pool_team_id).map((r) => r.name).join(" & ") : "(no fixture)";
    const ok = !!opp && away.map((a) => a.name).join(" & ") === names && away.every((a) => a.source === "pool"
      && a.primaryColor === opp.primary_color && a.secondaryColor === opp.secondary_color && a.team === p.data.awayTeam);
    if (ok) right++; else wrong.push(`match ${p.match.id}: sent ${away.map((a) => `${a.name} ${a.primaryColor}/${a.secondaryColor}`).join(", ")}; fixture ${names}`);
    if (opp) {
      const kit = `${away[0]?.primaryColor}/${away[0]?.secondaryColor}`;
      kitByClub.set(opp.team_name, [...new Set([...(kitByClub.get(opp.team_name) ?? []), kit])]);
    }
  }
  d.close();
  check("every away pair is its fixture's pool club pair, in that club's kit", right === served.length, wrong.slice(0, 3).join(" | ") || `${right} of ${served.length}`);
  const oneKitEach = [...kitByClub.values()].every((k) => k.length === 1 && !k[0].includes("null"));
  const kits = [...kitByClub.values()].map((k) => k[0]);
  check("each opponent always wears one non-null kit, and no two opponents wear the same",
    oneKitEach && new Set(kits).size === kits.length, `${kitByClub.size} opponents, ${new Set(kits).size} kits`);
  const sample = served[0]?.data;
  console.log(`  REPORT  first match: ${sample?.homeTeam} ${sample?.players[0].primaryColor}/${sample?.players[0].secondaryColor} vs ${sample?.awayTeam} ${sample?.players[2].primaryColor}/${sample?.players[2].secondaryColor} (${sample?.players[2].name}, ${sample?.players[3].name})`);
  check("no kit warning was logged for a season of matches", !/kit colours missing/.test(readLog(srv.logFile)));

  // ── 3. A club with no kit ─────────────────────────────────────────────────
  console.log("\n3. A GENUINELY NULL KIT IS SENT AS NULL AND WARNED ABOUT");
  const target = served[0];
  {
    const w = new DatabaseSync(dbFile);
    w.exec("PRAGMA busy_timeout = 5000");
    const opp = w.prepare(`SELECT c.pool_team_id AS id FROM world_tour_fixtures f JOIN competitors c ON c.id IN (f.home_competitor_id, f.away_competitor_id) AND c.pool_team_id IS NOT NULL WHERE f.match_id = ?`).get(target.match.id);
    w.prepare("UPDATE continental_pool_teams SET primary_color = NULL, secondary_color = NULL WHERE id = ?").run(opp.id);
    w.close();
  }
  const bare = await api("GET", `/unity/match-state?matchId=${target.match.id}`);
  await new Promise((r) => setTimeout(r, 300));
  const away = bare.data?.players?.slice(2) ?? [];
  check("the away pair's kit is null, not invented", away.length === 2 && away.every((a) => a.primaryColor === null && a.secondaryColor === null));
  check("the server logs a warning naming the players", /kit colours missing, Unity will paint its fallback kit/.test(readLog(srv.logFile)) && readLog(srv.logFile).includes(away[0]?.name ?? "?"));

  // ── 4. An older save ──────────────────────────────────────────────────────
  console.log("\n4. A SAVE FROM BEFORE THE KITS GETS THEM ON BOOT");
  await srv.stop();
  const oldFile = path.join(WORK, "old.sqlite");
  fs.copyFileSync(SHIPPED, oldFile);
  {
    const w = new DatabaseSync(oldFile);
    w.exec("ALTER TABLE continental_pool_teams DROP COLUMN primary_color");
    w.exec("ALTER TABLE continental_pool_teams DROP COLUMN secondary_color");
    w.close();
  }
  srv = await boot(oldFile, "old", { STARTER_DB_PATH: SHIPPED });
  await srv.stop();
  const o = new DatabaseSync(oldFile, { readOnly: true });
  const s = new DatabaseSync(SHIPPED, { readOnly: true });
  const oldKits = o.prepare("SELECT id, primary_color, secondary_color FROM continental_pool_teams ORDER BY id").all();
  const starterKits = s.prepare("SELECT id, primary_color, secondary_color FROM continental_pool_teams ORDER BY id").all();
  o.close(); s.close();
  const same = oldKits.filter((k, i) => k.primary_color === starterKits[i]?.primary_color && k.secondary_color === starterKits[i]?.secondary_color && k.primary_color);
  check("the columns are added and every club's kit is brought forward from the starter DB", same.length === 60, `${same.length} of 60`);
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  try { await srv.stop(); } catch { /* stopped */ }
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
