/**
 * Pictures brief 10 Oct, step 1: do the senior cards still lay out right with
 * Rob's cropped national-kit pictures (the name/flag banner cut off, so each
 * picture is shorter than the old 2:3; the width is unchanged)?
 *
 * Boots the built api-server in production mode (it serves the built UI) on a
 * COPY of the starter DB, makes a new Sydney Riptide career and signs headless
 * Chrome in. At 1280x720, 1440x900 and 1920x1080 it measures every card whose
 * picture is a senior's, on:
 *   team       the Team page (her squad: national-kit seniors)
 *   market     the Player Market's senior list
 *   ai-clubs   the Player Market's "At AI Clubs" list (the AI seniors' pictures)
 *   lightbox   the pop-up a card opens when clicked (the picture, whole)
 *   contracts  the Contracts page's round avatars
 * For each card: the frame, the picture as drawn, and how far the picture's
 * bottom is from the frame's bottom ("gap": positive = the blurred fill shows
 * under her, negative = the frame cuts the picture off). Screenshots of one
 * card per page and size, and each page whole.
 *
 * Usage: node scripts/webgl-proof/senior-cards-proof.mjs <outDir>
 * Prints one JSON summary line (also summary.json); exits 1 if a page had no card.
 */
import { fork, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const REPO = path.resolve(import.meta.dirname, "..", "..");
const outDir = path.resolve(process.argv[2] ?? "senior-cards-proof");
fs.mkdirSync(outDir, { recursive: true });
const SIZES = [[1280, 720], [1440, 900], [1920, 1080]];

const ELECTRON = path.join(REPO, "node_modules/electron/dist/electron.exe");
const SERVER = path.join(REPO, "artifacts/api-server/dist/index.mjs");
const PUBLIC_DIR = path.join(REPO, "artifacts/api-server/dist/public");
const PORT = 4211, BASE = `http://localhost:${PORT}`;
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const CDP = 9343;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const work = fs.mkdtempSync(path.join(os.tmpdir(), "senior-cards-"));
const dbFile = path.join(work, "save.sqlite");
fs.copyFileSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), dbFile);
const out = fs.openSync(path.join(work, "server.log"), "w");
const server = fork(SERVER, [], {
  execPath: ELECTRON,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PUBLIC_DIR, DB_PATH: dbFile, PORT: String(PORT), SESSION_SECRET: "senior-cards" },
  stdio: ["ignore", out, out, "ipc"],
});
let chrome = null;
const summary = { pages: {}, lightbox: {}, shots: [], errors: [] };
let ok = true;

