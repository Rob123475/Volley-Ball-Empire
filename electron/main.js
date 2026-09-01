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
const APP_NAME = "Volleyball Empire";

// Electron derives userData from the app name, and the app name differs by how
// the game was started: an unpackaged dev run takes it from the monorepo's root
// package.json "name" ("workspace"), a packaged build takes it from
// electron-builder's productName. Neither is the name we want on disk, so the
// path is set explicitly here and APP_NAME is the only thing that decides it.
//
// The root package.json "name" is deliberately NOT renamed: it is the pnpm
// workspace identifier, and changing it would move the dev save folder as a
// side effect of a packaging change — exactly the kind of coupling this block
// exists to remove.
const defaultUserDataPath = app.getPath("userData");
const appDataRoot = path.dirname(defaultUserDataPath);
app.setName(APP_NAME);
const userDataPath = path.join(appDataRoot, APP_NAME);
app.setPath("userData", userDataPath);

// Every folder name this game's saves have ever lived under, newest first.
// Enumerated rather than derived, because the derived value depends on whether
// the build is packaged and would silently miss the other case.
const LEGACY_APP_DIRS = [
  "Volley-Ball-Empire",   // previous APP_NAME
  "Volley-Ball Empire",   // launcher/shortcut spelling
  "Volleyball-Empire",
  "workspace",            // the pnpm workspace name — where dev saves actually went
];

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

/**
 * Bring a save forward from any folder the game used to write to.
 *
 * Copies rather than moves, so the original is untouched and a failure costs
 * nothing. Never overwrites an existing save at the new path. The -wal sidecar
 * is copied too and is not optional: SQLite keeps recent writes there until a
 * checkpoint, so copying only the .sqlite silently drops the most recent
 * progress — which is the part a player would notice.
 */
function migrateLegacyUserData() {
  if (fs.existsSync(userDbPath)) return;   // already have a save here

  let best = null;
  for (const dir of LEGACY_APP_DIRS) {
    const candidate = path.join(appDataRoot, dir, "volleyball-empire.sqlite");
    if (candidate === userDbPath) continue;
    if (!fs.existsSync(candidate)) continue;
    // Prefer the most recently written save, counting the WAL: a save whose
    // newest writes are still in the sidecar has a stale .sqlite mtime.
    let mtime = 0;
    for (const suffix of ["", "-wal"]) {
      try {
        const t = fs.statSync(`${candidate}${suffix}`).mtimeMs;
        if (t > mtime) mtime = t;
      } catch { /* sidecar absent — fine */ }
    }
    if (!best || mtime > best.mtime) best = { db: candidate, dir, mtime };
  }

  if (!best) return;

  try {
    fs.mkdirSync(userDataPath, { recursive: true });
    fs.copyFileSync(best.db, userDbPath);
    for (const suffix of ["-wal", "-shm"]) {
      const src = `${best.db}${suffix}`;
      if (fs.existsSync(src)) fs.copyFileSync(src, `${userDbPath}${suffix}`);
    }
    console.log(`Migrated save data from ${best.dir} to ${APP_NAME}`);
  } catch (err) {
    // Non-fatal: the game still starts, just with a fresh save. Say so loudly
    // rather than letting a player think their career vanished silently.
    console.error("Could not migrate legacy save data:", err);
    try {
      dialog.showErrorBox(
        "Could not move your existing save",
        `Volleyball Empire found an earlier save in "${best.dir}" but could not ` +
          `copy it to its new location.

Your old save has NOT been changed — ` +
          `it is still at:
${path.dirname(best.db)}

${err && err.message ? err.message : String(err)}`
      );
    } catch { /* dialog unavailable this early — the log line still stands */ }
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

// Shutdown. The old version was one line — `serverProcess.kill()` — which
// fires the signal and then trusts it. It never checked whether the signal
// landed, never waited for the child to actually go, and left the fork's IPC
// channel open. Any one of those failing leaves the main process resident
// after its last window is gone: still holding better_sqlite3.node and still
// bound to SERVER_PORT. The player sees a game that closed fine and then will
// not start again, and nothing short of Task Manager fixes it.
//
// No SIGKILL escalation here on purpose. Windows is the only platform we ship,
// and there child.kill() ignores the signal and calls TerminateProcess either
// way — escalating would be ceremony, not force.
const SHUTDOWN_GRACE_MS = 2000;
let shuttingDown = false;

app.on("before-quit", (event) => {
  isQuitting = true;

  const child = serverProcess;
  if (shuttingDown || !child) return; // second pass, or nothing to wait for
  shuttingDown = true;

  // Hold the quit open just long enough to reap the child ourselves.
  event.preventDefault();

  // kill() returns false when the handle is already gone — the child died
  // earlier and we would otherwise wait the full grace period for an "exit"
  // that can never arrive.
  const signalled = child.kill();
  if (!signalled) console.warn("[shutdown] server handle already gone, nothing to signal");

  // An open IPC channel is a live handle on this process's event loop, so it
  // can keep the parent alive on its own even once the child is dead.
  try { child.disconnect(); } catch { /* never connected, or already gone */ }

  let timer = null;
  const finish = (why) => {
    if (timer) clearTimeout(timer);
    console.log(`[shutdown] ${why}`);
    // Unconditional backstop. Whatever handles are still pending — sockets,
    // the fork channel, a wedged child — this line ends the parent.
    app.exit(0);
  };

  child.once("exit", () => finish("server child exited, quitting"));
  timer = setTimeout(
    () => finish(`server child did not exit within ${SHUTDOWN_GRACE_MS}ms, forcing`),
    SHUTDOWN_GRACE_MS,
  );
});
