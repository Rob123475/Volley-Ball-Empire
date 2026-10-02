/**
 * Daytime brief 2 Oct, U-3 (branch feat-job-market): the Job Market page as a
 * manager in a job sees it. A new Sydney Riptide career on a copy of the
 * starter DB, with three vacancies planted (the suite harness/ai-job-market.mjs
 * proves real ones come from sackings; a new career has none yet): each card
 * shows the club, its tier and bank balance, its board's expectation, why the
 * job is open, and whether the club would have him, in plain words.
 *
 * Usage: node scripts/webgl-proof/job-market-proof.mjs <outDir>
 */
import { fork, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..", "..");
const outDir = path.resolve(process.argv[2] ?? "staff-portraits-proof");
fs.mkdirSync(outDir, { recursive: true });
const ELECTRON = path.join(REPO, "node_modules/electron/dist/electron.exe");
const PORT = 4218, BASE = `http://localhost:${PORT}`, CDP = 9341;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const work = fs.mkdtempSync(path.join(os.tmpdir(), "job-market-proof-"));
const db = path.join(work, "save.sqlite");
fs.copyFileSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), db);
const server = fork(path.join(REPO, "artifacts/api-server/dist/index.mjs"), [], {
  execPath: ELECTRON, stdio: ["ignore", fs.openSync(path.join(outDir, "server.log"), "w"), "inherit", "ipc"],
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PUBLIC_DIR: path.join(REPO, "artifacts/api-server/dist/public"),
    DB_PATH: db, PORT: String(PORT), SESSION_SECRET: "job-market", STARTER_DB_PATH: path.join(REPO, "lib/db/volleyball-empire.sqlite") },
});
const out = { cards: [], errors: [] };
let chrome, ok = true;
try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${BASE}/api/healthz`)).ok) break; } catch { /* booting */ } await sleep(500); }
  let cookie = "";
  const api = async (m, p, b) => {
    const r = await fetch(BASE + "/api" + p, { method: m, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    return r.json().catch(() => null);
  };
  const prof = await api("POST", "/profiles", { name: "AI Buyable" });
  await api("POST", `/profiles/${prof.id}/select`);
  const club = (await api("GET", "/club-templates")).clubs.find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", { slotNumber: 1, managerName: "Rob Bonner", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "job-market-chrome-"));
  chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`,
    "--window-size=1440,900", "--no-first-run", "about:blank"], { stdio: "ignore" });
  let wsUrl;
  for (let i = 0; i < 60 && !wsUrl; i++) { try { wsUrl = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch { /* up soon */ } if (!wsUrl) await sleep(500); }
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 1; const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (method, params = {}) => { const i = id++; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((r) => pend.set(i, r)); };
  const js = async (x) => (await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  const [cn, cv] = cookie.split("=");
  await send("Network.setCookie", { name: cn, value: cv, url: BASE });
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const shot = async (name) => { const s = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(outDir, name), Buffer.from(s.result.data, "base64")); };
  // Three vacancies: the strongest, a middle and the weakest club outside the field.
  {
    const { DatabaseSync } = await import("node:sqlite");
    const d = new DatabaseSync(db);
    const cid = d.prepare("SELECT id FROM career_saves WHERE team_id IS NOT NULL").get().id;
    await api("GET", "/job-market");
    const field = new Set(d.prepare("SELECT pool_team_id AS id FROM world_tour_qualifications WHERE career_save_id = ?").all(cid).map((r) => r.id));
    const outside = d.prepare("SELECT id FROM continental_pool_teams ORDER BY rating DESC").all().filter((r) => !field.has(r.id));
    for (const c of [outside[0], outside[Math.floor(outside.length / 2)], outside[outside.length - 1]]) {
      d.prepare("UPDATE career_pool_team_state SET manager_name = NULL, vacant_since = '2026-01-01', vacancy_reason = ? WHERE career_save_id = ? AND pool_team_id = ?")
        .run("Planted for this picture: a real vacancy comes from a sacking (two failed seasons running).", cid, c.id);
    }
    d.close();
  }
  await send("Page.navigate", { url: BASE + "/job-market" });
  for (let i = 0; i < 60; i++) {
    await js(`[...document.querySelectorAll("button")].find(b => /^ *continue *$/i.test(b.textContent.trim()))?.click()`);
    if (await js(`document.querySelectorAll('[data-testid^="card-vacancy-"]').length >= 3`)) break;
    await sleep(400);
  }
  out.cards = await js(`[...document.querySelectorAll('[data-testid^="card-vacancy-"]')].map(c => c.innerText.split(String.fromCharCode(10)).filter(Boolean).join(" | "))`);
  await shot("u3-job-market.png");
  if (!(out.cards?.length === 3)) ok = false;
  ws.close();
} catch (err) {
  ok = false; out.errors.push(String(err?.stack ?? err));
} finally {
  if (chrome) chrome.kill();
  try { server.kill(); } catch { /* gone */ }
  await sleep(800);
}
fs.writeFileSync(path.join(outDir, "u3_job_market.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out));
process.exit(ok ? 0 : 1);
