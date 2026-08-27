const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { fork } = require("child_process");
const http = require("http");

// ── Paths ────────────────────────────────────────────────────────────────────
// process.resourcesPath only points into your packaged app once electron-builder
// has run. In dev (electron:dev, unpackaged) it points inside Electron's own
// install folder instead — so we resolve straight from the repo when unpackaged.
// Must run before any app.getPath("userData") call below: Electron derives the
// userData folder from the app name, which otherwise comes from the monorepo's
// package.json "name" ("workspace") and put every player's save in a folder
// called workspace. migrateLegacyUserData() below moves an existing one across.
const APP_NAME = "Volley-Ball-Empire";
const legacyUserDataPath = app.getPath("userData");
app.setName(APP_NAME);
const userDataPath = path.join(path.dirname(legacyUserDataPath), APP_NAME);
app.setPath("userData", userDataPath);

const isPackaged = app.isPackaged;
const repoRoot = path.join(__dirname, ".."); // electron/ -> repo root

// Bundled starter DB (copied into resources by electron-builder — see package.json extraResources)
const bundledDbPath = isPackaged
  ? path.join(process.resourcesPath, "starter-db", "volleyball-empire.sqlite")
  : path.join(repoRoot, "lib", "db", "volleyball-empire.sqlite");

// Writable per-user location the app actually reads/writes from.
// Copying the starter DB here on first launch means every subsequent launch
// re-uses the player's saved progress instead of resetting to the bundled starter.
const userDbPath = path.join(userDataPath, "volleyball-empire.sqlite");

// One-time move of a save written under the old "workspace" folder name.
// Copies rather than renames so a failure leaves the original intact.
function migrateLegacyUserData() {
  if (legacyUserDataPath === userDataPath) return;
  if (fs.existsSync(userDbPath)) return;

  const legacyDb = path.join(legacyUserDataPath, "volleyball-empire.sqlite");
  if (!fs.existsSync(legacyDb)) return;

  try {
    fs.mkdirSync(userDataPath, { recursive: true });
    fs.copyFileSync(legacyDb, userDbPath);
    for (const suffix of ["-wal", "-shm"]) {
      const src = `${legacyDb}${suffix}`;
      if (fs.existsSync(src)) fs.copyFileSync(src, `${userDbPath}${suffix}`);
    }
    console.log(`Migrated save data from ${legacyUserDataPath} to ${userDataPath}`);
  } catch (err) {
    console.error("Could not migrate legacy save data:", err);
  }
}

// The compiled API server (bundled via extraResources: api-server/dist -> server/dist)
const serverEntry = isPackaged
  ? path.join(process.resourcesPath, "server", "dist", "index.mjs")
  : path.join(repoRoot, "artifacts", "api-server", "dist", "index.mjs");

// Built frontend static files. Computed explicitly here (same pattern as
// serverEntry/bundledDbPath above) and passed to the server via env var —
// we stopped relying on the server reading process.resourcesPath itself,
// since that's been observed to resolve inconsistently across launches
// inside a forked (ELECTRON_RUN_AS_NODE) child process.
const publicDir = isPackaged
  ? path.join(process.resourcesPath, "public")
  : path.join(repoRoot, "artifacts", "api-server", "dist", "public");

const SERVER_PORT = 4173;

let serverProcess = null;
let mainWindow = null;
let isQuitting = false;

// ── First-launch DB setup ────────────────────────────────────────────────────
// Copies the -wal/-shm sidecars alongside the main file, if present, rather
// than opening + checkpointing bundledDbPath first: bundledDbPath lives
// under process.resourcesPath in a packaged build, which can be read-only
// (e.g. an unelevated install under Program Files), so anything requiring
// write access to the bundled copy would fail there. A bare copyFileSync of
// only the main .sqlite file silently drops any writes still sitting in an
// un-checkpointed WAL — SQLite auto-replays the copied WAL the first time
// the destination is opened, so the result is correct either way, but only
// this way works regardless of whether the source is writable.
function ensureUserDb() {
  if (!fs.existsSync(userDbPath)) {
    fs.mkdirSync(path.dirname(userDbPath), { recursive: true });
    fs.copyFileSync(bundledDbPath, userDbPath);
    for (const suffix of ["-wal", "-shm"]) {
      const src = `${bundledDbPath}${suffix}`;
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, `${userDbPath}${suffix}`);
      }
    }
  }
}

