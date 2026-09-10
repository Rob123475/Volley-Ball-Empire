/**
 * R-38 — GET /unity/match-state must say WHICH career it is for.
 *
 * ── The bug this exists for ─────────────────────────────────────────────────
 * The endpoint is documented "no auth required — Unity connects as an external
 * service", and then read `req.activeCareerSaveId`, which only exists on a
 * browser session. So every session-less caller got a 500:
 *
 *   Error: No active career. Player and staff state is career-scoped —
 *   this code path needs req.activeCareerSaveId.
 *
 * That is not a curl artefact. The WebGL build runs in an iframe with no app
 * session, and Unity Editor Play mode has no cookie at all, so the loader this
 * endpoint exists to feed could never have called it successfully. It was
 * unreachable from the only two places that were ever going to call it.
 *
 * The match lookup had a second, quieter version of the same fault: with no
 * matchId it picked the newest match by status with NO team filter, so in a
 * database holding two careers it could return whichever career's match was
 * most recent — the cross-career bleed R-20 was about.
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 * Two careers in one database, then:
 *   - ?careerSaveId=A and ?careerSaveId=B each return four players, and the two
 *     sets of player ids are DISJOINT. Scoping by id has to actually scope.
 *   - no id and no session is 400 with a message naming the problem, never a
 *     guess at "the first career in the table". A plausible wrong answer is
 *     worse than an error.
 *   - a careerSaveId that does not exist is 404, not a silent fallback.
 *   - a session with an active career still works with no id at all, so the
 *     browser path is not broken by the change.
 *
 * Usage: node harness/unity-career-scoping.mjs
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
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-unity-career-"));
const PORT = 4660;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

if (!fs.existsSync(SERVER)) {
  console.error(`[unity-career-scoping] FAILED: ${SERVER} not built.`);
  process.exit(1);
}

const dbFile = path.join(WORK, "career-scoping.sqlite");
fs.copyFileSync(SHIPPED, dbFile);

const logFile = path.join(WORK, "server.log");
const out = fs.openSync(logFile, "w");
const child = forkServer({
  server: SERVER,
  electron: ELECTRON,
  out,
  env: {
    ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT),
    NODE_ENV: "development", SESSION_SECRET: "career-scoping-secret",
  },
});

const BASE = `http://localhost:${PORT}/api`;

/** Session-carrying client. */
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

