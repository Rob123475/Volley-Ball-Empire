import { Router } from "express";
import {
  db, matchesTable, locationsTable, playersTable, teamsTable, matchLiveStateTable, careerSavesTable,
  worldTourFixturesTable, competitorsTable, continentalPoolTeamsTable, continentalPoolPlayersTable,
} from "@workspace/db";
import { eq, desc, inArray, or, and, isNull, notInArray, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { loadPlayers, type PlayerDTO } from "../lib/playerDto.js";
import { selectPair } from "../utils/condition.js";

const router = Router();

type PoolOpponent = {
  team: typeof continentalPoolTeamsTable.$inferSelect;
  pair: Array<typeof continentalPoolPlayersTable.$inferSelect>;
};

/**
 * R-73: the AI pool club a match is played against, from its World Tour
 * fixture — the competitor that is not the career's own club. Null when the
 * match has no fixture (nothing to identify an opponent by) or the other side is
 * not a pool club.
 */
function poolOpponentFor(careerSaveId: number, matchId: number, teamId: number | null): PoolOpponent | null {
  const fixture = db.select().from(worldTourFixturesTable)
    .where(and(eq(worldTourFixturesTable.careerSaveId, careerSaveId), eq(worldTourFixturesTable.matchId, matchId)))
    .limit(1).get();
  if (!fixture || fixture.awayCompetitorId == null) return null;
  const sides = db.select().from(competitorsTable)
    .where(inArray(competitorsTable.id, [fixture.homeCompetitorId, fixture.awayCompetitorId])).all();
  const other = sides.find((c) => c.poolTeamId != null && c.teamId !== teamId);
  if (other?.poolTeamId == null) return null;
  const team = db.select().from(continentalPoolTeamsTable)
    .where(eq(continentalPoolTeamsTable.id, other.poolTeamId)).get();
  if (!team) return null;
  const pair = db.select().from(continentalPoolPlayersTable)
    .where(eq(continentalPoolPlayersTable.poolTeamId, team.id))
    .orderBy(continentalPoolPlayersTable.id).all();
  return { team, pair: pair.slice(0, 2) };
}

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
 * GET /unity/match-state?careerSaveId=5&matchId=123
 *
 * Read-only endpoint for Unity integration.
 * If matchId is given, returns that specific match (plus its live tick
 * state, if the point-tick engine has one running/finished for it).
 * If matchId is omitted: the career's current in-progress match, or its most
 * recently completed one.
 *
 * ── Which career (R-38) ────────────────────────────────────────────────────
 * `?careerSaveId=N` wins; otherwise the session's active career; otherwise 400.
 *
 * This endpoint is documented as needing no auth because Unity connects as an
 * external service — but it then read `req.activeCareerSaveId`, which only
 * exists on a browser session. So every session-less caller got
 * "No active career ... needs req.activeCareerSaveId" as a 500. That is not
 * only curl: a WebGL build in an iframe has no app session, and Unity Editor
 * Play mode has no cookie at all, so the loader this endpoint exists to feed
 * could never have called it successfully.
 *
 * It deliberately does NOT fall back to "the first career in the table".
 * Guessing an owner is how R-20 showed one career another career's state; a
 * 400 that names the problem is strictly better than a plausible wrong answer.
 */
router.get("/unity/match-state", async (req, res): Promise<void> => {
  const matchIdParam = req.query.matchId != null ? parseInt(String(req.query.matchId)) : NaN;

  // ── Resolve the career before anything else reads career-scoped state ──────
  const careerIdParam =
    req.query.careerSaveId != null ? parseInt(String(req.query.careerSaveId)) : NaN;

  let careerSaveId: number;
  let careerSource: string;

  if (!isNaN(careerIdParam) && careerIdParam > 0) {
    careerSaveId = careerIdParam;
    careerSource = "query";
  } else if (req.activeCareerSaveId != null) {
    careerSaveId = req.activeCareerSaveId;
    careerSource = "session";
  } else {
    res.status(400).json({
      error: "No career specified",
      detail:
        "This endpoint is career-scoped. Pass ?careerSaveId=<id>, or call it " +
        "with a session that has an active career. It will not guess a career.",
    });
    return;
  }

  // An id that does not exist is a 404, not a silent fallback.
  const [career] = await db
    .select({ id: careerSavesTable.id, teamId: careerSavesTable.teamId })
    .from(careerSavesTable)
    .where(eq(careerSavesTable.id, careerSaveId))
    .limit(1);

  if (!career) {
    res.status(404).json({
      error: "Career not found",
      detail: `No career_save with id ${careerSaveId}.`,
    });
    return;
  }

  req.log?.info(
    { careerSaveId, careerSource, teamId: career.teamId },
    "unity/match-state career resolved",
  );

  let match: typeof matchesTable.$inferSelect | null = null;

  if (!isNaN(matchIdParam)) {
    // Scoped to the career's own team: an explicit matchId from one career must
    // not be able to read another career's match.
    const [row] = await db
      .select()
      .from(matchesTable)
      .where(
        career.teamId != null
          ? and(eq(matchesTable.id, matchIdParam), eq(matchesTable.homeTeamId, career.teamId))
          : eq(matchesTable.id, matchIdParam),
      )
      .limit(1);
    match = row ?? null;
  } else if (career.teamId != null) {
    // Prefer an in-progress match, then the most recent completed/scheduled one -
    // all restricted to this career's team. Before R-38 this query had no team
    // filter at all, so with two careers in one database it returned whichever
    // match was newest regardless of who owned it.
    const statusPriority = ["in_progress", "completed", "scheduled"];
    for (const status of statusPriority) {
      const [row] = await db
        .select()
        .from(matchesTable)
        .where(and(eq(matchesTable.status, status), eq(matchesTable.homeTeamId, career.teamId)))
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

  type PlayerRow = PlayerDTO;
  let homePlayers: PlayerRow[] = [];
  let awayPlayers: PlayerRow[] = [];
  let poolOpponent: PoolOpponent | null = null;

  if (lineupIds.length >= 4) {
    // Path A — explicit lineup (first 2 = home, last 2 = away)
    const homeIds = lineupIds.slice(0, 2);
    const awayIds = lineupIds.slice(2, 4);
    [homePlayers, awayPlayers] = await Promise.all([
      loadPlayers(careerSaveId, { includeRetired: true })
        .then((all) => all.filter((p) => homeIds.includes(p.id))),
      loadPlayers(careerSaveId, { includeRetired: true })
        .then((all) => all.filter((p) => awayIds.includes(p.id))),
    ]);
  } else {
    // Path B — derive from team IDs

    // Home: the pair that takes the court (R-50) — the same selection /simulate
    // and the live tick engine use, so an injured player is never sent to Unity.
    // This took the top two active seniors, injured or not.
    if (match.homeTeamId) {
      homePlayers = selectPair(await loadPlayers(careerSaveId, { teamId: match.homeTeamId }));
    }

    // R-73: the club this match is actually against. A World Tour or World Finals
    // match links to its fixture, and the other competitor is an AI pool club, so
    // its own pair takes the court in its own kit. This used to fall straight
    // through to the free-agent fill below: two unsigned players with no club and
    // no kit, which Unity painted in its red fallback.
    poolOpponent = poolOpponentFor(careerSaveId, match.id, career.teamId);

    // Away: top 2 active seniors on the away team, if it is a distinct DB team
    const awayIsDistinct = match.awayTeamId != null && match.awayTeamId !== match.homeTeamId;
    if (!poolOpponent && awayIsDistinct) {
      awayPlayers = selectPair(await loadPlayers(careerSaveId, { teamId: match.awayTeamId! }));
    }

    // Fallback, only when the match names no opponent at all: fill the away
    // slots from the unsigned senior pool, excluding anyone already selected for
    // home. These players have no club, so no kit — the warning below says so.
    if (!poolOpponent && awayPlayers.length < 2) {
      const needed    = 2 - awayPlayers.length;
      const excludeIds = [
        ...homePlayers.map((p) => p.id),
        ...awayPlayers.map((p) => p.id),
      ];
      // Free agents in THIS career, filling the away side.
      //
      // R-22: this used to also filter isActive: true, which a free agent
      // can never be — is_active is only ever set true when a player is
      // signed to a roster (seedStartingSquad.ts; confirmed on the live
      // save: 0 of 265 free agents have it, all 3 signed players do). That
      // made this query return zero rows unconditionally, every time, for
      // every career — which for World Tour matches (every awayTeamId
      // equals the home team's own id; there is no real opposing team row
      // to query in the first place — see R-29) meant the away side of the
      // /unity/match-state payload was always completely empty. Unity was
      // never shown a match with two clubs' colours because it was never
      // sent two players at all.
      const freeAgents = await loadPlayers(careerSaveId, {
        freeAgents: true, playerType: "senior",
      });
      const fillPlayers = freeAgents
        .filter((p) => !excludeIds.includes(p.id))
        .sort((x, y) => computeOverall(y) - computeOverall(x))
        .slice(0, needed);

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
      source:        "player" as const,
    };
  }

  const homeLabel = match.homeTeamName ?? null;
  const awayLabel = match.awayTeamName ?? poolOpponent?.team.teamName ?? null;

  // R-73: a pool club's player. Pool clubs keep no per-player morale or
  // condition, so the club row's own form, fitness and fatigue are sent. No
  // height is recorded for a pool player; Unity reads 0 as "not given".
  function serializePoolPlayer(pp: PoolOpponent["pair"][number], team: PoolOpponent["team"], teamLabel: string | null) {
    const ratings = { speed: pp.speed, power: pp.power, defense: pp.defense, serve: pp.serve, block: pp.block, stamina: pp.stamina };
    return {
      id:             pp.id,
      name:           pp.name,
      team:           teamLabel,
      position:       null,
      ...ratings,
      overall:        computeOverall(ratings),
      morale:         team.form,
      fatigue:        team.fatigue,
      fitness:        team.fitness,
      injured:        false,
      injuryStatus:   "Healthy",
      age:            pp.baseAge,
      height:         0,
      primaryColor:   team.primaryColor ?? null,
      secondaryColor: team.secondaryColor ?? null,
      // R-75: her own band, drawn from her nation's distribution.
      skinTone:       pp.skinTone ?? null,
      source:         "pool" as const,
    };
  }

  const players = [
    ...homePlayers.map((p) => serializeMatchPlayer(p, homeLabel)),
    ...(poolOpponent
      ? poolOpponent.pair.map((pp) => serializePoolPlayer(pp, poolOpponent!.team, awayLabel))
      : awayPlayers.map((p) => serializeMatchPlayer(p, awayLabel))),
  ];

  // The kit fallback is for a genuinely missing kit only, and it is never silent.
  const bareKits = players.filter((p) => !p.primaryColor || !p.secondaryColor);
  if (bareKits.length > 0) {
    req.log.warn(
      { matchId: match.id, careerSaveId, players: bareKits.map((p) => `${p.name} (${p.team ?? "no club"})`) },
      "unity/match-state: kit colours missing, Unity will paint its fallback kit",
    );
  }

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
