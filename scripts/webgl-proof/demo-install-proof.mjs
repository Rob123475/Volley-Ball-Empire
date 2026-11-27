/**
 * 1.2 demo (27 Nov 2026), brief Part C step 4 for the demo: install the demo
 * as a player would, and prove it is kept apart from the real game.
 *
 *  1. Fingerprints, before: every file in the real game's save folders
 *     (AppData\Roaming\Beach Volleyball Empire, and the older "Volleyball
 *     Empire" and "workspace" folders the real game brings saves forward from),
 *     the Steam install of the real game, and the Uninstall entries. SHA-1 of
 *     every file's bytes; nothing is opened by SQLite.
 *  2. Installs the demo silently (the NSIS installer, /S, per user).
 *  3. First run, with no save of its own: the demo's folder
 *     (AppData\Roaming\Beach Volleyball Empire 1.2 Demo) is made, its save is
 *     the starter database (no profiles), no save brought forward, Steam off,
 *     its own port (4174); the title screen shows "Beach Volleyball Empire 1.2
 *     Demo · version 1.2.0-demo1". Quit from the page (Exit game).
 *  4. A COPY of the live save into the demo's own folder (the first run's
 *     folder is moved aside first). The demo started again opens it.
 *  5. A played match on the installed demo's own 3D court: Rob's profile,
 *     Manual (remembered on the court page), Next match, Watch Match; a
 *     keyboard bot (J, K, L in turn every 120 ms) plays it to the end; Continue
 *     on the result box; the dashboard shows the result; the match is recorded
 *     and its prize (the winner's, or the runner-up's share) is on the ledger
 *     and in the balance. The frame rate is measured for 60 s in the TV look (V).
 *  6. Quit; fingerprints again: the real game's folders, its Steam install and
 *     its Uninstall entry byte for byte unchanged.
 *  7. The demo's folder (with the copy of the live save in it) is moved to
 *     <buildDir>\test-saves\, so the demo's next start is a first run again.
 *
 * Usage: node scripts/webgl-proof/demo-install-proof.mjs <installer.exe> <outDir> <buildDir>
 */
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const INSTALLER = path.resolve(process.argv[2]);
const outDir = path.resolve(process.argv[3]);
const buildDir = path.resolve(process.argv[4]);
fs.mkdirSync(outDir, { recursive: true });
const PRODUCT = "Beach Volleyball Empire 1.2 Demo", VERSION = "1.2.0-demo1";
const APPDATA = process.env.APPDATA, LOCAL = process.env.LOCALAPPDATA;
const DEMO_DIR = path.join(APPDATA, PRODUCT);
const INSTALL_DIR = path.join(LOCAL, "Programs", PRODUCT);
const EXE = path.join(INSTALL_DIR, `${PRODUCT}.exe`);
const REAL_SAVE_DIR = path.join(APPDATA, "Beach Volleyball Empire");
const LIVE_SAVE = path.join(REAL_SAVE_DIR, "volleyball-empire.sqlite");
const STEAM_DIR = "C:/Program Files (x86)/Steam/steamapps/common/Beach Volleyball Empire";
const CDP = 9339, BASE = "http://localhost:4174";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { installer: INSTALLER, steps: [], checks: [], shots: [] };
let ok = true;
const step = (s, extra) => { const e = { at: new Date().toISOString().slice(11, 19), s, ...(extra ?? {}) }; out.steps.push(e); console.error(JSON.stringify(e)); };
const check = (label, cond, detail = "") => { out.checks.push({ label, pass: !!cond, detail }); if (!cond) ok = false; console.error(`${cond ? "PASS" : "FAIL"}  ${label}  ${typeof detail === "string" ? detail : JSON.stringify(detail)}`); };

