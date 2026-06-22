import { Router } from "express";
import { db } from "@workspace/db";
import { teamsTable, playersTable, seasonInjuryStatsTable, matchesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

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
