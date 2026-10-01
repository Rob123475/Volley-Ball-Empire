import { db } from "@workspace/db";
import {
  careerSavesTable, teamsTable, trophiesTable, achievementsTable,
  hallOfFameTable, careerHistoryEntriesTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { seasonsTable, managerLevelFor, MANAGER_SALARY_PER_SEASON, managerSalaryFor, financeTransactionsTable } from "@workspace/db";
import { getGameDate } from "./gameDate.js";
import { getSession, getSessionId, updateSession } from "../lib/auth.js";
import { ACHIEVEMENT_DEFS } from "./achievement-definitions.js";
import type { Request } from "express";

// ── Manager salary ─────────────────────────────────────────────────────────────
/**
 * Overnight 1 Oct, N-41: the salary is a month, fixed in Rob's range for the
 * career (managerSalaryFor, lib/db/src/schema/money.ts), and paid weekly from
 * the club's budget. Before that (overnight 30 Sep item 2) it was
 * MANAGER_SALARY_PER_SEASON, $6,000 a season, never paid out.
 *
 * "Career Earnings" is the salary EARNED to date: the manager-salary lines on
 * the ledger, plus, for a save older than the pass, the old $6,000 a season pro
 * rata on the game days served before it. It used to show the club's prize money.
 */
export async function managerEarnings(careerSaveId: number, today: string): Promise<number> {
  const [save] = await db.select({ teamId: careerSavesTable.teamId, formerTeamId: careerSavesTable.formerTeamId, moneyPassAt: careerSavesTable.moneyPassAt })
    .from(careerSavesTable).where(eq(careerSavesTable.id, careerSaveId));
  // Overnight 1 Oct, N-41: from the money pass on, the salary is really paid,
  // weekly, on the club's ledger ("Manager salary"): what was paid is what was earned.
  const teams = [save?.teamId, save?.formerTeamId].filter((t): t is number => t != null);
  const paid = teams.length === 0 ? 0 : (await db.select({ amount: financeTransactionsTable.amount })
    .from(financeTransactionsTable)
    .where(and(inArray(financeTransactionsTable.teamId, teams), eq(financeTransactionsTable.category, "manager_salary"))))
    .reduce((sum, r) => sum + Number(r.amount), 0);

  // Before it (an older save), the old $6,000 a season, pro rata on the game
  // days served up to the day the pass ran. A career made since has none.
  const until = /^\d{4}-\d{2}-\d{2}/.test(save?.moneyPassAt ?? "") ? save!.moneyPassAt!.slice(0, 10)
    : save?.moneyPassAt == null ? today : null;
  if (until == null) return Math.round(paid);
  const seasons = await db.select({ startDate: seasonsTable.startDate, endDate: seasonsTable.endDate, status: seasonsTable.status })
    .from(seasonsTable).where(eq(seasonsTable.careerSaveId, careerSaveId));
  const day = (d: string) => Date.parse(`${d.slice(0, 10)}T00:00:00Z`) / 86_400_000;
  let earned = 0;
  for (const s of seasons) {
    const length = day(s.endDate) - day(s.startDate) + 1;
    if (length <= 0) continue;
    // A finished season in full, the one the pass ran in (or today) up to that day.
    const served = s.status === "completed" && s.endDate.slice(0, 10) <= until ? length
      : Math.max(0, Math.min(length, day(until) - day(s.startDate) + 1));
    earned += MANAGER_SALARY_PER_SEASON * served / length;
  }
  return Math.round(paid + earned);
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
    // Item 2: one measure, the manager's reputation points and their level.
    managerRepPoints:     team?.managerRepPoints ?? 0,
    managerLevel:         managerLevelFor(team?.managerRepPoints ?? 0).level,
    managerLevelName:     managerLevelFor(team?.managerRepPoints ?? 0).name,
    // Overnight 1 Oct, N-41: a month, from Rob's range (lib/db/src/schema/money.ts).
    managerSalary:        save ? managerSalaryFor(`career:${save.id}`) : 0,
    careerEarnings:       save ? await managerEarnings(save.id, await getGameDate(teamId)) : 0,
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
