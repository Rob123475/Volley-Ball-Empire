/**
 * 1.1.3 (brief Part C.4): the packaged game on the three throwaway saves final-1.1.3-save.mjs keeps,
 * with the screenshots the brief lists:
 *
 *   A  (offers waiting)  the Dashboard notice, the offers on the Career page, flags on the job market
 *                        and on the youth cards
 *   B  (Cup group day)   the National Team page, flags on the Nations Cup schedule, the Dashboard's
 *                        "Empire Nations Cup today", his nation's match on the 3D court (national
 *                        colours, Nations Cup boards)
 *   C  (both decided)    the two medal ceremonies as the Dashboard opens them (Skip between), the
 *                        continental ladder cups (this season and the history)
 *
 * The real packaged exe runs with --user-data-dir on a fresh temporary folder, its save folder seeded
 * with each prepared save in turn; Rob's AppData saves are hashed before and after and must be unchanged.
 *
 * Usage: node scripts/webgl-proof/final-1.1.3-shots.mjs "<win-unpacked>/Beach Volleyball Empire.exe" <savesDir> <outDir> [A,B,C]
 */
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [exeArg, savesArg, outArg, only] = process.argv.slice(2);
const EXE = path.resolve(exeArg), SAVES = path.resolve(savesArg), outDir = path.resolve(outArg);
const RUN = (only ?? "A,B,C").split(",");
fs.mkdirSync(outDir, { recursive: true });
const CDP = 9348, BASE = "http://localhost:4173";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const info = JSON.parse(fs.readFileSync(path.join(SAVES, "final-1.1.3.json"), "utf8"));
const out = { exe: EXE, shots: [], steps: [] };
const step = (s, extra) => { out.steps.push({ s, ...(extra ?? {}) }); console.error(JSON.stringify({ s, ...(extra ?? {}) })); };

const APPDATA = process.env.APPDATA;
const robFiles = ["Beach Volleyball Empire", "Volleyball Empire"].flatMap((d) =>
  ["volleyball-empire.sqlite", "volleyball-empire.sqlite-wal", "volleyball-empire.sqlite-shm"].map((f) => path.join(APPDATA, d, f)));
const fingerprint = () => Object.fromEntries(robFiles.filter((f) => fs.existsSync(f)).map((f) => {
  const st = fs.statSync(f); return [f, { size: st.size, mtime: st.mtime.toISOString(), sha1: crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex") }];
}));
out.robBefore = fingerprint();

async function session(name, body) {
  let busy = false; try { busy = (await fetch(`${BASE}/api/healthz`)).ok; } catch { /* free */ }
  if (busy) throw new Error("port 4173 is in use (is the game running?); not starting");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `vbe-1.1.3-shots-${name}-`));
  const saveFolder = path.join(tmp, "Beach Volleyball Empire");
  fs.mkdirSync(saveFolder, { recursive: true });
  fs.copyFileSync(path.join(SAVES, name, "volleyball-empire.sqlite"), path.join(saveFolder, "volleyball-empire.sqlite"));
  const log = fs.openSync(path.join(outDir, `electron-${name}.log`), "w");
  const app = spawn(EXE, [`--user-data-dir=${path.join(tmp, "root")}`, `--remote-debugging-port=${CDP}`,
    "--disable-features=CalculateNativeWinOcclusion", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "--disable-background-timer-throttling"], { stdio: ["ignore", log, log] });
  step(`${name}: started the packaged exe`, { save: info.saves[name]?.date });
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
    const shot = async (file) => { const s = await send("Page.captureScreenshot", { format: "png" }); if (!s.result) { step("screenshot failed", { file }); return; } fs.writeFileSync(path.join(outDir, file), Buffer.from(s.result.data, "base64")); out.shots.push(file); };
    const waitFor = async (expr, ms, every = 500) => { const t = Date.now(); while (Date.now() - t < ms) { try { const v = await ev(expr); if (v) return v; } catch { /* navigating */ } await sleep(every); } return null; };
    const nav = (p) => ev(`(() => { history.pushState(null, "", ${JSON.stringify(p)}); dispatchEvent(new PopStateEvent("popstate")); return location.pathname; })()`);
    const into = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.scrollIntoView({ block: "center" }); return true; })()`);
    const text = (sel, n = 6) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return e ? e.innerText.split("\\n").filter(Boolean).slice(0, ${n}).join(" | ") : null; })()`);
    const flagsShown = () => ev(`[...document.querySelectorAll('img[src*="/images/flags/"]')].filter((i) => i.complete && i.naturalWidth > 0).map((i) => i.getAttribute("src").replace(/^.*\\//, "")).slice(0, 12)`);
    await send("Page.enable"); await send("Runtime.enable");
    await send("Page.addScriptToEvaluateOnNewDocument", { source: `window.__msgs = []; addEventListener("message", (e) => window.__msgs.push(String(e.data)));` });
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(3000);
    step(`${name}: profile selected`, { status: await ev(`fetch("/api/profiles/${info.profileId}/select", { method: "POST" }).then(r => r.status)`) });
    await send("Page.navigate", { url: `${BASE}/` });
    await waitFor(`[...document.querySelectorAll("button")].some(b => b.textContent.trim().toUpperCase() === "CONTINUE")`, 30000);
    step(`${name}: CONTINUE`, { pressed: await ev(`(() => { const b = [...document.querySelectorAll("button")].find(x => /^CONTINUE$/i.test(x.textContent.trim())); if (b) b.click(); return !!b; })()`) });
    await waitFor(`location.pathname === "/" && !!document.querySelector('[data-testid="calendar-date"]')`, 30000);
    await sleep(3000);
    step(`${name}: dashboard`, { date: await text('[data-testid="calendar-date"]', 1), dialogs: await ev(`[...document.querySelectorAll('[role="dialog"]')].map((d) => d.getAttribute("data-testid") ?? d.innerText.slice(0, 60))`) });
    await body({ ev, shot, waitFor, nav, into, text, flagsShown });
  } catch (err) {
    out[`error${name}`] = String(err?.stack ?? err);
    step(`${name}: error`, { err: String(err?.message ?? err) });
  } finally {
    try { ws?.close(); } catch { /* closed */ }
    app.kill();
    await sleep(4000);
    spawn("taskkill", ["/PID", String(app.pid), "/T", "/F"], { stdio: "ignore" });
    await sleep(3000);
  }
}

