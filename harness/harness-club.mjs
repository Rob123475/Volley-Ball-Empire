/**
 * R-80 (closes R-78) — a harness club, in the harness's own throwaway database.
 *
 * Two operations, both on the file the running suite created and owns, and
 * neither known to any shipped code: make the club's squad fit again, and make
 * it strong enough that a result the suite is not trying to measure stops being
 * a dice roll.
 *
 * WHY THIS EXISTS
 * Four suites were failing at random — smoke ("none of them was forfeited"),
 * watched-match check 3, world-tour-competitors ("every result is a legal
 * best-of-three") and trophies ("no champion in 8 seasons"). Measured before
 * any change: smoke alone failed 8 of 36 runs on identical code.
 *
 * The cause was proven, not assumed. Every forfeit observed carried the server's
 * own R-48 reason ("fewer than 2 contracted players fit to play"), a squad of
 * exactly 2, both under contract, and exactly one of them carrying a "Major
 * Injury" — never a squad that was short of contracts. So it is the R-50 injury
 * roll (3% per player per match, condition.ts INJURY_BASE_RISK) emptying a
 * two-player harness club, and the game is behaving exactly as R-48 and R-50 say
 * it must. The bug was in the test, not the game.
 *
 * WHY IT WRITES TO THE DATABASE RATHER THAN CALLING THE API
 * There is no heal endpoint — the medical routes are all read-only
 * (injury-history, workload, injury-stats), because in the real game injuries
 * heal on the calendar, a week per 7 game days. Nothing the player can click
 * makes a player fit. The alternatives were worse: adding a heal route or a
 * test-only switch would put test scaffolding inside shipped game code, which
 * the rules forbid; releasing and re-signing the injured player would destroy
 * the very condition history the suites then assert on. So the harness edits
 * the throwaway file it owns and nothing else, and no shipped code knows this
 * exists.
 *
 * WHAT IT DOES NOT DO
 * It does not stop injuries happening, and it does not touch any club but the
 * one it is given, so the injury system itself is still exercised and still
 * asserted on by harness/condition.mjs (R-50's own suite, 27 checks, which
 * deliberately injures players and is untouched by this). This only stops a
 * two-player club being wiped out mid-suite by a dice roll that the suite was
 * never trying to measure.
 */
import { DatabaseSync } from "node:sqlite";

/**
 * Make every player at `teamId` in `careerSaveId` fit again.
 *
 * Opens the file, writes, closes — a long-lived handle beside the server's own
 * would sit on the WAL. Returns the number of players healed, so a caller can
 * report it rather than guess.
 */
export function healSquad(dbPath, careerSaveId, teamId) {
  const db = new DatabaseSync(dbPath);
  try {
    const count = db.prepare(
      `SELECT COUNT(*) AS n FROM career_player_state
        WHERE career_save_id = ? AND team_id = ?
          AND (is_injured = 1 OR injury_status <> 'Healthy')`,
    ).get(careerSaveId, teamId)?.n ?? 0;

    if (count > 0) {
      db.prepare(
        `UPDATE career_player_state
            SET injury_status = 'Healthy', injury_weeks_remaining = 0, is_injured = 0
          WHERE career_save_id = ? AND team_id = ?`,
      ).run(careerSaveId, teamId);
    }
    return count;
  } finally {
    db.close();
  }
}

/**
 * The same, for a club the caller knows only by team id — looks the career up
 * from the team's own row. Convenience for suites that never held the career id.
 */
export function healSquadByTeam(dbPath, teamId) {
  const db = new DatabaseSync(dbPath);
  let careerSaveId;
  try {
    careerSaveId = db.prepare(
      `SELECT career_save_id AS c FROM career_player_state WHERE team_id = ? LIMIT 1`,
    ).get(teamId)?.c;
  } finally {
    db.close();
  }
  if (careerSaveId == null) return 0;
  return healSquad(dbPath, careerSaveId, teamId);
}

/**
 * Set every one of this club's players to the engine's top stats.
 *
 * WHY trophies.mjs NEEDS IT
 * That suite has to see one champion season so the champion branch of the
 * trophy writer is exercised at all. Whether the club won the World Finals was
 * left to chance: it played up to eight separate one-season careers and gave up
 * with "no champion in 8 seasons", which is how it failed. Worse for a gate that
 * demands identical totals from run to run, it stopped as soon as it found one,
 * so the number of checks it emitted changed with the dice - 10 one run, 16 the
 * next.
 *
 * sideRating (matchEngine.ts) is the flat mean of power, defense, serve, block,
 * speed and stamina, and World Tour opponents are rated 64 (Bronze) to the mid
 * 80s from their tier. A club at 99 therefore wins its way to the final and
 * wins it, so the champion season is there in the first career, every run.
 *
 * This does not weaken anything. The suite still asserts that the trophy rows
 * equal exactly what that season earned - if the writer credits a title the
 * season did not produce, or misses one it did, the check still fails.
 */
export function maxOutSquad(dbPath, careerSaveId, teamId) {
  const db = new DatabaseSync(dbPath);
  try {
    const info = db.prepare(
      `UPDATE career_player_state
          SET power = 99, defense = 99, serve = 99, block = 99, speed = 99, stamina = 99,
              fitness = 100, fatigue = 0, morale = 100,
              injury_status = 'Healthy', injury_weeks_remaining = 0, is_injured = 0
        WHERE career_save_id = ? AND team_id = ?`,
    ).run(careerSaveId, teamId);
    return Number(info.changes ?? 0);
  } finally {
    db.close();
  }
}

