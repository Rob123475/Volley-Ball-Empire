/**
 * L-02b — retirement at forty, and what a retired athlete leaves behind.
 *
 * Rob's rule (22 Sep): a player retires at the end of the season she turns 40.
 * Her contract closes, she leaves the squad, and no renewal path can see her.
 * If no club has put her in its Hall of Fame her career record is deleted and
 * her name and portrait go back into circulation; if a club has, everything
 * about her is kept.
 *
 * What this suite is here to catch, from the thirty-season run (L-01 finding 4):
 * a retired player's contract row stayed active in GET /contracts, so every
 * season began with renewals refused as "no longer in your squad" — 53 of them
 * across thirty seasons. Nothing expired the row and nothing removed it.
 *
 * Own database, own server on port 4523. Ages are set straight in the database:
 * walking a career to season fifteen to age a squad out would take twenty
 * minutes to prove what one boundary proves.
 *
 * Usage: node harness/retirement.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";
import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healAllSquads } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-retirement-"));
const PORT = 4523;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log("  L-02b RETIREMENT AT FORTY, AND THE NAMES AND FACES IT RETURNS");
console.log("=".repeat(72));

const dbFile = path.join(WORK, "retirement.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const logFile = path.join(WORK, "server.log");
const out = fs.openSync(logFile, "w");

const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: {
    ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT),
    NODE_ENV: "development", SESSION_SECRET: "retirement-secret",
  },
});

const BASE = `http://localhost:${PORT}/api`;
let cookie = "";
const api = async (method, p, body) => {
  const res = await fetch(BASE + p, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const sc = res.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
};

const read = (q, ...a) => {
  const d = new DatabaseSync(dbFile, { readOnly: true });
  const r = d.prepare(q).all(...a);
  d.close();
  return r;
};
const write = (q, ...a) => {
  const d = new DatabaseSync(dbFile);
  d.prepare(q).run(...a);
  d.close();
};

/** Play whatever the calendar is blocked on, then move the day along. */
async function step() {
  const r = await api("POST", "/calendar/advance", {});
  if (r.status >= 400) return { stopped: `advance HTTP ${r.status} ${JSON.stringify(r.data).slice(0, 90)}` };
  if (r.data?.blocked === "pending_match") {
    await api("POST", `/matches/${r.data.pendingMatchId}/simulate`, {});
    await api("POST", "/calendar/skip-match", {});
    return {};
  }
  const mid = r.data?.matchDay?.matchId;
  if (mid) { await api("POST", `/matches/${mid}/simulate`, {}); await api("POST", "/calendar/dismiss-match", {}); }
  const roll = r.data?.seasonRollover;
  if (roll && roll.kind !== "none") return { roll };
  return {};
}

