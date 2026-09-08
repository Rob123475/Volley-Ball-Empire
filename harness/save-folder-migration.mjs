/**
 * R-23 — renaming productName must bring an existing save across, not orphan it.
 *
 * ── The bug this exists for ─────────────────────────────────────────────────
 * `productName` drives Electron's `userData` folder. R-23 renamed it from
 * "Volleyball Empire" to "Beach Volleyball Empire" — on its own, that would
 * make every existing player's save invisible: the app would look in the new
 * folder, find nothing, and copy a fresh starter DB over it while the real
 * save sat untouched next door. `electron/main.js` already has a generic
 * `migrateLegacyUserData()` for several older folder names (COPY semantics —
 * leaves the source alone), but this specific hand-off (the name the app
 * shipped under until today, with Rob's real save under it right now) is a
 * new, separate `migrateRenamedAppData()`: MOVE semantics, called first thing
 * inside `ensureUserDb()`, so the files are not left duplicated across two
 * folders — but it must never delete the old folder itself, only empty it.
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 * This is the first harness suite to boot the real `electron/main.js` itself
 * (every other suite boots only the built server via ELECTRON_RUN_AS_NODE) —
 * the migration logic lives entirely in main.js, using real Electron `app`
 * APIs, so nothing short of a real (non-RUN_AS_NODE) Electron process can
 * exercise it. `--user-data-dir` is a standard Chromium/Electron flag that
 * reliably overrides `app.getPath("userData")` — far more reliable than
 * trying to override the OS's roaming-appdata resolution via env vars, which
 * Electron's path service does not read back on Windows.
 *
 * A temp "AppData\Roaming"-alike is seeded with a save ONLY under the OLD
 * folder name, containing real profile rows (not just an empty starter DB —
 * "profiles intact" has to mean something checkable). After boot: the save
 * must be under the NEW folder name, the old folder must still exist but be
 * empty, the moved DB must open, and the two seeded profiles must be exactly
 * as seeded.
 *
 * Usage: node harness/save-folder-migration.mjs
 */
import { spawn, execSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { requireElectronBinary } from "./electron-binary.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-folder-migration-"));

const OLD_NAME = "Volleyball Empire";
const NEW_NAME = "Beach Volleyball Empire";

let failures = 0;
let checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

if (!fs.existsSync(SERVER)) {
  console.error(`[save-folder-migration] FAILED: ${SERVER} not built. Run the api-server build first.`);
  process.exit(1);
}

console.log("=".repeat(72));
console.log("  R-23 SAVE FOLDER MOVES WITH THE RENAME");
console.log("=".repeat(72));

// ── Seed a save under the OLD folder name only, with real profile rows ───────
const oldDir = path.join(WORK, OLD_NAME);
const newDir = path.join(WORK, NEW_NAME);
const oldDb = path.join(oldDir, "volleyball-empire.sqlite");
const newDb = path.join(newDir, "volleyball-empire.sqlite");

fs.mkdirSync(oldDir, { recursive: true });
fs.copyFileSync(SHIPPED, oldDb);

const SEEDED_USERS = [
  { id: "harness-mary-0000-0000-000000000001", firstName: "mary" },
  { id: "harness-r04-check-000-000000000002", firstName: "R04 Check" },
];
{
  const db = new DatabaseSync(oldDb);
  const now = Math.floor(Date.now() / 1000);
  const stmt = db.prepare(
    "INSERT INTO users (id, first_name, created_at, updated_at) VALUES (?, ?, ?, ?)",
  );
  for (const u of SEEDED_USERS) stmt.run(u.id, u.firstName, now, now);
  db.close();
}

// A decoy under "workspace" — an unrelated, older, empty save that exists on
// Rob's real machine from a past dev session. This is the fixture that
// caught the real bug: migrateLegacyUserData() (COPY, broad net over several
// legacy names including "workspace") ran BEFORE migrateRenamedAppData()
// (MOVE, the one specific hand-off that actually matters here) and claimed
// userDbPath with this decoy first, so the real save under OLD_NAME never
// got moved at all. A fixture with only OLD_NAME present cannot catch that
// ordering bug — nothing else was competing for userDbPath.
const decoyDir = path.join(WORK, "workspace");
const decoyDb = path.join(decoyDir, "volleyball-empire.sqlite");
fs.mkdirSync(decoyDir, { recursive: true });
fs.copyFileSync(SHIPPED, decoyDb); // shipped starter DB — zero users, same as the real decoy was
const decoyBytesBefore = fs.readFileSync(decoyDb);