/**
 * Make EVERY club in the throwaway database fit.
 *
 * ── R-80: why this exists as well as healSquad ──────────────────────────────
 * The R-78 root cause turned up six times before anyone swept for it: a
 * harness club is at most three seniors (MAX_SENIORS), the R-50 roll injures
 * 3% of players per match, and R-48 correctly forfeits a club that cannot put
 * two on the sand. A forfeit completes the fixture with no sets, no purse and
 * no squadRating, which quietly breaks any check that was measuring a PLAYED
 * match — scores, purses, ranking points, tier access, board confidence, the
 * lot.
 *
 * A sweep of every fixture-completing call in the harness found sixteen sites
 * across thirteen suites with no guard at all. Rather than wait for Gate 3 to
 * surface them one full run at a time, they all call this.
 *
 * Every club rather than one, because most of these suites never hold their own
 * team id at the point they simulate, and healing the AI clubs changes nothing:
 * a World Tour opponent's strength comes from `opponentRatingFromTier`, not
 * from its players' condition, so their injuries are not an input to any
 * result. The file is this run's own copy and nothing else reads it.
 *
 * NOT used by harness/squad-forfeit.mjs, which exists to prove that a club
 * which cannot field a pair forfeits — healing it would delete the thing it
 * measures.
 */
export function healAllSquads(dbPath) {
  const db = new DatabaseSync(dbPath);
  try {
    const info = db.prepare(
      `UPDATE career_player_state
          SET injury_status = 'Healthy', injury_weeks_remaining = 0, is_injured = 0
        WHERE is_injured = 1 OR injury_status <> 'Healthy'`,
    ).run();
    return Number(info.changes ?? 0);
  } finally {
    db.close();
  }
}

/**
 * Keep a harness club under contract and on the sand, through the real routes.
 *
 * Three suites (retirement, youth rebirth, hall of fame) walk a career across
 * season boundaries for reasons that have nothing to do with squad management,
 * and every one of them was sacked for abandonment (R-48) until it did these
 * two things — which is exactly what a manager does without thinking:
 *
 *   renew    a contract that ends this season is renewed for another, through
 *            POST /contracts/:id/renew. Contracts expire on the game clock
 *            (R-51); a squad nobody re-signs is gone at the boundary.
 *   field    the starting seniors retire at 40 (L-02b) and an academy graduate
 *            promoted by the rollover stays a reserve until somebody gives her
 *            a squad role. Without this the club ends up with a shelf of
 *            graduates and nobody in the side.
 *
 * `api` is the suite's own authenticated caller: (method, path, body).
 */
export async function renewExpiringContracts(api) {
  const season = (await api("GET", "/seasons/current")).data;
  const contracts = (await api("GET", "/contracts")).data;
  if (!season?.endDate || !Array.isArray(contracts)) return { renewed: 0 };
  let renewed = 0;
  for (const c of contracts.filter((k) => k.endDate <= season.endDate)) {
    const r = await api("POST", `/contracts/${c.id}/renew`, { length: "1s" });
    if (r.status === 200) renewed++;
  }
  return { renewed };
}

/** How many players a harness club keeps active. Two is the legal minimum (R-48). */
export const FIELDED = 4;

export async function keepSideFielded(api) {
  const roster = (await api("GET", "/team/roster")).data;
  if (!roster) return { moved: 0 };
  let starters = (roster.starters ?? []).length;
  let active = starters + (roster.interchanges ?? []).length;
  const bench = (roster.reserves ?? [])
    .filter((p) => p.age >= 18 && !p.isRetired && !p.isInjured)
    .sort((a, b) => (b.overallRating ?? b.rating ?? 0) - (a.overallRating ?? a.rating ?? 0));
  let moved = 0;
  for (const p of bench) {
    if (active >= FIELDED) break;
    const role = starters < 2 ? "starter" : "interchange";
    const r = await api("PATCH", `/team/roster/${p.id}/role`, { role });
    if (r.status === 200) { moved++; active++; if (role === "starter") starters++; }
  }
  return { moved };
}

/**
 * Keep a harness club in the black, in the harness's own throwaway database.
 *
 * L-04 made a club that finishes at the bottom lose money every season, and
 * L-02e sells a club that has lost money five seasons running. That is the
 * game working — and it ends the long walks that are measuring something else
 * entirely. youth-rebirth walks thirty seasons to count an academy; it manages
 * no budget, and its clubs were sold in season nineteen.
 *
 * It GRANTS money rather than topping the balance up to a floor, and the
 * difference matters: the board counts a loss-making season by comparing what
 * a club finishes a season with against what it opened it on. A club held at a
 * floor spends down from that floor and is topped back up, so it ends every
 * season below where it started and is sold exactly as before — which is what
 * the first version of this did. A grant at the start of a season leaves the
 * club finishing ahead of where the board opened it, and the run resets.
 *
 * harness/economy.mjs must never call this. It is the suite that measures
 * exactly what this hides.
 */
export function keepClubSolvent(dbPath, teamId, grant = 1_500_000, below = 3_000_000) {
  const db = new DatabaseSync(dbPath);
  try {
    const row = db.prepare(`SELECT budget FROM teams WHERE id = ?`).get(teamId);
    if (!row || Number(row.budget) >= below) return { granted: 0 };
    db.prepare(`UPDATE teams SET budget = budget + ? WHERE id = ?`).run(grant, teamId);
    return { granted: grant, from: Number(row.budget), to: Number(row.budget) + grant };
  } finally {
    db.close();
  }
}
