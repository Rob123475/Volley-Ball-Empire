/**
 * R-70 — the top bar shows the round of the competition being played.
 *
 * Rob's play-through: the top bar read "R7/78". 78 is the season record's
 * totalRounds, which is the SCHEDULE's slot count (roundToDate spreads it over
 * the year), not a count of anything the player plays. Match screens made the
 * same mistake with a match's slot: World Tour round 31 sits in slot 42 and was
 * shown as "Round 42", and the World Tour results page's "round - 10" was wrong
 * from the first open date on.
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 *   78       the slot layout, and the season re-derived from the schedule the
 *            server actually runs: 10 continental + 57 World Tour events + 2
 *            World Finals days = 69 rounds
 *   phase    GET /calendar gives every phase its own round: Continental R7/10,
 *            World Tour R31/57 (open dates keep the last event's number),
 *            Finals · Semi-finals / Final, Off-season; no 78 in the payload
 *   names    GET /calendar/round-names names every match slot the same way
 *   events   the upcoming-events season end counts the season's own rounds
 *   clock    advancing the real clock moves the label with the date
 *   screens  the top bar, the dashboard pill and the match screens read the
 *            phase or the round names, in the source and the served bundle
 *
 * Usage: node harness/season-phase.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healAllSquads } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-season-phase-"));
const PORT = 4860;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log("  R-70 THE TOP BAR SHOWS THE COMPETITION'S ROUND");
console.log("=".repeat(72));

// ── 0. The source ───────────────────────────────────────────────────────────
console.log("\n0. THE 78 SLOTS, AND THE SCREENS THAT SHOWED THEM");
const src = (p) => fs.readFileSync(path.join(REPO, p), "utf8");
{
  const slots = src("artifacts/api-server/src/utils/calendarSlots.ts");
  const num = (name) => Number(new RegExp(`export const ${name}\\s*=\\s*(\\d+);`).exec(slots)?.[1]);
  const layout = { continental: num("REGIONAL_SLOTS"), worldTour: num("WORLD_TOUR_SLOTS"), finals: num("FINALS_SLOTS"), offSeason: num("HOLIDAY_SLOTS"), total: num("TOTAL_SLOTS") };
  check("78 is the schedule's slots: continental + World Tour + finals + off-season",
    layout.total === 78 && layout.continental + layout.worldTour + layout.finals + layout.offSeason === 78,
    `${layout.continental} + ${layout.worldTour} + ${layout.finals} + ${layout.offSeason} = ${layout.total}`);

  const panel = src("artifacts/beach-volleyball/src/components/calendar-panel.tsx");
  check("the top bar shows the phase, and the next match by its round name",
    /\{calendar\.seasonYear\} · \{calendar\.seasonPhase\.label\}/.test(panel)
      && /roundName\(calendar\.nextMatch\.round, "short"\)/.test(panel));

  const dashboard = src("artifacts/beach-volleyball/src/pages/dashboard.tsx");
  check("the dashboard pill shows the phase and progress through the season's own rounds",
    /\{calendar\.seasonPhase\.label\}/.test(dashboard)
      && /calendar\.seasonPhase\.played \/ calendar\.seasonPhase\.length/.test(dashboard));

  const offenders = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name)) {
        const t = fs.readFileSync(p, "utf8");
        for (const bad of ["seasonTotalRounds", "seasonRound", "round - 10", "Round {match.round}", "R{calendar.nextMatch.round}", "Round {nextBye.round}", "World Tour round 70"]) {
          if (t.includes(bad)) offenders.push(`${path.relative(REPO, p)}: ${bad}`);
        }
      }
    }
  };
  walk(path.join(REPO, "artifacts/beach-volleyball/src"));
  check("no screen shows a schedule slot as a round", offenders.length === 0, offenders.join("; ") || "none of the old forms left");

  const assets = path.join(REPO, "artifacts/api-server/dist/public/assets");
  const bundle = fs.existsSync(assets)
    ? fs.readdirSync(assets).filter((f) => f.endsWith(".js")).map((f) => fs.readFileSync(path.join(assets, f), "utf8")).join("\n")
    : "";
  check("the served bundle carries the phase label and the round names",
    /calendar-season-phase/.test(bundle) && /dashboard-season-phase/.test(bundle) && /\/api\/calendar\/round-names/.test(bundle),
    bundle ? "" : `${assets} not built`);
}

if (!fs.existsSync(SERVER)) { console.error(`[season-phase] FAILED: ${SERVER} not built.`); process.exit(1); }

function session() {
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

const dbFile = path.join(WORK, "phase.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const logFile = path.join(WORK, "server.log");
const out = fs.openSync(logFile, "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "season-phase" },
});
{
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
}

const query = (q, ...a) => { const d = new DatabaseSync(dbFile, { readOnly: true }); const r = d.prepare(q).all(...a); d.close(); return r; };
const exec = (q, ...a) => { const d = new DatabaseSync(dbFile); d.exec("PRAGMA busy_timeout = 5000"); d.prepare(q).run(...a); d.close(); };

try {
  // ── 1. A new career, and the season re-derived ────────────────────────────
  console.log("\n1. THE SEASON'S LENGTH, FROM THE SCHEDULE THE SERVER RUNS");
  const api = session();
  const prof = await api("POST", "/profiles", { name: "Phase" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const clubs = (await api("GET", "/club-templates")).data;
  const club = (Array.isArray(clubs) ? clubs : clubs?.clubs ?? [])[0];
  const created = await api("POST", "/careers", {
    slotNumber: 1, managerName: "Phase", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "underdog", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0,
  });
  const cal0 = (await api("GET", "/calendar")).data;
  check("a new career's top bar reads Continental R1/10",
    created.status < 300 && cal0?.seasonPhase?.label === "Continental R1/10" && cal0?.scheduleSlot === 1,
    `HTTP ${created.status}; "${cal0?.seasonPhase?.label}", slot ${cal0?.scheduleSlot}`);
  check("the calendar payload no longer carries the 78 as a round count",
    cal0 && !("seasonTotalRounds" in cal0) && !("seasonRound" in cal0), Object.keys(cal0 ?? {}).filter((k) => /round|slot|phase/i.test(k)).join(", "));

  const wt = (await api("GET", "/world-tour/fixtures?round=11")).data;
  const eventRounds = wt?.eventRounds ?? [];
  const openDates = [];
  for (let s = 11; s <= 70; s++) if (!eventRounds.includes(s)) openDates.push(s);
  const derived = 10 + eventRounds.length + 2;
  check("the season is 10 continental rounds + the World Tour's events + 2 World Finals days",
    eventRounds.length === 57 && openDates.join(",") === "41,51,61" && derived === 69 && cal0?.seasonPhase?.length === derived,
    `10 + ${eventRounds.length} + 2 = ${derived}; open dates ${openDates.join(", ")}; calendar says ${cal0?.seasonPhase?.length}`);
  console.log(`  REPORT  78 was the schedule's slot count: 10 continental + 60 World Tour slots (${eventRounds.length} events + open dates ${openDates.join(", ")}) + 2 World Finals days + 6 off-season. The season played is ${derived} rounds.`);

  // ── 2. Every phase ────────────────────────────────────────────────────────
  console.log("\n2. THE TOP BAR IN EVERY PHASE");
  const cid = query("SELECT id FROM career_saves ORDER BY id LIMIT 1")[0].id;
  const seasonId = query("SELECT id FROM seasons WHERE career_save_id = ? AND status = 'active'", cid)[0].id;
  const wtLabel = (slot) => `World Tour R${eventRounds.filter((r) => r <= slot).length}/${eventRounds.length}`;
  const groups = {
    continental: [[1, "Continental R1/10", 1], [7, "Continental R7/10", 7], [10, "Continental R10/10", 10]],
    "World Tour (41 is an open date)": [[11, "World Tour R1/57", 11], [40, "World Tour R30/57", 40], [41, "World Tour R30/57", 40], [42, "World Tour R31/57", 41], [70, "World Tour R57/57", 67]],
    "World Finals": [[71, "Finals · Semi-finals", 68], [72, "Finals · Final", 69]],
    "off-season": [[73, "Off-season", 69], [78, "Off-season", 69]],
  };
  for (const [group, cases] of Object.entries(groups)) {
    const seen = [];
    let ok = true;
    for (const [slot, label, played] of cases) {
      exec("UPDATE seasons SET current_round = ? WHERE id = ?", slot, seasonId);
      const p = (await api("GET", "/calendar")).data?.seasonPhase;
      const pct = p ? Math.round((p.played / p.length) * 100) : null;
      const schedule = slot >= 11 && slot <= 70 ? wtLabel(slot) === label : true;
      if (!(p?.label === label && p?.played === played && p?.length === 69 && schedule)) ok = false;
      seen.push(`slot ${slot} "${p?.label}" ${p?.played}/${p?.length} (${pct}%)`);
    }
    check(`${group}`, ok, seen.join("; "));
  }

  // ── 3. Round names for match screens ──────────────────────────────────────
  console.log("\n3. A MATCH'S ROUND, NAMED THE SAME WAY");
  const rn = (await api("GET", "/calendar/round-names")).data;
  const names = rn?.names ?? {};
  const wtNames = eventRounds.map((s) => names[s]?.name);
  check("every World Tour event is named by its place among the events, not its slot",
    wtNames.length === 57 && wtNames.every((n, i) => n === `World Tour R${i + 1}`) && names[42]?.short === "WT R31",
    `slot 11 "${names[11]?.name}", slot 42 "${names[42]?.name}" / "${names[42]?.short}", slot 70 "${names[70]?.name}"`);
  const contOk = Array.from({ length: 10 }, (_, i) => names[i + 1]?.name === `Continental R${i + 1}`).every(Boolean);
  check("continental rounds and the World Finals days are named",
    contOk && names[71]?.name === "World Finals semi-final" && names[71]?.short === "Semi-final" && names[72]?.name === "World Final" && rn?.seasonLength === 69,
    `slot 7 "${names[7]?.name}" / "${names[7]?.short}"; 71 "${names[71]?.name}"; 72 "${names[72]?.name}"; season ${rn?.seasonLength}`);

  // ── 4. The upcoming-events season end ─────────────────────────────────────
  console.log("\n4. UPCOMING EVENTS COUNT THE SEASON'S OWN ROUNDS");
  exec("UPDATE seasons SET current_round = ? WHERE id = ?", 42, seasonId);
  const ev = (await api("GET", "/events/upcoming")).data;
  const items = Array.isArray(ev) ? ev : ev?.items ?? ev?.events ?? [];
  const seasonEnd = items.find((i) => i.type === "season_end");
  check("at World Tour R31 the season end reads 28 rounds remaining, of 69",
    seasonEnd?.subtitle === "28 rounds remaining" && /69 rounds — 10 continental, 57 World Tour, 2 World Finals days/.test(seasonEnd?.detail ?? ""),
    seasonEnd ? `"${seasonEnd.subtitle}"; "${seasonEnd.detail}"` : "no season_end item");

  // ── 5. The real clock ─────────────────────────────────────────────────────
  console.log("\n5. THE LABEL FOLLOWS THE CLOCK");
  exec("UPDATE seasons SET current_round = ? WHERE id = ?", 1, seasonId);
  let cal = (await api("GET", "/calendar")).data;
  const start = { date: cal?.currentDate, label: cal?.seasonPhase?.label };
  for (let i = 0; i < 20 && (cal?.scheduleSlot ?? 0) < 2; i++) {
    const r = await api("POST", "/calendar/advance", {});
    if (r.data?.blocked === "pending_match") {
      healAllSquads(dbFile); // R-80: a forfeit here would be measured as a played match
      const sim = await api("POST", `/matches/${r.data.pendingMatchId}/simulate`, {});
      if (sim.status >= 400) await api("POST", `/matches/${r.data.pendingMatchId}/forfeit`, {});
    }
    cal = (await api("GET", "/calendar")).data;
  }
  check("advancing to the second continental round's date moves the top bar to Continental R2/10",
    start.label === "Continental R1/10" && cal?.scheduleSlot === 2 && cal?.seasonPhase?.label === "Continental R2/10",
    `${start.date} "${start.label}" -> ${cal?.currentDate} "${cal?.seasonPhase?.label}"`);
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  await stopServer(child);
  try { fs.closeSync(out); } catch { /* closed */ }
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
