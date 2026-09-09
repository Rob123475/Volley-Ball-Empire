import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { buildBoardConfidenceResult, forcedSaleTarget } from "../utils/board-confidence.js";
import { endCareer } from "../utils/careerLifecycle.js";
import { loadPlayers } from "../lib/playerDto.js";

const router = Router();

// GET /board-confidence — current board confidence score, escalation-ladder
// stage, and status.
//
// R-09: this is also where the "sacked" stage takes effect. The escalation
// ladder (warning -> spending blocked -> forced sale pending -> sacked) is
// computed fresh every time the score is read; when it reads as "sacked",
// the career ends right here, in the same request, rather than the client
// having to notice a number hit zero and act on it separately. That is what
// makes it "not a silent stop" — the very read that would show the player a
// 0% meter is the read that ends the career and tells them so.
router.get("/board-confidence", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No active career" }); return; }

  const result = buildBoardConfidenceResult(team);

  let forcedSale: { pending: boolean; player: { id: number; name: string; salary: number } | null } | null = null;
  if (result.stage === "forced_sale_pending" || result.stage === "sacked") {
    const careerSaveId = req.activeCareerSaveId;
    const squad = careerSaveId ? await loadPlayers(careerSaveId, { teamId: team.id }) : [];
    const target = forcedSaleTarget(squad);
    forcedSale = {
      pending: target !== null,
      player: target ? { id: target.id, name: target.name, salary: target.salary } : null,
    };
  }

  let careerEnded = false;
  if (result.stage === "sacked") {
    await endCareer(req, team.id, req.user.id, {
      type: "dismissal",
      description: (s) => `${s.managerName} was sacked by ${s.clubName} after board confidence collapsed to zero.`,
    });
    careerEnded = true;
  }

  res.json({ ...result, forcedSale, careerEnded });
});

export default router;
