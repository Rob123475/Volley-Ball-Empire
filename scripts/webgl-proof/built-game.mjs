/**
 * 1.2 (29 Nov 2026): the built game in headless Chrome, for the page proofs (pages-d4-d6.mjs,
 * music-9d.mjs, demo3-proof.mjs). Shared so each proof is only its own steps.
 *
 *   - the api-server (development mode, so the harness's store switch exists) on a COPY of the
 *     starter DB, never a save in play;
 *   - a small server here serving the built pages (artifacts/beach-volleyball/dist/public) and
 *     passing /api to it, as the packaged game's one server does;
 *   - a profile and a Sydney Riptide career, made as the suites make them (harness-club.mjs);
 *   - Chrome (headless, the music allowed to start on its own, as Electron allows it) driven over
 *     its DevTools protocol: go, js, shot, the page's console lines, waitFor a line.
 *
 * const g = await builtGame({ outDir, ports: { api, web, cdp } });  ...  await g.close();
 */
import { fork, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { startCareer } from "../../harness/harness-club.mjs";

const REPO = path.resolve(import.meta.dirname, "..", "..");
const ELECTRON = path.join(REPO, "node_modules", "electron", "dist", "electron.exe");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const PUBLIC = path.join(REPO, "artifacts", "beach-volleyball", "dist", "public");
const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find((p) => fs.existsSync(p));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".json": "application/json", ".mp3": "audio/mpeg", ".woff2": "font/woff2", ".jpg": "image/jpeg", ".wasm": "application/wasm" };
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function builtGame({ outDir, ports, width = 1600, height = 1000, managerName = "Page Proof" }) {
  fs.mkdirSync(outDir, { recursive: true });
  const BASE = `http://localhost:${ports.web}`;
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "built-game-"));
  const db = path.join(work, "save.sqlite");
  fs.copyFileSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), db);
  const server = fork(SERVER, [], { execPath: ELECTRON, env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "development", DB_PATH: db, PORT: String(ports.api), SESSION_SECRET: "pages" },
    stdio: ["ignore", fs.openSync(path.join(outDir, "server.log"), "w"), "inherit", "ipc"] });
  const web = http.createServer((req, res) => {
    if (req.url.startsWith("/api")) {
      const p = http.request({ host: "localhost", port: ports.api, path: req.url, method: req.method, headers: req.headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
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
  web.listen(ports.web);

  const summary = { checks: [], shots: [] };
  let ok = true;
  const check = (label, cond, detail = "") => { summary.checks.push({ label, pass: !!cond, detail }); if (!cond) ok = false; console.error(`${cond ? "PASS" : "FAIL"}  ${label}  ${detail}`); };

  for (let i = 0; i < 120; i++) { try { if ((await fetch(`http://localhost:${ports.api}/api/healthz`)).ok) break; } catch { /* booting */ } await sleep(500); }
  let cookie = "";
  const call = async (m, p, b) => {
    const r = await fetch(`${BASE}/api${p}`, { method: m, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    const t = await r.text(); let data; try { data = JSON.parse(t); } catch { data = t; }
    return { status: r.status, data };
  };
  const prof = (await call("POST", "/profiles", { name: managerName })).data;
  await call("POST", `/profiles/${prof.id}/select`);
  const club = (await call("GET", "/club-templates")).data.clubs.find((c) => c.name === "Sydney Riptide");
  await startCareer(call, { managerFaceId: 8, slotNumber: 1, managerName, managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "built-game-chrome-"));
  const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${ports.cdp}`, `--user-data-dir=${profile}`, `--window-size=${width},${height}`, "--no-first-run",
    "--autoplay-policy=no-user-gesture-required", "--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist", "about:blank"], { stdio: "ignore" });
  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) { try { wsUrl = (await (await fetch(`http://127.0.0.1:${ports.cdp}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch { /* up soon */ } if (!wsUrl) await sleep(500); }
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 1; const pending = new Map(); const lines = []; const t0 = Date.now();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === "Runtime.consoleAPICalled") {
      const l = { at: Date.now(), text: (m.params.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ") };
      lines.push(l);
      fs.appendFileSync(path.join(outDir, "console.log"), `${((l.at - t0) / 1000).toFixed(1)}s ${l.text.split("\n")[0]}\n`);
    }
  };
  const send = (method, params = {}, ms = 20000) => { const i = id++; ws.send(JSON.stringify({ id: i, method, params }));
    return new Promise((r) => { const t = setTimeout(() => { pending.delete(i); r({}); }, ms); pending.set(i, (m) => { clearTimeout(t); r(m); }); }); };
  const js = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
  const shot = async (name, why) => { const s = await send("Page.captureScreenshot", { format: "png" }); if (s.result) { fs.writeFileSync(path.join(outDir, name), Buffer.from(s.result.data, "base64")); summary.shots.push({ name, why }); } };
  const go = async (p, wait = 3000) => { await send("Page.navigate", { url: BASE + p }); await sleep(wait); };
  /** The first console line from `from` on that matches, within ms (or null). */
  const waitFor = async (re, ms, from = 0) => { const t = Date.now(); while (Date.now() - t < ms) { const l = lines.find((x) => x.at >= from && re.test(x.text)); if (l) return l; await sleep(250); } return null; };
  await send("Runtime.enable"); await send("Page.enable"); await send("Network.enable");
  const [cn, cv] = cookie.split("="); await send("Network.setCookie", { name: cn, value: cv, url: BASE });
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });

  return {
    BASE, call, send, js, shot, go, lines, waitFor, check, summary,
    get ok() { return ok; }, fail(e) { ok = false; summary.error = String(e?.stack ?? e); console.error(e); },
    /** The title screen's CONTINUE (every fresh session shows it until pressed). */
    async continueTitle() {
      for (let i = 0; i < 40; i++) {
        const gone = await js(`(() => { const b = [...document.querySelectorAll("button")].find(b => /^ *continue *$/i.test(b.textContent.trim())); if (b) { b.click(); return false; } return !!document.querySelector("nav"); })()`);
        if (gone) return true;
        await sleep(500);
      }
      return false;
    },
    /** The career advanced to its first match day; that match's id. */
    async firstMatchDay() {
      for (let i = 0; i < 200; i++) {
        const adv = await call("POST", "/calendar/advance", {});
        if (adv.status >= 400) break;
        const m = adv.data?.matchDay?.matchId ?? (adv.data?.blocked === "pending_match" ? adv.data.pendingMatchId : null);
        if (m != null) return m;
      }
      throw new Error("no match day");
    },
    async close() {
      fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify({ ok, ...summary }, null, 2));
      try { chrome.kill(); } catch { /* gone */ }
      server.kill(); web.close();
    },
  };
}
