/**
 * 1.2 demo (27 Nov 2026), brief Part C steps 2 and 3: one whole match on the
 * WebGL build in headless Chrome (real GPU with --gpu), on the built game.
 *
 * Boots the built api-server in production mode on a COPY of the starter DB,
 * makes a new Sydney Riptide career as the harness does (its Day 1 draft
 * picked and closed, harness-club.mjs startCareer), advances it to its first
 * match day, and opens that match as Rob does (the remembered Auto/Manual
 * choice, CONTINUE on the title screen, Watch Match). Then, to the end of the
 * match:
 *   --mode auto    a watched match. It opens on the TV look (the default for a
 *                  watched match); once the moments below are on file, V
 *                  switches to the Game look for the rest.
 *   --mode manual  a played match, driven by a keyboard bot: J, K and L pressed
 *                  in turn every 120 ms into the court (the Input System), so
 *                  whichever touch the ball wants is pressed near its moment
 *                  and the serve meter is tapped. The bot does not move or
 *                  aim: it plays like a beginner who only presses buttons. It
 *                  opens on the Game look (the default for a played match),
 *                  then V switches to TV.
 * In each look, pictures from the court's own log lines:
 *   serve    0.2 s after the serve ("[Point] decided" in Auto, "[Played] serve by" in Manual)
 *   rally    1.6 s after the serve, if the point is still going
 *   between  0.6 s into the scorer's close-up ("[Director] cutaway: the scorer")
 *   replay   0.8 s into a replay ("[Director] cutaway: replay")
 * and at the end, in the second look, the winners' celebration and the result box.
 * With --fps N, the frame rate is measured for N seconds in the TV look: every
 * requestAnimationFrame of the court's own frame (Unity draws on those).
 *
 * Usage: node scripts/webgl-proof/demo-1.2-proof.mjs <outDir> --mode auto|manual [--gpu] [--size 1920x1080] [--fps 60]
 * Writes summary.json and prints one JSON line; exits 1 if a check fails.
 */
import { fork, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startCareer } from "../../harness/harness-club.mjs";

const REPO = path.resolve(import.meta.dirname, "..", "..");
const args = process.argv.slice(2);
const outDir = path.resolve(args[0]);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const MODE = opt("--mode", "auto") === "manual" ? "manual" : "auto";
const GPU = args.includes("--gpu");
const [W, H] = opt("--size", "1280x720").split("x").map(Number);
const FPS_SECONDS = Number(opt("--fps", "0"));
fs.mkdirSync(outDir, { recursive: true });

const ELECTRON = path.join(REPO, "node_modules/electron/dist/electron.exe");
const SERVER = path.join(REPO, "artifacts/api-server/dist/index.mjs");
const PUBLIC_DIR = path.join(REPO, "artifacts/api-server/dist/public");
const PORT = MODE === "manual" ? 4231 : 4232, BASE = `http://localhost:${PORT}`;
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const CDP = MODE === "manual" ? 9361 : 9362;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FIRST = MODE === "manual" ? "Game" : "TV", SECOND = MODE === "manual" ? "TV" : "Game";
const MOMENTS = ["serve", "rally", "between", "replay"];