// ── Fingerprints ────────────────────────────────────────────────────────────
const walk = (dir) => {
  if (!fs.existsSync(dir)) return [];
  const all = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) all.push(...walk(p)); else if (e.isFile()) all.push(p);
  }
  return all;
};
const sha1 = (f) => crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex");
const fingerprint = (dir) => Object.fromEntries(walk(dir).sort().map((f) => { const st = fs.statSync(f); return [path.relative(dir, f), { size: st.size, mtime: st.mtimeMs, sha1: sha1(f) }]; }));
const REAL_DIRS = { "real save folder": REAL_SAVE_DIR, "old 'Volleyball Empire' folder": path.join(APPDATA, "Volleyball Empire"), "old 'workspace' folder": path.join(APPDATA, "workspace"), "Steam install": STEAM_DIR };
const uninstallKeys = () => {
  const r = spawnSync("reg", ["query", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall", "/s", "/v", "DisplayName"], { encoding: "utf8" });
  const keys = {}; let k = null;
  for (const line of r.stdout.split(/\r?\n/)) {
    if (/^HKEY_/.test(line)) k = line.trim();
    const m = /DisplayName\s+REG_SZ\s+(.*)$/.exec(line);
    if (m && k) keys[k] = m[1].trim();
  }
  return keys;
};
const compare = (a, b) => {
  const names = new Set([...Object.keys(a), ...Object.keys(b)]);
  const diff = [];
  for (const n of names) {
    const x = a[n], y = b[n];
    if (!x) diff.push(`added ${n}`); else if (!y) diff.push(`removed ${n}`);
    else if (x.sha1 !== y.sha1 || x.size !== y.size || x.mtime !== y.mtime) diff.push(`changed ${n}`);
  }
  return diff;
};

let app = null, ws = null;
const launch = async (label) => {
  const log = fs.openSync(path.join(outDir, `electron-${label}.log`), "w");
  app = spawn(EXE, [`--remote-debugging-port=${CDP}`,
    // The PC is unattended (screen off or locked): keep the window painting and its timers running.
    "--disable-features=CalculateNativeWinOcclusion", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "--disable-background-timer-throttling"], { stdio: ["ignore", log, log] });
  app.exited = null;
  app.on("exit", (code) => { app.exited = { code, at: Date.now() }; });
  let target;
  for (let i = 0; i < 240 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((t) => t.type === "page" && t.url.startsWith(BASE)); } catch { /* starting */ }
    if (!target) await sleep(500);
  }
  if (!target) throw new Error(`${label}: the demo's window never loaded the game page on ${BASE}`);
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 1; const pend = new Map(); const lines = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
    if (m.method === "Runtime.consoleAPICalled") lines.push({ at: Date.now(), text: (m.params.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ") });
  };
  const send = (method, params = {}, ms = 20000) => { const i = id++; ws.send(JSON.stringify({ id: i, method, params }));
    return new Promise((r) => { const t = setTimeout(() => { pend.delete(i); r({}); }, ms); pend.set(i, (m) => { clearTimeout(t); r(m); }); }); };
  const ev = async (x) => { const r = await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? "eval failed"); return r.result?.result?.value; };
  const shot = async (name) => { const s = await send("Page.captureScreenshot", { format: "png" }); if (!s.result) return; const f = path.join(outDir, `${String(out.shots.length + 1).padStart(2, "0")}-${name}.png`); fs.writeFileSync(f, Buffer.from(s.result.data, "base64")); out.shots.push(path.basename(f)); };
  const waitFor = async (expr, ms, every = 500) => { const t = Date.now(); while (Date.now() - t < ms) { try { const v = await ev(expr); if (v) return v; } catch { /* navigating */ } await sleep(every); } return null; };
  const key = async (k, code, vk, holdMs = 50) => {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
    await sleep(holdMs);
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  };
  await send("Page.enable"); await send("Runtime.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `window.__msgs = []; addEventListener("message", (e) => window.__msgs.push(String(e.data)));` });
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send("Page.reload"); await sleep(4000);
  return { send, ev, shot, waitFor, key, lines };
};
const quit = async (c, label) => {
  // Settings' Exit game: the main process quits as closing the window does (the save checkpointed and closed).
  try { await c.ev(`window.vbeApp.quit()`); } catch { /* the window is going */ }
  for (let i = 0; i < 60 && !app.exited; i++) await sleep(500);
  try { ws.close(); } catch { /* closed */ }
  step(`${label}: quit`, { exited: app.exited });
  // Its server goes with it: the port is free again.
  let free = false;
  for (let i = 0; i < 20 && !free; i++) { try { await fetch(`${BASE}/api/healthz`); await sleep(500); } catch { free = true; } }
  return !!app.exited && free;
};

try {
  // Nothing of the game may be running: the real save must stand still through the test.
  const running = spawnSync("tasklist", ["/FO", "CSV"], { encoding: "utf8" }).stdout.split(/\r?\n/).filter((l) => /Beach Volleyball Empire/i.test(l));
  if (running.length) throw new Error(`the game is running (${running.join("; ")}); not starting`);
  check("(set-up) the real game's live save exists and has no -wal (the game is closed)", fs.existsSync(LIVE_SAVE) && !fs.existsSync(LIVE_SAVE + "-wal"), LIVE_SAVE);

  // 1. Before.
  const before = Object.fromEntries(Object.entries(REAL_DIRS).map(([k, d]) => [k, fingerprint(d)]));
  const keysBefore = uninstallKeys();
  out.before = Object.fromEntries(Object.entries(before).map(([k, f]) => [k, { files: Object.keys(f).length, bytes: Object.values(f).reduce((a, x) => a + x.size, 0) }]));
  out.liveSaveSha1 = sha1(LIVE_SAVE);
  step("fingerprints before", out.before);
  check("(set-up) the demo is not installed yet and has no folder", !fs.existsSync(INSTALL_DIR) && !fs.existsSync(DEMO_DIR), `${INSTALL_DIR}; ${DEMO_DIR}`);

  // 2. Install.
  const t0 = Date.now();
  const inst = spawnSync(INSTALLER, ["/S"], { encoding: "utf8", timeout: 10 * 60 * 1000 });
  for (let i = 0; i < 60 && !fs.existsSync(EXE); i++) await sleep(1000);
  const keysAfter = uninstallKeys();
  const newKeys = Object.entries(keysAfter).filter(([k]) => !(k in keysBefore));
  out.install = { exit: inst.status, seconds: Math.round((Date.now() - t0) / 1000), exe: EXE, newUninstallEntries: newKeys };
  check("the installer put the demo in its own folder, with its own exe", inst.status === 0 && fs.existsSync(EXE), `exit ${inst.status}; ${EXE}`);
  check("with its own Uninstall entry, named for the demo; every other entry as it was",
    newKeys.length === 1 && newKeys[0][1].startsWith(PRODUCT) && Object.entries(keysBefore).every(([k, v]) => keysAfter[k] === v),
    newKeys.map(([k, v]) => `${v} (${k.split("\\").pop()})`).join("; "));
  check("the Steam install of the real game untouched by the install", compare(before["Steam install"], fingerprint(STEAM_DIR)).length === 0);

  // 3. First run, no save of its own.
  let c = await launch("first-run");
  await c.waitFor(`!!document.querySelector('[data-testid="title-version"]')`, 30000);
  const titleText = await c.ev(`document.querySelector('[data-testid="title-version"]')?.textContent ?? ""`);
  await c.shot("first-run-title-screen");
  check("the title screen shows the demo's name and version", titleText.includes(PRODUCT) && titleText.includes(VERSION), titleText);
  const profiles = await c.ev(`fetch("/api/profiles").then(r => r.json())`);
  check("a first run with no save starts from the starter database: no managers", Array.isArray(profiles?.profiles) && profiles.profiles.length === 0, JSON.stringify(profiles).slice(0, 120));
  const title = await c.ev(`document.title`);
  const demoFiles = fs.existsSync(DEMO_DIR) ? fs.readdirSync(DEMO_DIR) : [];
  check("its save is in its own folder", demoFiles.includes("volleyball-empire.sqlite") && demoFiles.includes("starter-reference.db"), `${DEMO_DIR}: ${demoFiles.filter((f) => /sqlite|\.db/.test(f)).join(", ")}`);
  check("on its own port (4174), not the real game's 4173", (await c.ev(`location.port`)) === "4174", `${title}; ${await c.ev("location.href")}`);
  check("quit from the page (Exit game)", await quit(c, "first run"));
  const firstLog = fs.readFileSync(path.join(outDir, "electron-first-run.log"), "utf8");
  check("no save brought forward from any other folder, and Steam off", !/Migrated save data|Moved save data/.test(firstLog) && /\[steam\] off in Beach Volleyball Empire 1\.2 Demo/.test(firstLog),
    (firstLog.match(/\[steam\][^\n]*/g) ?? []).join(" | "));
  check("the real save folder unchanged after the first run", compare(before["real save folder"], fingerprint(REAL_SAVE_DIR)).length === 0);

  // 4. A copy of the live save, in the demo's own folder.
  const testSaves = path.join(buildDir, "test-saves");
  fs.mkdirSync(testSaves, { recursive: true });
  const firstRunAside = path.join(testSaves, "first-run");
  fs.rmSync(firstRunAside, { recursive: true, force: true });
  fs.renameSync(DEMO_DIR, firstRunAside);
  fs.mkdirSync(DEMO_DIR, { recursive: true });
  fs.copyFileSync(LIVE_SAVE, path.join(DEMO_DIR, "volleyball-empire.sqlite"));
  check("a copy of the live save in the demo's own folder (the first run's folder moved to test-saves/first-run)",
    sha1(path.join(DEMO_DIR, "volleyball-empire.sqlite")) === out.liveSaveSha1, `${path.join(DEMO_DIR, "volleyball-empire.sqlite")} sha1 ${out.liveSaveSha1}`);

  // 5. A played match on the installed demo's own court.
  c = await launch("copy-of-live-save");
  await c.waitFor(`[...document.querySelectorAll("button")].length > 0`, 30000);
  const profs = (await c.ev(`fetch("/api/profiles").then(r => r.json())`))?.profiles ?? [];
  const rob = profs.find((p) => /^Rob/.test(p.name)) ?? profs[0];
  step("profiles in the copy", { profiles: profs.map((p) => p.name), chosen: rob?.name });
  await c.ev(`fetch("/api/profiles/${rob.id}/select", { method: "POST" }).then(r => r.status)`);
  await c.ev(`localStorage.setItem("vbe-court-control-mode", "manual")`);
  await c.send("Page.navigate", { url: `${BASE}/` });
  await sleep(4000);
  for (let i = 0; i < 20 && !(await c.ev(`!!document.querySelector('[data-testid="calendar-date"]')`)); i++) {
    await c.ev(`(() => { const b = [...document.querySelectorAll("button")].find(b => /^ *continue *$/i.test(b.textContent.trim())); if (b) b.click(); })()`);
    await sleep(1500);
  }
  const teamBefore = await c.ev(`fetch("/api/team").then(r => r.json())`);
  const ledgerBefore = (await c.ev(`fetch("/api/finances").then(r => r.json())`)).map((t) => t.id);
  out.before.team = { name: teamBefore.name, budget: teamBefore.budget, wins: teamBefore.wins, losses: teamBefore.losses };
  step("the copy's career, before the match", out.before.team);
  await c.shot("copy-dashboard-before");
  await c.ev(`document.querySelector('[data-testid="button-next-match"]')?.click()`);
  await c.waitFor(`!!document.querySelector('[data-testid="match-day-box"]')`, 120000);
  out.matchDay = await c.ev(`document.querySelector('[data-testid="match-day-box"]')?.innerText.split("\\n").slice(0, 5).join(" | ")`);
  step("match day", { box: out.matchDay });
  await c.shot("copy-match-day");
  await c.ev(`(() => { const b = [...document.querySelectorAll('[data-testid="match-day-box"] button')].find(x => /Watch/.test(x.textContent)); if (b) b.click(); return !!b; })()`);
  const onCourt = await c.waitFor(`location.pathname.startsWith("/court") ? location.search : null`, 60000);
  const matchId = Number(new URLSearchParams(onCourt ?? "").get("matchId"));
  check("Watch Match opens the court in Manual (the remembered choice)", /mode=manual/.test(await c.ev(`document.querySelector("iframe")?.getAttribute("src") ?? ""`)), onCourt ?? "");
  const loaded = await c.waitFor(`window.__msgs.includes("unity-loaded")`, 300000, 1000);
  step("Unity loaded", { loaded: !!loaded });
  await c.ev(`document.querySelector("iframe")?.focus()`);
  let botOn = true, presses = 0;
  const KEYS = [["j", "KeyJ", 74], ["k", "KeyK", 75], ["l", "KeyL", 76]];
  const bot = (async () => { let i = 0; while (botOn) { const [k, cd, v] = KEYS[i++ % 3]; await c.key(k, cd, v); presses++; await sleep(70); } })();
  await sleep(20000); await c.shot("court-played-match");

  // The frame rate in the installed app, TV look (V), for 60 s.
  await c.key("v", "KeyV", 86, 80);
  await sleep(1500);
  await c.ev(`(() => { const w = document.querySelector("iframe").contentWindow; w.__fps = []; let last = 0;
    const f = (t) => { if (last) w.__fps.push(t - last); last = t; if (w.__fpsOn) w.requestAnimationFrame(f); }; w.__fpsOn = true; w.requestAnimationFrame(f); })()`);
  await sleep(60000);
  const d = await c.ev(`(() => { const w = document.querySelector("iframe").contentWindow; w.__fpsOn = false; return w.__fps; })()`);
  const sorted = [...d].sort((a, b) => a - b), total = d.reduce((a, b) => a + b, 0), pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  out.fps = { where: "installed demo (Electron), 1280x720 page, TV look", look: c.lines.filter((l) => /\[Camera\] /.test(l.text)).map((l) => l.text).slice(-1)[0] ?? "",
    seconds: +(total / 1000).toFixed(1), frames: d.length, fps: +(d.length / (total / 1000)).toFixed(1), p50ms: +pct(0.5).toFixed(1), p95ms: +pct(0.95).toFixed(1), p99ms: +pct(0.99).toFixed(1),
    worstMs: +sorted[sorted.length - 1].toFixed(1), over33ms: d.filter((x) => x > 33.4).length, over50ms: d.filter((x) => x > 50).length };
  step("frame rate", out.fps);
  await c.shot("court-tv-look");

  let recorded = null;
  const t1 = Date.now();
  while (Date.now() - t1 < 60 * 60000) {
    recorded = await c.ev(`fetch("/api/matches").then(r => r.json()).then(l => { const m = (Array.isArray(l) ? l : l.matches ?? []).find(x => x.id === ${matchId}); return m && m.status === "completed" ? { score: m.homeScore + "-" + m.awayScore, sets: m.sets, home: m.homeTeamName, away: m.awayTeamName } : null; })`).catch(() => null);
    if (recorded) break;
    await sleep(5000);
  }
  botOn = false; await bot;
  const played = c.lines.filter((l) => /\[Played\] a played match from this serve/.test(l.text)).length;
  const touches = c.lines.filter((l) => /\[Played\] (dig|set|spike|soft|serve) by/i.test(l.text)).length;
  out.match = { id: matchId, recorded, minutes: Math.round((Date.now() - t1) / 6000) / 10, playedServes: played, touches, presses };
  check("the played match went to its end and the court's result reached the game", !!recorded && played > 0, JSON.stringify(out.match));
  await sleep(6000); await c.shot("court-result-box");
  for (let i = 0; i < 12; i++) {
    if (await c.ev(`!location.pathname.startsWith("/court")`).catch(() => true)) break;
    const at = await c.ev(`(() => { const f = document.querySelector("iframe"); const r = f ? f.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
      const k = Math.sqrt((r.width / 1280) * (r.height / 720)); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2 + 112 * k) }; })()`) ?? { x: 640, y: 472 };
    for (const type of ["mousePressed", "mouseReleased"]) await c.send("Input.dispatchMouseEvent", { type, x: at.x, y: at.y, button: "left", clickCount: 1 });
    await sleep(2500);
  }
  const back = await c.waitFor(`location.pathname === "/" && !!document.querySelector('[data-testid="calendar-date"]')`, 30000);
  await sleep(3000);
  await c.shot("dashboard-after-match");
  const row = await c.ev(`document.querySelector('[data-testid="row-match-${matchId}"]')?.innerText.replace(/\\s+/g, " ") ?? ""`);
  const teamAfter = await c.ev(`fetch("/api/team").then(r => r.json())`);
  const ledger = await c.ev(`fetch("/api/finances").then(r => r.json())`);
  const newRows = ledger.filter((t) => !ledgerBefore.includes(t.id));
  const prize = newRows.filter((t) => t.category === "prize_money");
  const opp = recorded && (recorded.home === teamBefore.name ? recorded.away : recorded.home);
  out.after = { team: { budget: teamAfter.budget, wins: teamAfter.wins, losses: teamAfter.losses }, newLedgerRows: newRows.map((t) => `${t.date} ${t.category} ${t.description} ${t.amount}`) };
  check("Continue on the result box goes back to the dashboard", !!back);
  check("the dashboard's Recent Results shows this match, with its WIN or LOSS", /\b(WIN|LOSS)\b/.test(row), `row: "${row}"; recorded ${recorded?.score} v ${opp}`);
  const won = teamAfter.wins === teamBefore.wins + 1, lost = teamAfter.losses === teamBefore.losses + 1;
  // Next match passes days too (wages, running costs, sponsors): the balance moves by exactly the new ledger rows, the prize among them.
  const moved = newRows.reduce((a, t) => a + (t.type === "income" ? t.amount : -t.amount), 0);
  check(`it pays out: the ${won ? "win" : "loss"} counted, its prize on the ledger, and the balance moved by exactly the new ledger rows`,
    (won || lost) && prize.length === 1 && prize[0].amount > 0 && prize[0].description.includes(opp) && Math.abs(teamAfter.budget - teamBefore.budget - moved) < 1e-6,
    `wins ${teamBefore.wins}->${teamAfter.wins}, losses ${teamBefore.losses}->${teamAfter.losses}; ${prize.map((t) => `${t.description} $${t.amount}`).join("; ")}; balance ${teamBefore.budget} -> ${teamAfter.budget} (${moved >= 0 ? "+" : ""}${moved}: ${newRows.map((t) => `${t.type === "income" ? "+" : "-"}${t.amount} ${t.category}`).join(", ")})`);
  check("quit from the page (Exit game)", await quit(c, "copy of the live save"));

  // 6. After.
  for (const [k, d] of Object.entries(REAL_DIRS)) {
    const diff = compare(before[k], fingerprint(d));
    check(`${k} byte for byte unchanged (${out.before[k].files} files, SHA-1 of each)`, diff.length === 0, diff.slice(0, 5).join("; ") || d);
  }
  check("the live save's own SHA-1 unchanged", sha1(LIVE_SAVE) === out.liveSaveSha1, out.liveSaveSha1);
  check("the real game's Uninstall entries unchanged", Object.entries(keysBefore).every(([k, v]) => uninstallKeys()[k] === v));
  check("the copy in the demo's folder did move on (the match is in it)", sha1(path.join(DEMO_DIR, "volleyball-empire.sqlite")) !== out.liveSaveSha1);

  // 7. The demo's next start is a first run again.
  const copyAside = path.join(testSaves, "copy-of-live-save");
  fs.rmSync(copyAside, { recursive: true, force: true });
  fs.renameSync(DEMO_DIR, copyAside);
  step("the demo's folder moved aside", { to: copyAside });
} catch (err) {
  ok = false;
  out.error = String(err?.stack ?? err);
  console.error(out.error);
  try { if (app && !app.exited) app.kill(); } catch { /* gone */ }
}
fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ ok, checks: out.checks.map((c) => `${c.pass ? "PASS" : "FAIL"} ${c.label}`) }));
process.exit(ok ? 0 : 1);
