import { Router } from "express";
import { db } from "@workspace/db";
import { loadPoolTeams, requireCareerSaveId } from "../lib/playerDto.js";
import {
  loadLeagueSeasons, loadFixtures, loadResultsForFixtures, insertLeagueResult, updateFixture,
} from "../lib/regionalLeague.js";
import {
  CONTINENT_KEYS,
  continentKeyFrom,
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

// The canonical six live in @workspace/db. This module used to keep its own
// copy, which is how "Africa and Middle East" here and "Africa & Middle East"
// in routes/players.ts drifted apart while both looked authoritative.
export { CONTINENT_KEYS, type ContinentKey } from "@workspace/db";

// ── Helper: get the current active season for a continent ─────────────────────
async function getActiveSeason(continent: string, careerSaveId: number) {
  const seasons = await loadLeagueSeasons(careerSaveId, { continent, status: "active" });
  const season = [...seasons].sort((a, b) => b.seasonYear - a.seasonYear)[0];
  return season ?? null;
}

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

// ── GET /regional-league/:continent ──────────────────────────────────────────
// Returns current season, full fixture list with results, and computed ladder
router.get("/regional-league/:continent", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Accept a key or any historical label — everything downstream is the key.
  const continent = continentKeyFrom(decodeURIComponent(req.params.continent));
  if (!continent) {
    res.status(400).json({ error: "Unknown continent", valid: CONTINENT_KEYS });
    return;
  }

  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const season = await getActiveSeason(continent, cid);
  if (!season) {
    res.status(404).json({ error: "No active season for this continent" });
    return;
  }

  const fixtures = (await loadFixtures(cid, { seasonId: season.id }))
    .sort((a, b) => a.round - b.round);

  const completedIds = fixtures.filter(f => f.status === "completed").map(f => f.id);
  const results = await loadResultsForFixtures(cid, completedIds);
  const resultMap = new Map(results.map(r => [r.fixtureId, r]));

  const ladder = await computeLadderForSeason(season.id, cid);

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

  // Accept a key or any historical label — everything downstream is the key.
  const continent = continentKeyFrom(decodeURIComponent(req.params.continent));
  if (!continent) {
    res.status(400).json({ error: "Unknown continent", valid: CONTINENT_KEYS });
    return;
  }

  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const season = await getActiveSeason(continent, cid);
  if (!season) {
    res.status(404).json({ error: "No active season for this continent" });
    return;
  }

  // Get all scheduled fixtures and team ratings
  const fixtures = await loadFixtures(cid, { seasonId: season.id, status: "scheduled" });

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

    await insertLeagueResult(cid, {
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

  await resolveRegionalSeason(season.id, requireCareerSaveId(req.activeCareerSaveId));

  res.json({
    ok: true,
    continent,
    seasonId:  season.id,
    seasonYear:season.seasonYear,
    simulated,
  });
});

// ── GET /regional-league/:continent/pools ────────────────────────────────────
// Returns all continental pool teams with their players for a continent.
// isActiveInLeague=true → currently in the regional league
// isActiveInLeague=false → in the pool (promotion candidates)
router.get("/regional-league/:continent/pools", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Accept a key or any historical label — everything downstream is the key.
  const continent = continentKeyFrom(decodeURIComponent(req.params.continent));
  if (!continent) {
    res.status(400).json({ error: "Unknown continent", valid: CONTINENT_KEYS });
    return;
  }

  // Career-scoped: promotion/relegation state differs per save, so a shared
  // read would show one career's league table in another's.
  const poolTeams = (await loadPoolTeams(
    requireCareerSaveId(req.activeCareerSaveId), { continent },
  )).sort((a, b) => a.poolRanking - b.poolRanking);

  if (poolTeams.length === 0) {
    res.json({ continent, poolTeams: [] });
    return;
  }

  const teamIds = poolTeams.map(t => t.id);
  const players = await db
    .select()
    .from(continentalPoolPlayersTable)
    .where(inArray(continentalPoolPlayersTable.poolTeamId, teamIds));

  const playersByTeam = new Map<number, typeof players>();
  for (const p of players) {
    if (!playersByTeam.has(p.poolTeamId)) playersByTeam.set(p.poolTeamId, []);
    playersByTeam.get(p.poolTeamId)!.push(p);
  }

  res.json({
    continent,
    poolTeams: poolTeams.map(t => ({
      id:              t.id,
      teamName:        t.teamName,
      stableId:        t.stableId,
      rating:          t.rating,
      form:            t.form,
      fitness:         t.fitness,
      poolRanking:     t.poolRanking,
      promotionCount:  t.promotionCount,
      relegationCount: t.relegationCount,
      isActiveInLeague:t.isActiveInLeague,
      players: (playersByTeam.get(t.id) ?? []).map(p => ({
        id:          p.id,
        name:        p.name,
        nationality: p.nationality,
        age:         p.baseAge,
        speed:       p.speed,
        power:       p.power,
        defense:     p.defense,
        serve:       p.serve,
        block:       p.block,
        stamina:     p.stamina,
        imageUrl:    p.imageUrl,
      })),
    })),
  });
});

export default router;
