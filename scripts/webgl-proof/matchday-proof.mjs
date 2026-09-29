/**
 * Unity match brief (29 Sep), item 10 — Match Day only on match day.
 *
 * Real server (production, built UI) on a starter-DB copy, headless Chrome.
 * Day 1: the left-hand menu has no "Match Day". Next match: the MATCH DAY box
 * appears. Its X closes it; the dashboard's Next Match card then shows "Play
 * match", which reopens the same box. Prints one JSON object.
 *
 * Usage: node scripts/webgl-proof/matchday-proof.mjs [outPngPrefix]
 */
import { fork, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..", "..");
const prefix = process.argv[2] ? path.resolve(process.argv[2]) : null;
const ELECTRON = path.join(REPO, "node_modules/electron/dist/electron.exe");
const PORT = 4196, BASE = `http://localhost:${PORT}`, CDP = 9336;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const work = fs.mkdtempSync(path.join(os.tmpdir(), "matchday-proof-"));
const db = path.join(work, "m.sqlite");
fs.copyFileSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), db);
const server = fork(path.join(REPO, "artifacts/api-server/dist/index.mjs"), [], {
  execPath: ELECTRON, stdio: ["ignore", "ignore", "ignore", "ipc"],
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PUBLIC_DIR: path.join(REPO, "artifacts/api-server/dist/public"),
    DB_PATH: db, PORT: String(PORT), SESSION_SECRET: "matchday-proof" },
});
const out = {};
let chrome;
try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${BASE}/api/healthz`)).ok) break; } catch { /* booting */ } await sleep(500); }
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "matchday-chrome-"));
  chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`,
    "--window-size=1280,800", "--no-first-run", "about:blank"], { stdio: "ignore" });
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
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });

  await send("Page.navigate", { url: `${BASE}/login` }); await sleep(2500);
  await ev(`(async () => {
    const J = (u, o = {}) => fetch(u, { headers: { "content-type": "application/json" }, ...o }).then(r => r.json());
    const p = await J("/api/profiles", { method: "POST", body: JSON.stringify({ name: "Match Day Proof" }) });
    await fetch("/api/profiles/" + p.id + "/select", { method: "POST" });
    const c = (await J("/api/club-templates")).clubs.find(x => x.name === "Sydney Riptide");
    await J("/api/careers", { method: "POST", body: JSON.stringify({ slotNumber: 1, managerName: "Match Day Proof", managerNationality: "Australia", clubName: c.name, originalClubName: c.name, budget: c.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 }) });
    return true; })()`);
  await send("Page.navigate", { url: `${BASE}/` }); await sleep(3000);
  await ev(`(() => { const b = [...document.querySelectorAll("button")].find(x => /^\\s*CONTINUE\\s*$/i.test(x.textContent)); if (b) b.click(); return !!b; })()`);
  await sleep(4000);

  const navText = `(() => [...document.querySelectorAll("nav a, nav button, aside a, aside button")].map(e => e.textContent.trim()).filter(Boolean))()`;
  out.where = await ev(`location.pathname + " :: " + document.body.innerText.slice(0, 300)`);
  out.day1 = { date: await ev(`document.querySelector('[data-testid="calendar-date"]')?.textContent`), menu: await ev(navText) };
  out.day1.matchDayInMenu = (out.day1.menu ?? []).some((t) => /^Match Day$/i.test(t));
  out.day1.links = await ev(`[...document.querySelectorAll("a[href]")].map(a => a.getAttribute("href")).filter(h => /court/.test(h))`);
  await shot("day1");

  await ev(`document.querySelector('[data-testid="button-next-match"]').click()`);
  await sleep(6000);
  out.matchDay = { date: await ev(`document.querySelector('[data-testid="calendar-date"]')?.textContent`), boxOpen: await ev(`!!document.querySelector('[data-testid="match-day-box"]')`),
    box: await ev(`document.querySelector('[data-testid="match-day-box"]')?.innerText.split("\\n").slice(0, 6).join(" | ")`) };
  await shot("box");

  const closed = await ev(`(() => { const box = document.querySelector('[data-testid="match-day-box"]'); const x = box && [...box.querySelectorAll("button")].find(b => /close/i.test(b.textContent) || b.querySelector(".sr-only")); if (x) x.click(); return !!x; })()`);
  await sleep(1500);
  out.afterX = { pressedX: closed, boxOpen: await ev(`!!document.querySelector('[data-testid="match-day-box"]')`),
    playMatchButton: await ev(`!!document.querySelector('[data-testid="button-play-match"]')`),
    pending: await ev(`fetch("/api/calendar").then(r => r.json()).then(c => c.pendingMatchId)`) };
  await shot("closed");

  await ev(`document.querySelector('[data-testid="button-play-match"]')?.click()`);
  await sleep(1500);
  out.afterPlayMatch = { boxOpen: await ev(`!!document.querySelector('[data-testid="match-day-box"]')`),
    box: await ev(`document.querySelector('[data-testid="match-day-box"]')?.innerText.split("\\n").slice(0, 4).join(" | ")`) };
  await shot("reopened");
  ws.close();
} catch (err) {
  out.error = String(err?.stack ?? err);
} finally {
  if (chrome) chrome.kill();
  try { server.send({ type: "shutdown" }); } catch { /* gone */ }
  await sleep(1500);
}
console.log(JSON.stringify(out, null, 1));
