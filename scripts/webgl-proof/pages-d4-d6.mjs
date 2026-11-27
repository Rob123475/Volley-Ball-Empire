/**
 * 1.2 D4, D5, D6 (28 Nov 2026): the new pages in pictures, in headless Chrome, on the built game.
 *
 * The api-server runs in development mode (so the harness's store switch exists) on a copy of the
 * starter DB, and a small server here serves the built pages (artifacts/beach-volleyball/dist/public)
 * and passes /api to it, as the packaged game's one server does.
 *   1. the title screen, with the EXHIBITION GAME pill beside CONTINUE;
 *   2. the store as shipped, closed: no Store pill in the side menu, and /store goes back to the dashboard;
 *   3. opened (the harness switch, as flipping the settings file would): the pill, the store page, a
 *      hat bought in red and worn (the wallet down by its price);
 *   4. the exhibition's pick screen, the worn hat already on the home team's first player;
 *   5. Settings > Match presentation, the player's banner typed in;
 *   6. Play on the pick screen: the WebGL court opens the exhibition (exhibitionId on its URL), dresses
 *      the players and starts the match.
 * Pictures and summary.json in <outDir>.
 *
 * Usage: node scripts/webgl-proof/pages-d4-d6.mjs <outDir>
 */
import { fork, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { startCareer } from "../../harness/harness-club.mjs";

const REPO = path.resolve(import.meta.dirname, "..", "..");
const outDir = path.resolve(process.argv[2] ?? "pages-d4-d6");
const API = 4953, WEB = 4952, CDP = 9361, BASE = `http://localhost:${WEB}`;
const ELECTRON = path.join(REPO, "node_modules", "electron", "dist", "electron.exe");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const PUBLIC = path.join(REPO, "artifacts", "beach-volleyball", "dist", "public");
const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(outDir, { recursive: true });
const work = fs.mkdtempSync(path.join(os.tmpdir(), "pages-d4-d6-"));
const db = path.join(work, "save.sqlite");
fs.copyFileSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), db);
const server = fork(SERVER, [], { execPath: ELECTRON, env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "development", DB_PATH: db, PORT: String(API), SESSION_SECRET: "pages" }, stdio: ["ignore", fs.openSync(path.join(outDir, "server.log"), "w"), "inherit", "ipc"] });

