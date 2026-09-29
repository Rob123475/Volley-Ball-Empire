/**
 * D-5 — the MATCH DAY box names the player's club, not "Your Team".
 *
 * Rob, 29 Sep: "Your Team vs Barcelona Playa Elites". The box
 * (components/match-day-modal.tsx) printed a fixed "Your Team" on the club's
 * side. It now prints the club's name as the career carries it (a custom name
 * included, exactly as the dashboard shows it), which GET /calendar returns with the pending match.
 *
 * Asserted: a new career run to its first match day gets its club's name from
 * GET /calendar, the same name the dashboard shows; the box renders it; and no
 * "Your Team" placeholder is left anywhere a player can read.
 *
 * Usage: node harness/match-day-box.mjs
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
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-match-day-box-"));
const PORT = 4914;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log("  D-5 THE MATCH DAY BOX NAMES THE CLUB");
console.log("=".repeat(72));

if (!fs.existsSync(SERVER)) { console.error(`[match-day-box] FAILED: ${SERVER} not built.`); process.exit(1); }

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

const dbFile = path.join(WORK, "matchday.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "match-day-box" },
});

try {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }

  const prof = await api("POST", "/profiles", { name: "Match Day" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((x) => x.name === "Sydney Riptide");
  const c = await api("POST", "/careers", {
    slotNumber: 1, managerName: "Match Day", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0,
  });
  if (c.status >= 300) throw new Error(`career: HTTP ${c.status}`);

  let cal = (await api("GET", "/calendar")).data;
  for (let i = 0; i < 80 && !cal?.pendingMatchId; i++) {
    await api("POST", "/calendar/advance");
    cal = (await api("GET", "/calendar")).data;
  }
  check("the career reaches its first match day", !!cal?.pendingMatchId && !!cal?.pendingMatch,
    `${cal?.currentDate}: match ${cal?.pendingMatchId} vs ${cal?.todayEvents?.[0]?.opponent}`);
  check("GET /calendar gives the club's name for the box", cal?.clubName === "Sydney Riptide", JSON.stringify(cal?.clubName));

  // The same name the dashboard's header shows (careerSave.clubName ?? team.name).
  const dash = (await api("GET", "/dashboard")).data;
  check("and it is the name the dashboard shows", cal?.clubName === dash?.clubName, `dashboard ${JSON.stringify(dash?.clubName)}`);

  // The box itself.
  const modal = fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", "components", "match-day-modal.tsx"), "utf8");
  check("the box prints the club's name from the calendar", /calendar\.clubName/.test(modal) && !/"Your Team"/.test(modal));

  // No placeholder standing in for a club's NAME anywhere a player can read:
  // a bare "Your Team"/"Your Club"-style literal, or a fallback (?? / ||) to
  // one. Sentences that merely say "your team" ("Match day - your team plays
  // today!") are ordinary wording and are fine.
  const PLACEHOLDER = /["'`](Your|My|Home|User|Player)\s(Team|Club|Side)["'`]|(\?\?|\|\|)\s*["'`](Your|My)\s\w+["'`]/;
  const hits = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) walk(f);
      else if (/\.(tsx?|jsx?)$/.test(e.name)) {
        fs.readFileSync(f, "utf8").split("\n").forEach((l, i) => {
          if (/^\s*(\/\/|\*)/.test(l)) return;
          if (PLACEHOLDER.test(l)) hits.push(`${path.relative(REPO, f)}:${i + 1} ${l.trim().slice(0, 60)}`);
        });
      }
    }
  };
  walk(path.join(REPO, "artifacts", "beach-volleyball", "src"));
  walk(path.join(REPO, "artifacts", "api-server", "src"));
  check("no \"Your Team\"/\"Your Club\" placeholder for a club name in the client or the server", hits.length === 0, hits.join("; "));
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  try { await stopServer(child); } catch { /* already stopped */ }
  try { fs.closeSync(out); } catch { /* closed */ }
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
