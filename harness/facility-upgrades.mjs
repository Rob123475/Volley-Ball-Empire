/**
 * D-1 — a building under construction is never offered as "Upgrade Ready".
 *
 * Rob, 29 Sep: he bought the Training Centre's level-2 upgrade on 1 Jan, the
 * Facilities page said "UPGRADING -> LEVEL 2, 3 rounds remaining", and the
 * dashboard's Attention Required kept offering "Upgrade Ready: Level 1 -> 2 for
 * $20,000" days later. The card read `level` and never looked at
 * `upgrading_to_level`; and a finished build was only collected when somebody
 * opened the Facilities page, so the building stayed at its old level for every
 * bonus until then. Builds now finish on the clock (utils/facilityUpgrades.ts).
 *
 * One career. Every other building is set to the top level first, so the
 * Training Centre is the only one that can produce an upgrade card and its
 * presence or absence is unambiguous (the card list keeps the three cheapest).
 *
 * Usage: node harness/facility-upgrades.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-facility-upgrades-"));
const PORT = 4910;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log("  D-1 NO \"UPGRADE READY\" FOR A BUILDING UNDER CONSTRUCTION");
console.log("=".repeat(72));

if (!fs.existsSync(SERVER)) { console.error(`[facility-upgrades] FAILED: ${SERVER} not built.`); process.exit(1); }

let cookie = "";
async function api(method, p, body) {
  const res = await fetch(BASE + p, {
    method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const text = await res.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

const dbFile = path.join(WORK, "facilities.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "facility-upgrades" },
});

const upgradeCards = async () => ((await api("GET", "/attention-items")).data?.items ?? []).filter((i) => i.category === "Facilities");
const training = (cards) => cards.find((c) => c.id === "upgrade-training_complex");
/** Straight from the save, so no read path gets a chance to collect a finished build first. */
function trainingRow(teamId) {
  const d = new DatabaseSync(dbFile);
  try {
    return d.prepare("SELECT level, upgrading_to_level AS upTo, upgrade_completes_at_round AS at FROM facilities WHERE team_id = ? AND type = 'training_complex'").get(teamId);
  } finally { d.close(); }
}

try {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }

  const prof = await api("POST", "/profiles", { name: "Facility Test" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const clubs = (await api("GET", "/club-templates")).data;
  const club = (Array.isArray(clubs) ? clubs : clubs?.clubs ?? [])[0];
  const c = await api("POST", "/careers", {
    slotNumber: 1, managerName: "Facility Test", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0,
  });
  if (c.status >= 300) throw new Error(`career: HTTP ${c.status}`);
  const teamId = (await api("GET", "/team")).data?.id;

  await api("GET", "/facilities"); // creates the club's facility rows
  {
    const d = new DatabaseSync(dbFile);
    d.prepare("UPDATE facilities SET level = 10 WHERE team_id = ? AND type <> 'training_complex'").run(teamId);
    d.close();
  }

  const before = training(await upgradeCards());
  check("before buying: the Training Centre is offered, Level 1 -> 2 for $20,000",
    before && /Level 1 → 2 for \$20,000/.test(before.description), JSON.stringify(before ?? null));

  const buy = await api("POST", "/facilities/training_complex/upgrade");
  const row = trainingRow(teamId);
  check("the upgrade is bought and under construction", buy.status === 200 && row.level === 1 && row.upTo === 2,
    `HTTP ${buy.status}; level ${row.level}, upgrading to ${row.upTo}, completes round ${row.at}`);

  const during = await upgradeCards();
  check("while it is being built: no Upgrade Ready card for it", !training(during), JSON.stringify(during));

  // A few days on, still building: the card must stay away (Rob saw it days later).
  for (let i = 0; i < 3; i++) await api("POST", "/calendar/advance");
  const later = trainingRow(teamId);
  const laterCards = await upgradeCards();
  check("days later, still building: still no card for it", later.upTo === 2 && !training(laterCards),
    `${(await api("GET", "/calendar")).data?.currentDate}: level ${later.level} -> ${later.upTo}; ${laterCards.length} cards`);

  const upcoming = ((await api("GET", "/events/upcoming")).data?.items ?? []).find((e) => e.type === "facility_upgrade");
  check("the upcoming-events list shows it as building", upcoming && /Level 1 → 2/.test(upcoming.subtitle ?? ""), JSON.stringify(upcoming ?? null));

  // Run the clock (only the clock: no screen is read in between) until the build's round arrives.
  let done = trainingRow(teamId), days = 0;
  while (done.upTo != null && days < 40) {
    const r = await api("POST", "/calendar/advance");
    if (r.data?.matchDay || r.data?.blocked) break;
    days++;
    done = trainingRow(teamId);
  }
  const today = (await api("GET", "/calendar")).data?.currentDate;
  check("the build finishes on the clock, without the Facilities page being opened",
    done.level === 2 && done.upTo == null && done.at == null, `${today}, after ${days} more days: level ${done.level}`);

  const after = training(await upgradeCards());
  check("completed: the card for the NEXT level can appear, Level 2 -> 3 for $40,000",
    after && /Level 2 → 3 for \$40,000/.test(after.description), JSON.stringify(after ?? null));

  const upcomingAfter = ((await api("GET", "/events/upcoming")).data?.items ?? []).filter((e) => e.type === "facility_upgrade");
  check("and nothing still says it is being built", upcomingAfter.length === 0, JSON.stringify(upcomingAfter));

  // The dashboard's own facility tiles: the amber "upgrade" badge and cost must
  // not show on a building under construction either.
  const dash = fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", "pages", "dashboard.tsx"), "utf8");
  check("the dashboard's facility tile does not offer an upgrade while building",
    /const canUpgrade = !underConstruction && /.test(dash) && /upgradingToLevel: f\.upgradingToLevel/.test(dash));
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  try { await stopServer(child); } catch { /* already stopped */ }
  try { fs.closeSync(out); } catch { /* closed */ }
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
