/**
 * Rob, 16 Oct: the game's sound in the PACKAGED game, every slider, measured
 * at the output: what the 3D court sends to the speakers (court-audio.mjs) and
 * what Windows receives from the game (windows-audio-meter.ps1, the game's own
 * audio session meter).
 *
 * The real packaged exe on a throwaway profile (--user-data-dir on a temporary
 * folder, as package-proof.mjs; Rob's saves hashed before and after). A new
 * career through the game's own API (the harness's startCareer, the Day 1
 * draft included), then, in the game's window:
 *   1. Settings > Sound, through its sliders and Mute: the master is first; the
 *      music is heard at 40%; the master scales it (50%: the element at 0.2) and
 *      silences it at 0; the music's Mute silences the songs and nothing else
 *      changes; then Rob's sliders (crowd 0, commentary 100, the music muted).
 *   2. Next match, Watch Match: heard as stored (the commentary, with the crowd
 *      at 0 and the music muted).
 *   3. The court's own Settings (the gear above the court), over the match: the
 *      match carries on and is heard with the settings open; each slider there:
 *      commentary alone, crowd alone, both 0 silent, master 0 silent, master 50%
 *      (the court gets half), all back; Auto / Manual reach the court; closing
 *      gives the keyboard back to the court; still on the court, no page errors.
 * Diagnostics used to find the 16 Oct fault (not in the default run): --blur
 * (the focus off the court), --manual, --pause-cycle (Esc twice),
 * --second-visit=<crowd>,<commentary> (leave, change, watch the next match).
 *
 * Usage: node scripts/webgl-proof/package-sound-proof.mjs "<exe>" <outDir> [--start=<crowd>,<commentary>] [--music-muted] [diagnostics]
 * One JSON summary on stdout; exits 1 if a check fails.
 */
import { execFile, spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startCareer } from "../../harness/harness-club.mjs";
import { AUDIO_TAP } from "./court-audio.mjs";

// Every <audio> the game makes (the music), so its volume and mute can be read.
const MEDIA_HOOK = `(() => {
  const make = Document.prototype.createElement;
  Document.prototype.createElement = function (tag, ...rest) {
    const el = make.call(this, tag, ...rest);
    if (String(tag).toLowerCase() === "audio") (window.__vbeMedia = window.__vbeMedia || []).push(el);
    return el;
  };
})();`;

const args = process.argv.slice(2);
const EXE = path.resolve(args[0]);
const outDir = path.resolve(args[1]);
const MUSIC_MUTED = args.includes("--music-muted");
// Manual (Rob plays Manual) and a pause and resume with Esc (Manual's pause pauses all the court's sound).
const MANUAL = args.includes("--manual"), PAUSE_CYCLE = args.includes("--pause-cycle");
// Rob's way: leave the first match (forfeit), change the volumes, watch the next: "--second-visit=<crowd>,<commentary>".
const SECOND = args.find((a) => a.startsWith("--second-visit="))?.slice(15).split(",").map(Number) ?? null;
// The focus moved off the court onto the game page around it (a click on its bar), then back.
const BLUR = args.includes("--blur");
const START = (args.find((a) => a.startsWith("--start="))?.slice(8).split(",").map(Number)) ?? [0, 1];
fs.mkdirSync(outDir, { recursive: true });
const CDP = 9339, BASE = "http://localhost:4173";
const VOLUME_KEY = "vbe-court-volume", VOLUME_EVENT = "vbe-court-volume-changed";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const summary = { exe: EXE, start: START, musicMuted: MUSIC_MUTED, checks: [], levels: [], console: [], errors: [] };
let ok = true;
const check = (label, cond, detail = "") => { summary.checks.push({ label, pass: !!cond, detail }); if (!cond) ok = false; console.error(`${cond ? "PASS" : "FAIL"}  ${label}  ${detail}`); };

