import { Router } from "express";
import { awayKit } from "../utils/kits.js";
import {
  db, matchesTable, locationsTable, playersTable, teamsTable, matchLiveStateTable, careerSavesTable,
  worldTourFixturesTable, competitorsTable, continentalPoolTeamsTable, continentalPoolPlayersTable,
} from "@workspace/db";
import { eq, desc, inArray, or, and, isNull, notInArray, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { loadPlayers, type PlayerDTO } from "../lib/playerDto.js";
import { isInjured, selectPair } from "../utils/condition.js";
import { overallRating } from "../utils/overallRating.js";
import { matchPointChance, completeMatch, type MatchContext } from "./matches.js";
import { isLegalResult, isLegalProgress, type SetScore } from "../utils/matchEngine.js";

import { aiPairTx, type AiMember } from "../utils/aiSquads.js";
import { careerPlayerStateTable, nationsCupFixturesTable, olympicMatchesTable, nationalKit, type OlympicPlayerEntry, type NationsCupFixture } from "@workspace/db";
import { withCareerStateTx, type CareerStateTx } from "../lib/playerDto.js";
import { careerGameDateTx } from "../utils/gameDate.js";
import { coachedNationTx } from "../utils/nationalCoach.js";
import {
  nationsCupFixtureTx, fixturePairsTx, fixturePointChanceTx, decideNationsCupFixtureTx, advanceNationsCupTx,
} from "../utils/olympics.js";
const router = Router();

type PoolOpponent = {
  team: typeof continentalPoolTeamsTable.$inferSelect;
  /** U-6: the two the AI club plays in this career (utils/aiSquads.ts). */
  pair: AiMember[];
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
  const pair = db.transaction((tx) => aiPairTx(tx, careerSaveId, team.id));
  return { team, pair };
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

  // 1.1.3 (A4b): an Empire Nations Cup match (?nationsMatchId=), its nations' pairs in national colours.
  if (req.query.nationsMatchId != null) {
    const state = nationsMatchState(careerSaveId, Number(req.query.nationsMatchId));
    if ("error" in state) { res.status(state.status).json({ error: state.error }); return; }
    req.log.info({ nationsMatchId: state.nationsMatchId, players: state.players.length }, "unity/match-state served (Nations Cup)");
    res.json(state);
    return;
  }

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
    // Item 14: an injured player is never sent to the court, lineup or not.
    if (match.homeTeamId && homePlayers.some((p) => isInjured(p))) {
      homePlayers = selectPair(await loadPlayers(careerSaveId, { teamId: match.homeTeamId }), homeIds);
    }
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
      // signed to a roster (POST /contracts; confirmed on the live
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
        .sort((x, y) => overallRating(y) - overallRating(x))
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

  // Pictures brief 10 Oct: an AI club player Rob bought (or took over with an
  // AI club) is a career player with no player_v4 of her own; her skin tone is
  // her pool player's, the band of her picture (utils/aiSkinTones.ts).
  const poolIds = [...new Set(allRows.map((p) => p.poolPlayerId).filter((id): id is number => id != null))];
  const poolToneMap = new Map(poolIds.length > 0
    ? (await db.select({ id: continentalPoolPlayersTable.id, skinTone: continentalPoolPlayersTable.skinTone })
        .from(continentalPoolPlayersTable).where(inArray(continentalPoolPlayersTable.id, poolIds))).map((r) => [r.id, r.skinTone])
    : []);

  // Serialise a player row, tagging it with its match-side team label
  function serializeMatchPlayer(p: PlayerRow, teamLabel: string | null) {
    const teamRow      = p.teamId != null ? teamColorMap.get(p.teamId) : undefined;
    const primaryColor   = teamRow?.logoColor          ?? null;
    const secondaryColor = teamRow?.secondaryLogoColor ?? null;
    const skinTone       = (p.playerV4 as any)?.visual_identity?.skin_tone
      ?? (p.poolPlayerId != null ? poolToneMap.get(p.poolPlayerId) : null) ?? null;

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
      overall:       overallRating(p),
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
      // U-6: a career senior made from a pool player keeps her pool id here;
      // a free agent the club signed has none (poolPlayerId null).
      id:             pp.poolPlayerId ?? pp.id,
      poolPlayerId:   pp.poolPlayerId,
      name:           pp.name,
      team:           teamLabel,
      position:       null,
      ...ratings,
      overall:        overallRating(ratings),
      morale:         team.form,
      fatigue:        team.fatigue,
      fitness:        team.fitness,
      injured:        false,
      injuryStatus:   "Healthy",
      age:            pp.age,
      height:         0,
      primaryColor:   team.primaryColor ?? null,
      secondaryColor: team.secondaryColor ?? null,
      // R-75: her own band, drawn from her nation's distribution.
      skinTone:       pp.skinTone ?? null,
      source:         "pool" as const,
    };
  }

  const homeSide = homePlayers.map((p) => serializeMatchPlayer(p, homeLabel));
  const awaySide = poolOpponent
    ? poolOpponent.pair.map((pp) => serializePoolPlayer(pp, poolOpponent!.team, awayLabel))
    : awayPlayers.map((p) => serializeMatchPlayer(p, awayLabel));
  // Update 1, overnight part 7 (K-1 A): kits too alike, the away pair wears
  // white (utils/kits.ts, the one rule). Unity paints what it is sent.
  const homePrimary = homeSide.find((p) => p.primaryColor)?.primaryColor ?? null;
  const awayChange = awayKit(homePrimary, { primary: awaySide.find((p) => p.primaryColor)?.primaryColor ?? null, secondary: awaySide.find((p) => p.secondaryColor)?.secondaryColor ?? null });
  const players = [
    ...homeSide,
    ...(awayChange.changed ? awaySide.map((p) => ({ ...p, primaryColor: awayChange.primary, secondaryColor: awayChange.secondary })) : awaySide),
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

  // Unity brief item 1: the per-point chance the court decides every point
  // from, computed by the same function Sim Result plays at. Null for a match
  // that is over, or a club that cannot field a pair (it would be forfeited).
  let pointChanceHome: number | null = null;
  if (match.status !== "completed" && match.homeTeamId != null && match.homeTeamId === career.teamId) {
    const team = await db.query.teamsTable.findFirst({ where: eq(teamsTable.id, match.homeTeamId) });
    if (team) {
      const chance = await matchPointChance(careerSaveId, team, match);
      if (chance.pair.length >= 2) pointChanceHome = chance.pointChanceHome;
    }
  }

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
    pointChanceHome,
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
    /** Overnight part 7: the away pair is in its change kit (the clubs' kits were too alike). */
    awayKitChanged: awayChange.changed,
  });
});

