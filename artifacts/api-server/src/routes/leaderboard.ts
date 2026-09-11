import { Router } from "express";
import { db } from "@workspace/db";
import { teamsTable, careerSavesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { getActiveSeasonForCareer } from "../lib/getActiveSeason.js";
import { requireCareerSaveId } from "../lib/playerDto.js";
import { worldTourStandings } from "../utils/worldTour.js";

const router = Router();

/**
 * R-06: this used to `db.select().from(teamsTable)` with no filter at all —
 * every team in the database, across every profile and every retired
 * career, ranked together with no results gate. A fresh save's only team
 * (0-0) still "won" the top slot because nothing else was there — the
 * "Champion" crown on a career that had never played.
 *
 * R-29: rebuilt again, on the same standings function as the season ladder,
 * the dashboard rank and the World Finals seeding (utils/worldTour.ts). The
 * R-06 version was career-scoped but INNER JOINed `teams`, so the AI clubs of
 * the World Tour could never appear and the table held exactly one row: the
 * player's. A leaderboard of one is not a leaderboard.
 *
 * AI clubs have no manager, budget or reputation in this game, so those fields
 * are null for them rather than invented.
 */
router.get("/leaderboard", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const cid = requireCareerSaveId(req.activeCareerSaveId);

  const activeSeason = await getActiveSeasonForCareer(cid);
  if (!activeSeason) { res.json([]); return; }

  const [save] = await db.select({ userId: careerSavesTable.userId, managerName: careerSavesTable.managerName })
    .from(careerSavesTable)
    .where(eq(careerSavesTable.id, cid))
    .limit(1);

  const standings = worldTourStandings(cid, activeSeason.year);
  const teamIds = standings.flatMap((s) => (s.teamId != null ? [s.teamId] : []));
  const teams = teamIds.length > 0
    ? await db.select({ id: teamsTable.id, budget: teamsTable.budget, reputation: teamsTable.reputation })
        .from(teamsTable)
        .where(inArray(teamsTable.id, teamIds))
    : [];
  const teamById = new Map(teams.map((t) => [t.id, t]));

  res.json(standings.map((s) => {
    const team = s.teamId != null ? teamById.get(s.teamId) : undefined;
    return {
      rank:         s.rank,
      competitorId: s.competitorId,
      teamId:       s.teamId,
      teamName:     s.name,
      isPlayer:     s.isPlayer,
      userId:       s.isPlayer ? (save?.userId ?? null) : null,
      username:     s.isPlayer ? (save?.managerName || "Unknown") : null,
      wins:         s.wins,
      losses:       s.losses,
      points:       s.points,
      earnings:     team ? Number(team.budget) : null,
      reputation:   team ? team.reputation : null,
    };
  }));
});

export default router;
