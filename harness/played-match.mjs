/**
 * 1.2 Part A: the 3D court's played match.
 *
 *   1. the engine's own checks: the Unity project's Assets/Scripts/PlayedMatch
 *      and Assets/Editor/PlayedMatchChecks.cs, compiled from the Unity repo and
 *      run by dotnet (harness/played-match): A1 ball flight, A2 touch grading,
 *      A4 the AI plays the same game, and (with --a6) A6's win-rate table
 *   2. A5: GET /unity/match-state sends the career's difficulty
 *      (gameDifficulty), Easy, Medium and Hard, and Medium for a career made
 *      before difficulty existed (no value)
 *   3. with --unity: the Unity project (batch mode, Unity closed) reads each
 *      career's match from this server and plays a few points at its
 *      difficulty: the ring, the prompts and the AI's sharpness as A5 says
 *      (PlayedMatchPlayProof -apiBase ... -points 6 -expect <difficulty>)
 *
 * Usage: node harness/played-match.mjs [--a6] [--unity] [--proof-dir DIR]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { startCareer } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const RUNNER = path.join(REPO, "harness", "played-match");
const UNITY_REPO = process.env.UNITY_REPO ?? "C:/Users/rbonn/Game_Dev/VolleyBall Empire/volleyball";
const UNITY_EXE = process.env.UNITY_EXE ?? "C:/Program Files/Unity/Hub/Editor/6000.3.16f1/Editor/Unity.exe";
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-played-"));
const DB = path.join(WORK, "save.sqlite");
const PORT = 4967;
const BASE = `http://localhost:${PORT}/api`;
const args = process.argv.slice(2);
const WITH_A6 = args.includes("--a6");
const WITH_UNITY = args.includes("--unity");
const PROOF_DIR = args.includes("--proof-dir") ? args[args.indexOf("--proof-dir") + 1] : path.join(WORK, "proof");

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  1.2 PART A: THE PLAYED MATCH");
console.log("=".repeat(72));

// ── 1. The engine, by dotnet ───────────────────────────────────────────────
console.log("\n1. THE ENGINE'S OWN CHECKS (the Unity repo's files, run by dotnet)");
{
  const sections = ["A1", "A2", "A4", ...(WITH_A6 ? ["A6"] : [])];
  const run = spawnSync("dotnet", ["run", "-c", "Release", "--", ...sections], { cwd: RUNNER, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const out = (run.stdout ?? "") + (run.stderr ?? "");
  for (const line of out.split("\n")) if (/^\s*CHECK .*FAIL/.test(line)) console.log("    " + line.trim());
  const result = out.match(/RESULT: (PASS|FAIL) \((\d+) passed, (\d+) failed\)/);
  check(`the played-match engine's checks pass (${sections.join(", ")})`, run.status === 0 && result?.[1] === "PASS", result ? result[0] : out.slice(-600));
  if (WITH_A6) {
    const table = out.split("\n").filter((l) => /^\s*\|/.test(l));
    if (table.length) console.log(table.map((l) => "    " + l.trim()).join("\n"));
  }
}

// ── 2. A5: the difficulty in the court's payload ─────────────────────────────
console.log("\n2. A5: /unity/match-state SENDS THE CAREER'S DIFFICULTY");
if (!fs.existsSync(SERVER)) { console.error(`[played-match] FAILED: ${SERVER} not built.`); process.exit(1); }
fs.copyFileSync(SHIPPED, DB);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: requireElectronBinary(REPO), out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: DB, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "played-match-secret" },
});
{
  const deadline = Date.now() + 60000;
  let up = false;
  while (Date.now() < deadline) { try { await fetch(`${BASE}/health`); up = true; break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  if (!up) { console.error("[played-match] server never came up"); console.error(fs.readFileSync(path.join(WORK, "server.log"), "utf8").slice(-3000)); process.exit(1); }
}

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
  const created = await api("POST", "/careers", { managerFaceId: 8, slotNumber: 1, managerName: name, managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", ...(gameDifficulty ? { gameDifficulty } : {}), primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  await startCareer(async (m, p, b) => (m === "POST" && p === "/careers" ? created : api(m, p, b)), {});
  const teamId = (await api("GET", "/team")).data?.id;
  const cid = q(`SELECT id FROM career_saves WHERE team_id = ?`, teamId)[0]?.id;
  return { api, teamId, cid };
}

/** Advance the calendar to the career's first match day: its match id. */
async function firstMatch(api) {
  for (let i = 0; i < 200; i++) {
    const adv = await api("POST", "/calendar/advance", {});
    if (adv.status >= 400) return null;
    const id = adv.data?.matchDay?.matchId ?? (adv.data?.blocked === "pending_match" ? adv.data.pendingMatchId : null);
    if (id != null) return id;
  }
  return null;
}

