/**
 * 1.2 Part D, section 2 (28 Nov 2026): the frame rate of a venue at every time of day, in the
 * WebGL build in headless Chrome (real GPU with --gpu), on the built game, with the roaming TV
 * camera on (the watched match's default look).
 *
 * Boots the built api-server in production mode on a COPY of the starter DB, makes a new Sydney
 * Riptide career as the harness does (harness-club.mjs startCareer) and advances it to its first
 * match day. The game gives every match its time of day (routes/unity.ts timeOfDayFor), so this
 * asks /api/unity/match-state of the career's matches until it has one morning, one midday, one
 * sunset and one night match, and opens each on the court (/court?matchId=...). Once the match
 * has started and the walk-on is over, it counts every frame the court's page draws for N
 * seconds, and takes a picture at the end. The venue is the match's continent's, or the fallback
 * while that one waits on Rob (the court's log says which).
 *
 * Usage: node scripts/webgl-proof/venue-fps.mjs <outDir> [--gpu] [--size 1920x1080] [--seconds 60]
 * Writes summary.json and prints one JSON line.
 */
import { fork, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startCareer } from "../../harness/harness-club.mjs";

const REPO = path.resolve(import.meta.dirname, "..", "..");
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const outDir = path.resolve(args[0] ?? "venue-fps");
const GPU = args.includes("--gpu");
const [W, H] = opt("--size", "1920x1080").split("x").map(Number);
const SECONDS = Number(opt("--seconds", "60"));
const PORT = 4956, CDP = 9357, BASE = `http://localhost:${PORT}`;
const ELECTRON = path.join(REPO, "node_modules", "electron", "dist", "electron.exe");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const PUBLIC_DIR = path.join(REPO, "artifacts", "beach-volleyball", "dist", "public");
const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(outDir, { recursive: true });

const work = fs.mkdtempSync(path.join(os.tmpdir(), "venue-fps-"));
const dbFile = path.join(work, "save.sqlite");
fs.copyFileSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), dbFile);
const out = fs.openSync(path.join(outDir, "server.log"), "w");
const server = fork(SERVER, [], {
  execPath: ELECTRON,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PUBLIC_DIR, DB_PATH: dbFile, PORT: String(PORT), SESSION_SECRET: "venue-fps" },
  stdio: ["ignore", out, out, "ipc"],
});
let chrome = null;
const summary = { size: `${W}x${H}`, gpu: GPU, seconds: SECONDS, runs: [], errors: [] };
const t0 = Date.now();

