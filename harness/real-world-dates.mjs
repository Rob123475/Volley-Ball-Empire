/**
 * Overnight brief 30 Sep, item 3 — old records keep PC dates.
 *
 * Rob's save (backup 30 Sep 09:21): "First Steps" unlocked "29 Sept 2026" for a
 * first win on 17 Feb 2026; a training session "finished 4 Oct". Records
 * written before the game dated them on its own calendar hold the PC's clock.
 *
 * Asserted on a copy of Rob's save (skipped with a note when it is absent):
 * on boot every such date becomes its game date (utils/realWorldDates.ts):
 * First Steps is dated the day of the club's first win; the training session
 * sits on a game date and finished that day; no achievement or injury time is
 * off midnight, no training or ledger date carries a clock time, no contract
 * starts after today; the API shows the same; a second boot finds nothing to
 * do; a new unlock is dated on the game calendar.
 *
 * Usage: node harness/real-world-dates.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const ROB = path.join(os.homedir(), "Downloads", "volleyball-empire-backup-30sep-0921.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-real-dates-"));
const PORT = 4932;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  OVERNIGHT 30 SEP, 3: OLD RECORDS MOVE FROM THE PC'S DATE TO THE GAME'S");
console.log("=".repeat(72));
if (!fs.existsSync(SERVER)) { console.error(`[real-world-dates] FAILED: ${SERVER} not built.`); process.exit(1); }
if (!fs.existsSync(ROB)) {
  console.log(`  NOTE  ${ROB} is not on this machine: nothing to convert, suite skipped`);
  console.log(`\n=== 0/0 passed ===`);
  process.exit(0);
}

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
const dbFile = path.join(WORK, "rob.sqlite");
fs.copyFileSync(ROB, dbFile);
const q = (sql, ...a) => { const d = new DatabaseSync(dbFile, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
async function boot(log) {
  const out = fs.openSync(path.join(WORK, log), "w");
  const child = forkServer({ server: SERVER, electron: ELECTRON, out,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "real-dates", STARTER_DB_PATH: SHIPPED } });
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }
  return async () => { try { await stopServer(child); } catch { /* stopped */ } try { fs.closeSync(out); } catch { /* closed */ } };
}
const day = (sec) => new Date(sec * 1000).toISOString().slice(0, 10);

const before = {
  ach: q(`SELECT achievement_key AS k, unlocked_at AS t FROM achievements`),
  train: q(`SELECT id, scheduled_at AS s, status FROM training_sessions`),
};
console.log(`  before: ${before.ach.map((a) => `${a.k} ${day(a.t)}`).join(", ")}; training ${before.train.map((t) => t.s).join(", ")}`);
let stop = await boot("boot1.log");
try {
  const team = q(`SELECT team_id AS id, "current_date" AS today FROM calendar_state`)[0];
  const firstWin = q(`SELECT substr(scheduled_at, 1, 10) AS d FROM matches WHERE home_team_id = ? AND status = 'completed' AND home_score > away_score ORDER BY season, round LIMIT 1`, team.id)[0]?.d;
  const fs1 = q(`SELECT unlocked_at AS t FROM achievements WHERE achievement_key = 'first_steps'`)[0];
  check("First Steps is dated the day of the club's first win (it said the PC's date)", fs1 && day(fs1.t) === firstWin && fs1.t % 86400 === 0,
    `was ${day(before.ach.find((a) => a.k === "first_steps")?.t ?? 0)}, now ${fs1 ? day(fs1.t) : "-"}; first win ${firstWin}`);
  const tr = q(`SELECT scheduled_at AS s, finishes_on AS f, status FROM training_sessions`);
  check("the training session sits on a game date and, finished at once as sessions then were, finished that day",
    tr.length > 0 && tr.every((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.s) && t.s <= team.today && (t.status !== "completed" || t.f === t.s)),
    tr.map((t) => `${t.s} (${t.status}, finished ${t.f})`).join(", "));
  const left = {
    achievements: q(`SELECT COUNT(*) AS n FROM achievements WHERE unlocked_at % 86400 != 0`)[0].n,
    injuries: q(`SELECT COUNT(*) AS n FROM injury_history WHERE date_injured % 86400 != 0`)[0].n,
    training: q(`SELECT COUNT(*) AS n FROM training_sessions WHERE scheduled_at LIKE '%T%'`)[0].n,
    ledger: q(`SELECT COUNT(*) AS n FROM finance_transactions WHERE date LIKE '%T%'`)[0].n,
    contracts: q(`SELECT COUNT(*) AS n FROM contracts WHERE team_id = ? AND substr(start_date, 1, 10) > ?`, team.id, team.today)[0].n,
  };
  check("no real-world date is left in unlocks, injuries, training, the ledger or contract starts", Object.values(left).every((n) => n === 0), JSON.stringify(left));
  const log1 = fs.readFileSync(path.join(WORK, "boot1.log"), "utf8");
  check("the boot log says what it converted", /real-world dates converted to game dates/.test(log1));

  const profiles = (await api("GET", "/profiles")).data?.profiles ?? [];
  await api("POST", `/profiles/${profiles[0].id}/select`);
  const save = ((await api("GET", "/careers")).data?.saves ?? []).find((s) => s.teamId != null);
  await api("POST", `/careers/${save.id}/load`);
  const ach = ((await api("GET", "/achievements")).data ?? []).find((a) => a.key === "first_steps");
  check("the Achievements page is told the game date", ach?.unlockedAt?.slice(0, 10) === firstWin, ach?.unlockedAt);
  const sess = ((await api("GET", "/training")).data ?? [])[0];
  check("the Training page's session finished on a game date, not \"4 Oct\"", !!sess && sess.finishesOn <= team.today, `finishes ${sess?.finishesOn}`);

  // A new unlock is dated on the game calendar.
  const d = new DatabaseSync(dbFile);
  const cs = JSON.parse(d.prepare(`SELECT career_stats AS s FROM career_saves WHERE id = ?`).get(save.id).s ?? "{}");
  d.prepare(`UPDATE career_saves SET career_stats = ? WHERE id = ?`).run(JSON.stringify({ ...cs, hallOfFameInductions: 1 }), save.id);
  d.close();
  await api("POST", "/dev/achievements/check");
  const fi = q(`SELECT unlocked_at AS t FROM achievements WHERE achievement_key = 'first_inductee'`)[0];
  check("a new unlock is dated today on the game calendar", fi && day(fi.t) === team.today && fi.t % 86400 === 0, fi ? day(fi.t) : "none");
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  await stop();
}
stop = await boot("boot2.log");
await stop();
check("a second boot has nothing left to convert", !/real-world dates converted/.test(fs.readFileSync(path.join(WORK, "boot2.log"), "utf8")));
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
