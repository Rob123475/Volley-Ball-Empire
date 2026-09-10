/**
 * R-34 — players added to the starter DB after a save was created never
 * appear in that save.
 *
 * ── The bug this exists for ─────────────────────────────────────────────────
 * R-28/R-33 only ever touch a row a save ALREADY HAS — a player added to the
 * starter DB after a save was created is never inserted at all, so they can
 * never appear anywhere in that save: not the market, not signable, not on
 * an Olympic squad count. Concretely: 8 of the 24 Europe seniors added by
 * seed-europe-players.ts are missing entirely from Rob's live save.
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 * A. A save with one existing, already-played career boots against a starter
 *    DB carrying 3 extra senior players (+1 spare) it doesn't have. The 3
 *    seniors are inserted into the save and appear as free agents for that
 *    EXISTING career via the real GET /players/free-agents endpoint — not a
 *    new career, the one that already existed before this boot.
 * B. Their player_v4 block is copied verbatim from the starter DB (the exact
 *    JSON planted there, byte for byte) — not regenerated, not left null.
 * C. The 4th player, player_type='spare', is NOT in the free-agents list —
 *    isSeniorPlayer()'s existing exclusion holds; this pass adds no second,
 *    bespoke "skip spares" rule and doesn't need one.
 * D. career_player_state exists for all 4 (spare included) with team_id NULL
 *    — seedPlayerStateRows() doesn't discriminate, matching what a brand-new
 *    career already does; visibility is enforced at the read side, not by
 *    withholding state.
 * E. Regional league untouched: no second season/fixture set was created for
 *    this boot's existing career — proving seedRegionalLeagueTx() was
 *    correctly NOT re-run against an existing career.
 *
 * Usage: node harness/reference-data-new-players.mjs
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
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-ref-newplayers-"));

let failures = 0;
let checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

if (!fs.existsSync(SERVER)) {
  console.error(`[reference-data-new-players] FAILED: ${SERVER} not built. Run the api-server build first.`);
  process.exit(1);
}

let portCounter = 4650;

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
      NODE_ENV: "development", SESSION_SECRET: "ref-newplayers-secret", ...extraEnv,
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
console.log("  R-34 NEW STARTER-DB PLAYERS REACH AN EXISTING SAVE");
console.log("=".repeat(72));

const dbFile = path.join(WORK, "existing-save.sqlite");
fs.copyFileSync(SHIPPED, dbFile);

// Test player_v4 blocks — small but genuinely valid-shaped, with a
// distinguishing marker (a made-up regen_seed) so "copied verbatim" is a
// byte comparison, not a guess.
function testV4(id, marker) {
  return JSON.stringify({
    schema_version: "players_v4_ultimate_dynasty",
    player_id: id,
    regen: { regen_seed: marker },
  });
}

const NEW_SENIORS = [
  { id: 9001, name: "Harness Player One",   nationality: "Iceland", continent: "europe" },
  { id: 9002, name: "Harness Player Two",   nationality: "Iceland", continent: "europe" },
  { id: 9003, name: "Harness Player Three", nationality: "Iceland", continent: "europe" },
];
const NEW_SPARE = { id: 9004, name: "Harness Spare Four", nationality: "Iceland", continent: "europe" };

console.log("\nA/B/C/D/E. AN EXISTING CAREER GAINS 3 NEW STARTER-DB PLAYERS AT BOOT");
{
  let careerSaveId, teamId, profileId;

  // Boot 1: create the "existing career" this save already has, before any
  // of the new players exist anywhere.
  {
    const srv = await boot(dbFile, "seed-career", { STARTER_DB_PATH: SHIPPED });
    const profileRes = await srv.api("POST", "/profiles", { name: "RefNewPlayers" });
    profileId = profileRes.data.id;
    await srv.api("POST", `/profiles/${profileId}/select`);
    const careerRes = await srv.api("POST", "/careers", {
      slotNumber: 1, managerName: "RefNewPlayers", managerNationality: "Australia",
      clubName: "RefNewPlayers FC", originalClubName: "RefNewPlayers FC", season: "Season 1",
      budget: "500000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a",
    });
    careerSaveId = careerRes.data.id;
    teamId = careerRes.data.teamId;
    check("existing career created", !!teamId, `teamId=${teamId}`);
    await srv.stop();
    await new Promise((r) => setTimeout(r, 600));
  }

  // Regional league fingerprint BEFORE the sync boot, to prove Pass 3 does
  // not re-run seedRegionalLeagueTx against an existing career.
  const leagueBefore = (() => {
    const db = new DatabaseSync(dbFile, { readOnly: true });
    const seasons = db.prepare(
      "SELECT COUNT(*) as n FROM regional_league_seasons WHERE career_save_id = ?",
    ).get(careerSaveId);
    const fixtures = db.prepare(
      "SELECT COUNT(*) as n FROM regional_league_fixtures WHERE career_save_id = ?",
    ).get(careerSaveId);
    db.close();
    return { seasons: seasons.n, fixtures: fixtures.n };
  })();

  // Build a starter DB with 3 extra senior players + 1 extra spare, none of
  // which exist in dbFile yet.
  const starterExtra = path.join(WORK, "starter-with-extras.sqlite");
  fs.copyFileSync(SHIPPED, starterExtra);
  {
    const db = new DatabaseSync(starterExtra);
    const insert = db.prepare(`
      INSERT INTO players (id, name, nationality, continent, base_age, player_type, player_v4, created_at)
      VALUES (?, ?, ?, ?, 22, ?, ?, unixepoch())
    `);
    for (const p of NEW_SENIORS) insert.run(p.id, p.name, p.nationality, p.continent, "senior", testV4(p.id, `MARKER-${p.id}`));
    insert.run(NEW_SPARE.id, NEW_SPARE.name, NEW_SPARE.nationality, NEW_SPARE.continent, "spare", testV4(NEW_SPARE.id, `MARKER-${NEW_SPARE.id}`));
    db.close();
  }

  const beforeSync = new DatabaseSync(dbFile, { readOnly: true });
  const idsBefore = [9001, 9002, 9003, 9004].filter((id) =>
    beforeSync.prepare("SELECT 1 FROM players WHERE id = ?").get(id));
  beforeSync.close();
  check("fixture really is missing all 4 new players before the sync boot", idsBefore.length === 0, `present: ${idsBefore.join(",")}`);

  // Boot 2: the actual sync — same save, now compared against the starter
  // DB carrying the 4 new rows. A fresh boot means a fresh session, so
  // re-select the same profile/career before reading the market.
  const srv = await boot(dbFile, "sync-boot", { STARTER_DB_PATH: starterExtra });
  const log = srv.log();
  await srv.api("POST", `/profiles/${profileId}/select`);
  await srv.api("POST", `/careers/${careerSaveId}/load`);
  const freeAgents = await srv.api("GET", "/players/free-agents");
  check("free-agents request actually succeeded (setup)", freeAgents.status === 200,
    `HTTP ${freeAgents.status} ${JSON.stringify(freeAgents.data).slice(0, 200)}`);
  await srv.stop();
  await new Promise((r) => setTimeout(r, 600));

  check("the boot log names the players insert and the career it seeded",
    /reference data backfilled/.test(log) && /players/.test(log) && /seededIntoCareers/.test(log),
    /reference data backfilled/.test(log) ? "" : "log never mentions the backfill");

  // A. the 3 seniors are free agents for the EXISTING career
  const freeAgentIds = new Set((freeAgents.data ?? []).map((p) => p.id));
  check("A. all 3 new seniors appear as free agents for the existing career",
    NEW_SENIORS.every((p) => freeAgentIds.has(p.id)),
    `free agent ids seen: ${[...freeAgentIds].filter((id) => id >= 9000).join(",")}`);

  // B. player_v4 copied verbatim
  const after = new DatabaseSync(dbFile, { readOnly: true });
  const v4Matches = NEW_SENIORS.every((p) => {
    const row = after.prepare("SELECT player_v4 FROM players WHERE id = ?").get(p.id);
    return row?.player_v4 === testV4(p.id, `MARKER-${p.id}`);
  });
  check("B. player_v4 was copied verbatim (byte-identical to the starter DB's)", v4Matches);

  // C. the spare is NOT a visible free agent
  check("C. the spare (player_type='spare') is NOT in the free-agents list",
    !freeAgentIds.has(NEW_SPARE.id), `spare id ${NEW_SPARE.id} present: ${freeAgentIds.has(NEW_SPARE.id)}`);

  // D. career_player_state exists for all 4, including the spare, team_id NULL
  const stateRows = after.prepare(
    "SELECT player_id, team_id FROM career_player_state WHERE career_save_id = ? AND player_id IN (9001,9002,9003,9004)",
  ).all(careerSaveId);
  check("D. career_player_state exists for all 4 new players (spare included), all free (team_id NULL)",
    stateRows.length === 4 && stateRows.every((r) => r.team_id === null),
    JSON.stringify(stateRows));

  // E. regional league was not duplicated
  const leagueAfter = {
    seasons: after.prepare(
      "SELECT COUNT(*) as n FROM regional_league_seasons WHERE career_save_id = ?",
    ).get(careerSaveId).n,
    fixtures: after.prepare(
      "SELECT COUNT(*) as n FROM regional_league_fixtures WHERE career_save_id = ?",
    ).get(careerSaveId).n,
  };
  after.close();
  check("E. regional league season/fixture counts unchanged — not re-seeded against an existing career",
    leagueAfter.seasons === leagueBefore.seasons && leagueAfter.fixtures === leagueBefore.fixtures,
    `before ${JSON.stringify(leagueBefore)} after ${JSON.stringify(leagueAfter)}`);
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch {} }
process.exit(failures > 0 ? 1 : 0);
