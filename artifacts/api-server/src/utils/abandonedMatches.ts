/**
 * A watched match is "in_progress" from the moment the 3D court opens until
 * the court posts its result, or the player leaves. If the window is closed
 * with the X in between, the result never arrives, and the save would be left
 * mid-match: the calendar blocked on a match nothing can finish.
 *
 * Overnight brief 30 Sep, item 24: the window's X mid-match counts the same as
 * leaving the court: at the next boot every such match is forfeited
 * (recordForfeit, the one forfeit there is). It used to be finished from the
 * last score the court sent.
 */
import { db, matchesTable, teamsTable, careerSavesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { recordForfeit } from "../routes/matches.js";
import { logger } from "../lib/logger.js";

export async function forfeitAbandonedWatchedMatches(): Promise<Array<{ matchId: number; round: number }>> {
  const open = await db.select().from(matchesTable).where(eq(matchesTable.status, "in_progress"));
  const done: Array<{ matchId: number; round: number }> = [];
  for (const match of open) {
    if (match.homeTeamId == null) continue;
    const team = await db.query.teamsTable.findFirst({ where: eq(teamsTable.id, match.homeTeamId) });
    const save = await db.query.careerSavesTable.findFirst({ where: eq(careerSavesTable.teamId, match.homeTeamId) });
    if (!team || !save) continue;
    try {
      await recordForfeit(null, team, match, save.id);
      done.push({ matchId: match.id, round: match.round });
    } catch (err) {
      logger.error({ err, matchId: match.id }, "could not forfeit an abandoned watched match");
    }
  }
  return done;
}
