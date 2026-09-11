import { Router } from "express";
import { db } from "@workspace/db";
import { seasonsTable, matchesTable, teamsTable, seasonFinalStandingsTable, careerHistoryEntriesTable, competitorRankingsTable, competitorsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { getActiveSeason } from "../lib/getActiveSeason.js";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { requireCareerSaveId } from "../lib/playerDto.js";
import { currentRanking, TIER_RANKING_POINTS } from "../utils/rankingPoints.js";
import { loadPlayers } from "../lib/playerDto.js";
import { seasonNumberForYear, FINAL_SEASON } from "../utils/seasonRollover.js";
import { worldTourStandings, worldFinalsSummary } from "../utils/worldTour.js";

const router = Router();

router.get("/seasons", async (req, res) => {
  const seasons = await db.select().from(seasonsTable).orderBy(desc(seasonsTable.year));
  res.json(seasons);
});

router.post("/seasons", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { year, name, totalRounds, startDate, endDate } = req.body;
  const [season] = await db.insert(seasonsTable).values({
    year: Number(year), name, totalRounds: Number(totalRounds),
    startDate, endDate, status: "active", currentRound: 1,
  }).returning();
  res.status(201).json(season);
});

/**
 * This career's ranking for the active season.
 *
 * Exists so ranking points are OBSERVABLE before anything gates on them.
 * competitor_rankings sat empty and unread since Phase 0; a value nothing can
 * see is indistinguishable from a value that is not being written, which is
 * how it stayed empty for so long.
 */
router.get("/seasons/ranking", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const season = await getActiveSeason(req);
  if (!season) { res.status(404).json({ error: "No active season" }); return; }

  const ranking = await currentRanking(
    requireCareerSaveId(req.activeCareerSaveId), team.id, season.year,
  );
  res.json({
    seasonYear: season.year,
    ...ranking,
    // Named so the UI does not have to know the weights.
    pointsByTier: TIER_RANKING_POINTS,
  });
});

/**
 * Everything that happened in a completed season.
 *
 * Phase 8 row 6. The rollover has returned `seasonRollover` and `careerComplete`
 * since Phase 1.1 and the client ignored both, so five season boundaries passed
 * with nothing to show for them. This is the data behind the screen that fixes
 * that, and every field is something already recorded at the boundary rather
 * than computed fresh — the review reports what happened, it does not decide it.
 */
router.get("/seasons/:year/review", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const year = Number(req.params.year);
  if (!Number.isFinite(year)) { res.status(400).json({ error: "Bad year" }); return; }

  const [season] = await db.select().from(seasonsTable).where(and(
    eq(seasonsTable.careerSaveId, cid),
    eq(seasonsTable.year, year),
  )).limit(1);
  if (!season) { res.status(404).json({ error: `No season ${year} in this career` }); return; }

  const standings = await db.select().from(seasonFinalStandingsTable)
    .where(and(
      eq(seasonFinalStandingsTable.teamId, team.id),
      eq(seasonFinalStandingsTable.seasonYear, year),
    ))
    .orderBy(seasonFinalStandingsTable.rank);

  const ranking = await currentRanking(cid, team.id, year);

  // Who left and who came up, from career state rather than a recomputation.
  const retired = await loadPlayers(cid, { includeRetired: true });
  const retiredThisSeason = retired
    .filter((p) => p.isRetired && p.retiredSeasonYear === year)
    .map((p) => ({ id: p.id, name: p.name, age: p.age }));

  const [history] = await db.select().from(careerHistoryEntriesTable).where(and(
    eq(careerHistoryEntriesTable.careerSaveId, cid),
    eq(careerHistoryEntriesTable.season, `Season ${seasonNumberForYear(year)}`),
  )).limit(1);

  // R-29: how much of the season's fixture was the club's to play. A finals
  // match it did not qualify for is not an unplayed match; it was never its.
  const seasonMatches = await db.select({ status: matchesTable.status }).from(matchesTable)
    .where(and(eq(matchesTable.homeTeamId, team.id), eq(matchesTable.season, year)));
  const fixture = {
    total:        seasonMatches.length,
    completed:    seasonMatches.filter((m) => m.status === "completed").length,
    notQualified: seasonMatches.filter((m) => m.status === "not_qualified").length,
  };

  res.json({
    seasonYear:   year,
    seasonNumber: seasonNumberForYear(year),
    name:         season.name,
    status:       season.status,
    record:       { wins: team.wins, losses: team.losses },
    balance:      Number(team.budget),
    ranking,
    playerRank:   standings.find((r) => r.isPlayer)?.rank ?? null,
    standings:    standings.slice(0, 10),
    retired:      retiredThisSeason,
    summary:      history?.description ?? null,
    isFinalSeason: seasonNumberForYear(year) >= FINAL_SEASON,
    fixture,
    worldFinals:  worldFinalsSummary(cid, year, team.id),
  });
});

router.get("/seasons/current", async (req, res) => {
  const season = await getActiveSeason(req);
  if (!season) {
    const latest = await db.query.seasonsTable.findFirst();
    res.json(latest || { id: 1, year: 2026, name: "2026 World Series", status: "active", totalRounds: 10, currentRound: 1, startDate: "2026-01-01", endDate: "2026-12-31" });
    return;
  }
  res.json(season);
});

/**
 * R-20: this used to `db.select().from(teamsTable)` with no filter at all —
 * `:id` was parsed and never used. Every team in the database, across every
 * profile and every retired career, showed up on every career's ladder. A
 * brand-new career with zero matches played showed a RETIRED career's team
 * on its ladder because that was the only other row in the table.
 *
 * The ladder is now built from competitor_rankings, which is already
 * correctly scoped per (career_save_id, season_year) — R-03/R-04's work.
 * The :id is verified to belong to the requesting career before it's used,
 * rather than trusted as-is: a bare numeric id in the URL is exactly the
 * kind of thing that must be checked against the session, not assumed.
 */
router.get("/seasons/:id/ladder", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const seasonId = parseInt(req.params.id);
  if (!Number.isFinite(seasonId)) { res.status(400).json({ error: "Bad season id" }); return; }
  const cid = requireCareerSaveId(req.activeCareerSaveId);

  const [season] = await db.select().from(seasonsTable).where(and(
    eq(seasonsTable.id, seasonId),
    eq(seasonsTable.careerSaveId, cid),
  )).limit(1);
  if (!season) { res.status(404).json({ error: "Season not found in this career" }); return; }

  // R-29: one standings function for every reader (utils/worldTour.ts). This
  // used to INNER JOIN teams, so an AI club could never appear on it, and its
  // "goals" were `wins * 2 + teamId % 10` — deterministic, but not data.
  // goalsFor/goalsAgainst now carry real sets won and lost from
  // world_tour_fixtures; the names stay so the API shape does not move.
  const ladder = worldTourStandings(cid, season.year).map((s) => ({
    rank:         s.rank,
    competitorId: s.competitorId,
    teamId:       s.teamId,
    teamName:     s.name,
    isPlayer:     s.isPlayer,
    wins:         s.wins,
    losses:       s.losses,
    points:       s.points,
    goalsFor:     s.setsFor,
    goalsAgainst: s.setsAgainst,
    form:         s.form,
  }));
  res.json(ladder);
});

export default router;
