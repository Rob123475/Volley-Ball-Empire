/**
 * R-40 proof: load the WebGL build in headless Chrome, capture console output,
 * screenshot the page, write it to disk. Driven over the Chrome DevTools Protocol
 * with Node 24's native WebSocket - Playwright is not installed on this machine.
 *
 * Usage: node webgl-proof.mjs <pageUrl> <outPng> [waitSeconds]
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [, , pageUrl, outPng, waitArg] = process.argv;
const WAIT_MS = Number(waitArg ?? 240) * 1000;
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9333;

// R40_GPU=1 renders on the real GPU through ANGLE/D3D11 - the path a player's
// Chrome or Electron actually takes. Default is SwiftShader (software GL).
const GPU = process.env.R40_GPU === "1";
const glFlags = GPU
  ? ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"]
  : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
console.log(`GL mode: ${GPU ? "real GPU (ANGLE d3d11)" : "SwiftShader (software)"}`);

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "r40-chrome-"));
const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  ...glFlags,
  "--window-size=1280,720",
  "--no-first-run",
  "--no-default-browser-check",
  "about:blank",
], { stdio: "ignore" });

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function targetWs() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error("Chrome DevTools endpoint never came up");
}

const console_ = [];
const errors = [];
let nextId = 1;
const pending = new Map();

const ws = new WebSocket(await targetWs());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
    return;
  }
  if (msg.method === "Runtime.consoleAPICalled") {
    const text = (msg.params.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ");
    console_.push(`[${msg.params.type}] ${text}`);
    if (msg.params.type === "error") errors.push(text);
  } else if (msg.method === "Runtime.exceptionThrown") {
    const d = msg.params.exceptionDetails;
    errors.push(`EXCEPTION ${d.text} ${d.exception?.description ?? ""}`.trim());
  } else if (msg.method === "Log.entryAdded") {
    const e = msg.params.entry;
    if (e.level === "error") errors.push(`LOG ${e.source}: ${e.text}${e.url ? " " + e.url : ""}`);
  }
};

function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res) => pending.set(id, res));
}

await send("Runtime.enable");
await send("Log.enable");
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

console.log(`navigating: ${pageUrl}`);
await send("Page.navigate", { url: pageUrl });

// Wait for the loader's per-player lines, or the timeout.
const started = Date.now();
let sawPlayers = 0;
while (Date.now() - started < WAIT_MS) {
  sawPlayers = console_.filter((l) => l.includes("[UnityMatchDataLoader]") && l.includes(" <- ")).length;
  const applied = console_.some((l) => l.includes("[UnityMatchDataLoader] applied"));
  if (sawPlayers >= 4 && applied) break;
  await sleep(2000);
}
// Give the renderer a few more seconds after data is applied.
await sleep(8000);

// Which GL implementation actually drew the frame - recorded, not assumed.
const glInfo = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return "no WebGL context";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return (gl instanceof WebGL2RenderingContext ? "WebGL2 | " : "WebGL1 | ") + r;
  })()`,
});
console.log(`WebGL renderer: ${glInfo.result?.result?.value}`);

const shot = await send("Page.captureScreenshot", { format: "png" });
fs.writeFileSync(outPng, Buffer.from(shot.result.data, "base64"));

console.log(`waited ${((Date.now() - started) / 1000).toFixed(0)}s, loader player lines seen: ${sawPlayers}`);
console.log("--- console (UnityMatchDataLoader + errors) ---");
for (const l of console_) {
  if (l.includes("UnityMatchDataLoader") || l.startsWith("[error]") || l.startsWith("[warning]")) console.log("  " + l);
}
console.log(`--- errors (${errors.length}) ---`);
for (const e of errors.slice(0, 40)) console.log("  " + e);
console.log(`screenshot -> ${outPng}`);

ws.close();
chrome.kill();
await sleep(1000);
try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* chrome may hold files briefly */ }
process.exit(0);
