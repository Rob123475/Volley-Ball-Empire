/**
 * /api/game/*  —  Unity Game API
 *
 * A clean, Unity-ready integration surface. These endpoints let a Unity
 * client read the current save state, load a match, submit results, and
 * push post-match player updates back into the manager game.
 *
 * All responses are flat, simple JSON — no nested game-engine objects.
 * No gameplay simulation logic lives here; this layer only reads/writes
 * data that the manager game already owns.
 */

import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { db } from "@workspace/db";
import {
  matchesTable,
  playersTable,
  careerSavesTable,
  unityMatchStatsTable,
} from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { loadPlayers, requireCareerSaveId, updatePlayerState, type CareerPlayerFields } from "../lib/playerDto.js";

const router = Router();

// ─── helpers ────────────────────────────────────────────────────────────────

function computeOverall(p: {
  speed: number; power: number; defense: number;
  serve: number; block: number; stamina: number;
}): number {
  return Math.round((p.speed + p.power + p.defense + p.serve + p.block + p.stamina) / 6);
}

function serializePlayer(p: any) {
  return {
    playerId:  p.id,
    name:      p.name,
    nationality: p.nationality ?? null,
    age:       p.age,
    position:  p.position,
    imageUrl:  p.imageUrl ?? null,
    squadRole: p.squadRole,
    ratings: {
      speed:    p.speed,
      power:    p.power,
      defense:  p.defense,
      serve:    p.serve,
      block:    p.block,
      stamina:  p.stamina,
      overall:  computeOverall(p),
    },
    status: {
      morale:                p.morale,
      fatigue:               p.fatigue,
      fitness:               p.fitness,
      isInjured:             p.isInjured,
      injuryStatus:          p.injuryStatus,
      injuryWeeksRemaining:  p.injuryWeeksRemaining,
    },
  };
}

function clubLogo(team: any) {
  return {
    primaryColor:   team.logoColor          ?? "#3B82F6",
    secondaryColor: team.secondaryLogoColor ?? "#1E40AF",
  };
}

function authGuard(req: any, res: any): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

// ─── GET /api/game/session ───────────────────────────────────────────────────
/**
 * Returns the active career save context needed to bootstrap a Unity session.
 *
 * Response shape:
 *   saveSlotId   – career save row id (null if not yet created)
 *   managerId    – authenticated user id
 *   managerName  – manager display name from the career save
 *   season       – season label, e.g. "Season 3"
 *   clubId       – team row id
 *   clubName     – team name
 */
router.get("/game/session", async (req, res) => {
  if (!authGuard(req, res)) return;
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No active team" }); return; }

  const [save] = await db
    .select()
    .from(careerSavesTable)
    .where(eq(careerSavesTable.teamId, team.id));

  res.json({
    saveSlotId:  save?.id          ?? null,
    managerId:   req.user?.id      ?? null,
    managerName: save?.managerName ?? null,
    season:      save?.season      ?? "Season 1",
    clubId:      team.id,
    clubName:    team.name,
  });
});

// ─── GET /api/game/club ──────────────────────────────────────────────────────
/**
 * Full club snapshot: identity, logo colours, finances, and record.
 */
router.get("/game/club", async (req, res) => {
  if (!authGuard(req, res)) return;
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No active team" }); return; }

  res.json({
    clubId:      team.id,
    clubName:    team.name,
    clubLogo:    clubLogo(team),
    budget:      Number(team.budget),
    reputation:  team.reputation,
    wins:        team.wins,
    losses:      team.losses,
    titlesWon:   team.titlesWon,
    winStreak:   team.winStreak,
  });
});

// ─── GET /api/game/squad ─────────────────────────────────────────────────────
/**
 * All active players on the club with their current ratings and status.
 * Safe to call at any time — does not reveal hidden scouting data.
 */
router.get("/game/squad", async (req, res) => {
  if (!authGuard(req, res)) return;
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No active team" }); return; }

  const players = await loadPlayers(requireCareerSaveId(req.activeCareerSaveId), { teamId: team.id, isActive: true });

  res.json({
    clubId:   team.id,
    clubName: team.name,
    total:    players.length,
    players:  players.map(serializePlayer),
  });
});

// ─── GET /api/game/next-match ────────────────────────────────────────────────
/**
 * The next scheduled match for the active team.
 * Returns full fixture metadata so Unity can build the pre-match screen
 * without a separate fetch.
 */
