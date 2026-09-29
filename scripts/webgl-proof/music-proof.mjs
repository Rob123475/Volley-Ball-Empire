/**
 * Unity match brief (29 Sep), item 9 — the soundtrack during the 3D match.
 *
 * The real server (production mode, serving the built UI) on a starter-DB
 * copy, headless Chrome with autoplay allowed as Electron allows it. A new
 * career is run to its first match day; the dashboard plays the soundtrack;
 * "Watch Match" opens the 3D court; then "Leave match". The page's one <audio>
 * element is captured as it is created, and its state sampled every 250 ms.
 *
 * Usage: node scripts/webgl-proof/music-proof.mjs <outJson>
 */
import { fork, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..", "..");
const outJson = path.resolve(process.argv[2] ?? "music-proof.json");
const ELECTRON = path.join(REPO, "node_modules/electron/dist/electron.exe");
const PORT = 4197, BASE = `http://localhost:${PORT}`, CDP = 9335;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const work = fs.mkdtempSync(path.join(os.tmpdir(), "music-proof-"));
const db = path.join(work, "m.sqlite");
fs.copyFileSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), db);
const server = fork(path.join(REPO, "artifacts/api-server/dist/index.mjs"), [], {
  execPath: ELECTRON, stdio: ["ignore", "ignore", "ignore", "ipc"],
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PUBLIC_DIR: path.join(REPO, "artifacts/api-server/dist/public"),
    DB_PATH: db, PORT: String(PORT), SESSION_SECRET: "music-proof" },
});
const out = { samples: [], steps: [] };
let chrome;
try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${BASE}/api/healthz`)).ok) break; } catch { /* booting */ } await sleep(500); }
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "music-chrome-"));
  chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`,
    "--autoplay-policy=no-user-gesture-required", "--window-size=1280,800", "--no-first-run", "about:blank"], { stdio: "ignore" });
  let wsUrl;
  for (let i = 0; i < 60 && !wsUrl; i++) { try { wsUrl = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch { /* up soon */ } if (!wsUrl) await sleep(500); }
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 1; const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (method, params = {}) => { const i = id++; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((r) => pend.set(i, r)); };
  const ev = async (x) => (await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  // Capture the provider's <audio> the moment it is made.
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    (() => { const orig = Document.prototype.createElement;
      Document.prototype.createElement = function (tag, ...rest) { const el = orig.call(this, tag, ...rest);
        if (String(tag).toLowerCase() === "audio") window.__audio = el; return el; }; })();` });

  await send("Page.navigate", { url: `${BASE}/login` }); await sleep(2500);
  await ev(`(async () => {
    const J = (u, o = {}) => fetch(u, { headers: { "content-type": "application/json" }, ...o }).then(r => r.json());
    const p = await J("/api/profiles", { method: "POST", body: JSON.stringify({ name: "Music Proof" }) });
    await fetch("/api/profiles/" + p.id + "/select", { method: "POST" });
    const c = (await J("/api/club-templates")).clubs.find(x => x.name === "Sydney Riptide");
    await J("/api/careers", { method: "POST", body: JSON.stringify({ slotNumber: 1, managerName: "Music Proof", managerNationality: "Australia", clubName: c.name, originalClubName: c.name, budget: c.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 }) });
    await J("/api/calendar/next-match", { method: "POST" });
    return true; })()`);
  await send("Page.navigate", { url: `${BASE}/` }); await sleep(3000);
  // The title screen first, as for a player: CONTINUE to the dashboard.
  await ev(`(() => { const b = [...document.querySelectorAll("button")].find(x => /^\s*CONTINUE\s*$/i.test(x.textContent)); if (b) b.click(); return !!b; })()`);
  await sleep(5000);

  const state = () => ev(`(() => { const a = window.__audio; return a ? { t: Math.round(performance.now()), path: location.pathname, src: (a.currentSrc || a.src).split("/").pop(), paused: a.paused, volume: Math.round(a.volume * 1000) / 1000, time: Math.round(a.currentTime * 10) / 10 } : null; })()`);
  out.steps.push({ step: "dashboard, before the match", ...(await state()) });

  const clicked = await ev(`(() => { const b = [...document.querySelectorAll("button")].find(x => /Watch Match/.test(x.textContent)); if (b) b.click(); return !!b; })()`);
  out.steps.push({ step: `pressed Watch Match (${clicked ? "found" : "NOT FOUND"})`, ...(clicked ? {} : { page: await ev("document.body.innerText.slice(0, 600)") }) });
  const t0 = Date.now();
  while (Date.now() - t0 < 4000) { out.samples.push({ ms: Date.now() - t0, ...(await state()) }); await sleep(250); }
  out.steps.push({ step: "on the court, 4 s after Watch Match", ...(await state()) });

  const left = await ev(`(() => { const b = document.querySelector('[data-testid="button-leave-match"]'); if (b) b.click(); return !!b; })()`);
  out.steps.push({ step: `pressed Leave match (${left ? "found" : "NOT FOUND"})` });
  await sleep(3000);
  out.steps.push({ step: "back on the dashboard, 3 s after leaving", ...(await state()) });
  ws.close();
} catch (err) {
  out.error = String(err?.stack ?? err);
} finally {
  if (chrome) chrome.kill();
  try { server.send({ type: "shutdown" }); } catch { /* gone */ }
  await sleep(1500);
}
fs.writeFileSync(outJson, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out.steps, null, 1));
const firstPaused = out.samples.find((s) => s.paused);
console.log(`music stopped ${firstPaused ? firstPaused.ms + " ms" : "NEVER"} after Watch Match`);
