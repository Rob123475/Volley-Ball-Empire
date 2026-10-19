/**
 * Trademark cleanup (Rob, 19 Oct): the Olympics are the Empire Nations Cup.
 * Saves made before the rename stored the old words in display text — trophy
 * names ("Olympic Gold 2028 — Brazil"), history and ledger lines, scouting
 * reports, staff traits from the starter DB. utils/trademarkRenames.ts
 * rewrites them at boot.
 *
 * Old rows are planted into a copy of Rob's 2 Oct save (or of the starter DB
 * when that backup is not on this machine), the server boots on it twice:
 *   - every planted display line reads Nations Cup, with the right article;
 *   - keys stay: trophy types olympic_gold/olympic_appearance, the youth's
 *     elite_event_type "Olympic Wonderkid" (an API enum the page relabels),
 *     a player called Olympia keeps her name;
 *   - after the boot no text column anywhere in the save has a whole-word
 *     Olympic/Olympics/Olympian outside the known key columns;
 *   - a second boot changes nothing and says nothing.
 *
 * Usage: node harness/trademark-renames.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const ROB = process.env.VBE_ROB_BACKUP ?? path.join(os.homedir(), "Downloads", "volleyball-empire-backup-02oct-0845.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-trademark-"));
const PORT = 4996;
const BASE = `http://localhost:${PORT}/api`;
const LOG_LINE = "stored Olympic text renamed to the Empire Nations Cup";

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  ROB, 19 OCT: STORED OLYMPIC TEXT BECOMES THE EMPIRE NATIONS CUP");
console.log("=".repeat(72));

const q = (file, sql, ...a) => { const d = new DatabaseSync(file, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
let child = null;
async function boot(file, tag) {
  const log = path.join(WORK, `server-${tag}.log`);
  const out = fs.openSync(log, "w");
  child = forkServer({ server: SERVER, electron: ELECTRON, out,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: file, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "tm", STARTER_DB_PATH: SHIPPED } });
  for (let i = 0; i < 360; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) return log; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }
  throw new Error("server did not boot");
}
async function stop() { if (child) await stopServer(child); child = null; }

// Text columns whose "olympic" is a key or a JSON field name, not display text.
const KEY_COLUMNS = new Set([
  "trophies.type", "facilities.type", "youth_prospects.elite_event_type", "players.elite_event_type",
  "career_saves.career_stats", "career_history_entries.type", "achievements.achievement_key",
]);
const WHOLE_WORD = /\b(Olympic|Olympics|Olympian|Olympians)\b/i;
function displayHits(file) {
  const d = new DatabaseSync(file, { readOnly: true });
  const hits = [];
  try {
    for (const { name: t } of d.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()) {
      for (const c of d.prepare(`PRAGMA table_info("${t}")`).all()) {
        if (KEY_COLUMNS.has(`${t}.${c.name}`)) continue;
        for (const r of d.prepare(`SELECT "${c.name}" AS v FROM "${t}" WHERE typeof("${c.name}") = 'text' AND "${c.name}" LIKE '%olympi%'`).all()) {
          if (WHOLE_WORD.test(r.v)) hits.push(`${t}.${c.name}: ${r.v.slice(0, 80)}`);
        }
      }
    }
  } finally { d.close(); }
  return hits;
}

try {
  const base = fs.existsSync(ROB) ? ROB : SHIPPED;
  const copy = path.join(WORK, "save.sqlite");
  fs.copyFileSync(base, copy);
  console.log(`\n1. OLD ROWS PLANTED INTO A COPY OF ${base === ROB ? "ROB'S 2 OCT SAVE" : "THE STARTER DB"}`);
  const w = new DatabaseSync(copy);
  const teamId = w.prepare("SELECT team_id AS t FROM career_saves WHERE team_id IS NOT NULL").get()?.t
    ?? w.prepare("SELECT id AS t FROM teams ORDER BY id LIMIT 1").get().t;
  const userId = w.prepare("SELECT user_id AS u FROM career_saves LIMIT 1").get()?.u ?? "harness-user";
  const now = Math.floor(Date.now() / 1000);
  const ids = {};
  const ins = (key, sql, ...a) => { ids[key] = Number(w.prepare(sql).run(...a).lastInsertRowid); };
  ins("gold", `INSERT INTO trophies (team_id, type, name, season, year, notes, created_at) VALUES (?, 'olympic_gold', 'Olympic Gold 2028 — Brazil', 3, 2028, 'Ana Souza & Olympia Kostas for Brazil', ?)`, teamId, now);
  ins("games", `INSERT INTO trophies (team_id, type, name, season, year, notes, created_at) VALUES (?, 'olympic_appearance', 'Olympic Games 2028', 3, 2028, 'Ana Souza (Brazil)', ?)`, teamId, now);
  ins("history", `INSERT INTO career_history_entries (user_id, type, club_name, season, description, occurred_at) VALUES (?, 'retirement', 'Harness Club', '2030', 'Retired after 400 matches, 3 titles, and 2 Olympic medals.', ?)`, userId, now);
  ins("ledger", `INSERT INTO finance_transactions (team_id, type, amount, description, category, date, created_at) VALUES (?, 'income', 5000, 'Olympic Games bonus: an Olympic medal', 'prize', '2028-08-10', ?)`, teamId, now);
  ins("youth", `INSERT INTO youth_prospects (team_id, name, age, continent, current_rating, potential_stars, speciality, signing_cost, scouting_report_text, elite_event_type, created_at)
    VALUES (?, 'Olympia Reyes', 16, 'South America', 55, 5, 'Blocker', 1000, 'FUTURE OLYMPIAN. With proper development, an Olympic podium is a realistic ceiling. OLYMPIC CALIBRE.', 'Olympic Wonderkid', ?)`, teamId, now);
  ins("summary", `INSERT INTO manager_season_summaries (user_id, team_id, season_year, club_name, world_result, created_at) VALUES (?, ?, 2028, 'Harness Club', 'Olympic Gold', ?)`, userId, teamId, now);
  w.close();
  const plantedHits = displayHits(copy);
  check("the copy has Olympic display text before the boot", plantedHits.length >= 6, `${plantedHits.length} lines`);

  console.log("\n2. FIRST BOOT");
  const log1 = await boot(copy, "1");
  await stop();
  const row = (sql, id) => q(copy, sql, id)[0];
  const gold = row("SELECT type, name, notes FROM trophies WHERE id = ?", ids.gold);
  const games = row("SELECT type, name FROM trophies WHERE id = ?", ids.games);
  check("trophy: Nations Cup Gold 2028 — Brazil, still type olympic_gold", gold.name === "Nations Cup Gold 2028 — Brazil" && gold.type === "olympic_gold", `${gold.name} (${gold.type})`);
  check("a player called Olympia keeps her name", gold.notes === "Ana Souza & Olympia Kostas for Brazil", gold.notes);
  check("trophy: Empire Nations Cup 2028, still type olympic_appearance", games.name === "Empire Nations Cup 2028" && games.type === "olympic_appearance", `${games.name} (${games.type})`);
  const history = row("SELECT description FROM career_history_entries WHERE id = ?", ids.history).description;
  check("history line", history === "Retired after 400 matches, 3 titles, and 2 Nations Cup medals.", history);
  const ledger = row("SELECT description FROM finance_transactions WHERE id = ?", ids.ledger).description;
  check("ledger line, with the article fixed", ledger === "Empire Nations Cup bonus: a Nations Cup medal", ledger);
  const youth = row("SELECT name, scouting_report_text AS r, elite_event_type AS e FROM youth_prospects WHERE id = ?", ids.youth);
  check("stored scouting report", youth.r === "FUTURE NATIONS CUP PLAYER. With proper development, a Nations Cup podium is a realistic ceiling. NATIONS CUP CALIBRE.", youth.r);
  check("the elite event key stays 'Olympic Wonderkid' (the page relabels it)", youth.e === "Olympic Wonderkid" && youth.name === "Olympia Reyes", `${youth.e}; ${youth.name}`);
  const summary = row("SELECT world_result AS r FROM manager_season_summaries WHERE id = ?", ids.summary).r;
  check("season summary", summary === "Nations Cup Gold", summary);
  const staff = q(copy, "SELECT specialty, special_trait AS trait FROM staff WHERE specialty LIKE '%Weightlifting%' OR special_trait LIKE '%Medallist%'");
  check("starter staff: Competition Weightlifting & Power, Nations Cup Gold Medallist",
    staff.length > 0 && staff.every((s) => !/olympi/i.test(`${s.specialty} ${s.trait}`))
      && staff.some((s) => s.specialty === "Competition Weightlifting & Power") && staff.some((s) => s.trait === "Nations Cup Gold Medallist"),
    staff.map((s) => `${s.specialty} / ${s.trait}`).join("; "));
  const left = displayHits(copy);
  check("no whole-word Olympic left in any text column outside the key columns", left.length === 0, left.slice(0, 5).join(" | "));
  check("the boot said what it renamed", fs.readFileSync(log1, "utf8").includes(LOG_LINE));

  console.log("\n3. SECOND BOOT");
  const snapshot = () => JSON.stringify([
    q(copy, "SELECT id, type, name, notes FROM trophies ORDER BY id"),
    q(copy, "SELECT id, description FROM career_history_entries ORDER BY id"),
    q(copy, "SELECT id, description FROM finance_transactions WHERE id = ?", ids.ledger),
    q(copy, "SELECT id, scouting_report_text, elite_event_type FROM youth_prospects ORDER BY id"),
    q(copy, "SELECT id, specialty, special_trait FROM staff ORDER BY id"),
  ]);
  const before = snapshot();
  const log2 = await boot(copy, "2");
  await stop();
  check("a second boot changes nothing", snapshot() === before);
  check("and says nothing", !fs.readFileSync(log2, "utf8").includes(LOG_LINE));
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  await stop();
}
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else fs.rmSync(WORK, { recursive: true, force: true });
process.exit(failures > 0 ? 1 : 0);
