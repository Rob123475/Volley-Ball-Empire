/**
 * P-11 — a staff card renamed in the starter DB is renamed in existing saves
 * too, and a name the player typed is not.
 *
 * The boot-time reference sync (ensureReferenceData) leaves staff `name` and
 * `nationality` alone on purpose: the player can edit both. That also meant a
 * rename in the starter DB never reached a save — Rob's kept four doctors' old
 * names after they were fixed, and would have kept all 28 of 28 Sep's.
 *
 * Pass 4 brings a card forward only when the save still holds a name the
 * starter DB itself once shipped for that id (utils/staffNameHistory.ts).
 * This suite builds a save in exactly that state — every card on its most
 * recent old name, as Rob's is — plus cards the player renamed, boots the real
 * server against it with the starter DB as reference, and reads the result.
 *
 *   old      every card holding a previous starter name gets today's name AND
 *            nationality, swapped pairs included (Fiona Walsh <-> Henri Fontaine)
 *   player   a name the player typed stays, on a card with history and without
 *   once     a second boot has nothing left to do
 *
 * Usage: node harness/staff-name-sync.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-staff-name-sync-"));
const PORT = 4871;
const OLD_NATIONALITY = "Oldland";

// The history map itself — Node strips the types from a .ts import.
const { PREVIOUS_STAFF_NAMES } = await import(
  pathToFileURL(path.join(REPO, "artifacts", "api-server", "src", "utils", "staffNameHistory.ts")).href);

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log("  P-11 STAFF RENAMES REACH EXISTING SAVES; THE PLAYER'S OWN DO NOT");
console.log("=".repeat(72));

if (!fs.existsSync(SERVER)) { console.error(`[staff-name-sync] FAILED: ${SERVER} not built.`); process.exit(1); }

// ── 0. The history ─────────────────────────────────────────────────────────
console.log("\n0. THE HISTORY MAP");
const starter = new DatabaseSync(SHIPPED, { readOnly: true });
const today = new Map(starter.prepare("SELECT id, name, nationality FROM staff").all().map((r) => [r.id, r]));
starter.close();
const ids = Object.keys(PREVIOUS_STAFF_NAMES).map(Number);
check("the map names only real staff ids, and never a card's current name as an old one",
  ids.length > 0 && ids.every((id) => today.has(id) && !PREVIOUS_STAFF_NAMES[id].includes(today.get(id).name)),
  `${ids.length} ids`);
const RENAMED_28_SEP = [1, 86, 2, 3, 5, 10, 13, 18, 12, 19, 110, 107, 111, 114, 104, 105, 102, 90, 91, 95, 92, 93, 89, 80, 76, 84, 85, 126];
const FIXED_EARLIER = [131, 141, 147, 161];
const uncovered = [...RENAMED_28_SEP, ...FIXED_EARLIER].filter((id) => !PREVIOUS_STAFF_NAMES[id]);
check("it covers the 28 renamed on 28 Sep and the 4 doctors fixed before", uncovered.length === 0,
  uncovered.length ? `missing: ${uncovered.join(", ")}` : `${RENAMED_28_SEP.length} + ${FIXED_EARLIER.length}`);

// ── 1. A save in Rob's state ───────────────────────────────────────────────
console.log("\n1. A SAVE STILL ON THE OLD NAMES");
const saveFile = path.join(WORK, "save.sqlite");
fs.copyFileSync(SHIPPED, saveFile);
const PLAYER_EDITS = new Map([
  [1, { name: "My Own Head Coach", nationality: "Iceland" }],   // a card WITH history, renamed by the player
  [20, { name: "Coach I Renamed", nationality: "Fiji" }],       // a card with no history, renamed by the player
]);
{
  const w = new DatabaseSync(saveFile);
  const set = w.prepare("UPDATE staff SET name = ?, nationality = ? WHERE id = ?");
  for (const id of ids) {
    const old = PREVIOUS_STAFF_NAMES[id];
    set.run(old[old.length - 1], OLD_NATIONALITY, id);   // the name it had just before today's
  }
  for (const [id, e] of PLAYER_EDITS) set.run(e.name, e.nationality, id);
  w.close();
}
const planted = ids.filter((id) => !PLAYER_EDITS.has(id));
console.log(`  planted ${planted.length} cards on their last old name (nationality "${OLD_NATIONALITY}"), ${PLAYER_EDITS.size} player renames`);

async function boot(label) {
  const logFile = path.join(WORK, `${label}.log`);
  const out = fs.openSync(logFile, "w");
  const child = forkServer({
    server: SERVER, electron: ELECTRON, out,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: saveFile, PORT: String(PORT), NODE_ENV: "development",
      SESSION_SECRET: "staff-name-sync", STARTER_DB_PATH: SHIPPED },
  });
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`http://localhost:${PORT}/api/healthz`)).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  await stopServer(child);
  try { fs.closeSync(out); } catch { /* closed */ }
  return fs.readFileSync(logFile, "utf8").replace(/\x1b\[[0-9;]*m/g, "");
}

try {
  const log1 = await boot("first-boot");
  const after = new DatabaseSync(saveFile, { readOnly: true });
  const now = new Map(after.prepare("SELECT id, name, nationality FROM staff").all().map((r) => [r.id, r]));
  after.close();

  const stale = planted.filter((id) => now.get(id).name !== today.get(id).name || now.get(id).nationality !== today.get(id).nationality);
  check("every card on an old starter name now has today's name and nationality", stale.length === 0,
    stale.length ? stale.map((id) => `${id}: ${now.get(id).name} (${now.get(id).nationality})`).join("; ") : `${planted.length} cards`);
  const pairs = [[104, 105], [76, 80], [92, 95], [13, 18]];
  check("including the pairs that swapped names, with no name held twice",
    pairs.every(([a, b]) => now.get(a).name === today.get(a).name && now.get(b).name === today.get(b).name),
    pairs.map(([a, b]) => `${now.get(a).name} / ${now.get(b).name}`).join("; "));
  const sample = [126, 131, 161, 13].map((id) => `${id} ${now.get(id).name} (${now.get(id).nationality})`).join("; ");
  check("the four doctors fixed earlier and the 28 Sep renames among them", [...RENAMED_28_SEP, ...FIXED_EARLIER]
    .filter((id) => !PLAYER_EDITS.has(id)).every((id) => now.get(id).name === today.get(id).name), sample);

  const kept = [...PLAYER_EDITS].filter(([id, e]) => now.get(id).name === e.name && now.get(id).nationality === e.nationality);
  check("a name the player typed stays, on a card with history and on one without", kept.length === PLAYER_EDITS.size,
    [...PLAYER_EDITS.keys()].map((id) => `${id}: ${now.get(id).name} (${now.get(id).nationality})`).join("; "));

  const untouched = [...today.keys()].filter((id) => !ids.includes(id) && !PLAYER_EDITS.has(id))
    .filter((id) => now.get(id).name !== today.get(id).name);
  check("and no other card changed", untouched.length === 0, `${today.size - ids.length - 1} other cards`);

  const lastOld126 = PREVIOUS_STAFF_NAMES[126][PREVIOUS_STAFF_NAMES[126].length - 1];
  check("the boot log says what it renamed, from and to", /renamedStaff/.test(log1) && log1.includes(lastOld126) && log1.includes(today.get(126).name),
    `${lastOld126} -> ${today.get(126).name}`);

  const log2 = await boot("second-boot");
  check("a second boot has nothing left to rename", !/renamedStaff/.test(log2) || /save is up to date/.test(log2),
    /save is up to date/.test(log2) ? "save is up to date" : "renamed again");
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
