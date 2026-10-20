/**
 * 1.1.2 (Rob, 21 Oct): the packaged game on a throwaway save that has reached a season's turn
 * (new-seniors-save.mjs), screenshotting a new-nation picture player in the Player Market and the
 * senior market itself.
 *
 * The real packaged exe runs with --user-data-dir on a fresh temporary folder, its save folder seeded
 * with the prepared save; Rob's AppData saves are hashed before and after and must be unchanged.
 *
 * Usage: node scripts/webgl-proof/new-seniors-shots.mjs "<win-unpacked>/Beach Volleyball Empire.exe" <saveDir> <outDir> [nation...]
 *   nation: the picture players' nations to prefer, in order (default Ukraine, Croatia)
 */
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [exeArg, saveDir, outArg, ...prefer] = process.argv.slice(2);
const EXE = path.resolve(exeArg), outDir = path.resolve(outArg);
const nations = prefer.length ? prefer : ["Ukraine", "Croatia"];
fs.mkdirSync(outDir, { recursive: true });
const CDP = 9347, BASE = "http://localhost:4173";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { exe: EXE, shots: [], steps: [] };
const step = (s, extra) => { out.steps.push({ s, ...(extra ?? {}) }); console.error(JSON.stringify({ s, ...(extra ?? {}) })); };

const APPDATA = process.env.APPDATA;
const robFiles = ["Beach Volleyball Empire", "Volleyball Empire"].flatMap((d) =>
  ["volleyball-empire.sqlite", "volleyball-empire.sqlite-wal", "volleyball-empire.sqlite-shm"].map((f) => path.join(APPDATA, d, f)));
