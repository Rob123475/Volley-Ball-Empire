/**
 * Unity match brief (29 Sep), item 11 — after a match, the clock stays paused.
 *
 * Rob, 29 Sep: after a match the calendar went straight back to the speed it had
 * before it (calendar_state.pre_match_speed, e.g. "fast") and ran on to the next
 * match at once. Now, after EVERY match, the calendar is paused on the dashboard
 * and the player starts it again.
 *
 * Asserted for the three ways of playing a match, each with the clock on "fast"
 * before match day: Sim Result (simulate, then the box is dismissed, as the
 * client does), Skip (simulate, then skip-match) and watched (the 3D court posts
 * its result; GET /calendar clears the match day).
 *
 * Usage: node harness/pause-after-match.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healSquadByTeam } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-pause-after-"));
const PORT = 4919;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  UNITY 11: AFTER A MATCH, THE CLOCK STAYS PAUSED");
console.log("=".repeat(72));
if (!fs.existsSync(SERVER)) { console.error(`[pause-after-match] FAILED: ${SERVER} not built.`); process.exit(1); }

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
const dbFile = path.join(WORK, "pause.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "pause-after" },
});

try {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  const prof = await api("POST", "/profiles", { name: "Pause After" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? [])[0];
  await api("POST", "/careers", {
    slotNumber: 1, managerName: "Pause After", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0,
  });
  const teamId = (await api("GET", "/team")).data?.id;
  const careerSaveId = ((await api("GET", "/careers")).data?.saves ?? []).find((s) => s.slotNumber === 1)?.id;
  const speed = async () => (await api("GET", "/calendar")).data?.calendarSpeed;

  /** Clock on fast, then the ticker's own step - one day at a time - to the next match day. */
  async function fastToMatchDay() {
    await api("PATCH", "/calendar/speed", { speed: "fast" });
    const before = await speed();
    for (let i = 0; i < 60; i++) {
      const r = await api("POST", "/calendar/advance");
      const id = r.data?.matchDay?.matchId ?? (r.data?.blocked === "pending_match" ? r.data.pendingMatchId : null);
      if (id) { healSquadByTeam(dbFile, teamId); return { id, before }; }
    }
    return { id: null, before };
  }

  const ways = [
    ["Sim Result", async (id) => { await api("POST", `/matches/${id}/simulate`); await api("POST", "/calendar/dismiss-match"); }],
    ["Skip", async (id) => { await api("POST", `/matches/${id}/simulate`); await api("POST", "/calendar/skip-match"); }],
    ["watched in 3D", async (id) => {
      await api("POST", `/matches/${id}/watch`, {});
      await fetch(`${BASE}/unity/match-result`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ careerSaveId, matchId: id, sets: [{ home: 11, away: 6 }, { home: 11, away: 8 }] }) });
    }],
  ];
  for (const [name, play] of ways) {
    const { id, before } = await fastToMatchDay();
    await play(id);
    const cal = (await api("GET", "/calendar")).data;
    const m = (await api("GET", "/matches")).data?.find((x) => x.id === id);
    check(`${name}: "fast" before the match, "pause" after it`,
      before === "fast" && m?.status === "completed" && cal?.pendingMatchId == null && cal?.calendarSpeed === "pause",
      `before ${before}; match ${id} ${m?.status}; after: ${cal?.calendarSpeed}, pending ${cal?.pendingMatchId}`);
  }

  const src = fs.readFileSync(path.join(REPO, "artifacts", "api-server", "src", "routes", "calendar.ts"), "utf8");
  check("nothing resumes the pre-match speed any more", !/preMatchSpeed \?\?/.test(src) && !/preMatchSpeed: calendar\.calendarSpeed/.test(src));
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
