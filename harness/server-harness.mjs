/**
 * Boot and stop the real server, the way a quit actually happens.
 *
 * R-36: every suite used to `spawn(ELECTRON, [SERVER])` and stop it with
 * `child.kill("SIGKILL")`. SIGKILL gives the server no chance to run R-31's
 * shutdown path, so the database is left in WAL mode with an un-checkpointed
 * `-wal` sidecar holding the session's last writes. Opening that database from
 * another process with `new DatabaseSync(file, { readOnly: true })` then fails
 * outright — replaying a WAL requires creating the `-shm` index file, which a
 * read-only connection cannot do, and SQLite reports it as `disk I/O error`.
 *
 * That is not a hypothetical: `reference-data-backfill.mjs` failed on it
 * outright, and three other suites carried a 600ms "let the sidecar settle"
 * sleep that was the same bug half-papered-over — a race they happened to win
 * most of the time.
 *
 * The fix is for the harness to quit the server the way the app does. R-31
 * already built that path: the server listens on the fork's IPC channel for
 * `{ type: "shutdown" }`, runs `PRAGMA wal_checkpoint(TRUNCATE)`, closes the
 * sqlite handle and exits 0 itself. `electron/main.js` uses it on `before-quit`
 * and `wal-checkpoint-shutdown.mjs` proves it. So the harness uses it too, and
 * the database a suite opens afterwards is a single complete file with no WAL —
 * which is also a truer test, because it is the state a player's save is
 * actually left in.
 *
 * The IPC channel only exists on a forked child, which is why this uses
 * `fork()` rather than `spawn()`. `execPath` is Electron's binary with
 * ELECTRON_RUN_AS_NODE=1 — the same ABI-matching trick every suite already
 * used, because better-sqlite3 is compiled against Electron's Node ABI — and
 * fork() still sets up a normal IPC channel under RUN_AS_NODE.
 *
 * Deliberately NOT used where a suite kills the server on purpose:
 * `migration-fixtures.mjs` simulates a crashed process, and an orderly
 * shutdown would destroy the thing it is testing.
 */
import { fork } from "node:child_process";

/**
 * Fork the built server with an IPC channel, logging to the `out` fd.
 *
 * `env` is passed through as the caller built it, so each suite keeps its own
 * DB_PATH / PORT / SESSION_SECRET exactly as before.
 */
export function forkServer({ server, electron, env, out }) {
  return fork(server, [], {
    execPath: electron,
    env,
    stdio: ["ignore", out, out, "ipc"],
  });
}

/**
 * Stop the server through R-31's shutdown path and wait for it to exit.
 *
 * Returns how it went, so a caller that cares can assert on it:
 *   { graceful: true }                      — checkpointed and exited on its own
 *   { graceful: false, reason: "..." }       — had to be killed
 *
 * The SIGKILL fallback is kept for the same reason `main.js` keeps its 2s one:
 * if the message is never sent, never received or never finishes, the suite
 * still has to terminate rather than hang. A fallback that fires is reported,
 * never silent — a suite passing because it quietly fell back to the old
 * behaviour is how this bug stayed invisible in the first place.
 */
export async function stopServer(child, { timeoutMs = 10000 } = {}) {
  let exited = child.exitCode !== null || child.signalCode !== null;
  child.once("exit", () => { exited = true; });

  let result;
  let sent = false;
  try { sent = child.connected && child.send({ type: "shutdown" }); } catch { sent = false; }

  if (!sent) {
    result = { graceful: false, reason: "shutdown message could not be sent (no IPC channel?)" };
  } else {
    const deadline = Date.now() + timeoutMs;
    while (!exited && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
    }
    result = exited
      ? { graceful: true }
      : { graceful: false, reason: `server did not exit within ${timeoutMs}ms of the shutdown message` };
  }

  if (!result.graceful) {
    try { child.kill("SIGKILL"); } catch { /* already gone */ }
    // Only the forced path needs a settle window: a SIGKILL can leave the -wal
    // sidecar mid-write. The graceful path has already checkpointed it away.
    await new Promise((r) => setTimeout(r, 600));
    console.log(`  NOTE  graceful shutdown failed, fell back to SIGKILL — ${result.reason}`);
  }

  // pino logs through a worker thread; give an orderly exit a moment to have
  // its last line land before a caller reads the log file.
  await new Promise((r) => setTimeout(r, 150));
  return result;
}