const work = fs.mkdtempSync(path.join(os.tmpdir(), "demo-proof-"));
const dbFile = path.join(work, "save.sqlite");
fs.copyFileSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), dbFile);
const out = fs.openSync(path.join(outDir, "server.log"), "w");
const server = fork(SERVER, [], {
  execPath: ELECTRON,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PUBLIC_DIR, DB_PATH: dbFile, PORT: String(PORT), SESSION_SECRET: "demo-proof" },
  stdio: ["ignore", out, out, "ipc"],
});
let chrome = null;
const summary = { mode: MODE, size: `${W}x${H}`, gpu: GPU, checks: [], shots: [], fps: null, match: null, bot: null, console: [], errors: [] };
let ok = true;
const check = (label, cond, detail = "") => { summary.checks.push({ label, pass: !!cond, detail }); if (!cond) ok = false; console.error(`${cond ? "PASS" : "FAIL"}  ${label}  ${detail}`); };
const t0 = Date.now();
const secs = () => ((Date.now() - t0) / 1000).toFixed(1);

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
  const prof = await api("POST", "/profiles", { name: "Demo Proof" });
  await api("POST", `/profiles/${prof.id}/select`);
  const club = (await api("GET", "/club-templates")).clubs.find((c) => c.name === "Sydney Riptide");
  // A new career as the harness makes one: the Day 1 draft picked and closed (harness-club.mjs startCareer).
  await startCareer(call, { managerFaceId: 8, slotNumber: 1, managerName: "Rob Bonner", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  // Days pass to the first match day.
  let firstMatchId = null;
  for (let i = 0; i < 200 && firstMatchId == null; i++) {
    const adv = await call("POST", "/calendar/advance", {});
    if (adv.status >= 400) break;
    firstMatchId = adv.data?.matchDay?.matchId ?? (adv.data?.blocked === "pending_match" ? adv.data.pendingMatchId : null);
  }
  check("(set-up) a new career, its draft done, on its first match day", firstMatchId != null, `match ${firstMatchId}`);
  if (firstMatchId == null) throw new Error("no match day");

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "demo-proof-chrome-"));
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
      // Every line of the page and the court, as it comes (console.log in outDir).
      fs.appendFileSync(path.join(outDir, "console.log"), `${((l.at - t0) / 1000).toFixed(1)}s ${l.text}
`);
    }
    if (m.method === "Runtime.exceptionThrown") summary.errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
  };
  // A page that stops drawing never answers a screenshot: every call gives up after 20 s.
  const send = (method, params = {}, ms = 20000) => { const id = nextId++; ws.send(JSON.stringify({ id, method, params }));
    return new Promise((r) => { const t = setTimeout(() => { pending.delete(id); r({}); }, ms); pending.set(id, (m) => { clearTimeout(t); r(m); }); }); };
  const js = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send("Runtime.enable"); await send("Page.enable");
  const [cn, cv] = cookie.split("=");
  await send("Network.enable"); await send("Network.setCookie", { name: cn, value: cv, url: BASE });
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  const shot = async (name, why) => {
    const s = await send("Page.captureScreenshot", { format: "png" });
    if (!s.result) return false;
    fs.writeFileSync(path.join(outDir, name), Buffer.from(s.result.data, "base64"));
    summary.shots.push({ file: name, at: secs(), why });
    console.error(`  shot ${name} (${why})`);
    return true;
  };
  const seen = (re, from = 0) => lines.some((l) => l.at >= from && re.test(l.text));
  const waitFor = async (re, ms, from = 0) => { const t = Date.now(); while (Date.now() - t < ms) { if (seen(re, from)) return true; await sleep(250); } return false; };
  const key = async (k, code, vk, holdMs = 60) => {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
    await sleep(holdMs);
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  };

  // The player's choice, remembered on the court page; the camera at its defaults.
  await send("Page.navigate", { url: BASE + "/" });
  await sleep(2500);
  await js(`localStorage.setItem("vbe-court-control-mode", "${MODE}"); localStorage.removeItem("vbe-court-camera"); localStorage.removeItem("vbe-court-skips")`);
  await send("Page.reload");
  await sleep(2500);
  // The title screen's CONTINUE, then the match day box's Watch Match.
  let watched = false;
  for (let i = 0; i < 80 && !watched; i++) {
    await js(`(() => { const b = [...document.querySelectorAll("button")].find(b => /^ *continue *$/i.test(b.textContent.trim())); if (b) b.click(); })()`);
    await sleep(500);
    watched = await js(`(() => { const b = [...document.querySelectorAll('[data-testid="match-day-box"] button')].find(x => /Watch/i.test(x.textContent)); if (b && !b.disabled) { b.click(); return true; } return false; })()`);
  }
  check("CONTINUE on the title screen, then Watch Match on the match day box", watched, await js(`location.pathname`));
  if (!watched) throw new Error("never reached Watch Match");
  let src = null;
  for (let i = 0; i < 40 && !src; i++) { await sleep(500); src = await js(`document.querySelector("iframe")?.getAttribute("src") ?? null`); }
  const matchId = /matchId=(\d+)/.exec(src ?? "")?.[1] ?? null;
  check(`the court opens in ${MODE === "manual" ? "Manual" : "Auto"} (the remembered choice)`, MODE === "manual" ? /mode=manual/.test(src ?? "") : !/mode=manual/.test(src ?? ""), src);
  const started = await waitFor(/match starts/, 300000);
  check("the court loaded and the match started", started, lines.find((l) => /match starts/.test(l.text))?.text.slice(0, 160) ?? "");
  if (!started) throw new Error("the court never started the match");
  await js(`document.querySelector("iframe")?.focus()`);

  // The keyboard bot (Manual): J, K, L in turn, 120 ms apart, all match.
  let botOn = MODE === "manual", presses = 0;
  const KEYS = [["j", "KeyJ", 74], ["k", "KeyK", 75], ["l", "KeyL", 76]];
  const bot = (async () => {
    let i = 0;
    while (botOn) { const [k, c, v] = KEYS[i++ % 3]; await key(k, c, v, 50); presses++; await sleep(70); }
  })();

  // The frame rate in the TV look: every frame the court's page draws, for FPS_SECONDS.
  const measureFps = async () => {
    await js(`(() => { const w = document.querySelector("iframe").contentWindow; w.__fps = []; let last = 0;
      const f = (t) => { if (last) w.__fps.push(t - last); last = t; if (w.__fpsOn) w.requestAnimationFrame(f); };
      w.__fpsOn = true; w.requestAnimationFrame(f); })()`);
    await sleep(FPS_SECONDS * 1000);
    const d = await js(`(() => { const w = document.querySelector("iframe").contentWindow; w.__fpsOn = false; return w.__fps; })()`);
    const sorted = [...d].sort((a, b) => a - b);
    const total = d.reduce((a, b) => a + b, 0);
    const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
    return { seconds: +(total / 1000).toFixed(1), frames: d.length, fps: +(d.length / (total / 1000)).toFixed(1),
      p50ms: +pct(0.5).toFixed(1), p95ms: +pct(0.95).toFixed(1), p99ms: +pct(0.99).toFixed(1), worstMs: +sorted[sorted.length - 1].toFixed(1),
      over33ms: d.filter((x) => x > 33.4).length, over50ms: d.filter((x) => x > 50).length,
      shots: lines.filter((l) => /\[Director\] /.test(l.text)).length };
  };

  // The moments, from the court's own lines.
  const serveRe = MODE === "manual" ? /\[Played\] serve by/ : /\[Point\] decided/;
  const pointRe = MODE === "manual" ? /\[Played\] point to/ : /\[Point\] awarded/;
  let look = FIRST, done = new Set(), cursor = lines.length, pending2 = [], switched = false, fpsDone = FPS_SECONDS === 0, finished = false;
  let lastServe = 0;
  const deadline = Date.now() + 60 * 60 * 1000;
  const lookDone = () => MOMENTS.every((m) => done.has(`${look}-${m}`));
  while (Date.now() < deadline) {
    // The court logs every serve, point and shot: three minutes of silence means it has stopped.
    if (Date.now() - lines[lines.length - 1].at > 180000) {
      await shot(`${MODE}-stopped.png`, "the court went silent");
      throw new Error(`the court has logged nothing for 3 minutes; its last line: ${lines[lines.length - 1].text.slice(0, 200)}`);
    }
    for (; cursor < lines.length; cursor++) {
      const l = lines[cursor];
      if (serveRe.test(l.text)) {
        lastServe = l.at;
        if (!done.has(`${look}-serve`)) pending2.push({ at: l.at + 200, name: `${look}-serve` });
        if (!done.has(`${look}-rally`)) pending2.push({ at: l.at + 1600, name: `${look}-rally`, serve: l.at });
      }
      if (/\[Director\] cutaway: the scorer/.test(l.text) && !done.has(`${look}-between`)) pending2.push({ at: l.at + 600, name: `${look}-between` });
      if (/\[Director\] cutaway: replay/.test(l.text) && !done.has(`${look}-replay`)) pending2.push({ at: l.at + 800, name: `${look}-replay` });
      if (/\[Director\] cutaway: the winners' celebration/.test(l.text)) pending2.push({ at: l.at + 2000, name: `${look}-result-celebration`, end: true });
      if (/\[Match moments\] celebration/.test(l.text)) pending2.push({ at: l.at + 3000, name: `${look}-result-box`, end: true, last: true });
    }
    const now = Date.now();
    for (const p of pending2.filter((x) => x.at <= now)) {
      pending2.splice(pending2.indexOf(p), 1);
      if (done.has(p.name)) continue;
      // The rally picture only while that point is still being played.
      if (p.serve && seen(pointRe, p.serve)) continue;
      if (await shot(`${MODE}-${p.name}.png`, p.name)) done.add(p.name);
      if (p.last) finished = true;
    }
    if (finished) break;
    if (!fpsDone && look === "TV" && done.has("TV-serve")) {
      summary.fps = await measureFps();
      fpsDone = true;
      console.error(`  fps ${JSON.stringify(summary.fps)}`);
      continue;
    }
    if (!switched && lookDone() && fpsDone) {
      const before = Date.now();
      await key("v", "KeyV", 86, 80);
      const ok2 = await waitFor(new RegExp(`\\[Camera\\] ${SECOND} look`), 5000, before);
      check(`V switches the court to the ${SECOND} look`, ok2, lines.find((l) => l.at >= before && /\[Camera\]/.test(l.text))?.text ?? "");
      look = SECOND; switched = true; pending2 = [];
    }
    await sleep(100);
  }
  botOn = false; await bot;
  summary.bot = MODE === "manual" ? { presses } : null;

  for (const lk of [FIRST, SECOND]) for (const m of MOMENTS)
    check(`${lk} look: a picture at the ${m}`, done.has(`${lk}-${m}`), summary.shots.find((s) => s.why === `${lk}-${m}`)?.file ?? "none");
  check(`${SECOND} look: the winners' celebration and the result box`, done.has(`${SECOND}-result-celebration`) && done.has(`${SECOND}-result-box`));

  // The match on the server: recorded as played to its end.
  let m = null;
  for (let i = 0; i < 40; i++) { m = (await api("GET", "/matches")).find?.((x) => String(x.id) === String(matchId)); if (m?.status === "completed") break; await sleep(1500); }
  summary.match = m && { id: m.id, status: m.status, score: `${m.homeScore}-${m.awayScore}`, sets: m.sets, home: m.homeTeamName, away: m.awayTeamName };
  check("the match was played to its end and recorded", m?.status === "completed", JSON.stringify(summary.match));
  if (MODE === "manual") {
    const played = lines.filter((l) => /\[Played\] a played match from this serve/.test(l.text)).length;
    const touches = lines.filter((l) => /\[Played\] (dig|set|spike|soft|serve) by/i.test(l.text)).length;
    const points = lines.filter((l) => pointRe.test(l.text)).length;
    summary.bot.playedServes = played; summary.bot.touches = touches; summary.bot.points = points;
    check("every point was a played point (the new engine), with the bot's presses reaching it", played > 0 && touches > points, `${played} played serves, ${points} points, ${touches} serves and touches, ${presses} key presses`);
  } else {
    check("in Auto no played-match code runs", !lines.some((l) => /\[Played\]/.test(l.text)));
  }
  if (FPS_SECONDS > 0) check(`the frame rate measured for ${FPS_SECONDS} s in the TV look`, summary.fps && summary.fps.frames > 0, JSON.stringify(summary.fps));
  summary.console = lines.filter((l) => /\[Camera\]|\[Match moments\]|\[Between points\]|CourtBridge|match starts|\[Played\] (point|match over)/.test(l.text)).map((l) => `${((l.at - t0) / 1000).toFixed(1)}s ${l.text.slice(0, 220)}`);
  check("no page errors", summary.errors.length === 0, summary.errors.slice(0, 2).join(" | "));
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
console.log(JSON.stringify({ mode: MODE, ok, match: summary.match, fps: summary.fps, checks: summary.checks.map((c) => `${c.pass ? "PASS" : "FAIL"} ${c.label}`) }));
process.exit(ok ? 0 : 1);
