/**
 * Update 1 night 2, Part 9: prove a packaged build runs, as a player starts it (first used on 1.1.0).
 *
 * The real packaged exe (its own Electron window, its own server on 4173) is
 * started with --user-data-dir pointing at a fresh temporary folder, so the
 * game's save folder is <tmp>\Beach Volleyball Empire, never Rob's AppData save.
 * Rob's save files are hashed before and after and must be unchanged.
 *
 * Drives the window over CDP: a new profile and career (Sydney Riptide,
 * Established), the Day 1 draft picked in the UI, Next match (days pass), the
 * match day box's Watch Match: the 3D court until Unity reports the result and
 * Continue is pressed, Next match again, then Settings.
 * Rob, 16 Oct (last fixes): Advance during the draft says why, with the way to
 * the draft; Close the draft says the AI clubs have filled; the staff banner on
 * Jan 1 and not on the match day; Pause and Resume on the 3D court (the picture
 * stands still, then moves); the Sort menus on the three markets; last, Exit
 * game from Settings: asked in the page, Cancel keeps the game, Exit closes the
 * app itself, its save checkpointed (no -wal left).
 * Screenshots in <outDir>; one JSON summary on stdout.
 *
 * Usage: node scripts/webgl-proof/package-proof.mjs "C:/build/vbe-<name>/win-unpacked/Beach Volleyball Empire.exe" <outDir>
 */
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const EXE = path.resolve(process.argv[2]);
const outDir = path.resolve(process.argv[3]);
fs.mkdirSync(outDir, { recursive: true });
const CDP = 9338, BASE = "http://localhost:4173";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { exe: EXE, steps: [], shots: [] };
const step = (s, extra) => { const e = { at: new Date().toISOString().slice(11, 19), s, ...(extra ?? {}) }; out.steps.push(e); console.error(JSON.stringify(e)); };

// Rob's saves: stat and hash only (read, never opened by SQLite, never written).
const APPDATA = process.env.APPDATA;
const robFiles = ["Beach Volleyball Empire", "Volleyball Empire"].flatMap((d) =>
  ["volleyball-empire.sqlite", "volleyball-empire.sqlite-wal", "volleyball-empire.sqlite-shm"].map((f) => path.join(APPDATA, d, f)));