check("fixture really is seeded only under the OLD folder name",
  fs.existsSync(oldDb) && !fs.existsSync(newDb));

// ── Boot the real app (not the server directly) against this temp AppData ────
// --user-data-dir makes app.getPath("userData") resolve inside WORK,
// deterministically, regardless of the real Windows user profile — main.js's
// own appDataRoot = path.dirname(that) then lands on WORK itself, so
// "WORK/<name>" is exactly where main.js looks for each named folder.
const logFile = path.join(WORK, "electron.log");
const out = fs.openSync(logFile, "w");
const defaultUserDataDir = path.join(WORK, "electron-default-userdata");
const child = spawn(ELECTRON, [REPO, `--user-data-dir=${defaultUserDataDir}`], {
  env: { ...process.env, NODE_ENV: "development" },
  stdio: ["ignore", out, out],
  windowsHide: false,
});

// The migration runs before the server or window ever come up, so the signal
// to wait for is the moved file itself, not a health check.
const deadline = Date.now() + 20000;
while (Date.now() < deadline && !fs.existsSync(newDb)) {
  await new Promise((r) => setTimeout(r, 250));
}

// Give the write a moment to fully flush/settle, then stop the whole process
// tree — taskkill /T catches the server child main.js forked, not just main.js
// itself, so nothing is left bound to the port or holding the DB open.
await new Promise((r) => setTimeout(r, 500));
try { execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: "ignore" }); } catch { /* already gone */ }
await new Promise((r) => setTimeout(r, 500));
try { fs.closeSync(out); } catch { /* already closed */ }

const log = fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8") : "";

check("the new-named folder has the moved DB", fs.existsSync(newDb));

const oldDirEntries = fs.existsSync(oldDir) ? fs.readdirSync(oldDir) : null;
check("the old folder still exists", oldDirEntries !== null);
check("the old folder is now empty — moved, not copied, and never deleted",
  oldDirEntries !== null && oldDirEntries.length === 0,
  oldDirEntries ? `left behind: ${oldDirEntries.join(", ")}` : "");

check("the boot log names the move",
  new RegExp(`Moved save data from "${OLD_NAME}" to "${NEW_NAME}"`).test(log),
  log.includes("Moved save data") ? "" : "no move line in the log");

// The decoy must never be touched: migrateRenamedAppData() finding the real
// save under OLD_NAME must claim userDbPath FIRST, so migrateLegacyUserData()
// (which would otherwise happily copy this decoy in) has nothing left to do.
const decoyBytesAfter = fs.existsSync(decoyDb) ? fs.readFileSync(decoyDb) : null;
check("an unrelated decoy legacy folder (workspace) is left completely untouched",
  decoyBytesAfter !== null && decoyBytesAfter.equals(decoyBytesBefore),
  decoyBytesAfter === null ? "decoy file gone" : !decoyBytesAfter.equals(decoyBytesBefore) ? "decoy file changed" : "");

if (fs.existsSync(newDb)) {
  const db = new DatabaseSync(newDb, { readOnly: true });
  const rows = db.prepare("SELECT id, first_name FROM users ORDER BY id").all();
  db.close();
  const expected = [...SEEDED_USERS].sort((a, b) => a.id.localeCompare(b.id));
  const matches = rows.length === expected.length &&
    rows.every((r, i) => r.id === expected[i].id && r.first_name === expected[i].firstName);
  check("the moved DB opens and both seeded profiles are exactly intact",
    matches, matches ? `${rows.length} profiles` : JSON.stringify(rows));
} else {
  check("the moved DB opens and both seeded profiles are exactly intact", false, "no DB to open");
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch {} }
process.exit(failures > 0 ? 1 : 0);
