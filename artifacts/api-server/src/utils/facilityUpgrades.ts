/**
 * Facility upgrades: what one costs, and when a bought one is finished.
 *
 * D-1 (29 Sep): the dashboard offered "Upgrade Ready: Level 1 -> 2" for a
 * building whose level-2 upgrade had already been bought. Two causes, both
 * fixed here:
 *   - the Attention card read `level` and never looked at `upgradingToLevel`,
 *     so a building under construction still looked ready to buy;
 *   - a finished build was only collected when someone opened the Facilities
 *     page (GET /facilities). Until then the building stayed at its old level
 *     for every bonus in the game, and anything reading it saw stale state.
 * Builds now finish on the calendar day their round arrives (calendar
 * advance), and every reader shares these rules.
 */
import { db, facilitiesTable, type seasonsTable } from "@workspace/db";
import { and, eq, isNotNull, lte } from "drizzle-orm";

export const MAX_FACILITY_LEVEL = 10;

export function upgradeCost(currentLevel: number): number {
  return currentLevel * 20000;
}

/** The round counter builds are timed in: rounds since the first season began. */
export function absoluteRound(season: Pick<typeof seasonsTable.$inferSelect, "year" | "currentRound"> | null | undefined): number {
  if (!season) return 0;
  return (season.year - 2026) * 70 + season.currentRound;
}

/** A facility the player could buy the next level of right now. */
export function canStartUpgrade(f: Pick<typeof facilitiesTable.$inferSelect, "level" | "upgradingToLevel">): boolean {
  return f.upgradingToLevel == null && f.level < MAX_FACILITY_LEVEL;
}

/** Finish every build of this team's that is due by `currentRound`. */
export async function completeDueUpgrades(teamId: number, currentRound: number): Promise<void> {
  const due = await db
    .select()
    .from(facilitiesTable)
    .where(
      and(
        eq(facilitiesTable.teamId, teamId),
        isNotNull(facilitiesTable.upgradingToLevel),
        lte(facilitiesTable.upgradeCompletesAtRound, currentRound),
      ),
    );

  for (const f of due) {
    if (f.upgradingToLevel == null) continue;
    await db
      .update(facilitiesTable)
      .set({
        level:                   f.upgradingToLevel,
        upgradingToLevel:        null,
        upgradeCompletesAtRound: null,
        updatedAt:               new Date(),
      })
      .where(eq(facilitiesTable.id, f.id));
  }
}
