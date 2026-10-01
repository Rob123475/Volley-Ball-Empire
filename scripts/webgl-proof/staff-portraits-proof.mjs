/**
 * Daytime brief 2 Oct, N-46: the staff and medical portraits on Rob's own
 * pages, from a COPY of his 2 Oct save. Valentino Greco's card showed "JAMES
 * WHITMORE" printed in the picture and Ana Vieira's "SOFIA PETROVA" and a flag:
 * the portraits were cut from finished cards. Now every portrait is the person
 * alone, 500 x 500.
 *
 * Boots the built api-server in production mode (it serves the built UI),
 * loads the save's career in headless Chrome, opens /staff and /medical, and
 * for every staff picture on them reads the file it shows and its real size.
 * Screenshots of both pages and of the two cards Rob named go to <outDir>.
 *
 * Usage: node scripts/webgl-proof/staff-portraits-proof.mjs <outDir>
 * Exits 1 if a picture is missing or is not one of the 500 x 500 portraits.
 */
import { fork, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..", "..");
const outDir = path.resolve(process.argv[2] ?? "staff-portraits-proof");
fs.mkdirSync(outDir, { recursive: true });
const ROB = path.join(os.homedir(), "Downloads", "volleyball-empire-backup-02oct-0845.sqlite");
const ELECTRON = path.join(REPO, "node_modules/electron/dist/electron.exe");
const PORT = 4216, BASE = `http://localhost:${PORT}`, CDP = 9339;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const work = fs.mkdtempSync(path.join(os.tmpdir(), "staff-portraits-"));
const db = path.join(work, "save.sqlite");
fs.copyFileSync(ROB, db);
const server = fork(path.join(REPO, "artifacts/api-server/dist/index.mjs"), [], {
  execPath: ELECTRON, stdio: ["ignore", fs.openSync(path.join(outDir, "server.log"), "w"), "inherit", "ipc"],
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PUBLIC_DIR: path.join(REPO, "artifacts/api-server/dist/public"),
    DB_PATH: db, PORT: String(PORT), SESSION_SECRET: "staff-portraits", STARTER_DB_PATH: path.join(REPO, "lib/db/volleyball-empire.sqlite") },
});
const out = { pages: {}, named: {}, errors: [] };
let chrome, ok = true;
try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${BASE}/api/healthz`)).ok) break; } catch { /* booting */ } await sleep(500); }
  let cookie = "";
  const api = async (m, p, b) => {
    const r = await fetch(BASE + "/api" + p, { method: m, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    return r.json().catch(() => null);
  };
  const profiles = (await api("GET", "/profiles")).profiles;
  await api("POST", `/profiles/${profiles[0].id}/select`);
  const save = (await api("GET", "/careers")).saves.find((s) => s.teamId != null);
  await api("POST", `/careers/${save.id}/load`);

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "staff-portraits-chrome-"));
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
  const shot = async (name, clip) => {
    const s = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: !clip, ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
    fs.writeFileSync(path.join(outDir, name), Buffer.from(s.result.data, "base64"));
  };
  const pictures = `[...document.querySelectorAll("img")].filter(i => /\\/images\\/staff\\//.test(i.currentSrc || i.src))`;
  for (const route of ["/staff", "/staff-market", "/medical", "/medical-market"]) {
    await send("Page.navigate", { url: BASE + route });
    let n = 0;
    for (let i = 0; i < 80; i++) {
      await js(`[...document.querySelectorAll("button")].find(b => /^ *continue *$/i.test(b.textContent.trim()))?.click()`);
      n = await js(`${pictures}.filter(i => i.complete && i.naturalWidth > 0).length`);
      if (n > 0 && i > 6) break;
      await sleep(400);
    }
    await js(`(async () => { for (const i of ${pictures}) { i.loading = "eager"; i.scrollIntoView(); await new Promise(r => setTimeout(r, 60)); } window.scrollTo(0, 0); })()`);
    await sleep(800);
    const imgs = await js(`${pictures}.map(i => ({ src: (i.currentSrc || i.src).replace(location.origin, ""), w: i.naturalWidth, h: i.naturalHeight, name: i.alt }))`);
    out.pages[route] = { pictures: imgs.length, portraits500x500: imgs.filter((i) => i.w === 500 && i.h === 500).length, others: imgs.filter((i) => !(i.w === 500 && i.h === 500)) };
    if ((route !== "/medical" && imgs.length === 0) || out.pages[route].others.length) ok = false;
    await shot(`n46-${route.slice(1)}-page.png`);
    for (const who of ["Valentino Greco", "Ana Vieira"]) {
      const r = await js(`(() => { const i = ${pictures}.find(x => x.alt === ${JSON.stringify(who)}); if (!i) return null; i.scrollIntoView({ block: "center" });
        const card = i.closest('[class*="rounded"]') ?? i; const b = card.getBoundingClientRect();
        return { src: (i.currentSrc || i.src).replace(location.origin, ""), w: i.naturalWidth, h: i.naturalHeight, box: { x: b.left + scrollX, y: b.top + scrollY, width: b.width, height: b.height } }; })()`);
      if (!r) continue;
      await sleep(300);
      const vis = await js(`(() => { const i = ${pictures}.find(x => x.alt === ${JSON.stringify(who)}); const card = i.closest('[class*="rounded"]') ?? i; const b = card.getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; })()`);
      await shot(`n46-card-${who.toLowerCase().replace(/\s+/g, "-")}.png`, vis);
      out.named[who] = { page: route, src: r.src, size: `${r.w} x ${r.h}` };
      if (!(r.w === 500 && r.h === 500)) ok = false;
    }
  }
  for (const who of ["Valentino Greco", "Ana Vieira"]) if (!out.named[who]) { ok = false; out.errors.push(`${who}'s card not found`); }
  ws.close();
} catch (err) {
  ok = false; out.errors.push(String(err?.stack ?? err));
} finally {
  if (chrome) chrome.kill();
  try { server.kill(); } catch { /* gone */ }
  await sleep(800);
}
fs.writeFileSync(path.join(outDir, "n46_portraits.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out));
process.exit(ok ? 0 : 1);
