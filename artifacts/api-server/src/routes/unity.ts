import { Router } from "express";
import { db, matchesTable, locationsTable, playersTable, teamsTable, matchLiveStateTable } from "@workspace/db";
import { eq, desc, inArray, or, and, isNull, notInArray, sql } from "drizzle-orm";
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
 * GET /unity/match-state?matchId=123
 *
 * Read-only endpoint for Unity integration.
 * If matchId is given, returns that specific match (plus its live tick
 * state, if the point-tick engine has one running/finished for it).
 * If matchId is omitted, falls back to the previous behavior: the current
 * in-progress match, or the most recently completed one.
 * No auth required — Unity connects as an external service.
 */
router.get("/unity/match-state", async (req, res): Promise<void> => {
  const matchIdParam = req.query.matchId != null ? parseInt(String(req.query.matchId)) : NaN;

  let match: typeof matchesTable.$inferSelect | null = null;

  if (!isNaN(matchIdParam)) {
    const [row] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchIdParam)).limit(1);
    match = row ?? null;
  } else {
    // Legacy fallback — prefer an in-progress match; fall back to the most recently completed one
    const statusPriority = ["in_progress", "completed", "scheduled"];
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
  }

  if (!match) {
    res.status(404).json({ error: "No match found" });
    return;
  }

  // Live tick state, if the point-tick engine has (or had) one for this match
  const liveState = await db.query.matchLiveStateTable.findFirst({
    where: eq(matchLiveStateTable.matchId, match.id),
  });

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

  // SQL expression for computed overall — used for ordering fallback queries
  const overallExpr = sql`(${playersTable.speed}+${playersTable.power}+${playersTable.defense}+${playersTable.serve}+${playersTable.block}+${playersTable.stamina})`;

  // Fetch exactly 2 home players and 2 away players.
  //
  // Path A — explicit lineup: the match stores 4 player IDs (home1,home2,away1,away2).
  //           Use them directly; team label is resolved by teamId comparison below.
  //
  // Path B — no lineup (most matches): query home and away separately so we always
  //           get 2 per side even when the away team is an AI club with no DB rows.
  const lineupIds = match.lineup ?? [];

  type PlayerRow = typeof playersTable.$inferSelect;
  let homePlayers: PlayerRow[] = [];
  let awayPlayers: PlayerRow[] = [];

  if (lineupIds.length >= 4) {
    // Path A — explicit lineup (first 2 = home, last 2 = away)
    const homeIds = lineupIds.slice(0, 2);
    const awayIds = lineupIds.slice(2, 4);
    [homePlayers, awayPlayers] = await Promise.all([
      db.select().from(playersTable).where(inArray(playersTable.id, homeIds)),
      db.select().from(playersTable).where(inArray(playersTable.id, awayIds)),
    ]);
  } else {
    // Path B — derive from team IDs

    // Home: top 2 active seniors on the home team
    if (match.homeTeamId) {
      homePlayers = await db
        .select()
        .from(playersTable)
        .where(and(
          eq(playersTable.teamId,    match.homeTeamId),
          eq(playersTable.isActive,  true),
          eq(playersTable.playerType, "senior"),
        ))
        .orderBy(desc(overallExpr))
        .limit(2);
    }

    // Away: top 2 active seniors on the away team, if it is a distinct DB team
    const awayIsDistinct = match.awayTeamId != null && match.awayTeamId !== match.homeTeamId;
    if (awayIsDistinct) {
      awayPlayers = await db
        .select()
        .from(playersTable)
        .where(and(
          eq(playersTable.teamId,    match.awayTeamId!),
          eq(playersTable.isActive,  true),
          eq(playersTable.playerType, "senior"),
        ))
        .orderBy(desc(overallExpr))
        .limit(2);
    }

    // Fallback: AI opponent has no DB team — fill remaining slots from the
    // unsigned senior pool, excluding anyone already selected for home.
    if (awayPlayers.length < 2) {
      const needed    = 2 - awayPlayers.length;
      const excludeIds = [
        ...homePlayers.map((p) => p.id),
        ...awayPlayers.map((p) => p.id),
      ];
      const fallbackWhere = excludeIds.length > 0
        ? and(
            isNull(playersTable.teamId),
            eq(playersTable.playerType, "senior"),
            eq(playersTable.isActive,   true),
            notInArray(playersTable.id, excludeIds),
          )
        : and(
            isNull(playersTable.teamId),
            eq(playersTable.playerType, "senior"),
            eq(playersTable.isActive,   true),
          );

      const fillPlayers = await db
        .select()
        .from(playersTable)
        .where(fallbackWhere)
        .orderBy(desc(overallExpr))
        .limit(needed);

      awayPlayers = [...awayPlayers, ...fillPlayers];
    }
  }

  // Fetch team colors for all DB-team players in one round-trip
  const allRows    = [...homePlayers, ...awayPlayers];
  const dbTeamIds  = [...new Set(allRows.map((p) => p.teamId).filter((id): id is number => id != null))];
  const teamRows   = dbTeamIds.length > 0
    ? await db.select().from(teamsTable).where(inArray(teamsTable.id, dbTeamIds))
    : [];
  const teamColorMap = new Map(teamRows.map((t) => [t.id, t]));

  // Serialise a player row, tagging it with its match-side team label
  function serializeMatchPlayer(p: PlayerRow, teamLabel: string | null) {
    const teamRow      = p.teamId != null ? teamColorMap.get(p.teamId) : undefined;
    const primaryColor   = teamRow?.logoColor          ?? null;
    const secondaryColor = teamRow?.secondaryLogoColor ?? null;
    const skinTone       = (p.playerV4 as any)?.visual_identity?.skin_tone ?? null;

    return {
      id:            p.id,
      name:          p.name,
      team:          teamLabel,
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
      height:        p.height,
      primaryColor,
      secondaryColor,
      skinTone,
    };
  }

  const homeLabel = match.homeTeamName ?? null;
  const awayLabel = match.awayTeamName ?? null;

  const players = [
    ...homePlayers.map((p) => serializeMatchPlayer(p, homeLabel)),
    ...awayPlayers.map((p) => serializeMatchPlayer(p, awayLabel)),
  ];

  req.log.info({ matchId: match.id, status: match.status, playerCount: players.length }, "unity/match-state served");

  const highlights = match.highlights ?? [];
  const commentaryLine = highlights.length > 0 ? highlights[highlights.length - 1] : "";

  res.json({
    matchId:              match.id,
    venue:                venueName,
    homeTeam:             match.homeTeamName ?? null,
    awayTeam:             match.awayTeamName ?? null,
    // Sets won — the score that decides the match. Falls back to the raw
    // homeScore/awayScore columns once the match has been finalized.
    homeScore:            liveState?.setsWonHome ?? match.homeScore ?? 0,
    awayScore:            liveState?.setsWonAway ?? match.awayScore ?? 0,
    servingTeam:          liveState?.servingTeam ?? null,
    weather:              match.weather,
    windSpeed:            match.windSpeed,
    crowdSize:            estimateCrowdSize(match.tier),
    commentaryLine:       liveState?.lastAction ?? commentaryLine,
    // Boost mechanic isn't implemented in the API yet — always off for now.
    attackBoostActive:    false,
    defenceBoostActive:   false,
    attackBoostTeam:      null,
    defenceBoostTeam:     null,
    attackBoostRemaining: 0,
    defenceBoostRemaining: 0,
    // Live rally state — real values once a match has been started via
    // POST /matches/:id/watch; unset/defaults for matches that were only
    // ever instant-simulated via the "Sim Result" button.
    currentServer:        liveState?.servingTeam ?? null,
    ballOwner:            liveState?.ballOwnerId ?? null,
    rallyState:           liveState?.rallyState ?? "unknown",
    lastAction:           liveState?.lastAction ?? "",
    lastActionPlayer:     liveState?.lastActionPlayerId ?? null,
    lastActionTeam:       liveState?.lastActionTeam ?? null,
    lastOutcome:          liveState?.lastOutcome ?? "",
    pointWinner:          liveState?.pointWinner ?? null,
    setA:                 liveState?.homeSetScore ?? 0,
    setB:                 liveState?.awaySetScore ?? 0,
    currentSet:           liveState?.currentSet ?? 1,
    matchTime:            liveState?.matchTimeSeconds ?? 0,
    players,
  });
});

export default router;
