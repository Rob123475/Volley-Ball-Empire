/**
 * Update 1, 15 Oct (O-5): the match sound's volumes from Settings reach the
 * 3D court, in headless Chrome (real GPU with --gpu), on the real game page.
 *
 * Boots the built api-server in production mode on a COPY of the starter DB,
 * makes a new career (the harness's own startCareer, Day 1 draft included),
 * stores the volumes as the Settings page does (crowd 50%, commentary 25%),
 * starts the first match with Watch Match, and then:
 *   - when the court has loaded, the court page sent them: the court's own log
 *     says "[Sound] crowd volume 0.50" and "commentary volume 0.25";
 *   - they change while the court plays (saved as Settings saves them): 0 and
 *     0, then 1 and 1, each in the court's log;
 *   - what the court sends to the speakers (every Web Audio node the build
 *     connects to the output is routed through an analyser): heard at 1, and
 *     silent at 0;
 *   - no page errors.
 *
 * Usage: node scripts/webgl-proof/sound-volume-proof.mjs <outDir> [--gpu]
 * Prints one JSON summary line; exits 1 if a check fails.
 */
import { fork, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startCareer } from "../../harness/harness-club.mjs";

const REPO = path.resolve(import.meta.dirname, "..", "..");
const args = process.argv.slice(2);
const outDir = path.resolve(args[0]);
const GPU = args.includes("--gpu");
const W = 1280, H = 720;
fs.mkdirSync(outDir, { recursive: true });

const ELECTRON = path.join(REPO, "node_modules/electron/dist/electron.exe");
const SERVER = path.join(REPO, "artifacts/api-server/dist/index.mjs");
const PUBLIC_DIR = path.join(REPO, "artifacts/api-server/dist/public");
const PORT = 4213, BASE = `http://localhost:${PORT}`;
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const CDP = 9345;
const VOLUME_KEY = "vbe-court-volume", VOLUME_EVENT = "vbe-court-volume-changed";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Runs in every frame before its own scripts: every node connected to the
// speakers goes through one analyser, which the proof reads.
const AUDIO_TAP = `(() => {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  const taps = new WeakMap();
  const tapFor = (ctx) => {
    if (!taps.has(ctx)) {
      const a = ctx.createAnalyser(); a.fftSize = 2048;
      AudioNode.prototype.__vbeConnect.call(a, ctx.destination);
      taps.set(ctx, a);
      (window.__vbeTaps = window.__vbeTaps || []).push(a);
    }
    return taps.get(ctx);
  };
  AudioNode.prototype.__vbeConnect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    if (dest instanceof AudioDestinationNode) return this.__vbeConnect(tapFor(dest.context), ...rest);
    return this.__vbeConnect(dest, ...rest);
  };
  window.__vbeLevel = () => {
    let peak = 0, sum = 0, n = 0;
    for (const a of window.__vbeTaps || []) {
      const buf = new Float32Array(a.fftSize); a.getFloatTimeDomainData(buf);
      for (const s of buf) { peak = Math.max(peak, Math.abs(s)); sum += s * s; n++; }
    }
    return { peak, rms: n ? Math.sqrt(sum / n) : -1, taps: (window.__vbeTaps || []).length,
      state: (window.__vbeTaps || []).map((a) => a.context.state).join(",") };
  };
})();`;

const work = fs.mkdtempSync(path.join(os.tmpdir(), "sound-volume-"));
const dbFile = path.join(work, "save.sqlite");
fs.copyFileSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), dbFile);
const out = fs.openSync(path.join(outDir, "server.log"), "w");
const server = fork(SERVER, [], {
  execPath: ELECTRON,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PUBLIC_DIR, DB_PATH: dbFile, PORT: String(PORT), SESSION_SECRET: "sound-volume" },
  stdio: ["ignore", out, out, "ipc"],
});
let chrome = null;
const summary = { checks: [], levels: [], console: [], errors: [] };
let ok = true;
const check = (label, cond, detail = "") => { summary.checks.push({ label, pass: !!cond, detail }); if (!cond) ok = false; console.error(`${cond ? "PASS" : "FAIL"}  ${label}  ${detail}`); };

