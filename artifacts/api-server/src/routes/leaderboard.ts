import { Router } from "express";
import { db } from "@workspace/db";
import { teamsTable, careerSavesTable, competitorRankingsTable, competitorsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { getActiveSeasonForCareer } from "../lib/getActiveSeason.js";
import { requireCareerSaveId } from "../lib/playerDto.js";

const router = Router();

/**
 * R-06: this used to `db.select().from(teamsTable)` with no filter at all —
 * every team in the database, across every profile and every retired
 * career, ranked together with no results gate. A fresh save's only team
 * (0-0) still "won" the top slot because nothing else was there — the
 * "Champion" crown on a career that had never played.
 *
 * Rebuilt on the same source and the same (career_save_id, season_year)
 * scope R-20 already uses for the season ladder: competitor_rankings.
 * "Leaderboard for each career contains only its own competitors" — a
 * fresh career's leaderboard is genuinely empty until it has a ranking
 * row (first match played, or R-26's zero-row seed at creation), and the
 * frontend's own `top3.length > 0` / `rankings.map(...)` guards already
 * render nothing for an empty array; this just stops it from ever being
 * fed cross-career data to render in the first place.
 */
router.get("/leaderboard", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const cid = requireCareerSaveId(req.activeCareerSaveId);

  const activeSeason = await getActiveSeasonForCareer(cid);
  if (!activeSeason) { res.json([]); return; }

  const rows = await db.select({
    teamId:       teamsTable.id,
    teamName:     teamsTable.name,
    userId:       careerSavesTable.userId,
    managerName:  careerSavesTable.managerName,
    wins:         competitorRankingsTable.wins,
    losses:       competitorRankingsTable.losses,
    reputation:   teamsTable.reputation,
    budget:       teamsTable.budget,
  })
    .from(competitorRankingsTable)
    .innerJoin(competitorsTable, eq(competitorsTable.id, competitorRankingsTable.competitorId))
    .innerJoin(teamsTable, eq(teamsTable.id, competitorsTable.teamId))
    .innerJoin(careerSavesTable, eq(careerSavesTable.id, competitorRankingsTable.careerSaveId))
    .where(and(
      eq(competitorRankingsTable.careerSaveId, cid),
      eq(competitorRankingsTable.seasonYear, activeSeason.year),
    ))
    .orderBy(desc(competitorRankingsTable.rankingPoints));

  const entries = rows.map((r, idx) => ({
    rank:       idx + 1,
    teamId:     r.teamId,
    teamName:   r.teamName,
    userId:     r.userId,
    username:   r.managerName || "Unknown",
    wins:       r.wins,
    losses:     r.losses,
    earnings:   Number(r.budget),
    reputation: r.reputation,
  }));
  res.json(entries);
});

export default router;
