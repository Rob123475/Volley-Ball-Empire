import { db } from "@workspace/db";
import {
  careerSavesTable, teamsTable, trophiesTable, achievementsTable,
  hallOfFameTable, careerHistoryEntriesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getSession, getSessionId, updateSession } from "../lib/auth.js";
import { ACHIEVEMENT_DEFS } from "./achievement-definitions.js";
import type { Request } from "express";

// ── Manager salary ─────────────────────────────────────────────────────────────
/**
 * There is no contract-negotiation system in this game (R-12 removed the
 * stub UI for one) — salary is not a number the player sets or a row in a
 * table, so it is derived from the one real, per-career figure that already
 * stands in for a manager's standing: reputation. $2,000 base plus $80 per
 * reputation point keeps it in the same ballpark the old hardcoded "$5,000"
 * placeholder was ($6,000 at the default rep of 50), but now moves with the
 * manager's actual career instead of being the same number for everyone.
 */
export function computeManagerSalary(managerReputation: number): number {
  return 2_000 + managerReputation * 80;
}

// ── Career summary ────────────────────────────────────────────────────────────
// Shared by /careers/summary and every path that ends a career, so the Hall of
// Fame archive is always built from the same numbers the player last saw.

/**
 * `careerSaveId` is for a career that no longer holds the club it is being
 * summarised from: L-02e leaves a manager between clubs with no team_id, and
 * the summary of their career is still built from the club they last had.
 * Without it the save is not found and every field falls back to "Unknown".
 */
export async function buildCareerSummary(teamId: number, userId: string, careerSaveId?: number) {
  const [save] = careerSaveId
    ? await db.select().from(careerSavesTable).where(and(
        eq(careerSavesTable.id, careerSaveId),
        eq(careerSavesTable.userId, userId),
      ))
    : await db.select().from(careerSavesTable).where(and(
        eq(careerSavesTable.teamId, teamId),
        eq(careerSavesTable.userId, userId),
      ));

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));

  const trophies = await db.select().from(trophiesTable).where(eq(trophiesTable.teamId, teamId));
  const unlocked = await db.select().from(achievementsTable).where(eq(achievementsTable.teamId, teamId));

  const worldTitles   = trophies.filter(t => t.type === "world_championship").length;
  const olympicMedals = trophies.filter(t => ["olympic_gold", "olympic_silver", "olympic_bronze"].includes(t.type)).length;

  // ACH: counted, not remembered. This was hardcoded at 25 while the game
  // shipped 30, so the career-end screen told a manager who had unlocked 28
  // of them "28 / 25" and drew a progress bar past its own end. Rob's rule
  // is exactly 30 achievements; the list is the only place that says so.
  const TOTAL_ACHIEVEMENTS = ACHIEVEMENT_DEFS.length;

  return {
    managerName:          save?.managerName ?? "Unknown",
    managerNationality:   save?.managerNationality ?? null,
    clubName:             save?.clubName    ?? "Unknown",
    season:               save?.season      ?? "Season 1",
    worldRanking:         save?.worldRanking ?? null,
    worldTitles,
    olympicMedals,
    achievementsCompleted: unlocked.length,
    totalAchievements:    TOTAL_ACHIEVEMENTS,
    totalWins:            team?.wins   ?? 0,
    totalLosses:          team?.losses ?? 0,
    managerReputation:    save?.managerReputation ?? 50,
    managerSalary:        computeManagerSalary(save?.managerReputation ?? 50),
  };
}

export type CareerSummary = Awaited<ReturnType<typeof buildCareerSummary>>;

// ── End a career, permanently ─────────────────────────────────────────────────
/**
 * Archives to Hall of Fame, writes one history entry, marks the career save
 * retired, and clears it from the session. This is the one place a career
 * ends.
 *
 * Used by voluntary retirement (POST /careers/end), by every sacking (the
 * season review and abandonment, R-53), and — R-60 — by resigning and breaking
 * a contract: same termination, different history `type`/`description`. The
 * save keeps its club link; nothing ever leaves a save without a club.
 */
