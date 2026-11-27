/**
 * 1.2 Part D (28 Nov 2026): a Unity proof run against a real match from the game.
 *
 * Boots the built api-server (production, port 4968) on a COPY of the starter DB,
 * makes a career the way the suites do (its Day 1 draft picked and closed,
 * harness-club.mjs startCareer), advances it to its first match day, marks the
 * match as watched, and runs a Unity batch method with
 *   -apiBase http://localhost:4968 -careerSaveId <id> -matchId <id>
 * plus whatever follows `--`, so the court reads that match's real data (the two
 * teams' kits, names, nations, ratings) as it does in the game.
 *
 * Usage: node harness/unity-on-server.mjs <Unity method> <log file> [--club NAME] [-- extra Unity args]
 * Unity must be closed. Prints the method's exit code.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { forkServer, stopServer } from "./server-harness.mjs";
import { startCareer } from "./harness-club.mjs";

const REPO = path.resolve(import.meta.dirname, "..");
const UNITY = process.env.UNITY_EXE ?? "C:/Program Files/Unity/Hub/Editor/6000.3.16f1/Editor/Unity.exe";
const PROJECT = process.env.UNITY_REPO ?? "C:/Users/rbonn/Game_Dev/VolleyBall Empire/volleyball";
const args = process.argv.slice(2);
const dashes = args.indexOf("--");
const extra = dashes >= 0 ? args.slice(dashes + 1) : [];
const [method, logFile] = args;
const clubArg = args.indexOf("--club") >= 0 && args.indexOf("--club") < (dashes >= 0 ? dashes : 1e9) ? args[args.indexOf("--club") + 1] : "Sydney Riptide";
const PORT = 4968, BASE = `http://localhost:${PORT}`;
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "unity-on-server-"));
const DB = path.join(WORK, "save.sqlite");
fs.copyFileSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), DB);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const child = forkServer({
  server: path.join(REPO, "artifacts/api-server/dist/index.mjs"),
  electron: path.join(REPO, "node_modules/electron/dist/electron.exe"),
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", DB_PATH: DB, PORT: String(PORT), SESSION_SECRET: "unity-on-server", PUBLIC_DIR: path.join(REPO, "artifacts/api-server/dist/public") },
  out: fs.openSync(path.join(WORK, "server.log"), "w"),
});
let code = 1;
try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${BASE}/api/healthz`)).ok) break; } catch { /* booting */ } await sleep(500); }
  let cookie = "";
  const api = async (m, p, b) => {
    const r = await fetch(BASE + "/api" + p, { method: m, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    const t = await r.text(); let data; try { data = JSON.parse(t); } catch { data = t; }
    return { status: r.status, data };
  };
  const prof = (await api("POST", "/profiles", { name: "Unity on server" })).data;
  await api("POST", `/profiles/${prof.id}/select`);
  const club = (await api("GET", "/club-templates")).data.clubs.find((c) => c.name === clubArg) ?? (await api("GET", "/club-templates")).data.clubs[0];
  await startCareer(api, { managerFaceId: 8, slotNumber: 1, managerName: "Rob Bonner", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  let matchId = null;
  for (let i = 0; i < 200 && matchId == null; i++) {
    const adv = await api("POST", "/calendar/advance", {});
    if (adv.status >= 400) break;
    matchId = adv.data?.matchDay?.matchId ?? (adv.data?.blocked === "pending_match" ? adv.data.pendingMatchId : null);
  }
  const teamId = (await api("GET", "/team")).data?.id;
  const d = new DatabaseSync(DB, { readOnly: true });
  const cid = d.prepare("SELECT id FROM career_saves WHERE team_id = ?").get(teamId)?.id;
  d.close();
  await api("POST", `/matches/${matchId}/watch`, {});
  console.log(`career ${cid}, ${club.name}, first match ${matchId}`);
  const r = spawnSync(UNITY, ["-batchmode", "-projectPath", PROJECT, "-executeMethod", method, "-apiBase", BASE, "-careerSaveId", String(cid), "-matchId", String(matchId), "-logFile", logFile, ...extra],
    { encoding: "utf8", timeout: 60 * 60 * 1000 });
  code = r.status ?? 1;
  console.log(`${method} exit ${code}`);
} finally {
  await stopServer(child);
}
process.exit(code);
