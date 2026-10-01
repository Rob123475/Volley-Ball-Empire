/**
 * Overnight brief 1 Oct, N-30: the "Leave match" bar on the game's /court page
 * was clipped at both ends ("forfeits the match." cut off top-left, "Leave ma…"
 * top-right). Headless proof of the bar on the GAME page (not the Unity page):
 *
 * Boots the built api-server (production mode, serving the built UI) on a COPY
 * of the starter DB, makes a career, runs it to its first match day and marks
 * the match watched, signs headless Chrome in with the session, opens
 * /court?matchId=…, and at each window size measures the bar: its left and
 * right edges, the note's and the button's edges, whether either's text is cut
 * (scrollWidth > clientWidth), and whether the page scrolls sideways. A
 * screenshot of the top of the window is kept for each size.
 *
 * Usage: node scripts/webgl-proof/leave-bar-proof.mjs <outDir> [--sizes 1280x720,1024x700]
 * Prints one JSON summary line; exits 1 if the bar does not fit at any size.
 */
import { fork, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..", "..");
const args = process.argv.slice(2);
const outDir = path.resolve(args[0]);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SIZES = opt("--sizes", "1920x1080,1600x900,1366x768,1280x720,1024x700,800x600").split(",").map((s) => s.split("x").map(Number));
fs.mkdirSync(outDir, { recursive: true });

const ELECTRON = path.join(REPO, "node_modules/electron/dist/electron.exe");
const SERVER = path.join(REPO, "artifacts/api-server/dist/index.mjs");
const PUBLIC_DIR = path.join(REPO, "artifacts/api-server/dist/public");
const PORT = 4199, BASE = `http://localhost:${PORT}`;
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const CDP = 9335;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const work = fs.mkdtempSync(path.join(os.tmpdir(), "leave-bar-"));
const db = path.join(work, "court.sqlite");
fs.copyFileSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), db);
const out = fs.openSync(path.join(outDir, "server.log"), "w");
const server = fork(SERVER, [], {
  execPath: ELECTRON,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PUBLIC_DIR, DB_PATH: db, PORT: String(PORT), SESSION_SECRET: "leave-bar-proof" },
  stdio: ["ignore", out, out, "ipc"],
});
let chrome = null;
const summary = { sizes: [], errors: [] };
let ok = true;

