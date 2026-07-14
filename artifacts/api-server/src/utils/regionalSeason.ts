/**
 * Regional league season utilities:
 *  - Ladder computation with full tie-breaker chain
 *  - Season resolution (qualification, relegation, promotion)
 */

import { db } from "@workspace/db";
import {
  regionalLeagueSeasonsTable,
  regionalLeagueFixturesTable,
  regionalLeagueResultsTable,
  worldTourQualificationsTable,
  continentalPoolTeamsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

// ── Types ─────────────────────────────────────────────────────────────────────

export type LadderEntry = {
  poolTeamId: number | null;
  isUser: boolean;
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
 * Compute the league ladder for a given regional season.
 * Tie-breaker order:
 *   1. Points (win = 3 pts)
 *   2. Wins
 *   3. Set difference (set wins − set losses)
 *   4. Match-point difference
 *   5. Head-to-head points (among tied teams)
 *   6. Stable seeded index (from pool team seededIndex, user = 0)
 */
export async function computeLadder(seasonId: number): Promise<Ladder> {
  const fixtures = await db
    .select()
    .from(regionalLeagueFixturesTable)
    .where(
      and(
        eq(regionalLeagueFixturesTable.seasonId, seasonId),
        eq(regionalLeagueFixturesTable.status, "completed"),
      ),
    );

  if (fixtures.length === 0) return [];

  const fixtureIds = fixtures.map((f) => f.id);
  const allResults = await db
    .select()
    .from(regionalLeagueResultsTable)
    .where(
      fixtureIds.length === 1
        ? eq(regionalLeagueResultsTable.fixtureId, fixtureIds[0]!)
        : eq(regionalLeagueResultsTable.fixtureId, fixtureIds[0]!),
    );

  // Build results map fixtureId → result
  const resultMap = new Map(allResults.map((r) => [r.fixtureId, r]));

  // Collect all participant keys
  type ParticipantKey = string; // "pool:${id}" | "user"
  const entriesMap = new Map<ParticipantKey, LadderEntry>();

  function key(poolTeamId: number | null, isUser: boolean): ParticipantKey {
    return isUser ? "user" : `pool:${poolTeamId}`;
  }

  function getOrCreate(
    poolTeamId: number | null,
    isUser: boolean,
  ): LadderEntry {
    const k = key(poolTeamId, isUser);
    if (!entriesMap.has(k)) {
      entriesMap.set(k, {
        poolTeamId,
        isUser,
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
    return entriesMap.get(k)!;
  }

  for (const fixture of fixtures) {
    const result = resultMap.get(fixture.id);
    if (!result) continue;

    const home = getOrCreate(fixture.homePoolTeamId, fixture.homeIsUser);
    const away = getOrCreate(fixture.awayPoolTeamId, fixture.awayIsUser);

    const homeWon = result.homeSetWins > result.awaySetWins;

    home.played++;
    away.played++;
    home.setWins += result.homeSetWins;
    home.setLosses += result.awaySetWins;
    away.setWins += result.awaySetWins;
    away.setLosses += result.homeSetWins;
    home.matchPointsFor += result.homeMatchPoints;
    home.matchPointsAgainst += result.awayMatchPoints;
    away.matchPointsFor += result.awayMatchPoints;
    away.matchPointsAgainst += result.homeMatchPoints;

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

  // Recalculate diffs
  for (const e of entriesMap.values()) {
    e.setDiff = e.setWins - e.setLosses;
    e.matchPointDiff = e.matchPointsFor - e.matchPointsAgainst;
  }

  const ladder = Array.from(entriesMap.values());

  // Build head-to-head lookup
  function h2hPoints(
    teamA: LadderEntry,
    teamB: LadderEntry,
  ): number {
    let pts = 0;
    for (const fixture of fixtures) {
      const result = resultMap.get(fixture.id);
      if (!result) continue;
      const homeKey = key(fixture.homePoolTeamId, fixture.homeIsUser);
      const awayKey = key(fixture.awayPoolTeamId, fixture.awayIsUser);
      const aKey = key(teamA.poolTeamId, teamA.isUser);
      const bKey = key(teamB.poolTeamId, teamB.isUser);
      if (homeKey === aKey && awayKey === bKey) {
        const homeWon = result.homeSetWins > result.awaySetWins;
        pts += homeWon ? 3 : 0;
      } else if (homeKey === bKey && awayKey === aKey) {
        const homeWon = result.homeSetWins > result.awaySetWins;
        pts += homeWon ? 0 : 3;
      }
    }
    return pts;
  }

  ladder.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.setDiff !== a.setDiff) return b.setDiff - a.setDiff;
    if (b.matchPointDiff !== a.matchPointDiff)
      return b.matchPointDiff - a.matchPointDiff;
    // Head-to-head
    const h2h = h2hPoints(b, a) - h2hPoints(a, b);
    if (h2h !== 0) return h2h;
    // Stable: user first among equals (index 0), then seededIndex (fetched separately)
    return 0;
  });

  return ladder;
}

// ── Season resolution ─────────────────────────────────────────────────────────

/**
 * Resolve a completed regional season:
 *  - Positions 1–3 → qualified for World Tour
 *  - Position 6    → relegated (bench team promoted into active slot)
 *
 * Returns the qualification records inserted.
 * Does NOT mutate pool team tiers in this call; tier mutation is
 * deferred to when the next season is initialised.
 */
export async function resolveRegionalSeason(seasonId: number): Promise<void> {
  const ladder = await computeLadder(seasonId);
  if (ladder.length === 0) return;

  const records: Array<{
    seasonId: number;
    position: number;
    poolTeamId: number | null;
    isUser: boolean;
    type: string;
  }> = [];

  ladder.forEach((entry, idx) => {
    const position = idx + 1;
    if (position <= 3) {
      records.push({
        seasonId,
        position,
        poolTeamId: entry.poolTeamId,
        isUser: entry.isUser,
        type: "qualified",
      });
    }
    if (position === 6) {
      records.push({
        seasonId,
        position,
        poolTeamId: entry.poolTeamId,
        isUser: entry.isUser,
        type: "relegated",
      });
    }
  });

  if (records.length > 0) {
    await db.insert(worldTourQualificationsTable).values(records);
  }

  // Mark season completed
  await db
    .update(regionalLeagueSeasonsTable)
    .set({ status: "completed" })
    .where(eq(regionalLeagueSeasonsTable.id, seasonId));

  // If the 6th-place team is an AI pool team, swap it to bench and promote a bench team
  const sixthEntry = ladder[5];
  if (sixthEntry && !sixthEntry.isUser && sixthEntry.poolTeamId != null) {
    const relegatedId = sixthEntry.poolTeamId;

    // Get continent for this season
    const [season] = await db
      .select()
      .from(regionalLeagueSeasonsTable)
      .where(eq(regionalLeagueSeasonsTable.id, seasonId));
    if (!season) return;

    // Demote relegated team to bench
    await db
      .update(continentalPoolTeamsTable)
      .set({ tier: "bench" })
      .where(eq(continentalPoolTeamsTable.id, relegatedId));

    // Find a bench team to promote (lowest seededIndex bench team)
    const benchTeams = await db
      .select()
      .from(continentalPoolTeamsTable)
      .where(
        and(
          eq(continentalPoolTeamsTable.continent, season.continent),
          eq(continentalPoolTeamsTable.tier, "bench"),
        ),
      );

    // Sort bench teams, pick lowest seededIndex (excluding the just-relegated one)
    const candidates = benchTeams
      .filter((t) => t.id !== relegatedId)
      .sort((a, b) => a.seededIndex - b.seededIndex);

    if (candidates[0]) {
      await db
        .update(continentalPoolTeamsTable)
        .set({ tier: "active" })
        .where(eq(continentalPoolTeamsTable.id, candidates[0].id));
    }
  }
}
