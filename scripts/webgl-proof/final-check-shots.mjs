/**
 * Trademark cleanup, final check (19 Oct night): the packaged game, as a player starts it, with
 * screenshots for Rob of the main menu, a senior player card, the Empire Nations Cup screens, and a
 * match with the ball close up (the court's 4x zoom).
 *
 * The real packaged exe runs with --user-data-dir on a fresh temporary folder, so its save folder is
 * <tmp>\Beach Volleyball Empire, never Rob's AppData save (hashed before and after; must be unchanged).
 * Same launch and CDP driving as package-proof.mjs.
 *
 * Usage: node scripts/webgl-proof/final-check-shots.mjs "<win-unpacked>/Beach Volleyball Empire.exe" <outDir>
 */
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const EXE = path.resolve(process.argv[2]);
const outDir = path.resolve(process.argv[3]);
fs.mkdirSync(outDir, { recursive: true });
const CDP = 9339, BASE = "http://localhost:4173";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { exe: EXE, steps: [], shots: [] };
const step = (s, extra) => { const e = { at: new Date().toISOString().slice(11, 19), s, ...(extra ?? {}) }; out.steps.push(e); console.error(JSON.stringify(e)); };

const APPDATA = process.env.APPDATA;
const robFiles = ["Beach Volleyball Empire", "Volleyball Empire"].flatMap((d) =>
  ["volleyball-empire.sqlite", "volleyball-empire.sqlite-wal", "volleyball-empire.sqlite-shm"].map((f) => path.join(APPDATA, d, f)));
