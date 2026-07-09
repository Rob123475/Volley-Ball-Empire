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
router.get("/unity/match-state", async (req, res): Promise<void> => {
  // Prefer an in-progress match; fall back to the most recently completed one
  const statusPriority = ["in_progress", "completed", "scheduled"];

  let match: typeof matchesTable.$inferSelect | null = null;

  for (const status of statusPriority) {
    const [row] = await db
      .select()
      .from(matchesTable)
      .where(eq(matchesTable.status, status))
      .orderBy(desc(matchesTable.createdAt))
      .limit(1);

    if (row) {
      match = row;
      break;
    }
  }

  if (!match) {
    res.status(404).json({ error: "No match found" });
    return;
  }

  // Resolve venue name — prefer denormalised column, fall back to location join
  let venueName = match.locationName ?? null;
  if (!venueName && match.locationId) {
    const [location] = await db
      .select()
      .from(locationsTable)
      .where(eq(locationsTable.id, match.locationId))
      .limit(1);
    venueName = location?.name ?? null;
  }

  req.log.info({ matchId: match.id, status: match.status }, "unity/match-state served");

  const highlights = match.highlights ?? [];
  const commentaryLine = highlights.length > 0 ? highlights[highlights.length - 1] : "";

  res.json({
    matchId:              match.id,
    venue:                venueName,
    homeTeam:             match.homeTeamName ?? null,
    awayTeam:             match.awayTeamName ?? null,
    homeScore:            match.homeScore  ?? 0,
    awayScore:            match.awayScore  ?? 0,
    servingTeam:          null,   // live state — not persisted in DB
    weather:              match.weather,
    windSpeed:            match.windSpeed != null ? parseFloat(match.windSpeed) : null,
    crowdSize:            estimateCrowdSize(match.tier),
    commentaryLine,
    // Boost — live state, not persisted in DB
    attackBoostActive:    false,
    defenceBoostActive:   false,
    attackBoostTeam:      null,
    defenceBoostTeam:     null,
    attackBoostRemaining: 0,
    defenceBoostRemaining: 0,
  });
});

export default router;
