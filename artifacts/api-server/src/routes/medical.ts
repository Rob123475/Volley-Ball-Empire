import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { db, careerPlayerStateTable } from "@workspace/db";
import { playersTable, matchesTable, trainingSessionsTable, careerInjuriesTable, BODY_AREA_LABELS, RECONSTRUCTION, type BodyArea } from "@workspace/db";
import { eq, and, desc, gte } from "drizzle-orm";
import { getGameDate } from "../utils/gameDate.js";
import { loadPlayers, requireCareerSaveId } from "../lib/playerDto.js";
import { isInjured } from "../utils/condition.js";

const router = Router();

/**
 * Night 2 (O-7): the club's injuries this season (the game year), from every
 * club's one injury history (career_injuries), named, with their body area.
 */
async function clubInjuriesThisSeason(careerSaveId: number, teamId: number) {
  const today = await getGameDate(teamId);
  return db.select({ h: careerInjuriesTable, name: playersTable.name })
    .from(careerInjuriesTable).innerJoin(playersTable, eq(playersTable.id, careerInjuriesTable.playerId))
    .where(and(eq(careerInjuriesTable.careerSaveId, careerSaveId), eq(careerInjuriesTable.teamId, teamId),
      gte(careerInjuriesTable.gameDate, `${today.slice(0, 4)}-01-01`)))
    .orderBy(desc(careerInjuriesTable.gameDate), desc(careerInjuriesTable.id));
}

router.get("/medical/injury-history", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const rows = await clubInjuriesThisSeason(requireCareerSaveId(req.activeCareerSaveId), team.id);
  res.json(rows.map(({ h, name }) => ({
    id: h.id, teamId: team.id, playerId: h.playerId, playerName: name,
    injuryType: h.injury, area: BODY_AREA_LABELS[h.area as BodyArea] ?? h.area, reconstruction: h.reconstruction,
    daysMissed: Math.round(h.weeksOut * 7), dateInjured: `${h.gameDate}T00:00:00.000Z`,
  })));
});

/**
 * Night 2 (O-7, O-8): one player's injury history, every club she was at, and
 * her injuries per body area in the last 12 months (three to one area makes the
 * next a reconstruction). The player card.
 */
router.get("/players/:id/injuries", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const playerId = Number(req.params.id);
  const today = team ? await getGameDate(team.id) : "2026-01-01";
  const rows = await db.select().from(careerInjuriesTable)
    .where(and(eq(careerInjuriesTable.careerSaveId, cid), eq(careerInjuriesTable.playerId, playerId)))
    .orderBy(desc(careerInjuriesTable.gameDate), desc(careerInjuriesTable.id));
  const yearAgo = new Date(`${today}T00:00:00Z`); yearAgo.setUTCDate(yearAgo.getUTCDate() - RECONSTRUCTION.windowDays);
  const since = yearAgo.toISOString().slice(0, 10);
  const areas = new Map<string, number>();
  // Only the injuries that count toward a reconstruction (utils/injuries.ts injuriesInAreaTx: not a 1-week one).
  for (const r of rows) if (r.gameDate >= since && r.baseWeeks >= RECONSTRUCTION.minBaseWeeks) areas.set(r.area, (areas.get(r.area) ?? 0) + 1);
  res.json({
    injuries: rows.map((r) => ({ injury: r.injury, area: BODY_AREA_LABELS[r.area as BodyArea] ?? r.area, gameDate: r.gameDate, weeksOut: r.weeksOut, reconstruction: r.reconstruction })),
    areasLast12Months: [...areas].map(([area, count]) => ({ area: BODY_AREA_LABELS[area as BodyArea] ?? area, count }))
      .sort((a, b) => b.count - a.count),
    reconstructionAt: RECONSTRUCTION.injuriesInArea,
  });
});

