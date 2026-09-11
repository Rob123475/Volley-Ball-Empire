/**
 * R-29 — the World Tour as the whole field sees it, for the active career.
 *
 *   GET /world-tour/fixtures?round=N  every fixture in a round, and who rested
 *   GET /world-tour/finals            seeds, semi finals, final and champion
 *
 * The fixtures screen used to list only the player's own matches under a
 * hardcoded "18 qualified teams" header, and the World Finals screen drew a
 * bracket from a one-row ladder with the final permanently "TBD". Both now read
 * world_tour_fixtures, which utils/worldTour.ts fills.
 */
import { Router } from "express";
import {
  db,
  worldTourFixturesTable,
  competitorsTable,
  teamsTable,
  continentalPoolTeamsTable,
  matchesTable,
} from "@workspace/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { getActiveSeason } from "../lib/getActiveSeason.js";
import { requireCareerSaveId } from "../lib/playerDto.js";
import { worldTourStandings, SEMI_FINAL_TIER, NOT_QUALIFIED } from "../utils/worldTour.js";
import { WORLD_TOUR_START, WORLD_TOUR_END, FINALS_START, FINALS_END } from "../utils/calendarSlots.js";

const router = Router();

type Fixture = typeof worldTourFixturesTable.$inferSelect;
type Names = Map<number, { name: string; isPlayer: boolean }>;

function competitorNames(ids: number[]): Names {
  if (ids.length === 0) return new Map();
  const rows = db.select({
    id:       competitorsTable.id,
    teamId:   competitorsTable.teamId,
    teamName: teamsTable.name,
    poolName: continentalPoolTeamsTable.teamName,
  })
    .from(competitorsTable)
    .leftJoin(teamsTable, eq(teamsTable.id, competitorsTable.teamId))
    .leftJoin(continentalPoolTeamsTable, eq(continentalPoolTeamsTable.id, competitorsTable.poolTeamId))
    .where(inArray(competitorsTable.id, ids))
    .all();
  return new Map(rows.map((r) => [r.id, { name: r.teamName ?? r.poolName ?? "Unknown", isPlayer: r.teamId != null }]));
}

function serializeFixture(f: Fixture, names: Names) {
  const side = (competitorId: number, seed: number | null) => ({
    competitorId,
    name:     names.get(competitorId)?.name ?? "Unknown",
    isPlayer: names.get(competitorId)?.isPlayer ?? false,
    seed,
  });
  const decided = f.status === "completed";
  return {
    id:       f.id,
    round:    f.round,
    tier:     f.tier,
    status:   f.status,
    matchId:  f.matchId,
    home:     side(f.homeCompetitorId, f.homeSeed),
    away:     side(f.awayCompetitorId, f.awaySeed),
    homeSets: f.homeSets,
    awaySets: f.awaySets,
    sets:     f.sets ?? null,
    winnerCompetitorId: decided
      ? ((f.homeSets ?? 0) > (f.awaySets ?? 0) ? f.homeCompetitorId : f.awayCompetitorId)
      : null,
  };
}

function fixturesInRound(careerSaveId: number, seasonYear: number, round: number): Fixture[] {
  return db.select().from(worldTourFixturesTable).where(and(
    eq(worldTourFixturesTable.careerSaveId, careerSaveId),
    eq(worldTourFixturesTable.seasonYear, seasonYear),
    eq(worldTourFixturesTable.round, round),
  )).orderBy(asc(worldTourFixturesTable.id)).all();
}

function namesFor(fixtures: Fixture[]): Names {
  return competitorNames([...new Set(fixtures.flatMap((f) => [f.homeCompetitorId, f.awayCompetitorId]))]);
}

router.get("/world-tour/fixtures", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const season = await getActiveSeason(req);
  if (!season) { res.status(404).json({ error: "No active season" }); return; }
  const cid = requireCareerSaveId(req.activeCareerSaveId);

  const round = Number(req.query.round);
  if (!Number.isInteger(round) || round < WORLD_TOUR_START || round > FINALS_END) {
    res.status(400).json({ error: `round must be a World Tour or finals round, ${WORLD_TOUR_START}-${FINALS_END}` });
    return;
  }

  const drawn = !!db.select({ id: worldTourFixturesTable.id }).from(worldTourFixturesTable).where(and(
    eq(worldTourFixturesTable.careerSaveId, cid),
    eq(worldTourFixturesTable.seasonYear, season.year),
  )).limit(1).get();

  const fixtures = fixturesInRound(cid, season.year, round);
  const standings = drawn ? worldTourStandings(cid, season.year) : [];
  const playing = new Set(fixtures.flatMap((f) => [f.homeCompetitorId, f.awayCompetitorId]));

  // Only a regular round has a rest: the finals are four and two clubs by design.
  const resting = round <= WORLD_TOUR_END && fixtures.length > 0
    ? standings.filter((s) => !playing.has(s.competitorId)).map((s) => ({ competitorId: s.competitorId, name: s.name }))
    : [];

  res.json({
    seasonYear: season.year,
    round,
    drawn,
    fieldSize:  drawn ? standings.length : null,
    fixtures:   fixtures.map((f) => serializeFixture(f, namesFor(fixtures))),
    resting,
  });
});

router.get("/world-tour/finals", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const season = await getActiveSeason(req);
  if (!season) { res.status(404).json({ error: "No active season" }); return; }
  const cid = requireCareerSaveId(req.activeCareerSaveId);

  const semis = fixturesInRound(cid, season.year, FINALS_START);
  const finals = fixturesInRound(cid, season.year, FINALS_END);
  const names = namesFor([...semis, ...finals]);

  const playerSemi = db.select({ status: matchesTable.status }).from(matchesTable).where(and(
    eq(matchesTable.homeTeamId, team.id),
    eq(matchesTable.season, season.year),
    eq(matchesTable.tier, SEMI_FINAL_TIER),
  )).limit(1).get();

  const playerQualified = semis.length === 0
    ? null
    : playerSemi?.status === NOT_QUALIFIED ? false : semis.some((s) => s.matchId != null);

  const final = finals[0] ? serializeFixture(finals[0], names) : null;
  const champion = final?.winnerCompetitorId != null
    ? (final.home.competitorId === final.winnerCompetitorId ? final.home : final.away)
    : null;

  res.json({
    seasonYear: season.year,
    seeded:     semis.length > 0,
    playerQualified,
    semis:      semis.map((s) => serializeFixture(s, names)),
    final,
    champion,
  });
});

export default router;
