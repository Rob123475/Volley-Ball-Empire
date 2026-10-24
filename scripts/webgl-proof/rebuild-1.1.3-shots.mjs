/**
 * 1.1.3 rebuild (brief Part E.4): the packaged game on the throwaway saves rebuild-1.1.3-save.mjs keeps,
 * with the screenshots the brief lists:
 *
 *   D  (2 January)    Rob's new head coaches and scouts on the Staff Market (and the medics on the
 *                     Medical Market); a free agent's contract box at his club: 6 months, 1 season,
 *                     2 seasons; the youth card with no wall text; the Rules page's contract lengths
 *   E  (an AI bid)    an AI club's offer for his star on the Transfers tab: 1 or 2 seasons, no 6 months
 *
 * The real packaged exe runs with --user-data-dir on a fresh temporary folder, its save folder seeded
 * with each prepared save in turn; Rob's AppData saves are hashed before and after and must be unchanged.
 * (The session code is final-1.1.3-shots.mjs's.)
 *
 * Usage: node scripts/webgl-proof/rebuild-1.1.3-shots.mjs "<win-unpacked>/Beach Volleyball Empire.exe" <savesDir> <outDir> [D,E]
 */
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [exeArg, savesArg, outArg, only] = process.argv.slice(2);
const EXE = path.resolve(exeArg), SAVES = path.resolve(savesArg), outDir = path.resolve(outArg);
const RUN = (only ?? "D,E").split(",");
fs.mkdirSync(outDir, { recursive: true });
const CDP = 9349, BASE = "http://localhost:4173";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const info = JSON.parse(fs.readFileSync(path.join(SAVES, "rebuild-1.1.3.json"), "utf8"));
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `vbe-rebuild-shots-${name}-`));
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

const clickText = (ev, sel, re) => ev(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => ${re}.test(x.textContent.trim())); if (b) b.click(); return !!b; })()`);

// D: the new faces, his club's contract box, the youth card, the rules.
if (RUN.includes("D")) await session("D", async ({ ev, shot, waitFor, nav, into, text }) => {
  out.D = {};
  await nav("/staff-market");
  await waitFor(`document.querySelectorAll('img[src*="/images/staff/"]').length > 0`, 20000); await sleep(1500);
  for (const [label, file, folder] of [["Head Coach", "01-staff-market-head-coaches.png", "head_coach"], ["Assistant Coach", "02-staff-market-assistant-coaches.png", "assistant_coach"], ["Scout", "03-staff-market-scouts.png", "scouts"]]) {
    out.D[label] = { pressed: await clickText(ev, "button", `/^${label}$/`) };
    await sleep(2500);
    // Rob's new ones: pictures numbered past the old ones (head/assistant coaches from 36, scouts from 11).
    out.D[label].newFaces = await ev(`[...document.querySelectorAll('img[src*="/images/staff/${folder}/"]')].filter((i) => Number((i.getAttribute("src").match(/staff-(\d+)\.webp/) ?? [])[1]) >= ${folder === "scouts" ? 11 : 36} && i.complete && i.naturalWidth > 0).length`);
    await ev(`(() => { const i = [...document.querySelectorAll('img[src*="/images/staff/${folder}/"]')].find((i) => Number((i.getAttribute("src").match(/staff-(\d+)\.webp/) ?? [])[1]) >= ${folder === "scouts" ? 11 : 36}); i?.scrollIntoView({ block: "center" }); return !!i; })()`);
    await sleep(1200);
    await shot(file);
  }
  await nav("/medical-market");
  await waitFor(`document.querySelectorAll('img[src*="/images/staff/"]').length > 0`, 20000); await sleep(2500);
  out.D.medicalFaces = await ev(`document.querySelectorAll('img[src*="/images/staff/"]').length`);
  await shot("04-medical-market.png");
  // A free agent's contract box at his club.
  await nav("/players");
  out.D.signButton = await waitFor(`(() => { const b = document.querySelector('[data-testid^="button-sign-"]'); if (b) { b.scrollIntoView({ block: "center" }); b.click(); } return !!b; })()`, 30000);
  out.D.lengths = await waitFor(`[...document.querySelectorAll('[data-testid^="button-length-"]')].map((b) => b.textContent.trim())`, 15000);
  await sleep(1200);
  await shot("05-contract-box-his-club-6-months.png");
  await ev(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))`); await sleep(800);
  // The youth card, with no wall text.
  await nav("/team");
  await sleep(1500);
  out.D.youthTab = await clickText(ev, "button", "/^Youth/");
  await sleep(2500);
  out.D.youthCardOpened = await ev(`(() => { const i = document.querySelector('img[src*="player_youth_card_01"]'); if (i) { i.scrollIntoView({ block: "center" }); return true; }
    const r = [...document.querySelectorAll('[class*="cursor-pointer"]')].find((e) => /\bAge\b|Potential|★/.test(e.textContent)); r?.click(); return !!r; })()`);
  await waitFor(`!!document.querySelector('img[src*="player_youth_card_01"]')`, 10000); await sleep(1500);
  await ev(`document.querySelector('img[src*="player_youth_card_01"]')?.scrollIntoView({ block: "center" })`); await sleep(800);
  out.D.youthCardShown = await ev(`!!document.querySelector('img[src*="player_youth_card_01"]')`);
  await shot("06-youth-card-no-wall-text.png");
  await nav("/rules");
  await waitFor(`document.body.innerText.includes("Contract lengths")`, 20000); await sleep(1000);
  await ev(`(() => { const e = [...document.querySelectorAll("h2,h3,h4,div,span,p")].find((x) => x.textContent.trim() === "Contract lengths"); e?.scrollIntoView({ block: "start" }); return !!e; })()`); await sleep(1000);
  out.D.rules = await ev(`(() => { const t = document.body.innerText; const i = t.indexOf("Contract lengths"); return i < 0 ? null : t.slice(i, i + 600); })()`);
  await shot("07-rules-contract-lengths.png");
  step("D done", out.D);
});

// E: an AI club's offer: 1 or 2 seasons.
if (RUN.includes("E")) await session("E", async ({ ev, shot, waitFor, nav }) => {
  out.E = { bid: info.bid };
  await nav("/team");
  await sleep(1500);
  out.E.tab = await clickText(ev, "button", "/^Transfers/");
  out.E.offer = await waitFor(`(() => { const o = document.querySelector('[data-testid^="offer-"]'); if (o) o.scrollIntoView({ block: "center" }); return o ? o.innerText.split("\n").join(" | ") : null; })()`, 20000);
  await sleep(1000);
  await shot("08-ai-club-offer-1-or-2-seasons.png");
  // His counter: his club's contract, so his three lengths.
  out.E.counter = await ev(`(() => { const b = document.querySelector('[data-testid^="offer-counter-"]'); if (b) b.click(); return !!b; })()`);
  out.E.counterLengths = await waitFor(`[...document.querySelectorAll('[data-testid^="counter-length-"]')].map((b) => b.textContent.trim())`, 10000);
  await sleep(800);
  await shot("09-his-counter-his-club-lengths.png");
  step("E done", out.E);
});

out.robAfter = fingerprint();
out.robSaveUntouched = JSON.stringify(out.robBefore) === JSON.stringify(out.robAfter);
fs.writeFileSync(path.join(outDir, "rebuild-1.1.3-shots.json"), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
