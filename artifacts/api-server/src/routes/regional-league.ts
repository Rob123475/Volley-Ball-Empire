import { Router } from "express";
import { db } from "@workspace/db";
import {
  continentalPoolTeamsTable,
  continentalPoolPlayersTable,
  regionalLeagueSeasonsTable,
  regionalLeagueFixturesTable,
  regionalLeagueResultsTable,
  worldTourQualificationsTable,
} from "@workspace/db";
import { eq, and, inArray, desc } from "drizzle-orm";
import {
  computeLadderForSeason,
  resolveRegionalSeason,
  simulateFixtureResult,
} from "../utils/regionalSeason.js";

const router = Router();

export const CONTINENTS = [
  "Europe",
  "Asia",
  "North America",
  "South America",
  "Africa and Middle East",
  "Australia and Pacific Islands",
] as const;

export type Continent = (typeof CONTINENTS)[number];

// ── Helper: get the current active season for a continent ─────────────────────
async function getActiveSeason(continent: string) {
  const [season] = await db
    .select()
    .from(regionalLeagueSeasonsTable)
    .where(
      and(
        eq(regionalLeagueSeasonsTable.continent, continent),
        eq(regionalLeagueSeasonsTable.status, "active"),
      ),
    )
    .orderBy(desc(regionalLeagueSeasonsTable.seasonYear))
    .limit(1);
  return season ?? null;
}

// ── GET /regional-league/:continent ──────────────────────────────────────────
// Returns current season, full fixture list with results, and computed ladder
router.get("/regional-league/:continent", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const continent = decodeURIComponent(req.params.continent);
  if (!CONTINENTS.includes(continent as Continent)) {
    res.status(400).json({ error: "Unknown continent", valid: CONTINENTS });
    return;
  }

  const season = await getActiveSeason(continent);
  if (!season) {
    res.status(404).json({ error: "No active season for this continent" });
    return;
  }

  const fixtures = await db
    .select()
    .from(regionalLeagueFixturesTable)
    .where(eq(regionalLeagueFixturesTable.regionalLeagueSeasonId, season.id))
    .orderBy(regionalLeagueFixturesTable.round);

  const completedIds = fixtures.filter(f => f.status === "completed").map(f => f.id);
  const results = completedIds.length > 0
    ? await db
        .select()
        .from(regionalLeagueResultsTable)
        .where(inArray(regionalLeagueResultsTable.fixtureId, completedIds))
    : [];
  const resultMap = new Map(results.map(r => [r.fixtureId, r]));

  const ladder = await computeLadderForSeason(season.id);

  // Enrich ladder with team names
  const poolIds = ladder.map(e => e.poolTeamId);
  const poolTeams = poolIds.length > 0
    ? await db
        .select({ id: continentalPoolTeamsTable.id, teamName: continentalPoolTeamsTable.teamName })
        .from(continentalPoolTeamsTable)
        .where(inArray(continentalPoolTeamsTable.id, poolIds))
    : [];
  const nameMap = new Map(poolTeams.map(t => [t.id, t.teamName]));

  // Enrich fixtures with team names
  const allTeamIds = Array.from(new Set([
    ...fixtures.map(f => f.homePoolTeamId),
    ...fixtures.map(f => f.awayPoolTeamId),
  ]));
  const allTeams = allTeamIds.length > 0
    ? await db
        .select({ id: continentalPoolTeamsTable.id, teamName: continentalPoolTeamsTable.teamName })
        .from(continentalPoolTeamsTable)
        .where(inArray(continentalPoolTeamsTable.id, allTeamIds))
    : [];
  const allTeamNameMap = new Map(allTeams.map(t => [t.id, t.teamName]));

  res.json({
    season: {
      id:         season.id,
      seasonYear: season.seasonYear,
      continent:  season.continent,
      teamIds:    season.teamIds,
      status:     season.status,
    },
    fixtures: fixtures.map(f => ({
      ...f,
      homeTeamName: allTeamNameMap.get(f.homePoolTeamId) ?? "Unknown",
      awayTeamName: allTeamNameMap.get(f.awayPoolTeamId) ?? "Unknown",
      result: resultMap.get(f.id) ?? null,
    })),
    ladder: ladder.map((entry, idx) => ({
      position:        idx + 1,
      poolTeamId:      entry.poolTeamId,
      teamName:        nameMap.get(entry.poolTeamId) ?? "Unknown",
      played:          entry.played,
      wins:            entry.wins,
      losses:          entry.losses,
      points:          entry.points,
      setDiff:         entry.setDiff,
      matchPointDiff:  entry.matchPointDiff,
    })),
  });
});

