/**
 * HOF — the club's Hall of Fame: who it honours, and who it should.
 *
 * Rob's rule (22 Sep): every two seasons a club may induct up to six players,
 * current or retired, and may induct nobody. Honours come first in the
 * recommendation — Olympic gold, then World Finals won while she was at the
 * club — then seasons served, then the ranking points she earned.
 *
 * The Trophy Cabinet had a "Hall of Fame" tab before this, listing retired
 * players still at the club — a list that was always empty, because retiring a
 * player is what takes her off the club (L-02b). There was no induction, no
 * window and no table behind it.
 *
 * Own database, own server on port 4527. Honours are written straight into the
 * database: winning a real Olympic gold takes a career to 2028 and a medal the
 * suite cannot arrange, and what is being tested here is the ORDER, not the
 * tournament.
 *
 * Usage: node harness/hall-of-fame.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";
import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healAllSquads, renewExpiringContracts, keepSideFielded } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-hof-"));
const PORT = 4527;

/** Read the two numbers from the source, so this suite cannot disagree with the game. */
const HOF_SRC = fs.readFileSync(path.join(REPO, "artifacts/api-server/src/routes/hall-of-fame.ts"), "utf8");
const EVERY = Number(/INDUCTION_INTERVAL_SEASONS = (\d+)/.exec(HOF_SRC)?.[1]);
const MAX_PICKS = Number(/MAX_INDUCTIONS_PER_WINDOW = (\d+)/.exec(HOF_SRC)?.[1]);

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log(`  HOF THE CLUB HALL OF FAME — EVERY ${EVERY} SEASONS, UP TO ${MAX_PICKS}`);
console.log("=".repeat(72));

const dbFile = path.join(WORK, "hof.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");

const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: {
    ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT),
    NODE_ENV: "development", SESSION_SECRET: "hof-secret",
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

/** One season boundary, playing whatever the calendar blocks on. */
async function toBoundary() {
  // A club nobody manages is sacked for abandonment long before it reaches a
  // Hall of Fame (R-48): its contracts run out and its graduates sit on the
  // bench. Both are the manager's ordinary work, done here through the real
  // routes so the walk is a career, not a clock.
  await keepSideFielded(api);
  await renewExpiringContracts(api);
  for (let i = 0; i < 600; i++) {
    healAllSquads(dbFile);
    const r = await api("POST", "/calendar/advance", {});
    if (r.status >= 400) return { stopped: `advance HTTP ${r.status} ${JSON.stringify(r.data).slice(0, 80)}` };
    if (r.data?.blocked === "pending_match") {
      await api("POST", `/matches/${r.data.pendingMatchId}/simulate`, {});
      await api("POST", "/calendar/skip-match", {});
      continue;
    }
    const mid = r.data?.matchDay?.matchId;
    if (mid) { await api("POST", `/matches/${mid}/simulate`, {}); await api("POST", "/calendar/dismiss-match", {}); }
    const roll = r.data?.seasonRollover;
    if (roll && roll.kind !== "none") return { roll };
  }
  return { stopped: "no boundary" };
}