const careers = [];
try {
  for (const [label, d] of [["Easy", "easy"], ["Medium", "medium"], ["Hard", "hard"], ["Before difficulty", null]]) {
    const c = await career(`Played ${label}`, d ?? "hard");
    if (d == null) w(`UPDATE career_saves SET game_difficulty = NULL WHERE id = ?`, c.cid);   // a career made before difficulty: no value
    const matchId = await firstMatch(c.api);
    const st = await c.api("GET", `/unity/match-state?careerSaveId=${c.cid}&matchId=${matchId}`);
    const want = d ?? "medium";
    check(`${label}: /unity/match-state says gameDifficulty "${want}"`, st.status === 200 && st.data?.gameDifficulty === want,
      `career ${c.cid}, match ${matchId}: HTTP ${st.status}, gameDifficulty ${JSON.stringify(st.data?.gameDifficulty)}, players ${st.data?.players?.length}`);
    careers.push({ label, want, cid: c.cid, matchId, api: c.api });
  }
  // 1.2 B3: each player's nation, for the walk-on's lower third (career players and pool players alike).
  {
    const c0 = careers[1];
    const st = await c0.api("GET", `/unity/match-state?careerSaveId=${c0.cid}&matchId=${c0.matchId}`);
    const ps = st.data?.players ?? [];
    check("/unity/match-state sends each player's nation (B3: the walk-on's lower third)", ps.length === 4 && ps.every((p) => typeof p.nationality === "string" && p.nationality.length > 0),
      ps.map((p) => `${p.name} (${p.nationality})`).join(", "));
  }
  const src = fs.readFileSync(path.join(REPO, "artifacts", "api-server", "src", "routes", "unity.ts"), "utf8");
  check("the Empire Nations Cup payload sends it too (same route, same function)", /res\.json\(\{ \.\.\.state, gameDifficulty: gameDifficultyOf\(career\.gameDifficulty\) \}\)/.test(src));

  // ── 3. The court reads it (Unity, batch mode) ───────────────────────────────
  if (WITH_UNITY) {
    console.log("\n3. THE COURT PLAYS AT IT (Unity batch mode, reading this server)");
    for (const c of careers.slice(0, 3)) {
      const outName = `a5-${c.want}.txt`;
      const log = path.join(PROOF_DIR, "A5", `a5-${c.want}-unity.log`);
      fs.mkdirSync(path.dirname(log), { recursive: true });
      const r = spawnSync(UNITY_EXE, ["-batchmode", "-projectPath", UNITY_REPO, "-executeMethod", "PlayedMatchPlayProof.Run",
        "-proofDir", PROOF_DIR, "-section", "A5", "-out", outName, "-points", "6", "-expect", c.want,
        "-apiBase", `http://localhost:${PORT}`, "-careerSaveId", String(c.cid), "-matchId", String(c.matchId), "-logFile", log], { encoding: "utf8", timeout: 30 * 60 * 1000 });
      const text = fs.existsSync(path.join(PROOF_DIR, "A5", outName)) ? fs.readFileSync(path.join(PROOF_DIR, "A5", outName), "utf8") : "";
      for (const line of text.split("\n")) if (/CHECK|A5:|timing windows/.test(line)) console.log("    " + line.trim());
      check(`${c.label}: the Unity court read the career's match and played at ${c.want} (PlayedMatchPlayProof)`, r.status === 0 && /RESULT: PASS/.test(text), `exit ${r.status}; ${text.match(/RESULT: .*/)?.[0] ?? "no result"}`);
    }
  }
  // ── 4. A6: a whole played match, reported and paid like any other ──────────
  if (args.includes("--unity-full")) {
    console.log("\n4. A6: A WHOLE PLAYED MATCH ON THE COURT, REPORTED THROUGH MatchReporter, RECORDED AND PAID");
    const c = careers.find((x) => x.want === "medium" && x.label === "Medium");
    const api = c.api;   // the Medium career's own session, as the game's page has it
    const teamBefore = (await api("GET", "/team")).data;
    const pairBefore = q(`SELECT player_id, fitness, fatigue FROM career_player_state WHERE career_save_id = ? AND team_id = ? ORDER BY player_id`, c.cid, teamBefore.id);
    const watch = await api("POST", `/matches/${c.matchId}/watch`, {});
    check("the match is being watched (in progress), as the court page does before it plays", watch.status === 200, `HTTP ${watch.status}`);
    const log = path.join(PROOF_DIR, "A6", "a6-played-on-server-unity.log");
    fs.mkdirSync(path.dirname(log), { recursive: true });
    const r = spawnSync(UNITY_EXE, ["-batchmode", "-projectPath", UNITY_REPO, "-executeMethod", "PlayedMatchPlayProof.Run",
      "-proofDir", PROOF_DIR, "-section", "A6", "-out", "a6-played-on-server.txt",
      "-apiBase", `http://localhost:${PORT}`, "-careerSaveId", String(c.cid), "-matchId", String(c.matchId), "-logFile", log], { encoding: "utf8", timeout: 45 * 60 * 1000 });
    const text = fs.existsSync(path.join(PROOF_DIR, "A6", "a6-played-on-server.txt")) ? fs.readFileSync(path.join(PROOF_DIR, "A6", "a6-played-on-server.txt"), "utf8") : "";
    const unityLog = fs.existsSync(log) ? fs.readFileSync(log, "utf8") : "";
    const court = text.match(/match: (\d)-(\d) \(([^)]*)\)/);
    check("the court played the whole match (PlayedMatchPlayProof)", r.status === 0 && /RESULT: PASS/.test(text), `exit ${r.status}; ${text.match(/RESULT: .*/)?.[0] ?? "no result"}; ${court?.[0] ?? ""}`);
    check("MatchReporter sent the result, and the game took it (POST /api/unity/match-result ok)", /\[MatchReporter\] POST \/api\/unity\/match-result ok/.test(unityLog) && !/RESULT NOT SENT/.test(unityLog),
      (unityLog.match(/\[MatchReporter\][^\n]*/g) ?? []).slice(-2).join(" | "));
    const m = ((await api("GET", "/matches")).data ?? []).find((x) => x.id === c.matchId);
    const sets = (m?.sets ?? []).map((s) => `${s.home}-${s.away}`).join(", ");
    check("the game recorded exactly the court's score", m?.status === "completed" && court && sets === court[3] && m.homeScore === Number(court[1]) && m.awayScore === Number(court[2]),
      `court ${court?.[1]}-${court?.[2]} (${court?.[3]}); game ${m?.status} ${m?.homeScore}-${m?.awayScore} (${sets})`);
    const teamAfter = (await api("GET", "/team")).data;
    const weHome = m?.homeTeamId === teamBefore.id;
    const weWon = m && (weHome ? m.homeScore > m.awayScore : m.awayScore > m.homeScore);
    const roundName = (await api("GET", "/calendar/round-names")).data?.names?.[String(m?.round)]?.name;
    const prize = ((await api("GET", "/finances")).data ?? []).filter((t) => t.category === "prize_money" && !!roundName && t.description.includes(`${roundName} vs `));
    check(`through the Sim Result path (completeMatch): the ${weWon ? "win" : "loss"} counted and ${weWon ? "the winner's prize is on the ledger" : "no prize"}`,
      (weWon ? teamAfter.wins === teamBefore.wins + 1 && prize.length === 1 : teamAfter.losses === teamBefore.losses + 1 && prize.length === 0),
      `wins ${teamBefore.wins} -> ${teamAfter.wins}, losses ${teamBefore.losses} -> ${teamAfter.losses}; prize lines ${prize.map((t) => `${t.description} $${t.amount}`).join("; ") || "none"}; balance ${teamBefore.budget} -> ${teamAfter.budget}`);
    const pairAfter = q(`SELECT player_id, fitness, fatigue FROM career_player_state WHERE career_save_id = ? AND team_id = ? ORDER BY player_id`, c.cid, teamBefore.id);
    const changed = pairAfter.filter((a) => { const b = pairBefore.find((x) => x.player_id === a.player_id); return b && (b.fitness !== a.fitness || b.fatigue !== a.fatigue); });
    check("and the match's cost to the players (fitness, fatigue) was charged, as for a simmed match", changed.length >= 2,
      changed.map((a) => { const b = pairBefore.find((x) => x.player_id === a.player_id); return `player ${a.player_id}: fitness ${b.fitness}->${a.fitness}, fatigue ${b.fatigue}->${a.fatigue}`; }).join("; "));
  }
} finally {
  await stopServer(child);
}

console.log("\n" + "=".repeat(72));
console.log(`  ${failures === 0 ? "PASS" : "FAIL"}: ${checks - failures}/${checks} checks`);
console.log("=".repeat(72));
process.exit(failures === 0 ? 0 : 1);
