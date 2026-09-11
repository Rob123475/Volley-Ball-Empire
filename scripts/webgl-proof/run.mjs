/**
 * R-40 proof run: fork the built api-server against a COPY of the live save,
 * serve the WebGL build in production mode, drive headless Chrome at it, then
 * stop the server through R-31's graceful shutdown.
 *
 * Usage: node scripts/webgl-proof/run.mjs <copyOfASave.sqlite> <out.png> <label>
 *   R40_GPU=1         render on the real GPU (ANGLE d3d11) instead of SwiftShader
 *   R40_PUBLIC_DIR=…  serve a different public dir (e.g. an older build, as a control)
 * Then: python scripts/webgl-proof/stats.py <out.png>  (sky-blue vs sand share)
 */
import { fork, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..", "..");
const LIVE = path.resolve("C:/Users/rbonn/AppData/Roaming/Beach Volleyball Empire/volleyball-empire.sqlite");
const [, , dbArg, outPng, label = "run"] = process.argv;
const dbPath = path.resolve(dbArg);

if (dbPath.toLowerCase() === LIVE.toLowerCase()) {
  console.error("REFUSING: that is the live save. The proof server only ever opens a copy.");
  process.exit(2);
}

const ELECTRON = path.join(REPO, "node_modules/electron/dist/electron.exe");
const SERVER = path.join(REPO, "artifacts/api-server/dist/index.mjs");
// Overridable so a control run can serve an older build from a scratch folder.
const PUBLIC_DIR = process.env.R40_PUBLIC_DIR || path.join(REPO, "artifacts/api-server/dist/public");
console.log(`serving PUBLIC_DIR ${PUBLIC_DIR}`);
const PORT = 4199;
const base = `http://localhost:${PORT}`;

const serverLog = path.join(path.dirname(outPng), `${label}-server.log`);
const out = fs.openSync(serverLog, "w");
const child = fork(SERVER, [], {
  execPath: ELECTRON,
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    NODE_ENV: "production",
    PUBLIC_DIR,
    DB_PATH: dbPath,
    PORT: String(PORT),
    SESSION_SECRET: "r40-proof-only",
  },
  stdio: ["ignore", out, out, "ipc"],
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let exited = false;
child.once("exit", () => { exited = true; });

async function stop() {
  if (exited) return "already exited";
  try { child.send({ type: "shutdown" }); } catch { /* no channel */ }
  for (let i = 0; i < 200 && !exited; i++) await sleep(50);
  if (!exited) { child.kill("SIGKILL"); return "KILLED (graceful shutdown timed out)"; }
  return "graceful";
}

try {
  let up = false;
  for (let i = 0; i < 120; i++) {
    // /api/health sits behind the session gate and answers 401 without a
    // cookie; any HTTP answer at all means the listener is up.
    try { if ((await fetch(`${base}/api/health`)).status < 500) { up = true; break; } } catch { /* booting */ }
    if (exited) break;
    await sleep(500);
  }
  if (!up) throw new Error(`server never answered /api/health (see ${serverLog})`);
  console.log(`server up on ${base} against ${dbPath}`);

  const ms = await fetch(`${base}/api/unity/match-state?careerSaveId=9`);
  const body = await ms.json().catch(() => ({}));
  const players = body.players ?? body.homePlayers?.concat(body.awayPlayers ?? []) ?? [];
  console.log(`match-state?careerSaveId=9 -> ${ms.status}, players in payload: ${Array.isArray(players) ? players.length : "?"}`);

  const idx = await fetch(`${base}/unity-build/index.html`);
  console.log(`unity-build/index.html -> ${idx.status}`);

  const proof = spawnSync(process.execPath, [
    path.join(import.meta.dirname, "proof.mjs"),
    `${base}/unity-build/index.html?careerSaveId=9`,
    outPng,
    "300",
  ], { stdio: "inherit" });
  console.log(`proof exit ${proof.status}`);
} catch (err) {
  console.error(`RUN FAILED: ${err.message}`);
} finally {
  console.log(`server stop: ${await stop()}`);
}