try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${BASE}/api/healthz`)).ok) break; } catch { /* booting */ } await sleep(500); }
  let cookie = "";
  const api = async (m, p, b) => {
    const r = await fetch(BASE + "/api" + p, { method: m, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    const t = await r.text(); try { return JSON.parse(t); } catch { return t; }
  };
  const prof = await api("POST", "/profiles", { name: "Leave Bar Proof" });
  await api("POST", `/profiles/${prof.id}/select`);
  const club = (await api("GET", "/club-templates")).clubs.find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", { slotNumber: 1, managerName: "Leave Bar Proof", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  const matchId = (await api("POST", "/calendar/next-match")).matchDay.matchId;
  const VIA_DASHBOARD = args.includes("--via-dashboard");
  if (!VIA_DASHBOARD) await api("POST", `/matches/${matchId}/watch`, {});

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "leave-bar-chrome-"));
  chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    `--window-size=${SIZES[0][0]},${SIZES[0][1]}`, "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore" });
  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    try { wsUrl = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch { /* up soon */ }
    if (!wsUrl) await sleep(500);
  }
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let nextId = 1; const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === "Runtime.exceptionThrown") summary.errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
  };
  const send = (method, params = {}) => { const id = nextId++; ws.send(JSON.stringify({ id, method, params })); return new Promise((r) => pending.set(id, r)); };
  const evalJs = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send("Runtime.enable"); await send("Page.enable"); await send("Network.enable");
  const [name, value] = cookie.split("=");
  await send("Network.setCookie", { name, value, url: BASE });
  const size = async ([w, h]) => send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await size(SIZES[0]);
  // --via-dashboard: as Rob does it: the dashboard, its MATCH DAY box, Watch Match.
  await send("Page.navigate", { url: VIA_DASHBOARD ? `${BASE}/` : `${BASE}/court?matchId=${matchId}` });
  if (VIA_DASHBOARD) {
    let watched = false;
    for (let i = 0; i < 80 && !watched; i++) {
      watched = await evalJs(`(() => { const b = [...document.querySelectorAll('[data-testid="match-day-box"] button')].find(x => /Watch Match/.test(x.textContent)); if (b) { b.click(); return true; } [...document.querySelectorAll("button")].find(x => /^ *continue *$/i.test(x.textContent.trim()))?.click(); return false; })()`);
      if (!watched) await sleep(500);
    }
    summary.viaDashboard = watched;
  }
  // The game's splash (CONTINUE) comes first on a fresh launch, as for a player.
  let found = false;
  for (let i = 0; i < 60 && !found; i++) {
    found = await evalJs(`!!document.querySelector('[data-testid="court-leave-bar"]')`);
    if (!found) { await evalJs(`[...document.querySelectorAll("button")].find(b => /continue/i.test(b.textContent))?.click()`); await sleep(500); }
  }
  if (!found) throw new Error(`no Leave bar: page at ${await evalJs("location.href")}: ${(await evalJs("document.body.innerText"))?.slice(0, 300)}`);

  for (const s of SIZES) {
    await size(s);
    await sleep(700);
    // As when the player clicks into the court: the Unity frame takes focus,
    // and the browser scrolls whatever it must to show it.
    await evalJs(`(() => { const f = document.querySelector("iframe"); f?.focus(); f?.scrollIntoView({ block: "end" }); return true; })()`);
    await sleep(300);
    const m = await evalJs(`(() => {
      const bar = document.querySelector('[data-testid="court-leave-bar"]');
      const note = bar.querySelector('span'), btn = bar.querySelector('[data-testid="button-leave-match"]');
      const r = (e) => { const b = e.getBoundingClientRect(); return { left: Math.round(b.left), right: Math.round(b.right), top: Math.round(b.top), bottom: Math.round(b.bottom) }; };
      return { viewport: innerWidth, docScroll: document.documentElement.scrollWidth, viewportH: innerHeight,
        docScrollH: document.documentElement.scrollHeight, scrollY: Math.round(scrollY),
        bodyStyle: document.body.getAttribute("style") || "", htmlStyle: document.documentElement.getAttribute("style") || "",
        tallest: [...document.body.children].map(e => e.tagName + "." + (e.className || "").toString().slice(0, 40) + ":" + Math.round(e.getBoundingClientRect().height)).join(" | "), bar: r(bar), note: r(note), noteText: note.textContent,
        noteCut: note.scrollWidth > note.clientWidth + 1, button: r(btn), buttonText: btn.textContent, buttonCut: btn.scrollWidth > btn.clientWidth + 1 };
    })()`);
    const fits = m.bar.left >= 0 && m.bar.right <= m.viewport && m.note.left >= 0 && m.button.right <= m.viewport && m.bar.top >= 0
      && !m.noteCut && !m.buttonCut && m.docScroll <= m.viewport && m.docScrollH <= m.viewportH && m.scrollY === 0;
    if (!fits) ok = false;
    const shot = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: s[0], height: 90, scale: 1 } });
    const file = path.join(outDir, `leave-bar-${s[0]}x${s[1]}.png`);
    fs.writeFileSync(file, Buffer.from(shot.result.data, "base64"));
    summary.sizes.push({ size: `${s[0]}x${s[1]}`, fits, ...m, shot: path.basename(file) });
  }
  ws.close();
} catch (err) {
  ok = false;
  summary.errors.push(String(err?.stack ?? err));
} finally {
  if (chrome) chrome.kill();
  try { server.send({ type: "shutdown" }); } catch { /* gone */ }
  await sleep(1500);
  try { server.kill(); } catch { /* gone */ }
}
fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
process.exit(ok ? 0 : 1);
