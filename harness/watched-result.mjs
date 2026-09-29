/**
 * Unity match brief (29 Sep), item 4 — when the player watches, the 3D court's
 * result is the result.
 *
 * Rob, 29 Sep: the court showed Sydney 17 - Barcelona 21; the game recorded a
 * 2-1 WIN. The server's own "tick engine" played a second match alongside the
 * court and recorded that. It is deleted. Now:
 *   POST /matches/:id/watch        the match is "in_progress" (being watched)
 *   POST /unity/match-progress     the court's score after every point
 *   POST /unity/match-result       the court's final score, recorded through
 *                                  completeMatch, the path Sim Result uses
 *   POST /matches/:id/leave        left early: finished from the last score
 *   boot                           a match left in_progress (window closed)
 *                                  is finished from the last score
 *
 * Asserted: a posted result is recorded exactly (sets, winner, win/loss, the
 * prize on the ledger); an illegal score is refused and changes nothing;
 * posting the same result twice changes nothing; while watched, Sim Result
 * refuses and the day cannot move on; leaving at 7-4 in set 2 (set 1 won 11-8)
 * records set 1 as 11-8 and set 2 finished from 7-4; and a match whose window
 * was closed at 3-2 is finished from 3-2 on the next boot.
 *
 * Usage: node harness/watched-result.mjs
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
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-watched-result-"));
const PORT = 4918;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log("  UNITY 4: THE 3D COURT'S RESULT COUNTS");
console.log("=".repeat(72));
if (!fs.existsSync(SERVER)) { console.error(`[watched-result] FAILED: ${SERVER} not built.`); process.exit(1); }

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
/** The court calls without the app's session, as the Unity build in its iframe does. */
async function court(p, body) {
  const res = await fetch(BASE + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const text = await res.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

const dbFile = path.join(WORK, "watched.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
function boot(tag) {
  const out = fs.openSync(path.join(WORK, `server-${tag}.log`), "w");
  return { out, child: forkServer({
    server: SERVER, electron: ELECTRON, out,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "watched-result" },
  }) };
}
async function ready() {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) return; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
}
const matchRow = async (id) => (await api("GET", "/matches")).data?.find((m) => m.id === id);
const team = async () => (await api("GET", "/team")).data;
const ledgerFor = async (round) => ((await api("GET", "/finances")).data ?? []).filter((t) => t.category === "prize_money" && new RegExp(`Round ${round}\\b`).test(t.description));
const fmtSets = (sets) => (sets ?? []).map((s) => `${s.home}-${s.away}`).join(", ");

let srv = boot("1");
try {
  await ready();
  const prof = await api("POST", "/profiles", { name: "Watched Result" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", {
    slotNumber: 1, managerName: "Watched Result", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0,
  });
  const careerSaveId = ((await api("GET", "/careers")).data?.saves ?? []).find((s) => s.slotNumber === 1)?.id;

  // ── A. A watched match's result is the court's ──────────────────────────
  console.log("\nA. THE COURT'S RESULT IS RECORDED");
  const m1 = (await api("POST", "/calendar/next-match")).data?.matchDay?.matchId;
  const w1 = await api("POST", `/matches/${m1}/watch`, {});
  check("watching puts the match in progress", w1.status === 200 && (await matchRow(m1))?.status === "in_progress", `HTTP ${w1.status}`);

  const sim = await api("POST", `/matches/${m1}/simulate`);
  check("while it is watched, Sim Result refuses to complete it", sim.status === 409 && sim.data?.beingWatched === true, `HTTP ${sim.status}`);
  const adv = await api("POST", "/calendar/advance");
  check("and the day cannot move on past it", adv.data?.blocked === "pending_match", JSON.stringify(adv.data?.blocked));

  const prog = await court("/unity/match-progress", { careerSaveId, matchId: m1, sets: [{ home: 9, away: 11 }], current: { home: 4, away: 6 } });
  check("the court's score after a point is taken", prog.status === 200, `HTTP ${prog.status}`);

  const bad = await court("/unity/match-result", { careerSaveId, matchId: m1, sets: [{ home: 9, away: 11 }, { home: 11, away: 10 }, { home: 11, away: 7 }] });
  const afterBad = await matchRow(m1);
  check("an illegal score (11-10) is refused and changes nothing", bad.status === 400 && afterBad?.status === "in_progress", `HTTP ${bad.status}; status ${afterBad?.status}`);
  const wrongCareer = await court("/unity/match-result", { careerSaveId: careerSaveId + 999, matchId: m1, sets: [{ home: 9, away: 11 }, { home: 11, away: 7 }, { home: 11, away: 8 }] });
  check("a result for another career is refused", wrongCareer.status === 404, `HTTP ${wrongCareer.status}`);

  const before = await team();
  const SETS = [{ home: 9, away: 11 }, { home: 11, away: 7 }, { home: 13, away: 11 }];
  const post = await court("/unity/match-result", { careerSaveId, matchId: m1, sets: SETS });
  const rec = await matchRow(m1);
  const after = await team();
  const prize1 = await ledgerFor(rec?.round);
  check("the posted result is recorded exactly: sets, 2-1 to the club",
    post.status === 200 && rec?.status === "completed" && rec.homeScore === 2 && rec.awayScore === 1 && fmtSets(rec.sets) === "9-11, 11-7, 13-11",
    `HTTP ${post.status}; ${rec?.status} ${rec?.homeScore}-${rec?.awayScore} (${fmtSets(rec?.sets)})`);
  check("through the Sim Result path: one more win, the winner's prize on the ledger",
    after.wins === before.wins + 1 && after.losses === before.losses && prize1.length === 1 && Number(after.budget) - Number(before.budget) === Number(prize1[0]?.amount),
    `wins ${before.wins} -> ${after.wins}; ledger ${prize1.map((t) => `${t.description} $${t.amount}`).join("; ")}; balance +$${Number(after.budget) - Number(before.budget)}`);

  const again = await court("/unity/match-result", { careerSaveId, matchId: m1, sets: SETS });
  const after2 = await team();
  const prize2 = await ledgerFor(rec?.round);
  check("posting the same result twice changes nothing",
    again.status === 200 && again.data?.alreadyRecorded === true && after2.wins === after.wins && Number(after2.budget) === Number(after.budget) && prize2.length === 1,
    `HTTP ${again.status}; wins ${after2.wins}; balance $${after2.budget}; ${prize2.length} prize line(s)`);
  const other = await court("/unity/match-result", { careerSaveId, matchId: m1, sets: [{ home: 5, away: 11 }, { home: 7, away: 11 }] });
  check("a different result for a recorded match is refused", other.status === 409, `HTTP ${other.status}`);

  // ── B. Leaving the court early at 7-4 in set 2 ──────────────────────────
  console.log("\nB. LEFT EARLY AT 7-4 IN SET 2");
  await api("POST", "/calendar/skip-match");
  const m2 = (await api("POST", "/calendar/next-match")).data?.matchDay?.matchId;
  await api("POST", `/matches/${m2}/watch`, {});
  const p2 = await court("/unity/match-progress", { careerSaveId, matchId: m2, sets: [{ home: 11, away: 8 }], current: { home: 7, away: 4 } });
  const left = await api("POST", `/matches/${m2}/leave`);
  const r2 = await matchRow(m2);
  const s2 = r2?.sets ?? [];
  check("leaving finishes and records the match", p2.status === 200 && left.status === 200 && r2?.status === "completed", `HTTP ${left.status}; ${r2?.status}`);
  check("set 1 is the court's 11-8", s2[0]?.home === 11 && s2[0]?.away === 8, fmtSets(s2));
  check("set 2 was played on from 7-4 (both sides at least there), to a legal finish",
    s2[1] && s2[1].home >= 7 && s2[1].away >= 4 && ((s2[1].home >= 11 && s2[1].home - s2[1].away >= 2) || (s2[1].away >= 11 && s2[1].away - s2[1].home >= 2)),
    `${fmtSets(s2)}; finished from ${JSON.stringify(left.data?.finishedFrom)}`);
  check("the response says what it was finished from",
    JSON.stringify(left.data?.finishedFrom) === JSON.stringify({ finished: [{ home: 11, away: 8 }], current: { home: 7, away: 4 } }));

  // ── C. The window closed mid-match ─────────────────────────────────────
  console.log("\nC. THE WINDOW CLOSED AT 3-2");
  await api("POST", "/calendar/skip-match");
  const m3 = (await api("POST", "/calendar/next-match")).data?.matchDay?.matchId;
  await api("POST", `/matches/${m3}/watch`, {});
  await court("/unity/match-progress", { careerSaveId, matchId: m3, sets: [], current: { home: 3, away: 2 } });
  check("mid-match, the match is in progress", (await matchRow(m3))?.status === "in_progress");
  srv.child.kill("SIGKILL");                        // the window's X: no orderly shutdown
  await new Promise((r) => setTimeout(r, 800));
  try { fs.closeSync(srv.out); } catch { /* closed */ }
  srv = boot("2");
  await ready();
  cookie = "";
  await api("POST", `/profiles/${prof.data.id}/select`);
  const r3 = await matchRow(m3);
  const s3 = r3?.sets ?? [];
  check("on the next launch the match is finished, never left in progress", r3?.status === "completed", `${r3?.status} ${r3?.homeScore}-${r3?.awayScore}`);
  check("from the last score the court sent (3-2 in set 1)", s3[0] && s3[0].home >= 3 && s3[0].away >= 2 && s3.length >= 2, fmtSets(s3));
  // The logger writes through a worker thread: give the boot line time to land.
  let log = "";
  for (let i = 0; i < 40; i++) {
    log = fs.readFileSync(path.join(WORK, "server-2.log"), "utf8");
    if (/finished from their last score/.test(log)) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  check("and the boot log says so", /finished from their last score/.test(log) && new RegExp(`"matchId":\\s*${m3}\\b`).test(log));
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  try { await stopServer(srv.child); } catch { /* stopped */ }
  try { fs.closeSync(srv.out); } catch { /* closed */ }
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
