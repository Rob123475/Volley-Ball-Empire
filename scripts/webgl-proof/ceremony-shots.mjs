/**
 * 1.1.3 (brief A5): headless-Chromium renders of the two medal ceremonies, the World Finals'
 * and the Empire Nations Cup's, on the real Unity build.
 *
 * The save is harness/ceremonies.mjs's, kept with CEREMONY_KEEP_DB=<save>; <save>.json names its
 * career and the two ceremonies' years. The built api-server is booted on a copy (production mode,
 * serving <public> with unity-build/), and the court page is opened in ceremony mode inside a parent
 * frame, as components/ceremony-dialog.tsx opens it. Screenshots at the seconds given, and the
 * court's [Ceremony] log lines, into <outDir>.
 *
 * Usage: node scripts/webgl-proof/ceremony-shots.mjs <outDir> --db <save> [--public <dir>] [--at 40,46,52] [--gpu]
 */
import { fork, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..", "..");
const args = process.argv.slice(2);
const outDir = path.resolve(args[0]);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SAVE = opt("--db");
const PUBLIC_DIR = path.resolve(opt("--public", path.join(REPO, "artifacts/beach-volleyball/public")));
const AT = opt("--at", "40,46,52").split(",").map(Number);
const GPU = args.includes("--gpu");
const STATE = JSON.parse(fs.readFileSync(`${SAVE}.json`, "utf8"));
fs.mkdirSync(outDir, { recursive: true });

const ELECTRON = path.join(REPO, "node_modules/electron/dist/electron.exe");
const SERVER = path.join(REPO, "artifacts/api-server/dist/index.mjs");
const PORT = 4197, BASE = `http://localhost:${PORT}`;
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const CDP = 9335;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const work = fs.mkdtempSync(path.join(os.tmpdir(), "ceremony-proof-"));
const db = path.join(work, "ceremony.sqlite");
fs.copyFileSync(SAVE, db);
const out = fs.openSync(path.join(outDir, "server.log"), "w");
const server = fork(SERVER, [], {
  execPath: ELECTRON,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PUBLIC_DIR, DB_PATH: db, PORT: String(PORT), SESSION_SECRET: "ceremony-proof",
    STARTER_DB_PATH: path.join(REPO, "lib/db/volleyball-empire.sqlite") },
  stdio: ["ignore", out, out, "ipc"],
});
let chrome = null;
const summary = { careerSaveId: STATE.careerSaveId, shots: [], ceremony: {}, errors: [] };

try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${BASE}/api/healthz`)).ok) break; } catch { /* booting */ } await sleep(500); }
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ceremony-chrome-"));
  const gl = GPU ? ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
  chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, ...gl, "--autoplay-policy=no-user-gesture-required",
    "--window-size=1280,720", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore" });
  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    try { wsUrl = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch { /* up soon */ }
    if (!wsUrl) await sleep(500);
  }
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let nextId = 1; const pending = new Map(); const consoleLines = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === "Runtime.consoleAPICalled") consoleLines.push(`[${m.params.type}] ${(m.params.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ")}`);
    if (m.method === "Runtime.exceptionThrown") summary.errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
  };
  const send = (method, params = {}) => { const id = nextId++; ws.send(JSON.stringify({ id, method, params })); return new Promise((r) => pending.set(id, r)); };
  await send("Runtime.enable"); await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

  for (const event of ["world_finals", "nations_cup"]) {
    const year = STATE[event];
    if (!year) { summary.errors.push(`no ${event} in ${SAVE}.json`); continue; }
    summary.ceremony[event] = await (await fetch(`${BASE}/api/unity/ceremony-state?careerSaveId=${STATE.careerSaveId}&event=${event}&year=${year}`)).json();
    const url = `${BASE}/unity-build/index.html?careerSaveId=${STATE.careerSaveId}&ceremony=${event}&year=${year}`;
    consoleLines.length = 0;
    await send("Page.navigate", { url });
    const t0 = Date.now();
    for (const at of AT) {
      while (Date.now() - t0 < at * 1000) await sleep(250);
      const shot = await send("Page.captureScreenshot", { format: "png" });
      const file = path.join(outDir, `podium-${event}-${year}-t${String(at).padStart(3, "0")}.png`);
      fs.writeFileSync(file, Buffer.from(shot.result.data, "base64"));
      summary.shots.push(path.basename(file));
    }
    summary[`${event}Log`] = consoleLines.filter((l) => /\[Ceremony\]|CourtsideBoards|error|Error/.test(l)).slice(0, 30);
  }
  ws.close();
} catch (err) {
  summary.errors.push(String(err?.stack ?? err));
} finally {
  if (chrome) chrome.kill();
  try { server.send({ type: "shutdown" }); } catch { /* gone */ }
  await sleep(1500);
  try { server.kill(); } catch { /* gone */ }
}
fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ shots: summary.shots, errors: summary.errors, logs: [summary.world_finalsLog, summary.nations_cupLog] }, null, 1));
