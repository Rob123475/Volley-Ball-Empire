/**
 * Regional league season utilities:
 *  - Ladder computation with full tie-breaker chain
 *  - Season resolution (qualification, relegation, promotion, next-season fixture generation)
 */

import { db } from "@workspace/db";
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

async function fetchLadderData(seasonId: number): Promise<{
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
  const fixtures = await db
    .select({
      id:             regionalLeagueFixturesTable.id,
      homePoolTeamId: regionalLeagueFixturesTable.homePoolTeamId,
      awayPoolTeamId: regionalLeagueFixturesTable.awayPoolTeamId,
      status:         regionalLeagueFixturesTable.status,
    })
    .from(regionalLeagueFixturesTable)
    .where(eq(regionalLeagueFixturesTable.regionalLeagueSeasonId, seasonId));

  const fixtureIds = fixtures.map(f => f.id);

  const results = fixtureIds.length > 0
    ? await db
        .select({
          fixtureId:       regionalLeagueResultsTable.fixtureId,
          winnerId:        regionalLeagueResultsTable.winnerId,
          homeSets:        regionalLeagueResultsTable.homeSets,
          awaySets:        regionalLeagueResultsTable.awaySets,
          homeMatchPoints: regionalLeagueResultsTable.homeMatchPoints,
          awayMatchPoints: regionalLeagueResultsTable.awayMatchPoints,
        })
        .from(regionalLeagueResultsTable)
        .where(inArray(regionalLeagueResultsTable.fixtureId, fixtureIds))
    : [];

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
export async function computeLadderForSeason(seasonId: number): Promise<Ladder> {
  const { fixtures, results, poolRankings } = await fetchLadderData(seasonId);
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
export async function resolveRegionalSeason(seasonId: number): Promise<void> {
  // ── 1. Load and validate season ───────────────────────────────────────────
  const [season] = await db
    .select()
    .from(regionalLeagueSeasonsTable)
    .where(eq(regionalLeagueSeasonsTable.id, seasonId));
  if (!season) throw new Error(`Season ${seasonId} not found`);
  if (season.status === "completed") throw new Error(`Season ${seasonId} is already completed`);

  const { fixtures, results, poolRankings } = await fetchLadderData(seasonId);

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
  await db.transaction(async (tx) => {
    // Insert World Tour qualification rows for top 3
    for (let i = 0; i < Math.min(3, ladder.length); i++) {
      await tx.insert(worldTourQualificationsTable).values({
        seasonYear:         season.seasonYear,
        continent:          season.continent,
        poolTeamId:         ladder[i]!.poolTeamId,
        qualifyingPosition: i + 1,
      });
    }

    // Relegate 6th-place team
    const sixthEntry = ladder[5];
    if (sixthEntry) {
      const sixth = await getTeamTx(tx, sixthEntry.poolTeamId);
      await tx
        .update(continentalPoolTeamsTable)
        .set({ isActiveInLeague: false, relegationCount: sixth.relegationCount + 1 })
        .where(eq(continentalPoolTeamsTable.id, sixthEntry.poolTeamId));
    }

    // Promote top bench team (lowest poolRanking among bench for this continent,
    // excluding the just-relegated team)
    const sixthId = ladder[5]?.poolTeamId ?? null;
    const benchTeams = await tx
      .select()
      .from(continentalPoolTeamsTable)
      .where(
        and(
          eq(continentalPoolTeamsTable.continent, season.continent),
          eq(continentalPoolTeamsTable.isActiveInLeague, false),
        ),
      );
    const candidates = benchTeams
      .filter(t => t.id !== sixthId)
      .sort((a, b) => a.poolRanking - b.poolRanking);

    const promoted = candidates[0] ?? null;
    if (promoted) {
      await tx
        .update(continentalPoolTeamsTable)
        .set({ isActiveInLeague: true, promotionCount: promoted.promotionCount + 1 })
        .where(eq(continentalPoolTeamsTable.id, promoted.id));
    }

    // Build next-season roster: replace relegated slot with promoted team
    const nextTeamIds = (season.teamIds as number[]).slice();
    if (sixthId !== null && promoted) {
      const idx = nextTeamIds.indexOf(sixthId);
      if (idx !== -1) nextTeamIds[idx] = promoted.id;
    }

    // Create next-season record
    const [nextSeason] = await tx
      .insert(regionalLeagueSeasonsTable)
      .values({
        seasonYear: season.seasonYear + 1,
        continent:  season.continent,
        teamIds:    nextTeamIds,
        status:     "active",
      })
      .returning();

    if (nextSeason) {
      const fixtureSlots = generateDoubleRoundRobin(nextTeamIds);
      await tx.insert(regionalLeagueFixturesTable).values(
        fixtureSlots.map(s => ({
          regionalLeagueSeasonId: nextSeason.id,
          round:          s.round,
          homePoolTeamId: s.home,
          awayPoolTeamId: s.away,
          status:         "scheduled" as const,
        })),
      );
    }

    // Mark current season completed
    await tx
      .update(regionalLeagueSeasonsTable)
      .set({ status: "completed" })
      .where(eq(regionalLeagueSeasonsTable.id, seasonId));
  });
}

async function getTeam(id: number) {
  const [t] = await db.select().from(continentalPoolTeamsTable).where(eq(continentalPoolTeamsTable.id, id));
  if (!t) throw new Error(`Pool team ${id} not found`);
  return t;
}

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function getTeamTx(tx: DbTx, id: number) {
  const [t] = await tx.select().from(continentalPoolTeamsTable).where(eq(continentalPoolTeamsTable.id, id));
  if (!t) throw new Error(`Pool team ${id} not found`);
  return t;
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