router.get("/game/next-match", async (req, res) => {
  if (!authGuard(req, res)) return;
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No active team" }); return; }

  const [match] = await db
    .select()
    .from(matchesTable)
    .where(and(eq(matchesTable.homeTeamId, team.id), eq(matchesTable.status, "scheduled")))
    .orderBy(asc(matchesTable.round))
    .limit(1);

  if (!match) { res.status(404).json({ error: "No upcoming matches scheduled" }); return; }

  const isHome     = match.homeTeamId === team.id;
  const opponentId = isHome ? match.awayTeamId   : match.homeTeamId;
  const opponentName = isHome
    ? (match.awayTeamName ?? "Opponent")
    : (match.homeTeamName ?? "Opponent");

  res.json({
    matchId:      match.id,
    round:        match.round,
    season:       match.season,
    tier:         match.tier         ?? null,
    continent:    match.continent    ?? null,
    scheduledAt:  match.scheduledAt  ?? null,
    locationName: match.locationName ?? null,
    prizeAmount:  Number(match.prizeAmount ?? 0),
    weather: {
      condition:   match.weather      ?? "sunny",
      windSpeed:   Number(match.windSpeed   ?? 0),
      temperature: Number(match.temperature ?? 25),
    },
    myTeam: {
      clubId:   team.id,
      clubName: team.name,
      clubLogo: clubLogo(team),
      isHome,
    },
    opponent: {
      clubId:   opponentId   ?? null,
      clubName: opponentName,
    },
  });
});

// ─── GET /api/game/match-setup/:matchId ─────────────────────────────────────
/**
 * Full match setup packet for a specific match id.
 * Includes both teams, the named lineup, weather, and venue.
 * Unity should call this once per match session start.
 */
router.get("/game/match-setup/:matchId", async (req, res) => {
  if (!authGuard(req, res)) return;
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No active team" }); return; }

  const matchId = parseInt(req.params.matchId, 10);
  if (isNaN(matchId)) { res.status(400).json({ error: "Invalid matchId" }); return; }

  const [match] = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.id, matchId));

  if (!match) { res.status(404).json({ error: "Match not found" }); return; }
  if (match.homeTeamId !== team.id && match.awayTeamId !== team.id) {
    res.status(403).json({ error: "This match does not belong to your team" }); return;
  }

  const isHome       = match.homeTeamId === team.id;
  const opponentId   = isHome ? match.awayTeamId   : match.homeTeamId;
  const opponentName = isHome
    ? (match.awayTeamName ?? "Opponent")
    : (match.homeTeamName ?? "Opponent");

  const allPlayers = await loadPlayers(requireCareerSaveId(req.activeCareerSaveId), { teamId: team.id, isActive: true });

  const lineup: number[] = Array.isArray(match.lineup) ? (match.lineup as number[]) : [];
  const lineupPlayers = lineup.length > 0
    ? allPlayers.filter(p => lineup.includes(p.id))
    : allPlayers.filter(p => p.squadRole === "starter" || p.squadRole === "interchange");

  const [save] = await db
    .select()
    .from(careerSavesTable)
    .where(eq(careerSavesTable.teamId, team.id));

  res.json({
    matchId:     match.id,
    saveSlotId:  save?.id    ?? null,
    managerId:   req.user?.id ?? null,
    round:       match.round,
    season:      match.season,
    tier:         match.tier         ?? null,
    continent:    match.continent    ?? null,
    scheduledAt:  match.scheduledAt  ?? null,
    locationName: match.locationName ?? null,
    prizeAmount:  Number(match.prizeAmount ?? 0),
    status:       match.status,
    weather: {
      condition:   match.weather      ?? "sunny",
      windSpeed:   Number(match.windSpeed   ?? 0),
      temperature: Number(match.temperature ?? 25),
    },
    myTeam: {
      clubId:   team.id,
      clubName: team.name,
      clubLogo: clubLogo(team),
      isHome,
      lineup:   lineupPlayers.map(serializePlayer),
    },
    opponent: {
      clubId:   opponentId   ?? null,
      clubName: opponentName,
    },
  });
});

// ─── POST /api/game/match-result ─────────────────────────────────────────────
/**
 * Unity submits the final score after a match simulation.
 * Marks the match as completed and stores the scores.
 * Does NOT trigger prize money, morale or fatigue updates — use
 * POST /api/game/post-match for that.
 *
 * Body: { matchId, homeScore, awayScore, winnerId? }
 */
router.post("/game/match-result", async (req, res) => {
  if (!authGuard(req, res)) return;
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No active team" }); return; }

  const { matchId, homeScore, awayScore, winnerId } = req.body;
  if (matchId == null || homeScore == null || awayScore == null) {
    res.status(400).json({ error: "matchId, homeScore and awayScore are required" }); return;
  }

  const [match] = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.id, Number(matchId)));

  if (!match) { res.status(404).json({ error: "Match not found" }); return; }
  if (match.homeTeamId !== team.id && match.awayTeamId !== team.id) {
    res.status(403).json({ error: "This match does not belong to your team" }); return;
  }
  if (match.status === "completed") {
    res.status(400).json({ error: "Match is already marked as completed" }); return;
  }

  await db
    .update(matchesTable)
    .set({ homeScore: Number(homeScore), awayScore: Number(awayScore), status: "completed" })
    .where(eq(matchesTable.id, Number(matchId)));

  res.json({
    ok:        true,
    matchId:   Number(matchId),
    homeScore: Number(homeScore),
    awayScore: Number(awayScore),
    winnerId:  winnerId ?? null,
  });
});

