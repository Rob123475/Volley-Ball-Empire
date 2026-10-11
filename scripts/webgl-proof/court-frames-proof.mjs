/**
 * Serve brief 11 Oct: frames of the 3D court for Rob (headless Chrome, real GPU
 * with --gpu), on the built game.
 *
 * Boots the built api-server in production mode on a COPY of the starter DB,
 * makes a new Sydney Riptide career, opens its first match the way Rob does
 * (the remembered Auto/Manual choice, Next match, Watch Match), and saves:
 *   serve-team-a.png / serve-team-b.png  before a Team A and a Team B serve,
 *                       everyone on her spot, the server behind her baseline
 *                       (item 1): 1.8 s after the point that gives that team
 *                       the serve (the court logs "[Point] awarded").
 *   serve-meter.png     (--meter, in Auto) your player's serve with the meter on
 *                       screen (item 2): after a point your team wins, Tab
 *                       switches to Manual for its serve; the court logs
 *                       "[Manual] serve meter" when the meter comes up.
 *   bikini-*.png        the close camera (the one the match starts on), zoomed
 *                       in: with --zoom-buttons the court's 4x button is
 *                       clicked (item 6); without, = is held (the old dolly,
 *                       all there was before); a few frames of the players
 *                       before a serve (item 4).
 * Writes summary.json with the court's own lines for each frame.
 *
 * Usage: node scripts/webgl-proof/court-frames-proof.mjs <outDir> [--mode auto|manual] [--gpu] [--only bikini] [--zoom-buttons] [--meter] (--only bikini | meter | positions)
 */
import { fork, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..", "..");
const args = process.argv.slice(2);
const outDir = path.resolve(args[0]);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const MODE = opt("--mode", "auto") === "manual" ? "manual" : "auto";
const ONLY = opt("--only", "");
const GPU = args.includes("--gpu");
const ZOOM_BUTTONS = args.includes("--zoom-buttons");
const W = 1280, H = 720;
fs.mkdirSync(outDir, { recursive: true });

const ELECTRON = path.join(REPO, "node_modules/electron/dist/electron.exe");
const SERVER = path.join(REPO, "artifacts/api-server/dist/index.mjs");
const PUBLIC_DIR = path.join(REPO, "artifacts/api-server/dist/public");
const PORT = 4235, BASE = `http://localhost:${PORT}`;
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const CDP = 9355;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const work = fs.mkdtempSync(path.join(os.tmpdir(), "court-frames-"));
const dbFile = path.join(work, "save.sqlite");
fs.copyFileSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), dbFile);
const out = fs.openSync(path.join(outDir, "server.log"), "w");
const server = fork(SERVER, [], {
  execPath: ELECTRON,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PUBLIC_DIR, DB_PATH: dbFile, PORT: String(PORT), SESSION_SECRET: "court-frames" },
  stdio: ["ignore", out, out, "ipc"],
});
let chrome = null;
const summary = { mode: MODE, frames: {}, lines: [], errors: [] };
let ok = true;