const fingerprint = () => Object.fromEntries(robFiles.filter((f) => fs.existsSync(f)).map((f) => {
  const st = fs.statSync(f); return [f, { size: st.size, mtime: st.mtime.toISOString(), sha1: crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex") }];
}));
out.robBefore = fingerprint();

let busy = false; try { busy = (await fetch(`${BASE}/api/healthz`)).ok; } catch { /* free */ }
if (busy) { console.log(JSON.stringify({ error: "port 4173 is in use (is the game running?); not starting" })); process.exit(1); }

const info = JSON.parse(fs.readFileSync(path.join(saveDir, "new-seniors.json"), "utf8"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-1.1.2-shots-"));
const udRoot = path.join(tmp, "root");
const saveFolder = path.join(tmp, "Beach Volleyball Empire");
fs.mkdirSync(saveFolder, { recursive: true });
for (const f of fs.readdirSync(saveDir)) if (f.startsWith("volleyball-empire.sqlite")) fs.copyFileSync(path.join(saveDir, f), path.join(saveFolder, f));
const log = fs.openSync(path.join(outDir, "electron-1.1.2.log"), "w");
const app = spawn(EXE, [`--user-data-dir=${udRoot}`, `--remote-debugging-port=${CDP}`,
  "--disable-features=CalculateNativeWinOcclusion", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "--disable-background-timer-throttling"], { stdio: ["ignore", log, log] });
step("started the packaged exe on the prepared save", { saveFolder });

let ws;
try {
  let target;
  for (let i = 0; i < 240 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((t) => t.type === "page" && t.url.startsWith(BASE)); } catch { /* starting */ }
    if (!target) await sleep(500);
  }
  if (!target) throw new Error("the game window never loaded the game page");
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 1; const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (method, params = {}, ms = 20000) => { const i = id++; ws.send(JSON.stringify({ id: i, method, params }));
    return new Promise((r) => { const t = setTimeout(() => { pend.delete(i); r({}); }, ms); pend.set(i, (m) => { clearTimeout(t); r(m); }); }); };
  const ev = async (x) => { const r = await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? "eval failed"); return r.result?.result?.value; };
  const shot = async (name, clip) => { const s = await send("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { ...clip, scale: 1 } } : {}) }); if (!s.result) return; const f = path.join(outDir, name); fs.writeFileSync(f, Buffer.from(s.result.data, "base64")); out.shots.push(name); };
  const waitFor = async (expr, ms, every = 500) => { const t = Date.now(); while (Date.now() - t < ms) { try { const v = await ev(expr); if (v) return v; } catch { /* navigating */ } await sleep(every); } return null; };
  const nav = (p) => ev(`(() => { history.pushState(null, "", ${JSON.stringify(p)}); dispatchEvent(new PopStateEvent("popstate")); return location.pathname; })()`);
  const clickText = (re) => ev(`(() => { const b = [...document.querySelectorAll("button")].find(x => ${re}.test(x.textContent.trim()) && !x.disabled); if (b) b.click(); return !!b; })()`);
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(3000);
  step("profile selected", { status: await ev(`fetch("/api/profiles/${info.profileId}/select", { method: "POST" }).then(r => r.status)`) });
  await send("Page.navigate", { url: `${BASE}/` });
  await waitFor(`[...document.querySelectorAll("button")].some(b => b.textContent.trim().toUpperCase() === "CONTINUE")`, 30000);
  step("CONTINUE", { pressed: await clickText(/^CONTINUE$/i) });
  await sleep(4000);
  // Close a match-day box if one is up.
  await ev(`(() => { const b = [...document.querySelectorAll('[role="dialog"] button')].find((x) => /close/i.test(x.textContent) || x.getAttribute("aria-label") === "Close"); if (b) b.click(); return !!b; })()`);

  // The picture players in the market, as the game serves them.
  const market = await ev(`fetch("/api/players/market-all").then(r => r.json())`);
  const pics = info.arrived.filter((a) => a.kind === "picture");
  out.pictureNations = pics.map((p) => `${p.name} (${p.nation})`);
  const pick = nations.map((n) => pics.find((p) => p.nation === n)).find(Boolean) ?? pics[0];
  const row = (market ?? []).find((m) => m.id === pick?.id);
  out.picked = { name: pick?.name, nation: pick?.nation, url: pick?.url, inMarket: !!row, status: row?.status, marketNationality: row?.nationality, marketImage: row?.imageUrl };
  step("picture player chosen", out.picked);

  // The senior market as a player opens it.
  await nav("/players");
  await waitFor(`!!document.querySelector('[data-testid="market-watch-list"]')`, 30000); await sleep(2500);
  await shot("25-senior-market-1.1.2.png");

  // Her card: search her name.
  await ev(`(() => { const el = document.querySelector('input[placeholder="Search players..."]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, ${JSON.stringify(pick?.name ?? "")}); el.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
  await sleep(2000);
  const rect = await ev(`(() => { let e = document.querySelector('[data-testid="price-${pick?.id}"]') ?? document.querySelector('[data-testid="watch-${pick?.id}"]'); if (!e) return null;
    while (e.parentElement && e.getBoundingClientRect().height < 420) e = e.parentElement;
    e.scrollIntoView({ block: "start" }); const r = e.getBoundingClientRect(); return { x: Math.max(0, r.left - 8), y: Math.max(0, r.top - 8), width: r.width + 16, height: Math.min(r.height + 16, 900 - Math.max(0, r.top - 8)) }; })()`);
  await sleep(800);
  await shot(`26-new-nation-player-${(pick?.nation ?? "player").toLowerCase().replace(/[^a-z]+/g, "-")}.png`, rect ?? undefined);
  await shot("27-market-search-new-nation-player.png");
  out.cardText = await ev(`(() => { const e = document.querySelector('[data-testid="price-${pick?.id}"]'); let c = e; while (c && c.parentElement && c.getBoundingClientRect().height < 420) c = c.parentElement; return c ? c.innerText.split("\\n").slice(0, 8).join(" | ") : null; })()`);
  step("card", { text: out.cardText, rect });
} catch (err) {
  out.error = String(err?.stack ?? err);
} finally {
  try { ws?.close(); } catch { /* closed */ }
  app.kill();
  await sleep(4000);
  spawn("taskkill", ["/PID", String(app.pid), "/T", "/F"], { stdio: "ignore" });
  await sleep(2000);
  out.robAfter = fingerprint();
  out.robSaveUntouched = JSON.stringify(out.robBefore) === JSON.stringify(out.robAfter);
}
console.log(JSON.stringify(out, null, 1));
