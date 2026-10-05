/**
 * Final brief 5 Oct, A3 (N-43): does "Grow Your Squad" survive a first match
 * WATCHED IN 3D? Rob's first match was watched through the court page and
 * nobody was hurt; 2 Oct's test only used Sim Result.
 *
 * Boots the built api-server in production mode (it serves the built UI and
 * unity-build/) on a COPY of the starter DB, makes a new Sydney Riptide
 * career, signs headless Chrome in (real GPU with --gpu), and plays the first
 * match as Rob does: dashboard -> Next match -> the MATCH DAY box's "Watch
 * Match" -> the court page (/court, Unity in its frame) -> the match plays to
 * its end -> Continue in the result box -> the dashboard. The card is read
 * before and after, on screen and from the server, with screenshots.
 *
 * Usage: node scripts/webgl-proof/grow-card-3d-proof.mjs <outDir> [--gpu] [--limit 1200]
 * Prints one JSON summary line; exits 1 if a step could not be done.
 */
import { fork, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const REPO = path.resolve(import.meta.dirname, "..", "..");
const args = process.argv.slice(2);
const outDir = path.resolve(args[0]);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const GPU = args.includes("--gpu");
const LIMIT = Number(opt("--limit", "1200"));
const W = 1280, H = 720;
fs.mkdirSync(outDir, { recursive: true });

const ELECTRON = path.join(REPO, "node_modules/electron/dist/electron.exe");
const SERVER = path.join(REPO, "artifacts/api-server/dist/index.mjs");
const PUBLIC_DIR = path.join(REPO, "artifacts/api-server/dist/public");
const PORT = 4207, BASE = `http://localhost:${PORT}`;
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const CDP = 9339;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const work = fs.mkdtempSync(path.join(os.tmpdir(), "grow-3d-"));
const dbFile = path.join(work, "save.sqlite");
fs.copyFileSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), dbFile);
const out = fs.openSync(path.join(outDir, "server.log"), "w");
const server = fork(SERVER, [], {
  execPath: ELECTRON,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PUBLIC_DIR, DB_PATH: dbFile, PORT: String(PORT), SESSION_SECRET: "grow-3d" },
  stdio: ["ignore", out, out, "ipc"],
});
const q = (sql, ...a) => { const d = new DatabaseSync(dbFile, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
let chrome = null;
const summary = { steps: [], errors: [] };
const step = (label, ok, detail = "") => { summary.steps.push({ label, ok: !!ok, detail }); console.error(`${ok ? "OK  " : "FAIL"} ${label} ${detail}`); };
let failed = false;

try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${BASE}/api/healthz`)).ok) break; } catch { /* booting */ } await sleep(500); }
  let cookie = "";
  const api = async (m, p, b) => {
    const r = await fetch(BASE + "/api" + p, { method: m, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    const t = await r.text(); try { return JSON.parse(t); } catch { return t; }
  };
  const prof = await api("POST", "/profiles", { name: "Grow 3D" });
  await api("POST", `/profiles/${prof.id}/select`);
  const club = (await api("GET", "/club-templates")).clubs.find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", { slotNumber: 1, managerName: "Rob Bonner", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  const team = await api("GET", "/team");
  const squad = () => q(`SELECT p.name, s.squad_role AS role, s.is_active AS active, s.injury_status AS inj FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.team_id = ? ORDER BY s.squad_role`, team.id);
  summary.squadBefore = squad();

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "grow-3d-chrome-"));
  const gl = GPU ? ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
  chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, ...gl, "--autoplay-policy=no-user-gesture-required",
    `--window-size=${W},${H}`, "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore" });
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
  const js = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send("Runtime.enable"); await send("Page.enable");
  const [cn, cv] = cookie.split("=");
  await send("Network.enable"); await send("Network.setCookie", { name: cn, value: cv, url: BASE });
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  const shot = async (name) => { const s = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(outDir, name), Buffer.from(s.result.data, "base64")); };
  const hasCard = () => js(`[...document.querySelectorAll('#attention-required button')].some(b => /Grow Your Squad/.test(b.textContent))`);
  const panelText = () => js(`document.querySelector('#attention-required')?.innerText ?? "(no attention panel)"`);
  const serverItems = async () => ((await api("GET", "/attention-items")).items ?? []).map((x) => x.id);

  // 1. The dashboard, as a new career opens on it.
  await send("Page.navigate", { url: BASE + "/" });
  for (let i = 0; i < 80 && !(await js(`!!document.querySelector('#attention-required')`)); i++) {
    await js(`[...document.querySelectorAll("button")].find(b => /^ *continue *$/i.test(b.textContent.trim()))?.click()`);
    await sleep(400);
  }
  await sleep(1500);
  const before = await hasCard();
  await shot("a3-1-dashboard-before.png");
  step("the card is on the dashboard before the first match", before, `server: ${(await serverItems()).join(", ")}`);

  // 2. Next match, then the MATCH DAY box's Watch Match.
  await js(`[...document.querySelectorAll("button")].find(x => /Next match/.test(x.textContent))?.click()`);
  let watched = false;
  for (let i = 0; i < 60 && !watched; i++) {
    await sleep(500);
    watched = await js(`(() => { const b = [...document.querySelectorAll('[data-testid="match-day-box"] button')].find(x => /Watch/i.test(x.textContent)); if (b && !b.disabled) { b.click(); return true; } return false; })()`);
  }
  step("Next match, then Watch Match in the MATCH DAY box", watched);
  if (!watched) { await shot("a3-2-no-watch-button.png"); throw new Error("no Watch Match button"); }

  // 3. The court page: wait for Unity, take a frame mid-match, then wait for
  //    the page to return to the dashboard by itself.
  let onCourt = false;
  for (let i = 0; i < 40 && !onCourt; i++) { await sleep(500); onCourt = await js(`location.pathname === "/court"`); }
  step("the court page opened", onCourt, await js(`location.href`));
  // The result stays up in a box until Continue is pressed (Unity N-29), as Rob
  // presses it. Its button: centred, 24 px (reference 1280 x 720) above the
  // bottom of a 640 x 330 box in the middle of the court frame, which sits
  // under the page's 44 px top bar. Pressed once the match is recorded, again
  // every few seconds until the page goes back.
  const continueAt = async () => {
    const r = await js(`(() => { const f = document.querySelector("iframe"); if (!f) return null; const b = f.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; })()`);
    if (!r) return null;
    const s = Math.sqrt((r.w / 1280) * (r.h / 720));
    return { x: Math.round(r.x + r.w / 2), y: Math.round(r.y + r.h / 2 + (165 - 24 - 29) * s) };
  };
  const t0 = Date.now();
  let midShot = false, back = false, resultShot = false, presses = 0;
  while (Date.now() - t0 < LIMIT * 1000) {
    await sleep(3000);
    const path_ = await js(`location.pathname`);
    if (path_ !== "/court") { back = true; break; }
    if (!midShot && Date.now() - t0 > 60000) { await shot("a3-3-court-mid-match.png"); midShot = true; }
    const done = q(`SELECT status FROM matches WHERE (home_team_id = ? OR away_team_id = ?) AND status = 'completed' LIMIT 1`, team.id, team.id).length > 0;
    if (done) {
      if (!resultShot) { await sleep(4000); await shot("a3-4-court-result-box.png"); resultShot = true; }
      const at = await continueAt();
      if (at) {
        await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x, y: at.y });
        await send("Input.dispatchMouseEvent", { type: "mousePressed", x: at.x, y: at.y, button: "left", clickCount: 1 });
        await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: at.x, y: at.y, button: "left", clickCount: 1 });
        presses++;
      }
    }
  }
  summary.continuePresses = presses;
  summary.matchSeconds = Math.round((Date.now() - t0) / 1000);
  const match = q(`SELECT id, status, home_score AS h, away_score AS a, sets FROM matches WHERE (home_team_id = ? OR away_team_id = ?) AND status = 'completed' ORDER BY id LIMIT 1`, team.id, team.id)[0];
  step("the match played to its end on the court; Continue in the result box went back to the dashboard", back && match, `after ${summary.matchSeconds}s; match ${JSON.stringify(match)}`);

  // 4. The dashboard after the watched match.
  for (let i = 0; i < 40 && !(await js(`!!document.querySelector('#attention-required')`)); i++) await sleep(500);
  await sleep(3000);
  const after = await hasCard();
  const items = await serverItems();
  summary.panelAfter = await panelText();
  summary.squadAfter = squad();
  await shot("a3-5-dashboard-after-watched-match.png");
  // And once more after a reload, as the game would show it next time.
  await send("Page.reload", {});
  for (let i = 0; i < 40 && !(await js(`!!document.querySelector('#attention-required')`)); i++) {
    await js(`[...document.querySelectorAll("button")].find(b => /^ *continue *$/i.test(b.textContent.trim()))?.click()`);
    await sleep(500);
  }
  await sleep(2000);
  const afterReload = await hasCard();
  await shot("a3-6-dashboard-after-reload.png");
  summary.result = { before, after, afterReload, serverItems: items };
  step("after the watched match: the card on screen / after a reload / sent by the server",
    true, `on screen ${after}; after reload ${afterReload}; server ${items.includes("grow-your-squad")} (${items.join(", ")})`);
  ws.close();
} catch (err) {
  failed = true;
  summary.errors.push(String(err?.stack ?? err));
} finally {
  if (chrome) chrome.kill();
  try { server.send({ type: "shutdown" }); } catch { /* gone */ }
  await sleep(1500);
  try { server.kill(); } catch { /* gone */ }
}
fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
process.exit(failed || summary.steps.some((s) => !s.ok) ? 1 : 0);
