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
 * Overnight brief 30 Sep, item 4 (Rob, 30 Sep): staff and medical scouting
 * takes 5 game days like a player's, and every scout costs $1,500, charged when
 * sent, on the ledger. It was instant and $1,000.
 *
 * Item 7: nobody unscouted and unhired carries a star or quality rating: the
 * market lists send no rating, scouting rating, skill level or attributes
 * until the report is in, and the Staff Market card shows "?" (it drew
 * "Quality ★★★★★ Elite" from the true rating).
 *
 * Item 8: an unscouted, unhired card shows a wage RANGE (85%-115% of the
 * wage, rounded out to $500, as player prices), exact once scouted or hired.
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

  // Item 7: no rating of any kind on an unscouted, unhired card, in either market.
  const staffM0 = (await api("GET", "/staff/market")).data ?? [];
  const bare = (m) => m.overallRating == null && m.scoutingRating == null && m.skillLevel == null && Object.keys(m.attributes ?? {}).length === 0;
  const leaks = [...m0, ...staffM0].filter((m) => !m.isScoutRevealed && !bare(m));
  check("no unscouted card carries a rating, scouting rating, skill level or attributes (both markets)",
    m0.length > 10 && staffM0.length > 10 && leaks.length === 0,
    `${m0.length} medical + ${staffM0.length} staff cards; carrying a rating: ${leaks.slice(0, 3).map((m) => `${m.name} ${m.overallRating}`).join(", ") || "none"}`);
  const smSrc = fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/pages/staff-market.tsx"), "utf8");
  check("the Staff Market card shows \"?\" for an unscouted rating, and no \"Quality\" stars",
    /if \(!revealed \|\| rating == null\)/.test(smSrc) && /data-testid="ovr-unknown"/.test(smSrc) && !/>Quality</.test(smSrc));

  // Item 8: a wage range until the report is in, and it holds her real wage.
  const wageOf = (id) => Number(read(`SELECT salary FROM career_staff_state WHERE career_save_id = ? AND staff_id = ?`, careerSaveId, id)[0]?.salary);
  const noRange = [...m0, ...staffM0].filter((m) => !m.isScoutRevealed && !(m.salary == null && m.salaryRange && m.salaryRange.low < m.salaryRange.high
    && m.salaryRange.low % 500 === 0 && m.salaryRange.high % 500 === 0 && m.salaryRange.low <= wageOf(m.id) && wageOf(m.id) <= m.salaryRange.high));
  const eg = m0.find((m) => !m.isScoutRevealed);
  check("every unscouted card shows a wage range, not the wage, and the range holds her real wage (both markets)",
    noRange.length === 0, `e.g. ${eg?.name}: $${eg?.salaryRange?.low}-$${eg?.salaryRange?.high}/mo (real $${wageOf(eg?.id)}); wrong: ${noRange.slice(0, 3).map((m) => m.name).join(", ") || "none"}`);

  const b0 = await budget();
  const sent = [];
  for (const m of three) sent.push(await api("POST", `/staff/${m.id}/scout`));
  const b1 = await budget();
  const ledger = read(`SELECT amount, description, date FROM finance_transactions WHERE team_id = ? AND category = 'scouting'`, teamId);
  let gameDay = null;
  const readDay = async () => { gameDay = (await api("GET", "/calendar")).data?.currentDate ?? null; return gameDay; };
  const today = () => gameDay;
  const sentOn = await readDay();
  check("3 scouts: $1,500 each ($4,500), charged when sent, each on the ledger as scouting",
    b0 - b1 === 4500 && ledger.length === 3 && ledger.every((r) => Number(r.amount) === 1500 && /^Scouting: /.test(r.description) && r.date === sentOn),
    `balance ${b0} -> ${b1}; ${ledger.map((r) => `${r.date} $${r.amount} ${r.description}`).join("; ")}`);
  check("each report is due in 5 game days, and nothing is revealed yet",
    sent.every((r) => r.status === 200 && r.data?.days === 5 && r.data?.cost === 1500 && r.data?.scouting?.state === "in_progress" && r.data.scouting.daysLeft === 5)
    && (await medMarket()).filter((m) => three.some((t) => t.id === m.id)).every((m) => !m.isScoutRevealed && m.scouting?.state === "in_progress"),
    sent.map((r) => `${r.status} ${JSON.stringify(r.data?.scouting)}`).join("; "));
  const againScout = await api("POST", `/staff/${three[0].id}/scout`);
  check("scouting one again is refused, with no second charge", againScout.status === 409 && (await budget()) === b1, `${againScout.status}: ${againScout.data?.error}`);
  const revealed = (list) => three.every((t) => list.find((m) => m.id === t.id)?.isScoutRevealed === true);
  // Day by day to the report: hidden on day 4, in on day 5.
  const dayAfter = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const advanceTo = async (date) => {
    for (let i = 0; i < 40 && (await readDay()) < date; i++) {
      healAllSquads(dbFile);
      const r = await api("POST", "/calendar/advance", {});
      if (r.data?.blocked === "pending_match") { await api("POST", `/matches/${r.data.pendingMatchId}/simulate`); await api("POST", "/calendar/dismiss-match"); continue; }
      if (r.data?.matchDay?.matchId) { await api("POST", `/matches/${r.data.matchDay.matchId}/simulate`); await api("POST", "/calendar/dismiss-match"); }
    }
    await readDay();
  };
  await advanceTo(dayAfter(sentOn, 4));
  const day4 = await medMarket();
  check("4 game days on: still hidden, report in 1 day", today() === dayAfter(sentOn, 4) && three.every((t) => { const m = day4.find((x) => x.id === t.id); return m && !m.isScoutRevealed && m.scouting?.daysLeft === 1; }),
    `${today()}: ${three.map((t) => JSON.stringify(day4.find((x) => x.id === t.id)?.scouting)).join(" ")}`);
  await advanceTo(dayAfter(sentOn, 5));
  const day5 = await medMarket();
  check("5 game days on: all 3 reports are in, with their rating and attributes",
    today() === dayAfter(sentOn, 5) && revealed(day5) && three.every((t) => { const m = day5.find((x) => x.id === t.id); return m?.overallRating > 0 && Object.keys(m.attributes ?? {}).length > 0; }), today());
  check("and each scouted card shows her exact wage, no range",
    three.every((t) => { const m = day5.find((x) => x.id === t.id); return m?.salary === wageOf(t.id) && m.salaryRange == null; }),
    three.map((t) => { const m = day5.find((x) => x.id === t.id); return `${m?.name} $${m?.salary}`; }).join(", "));
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
  const state = read(`SELECT staff_id AS id, team_id AS teamId, is_scout_revealed AS rev, scout_started_on AS started FROM career_staff_state WHERE career_save_id = ? AND staff_id IN (?, ?, ?)`,
    careerSaveId, three[0].id, three[1].id, three[2].id);
  const hired = state.find((r) => r.id === three[0].id);
  const others = state.filter((r) => r.id !== three[0].id && r.teamId == null);
  check("at season end the unhired reports lapse; the hired one keeps hers",
    rolled && others.length === 2 && others.every((r) => r.rev === 0 && r.started == null) && hired?.teamId === teamId && hired.started === sentOn,
    `rolled ${rolled}; ${state.map((r) => `${r.id}: team ${r.teamId ?? "-"}, revealed ${r.rev}, scouted ${r.started ?? "-"}`).join("; ")}`);
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