try {
  const dl = Date.now() + 30000;
  for (;;) {
    if (Date.now() > dl) throw new Error("server never came up");
    try { await fetch(`${BASE}/healthz`); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }

  const prof = await api("POST", "/profiles", { name: "Retirement" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const career = await api("POST", "/careers", {
    slotNumber: 1, managerName: "Retirement", managerNationality: "Australia",
    clubName: "Retirement FC", originalClubName: "Retirement FC",
    budget: "500000", difficulty: "established",
    primaryColor: "#0a0", secondaryColor: "#00a", crestShapeIndex: 0,
    season: "Season 1", locationId: 1,
  });
  check("a career was created", career.status === 200, `HTTP ${career.status}`);
  const careerSaveId = career.data?.id;
  const teamId = career.data?.teamId;

  // ── The squad this career retires ─────────────────────────────────────────
  // A career starts with its three seniors already signed (MAX_SENIORS is 3, so
  // there is no room to sign more): one the club will honour, one it will not,
  // and one nowhere near forty who must be left alone.
  const roster0 = (await api("GET", "/team/roster")).data ?? {};
  const squad = [...(roster0.activePlayers ?? []), ...(roster0.benchPlayers ?? [])]
    .filter((p) => p.age >= 19);
  check("the career starts with three seniors under contract", squad.length >= 3, `${squad.length} senior(s)`);
  const [legend, journeyman, youngster] = squad;
  const contractsNow = read(`SELECT COUNT(*) AS n FROM contracts
                              WHERE team_id = ? AND status = 'active'
                                AND player_id IN (?, ?, ?)`,
    teamId, legend.id, journeyman.id, youngster.id)[0].n;
  check("each of the three holds a live contract", contractsNow === 3, `${contractsNow} of 3`);

  // The club has honoured one of them. The induction window itself — the
  // recommendations, the two-season cycle, the cap of six — is the Hall of Fame
  // item; this suite only needs the row to exist.
  write(`INSERT INTO club_hall_of_fame (career_save_id, team_id, player_id, player_name, season_inducted, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
    careerSaveId, teamId, legend.id, legend.name, 2026, Date.now());

  // Old enough to go at this boundary; the third is not.
  write(`UPDATE career_player_state SET age = 39 WHERE career_save_id = ? AND player_id IN (?, ?)`,
    careerSaveId, legend.id, journeyman.id);
  write(`UPDATE career_player_state SET age = 24 WHERE career_save_id = ? AND player_id = ?`,
    careerSaveId, youngster.id);

  const before = read(`SELECT COUNT(*) AS n FROM contracts WHERE team_id = ? AND status = 'active'`, teamId)[0].n;
  check("the club's contracts are all live before the boundary", before >= 3, `${before}`);

  // ── 1. The season turns ───────────────────────────────────────────────────
  console.log("\n1. THE SEASON TURNS AND THE FORTY-YEAR-OLDS GO");
  let rolled = null, days = 0, stopped = "";
  for (let i = 0; i < 500; i++) {
    healAllSquads(dbFile);
    const s = await step();
    days++;
    if (s.stopped) { stopped = s.stopped; break; }
    if (s.roll) { rolled = s.roll; break; }
  }
  check("the season rolled over", rolled !== null, stopped || `after ${days} days`);

  const state = (id) => read(`SELECT age, is_retired AS retired, team_id AS team, retired_season_year AS year
                               FROM career_player_state WHERE career_save_id = ? AND player_id = ?`,
    careerSaveId, id)[0] ?? null;

  check("the player who did not turn forty is untouched",
    state(youngster.id)?.retired === 0 && state(youngster.id)?.team === teamId,
    JSON.stringify(state(youngster.id)));

  // ── 2. The contract closes with the career ────────────────────────────────
  console.log("\n2. A RETIRED PLAYER'S CONTRACT IS CLOSED, NOT LEFT LYING ACTIVE");
  const stillActive = read(`SELECT c.id FROM contracts c
                             WHERE c.team_id = ? AND c.player_id IN (?, ?) AND c.status = 'active'`,
    teamId, legend.id, journeyman.id);
  check("neither retiree still holds an active contract row",
    stillActive.length === 0, `${stillActive.length} still active`);

  const listed = (await api("GET", "/contracts")).data ?? [];
  check("and neither appears on the Contracts page",
    !listed.some((c) => c.playerId === legend.id || c.playerId === journeyman.id),
    `${listed.length} contract(s) listed`);

  const closed = read(`SELECT id FROM contracts WHERE player_id = ? AND team_id = ?`, journeyman.id, teamId)[0];
  const renewDead = await api("POST", `/contracts/${closed?.id}/renew`, { length: "1s" });
  check("renewing a retired player's contract is refused — the thirty-season run hit this 53 times",
    renewDead.status >= 400, `HTTP ${renewDead.status} ${renewDead.data?.error ?? ""}`);

  const roster = (await api("GET", "/team/roster")).data ?? {};
  const inSquad = [...(roster.activePlayers ?? []), ...(roster.benchPlayers ?? [])]
    .filter((p) => p.id === legend.id || p.id === journeyman.id);
  check("neither is in the squad or on the bench any more", inSquad.length === 0,
    inSquad.map((p) => p.name).join(", ") || "gone from both");

  const market = (await api("GET", "/players/free-agents")).data ?? [];
  const onMarket = (Array.isArray(market) ? market : market.players ?? [])
    .filter((p) => p.id === legend.id || p.id === journeyman.id);
  check("and neither is back on the market as a free agent", onMarket.length === 0,
    onMarket.map((p) => p.name).join(", ") || "neither offered");

  // ── 3. Honoured or forgotten ──────────────────────────────────────────────
  console.log("\n3. THE HALL OF FAME DECIDES WHAT IS KEPT");
  const retirements = read(`SELECT * FROM player_retirements WHERE career_save_id = ?`, careerSaveId);
  check("both retirements were recorded", retirements.length === 2, `${retirements.length} row(s)`);

  const legendRow = retirements.find((r) => r.player_id === legend.id);
  const otherRow = retirements.find((r) => r.player_id === journeyman.id);

  check("the honoured player keeps her career record",
    state(legend.id) !== null && state(legend.id)?.retired === 1,
    JSON.stringify(state(legend.id)));
  check("and her name and face are hers for good",
    legendRow?.in_hall_of_fame === 1 && legendRow?.name_reused_at != null && legendRow?.portrait_reused_at != null,
    `hof ${legendRow?.in_hall_of_fame}, name reused ${legendRow?.name_reused_at}, portrait ${legendRow?.portrait_reused_at}`);

  check("the player nobody honoured has her career record deleted",
    state(journeyman.id) === null, JSON.stringify(state(journeyman.id)));
  check("but what she was is remembered — the record is gone, the person is not",
    otherRow?.name === journeyman.name && otherRow?.in_hall_of_fame === 0 && otherRow?.age === 40,
    `${otherRow?.name}, age ${otherRow?.age}, ${otherRow?.image_url}`);

  // Her name and face go back into circulation. The academy intake at this same
  // boundary draws from that pool first (L-02c), so by the time the suite looks
  // they are either still free or already worn by somebody who was born this
  // season — both of which are the pool working. What must never happen is a
  // name marked used with nobody wearing it.
  const heirs = read(
    `SELECT p.name, p.image_url AS face FROM players p
       JOIN career_player_state ps ON ps.player_id = p.id AND ps.career_save_id = ?
      WHERE p.origin_career_save_id = ?`, careerSaveId, careerSaveId);
  const nameTaken = otherRow?.name_reused_at != null;
  const faceTaken = otherRow?.portrait_reused_at != null;
  check("her name is either still in the pool or being worn by a new player",
    !nameTaken || heirs.some((h) => h.name === otherRow.name),
    nameTaken ? `taken by ${heirs.find((h) => h.name === otherRow.name)?.name ?? "nobody"}` : "still free");
  check("and so is her face",
    !faceTaken || heirs.some((h) => h.face === otherRow.image_url),
    faceTaken ? `worn by ${heirs.find((h) => h.face === otherRow.image_url)?.name ?? "nobody"}` : "still free");

  // ── 4. The season review still knows who left ─────────────────────────────
  console.log("\n4. THE SEASON REVIEW STILL NAMES EVERY RETIREMENT");
  const review = await api("GET", "/seasons/2026/review");
  const named = (review.data?.retired ?? []).map((p) => p.name);
  check("the review names both, including the one whose record was deleted",
    named.includes(legend.name) && named.includes(journeyman.name),
    `HTTP ${review.status}: ${named.join(", ") || "nobody"}`);

} finally {
  await stopServer(child);
  try { fs.closeSync(out); } catch { /* already closed */ }
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