/** The first of the last WORKLOAD_DAYS game days, today being the last. */
export const WORKLOAD_DAYS = 14;
export function workloadWindowStart(today: string): string {
  const d = new Date(`${today.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (WORKLOAD_DAYS - 1));
  return d.toISOString().slice(0, 10);
}

router.get("/medical/workload", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }

  // Overnight 1 Oct, N-36: the last 14 GAME days, today included. It compared
  // each row's createdAt (the PC's clock) with the PC's today, and every fixture
  // of a season is created at the same moment, so it counted the whole season.
  const today = await getGameDate(team.id);
  const from = workloadWindowStart(today);
  const inWindow = (d: string | null | undefined) => !!d && d.slice(0, 10) >= from && d.slice(0, 10) <= today;

  const [players, completedMatches, completedTraining] = await Promise.all([
    loadPlayers(requireCareerSaveId(req.activeCareerSaveId), { teamId: team.id }),
    db.select({ lineup: matchesTable.lineup, playedOn: matchesTable.scheduledAt })
      .from(matchesTable)
      .where(and(
        eq(matchesTable.homeTeamId, team.id),
        eq(matchesTable.status, "completed"),
      )),
    db.select({ playerId: trainingSessionsTable.playerId, finishesOn: trainingSessionsTable.finishesOn, scheduledAt: trainingSessionsTable.scheduledAt })
      .from(trainingSessionsTable)
      .where(and(
        eq(trainingSessionsTable.teamId, team.id),
        eq(trainingSessionsTable.status, "completed"),
      )),
  ]);
  const recentMatches = completedMatches.filter((m) => inWindow(m.playedOn));
  const recentTraining = completedTraining.filter((t) => inWindow(t.finishesOn ?? t.scheduledAt));

  const trainingCount = new Map<number, number>();
  for (const t of recentTraining) {
    trainingCount.set(t.playerId, (trainingCount.get(t.playerId) ?? 0) + 1);
  }

  const workloads = players.map(player => {
    const matchesPlayed = recentMatches.filter(
      m => (m.lineup as number[] | null)?.includes(player.id) ?? false
    ).length;
    const trainingSessions = trainingCount.get(player.id) ?? 0;

    let status: "Fresh" | "Heavy Load" | "Overworked";
    if (matchesPlayed >= 4 || trainingSessions >= 6) {
      status = "Overworked";
    } else if (matchesPlayed >= 2 || trainingSessions >= 3) {
      status = "Heavy Load";
    } else {
      status = "Fresh";
    }

    return {
      id: player.id,
      name: player.name,
      position: player.position,
      squadRole: player.squadRole,
      imageUrl: player.imageUrl ?? null,
      matchesPlayed,
      trainingSessions,
      status,
    };
  });

  res.json(workloads);
});

router.get("/medical/injury-stats", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const [rows, players] = await Promise.all([
    clubInjuriesThisSeason(cid, team.id),
    db.select({ injuryStatus: careerPlayerStateTable.injuryStatus, isInjured: careerPlayerStateTable.isInjured })
      .from(careerPlayerStateTable)
      .where(and(eq(careerPlayerStateTable.careerSaveId, cid), eq(careerPlayerStateTable.teamId, team.id))),
  ]);
  // Item 14: injured by either flag, the one test (utils/condition.ts).
  const currentInjuryCount = players.filter((p) => isInjured(p)).length;
  const totalInjuries = rows.length;
  const daysLost = Math.round(rows.reduce((t, { h }) => t + h.weeksOut * 7, 0));
  const counts = new Map<string, number>();
  for (const { h } of rows) counts.set(h.injury, (counts.get(h.injury) ?? 0) + 1);
  const byType = [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  res.json({
    seasonId: Number((await getGameDate(team.id)).slice(0, 4)),
    totalInjuries,
    daysLost,
    byType,
    avgRecoveryDays: totalInjuries > 0 ? Math.round(daysLost / totalInjuries) : 0,
    mostCommon: byType[0]?.label ?? "None",
    currentInjuryCount,
  });
});

export default router;
