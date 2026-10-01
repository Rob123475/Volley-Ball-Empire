/**
 * Overnight brief 30 Sep, item 2 — Manager Profile: earnings and one standing.
 *
 * Rob, 30 Sep: "Career Earnings $27k" was the club's prize money; the 3 stars
 * "Experienced Manager" and the dashboard's "Level 1 Local Coach" were two
 * different measures. The stars came from career_saves.manager_reputation,
 * which nothing ever moved (50, so always 3 stars and a $6,000 salary); the
 * level from teams.manager_rep_points, which wins, titles, upgrades and
 * developing young players move.
 *
 * Asserted on a copy of Rob's save (the starter save when it is absent):
 * Career Earnings = the $6,000 salary pro rata on the game days of each season
 * (a direct sum from the copy's seasons and game date) up to the day the 1 Oct
 * money pass ran, plus the "Manager salary" lines paid since (overnight 1 Oct,
 * N-41), not the prize money; the salary shown is the manager's monthly figure
 * in Rob's range (lib/db/src/schema/money.ts);
 * the level and its name come from the rep points; the profile, the dashboard,
 * the Trophy Cabinet and the retire screen all read the one table.
 *
 * Usage: node harness/manager-profile.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
// Overnight 1 Oct, N-41: the manager's salary, from the one config file (Node strips the types).
import { managerSalaryFor } from "../lib/db/src/schema/money.ts";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const ROB = path.join(os.homedir(), "Downloads", "volleyball-empire-backup-30sep-0921.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-manager-profile-"));
const PORT = 4931;
const BASE = `http://localhost:${PORT}/api`;
const SALARY = 6000;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  OVERNIGHT 30 SEP, 2: MANAGER EARNINGS AND ONE STANDING");
console.log("=".repeat(72));
if (!fs.existsSync(SERVER)) { console.error(`[manager-profile] FAILED: ${SERVER} not built.`); process.exit(1); }

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
const usingRob = fs.existsSync(ROB);
const dbFile = path.join(WORK, "save.sqlite");
fs.copyFileSync(usingRob ? ROB : SHIPPED, dbFile);
console.log(`  save: ${usingRob ? "a copy of " + ROB : "the starter save"}`);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development",
    SESSION_SECRET: "manager-profile", STARTER_DB_PATH: SHIPPED },
});

try {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  if (usingRob) {
    const profiles = (await api("GET", "/profiles")).data?.profiles ?? [];
    await api("POST", `/profiles/${profiles[0].id}/select`);
    const save = ((await api("GET", "/careers")).data?.saves ?? []).find((s) => s.teamId != null);
    await api("POST", `/careers/${save.id}/load`);
  } else {
    const prof = await api("POST", "/profiles", { name: "Profile Test" });
    await api("POST", `/profiles/${prof.data.id}/select`);
    const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
    await api("POST", "/careers", {
      slotNumber: 1, managerName: "Profile Test", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
      budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0,
    });
    for (let i = 0; i < 40; i++) await api("POST", "/calendar/advance", {});
  }
  const team = (await api("GET", "/team")).data;
  const sum = (await api("GET", "/careers/summary")).data;
  const careerSaveId = ((await api("GET", "/careers")).data?.saves ?? []).find((s) => s.teamId === team.id)?.id;
  const d = new DatabaseSync(dbFile, { readOnly: true });
  const today = d.prepare(`SELECT * FROM calendar_state WHERE team_id = ?`).get(team.id).current_date;
  const seasons = d.prepare(`SELECT start_date AS s, end_date AS e, status FROM seasons WHERE career_save_id = ?`).all(careerSaveId);
  const prize = Number(d.prepare(`SELECT COALESCE(SUM(amount), 0) AS t FROM finance_transactions WHERE team_id = ? AND type = 'income' AND category = 'prize_money'`).get(team.id).t);
  const paid = Number(d.prepare(`SELECT COALESCE(SUM(amount), 0) AS t FROM finance_transactions WHERE team_id = ? AND category = 'manager_salary'`).get(team.id).t);
  const passAt = d.prepare(`SELECT money_pass_at AS m FROM career_saves WHERE id = ?`).get(careerSaveId)?.m ?? null;
  d.close();
  const until = /^\d{4}-\d{2}-\d{2}$/.test(passAt ?? "") ? passAt : null;
  const day = (x) => Date.parse(`${x.slice(0, 10)}T00:00:00Z`) / 86400000;
  const before = until == null ? 0 : seasons.reduce((a, s) => {
    const len = day(s.e) - day(s.s) + 1;
    const served = s.status === "completed" && s.e.slice(0, 10) <= until ? len : Math.max(0, Math.min(len, day(until) - day(s.s) + 1));
    return a + SALARY * served / len;
  }, 0);
  const expected = Math.round(paid + before);
  check("Career Earnings = the old $6,000 a season pro rata up to the money pass, plus the manager salary paid since",
    sum?.careerEarnings === expected,
    `$${sum?.careerEarnings?.toLocaleString()} on ${today} (${seasons.length} season(s), pass ${passAt}); computed $${Math.round(before).toLocaleString()} + paid $${paid.toLocaleString()}`);
  const salaryWant = managerSalaryFor(`career:${careerSaveId}`);
  check("the salary shown is the manager's monthly figure in Rob's range", sum.managerSalary === salaryWant && salaryWant >= 16000 && salaryWant <= 20000,
    `$${sum.managerSalary?.toLocaleString()} a month`);
  check("...not the club's prize money", sum.careerEarnings !== prize || prize === 0, `prize money $${prize.toLocaleString()}`);
  const levels = [[0, 1, "Local Coach"], [100, 2, "Regional Coach"], [300, 3, "National Coach"], [700, 4, "World Class Coach"], [1500, 5, "Legend"]];
  const want = [...levels].reverse().find(([min]) => (team.managerRepPoints ?? 0) >= min);
  check("the level and its name come from the manager's reputation points", sum.managerRepPoints === (team.managerRepPoints ?? 0) && sum.managerLevel === want[1] && sum.managerLevelName === want[2],
    `${sum.managerRepPoints} points -> Level ${sum.managerLevel} ${sum.managerLevelName}`);
  const src = (p) => fs.readFileSync(path.join(REPO, p), "utf8");
  const profile = src("artifacts/beach-volleyball/src/pages/profile.tsx");
  check("the profile shows that level (stars = level) and the earnings; the old 0-100 reputation is gone from every page",
    /const stars = summary\?\.managerLevel/.test(profile) && /summary\?\.careerEarnings/.test(profile) && !/Experienced/.test(profile)
    && ["pages/profile.tsx", "components/career/RetireModal.tsx", "pages/dashboard.tsx"].every((f) => !/managerReputation/.test(src(`artifacts/beach-volleyball/src/${f}`))));
  // Overnight 1 Oct, N-40: Career Earnings to the dollar ("$1,249"), not "$1k"; the salary a month, likewise.
  check("Career Earnings and the salary are shown to the dollar, not rounded to thousands",
    /value=\{`\$\$\{Math\.round\(careerEarnings\)\.toLocaleString\("en-US"\)\}`\}/.test(profile)
    && /`\$\$\{Math\.round\(summary\?\.managerSalary \?\? 0\)\.toLocaleString\("en-US"\)\} \/ month`/.test(profile)
    && !/fmtMoney\(careerEarnings\)/.test(profile),
    `today ${"$" + Number(sum?.careerEarnings ?? 0).toLocaleString("en-US")} earned, ${"$" + Number(sum?.managerSalary ?? 0).toLocaleString("en-US")} a month`);
  check("the dashboard and the Trophy Cabinet read the one table of levels",
    /managerLevelFor\(pts\)/.test(src("artifacts/beach-volleyball/src/pages/dashboard.tsx")) && /\.\.\.MANAGER_LEVELS\[0\]/.test(src("artifacts/beach-volleyball/src/pages/trophy-cabinet.tsx")));
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