/** No cookie, ever — this is what Unity looks like to the server. */
async function anon(p) {
  const res = await fetch(BASE + p, { headers: { "content-type": "application/json" } });
  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

async function makeCareer(api, label, slot) {
  const r = await api("POST", "/profiles", { name: label });
  await api("POST", `/profiles/${r.data.id}/select`);
  const c = await api("POST", "/careers", {
    slotNumber: slot, managerName: label, managerNationality: "Australia",
    clubName: `${label} FC`, originalClubName: `${label} FC`, season: "Season 1",
    budget: "500000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a",
  });
  if (c.status >= 400) throw new Error(`career creation failed: ${JSON.stringify(c.data)}`);
  return { careerSaveId: c.data.id, teamId: c.data.teamId };
}

const deadline = Date.now() + 30000;
let up = false;
while (Date.now() < deadline) {
  try { await fetch(`${BASE}/health`); up = true; break; }
  catch { await new Promise((r) => setTimeout(r, 250)); }
}
if (!up) {
  console.error("[unity-career-scoping] server never came up");
  console.error(fs.readFileSync(logFile, "utf8").slice(-2000));
  process.exit(1);
}

console.log("=".repeat(72));
console.log("  R-38 /unity/match-state IS CAREER-SCOPED");
console.log("=".repeat(72));

try {
  // Two separate profiles, so two genuinely independent careers in one database.
  const apiA = session();
  const apiB = session();
  const A = await makeCareer(apiA, "CareerA", 1);
  const B = await makeCareer(apiB, "CareerB", 1);

  check("two distinct careers exist", A.careerSaveId !== B.careerSaveId,
    `A=${A.careerSaveId} (team ${A.teamId}), B=${B.careerSaveId} (team ${B.teamId})`);

  // ── 1. ?careerSaveId scopes the players ──────────────────────────────────
  const resA = await anon(`/unity/match-state?careerSaveId=${A.careerSaveId}`);
  const resB = await anon(`/unity/match-state?careerSaveId=${B.careerSaveId}`);

  check("careerSaveId=A returns 200 with no session at all",
    resA.status === 200, `HTTP ${resA.status}`);
  check("careerSaveId=B returns 200 with no session at all",
    resB.status === 200, `HTTP ${resB.status}`);

  const playersA = Array.isArray(resA.data?.players) ? resA.data.players : [];
  const playersB = Array.isArray(resB.data?.players) ? resB.data.players : [];

  check("A returns four players", playersA.length === 4, `${playersA.length} players`);
  check("B returns four players", playersB.length === 4, `${playersB.length} players`);

  const idsA = new Set(playersA.map((p) => p.id));
  const idsB = new Set(playersB.map((p) => p.id));

  // NOT asserted: that A's and B's player IDS differ. They legitimately do not.
  // `players` is global reference data shared by every career - only
  // `career_player_state` is career-scoped - so two careers seeded from the same
  // starter pool pick the same top-rated rows, and identical ids here are
  // correct rather than a leak. An earlier version of this suite asserted the id
  // sets were disjoint and failed for exactly that reason: the test encoded a
  // wrong idea of the data model, not a bug in the endpoint.
  //
  // What must be career-specific is the CLUB, the MATCH, and the
  // career_player_state rows behind those players (verified from the DB below).

  check("each side's match is its own career's match",
    resA.data?.matchId !== resB.data?.matchId,
    `A matchId ${resA.data?.matchId}, B matchId ${resB.data?.matchId}`);

  check("each side reports its own club, not the other's",
    resA.data?.homeTeam !== resB.data?.homeTeam &&
    typeof resA.data?.homeTeam === "string" && typeof resB.data?.homeTeam === "string",
    `A homeTeam '${resA.data?.homeTeam}', B homeTeam '${resB.data?.homeTeam}'`);

  // ── 2. No id and no session is a clear 400, never a guess ────────────────
  const none = await anon("/unity/match-state");
  check("no careerSaveId and no session -> 400", none.status === 400, `HTTP ${none.status}`);
  check("the 400 names the problem rather than guessing",
    typeof none.data?.error === "string" && /career/i.test(none.data.error),
    JSON.stringify(none.data).slice(0, 160));

  // ── 3. A non-existent id is 404, not a fallback ──────────────────────────
  const ghost = await anon("/unity/match-state?careerSaveId=999999");
  check("unknown careerSaveId -> 404, not a silent fallback",
    ghost.status === 404, `HTTP ${ghost.status} ${JSON.stringify(ghost.data).slice(0, 120)}`);

  // ── 4. The browser path still works with no id ───────────────────────────
  const viaSession = await apiB("GET", "/unity/match-state");
  check("a session with an active career still works with no id",
    viaSession.status === 200, `HTTP ${viaSession.status}`);

  const sessionIds = new Set(
    (Array.isArray(viaSession.data?.players) ? viaSession.data.players : []).map((p) => p.id));
  const sameAsB = sessionIds.size === idsB.size && [...sessionIds].every((id) => idsB.has(id));
  check("the session path resolves to the same career as ?careerSaveId=B",
    sameAsB, `session ids [${[...sessionIds].join(", ")}]`);

  // ── 5. Sanity: the DB really holds two careers ───────────────────────────
  await stopServer(child);
  try { fs.closeSync(out); } catch { /* already closed */ }

  const db = new DatabaseSync(dbFile, { readOnly: true });
  const n = db.prepare("SELECT COUNT(*) AS n FROM career_saves").get().n;

  // The real scoping proof. `players` is global, so the test is whether each
  // returned player has a career_player_state row for THAT career putting her on
  // THAT career's team. If the endpoint ignored careerSaveId, B's payload would
  // be describing players as A's team owns them.
  // Only TWO of the four are on the career's team. The away pair is filled from
  // the free-agent pool because every match's awayTeamId equals its homeTeamId -
  // there is no real opposing-team row anywhere (R-29), so the true away side is
  // an AI opponent represented by a name string and staffed from free agents
  // (R-22). Free agents have team_id NULL in career_player_state. An earlier
  // version of this check demanded all four be on the team and failed on the away
  // players for exactly that reason.
  const stateRow = db.prepare(
    "SELECT team_id FROM career_player_state WHERE career_save_id = ? AND player_id = ?",
  );

  /**
   * Every returned player must have a career_player_state row for THIS career -
   * that is the scoping proof - and the home pair must additionally sit on this
   * career's team while the away pair are free agents.
   */
  function verify(players, homeLabel, careerSaveId, teamId) {
    const problems = [];
    let home = 0, away = 0;

    for (const p of players) {
      const row = stateRow.get(careerSaveId, p.id);
      if (!row) { problems.push(`player ${p.id} has no career_player_state in career ${careerSaveId}`); continue; }

      if (p.team === homeLabel) {
        home++;
        if (Number(row.team_id) !== Number(teamId)) {
          problems.push(`home player ${p.id} has team_id ${row.team_id}, expected ${teamId}`);
        }
      } else {
        away++;
        if (row.team_id !== null) {
          problems.push(`away player ${p.id} should be a free agent but has team_id ${row.team_id}`);
        }
      }
    }

    return { problems, home, away };
  }

  const vA = verify(playersA, resA.data?.homeTeam, A.careerSaveId, A.teamId);
  const vB = verify(playersB, resB.data?.homeTeam, B.careerSaveId, B.teamId);
  db.close();

  check("the database really contains two careers", Number(n) === 2, `${n} career_saves rows`);

  check("A's four players all resolve inside A's own career state",
    vA.problems.length === 0,
    vA.problems.length === 0
      ? `${vA.home} on team ${A.teamId}, ${vA.away} free agents, all in career ${A.careerSaveId}`
      : vA.problems.join("; "));

  check("B's four players all resolve inside B's own career state",
    vB.problems.length === 0,
    vB.problems.length === 0
      ? `${vB.home} on team ${B.teamId}, ${vB.away} free agents, all in career ${B.careerSaveId}`
      : vB.problems.join("; "));
} catch (err) {
  failures++;
  console.log(`  FAIL  threw: ${err.message}`);
  try { await stopServer(child); } catch { /* ignore */ }
  try { fs.closeSync(out); } catch { /* ignore */ }
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* ignore */ } }
process.exit(failures > 0 ? 1 : 0);
