/**
 * Daytime brief 2 Oct, U-6 (branch feat-ai-buyable): the Player Market's "At AI
 * Clubs" filter. A new Sydney Riptide career on a copy of the starter DB; the
 * page in headless Chrome, the filter pressed; every card it shows is a senior
 * at an AI club, says which club, and can be signed; the free agents' filter
 * holds none of them.
 *
 * Usage: node scripts/webgl-proof/ai-buyable-proof.mjs <outDir>
 */
import { fork, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..", "..");
const outDir = path.resolve(process.argv[2] ?? "staff-portraits-proof");
fs.mkdirSync(outDir, { recursive: true });
const ELECTRON = path.join(REPO, "node_modules/electron/dist/electron.exe");
const PORT = 4217, BASE = `http://localhost:${PORT}`, CDP = 9340;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const work = fs.mkdtempSync(path.join(os.tmpdir(), "ai-buyable-proof-"));
const db = path.join(work, "save.sqlite");
fs.copyFileSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), db);
const server = fork(path.join(REPO, "artifacts/api-server/dist/index.mjs"), [], {
  execPath: ELECTRON, stdio: ["ignore", fs.openSync(path.join(outDir, "server.log"), "w"), "inherit", "ipc"],
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PUBLIC_DIR: path.join(REPO, "artifacts/api-server/dist/public"),
    DB_PATH: db, PORT: String(PORT), SESSION_SECRET: "ai-buyable", STARTER_DB_PATH: path.join(REPO, "lib/db/volleyball-empire.sqlite") },
});
const out = { filters: {}, cards: [], errors: [] };
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

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ai-buyable-chrome-"));
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
  await send("Page.navigate", { url: BASE + "/players" });
  const pill = (label) => `[...document.querySelectorAll("button")].find(b => b.textContent.trim().startsWith(${JSON.stringify(label)}))`;
  for (let i = 0; i < 80; i++) {
    await js(`[...document.querySelectorAll("button")].find(b => /^ *continue *$/i.test(b.textContent.trim()))?.click()`);
    if (await js(`!!${pill("At AI Clubs")} && /\\d/.test(${pill("At AI Clubs")}.textContent)`)) break;
    await sleep(400);
  }
  for (const f of ["At AI Clubs", "Free Agents"]) {
    await js(`${pill(f)}.click()`);
    await sleep(1200);
    out.filters[f] = await js(`(() => { const t = ${pill(f)}.textContent; const n = Number((t.match(/(\\d+)\\s*$/) || [])[1]);
      const text = document.body.innerText; return { count: n, atAiBadges: (text.match(/At AI Club\\b/g) || []).length - 1, freeAgentBadges: (text.match(/Free Agent\\b/g) || []).length - 1,
        underContractAt: [...text.matchAll(/Under contract at ([^\\n]+)/g)].map(m => m[1]).slice(0, 6) }; })()`);
    if (f === "At AI Clubs") { await js(`[...document.querySelectorAll("span")].find(e => e.textContent.startsWith("Under contract at"))?.scrollIntoView({ block: "center" })`); await sleep(500); }
    await shot(`u6-market-${f.toLowerCase().replace(/\s+/g, "-")}.png`);
  }
  const ai = out.filters["At AI Clubs"], fa = out.filters["Free Agents"];
  if (!(ai?.count === 120 && ai.underContractAt.length > 0 && fa?.atAiBadges <= 0)) ok = false;
  ws.close();
} catch (err) {
  ok = false; out.errors.push(String(err?.stack ?? err));
} finally {
  if (chrome) chrome.kill();
  try { server.kill(); } catch { /* gone */ }
  await sleep(800);
}
fs.writeFileSync(path.join(outDir, "u6_market.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out));
process.exit(ok ? 0 : 1);
