/**
 * F-1 — "Next match": the clock run to the day of the player's next match.
 *
 * Rob, 29 Sep: a new career's first match is round 11, 17 Feb, 46 days after
 * the start; Advance moves one day and the fast clock takes too long. The new
 * button (top bar, next to Advance) calls POST /calendar/next-match, which
 * runs the SAME day as the clock (advanceOneDay in routes/calendar.ts), once
 * per day, until the day the match is played, and stops on the MATCH DAY box.
 * It is a faster clock, not a skip.
 *
 * The proof: the same new career, from the same starter DB, run twice with the
 * same seeded dice (harness/seeded-random.cjs) — once pressing Advance day by
 * day, once pressing Next match — and the two saves compared table by table,
 * every row and column except timestamps and login ids. Before that, a
 * control: two day-by-day runs compared the same way must be identical, or
 * the comparison would be measuring noise.
 *
 * Both runs buy the Training Centre upgrade on 1 Jan, so a facility build
 * finishes inside the stretch the button covers.
 *
 * Also: with no match scheduled the button's endpoint refuses with a reason,
 * and GET /calendar has no next match (the button is disabled on that).
 *
 * Usage: node harness/next-match.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fork } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { stopServer } from "./server-harness.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const SEEDED = path.join(REPO, "harness", "seeded-random.cjs");
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-next-match-"));
const PORT = 4916;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log("  F-1 NEXT MATCH: THE CLOCK, FASTER");
console.log("=".repeat(72));

if (!fs.existsSync(SERVER)) { console.error(`[next-match] FAILED: ${SERVER} not built.`); process.exit(1); }

/** Tables and columns that differ between any two runs for reasons that are not the game. */
const SKIP_TABLES = new Set(["sessions", "session", "user_sessions"]);
const SKIP_COLUMN = /(^|_)(created|updated)(_at)?$|_at$|^user_id$|^profile_id$|^sid$|^expire/;

function boot(dbFile, tag) {
  const out = fs.openSync(path.join(WORK, `server-${tag}.log`), "w");
  const child = fork(SERVER, [], {
    execPath: ELECTRON,
    execArgv: ["--require", SEEDED],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development",
      SESSION_SECRET: "next-match", VBE_RANDOM_SEED: "20260929" },
    stdio: ["ignore", out, out, "ipc"],
  });
  return { child, out };
}

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

/** Every row of every table, minus the columns in SKIP_COLUMN, as one comparable object. */
function snapshot(dbFile) {
  const d = new DatabaseSync(dbFile, { readOnly: true });
  const snap = {};
  // Login ids are random UUIDs: the same person in both runs, so one token.
  const ids = d.prepare("SELECT id FROM users").all().map((u) => String(u.id));
  const norm = (json) => ids.reduce((j, id) => j.split(id).join("<user>"), json);
  for (const { name } of d.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()) {
    if (SKIP_TABLES.has(name)) continue;
    const cols = d.prepare(`PRAGMA table_info("${name}")`).all().map((c) => c.name).filter((c) => !SKIP_COLUMN.test(c));
    if (cols.length === 0) continue;
    const pk = d.prepare(`PRAGMA table_info("${name}")`).all().filter((c) => c.pk > 0).map((c) => `"${c.name}"`);
    const order = pk.length ? pk.join(", ") : "rowid";
    snap[name] = d.prepare(`SELECT ${cols.map((c) => `"${c}"`).join(", ")} FROM "${name}" ORDER BY ${order}`).all()
      .map((r) => norm(JSON.stringify(r)));
  }
  d.close();
  return snap;
}

/** Tables whose rows differ, with the first differing row of each. */
function diff(a, b) {
  const out = [];
  for (const t of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const ra = a[t] ?? [], rb = b[t] ?? [];
    if (ra.length !== rb.length) { out.push(`${t}: ${ra.length} rows vs ${rb.length}`); continue; }
    const i = ra.findIndex((r, k) => r !== rb[k]);
    if (i >= 0) out.push(`${t} row ${i}: ${ra[i].slice(0, 160)} vs ${rb[i].slice(0, 160)}`);
  }
  return out;
}

