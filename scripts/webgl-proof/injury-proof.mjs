/**
 * Unity match brief (29 Sep), item 14 — an injured Match Player: the game says so.
 *
 * Real server (production, built UI) on a starter-DB copy, headless Chrome. A
 * Match Player is injured (Minor Injury, weeks out) as Rob's Nyasha was. The
 * dashboard: its Fitness tile and Attention Required. Then Next match: the MATCH
 * DAY box names who plays and who came in for her. Prints one JSON object.
 *
 * Usage: node scripts/webgl-proof/injury-proof.mjs [outPngPrefix]
 */
import { fork, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const REPO = path.resolve(import.meta.dirname, "..", "..");
const prefix = process.argv[2] ? path.resolve(process.argv[2]) : null;
const ELECTRON = path.join(REPO, "node_modules/electron/dist/electron.exe");
const PORT = 4198, BASE = `http://localhost:${PORT}`, CDP = 9338;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const work = fs.mkdtempSync(path.join(os.tmpdir(), "injury-proof-"));
const db = path.join(work, "m.sqlite");
fs.copyFileSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), db);
const server = fork(path.join(REPO, "artifacts/api-server/dist/index.mjs"), [], {
  execPath: ELECTRON, stdio: ["ignore", "ignore", "ignore", "ipc"],
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PUBLIC_DIR: path.join(REPO, "artifacts/api-server/dist/public"),
    DB_PATH: db, PORT: String(PORT), SESSION_SECRET: "injury-proof" },
});
const out = {};
let chrome;
try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${BASE}/api/healthz`)).ok) break; } catch { /* booting */ } await sleep(500); }
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "injury-chrome-"));
  chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`,
    "--window-size=1280,800", "--no-first-run", "about:blank"], { stdio: "ignore" });
  let wsUrl;
  for (let i = 0; i < 60 && !wsUrl; i++) { try { wsUrl = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch { /* up soon */ } if (!wsUrl) await sleep(500); }
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 1; const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (method, params = {}) => { const i = id++; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((r) => pend.set(i, r)); };
  const ev = async (x) => (await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value;
  const shot = async (name) => { if (!prefix) return; const s = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(`${prefix}-${name}.png`, Buffer.from(s.result.data, "base64")); };
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });

  await send("Page.navigate", { url: `${BASE}/login` }); await sleep(2500);
  await ev(`(async () => {
    const J = (u, o = {}) => fetch(u, { headers: { "content-type": "application/json" }, ...o }).then(r => r.json());
    const p = await J("/api/profiles", { method: "POST", body: JSON.stringify({ name: "Injury Proof" }) });
    await fetch("/api/profiles/" + p.id + "/select", { method: "POST" });
    const c = (await J("/api/club-templates")).clubs.find(x => x.name === "Sydney Riptide");
    await J("/api/careers", { method: "POST", body: JSON.stringify({ slotNumber: 1, managerName: "Injury Proof", managerNationality: "Australia", clubName: c.name, originalClubName: c.name, budget: c.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 }) });
    return true; })()`);
  await send("Page.navigate", { url: `${BASE}/` }); await sleep(3000);
  await ev(`(() => { const b = [...document.querySelectorAll("button")].find(x => /^\\s*CONTINUE\\s*$/i.test(x.textContent)); if (b) b.click(); return !!b; })()`);
  await sleep(4000);

  // Rob's case: a Match Player injured, still in her slot.
  const d = new DatabaseSync(db);
  const row = d.prepare(`SELECT s.player_id AS id, p.name FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.squad_role = 'starter' AND s.team_id IS NOT NULL AND s.is_active = 1 ORDER BY s.player_id LIMIT 1`).get();
  d.prepare(`UPDATE career_player_state SET injury_status = 'Minor Injury', is_injured = 1, injury_weeks_remaining = 20 WHERE player_id = ? AND team_id IS NOT NULL`).run(row.id);
  d.close();
  out.injured = row.name;
  await send("Page.navigate", { url: `${BASE}/` }); await sleep(4000);
  const text = await ev(`document.body.innerText`);
  out.fitnessTile = (text.match(/Fitness\s*\n\s*([^\n]+)\n\s*([^\n]+)/) ?? []).slice(1).join(" | ");
  out.attention = (text.match(/[^\n]*is injured and still a Match Player[^\n]*/) ?? [])[0] ?? null;
  out.nextMatchCard = (text.match(/[^\n]*cannot be selected[^\n]*/) ?? [])[0] ?? null;
  await shot("dashboard");
  await ev(`document.querySelector('[data-testid="button-next-match"]').click()`);
  await sleep(6000);
  out.box = await ev(`document.querySelector('[data-testid="match-day-team"]')?.innerText`);
  await shot("box");
  ws.close();
} catch (err) {
  out.error = String(err?.stack ?? err);
} finally {
  if (chrome) chrome.kill();
  try { server.send({ type: "shutdown" }); } catch { /* gone */ }
  await sleep(1500);
}
console.log(JSON.stringify(out, null, 1));
