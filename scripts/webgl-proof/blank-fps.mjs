/**
 * 1.2 section 2 (28 Nov 2026): the frame rate headless Chrome gives an EMPTY page, measured exactly
 * as venue-fps.mjs measures the court (every requestAnimationFrame for N seconds, same flags, same
 * window). If the empty page is no faster than the court, the court's figure is the browser's own
 * frame pacing on this PC, not what the scene costs.
 *
 * Usage: node scripts/webgl-proof/blank-fps.mjs [--gpu] [--size 1920x1080] [--seconds 20]
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const GPU = args.includes("--gpu");
const [W, H] = opt("--size", "1920x1080").split("x").map(Number);
const SECONDS = Number(opt("--seconds", "20"));
const CDP = 9359;
const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "blank-fps-chrome-"));
const gl = GPU ? ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, ...gl, `--window-size=${W},${H}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
try {
  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) { try { wsUrl = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch { /* up soon */ } if (!wsUrl) await sleep(500); }
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 1; const pending = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => { const i = id++; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((r) => pending.set(i, r)); };
  const js = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await js(`window.__fps = []; let last = 0; const f = (t) => { if (last) window.__fps.push(t - last); last = t; if (window.__on) requestAnimationFrame(f); }; window.__on = true; requestAnimationFrame(f);`);
  await sleep(SECONDS * 1000);
  const d = await js(`(() => { window.__on = false; return window.__fps; })()`);
  const sorted = [...d].sort((a, b) => a - b), total = d.reduce((a, b) => a + b, 0);
  console.log(JSON.stringify({ page: "about:blank", gpu: GPU, size: `${W}x${H}`, seconds: +(total / 1000).toFixed(1), frames: d.length, fps: +(d.length / (total / 1000)).toFixed(1), p50ms: +sorted[Math.floor(sorted.length / 2)].toFixed(1) }));
} finally { chrome.kill(); }
