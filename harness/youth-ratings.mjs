/**
 * Overnight brief 1 Oct, N-44 (Rob, 1 Oct): youth ratings consistent everywhere.
 *
 * Youths a scouting mission found came back rated 74, 72 and 65 (ages 15-16)
 * while the loan list's youths were 47-51: the missions had a rating rule of
 * their own. Now every youth the game makes is drawn by one rule
 * (utils/youthIntake.ts drawYouthStats): each stat a normal draw on the 72
 * shipped youth's mean and spread, and about 1 in 100 super-gifted (every stat
 * around 72, so she rates about 70+). The cards show her country, not her
 * region, and the whole scout's report.
 *
 * Asserted on a new career (starter save): ~170 scouting missions' finds and
 * the sixty AI academies (the intake's rule) rate alike - mean about 50, none
 * above 63 unless super-gifted, a super-gifted one is the report's
 * "Generational Talent" and rates 66 or more, about 1 in 100 of them; a find's
 * rating is her stats' rating; signing her makes that player (same stats, same
 * country); her country is one of her region's nations and her report names
 * it. Then an old-style pending find (rated 74 by the old rule, no stats) is
 * re-rated once at boot, keeps the country its report names, and a second
 * boot leaves it alone. The pages show the country and the whole report.
 *
 * Usage: node harness/youth-ratings.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-youth-ratings-"));
const PORT = 4559;
const BASE = `http://localhost:${PORT}/api`;
const GIFTED_MIN = 66, NORMAL_MAX = 63;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  OVERNIGHT 1 OCT, N-44: ONE RULE FOR EVERY YOUTH'S RATING");
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
const dbFile = path.join(WORK, "save.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
let child = null;
async function boot(tag) {
  const out = fs.openSync(path.join(WORK, `server-${tag}.log`), "w");
  child = forkServer({
    server: SERVER, electron: ELECTRON, out,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development",
      SESSION_SECRET: "youth-ratings", STARTER_DB_PATH: SHIPPED },
  });
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) return; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("server did not boot");
}
async function stop() { if (child) await stopServer(child); child = null; }
const q = (sql, ...a) => { const d = new DatabaseSync(dbFile, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
const w = (sql, ...a) => { const d = new DatabaseSync(dbFile); try { return d.prepare(sql).run(...a); } finally { d.close(); } };
const ovr = (s) => Math.round((s.speed + s.power + s.defense + s.serve + s.block + s.stamina) / 6);
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

try {
  await boot("1");
  const prof = await api("POST", "/profiles", { name: "Youth Ratings" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", { slotNumber: 1, managerName: "Youth Ratings", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  const team = (await api("GET", "/team")).data;
  w(`UPDATE teams SET budget = 50000000 WHERE id = ?`, team.id);
  const regions = ((await api("GET", "/continental-scouting/regions")).data ?? []).map((r) => r.id ?? r.region?.id).filter(Boolean);
  const offer = ((await api("GET", "/staff/market?role=scout")).data ?? []).find((m) => /scout/i.test(m.role));
  await api("POST", "/staff", { staffId: offer?.id, length: "2s" });
  const scout = ((await api("GET", "/staff")).data ?? []).find((s) => /^scout$/i.test(s.role));

  // ── 1. Missions ───────────────────────────────────────────────────────────
  console.log("\n1. A SCOUTING MISSION'S FINDS");
  const finds = [];
  for (let round = 0; round < 28; round++) {
    for (const region of regions) {
      const st = await api("POST", "/continental-scouting/start", { region, durationMonths: 1, staffId: scout.id });
      if (st.status !== 201) continue;
      await api("POST", `/continental-scouting/missions/${st.data.id}/dev-complete`);
      const col = await api("POST", `/continental-scouting/missions/${st.data.id}/collect`);
      for (const p of col.data?.prospects ?? []) finds.push({ ...p, region });
    }
  }
  const stored = new Map(q(`SELECT id, stats, nationality, elite_event_type AS elite FROM youth_prospects WHERE team_id = ?`, team.id).map((r) => [r.id, r]));
  const rows = finds.map((p) => ({ ...p, stats: JSON.parse(stored.get(p.id)?.stats ?? "null"), elite: stored.get(p.id)?.elite ?? null }));
  const gifted = rows.filter((p) => p.currentRating >= GIFTED_MIN);
  const normal = rows.filter((p) => p.currentRating < GIFTED_MIN);
  check(`many finds to judge by`, rows.length >= 200, `${rows.length} youths from ${regions.length} regions`);
  check("every find's rating is her six stats' rating", rows.every((p) => p.stats && ovr(p.stats) === p.currentRating));
  check("they rate like other youths: mean about 50, none above 63 unless super-gifted",
    mean(normal.map((p) => p.currentRating)) >= 46 && mean(normal.map((p) => p.currentRating)) <= 55 && normal.every((p) => p.currentRating <= NORMAL_MAX),
    `mean ${mean(normal.map((p) => p.currentRating)).toFixed(1)}, ${Math.min(...normal.map((p) => p.currentRating))}-${Math.max(...normal.map((p) => p.currentRating))}`);
  check("a super-gifted find is the report's \"Generational Talent\", and every Generational Talent is super-gifted",
    gifted.every((p) => p.elite === "Generational Talent" && p.eliteEventType === "Generational Talent")
    && rows.filter((p) => p.elite === "Generational Talent").every((p) => p.currentRating >= GIFTED_MIN),
    `${gifted.length} super-gifted: ${gifted.map((p) => p.currentRating).join(", ") || "none this run"}`);
  // Not every report sentence names a country; when one does, it is hers.
  const named = rows.filter((p) => / from [A-Z]/.test(p.scoutingReportText ?? ""));
  const nationsOk = rows.every((p) => p.nationality) && named.length > 0 && named.every((p) => (p.scoutingReportText ?? "").includes(` from ${p.nationality}`));
  check("each find carries her country, and a report that names a country names hers", nationsOk,
    `e.g. ${rows.slice(0, 3).map((p) => `${p.name} (${p.region}): ${p.nationality}`).join("; ")}`);

  // ── 2. The intake's rule: the sixty AI academies ──────────────────────────
  console.log("\n2. THE AI ACADEMIES (THE INTAKE'S RULE)");
  for (let i = 0; i < 10 && q(`SELECT COUNT(*) n FROM career_player_state WHERE pool_team_id IS NOT NULL`)[0].n === 0; i++) await api("POST", "/calendar/advance", {});
  const academy = q(`SELECT s.speed, s.power, s.defense, s.serve, s.block, s.stamina FROM career_player_state s JOIN players p ON p.id = s.player_id
                      WHERE s.pool_team_id IS NOT NULL AND p.player_type = 'youth'`).map(ovr);
  const acNormal = academy.filter((r) => r < GIFTED_MIN);
  check("the AI academies' youths rate alike: mean about 50, none above 63 unless super-gifted",
    academy.length >= 200 && mean(acNormal) >= 46 && mean(acNormal) <= 55 && acNormal.every((r) => r <= NORMAL_MAX),
    `${academy.length} youths, mean ${mean(acNormal).toFixed(1)}, ${Math.min(...acNormal)}-${Math.max(...acNormal)}; super-gifted ${academy.length - acNormal.length}`);
  const all = rows.length + academy.length, nGifted = gifted.length + academy.length - acNormal.length;
  check("about 1 in 100 youths is super-gifted (70+)", nGifted <= all * 0.03,
    `${nGifted} of ${all} (${(100 * nGifted / all).toFixed(1)}%; expected about 1%)`);

  // ── 3. Signing a find makes that youth ────────────────────────────────────
  console.log("\n3. SIGNING A FIND");
  const pick = rows.find((p) => p.status === "pending");
  const before = new Set(q(`SELECT player_id AS id FROM career_player_state WHERE team_id = ?`, team.id).map((r) => r.id));
  const signed = await api("POST", `/youth-scouting/prospects/${pick.id}/sign`, { confirm: true });
  const fresh = q(`SELECT s.player_id AS id, s.speed, s.power, s.defense, s.serve, s.block, s.stamina, p.nationality, p.name
                     FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.team_id = ?`, team.id).filter((r) => !before.has(r.id));
  check("signing her makes that youth: her stats and her country", signed.status < 300 && fresh.length === 1
    && ["speed", "power", "defense", "serve", "block", "stamina"].every((k) => fresh[0][k] === pick.stats[k]) && fresh[0].nationality === pick.nationality,
    `HTTP ${signed.status} ${signed.data?.error ?? ""}; ${fresh[0]?.name} ${fresh[0]?.nationality}, rated ${fresh[0] ? ovr(fresh[0]) : "?"} (card ${pick.currentRating})`);

  // ── 4. An old find, re-rated once at boot ─────────────────────────────────
  console.log("\n4. A FIND FROM BEFORE THE RULE");
  await stop();
  const report = "Valentina Ramos is a 16-year-old from Argentina. Exceptional court vision and soft hands.";
  const valId = Number(w(`INSERT INTO youth_prospects (team_id, name, age, continent, current_rating, potential_stars, speciality, signing_cost, status, scouting_report_text, created_at)
     VALUES (?, 'Old Find Valentina', 16, 'South America', 74, 'Elite', 'Defense', 1700, 'pending', ?, ?)`, team.id, report, Date.now()).lastInsertRowid);
  const anaId = Number(w(`INSERT INTO youth_prospects (team_id, name, age, continent, current_rating, potential_stars, speciality, signing_cost, status, scouting_report_text, elite_event_type, created_at)
     VALUES (?, 'Old Find Ana', 15, 'South America', 80, 'Generational', 'Power', 2000, 'pending', 'Ana from Brazil is a generational talent.', 'Generational Talent', ?)`, team.id, Date.now()).lastInsertRowid);
  await boot("2");
  await stop();
  const old = q(`SELECT id, name, current_rating AS r, stats, nationality FROM youth_prospects WHERE id IN (?, ?) ORDER BY id`, valId, anaId);
  const [val, ana] = old;
  const vs = JSON.parse(val?.stats ?? "null"), as = JSON.parse(ana?.stats ?? "null");
  check("an old find (rated 74 by the old rule) is re-rated by the one rule, from stats she now has",
    vs && val.r === ovr(vs) && (val.r <= NORMAL_MAX || val.r >= GIFTED_MIN), `74 -> ${val?.r}`);
  check("...and her country is the one her report names", val?.nationality === "Argentina", val?.nationality);
  check("an old \"Generational Talent\" stays the super-gifted one", as && ana.r === ovr(as) && ana.r >= GIFTED_MIN && ana.nationality === "Brazil", `80 -> ${ana?.r}, ${ana?.nationality}`);
  await boot("3");
  await stop();
  const again = q(`SELECT id, name, current_rating AS r, stats, nationality FROM youth_prospects WHERE id IN (?, ?) ORDER BY id`, valId, anaId);
  check("a second boot leaves them alone", JSON.stringify(again) === JSON.stringify(old));

  // ── 5. The pages ──────────────────────────────────────────────────────────
  const page = (f) => fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/pages", f), "utf8");
  check("the scouting and academy cards show her country and the whole report",
    ["continental-scouting.tsx", "youth-academy.tsx"].every((f) => /\.nationality \?\? (prospect|p)\.continent/.test(page(f)) && !/line-clamp-\d[^"]*">\s*\n?\s*"\{(prospect|\(p as any\))\.scoutingReportText/.test(page(f))));
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  await stop();
}
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else fs.rmSync(WORK, { recursive: true, force: true });
process.exit(failures > 0 ? 1 : 0);
