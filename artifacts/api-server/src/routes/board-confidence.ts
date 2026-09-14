import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { getActiveSeasonForCareer } from "../lib/getActiveSeason.js";
import { requireCareerSaveId } from "../lib/playerDto.js";
import { getGameDate } from "../utils/gameDate.js";
import { boardStatus } from "../utils/board-confidence.js";

const router = Router();

/**
 * GET /board-confidence — the board's expectation for this season and its
 * current verdict, in plain words, with the numbers behind them.
 *
 * R-53 (docs/r53-design.md): the board no longer sacks on a read. It judges the
 * season at its review (utils/seasonRollover.ts) and sacks mid-season only for
 * abandonment (routes/matches.ts recordForfeit). This used to end the career on
 * any read that found the old meter at zero.
 */
router.get("/board-confidence", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No active career" }); return; }
  const careerSaveId = requireCareerSaveId(req.activeCareerSaveId);
  const season = await getActiveSeasonForCareer(careerSaveId);
  if (!season) { res.status(404).json({ error: "No active season" }); return; }

  res.json(boardStatus(careerSaveId, season.year, team.id, await getGameDate(team.id)));
});

export default router;