// ── Unity brief item 4: the 3D court's result counts ────────────────────────
//
// The Unity build posts these from inside its iframe, which carries no app
// session (see /unity/match-state), so a request names its career and match
// and is accepted only for a match of that career that is being watched
// (status "in_progress", set by POST /matches/:id/watch).

type CourtBody = { careerSaveId?: unknown; matchId?: unknown; sets?: unknown; current?: unknown };

function toSets(v: unknown): SetScore[] | null {
  if (!Array.isArray(v)) return null;
  const out: SetScore[] = [];
  for (const s of v) {
    const home = Number((s as { home?: unknown })?.home), away = Number((s as { away?: unknown })?.away);
    if (!Number.isInteger(home) || !Number.isInteger(away)) return null;
    out.push({ home, away });
  }
  return out;
}

/** The career and the watched match a court request is about, or why not. */
async function courtMatch(body: CourtBody) {
  const careerSaveId = Number(body.careerSaveId), matchId = Number(body.matchId);
  if (!Number.isInteger(careerSaveId) || !Number.isInteger(matchId)) return { status: 400, error: "careerSaveId and matchId are required" } as const;
  const save = await db.query.careerSavesTable.findFirst({ where: eq(careerSavesTable.id, careerSaveId) });
  if (!save || save.teamId == null) return { status: 404, error: "Career not found" } as const;
  const match = await db.query.matchesTable.findFirst({ where: eq(matchesTable.id, matchId) });
  if (!match || match.homeTeamId !== save.teamId) return { status: 404, error: "That match is not this career's" } as const;
  return { save, match } as const;
}

/**
 * POST /unity/match-progress  { careerSaveId, matchId, sets: [{home,away}...finished], current: {home,away} }
 * After every point: the score so far, kept so a match left early is finished from it.
 */