// The built pages, and /api passed to the api-server.
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".json": "application/json", ".mp3": "audio/mpeg", ".woff2": "font/woff2", ".jpg": "image/jpeg" };
const web = http.createServer((req, res) => {
  if (req.url.startsWith("/api")) {
    const p = http.request({ host: "localhost", port: API, path: req.url, method: req.method, headers: req.headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    req.pipe(p); p.on("error", () => { res.writeHead(502); res.end(); });
    return;
  }
  const clean = decodeURIComponent(req.url.split("?")[0]);
  let file = path.join(PUBLIC, clean);
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.extname(clean) ? null : path.join(PUBLIC, "index.html");
  if (!file) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
web.listen(WEB);

const summary = { checks: [], shots: [] };
let ok = true;
const check = (label, cond, detail = "") => { summary.checks.push({ label, pass: !!cond, detail }); if (!cond) ok = false; console.error(`${cond ? "PASS" : "FAIL"}  ${label}  ${detail}`); };
let chrome = null;
try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`http://localhost:${API}/api/healthz`)).ok) break; } catch { /* booting */ } await sleep(500); }
  let cookie = "";
  const call = async (m, p, b) => {
    const r = await fetch(`${BASE}/api${p}`, { method: m, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    const t = await r.text(); let data; try { data = JSON.parse(t); } catch { data = t; }
    return { status: r.status, data };
  };
  const prof = (await call("POST", "/profiles", { name: "Pages Proof" })).data;
  await call("POST", `/profiles/${prof.id}/select`);
  const club = (await call("GET", "/club-templates")).data.clubs.find((c) => c.name === "Sydney Riptide");
  await startCareer(call, { managerFaceId: 8, slotNumber: 1, managerName: "Pages Proof", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "pages-chrome-"));
  chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, "--window-size=1600,1000", "--no-first-run", "about:blank"], { stdio: "ignore" });
  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) { try { wsUrl = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch { /* up soon */ } if (!wsUrl) await sleep(500); }
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 1; const pending = new Map(); const lines = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === "Runtime.consoleAPICalled") lines.push((m.params.args ?? []).map((a) => a.value ?? a.description ?? "").join(" "));
  };
  const send = (method, params = {}) => { const i = id++; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((r) => { const t = setTimeout(() => r({}), 20000); pending.set(i, (m) => { clearTimeout(t); r(m); }); }); };
  const js = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
  const shot = async (name, why) => { const s = await send("Page.captureScreenshot", { format: "png" }); if (s.result) { fs.writeFileSync(path.join(outDir, name), Buffer.from(s.result.data, "base64")); summary.shots.push({ name, why }); } };
  const go = async (p) => { await send("Page.navigate", { url: BASE + p }); await sleep(3000); };
  await send("Runtime.enable"); await send("Page.enable"); await send("Network.enable");
  const [cn, cv] = cookie.split("="); await send("Network.setCookie", { name: cn, value: cv, url: BASE });
  await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });

  await go("/");
  const pill = await js(`!![...document.querySelectorAll("button")].find(b => /exhibition game/i.test(b.textContent))`);
  check("the title screen has the EXHIBITION GAME pill", pill);
  await shot("d6-title-pill.png", "the title screen");
  await js(`[...document.querySelectorAll("button")].find(b => /^ *continue *$/i.test(b.textContent.trim()))?.click()`);
  await sleep(3000);
  const closedPill = await js(`[...document.querySelectorAll("nav a")].some(a => a.getAttribute("href") === "/store")`);
  check("closed as shipped: no Store pill in the side menu", closedPill === false);
  await shot("d4-closed-menu.png", "the side menu with the store closed");
  await go("/store");
  check("closed: /store goes back to the dashboard", (await js("location.pathname")) === "/", await js("location.pathname"));

  await call("POST", "/dev/store/open", { open: true });
  await go("/");
  const openPill = await js(`[...document.querySelectorAll("nav a")].some(a => a.getAttribute("href") === "/store")`);
  check("opened: the Store pill is in the side menu", openPill === true);
  await go("/store");
  await sleep(1500);
  const before = await js(`document.querySelector('[data-testid="store-balance"]')?.textContent`);
  await shot("d4-store-page.png", "the store page");
  // The hat in red, bought and worn.
  await js(`(() => { const i = document.querySelector('input[aria-label="Sun hat colour 1"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(i, "#cc2222"); i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
  await js(`document.querySelector('[data-testid="buy-sun-hat"]').click()`);
  await sleep(1500);
  await js(`document.querySelector('[data-testid^="wear-"]')?.click()`);
  await sleep(1500);
  const after = await js(`document.querySelector('[data-testid="store-balance"]')?.textContent`);
  check("bought: the wallet down by the hat's price", /1000/.test(before) && /850/.test(after), `${before} -> ${after}`);
  await shot("d4-store-bought.png", "the hat bought in red and worn");

  await go("/exhibition");
  await sleep(2000);
  const hatOn = await js(`[...document.querySelectorAll('[data-testid="ex-player-0"] select')].some(s => s.value === "sun-hat")`);
  check("the exhibition's pick screen: the worn hat on the home team's first player", hatOn === true);
  await shot("d6-pick-screen.png", "the exhibition pick screen");
  await call("POST", "/dev/store/open", { open: false });

  await go("/settings");
  await js(`(() => { const i = document.querySelector('[data-testid="crowd-banner"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(i, "We love the Riptide"); i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
  await sleep(500);
  check("Settings: the player's banner is remembered", (await js(`localStorage.getItem("vbe-court-banner")`)) === "We love the Riptide");
  await js(`document.querySelector('[data-testid="crowd-banner"]').scrollIntoView({ block: "center" })`);
  await shot("d5-banner-setting.png", "Settings > Match presentation, the banner");

  // 6. Play an exhibition in the WebGL court.
  // The store is closed again, so nothing bought is worn; the hat is picked here, free, as in any exhibition.
  await go("/exhibition");
  await sleep(2000);
  await js(`(() => { const s = document.querySelector('[data-testid="ex-player-0"] select[aria-label="hat"]'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set; set.call(s, "sun-hat"); s.dispatchEvent(new Event("change", { bubbles: true })); })()`);
  await sleep(500);
  await js(`document.querySelector('[data-testid="exhibition-play"]').click()`);
  let started = false;
  for (let i = 0; i < 240 && !started; i++) { await sleep(1000); started = lines.some((l) => /match starts/.test(l)); }
  const at = await js("location.pathname + location.search");
  check("Play: the court opens the exhibition", /\/exhibition\/court\?exhibitionId=/.test(at), at);
  const exId = new URLSearchParams(at.split("?")[1]).get("exhibitionId");
  const wear = await js(`fetch("/api/unity/exhibition-state?id=${exId}").then((r) => r.json()).then((d) => JSON.stringify(d.players[0].wear))`);
  check("the court's view of the game: the first player's worn hat", /"part":"[^"]*hat/i.test(wear), wear);
  const dressed = lines.filter((l) => /\[UnityMatchDataLoader\] exhibition: /.test(l)).map((l) => l.split("\n")[0]);
  console.log([...dressed, ...lines.filter((l) => /\[Wardrobe\]/.test(l)).map((l) => l.split("\n")[0])].join("\n"));
  check("the WebGL court put the hat on the first player", /exhibition: Player_A1 .*wears .*hat/i.test(dressed[0] ?? ""), dressed[0] ?? "");
  check("and started the match", started, lines.find((l) => /match starts/.test(l)) ?? "");
  await sleep(12000);
  await shot("d6-webgl-court.png", "the exhibition in the WebGL court");
} catch (e) {
  ok = false; summary.error = String(e?.stack ?? e); console.error(e);
} finally {
  fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
  try { chrome?.kill(); } catch { /* gone */ }
  server.kill(); web.close();
}
console.log(JSON.stringify({ ok, checks: summary.checks.map((c) => `${c.pass ? "PASS" : "FAIL"} ${c.label}`) }));
process.exit(ok ? 0 : 1);
