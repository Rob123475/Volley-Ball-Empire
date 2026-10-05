/**
 * Final brief 5 Oct, A4: screenshots of the new player pictures on their cards.
 *
 * Boots the built api-server in production mode (it serves the built UI) on a
 * COPY of the starter DB, makes a new Sydney Riptide career and signs headless
 * Chrome in. Scenarios (any of):
 *   graduate   a youth of the club's academy, 18, promoted by hand: her card
 *              on the Team page (her graduate picture) and on the market list
 *   market     the Player Market: a youth's card (still her flag card) and a
 *              senior's card, side by side
 *   ai-market  (try branch) the Player Market's "At AI Clubs" players: the
 *              cards of AI club seniors with Rob's new pictures
 *
 * Usage: node scripts/webgl-proof/player-cards-proof.mjs <outDir> <scenario> [...]
 * Prints one JSON summary line; exits 1 if a card could not be found.
 */
import { fork, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const REPO = path.resolve(import.meta.dirname, "..", "..");
const args = process.argv.slice(2);
const outDir = path.resolve(args[0]);
const scenarios = args.slice(1);
const W = 1440, H = 900;
fs.mkdirSync(outDir, { recursive: true });

const ELECTRON = path.join(REPO, "node_modules/electron/dist/electron.exe");
const SERVER = path.join(REPO, "artifacts/api-server/dist/index.mjs");
const PUBLIC_DIR = path.join(REPO, "artifacts/api-server/dist/public");
const PORT = 4209, BASE = `http://localhost:${PORT}`;
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const CDP = 9341;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const work = fs.mkdtempSync(path.join(os.tmpdir(), "cards-proof-"));
const dbFile = path.join(work, "save.sqlite");
fs.copyFileSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), dbFile);
const out = fs.openSync(path.join(work, "server.log"), "w");
const server = fork(SERVER, [], {
  execPath: ELECTRON,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PUBLIC_DIR, DB_PATH: dbFile, PORT: String(PORT), SESSION_SECRET: "cards-proof" },
  stdio: ["ignore", out, out, "ipc"],
});
const q = (sql, ...a) => { const d = new DatabaseSync(dbFile, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
const w = (sql, ...a) => { const d = new DatabaseSync(dbFile); try { return d.prepare(sql).run(...a); } finally { d.close(); } };
let chrome = null;
const summary = { shots: [], found: {}, errors: [] };
let ok = true;

try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${BASE}/api/healthz`)).ok) break; } catch { /* booting */ } await sleep(500); }
  let cookie = "";
  const api = async (m, p, b) => {
    const r = await fetch(BASE + "/api" + p, { method: m, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    const t = await r.text(); try { return JSON.parse(t); } catch { return t; }
  };
  const prof = await api("POST", "/profiles", { name: "Cards" });
  await api("POST", `/profiles/${prof.id}/select`);
  const club = (await api("GET", "/club-templates")).clubs.find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", { slotNumber: 1, managerName: "Rob Bonner", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  const team = await api("GET", "/team");
  const cid = q(`SELECT id FROM career_saves WHERE team_id = ?`, team.id)[0].id;

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "cards-chrome-"));
  chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    `--window-size=${W},${H}`, "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore" });
  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    try { wsUrl = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch { /* up soon */ }
    if (!wsUrl) await sleep(500);
  }
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let nextId = 1; const pending = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => { const id = nextId++; ws.send(JSON.stringify({ id, method, params })); return new Promise((r) => pending.set(id, r)); };
  const js = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send("Runtime.enable"); await send("Page.enable");
  const [cn, cv] = cookie.split("=");
  await send("Network.enable"); await send("Network.setCookie", { name: cn, value: cv, url: BASE });
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  const open = async (route, ready) => {
    await send("Page.navigate", { url: BASE + route });
    for (let i = 0; i < 80; i++) {
      if (await js(`!!(${ready})`)) return true;
      await js(`[...document.querySelectorAll("button")].find(b => /^ *continue *$/i.test(b.textContent.trim()))?.click()`);
      await sleep(400);
    }
    return false;
  };
  /** The card (the smallest card-sized box) holding this name; scrolled into view; its rectangle. */
  // The card's name is printed letter by letter down its side, so the card is
  // found from its picture (alt = her name), climbing to the card-sized box.
  const cardOf = (name) => js(`(() => {
    const im = [...document.querySelectorAll('img')].find(i => i.getAttribute('alt') === ${JSON.stringify(name)});
    let c = im; while (c && !(c.getBoundingClientRect().height > 330 && c.getBoundingClientRect().width > 180)) c = c.parentElement;
    if (!c) return null;
    c.scrollIntoView({ block: "center" });
    const r = c.getBoundingClientRect();
    const img = c.querySelector('img');
    return { x: r.left, y: r.top, w: r.width, h: r.height, img: img?.getAttribute('src') ?? null, text: c.innerText.slice(0, 160) };
  })()`);
  const shotOf = async (name, file, pad = 8) => {
    let r = null;
    for (let i = 0; i < 20 && !r; i++) { r = await cardOf(name); if (!r) await sleep(500); }
    if (!r) { ok = false; summary.errors.push(`no card for ${name} (${file})`); return null; }
    await sleep(1500);
    r = await cardOf(name);
    const s = await send("Page.captureScreenshot", { format: "png", clip: { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: r.w + 2 * pad, height: r.h + 2 * pad, scale: 1 } });
    fs.writeFileSync(path.join(outDir, file), Buffer.from(s.result.data, "base64"));
    summary.shots.push(file);
    return r;
  };
  const fullShot = async (file) => { const s = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(outDir, file), Buffer.from(s.result.data, "base64")); summary.shots.push(file); };

  if (scenarios.includes("graduate")) {
    const youth = q(`SELECT s.player_id AS id, p.name, p.continent FROM career_player_state s JOIN players p ON p.id = s.player_id
      WHERE s.career_save_id = ? AND p.player_type = 'youth' AND s.team_id IS NULL AND s.is_promoted = 0 AND p.continent = 'oceania' LIMIT 1`, cid)[0];
    w(`UPDATE career_player_state SET team_id = ?, age = 18, academy_contract_years = 2, squad_role = 'reserve', is_active = 0 WHERE career_save_id = ? AND player_id = ?`, team.id, cid, youth.id);
    const r = await api("PATCH", `/team/roster/${youth.id}/role`, { role: "interchange", length: "1s" });
    const pic = q(`SELECT image_url AS u FROM career_graduate_portraits WHERE career_save_id = ? AND player_id = ?`, cid, youth.id)[0]?.u ?? null;
    await open("/team", `document.body.innerText.includes(${JSON.stringify(youth.name)})`);
    const card = await shotOf(youth.name, "a4-graduate-card-team-page.png");
    await fullShot("a4-graduate-team-page.png");
    summary.found.graduate = { name: youth.name, promoted: r?.error ?? "ok", picture: pic, cardImg: card?.img ?? null };
    if (!pic || card?.img !== pic) ok = false;
  }
  if (scenarios.includes("market")) {
    await open("/players", `document.querySelectorAll('img').length > 3`);
    await sleep(2000);
    const senior = await js(`(() => { const n = [...document.querySelectorAll('img')].find(i => /\\/seniors\\//.test(i.getAttribute('src') ?? ''))?.getAttribute('alt'); return n ?? null; })()`);
    if (senior) await shotOf(senior, "a4-market-card-senior.png");
    await fullShot("a4-market-page.png");
    summary.found.market = { senior };
    if (!senior) ok = false;
  }
  if (scenarios.includes("ai-market")) {
    await open("/players", `document.body.innerText.includes("At AI Clubs")`);
    await js(`[...document.querySelectorAll("button")].find(b => /At AI Clubs/.test(b.textContent))?.click()`);
    await sleep(3000);
    const names = await js(`[...document.querySelectorAll('img')].filter(i => /\\/seniors\\/ai\\//.test(i.getAttribute('src') ?? '')).slice(0, 3).map(i => ({ name: i.getAttribute('alt'), src: i.getAttribute('src') }))`);
    for (const [k, n] of (names ?? []).entries()) await shotOf(n.name, `a4-ai-club-card-${k + 1}.png`);
    await fullShot("a4-ai-clubs-market-page.png");
    summary.found.aiMarket = names;
    if (!names?.length) ok = false;
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
