/**
 * Unity match brief (29 Sep), items 6-8: headless proof of the 3D court page.
 *
 * Boots the built api-server (production mode, so it serves the built UI and
 * unity-build/) on a COPY of the starter DB, creates a career and runs it to
 * its first match day, marks the match watched, then opens the court page the
 * way the game does: inside a parent frame, which records every postMessage
 * the court sends ("unity-loaded", "unity-match-finished").
 *
 * Screenshots are taken at the seconds given (after the page is opened), at
 * the viewport sizes given, into <outDir>. The court page's own title and
 * visible text are read too.
 *
 * Usage: node scripts/webgl-proof/court-proof.mjs <outDir> [--at 2,4,6] [--sizes 1280x720,900x640]
 *        [--until-finished 900] [--gpu]
 * Prints one JSON summary line at the end.
 */
import { fork, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..", "..");
const args = process.argv.slice(2);
const outDir = path.resolve(args[0]);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const AT = opt("--at", "30").split(",").map(Number);
const SIZES = opt("--sizes", "1280x720").split(",").map((s) => s.split("x").map(Number));
const UNTIL_FINISHED = Number(opt("--until-finished", "0"));
const GPU = args.includes("--gpu");
fs.mkdirSync(outDir, { recursive: true });

const ELECTRON = path.join(REPO, "node_modules/electron/dist/electron.exe");
const SERVER = path.join(REPO, "artifacts/api-server/dist/index.mjs");
const PUBLIC_DIR = path.join(REPO, "artifacts/api-server/dist/public");
const PORT = 4198, BASE = `http://localhost:${PORT}`;
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const CDP = 9334;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const work = fs.mkdtempSync(path.join(os.tmpdir(), "court-proof-"));
const db = path.join(work, "court.sqlite");
fs.copyFileSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), db);
const out = fs.openSync(path.join(outDir, "server.log"), "w");
const server = fork(SERVER, [], {
  execPath: ELECTRON,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PUBLIC_DIR, DB_PATH: db, PORT: String(PORT), SESSION_SECRET: "court-proof" },
  stdio: ["ignore", out, out, "ipc"],
});
let chrome = null;
const summary = { shots: [], messages: [], errors: [] };

try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${BASE}/api/healthz`)).ok) break; } catch { /* booting */ } await sleep(500); }
  let cookie = "";
  const api = async (m, p, b) => {
    const r = await fetch(BASE + "/api" + p, { method: m, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    const t = await r.text(); try { return JSON.parse(t); } catch { return t; }
  };
  const prof = await api("POST", "/profiles", { name: "Court Proof" });
  await api("POST", `/profiles/${prof.id}/select`);
  const club = (await api("GET", "/club-templates")).clubs.find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", { slotNumber: 1, managerName: "Court Proof", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  const careerSaveId = (await api("GET", "/careers")).saves.find((s) => s.slotNumber === 1).id;
  const matchId = (await api("POST", "/calendar/next-match")).matchDay.matchId;
  await api("POST", `/matches/${matchId}/watch`, {});
  summary.careerSaveId = careerSaveId; summary.matchId = matchId;
  const courtUrl = `${BASE}/unity-build/index.html?careerSaveId=${careerSaveId}&matchId=${matchId}`;

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "court-chrome-"));
  const gl = GPU ? ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
  chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, ...gl, "--autoplay-policy=no-user-gesture-required",
    `--window-size=${SIZES[0][0]},${SIZES[0][1]}`, "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore" });
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
  const evalJs = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send("Runtime.enable"); await send("Page.enable");
  const size = async ([w, h]) => send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await size(SIZES[0]);

  // The parent page: the court page in a full-size frame, as court.tsx has it.
  await send("Page.navigate", { url: `${BASE}/api/healthz` });
  await sleep(800);
  await evalJs(`(() => {
    document.documentElement.innerHTML = '<body style="margin:0;background:#000"><iframe id="court" src="${courtUrl}" style="border:0;width:100vw;height:100vh;display:block"></iframe></body>';
    window.__msgs = [];
    window.addEventListener("message", (e) => window.__msgs.push({ t: performance.now(), data: String(e.data) }));
    window.__opened = performance.now();
    return true;
  })()`);

  const t0 = Date.now();
  for (const at of [...AT].sort((a, b) => a - b)) {
    while (Date.now() - t0 < at * 1000) await sleep(200);
    for (const s of SIZES) {
      await size(s);
      await sleep(600);
      const shot = await send("Page.captureScreenshot", { format: "png" });
      const file = path.join(outDir, `court-t${String(at).padStart(3, "0")}-${s[0]}x${s[1]}.png`);
      fs.writeFileSync(file, Buffer.from(shot.result.data, "base64"));
      summary.shots.push(path.basename(file));
    }
    await size(SIZES[0]);
  }
  if (UNTIL_FINISHED > 0) {
    while (Date.now() - t0 < UNTIL_FINISHED * 1000) {
      const msgs = await evalJs("window.__msgs");
      if ((msgs ?? []).some((m) => m.data === "unity-match-finished")) break;
      await sleep(1000);
    }
  }
  summary.messages = await evalJs("window.__msgs.map(m => ({ data: m.data, afterSeconds: Math.round((m.t - window.__opened) / 100) / 10 }))");
  summary.match = (await api("GET", "/matches")).find((m) => m.id === matchId);
  summary.match = summary.match && { status: summary.match.status, score: `${summary.match.homeScore}-${summary.match.awayScore}`, sets: summary.match.sets };

  // The court page on its own: its title and every piece of text on it.
  await send("Page.navigate", { url: courtUrl });
  await sleep(3000);
  summary.page = await evalJs(`({ title: document.title, text: document.body.innerText.trim(), images: [...document.images].map(i => i.src), footer: !!document.querySelector("#unity-footer, #unity-logo, #unity-build-title") })`);
  summary.console = consoleLines.filter((l) => /MatchReporter|MatchManager\] match starts|CourtBridge|error/i.test(l)).slice(0, 40);
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
console.log(JSON.stringify(summary));
