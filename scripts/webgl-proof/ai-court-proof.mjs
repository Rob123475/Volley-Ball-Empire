/**
 * Merge brief 6 Oct, step 4: the 3D court shows try's AI club squads and
 * pictures correctly, in Auto and in Manual (headless Chromium, real GPU with
 * --gpu), on the joined build.
 *
 * Boots the built api-server in production mode on a COPY of the starter DB,
 * makes a new Sydney Riptide career, and finds its first match against an AI
 * club. Then, as try's Player Market allows (U-6), buys one of that club's two
 * players, so the club's squad is not the starter DB's any more: it plays its
 * next player. The court must show the club as it is now:
 *   - the match-state the court reads names the AI club's current pair (not
 *     the player bought from it), each of them on the club's squad in the
 *     Player Market, each with her picture (the file is served);
 *   - each one's skin tone is her picture's (Rob's AI senior pictures were
 *     matched to the players' skin tones: scripts/portraits/ai-senior-cards.json);
 *   - the court's own loader log puts exactly those two, with those skin tones,
 *     on the away side;
 *   - in the mode chosen on the court page (remembered, as Rob plays it):
 *     Manual: the court says it started in Manual; Auto: no manual code runs,
 *     and with --until-finished the match is played to its end;
 *   - no page errors.
 *
 * Usage: node scripts/webgl-proof/ai-court-proof.mjs <outDir> --mode manual|auto [--until-finished 900] [--gpu]
 * Prints one JSON summary line; exits 1 if a check fails.
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
const MODE = opt("--mode", "auto") === "manual" ? "manual" : "auto";
const UNTIL_FINISHED = Number(opt("--until-finished", "0"));
const GPU = args.includes("--gpu");
const W = 1280, H = 720;
fs.mkdirSync(outDir, { recursive: true });

const ELECTRON = path.join(REPO, "node_modules/electron/dist/electron.exe");
const SERVER = path.join(REPO, "artifacts/api-server/dist/index.mjs");
const PUBLIC_DIR = path.join(REPO, "artifacts/api-server/dist/public");
const PORT = 4223, BASE = `http://localhost:${PORT}`;
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const CDP = 9351;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CARDS = new Map(JSON.parse(fs.readFileSync(path.join(REPO, "scripts/portraits/ai-senior-cards.json"), "utf8")).players.map((p) => [p.card, p]));

const work = fs.mkdtempSync(path.join(os.tmpdir(), "ai-court-"));
const dbFile = path.join(work, "save.sqlite");
fs.copyFileSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), dbFile);
const q = (sql, ...a) => { const d = new DatabaseSync(dbFile, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
const w = (sql, ...a) => { const d = new DatabaseSync(dbFile); try { return d.prepare(sql).run(...a); } finally { d.close(); } };
const out = fs.openSync(path.join(outDir, "server.log"), "w");
const server = fork(SERVER, [], {
  execPath: ELECTRON,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PUBLIC_DIR, DB_PATH: dbFile, PORT: String(PORT), SESSION_SECRET: "ai-court" },
  stdio: ["ignore", out, out, "ipc"],
});
let chrome = null;
const summary = { mode: MODE, checks: [], loader: [], console: [], errors: [] };
let ok = true;
const check = (label, cond, detail = "") => { summary.checks.push({ label, pass: !!cond, detail }); if (!cond) ok = false; console.error(`${cond ? "PASS" : "FAIL"}  ${label}  ${detail}`); };

try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${BASE}/api/healthz`)).ok) break; } catch { /* booting */ } await sleep(500); }
  let cookie = "";
  const api = async (m, p, b) => {
    const r = await fetch(BASE + "/api" + p, { method: m, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    const t = await r.text(); let data; try { data = JSON.parse(t); } catch { data = t; }
    return { status: r.status, data };
  };
  const prof = (await api("POST", "/profiles", { name: "AI Court" })).data;
  await api("POST", `/profiles/${prof.id}/select`);
  const club = (await api("GET", "/club-templates")).data.clubs.find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", { slotNumber: 1, managerName: "Rob Bonner", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  const team = (await api("GET", "/team")).data;
  const cid = q(`SELECT id FROM career_saves WHERE team_id = ?`, team.id)[0].id;
  const state = async (matchId) => (await api("GET", `/unity/match-state?careerSaveId=${cid}&matchId=${matchId}`)).data;
  const away = (s) => (s?.players ?? []).slice(2);

  // The first match against an AI club (the court is opened from "Next match").
  let matchId = null, ms = null;
  for (let i = 0; i < 12; i++) {
    const nm = await api("POST", "/calendar/next-match");
    matchId = nm.data?.matchDay?.matchId ?? null;
    if (matchId == null) break;
    ms = await state(matchId);
    if (away(ms).length === 2 && away(ms).every((p) => p.source === "pool")) break;
    await api("POST", `/matches/${matchId}/simulate`, {});
    await api("POST", "/calendar/dismiss-match", {});
    matchId = null;
  }
  check("(set-up) a match against an AI club", matchId != null, `match ${matchId}: ${ms?.players?.[0]?.team} v ${away(ms)[0]?.team}`);
  const awayClub = away(ms)[0]?.team;
  const pairBefore = away(ms).map((p) => p.name);

  // Try's Player Market: buy one of the AI club's pair (it then plays its next).
  w(`UPDATE teams SET budget = 5000000 WHERE id = ?`, team.id);
  const market0 = (await api("GET", "/players/market-all")).data;
  const squad0 = market0.filter((p) => p.status === "ai_club" && p.currentTeamName === awayClub);
  const target = squad0.find((p) => p.name === pairBefore[0]);
  let bought = null;
  if (target) {
    for (const p of (await api("GET", "/players")).data.filter((p) => p.squadRole === "interchange")) await api("POST", `/players/${p.id}/release`, {});
    const wage = q(`SELECT salary FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, target.id)[0].salary;
    bought = await api("POST", "/contracts", { playerId: target.id, salary: wage, bonusPerWin: 0, squadRole: "interchange", length: "1s", confirm: true });
  }
  check(`(set-up) bought ${pairBefore[0]} from ${awayClub} on the Player Market`, bought?.status === 201,
    `${awayClub} had ${squad0.length} players: ${squad0.map((p) => p.name).join(", ")}; HTTP ${bought?.status} ${bought?.data?.error ?? ""}`);

  ms = await state(matchId);
  const pair = away(ms);
  const market = (await api("GET", "/players/market-all")).data;
  const squad = market.filter((p) => p.status === "ai_club" && p.currentTeamName === awayClub);
  summary.awayPair = pair.map((p) => ({ name: p.name, team: p.team, skinTone: p.skinTone, poolPlayerId: p.poolPlayerId }));
  summary.awaySquadNow = squad.map((p) => ({ name: p.name, imageUrl: p.imageUrl }));
  check("the court's match-state plays the AI club as it is now: not the player bought from it",
    pair.length === 2 && !pair.some((p) => p.name === pairBefore[0]) && pair.every((p) => p.team === awayClub),
    `before: ${pairBefore.join(" & ")}; now: ${pair.map((p) => p.name).join(" & ")}`);
  check("both are on the club's squad in the Player Market", pair.every((p) => squad.some((s) => s.name === p.name)), squad.map((s) => s.name).join(", "));
  const pics = [];
  for (const p of pair) {
    const card = squad.find((s) => s.name === p.name)?.imageUrl ?? null;
    const served = card ? (await fetch(BASE + card)).status : null;
    const cardRow = card ? CARDS.get(card) : null;
    pics.push({ name: p.name, card, served, skinTone: p.skinTone, pictureBand: cardRow?.imageBand ?? null, rob: cardRow?.kind ?? null });
  }
  summary.pictures = pics;
  check("each has her picture, and the file is served", pics.every((x) => x.card && x.served === 200), pics.map((x) => `${x.name}: ${x.card} (${x.served})`).join(" | "));
  check("each one's skin tone on the court is her picture's", pics.every((x) => x.skinTone && (x.pictureBand == null || x.pictureBand === x.skinTone)),
    pics.map((x) => `${x.name}: court '${x.skinTone}', picture '${x.pictureBand ?? "(not one of the 120 AI cards)"}'`).join(" | "));

  // The court, opened as Rob opens it: the remembered choice, Next match, Watch Match.
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ai-court-chrome-"));
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
    if (m.method === "Runtime.consoleAPICalled") lines.push((m.params.args ?? []).map((a) => a.value ?? a.description ?? "").join(" "));
    if (m.method === "Runtime.exceptionThrown") summary.errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
  };
  const send = (method, params = {}) => { const id = nextId++; ws.send(JSON.stringify({ id, method, params })); return new Promise((r) => pending.set(id, r)); };
  const js = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send("Runtime.enable"); await send("Page.enable");
  const [cn, cv] = cookie.split("=");
  await send("Network.enable"); await send("Network.setCookie", { name: cn, value: cv, url: BASE });
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  const shot = async (name) => { const s = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(outDir, name), Buffer.from(s.result.data, "base64")); };
  const waitFor = async (re, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (lines.some((l) => re.test(l))) return true; await sleep(250); } return false; };

  await send("Page.navigate", { url: BASE + "/" });
  await sleep(2500);
  await js(`localStorage.setItem("vbe-court-control-mode", "${MODE}")`);
  await send("Page.reload");
  await sleep(2500);
  for (let i = 0; i < 40 && !(await js(`[...document.querySelectorAll("button")].some(b => /Next match/.test(b.textContent))`)); i++) {
    await js(`[...document.querySelectorAll("button")].find(b => /^ *continue *$/i.test(b.textContent.trim()))?.click()`);
    await sleep(400);
  }
  await js(`[...document.querySelectorAll("button")].find(x => /Next match/.test(x.textContent))?.click()`);
  let watched = false;
  for (let i = 0; i < 60 && !watched; i++) {
    await sleep(500);
    watched = await js(`(() => { const b = [...document.querySelectorAll('[data-testid="match-day-box"] button')].find(x => /Watch/i.test(x.textContent)); if (b && !b.disabled) { b.click(); return true; } return false; })()`);
  }
  check("Next match, then Watch Match", watched);
  let src = null;
  for (let i = 0; i < 40 && !src; i++) { await sleep(500); src = await js(`document.querySelector("iframe")?.getAttribute("src") ?? null`); }
  check(`the court opens on match ${matchId}, in ${MODE === "manual" ? "Manual" : "Auto"} (the remembered choice)`,
    new RegExp(`matchId=${matchId}\\b`).test(src ?? "") && (MODE === "manual" ? /mode=manual/.test(src ?? "") : !/mode=manual/.test(src ?? "")), src);
  const label = await js(`document.querySelector('[data-testid="button-control-mode"]')?.textContent ?? ""`);
  check("the court page's button says so", MODE === "manual" ? /Manual: you play/.test(label) : /Auto: AI plays/.test(label), label);

  const loaded = await waitFor(/\[UnityMatchDataLoader\] \S+ <- .*\(away\)/, 240000);
  await waitFor(/match starts/, 60000);
  await sleep(1500);
  const loader = lines.filter((l) => /\[UnityMatchDataLoader\] \S+ <- /.test(l)).map((l) => {
    const m = /<- (.+?) \| team (.+?) \((home|away)\) \| skinTone (.+?) \|/.exec(l);
    return m ? { name: m[1], team: m[2], side: m[3], skinTone: m[4].replace(/^'|'$/g, "") } : { raw: l.slice(0, 200) };
  });
  summary.loader = loader;
  const awayLoaded = loader.filter((x) => x.side === "away");
  check("the court's loader puts that pair on the away side, with those skin tones", loaded && awayLoaded.length === 2 &&
    pair.every((p) => awayLoaded.some((x) => x.name === p.name && x.team === awayClub && x.skinTone.includes(p.skinTone))),
    awayLoaded.map((x) => `${x.name} (${x.team}) skin ${x.skinTone}`).join(" | "));
  check("and Rob's pair on the home side", loader.filter((x) => x.side === "home").length === 2, loader.filter((x) => x.side === "home").map((x) => x.name).join(" & "));
  if (MODE === "manual") {
    check("the court started in Manual, from the page", await waitFor(/\[Manual\] mode Manual \(page\)/, 30000), lines.find((l) => /\[Manual\] mode/.test(l)) ?? "");
  } else {
    check("in Auto no manual code runs", !lines.some((l) => /\[Manual\]/.test(l)));
  }
  await sleep(4000);
  await shot(`ai-court-${MODE}-start.png`);
  await sleep(20000);
  await shot(`ai-court-${MODE}-play.png`);

  if (UNTIL_FINISHED > 0) {
    const t0 = Date.now();
    let m = null;
    while (Date.now() - t0 < UNTIL_FINISHED * 1000) {
      m = (await api("GET", "/matches")).data.find((x) => x.id === matchId);
      if (m?.status === "completed") break;
      await sleep(5000);
    }
    await sleep(3000);
    await shot(`ai-court-${MODE}-end.png`);
    summary.match = m && { status: m.status, score: `${m.homeScore}-${m.awayScore}`, sets: m.sets, away: m.awayTeamName };
    check(`the match was played to its end in ${MODE === "manual" ? "Manual" : "Auto"}`, m?.status === "completed", JSON.stringify(summary.match));
    if (MODE === "auto") check("and no manual code ran in it", !lines.some((l) => /\[Manual\]/.test(l)));
  }
  summary.console = lines.filter((l) => /\[Manual\]|CourtBridge|match starts|UnityMatchDataLoader\] (team names|point chance)/.test(l)).slice(0, 30);
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
console.log(JSON.stringify({ mode: MODE, ok, checks: summary.checks.map((c) => `${c.pass ? "PASS" : "FAIL"} ${c.label}`) }));
process.exit(ok ? 0 : 1);