const fingerprint = () => Object.fromEntries(robFiles.filter((f) => fs.existsSync(f)).map((f) => {
  const st = fs.statSync(f); return [f, { size: st.size, mtime: st.mtime.toISOString(), sha1: crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex") }];
}));
out.robBefore = fingerprint();

let busy = false; try { busy = (await fetch(`${BASE}/api/healthz`)).ok; } catch { /* free */ }
if (busy) { console.log(JSON.stringify({ error: "port 4173 is in use (is the game running?); not starting" })); process.exit(1); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-1.1.0-proof-"));
const udRoot = path.join(tmp, "root");   // the game puts its saves in <tmp>\Beach Volleyball Empire
out.profileFolder = path.join(tmp, "Beach Volleyball Empire");
const log = fs.openSync(path.join(outDir, "electron.log"), "w");
const app = spawn(EXE, [`--user-data-dir=${udRoot}`, `--remote-debugging-port=${CDP}`,
  // The PC is unattended (screen off or locked): keep the window painting and its timers running.
  "--disable-features=CalculateNativeWinOcclusion", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "--disable-background-timer-throttling"], { stdio: ["ignore", log, log] });
step("started the packaged exe", { pid: app.pid, userDataDir: udRoot });
let appExited = null;
app.on("exit", (code) => { appExited = { code, at: Date.now() }; });

let ws;
try {
  let target;
  for (let i = 0; i < 240 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((t) => t.type === "page" && t.url.startsWith(BASE)); } catch { /* starting */ }
    if (!target) await sleep(500);
  }
  if (!target) throw new Error("the game window never loaded the game page");
  step("game window on the game page", { url: target.url });
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 1; const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (method, params = {}, ms = 20000) => { const i = id++; ws.send(JSON.stringify({ id: i, method, params }));
    return new Promise((r) => { const t = setTimeout(() => { pend.delete(i); step(`CDP ${method} timed out`); r({}); }, ms); pend.set(i, (m) => { clearTimeout(t); r(m); }); }); };
  const ev = async (x) => { const r = await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? "eval failed"); return r.result?.result?.value; };
  const shot = async (name) => { const s = await send("Page.captureScreenshot", { format: "png" }); if (!s.result) return; const f = path.join(outDir, `${String(out.shots.length + 1).padStart(2, "0")}-${name}.png`); fs.writeFileSync(f, Buffer.from(s.result.data, "base64")); out.shots.push(path.basename(f)); };
  const waitFor = async (expr, ms, every = 500) => { const t = Date.now(); while (Date.now() - t < ms) { try { const v = await ev(expr); if (v) return v; } catch { /* navigating */ } await sleep(every); } return null; };
  // Inside the app (wouter follows history.pushState); a reload would show the title screen again.
  const nav = (p) => ev(`(() => { history.pushState(null, "", ${JSON.stringify(p)}); dispatchEvent(new PopStateEvent("popstate")); return location.pathname; })()`);
  const click = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (e) e.click(); return !!e; })()`);
  const clickText = (re) => ev(`(() => { const b = [...document.querySelectorAll("button")].find(x => ${re}.test(x.textContent.trim()) && !x.disabled); if (b) b.click(); return !!b; })()`);
  await send("Page.enable"); await send("Runtime.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `window.__msgs = []; addEventListener("message", (e) => window.__msgs.push(String(e.data)));` });
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send("Page.reload"); await sleep(4000);

  out.firstScreen = await ev(`location.pathname + " :: " + document.body.innerText.slice(0, 200).replace(/\\s+/g, " ")`);
  await shot("first-screen");

  // A new profile and career, as the wizard would post them.
  const made = await ev(`(async () => {
    const J = async (u, o = {}) => { const r = await fetch(u, { headers: { "content-type": "application/json" }, ...o }); return { status: r.status, data: await r.json().catch(() => null) }; };
    const p = await J("/api/profiles", { method: "POST", body: JSON.stringify({ name: "Proof 1.1.1" }) });
    await fetch("/api/profiles/" + p.data.id + "/select", { method: "POST" });
    const c = (await J("/api/club-templates")).data.clubs.find(x => x.name === "Sydney Riptide");
    const r = await J("/api/careers", { method: "POST", body: JSON.stringify({ slotNumber: 1, managerName: "Proof Manager", managerNationality: "Australia", managerFaceId: 8,
      clubName: c.name, originalClubName: c.name, budget: c.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 }) });
    return { profile: p.status, career: r.status }; })()`);
  step("profile and career created", made);

  // Into the game as a player does: the title screen's CONTINUE.
  await send("Page.navigate", { url: `${BASE}/` });
  await waitFor(`[...document.querySelectorAll("button")].some(b => b.textContent.trim().toUpperCase() === "CONTINUE")`, 30000);
  await shot("title-screen");
  step("title screen: CONTINUE", { pressed: await clickText(/^CONTINUE$/i) });
  await sleep(4000);
  step("after CONTINUE", { path: await ev(`location.pathname`) });

  // Rob, 16 Oct: Advance while the draft is open says why, in plain words, with the way to the draft.
  await nav("/"); await sleep(2500);
  await clickText(/^Advance$/); await sleep(2500);
  const refusedText = await ev(`document.body.innerText`);
  out.advanceRefused = { said: /Pick 2 or 3 seniors in the Day 1 draft first/.test(refusedText), noPath: !/\/api\/calendar\/advance 409/.test(refusedText), openTheDraft: /Open the draft/.test(refusedText) };
  await shot("advance-refused");
  if (await clickText(/^Open the draft$/)) await sleep(2500);
  out.advanceRefused.wentToDraft = (await ev(`location.pathname`)) === "/day1-draft";
  step("Advance during the draft", out.advanceRefused);

  // The Day 1 draft, in the UI: free agents, the cheapest that fits each time, then Finish.
  if ((await ev(`location.pathname`)) !== "/day1-draft") await nav("/day1-draft");
  await waitFor(`!!document.querySelector('[data-testid="draft-wage-cap"]')`, 30000);
  await clickText(/^Free agents$/); await sleep(1000);
  await shot("day1-draft");
  for (let k = 0; k < 3; k++) {
    const picked = await ev(`(() => {
      const cards = [...document.querySelectorAll('[data-testid^="draft-card-"]')].map(c => ({ c, b: [...c.querySelectorAll("button")].find(x => x.textContent.trim() === "Pick"),
        wage: Number((c.innerText.match(/\\$([\\d,]+) a month/) ?? [0, "0"])[1].replace(/,/g, "")) })).filter(x => x.b && !x.b.disabled).sort((a, b) => a.wage - b.wage);
      if (!cards.length) return null; cards[0].b.click(); return cards[0].c.innerText.split("\\n")[0] + " $" + cards[0].wage; })()`);
    step("draft pick", { picked });
    await sleep(2500);
  }
  out.draftCap = await ev(`document.querySelector('[data-testid="draft-wage-cap"]')?.textContent`);
  await shot("draft-picked");
  await click('[data-testid="draft-finish"]');
  await waitFor(`location.pathname === "/" && !!document.querySelector('[data-testid="calendar-date"]')`, 30000);
  out.draftClosedMessage = await waitFor(`/Draft closed\./.test(document.body.innerText) && /The AI clubs have filled their squads from the players left\./.test(document.body.innerText)`, 10000, 250);
  await sleep(3000);
  out.staffBannerJan1 = await ev(`!!document.querySelector('[data-testid="staff-deal-warning"]') && /Hire your staff and medical team before Jan 8/.test(document.body.innerText)`);
  out.afterDraft = { date: await ev(`document.querySelector('[data-testid="calendar-date"]')?.textContent`), squad: await ev(`fetch("/api/day1-draft").then(r => r.json()).then(d => ({ open: d.open, picks: (d.picks ?? []).map(p => p.name) }))`) };
  step("draft finished", out.afterDraft);
  await shot("dashboard-day1");

  // Days pass: Next match, then Watch Match on the match day box.
  await click('[data-testid="button-next-match"]');
  await waitFor(`!!document.querySelector('[data-testid="match-day-box"]')`, 120000);
  out.matchDay = { date: await ev(`document.querySelector('[data-testid="calendar-date"]')?.textContent`), box: await ev(`document.querySelector('[data-testid="match-day-box"]')?.innerText.split("\\n").slice(0, 5).join(" | ")`) };
  out.staffBannerOnMatchDay = await ev(`!!document.querySelector('[data-testid="staff-deal-warning"]')`);
  step("match day", { ...out.matchDay, staffBanner: out.staffBannerOnMatchDay });
  await shot("match-day-box");
  // The match day box's own Watch Match ("Play on the 3D court"; it has no test id).
  step("Watch Match pressed", { pressed: await ev(`(() => { const b = [...document.querySelectorAll('[data-testid="match-day-box"] button')].find(x => /Watch Match/.test(x.textContent)); if (b) b.click(); return !!b; })()`) });
  const onCourt = await waitFor(`location.pathname.startsWith("/court") ? location.search : null`, 60000);
  const matchId = Number(new URLSearchParams(onCourt ?? "").get("matchId"));
  step("on the 3D court", { url: onCourt });
  const loaded = await waitFor(`window.__msgs.includes("unity-loaded")`, 300000, 1000);
  step("Unity loaded", { loaded: !!loaded });
  await sleep(15000); await shot("court-15s");
  // Rob, 16 Oct: Pause and Resume on the court; the picture stands still, then moves again.
  const frame = async () => crypto.createHash("sha1").update((await send("Page.captureScreenshot", { format: "png" })).result?.data ?? "").digest("hex");
  const pressed = await click('[data-testid="button-court-pause"]');
  await sleep(1500);
  const p1 = await frame(); await sleep(3000); const p2 = await frame();
  const shownPaused = await ev(`!!document.querySelector('[data-testid="court-paused"]') && document.querySelector('[data-testid="button-court-pause"]').textContent.trim() === "Resume"`);
  await shot("court-paused");
  await click('[data-testid="button-court-pause"]');
  await sleep(1500);
  const p3 = await frame(); await sleep(3000); const p4 = await frame();
  out.pause = { pressed, shownPaused, stillWhilePaused: p1 === p2, movingAfterResume: p3 !== p4,
    resumed: await ev(`!document.querySelector('[data-testid="court-paused"]') && document.querySelector('[data-testid="button-court-pause"]').textContent.trim() === "Pause"`) };
  step("Pause and Resume on the court", out.pause);
  await sleep(45000); await shot("court-60s");

  // Until the court reports the result: the match is recorded, the result box is up, Continue (centre, 112 px below, at 1280x720).
  const t0 = Date.now(); let recorded = null;
  while (onCourt && Date.now() - t0 < 30 * 60000) {
    recorded = await ev(`fetch("/api/matches").then(r => r.json()).then(l => { const m = (Array.isArray(l) ? l : l.matches ?? []).find(x => x.id === ${matchId}); return m && m.status === "completed" ? { score: m.homeScore + "-" + m.awayScore, sets: m.sets } : null; })`).catch(() => null);
    if (recorded) break;
    await sleep(5000);
  }
  step("match recorded by the court", { recorded, minutes: Math.round((Date.now() - t0) / 6000) / 10 });
  await sleep(4000); await shot("court-result-box");
  for (let i = 0; i < 12; i++) {
    if (await ev(`window.__msgs.includes("unity-match-finished") || !location.pathname.startsWith("/court")`).catch(() => true)) break;
    // The result box is centred on Unity's canvas (the iframe); Continue is 112 px below its centre at the
    // 1280x720 reference, scaled as Unity's CanvasScaler does (match 0.5: the geometric mean of the two ratios).
    const at = await ev(`(() => { const f = document.querySelector("iframe"); const r = f ? f.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
      const k = Math.sqrt((r.width / 1280) * (r.height / 720)); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2 + 112 * k) }; })()`) ?? { x: 640, y: 472 };
    if (i === 0) step("pressing Continue", at);
    for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: at.x, y: at.y, button: "left", clickCount: 1 });
    await sleep(2500);
  }
  const back = await waitFor(`location.pathname === "/" && !!document.querySelector('[data-testid="calendar-date"]')`, 30000);
  step("back on the dashboard after Continue", { back: !!back });
  await sleep(3000); await shot("dashboard-after-match");

  // A few more days.
  await click('[data-testid="button-next-match"]');
  await waitFor(`!!document.querySelector('[data-testid="match-day-box"]')`, 120000);
  out.secondMatchDay = await ev(`document.querySelector('[data-testid="calendar-date"]')?.textContent`);
  step("next match day", { date: out.secondMatchDay });
  await shot("second-match-day");

  // Settings.
  await nav("/settings");
  await waitFor(`/Settings/.test(document.body.innerText)`, 20000); await sleep(2000);
  out.settings = await ev(`document.body.innerText.slice(0, 600).replace(/\\s+/g, " ")`);
  await shot("settings");
  if (await clickText(/^Sound$/)) { await sleep(1500); out.settingsSound = await ev(`document.body.innerText.match(/Sound[\\s\\S]{0,400}/)?.[0].replace(/\\s+/g, " ")`); await shot("settings-sound"); }
  step("settings opened");

  // Rob, 16 Oct: the Sort menus on the three markets (a React-controlled select: its own value setter, then change).
  out.sortMenus = [];
  for (const [where, testid, choose] of [["/players", "market-sort", "price_desc"], ["/staff-market", "staff-sort", "age_asc"], ["/medical-market", "medical-sort", "rating_desc"]]) {
    await nav(where);
    await waitFor(`!!document.querySelector('[data-testid="${testid}"]')`, 20000); await sleep(2000);
    const options = await ev(`[...document.querySelector('[data-testid="${testid}"]').options].map(o => o.text)`);
    await ev(`(() => { const el = document.querySelector('[data-testid="${testid}"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(el, "${choose}"); el.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
    await sleep(1500);
    const chosen = await ev(`document.querySelector('[data-testid="${testid}"]').value`);
    out.sortMenus.push({ where, options, chosen });
    await shot(`sort-${testid}`);
  }
  step("sort menus", out.sortMenus);

  // 1.1.1, Part 1: the Clubs page, every sort, and an AI club's Players and Staff & Medical.
  await nav("/clubs");
  await waitFor(`!!document.querySelector('[data-testid="clubs-sort"]') && document.querySelectorAll('[data-testid^="club-row-"]').length > 10`, 30000); await sleep(1500);
  out.clubs = { rows: await ev(`document.querySelectorAll('[data-testid^="club-row-"]').length`), mine: await ev(`!!document.querySelector('[data-testid^="club-row-mine-"]')`), sorts: [] };
  await shot("clubs-page");
  for (const key of await ev(`[...document.querySelector('[data-testid="clubs-sort"]').options].map(o => o.value)`)) {
    await ev(`(() => { const el = document.querySelector('[data-testid="clubs-sort"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(el, "${key}"); el.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
    await sleep(800);
    out.clubs.sorts.push({ sort: key, first: await ev(`document.querySelector('[data-testid^="club-row-"]')?.innerText.split("\t")[0].split("\n").filter(Boolean).slice(0, 2).join(" ")`) });
  }
  await shot("clubs-sorted");
  await click('[data-testid^="club-row-ai-"]');
  await waitFor(`!!document.querySelector('[data-testid="club-name"]')`, 20000); await sleep(2500);
  out.clubs.opened = { name: await ev(`document.querySelector('[data-testid="club-name"]')?.textContent`), seniors: await ev(`document.querySelectorAll('[data-testid^="club-senior-"]').length`),
    youths: await ev(`document.querySelectorAll('[data-testid^="club-youth-deal-"]').length`) };
  await shot("club-players");
  await click('[data-testid="club-tab-staff"]'); await sleep(1500);
  out.clubs.staffTable = await ev(`!!document.querySelector('[data-testid="club-staff-table"]')`);
  await shot("club-staff");
  step("Clubs page", out.clubs);

  // 1.1.1, Part 2: a buy-ahead. A bid for an AI club's senior (well over her wage, so her club can't keep her),
  // made through the game's own route, then seen where the player sees it: the Team page's Transfers tab.
  out.buyAhead = await ev(`(async () => {
    const J = async (u, o = {}) => { const r = await fetch(u, { headers: { "content-type": "application/json" }, ...o }); return { status: r.status, data: await r.json().catch(() => null) }; };
    const cap = (await J("/api/contracts/wage-cap")).data;
    const her = (await J("/api/players/market-all")).data.filter(p => p.status === "ai_club" && !p.joins && Math.round(p.salary * 1.5) <= cap.room).sort((a, b) => b.salary - a.salary)[0];
    if (!her) return { error: "no AI senior fits under the cap", room: cap.room };
    const r = await J("/api/contracts", { method: "POST", body: JSON.stringify({ playerId: her.id, salary: Math.round(her.salary * 1.5), length: "1s", squadRole: "interchange", confirm: true, perks: [] }) });
    return { player: her.name, from: her.currentTeamName, status: r.status, outcome: r.data?.transfer?.outcome, arrivesOn: r.data?.transfer?.arrivesOn, fee: r.data?.fee, error: r.data?.error }; })()`);
  await nav("/team?tab=transfers");
  await waitFor(`!!document.querySelector('[data-testid="transfers-incoming"]')`, 20000); await sleep(2000);
  out.buyAhead.shownIncoming = await ev(`document.querySelector('[data-testid="transfers-incoming"]')?.innerText.replace(/\\s+/g, " ").slice(0, 200) ?? null`);
  out.buyAhead.listedThere = !!out.buyAhead.player && (out.buyAhead.shownIncoming ?? "").includes(out.buyAhead.player);
  await shot("team-transfers-incoming");
  step("buy-ahead", out.buyAhead);

  // Rob, 16 Oct: Exit game, from Settings: asked in the page; Cancel keeps the game; Exit closes the app itself.
  await nav("/settings");
  await waitFor(`!!document.querySelector('[data-testid="settings-exit"]')`, 20000);
  await click('[data-testid="settings-exit"]'); await sleep(1200);
  const asked = await ev(`document.querySelector('[data-testid="dialog-exit-game"]')?.innerText.replace(/\\s+/g, " ") ?? null`);
  await shot("exit-asked");
  await click('[data-testid="exit-cancel"]'); await sleep(1200);
  const afterCancel = await ev(`({ dialog: !!document.querySelector('[data-testid="dialog-exit-game"]'), path: location.pathname })`);
  await click('[data-testid="settings-exit"]'); await sleep(1200);
  const pressedAt = Date.now();
  await click('[data-testid="exit-confirm"]');
  for (let i = 0; i < 60 && !appExited; i++) await sleep(500);
  out.exitGame = { asked, cancelKeptTheGame: afterCancel && !afterCancel.dialog && afterCancel.path === "/settings",
    appClosedItself: !!appExited, exitCode: appExited?.code ?? null, secondsToClose: appExited ? Math.round((appExited.at - pressedAt) / 100) / 10 : null };
  step("Exit game", out.exitGame);
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
  out.proofSaveFolder = fs.existsSync(out.profileFolder) ? fs.readdirSync(out.profileFolder) : null;
  const wal = path.join(out.profileFolder, "volleyball-empire.sqlite-wal");
  if (out.exitGame) out.exitGame.saveCheckpointed = !fs.existsSync(wal) || fs.statSync(wal).size === 0;
}
console.log(JSON.stringify(out, null, 1));