// ─── POST /api/game/player-stats ─────────────────────────────────────────────
/**
 * Unity submits per-player performance stats for a match.
 * Stats are stored in unity_match_stats and do not overwrite any
 * existing gameplay data — they are additive match records.
 *
 * Body: {
 *   matchId: number,
 *   stats: Array<{
 *     playerId, points, errors, aces, kills, blocks, digs,
 *     servesIn, servesTotal, attacksIn, attacksTotal, minutesPlayed
 *   }>
 * }
 */
router.post("/game/player-stats", async (req, res) => {
  if (!authGuard(req, res)) return;
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No active team" }); return; }

  const { matchId, stats } = req.body;
  if (matchId == null || !Array.isArray(stats)) {
    res.status(400).json({ error: "matchId and stats[] are required" }); return;
  }

  const [match] = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.id, Number(matchId)));

  if (!match) { res.status(404).json({ error: "Match not found" }); return; }
  if (match.homeTeamId !== team.id && match.awayTeamId !== team.id) {
    res.status(403).json({ error: "This match does not belong to your team" }); return;
  }

  if (stats.length === 0) { res.json({ ok: true, matchId: Number(matchId), saved: 0 }); return; }

  const rows = stats.map((s: any) => ({
    matchId:       Number(matchId),
    teamId:        team.id,
    playerId:      Number(s.playerId),
    points:        Number(s.points        ?? 0),
    errors:        Number(s.errors        ?? 0),
    aces:          Number(s.aces          ?? 0),
    kills:         Number(s.kills         ?? 0),
    blocks:        Number(s.blocks        ?? 0),
    digs:          Number(s.digs          ?? 0),
    servesIn:      Number(s.servesIn      ?? 0),
    servesTotal:   Number(s.servesTotal   ?? 0),
    attacksIn:     Number(s.attacksIn     ?? 0),
    attacksTotal:  Number(s.attacksTotal  ?? 0),
    minutesPlayed: Number(s.minutesPlayed ?? 0),
  }));

  await db.insert(unityMatchStatsTable).values(rows);

  res.json({ ok: true, matchId: Number(matchId), saved: rows.length });
});

// ─── POST /api/game/post-match ───────────────────────────────────────────────
/**
 * Unity pushes player state changes after a match ends.
 * Applies fatigue, morale, fitness, and injury updates to each player.
 * Values are clamped to [0, 100]. Only fields present in each update
 * object are written — omitted fields are left unchanged.
 *
 * Body: {
 *   matchId: number,
 *   updates: Array<{
 *     playerId,
 *     fatigue?,          // absolute value 0–100
 *     morale?,           // absolute value 0–100
 *     fitness?,          // absolute value 0–100
 *     isInjured?,        // boolean
 *     injuryStatus?,     // "Healthy" | "Minor" | "Moderate" | "Severe"
 *     injuryWeeksRemaining?
 *   }>
 * }
 */
router.post("/game/post-match", async (req, res) => {
  if (!authGuard(req, res)) return;
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No active team" }); return; }

  const { matchId, updates } = req.body;
  if (matchId == null || !Array.isArray(updates)) {
    res.status(400).json({ error: "matchId and updates[] are required" }); return;
  }

  const [match] = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.id, Number(matchId)));

  if (!match) { res.status(404).json({ error: "Match not found" }); return; }
  if (match.homeTeamId !== team.id && match.awayTeamId !== team.id) {
    res.status(403).json({ error: "This match does not belong to your team" }); return;
  }

  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  let applied = 0;
  for (const u of updates) {
    const playerId = Number(u.playerId);
    if (!playerId) continue;

    const patch: Partial<CareerPlayerFields> = {};
    if (u.fatigue  != null) patch.fatigue  = clamp(Number(u.fatigue));
    if (u.morale   != null) patch.morale   = clamp(Number(u.morale));
    if (u.fitness  != null) patch.fitness  = clamp(Number(u.fitness));
    if (u.isInjured         != null) patch.isInjured             = Boolean(u.isInjured);
    if (u.injuryStatus      != null) patch.injuryStatus           = String(u.injuryStatus);
    if (u.injuryWeeksRemaining != null)
      patch.injuryWeeksRemaining = Number(u.injuryWeeksRemaining);

    if (Object.keys(patch).length === 0) continue;

    await updatePlayerState(requireCareerSaveId(req.activeCareerSaveId), playerId, patch);
    applied++;
  }

  res.json({ ok: true, matchId: Number(matchId), updatedPlayers: applied });
});

// ─── GET /api/game/assets ────────────────────────────────────────────────────
/**
 * Returns image URLs and logo colour tokens for Unity to pre-load assets.
 * Includes the player roster image map and club logo colours.
 */
router.get("/game/assets", async (req, res) => {
  if (!authGuard(req, res)) return;
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No active team" }); return; }

  const players = await loadPlayers(requireCareerSaveId(req.activeCareerSaveId), { teamId: team.id, isActive: true });

  res.json({
    myClub: {
      clubId:   team.id,
      clubName: team.name,
      clubLogo: clubLogo(team),
    },
    players: players.map(p => ({
      playerId: p.id,
      name:     p.name,
      imageUrl: p.imageUrl ?? null,
    })),
  });
});

export default router;
