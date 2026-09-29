/**
 * Unity match brief (29 Sep), item 13 — the Finances page on a copy of Rob's save.
 *
 * Real server (production, built UI) on a COPY of
 * Downloads/volleyball-empire-backup-29sep-1136.sqlite, headless Chrome. Opens
 * the Finances page and prints what it shows: the top cards, Player Wages, the
 * breakdown lines, the forecast, the prize tracker, the first transaction dates
 * and the sponsor offers' expiry. Prints one JSON object.
 *
 * Usage: node scripts/webgl-proof/finances-proof.mjs [outPngPrefix]
 */
import { fork, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..", "..");
const prefix = process.argv[2] ? path.resolve(process.argv[2]) : null;
const ELECTRON = path.join(REPO, "node_modules/electron/dist/electron.exe");
const PORT = 4197, BASE = `http://localhost:${PORT}`, CDP = 9337;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const work = fs.mkdtempSync(path.join(os.tmpdir(), "finances-proof-"));
const db = path.join(work, "m.sqlite");
fs.copyFileSync(path.join(os.homedir(), "Downloads", "volleyball-empire-backup-29sep-1136.sqlite"), db);
const server = fork(path.join(REPO, "artifacts/api-server/dist/index.mjs"), [], {
  execPath: ELECTRON, stdio: ["ignore", "ignore", "ignore", "ipc"],
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PUBLIC_DIR: path.join(REPO, "artifacts/api-server/dist/public"),
    DB_PATH: db, PORT: String(PORT), SESSION_SECRET: "finances-proof" },
});
const out = {};
let chrome;
try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${BASE}/api/healthz`)).ok) break; } catch { /* booting */ } await sleep(500); }
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "finances-chrome-"));
  chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`,
    "--window-size=1280,900", "--no-first-run", "about:blank"], { stdio: "ignore" });
  let wsUrl;
  for (let i = 0; i < 60 && !wsUrl; i++) { try { wsUrl = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch { /* up soon */ } if (!wsUrl) await sleep(500); }
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 1; const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (method, params = {}) => { const i = id++; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((r) => pend.set(i, r)); };
  const ev = async (x) => (await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value;
  const shot = async (name) => { if (!prefix) return; const s = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(`${prefix}-${name}.png`, Buffer.from(s.result.data, "base64")); };
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

  await send("Page.navigate", { url: `${BASE}/login` }); await sleep(2500);
  out.loaded = await ev(`(async () => {
    const J = (u, o = {}) => fetch(u, { headers: { "content-type": "application/json" }, ...o }).then(r => r.json());
    const p = (await J("/api/profiles")).profiles[0];
    await fetch("/api/profiles/" + p.id + "/select", { method: "POST" });
    const save = (await J("/api/careers")).saves[0];
    await fetch("/api/careers/" + save.id + "/load", { method: "POST" });
    return save.id; })()`);
  await send("Page.navigate", { url: `${BASE}/finances` }); await sleep(3000);
  await ev(`(() => { const b = [...document.querySelectorAll("button")].find(x => /^\\s*CONTINUE\\s*$/i.test(x.textContent)); if (b) b.click(); return !!b; })()`);
  await sleep(2500);
  if (!(await ev(`location.pathname`)).startsWith("/finances")) { await send("Page.navigate", { url: `${BASE}/finances` }); await sleep(4000); }
  // Rob's save is on a match day: close the MATCH DAY box (it only hides it).
  await ev(`(() => { const box = document.querySelector('[data-testid="match-day-box"]'); const x = box && [...box.querySelectorAll("button")].find(b => /close/i.test(b.textContent) || b.querySelector(".sr-only")); if (x) x.click(); return !!x; })()`);
  await sleep(1200);
  const text = await ev(`document.body.innerText`);
  const grab = (re) => (text.match(re) ?? []).slice(1).join(" ");
  out.path = await ev(`location.pathname`);
  out.cards = grab(/Income, last 4 weeks\s+(\S+)[\s\S]*?Expenses, last 4 weeks\s+(\S+)[\s\S]*?Net, last 4 weeks\s+(\S+)/);
  out.wages = grab(/Player Wages[\s\S]*?Per week\s+(\S+)\s+Per month \(contracts\)\s+(\S+)/);
  out.forecast = grab(/Forecast: (next \d+ weeks)[\s\S]*?Expected Income\s+(\S+)[\s\S]*?Expected Expenses\s+(\S+)[\s\S]*?Projected Balance\s+(\S+)/);
  out.prize = grab(/Prize Money Tracker[\s\S]*?(Winner's prizes[\s\S]*?)Prize money this season\s+(\S+)/).replace(/\s+/g, " ");
  out.breakdown = (text.match(/(Prize Money|Sponsorships|Promo Deals|Player Salaries|Running Costs|Staff|Training|Other)\s+\$[\d,.]+ \(\d+%\)/g) ?? []).map(t => t.replace(/\s+/g, " "));
  out.expires = (text.match(/Expires\s+\d+d/g) ?? []).concat((text.match(/\n\d+d\n/g) ?? []).map(s => s.trim()));
  out.txDates = [...new Set((text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}/g) ?? []))].slice(0, 12);
  if (prefix) {
    // The page scrolls inside the app's main pane: step through it, one shot per screen.
    const scroller = `[...document.querySelectorAll("main, div")].find(e => e.scrollHeight > e.clientHeight + 50 && getComputedStyle(e).overflowY.match(/auto|scroll/))`;
    const total = await ev(`(${scroller})?.scrollHeight ?? 0`);
    for (let y = 0, n = 1; y < total && n <= 8; y += 820, n++) {
      await ev(`(() => { const e = ${scroller}; if (e) e.scrollTop = ${y}; return true; })()`);
      await sleep(700);
      const s = await send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(`${prefix}-${n}.png`, Buffer.from(s.result.data, "base64"));
    }
  }
  ws.close();
} catch (err) {
  out.error = String(err?.stack ?? err);
} finally {
  if (chrome) chrome.kill();
  try { server.send({ type: "shutdown" }); } catch { /* gone */ }
  await sleep(1500);
}
console.log(JSON.stringify(out, null, 1));
