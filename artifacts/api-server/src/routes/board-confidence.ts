import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { buildBoardConfidenceResult } from "../utils/board-confidence.js";

const router = Router();

// GET /board-confidence — current board confidence score and status
router.get("/board-confidence", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No active career" }); return; }
  res.json(buildBoardConfidenceResult(team));
});

export default router;
