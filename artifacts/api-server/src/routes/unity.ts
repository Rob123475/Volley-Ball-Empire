import { Router } from "express";
import { db, matchesTable, locationsTable } from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const router = Router();

// Crowd size estimate by match tier
function estimateCrowdSize(tier: string | null | undefined): number {
  switch (tier) {
    case "elite":      return 12000 + Math.floor(Math.random() * 4000);
    case "major":      return 8000  + Math.floor(Math.random() * 3000);
    case "challenger": return 4000  + Math.floor(Math.random() * 2000);
    case "satellite":  return 1500  + Math.floor(Math.random() * 1000);
    default:           return 3000  + Math.floor(Math.random() * 2000);
  }
}

/**
 * GET /unity/match-state
 *
 * Read-only endpoint for Unity integration.
 * Returns the current in-progress match, or the most recent completed match
 * if no match is currently live.
 * No auth required — Unity connects as an external service.
 */
// ── TEMPORARY TEST STUB — revert to live data after test ──────────────────────
router.get("/unity/match-state", async (req, res): Promise<void> => {
  req.log.info("unity/match-state — returning test stub");
  res.json({
    matchId:     999,
    venue:       "Unity Test Arena",
    homeTeam:    "OPENAI SHARKS",
    awayTeam:    "ROB'S LEGENDS",
    homeScore:   12,
    awayScore:   8,
    servingTeam: "OPENAI SHARKS",
    weather:     "sunny",
    windSpeed:   0,
    crowdSize:   9999,
  });
});
// ── END TEMPORARY TEST STUB ───────────────────────────────────────────────────

export default router;
