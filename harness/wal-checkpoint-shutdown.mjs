/**
 * R-31 — the database must be checkpointed and closed on quit, not just killed.
 *
 * ── The bug this exists for ─────────────────────────────────────────────────
 * `electron/main.js`'s `before-quit` used to just `child.kill()` the forked
 * server and wait up to 2s for it to die. Nothing ran `PRAGMA
 * wal_checkpoint`, nothing called `sqlite.close()` — confirmed by grep, no
 * such call existed anywhere on the main `sqlite` export. In WAL mode a
 * database's true state is split across `.sqlite` and `.sqlite-wal`; Steam
 * Cloud only syncs whatever it's told to, so a session's last writes sitting
 * un-checkpointed in the WAL on quit could ship a save missing its most
 * recent progress.
 *
 * ── The fix ──────────────────────────────────────────────────────────────
 * `index.ts` now listens on the fork's own IPC channel (the one
 * `electron/main.js` already had — confirmed live by its own pre-existing
 * `child.disconnect()` call — not a new mechanism) for `{ type: "shutdown" }`,
 * runs `PRAGMA wal_checkpoint(TRUNCATE)`, closes the sqlite handle, and exits
 * 0 itself. `before-quit` sends that message and waits for the child's own
 * "exit" event, with the existing 2s hard-kill as the fallback if the
 * message is never sent, never received, or never finishes.
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 * Boot the real server via a real fork() (not spawn()) — the IPC channel
 * the shutdown message travels over only exists on a forked child, exactly
 * like main.js's own. execPath is the Electron binary with
 * ELECTRON_RUN_AS_NODE=1, the same ABI-matching trick every other suite uses
 * to run the real built server (better-sqlite3 is a native module compiled
 * against Electron's Node ABI, not the system one) — fork() still sets up a
 * normal IPC channel under RUN_AS_NODE, it only suppresses Electron's own
 * app/BrowserWindow APIs.
 *
 * Write a row through the real API (POST /profiles — no auth needed, and it
 * is a genuine write through the app's own code path, not a raw SQL poke),
 * confirm the WAL is genuinely non-empty at that point (proves the write
 * really did land in the WAL and this isn't a vacuous test), send the
 * shutdown message, wait for exit, then assert: the WAL is 0 bytes or gone,
 * and the row is readable from the main .sqlite file alone, opened
 * read-only — i.e. checkpointed all the way back into the main file, not
 * just closed with the WAL still holding the only copy.
 *
 * Usage: node harness/wal-checkpoint-shutdown.mjs
 */
import { fork } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { requireElectronBinary } from "./electron-binary.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-wal-checkpoint-"));
const PORT = 4640;

let failures = 0;
let checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

if (!fs.existsSync(SERVER)) {
  console.error(`[wal-checkpoint-shutdown] FAILED: ${SERVER} not built. Run the api-server build first.`);
  process.exit(1);
}

console.log("=".repeat(72));
console.log("  R-31 CHECKPOINT AND CLOSE THE DB ON QUIT");
console.log("=".repeat(72));

const dbFile = path.join(WORK, "wal-checkpoint.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const walFile = `${dbFile}-wal`;

const logFile = path.join(WORK, "server.log");
const out = fs.openSync(logFile, "w");

// A real fork(), not spawn(): the IPC channel the shutdown message travels
// over — the same one electron/main.js already relies on — only exists on a
// forked child. execPath swaps in Electron's own binary (ABI-matching
// better-sqlite3) while ELECTRON_RUN_AS_NODE keeps it behaving as plain Node.
const child = fork(SERVER, [], {
  execPath: ELECTRON,
  env: {
    ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT),
    NODE_ENV: "development", SESSION_SECRET: "wal-checkpoint-secret",
  },
  stdio: ["ignore", out, out, "ipc"],
});

const base = `http://localhost:${PORT}/api`;
const api = async (method, p, body) => {
  const res = await fetch(base + p, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
};

const deadline = Date.now() + 25000;
let up = false;
while (Date.now() < deadline) {
  try { await fetch(`${base}/healthz`); up = true; break; }
  catch { await new Promise((r) => setTimeout(r, 250)); }
}
if (!up) {
  console.error("[wal-checkpoint-shutdown] server never came up");
  console.error(fs.readFileSync(logFile, "utf8").slice(-2000));
  process.exit(1);
}

// ── Write a real row through the app's own code path ─────────────────────────
const created = await api("POST", "/profiles", { name: "WalCheckpointTest" });
check("the write succeeded", created.status === 201, `HTTP ${created.status}`);
const profileId = created.data?.id;

const walSizeBeforeShutdown = fs.existsSync(walFile) ? fs.statSync(walFile).size : 0;
check("the WAL genuinely holds the write before shutdown (not a vacuous test)",
  walSizeBeforeShutdown > 0, `${walSizeBeforeShutdown} bytes`);

// ── Trigger the shutdown path exactly as main.js does ─────────────────────────
let exited = false;
child.once("exit", () => { exited = true; });
const sent = child.connected && child.send({ type: "shutdown" });
check("the shutdown message was sent over the fork's IPC channel", !!sent);

const exitDeadline = Date.now() + 10000;
while (Date.now() < exitDeadline && !exited) {
  await new Promise((r) => setTimeout(r, 100));
}
check("the server exited on its own after the shutdown message (not force-killed)", exited);

if (!exited) { try { child.kill(); } catch {} }
await new Promise((r) => setTimeout(r, 300));
try { fs.closeSync(out); } catch { /* already closed */ }

const log = fs.readFileSync(logFile, "utf8");
check("the log says the WAL was checkpointed and the DB closed",
  /WAL checkpointed and database closed for shutdown/.test(log),
  log.includes("checkpointed") ? "" : "no checkpoint line in the log");

const walSizeAfter = fs.existsSync(walFile) ? fs.statSync(walFile).size : 0;
check("the WAL is 0 bytes or absent after shutdown", walSizeAfter === 0, `${walSizeAfter} bytes`);

const db = new DatabaseSync(dbFile, { readOnly: true });
const row = db.prepare("SELECT id, first_name FROM users WHERE id = ?").get(profileId);
db.close();
check("the written row is present in the main .sqlite file alone, opened read-only",
  !!row && row.first_name === "WalCheckpointTest", JSON.stringify(row));

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch {} }
process.exit(failures > 0 ? 1 : 0);
