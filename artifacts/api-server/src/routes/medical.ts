import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { db, careerPlayerStateTable } from "@workspace/db";
import { teamsTable, playersTable, seasonInjuryStatsTable, injuryHistoryTable, matchesTable, trainingSessionsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { getGameDate } from "../utils/gameDate.js";
import { loadPlayers, requireCareerSaveId } from "../lib/playerDto.js";
import { isInjured } from "../utils/condition.js";

const router = Router();

router.get("/medical/injury-history", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }

  const lastMatch = await db.select({ season: matchesTable.season })
    .from(matchesTable)
    .where(eq(matchesTable.homeTeamId, team.id))
    .orderBy(desc(matchesTable.createdAt))
    .limit(1);

  const currentSeason = lastMatch[0]?.season ?? 1;

  const history = await db.select()
    .from(injuryHistoryTable)
    .where(and(
      eq(injuryHistoryTable.teamId, team.id),
      eq(injuryHistoryTable.seasonId, currentSeason),
    ))
    .orderBy(desc(injuryHistoryTable.dateInjured));

  res.json(history.map(h => ({
    ...h,
    dateInjured: h.dateInjured.toISOString(),
  })));
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

  const lastMatch = await db.select({ season: matchesTable.season })
    .from(matchesTable)
    .where(eq(matchesTable.homeTeamId, team.id))
    .orderBy(desc(matchesTable.createdAt))
    .limit(1);

  const currentSeason = lastMatch[0]?.season ?? 1;

  const [statRow, players] = await Promise.all([
    db.select()
      .from(seasonInjuryStatsTable)
      .where(and(
        eq(seasonInjuryStatsTable.teamId, team.id),
        eq(seasonInjuryStatsTable.seasonId, currentSeason),
      ))
      .limit(1),
    db.select({ injuryStatus: careerPlayerStateTable.injuryStatus, isInjured: careerPlayerStateTable.isInjured })
      .from(careerPlayerStateTable)
      .where(and(
        eq(careerPlayerStateTable.careerSaveId, requireCareerSaveId(req.activeCareerSaveId)),
        eq(careerPlayerStateTable.teamId, team.id),
      )),
  ]);

  const stat = statRow[0];
  // Item 14: injured by either flag, the one test (utils/condition.ts).
  const currentInjuryCount = players.filter(p => isInjured(p)).length;

  const totalInjuries       = stat?.totalInjuries       ?? 0;
  const daysLost            = stat?.daysLost            ?? 0;
  const minorInjuries       = stat?.minorInjuries       ?? 0;
  const majorInjuries       = stat?.majorInjuries       ?? 0;
  const unavailableInjuries = stat?.unavailableInjuries ?? 0;

  const avgRecoveryDays = totalInjuries > 0
    ? Math.round(daysLost / totalInjuries)
    : 0;

  const mostCommon = (() => {
    const counts = [
      { label: "Minor Injury",  count: minorInjuries },
      { label: "Major Injury",  count: majorInjuries },
      { label: "Unavailable",   count: unavailableInjuries },
    ];
    const best = counts.reduce((a, b) => b.count > a.count ? b : a, counts[0]);
    return best.count > 0 ? best.label : "None";
  })();

  res.json({
    seasonId:             currentSeason,
    totalInjuries,
    daysLost,
    minorInjuries,
    majorInjuries,
    unavailableInjuries,
    avgRecoveryDays,
    mostCommon,
    currentInjuryCount,
  });
});

export default router;