try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${BASE}/api/healthz`)).ok) break; } catch { /* booting */ } await sleep(500); }
  let cookie = "";
  const api = async (m, p, b) => {
    const r = await fetch(BASE + "/api" + p, { method: m, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    const t = await r.text(); try { return JSON.parse(t); } catch { return t; }
  };
  const prof = await api("POST", "/profiles", { name: "Senior Cards" });
  await api("POST", `/profiles/${prof.id}/select`);
  const club = (await api("GET", "/club-templates")).clubs.find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", { slotNumber: 1, managerName: "Rob Bonner", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  const d = new DatabaseSync(dbFile, { readOnly: true });
  summary.squad = d.prepare(`SELECT p.name, p.image_url AS img FROM career_player_state s JOIN players p ON p.id = s.player_id
    JOIN teams t ON t.id = s.team_id WHERE t.name = 'Sydney Riptide'`).all().map((r) => ({ ...r }));
  d.close();

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "senior-cards-chrome-"));
  chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--window-size=1920,1080", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore" });
  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    try { wsUrl = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch { /* up soon */ }
    if (!wsUrl) await sleep(500);
  }
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let nextId = 1; const pending = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => { const id = nextId++; ws.send(JSON.stringify({ id, method, params })); return new Promise((r) => pending.set(id, r)); };
  const js = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send("Runtime.enable"); await send("Page.enable");
  const [cn, cv] = cookie.split("=");
  await send("Network.enable"); await send("Network.setCookie", { name: cn, value: cv, url: BASE });
  const open = async (route, ready) => {
    await send("Page.navigate", { url: BASE + route });
    for (let i = 0; i < 80; i++) {
      if (await js(`!!(${ready})`)) return true;
      await js(`[...document.querySelectorAll("button")].find(b => /^ *continue *$/i.test(b.textContent.trim()))?.click()`);
      await sleep(400);
    }
    return false;
  };
  const shot = async (file, clip) => {
    const s = await send("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
    fs.writeFileSync(path.join(outDir, file), Buffer.from(s.result.data, "base64"));
    summary.shots.push(file);
  };
  /** Every portrait frame (PlayerPortrait's zoom button) whose picture matches `re`: frame, picture, gap. */
  const measure = (re) => js(`(async () => {
    const frames = [...document.querySelectorAll('[role="button"][aria-label^="View "]')]
      .filter(f => { const i = f.querySelector('img'); return i && ${re}.test(i.getAttribute('src') ?? ''); });
    for (const f of frames) { const i = f.querySelector('img'); if (!i.complete) await new Promise(r => { i.onload = r; i.onerror = r; setTimeout(r, 4000); }); }
    // The picture as drawn: with object-fit cover the element is the column and
    // the picture is scaled to fill it (top anchored), so its own crop counts.
    return frames.map(f => {
      const i = f.querySelector('img'), a = f.getBoundingClientRect(), b = i.getBoundingClientRect();
      const nw = i.naturalWidth, nh = i.naturalHeight, fit = getComputedStyle(i).objectFit;
      const s = fit === 'cover' ? Math.max(b.width / nw, b.height / nh) : b.width / nw;
      const ch = nh * s, cw = nw * s;
      const shownBottom = b.top + Math.min(ch, b.height);
      const gap = a.bottom - shownBottom;
      const cut = Math.max(0, ch - (Math.min(a.bottom, b.bottom) - b.top));
      return { name: i.getAttribute('alt'), src: i.getAttribute('src'), natural: [nw, nh], fit,
        frame: [Math.round(a.width), Math.round(a.height)], column: [Math.round(b.width), Math.round(b.height)],
        gap: Math.round(gap), cutBottomPct: Math.round(100 * cut / ch), sideCropPct: Math.round(100 * Math.max(0, cw - b.width) / 2 / cw),
        headAtTop: Math.round(b.top - a.top) === 0 };
    });
  })()`);
  const stats = (cards) => {
    const g = cards.map((c) => c.gap), cut = cards.map((c) => c.cutBottomPct), side = cards.map((c) => c.sideCropPct);
    return { cards: cards.length, gapMin: Math.min(...g), gapMax: Math.max(...g),
      showsFillUnder: cards.filter((c) => c.gap > 0).length,
      cutBottomPct: [Math.min(...cut), Math.max(...cut)], sideCropPct: [Math.min(...side), Math.max(...side)],
      headAtTop: cards.every((c) => c.headAtTop),
      frames: [...new Set(cards.map((c) => c.frame.join("x")))], naturals: [...new Set(cards.map((c) => c.natural.join("x")))].slice(0, 6) };
  };
  const firstCardShot = async (re, file) => {
    const r = await js(`(() => {
      const f = [...document.querySelectorAll('[role="button"][aria-label^="View "]')].find(f => ${re}.test(f.querySelector('img')?.getAttribute('src') ?? ''));
      let c = f; while (c && !(c.className && String(c.className).includes('rounded') && c.getBoundingClientRect().height > f.getBoundingClientRect().height + 40)) c = c.parentElement;
      (c ?? f).scrollIntoView({ block: "center" });
      const r = (c ?? f).getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    })()`);
    if (!r) return;
    await sleep(800);
    await shot(file, { x: Math.max(0, r.x - 6), y: Math.max(0, r.y - 6), width: r.w + 12, height: r.h + 12 });
  };
  const SENIOR = String(/\/images\/players\/seniors\/player_senior_/);
  const AI = String(/\/images\/players\/seniors\/ai\//);

  for (const [W, H] of SIZES) {
    await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    const tag = `${W}x${H}`;

    await open("/team", `document.querySelectorAll('[role="button"][aria-label^="View "] img').length >= 2`);
    await sleep(1500);
    const team = await measure(SENIOR);
    summary.pages[`team ${tag}`] = { ...stats(team), sample: team.slice(0, 3) };
    await firstCardShot(SENIOR, `team-card-${tag}.png`);
    await js(`window.scrollTo(0, 0)`); await shot(`team-page-${tag}.png`);

    // The lightbox: click her card; the picture must be whole inside the window.
    await js(`[...document.querySelectorAll('[role="button"][aria-label^="View "]')].find(f => ${SENIOR}.test(f.querySelector('img')?.getAttribute('src') ?? ''))?.click()`);
    await sleep(1200);
    const lb = await js(`(() => {
      const imgs = [...document.querySelectorAll('img')].filter(i => getComputedStyle(i).objectFit === 'contain' && ${SENIOR}.test(i.getAttribute('src') ?? ''));
      const i = imgs[imgs.length - 1]; if (!i) return null;
      const b = i.getBoundingClientRect();
      return { src: i.getAttribute('src'), natural: [i.naturalWidth, i.naturalHeight], drawn: [Math.round(b.width), Math.round(b.height)],
        inside: b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight,
        ratioKept: Math.abs(b.width / b.height - i.naturalWidth / i.naturalHeight) < 0.02 };
    })()`);
    summary.lightbox[tag] = lb;
    if (!lb) { ok = false; summary.errors.push(`no lightbox at ${tag}`); }
    await shot(`lightbox-${tag}.png`);
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await sleep(600);

    await open("/players", `document.querySelectorAll('[role="button"][aria-label^="View "] img').length >= 3`);
    await sleep(2000);
    const market = await measure(SENIOR);
    summary.pages[`market ${tag}`] = { ...stats(market), sample: market.slice(0, 3) };
    await firstCardShot(SENIOR, `market-card-${tag}.png`);
    await js(`window.scrollTo(0, 0)`); await shot(`market-page-${tag}.png`);

    await js(`[...document.querySelectorAll("button")].find(b => /At AI Clubs/.test(b.textContent))?.click()`);
    await sleep(3000);
    const ai = await measure(AI);
    summary.pages[`ai-clubs ${tag}`] = { ...stats(ai), sample: ai.slice(0, 3) };
    await firstCardShot(AI, `ai-clubs-card-${tag}.png`);

    await open("/contracts", `document.querySelectorAll('img.rounded-full').length >= 1`);
    await sleep(1200);
    const av = await js(`[...document.querySelectorAll('img.rounded-full')].filter(i => ${SENIOR}.test(i.getAttribute('src') ?? '')).map(i => ({ name: i.alt, w: i.width, h: i.height, fit: getComputedStyle(i).objectFit, pos: getComputedStyle(i).objectPosition }))`);
    summary.pages[`contracts ${tag}`] = { avatars: av?.length ?? 0, sample: (av ?? []).slice(0, 2) };
    await shot(`contracts-page-${tag}.png`);

    for (const k of [`team ${tag}`, `market ${tag}`, `ai-clubs ${tag}`]) if (!summary.pages[k].cards) { ok = false; summary.errors.push(`no cards on ${k}`); }
  }
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
console.log(JSON.stringify({ ok, pages: Object.fromEntries(Object.entries(summary.pages).map(([k, v]) => [k, { ...v, sample: undefined }])), lightbox: summary.lightbox, errors: summary.errors }));
process.exit(ok ? 0 : 1);