try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${BASE}/api/healthz`)).ok) break; } catch { /* booting */ } await sleep(500); }
  let cookie = "";
  const call = async (m, p, b) => {
    const r = await fetch(BASE + "/api" + p, { method: m, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    const t = await r.text(); let data; try { data = JSON.parse(t); } catch { data = t; }
    return { status: r.status, data };
  };
  const api = async (m, p, b) => (await call(m, p, b)).data;
  const prof = await api("POST", "/profiles", { name: "Venue FPS" });
  await api("POST", `/profiles/${prof.id}/select`);
  const club = (await api("GET", "/club-templates")).clubs.find((c) => c.name === "Sydney Riptide");
  await startCareer(call, { managerFaceId: 8, slotNumber: 1, managerName: "Rob Bonner", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  let firstMatchId = null;
  for (let i = 0; i < 200 && firstMatchId == null; i++) {
    const adv = await call("POST", "/calendar/advance", {});
    if (adv.status >= 400) break;
    firstMatchId = adv.data?.matchDay?.matchId ?? (adv.data?.blocked === "pending_match" ? adv.data.pendingMatchId : null);
  }
  if (firstMatchId == null) throw new Error("no match day");
  const careerSaveId = (await api("GET", "/careers"))?.activeCareerSaveId;
  // One match at each time of day, as the game gives them.
  const matches = await api("GET", "/matches");
  const byTime = {};
  for (const m of Array.isArray(matches) ? matches : []) {
    const st = await api("GET", `/unity/match-state?careerSaveId=${careerSaveId}&matchId=${m.id}`);
    if (st?.timeOfDay && !byTime[st.timeOfDay]) byTime[st.timeOfDay] = { matchId: m.id, continent: st.continent, weather: st.weather };
    if (Object.keys(byTime).length === 4) break;
  }
  console.error(`matches by time of day: ${JSON.stringify(byTime)}`);

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "venue-fps-chrome-"));
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
  let nextId = 1; const pending = new Map(); const lines = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === "Runtime.consoleAPICalled") {
      const l = { at: Date.now(), text: (m.params.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ") };
      lines.push(l);
      fs.appendFileSync(path.join(outDir, "console.log"), `${((l.at - t0) / 1000).toFixed(1)}s ${l.text}\n`);
    }
    if (m.method === "Runtime.exceptionThrown") summary.errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
  };
  const send = (method, params = {}, ms = 20000) => { const id = nextId++; ws.send(JSON.stringify({ id, method, params }));
    return new Promise((r) => { const t = setTimeout(() => { pending.delete(id); r({}); }, ms); pending.set(id, (m) => { clearTimeout(t); r(m); }); }); };
  const js = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send("Runtime.enable"); await send("Page.enable");
  const [cn, cv] = cookie.split("=");
  await send("Network.enable"); await send("Network.setCookie", { name: cn, value: cv, url: BASE });
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  const waitFor = async (re, ms, from) => { const t = Date.now(); while (Date.now() - t < ms) { if (lines.some((l) => l.at >= from && re.test(l.text))) return true; await sleep(250); } return false; };

  // Watched in Auto on the TV look, the defaults.
  await send("Page.navigate", { url: BASE + "/" });
  await sleep(2500);
  await js(`localStorage.setItem("vbe-court-control-mode", "auto"); localStorage.removeItem("vbe-court-camera"); localStorage.removeItem("vbe-court-skips")`);
  // The title screen shows on every fresh session until CONTINUE (as Rob starts the game).
  await send("Page.reload");
  for (let i = 0; i < 40; i++) {
    const gone = await js(`(() => { const b = [...document.querySelectorAll("button")].find(b => /^ *continue *$/i.test(b.textContent.trim())); if (b) { b.click(); return false; } return !!document.querySelector("nav"); })()`);
    if (gone) break;
    await sleep(500);
  }
  for (const time of ["morning", "midday", "sunset", "night"]) {
    const pick = byTime[time];
    if (!pick) { summary.runs.push({ time, error: "no match at this time" }); continue; }
    const from = Date.now();
    await send("Page.navigate", { url: `${BASE}/court?matchId=${pick.matchId}` });
    const started = await waitFor(/match starts/, 300000, from);
    const venue = lines.filter((l) => l.at >= from && /\[Venue\]|\[TimeOfDay\]/.test(l.text)).map((l) => l.text.slice(0, 160));
    if (!started) { summary.runs.push({ time, ...pick, error: "the match never started", venue }); continue; }
    await sleep(14000);   // the walk-on (about 10 s) and the first serve
    await js(`(() => { const w = document.querySelector("iframe").contentWindow; w.__fps = []; let last = 0;
      const f = (t) => { if (last) w.__fps.push(t - last); last = t; if (w.__fpsOn) w.requestAnimationFrame(f); };
      w.__fpsOn = true; w.requestAnimationFrame(f); })()`);
    await sleep(SECONDS * 1000);
    const d = await js(`(() => { const w = document.querySelector("iframe").contentWindow; w.__fpsOn = false; return w.__fps; })()`) ?? [];
    const sorted = [...d].sort((a, b) => a - b);
    const total = d.reduce((a, b) => a + b, 0);
    const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
    const s = await send("Page.captureScreenshot", { format: "png" });
    if (s.result) fs.writeFileSync(path.join(outDir, `fps-${time}.png`), Buffer.from(s.result.data, "base64"));
    const run = { time, ...pick, venue, seconds: +(total / 1000).toFixed(1), frames: d.length, fps: total ? +(d.length / (total / 1000)).toFixed(1) : 0,
      p50ms: +pct(0.5).toFixed(1), p95ms: +pct(0.95).toFixed(1), worstMs: +(sorted[sorted.length - 1] ?? 0).toFixed(1),
      over33ms: d.filter((x) => x > 33.4).length, over50ms: d.filter((x) => x > 50).length };
    summary.runs.push(run);
    console.error(`${time}: ${run.fps} fps (median ${run.p50ms} ms, 95th ${run.p95ms} ms, ${run.over50ms} over 50 ms) match ${pick.matchId}`);
  }
} catch (e) {
  summary.errors.push(String(e?.stack ?? e));
} finally {
  fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
  try { chrome?.kill(); } catch { /* gone */ }
  try { server.kill(); } catch { /* gone */ }
}
console.log(JSON.stringify({ runs: summary.runs.map((r) => ({ time: r.time, fps: r.fps, p95ms: r.p95ms, over50ms: r.over50ms, error: r.error })), errors: summary.errors.length }));
