import { db } from "@workspace/db";
import {
  careerSavesTable, teamsTable, trophiesTable, achievementsTable,
  hallOfFameTable, careerHistoryEntriesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getSession, getSessionId, updateSession } from "../lib/auth.js";
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

export async function buildCareerSummary(teamId: number, userId: string) {
  const [save] = await db
    .select()
    .from(careerSavesTable)
    .where(and(eq(careerSavesTable.teamId, teamId), eq(careerSavesTable.userId, userId)));

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));

  const trophies = await db.select().from(trophiesTable).where(eq(trophiesTable.teamId, teamId));
  const unlocked = await db.select().from(achievementsTable).where(eq(achievementsTable.teamId, teamId));

  const worldTitles   = trophies.filter(t => t.type === "world_championship").length;
  const olympicMedals = trophies.filter(t => ["olympic_gold", "olympic_silver", "olympic_bronze"].includes(t.type)).length;

  const TOTAL_ACHIEVEMENTS = 25;

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
 * ACTUALLY ends (as opposed to resign/break-contract, which only disconnect
 * the manager from a club — the save stays alive, employable again from the
 * Job Market).
 *
 * Used by voluntary retirement (POST /careers/end) and by the board-
 * confidence fail state (sacked at zero confidence, R-09) — same
 * termination, different history `type`/`description`.
 */
export async function endCareer(
  req: Request,
  teamId: number,
  userId: string,
  opts: { type: string; description: (summary: CareerSummary) => string },
): Promise<CareerSummary> {
  const summary = await buildCareerSummary(teamId, userId);

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

  const [activeSave] = await db
    .select()
    .from(careerSavesTable)
    .where(and(eq(careerSavesTable.teamId, teamId), eq(careerSavesTable.userId, userId)));

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
      .set({ retiredAt: new Date() })
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