// A: the offers.
if (RUN.includes("A")) await session("A", async ({ ev, shot, waitFor, nav, into, text, flagsShown }) => {
  out.A = {};
  out.A.notice = await waitFor(`!!document.querySelector('[data-testid="national-coach-notice"]')`, 20000) ? await text('[data-testid="national-coach-notice"]') : null;
  await into('[data-testid="national-coach-notice"]'); await sleep(800);
  await shot("01-dashboard-national-coach-notice.png");
  await nav("/career");
  out.A.offers = await waitFor(`document.querySelectorAll('[data-testid="national-coach-offer"]').length`, 20000);
  await into('[data-testid="national-coach-offers"]'); await sleep(1500);
  out.A.offersText = await text('[data-testid="national-coach-offers"]', 12);
  out.A.offerFlags = await flagsShown();
  await shot("02-career-national-coach-offers.png");
  await nav("/job-market");
  await waitFor(`!!document.querySelector('[data-testid="national-coach-offers"]')`, 20000); await sleep(2000);
  out.A.jobMarketOffers = await text('[data-testid="national-coach-offers"]', 12);
  out.A.jobMarketFlags = await flagsShown();
  await shot("03-flags-job-market.png");
  await nav("/youth-academy");
  await waitFor(`document.querySelectorAll('img[src*="/images/flags/"]').length > 0`, 20000); await sleep(2500);
  await ev(`(() => { const i = document.querySelector('img[src*="/images/flags/"]'); i?.scrollIntoView({ block: "center" }); return !!i; })()`); await sleep(1000);
  out.A.youthFlags = await flagsShown();
  await shot("04-flags-youth-card.png");
  step("A done", out.A);
});