// Rob's saves: stat and hash only (read, never opened by SQLite, never written).
const APPDATA = process.env.APPDATA;
const robFiles = ["Beach Volleyball Empire", "Volleyball Empire"].flatMap((d) =>
  ["volleyball-empire.sqlite", "volleyball-empire.sqlite-wal", "volleyball-empire.sqlite-shm"].map((f) => path.join(APPDATA, d, f)));
const fingerprint = () => Object.fromEntries(robFiles.filter((f) => fs.existsSync(f)).map((f) => {
  const st = fs.statSync(f); return [f, { size: st.size, mtime: st.mtime.toISOString(), sha1: crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex") }];
}));
summary.robBefore = fingerprint();

let busy = false; try { busy = (await fetch(`${BASE}/api/healthz`)).ok; } catch { /* free */ }
if (busy) { console.log(JSON.stringify({ error: "port 4173 is in use (is the game running?); not starting" })); process.exit(1); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-sound-proof-"));
const log = fs.openSync(path.join(outDir, "electron.log"), "w");
const app = spawn(EXE, [`--user-data-dir=${path.join(tmp, "root")}`, `--remote-debugging-port=${CDP}`,
  "--disable-features=CalculateNativeWinOcclusion", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "--disable-background-timer-throttling"], { stdio: ["ignore", log, log] });

let ws;
try {
  let target;
  for (let i = 0; i < 240 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((t) => t.type === "page" && t.url.startsWith(BASE)); } catch { /* starting */ }
    if (!target) await sleep(500);
  }
  if (!target) throw new Error("the game window never loaded the game page");

  // A career through the game's own API, on this test profile's session.
  let cookie = "";
  const api = async (m, p, b) => {
    const r = await fetch(BASE + "/api" + p, { method: m, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    const t = await r.text(); let data = null; try { data = t ? JSON.parse(t) : null; } catch { data = t; }
    return { status: r.status, data };
  };
  const prof = await api("POST", "/profiles", { name: "Sound Proof" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = (await api("GET", "/club-templates")).data.clubs.find((c) => c.name === "Sydney Riptide");
  await startCareer(api, { managerFaceId: 8, slotNumber: 1, managerName: "Sound Proof", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", gameDifficulty: "medium", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });

  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let nextId = 1; const pending = new Map(); const contexts = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === "Runtime.executionContextCreated") contexts.set(m.params.context.id, m.params.context.auxData?.frameId);
    if (m.method === "Runtime.consoleAPICalled") {
      const line = (m.params.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ").trim();
      if (/\[Sound\]|\[Pause\]|\[Commentary\]|\[Manual\] (mode|paused|resumed)|MatchManager\] match starts/.test(line)) summary.console.push(line.slice(0, 200));
    }
    if (m.method === "Runtime.exceptionThrown") summary.errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
  };
  const send = (method, params = {}) => { const id = nextId++; ws.send(JSON.stringify({ id, method, params })); return new Promise((r) => pending.set(id, r)); };
  const js = async (expr, contextId) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true, ...(contextId ? { contextId } : {}) })).result?.result?.value;
  const shot = async (name) => { const s = await send("Page.captureScreenshot", { format: "png" }); if (s.result) fs.writeFileSync(path.join(outDir, name), Buffer.from(s.result.data, "base64")); };
  const count = (re) => summary.console.filter((l) => re.test(l)).length;
  const waitFor = async (re, ms, n = 1) => { const t = Date.now(); while (Date.now() - t < ms) { if (count(re) >= n) return true; await sleep(250); } return false; };
  const waitJs = async (expr, ms) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await js(expr)) return true; } catch { /* navigating */ } await sleep(500); } return false; };

  await send("Page.addScriptToEvaluateOnNewDocument", { source: AUDIO_TAP });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: MEDIA_HOOK });
  await send("Runtime.enable"); await send("Page.enable"); await send("Network.enable");
  const [cn, cv] = cookie.split("=");
  await send("Network.setCookie", { name: cn, value: cv, url: BASE });
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

  // A fresh profile: the music at 40%, playing; the court's volumes never set; Auto or Manual.
  await js(`localStorage.setItem("bve.music", JSON.stringify({ volume: 0.4, muted: false }));
    localStorage.setItem("vbe-court-control-mode", ${JSON.stringify(MANUAL ? "manual" : "auto")}); true`);
  await send("Page.navigate", { url: BASE + "/" });
  await waitJs(`[...document.querySelectorAll("button")].some(b => /^continue$/i.test(b.textContent.trim()))`, 30000);
  await js(`[...document.querySelectorAll("button")].find(b => /^continue$/i.test(b.textContent.trim()))?.click()`);
  await waitJs(`!!document.querySelector('[data-testid="button-next-match"]')`, 30000);

  // What Windows receives from the game over the same seconds (its audio session's peak meter, mixer volume and mute).
  const windowsMeter = (ms) => new Promise((resolve) => execFile("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
    path.join(import.meta.dirname, "windows-audio-meter.ps1"), "-ProcessName", path.basename(EXE, ".exe"), "-Seconds", String(ms / 1000)],
    { timeout: ms + 30000 }, (err, stdout) => { try { resolve(JSON.parse(stdout.trim())); } catch { resolve({ error: String(err ?? stdout).slice(0, 200) }); } }));
  // As a player drags a slider: React's own value setter, then the input event.
  const setRange = (testid, v) => js(`(() => { const el = document.querySelector('[data-testid="${testid}"]'); if (!el) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, "${v}"); el.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
  const clickTestid = (testid) => js(`(() => { const e = document.querySelector('[data-testid="${testid}"]'); if (e) e.click(); return !!e; })()`);
  const music = () => js(`(() => { const a = (window.__vbeMedia || [])[0]; return a ? { volume: Math.round(a.volume * 1000) / 1000, muted: a.muted, paused: a.paused } : null; })()`);
  const stored = () => js(`({ court: JSON.parse(localStorage.getItem(${JSON.stringify(VOLUME_KEY)}) ?? "null"), music: JSON.parse(localStorage.getItem("bve.music") ?? "null") })`);

  // ── 1. Settings > Sound ─────────────────────────────────────────────────────
  console.error("\n1. SETTINGS > SOUND: THE MASTER, THE MUSIC AND ITS MUTE (only the music plays here)");
  await js(`history.pushState(null, "", "/settings"); dispatchEvent(new PopStateEvent("popstate")); true`);
  await waitJs(`!!document.querySelector('[data-testid="sound-master-volume"]')`, 20000);
  const order = await js(`[...document.querySelectorAll('input[type="range"], [data-testid="sound-mute"]')].map(e => e.dataset.testid).filter(t => /^sound-/.test(t ?? ""))`);
  check("Sound: the master first, then the music (Mute and volume), the crowd and the commentary", JSON.stringify(order) === JSON.stringify(["sound-master-volume", "sound-mute", "sound-volume", "sound-crowd-volume", "sound-commentary-volume"]), JSON.stringify(order));
  check("the master starts at 100%", (await js(`document.querySelector('[data-testid="sound-master-volume"]').value`)) === "100");
  await setRange("sound-volume", 40); await sleep(1500);
  const m1 = await music(), w1 = await windowsMeter(6000);
  check("the music plays at 40% (master 100%) and is heard", m1 && !m1.paused && !m1.muted && m1.volume === 0.4 && w1.peak > 0.001, `element ${JSON.stringify(m1)}, Windows peak ${w1.peak}`);
  await setRange("sound-master-volume", 50); await sleep(800);
  const m2 = await music(), w2 = await windowsMeter(6000);
  check("master 50%: the music plays at 0.2 (40% x 50%) and is heard", m2?.volume === 0.2 && w2.peak > 0.001, `element ${JSON.stringify(m2)}, Windows peak ${w2.peak}`);
  await setRange("sound-master-volume", 0); await sleep(800);
  const m3 = await music(), w3 = await windowsMeter(5000);
  check("master 0%: the music is silent", m3?.volume === 0 && w3.peak === 0, `element ${JSON.stringify(m3)}, Windows peak ${w3.peak}`);
  await setRange("sound-master-volume", 100); await sleep(800);
  const beforeMute = await stored();
  await clickTestid("sound-mute"); await sleep(800);
  const m4 = await music(), w4 = await windowsMeter(5000), afterMute = await stored();
  check("the music's Mute: the songs are silent", m4?.muted === true && w4.peak === 0 && afterMute.music?.muted === true, `element ${JSON.stringify(m4)}, Windows peak ${w4.peak}`);
  check("and it changes nothing else (the master, crowd and commentary stored as before)", JSON.stringify(beforeMute.court) === JSON.stringify(afterMute.court), JSON.stringify(afterMute.court));
  // Rob's sliders.
  await setRange("sound-crowd-volume", Math.round(START[0] * 100)); await sleep(300);
  await setRange("sound-commentary-volume", Math.round(START[1] * 100)); await sleep(300);
  if (!MUSIC_MUTED) { await clickTestid("sound-mute"); await sleep(300); }
  summary.settingsPage = await stored();
  await shot("s0-settings.png");
  check(`Rob's sliders stored: master 100%, crowd ${START[0] * 100}%, commentary ${START[1] * 100}%${MUSIC_MUTED ? ", the music muted" : ""}`,
    JSON.stringify(summary.settingsPage.court) === JSON.stringify({ master: 1, crowd: START[0], commentary: START[1] }) && summary.settingsPage.music?.muted === MUSIC_MUTED,
    JSON.stringify(summary.settingsPage));
  await js(`history.pushState(null, "", "/"); dispatchEvent(new PopStateEvent("popstate")); true`);
  await waitJs(`!!document.querySelector('[data-testid="button-next-match"]')`, 20000);

  // ── 2. The match, as stored ─────────────────────────────────────────────────
  console.error("\n2. THE MATCH, AS STORED");
  await js(`document.querySelector('[data-testid="button-next-match"]').click()`);
  await waitJs(`!!document.querySelector('[data-testid="match-day-box"]')`, 120000);
  const watched = await js(`(() => { const b = [...document.querySelectorAll('[data-testid="match-day-box"] button')].find(x => /Watch Match/.test(x.textContent)); if (b) b.click(); return !!b; })()`);
  check("Next match, then Watch Match", watched);
  const sent = (await waitFor(new RegExp(String.raw`\[Sound\] crowd volume ${START[0].toFixed(2)}`), 300000))
    && (await waitFor(new RegExp(String.raw`\[Sound\] commentary volume ${START[1].toFixed(2)}`), 5000));
  check(`when the court loaded, the page sent the stored volumes (crowd ${START[0].toFixed(2)}, commentary ${START[1].toFixed(2)})`, sent, summary.console.filter((l) => /\[Sound\]/.test(l)).join(" | "));
  await waitFor(/match starts/, 60000);
  await sleep(3000);
  await shot("s1-court-as-stored.png");

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
    const win = windowsMeter(ms);
    let peak = 0, sumRms = 0, n = 0, taps = 0, state = "";
    for (const t = Date.now(); Date.now() - t < ms;) {
      const l = ctx ? await js("window.__vbeLevel()", ctx) : null;
      if (l) { peak = Math.max(peak, l.peak); sumRms += Math.max(0, l.rms); n++; taps = l.taps; state = l.state; }
      await sleep(50);
    }
    const w = await win;
    const r = { label, peak: Number(peak.toFixed(5)), rms: Number((n ? sumRms / n : -1).toFixed(5)), samples: n, taps, state, windows: w };
    summary.levels.push(r);
    console.error(`  heard (${label}): peak ${r.peak}, mean RMS ${r.rms}, ${n} reads, ${taps} output tap(s), ${state}; Windows: peak ${w.peak}, sessions ${JSON.stringify(w.sessions)}, device ${w.deviceVolume}${w.deviceMuted ? " muted" : ""}`);
    return r;
  };
  // Heard: the court's output carries sound AND Windows receives it from the game (its session's meter).
  const heard = (label, h) => check(`heard: ${label}${MUSIC_MUTED ? ", music muted" : ""}`, h.taps > 0 && h.peak > 0.001 && h.windows?.peak > 0.001,
    `court peak ${h.peak}, Windows peak ${h.windows?.peak}, ${h.samples} reads, ${h.taps} tap(s), ${h.state}`);
  const silent = (label, h) => check(`silent: ${label}`, h.samples > 0 && h.peak === 0, `court peak ${h.peak} over ${h.samples} reads, Windows peak ${h.windows?.peak}`);

  const asStored = await listen(`as stored: crowd ${START[0]}, commentary ${START[1]}`, 25000);
  if (START[0] > 0 || START[1] > 0) heard(`as stored (crowd ${START[0]}, commentary ${START[1]})`, asStored);

  if (BLUR) {
    await js(`(() => { const b = document.querySelector('[data-testid="button-leave-match"]'); b.focus(); return document.activeElement === b; })()`);
    await sleep(1000);
    const off = await listen("the focus off the court (on its bar)", 15000);
    // Is the match still moving? Two pictures of the court 4 s apart, and the court's own clock.
    const frame = async () => crypto.createHash("sha1").update((await send("Page.captureScreenshot", { format: "png" })).result?.data ?? "").digest("hex");
    const f1 = await frame(); await sleep(4000); const f2 = await frame();
    summary.blur = { activeElement: await js(`document.activeElement?.tagName`), courtPictureChanged: f1 !== f2 };
    console.error(`  focus off the court: the court's picture ${f1 !== f2 ? "changed (still playing)" : "did not change (stopped)"} over 4 s`);
    heard("with the focus off the court", off);
    await shot("s1d-focus-off-court.png");
    await js(`(() => { const f = document.querySelector("iframe"); f.focus(); f.contentWindow.focus(); return true; })()`);
    await sleep(1000);
    heard("the focus back on the court", await listen("the focus back on the court", 15000));
  }

  if (PAUSE_CYCLE) {
    // Esc on the court (its iframe has the focus, as the court page gives it): paused, then resumed.
    const esc = async () => { for (const type of ["keyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { type, key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); };
    await js(`document.querySelector("iframe")?.focus(); true`);
    await esc();
    check("Esc paused the court", await waitFor(/\[Manual\] paused/, 5000), summary.console.filter((l) => /\[Manual\]/.test(l)).join(" | "));
    await sleep(1000);
    const paused = await listen("paused", 6000);
    silent("paused", paused);
    await shot("s1b-court-paused.png");
    await esc();
    check("Esc again resumed it", await waitFor(/\[Manual\] resumed/, 5000));
    await sleep(1000);
    const resumed = await listen(`resumed: crowd ${START[0]}, commentary ${START[1]}`, 25000);
    if (START[0] > 0 || START[1] > 0) heard(`after the pause (crowd ${START[0]}, commentary ${START[1]})`, resumed);
  }

  if (SECOND) {
    await js(`document.querySelector('[data-testid="button-leave-match"]').click(); true`);
    await sleep(800);
    await js(`document.querySelector('[data-testid="button-confirm-leave"]').click(); true`);
    check("left the first match (forfeit), back on the dashboard", await waitJs(`location.pathname === "/" && !!document.querySelector('[data-testid="button-next-match"]')`, 30000));
    await js(`localStorage.setItem(${JSON.stringify(VOLUME_KEY)}, JSON.stringify({ crowd: ${SECOND[0]}, commentary: ${SECOND[1]} })); window.dispatchEvent(new Event(${JSON.stringify(VOLUME_EVENT)})); true`);
    const loads = count(/\[Sound\] commentary volume/), starts = count(/match starts/);
    await sleep(1500);
    await js(`document.querySelector('[data-testid="button-next-match"]').click()`);
    await waitJs(`!!document.querySelector('[data-testid="match-day-box"]')`, 120000);
    check("the next match: Watch Match", await js(`(() => { const b = [...document.querySelectorAll('[data-testid="match-day-box"] button')].find(x => /Watch Match/.test(x.textContent)); if (b) b.click(); return !!b; })()`));
    const sent2 = await waitFor(/\[Sound\] commentary volume/, 300000, loads + 1);
    const last = (k) => summary.console.slice().reverse().find((l) => l.includes(`[Sound] ${k} volume`));
    check(`the second court got the new volumes (crowd ${SECOND[0].toFixed(2)}, commentary ${SECOND[1].toFixed(2)})`, sent2 && last("crowd")?.endsWith(SECOND[0].toFixed(2)) && last("commentary")?.endsWith(SECOND[1].toFixed(2)));
    await waitFor(/match starts/, 60000, starts + 1);
    await sleep(3000);
    await shot("s1c-second-court.png");
    const second = await listen(`second court: crowd ${SECOND[0]}, commentary ${SECOND[1]}`, 25000);
    if (SECOND[0] > 0 || SECOND[1] > 0) heard(`the second court in one session (crowd ${SECOND[0]}, commentary ${SECOND[1]})`, second);
  }

  // ── 3. The court's own settings, over the match ─────────────────────────────
  console.error("\n3. SETTINGS ON THE MATCH SCREEN (THE GEAR ABOVE THE COURT)");
  const frame = async () => crypto.createHash("sha1").update((await send("Page.captureScreenshot", { format: "png" })).result?.data ?? "").digest("hex");
  check("the gear above the court opens the settings over it", (await clickTestid("button-court-settings")) && (await waitJs(`!!document.querySelector('[data-testid="court-settings-overlay"]')`, 5000)));
  await sleep(1000);
  // As a player's click on a slider there does: the focus leaves the court for the settings.
  await js(`document.querySelector('[data-testid="court-settings-overlay"] [data-testid="sound-master-volume"]').focus(); true`);
  await sleep(500);
  const inside = await js(`(() => { const o = document.querySelector('[data-testid="court-settings-overlay"]'); const has = (t) => !!o.querySelector('[data-testid="' + t + '"]');
    return { master: has("sound-master-volume"), music: has("sound-volume") && has("sound-mute"), crowd: has("sound-crowd-volume"), commentary: has("sound-commentary-volume"),
      auto: has("controls-auto"), manual: has("controls-manual"), table: has("controls-table"), path: location.pathname, focus: document.activeElement?.tagName }; })()`);
  check("it holds Sound (master, music, crowd, commentary) and Controls (Auto, Manual, the controls table), and the page is still the court",
    inside.master && inside.music && inside.crowd && inside.commentary && inside.auto && inside.manual && inside.table && inside.path === "/court", JSON.stringify(inside));
  check("the focus is on the settings, off the court", inside.focus === "INPUT", inside.focus);
  await shot("s3-court-settings.png");
  const f1 = await frame(); await sleep(4000); const f2 = await frame();
  check("the match carries on with the settings open (the court's picture changes)", f1 !== f2);
  const open = await listen("the settings open over the match", 20000);
  heard(`with the settings open (crowd ${START[0]}, commentary ${START[1]})`, open);

  // Each slider there, as a player drags it; the court gets each volume times the master.
  const lastSent = (k) => Number(summary.console.slice().reverse().find((l) => l.includes(`[Sound] ${k} volume`))?.split(" ").pop());
  let now = { master: 1, crowd: START[0], commentary: START[1] };
  const setStep = async (st) => {
    for (const k of ["master", "crowd", "commentary"]) if (st[k] !== now[k]) {
      const before = count(/\[Sound\] commentary volume/);
      await setRange(`sound-${k}-volume`, Math.round(st[k] * 100));
      await waitFor(/\[Sound\] commentary volume/, 5000, before + 1);
    }
    now = { master: st.master, crowd: st.crowd, commentary: st.commentary };
    await sleep(800);
    const want = { crowd: st.crowd * st.master, commentary: st.commentary * st.master };
    check(`master ${st.master * 100}%, crowd ${st.crowd * 100}%, commentary ${st.commentary * 100}%: the court gets crowd ${want.crowd.toFixed(2)}, commentary ${want.commentary.toFixed(2)}`,
      lastSent("crowd") === Number(want.crowd.toFixed(2)) && lastSent("commentary") === Number(want.commentary.toFixed(2)), `got ${lastSent("crowd")} / ${lastSent("commentary")}`);
  };
  for (const st of [
    { master: 1, crowd: 0, commentary: 1, ms: 25000, heard: "commentary alone (crowd 0)" },
    { master: 1, crowd: 1, commentary: 0, ms: 15000, heard: "crowd alone (commentary 0)" },
    { master: 1, crowd: 0, commentary: 0, ms: 10000 },
    { master: 0, crowd: 1, commentary: 1, ms: 10000 },
    { master: 0.5, crowd: 1, commentary: 1, ms: 12000, heard: "master 50%, crowd and commentary 100%" },
    { master: 1, crowd: 1, commentary: 1, ms: 10000, heard: "everything at 100%" },
  ]) {
    await setStep(st);
    const label = `master ${st.master}, crowd ${st.crowd}, commentary ${st.commentary}`;
    const h = await listen(label, st.ms);
    if (st.heard) heard(st.heard, h); else silent(label, h);
  }

  // Auto / Manual from there reach the court (its log), and are remembered.
  const modeLogs = () => count(/\[Manual\] mode/);
  for (const m of MANUAL ? ["auto", "manual"] : ["manual", "auto"]) {
    const before = modeLogs();
    await clickTestid(`controls-${m}`);
    const got = await waitFor(/\[Manual\] mode/, 5000, before + 1);
    const line = summary.console.slice().reverse().find((l) => /\[Manual\] mode/.test(l)) ?? "";
    check(`${m === "auto" ? "Auto" : "Manual"} chosen over the match reaches the court and is remembered`,
      got && line.includes(`mode ${m === "auto" ? "Auto" : "Manual"}`) && (await js(`localStorage.getItem("vbe-court-control-mode")`)) === m, line);
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

  // Rob, 16 Oct: Exit game over the match asks first and says the match in play is forfeited; Cancel keeps playing.
  check("Exit game over the match asks in the page, saying the career is saved and the match in play counts as a forfeit",
    (await clickTestid("settings-exit")) && (await waitJs(`/Exit Beach Volleyball Empire\\?/.test(document.querySelector('[data-testid="dialog-exit-game"]')?.innerText ?? "")
      && /Your career is saved\\./.test(document.querySelector('[data-testid="dialog-exit-game"]').innerText)
      && /counts as a forfeit/.test(document.querySelector('[data-testid="dialog-exit-game"]').innerText)`, 5000)));
  await shot("s3b-exit-asked.png");
  await clickTestid("exit-cancel"); await sleep(1000);
  check("Cancel keeps the match: no question, still on the court",
    (await js(`!document.querySelector('[data-testid="dialog-exit-game"]') && location.pathname === "/court"`)));

  // Closing gives the keyboard back to the court.
  await clickTestid("button-close-court-settings"); await sleep(800);
  const closed = await js(`({ open: !!document.querySelector('[data-testid="court-settings-overlay"]'), focus: document.activeElement?.tagName })`);
  check("closing the settings gives the keyboard back to the court", !closed.open && closed.focus === "IFRAME", JSON.stringify(closed));
  heard("after closing the settings", await listen("after closing the settings", 10000));
  await shot("s4-court-after.png");
  check("still on the 3D court", await js(`location.pathname.startsWith("/court")`));
  check("no page errors", summary.errors.length === 0, summary.errors.slice(0, 2).join(" | "));
} catch (err) {
  ok = false;
  summary.errors.push(String(err?.stack ?? err));
} finally {
  try { ws?.close(); } catch { /* closed */ }
  app.kill();
  await sleep(4000);
  spawn("taskkill", ["/PID", String(app.pid), "/T", "/F"], { stdio: "ignore" });
  await sleep(2000);
  summary.robAfter = fingerprint();
  summary.robSaveUntouched = JSON.stringify(summary.robBefore) === JSON.stringify(summary.robAfter);
  if (!summary.robSaveUntouched) ok = false;
}
fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
process.exit(ok ? 0 : 1);