router.post("/unity/match-progress", async (req, res): Promise<void> => {
  if (req.body?.nationsMatchId != null) { const r = nationsMatchProgress(req.body); res.status(r.status).json(r.body); return; }
  const found = await courtMatch(req.body ?? {});
  if ("error" in found) { res.status(found.status ?? 400).json({ error: found.error }); return; }
  const { match } = found;
  if (match.status !== "in_progress") { res.status(409).json({ error: "This match is not being watched." }); return; }
  const sets = toSets(req.body?.sets);
  const cur = req.body?.current as { home?: unknown; away?: unknown } | undefined;
  const current = { home: Number(cur?.home), away: Number(cur?.away) };
  if (!sets || !isLegalProgress(sets, current)) { res.status(400).json({ error: "Not a legal score part-way through a best-of-3-to-11 match." }); return; }
  const homeSets = sets.filter((s) => s.home > s.away).length;
  await db.update(matchesTable).set({ sets }).where(eq(matchesTable.id, match.id));
  await db.insert(matchLiveStateTable).values({
    matchId: match.id, currentSet: sets.length + 1, homeSetScore: current.home, awaySetScore: current.away,
    setsWonHome: homeSets, setsWonAway: sets.length - homeSets, rallyState: "playing", matchTimeSeconds: 0,
  }).onConflictDoUpdate({
    target: matchLiveStateTable.matchId,
    set: { currentSet: sets.length + 1, homeSetScore: current.home, awaySetScore: current.away,
      setsWonHome: homeSets, setsWonAway: sets.length - homeSets, rallyState: "playing", updatedAt: new Date() },
  });
  res.json({ ok: true });
});

/**
 * POST /unity/match-result  { careerSaveId, matchId, sets: [{home,away}, ...] }
 * The match is over on the court: record exactly that result through
 * completeMatch, the path Sim Result uses (result, sets, prize, ranking points,
 * fitness and injuries, board, news, achievements). Sent twice, the second
 * changes nothing.
 */
router.post("/unity/match-result", async (req, res): Promise<void> => {
  if (req.body?.nationsMatchId != null) { const r = nationsMatchResult(req.body); res.status(r.status).json(r.body); return; }
  const found = await courtMatch(req.body ?? {});
  if ("error" in found) { res.status(found.status ?? 400).json({ error: found.error }); return; }
  const { save, match } = found;
  const sets = toSets(req.body?.sets);
  if (!sets || !isLegalResult(sets)) { res.status(400).json({ error: "Not a legal best-of-3-to-11 result (win by 2)." }); return; }
  const homeScore = sets.filter((s) => s.home > s.away).length;
  const awayScore = sets.length - homeScore;

  if (match.status === "completed") {
    const same = match.homeScore === homeScore && match.awayScore === awayScore
      && JSON.stringify(match.sets ?? []) === JSON.stringify(sets);
    res.status(same ? 200 : 409).json(same
      ? { ok: true, alreadyRecorded: true }
      : { error: "This match already has a different result." });
    return;
  }
  if (match.status !== "in_progress") { res.status(409).json({ error: "This match is not being watched." }); return; }

  const team = await db.query.teamsTable.findFirst({ where: eq(teamsTable.id, match.homeTeamId!) });
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }
  const ctx: MatchContext = { careerSaveId: save.id, team, userId: save.userId ?? null, log: req.log ?? logger };
  const result = await completeMatch(ctx, match, { homeScore, awayScore, sets });
  await db.delete(matchLiveStateTable).where(eq(matchLiveStateTable.matchId, match.id));
  if (!result) { res.json({ ok: true, alreadyRecorded: true }); return; }
  res.json({ ok: true, ...result });
});

// ── 1.1.3 (Rob, 23 Oct; brief A4b): an Empire Nations Cup match on the 3D court ──
//
// The two sides are the nations' pairs (the Cup's field, utils/olympics.ts), each
// player in her nation's colours (lib/db schema/national-kits.ts; the away pair
// changes to white when the two are too alike, the one kit rule, utils/kits.ts).
// The court shows the Nations Cup courtside boards ("EMPIRE NATIONS CUP {year}")
// in place of the club boards: `courtsideBoards` and `boardText` are the switch,
// and `kitSource` says the kits are national. A match is watched only on its day:
// fetching it then makes it live; its progress and result come back here as a
// club match's do. Watched matches play in Auto; `manualAllowed` only for the
// nation the player coaches.

type NationsBody = { careerSaveId?: unknown; nationsMatchId?: unknown; sets?: unknown; current?: unknown };

/** His nation is the fixture's away side: the court plays it as its home pair. */
function courtSidesSwapped(f: NationsCupFixture, coached: string | null): boolean {
  return coached != null && f.awayNation === coached && f.homeNation !== coached;
}

/** Scores between the fixture's sides and the court's (the same turn both ways). */
function courtSides(sets: SetScore[], swap: boolean): SetScore[] {
  return swap ? sets.map((s) => ({ home: s.away, away: s.home })) : sets;
}

