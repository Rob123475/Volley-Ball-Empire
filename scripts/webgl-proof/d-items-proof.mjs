/**
 * Overnight brief 1 Oct, section D: headless proof of the small on-screen items.
 *
 * Boots the built api-server in production mode (it serves the built UI) on a
 * COPY of the starter DB (or of Rob's 1 Oct backup with --rob), signs headless
 * Chrome in, and runs the scenarios named on the command line. Each scenario
 * measures what the page shows and keeps screenshots in <outDir>.
 *
 *   scout-report   N-35: a mission's report is a box in the middle of the
 *                  screen with Confirm, for a blank and for finds
 *
 * Usage: node scripts/webgl-proof/d-items-proof.mjs <outDir> <scenario> [...] [--size 1280x720]
 * Prints one JSON summary line; exits 1 if any scenario's checks fail.
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
const scenarios = args.slice(1).filter((a, i, all) => !a.startsWith("--") && !(all[i - 1] ?? "").startsWith("--"));
const [W, H] = opt("--size", "1280x720").split("x").map(Number);
fs.mkdirSync(outDir, { recursive: true });

const ELECTRON = path.join(REPO, "node_modules/electron/dist/electron.exe");
const SERVER = path.join(REPO, "artifacts/api-server/dist/index.mjs");
const PUBLIC_DIR = path.join(REPO, "artifacts/api-server/dist/public");
const PORT = 4205, BASE = `http://localhost:${PORT}`;
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const CDP = 9337;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const work = fs.mkdtempSync(path.join(os.tmpdir(), "d-items-"));
const dbFile = path.join(work, "save.sqlite");
fs.copyFileSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), dbFile);
const out = fs.openSync(path.join(outDir, "server.log"), "w");
const server = fork(SERVER, [], {
  execPath: ELECTRON,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PUBLIC_DIR, DB_PATH: dbFile, PORT: String(PORT), SESSION_SECRET: "d-items" },
  stdio: ["ignore", out, out, "ipc"],
});
let chrome = null;
const summary = { scenarios: {}, errors: [] };
let ok = true;
const check = (sc, label, cond, detail = "") => {
  (summary.scenarios[sc] ??= []).push({ label, pass: !!cond, detail });
  if (!cond) ok = false;
};
const q = (sql, ...a) => { const d = new DatabaseSync(dbFile, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
const w = (sql, ...a) => { const d = new DatabaseSync(dbFile); try { return d.prepare(sql).run(...a); } finally { d.close(); } };

try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${BASE}/api/healthz`)).ok) break; } catch { /* booting */ } await sleep(500); }
  let cookie = "";
  const api = async (m, p, b) => {
    const r = await fetch(BASE + "/api" + p, { method: m, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    const t = await r.text(); try { return JSON.parse(t); } catch { return t; }
  };
  const prof = await api("POST", "/profiles", { name: "D Items" });
  await api("POST", `/profiles/${prof.id}/select`);
  const club = (await api("GET", "/club-templates")).clubs.find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", { slotNumber: 1, managerName: "Rob Bonner", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  const team = await api("GET", "/team");

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "d-items-chrome-"));
  chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    `--window-size=${W},${H}`, "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore" });
  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    try { wsUrl = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch { /* up soon */ }
    if (!wsUrl) await sleep(500);
  }
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let nextId = 1; const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === "Runtime.exceptionThrown") summary.errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
  };
  const send = (method, params = {}) => { const id = nextId++; ws.send(JSON.stringify({ id, method, params })); return new Promise((r) => pending.set(id, r)); };
  const js = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send("Runtime.enable"); await send("Page.enable");
  const [cn, cv] = cookie.split("=");
  await send("Network.enable"); await send("Network.setCookie", { name: cn, value: cv, url: BASE });
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  const shot = async (name) => { const s = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(outDir, name), Buffer.from(s.result.data, "base64")); };
  /** Open a route, pressing the game's splash CONTINUE, and wait for `ready` (a JS expression). */
  const open = async (route, ready) => {
    await send("Page.navigate", { url: BASE + route });
    for (let i = 0; i < 80; i++) {
      if (await js(`!!(${ready})`)) return true;
      await js(`[...document.querySelectorAll("button")].find(b => /^ *continue *$/i.test(b.textContent.trim()))?.click()`);
      await sleep(400);
    }
    return false;
  };
  const clickText = (re) => js(`(() => { const b = [...document.querySelectorAll("button")].find(x => ${re}.test(x.textContent)); if (b) { b.click(); return true; } return false; })()`);

  // ── N-35: the scout's report ──────────────────────────────────────────────
  if (scenarios.includes("scout-report")) {
    const sc = "scout-report";
    w(`UPDATE teams SET budget = 5000000 WHERE id = ?`, team.id);
    const offer = (await api("GET", "/staff/market?role=scout")).find((m) => /scout/i.test(m.role));
    await api("POST", "/staff", { staffId: offer.id, length: "2s" });
    const scout = (await api("GET", "/staff")).find((s) => /^scout$/i.test(s.role));
    const regions = (await api("GET", "/continental-scouting/regions")).map((r) => r.id ?? r.region?.id).filter(Boolean);
    const seen = { blank: null, found: null };
    for (let attempt = 0; attempt < 40 && (!seen.blank || !seen.found); attempt++) {
      const region = regions[attempt % regions.length];
      const st = await api("POST", "/continental-scouting/start", { region, durationMonths: 1, staffId: scout.id });
      if (!st?.id) continue;
      await api("POST", `/continental-scouting/missions/${st.id}/dev-complete`);
      if (!(await open("/continental-scouting", `[...document.querySelectorAll("button")].some(b => /Collect/i.test(b.textContent))`))) { check(sc, "the page shows Collect", false); break; }
      await clickText("/Collect/i");
      let box = null;
      for (let i = 0; i < 30 && !box; i++) {
        await sleep(300);   // the box's opening animation
        box = await js(`(() => { const b = document.querySelector('[data-testid="scout-report-box"]'); if (!b) return null; const r = b.getBoundingClientRect();
          return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height, vw: document.documentElement.clientWidth, vh: document.documentElement.clientHeight,
            title: b.querySelector("h2")?.textContent, text: b.innerText,
            confirm: !!b.querySelector('[data-testid="button-confirm-scout-report"]'), toast: !!document.querySelector('[data-state="open"][role="status"]') }; })()`);
        if (!box) await sleep(250);
      }
      if (!box) { check(sc, "a report box appeared", false); break; }
      const kind = /No one recommended/.test(box.title ?? "") ? "blank" : "found";
      if (seen[kind]) continue;
      seen[kind] = box;
      await shot(`n35-scout-report-${kind}.png`);
      await js(`document.querySelector('[data-testid="button-confirm-scout-report"]').click()`);
      await sleep(500);
      box.closedByConfirm = !(await js(`!!document.querySelector('[data-testid="scout-report-box"]')`));
    }
    for (const kind of ["blank", "found"]) {
      const b = seen[kind];
      check(sc, `${kind === "blank" ? "nobody found" : "players found"}: the report is a box in the middle of the screen, with Confirm, not a corner toast`,
        b && Math.abs(b.cx - b.vw / 2) < 8 && Math.abs(b.cy - b.vh / 2) < 40 && b.confirm && !b.toast && b.closedByConfirm,
        b ? `centre (${Math.round(b.cx)}, ${Math.round(b.cy)}) of the ${b.vw}x${b.vh} view; "${b.title}"; Confirm closes it: ${b.closedByConfirm}` : "not seen in 40 missions");
    }
  }
  // ── N-37: loan dates in the game's style ──────────────────────────────────
  if (scenarios.includes("loan-dates")) {
    const sc = "loan-dates";
    let loans = null;
    for (let i = 0; i < 20 && !(loans?.available?.length > 0); i++) { await api("POST", "/calendar/advance", {}); loans = await api("GET", "/youth-loans"); }
    const listing = loans?.available?.[0];
    const b = listing ? await api("POST", "/youth-loans/borrow", { loanId: listing.loanId, months: Math.max(...listing.allowedMonths), confirm: true }) : null;
    check(sc, "a youth borrowed from an AI club", !!b?.loanId, b ? `${b.startsOn} to ${b.endsOn}` : JSON.stringify(loans).slice(0, 120));
    const okPage = await open("/team", `[...document.querySelectorAll("button")].some(x => /Youth Loans/.test(x.textContent))`);
    await clickText("/Youth Loans/");
    let text = "";
    for (let i = 0; i < 30 && !/to \d{1,2} [A-Z][a-z]{2} \d{4}/.test(text); i++) { await sleep(300); text = await js(`document.querySelector('[data-testid="loans-in"]')?.innerText ?? ""`); }
    const page = await js(`document.body.innerText`);
    await shot("n37-youth-loans-dates.png");
    const fmt = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m - 1]} ${y}`; };
    check(sc, "the loan shows its dates as \"22 Sep 2026\", and no raw date is on the tab",
      okPage && b && text.includes(`${fmt(b.startsOn)} to ${fmt(b.endsOn)}`) && !/\d{4}-\d{2}-\d{2}/.test(page),
      text.split("\n").find((l) => / to /.test(l)) ?? text.slice(0, 120));
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
console.log(JSON.stringify(summary));
process.exit(ok && summary.errors.length === 0 ? 0 : 1);