// B: the Cup's group day.
if (RUN.includes("B")) await session("B", async ({ ev, shot, waitFor, nav, into, text, flagsShown }) => {
  out.B = { coached: info.coached, yourMatch: info.yourMatch };
  await waitFor(`!!document.querySelector('[data-testid="nations-cup-today"]')`, 20000);
  out.B.today = await text('[data-testid="nations-cup-today"]', 8);
  await into('[data-testid="nations-cup-today"]'); await sleep(1200);
  await shot("05-dashboard-nations-cup-today.png");
  await nav("/national-team");
  await waitFor(`!!document.querySelector('[data-testid="national-team-page"]')`, 20000); await sleep(2000);
  out.B.page = await text('[data-testid="national-team-page"]', 10);
  out.B.players = await ev(`document.querySelectorAll('[data-testid="national-player"]').length`);
  await shot("06-national-team-page.png");
  await nav("/competition/olympic-schedule");
  await waitFor(`!!document.querySelector('[data-testid="cup-day"]')`, 20000); await sleep(2500);
  out.B.scheduleFlags = await flagsShown();
  await shot("07-flags-nations-cup-schedule.png");
  // His nation's match, from the Dashboard's Watch button.
  await nav("/");
  await waitFor(`!!document.querySelector('[data-testid="nations-cup-today"]')`, 20000); await sleep(1500);
  out.B.watchPressed = await ev(`(() => { const rows = [...document.querySelectorAll('[data-testid="nations-cup-today"] [data-testid="olympic-match"]')];
    const row = rows.find((r) => r.innerText.includes(${JSON.stringify(info.coached ?? "")})) ?? rows[0];
    const b = row?.querySelector('[data-testid="button-watch-cup-match"]'); if (b) b.click(); return b ? row.innerText.split("\\n").join(" ") : null; })()`);
  out.B.court = await waitFor(`location.pathname.startsWith("/court") ? location.search : null`, 30000);
  step("B: on the court", { pressed: out.B.watchPressed, url: out.B.court });
  out.B.unityLoaded = !!(await waitFor(`window.__msgs.includes("unity-loaded")`, 300000, 1000));
  out.B.leaveBar = await text('[data-testid="court-leave-bar"]', 3);
  await sleep(20000); await shot("08-nations-cup-court-20s.png");
  await sleep(25000); await shot("09-nations-cup-court-45s.png");
  out.B.msgs = await ev(`window.__msgs.filter((m) => !/^\\{/.test(m)).slice(0, 20)`);
  step("B done", out.B);
});

// C: both ceremonies, then the ladder cups.
if (RUN.includes("C")) await session("C", async ({ ev, shot, waitFor, nav, into, text, flagsShown }) => {
  out.C = { ceremonies: info.ceremonies, podiums: [] };
  for (let n = 0; n < 2; n++) {
    const src = await waitFor(`document.querySelector('[data-testid="ceremony-court"]')?.getAttribute("src")`, 60000);
    if (!src) { step(`C: no ceremony dialog (${n + 1})`); break; }
    const event = new URLSearchParams(src.split("?")[1] ?? "").get("ceremony") ?? `ceremony-${n + 1}`;
    // The court page is the dialog's iframe; Unity posts "unity-loaded" to it, not to this window.
    const loaded = await waitFor(`(() => { try { return document.querySelector('[data-testid="ceremony-court"]').contentWindow.__msgs.includes("unity-loaded"); } catch { return false; } })()`, 120000, 1000);
    step(`C: ceremony ${n + 1} court loaded`, { event, loaded: !!loaded });
    await sleep(loaded ? 30000 : 10000);
    await shot(`${10 + n}-podium-${event}.png`);
    const skipped = await ev(`(() => { const b = document.querySelector('[data-testid="ceremony-skip"]'); if (b) b.click(); return !!b; })()`);
    const gone = await waitFor(`!document.querySelector('[data-testid="ceremony-court"]') || document.querySelector('[data-testid="ceremony-court"]').getAttribute("src") !== ${JSON.stringify(src)}`, 20000);
    out.C.podiums.push({ event, src, skipped, closed: !!gone });
    step("C: podium", out.C.podiums.at(-1));
    await sleep(2000);
  }
  out.C.pendingAfter = await ev(`fetch("/api/ceremonies/pending").then(r => r.json())`);
  await nav("/competition/regional-ladders");
  out.C.cups = await waitFor(`document.querySelectorAll('[data-testid="ladder-cup"]').length`, 20000); await sleep(2000);
  await into('[data-testid="ladder-cup"]'); await sleep(800);
  await shot("12-continental-ladder-cups.png");
  await nav("/competition/regional-history");
  out.C.historyCups = await waitFor(`document.querySelectorAll('[data-testid="ladder-cup"]').length`, 20000); await sleep(2000);
  await into('[data-testid="ladder-cup"]'); await sleep(800);
  await shot("13-continental-ladder-cups-history.png");
  step("C done", out.C);
});

out.robAfter = fingerprint();
out.robSaveUntouched = JSON.stringify(out.robBefore) === JSON.stringify(out.robAfter);
fs.writeFileSync(path.join(outDir, "final-1.1.3-shots.json"), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
