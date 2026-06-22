import { Router } from "express";
import { db } from "@workspace/db";
import { teamsTable, playersTable, seasonInjuryStatsTable, matchesTable, trainingSessionsTable } from "@workspace/db";
import { eq, and, desc, gte } from "drizzle-orm";

const router = Router();

router.get("/medical/workload", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const team = await db.query.teamsTable.findFirst({ where: eq(teamsTable.userId, req.user.id) });
  if (!team) { res.status(404).json({ error: "No team" }); return; }

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [players, recentMatches, recentTraining] = await Promise.all([
    db.select({
      id:        playersTable.id,
      name:      playersTable.name,
      position:  playersTable.position,
      squadRole: playersTable.squadRole,
      imageUrl:  playersTable.imageUrl,
    })
      .from(playersTable)
      .where(eq(playersTable.teamId, team.id)),
    db.select({ lineup: matchesTable.lineup })
      .from(matchesTable)
      .where(and(
        eq(matchesTable.homeTeamId, team.id),
        eq(matchesTable.status, "completed"),
        gte(matchesTable.createdAt, fourteenDaysAgo),
      )),
    db.select({ playerId: trainingSessionsTable.playerId })
      .from(trainingSessionsTable)
      .where(and(
        eq(trainingSessionsTable.teamId, team.id),
        eq(trainingSessionsTable.status, "completed"),
        gte(trainingSessionsTable.createdAt, fourteenDaysAgo),
      )),
  ]);

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

  const team = await db.query.teamsTable.findFirst({ where: eq(teamsTable.userId, req.user.id) });
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
    db.select({ injuryStatus: playersTable.injuryStatus })
      .from(playersTable)
      .where(eq(playersTable.teamId, team.id)),
  ]);

  const stat = statRow[0];
  const currentInjuryCount = players.filter(p => p.injuryStatus !== "Healthy").length;

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