/**
 * L-02e — the club is sold, and the manager is out of a job but not out of the
 * game.
 *
 * Rob's rule: five loss-making seasons and the club is sold; for the manager's
 * own club that means losing the job, and then being shown what vacancies
 * there are. So this deliberately does NOT end the career: it detaches the
 * save from the club and marks it as seeking one. The career keeps everything
 * that is the MANAGER's — seasons completed, reputation (ACH moved the
 * counters onto the career save for exactly this) and the achievement rows,
 * which follow the manager to the next club (routes/job-market.ts) — and
 * loses everything
 * that was the CLUB's, because the club is somebody else's now.
 *
 * The save is left with no team_id, which R-60 treats as a finished career.
 * That is why `seeking_club_since` exists and why finishClublessCareers()
 * checks it: this is the one time a save is without a club on purpose.
 */
export async function loseClub(
  req: Request, teamId: number, verdict: string,
): Promise<{ clubName: string }> {
  const [save] = await db
    .select()
    .from(careerSavesTable)
    .where(eq(careerSavesTable.teamId, teamId));
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
  const clubName = team?.name ?? save?.clubName ?? "The club";

  if (save) {
    await db.insert(careerHistoryEntriesTable).values({
      userId:       save.userId,
      careerSaveId: save.id,
      type:         "club_sold",
      clubName,
      season:       save.season,
      description:
        `${clubName} was sold after five seasons of losses. ` +
        `${save.managerName} is out of a job. ${verdict}`,
    });

    await db.update(careerSavesTable)
      .set({ teamId: null, formerTeamId: teamId, seekingClubSince: new Date() })
      .where(eq(careerSavesTable.id, save.id));
  }

  // The session keeps the career but loses the club, so every club route says
  // "no team" until one is taken.
  const sid = getSessionId(req);
  if (sid) {
    const session = await getSession(sid);
    if (session) {
      const { activeTeamId: _, ...rest } = session;
      await updateSession(sid, { ...rest });
    }
  }

  return { clubName };
}

/**
 * `careerSaveId` is for the one case where the save is not found by its club:
 * L-02e leaves a career between clubs with no team_id, and a manager who
 * retires from the job market is ending THAT career while the summary is built
 * from the club they last had.
 */
export async function endCareer(
  req: Request,
  teamId: number,
  userId: string,
  opts: {
    type: string;
    description: (summary: CareerSummary) => string;
    careerSaveId?: number;
  },
): Promise<CareerSummary> {
  const summary = await buildCareerSummary(teamId, userId, opts.careerSaveId);

  await db.insert(hallOfFameTable).values({
    userId,
    managerName:           summary.managerName,
    clubName:              summary.clubName,
    season:                summary.season,
    worldRanking:          summary.worldRanking ?? null,
    worldTitles:           summary.worldTitles,
    olympicMedals:         summary.olympicMedals,
    achievementsCompleted: summary.achievementsCompleted,
    totalWins:             summary.totalWins,
    totalLosses:           summary.totalLosses,
  });

  const [activeSave] = opts.careerSaveId
    ? await db.select().from(careerSavesTable).where(and(
        eq(careerSavesTable.id, opts.careerSaveId),
        eq(careerSavesTable.userId, userId),
      ))
    : await db.select().from(careerSavesTable).where(and(
        eq(careerSavesTable.teamId, teamId),
        eq(careerSavesTable.userId, userId),
      ));

  if (activeSave) {
    await db.insert(careerHistoryEntriesTable).values({
      userId,
      careerSaveId: activeSave.id,
      type:         opts.type,
      clubName:     summary.clubName,
      season:       summary.season,
      description:  opts.description(summary),
    });

    await db
      .update(careerSavesTable)
      // L-02e: a career that ends while between clubs stops seeking one.
      .set({ retiredAt: new Date(), seekingClubSince: null, formerTeamId: null })
      .where(eq(careerSavesTable.id, activeSave.id));
  }

  const sid = getSessionId(req);
  if (sid) {
    const session = await getSession(sid);
    if (session) {
      const { activeTeamId: _, activeCareerSaveId: __, careerSessionRestored: ___, ...rest } = session;
      await updateSession(sid, { ...rest, careerSessionRestored: true });
    }
  }

  return summary;
}
