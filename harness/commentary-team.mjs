/**
 * 1.2 section 5 (Rob, 28 Nov 2026): the commentary team, on a copy of the starter DB.
 *
 *   - Rob's recording sheet (docs/update-1.2/COMMENTARY-TEAM-LINES.md) and the court's data
 *     (StreamingAssets/commentary/TEAM.json) agree line by line: every line in the sheet is in the data
 *     with the same file, voice, moment and words, and nothing else is; 57 new lines in all (15 for the
 *     sideline reporter, 17 for each guest, 8 for the residents); and each line names the clip the court
 *     will play once Rob records it (missing today: skipped in silence);
 *   - a career match's data has the team: the sideline reporter on, a guest at random per match;
 *   - an exhibition's: the guest the pick screen chose (or none) and the reporter on or off; a guest that
 *     is not a key is refused;
 *   - with --unity, the court plays a whole match in each (Assets/Editor/CommentaryTeamProof.cs, 3x): a
 *     career match, an exhibition with Roxy and the reporter, one with Kai and no reporter, and one with
 *     nobody but the residents; who would speak at each moment, with the clips missing, and pictures of
 *     the booth and the reporter (proof/5).
 *
 * Usage: node harness/commentary-team.mjs [--unity]
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { startCareer } from "./harness-club.mjs";
import { sheetRows, build, DATA, WHEN } from "../scripts/commentary-team-data.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-commentary-team-"));
const DB = path.join(WORK, "save.sqlite");
const PORT = 4971;
const BASE = `http://localhost:${PORT}/api`;
const UNITY = process.argv.includes("--unity");
const UNITY_EXE = "C:/Program Files/Unity/Hub/Editor/6000.3.16f1/Editor/Unity.exe";
const UNITY_PROJECT = process.env.VBE_UNITY_REPO ?? "C:/Users/rbonn/Game_Dev/VolleyBall Empire/volleyball";
const PROOF = path.join(REPO, "docs", "update-1.2", "proof");

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  1.2 SECTION 5: THE COMMENTARY TEAM");
console.log("=".repeat(72));

// ── the sheet and the data ──────────────────────────────────────────────────
const rows = sheetRows();
const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const inData = new Map();
for (const l of data.sideline.lines) inData.set(l.file, { voice: data.sideline.voice, when: l.when, text: l.text });
for (const g of data.guests) {
  for (const l of g.lines) inData.set(l.file, { voice: g.voice, when: l.when, text: l.text });
  if (g.introducedBy) inData.set(g.introducedBy.file, { voice: g.introducedBy.voice, when: `guest-${g.key}`, text: g.introducedBy.text });
}
for (const h of data.handovers) inData.set(h.file, { voice: h.voice, when: h.when, text: h.text });
const clipsDir = path.dirname(DATA);
console.log("\n  EVERY LINE IN ROB'S SHEET, AND THE CLIP THE COURT EXPECTS FOR IT");
let matched = 0, recorded = 0;
for (const r of rows) {
  const d = inData.get(r.file);
  const text = r.section.startsWith("The residents") ? r.cells[2] : r.cells[1];
  const have = fs.existsSync(path.join(clipsDir, r.file));
  if (have) recorded++;
  const ok = d && d.text === text && d.voice === r.file.split("_")[0];
  if (ok) matched++;
  console.log(`    ${ok ? "ok " : "BAD"} ${r.file.padEnd(24)} ${(d?.when ?? "?").padEnd(13)} ${have ? "recorded" : "not recorded: skipped in silence"}  "${text}"`);
}
check("every line in the sheet is in the court's data, same file, voice and words", matched === rows.length, `${matched} of ${rows.length}`);
check("and the data has nothing the sheet does not", inData.size === rows.length, `${inData.size} in TEAM.json, ${rows.length} in the sheet`);
check("57 new lines: 15 sideline, 17 Roxy, 17 Kai, 8 resident hand-overs",
  rows.length === 57 && data.sideline.lines.length === 15 && data.guests.map((g) => g.lines.length).join() === "17,17" && data.handovers.length + data.guests.filter((g) => g.introducedBy).length === 8,
  `${data.sideline.lines.length}, ${data.guests.map((g) => `${g.name} ${g.lines.length}`).join(", ")}, ${data.handovers.length + data.guests.filter((g) => g.introducedBy).length}`);
check("every line has a moment the court knows", [...inData.values()].every((d) => d.when && (Object.values(WHEN).includes(d.when) || d.when === "intro" || d.when.startsWith("guest-"))));
check("TEAM.json is up to date with the sheet (scripts/commentary-team-data.mjs)", fs.readFileSync(DATA, "utf8") === JSON.stringify(build(rows), null, 2) + "\n");
console.log(`  (${recorded} of ${rows.length} recorded so far)`);

// ── a career match's data, and an exhibition's ──────────────────────────────
fs.copyFileSync(SHIPPED, DB);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({ server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: DB, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "commentary-team", STARTER_DB_PATH: SHIPPED } });
let cookie = "";
async function call(method, p, body) {
  const r = await fetch(BASE + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  let d; const t = await r.text(); try { d = JSON.parse(t); } catch { d = t; }
  return { status: r.status, data: d };
}
try {
  for (let i = 0; i < 360; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }
  const prof = (await call("POST", "/profiles", { name: "Commentary Team" })).data;
  await call("POST", `/profiles/${prof.id}/select`);
  const club = (await call("GET", "/club-templates")).data.clubs.find((c) => c.name === "Sydney Riptide");
  await startCareer(call, { managerFaceId: 8, slotNumber: 1, managerName: "Commentary Team", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  let matchId = null;
  for (let i = 0; i < 200 && matchId == null; i++) {
    const adv = await call("POST", "/calendar/advance", {});
    if (adv.status >= 400) break;
    matchId = adv.data?.matchDay?.matchId ?? (adv.data?.blocked === "pending_match" ? adv.data.pendingMatchId : null);
  }
  const careerSaveId = (await call("GET", "/careers")).data?.activeCareerSaveId;
  console.log("\n  THE COURT'S VIEW OF A CAREER MATCH, AND OF AN EXHIBITION");
  const st = (await call("GET", `/unity/match-state?careerSaveId=${careerSaveId}&matchId=${matchId}`)).data;
  check("a career match: the sideline reporter on, a guest at random per match (the court picks by its id)", st.commentary?.sideline === true && st.commentary?.guest === "random", JSON.stringify(st.commentary));

  const o = (await call("GET", "/exhibition/options")).data;
  const t = o.teams[0], u = o.teams[1];
  const team = (x) => ({ poolTeamId: x.id, name: x.name, primary: x.primary, secondary: x.secondary, players: x.players.map((id) => ({ poolPlayerId: id, name: o.players.find((p) => p.id === id).name, wear: [] })) });
  const game = { home: team(t), away: team(u), venue: "oceania", timeOfDay: "midday", weather: "sunny", difficulty: "medium", seats: [-1, -1, -1, -1] };
  for (const [what, commentary, want] of [
    ["Kai in the booth, the reporter off", { sideline: false, guest: "kai" }, { sideline: false, guest: "kai" }],
    ["no guest, the reporter on", { sideline: true, guest: "none" }, { sideline: true, guest: "" }],
    ["with no commentary choice sent (the reporter on, no guest)", undefined, { sideline: true, guest: "" }],
  ]) {
    const made = await call("POST", "/exhibition", commentary ? { ...game, commentary } : game);
    const es = (await call("GET", `/unity/exhibition-state?id=${made.data.id}`)).data;
    check(`an exhibition, ${what}`, JSON.stringify(es.commentary) === JSON.stringify(want), JSON.stringify(es.commentary));
  }
  const bad = await call("POST", "/exhibition", { ...game, commentary: { sideline: "yes", guest: "Roxy Calderwood" } });
  check("refused: a commentary that is not a guest key and an on or off", bad.status === 400, `${bad.status} ${JSON.stringify(bad.data)}`);

  if (UNITY) {
    console.log("\n  THE COURT PLAYS A WHOLE MATCH WITH EACH TEAM (Unity, batch, 3x)");
    // The career match is marked watched, as the game's Watch Match does, so the court may report its progress.
    await call("POST", `/matches/${matchId}/watch`, {});
    const runs = [["career", null, "the reporter on, a guest at random"]];
    for (const [tag, commentary, what] of [["roxy", { sideline: true, guest: "roxy" }, "Roxy and the reporter"], ["kai", { sideline: false, guest: "kai" }, "Kai, no reporter"], ["residents", { sideline: false, guest: "none" }, "the residents alone"]]) {
      const made = await call("POST", "/exhibition", { ...game, commentary });
      runs.push([tag, made.data.id, what]);
    }
    for (const [tag, exId, what] of runs) {
      const log = path.join(WORK, `unity-${tag}.log`).replace(/\\/g, "/");
      const args = ["-batchmode", "-projectPath", UNITY_PROJECT, "-executeMethod", "CommentaryTeamProof.Run", "-proofDir", PROOF, "-tag", tag, "-apiBase", `http://localhost:${PORT}`,
        "-commentaryDir", path.dirname(DATA), "-logFile", log, ...(exId ? ["-exhibitionId", exId] : ["-careerSaveId", String(careerSaveId), "-matchId", String(matchId)])];
      const r = spawnSync(UNITY_EXE, args, { encoding: "utf8", timeout: 1500000 });
      const file = path.join(PROOF, "5", `team-${tag}.txt`);
      const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
      const booth = /\[Booth\] (.*)/.exec(text)?.[1] ?? "";
      const lines = text.split("\n").filter((l) => /\[Team\] (walk-on|drinks break|match won|after the)/.test(l));
      check(`${tag} (${what}): the court played the match through`, r.status === 0 && /SUMMARY/.test(text), `exit ${r.status}; ${text.split("\n").find((l) => /SUMMARY/.test(l))?.trim() ?? ""}`);
      const guest = tag === "roxy" ? "Roxy Calderwood" : tag === "kai" ? "Kai Brennock" : null;
      if (tag === "career") check("  the booth: Kailey, a guest (Roxy or Kai, the match's pick) and Hukum; Nicole on the sand", /Kailey/.test(booth) && /Roxy Calderwood|Kai Brennock/.test(booth) && /Hukum/.test(booth) && /on the sand: Nicole Dupont/.test(booth), booth);
      if (guest) check(`  the booth: Kailey, ${guest} and Hukum${tag === "roxy" ? "; Nicole on the sand" : "; nobody on the sand"}`, booth.includes(guest) && (tag === "roxy") === /on the sand/.test(booth), booth);
      if (tag === "residents") check("  the booth: Kailey, an empty seat, Hukum; nobody on the sand", /empty \(no guest\)/.test(booth) && !/on the sand/.test(booth), booth);
      const sideline = lines.filter((l) => /Nicole Dupont/.test(l)).length, guestLines = lines.filter((l) => /after the residents/.test(l)).length;
      if (tag === "career" || tag === "roxy") check("  Nicole decided at the walk-on, every drinks break and the match won; the guest after the residents' calls, never two in three points", sideline >= 3 && guestLines >= 2 && lines.some((l) => /walk-on: (Roxy|Kai)/.test(l)), `${sideline} sideline lines, ${guestLines} guest lines`);
      if (tag === "kai") check("  no reporter: none of her lines; Kai after the residents' calls", sideline === 0 && guestLines >= 2, `${sideline} sideline lines, ${guestLines} guest lines`);
      if (tag === "residents") check("  the residents alone: no guest line, no reporter's line", sideline === 0 && guestLines === 0, `${sideline}, ${guestLines}`);
      check("  every line not recorded is skipped in silence, nothing played", lines.length > 0 ? lines.every((l) => /skipped in silence|introduces|only once|is off/.test(l)) && /0 lines played/.test(text) : tag === "residents", `${lines.length} decisions`);
    }
  }
} catch (e) {
  failures++; console.log(`  FAIL  ${e?.stack ?? e}`);
} finally {
  await stopServer(child);
}
console.log(`\n  ${checks - failures}/${checks} checks passed`);
console.log(failures ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(failures ? 1 : 0);
