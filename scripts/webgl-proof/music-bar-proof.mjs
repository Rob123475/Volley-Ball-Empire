/**
 * Rob, 2 Oct (add-on): the music bar's Play / Pause and song list.
 *
 * The real server (production, the built UI) on a starter-DB copy, headless
 * Chrome with autoplay as Electron allows it, a new career's dashboard:
 *   - Pause holds the song where it is, through a page change; Play carries on
 *     from the same spot;
 *   - the title opens the list of all 18 songs, the one playing highlighted
 *     (screenshot); a song picked plays from the start;
 *   - Skip moves to another song, playing.
 *
 * Usage: node scripts/webgl-proof/music-bar-proof.mjs <outDir>
 */
import { fork, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..", "..");
const outDir = path.resolve(process.argv[2] ?? "music-bar-proof"); fs.mkdirSync(outDir, { recursive: true });
const ELECTRON = path.join(REPO, "node_modules/electron/dist/electron.exe");
const MUSIC = path.join(REPO, "artifacts/beach-volleyball/public/audio/music");
const SONGS = fs.readdirSync(MUSIC).filter((f) => f.endsWith(".mp3"));
const PORT = 4219, BASE = `http://localhost:${PORT}`, CDP = 9342;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const work = fs.mkdtempSync(path.join(os.tmpdir(), "music-bar-"));
const db = path.join(work, "m.sqlite");
fs.copyFileSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), db);
const server = fork(path.join(REPO, "artifacts/api-server/dist/index.mjs"), [], {
  execPath: ELECTRON, stdio: ["ignore", "ignore", "ignore", "ipc"],
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PUBLIC_DIR: path.join(REPO, "artifacts/api-server/dist/public"),
    DB_PATH: db, PORT: String(PORT), SESSION_SECRET: "music-bar" },
});
const FADED = new Set(["barefoot-tonight.mp3", "burn-under-the-sun.mp3", "rum-under-the-palms.mp3"]);
const out = { checks: [], errors: [] };
let chrome, ok = true;
try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${BASE}/api/healthz`)).ok) break; } catch { /* booting */ } await sleep(500); }
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "music-bar-chrome-"));
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
  const state = () => ev(`(() => { const a = window.__audio; return a ? { src: (a.currentSrc || a.src).split("/").pop(), paused: a.paused, time: Math.round(a.currentTime * 100) / 100 } : null; })()`);
  const click = (testid) => ev(`(() => { const b = document.querySelector('[data-testid="${testid}"]'); if (b) b.click(); return !!b; })()`);
  const shot = async (name) => { const s = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(outDir, name), Buffer.from(s.result.data, "base64")); };
  const check = (label, ok2, detail) => { out.checks.push({ label, pass: !!ok2, detail }); if (!ok2) ok = false; };
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  for (let i = 0; i < 40; i++) { const s = await state(); if (s && !s.paused && s.time > 1) break; await sleep(250); }
  // 1. Pause holds the spot, through a page change; Play carries on.
  await click("button-music-pause");
  await sleep(300);
  const p1 = await state();
  await sleep(1500);
  const p2 = await state();
  check("Pause holds the song where it is", p1?.paused && p2?.paused && Math.abs(p2.time - p1.time) < 0.05, `${p1?.src} at ${p1?.time} s, 1.5 s later ${p2?.time} s`);
  await ev(`(() => { const a = [...document.querySelectorAll("a")].find(x => /Player Market/.test(x.textContent)); if (a) a.click(); return !!a; })()`);
  await sleep(1500);
  const p3 = await state();
  check("and stays paused on another page", p3?.paused && p3.src === p1.src && Math.abs(p3.time - p1.time) < 0.05, `${p3?.src} at ${p3?.time} s`);
  await click("button-music-pause");
  await sleep(1200);
  const p4 = await state();
  check("Play carries on from the same spot", p4 && !p4.paused && p4.src === p1.src && p4.time >= p1.time && p4.time < p1.time + 2.5, `${p4?.src} at ${p4?.time} s`);
  // 2. The song list.
  await click("button-music-list");
  await sleep(500);
  const list = await ev(`(() => { const l = document.querySelector('[data-testid="music-song-list"]'); if (!l) return null; const items = [...l.querySelectorAll('[role="option"]')]; return { n: items.length, selected: items.filter(i => i.getAttribute("aria-selected") === "true").map(i => i.textContent) }; })()`);
  await shot("music-song-list.png");
  const playingTitle = await ev(`document.querySelector('[data-testid="music-title"]')?.textContent`);
  check("the title opens the list of all 18 songs, the one playing highlighted", list?.n === 18 && list.selected.length === 1 && list.selected[0] === playingTitle, `${list?.n} songs; highlighted: ${list?.selected?.join(", ")}; playing: ${playingTitle}`);
  const pickIndex = await ev(`[...document.querySelectorAll('[data-testid="music-song-list"] [role="option"]')].findIndex(i => i.getAttribute("aria-selected") !== "true")`);
  const pickTitle = await ev(`document.querySelectorAll('[data-testid="music-song-list"] [role="option"]')[${pickIndex}].textContent`);
  await click(`music-song-${pickIndex}`);
  await sleep(1500);
  const p5 = await state();
  const nowTitle = await ev(`document.querySelector('[data-testid="music-title"]')?.textContent`);
  check("a song picked from the list plays from the start", p5 && !p5.paused && p5.time < 3 && nowTitle === pickTitle && p5.src !== p4.src, `${pickTitle}: ${p5?.src} at ${p5?.time} s`);
  // 3. Skip.
  await click("button-music-skip");
  await sleep(1500);
  const p6 = await state();
  check("Skip moves to another song, playing", p6 && !p6.paused && p6.src !== p5.src, `${p5?.src} -> ${p6?.src} at ${p6?.time} s`);
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
fs.writeFileSync(path.join(outDir, "music_bar.json"), JSON.stringify(out, null, 2));
for (const c of out.checks) console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.label}  ${c.detail}`);
if (out.errors.length) console.log(out.errors.join(String.fromCharCode(10)));
process.exit(ok ? 0 : 1);
