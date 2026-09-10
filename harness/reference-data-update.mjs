/**
 * R-33 — reference-data UPDATES never reach an existing save.
 *
 * ── The bug this exists for ─────────────────────────────────────────────────
 * R-28 (reference-data-backfill.mjs) only ever INSERTs a row a save is
 * missing. It never asks whether a row the save already has has since been
 * CORRECTED in the starter DB — so when players 51 and 187 were renamed
 * (the caption-audit fixes: Novi Anggraini -> Dewi Lestari, Elena
 * Papadopoulou -> Eleni Papadopoulou), every existing save kept the old,
 * wrong values forever, no matter how many times it booted.
 *
 * ── Why this harness does NOT test renaming a player, despite the register
 *    item's own example ──────────────────────────────────────────────────────
 * `name` looked like the obvious column to test — it's the register's own
 * motivating example. Investigation (see utils/ensureSchema.ts's
 * REFERENCE_UPDATE_ONLY comment) found `pages/team.tsx` ships a real,
 * always-visible "Edit" button on every roster player that PATCHes name,
 * nationality, continent, position and potential straight onto the shared
 * `players` reference row. Syncing `name` from the starter DB on every boot
 * would silently erase that in-game edit the next time the app starts — the
 * exact failure this filter exists to prevent. So `name` is deliberately
 * EXCLUDED from R-33's sync, and this harness proves BOTH halves of that
 * decision: a genuinely safe column (never written by any route) DOES catch
 * up to the starter DB, and a gameplay-writable column (`name`) does NOT —
 * even when it's stale, even though the register's example was a rename.
 * That is the correct behaviour, not a shortfall; see the register entry for
 * the full account of why R-33 does not fix players 51/187's `name` for
 * saves that already exist.
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 * A. A safe column (`players.height`, never touched by any route — see the
 *    write-boundary comment) that has drifted from the starter DB is brought
 *    forward on boot, and the boot log names it.
 * B. `players.name`, stale in exactly the same row, is left alone — proving
 *    the gameplay-writable exclusion actually holds, not just in theory.
 * C. A genuine per-career gameplay column (`career_player_state.speed`,
 *    written by the real training/match-tick systems, nothing to do with the
 *    reference row at all) is untouched — the reference-sync pass never
 *    touches career-scoped tables, full stop.
 * D. `locations`/`club_templates`/`outfits` — R-28's original insert-missing
 *    behaviour still passes unchanged (reference-data-backfill.mjs already
 *    covers this end to end; not re-proven here).
 *
 * Usage: node harness/reference-data-update.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-ref-update-"));

let failures = 0;
let checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

if (!fs.existsSync(SERVER)) {
  console.error(`[reference-data-update] FAILED: ${SERVER} not built. Run the api-server build first.`);
  process.exit(1);
}

let portCounter = 4640;

async function boot(dbFile, label, extraEnv = {}) {
  const port = portCounter++;
  const logFile = path.join(WORK, `${label}-${port}.log`);
  const out = fs.openSync(logFile, "w");
  const child = forkServer({
    server: SERVER,
    electron: ELECTRON,
    out,
    env: {
      ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(port),
      NODE_ENV: "development", SESSION_SECRET: "ref-update-secret", ...extraEnv,
    },
  });

  const base = `http://localhost:${port}/api`;
  let cookie = "";
  const api = async (method, p, body) => {
    const res = await fetch(base + p, {
      method,
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const sc = res.headers.get("set-cookie");
    if (sc) cookie = sc.split(";")[0];
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data };
  };

  const deadline = Date.now() + 25000;
  for (;;) {
    if (Date.now() > deadline) {
      const log = fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8").slice(-1500) : "";
      throw new Error(`${label} server never came up\n${log}`);
    }
    try { await fetch(`${base}/health`); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  return {
    api,
    log: () => (fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8") : ""),
    // R-36: quit through R-31's shutdown path so the WAL is checkpointed back
    // into the main file. A SIGKILL left an un-checkpointed -wal, and a
    // readOnly DatabaseSync cannot replay one (it cannot create the -shm
    // index), which surfaces as a bare "disk I/O error".
    stop: async () => {
      await stopServer(child);
      try { fs.closeSync(out); } catch { /* already closed */ }
    },
  };
}

console.log("=".repeat(72));
console.log("  R-33 REFERENCE DATA UPDATES REACH AN EXISTING SAVE");
console.log("=".repeat(72));

