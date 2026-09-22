import { db, teamsTable, achievementsTable, playersTable, trophiesTable, careerSavesTable } from "@workspace/db";
import type { CareerStats } from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";
import { ACHIEVEMENT_DEFS } from "./achievement-definitions";
import { loadPlayers, careerSaveIdForTeamOrThrow } from "../lib/playerDto.js";
import { announceUnlocked } from "./steamBridge.js";

export const DEFAULT_CAREER_STATS: CareerStats = {
  matchesWon: 0,
  championshipsWon: 0,
  highestBalanceReached: 0,
  seasonsCompleted: 0,
  continentsVisited: [],
  youthSigned: 0,
  youthPromoted: 0,
  playersDevelopedToFiveStar: 0,
  olympicGolds: 0,
  perfectSeasons: 0,
  debtFreeSeasons: 0,
  currentSeasonLosses: 0,
  goldEventsWon: 0,
  hallOfFameInductions: 0,
  clubsSoldFromUnder: 0,
};

/**
 * The known counters only, each defaulting to zero. R-77: an older save's JSON
 * may still carry counters that were removed (continentalTitles,
 * seasonsInCurrentLocation, currentLocationId); they are dropped here, not
 * spread back into the stored object.
 */
export function getCareerStats(raw: unknown): CareerStats {
  const s = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const n = (key: keyof CareerStats) => (typeof s[key] === "number" ? (s[key] as number) : 0);
  return {
    matchesWon:                 n("matchesWon"),
    championshipsWon:           n("championshipsWon"),
    highestBalanceReached:      n("highestBalanceReached"),
    seasonsCompleted:           n("seasonsCompleted"),
    continentsVisited:          Array.isArray(s["continentsVisited"]) ? (s["continentsVisited"] as string[]) : [],
    youthSigned:                n("youthSigned"),
    youthPromoted:              n("youthPromoted"),
    playersDevelopedToFiveStar: n("playersDevelopedToFiveStar"),
    olympicGolds:               n("olympicGolds"),
    perfectSeasons:             n("perfectSeasons"),
    debtFreeSeasons:            n("debtFreeSeasons"),
    currentSeasonLosses:        n("currentSeasonLosses"),
    goldEventsWon:              n("goldEventsWon"),
    hallOfFameInductions:       n("hallOfFameInductions"),
    clubsSoldFromUnder:         n("clubsSoldFromUnder"),
  };
}

/**
 * The manager's record, read from the CAREER.
 *
 * ACH: it used to be read straight off `teams.career_stats` — the club's row —
 * so a manager who changed clubs (L-02e) started again from nothing and
 * "Manage for 30 seasons" was unreachable to anybody who ever moved. Seasons
 * are counted across a manager's whole career, so the record lives on the
 * career save. A save made before that is migrated here, once, the first time
 * it is asked for; the club's column is left alone rather than cleared, so a
 * downgrade to an older build still finds its numbers.
 */
export async function careerStatsFor(teamId: number): Promise<CareerStats> {
  const careerSaveId = await careerSaveIdForTeamOrThrow(teamId);
  const [save] = await db.select().from(careerSavesTable)
    .where(eq(careerSavesTable.id, careerSaveId)).limit(1);
  if (save?.careerStats) return getCareerStats(save.careerStats);

  const team = await db.query.teamsTable.findFirst({ where: eq(teamsTable.id, teamId) });
  const migrated = getCareerStats(team?.careerStats);
  await db.update(careerSavesTable).set({ careerStats: migrated })
    .where(eq(careerSavesTable.id, careerSaveId));
  return migrated;
}

export async function updateCareerStats(
  teamId: number,
  updater: (stats: CareerStats) => CareerStats,
): Promise<CareerStats> {
  const careerSaveId = await careerSaveIdForTeamOrThrow(teamId);
  const updated = updater(await careerStatsFor(teamId));
  await db.update(careerSavesTable).set({ careerStats: updated })
    .where(eq(careerSavesTable.id, careerSaveId));
  return updated;
}

export async function checkAchievements(teamId: number, season?: number): Promise<string[]> {
  const team = await db.query.teamsTable.findFirst({ where: eq(teamsTable.id, teamId) });
  if (!team) return [];

  const stats = await careerStatsFor(teamId);

  // Derive 5-star players from DB (peakOverallRating >= 85 = 5 stars)
  const fiveStarRows = (await loadPlayers(await careerSaveIdForTeamOrThrow(teamId), { teamId }))
    .filter((p) => (p.peakOverallRating ?? 0) >= 85);

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
    await db.update(careerSavesTable).set({ careerStats: derivedStats })
      .where(eq(careerSavesTable.id, await careerSaveIdForTeamOrThrow(teamId)));
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

  // ACH: Steam hears about it here rather than at each caller. There are five
  // call sites (calendar, matches, team, youth-scouting, hall-of-fame) and a
  // sixth would be one nobody remembered to wire — an achievement that pops in
  // the game and not on Steam is the kind of bug a player reports and nobody
  // can reproduce. Never throws, and does nothing when the server is not a
  // fork child (the harness, and `node dist/index.mjs` by hand).
  announceUnlocked(newlyUnlocked);

  return newlyUnlocked;
}