// ── GET /regional-league/qualifications ───────────────────────────────────────
// All world_tour_qualifications for the most recent completed season year,
// grouped by continent (18 teams total when all 6 continents completed)
router.get("/regional-league/qualifications", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Find the most recent season year that has any qualification rows
  const latestRows = await db
    .select()
    .from(worldTourQualificationsTable)
    .orderBy(desc(worldTourQualificationsTable.seasonYear))
    .limit(1);

  if (latestRows.length === 0) {
    res.json({ seasonYear: null, qualifications: [] });
    return;
  }

  const latestYear = latestRows[0]!.seasonYear;

  const qualifications = await db
    .select()
    .from(worldTourQualificationsTable)
    .where(eq(worldTourQualificationsTable.seasonYear, latestYear))
    .orderBy(
      worldTourQualificationsTable.continent,
      worldTourQualificationsTable.qualifyingPosition,
    );

  // Enrich with team names
  const teamIds = qualifications.map(q => q.poolTeamId);
  const teams = teamIds.length > 0
    ? await db
        .select({ id: continentalPoolTeamsTable.id, teamName: continentalPoolTeamsTable.teamName })
        .from(continentalPoolTeamsTable)
        .where(inArray(continentalPoolTeamsTable.id, teamIds))
    : [];
  const nameMap = new Map(teams.map(t => [t.id, t.teamName]));

  res.json({
    seasonYear: latestYear,
    qualifications: qualifications.map(q => ({
      id:                q.id,
      seasonYear:        q.seasonYear,
      continent:         q.continent,
      poolTeamId:        q.poolTeamId,
      teamName:          nameMap.get(q.poolTeamId) ?? "Unknown",
      qualifyingPosition:q.qualifyingPosition,
    })),
  });
});

// ── POST /regional-league/:continent/simulate-all ────────────────────────────
// Dev/test only — auto-resolves all outstanding fixtures with random scores
// then runs resolveRegionalSeason. Guard: NODE_ENV !== "production"
router.post("/regional-league/:continent/simulate-all", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({ error: "Not available in production" });
    return;
  }
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const continent = decodeURIComponent(req.params.continent);
  if (!CONTINENTS.includes(continent as Continent)) {
    res.status(400).json({ error: "Unknown continent", valid: CONTINENTS });
    return;
  }

  const season = await getActiveSeason(continent);
  if (!season) {
    res.status(404).json({ error: "No active season for this continent" });
    return;
  }

  // Get all scheduled fixtures and team ratings
  const fixtures = await db
    .select()
    .from(regionalLeagueFixturesTable)
    .where(
      and(
        eq(regionalLeagueFixturesTable.regionalLeagueSeasonId, season.id),
        eq(regionalLeagueFixturesTable.status, "scheduled"),
      ),
    );

  const teamIds = Array.from(new Set([
    ...fixtures.map(f => f.homePoolTeamId),
    ...fixtures.map(f => f.awayPoolTeamId),
  ]));

  const teams = teamIds.length > 0
    ? await db
        .select({ id: continentalPoolTeamsTable.id, rating: continentalPoolTeamsTable.rating, form: continentalPoolTeamsTable.form })
        .from(continentalPoolTeamsTable)
        .where(inArray(continentalPoolTeamsTable.id, teamIds))
    : [];
  const teamMap = new Map(teams.map(t => [t.id, t]));

  let simulated = 0;
  for (const fixture of fixtures) {
    const home = teamMap.get(fixture.homePoolTeamId);
    const away = teamMap.get(fixture.awayPoolTeamId);
    const homeRating = home ? Math.round(home.rating * 0.7 + home.form * 0.3) : 70;
    const awayRating = away ? Math.round(away.rating * 0.7 + away.form * 0.3) : 70;

    const sim = simulateFixtureResult(homeRating, awayRating);
    const winnerId = sim.winnerId === "home" ? fixture.homePoolTeamId : fixture.awayPoolTeamId;

    await db.insert(regionalLeagueResultsTable).values({
      fixtureId:       fixture.id,
      winnerId,
      homeSets:        sim.homeSets,
      awaySets:        sim.awaySets,
      homeMatchPoints: sim.homeMatchPoints,
      awayMatchPoints: sim.awayMatchPoints,
    });

    await db
      .update(regionalLeagueFixturesTable)
      .set({
        status:    "completed",
        homeScore: sim.homeSets,
        awayScore: sim.awaySets,
      })
      .where(eq(regionalLeagueFixturesTable.id, fixture.id));

    simulated++;
  }

  await resolveRegionalSeason(season.id);

  res.json({
    ok: true,
    continent,
    seasonId:  season.id,
    seasonYear:season.seasonYear,
    simulated,
  });
});

export default router;
