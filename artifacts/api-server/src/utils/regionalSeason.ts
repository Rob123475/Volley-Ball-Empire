/**
 * Regional league season utilities:
 *  - Ladder computation with full tie-breaker chain
 *  - Season resolution (qualification, relegation, promotion, next-season fixture generation)
 */

import { db } from "@workspace/db";
import { careerPoolTeamStateTable } from "@workspace/db";
import {
  loadFixtures, loadResultsForFixtures, loadLeagueSeason, loadLeagueSeasons,
} from "../lib/regionalLeague.js";
import { withCareerStateTx } from "../lib/playerDto.js";
import {
  regionalLeagueSeasonsTable,
  regionalLeagueFixturesTable,
  regionalLeagueResultsTable,
  worldTourQualificationsTable,
  continentalPoolTeamsTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { generateDoubleRoundRobin } from "./fixtures.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type LadderEntry = {
  poolTeamId: number;
  played: number;
  wins: number;
  losses: number;
  points: number;
  setWins: number;
  setLosses: number;
  setDiff: number;
  matchPointsFor: number;
  matchPointsAgainst: number;
  matchPointDiff: number;
};

export type Ladder = LadderEntry[];

// ── Ladder computation ────────────────────────────────────────────────────────

/**
 * Pure function: reduce completed results into a sorted standings array.
 * Tie-breaker order:
 *   1. Points (win = 3 pts)
 *   2. Wins
 *   3. Set difference (set wins − set losses)
 *   4. Match-point difference
 *   5. Head-to-head points (among tied teams)
 *   6. Stable seeded rank (poolRanking from pool team record)
 */