// ── Spawn the API server as a child process ─────────────────────────────────
function startServer() {
  return new Promise((resolve, reject) => {
    serverProcess = fork(serverEntry, [], {
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(SERVER_PORT),
        DB_PATH: userDbPath,
        PUBLIC_DIR: publicDir,
      },
      silent: true,
    });

    serverProcess.stdout?.on("data", (d) => console.log(`[server] ${d}`));
    serverProcess.stderr?.on("data", (d) => console.error(`[server] ${d}`));
    serverProcess.on("error", reject);

    // Without this, a server that dies after a successful startup left the
    // window up with every request failing — the game looked frozen and the
    // player had nothing to report.
    serverProcess.on("exit", (code, signal) => {
      serverProcess = null;
      if (isQuitting) return;
      const detail = signal ? `signal ${signal}` : `exit code ${code}`;
      reject(new Error(`Server process stopped (${detail})`));
      if (mainWindow && !mainWindow.isDestroyed()) {
        dialog.showErrorBox(
          "Volleyball Empire has lost its server",
          `The game's local server stopped unexpectedly (${detail}).

` +
            `Your save is on disk and unchanged. Please restart the game.`
        );
        app.quit();
      }
    });

    // Poll until the server actually responds, rather than guessing a fixed delay
    const start = Date.now();
    const timeoutMs = 15000;
    const retryOrFail = (reason) => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Server did not start within 15s (${reason})`));
      } else {
        setTimeout(poll, 300);
      }
    };

    const poll = () => {
      const req = http.get(`http://localhost:${SERVER_PORT}/api/healthz`, (res) => {
        // Any HTTP answer used to count as success, so an unrelated service
        // already holding port 4173 would make startup "succeed" and the game
        // would load someone else's page. Require a 2xx from our own endpoint.
        const ok = res.statusCode >= 200 && res.statusCode < 300;
        res.resume();
        res.on("end", () => (ok ? resolve() : retryOrFail(`health check returned ${res.statusCode}`)));
      });
      req.setTimeout(2000, () => req.destroy(new Error("health check timed out")));
      req.on("error", (err) => retryOrFail(err.message));
    };
    poll();
  });
}

// ── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false, // avoid a flash of the small unmaximized window before it fills the screen
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.loadURL(`http://localhost:${SERVER_PORT}/`);
}

// ── App lifecycle ────────────────────────────────────────────────────────────

// Two copies of the game against one SQLite file corrupts saves. Keep one.
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      migrateLegacyUserData();
      ensureUserDb();
      await startServer();
      createWindow();
    } catch (err) {
      // A packaged Windows app has no console, so console.error here was an
      // invisible quit: fifteen seconds of nothing, then the process ends.
      // Show the player something they can actually report.
      console.error("Failed to start:", err);
      dialog.showErrorBox(
        "Volleyball Empire could not start",
        `The game's local server failed to start, so the game has to close.

` +
          `${err && err.message ? err.message : String(err)}

` +
          `Log file: ${path.join(app.getPath("userData"), "startup-error.log")}`
      );
      try {
        fs.writeFileSync(
          path.join(app.getPath("userData"), "startup-error.log"),
          `${new Date().toISOString()}
${(err && err.stack) || String(err)}
`
        );
      } catch { /* nothing more we can do */ }
      app.quit();
    }
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  isQuitting = true;
  if (serverProcess) serverProcess.kill();
});
