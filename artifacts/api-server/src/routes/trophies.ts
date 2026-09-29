import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { db } from "@workspace/db";
import {
  teamsTable,
  playersTable,
  staffTable,
  matchesTable,
  financeTransactionsTable,
  trophiesTable,
} from "@workspace/db";
import { eq, desc, sql, and } from "drizzle-orm";
import { loadPlayers, requireCareerSaveId, loadStaff } from "../lib/playerDto.js";
import { careerStatsFor } from "../utils/check-achievements.js";
import { ACHIEVEMENT_DEFS, type AchievementCategory } from "../utils/achievement-definitions.js";
import { achievementsTable } from "@workspace/db";

// Item 21: how each of the 29 is drawn in the cabinet (its tier colour and
// icon). Display only: the list, names, descriptions and rules are
// ACHIEVEMENT_DEFS, the same list Steam gets.
const CABINET_TIER: Record<string, "bronze" | "silver" | "gold" | "platinum"> = {
  first_steps: "bronze", battle_hardened: "silver", century_wins: "gold", perfect_season: "platinum",
  tournament_winner: "silver", champion: "gold", world_champion: "gold", dynasty_begins: "platinum", volleyball_empire: "platinum",
  olympic_gold: "gold", double_olympic_gold: "platinum",
  making_money: "silver", millionaires_club: "gold", debt_free: "silver", financially_secure: "gold",
  talent_spotter: "bronze", youth_pipeline: "gold", youth_graduate: "bronze", youth_factory: "gold", future_superstar: "silver", star_factory: "gold",
  local_legend: "silver", mr_loyalty: "gold", decade_in_sand: "silver", veteran_coach: "gold", hall_of_fame: "platinum",
  world_traveller: "gold", globe_trotter: "silver", first_inductee: "silver",
};
const CABINET_ICON: Record<AchievementCategory, string> = {
  career: "trophy", competition: "crown", finance: "trending-up", youth: "sparkles", legacy: "calendar",
};

const router = Router();