function nationsMatchState(careerSaveId: number, id: number) {
  return withCareerStateTx((w) => {
    const tx = w.tx;
    const f = Number.isInteger(id) ? nationsCupFixtureTx(tx, careerSaveId, id) : null;
    if (!f) return { status: 404, error: "No such Nations Cup match in this career" } as const;
    const today = careerGameDateTx(tx, careerSaveId);
    const coached = coachedNationTx(tx, careerSaveId);
    const watchable = f.status !== "decided" && f.scheduledOn === today;
    if (watchable && f.status === "scheduled") tx.update(nationsCupFixturesTable).set({ status: "live" }).where(eq(nationsCupFixturesTable.id, f.id)).run();
    const pairs = fixturePairsTx(tx, f);
    const serialise = (entry: OlympicPlayerEntry, nation: string, kit: { primary: string | null; secondary: string | null }) => {
      const stats = entry.kind === "player"
        ? tx.select({
            speed: careerPlayerStateTable.speed, power: careerPlayerStateTable.power, defense: careerPlayerStateTable.defense,
            serve: careerPlayerStateTable.serve, block: careerPlayerStateTable.block, stamina: careerPlayerStateTable.stamina,
            morale: careerPlayerStateTable.morale, fatigue: careerPlayerStateTable.fatigue, fitness: careerPlayerStateTable.fitness, age: careerPlayerStateTable.age,
            v4: playersTable.playerV4, height: playersTable.height, position: playersTable.position, poolPlayerId: careerPlayerStateTable.poolPlayerId,
          }).from(careerPlayerStateTable).innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
            .where(and(eq(careerPlayerStateTable.careerSaveId, careerSaveId), eq(careerPlayerStateTable.playerId, entry.id))).get()
        : undefined;
      const poolId = entry.kind === "pool" ? entry.id : stats?.poolPlayerId ?? null;
      const pool = poolId != null ? tx.select().from(continentalPoolPlayersTable).where(eq(continentalPoolPlayersTable.id, poolId)).get() : undefined;
      const r = stats ?? pool ?? { speed: 60, power: 60, defense: 60, serve: 60, block: 60, stamina: 60 };
      const ratings = { speed: r.speed, power: r.power, defense: r.defense, serve: r.serve, block: r.block, stamina: r.stamina };
      return {
        id: entry.id, name: entry.name, team: nation, position: stats?.position ?? null, ...ratings, overall: overallRating(ratings),
        morale: stats?.morale ?? 80, fatigue: stats?.fatigue ?? 0, fitness: stats?.fitness ?? 100, injured: false, injuryStatus: "Healthy",
        age: stats?.age ?? pool?.baseAge ?? 0, height: stats?.height ?? 0,
        primaryColor: kit.primary, secondaryColor: kit.secondary,
        skinTone: (stats?.v4 as { visual_identity?: { skin_tone?: string } } | null)?.visual_identity?.skin_tone ?? pool?.skinTone ?? null,
        club: entry.club, source: entry.kind,
      };
    };
    // The court's Manual control plays its home pair (Team A): when his nation is the fixture's away
    // side, the court is sent it as home, and the scores it posts are turned back (courtSides).
    const swap = courtSidesSwapped(f, coached);
    const [homeNation, awayNation] = swap ? [f.awayNation, f.homeNation] : [f.homeNation, f.awayNation];
    const [homePair, awayPair] = swap ? [pairs.away, pairs.home] : [pairs.home, pairs.away];
    const homeKit = nationalKit(homeNation), awayOwn = nationalKit(awayNation);
    const away = awayKit(homeKit?.primary ?? null, { primary: awayOwn?.primary ?? null, secondary: awayOwn?.secondary ?? null });
    const players = [
      ...(homePair?.pair ?? []).map((p) => serialise(p, homeNation, { primary: homeKit?.primary ?? null, secondary: homeKit?.secondary ?? null })),
      ...(awayPair?.pair ?? []).map((p) => serialise(p, awayNation, { primary: away.primary, secondary: away.secondary })),
    ];
    const progress = f.progress ? courtSides(f.progress.sets, swap) : [];
    const label = f.stage === "group" ? `Group ${f.groupName}` : f.stage === "quarter_final" ? "Quarter-final" : f.stage === "semi_final" ? "Semi-final" : f.stage === "bronze" ? "Bronze medal match" : "Gold medal match";
    const chance = fixturePointChanceTx(tx, f);
    return {
      status: 200,
      matchId: 0,
      nationsMatchId: f.id,
      event: "nations_cup",
      venue: `Empire Nations Cup ${f.seasonYear} · ${label}`,
      homeTeam: homeNation,
      awayTeam: awayNation,
      sidesSwapped: swap,
      homeScore: progress.filter((s) => s.home > s.away).length,
      awayScore: progress.filter((s) => s.away > s.home).length,
      weather: null, windSpeed: null, crowdSize: 9000 + (f.id % 7) * 500, commentaryLine: "",
      pointChanceHome: watchable ? (swap ? 1 - chance : chance) : null,
      players,
      awayKitChanged: away.changed,
      kitSource: "national" as const,
      courtsideBoards: "nations_cup" as const,
      boardText: `EMPIRE NATIONS CUP ${f.seasonYear}`,
      manualAllowed: coached != null && (f.homeNation === coached || f.awayNation === coached),
      watchable,
      fixtureStatus: watchable ? "live" : f.status,
    };
  });
}