export function computeRegionalLadder(
  fixtures: Array<{
    id: number;
    homePoolTeamId: number;
    awayPoolTeamId: number;
    status: string;
  }>,
  results: Array<{
    fixtureId: number;
    winnerId: number | null;
    homeSets: number;
    awaySets: number;
    homeMatchPoints: number;
    awayMatchPoints: number;
  }>,
  poolRankings: Map<number, number>,
): Ladder {
  const resultMap = new Map(results.map(r => [r.fixtureId, r]));
  const entriesMap = new Map<number, LadderEntry>();

  function getOrCreate(teamId: number): LadderEntry {
    if (!entriesMap.has(teamId)) {
      entriesMap.set(teamId, {
        poolTeamId: teamId,
        played: 0,
        wins: 0,
        losses: 0,
        points: 0,
        setWins: 0,
        setLosses: 0,
        setDiff: 0,
        matchPointsFor: 0,
        matchPointsAgainst: 0,
        matchPointDiff: 0,
      });
    }
    return entriesMap.get(teamId)!;
  }

  for (const fixture of fixtures) {
    if (fixture.status !== "completed") continue;
    const result = resultMap.get(fixture.id);
    if (!result) continue;

    const home = getOrCreate(fixture.homePoolTeamId);
    const away = getOrCreate(fixture.awayPoolTeamId);

    const homeWon = result.homeSets > result.awaySets;

    home.played++;
    away.played++;
    home.setWins    += result.homeSets;
    home.setLosses  += result.awaySets;
    away.setWins    += result.awaySets;
    away.setLosses  += result.homeSets;
    home.matchPointsFor      += result.homeMatchPoints;
    home.matchPointsAgainst  += result.awayMatchPoints;
    away.matchPointsFor      += result.awayMatchPoints;
    away.matchPointsAgainst  += result.homeMatchPoints;

    if (homeWon) {
      home.wins++;
      home.points += 3;
      away.losses++;
    } else {
      away.wins++;
      away.points += 3;
      home.losses++;
    }
  }

  // Recalculate derived diffs
  for (const e of entriesMap.values()) {
    e.setDiff        = e.setWins - e.setLosses;
    e.matchPointDiff = e.matchPointsFor - e.matchPointsAgainst;
  }

  const ladder = Array.from(entriesMap.values());

  // Head-to-head helper: points scored by teamA against teamB
  function h2hPoints(aId: number, bId: number): number {
    let pts = 0;
    for (const fixture of fixtures) {
      const result = resultMap.get(fixture.id);
      if (!result) continue;
      if (fixture.homePoolTeamId === aId && fixture.awayPoolTeamId === bId) {
        pts += result.homeSets > result.awaySets ? 3 : 0;
      } else if (fixture.homePoolTeamId === bId && fixture.awayPoolTeamId === aId) {
        pts += result.awaySets > result.homeSets ? 3 : 0;
      }
    }
    return pts;
  }

  ladder.sort((a, b) => {
    if (b.points        !== a.points)        return b.points        - a.points;
    if (b.wins          !== a.wins)           return b.wins          - a.wins;
    if (b.setDiff       !== a.setDiff)        return b.setDiff       - a.setDiff;
    if (b.matchPointDiff!== a.matchPointDiff) return b.matchPointDiff- a.matchPointDiff;
    const h2h = h2hPoints(b.poolTeamId, a.poolTeamId) - h2hPoints(a.poolTeamId, b.poolTeamId);
    if (h2h !== 0) return h2h;
    // Stable: lower poolRanking = better seed
    return (poolRankings.get(a.poolTeamId) ?? 99) - (poolRankings.get(b.poolTeamId) ?? 99);
  });

  return ladder;
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchLadderData(seasonId: number, careerSaveId: number): Promise<{
  fixtures: Array<{
    id: number;
    homePoolTeamId: number;
    awayPoolTeamId: number;
    status: string;
  }>;
  results: Array<{
    fixtureId: number;
    winnerId: number | null;
    homeSets: number;
    awaySets: number;
    homeMatchPoints: number;
    awayMatchPoints: number;
  }>;
  poolRankings: Map<number, number>;
}> {
  const fixtures = await loadFixtures(careerSaveId, { seasonId });

  const fixtureIds = fixtures.map(f => f.id);

  const results = await loadResultsForFixtures(careerSaveId, fixtureIds);

  // Collect all participating team IDs
  const allTeamIds = Array.from(new Set([
    ...fixtures.map(f => f.homePoolTeamId),
    ...fixtures.map(f => f.awayPoolTeamId),
  ]));

  const poolTeams = allTeamIds.length > 0
    ? await db
        .select({ id: continentalPoolTeamsTable.id, poolRanking: continentalPoolTeamsTable.poolRanking })
        .from(continentalPoolTeamsTable)
        .where(inArray(continentalPoolTeamsTable.id, allTeamIds))
    : [];

  const poolRankings = new Map(poolTeams.map(t => [t.id, t.poolRanking]));

  return { fixtures, results, poolRankings };
}

// Public: compute ladder from DB for a given season
export async function computeLadderForSeason(
  seasonId: number,
  careerSaveId: number,
): Promise<Ladder> {
  const { fixtures, results, poolRankings } = await fetchLadderData(seasonId, careerSaveId);
  return computeRegionalLadder(fixtures, results, poolRankings);
}

// ── Season resolution ─────────────────────────────────────────────────────────

/**
 * Resolve a completed regional season:
 *  - Insert World Tour qualification rows for positions 1–3
 *  - Set 6th-place team isActiveInLeague=false, increment relegationCount
 *  - Promote highest-ranked bench team: isActiveInLeague=true, increment promotionCount
 *  - Create a new regional_league_seasons row for seasonYear+1 with the updated roster
 *  - Generate and insert 30 new fixtures for the next season
 *  - Mark the resolved season as 'completed'
 */
/**
 * @param careerSaveId Promotion and relegation are per-career now: relegating a
 *   club used to relegate it in every other save's league too. Threaded as a
 *   parameter rather than read off the season because seasons are not scoped
 *   until 0.6d, and an explicit argument makes the compiler check every caller.
 */
export async function resolveRegionalSeason(
  seasonId: number,
  careerSaveId: number,
): Promise<void> {
  // ── 1. Load and validate season ───────────────────────────────────────────
  const season = await loadLeagueSeason(careerSaveId, seasonId);
  if (!season) throw new Error(`Season ${seasonId} not found`);
  if (season.status === "completed") throw new Error(`Season ${seasonId} is already completed`);

  const { fixtures, results, poolRankings } = await fetchLadderData(seasonId, careerSaveId);

  // ── 2. Completion guard: all 30 fixtures must be completed ────────────────
  const totalFixtures = fixtures.length;
  const completedFixtures = fixtures.filter(f => f.status === "completed").length;
  if (totalFixtures !== 30) {
    throw new Error(`Expected 30 fixtures for season ${seasonId}, found ${totalFixtures}`);
  }
  if (completedFixtures !== 30) {
    throw new Error(
      `Season ${seasonId} is not fully played: ${completedFixtures}/30 fixtures completed`,
    );
  }

  const ladder = computeRegionalLadder(fixtures, results, poolRankings);

  // ── 3. All writes in a single transaction ─────────────────────────────────
  // NOTE: better-sqlite3 transactions must be synchronous — its native
  // .transaction() wrapper throws "Transaction function cannot return a
  // promise" if the callback is `async`. Every statement below uses the
  // driver's synchronous .run()/.all() accessors instead of await, and the
  // callback itself is a plain (non-async) function. If you ever see that
  // exact TypeError, this is why — and check whether the caller wraps this
  // in a bare `catch {}`, which will hide it completely (writes still land,
  // but non-atomically, as individually auto-committed statements outside
  // any real transaction).
  withCareerStateTx(({ tx, setPoolTeamState, insertLeagueSeason, insertLeagueFixtures, setLeagueSeasonStatus }) => {
    // Insert World Tour qualification rows for top 3
    for (let i = 0; i < Math.min(3, ladder.length); i++) {
      tx.insert(worldTourQualificationsTable).values({
        seasonYear:         season.seasonYear,
        continent:          season.continent,
        poolTeamId:         ladder[i]!.poolTeamId,
        qualifyingPosition: i + 1,
      }).run();
    }

    // Relegate 6th-place team
    const sixthEntry = ladder[5];
    if (sixthEntry) {
      const sixth = getPoolStateTx(tx, careerSaveId, sixthEntry.poolTeamId);
      setPoolTeamState(careerSaveId, sixthEntry.poolTeamId, {
        isActiveInLeague: false,
        relegationCount:  sixth.relegationCount + 1,
      });
    }

    // Promote top bench team (lowest poolRanking among bench for this continent,
    // excluding the just-relegated team)
    const sixthId = ladder[5]?.poolTeamId ?? null;
    const benchTeams = tx
      .select({ reference: continentalPoolTeamsTable, state: careerPoolTeamStateTable })
      .from(careerPoolTeamStateTable)
      .innerJoin(continentalPoolTeamsTable,
        eq(continentalPoolTeamsTable.id, careerPoolTeamStateTable.poolTeamId))
      .where(
        and(
          eq(careerPoolTeamStateTable.careerSaveId, careerSaveId),
          eq(continentalPoolTeamsTable.continent, season.continent),
          eq(careerPoolTeamStateTable.isActiveInLeague, false),
        ),
      )
      .all()
      .map(r => ({ ...r.reference, ...r.state, id: r.reference.id }));
    const candidates = benchTeams
      .filter(t => t.id !== sixthId)
      .sort((a, b) => a.poolRanking - b.poolRanking);

    const promoted = candidates[0] ?? null;
    if (promoted) {
      setPoolTeamState(careerSaveId, promoted.id, {
        isActiveInLeague: true,
        promotionCount:   promoted.promotionCount + 1,
      });
    }

    // Build next-season roster: replace relegated slot with promoted team
    const nextTeamIds = (season.teamIds as number[]).slice();
    if (sixthId !== null && promoted) {
      const idx = nextTeamIds.indexOf(sixthId);
      if (idx !== -1) nextTeamIds[idx] = promoted.id;
    }

    // Create next-season record
    const nextSeasonId = insertLeagueSeason(careerSaveId, {
      seasonYear: season.seasonYear + 1,
      continent:  season.continent,
      teamIds:    nextTeamIds,
      status:     "active",
    });

    insertLeagueFixtures(careerSaveId, nextSeasonId,
      generateDoubleRoundRobin(nextTeamIds).map(s => ({
        round:          s.round,
        homePoolTeamId: s.home,
        awayPoolTeamId: s.away,
        status:         "scheduled",
      })));

    // Mark current season completed
    setLeagueSeasonStatus(careerSaveId, seasonId, "completed");
  });
}

// ── Calendar integration: auto-simulate a regional round ─────────────────────

/**
 * Auto-simulate all regional fixtures for a given round number across every
 * active continental season.
 *
 * Called by the calendar advance endpoint when it reaches a regional slot (1–10).
 * Returns a summary of how many fixtures were simulated per continent.
 *
 * No year parameter: regional_league_seasons.seasonYear is an internal
 * ordinal counter local to the regional league (resolveRegionalSeason sets
 * it to `season.seasonYear + 1` on rollover), unrelated to the career's
 * real calendar year (seasons.year, e.g. 2026). Matching on status="active"
 * alone — the same pattern getActiveSeason() already uses — avoids the
 * two ever being conflated again.
 */
export async function simulateRegionalRound(
  roundNumber: number,
  careerSaveId: number,
): Promise<Array<{ continent: string; simulated: number }>> {
  // Load all active seasons (one per continent, in lockstep)
  const activeSeasons = await loadLeagueSeasons(careerSaveId, { status: "active" });

  if (activeSeasons.length === 0) return [];

  const seasonIds = activeSeasons.map(s => s.id);

  // Load ALL pool teams once (for rating lookup)
  const allPoolTeams = await db
    .select({ id: continentalPoolTeamsTable.id, poolRanking: continentalPoolTeamsTable.poolRanking })
    .from(continentalPoolTeamsTable);
  const ratingByTeamId = new Map(
    allPoolTeams.map(t => [t.id, 100 - (t.poolRanking - 1) * 8]),
  );

  // Load all scheduled fixtures for this round across all active seasons
  const fixtures = await loadFixtures(careerSaveId, {
    seasonIds, round: roundNumber, status: "scheduled",
  });

  if (fixtures.length === 0) return [];

  // Simulate each fixture and write results
  const summaryMap = new Map<string, number>();

  // Synchronous callback — see the note on the transaction in
  // resolveRegionalSeason() above for why (better-sqlite3 requirement).
  withCareerStateTx(({ insertLeagueResult, setFixtureResult }) => {
    for (const fixture of fixtures) {
      const homeRating = ratingByTeamId.get(fixture.homePoolTeamId) ?? 70;
      const awayRating = ratingByTeamId.get(fixture.awayPoolTeamId) ?? 70;
      const result = simulateFixtureResult(homeRating, awayRating);

      const winnerId =
        result.winnerId === "home" ? fixture.homePoolTeamId : fixture.awayPoolTeamId;

      insertLeagueResult(careerSaveId, {
        fixtureId:       fixture.id,
        winnerId,
        homeSets:        result.homeSets,
        awaySets:        result.awaySets,
        homeMatchPoints: result.homeMatchPoints,
        awayMatchPoints: result.awayMatchPoints,
      });

      setFixtureResult(careerSaveId, fixture.id, {
        status: "completed", homeScore: result.homeSets, awayScore: result.awaySets,
      });

      // Track per-season continent for summary
      const season = activeSeasons.find(s => s.id === fixture.regionalLeagueSeasonId);
      if (season) {
        summaryMap.set(season.continent, (summaryMap.get(season.continent) ?? 0) + 1);
      }
    }
  });

  return Array.from(summaryMap.entries()).map(([continent, simulated]) => ({ continent, simulated }));
}

async function getTeam(id: number) {
  const [t] = await db.select().from(continentalPoolTeamsTable).where(eq(continentalPoolTeamsTable.id, id));
  if (!t) throw new Error(`Pool team ${id} not found`);
  return t;
}

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function getTeamTx(tx: DbTx, id: number) {
  const [t] = tx.select().from(continentalPoolTeamsTable).where(eq(continentalPoolTeamsTable.id, id)).all();
  if (!t) throw new Error(`Pool team ${id} not found`);
  return t;
}

/** This career's mutable half of a pool club. */
function getPoolStateTx(tx: DbTx, careerSaveId: number, poolTeamId: number) {
  const [s] = tx
    .select()
    .from(careerPoolTeamStateTable)
    .where(and(
      eq(careerPoolTeamStateTable.careerSaveId, careerSaveId),
      eq(careerPoolTeamStateTable.poolTeamId, poolTeamId),
    ))
    .all();
  if (!s) throw new Error(`No career ${careerSaveId} state for pool team ${poolTeamId}`);
  return s;
}

// ── AI match simulation ───────────────────────────────────────────────────────

/**
 * Simulate a single fixture result using team rating + form.
 * Higher-rated team wins ~70% of the time with realistic set/point spreads.
 */
export function simulateFixtureResult(
  homeRating: number,
  awayRating: number,
): { homeSets: number; awaySets: number; homeMatchPoints: number; awayMatchPoints: number; winnerId: "home" | "away" } {
  const homeAdv = 2; // home advantage points
  const effectiveHome = homeRating + homeAdv + (Math.random() * 20 - 10);
  const effectiveAway = awayRating + (Math.random() * 20 - 10);

  const homeWins = effectiveHome > effectiveAway;
  const homeSets = homeWins ? 2 : Math.random() < 0.4 ? 1 : 0;
  const awaySets = homeWins ? (Math.random() < 0.4 ? 1 : 0) : 2;

  // Per-set point totals (beach volleyball: first to 21, tie-break to 15)
  function setPoints(winner: boolean): { won: number; lost: number } {
    if (winner) {
      const won = 21;
      const lost = Math.floor(Math.random() * 18) + 3; // 3..20
      return { won, lost };
    } else {
      const lost = 21;
      const won = Math.floor(Math.random() * 18) + 3;
      return { won, lost };
    }
  }

  let homeMatchPoints = 0;
  let awayMatchPoints = 0;
  const totalSets = homeSets + awaySets;
  for (let i = 0; i < totalSets; i++) {
    const homeWinsSet = i < homeSets;
    const pts = setPoints(homeWinsSet);
    homeMatchPoints += pts.won;
    awayMatchPoints += pts.lost;
  }

  return {
    homeSets,
    awaySets,
    homeMatchPoints,
    awayMatchPoints,
    winnerId: homeWins ? "home" : "away",
  };
}
