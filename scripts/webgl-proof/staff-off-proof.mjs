/**
 * Final brief 5 Oct, Part B: screenshots of a member of staff off ill or hurt.
 *
 * Boots the built api-server in production mode on a COPY of the starter DB,
 * makes a new Sydney Riptide career with a Head Coach and a Physiotherapist
 * (a direct write: the market is not the subject), plants both off (the coach
 * with the flu, 7 days; the physio a bad back, 7 days; the game's own roll is
 * off for the run), and takes:
 *   b1  the Staff page: the coach's card says "Off: flu, back in 7 days";
 *   b2  the Medical page: the physio's card says "Off: a bad back, back in 7 days";
 *   b3  the dashboard's Club News: "... caught the flu", after the days pass
 *       "... is back at work", and the Staff page with no badge.
 *
 * Usage: node scripts/webgl-proof/staff-off-proof.mjs <outDir>
 */
import { fork, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const REPO = path.resolve(import.meta.dirname, "..", "..");
const outDir = path.resolve(process.argv[2]);
const W = 1440, H = 900;
fs.mkdirSync(outDir, { recursive: true });
const ELECTRON = path.join(REPO, "node_modules/electron/dist/electron.exe");
const SERVER = path.join(REPO, "artifacts/api-server/dist/index.mjs");
const PUBLIC_DIR = path.join(REPO, "artifacts/api-server/dist/public");
const PORT = 4213, BASE = `http://localhost:${PORT}`;
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const CDP = 9345;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const work = fs.mkdtempSync(path.join(os.tmpdir(), "staff-off-"));
const dbFile = path.join(work, "save.sqlite");
fs.copyFileSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), dbFile);
const server = fork(SERVER, [], {
  execPath: ELECTRON,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PUBLIC_DIR, DB_PATH: dbFile, PORT: String(PORT), SESSION_SECRET: "staff-off", VBE_STAFF_ABSENCES: "off" },
  stdio: ["ignore", fs.openSync(path.join(work, "server.log"), "w"), fs.openSync(path.join(work, "server.log"), "a"), "ipc"],
});
const q = (sql, ...a) => { const d = new DatabaseSync(dbFile, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
const w = (sql, ...a) => { const d = new DatabaseSync(dbFile); try { return d.prepare(sql).run(...a); } finally { d.close(); } };
let chrome = null;
const summary = { found: {}, errors: [] };
let ok = true;

try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${BASE}/api/healthz`)).ok) break; } catch { /* booting */ } await sleep(500); }
  let cookie = "";
  const api = async (m, p, b) => {
    const r = await fetch(BASE + "/api" + p, { method: m, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    const t = await r.text(); try { return JSON.parse(t); } catch { return t; }
  };
  const prof = await api("POST", "/profiles", { name: "Staff Off" });
  await api("POST", `/profiles/${prof.id}/select`);
  const club = (await api("GET", "/club-templates")).clubs.find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", { slotNumber: 1, managerName: "Rob Bonner", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  const team = await api("GET", "/team");
  const cid = q(`SELECT id FROM career_saves WHERE team_id = ?`, team.id)[0].id;
  const coach = q(`SELECT id, name, role FROM staff WHERE role = 'Head Coach' ORDER BY skill_level DESC LIMIT 1`)[0];
  const physio = q(`SELECT id, name, role FROM staff WHERE role LIKE 'Physio%' ORDER BY skill_level DESC LIMIT 1`)[0];
  await api("POST", "/calendar/advance", {});
  const today = (await api("GET", "/calendar")).currentDate;
  for (const [s, cause] of [[coach, "flu"], [physio, "back"]]) {
    w(`UPDATE career_staff_state SET team_id = ?, is_available = 0, salary = 1000, contract_term = '1s', contract_start_date = ?, contract_end_date = '2099-12-31',
       off_cause = ?, off_since = ?, off_days_left = 7 WHERE career_save_id = ? AND staff_id = ?`, team.id, today, cause, today, cid, s.id);
    w(`INSERT INTO staff_absences (career_save_id, team_id, staff_id, staff_name, role, cause, days, started_on, created_at) VALUES (?, ?, ?, ?, ?, ?, 7, ?, 0)`,
      cid, team.id, s.id, s.name, s.role, cause, today);
  }

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "staff-off-chrome-"));
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
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } if (m.method === "Runtime.exceptionThrown") summary.errors.push(m.params.exceptionDetails?.exception?.description ?? ""); };
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
  const clipShot = async (sel, file) => {
    const r = await js(`(() => { const e = ${sel}; if (!e) return null; e.scrollIntoView({ block: "center" }); const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; })()`);
    await sleep(800);
    const s = r ? await send("Page.captureScreenshot", { format: "png", clip: { x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 8), width: r.w + 16, height: r.h + 16, scale: 1 } })
      : await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(outDir, file), Buffer.from(s.result.data, "base64"));
    return r;
  };
  const cardWithBadge = `[...document.querySelectorAll('[data-testid="staff-off-badge"]')].map(b => { let c = b; while (c && !(c.getBoundingClientRect().height > 300)) c = c.parentElement; return c; })[0]`;

  await open("/staff", `document.querySelector('[data-testid="staff-off-badge"]')`);
  summary.found.staff = await js(`[...document.querySelectorAll('[data-testid="staff-off-badge"]')].map(b => b.textContent)`);
  await clipShot(cardWithBadge, "b1-staff-card-off.png");
  await open("/medical", `document.querySelector('[data-testid="staff-off-badge"]')`);
  summary.found.medical = await js(`[...document.querySelectorAll('[data-testid="staff-off-badge"]')].map(b => b.textContent)`);
  await clipShot(cardWithBadge, "b2-medical-card-off.png");
  for (let i = 0; i < 8; i++) await api("POST", "/calendar/advance", {});
  const news = ((await api("GET", "/news")).items ?? []).filter((n) => n.type === "staff");
  summary.found.news = news.map((n) => `${n.date}: ${n.headline}`);
  await open("/", `document.body.innerText.includes("back at work")`);
  // The dashboard, tall enough to show Club News without scrolling, its section opened.
  await js(`[...document.querySelectorAll("button")].find(b => b.textContent.includes("Club News"))?.click()`);
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: 2600, deviceScaleFactor: 1, mobile: false });
  await sleep(2500);
  { const s3 = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(outDir, "b3-dashboard-club-news.png"), Buffer.from(s3.result.data, "base64")); }
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await open("/staff", `document.body.innerText.includes(${JSON.stringify(coach.name)})`);
  summary.found.staffAfter = await js(`[...document.querySelectorAll('[data-testid="staff-off-badge"]')].length`);
  if (!(summary.found.staff ?? []).some((t) => /Off: flu, back in 7 days/.test(t))) ok = false;
  if (!(summary.found.medical ?? []).some((t) => /Off: a bad back, back in 7 days/.test(t))) ok = false;
  if (news.filter((n) => /back at work/.test(n.headline)).length < 2) ok = false;
  if (summary.found.staffAfter !== 0) ok = false;
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
