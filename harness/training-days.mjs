/**
 * Unity match brief (29 Sep), item 19 — training takes game time (Rob's rule).
 *
 * Before: a scheduled session had a "Complete" button; one click finished it at
 * once and applied its gains (fatigue 9% -> 15%, morale 75% -> 76%, "DONE").
 * Rob: "no one trains in an instant."
 *
 * Now every programme has a length in GAME days (Power Camp 7, Agility Camp 5,
 * Serving Academy 5, Defensive Systems 5, Conditioning 7, Recovery Program 3);
 * a session starts on the game date it is scheduled, runs as the calendar
 * advances, and its gains (XP, stats, morale, fatigue) are applied once, when it
 * finishes. "Complete" is gone; a running session may be cancelled (no gains).
 *
 * Asserted on a starter-DB copy (a new career on 1 Jan: no match for weeks):
 * schedule an Agility Camp; after 4 days nothing has changed; on the 5th its
 * gains land, exactly once; a cancelled session gives nothing; the Complete
 * endpoint is gone; the page shows lengths, finish dates, days left and Cancel.
 *
 * Usage: node harness/training-days.mjs
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
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-training-days-"));
const PORT = 4927;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  UNITY 19: TRAINING TAKES GAME DAYS");
console.log("=".repeat(72));
if (!fs.existsSync(SERVER)) { console.error(`[training-days] FAILED: ${SERVER} not built.`); process.exit(1); }

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
const dbFile = path.join(WORK, "days.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "training-days" },
});

try {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  const prof = await api("POST", "/profiles", { name: "Days Test" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", {
    slotNumber: 1, managerName: "Days Test", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0,
  });
  const roster = async () => (await api("GET", "/team/roster")).data;
  const squad = (r) => (Array.isArray(r) ? r : [...(r?.starters ?? []), ...(r?.interchange ?? []), ...(r?.reserves ?? []), ...(r?.players ?? [])]);
  const me = async (id) => squad(await roster()).find((p) => p.id === id);
  const sessions = async () => (await api("GET", "/training")).data ?? [];
  const advance = async (n) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...((await api("POST", "/calendar/advance", {})).data?.events ?? [])); return ev; };
  const today = async () => (await api("GET", "/calendar")).data?.currentDate;

  const P = squad(await roster())[0];
  const start = await today();
  const sched = await api("POST", "/training", { playerId: P.id, type: "Agility Camp", durationHours: 2 });
  const S = sched.data;
  const expectEnd = (() => { const d = new Date(`${start}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 5); return d.toISOString().slice(0, 10); })();
  check("an Agility Camp: 5 game days, starting today, finishing 5 days on", sched.status === 201 && S.lengthDays === 5 && S.scheduledAt === start && S.finishesOn === expectEnd && S.daysLeft === 5,
    `starts ${S?.scheduledAt}, finishes ${S?.finishesOn}, ${S?.daysLeft} days left`);
  const b0 = await me(P.id);
  const complete = await api("POST", `/training/${S.id}/complete`);
  check("there is no instant Complete any more", complete.status === 404, `POST /training/${S.id}/complete -> ${complete.status}`);

  await advance(4);
  const b4 = await me(P.id);
  const s4 = (await sessions()).find((s) => s.id === S.id);
  check("after 4 days: still running, 1 day left, and nothing gained yet",
    s4.status === "scheduled" && s4.daysLeft === 1 && s4.progressPct === 80 && !s4.result
    && b4.trainingPoints === b0.trainingPoints && b4.speed === b0.speed && b4.defense === b0.defense,
    `points ${b0.trainingPoints} -> ${b4.trainingPoints}, speed ${b0.speed} -> ${b4.speed}; ${s4.daysLeft} left, ${s4.progressPct}%`);
  const ev5 = await advance(1);
  const b5 = await me(P.id);
  const s5 = (await sessions()).find((s) => s.id === S.id);
  check("on the 5th day it finishes and its gains land: the XP it records, the day's events say so",
    s5.status === "completed" && s5.result?.xpGained > 0 && b5.trainingPoints === b0.trainingPoints + s5.result.xpGained
    && ev5.some((e) => e.startsWith(`Training finished: ${P.name}, Agility Camp`)),
    `points ${b4.trainingPoints} -> ${b5.trainingPoints} (+${s5.result?.xpGained} XP), fatigue ${s5.result?.fatigueBefore} -> ${s5.result?.fatigueAfter}; "${ev5.find((e) => e.startsWith("Training")) ?? ""}"`);
  await advance(3);
  const b8 = await me(P.id);
  check("...exactly once", b8.trainingPoints === b5.trainingPoints, `points ${b5.trainingPoints} -> ${b8.trainingPoints} three days later`);

  // Cancel: no gains.
  const c = (await api("POST", "/training", { playerId: P.id, type: "Recovery Program", durationHours: 2 })).data;
  await advance(2);
  const cancel = await api("POST", `/training/${c.id}/cancel`);
  const c0 = await me(P.id);
  await advance(3);
  const c3 = await me(P.id);
  const cRow = (await sessions()).find((s) => s.id === c.id);
  check("a session cancelled after 2 of its 3 days gives nothing", cancel.status === 200 && cRow.status === "cancelled" && !cRow.result && c3.trainingPoints === c0.trainingPoints,
    `cancel ${cancel.status}, status ${cRow.status}, points ${c0.trainingPoints} -> ${c3.trainingPoints}`);
  const again = await api("POST", `/training/${c.id}/cancel`);
  check("a finished or cancelled session cannot be cancelled again", again.status === 409 && (await api("POST", `/training/${S.id}/cancel`)).status === 409);

  const page = fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/pages/training.tsx"), "utf8");
  check("the page: no Complete button; each row shows its length, finish date, days left and a Cancel button; scheduling shows the length",
    !/button-complete-/.test(page) && !/useCompleteTraining/.test(page) && /button-cancel-/.test(page) && /session-running-/.test(page) && /daysLeft/.test(page) && /session-when-/.test(page) && /program-days-/.test(page));
  const days = fs.readFileSync(path.join(REPO, "lib/db/src/schema/training-programs.ts"), "utf8");
  check("the lengths are Rob's: Power 7, Agility 5, Serving 5, Defensive 5, Conditioning 7, Recovery 3",
    [["Power Camp", 7], ["Agility Camp", 5], ["Serving Academy", 5], ["Defensive Systems", 5], ["Conditioning", 7], ["Recovery Program", 3]]
      .every(([n, d]) => new RegExp(`"${n}":\\s+${d},`).test(days)));
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