router.get("/trophies/cabinet", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const userId = req.user.id;

  const team = await getActiveTeam(req);
  if (!team) return res.status(404).json({ error: "Team not found" });

  const trophies = await db
    .select()
    .from(trophiesTable)
    .where(eq(trophiesTable.teamId, team.id))
    .orderBy(desc(trophiesTable.createdAt));

  const byType = (type: string) => trophies.filter((t) => t.type === type);

  const worldChampionships       = byType("world_championship");
  const continentalChampionships = byType("continental_championship");
  const grandFinals              = byType("grand_final");
  const runnerUps                = byType("runner_up");
  const bronzes                  = byType("bronze");
  // R-42: a Silver or Gold season tier, written at the season boundary.
  const worldTourTiers           = byType("world_tour_tier");
  const continentalFinals        = byType("continental_final");
  const olympicGold              = byType("olympic_gold");
  const olympicSilver            = byType("olympic_silver");
  const olympicBronze            = byType("olympic_bronze");
  const olympicAppearances       = byType("olympic_appearance");

  const continentalFinalsByContinent: Record<string, number> = {};
  for (const t of continentalFinals) {
    if (t.continent) {
      continentalFinalsByContinent[t.continent] =
        (continentalFinalsByContinent[t.continent] ?? 0) + 1;
    }
  }



  // Item 21 (Rob, W L W L showing "4 in a row"): the streak read EVERY
  // completed match in the database, and counted a match as won when
  // "away = this club and away > home". Every fixture of the player's club has
  // the club as both home and away (the opponent is only a name), so every
  // decisive match counted as a win, and other careers' matches broke the run.
  // Now: this club's own matches, in the order they were played (season,
  // round), won when the club's side (home) took more sets.
  const clubMatches = await db
    .select()
    .from(matchesTable)
    .where(and(eq(matchesTable.homeTeamId, team.id), eq(matchesTable.status, "completed")))
    .orderBy(matchesTable.season, matchesTable.round);

  let bestStreak = 0;
  let currentStreak = 0;
  for (const m of clubMatches) {
    if ((m.homeScore ?? 0) > (m.awayScore ?? 0)) {
      currentStreak++;
      if (currentStreak > bestStreak) bestStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
  }

  // Item 21: "Most Prize Money Earned" is prize money (winner's and runner-up
  // prizes), not every income row (it was $95,150 = prizes $14,950 + sponsorship).
  const [earningsRow] = await db
    .select({
      total: sql<string>`COALESCE(SUM(CAST(amount AS NUMERIC)), 0)`,
    })
    .from(financeTransactionsTable)
    .where(and(eq(financeTransactionsTable.teamId, team.id), eq(financeTransactionsTable.type, "income"), eq(financeTransactionsTable.category, "prize_money")));

  // ACH: seasons managed is a number the game counts — one per season boundary,
  // sacking included (R-77, routes/calendar.ts) — and it is kept on the career,
  // so it survives a change of club (L-02e).
  //
  // It used to be `Math.ceil(totalMatches / 10)`: a guess from the match count,
  // with a season being ten matches. A real season is 54 to 57 played, so every
  // season-based honour on this page unlocked five or six times too early —
  // "Manage for 30 seasons" arrived in the fifth. It also could not have been
  // right for a club whose matches were forfeited, or one that changed hands.
  const seasonsManaged = (await careerStatsFor(team.id)).seasonsCompleted;

  const olympicMedalCount = olympicGold.length + olympicSilver.length + olympicBronze.length;

  // Item 21: the cabinet shows the SAME achievements as Steam and Career >
  // Achievements (ACHIEVEMENT_DEFS: 29, in their order), unlocked when the
  // game unlocked them (the achievements table, which is what Steam is told).
  // Its own 18 ("First Tournament Win", "Unstoppable", "Develop the Best",
  // "5 Seasons Managed"...) were in-game only, with rules of their own.
  const stats = await careerStatsFor(team.id);
  const unlockedKeys = new Set((await db.select({ key: achievementsTable.achievementKey }).from(achievementsTable)
    .where(eq(achievementsTable.teamId, team.id))).map((r) => r.key));
  const achievements = ACHIEVEMENT_DEFS.map((def) => {
    const { current, target } = def.progress(team, stats);
    const unlocked = unlockedKeys.has(def.key);
    return {
      id: def.key,
      title: def.name,
      description: def.description,
      icon: CABINET_ICON[def.category],
      tier: CABINET_TIER[def.key] ?? "silver",
      unlocked,
      progress: unlocked ? target : Math.min(current, target),
      target,
    };
  });

  return res.json({
    honours: {
      worldChampionships,
      continentalChampionships,
      continentalFinalsByContinent,
      grandFinals,
      runnerUps,
      bronzes,
      worldTourTiers,
    },
    olympicMedals: {
      gold: olympicGold.length,
      silver: olympicSilver.length,
      bronze: olympicBronze.length,
      appearances: olympicAppearances.length,
      hosts: olympicAppearances.map((t) => ({
        year: t.year ?? 0,
        location: t.locationName ?? "",
      })),
    },
    achievements,
    records: {
      mostTitles: team.titlesWon,
      mostWins: team.wins,
      bestWinStreak: bestStreak,
      mostPrizeMoney: earningsRow?.total ?? "0",
      seasonsManaged,
      olympicMedals: olympicMedalCount,
    },
  });
});

/*
 * GET /trophies/hall-of-fame is gone (HOF).
 *
 * It listed "retired players still at this club", sorted by a legend score —
 * a list that was always empty, because retiring a player is what takes her
 * off the club (L-02b), and a score nothing computed. The club's Hall of Fame
 * is now a table of real inductions: routes/hall-of-fame.ts.
 */

export default router;
