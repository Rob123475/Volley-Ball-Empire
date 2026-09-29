/**
 * Unity brief item 4 (and 5): a watched match is "in_progress" from the moment
 * the 3D court opens until the court posts its result, or the player leaves.
 * If the window is closed with the X in between, the result never arrives, and
 * the save would be left mid-match: the calendar blocked on a match nothing can
 * finish. At boot, every such match is finished from the last score the court
 * sent (POST /unity/match-progress), with the game's engine at the match's own
 * chance, through the same code as leaving the court early.
 */
import { db, matchesTable, teamsTable, careerSavesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { finishWatchedMatchFromProgress } from "../routes/matches.js";
import { logger } from "../lib/logger.js";

export async function finishAbandonedWatchedMatches(): Promise<Array<{ matchId: number; from: string; result: string }>> {
  const open = await db.select().from(matchesTable).where(eq(matchesTable.status, "in_progress"));
  const done: Array<{ matchId: number; from: string; result: string }> = [];
  for (const match of open) {
    if (match.homeTeamId == null) continue;
    const team = await db.query.teamsTable.findFirst({ where: eq(teamsTable.id, match.homeTeamId) });
    const save = await db.query.careerSavesTable.findFirst({ where: eq(careerSavesTable.teamId, match.homeTeamId) });
    if (!team || !save) continue;
    try {
      const r = await finishWatchedMatchFromProgress({ careerSaveId: save.id, team, userId: save.userId ?? null, log: logger }, match);
      if (r) {
        const f = r.finishedFrom;
        done.push({
          matchId: match.id,
          from: `${f.finished.map((s) => `${s.home}-${s.away}`).concat(`${f.current.home}-${f.current.away}`).join(", ")}`,
          result: `${r.homeScore}-${r.awayScore}`,
        });
      }
    } catch (err) {
      logger.error({ err, matchId: match.id }, "could not finish an abandoned watched match");
    }
  }
  return done;
}
