/**
 * R-48 — a club without two contracted players forfeits instead of playing.
 *
 * ── The bug ──────────────────────────────────────────────────────────────────
 * The match engine rates an empty squad at a flat 60 (sideRating([])), so a club
 * whose whole squad had walked out of contract kept playing — and sometimes
 * winning — as a phantom pair. Rob's decision: a club that cannot put two
 * contracted players on the sand forfeits, through the existing forfeit path.
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 *   warned    with one contracted player left, the dashboard's red Squad item
 *             says matches are forfeited
 *   watch     the live match refuses to start (409, squadIncomplete)
 *   simulate  the match is a forfeit: 0-2, completed, the result says why, one
 *             more loss, board confidence down 5, the opponent credited on the
 *             World Tour fixture, the ranking row carries the loss
 *   control   a club with its full squad plays the same kind of match for real:
 *             not a forfeit, a legal best-of-three with set scores
 *
 * Usage: node harness/squad-forfeit.mjs
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
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-squad-forfeit-"));
const PORT = 4730;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

if (!fs.existsSync(SERVER)) {
  console.error(`[squad-forfeit] FAILED: ${SERVER} not built.`);
  process.exit(1);
}

const dbFile = path.join(WORK, "forfeit.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: {
    ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT),
    NODE_ENV: "development", SESSION_SECRET: "squad-forfeit-secret",
  },
});

{
  const deadline = Date.now() + 60000;
  let up = false;
  while (Date.now() < deadline) {
    try { await fetch(`${BASE}/health`); up = true; break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  if (!up) {
    console.error("[squad-forfeit] server never came up");
    console.error(fs.readFileSync(path.join(WORK, "server.log"), "utf8").slice(-3000));
    process.exit(1);
  }
}

function session() {
  let cookie = "";
  return async function api(method, p, body) {
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
}

async function newCareer(api, label) {
  const prof = await api("POST", "/profiles", { name: label });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const c = await api("POST", "/careers", {
    slotNumber: 1, managerName: label, managerNationality: "Australia",
    clubName: `${label} FC`, originalClubName: `${label} FC`, season: "Season 1",
    budget: "500000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a",
  });
  return { careerSaveId: c.data?.id, teamId: c.data?.teamId };
}

/** Walk the calendar to the first World Tour match day without playing anything. */
async function firstMatchDay(api) {
  for (let day = 0; day < 200; day++) {
    const adv = await api("POST", "/calendar/advance", {});
    if (adv.status >= 400) return null;
    const id = adv.data?.matchDay?.matchId ?? (adv.data?.blocked === "pending_match" ? adv.data.pendingMatchId : null);
    if (id != null) return id;
  }
  return null;
}

function read(sqlText, ...args) {
  const d = new DatabaseSync(dbFile, { readOnly: true });
  const rows = d.prepare(sqlText).all(...args);
  d.close();
  return rows;
}

console.log("=".repeat(72));
console.log("  R-48 A CLUB WITHOUT TWO CONTRACTED PLAYERS FORFEITS");
console.log("=".repeat(72));

try {
  const A = session(), B = session();
  const a = await newCareer(A, "ForfeitA");
  const b = await newCareer(B, "ForfeitB");

  // A loses two of its three contracted players.
  const contractsA = (await A("GET", "/contracts")).data ?? [];
  for (const c of contractsA.slice(0, 2)) await A("DELETE", `/contracts/${c.id}`);
  const active = read(`SELECT COUNT(*) AS n FROM career_player_state WHERE career_save_id = ? AND team_id = ? AND is_active = 1`,
    a.careerSaveId, a.teamId)[0].n;
  check("club A is down to one contracted, active player", active === 1, `${active} active`);

  console.log("\n1. THE MANAGER IS TOLD");
  const att = await A("GET", "/attention-items");
  const squadItem = (att.data?.items ?? []).find((i) => i.category === "Squad");
  check("the dashboard's Squad item is red and says matches are forfeited",
    squadItem?.priority === "red" && /forfeited/.test(squadItem?.description ?? ""), JSON.stringify(squadItem ?? null));

  const matchA = await firstMatchDay(A);
  const matchB = await firstMatchDay(B);
  check("both clubs reach a World Tour match day", matchA != null && matchB != null, `A ${matchA}, B ${matchB}`);

  console.log("\n2. THE MATCH CANNOT BE PLAYED");
  const watch = await A("POST", `/matches/${matchA}/watch`);
  check("the live match refuses to start", watch.status === 409 && watch.data?.squadIncomplete === true,
    `HTTP ${watch.status} ${JSON.stringify(watch.data)}`);

  const teamBefore = read(`SELECT losses, board_confidence FROM teams WHERE id = ?`, a.teamId)[0];
  const sim = await A("POST", `/matches/${matchA}/simulate`, {});
  check("simulating it is a forfeit, and says why",
    sim.status === 200 && sim.data?.forfeit === true && sim.data?.squadIncomplete === true && /Contracts page/.test(sim.data?.reason ?? ""),
    `HTTP ${sim.status} ${JSON.stringify({ forfeit: sim.data?.forfeit, reason: sim.data?.reason })}`);
  const matchRow = read(`SELECT status, home_score, away_score, sets FROM matches WHERE id = ?`, matchA)[0];
  check("the match is completed 0-2 with no sets played", matchRow?.status === "completed" && matchRow.home_score === 0 && matchRow.away_score === 2 && matchRow.sets == null,
    JSON.stringify(matchRow));
  const teamAfter = read(`SELECT losses, board_confidence FROM teams WHERE id = ?`, a.teamId)[0];
  check("one more loss and board confidence down 5, as a manual forfeit",
    teamAfter.losses === teamBefore.losses + 1 && teamAfter.board_confidence === Math.max(0, teamBefore.board_confidence - 5),
    `losses ${teamBefore.losses}->${teamAfter.losses}, confidence ${teamBefore.board_confidence}->${teamAfter.board_confidence}`);
  const fixture = read(`SELECT status, home_sets, away_sets FROM world_tour_fixtures WHERE match_id = ?`, matchA)[0];
  check("the World Tour fixture records the opponent's win", fixture?.status === "completed" && fixture.home_sets === 0 && fixture.away_sets === 2,
    JSON.stringify(fixture));
  const ranking = read(`SELECT r.wins, r.losses FROM competitor_rankings r JOIN competitors c ON c.id = r.competitor_id
    WHERE r.career_save_id = ? AND c.team_id = ?`, a.careerSaveId, a.teamId)[0];
  check("the club's ranking row carries the loss", ranking?.losses === 1 && ranking?.wins === 0, JSON.stringify(ranking));

  console.log("\n3. CONTROL: A FULL SQUAD PLAYS FOR REAL");
  const simB = await B("POST", `/matches/${matchB}/simulate`, {});
  const rowB = read(`SELECT status, home_score, away_score, sets FROM matches WHERE id = ?`, matchB)[0];
  let setsB = [];
  try { setsB = JSON.parse(rowB?.sets ?? "[]"); } catch { setsB = []; }
  check("club B's match is not a forfeit", simB.status === 200 && !simB.data?.forfeit, `HTTP ${simB.status} forfeit=${simB.data?.forfeit}`);
  check("it is a real best-of-three with set scores",
    rowB?.status === "completed" && Math.max(rowB.home_score, rowB.away_score) === 2 && setsB.length >= 2,
    `${rowB?.home_score}-${rowB?.away_score}, ${setsB.length} sets`);
} finally {
  await stopServer(child);
  try { fs.closeSync(out); } catch { /* closed */ }
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
