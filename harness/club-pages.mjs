/**
 * Unity match brief (29 Sep), item 20 — Club pages.
 *
 * Rob, 29 Sep:
 *   - the Medical Centre page ended with the whole Medical Staff Market (the
 *     Club page's Medical tab rendered the market page under it);
 *   - fatigue two ways: the Squad Fatigue Monitor said 31%, the Squad Fitness
 *     Overview 17% next to the same player (its own bar said 31). The 17% was the
 *     injury-risk estimate, unlabelled;
 *   - Treatment Queue: "Minor Injury, 1 week", "7d remaining", bar at 50%: the
 *     page's own injury table said a Minor Injury lasts 2 weeks (the game: 1);
 *   - Global Leaderboard: "69 rounds per season" (the whole season) beside a top
 *     bar counting "World Tour R4/57".
 * (The Trophy Cabinet count is item 21's.)
 *
 * Asserted: the Medical tab is the Medical Centre alone, with its "Browse
 * Medical Market" button to the market's own page; the risk figure is labelled
 * and fatigue is shown as the monitor shows it; the page's injury weeks are the
 * game's own (one table), so a 1-week injury with 7 days left is 0% treated and
 * with 4 days left 43%; GET /calendar states the rounds by phase and the top
 * bar's World Tour count is one of them; the leaderboard says which rounds.
 *
 * Usage: node harness/club-pages.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-club-pages-"));
const PORT = 4928;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  UNITY 20: CLUB PAGES");
console.log("=".repeat(72));
if (!fs.existsSync(SERVER)) { console.error(`[club-pages] FAILED: ${SERVER} not built.`); process.exit(1); }
const src = (p) => fs.readFileSync(path.join(REPO, p), "utf8");

// ── Pages ───────────────────────────────────────────────────────────────────
const hub = src("artifacts/beach-volleyball/src/pages/club-hub.tsx");
const medical = src("artifacts/beach-volleyball/src/pages/medical.tsx");
const app = src("artifacts/beach-volleyball/src/App.tsx");
check("the Club page's Medical tab is the Medical Centre alone; the market is its own page, behind \"Browse Medical Market\"",
  !/<MedicalMarket \/>/.test(hub) && !/import MedicalMarket/.test(hub) && /<Route path="\/medical-market"\s+component=\{MedicalMarket\}/.test(app)
  && (medical.match(/href="\/medical-market"/g) ?? []).length >= 1 && /Browse Medical Market/.test(medical));
check("one fatigue figure: the Squad Fitness Overview labels its % as injury risk and shows fatigue as a %",
  /Injury risk<\/span>/.test(medical) && /data-testid=\{`fatigue-\$\{player\.id\}`\}[\s\S]{0,120}\{fatigue\}%/.test(medical) && /\{fatigue\}% fatigue/.test(medical));

// The injury table is the game's: one file, read by the server's roll and the page.
const injuries = src("lib/db/src/schema/injuries.ts");
const weeks = Object.fromEntries([...injuries.matchAll(/"?([A-Za-z ]+?)"?:\s+(\d+),/g)].map((m) => [m[1].trim(), Number(m[2])]));
const cond = src("artifacts/api-server/src/utils/condition.ts");
check("the injury weeks are one table (Minor 1, Major 3, Unavailable 6), read by the game's roll and the Medical page",
  weeks["Minor Injury"] === 1 && weeks["Major Injury"] === 3 && weeks.Unavailable === 6
  && /INJURY_WEEKS\["Minor Injury"\]/.test(cond) && /\.\.\.INJURY_WEEKS/.test(medical) && !/"Minor Injury": 2,/.test(medical),
  JSON.stringify(weeks));
// The Treatment Queue's arithmetic, as the page does it.
const progress = (status, weeksLeft) => {
  const daysLeft = Math.round(weeksLeft * 7);
  const total = Math.max((weeks[status] ?? 0) * 7, daysLeft);
  return { daysLeft, pct: total > 0 ? Math.round(Math.max(0, Math.min(100, ((total - daysLeft) / total) * 100))) : 0 };
};
const p7 = progress("Minor Injury", 1), p4 = progress("Minor Injury", 4 / 7), p0 = progress("Major Injury", 3);
check("the Treatment Queue bar matches the days left: a 1-week injury with 7 days left 0%, with 4 left 43%; a fresh 3-week one 0%",
  p7.daysLeft === 7 && p7.pct === 0 && p4.daysLeft === 4 && p4.pct === 43 && p0.pct === 0 && /const totalDays = Math\.max\(baseWeeks \* 7, daysLeft\);/.test(medical),
  `7d -> ${p7.pct}%, 4d -> ${p4.pct}% (Rob saw 7d at 50%)`);

// ── The round counts, from the server ─────────────────────────────────────────
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
const dbFile = path.join(WORK, "club.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "club-pages" },
});
try {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  const prof = await api("POST", "/profiles", { name: "Club Test" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", {
    slotNumber: 1, managerName: "Club Test", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0,
  });
  await api("POST", "/calendar/next-match");
  const cal = (await api("GET", "/calendar")).data;
  const r = cal?.roundsByPhase;
  check("GET /calendar states the season's rounds by phase, and they add up", !!r && r.continental + r.worldTour + r.finals === r.total && r.worldTour === 57 && r.total === 69,
    JSON.stringify(r));
  const phaseSrc = fs.readFileSync(path.join(REPO, "artifacts/api-server/src/utils/seasonPhase.ts"), "utf8");
  check("the top bar's World Tour count (\"World Tour R4/57\") is that same number: both are WORLD_TOUR_ROUNDS",
    /World Tour R\$\{[^}]+\}\/\$\{WORLD_TOUR_ROUNDS\}/.test(phaseSrc) && /worldTour: WORLD_TOUR_ROUNDS/.test(fs.readFileSync(path.join(REPO, "artifacts/api-server/src/routes/calendar.ts"), "utf8")));
  const lb = src("artifacts/beach-volleyball/src/pages/leaderboard.tsx");
  check("the leaderboard says which rounds (World Tour, continental, finals), not \"69 rounds per season\"",
    /\$\{rounds\.worldTour\} World Tour rounds a season/.test(lb) && !/\$\{roundsPerSeason\} rounds per season/.test(lb));
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