try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${BASE}/api/healthz`)).ok) break; } catch { /* booting */ } await sleep(500); }
  let cookie = "";
  const api = async (m, p, b) => {
    const r = await fetch(BASE + "/api" + p, { method: m, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    const t = await r.text(); try { return JSON.parse(t); } catch { return t; }
  };
  const prof = await api("POST", "/profiles", { name: "Court Frames" });
  await api("POST", `/profiles/${prof.id}/select`);
  const club = (await api("GET", "/club-templates")).clubs.find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", { slotNumber: 1, managerName: "Rob Bonner", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "court-frames-chrome-"));
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
  let nextId = 1; const pending = new Map(); const lines = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === "Runtime.consoleAPICalled") lines.push((m.params.args ?? []).map((a) => a.value ?? a.description ?? "").join(" "));
    if (m.method === "Runtime.exceptionThrown") summary.errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
  };
  const send = (method, params = {}) => { const id = nextId++; ws.send(JSON.stringify({ id, method, params })); return new Promise((r) => pending.set(id, r)); };
  const js = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send("Runtime.enable"); await send("Page.enable");
  const [cn, cv] = cookie.split("=");
  await send("Network.enable"); await send("Network.setCookie", { name: cn, value: cv, url: BASE });
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  const shot = async (name, line) => {
    const s = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(outDir, name), Buffer.from(s.result.data, "base64"));
    summary.frames[name] = line ?? null;
  };
  /** Waits for a court line matching `re` that arrives after `from` (an index into the lines). */
  const nextLine = async (re, from, ms) => {
    const t = Date.now();
    while (Date.now() - t < ms) { for (let i = from; i < lines.length; i++) if (re.test(lines[i])) return { i, line: lines[i] }; await sleep(50); }
    return null;
  };
  const key = async (k, code, vk, holdMs = 120) => {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
    await sleep(holdMs);
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
    await sleep(200);
  };

  await send("Page.navigate", { url: BASE + "/" });
  await sleep(2500);
  await js(`localStorage.setItem("vbe-court-control-mode", "${MODE}")`);
  await send("Page.reload");
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
  if (!watched) throw new Error("could not press Watch Match");
  const started = await nextLine(/match starts/, 0, 240000);
  if (!started) throw new Error("the court never started");
  await js(`document.querySelector("iframe")?.focus()`);

  // The court's zoom buttons (item 6): where its canvas puts them (CameraZoomButtons: top
  // right, 14 px in, 122 px down, 44 px buttons 48 px apart, on a 1280x720 canvas scaled by
  // Unity's CanvasScaler with width and height weighted equally), clicked with the mouse.
  const zoomTo = async (factor) => {
    const r = await js(`(() => { const b = document.querySelector("iframe").getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; })()`);
    const sc = Math.pow(2, 0.5 * Math.log2(r.w / 1280) + 0.5 * Math.log2(r.h / 720));
    const i = [1, 2, 4].indexOf(factor);
    const p = { x: r.x + r.w - (14 + 150 - (4 + i * 48 + 22)) * sc, y: r.y + (122 + 17) * sc };
    const z0 = lines.length;
    for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: p.x, y: p.y, button: "left", clickCount: 1 });
    const z = await nextLine(new RegExp("\\[Camera\\] zoom " + factor + "x"), z0, 5000);
    if (!z) { ok = false; summary.errors.push(factor + "x click not seen by the court"); }
    return z ? z.line : null;
  };

  // Item 4 (and 6): the close camera (the match starts on it), zoomed in, before a serve.
  let from = lines.length;
  if (ONLY === "meter" || ONLY === "positions") { /* straight on */ }
  else if (ZOOM_BUTTONS) {
    summary.zoomClick = await zoomTo(4);
    await sleep(600);
    await shot("zoom-4x-buttons.png", summary.zoomClick);
  } else {
    await key("=", "Equal", 187, 1600);
  }
  for (let k = 0; k < (ONLY === "meter" || ONLY === "positions" ? 0 : 3); k++) {
    const hit = await nextLine(/\[Point\] decided:/, from, 300000);
    if (!hit) break;
    await sleep(150);
    await shot(`bikini-close-${k + 1}.png`, hit.line);
    from = hit.i + 1;
  }

  if (ONLY !== "bikini") {
    if (ZOOM_BUTTONS && !ONLY) { await zoomTo(1); await sleep(600); }
    // Item 1: a Team A serve and a Team B serve, while everyone stands on her spot: the
    // winner of a point serves the next, and 1.8 s after the point (the score shows for 2 s,
    // the serve waits until all four are there) they are on their spots, the server behind
    // her baseline. The serve that follows is named with the frame.
    from = lines.length;
    const want = new Set(ONLY === "meter" ? [] : ["A", "B"]);
    while (want.size > 0) {
      const won = await nextLine(/\[Point\] awarded: /, from, 300000);
      if (!won) break;
      const side = /awarded: SYDNEY RIPTIDE/i.test(won.line) ? "A" : "B";
      from = won.i + 1;
      if (!want.has(side)) continue;
      await sleep(1800);
      await shot(`serve-team-${side.toLowerCase()}.png`, won.line);
      const served = await nextLine(/\[Point\] decided: /, won.i, 8000);
      summary.frames[`serve-team-${side.toLowerCase()}.png`] = won.line.trim() + " -> " + (served ? served.line.trim() : "(serve not seen)");
      want.delete(side);
    }
    for (const side of want) { ok = false; summary.errors.push(`no Team ${side} serve seen`); }
    // Item 2: your player's serve, with the meter. In a match the proof does not play, Team A
    // only wins points in Auto; so after a point Team A wins, Tab switches to Manual for its
    // serve: if your player is the one serving, the meter comes up; if her partner serves, Tab
    // goes back to Auto and it waits for the next one.
    if (MODE === "auto" && args.includes("--meter")) {
      let got = null;
      for (let tries = 0; tries < 12 && !got; tries++) {
        const won = await nextLine(/\[Point\] awarded: SYDNEY RIPTIDE/i, lines.length, 300000);
        if (!won) break;
        const m0 = lines.length;
        await key("Tab", "Tab", 9);
        // The serve is decided first ("[Point] decided"), then the meter comes up if she serves.
        const decided = await nextLine(/\[Point\] decided:/, m0, 30000);
        const meter = decided ? await nextLine(/\[Manual\] serve meter/, decided.i, 1500) : null;
        if (meter) { got = meter; break; }
        await key("Tab", "Tab", 9);
      }
      if (!got) { ok = false; summary.errors.push("the serve meter never came up"); }
      else {
        await sleep(500); await shot("serve-meter.png", got.line);
        await sleep(300); await shot("serve-meter-2.png", got.line);
      }
    }
  }

  summary.lines = lines.filter((l) => /\[Point\] decided|\[Manual\] serve|\[Serve\]|match starts|UnityMatchDataLoader\] \S+ <-/.test(l)).slice(0, 80);
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
console.log(JSON.stringify({ mode: MODE, ok, frames: Object.keys(summary.frames), errors: summary.errors.slice(0, 3) }));
process.exit(ok ? 0 : 1);
