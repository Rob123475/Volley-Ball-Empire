/**
 * Final brief 5 Oct, Part C: the court loads with Manual on, in headless
 * Chromium (real GPU with --gpu), and the keyboard reaches the WebGL build.
 *
 * Boots the built api-server in production mode on a COPY of the starter DB,
 * makes a new Sydney Riptide career, chooses Manual on the court page as a
 * player would (remembered for the match; the court opens with ?mode=manual),
 * starts the first match with Watch Match, and then:
 *   - the court's own log says it started in Manual (from the page);
 *   - the MANUAL badge and the controls help are on screen (screenshot);
 *   - keys pressed into the page reach Unity through the Input System:
 *     D held moves the player, H hides the help, Esc pauses, Esc resumes,
 *     Tab switches to Auto (and the page's button follows: "Auto: AI plays"),
 *     the page's button switches back to Manual (SendMessage into the court);
 *   - no page errors.
 *
 * Usage: node scripts/webgl-proof/manual-court-proof.mjs <outDir> [--gpu]
 * Prints one JSON summary line; exits 1 if a check fails.
 */
import { fork, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..", "..");
const args = process.argv.slice(2);
const outDir = path.resolve(args[0]);
const GPU = args.includes("--gpu");
const W = 1280, H = 720;
fs.mkdirSync(outDir, { recursive: true });

const ELECTRON = path.join(REPO, "node_modules/electron/dist/electron.exe");
const SERVER = path.join(REPO, "artifacts/api-server/dist/index.mjs");
const PUBLIC_DIR = path.join(REPO, "artifacts/api-server/dist/public");
const PORT = 4211, BASE = `http://localhost:${PORT}`;
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const CDP = 9343;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const work = fs.mkdtempSync(path.join(os.tmpdir(), "manual-court-"));
const dbFile = path.join(work, "save.sqlite");
fs.copyFileSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), dbFile);
const out = fs.openSync(path.join(outDir, "server.log"), "w");
const server = fork(SERVER, [], {
  execPath: ELECTRON,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PUBLIC_DIR, DB_PATH: dbFile, PORT: String(PORT), SESSION_SECRET: "manual-court" },
  stdio: ["ignore", out, out, "ipc"],
});
let chrome = null;
const summary = { checks: [], console: [], errors: [] };
let ok = true;
const check = (label, cond, detail = "") => { summary.checks.push({ label, pass: !!cond, detail }); if (!cond) ok = false; console.error(`${cond ? "PASS" : "FAIL"}  ${label}  ${detail}`); };

try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${BASE}/api/healthz`)).ok) break; } catch { /* booting */ } await sleep(500); }
  let cookie = "";
  const api = async (m, p, b) => {
    const r = await fetch(BASE + "/api" + p, { method: m, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    const t = await r.text(); try { return JSON.parse(t); } catch { return t; }
  };
  const prof = await api("POST", "/profiles", { name: "Manual Court" });
  await api("POST", `/profiles/${prof.id}/select`);
  const club = (await api("GET", "/club-templates")).clubs.find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", { slotNumber: 1, managerName: "Rob Bonner", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "manual-court-chrome-"));
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
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === "Runtime.consoleAPICalled") {
      const line = (m.params.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ");
      if (/\[Manual\]|\[CourtBridge\]|MatchManager\] match starts/.test(line)) summary.console.push(line.slice(0, 200));
    }
    if (m.method === "Runtime.exceptionThrown") summary.errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
  };
  const send = (method, params = {}) => { const id = nextId++; ws.send(JSON.stringify({ id, method, params })); return new Promise((r) => pending.set(id, r)); };
  const js = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send("Runtime.enable"); await send("Page.enable");
  const [cn, cv] = cookie.split("=");
  await send("Network.enable"); await send("Network.setCookie", { name: cn, value: cv, url: BASE });
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  const shot = async (name) => { const s = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(outDir, name), Buffer.from(s.result.data, "base64")); };
  const seen = (re) => summary.console.some((l) => re.test(l));
  const waitFor = async (re, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (seen(re)) return true; await sleep(250); } return false; };
  const key = async (k, code, vk, holdMs = 120) => {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
    await sleep(holdMs);
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
    await sleep(300);
  };

  // The player's choice, remembered on the court page: Manual.
  await send("Page.navigate", { url: BASE + "/" });
  await sleep(2500);
  await js(`localStorage.setItem("vbe-court-control-mode", "manual")`);
  // Next match, then Watch Match, as Rob plays it.
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
  let src = null;
  for (let i = 0; i < 40 && !src; i++) { await sleep(500); src = await js(`document.querySelector("iframe")?.getAttribute("src") ?? null`); }
  check("the court opens with ?mode=manual (the remembered choice)", /mode=manual/.test(src ?? ""), src);
  check("the court page's button says Manual", /Manual: you play/.test(await js(`document.querySelector('[data-testid="button-control-mode"]')?.textContent ?? ""`)));
  const started = await waitFor(/\[Manual\] mode Manual \(page\)/, 240000);
  check("the court started in Manual, from the page", started, summary.console.find((l) => /mode Manual/.test(l)) ?? "");
  await waitFor(/match starts/, 60000);
  await sleep(4000);
  await shot("c1-manual-court-start.png");

  // Keys reach the court (the page focused it when it loaded).
  await js(`document.querySelector("iframe")?.focus()`);
  await key("d", "KeyD", 68, 900);
  await key("h", "KeyH", 72);
  await sleep(500);
  await shot("c2-help-hidden.png");
  await key("Escape", "Escape", 27);
  const paused = await waitFor(/\[Manual\] paused/, 4000);
  await shot("c3-paused.png");
  await key("Escape", "Escape", 27);
  const resumed = await waitFor(/\[Manual\] resumed/, 4000);
  check("Esc pauses and resumes the match (keyboard into the WebGL build)", paused && resumed);
  await key("Tab", "Tab", 9);
  const toAuto = await waitFor(/\[Manual\] mode Auto \(keyboard\)/, 4000);
  await sleep(800);
  const label = await js(`document.querySelector('[data-testid="button-control-mode"]')?.textContent ?? ""`);
  check("Tab switches the court to Auto, and the page's button follows", toAuto && /Auto: AI plays/.test(label), label);
  await shot("c4-auto-after-tab.png");
  await js(`document.querySelector('[data-testid="button-control-mode"]')?.click()`);
  let back = false;
  for (let i = 0; i < 40 && !back; i++) { await sleep(250); back = summary.console.filter((l) => /mode Manual \(page\)/.test(l)).length >= 2; }
  check("the page's button switches the running court back to Manual", back);
  await sleep(6000);
  await shot("c5-manual-again.png");
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
