import { db, teamsTable, achievementsTable, playersTable, trophiesTable } from "@workspace/db";
import type { CareerStats } from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";
import { ACHIEVEMENT_DEFS } from "./achievement-definitions";

export const DEFAULT_CAREER_STATS: CareerStats = {
  matchesWon: 0,
  championshipsWon: 0,
  highestBalanceReached: 0,
  seasonsCompleted: 0,
  seasonsInCurrentLocation: 0,
  currentLocationId: null,
  continentsVisited: [],
  youthSigned: 0,
  youthPromoted: 0,
  playersDevelopedToFiveStar: 0,
  continentalTitles: 0,
  olympicGolds: 0,
  perfectSeasons: 0,
  debtFreeSeasons: 0,
  currentSeasonLosses: 0,
};

export function getCareerStats(raw: unknown): CareerStats {
  const s = (typeof raw === "object" && raw !== null ? raw : {}) as Partial<CareerStats>;
  return {
    ...DEFAULT_CAREER_STATS,
    ...s,
    continentsVisited: Array.isArray(s.continentsVisited) ? s.continentsVisited : [],
  };
}

export async function updateCareerStats(
  teamId: number,
  updater: (stats: CareerStats) => CareerStats,
): Promise<CareerStats> {
  const team = await db.query.teamsTable.findFirst({ where: eq(teamsTable.id, teamId) });
  if (!team) throw new Error("Team not found");
  const current = getCareerStats(team.careerStats);
  const updated = updater(current);
  await db.update(teamsTable).set({ careerStats: updated }).where(eq(teamsTable.id, teamId));
  return updated;
}

export async function checkAchievements(teamId: number, season?: number): Promise<string[]> {
  const team = await db.query.teamsTable.findFirst({ where: eq(teamsTable.id, teamId) });
  if (!team) return [];

  const stats = getCareerStats(team.careerStats);

  // Derive 5-star players from DB (peakOverallRating >= 85 = 5 stars)
  const fiveStarRows = await db
    .select({ id: playersTable.id })
    .from(playersTable)
    .where(and(eq(playersTable.teamId, teamId), gte(playersTable.peakOverallRating, 85)));

  // Derive Olympic golds from trophies table
  const olympicGoldRows = await db
    .select({ id: trophiesTable.id })
    .from(trophiesTable)
    .where(and(eq(trophiesTable.teamId, teamId), eq(trophiesTable.type, "olympic_gold")));

  const derivedStats: CareerStats = {
    ...stats,
    playersDevelopedToFiveStar: Math.max(stats.playersDevelopedToFiveStar, fiveStarRows.length),
    highestBalanceReached: Math.max(stats.highestBalanceReached, Number(team.budget)),
    olympicGolds: Math.max(stats.olympicGolds, olympicGoldRows.length),
  };

  // Persist derived improvements back to careerStats if anything changed
  const needsUpdate =
    derivedStats.playersDevelopedToFiveStar > stats.playersDevelopedToFiveStar ||
    derivedStats.highestBalanceReached > stats.highestBalanceReached ||
    derivedStats.olympicGolds > stats.olympicGolds;

  if (needsUpdate) {
    await db.update(teamsTable).set({ careerStats: derivedStats }).where(eq(teamsTable.id, teamId));
  }

  const existing = await db
    .select({ achievementKey: achievementsTable.achievementKey })
    .from(achievementsTable)
    .where(eq(achievementsTable.teamId, teamId));
  const unlockedKeys = new Set(existing.map((a) => a.achievementKey));

  const newlyUnlocked: string[] = [];

  for (const def of ACHIEVEMENT_DEFS) {
    if (unlockedKeys.has(def.key)) continue;
    if (def.check(team, derivedStats)) {
      await db
        .insert(achievementsTable)
        .values({ teamId, achievementKey: def.key, seasonUnlocked: season ?? null })
        .onConflictDoNothing();
      newlyUnlocked.push(def.key);
    }
  }

  return newlyUnlocked;
}
