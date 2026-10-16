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
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startCareer } from "../../harness/harness-club.mjs";
import { AUDIO_TAP } from "./court-audio.mjs";

const REPO = path.resolve(import.meta.dirname, "..", "..");
const args = process.argv.slice(2);
const outDir = path.resolve(args[0]);
const GPU = args.includes("--gpu");
// Rob, 16 Oct: the music muted (its own button), as in Rob's match: the court must still be heard.
const MUSIC_MUTED = args.includes("--music-muted");
// The volumes stored before the match (Settings), "--start=<crowd>,<commentary>"; 0.5 and 0.25 by default.
const START = (args.find((a) => a.startsWith("--start="))?.slice(8).split(",").map(Number)) ?? [0.5, 0.25];
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
      if (/\[Sound\]|\[Pause\]|\[Commentary\]|MatchManager\] match starts/.test(line)) summary.console.push(line.slice(0, 200));
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
  await js(`localStorage.setItem(${JSON.stringify(VOLUME_KEY)}, JSON.stringify({ crowd: ${START[0]}, commentary: ${START[1]} }))`);
  if (MUSIC_MUTED) await js(`localStorage.setItem("bve.music", JSON.stringify({ volume: 0.4, muted: true })); true`);
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

  const sent = (await waitFor(new RegExp(String.raw`\[Sound\] crowd volume ${START[0].toFixed(2)}`), 240000))
    && (await waitFor(new RegExp(String.raw`\[Sound\] commentary volume ${START[1].toFixed(2)}`), 5000));
  check(`when the court loaded, the page sent the stored volumes (crowd ${START[0].toFixed(2)}, commentary ${START[1].toFixed(2)})`, sent, summary.console.filter((l) => /\[Sound\]/.test(l)).join(" | "));
  await waitFor(/match starts/, 60000);
  await sleep(3000);
  await shot("s1-court-as-stored.png");
  // As stored, before anything changes (Rob's match: crowd 0 and commentary 100 from the start).
  const asStored = await listen(`as stored: crowd ${START[0]}, commentary ${START[1]}`, 25000);
  if (START[0] > 0 || START[1] > 0) check(`heard as stored (crowd ${START[0]}, commentary ${START[1]}${MUSIC_MUTED ? ", music muted" : ""})`, asStored.taps > 0 && asStored.peak > 0.001,
    `peak ${asStored.peak}, ${asStored.samples} reads, ${asStored.taps} tap(s), ${asStored.state}`);

  // Rob, 16 Oct: each volume on its own. With the crowd at 0 everything heard is the commentators,
  // and with the commentary at 0 everything heard is the crowd. Long enough to hold several lines.
  const steps = [
    { crowd: 1, commentary: 1, ms: 10000, heard: true },
    { crowd: 0, commentary: 0, ms: 10000, heard: false },
    { crowd: 0, commentary: 1, ms: 25000, heard: true, what: "commentary alone (crowd 0)" },
    { crowd: 1, commentary: 0, ms: 15000, heard: true, what: "crowd alone (commentary 0)" },
    { crowd: 1, commentary: 1, ms: 8000, heard: true, what: "back to 1 and 1" },
  ];
  for (const st of steps) {
    const before = count(/\[Sound\] commentary volume/);
    await setVolume(st.crowd, st.commentary);
    const got = await waitFor(/\[Sound\] commentary volume/, 5000, before + 1);
    const want = (k, v) => summary.console.slice().reverse().find((l) => l.includes(`[Sound] ${k} volume`))?.trim().endsWith(v.toFixed(2));
    check(`crowd ${st.crowd}, commentary ${st.commentary} reach the court`, got && want("crowd", st.crowd) && want("commentary", st.commentary));
    await sleep(500);
    const h = await listen(`crowd ${st.crowd}, commentary ${st.commentary}`, st.ms);
    if (st.heard) check(`heard: ${st.what ?? `crowd ${st.crowd}, commentary ${st.commentary}`}${MUSIC_MUTED ? ", music muted" : ""}`, h.taps > 0 && h.peak > 0.001, `peak ${h.peak}, ${h.samples} reads, ${h.taps} tap(s), ${h.state}`);
    else check(`silent: crowd ${st.crowd}, commentary ${st.commentary}`, h.samples > 0 && h.peak === 0, `peak ${h.peak} over ${h.samples} reads`);
  }
  // Rob, 16 Oct: the Pause button above the court: the picture and every sound stop, a click on the
  // court doesn't start it again, and Resume does.
  console.error("\nPAUSE AND RESUME (THE BUTTON ABOVE THE COURT)");
  const pauseFrame = async () => crypto.createHash("sha1").update((await send("Page.captureScreenshot", { format: "png" })).result?.data ?? "").digest("hex");
  const pauseClick = () => js(`(() => { const b = document.querySelector('[data-testid="button-court-pause"]'); if (b) b.click(); return b ? b.textContent.trim() : null; })()`);
  const pausesBefore = count(/\[Pause\] paused/);
  const pressedLabel = await pauseClick();
  const pausedNow = (await waitFor(/\[Pause\] paused/, 5000, pausesBefore + 1)) && (await js(`!!document.querySelector('[data-testid="court-paused"]')`));
  check("Pause pauses the court (its log, PAUSED shown, the button now says Resume)", pressedLabel === "Pause" && pausedNow
    && (await js(`document.querySelector('[data-testid="button-court-pause"]')?.textContent.trim()`)) === "Resume", `pressed "${pressedLabel}"`);
  await sleep(1000);
  const pf1 = await pauseFrame(); await sleep(4000); const pf2 = await pauseFrame();
  const heardPaused = await listen("paused", 6000);
  check("paused: the court's picture stands still and nothing is heard", pf1 === pf2 && heardPaused.samples > 0 && heardPaused.peak === 0,
    `picture ${pf1 === pf2 ? "still" : "moved"}, peak ${heardPaused.peak} over ${heardPaused.samples} reads`);
  await shot("p1-court-paused.png");
  for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: 640, y: 420, button: "left", clickCount: 1 });
  await sleep(1500);
  const pf3 = await pauseFrame(); await sleep(3000); const pf4 = await pauseFrame();
  check("a click on the court while paused does not start it", pf3 === pf4 && (await js(`!!document.querySelector('[data-testid="court-paused"]')`)));
  const resumesBefore = count(/\[Pause\] resumed/);
  await pauseClick();
  const resumedNow = (await waitFor(/\[Pause\] resumed/, 5000, resumesBefore + 1)) && !(await js(`!!document.querySelector('[data-testid="court-paused"]')`));
  await sleep(1500);
  const pf5 = await pauseFrame(); await sleep(4000); const pf6 = await pauseFrame();
  const heardResumed = await listen("resumed", 12000);
  check("Resume: the court plays on and is heard again", resumedNow && pf5 !== pf6 && heardResumed.peak > 0.001,
    `picture ${pf5 !== pf6 ? "moving" : "still"}, peak ${heardResumed.peak}`);

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