// ── A/B/C: a save with a stale safe column, a stale name, and real gameplay state ──
console.log("\nA/B/C. A SAVE WITH STALE REFERENCE DATA AND REAL CAREER PROGRESS");
{
  const dbFile = path.join(WORK, "stale-save.sqlite");
  fs.copyFileSync(SHIPPED, dbFile);

  // Player 289 (Amara Odhiambo, Kenya) — any real player row works; picked
  // for no reason other than it being a normal, uncomplicated senior row.
  const PLAYER_ID = 289;

  const starterRow = (() => {
    const db = new DatabaseSync(SHIPPED, { readOnly: true });
    const row = db.prepare("SELECT id, name, height FROM players WHERE id = ?").get(PLAYER_ID);
    db.close();
    return row;
  })();

  // Give this save a real career with real gameplay-written state FIRST,
  // before any staleness exists — this boot's own reference-sync pass finds
  // nothing to fix yet (the save still matches the starter DB exactly), so
  // it cannot be the boot the assertions below are about.
  let careerSaveId, teamId, careerPlayerStateId;
  {
    const srv = await boot(dbFile, "seed-career", { STARTER_DB_PATH: SHIPPED });
    const profileRes = await srv.api("POST", "/profiles", { name: "RefUpdate" });
    await srv.api("POST", `/profiles/${profileRes.data.id}/select`);
    const careerRes = await srv.api("POST", "/careers", {
      slotNumber: 1, managerName: "RefUpdate", managerNationality: "Australia",
      clubName: "RefUpdate FC", originalClubName: "RefUpdate FC", season: "Season 1",
      budget: "500000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a",
    });
    careerSaveId = careerRes.data.id;
    teamId = careerRes.data.teamId;

    // Sign player 289 onto the new team so it has career_player_state.
    await srv.api("POST", "/contracts", {
      playerId: PLAYER_ID, salary: 9500, endDate: "2026-12-31", bonusPerWin: 0, squadRole: "interchange",
    });
    await srv.stop();
    await new Promise((r) => setTimeout(r, 600));
  }

  // NOW make the save stale, after the career-seeding boot has already run
  // its own (no-op) reference-sync pass, so the boot under test below is the
  // one that actually performs the fix: height (safe, never
  // gameplay-written) drifted from a starter-DB correction, AND name
  // (gameplay-writable via the Edit Player feature) was deliberately changed
  // by this save's own manager — both differ from the starter DB, on
  // purpose, to prove the two get opposite treatment. Also simulate real
  // training progress: bump this career's OWN copy of speed in
  // career_player_state — completely separate storage from players'
  // reference row, the thing part C must prove the reference-sync pass never
  // touches.
  const STALE_HEIGHT = starterRow.height + 7;
  const MANAGER_RENAMED_TO = "Manager's Custom Name";
  const TRAINED_SPEED = 91;
  {
    const db = new DatabaseSync(dbFile);
    db.prepare("UPDATE players SET height = ? WHERE id = ?").run(STALE_HEIGHT, PLAYER_ID);
    db.prepare("UPDATE players SET name = ? WHERE id = ?").run(MANAGER_RENAMED_TO, PLAYER_ID);
    const row = db.prepare(
      "SELECT id FROM career_player_state WHERE career_save_id = ? AND player_id = ?",
    ).get(careerSaveId, PLAYER_ID);
    careerPlayerStateId = row?.id;
    if (careerPlayerStateId) {
      db.prepare("UPDATE career_player_state SET speed = ? WHERE id = ?").run(TRAINED_SPEED, careerPlayerStateId);
    }
    db.close();
  }
  check("career_player_state row exists for the signed player (setup)", !!careerPlayerStateId, `id=${careerPlayerStateId}`);

  const before = new DatabaseSync(dbFile, { readOnly: true });
  const rowBefore = before.prepare("SELECT id, name, height FROM players WHERE id = ?").get(PLAYER_ID);
  before.close();
  check("fixture really is stale before the boot under test (height drifted, name manager-edited)",
    rowBefore.height === STALE_HEIGHT && rowBefore.name === MANAGER_RENAMED_TO,
    JSON.stringify(rowBefore));

  // ── The actual boot under test ──────────────────────────────────────────
  const srv = await boot(dbFile, "stale-save-boot", { STARTER_DB_PATH: SHIPPED });
  const log = srv.log();
  await srv.stop();

  const after = new DatabaseSync(dbFile, { readOnly: true });
  const rowAfter = after.prepare("SELECT id, name, height FROM players WHERE id = ?").get(PLAYER_ID);
  const stateAfter = after.prepare("SELECT speed FROM career_player_state WHERE id = ?").get(careerPlayerStateId);
  after.close();

  // A. safe column caught up
  check("A. players.height (safe, never gameplay-written) caught up to the starter DB",
    rowAfter.height === starterRow.height, `expected ${starterRow.height}, got ${rowAfter.height}`);
  check("A. the boot log names the update",
    /reference data backfilled/.test(log) && /updated/.test(log) && /players/.test(log),
    /reference data backfilled/.test(log) ? "" : "log never mentions the backfill");

  // B. gameplay-writable column left alone
  check("B. players.name (gameplay-writable via Edit Player) is NOT overwritten, even though it's stale",
    rowAfter.name === MANAGER_RENAMED_TO, `expected "${MANAGER_RENAMED_TO}", got "${rowAfter.name}"`);

  // C. real per-career gameplay state untouched
  check("C. career_player_state.speed (real gameplay-written state) is completely untouched",
    stateAfter?.speed === TRAINED_SPEED, `expected ${TRAINED_SPEED}, got ${stateAfter?.speed}`);
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch {} }
process.exit(failures > 0 ? 1 : 0);
