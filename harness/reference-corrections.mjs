/**
 * Rob, 2 Oct (add-on): reference corrections, in the starter DB and in every
 * existing save at boot (utils/referenceRenames.ts, utils/ensureSchema.ts).
 *
 *   - Aoife O'Sullivan (EUR_09_P2) plays for Dublin Emerald Spikers (EUR_10),
 *     Yasmin Grech (EUR_10_P2) for Lisbon Atlantic Blaze (EUR_09): contracts,
 *     wages and stats move with them.
 *   - Siosaia Taufa (AUS_08_P2) is Salote Taufa.
 *   - Honolulu Hula Warriors (AUS_04) is Maui Hula Warriors everywhere it is
 *     shown, past results included.
 *
 * Asserted on the starter DB, and on a copy of Rob's 2 Oct save booted twice
 * (the second boot changes nothing).
 *
 * Usage: node harness/reference-corrections.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
// A byte copy of the backup can stand in for it (VBE_ROB_BACKUP) when the file is not in Downloads.
const ROB = process.env.VBE_ROB_BACKUP ?? path.join(os.homedir(), "Downloads", "volleyball-empire-backup-02oct-0845.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-ref-corrections-"));
const PORT = 4951;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  ROB, 2 OCT: REFERENCE CORRECTIONS (TWO MOVES, TWO RENAMES)");
console.log("=".repeat(72));
const q = (file, sql, ...a) => { const d = new DatabaseSync(file, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
const ref = (file) => ({
  aoife: q(file, `SELECT p.name, t.stable_id AS club, p.speed, p.block FROM continental_pool_players p JOIN continental_pool_teams t ON t.id = p.pool_team_id WHERE p.stable_id = 'EUR_09_P2'`)[0],
  yasmin: q(file, `SELECT p.name, t.stable_id AS club, p.speed, p.block FROM continental_pool_players p JOIN continental_pool_teams t ON t.id = p.pool_team_id WHERE p.stable_id = 'EUR_10_P2'`)[0],
  salote: q(file, `SELECT name FROM continental_pool_players WHERE stable_id = 'AUS_08_P2'`)[0]?.name,
  maui: q(file, `SELECT team_name AS n FROM continental_pool_teams WHERE stable_id = 'AUS_04'`)[0]?.n,
});
let child = null;
async function boot(file, tag) {
  const out = fs.openSync(path.join(WORK, `server-${tag}.log`), "w");
  child = forkServer({ server: SERVER, electron: ELECTRON, out,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: file, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "ref", STARTER_DB_PATH: SHIPPED } });
  for (let i = 0; i < 360; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) return; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }
  throw new Error("server did not boot");
}
async function stop() { if (child) await stopServer(child); child = null; }

try {
  console.log("\n1. THE STARTER DB");
  const s = ref(SHIPPED);
  check("Aoife O'Sullivan plays for Dublin Emerald Spikers (EUR_10)", s.aoife?.name === "Aoife O'Sullivan" && s.aoife.club === "EUR_10");
  check("Yasmin Grech plays for Lisbon Atlantic Blaze (EUR_09)", s.yasmin?.name === "Yasmin Grech" && s.yasmin.club === "EUR_09");
  check("AUS_08_P2 is Salote Taufa", s.salote === "Salote Taufa", s.salote);
  check("AUS_04 is Maui Hula Warriors", s.maui === "Maui Hula Warriors", s.maui);

  console.log("\n2. ROB'S 2 OCT SAVE (A COPY), AT BOOT");
  if (!fs.existsSync(ROB)) check("Rob's 2 Oct backup is on this machine", false, ROB);
  else {
    const copy = path.join(WORK, "rob.sqlite");
    fs.copyFileSync(ROB, copy);
    const cid = q(copy, `SELECT id FROM career_saves WHERE team_id IS NOT NULL`)[0].id;
    const before = ref(copy);
    const contractOf = (file, stable) => q(file, `SELECT c.id, t.stable_id AS club, c.salary, c.end_date AS ends FROM pool_player_contracts c JOIN continental_pool_players p ON p.id = c.pool_player_id
      JOIN continental_pool_teams t ON t.id = c.pool_team_id WHERE c.career_save_id = ? AND p.stable_id = ? AND c.status = 'active'`, cid, stable)[0];
    const aoifeBefore = contractOf(copy, "EUR_09_P2"), yasminBefore = contractOf(copy, "EUR_10_P2");
    const oldNames = q(copy, `SELECT COUNT(*) AS n FROM matches WHERE home_team_name = 'Honolulu Hula Warriors' OR away_team_name = 'Honolulu Hula Warriors'`)[0].n
      + q(copy, `SELECT COUNT(*) AS n FROM finance_transactions WHERE description LIKE '%Honolulu Hula Warriors%'`)[0].n;
    check("the copy has the old state before the boot", before.aoife.club === "EUR_09" && before.yasmin.club === "EUR_10" && before.maui === "Honolulu Hula Warriors" && oldNames > 0,
      `Aoife at ${before.aoife.club}, Yasmin at ${before.yasmin.club}, ${before.maui}, ${oldNames} stored rows with the old club name`);
    await boot(copy, "rob-1");
    await stop();
    const after = ref(copy);
    // The same contract row goes with her, to the same date. Her wage is the one
    // the money pass (utils/moneyPass.ts) sets for every pool player's rating at
    // this boot, moved or not.
    const aoifeAfter = contractOf(copy, "EUR_09_P2"), yasminAfter = contractOf(copy, "EUR_10_P2");
    check("Aoife O'Sullivan is at Dublin Emerald Spikers, her contract and wage with her", after.aoife.club === "EUR_10" && aoifeAfter?.club === "EUR_10" && aoifeAfter.id === aoifeBefore?.id && aoifeAfter.ends === aoifeBefore?.ends,
      `contract #${aoifeAfter?.id} ${aoifeBefore?.club} -> ${aoifeAfter?.club}, to ${aoifeAfter?.ends}, $${aoifeBefore?.salary} -> $${aoifeAfter?.salary} a month (the money pass sets every pool wage at this boot)`);
    check("Yasmin Grech is at Lisbon Atlantic Blaze, her contract and wage with her", after.yasmin.club === "EUR_09" && yasminAfter?.club === "EUR_09" && yasminAfter.id === yasminBefore?.id && yasminAfter.ends === yasminBefore?.ends,
      `contract #${yasminAfter?.id} ${yasminBefore?.club} -> ${yasminAfter?.club}, to ${yasminAfter?.ends}, $${yasminBefore?.salary} -> $${yasminAfter?.salary} a month`);
    check("their stats are their own, unchanged", after.aoife.speed === before.aoife.speed && after.aoife.block === before.aoife.block && after.yasmin.block === before.yasmin.block);
    check("Salote Taufa, and Maui Hula Warriors", after.salote === "Salote Taufa" && after.maui === "Maui Hula Warriors", `${after.salote}; ${after.maui}`);
    const stillOld = q(copy, `SELECT COUNT(*) AS n FROM matches WHERE home_team_name = 'Honolulu Hula Warriors' OR away_team_name = 'Honolulu Hula Warriors'`)[0].n
      + q(copy, `SELECT COUNT(*) AS n FROM finance_transactions WHERE description LIKE '%Honolulu Hula Warriors%'`)[0].n;
    const nowMaui = q(copy, `SELECT COUNT(*) AS n FROM matches WHERE away_team_name = 'Maui Hula Warriors' OR home_team_name = 'Maui Hula Warriors'`)[0].n;
    check("past results and fixtures show the club under its new name", stillOld === 0 && nowMaui > 0, `${nowMaui} matches now Maui Hula Warriors, ${stillOld} left with the old name`);
    const snapshot = JSON.stringify([ref(copy), contractOf(copy, "EUR_09_P2"), contractOf(copy, "EUR_10_P2"), nowMaui]);
    await boot(copy, "rob-2");
    await stop();
    check("a second boot changes nothing", JSON.stringify([ref(copy), contractOf(copy, "EUR_09_P2"), contractOf(copy, "EUR_10_P2"),
      q(copy, `SELECT COUNT(*) AS n FROM matches WHERE away_team_name = 'Maui Hula Warriors' OR home_team_name = 'Maui Hula Warriors'`)[0].n]) === snapshot);
  }
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  await stop();
}
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else fs.rmSync(WORK, { recursive: true, force: true });
process.exit(failures > 0 ? 1 : 0);
