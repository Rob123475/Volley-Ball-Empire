/**
 * Overnight brief 1 Oct, item 22: the player moves to the next track cleanly at
 * the end of every song.
 *
 * The real server (production mode, the built UI) on a starter-DB copy,
 * headless Chrome with autoplay allowed as Electron allows it. The dashboard
 * plays the soundtrack; for each song in turn the proof waits for it to play,
 * notes its real length, seeks to its last 1.5 seconds and waits for it to end;
 * then it checks that the NEXT song started by itself (a different file,
 * playing, from 0) and how long after the end it did. It keeps going until
 * every song in the soundtrack has ended once.
 *
 * Usage: node scripts/webgl-proof/music-ends-proof.mjs <outJson>
 * Exits 1 if any song did not hand over to a different, playing next song.
 */
import { fork, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..", "..");
const outJson = path.resolve(process.argv[2] ?? "music-ends-proof.json");
const ELECTRON = path.join(REPO, "node_modules/electron/dist/electron.exe");
const MUSIC = path.join(REPO, "artifacts/beach-volleyball/public/audio/music");
const SONGS = fs.readdirSync(MUSIC).filter((f) => f.endsWith(".mp3"));
const PORT = 4213, BASE = `http://localhost:${PORT}`, CDP = 9338;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const work = fs.mkdtempSync(path.join(os.tmpdir(), "music-ends-"));
const db = path.join(work, "m.sqlite");
fs.copyFileSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), db);
const server = fork(path.join(REPO, "artifacts/api-server/dist/index.mjs"), [], {
  execPath: ELECTRON, stdio: ["ignore", "ignore", "ignore", "ipc"],
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PUBLIC_DIR: path.join(REPO, "artifacts/api-server/dist/public"),
    DB_PATH: db, PORT: String(PORT), SESSION_SECRET: "music-ends" },
});
const out = { songs: SONGS.length, handovers: [], errors: [] };
let chrome, ok = true;
try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${BASE}/api/healthz`)).ok) break; } catch { /* booting */ } await sleep(500); }
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "music-ends-chrome-"));
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
  // Capture the provider's <audio> the moment it is made, and note each 'ended'.
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    (() => { const orig = Document.prototype.createElement;
      Document.prototype.createElement = function (tag, ...rest) { const el = orig.call(this, tag, ...rest);
        if (String(tag).toLowerCase() === "audio") { window.__audio = el; window.__ends = [];
          el.addEventListener("ended", () => window.__ends.push({ t: performance.now(), src: (el.currentSrc || el.src).split("/").pop() })); }
        return el; }; })();` });
  await send("Page.navigate", { url: `${BASE}/login` }); await sleep(2500);
  await ev(`(async () => {
    const J = (u, o = {}) => fetch(u, { headers: { "content-type": "application/json" }, ...o }).then(r => r.json());
    const p = await J("/api/profiles", { method: "POST", body: JSON.stringify({ name: "Music Ends" }) });
    await fetch("/api/profiles/" + p.id + "/select", { method: "POST" });
    const c = (await J("/api/club-templates")).clubs.find(x => x.name === "Sydney Riptide");
    await J("/api/careers", { method: "POST", body: JSON.stringify({ slotNumber: 1, managerName: "Music Ends", managerNationality: "Australia", clubName: c.name, originalClubName: c.name, budget: c.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 }) });
    return true; })()`);
  await send("Page.navigate", { url: `${BASE}/` }); await sleep(3000);
  await ev(`(() => { const b = [...document.querySelectorAll("button")].find(x => /^ *CONTINUE *$/i.test(x.textContent.trim())); if (b) b.click(); return !!b; })()`);
  await sleep(3000);
  const state = () => ev(`(() => { const a = window.__audio; return a ? { src: (a.currentSrc || a.src).split("/").pop(), paused: a.paused, time: a.currentTime, duration: a.duration, ends: window.__ends.length } : null; })()`);

  const ended = new Set();
  for (let guard = 0; guard < SONGS.length * 3 && ended.size < SONGS.length; guard++) {
    // Wait for the current song to be playing with a known length.
    let s = null;
    for (let i = 0; i < 60; i++) { s = await state(); if (s && !s.paused && Number.isFinite(s.duration) && s.duration > 0 && s.time > 0) break; await sleep(250); }
    if (!s || s.paused) { out.errors.push(`song not playing: ${JSON.stringify(s)}`); ok = false; break; }
    const song = s.src, length = s.duration, endsBefore = s.ends;
    await ev(`(() => { const a = window.__audio; a.currentTime = Math.max(0, a.duration - 1.5); return true; })()`);
    let e = null;
    for (let i = 0; i < 60 && !e; i++) { await sleep(150); e = await ev(`window.__ends.length > ${endsBefore} ? window.__ends[window.__ends.length - 1] : null`); }
    let next = null;
    for (let i = 0; i < 40; i++) { await sleep(150); next = await state(); if (next && next.src !== song && !next.paused && next.time > 0) break; }
    const gapMs = e && next ? Math.round(await ev(`performance.now()`) - e.t) : null;
    const clean = !!e && e.src === song && !!next && next.src !== song && !next.paused && next.time > 0 && next.time < 5;
    out.handovers.push({ song, seconds: Math.round(length * 100) / 100, ended: !!e, next: next?.src ?? null, nextPlaying: next ? !next.paused : false, nextAt: next ? Math.round(next.time * 100) / 100 : null, clean });
    if (!clean) ok = false;
    ended.add(song);
  }
  out.allEnded = ended.size;
  if (ended.size < SONGS.length) ok = false;
  ws.close();
} catch (err) {
  ok = false;
  out.errors.push(String(err?.stack ?? err));
} finally {
  if (chrome) chrome.kill();
  try { server.send({ type: "shutdown" }); } catch { /* gone */ }
  await sleep(1500);
  try { server.kill(); } catch { /* gone */ }
}
fs.writeFileSync(outJson, JSON.stringify(out, null, 2));
for (const h of out.handovers) console.log(`${h.clean ? "clean" : "NOT CLEAN"}  ${h.song.padEnd(30)} ${String(h.seconds).padStart(7)} s  -> ${h.next} (playing ${h.nextPlaying}, at ${h.nextAt} s)`);
console.log(`songs ended: ${out.allEnded} of ${out.songs}; errors: ${out.errors.length ? out.errors.join("; ") : "none"}`);
process.exit(ok ? 0 : 1);
