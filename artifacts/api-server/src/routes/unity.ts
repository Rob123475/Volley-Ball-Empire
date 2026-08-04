import { Router } from "express";
import { db, matchesTable, locationsTable, playersTable, teamsTable } from "@workspace/db";
import { eq, desc, inArray, or } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const router = Router();

// Compute overall rating from the six core stats (mirrors game-api.ts)
function computeOverall(p: {
  speed: number; power: number; defense: number;
  serve: number; block: number; stamina: number;
}): number {
  return Math.round((p.speed + p.power + p.defense + p.serve + p.block + p.stamina) / 6);
}

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

  // Fetch players — use lineup IDs if present, otherwise both team rosters
  const lineupIds = match.lineup ?? [];
  let rawPlayers: (typeof playersTable.$inferSelect)[] = [];

  if (lineupIds.length > 0) {
    rawPlayers = await db
      .select()
      .from(playersTable)
      .where(inArray(playersTable.id, lineupIds));
  } else if (match.homeTeamId || match.awayTeamId) {
    const teamConditions = [
      match.homeTeamId ? eq(playersTable.teamId, match.homeTeamId) : null,
      match.awayTeamId ? eq(playersTable.teamId, match.awayTeamId) : null,
    ].filter(Boolean) as Parameters<typeof or>;
    rawPlayers = await db
      .select()
      .from(playersTable)
      .where(or(...teamConditions));
  }

  // Fetch team colors for all players that have a teamId
  const teamIds = [...new Set(rawPlayers.map((p) => p.teamId).filter((id): id is number => id != null))];
  const teamRows = teamIds.length > 0
    ? await db.select().from(teamsTable).where(inArray(teamsTable.id, teamIds))
    : [];
  const teamColorMap = new Map(teamRows.map((t) => [t.id, t]));

  const players = rawPlayers.map((p) => {
    // Determine which team label this player belongs to
    let team: string | null = null;
    if (p.teamId === match!.homeTeamId)      team = match!.homeTeamName ?? null;
    else if (p.teamId === match!.awayTeamId) team = match!.awayTeamName ?? null;

    // Resolve team kit colours from the teams table
    const teamRow = p.teamId != null ? teamColorMap.get(p.teamId) : undefined;
    const primaryColor   = teamRow?.logoColor          ?? null;
    const secondaryColor = teamRow?.secondaryLogoColor ?? null;

    // Resolve skinTone from player_v4 JSONB visual_identity block
    const skinTone = (p.playerV4 as any)?.visual_identity?.skin_tone ?? null;

    return {
      id:            p.id,
      name:          p.name,
      team,
      position:      p.position,
      speed:         p.speed,
      power:         p.power,
      defense:       p.defense,
      serve:         p.serve,
      block:         p.block,
      stamina:       p.stamina,
      overall:       computeOverall(p),
      morale:        p.morale,
      fatigue:       p.fatigue,
      fitness:       p.fitness,
      injured:       p.isInjured,
      injuryStatus:  p.injuryStatus,
      age:           p.age,
      height:        p.height != null ? parseFloat(p.height) : null,
      primaryColor,
      secondaryColor,
      skinTone,
    };
  });

  req.log.info({ matchId: match.id, status: match.status, playerCount: players.length }, "unity/match-state served");

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
    // Rally / live match state — not persisted in DB
    currentServer:        null,
    ballOwner:            null,
    rallyState:           "unknown",
    lastAction:           "",
    lastActionPlayer:     null,
    lastActionTeam:       null,
    lastOutcome:          "",
    pointWinner:          null,
    setA:                 0,
    setB:                 0,
    matchTime:            0,
    players,
  });
});

export default router;
