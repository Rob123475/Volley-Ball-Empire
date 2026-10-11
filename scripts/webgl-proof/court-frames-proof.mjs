/**
 * Serve brief 11 Oct: frames of the 3D court for Rob (headless Chrome, real GPU
 * with --gpu), on the built game.
 *
 * Boots the built api-server in production mode on a COPY of the starter DB,
 * makes a new Sydney Riptide career, opens its first match the way Rob does
 * (the remembered Auto/Manual choice, Next match, Watch Match), and saves:
 *   serve-team-a.png / serve-team-b.png  the moment a Team A and a Team B serve
 *                       is planned: everyone on her spot, the server behind
 *                       her baseline (item 1). The court logs "[Point] decided"
 *                       when the serve goes.
 *   serve-meter.png     (--mode manual) your player's serve with the meter on
 *                       screen (item 2): the court logs "[Manual] serve meter".
 *   bikini-*.png        the close camera (key 1), zoomed in (= held), a few
 *                       frames of the players before a serve (item 4).
 * Writes summary.json with the court's own lines for each frame.
 *
 * Usage: node scripts/webgl-proof/court-frames-proof.mjs <outDir> [--mode auto|manual] [--gpu] [--only bikini]
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

  if (ONLY !== "bikini") {
    // Item 1: a Team A serve and a Team B serve, as each is planned (everyone on her spot).
    let from = started.i;
    for (const side of ["A", "B"]) {
      const hit = await nextLine(new RegExp(`\\[Point\\] decided: .*\\(server ${side},`), from, 300000);
      if (!hit) { ok = false; summary.errors.push(`no Team ${side} serve seen`); continue; }
      await shot(`serve-team-${side.toLowerCase()}.png`, hit.line);
      from = hit.i + 1;
    }
    // Item 2 (Manual): your player's serve, with the meter.
    if (MODE === "manual") {
      const meter = await nextLine(/\[Manual\] serve meter/, started.i, 400000);
      if (!meter) { ok = false; summary.errors.push("the serve meter never came up"); }
      else { await sleep(700); await shot("serve-meter.png", meter.line); await sleep(250); await shot("serve-meter-2.png", meter.line); }
    }
  }

  // Item 4: the close camera, zoomed in, before a serve: the players standing still.
  await key("1", "Digit1", 49);
  await key("=", "Equal", 187, 1600);
  let from = lines.length;
  for (let k = 0; k < 3; k++) {
    const hit = await nextLine(/\[Point\] decided:/, from, 300000);
    if (!hit) break;
    await sleep(150);
    await shot(`bikini-close-${k + 1}.png`, hit.line);
    from = hit.i + 1;
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