try {
  const dl = Date.now() + 30000;
  for (;;) {
    if (Date.now() > dl) throw new Error("server never came up");
    try { await fetch(`${BASE}/healthz`); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }

  const prof = await api("POST", "/profiles", { name: "HallOfFame" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const career = await api("POST", "/careers", {
    slotNumber: 1, managerName: "HallOfFame", managerNationality: "Australia",
    clubName: "HallOfFame FC", originalClubName: "HallOfFame FC",
    budget: "500000", difficulty: "established",
    primaryColor: "#0a0", secondaryColor: "#00a", crestShapeIndex: 0,
    season: "Season 1", locationId: 1,
  });
  check("a career was created", career.status === 200, `HTTP ${career.status}`);
  const careerSaveId = career.data?.id;
  const teamId = career.data?.teamId;

  // ── 1. A new club has nothing to honour yet ───────────────────────────────
  console.log(`\n1. THE WINDOW OPENS EVERY ${EVERY} SEASONS, NOT BEFORE`);
  const fresh = await api("GET", "/hall-of-fame");
  check("the Hall of Fame reads on a brand-new career", fresh.status === 200, `HTTP ${fresh.status}`);
  check("it is empty, and the window is shut",
    (fresh.data?.inducted ?? []).length === 0 && fresh.data?.window?.open === false,
    `${(fresh.data?.inducted ?? []).length} inducted, open ${fresh.data?.window?.open}`);
  const early = await api("POST", "/hall-of-fame/induct", { playerIds: [] });
  check("and inducting before the first window is refused, with the count to go",
    early.status === 409 && /\d+ to go/.test(early.data?.error ?? ""),
    `HTTP ${early.status} ${early.data?.error ?? ""}`);

  // ── 2. Play to the first window ───────────────────────────────────────────
  console.log(`\n2. ${EVERY} SEASONS LATER`);
  for (let i = 0; i < EVERY; i++) {
    const step = await toBoundary();
    if (step.stopped) { check(`season ${i + 1} played`, false, step.stopped); break; }
  }
  const open = await api("GET", "/hall-of-fame");
  check(`after ${EVERY} seasons the window is open`,
    open.data?.window?.open === true && open.data?.seasonsCompleted >= EVERY,
    `seasons ${open.data?.seasonsCompleted}, open ${open.data?.window?.open}`);
  check(`it asks for at most ${MAX_PICKS}`, open.data?.window?.maxThisWindow === MAX_PICKS,
    `${open.data?.window?.maxThisWindow}`);
  check("and it has somebody to recommend", (open.data?.recommendations ?? []).length > 0,
    `${(open.data?.recommendations ?? []).length} recommended of ${(open.data?.eligible ?? []).length} eligible`);

  // ── 3. Honours come first ─────────────────────────────────────────────────
  console.log("\n3. THE RECOMMENDATION PUTS HONOURS FIRST");
  const squad = (await api("GET", "/team/roster")).data ?? {};
  const [a, b] = [...(squad.activePlayers ?? []), ...(squad.benchPlayers ?? [])];
  // b has more ranking points than a; a has an Olympic gold. Honours win.
  write(`INSERT INTO player_ranking_points (career_save_id, season_year, competitor_id, player_id, ranking_points, matches, updated_at)
         SELECT ?, 2026, (SELECT id FROM competitors WHERE team_id = ? LIMIT 1), ?, 900, 40, ?`,
    careerSaveId, teamId, b.id, Date.now());
  write(`INSERT INTO olympic_tournaments (career_save_id, season_year, played_on, field, passed_over, created_at)
         VALUES (?, 2028, '2028-08-01', '[]', '[]', ?)`, careerSaveId, Date.now());
  const tour = read(`SELECT id FROM olympic_tournaments WHERE career_save_id = ?`, careerSaveId)[0];
  write(`INSERT INTO olympic_medals (tournament_id, career_save_id, season_year, medal, nation, player_kind, player_id, player_name, club_name, created_at)
         VALUES (?, ?, 2028, 'gold', 'Brazil', 'player', ?, ?, 'HallOfFame FC', ?)`,
    tour.id, careerSaveId, a.id, a.name, Date.now());

  const ranked = await api("GET", "/hall-of-fame");
  const order = (ranked.data?.recommendations ?? []).map((c) => c.name);
  const goldFirst = order[0] === a.name;
  check("the Olympic champion is recommended ahead of the club's points-scorer",
    goldFirst, `${order.slice(0, 3).join(" > ")} (gold: ${a.name}, points: ${b.name})`);

  // ── 4. Inducting ──────────────────────────────────────────────────────────
  console.log("\n4. THE CLUB PICKS, AND THE WINDOW CLOSES BEHIND IT");
  const eligible = ranked.data?.eligible ?? [];
  const tooMany = await api("POST", "/hall-of-fame/induct", {
    playerIds: eligible.slice(0, MAX_PICKS + 1).map((c) => c.playerId),
  });
  check(`picking more than ${MAX_PICKS} is refused`, tooMany.status === 422,
    `HTTP ${tooMany.status} ${tooMany.data?.error ?? ""}`);

  const picks = eligible.slice(0, 2).map((c) => c.playerId);
  const induct = await api("POST", "/hall-of-fame/induct", { playerIds: picks });
  check("two inductions are accepted", induct.status === 201,
    `HTTP ${induct.status} ${JSON.stringify(induct.data).slice(0, 90)}`);

  const after = await api("GET", "/hall-of-fame");
  check("both are in the Hall of Fame now",
    (after.data?.inducted ?? []).length === 2 &&
    picks.every((id) => (after.data.inducted ?? []).some((r) => r.playerId === id)),
    (after.data?.inducted ?? []).map((r) => `${r.name} (season ${r.seasonInducted})`).join(", "));
  check("the window closed behind them", after.data?.window?.open === false,
    `open ${after.data?.window?.open}, ${after.data?.window?.seasonsUntilNext} seasons to the next`);
  check("neither is offered again", !(after.data?.eligible ?? []).some((c) => picks.includes(c.playerId)));

  const again = await api("POST", "/hall-of-fame/induct", { playerIds: [eligible[3]?.playerId] });
  check("a second induction in the same window is refused", again.status === 409,
    `HTTP ${again.status} ${again.data?.error ?? ""}`);

  // ── 5. What induction is worth ────────────────────────────────────────────
  console.log("\n5. AN INDUCTED PLAYER IS KEPT WHEN SHE RETIRES (L-02b)");
  const honoured = picks[0];
  write(`UPDATE career_player_state SET age = 39 WHERE career_save_id = ? AND player_id = ?`,
    careerSaveId, honoured);
  const step = await toBoundary();
  check("another season was played", !step.stopped, step.stopped ?? "rolled");

  const kept = read(`SELECT is_retired AS retired FROM career_player_state
                      WHERE career_save_id = ? AND player_id = ?`, careerSaveId, honoured)[0];
  const row = read(`SELECT in_hall_of_fame AS hof, name_reused_at AS nameUsed, portrait_reused_at AS faceUsed
                      FROM player_retirements WHERE career_save_id = ? AND player_id = ?`,
    careerSaveId, honoured)[0];
  check("she retired but her career record was kept", kept?.retired === 1, JSON.stringify(kept));
  check("and her name and face were never put back in the pool",
    row?.hof === 1 && row?.nameUsed != null && row?.faceUsed != null,
    `hof ${row?.hof}, name ${row?.nameUsed}, face ${row?.faceUsed}`);

  const stillListed = await api("GET", "/hall-of-fame");
  check("she is still on the club's honour board after retiring",
    (stillListed.data?.inducted ?? []).some((r) => r.playerId === honoured),
    (stillListed.data?.inducted ?? []).map((r) => r.name).join(", "));

  // ── 6. Skipping ───────────────────────────────────────────────────────────
  console.log("\n6. A CLUB MAY HONOUR NOBODY");
  // Section 5 played one season; the next window opens at the one after it.
  const toWindow = await toBoundary();
  check("a season was played to reach the next window", !toWindow.stopped, toWindow.stopped ?? "rolled");

  const skipped = await api("POST", "/hall-of-fame/induct", { playerIds: [] });
  check("an empty induction is allowed once the window is open again",
    skipped.status === 200 && skipped.data?.skipped === true,
    `HTTP ${skipped.status} ${JSON.stringify(skipped.data)}`);
  const afterSkip = await api("GET", "/hall-of-fame");
  check("and skipping honours nobody", (afterSkip.data?.inducted ?? []).length === 2,
    `${(afterSkip.data?.inducted ?? []).length} on the board`);
  check("skipping does not use the window up either", afterSkip.data?.window?.open === true,
    `open ${afterSkip.data?.window?.open}`);

  // ── 7. The same player twice ──────────────────────────────────────────────
  //
  // One induction, not two. The board has a unique index on (career, club,
  // player), so a repeated id was a constraint violation and a 500 rather than
  // a 201 — and a club cannot honour anybody twice in any case. Last, because
  // it uses the window the skip above deliberately left open.
  console.log("\n7. NAMING THE SAME PLAYER TWICE");
  const spare = (afterSkip.data?.eligible ?? [])[0];
  const twice = await api("POST", "/hall-of-fame/induct", {
    playerIds: [spare?.playerId, spare?.playerId],
  });
  check("it is accepted, and inducts her once",
    twice.status === 201 && (twice.data?.inducted ?? []).length === 1,
    `HTTP ${twice.status} ${JSON.stringify(twice.data).slice(0, 80)}`);
  const finalBoard = (await api("GET", "/hall-of-fame")).data?.inducted ?? [];
  check("and she is on the board exactly once",
    finalBoard.filter((r) => r.playerId === spare?.playerId).length === 1,
    `${finalBoard.length} on the board: ${finalBoard.map((r) => r.name).join(", ")}`);

} finally {
  await stopServer(child);
  try { fs.closeSync(out); } catch { /* already closed */ }
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