const fingerprint = () => Object.fromEntries(robFiles.filter((f) => fs.existsSync(f)).map((f) => {
  const st = fs.statSync(f); return [f, { size: st.size, mtime: st.mtime.toISOString(), sha1: crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex") }];
}));
out.robBefore = fingerprint();

let busy = false; try { busy = (await fetch(`${BASE}/api/healthz`)).ok; } catch { /* free */ }
if (busy) { console.log(JSON.stringify({ error: "port 4173 is in use (is the game running?); not starting" })); process.exit(1); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-final-check-"));
const udRoot = path.join(tmp, "root");
out.profileFolder = path.join(tmp, "Beach Volleyball Empire");
const log = fs.openSync(path.join(outDir, "electron.log"), "w");
const app = spawn(EXE, [`--user-data-dir=${udRoot}`, `--remote-debugging-port=${CDP}`,
  "--disable-features=CalculateNativeWinOcclusion", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "--disable-background-timer-throttling"], { stdio: ["ignore", log, log] });
step("started the packaged exe", { pid: app.pid, userDataDir: udRoot });

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
    return new Promise((r) => { const t = setTimeout(() => { pend.delete(i); step(`CDP ${method} timed out`); r({}); }, ms); pend.set(i, (m) => { clearTimeout(t); r(m); }); }); };
  const ev = async (x) => { const r = await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? "eval failed"); return r.result?.result?.value; };
  const shot = async (name, clip) => { const s = await send("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { ...clip, scale: 1 } } : {}) }); if (!s.result) return; const f = path.join(outDir, `${String(out.shots.length + 1).padStart(2, "0")}-${name}.png`); fs.writeFileSync(f, Buffer.from(s.result.data, "base64")); out.shots.push(path.basename(f)); };
  const waitFor = async (expr, ms, every = 500) => { const t = Date.now(); while (Date.now() - t < ms) { try { const v = await ev(expr); if (v) return v; } catch { /* navigating */ } await sleep(every); } return null; };
  const nav = (p) => ev(`(() => { history.pushState(null, "", ${JSON.stringify(p)}); dispatchEvent(new PopStateEvent("popstate")); return location.pathname; })()`);
  const click = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (e) e.click(); return !!e; })()`);
  const clickText = (re) => ev(`(() => { const b = [...document.querySelectorAll("button")].find(x => ${re}.test(x.textContent.trim()) && !x.disabled); if (b) b.click(); return !!b; })()`);
  await send("Page.enable"); await send("Runtime.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `window.__msgs = []; addEventListener("message", (e) => window.__msgs.push(String(e.data)));` });
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send("Page.reload"); await sleep(5000);
  await shot("main-menu-first-launch");

  const made = await ev(`(async () => {
    const J = async (u, o = {}) => { const r = await fetch(u, { headers: { "content-type": "application/json" }, ...o }); return { status: r.status, data: await r.json().catch(() => null) }; };
    const p = await J("/api/profiles", { method: "POST", body: JSON.stringify({ name: "Final Check" }) });
    await fetch("/api/profiles/" + p.data.id + "/select", { method: "POST" });
    const c = (await J("/api/club-templates")).data.clubs.find(x => x.name === "Sydney Riptide");
    const r = await J("/api/careers", { method: "POST", body: JSON.stringify({ slotNumber: 1, managerName: "Final Check", managerNationality: "Australia", managerFaceId: 8,
      clubName: c.name, originalClubName: c.name, budget: c.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 }) });
    return { profile: p.status, career: r.status }; })()`);
  step("profile and career created", made);

  await send("Page.navigate", { url: `${BASE}/` });
  await waitFor(`[...document.querySelectorAll("button")].some(b => b.textContent.trim().toUpperCase() === "CONTINUE")`, 30000);
  await sleep(1500);
  await shot("main-menu");
  step("main menu: CONTINUE", { pressed: await clickText(/^CONTINUE$/i) });
  await sleep(4000);

  // The Day 1 draft (seniors with their cards), picked in the UI.
  await nav("/day1-draft");
  await waitFor(`!!document.querySelector('[data-testid="draft-wage-cap"]')`, 30000);
  await clickText(/^Free agents$/); await sleep(2000);
  await shot("senior-cards-draft");
  for (let k = 0; k < 3; k++) {
    const picked = await ev(`(() => {
      const cards = [...document.querySelectorAll('[data-testid^="draft-card-"]')].map(c => ({ c, b: [...c.querySelectorAll("button")].find(x => x.textContent.trim() === "Pick"),
        wage: Number((c.innerText.match(/\\$([\\d,]+) a month/) ?? [0, "0"])[1].replace(/,/g, "")) })).filter(x => x.b && !x.b.disabled).sort((a, b) => a.wage - b.wage);
      if (!cards.length) return null; cards[0].b.click(); return cards[0].c.innerText.split("\\n")[0]; })()`);
    step("draft pick", { picked });
    await sleep(2500);
  }
  await click('[data-testid="draft-finish"]');
  await waitFor(`location.pathname === "/" && !!document.querySelector('[data-testid="calendar-date"]')`, 30000);
  await sleep(3000);

  // A senior player card: the Team page's first card, alone.
  await nav("/team");
  await waitFor(`!!document.querySelector('[data-testid^="card-player-"]')`, 30000); await sleep(2500);
  await shot("team-page");
  const rect = await ev(`(() => { const c = document.querySelector('[data-testid^="card-player-"]'); c.scrollIntoView({ block: "start" }); const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: Math.min(r.height, 720 - r.top) }; })()`);
  await sleep(1000);
  out.cardName = await ev(`document.querySelector('[data-testid^="card-player-"]')?.innerText.split("\\n").slice(0, 2).join(" ")`);
  await shot("senior-player-card", rect);
  // The senior market too: more cards at once.
  await nav("/players"); await sleep(3500);
  await shot("senior-market-cards");

  // The Empire Nations Cup screens.
  for (const [p, name] of [["/olympics", "empire-nations-cup-qualification"], ["/competition/olympic-schedule", "empire-nations-cup-schedule"], ["/competition/national-squads", "empire-nations-cup-national-pairs"]]) {
    await nav(p); await sleep(3500);
    await shot(name);
  }
  out.nationsCupText = await ev(`document.body.innerText.match(/[^\\n]*Nations Cup[^\\n]*/g)?.slice(0, 6) ?? null`);
  out.olympicOnScreen = await ev(`/olympi/i.test(document.body.innerText)`);
  await nav("/"); await sleep(2500);
  out.sideMenuHasNationsCup = await ev(`/Empire Nations Cup/.test(document.body.innerText)`);
  out.sideMenuHasOlympic = await ev(`/olympi/i.test(document.body.innerText)`);
  step("Nations Cup screens", { text: out.nationsCupText, olympicOnScreen: out.olympicOnScreen, menu: out.sideMenuHasNationsCup, menuOlympic: out.sideMenuHasOlympic });

  // A match on the 3D court, the 4x zoom, frames until the ball is near.
  await click('[data-testid="button-next-match"]');
  await waitFor(`!!document.querySelector('[data-testid="match-day-box"]')`, 120000);
  step("Watch Match", { pressed: await ev(`(() => { const b = [...document.querySelectorAll('[data-testid="match-day-box"] button')].find(x => /Watch Match/.test(x.textContent)); if (b) b.click(); return !!b; })()`) });
  await waitFor(`location.pathname.startsWith("/court")`, 60000);
  const loaded = await waitFor(`window.__msgs.includes("unity-loaded")`, 300000, 1000);
  step("Unity loaded", { loaded: !!loaded });
  await sleep(12000);
  await shot("match-court");
  const at = await ev(`(() => { const f = document.querySelector("iframe"); const r = f ? f.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
    const k = Math.sqrt((r.width / 1280) * (r.height / 720)); return { x: Math.round(r.left + r.width - 42 * k), y: Math.round(r.top + 139 * k) }; })()`);
  for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: at.x, y: at.y, button: "left", clickCount: 1 });
  step("4x zoom pressed", at);
  for (let i = 0; i < 10; i++) { await sleep(2500); await shot(`match-4x-${i + 1}`); }
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
