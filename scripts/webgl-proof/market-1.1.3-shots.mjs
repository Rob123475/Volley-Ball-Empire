/**
 * 1.1.3 market brief (Part C.4): the packaged game on the throwaway saves market-1.1.3-save.mjs keeps, with
 * the screenshots the brief asks for:
 *
 *   M  (15 June, mid-season)  item 5: the way into the Job Market (Career page, its Job Market tab) and the
 *                             way back (the sidebar; and the page on its own, with its Back link, as the
 *                             Career Options buttons open it); item 2: a repointed pool player's card on her
 *                             AI club's page, and the item 3 contract box sentence
 *   N  (2 January, season 2)  item 1: the AI clubs' market in Club News (the days they signed from the free
 *                             agents in the window, who went where)
 *
 * 1.1.3 squad policy brief (26 Oct), Part C.4, two more:
 *   M                         item B: a Malta player's card (one of Rob's Malta pictures) on her club's page
 *   C  (a match day)          item C: two retoned players on the court (planted as his pair in the save):
 *                             Next match, Watch Match, and the court's own loader log draws them with their new bands
 *
 * The real packaged exe runs with --user-data-dir on a fresh temporary folder, its save folder seeded with
 * each prepared save in turn; Rob's AppData saves are hashed before and after and must be unchanged.
 * (The session code is rebuild-1.1.3-shots.mjs's.)
 *
 * Usage: node scripts/webgl-proof/market-1.1.3-shots.mjs "<win-unpacked>/Beach Volleyball Empire.exe" <savesDir> <outDir> [C,M,N]
 */
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [exeArg, savesArg, outArg, only] = process.argv.slice(2);
const EXE = path.resolve(exeArg), SAVES = path.resolve(savesArg), outDir = path.resolve(outArg);
const RUN = (only ?? "C,M,N").split(",");
fs.mkdirSync(outDir, { recursive: true });
const CDP = 9349, BASE = "http://localhost:4173";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const info = JSON.parse(fs.readFileSync(path.join(SAVES, "market-1.1.3.json"), "utf8"));
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `vbe-market-shots-${name}-`));
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
    let id = 1; const pend = new Map(); const lines = [];
    // (26 Oct) the page's console too: the court (a same-origin iframe) logs who it loads, with her skin tone.
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
      if (m.method === "Runtime.consoleAPICalled") lines.push((m.params.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ")); };
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
    await body({ ev, shot, waitFor, nav, into, text, flagsShown, lines });
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

// C (26 Oct, item C): two of the 24 retoned, planted as his pair in the save (market-1.1.3-save.mjs says why). Next
// match, Watch Match: the court's own loader log must draw them on his side, each with her new picture's band.
if (RUN.includes("C") && info.saves?.C) await session("C", async ({ ev, shot, waitFor, lines }) => {
  out.C = { expected: info.court };
  await ev(`localStorage.setItem("vbe-court-control-mode", "auto")`);
  out.C.nextMatch = await waitFor(`(() => { const b = [...document.querySelectorAll("button")].find((x) => /Next match/.test(x.textContent)); if (b) b.click(); return !!b; })()`, 20000);
  out.C.watch = await waitFor(`(() => { const b = [...document.querySelectorAll('[data-testid="match-day-box"] button')].find((x) => /Watch/i.test(x.textContent)); if (b && !b.disabled) { b.click(); return true; } return false; })()`, 40000);
  out.C.court = await waitFor(`document.querySelector("iframe")?.getAttribute("src") ?? null`, 30000);
  const until = async (re, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (lines.some((l) => re.test(l))) return true; await sleep(500); } return false; };
  out.C.loaded = await until(/\[UnityMatchDataLoader\] \S+ <- .*\(away\)/, 240000);
  out.C.started = await until(/match starts/, 60000);
  out.C.loader = lines.filter((l) => /\[UnityMatchDataLoader\] \S+ <- /.test(l)).map((l) => {
    const m = /<- (.+?) \| team (.+?) \((home|away)\) \| skinTone (.+?) \|/.exec(l);
    return m ? { name: m[1], team: m[2], side: m[3], skinTone: m[4].replace(/^'|'$/g, "") } : { raw: l.slice(0, 200) };
  });
  // (his club may be home or away in the match)
  out.C.pairDrawnWithNewBands = (info.court?.planted ?? []).length === 2 && info.court.planted.every((p) =>
    out.C.loader.some((x) => x.team === info.court.myClub && x.name === p.name && x.skinTone === p.band) && p.band !== p.before);
  await sleep(4000);
  await shot("20-court-two-retoned-players-start.png");
  await sleep(15000);
  await shot("21-court-two-retoned-players-play.png");
  step("C done", { ...out.C, loader: out.C.loader });
});

// M: mid-season. The Job Market's way in and way back; a repointed pool player's card; the contract box.
if (RUN.includes("M")) await session("M", async ({ ev, shot, waitFor, nav, into, text }) => {
  out.M = {};
  // The way in: the sidebar's Career, then its Job Market tab.
  out.M.sidebarCareer = await ev(`(() => { const a = [...document.querySelectorAll("a")].find((x) => x.getAttribute("href") === "/career"); if (a) a.click(); return !!a; })()`);
  await waitFor(`!!document.querySelector('[data-testid="career-tab-jobs"]')`, 20000); await sleep(1200);
  await shot("10-career-page-job-market-tab.png");
  out.M.tab = await ev(`(() => { const b = document.querySelector('[data-testid="career-tab-jobs"]'); if (b) b.click(); return !!b; })()`);
  out.M.window = await waitFor(`document.querySelector('[data-testid="job-market-window"]')?.innerText ?? null`, 20000);
  out.M.vacancies = await ev(`document.querySelectorAll('[data-testid^="card-vacancy-"]').length`);
  out.M.applyDisabled = await ev(`document.querySelector('[data-testid="button-apply"]')?.disabled ?? null`);
  await sleep(1200);
  await shot("11-job-market-mid-season-in-the-career-page.png");
  // The way back: the sidebar, as from every screen (Dashboard).
  out.M.sidebarBack = await ev(`(() => { const a = [...document.querySelectorAll("a")].find((x) => x.getAttribute("href") === "/"); if (a) a.click(); return !!a; })()`);
  out.M.backOnDashboard = !!(await waitFor(`location.pathname === "/" && !!document.querySelector('[data-testid="calendar-date"]')`, 20000));
  await sleep(1200);
  await shot("12-back-on-the-dashboard.png");
  // The page on its own (Career Options' leave buttons open it): its Back link, mid-season, back where he was.
  await nav("/career");
  await waitFor(`!!document.querySelector('[data-testid="career-tab-jobs"]')`, 20000); await sleep(800);
  await ev(`(() => { history.pushState(null, "", "/job-market"); dispatchEvent(new PopStateEvent("popstate")); return true; })()`);
  out.M.standaloneBack = await waitFor(`document.querySelector('[data-testid="job-market-back"]')?.innerText ?? null`, 20000);
  out.M.standaloneSidebar = await ev(`!!document.querySelector('a[href="/team"]')`);
  await sleep(1200);
  await shot("13-job-market-page-on-its-own-with-back.png");
  out.M.backClicked = await ev(`(() => { const b = document.querySelector('[data-testid="job-market-back"]'); if (b) b.click(); return !!b; })()`);
  out.M.backTo = await waitFor(`location.pathname === "/career" && !!document.querySelector('[data-testid="career-tab-jobs"]') ? location.pathname : null`, 20000);
  await sleep(1200);
  await shot("14-back-from-the-job-market-page.png");
  // Item 2: a repointed pool player's card, on her AI club's page.
  const r = (info.repointed ?? [])[0];
  out.M.repointed = r ?? null;
  if (r) {
    await nav(`/clubs/${r.club}`);
    await waitFor(`!!document.querySelector('[data-testid="club-detail"]')`, 20000); await sleep(2500);
    out.M.card = await ev(`(() => { const img = [...document.querySelectorAll("img")].find((i) => (i.getAttribute("src") ?? "").includes(${JSON.stringify(r.img)})); if (img) img.scrollIntoView({ block: "center" }); return img ? { src: img.getAttribute("src"), loaded: img.complete && img.naturalWidth > 0 } : null; })()`);
    out.M.nameOnPage = await ev(`document.body.innerText.includes(${JSON.stringify(r.name)})`);
    await sleep(1500);
    await shot("15-repointed-pool-player-card.png");
  }
  // 26 Oct (item B): a Malta player's card (one of Rob's Malta pictures), on her club's page.
  const mt = (info.malta ?? []).find((x) => x.club != null && x.myClub == null);
  out.M.malta = mt ?? null;
  if (mt) {
    await nav(`/clubs/${mt.club}`);
    await waitFor(`!!document.querySelector('[data-testid="club-detail"]')`, 20000); await sleep(2500);
    out.M.maltaCard = await ev(`(() => { const img = [...document.querySelectorAll("img")].find((i) => (i.getAttribute("src") ?? "").includes(${JSON.stringify(mt.img)})); if (img) img.scrollIntoView({ block: "center" }); return img ? { src: img.getAttribute("src"), loaded: img.complete && img.naturalWidth > 0 } : null; })()`);
    out.M.maltaNameOnPage = await ev(`document.body.innerText.includes(${JSON.stringify(mt.name)})`);
    await sleep(1500);
    await shot("15b-malta-player-card.png");
  }
  // Item 3: the contract box sentence (a free agent's box at his club).
  await nav("/players");
  out.M.signButton = await waitFor(`(() => { const b = document.querySelector('[data-testid^="button-sign-"]'); if (b) { b.scrollIntoView({ block: "center" }); b.click(); } return !!b; })()`, 30000);
  out.M.sentence = await waitFor(`(() => { const p = [...document.querySelectorAll('[role="dialog"] p')].find((x) => /1 season runs to 31 December/.test(x.textContent)); if (p) p.scrollIntoView({ block: "center" }); return p ? p.textContent.trim() : null; })()`, 15000);
  await sleep(1000);
  await shot("16-contract-box-season-sentence.png");
  await ev(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))`); await sleep(600);
  step("M done", out.M);
});

// N: 2 January of season 2. The AI clubs' market in Club News.
if (RUN.includes("N")) await session("N", async ({ ev, shot, waitFor, into }) => {
  out.N = { marketDays: info.marketDays };
  await waitFor(`!!document.querySelector('[data-testid="club-news"]')`, 20000);
  await into('[data-testid="club-news"]'); await sleep(1500);
  out.N.items = await ev(`[...document.querySelectorAll('[data-testid="club-news"] button')].map((b) => b.innerText.split("\\n").filter(Boolean).slice(0, 3).join(" | ")).filter((t) => /AI clubs sign/.test(t))`);
  await shot("17-club-news-ai-clubs-market.png");
  out.N.opened = await ev(`(() => { const b = [...document.querySelectorAll('[data-testid="club-news"] button')].find((x) => /AI clubs sign/.test(x.innerText)); if (b) { b.click(); b.scrollIntoView({ block: "center" }); } return !!b; })()`);
  await sleep(1500);
  out.N.detail = await ev(`(() => { const t = document.querySelector('[data-testid="club-news"]')?.innerText ?? ""; const i = t.indexOf("AI clubs sign"); return i < 0 ? null : t.slice(i, i + 600); })()`);
  await shot("18-club-news-ai-signings-opened.png");
  step("N done", out.N);
});

out.robAfter = fingerprint();
out.robSaveUntouched = JSON.stringify(out.robBefore) === JSON.stringify(out.robAfter);
fs.writeFileSync(path.join(outDir, "market-1.1.3-shots.json"), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