/** The career's Cup fixture a court request is about, or why not. */
function nationsCourtFixture(w: CareerStateTx, body: NationsBody): { status: number; error: string } | { careerSaveId: number; f: NationsCupFixture } {
  const careerSaveId = Number(body.careerSaveId), id = Number(body.nationsMatchId);
  if (!Number.isInteger(careerSaveId) || !Number.isInteger(id)) return { status: 400, error: "careerSaveId and nationsMatchId are required" };
  const f = nationsCupFixtureTx(w.tx, careerSaveId, id);
  if (!f) return { status: 404, error: "That Nations Cup match is not this career's" };
  return { careerSaveId, f };
}

function nationsMatchProgress(body: NationsBody): { status: number; body: unknown } {
  return withCareerStateTx((w) => {
    const found = nationsCourtFixture(w, body);
    if ("error" in found) return { status: found.status, body: { error: found.error } };
    if (found.f.status !== "live") return { status: 409, body: { error: "This Nations Cup match is not being watched." } };
    const swap = courtSidesSwapped(found.f, coachedNationTx(w.tx, found.careerSaveId));
    const courtSets = toSets(body.sets);
    const cur = body.current as { home?: unknown; away?: unknown } | undefined;
    const courtCurrent = { home: Number(cur?.home), away: Number(cur?.away) };
    if (!courtSets || !isLegalProgress(courtSets, courtCurrent)) return { status: 400, body: { error: "Not a legal score part-way through a best-of-3-to-11 match." } };
    const sets = courtSides(courtSets, swap);
    const current = swap ? { home: courtCurrent.away, away: courtCurrent.home } : courtCurrent;
    w.tx.update(nationsCupFixturesTable).set({ progress: { sets, current } }).where(eq(nationsCupFixturesTable.id, found.f.id)).run();
    return { status: 200, body: { ok: true } };
  });
}

function nationsMatchResult(body: NationsBody): { status: number; body: unknown } {
  return withCareerStateTx((w) => {
    const found = nationsCourtFixture(w, body);
    if ("error" in found) return { status: found.status, body: { error: found.error } };
    const { careerSaveId, f } = found;
    const courtSets = toSets(body.sets);
    if (!courtSets || !isLegalResult(courtSets)) return { status: 400, body: { error: "Not a legal best-of-3-to-11 result (win by 2)." } };
    const sets = courtSides(courtSets, courtSidesSwapped(f, coachedNationTx(w.tx, careerSaveId)));
    const homeSets = sets.filter((s) => s.home > s.away).length;
    if (f.status === "decided") {
      const m = f.matchId != null ? w.tx.select().from(olympicMatchesTable).where(eq(olympicMatchesTable.id, f.matchId)).get() : undefined;
      const same = m && m.homeSets === homeSets && JSON.stringify(m.sets) === JSON.stringify(sets);
      return same ? { status: 200, body: { ok: true, alreadyRecorded: true } } : { status: 409, body: { error: "This Nations Cup match already has a different result." } };
    }
    if (f.status !== "live") return { status: 409, body: { error: "This Nations Cup match is not being watched." } };
    decideNationsCupFixtureTx(w.tx, f, { homeSets, awaySets: sets.length - homeSets, sets }, "court");
    const teamId = w.tx.select({ t: careerSavesTable.teamId }).from(careerSavesTable).where(eq(careerSavesTable.id, careerSaveId)).get()?.t ?? null;
    const { finished } = advanceNationsCupTx(w, careerSaveId, f.seasonYear, teamId, careerGameDateTx(w.tx, careerSaveId));
    return { status: 200, body: { ok: true, winner: homeSets > sets.length - homeSets ? f.homeNation : f.awayNation, cupFinished: finished } };
  });
}

export default router;
