/**
 * L-02e — the club is sold, and the manager looks for another.
 *
 * Rob's rule (22 Sep, final): the board never sacks for on-field collapse.
 * Five consecutive loss-making seasons and the club is sold; for the manager's
 * own club that means losing the job, and then being shown real clubs with
 * vacancies. Take one and the career carries on with everything that is the
 * manager's; decline them all and that is retirement.
 *
 * ── How the five seasons are arranged ───────────────────────────────────────
 * The board records the balance every season OPENS on, and one season's
 * opening balance is the season before it's closing balance — that chain is
 * how the run is counted, and it is what this suite writes: four earlier
 * seasons whose openings fall, and a fifth the career actually plays and ends
 * down on. Playing five real loss-making seasons would take twenty minutes to
 * arrange what four rows arrange exactly.
 *
 * Own database, own server on port 4533.
 *
 * Usage: node harness/job-market.mjs
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
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-job-market-"));
const PORT = 4533;

/** Read from the source, so this suite cannot disagree with the game. */
const BOARD_SRC = fs.readFileSync(path.join(REPO, "artifacts/api-server/src/utils/board-confidence.ts"), "utf8");
const TO_SALE = Number(/LOSS_MAKING_SEASONS_TO_SALE = (\d+)/.exec(BOARD_SRC)?.[1]);

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
const money = (n) => (n < 0 ? "-" : "") + "$" + Math.abs(Math.round(n)).toLocaleString();

console.log("=".repeat(72));
console.log(`  L-02e ${TO_SALE} LOSS-MAKING SEASONS SELLS THE CLUB; THE MANAGER LOOKS FOR ANOTHER`);
console.log("=".repeat(72));

const dbFile = path.join(WORK, "jobs.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");

const serverEnv = {
  ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT),
  NODE_ENV: "development", SESSION_SECRET: "job-market-secret",
};
// `let`, because section 2b shuts the game down and starts it again to prove
// what a save made before this build is repaired into on the next boot.
let child = forkServer({ server: SERVER, electron: ELECTRON, out, env: serverEnv });

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

