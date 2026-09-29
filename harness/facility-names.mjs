/**
 * D-3 — one building, one name, everywhere a player reads it.
 *
 * Rob, 29 Sep: dashboard "Training Complex", Facilities page "Training Centre".
 * The names now come from one table (lib/db/src/schema/facility-names.ts),
 * whose names are the Facilities page's own. Checked where a player reads a
 * facility's name: the Attention cards, the upcoming-events list, the season
 * calendar, the finance ledger (new rows, and the rows an existing save
 * already holds), and a sweep of the client for the old spellings.
 *
 * Usage: node harness/facility-names.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { FACILITY_NAMES, FACILITY_PAGE_TYPES } from "../lib/db/src/schema/facility-names.ts";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-facility-names-"));
const PORT = 4912;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log("  D-3 ONE BUILDING, ONE NAME");
console.log("=".repeat(72));

if (!fs.existsSync(SERVER)) { console.error(`[facility-names] FAILED: ${SERVER} not built.`); process.exit(1); }

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

const dbFile = path.join(WORK, "names.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
function boot(tag) {
  const out = fs.openSync(path.join(WORK, `server-${tag}.log`), "w");
  const child = forkServer({
    server: SERVER, electron: ELECTRON, out,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "facility-names" },
  });
  return { child, out };
}
async function ready() {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) return; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
}

const PAGE_NAMES = new Set(FACILITY_PAGE_TYPES.map((t) => FACILITY_NAMES[t]));
let srv = boot("1");

try {
  await ready();
  check("the table names the Training Centre as the Facilities page does", FACILITY_NAMES.training_complex === "Training Centre");

  const prof = await api("POST", "/profiles", { name: "Names Test" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const clubs = (await api("GET", "/club-templates")).data?.clubs ?? [];
  const club = clubs[0];
  const c = await api("POST", "/careers", {
    slotNumber: 1, managerName: "Names Test", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0,
  });
  if (c.status >= 300) throw new Error(`career: HTTP ${c.status}`);
  const teamId = (await api("GET", "/team")).data?.id;
  await api("GET", "/facilities");

  // ── Attention cards ─────────────────────────────────────────────────────
  const cards = ((await api("GET", "/attention-items")).data?.items ?? []).filter((i) => i.category === "Facilities");
  const cardNames = cards.map((i) => i.title.replace(/^Upgrade Ready: /, ""));
  check("Attention: every upgrade card uses the Facilities page's name",
    cards.length > 0 && cardNames.every((n) => PAGE_NAMES.has(n)), cardNames.join(", "));
  check("Attention: the Training Centre's card says Training Centre", cardNames.includes("Training Centre"), cardNames.join(", "));

  // Every page building at the top level: a card may now only be for a building
  // the player can find on the Facilities page, i.e. none at all.
  {
    const d = new DatabaseSync(dbFile);
    const ph = FACILITY_PAGE_TYPES.map(() => "?").join(",");
    d.prepare(`UPDATE facilities SET level = 10 WHERE team_id = ? AND type IN (${ph})`).run(teamId, ...FACILITY_PAGE_TYPES);
    const off = d.prepare(`SELECT type, level FROM facilities WHERE team_id = ? AND type NOT IN (${ph})`).all(teamId, ...FACILITY_PAGE_TYPES);
    d.close();
    const left = ((await api("GET", "/attention-items")).data?.items ?? []).filter((i) => i.category === "Facilities");
    check("Attention: no card for a building that is not on the Facilities page",
      left.length === 0, `off-page rows: ${off.map((r) => `${r.type} L${r.level}`).join(", ")}; cards: ${JSON.stringify(left.map((i) => i.title))}`);
    const d2 = new DatabaseSync(dbFile);
    d2.prepare(`UPDATE facilities SET level = 1 WHERE team_id = ? AND type = 'training_complex'`).run(teamId);
    d2.close();
  }

  // ── Buy the Training Centre's next level ────────────────────────────────
  const buy = await api("POST", "/facilities/training_complex/upgrade");
  check("the Training Centre upgrade is bought", buy.status === 200, `HTTP ${buy.status}`);

  const ledger = ((await api("GET", "/finances")).data ?? []).filter((t) => /^Facility upgrade/.test(t.description));
  check("ledger: \"Facility upgrade: Training Centre → Level 2\"",
    ledger.length === 1 && ledger[0].description === "Facility upgrade: Training Centre → Level 2", JSON.stringify(ledger.map((t) => t.description)));

  const upcoming = ((await api("GET", "/events/upcoming")).data?.items ?? []).filter((e) => e.type === "facility_upgrade");
  check("upcoming events: the build is the Training Centre", upcoming.length === 1 && /Training Centre Upgrading/.test(upcoming[0].title),
    JSON.stringify(upcoming.map((e) => e.title)));

  const year = Number(((await api("GET", "/calendar")).data?.currentDate ?? "2026").slice(0, 4));
  const annual = ((await api("GET", `/calendar/annual?year=${year}`)).data?.events ?? []).filter((e) => e.type === "facility");
  check("season calendar: \"Upgrade Complete: Training Centre\"", annual.length === 1 && annual[0].title === "Upgrade Complete: Training Centre",
    JSON.stringify(annual.map((e) => e.title)));

  // ── A save that already holds the old ledger text ───────────────────────
  await stopServer(srv.child); try { fs.closeSync(srv.out); } catch { /* closed */ }
  {
    const d = new DatabaseSync(dbFile);
    const ins = d.prepare("INSERT INTO finance_transactions (team_id, type, amount, description, category, date, created_at) VALUES (?, 'expense', ?, ?, 'facilities', '2026-01-01', ?)");
    const now = Math.floor(Date.now() / 1000);
    ins.run(teamId, 20000, "Facility upgrade: training complex → Level 2", now);
    ins.run(teamId, 40000, "Facility upgrade: sports science lab → Level 3", now);
    ins.run(teamId, 20000, "Facility upgrade: scouting department → Level 2", now);
    d.close();
  }
  srv = boot("2");
  await ready();
  const old = ((await api("GET", "/finances")).data ?? []).filter((t) => /^Facility upgrade/.test(t.description)).map((t) => t.description).sort();
  check("an existing save's ledger reads the same names after one boot",
    JSON.stringify(old) === JSON.stringify([
      "Facility upgrade: Performance Centre → Level 3",
      "Facility upgrade: Scouting Department → Level 2",
      "Facility upgrade: Training Centre → Level 2",
      "Facility upgrade: Training Centre → Level 2",
    ]), JSON.stringify(old));

  // ── The client: none of the old spellings is left for a player to read ──
  const OLD = ["Training Complex", "Training Center", "Scouting Dept", "Commercial Dept", "Sports Science Lab", "Performance Lab",
    "Commercial Ops", "Beachfront Resort", "Medical Facility"];
  const hits = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) walk(f);
      else if (/\.(tsx?|jsx?)$/.test(e.name)) {
        const lines = fs.readFileSync(f, "utf8").split("\n");
        lines.forEach((l, i) => { for (const o of OLD) if (l.includes(o)) hits.push(`${path.relative(REPO, f)}:${i + 1} ${o}`); });
      }
    }
  };
  walk(path.join(REPO, "artifacts", "beach-volleyball", "src"));
  walk(path.join(REPO, "artifacts", "api-server", "src", "routes"));
  check("no old facility spelling left in the client or the server's routes", hits.length === 0, hits.join("; "));
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  try { await stopServer(srv.child); } catch { /* already stopped */ }
  try { fs.closeSync(srv.out); } catch { /* closed */ }
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
