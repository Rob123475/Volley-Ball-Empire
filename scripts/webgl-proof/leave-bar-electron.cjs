/**
 * Overnight brief 1 Oct, N-30: the Leave match bar in the game's own renderer
 * (Electron, as the packaged game runs), not headless Chrome.
 *
 * A stand-alone Electron main of its own: a temporary userData folder, the
 * built api-server on a COPY of the starter DB (never the game's save folder),
 * a career run to its first match day and watched, then /court?matchId=… in a
 * BrowserWindow at each size (and maximised), with the bar's measurements after
 * the court has had time to load and take focus.
 *
 * Usage: node_modules/electron/dist/electron.exe scripts/webgl-proof/leave-bar-electron.cjs <outDir>
 */
const { app, BrowserWindow, session } = require("electron");
const { fork } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const REPO = path.resolve(__dirname, "..", "..");
const outDir = path.resolve(process.argv[process.argv.length - 1]);
const PORT = 4201, BASE = `http://localhost:${PORT}`;
const SIZES = [[1400, 900], [1280, 720], [1024, 700], "max"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "leave-bar-electron-")));
fs.mkdirSync(outDir, { recursive: true });

app.whenReady().then(async () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "leave-bar-db-"));
  const db = path.join(work, "court.sqlite");
  fs.copyFileSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), db);
  const server = fork(path.join(REPO, "artifacts/api-server/dist/index.mjs"), [], {
    execPath: process.execPath,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PUBLIC_DIR: path.join(REPO, "artifacts/api-server/dist/public"),
      DB_PATH: db, PORT: String(PORT), SESSION_SECRET: "leave-bar-electron" },
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  const result = { sizes: [], errors: [] };
  try {
    for (let i = 0; i < 120; i++) { try { if ((await fetch(`${BASE}/api/healthz`)).ok) break; } catch { /* booting */ } await sleep(500); }
    let cookie = "";
    const api = async (m, p, b) => {
      const r = await fetch(BASE + "/api" + p, { method: m, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
      const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
      const t = await r.text(); try { return JSON.parse(t); } catch { return t; }
    };
    const prof = await api("POST", "/profiles", { name: "Leave Bar Electron" });
    await api("POST", `/profiles/${prof.id}/select`);
    const club = (await api("GET", "/club-templates")).clubs.find((c) => c.name === "Sydney Riptide");
    await api("POST", "/careers", { slotNumber: 1, managerName: "Leave Bar Electron", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
      budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
    const matchId = (await api("POST", "/calendar/next-match")).matchDay.matchId;
    await api("POST", `/matches/${matchId}/watch`, {});
    const [name, value] = cookie.split("=");
    await session.defaultSession.cookies.set({ url: BASE, name, value });

    const win = new BrowserWindow({ width: 1400, height: 900, show: true, webPreferences: { contextIsolation: true, nodeIntegration: false } });
    await win.loadURL(`${BASE}/court?matchId=${matchId}`);
    const js = (e) => win.webContents.executeJavaScript(e, true);
    for (let i = 0; i < 60; i++) {
      if (await js(`!!document.querySelector('[data-testid="court-leave-bar"]')`)) break;
      await js(`[...document.querySelectorAll("button")].find(b => /continue/i.test(b.textContent))?.click()`);
      await sleep(500);
    }
    await sleep(20000); // the court loads and takes focus, as for a player
    for (const s of SIZES) {
      if (s === "max") win.maximize(); else { win.unmaximize(); win.setContentSize(s[0], s[1]); }
      await sleep(1500);
      const m = await js(`(() => {
        const bar = document.querySelector('[data-testid="court-leave-bar"]');
        const note = bar.querySelector('span'), btn = bar.querySelector('[data-testid="button-leave-match"]');
        const r = (e) => { const b = e.getBoundingClientRect(); return { left: Math.round(b.left), right: Math.round(b.right), top: Math.round(b.top), bottom: Math.round(b.bottom) }; };
        return { innerWidth, innerHeight, docW: document.documentElement.scrollWidth, docH: document.documentElement.scrollHeight, scrollX, scrollY,
          bar: r(bar), note: r(note), noteCut: note.scrollWidth > note.clientWidth + 1, button: r(btn), buttonCut: btn.scrollWidth > btn.clientWidth + 1,
          zoom: devicePixelRatio };
      })()`);
      // Measured, not pictured: capturePage comes back empty for a window behind
      // others, and the DevTools screenshot waits for a frame that never comes.
      const label = s === "max" ? "maximised" : `${s[0]}x${s[1]}`;
      result.sizes.push({ size: label, ...m });
    }
  } catch (err) {
    result.errors.push(String(err && err.stack || err));
  }
  fs.writeFileSync(path.join(outDir, "electron-summary.json"), JSON.stringify(result, null, 2));
  try { server.kill(); } catch { /* gone */ }
  app.exit(0);
});
