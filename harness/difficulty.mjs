/**
 * Update 1, overnight brief part 6 (Rob, 14 Oct, item 6): difficulty, Easy /
 * Medium / Hard.
 *
 *   1. a new career keeps the difficulty picked in the wizard (none sent:
 *      Medium); a career made before this (no value) reads Medium; Profile's
 *      GET /manager says which
 *   2. nobody's player ratings change: an Easy and a Hard career start with
 *      the same seniors at the same ratings
 *   3. AI training follows it: Easy every 4 career weeks, Hard every week
 *   4. (source) AI pre-season camps follow it (never / coin flip / every club
 *      that can afford one), and there is no second knob (AI_TRAIN_EVERY_WEEKS is gone)
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healAllSquads, startCareer } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-difficulty-"));
const DB = path.join(WORK, "save.sqlite");
const PORT = 4991;
const BASE = `http://localhost:${PORT}/api`;
const SRC = (p) => fs.readFileSync(path.join(REPO, "artifacts", "api-server", "src", p), "utf8");
const { GAME_DIFFICULTY } = await import(pathToFileURL(path.join(REPO, "lib", "db", "src", "schema", "game-difficulty.ts")).href);

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  UPDATE 1, OVERNIGHT PART 6: DIFFICULTY, EASY / MEDIUM / HARD");
console.log("=".repeat(72));

/** One logged-in client per career (its own session cookie). */
function client() {
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
const q = (sql, ...a) => { const d = new DatabaseSync(DB, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
const w = (sql, ...a) => { const d = new DatabaseSync(DB); try { return d.prepare(sql).run(...a); } finally { d.close(); } };

async function career(name, gameDifficulty) {
  const api = client();
  const prof = await api("POST", "/profiles", { name });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? [])[0];
  const draft0 = [];
  const created = await api("POST", "/careers", { managerFaceId: 8, slotNumber: 1, managerName: name, managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", ...(gameDifficulty ? { gameDifficulty } : {}), primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  draft0.push(...(((await api("GET", "/day1-draft")).data?.players) ?? []));
  // startCareer's own draft, on the career already made.
  await startCareer(async (m, p, b) => (m === "POST" && p === "/careers" ? created : api(m, p, b)), {});
  const teamId = (await api("GET", "/team")).data?.id;
  const cid = q(`SELECT id FROM career_saves WHERE team_id = ?`, teamId)[0]?.id;
  return { api, teamId, cid, draft0 };
}
const aiTp = (cid) => new Map(q(`SELECT s.player_id AS id, s.training_points AS tp FROM career_player_state s JOIN players p ON p.id = s.player_id
  WHERE s.career_save_id = ? AND s.pool_team_id IS NOT NULL AND s.team_id IS NULL AND s.is_retired = 0 AND (p.player_type = 'senior' OR s.is_promoted = 1)`, cid).map((r) => [r.id, r.tp]));

async function weekOf(c) {
  const last = () => q(`SELECT last_salary_date AS d FROM calendar_state WHERE team_id = ?`, c.teamId)[0]?.d;
  const was = last();
  for (let i = 0; i < 10 && last() === was; i++) {
    healAllSquads(DB);
    const r = await c.api("POST", "/calendar/advance", {});
    const id = r.data?.blocked === "pending_match" ? r.data.pendingMatchId : r.data?.matchDay?.matchId;
    if (id) { await c.api("POST", `/matches/${id}/simulate`); await c.api("POST", r.data?.blocked === "pending_match" ? "/calendar/skip-match" : "/calendar/dismiss-match"); }
  }
}
/** Over `weeks` weekly blocks, how many raised the AI seniors' training points. */
async function trainedWeeks(c, weeks) {
  let trained = 0;
  for (let i = 0; i < weeks; i++) {
    const before = aiTp(c.cid);
    await weekOf(c);
    const after = aiTp(c.cid);
    const rose = [...before.keys()].filter((id) => after.has(id) && after.get(id) > before.get(id)).length;
    if (rose > before.size / 2) trained++;
  }
  return trained;
}

let child = null;
try {
  fs.copyFileSync(SHIPPED, DB);
  const out = fs.openSync(path.join(WORK, "server.log"), "w");
  child = forkServer({ server: SERVER, electron: ELECTRON, out,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: DB, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "difficulty", STARTER_DB_PATH: SHIPPED } });
  for (let i = 0; i < 360; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }

  // ── 1. Stored and shown ────────────────────────────────────────────────────
  console.log("\n1. THE CAREER KEEPS ITS DIFFICULTY, AND PROFILE SHOWS IT");
  const easy = await career("Easy Career", "easy");
  const hard = await career("Hard Career", "hard");
  const plain = await career("Plain Career", null);
  const stored = (c) => q(`SELECT game_difficulty AS d FROM career_saves WHERE id = ?`, c.cid)[0]?.d;
  check("Easy and Hard are kept; none sent is Medium", stored(easy) === "easy" && stored(hard) === "hard" && stored(plain) === "medium",
    `${stored(easy)} / ${stored(hard)} / ${stored(plain)}`);
  const mgr = (await hard.api("GET", "/manager")).data;
  check("GET /manager (Profile) says the career's difficulty", mgr?.gameDifficulty === "hard" && mgr?.gameDifficultyLabel === "Hard" && !!mgr?.gameDifficultyBlurb,
    `${mgr?.gameDifficultyLabel}: ${mgr?.gameDifficultyBlurb}`);
  w(`UPDATE career_saves SET game_difficulty = NULL WHERE id = ?`, plain.cid);
  const old = (await plain.api("GET", "/manager")).data;
  check("a career made before this (no value) is Medium", old?.gameDifficulty === "medium" && old?.gameDifficultyLabel === "Medium");

  // ── 2. Nobody's ratings change ─────────────────────────────────────────────
  console.log("\n2. NOBODY'S PLAYER RATINGS CHANGE");
  const ratings = (c) => new Map(c.draft0.map((p) => [p.name, p.rating]));
  const re = ratings(easy), rh = ratings(hard);
  const same = re.size > 100 && [...re.keys()].every((n) => rh.get(n) === re.get(n));
  check("an Easy and a Hard career start with the same seniors at the same ratings", same, `${re.size} seniors compared`);

  // ── 3. AI training ─────────────────────────────────────────────────────────
  console.log("\n3. AI TRAINING FOLLOWS IT");
  await weekOf(easy); await weekOf(hard);   // the AI clubs' seniors become career players at the first weekly block
  const e = await trainedWeeks(easy, 8), h = await trainedWeeks(hard, 4);
  check(`Easy: AI seniors trained in 2 of 8 weeks (every ${GAME_DIFFICULTY.easy.aiTrainEveryWeeks})`, e === 2, `${e} of 8`);
  check(`Hard: every week (${GAME_DIFFICULTY.hard.aiTrainEveryWeeks})`, h === 4, `${h} of 4`);

  // ── 4. Camps, and one knob ─────────────────────────────────────────────────
  console.log("\n4. AI CAMPS FOLLOW IT; ONE KNOB");
  const camp = SRC("utils/preseasonCamp.ts");
  check("(source) Easy never, Medium a coin flip each, Hard every club that can afford one",
    GAME_DIFFICULTY.easy.aiCamp === "never" && GAME_DIFFICULTY.medium.aiCamp === "coin" && GAME_DIFFICULTY.hard.aiCamp === "always"
      && /level\.aiCamp === "always" \|\| \(level\.aiCamp === "coin" && random\(\) < 0\.5\)/.test(camp));
  check("(source) AI_TRAIN_EVERY_WEEKS is gone; AI training reads the career's difficulty",
    !/AI_TRAIN_EVERY_WEEKS/.test(SRC("utils/aiTraining.ts")) && !/AI_TRAIN_EVERY_WEEKS/.test(SRC("utils/aiSquads.ts")) && /\.aiTrainEveryWeeks;/.test(SRC("utils/aiSquads.ts")));
} catch (err) {
  failures++;
  console.log(`  FAIL  the suite threw: ${err?.stack ?? err}`);
} finally {
  if (child) await stopServer(child);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
