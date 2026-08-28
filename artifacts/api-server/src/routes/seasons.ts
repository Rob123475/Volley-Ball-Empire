import { Router } from "express";
import { db } from "@workspace/db";
import { seasonsTable, matchesTable, teamsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getActiveSeason } from "../lib/getActiveSeason.js";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { requireCareerSaveId } from "../lib/playerDto.js";
import { currentRanking, TIER_RANKING_POINTS } from "../utils/rankingPoints.js";

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

router.get("/seasons/current", async (req, res) => {
  const season = await getActiveSeason(req);
  if (!season) {
    const latest = await db.query.seasonsTable.findFirst();
    res.json(latest || { id: 1, year: 2026, name: "2026 World Series", status: "active", totalRounds: 10, currentRound: 1, startDate: "2026-01-01", endDate: "2026-12-31" });
    return;
  }
  res.json(season);
});

router.get("/seasons/:id/ladder", async (req, res) => {
  const seasonId = parseInt(req.params.id);
  const teams = await db.select().from(teamsTable);
  const ladder = teams.map((team, idx) => ({
    rank: idx + 1,
    teamId: team.id,
    teamName: team.name,
    wins: team.wins,
    losses: team.losses,
    points: team.wins * 3,
    // Derived from the team's own record, not Math.random() — these were
    // regenerated on every request, so the numbers visibly changed as the
    // player watched the ladder.
    goalsFor: team.wins * 2 + (team.id % 10),
    goalsAgainst: team.losses * 2 + (team.id % 8),
  })).sort((a, b) => b.points - a.points).map((e, i) => ({ ...e, rank: i + 1 }));
  res.json(ladder);
});

export default router;