try {
  const waitForServer = async () => {
    const dl = Date.now() + 30000;
    for (;;) {
      if (Date.now() > dl) throw new Error("server never came up");
      try { await fetch(`${BASE}/healthz`); return; } catch { await new Promise((r) => setTimeout(r, 250)); }
    }
  };
  await waitForServer();

  const prof = await api("POST", "/profiles", { name: "JobMarket" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const career = await api("POST", "/careers", {
    slotNumber: 1, managerName: "JobMarket", managerNationality: "Australia",
    clubName: "JobMarket FC", originalClubName: "JobMarket FC",
    budget: "500000", difficulty: "established",
    primaryColor: "#0a0", secondaryColor: "#00a", crestShapeIndex: 0,
    season: "Season 1", locationId: 1,
  });
  check("a career was created", career.status === 200, `HTTP ${career.status}`);
  const careerSaveId = career.data?.id;
  const teamId = career.data?.teamId;
  const YEAR = 2026;

  // ── 1. Nobody is out of a job yet ─────────────────────────────────────────
  console.log("\n1. A MANAGER WITH A CLUB IS NOT IN THE JOB MARKET");
  const before = await api("GET", "/job-market");
  check("the job market says the manager is not looking",
    before.status === 200 && before.data?.seeking === false && (before.data?.vacancies ?? []).length === 0,
    `HTTP ${before.status}, seeking ${before.data?.seeking}`);
  const earlyTake = await api("POST", "/job-market/accept", { poolTeamId: 1 });
  check("and cannot take another club", earlyTake.status === 409,
    `HTTP ${earlyTake.status} ${earlyTake.data?.error ?? ""}`);

  // ── 2. Four seasons of losses behind it ───────────────────────────────────
  // Each season's row opens on what the club carried into it, so a falling
  // chain of openings IS a run of loss-making seasons. Every row names the club
  // that played it: the run belongs to the club, not to the career, or the
  // manager's next club would inherit this one's losses.
  console.log(`\n2. ${TO_SALE - 1} LOSS-MAKING SEASONS ALREADY BEHIND THE CLUB`);
  const opens = [900_000, 800_000, 700_000, 600_000];
  for (let i = 0; i < opens.length; i++) {
    const year = YEAR - (opens.length - i);
    write(
      `INSERT INTO board_seasons (career_save_id, team_id, season_year, season_start_balance,
                                  confidence_before, confidence_after, outcome, reviewed_on,
                                  forfeits, strength_rank, target, finish, grade, created_at, updated_at)
       VALUES (?, ?, ?, ?, 60, 60, 'warning', ?, 0, 19, 19, 19, 'met', ?, ?)`,
      careerSaveId, teamId, year, opens[i], `${year}-12-31`, Date.now(), Date.now());
  }
  // This season opened on the last of them, and the club is going to end below it.
  write(`UPDATE board_seasons SET season_start_balance = ? WHERE career_save_id = ? AND season_year = ?`,
    500_000, careerSaveId, YEAR);
  const chain = read(
    `SELECT season_year AS y, season_start_balance AS b FROM board_seasons
      WHERE career_save_id = ? AND team_id = ? ORDER BY season_year`, careerSaveId, teamId);
  check(`${chain.length} seasons on record, each opening lower than the last`,
    chain.length === TO_SALE && chain.every((r, i) => i === 0 || r.b < chain[i - 1].b),
    chain.map((r) => `${r.y}:${money(r.b)}`).join(" > "));

  // ── 2b. A save from before the board knew which club played ─────────────
  //
  // `board_seasons.team_id` is new. Every save on a player's disk was written
  // without it, and the five-season rule is read off it - so without a repair
  // at boot, every season a save has already played would be forgotten by the
  // board. A career had exactly one club until the job market existed, which is
  // what makes the repair possible at all: its rows can only be its team's.
  console.log("\n2b. A SAVE MADE BEFORE THE BOARD KNEW WHICH CLUB PLAYED EACH SEASON");
  await stopServer(child);
  write(`UPDATE board_seasons SET team_id = NULL WHERE career_save_id = ?`, careerSaveId);
  const unnamed = read(
    `SELECT COUNT(*) AS n FROM board_seasons WHERE career_save_id = ? AND team_id IS NULL`,
    careerSaveId)[0].n;
  check("the save is left as an older build would have written it", unnamed === TO_SALE,
    `${unnamed} season(s) with no club against them`);

  child = forkServer({ server: SERVER, electron: ELECTRON, out, env: serverEnv });
  await waitForServer();
  cookie = "";
  await api("POST", `/profiles/${prof.data.id}/select`);
  const repaired = read(
    `SELECT COUNT(*) AS n FROM board_seasons WHERE career_save_id = ? AND team_id = ?`,
    careerSaveId, teamId)[0].n;
  check("starting the game again matches every one of them to the club that played it",
    repaired === TO_SALE, `${repaired} of ${TO_SALE} season(s) now name the club`);

  // The club will finish this season below what it opened on: everything it
  // has, minus a little, is spent.
  write(`UPDATE teams SET budget = ? WHERE id = ?`, 120_000, teamId);

  // Read while the manager still has a club: career stats are read through the
  // club, and in a moment there will not be one.
  const seasonsBeforeSale = (await api("GET", "/achievements/career-stats")).data?.seasonsCompleted ?? 0;

  // ACH: what the manager has already won, so that after the sale it can be
  // checked that it came with them. `world_champion` is seeded rather than
  // played for - winning a World Championship would be a harness of its own -
  // and it is a key nothing here unlocks by accident.
  write(`INSERT INTO achievements (team_id, achievement_key, unlocked_at) VALUES (?, 'world_champion', ?)`,
    teamId, Math.floor(Date.now() / 1000));

  // ── 3. The season ends and the club is sold ───────────────────────────────
  console.log("\n3. THE FIFTH ENDS IT — THE CLUB IS SOLD, NOT THE MANAGER SACKED");
  let boundary = null, stopped = "";
  for (let i = 0; i < 600; i++) {
    healAllSquads(dbFile);
    await keepSideFielded(api);
    const r = await api("POST", "/calendar/advance", {});
    if (r.status >= 400) { stopped = `advance HTTP ${r.status} ${JSON.stringify(r.data).slice(0, 80)}`; break; }
    if (r.data?.blocked === "pending_match") {
      await api("POST", `/matches/${r.data.pendingMatchId}/simulate`, {});
      await api("POST", "/calendar/skip-match", {});
      continue;
    }
    const mid = r.data?.matchDay?.matchId;
    if (mid) { await api("POST", `/matches/${mid}/simulate`, {}); await api("POST", "/calendar/dismiss-match", {}); }
    if (r.data?.seasonRollover && r.data.seasonRollover.kind !== "none") { boundary = r.data; break; }
  }
  check("the season reached its boundary", boundary !== null, stopped || "rolled");
  check("the boundary is a sale, and nobody was sacked",
    boundary?.seasonRollover?.kind === "rolled" && boundary?.seasonRollover?.clubSold === true
      && boundary?.clubSold === true && boundary?.fired === false,
    `${boundary?.seasonRollover?.kind}, sold ${boundary?.clubSold}, fired ${boundary?.fired}`);
  check("and the season still opened — there is one for the next club to join",
    boundary?.seasonRollover?.toSeason === 2,
    `next season ${boundary?.seasonRollover?.toSeason}`);
  check("the review says the club has been sold",
    boundary?.seasonRollover?.review?.outcome === "sold",
    boundary?.seasonRollover?.review?.text ?? "no review");

  const save = () => read(
    `SELECT team_id AS team, seeking_club_since AS seeking, retired_at AS retired, club_name AS club
       FROM career_saves WHERE id = ?`, careerSaveId)[0];
  check("the career is without a club, and is NOT finished",
    save()?.team === null && save()?.seeking != null && save()?.retired == null,
    JSON.stringify(save()));
  const keysBeforeSale = read(
    `SELECT achievement_key AS k FROM achievements WHERE team_id = ?`, teamId).map((r) => r.k).sort();
  check("the manager had achievements at the club that was sold",
    keysBeforeSale.includes("world_champion") && keysBeforeSale.length >= 1,
    keysBeforeSale.join(", ") || "nothing unlocked");
  const history = read(
    `SELECT type, description FROM career_history_entries
      WHERE career_save_id = ? ORDER BY id DESC LIMIT 1`, careerSaveId)[0];
  check("and the history says what happened, in the club's words",
    history?.type === "club_sold" && /sold after five seasons of losses/.test(history?.description ?? ""),
    history?.description);

  // ── 4. Real clubs with vacancies ──────────────────────────────────────────
  console.log("\n4. REAL CLUBS, REAL VACANCIES");
  const market = await api("GET", "/job-market");
  const vacancies = market.data?.vacancies ?? [];
  check("the manager is now looking for a club", market.data?.seeking === true,
    `seeking ${market.data?.seeking}, former club ${market.data?.formerClub}`);
  check("and is offered clubs", vacancies.length > 0, `${vacancies.length} offered`);

  const worldClubs = read(`SELECT id, team_name AS name FROM continental_pool_teams`);
  const byId = new Map(worldClubs.map((c) => [c.id, c.name]));
  check("every one of them is a real club of this game's world, by name",
    vacancies.every((v) => byId.get(v.poolTeamId) === v.name),
    vacancies.map((v) => `${v.name} (${v.continentName})`).join(", "));

  // The field is the eighteen clubs that QUALIFIED plus the player's own, not
  // every club in the world: all sixty have a competitor row, because the
  // regional league is played by all of them.
  const inField = read(
    `SELECT DISTINCT pool_team_id AS id FROM world_tour_qualifications WHERE career_save_id = ?`,
    careerSaveId).map((r) => r.id);
  check("and none of them is already in the World Tour field — no club appears twice",
    inField.length > 0 && vacancies.every((v) => !inField.includes(v.poolTeamId)),
    `${inField.length} clubs in the field, ${vacancies.length} offered`);

  const refused = await api("POST", "/job-market/accept", { poolTeamId: inField[0] });
  check("a club that is not on offer cannot be taken", refused.status === 422,
    `HTTP ${refused.status} ${refused.data?.error ?? ""}`);

  // ── 4b. Closing the game and coming back ──────────────────────────────────
  //
  // A career between clubs has no team, and the session restore used to want
  // one: it looked up "the newest career that still has a club", which after a
  // sale is a DIFFERENT career, or none. A player with a second career would
  // have been dropped into that one without being told, and the sold career
  // would have been stranded. This is that restart, with a session that knows
  // nothing.
  console.log("\n4b. SHUTTING THE GAME AND COMING BACK TO IT");
  cookie = "";
  const backIn = await api("POST", `/profiles/${prof.data.id}/select`);
  check("the profile is selected again on a fresh session", backIn.status < 400, `HTTP ${backIn.status}`);
  const resumed = await api("GET", "/job-market");
  check("the game comes back to the job market, not to somebody else's club",
    resumed.data?.seeking === true && resumed.data?.formerClub === "JobMarket FC",
    `seeking ${resumed.data?.seeking}, former club ${resumed.data?.formerClub}`);
  check("and the vacancies are still there",
    (resumed.data?.vacancies ?? []).length === (market.data?.vacancies ?? []).length,
    `${(resumed.data?.vacancies ?? []).length} offered`);

  // ── 5. Taking the job ─────────────────────────────────────────────────────
  console.log("\n5. TAKING ONE, AND KEEPING THE CAREER");
  const pick = vacancies[0];
  const accepted = await api("POST", "/job-market/accept", { poolTeamId: pick.poolTeamId });
  check(`taking ${pick?.name} is accepted`, accepted.status === 201,
    `HTTP ${accepted.status} ${JSON.stringify(accepted.data).slice(0, 90)}`);

  const team = (await api("GET", "/team")).data;
  check("the manager has a club again, and it is that club",
    team?.name === pick.name, `${team?.name}`);
  // ACH moved the manager's record onto the career save for exactly this: the
  // season just played counts, and it came with them to the new club.
  const seasonsAfter = (await api("GET", "/achievements/career-stats")).data?.seasonsCompleted;
  check("the career kept its seasons — they are the manager's, not the club's",
    seasonsAfter === seasonsBeforeSale + 1,
    `${seasonsBeforeSale} before the sale, ${seasonsAfter} at the new club`);
  check("and is no longer looking",
    save()?.seeking == null && save()?.team === team?.id && save()?.club === pick.name,
    JSON.stringify(save()));

  // The club plays out of a beach on its OWN continent. Tokyo Surf Samurai
  // running out of Copacabana Beach is the kind of thing a player notices in
  // the first minute.
  const home = read(
    `SELECT l.country AS country FROM teams t JOIN locations l ON l.id = t.location_id
      WHERE t.id = ?`, team?.id)[0];
  const CONTINENT_COUNTRIES = {
    south_america: ["Brazil", "Argentina", "Peru", "Chile", "Uruguay", "Colombia", "Mexico"],
    north_america: ["USA", "Canada", "Mexico"],
    europe: ["Spain", "France", "Germany", "Italy", "Netherlands", "Norway", "Poland", "Monaco"],
    asia: ["Thailand", "Indonesia", "Japan", "China", "South Korea"],
    oceania: ["Australia", "New Zealand", "Fiji", "Samoa", "Tonga"],
    africa_middle_east: ["Egypt", "Morocco", "Nigeria", "Israel", "Qatar"],
  };
  const expected = CONTINENT_COUNTRIES[pick.continent] ?? [];
  check("the new club plays out of a beach on its own continent",
    expected.length === 0 || expected.includes(home?.country),
    `${pick.name} (${pick.continent}) is at a beach in ${home?.country}`);

  const roster = (await api("GET", "/team/roster")).data ?? {};
  const squad = [...(roster.activePlayers ?? []), ...(roster.benchPlayers ?? [])];
  check("the new club has a squad it can field", squad.length >= 2, `${squad.length} players`);
  check("and a balance of its own, not the old club's",
    Number(team?.budget ?? 0) > 0 && Number(team?.budget ?? 0) !== 120_000,
    money(Number(team?.budget ?? 0)));

  const seats = read(`SELECT COUNT(*) AS n FROM competitors WHERE team_id IS NOT NULL`)[0].n;
  check("the club the manager left kept its seat, and the new club has it — not a second one",
    seats === 1, `${seats} club(s) with a seat of their own`);

  const ach = (await api("GET", "/achievements")).data ?? [];
  check("and 'Sold On' is unlocked: a club lost, another taken, still managing",
    ach.find((a) => a.key === "sold_on")?.unlocked === true,
    ach.filter((a) => a.unlocked).map((a) => a.key).join(", ") || "nothing unlocked");

  // The achievements are the MANAGER's. They are stored against a team id,
  // so unless they move with the manager the cabinet reads empty at the new
  // club - and the achievement check, seeing a club with nothing unlocked,
  // pops all thirty a second time.
  const keysAfter = ach.filter((a) => a.unlocked).map((a) => a.key).sort();
  const lost = keysBeforeSale.filter((k) => !keysAfter.includes(k));
  check("everything the manager had unlocked came with them to the new club",
    lost.length === 0,
    `${keysBeforeSale.length} before the sale, ${keysAfter.length} after` +
      (lost.length ? `, left behind: ${lost.join(", ")}` : ""));
  const leftBehind = read(`SELECT COUNT(*) AS n FROM achievements WHERE team_id = ?`, teamId)[0].n;
  check("and none of them was left with the club that was sold",
    leftBehind === 0, `${leftBehind} row(s) still against the old club`);
  const twice = read(
    `SELECT achievement_key AS k, COUNT(*) AS n FROM achievements GROUP BY achievement_key HAVING n > 1`);
  check("and nothing was unlocked a second time - no manager is told twice",
    twice.length === 0, twice.map((d) => `${d.k} x${d.n}`).join(", "));

  // Rob's rule: exactly thirty achievements. The career-end screen used to
  // carry its own hardcoded 25 and told a manager with 28 of them "28 / 25".
  const summary = (await api("GET", "/careers/summary")).data;
  check("the career summary counts all thirty achievements, not a number of its own",
    summary?.totalAchievements === 30,
    `${summary?.achievementsCompleted} of ${summary?.totalAchievements}`);

  // ── 5b. The new club is judged on its own seasons ─────────────────────
  //
  // There is one board row per career per season, and until L-02e that was the
  // same thing as one per club. It is not any more. The rollover opens the next
  // season's row for the club it is about to sell, and the manager joins that
  // same season at a new club days later - so unless the row changes hands with
  // it, the new club's first season is measured against the sold club's balance
  // and its losing run is the sold club's five. The manager takes a job and is
  // sold out of it again at the end of their first season, told it was five.
  console.log("\n5b. THE NEW CLUB IS JUDGED ON ITS OWN SEASONS, NOT THE SOLD CLUB'S");
  const joinedYear = read(
    `SELECT year FROM seasons WHERE career_save_id = ? AND status = 'active'
      ORDER BY year DESC LIMIT 1`, careerSaveId)[0]?.year;
  const joinedRow = read(
    `SELECT team_id AS team, season_start_balance AS opened, forfeits, reviewed_on AS reviewed
       FROM board_seasons WHERE career_save_id = ? AND season_year = ?`, careerSaveId, joinedYear)[0];
  check("the season the manager joined is the new club's season, not the sold club's",
    joinedRow?.team === team?.id, `board row names club ${joinedRow?.team}, the new club is ${team?.id}`);
  check("and it opens on the new club's own balance, with nothing on it",
    Math.round(Number(joinedRow?.opened ?? -1)) === Math.round(Number(team?.budget ?? 0))
      && joinedRow?.forfeits === 0 && joinedRow?.reviewed == null,
    `opened on ${money(Number(joinedRow?.opened ?? 0))}, club has ${money(Number(team?.budget ?? 0))}, ` +
      `${joinedRow?.forfeits} forfeit(s)`);
  const soldClubSeasons = read(
    `SELECT COUNT(*) AS n FROM board_seasons WHERE career_save_id = ? AND team_id = ?`,
    careerSaveId, teamId)[0].n;
  check("the sold club's seasons are still recorded under the sold club",
    soldClubSeasons >= TO_SALE, `${soldClubSeasons} season(s) under the club that was sold`);

  // Now lose money at the new club, once.
  //
  // $400,000 is chosen to be BELOW the sold club's last opening ($500,000), so
  // a run read off the career rather than the club would not stop here: it
  // would see a sixth falling season and sell the club the manager has just
  // taken, at the end of their first season, in a review that said five. The
  // club's balance is then held down through the season so that finishing
  // below what it opened on is certain rather than likely.
  const SOLD_CLUB_LAST_OPENING = Number(read(
    `SELECT season_start_balance AS b FROM board_seasons
      WHERE career_save_id = ? AND team_id = ? ORDER BY season_year DESC LIMIT 1`,
    careerSaveId, teamId)[0]?.b ?? 0);
  const NEW_CLUB_OPENING = 400_000;
  const HELD_BALANCE = 100_000;
  check("the new club's season is set up to continue the sold club's falling chain",
    NEW_CLUB_OPENING < SOLD_CLUB_LAST_OPENING && HELD_BALANCE < NEW_CLUB_OPENING,
    `${money(SOLD_CLUB_LAST_OPENING)} > ${money(NEW_CLUB_OPENING)} > ${money(HELD_BALANCE)}`);
  write(`UPDATE board_seasons SET season_start_balance = ? WHERE career_save_id = ? AND season_year = ?`,
    NEW_CLUB_OPENING, careerSaveId, joinedYear);
  let secondBoundary = null, stopped2 = "";
  for (let i = 0; i < 600; i++) {
    healAllSquads(dbFile);
    await keepSideFielded(api);
    await renewExpiringContracts(api);
    write(`UPDATE teams SET budget = ? WHERE id = ?`, HELD_BALANCE, team?.id);
    const r = await api("POST", "/calendar/advance", {});
    if (r.status >= 400) { stopped2 = `advance HTTP ${r.status} ${JSON.stringify(r.data).slice(0, 80)}`; break; }
    if (r.data?.blocked === "pending_match") {
      await api("POST", `/matches/${r.data.pendingMatchId}/simulate`, {});
      await api("POST", "/calendar/skip-match", {});
      continue;
    }
    const mid = r.data?.matchDay?.matchId;
    if (mid) { await api("POST", `/matches/${mid}/simulate`, {}); await api("POST", "/calendar/dismiss-match", {}); }
    if (r.data?.seasonRollover && r.data.seasonRollover.kind !== "none") { secondBoundary = r.data; break; }
  }
  check("the new club's first season reached its boundary", secondBoundary !== null, stopped2 || "rolled");
  const reviewed = read(
    `SELECT outcome, money_points AS money, season_start_balance AS opened FROM board_seasons
      WHERE career_save_id = ? AND season_year = ?`, careerSaveId, joinedYear)[0];
  check("the board saw a loss-making season at the new club",
    Number(reviewed?.money ?? 0) < 0,
    `opened on ${money(Number(reviewed?.opened ?? 0))}, money ${reviewed?.money}`);
  // Unscoped, the chain of openings from the sold club runs straight through
  // this season: that is the run this suite exists to keep apart from it.
  const unscoped = read(
    `SELECT season_year AS y, season_start_balance AS b FROM board_seasons
      WHERE career_save_id = ? ORDER BY season_year`, careerSaveId);
  check("read off the career instead of the club, the chain would have reached the sale",
    unscoped.length > TO_SALE && unscoped.every((r, i) => i === 0 || r.b < unscoped[i - 1].b),
    unscoped.map((r) => `${r.y}:${money(r.b)}`).join(" > "));
  check("a losing first season at the new club is ONE losing season, not the sixth",
    reviewed?.outcome !== "sold" && secondBoundary?.clubSold !== true,
    `the board said "${reviewed?.outcome}", sold ${secondBoundary?.clubSold === true}`);
  check("and the manager still has the club they took",
    save()?.team === team?.id && save()?.seeking == null, JSON.stringify(save()));

  // ── 6. Declining is retirement ────────────────────────────────────────────
  console.log("\n6. DECLINING EVERY VACANCY IS RETIREMENT");
  const notSeeking = await api("POST", "/job-market/retire", {});
  check("a manager with a club cannot retire through the job market", notSeeking.status === 409,
    `HTTP ${notSeeking.status} ${notSeeking.data?.error ?? ""}`);

  // Put the career back out of work the way the sale does — which includes
  // remembering the club it just lost, because that is the club the career is
  // archived under when the manager stops.
  write(`UPDATE career_saves SET team_id = NULL, former_team_id = ?, seeking_club_since = ? WHERE id = ?`,
    team?.id, Date.now(), careerSaveId);

  // A club the manager has already run is never offered again. The vacancies
  // are the highest-rated clubs outside the World Tour field, and the club just
  // lost is exactly that - so without saying it was taken over, a second sale
  // sells the club and then lists it, by name, among the jobs going.
  const second = (await api("GET", "/job-market")).data?.vacancies ?? [];
  check("the club the manager has just run is not offered back to them",
    second.length > 0 && second.every((v) => v.poolTeamId !== pick.poolTeamId),
    `${second.length} offered: ${second.map((v) => v.name).join(", ")}`);

  const retired = await api("POST", "/job-market/retire", {});
  check("declining them all ends the career", retired.status === 200 && retired.data?.retired === true,
    `HTTP ${retired.status} ${JSON.stringify(retired.data)}`);
  check("and the save is finished, not left hanging",
    save()?.retired != null && save()?.seeking == null, JSON.stringify(save()));

  // A career that ends has to end the way every other ending does, or the
  // career-end screen falls back to its default and tells a manager who chose
  // to stop that they were sacked.
  const ending = read(
    `SELECT type, description FROM career_history_entries
      WHERE career_save_id = ? ORDER BY id DESC LIMIT 1`, careerSaveId)[0];
  check("the history says they retired, in the game's own words",
    ending?.type === "retirement" && /retired rather than take another club/.test(ending?.description ?? ""),
    `${ending?.type}: ${ending?.description}`);
  const archived = read(
    `SELECT manager_name AS m, club_name AS c FROM hall_of_fame ORDER BY id DESC LIMIT 1`)[0];
  check("and the career is archived to the Hall of Fame, under the club they last had",
    archived?.m === "JobMarket", `${archived?.m} of ${archived?.c}`);
  // Quitting at the job market is the natural moment to stop playing: you have
  // just lost your club. `GET /api/team` answers 404 for a career between
  // clubs, which is the same answer as "no career at all" - so the title
  // screen offered a NEW CAREER to a manager who already had one, and the
  // dismissed-title path bounced them back to it.
  const guard = fs.readFileSync(
    path.join(REPO, "artifacts/beach-volleyball/src/components/layout/auth-guard.tsx"), "utf8");
  check("the game comes back to the job market rather than offering a new career",
    /seekingClub/.test(guard) && /href = "\/job-market"/.test(guard)
      && /hasTeam \|\| seekingClub \? "CONTINUE"/.test(guard),
    "auth-guard asks the job market before it decides a career has ended");

  const screen = fs.readFileSync(
    path.join(REPO, "artifacts/beach-volleyball/src/pages/career-end.tsx"), "utf8");
  check("and the career-end screen has a title for it",
    /retirement:\s*\{ title: "You Retired"/.test(screen) && !/club_sold:/.test(screen),
    "retirement titled; club_sold deliberately absent — the club ending is not the career ending");

  // ── 7. Throwing away a career that is between clubs ───────────────────────
  //
  // `career_saves.former_team_id` is a foreign key to a team that a profile
  // deletion also deletes. Deleting a profile is something a player does from
  // the Select Manager screen, and a cascade that trips over its own key is a
  // crash at exactly the wrong moment.
  console.log("\n7. A PROFILE CAN STILL BE DELETED WHILE A CAREER IS BETWEEN CLUBS");
  cookie = "";
  const prof2 = await api("POST", "/profiles", { name: "JobMarketGone" });
  await api("POST", `/profiles/${prof2.data.id}/select`);
  const career2 = await api("POST", "/careers", {
    slotNumber: 1, managerName: "JobMarketGone", managerNationality: "Australia",
    clubName: "JobMarketGone FC", originalClubName: "JobMarketGone FC",
    budget: "500000", difficulty: "established",
    primaryColor: "#0a0", secondaryColor: "#00a", crestShapeIndex: 0,
    season: "Season 1", locationId: 1,
  });
  check("a second career was created", career2.status === 200, `HTTP ${career2.status}`);
  write(`UPDATE career_saves SET team_id = NULL, former_team_id = ?, seeking_club_since = ? WHERE id = ?`,
    career2.data.teamId, Date.now(), career2.data.id);

  const gone = await api("DELETE", `/profiles/${prof2.data.id}`);
  check("deleting the profile is accepted", gone.status < 300,
    `HTTP ${gone.status} ${JSON.stringify(gone.data).slice(0, 90)}`);
  const leftovers = read(
    `SELECT (SELECT COUNT(*) FROM career_saves WHERE id = ?) AS saves,
            (SELECT COUNT(*) FROM teams WHERE id = ?) AS teams`,
    career2.data.id, career2.data.teamId)[0];
  check("and it took the career and the club with it, key and all",
    leftovers?.saves === 0 && leftovers?.teams === 0, JSON.stringify(leftovers));

} finally {
  await stopServer(child);
  try { fs.closeSync(out); } catch { /* already closed */ }
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
