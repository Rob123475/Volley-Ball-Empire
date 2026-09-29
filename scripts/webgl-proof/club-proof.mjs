/**
 * Unity match brief (29 Sep), item 20 — the Club pages on screen.
 *
 * Real server (production, built UI) on a starter-DB copy, headless Chrome. One
 * player at fatigue 31 (Rob's Charlotte Wade), one with a 1-week Minor Injury
 * and 7 days left (Rob's Nyasha). Opens Club > Medical Centre and Club > Hall of
 * Fame and prints what they show. Prints one JSON object.
 *
 * Usage: node scripts/webgl-proof/club-proof.mjs [outPngPrefix]
 */
import { fork, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const REPO = path.resolve(import.meta.dirname, "..", "..");
const prefix = process.argv[2] ? path.resolve(process.argv[2]) : null;
const ELECTRON = path.join(REPO, "node_modules/electron/dist/electron.exe");
const PORT = 4199, BASE = `http://localhost:${PORT}`, CDP = 9339;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const work = fs.mkdtempSync(path.join(os.tmpdir(), "club-proof-"));
const db = path.join(work, "c.sqlite");
fs.copyFileSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), db);
const server = fork(path.join(REPO, "artifacts/api-server/dist/index.mjs"), [], {
  execPath: ELECTRON, stdio: ["ignore", "ignore", "ignore", "ipc"],
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PUBLIC_DIR: path.join(REPO, "artifacts/api-server/dist/public"),
    DB_PATH: db, PORT: String(PORT), SESSION_SECRET: "club-proof" },
});
const out = {};
let chrome;
try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${BASE}/api/healthz`)).ok) break; } catch { /* booting */ } await sleep(500); }
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "club-chrome-"));
  chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`,
    "--window-size=1280,900", "--no-first-run", "about:blank"], { stdio: "ignore" });
  let wsUrl;
  for (let i = 0; i < 60 && !wsUrl; i++) { try { wsUrl = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch { /* up soon */ } if (!wsUrl) await sleep(500); }
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 1; const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (method, params = {}) => { const i = id++; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((r) => pend.set(i, r)); };
  const ev = async (x) => (await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value;
  const shot = async (name) => { if (!prefix) return; const s = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(`${prefix}-${name}.png`, Buffer.from(s.result.data, "base64")); };
  const scrollShot = async (name, max = 6) => {
    const scroller = `[...document.querySelectorAll("main, div")].find(e => e.scrollHeight > e.clientHeight + 50 && getComputedStyle(e).overflowY.match(/auto|scroll/))`;
    const total = await ev(`(${scroller})?.scrollHeight ?? 0`);
    for (let y = 0, n = 1; y < total && n <= max; y += 820, n++) {
      await ev(`(() => { const e = ${scroller}; if (e) e.scrollTop = ${y}; return true; })()`);
      await sleep(600);
      await shot(`${name}-${n}`);
    }
  };
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

  await send("Page.navigate", { url: `${BASE}/login` }); await sleep(2500);
  await ev(`(async () => {
    const J = (u, o = {}) => fetch(u, { headers: { "content-type": "application/json" }, ...o }).then(r => r.json());
    const p = await J("/api/profiles", { method: "POST", body: JSON.stringify({ name: "Club Proof" }) });
    await fetch("/api/profiles/" + p.id + "/select", { method: "POST" });
    const c = (await J("/api/club-templates")).clubs.find(x => x.name === "Sydney Riptide");
    await J("/api/careers", { method: "POST", body: JSON.stringify({ slotNumber: 1, managerName: "Club Proof", managerNationality: "Australia", clubName: c.name, originalClubName: c.name, budget: c.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 }) });
    return true; })()`);
  // Rob's two: fatigue 31 on one, a 1-week Minor Injury on another.
  const d = new DatabaseSync(db);
  const ids = d.prepare(`SELECT s.player_id AS id, p.name FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.team_id IS NOT NULL AND s.is_active = 1 ORDER BY s.player_id`).all();
  d.prepare(`UPDATE career_player_state SET fatigue = 31, fitness = 100 WHERE player_id = ? AND team_id IS NOT NULL`).run(ids[0].id);
  d.prepare(`UPDATE career_player_state SET injury_status = 'Minor Injury', is_injured = 1, injury_weeks_remaining = 1 WHERE player_id = ? AND team_id IS NOT NULL`).run(ids[1].id);
  d.close();
  out.players = { fatigue31: ids[0].name, injured: ids[1].name };

  await send("Page.navigate", { url: `${BASE}/` }); await sleep(3000);
  await ev(`(() => { const b = [...document.querySelectorAll("button")].find(x => /^\\s*CONTINUE\\s*$/i.test(x.textContent)); if (b) b.click(); return !!b; })()`);
  await sleep(2500);
  await send("Page.navigate", { url: `${BASE}/club` }); await sleep(3000);
  await ev(`(() => { const b = [...document.querySelectorAll("button")].find(x => x.textContent.trim() === "Medical Centre"); if (b) b.click(); return !!b; })()`);
  await sleep(2500);
  const med = await ev(`document.body.innerText`);
  out.path = await ev(`location.pathname`);
  out.medical = {
    marketOnPage: /Medical Staff Market|Department Full|Scout to reveal stats/.test(med),
    browseButton: /Browse Medical Market/.test(med),
    treatment: (med.match(new RegExp(ids[1].name + "[\\s\\S]{0,80}?(\\d+d remaining|Ready next week)[\\s\\S]{0,10}?(\\d+%)")) ?? []).slice(1).join(" "),
    riskAndFatigue: (med.match(new RegExp(ids[0].name + "[\\s\\S]{0,160}?Injury risk\\s*(\\d+%)[\\s\\S]{0,80}?Fatigue\\s*(\\d+%)")) ?? []).slice(1).join(" / "),
    monitor: (med.match(/(\d+)% fatigue/) ?? [])[0] ?? null,
  };
  await scrollShot("medical");
  await ev(`(() => { const b = [...document.querySelectorAll("button")].find(x => x.textContent.trim() === "Hall of Fame"); if (b) b.click(); return !!b; })()`);
  await sleep(2500);
  const hof = await ev(`document.body.innerText`);
  out.leaderboardRounds = (hof.match(/\d+ World Tour rounds a season[^\n]*/) ?? hof.match(/\d+ rounds per season/) ?? [null])[0];
  out.topBar = (hof.match(/(World Tour|Continental) R\d+\/\d+/) ?? [null])[0];
  await shot("halloffame");
  ws.close();
} catch (err) {
  out.error = String(err?.stack ?? err);
} finally {
  if (chrome) chrome.kill();
  try { server.send({ type: "shutdown" }); } catch { /* gone */ }
  await sleep(1500);
}
console.log(JSON.stringify(out, null, 1));
