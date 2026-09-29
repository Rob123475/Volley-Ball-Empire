/**
 * Unity match brief (29 Sep), item 17 — Staff and Medical Market scouting is
 * kept and shown (Rob's design, 29 Sep): "you may scout 3 nutritionists before
 * you hire one and you don't want to lose the info."
 *
 * Today's code (before this item): POST /staff/:id/scout (both markets use it)
 * costs $1,000 and sets career_staff_state.is_scout_revealed, so the reveal
 * already survived leaving the page and a relaunch; but the $1,000 left the
 * balance with no ledger row, the card's Scout button simply vanished (no
 * "Scouted" label), and a report never lapsed. Hired people already left the
 * market lists (the markets list only unhired staff).
 *
 * Asserted on a starter-DB copy: scout 3 people of one medical role, read the
 * market again (leaving the page) and after restarting the server on the same
 * save (a relaunch): all 3 still revealed, no second charge for a second scout;
 * each scout is on the ledger; hiring one of them works and she leaves the
 * market; the cards show a red "Scouted" label with Hire still usable; at season
 * end the unhired two are unrevealed again, the hired one keeps her report.
 *
 * Usage: node harness/staff-scouting.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healAllSquads } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-staff-scouting-"));
const PORT = 4925;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  UNITY 17: STAFF AND MEDICAL SCOUTING IS KEPT AND SHOWN");
console.log("=".repeat(72));
if (!fs.existsSync(SERVER)) { console.error(`[staff-scouting] FAILED: ${SERVER} not built.`); process.exit(1); }

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
const dbFile = path.join(WORK, "scouting.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
function read(q, ...a) { const d = new DatabaseSync(dbFile, { readOnly: true }); try { return d.prepare(q).all(...a); } finally { d.close(); } }
let out = fs.openSync(path.join(WORK, "server.log"), "w");
const start = () => forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "staff-scouting" },
});
async function up() {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) return; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
}
let child = start();

try {
  await up();
  const prof = await api("POST", "/profiles", { name: "Scout Test" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", {
    slotNumber: 1, managerName: "Scout Test", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0,
  });
  const teamId = (await api("GET", "/team")).data?.id;
  const careerSaveId = ((await api("GET", "/careers")).data?.saves ?? [])[0]?.id;
  const budget = async () => Number((await api("GET", "/team")).data?.budget);
  // Scouting needs a Scout, Head Coach or Assistant Coach on staff.
  if (!((await api("GET", "/staff")).data ?? []).some((s) => /scout|coach/i.test(s.role))) {
    const scout = ((await api("GET", "/staff/market?role=scout")).data ?? [])[0];
    await api("POST", "/staff", { staffId: scout.id, length: "6m" });
  }

  const medMarket = async () => (await api("GET", "/medical-staff/market")).data ?? [];
  const m0 = await medMarket();
  const byRole = {};
  for (const m of m0) (byRole[m.role] ??= []).push(m);
  const [role, people] = Object.entries(byRole).sort((a, b) => b[1].length - a[1].length)[0];
  const three = people.slice(0, 3);
  check("three unscouted people of one medical role on the market", three.length === 3 && three.every((m) => !m.isScoutRevealed), `${role}: ${three.map((m) => m.name).join(", ")}`);

  const b0 = await budget();
  for (const m of three) await api("POST", `/staff/${m.id}/scout`);
  const b1 = await budget();
  const ledger = read(`SELECT amount, description FROM finance_transactions WHERE team_id = ? AND category = 'scouting'`, teamId);
  check("3 scouts: $3,000, and each is on the ledger", b0 - b1 === 3000 && ledger.length === 3 && ledger.every((r) => Number(r.amount) === 1000), `balance ${b0} -> ${b1}; ${ledger.length} ledger rows`);
  const againScout = await api("POST", `/staff/${three[0].id}/scout`);
  check("scouting one again is refused, with no second charge", againScout.status === 400 && (await budget()) === b1, `${againScout.status}: ${againScout.data?.error}`);
  const revealed = (list) => three.every((t) => list.find((m) => m.id === t.id)?.isScoutRevealed === true);
  check("leaving the page and coming back: all 3 still revealed", revealed(await medMarket()));

  // A relaunch: the server stops and starts again on the same save.
  await stopServer(child);
  fs.closeSync(out); out = fs.openSync(path.join(WORK, "server2.log"), "w");
  child = start();
  await up();
  cookie = "";
  await api("POST", `/profiles/${prof.data.id}/select`);
  await api("POST", `/careers/${careerSaveId}/load`);
  const afterRelaunch = await medMarket();
  check("after a relaunch: all 3 still revealed, with their attributes", revealed(afterRelaunch)
    && three.every((t) => Object.keys(afterRelaunch.find((m) => m.id === t.id)?.attributes ?? {}).length > 0));

  const hire = await api("POST", "/medical-staff", { staffId: three[0].id, length: "2s" });   // still hers after the season ends
  const after = await medMarket();
  check("hiring one of them works, and she leaves the market", hire.status < 300 && !after.some((m) => m.id === three[0].id) && revealed(after.concat([{ ...three[0], isScoutRevealed: true }])),
    `hire ${hire.status}; market still lists her: ${after.some((m) => m.id === three[0].id)}`);

  const src = (p) => fs.readFileSync(path.join(REPO, p), "utf8");
  check("both markets show a red \"Scouted\" label on a scouted card, with Hire still there",
    ["staff-market.tsx", "medical-market.tsx"].every((f) => { const t = src(`artifacts/beach-volleyball/src/pages/${f}`); return /data-testid=\{`scouted-\$\{member\.id\}`\}/.test(t) && /Scouted/.test(t) && /text-red-600/.test(t) && /\? "Hiring…" :/.test(t); }));

  // Season end: the unhired two lapse; the hired one keeps everything.
  let rolled = false;
  for (let i = 0; i < 700 && !rolled; i++) {
    healAllSquads(dbFile);
    const r = await api("POST", "/calendar/advance", {});
    if (r.status >= 400) break;
    if (r.data?.blocked === "pending_match") { await api("POST", `/matches/${r.data.pendingMatchId}/simulate`); await api("POST", "/calendar/dismiss-match"); continue; }
    if (r.data?.matchDay?.matchId) { await api("POST", `/matches/${r.data.matchDay.matchId}/simulate`); await api("POST", "/calendar/dismiss-match"); }
    if (r.data?.seasonRollover && r.data.seasonRollover.kind !== "none") rolled = true;
  }
  const state = read(`SELECT staff_id AS id, team_id AS teamId, is_scout_revealed AS rev FROM career_staff_state WHERE career_save_id = ? AND staff_id IN (?, ?, ?)`,
    careerSaveId, three[0].id, three[1].id, three[2].id);
  const hired = state.find((r) => r.id === three[0].id);
  const others = state.filter((r) => r.id !== three[0].id && r.teamId == null);
  check("at season end the unhired reports lapse; the hired one keeps hers", rolled && others.length === 2 && others.every((r) => r.rev === 0) && hired?.teamId === teamId && hired.rev === 1,
    `rolled ${rolled}; ${state.map((r) => `${r.id}: team ${r.teamId ?? "-"}, revealed ${r.rev}`).join("; ")}`);
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