try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${BASE}/api/healthz`)).ok) break; } catch { /* booting */ } await sleep(500); }
  let cookie = "";
  const api = async (m, p, b) => {
    const r = await fetch(BASE + "/api" + p, { method: m, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    const t = await r.text(); let data = null; try { data = t ? JSON.parse(t) : null; } catch { data = t; }
    return { status: r.status, data };
  };
  const prof = await api("POST", "/profiles", { name: "Sound Volume" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = (await api("GET", "/club-templates")).data.clubs.find((c) => c.name === "Sydney Riptide");
  await startCareer(api, { managerFaceId: 8, slotNumber: 1, managerName: "Sound Test", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", gameDifficulty: "medium", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "sound-volume-chrome-"));
  const gl = GPU ? ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
  chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, ...gl, "--autoplay-policy=no-user-gesture-required",
    `--window-size=${W},${H}`, "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore" });
  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    try { wsUrl = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch { /* up soon */ }
    if (!wsUrl) await sleep(500);
  }
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let nextId = 1; const pending = new Map();
  const contexts = new Map();   // execution context id -> frame id
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === "Runtime.executionContextCreated") contexts.set(m.params.context.id, m.params.context.auxData?.frameId);
    if (m.method === "Runtime.consoleAPICalled") {
      const line = (m.params.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ");
      if (/\[Sound\]|MatchManager\] match starts/.test(line)) summary.console.push(line.slice(0, 200));
    }
    if (m.method === "Runtime.exceptionThrown") summary.errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
  };
  const send = (method, params = {}) => { const id = nextId++; ws.send(JSON.stringify({ id, method, params })); return new Promise((r) => pending.set(id, r)); };
  const js = async (expr, contextId) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true, ...(contextId ? { contextId } : {}) })).result?.result?.value;
  await send("Page.addScriptToEvaluateOnNewDocument", { source: AUDIO_TAP });
  await send("Runtime.enable"); await send("Page.enable");
  const [cn, cv] = cookie.split("=");
  await send("Network.enable"); await send("Network.setCookie", { name: cn, value: cv, url: BASE });
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  const shot = async (name) => { const s = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(outDir, name), Buffer.from(s.result.data, "base64")); };
  const count = (re) => summary.console.filter((l) => re.test(l)).length;
  const waitFor = async (re, ms, n = 1) => { const t = Date.now(); while (Date.now() - t < ms) { if (count(re) >= n) return true; await sleep(250); } return false; };
  // What the court sends to the speakers, sampled over `ms` (the court's frame).
  const courtContext = async () => {
    const tree = (await send("Page.getFrameTree")).result.frameTree;
    const courtFrame = (tree.childFrames ?? []).map((c) => c.frame).find((f) => /unity-build/.test(f.url));
    for (const [id, frameId] of [...contexts].reverse()) if (frameId === courtFrame?.id) {
      if ((await js("typeof window.__vbeLevel", id)) === "function") return id;
    }
    return null;
  };
  const listen = async (label, ms) => {
    const ctx = await courtContext();
    let peak = 0, sumRms = 0, n = 0, taps = 0, state = "";
    for (const t = Date.now(); Date.now() - t < ms;) {
      const l = ctx ? await js("window.__vbeLevel()", ctx) : null;
      if (l) { peak = Math.max(peak, l.peak); sumRms += Math.max(0, l.rms); n++; taps = l.taps; state = l.state; }
      await sleep(50);
    }
    const r = { label, peak: Number(peak.toFixed(5)), rms: Number((n ? sumRms / n : -1).toFixed(5)), samples: n, taps, state };
    summary.levels.push(r);
    console.error(`  heard (${label}): peak ${r.peak}, mean RMS ${r.rms}, ${n} reads, ${taps} output tap(s), ${state}`);
    return r;
  };
  const setVolume = async (crowd, commentary) => {
    await js(`localStorage.setItem(${JSON.stringify(VOLUME_KEY)}, JSON.stringify({ crowd: ${crowd}, commentary: ${commentary} })); window.dispatchEvent(new Event(${JSON.stringify(VOLUME_EVENT)})); true`);
  };

  // As chosen on the Settings page: crowd 50%, commentary 25%.
  await send("Page.navigate", { url: BASE + "/" });
  await sleep(2500);
  await js(`localStorage.setItem(${JSON.stringify(VOLUME_KEY)}, JSON.stringify({ crowd: 0.5, commentary: 0.25 }))`);
  await send("Page.navigate", { url: BASE + "/" });
  await sleep(2500);
  for (let i = 0; i < 40 && !(await js(`[...document.querySelectorAll("button")].some(b => /Next match/.test(b.textContent))`)); i++) {
    await js(`[...document.querySelectorAll("button")].find(b => /^ *continue *$/i.test(b.textContent.trim()))?.click()`);
    await sleep(400);
  }
  await js(`[...document.querySelectorAll("button")].find(x => /Next match/.test(x.textContent))?.click()`);
  let watched = false;
  for (let i = 0; i < 60 && !watched; i++) {
    await sleep(500);
    watched = await js(`(() => { const b = [...document.querySelectorAll('[data-testid="match-day-box"] button')].find(x => /Watch/i.test(x.textContent)); if (b && !b.disabled) { b.click(); return true; } return false; })()`);
  }
  check("Next match, then Watch Match", watched);

  const sent = (await waitFor(/\[Sound\] crowd volume 0\.50/, 240000)) && (await waitFor(/\[Sound\] commentary volume 0\.25/, 5000));
  check("when the court loaded, the page sent the stored volumes (crowd 0.50, commentary 0.25)", sent, summary.console.filter((l) => /\[Sound\]/.test(l)).join(" | "));
  await waitFor(/match starts/, 60000);
  await sleep(5000);
  await shot("s1-court-crowd-50-commentary-25.png");

  await setVolume(1, 1);
  const full = (await waitFor(/\[Sound\] crowd volume 1\.00/, 5000)) && (await waitFor(/\[Sound\] commentary volume 1\.00/, 5000));
  check("changed while the court plays: 1 and 1 reach the court", full);
  const heardFull = await listen("crowd 1, commentary 1", 8000);

  await setVolume(0, 0);
  const zero = (await waitFor(/\[Sound\] crowd volume 0\.00/, 5000)) && (await waitFor(/\[Sound\] commentary volume 0\.00/, 5000));
  check("changed again: 0 and 0 reach the court", zero);
  await sleep(500);
  const heardZero = await listen("crowd 0, commentary 0", 10000);

  await setVolume(1, 1);
  await waitFor(/\[Sound\] crowd volume 1\.00/, 5000, 2);
  await sleep(500);
  const heardBack = await listen("back to 1 and 1", 8000);

  check("the court is heard at 1", heardFull.taps > 0 && heardFull.peak > 0.001, `peak ${heardFull.peak}, ${heardFull.taps} tap(s), ${heardFull.state}`);
  check("the court is silent at 0", heardZero.samples > 0 && heardZero.peak === 0, `peak ${heardZero.peak} over ${heardZero.samples} reads`);
  check("and heard again at 1", heardBack.peak > 0.001, `peak ${heardBack.peak}`);
  await shot("s2-court-after.png");
  check("no page errors", summary.errors.length === 0, summary.errors.slice(0, 2).join(" | "));
  ws.close();
} catch (err) {
  ok = false;
  summary.errors.push(String(err?.stack ?? err));
} finally {
  if (chrome) chrome.kill();
  try { server.send({ type: "shutdown" }); } catch { /* gone */ }
  await sleep(1500);
  try { server.kill(); } catch { /* gone */ }
}
fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
process.exit(ok ? 0 : 1);