/** A new career from a fresh starter-DB copy, run to its first match day by `mode`. */
async function run(tag, mode) {
  const dbFile = path.join(WORK, `${tag}.sqlite`);
  fs.copyFileSync(SHIPPED, dbFile);
  const srv = boot(dbFile, tag);
  const api = session();
  const info = { tag, mode };
  try {
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ }
      await new Promise((r) => setTimeout(r, 250));
    }
    const prof = await api("POST", "/profiles", { name: "Next Match" });
    await api("POST", `/profiles/${prof.data.id}/select`);
    const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
    const c = await api("POST", "/careers", {
      slotNumber: 1, managerName: "Next Match", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
      budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0,
    });
    if (c.status >= 300) throw new Error(`career: HTTP ${c.status}`);
    await api("GET", "/facilities");
    info.bought = (await api("POST", "/facilities/training_complex/upgrade")).status;
    info.start = (await api("GET", "/calendar")).data?.currentDate;

    const t0 = Date.now();
    if (mode === "day") {
      let presses = 0;
      for (; presses < 120; presses++) {
        const r = await api("POST", "/calendar/advance");
        if (r.data?.matchDay || r.data?.blocked) { presses++; break; }
      }
      info.presses = presses;
    } else {
      const r = await api("POST", "/calendar/next-match");
      info.presses = 1;
      info.response = { status: r.status, daysAdvanced: r.data?.daysAdvanced, matchDay: r.data?.matchDay ?? null, stoppedBecause: r.data?.stoppedBecause };
    }
    info.ms = Date.now() - t0;
    const cal = (await api("GET", "/calendar")).data;
    info.date = cal?.currentDate;
    info.pendingMatchId = cal?.pendingMatchId;
    info.balance = Number((await api("GET", "/team")).data?.budget);
  } finally {
    await stopServer(srv.child);
    try { fs.closeSync(srv.out); } catch { /* closed */ }
  }
  info.snap = snapshot(dbFile);
  return info;
}

try {
  console.log("\n1. CONTROL: THE SAME DAYS TWICE, DAY BY DAY");
  const day1 = await run("day-1", "day");
  const day2 = await run("day-2", "day");
  const control = diff(day1.snap, day2.snap);
  check("two day-by-day runs with the same dice leave identical saves (so the comparison below measures only the button)",
    control.length === 0, control.slice(0, 5).join(" | "));

  console.log("\n2. NEXT MATCH, PRESSED ONCE");
  const next = await run("next", "next");
  const d1 = day1;
  console.log(`  REPORT  day by day: ${d1.presses} presses, ${d1.start} -> ${d1.date}, ${d1.ms} ms; Next match: 1 press, ${next.start} -> ${next.date}, ${next.ms} ms, ${JSON.stringify(next.response)}`);
  check("one press: the calendar is on 17 Feb", next.response?.status === 200 && next.date === "2026-02-17", `${next.start} -> ${next.date}`);
  check("and the match day is pending (the MATCH DAY box is up)", next.pendingMatchId != null && next.response?.matchDay?.matchId === next.pendingMatchId,
    `pending ${next.pendingMatchId}; response matchDay ${next.response?.matchDay?.matchId} vs ${next.response?.matchDay?.opponent}`);
  check("the day-by-day clock reaches the same day and match", d1.date === next.date && d1.pendingMatchId === next.pendingMatchId,
    `day by day ${d1.date} match ${d1.pendingMatchId} after ${d1.presses} presses`);
  check("balance identical", d1.balance === next.balance, `$${d1.balance.toLocaleString()} vs $${next.balance.toLocaleString()}`);
  const fac = (s) => (s.facilities ?? []).map((r) => JSON.parse(r)).filter((r) => r.type === "training_complex").map((r) => `L${r.level}${r.upgrading_to_level ? `->${r.upgrading_to_level}` : ""}`).join(",");
  check("facility builds identical (the Training Centre build finished on the way, in both)",
    JSON.stringify(d1.snap.facilities) === JSON.stringify(next.snap.facilities) && /L2/.test(fac(next.snap)), `${fac(d1.snap)} vs ${fac(next.snap)}`);
  // Before 17 Feb the AI results are the six continental leagues' rounds 1-10
  // (the World Tour starts on the player's first match day).
  const AI = ["regional_league_fixtures", "regional_league_results", "matches", "world_tour_fixtures", "competitor_rankings"];
  const done = (s) => (s.regional_league_fixtures ?? []).map((r) => JSON.parse(r)).filter((f) => f.status === "completed").length;
  const aiSame = AI.every((t) => JSON.stringify(d1.snap[t]) === JSON.stringify(next.snap[t]));
  check("AI results identical (every regional fixture and result, World Tour draw, rankings)",
    aiSame && done(next.snap) > 0, `${done(d1.snap)} vs ${done(next.snap)} regional fixtures played, ${(next.snap.regional_league_results ?? []).length} results rows`);
  const whole = diff(d1.snap, next.snap);
  check(`the whole save identical, all ${Object.keys(next.snap).length} tables (salaries, ledger, contracts, news, rankings, player condition)`,
    whole.length === 0, whole.slice(0, 5).join(" | "));

  console.log("\n3. NO MATCH SCHEDULED");
  {
    const dbFile = path.join(WORK, "none.sqlite");
    fs.copyFileSync(SHIPPED, dbFile);
    const srv = boot(dbFile, "none");
    const api = session();
    try {
      const deadline = Date.now() + 60000;
      while (Date.now() < deadline) {
        try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ }
        await new Promise((r) => setTimeout(r, 250));
      }
      const prof = await api("POST", "/profiles", { name: "No Match" });
      await api("POST", `/profiles/${prof.data.id}/select`);
      const club = ((await api("GET", "/club-templates")).data?.clubs ?? [])[0];
      await api("POST", "/careers", {
        slotNumber: 1, managerName: "No Match", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
        budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0,
      });
      const teamId = (await api("GET", "/team")).data?.id;
      const d = new DatabaseSync(dbFile);
      const n = d.prepare("UPDATE matches SET status = 'harness_removed' WHERE status = 'scheduled' AND (home_team_id = ? OR away_team_id = ?)").run(teamId, teamId).changes;
      d.close();
      const before = (await api("GET", "/calendar")).data;
      const r = await api("POST", "/calendar/next-match");
      const after = (await api("GET", "/calendar")).data;
      check("with no match scheduled, GET /calendar has no next match (the button is disabled on it)", before?.nextMatch == null, `${n} fixtures taken out`);
      check("and the endpoint refuses with a short reason, the clock unmoved",
        r.status === 409 && typeof r.data?.reason === "string" && r.data.reason.length > 0 && after?.currentDate === before?.currentDate,
        `HTTP ${r.status} ${JSON.stringify(r.data)}; ${before?.currentDate} -> ${after?.currentDate}`);
    } finally {
      await stopServer(srv.child);
      try { fs.closeSync(srv.out); } catch { /* closed */ }
    }
  }

  // The button itself: next to Advance, disabled with its reason.
  const panel = fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", "components", "calendar-panel.tsx"), "utf8");
  check("the top bar has a Next match button beside Advance, disabled with a reason when there is none",
    /nextMatchBlockedReason/.test(panel) && panel.indexOf('data-testid="button-next-match"') > panel.indexOf(">Advance<")
    && panel.indexOf(">Advance<") > 0 && /disabled=\{disabled\}/.test(panel) && /title=\{hint\}/.test(panel));
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
