import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { db } from "@workspace/db";
import {
  teamsTable,
  playersTable,
  staffTable,
  matchesTable,
  olympicSelectionsTable,
  financeTransactionsTable,
  trophiesTable,
} from "@workspace/db";
import { eq, desc, sql, and } from "drizzle-orm";

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

  const [olympicSelection] = await db
    .select()
    .from(olympicSelectionsTable)
    .where(eq(olympicSelectionsTable.userId, userId));

  const teamPlayers = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.teamId, team.id));

  const teamStaff = await db
    .select()
    .from(staffTable)
    .where(eq(staffTable.teamId, team.id));

  const completedMatches = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.status, "completed"))
    .orderBy(desc(matchesTable.createdAt));

  let bestStreak = 0;
  let currentStreak = 0;
  for (const m of completedMatches) {
    const won =
      (m.homeTeamId === team.id && (m.homeScore ?? 0) > (m.awayScore ?? 0)) ||
      (m.awayTeamId === team.id && (m.awayScore ?? 0) > (m.homeScore ?? 0));
    if (won) {
      currentStreak++;
      if (currentStreak > bestStreak) bestStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
  }

  const [earningsRow] = await db
    .select({
      total: sql<string>`COALESCE(SUM(CASE WHEN type = 'income' THEN CAST(amount AS NUMERIC) ELSE 0 END), 0)`,
    })
    .from(financeTransactionsTable)
    .where(eq(financeTransactionsTable.teamId, team.id));

  const totalMatches = completedMatches.filter(
    (m) => m.homeTeamId === team.id || m.awayTeamId === team.id,
  ).length;
  const seasonsManaged = Math.max(1, Math.ceil(totalMatches / 10));

  const generationalOnTeam = teamPlayers.filter((p) => p.potential === "Generational");
  const scoutedPlayers      = teamPlayers.filter((p) => p.scoutedPotential != null);
  const eliteStaff          = teamStaff.filter((s) => s.overallRating >= 90);
  const highOvrPlayers      = teamPlayers.filter(
    (p) => Math.round((p.power + p.speed + p.defense + p.serve + p.block) / 5) >= 85,
  );

  const olympicMedalCount = olympicGold.length + olympicSilver.length + olympicBronze.length;

  const achievements = [
    {
      id: "first_win",
      title: "First Tournament Win",
      description: "Win your first match",
      icon: "trophy",
      tier: "bronze",
      unlocked: team.wins > 0,
      progress: Math.min(1, team.wins),
      target: 1,
    },
    {
      id: "five_wins",
      title: "On a Roll",
      description: "Win 5 matches",
      icon: "zap",
      tier: "bronze",
      unlocked: team.wins >= 5,
      progress: Math.min(5, team.wins),
      target: 5,
    },
    {
      id: "winning_streak_5",
      title: "Unstoppable",
      description: "Win 5 consecutive matches",
      icon: "flame",
      tier: "silver",
      unlocked: bestStreak >= 5,
      progress: Math.min(5, bestStreak),
      target: 5,
    },
    {
      id: "first_continental",
      title: "First Continental Title",
      description: "Win a continental championship",
      icon: "globe",
      tier: "silver",
      unlocked: continentalChampionships.length > 0,
      progress: Math.min(1, continentalChampionships.length),
      target: 1,
    },
    {
      id: "first_world",
      title: "First World Championship",
      description: "Win a World Tour Championship",
      icon: "star",
      tier: "gold",
      unlocked: worldChampionships.length > 0,
      progress: Math.min(1, worldChampionships.length),
      target: 1,
    },
    {
      id: "dynasty",
      title: "Dynasty",
      description: "Win 3 major titles (Continental or World)",
      icon: "crown",
      tier: "gold",
      unlocked: worldChampionships.length + continentalChampionships.length >= 3,
      progress: Math.min(3, worldChampionships.length + continentalChampionships.length),
      target: 3,
    },
    {
      id: "olympic_qual",
      title: "Olympic Qualification",
      description: "Qualify for the Olympics as a national coach",
      icon: "medal",
      tier: "gold",
      unlocked: !!olympicSelection,
      progress: olympicSelection ? 1 : 0,
      target: 1,
    },
    {
      id: "olympic_medal",
      title: "Olympic Medal",
      description: "Win any Olympic medal",
      icon: "award",
      tier: "gold",
      unlocked: olympicMedalCount > 0,
      progress: Math.min(1, olympicMedalCount),
      target: 1,
    },
    {
      id: "olympic_gold",
      title: "Olympic Gold",
      description: "Win the Olympic gold medal",
      icon: "star",
      tier: "platinum",
      unlocked: olympicGold.length > 0,
      progress: Math.min(1, olympicGold.length),
      target: 1,
    },
    {
      id: "develop_olympic_champ",
      title: "Develop an Olympic Champion",
      description: "Win Olympic gold with a player you coached",
      icon: "star",
      tier: "platinum",
      unlocked: olympicGold.length > 0 && teamPlayers.length > 0,
      progress: olympicGold.length > 0 && teamPlayers.length > 0 ? 1 : 0,
      target: 1,
    },
    {
      id: "seasons_5",
      title: "5 Seasons Managed",
      description: "Manage for 5 seasons",
      icon: "calendar",
      tier: "bronze",
      unlocked: seasonsManaged >= 5,
      progress: Math.min(5, seasonsManaged),
      target: 5,
    },
    {
      id: "seasons_10",
      title: "10 Seasons Managed",
      description: "Manage for 10 seasons",
      icon: "calendar",
      tier: "silver",
      unlocked: seasonsManaged >= 10,
      progress: Math.min(10, seasonsManaged),
      target: 10,
    },
    {
      id: "seasons_20_town",
      title: "20 Seasons In One Town",
      description: "Stay with the same home location for 20 seasons",
      icon: "home",
      tier: "gold",
      unlocked: seasonsManaged >= 20 && !!team.locationId,
      progress: Math.min(20, seasonsManaged),
      target: 20,
    },
    {
      id: "seasons_30",
      title: "30 Season Legend",
      description: "Manage for 30 seasons — a true legend",
      icon: "flame",
      tier: "platinum",
      unlocked: seasonsManaged >= 30,
      progress: Math.min(30, seasonsManaged),
      target: 30,
    },
    {
      id: "high_ovr",
      title: "Develop the Best",
      description: "Have a player reach 85+ OVR on your team",
      icon: "trending-up",
      tier: "silver",
      unlocked: highOvrPlayers.length > 0,
      progress: Math.min(1, highOvrPlayers.length),
      target: 1,
    },
    {
      id: "generational_talent",
      title: "Sign a Generational Talent",
      description: "Have a Generational potential player on your roster",
      icon: "sparkles",
      tier: "gold",
      unlocked: generationalOnTeam.length > 0,
      progress: Math.min(1, generationalOnTeam.length),
      target: 1,
    },
    {
      id: "hidden_gem",
      title: "Discover a Hidden Gem",
      description: "Scout a player and reveal their potential",
      icon: "search",
      tier: "bronze",
      unlocked: scoutedPlayers.length > 0,
      progress: Math.min(1, scoutedPlayers.length),
      target: 1,
    },
    {
      id: "elite_staff",
      title: "Hire Elite Staff",
      description: "Have a staff member with 90+ overall rating",
      icon: "user-check",
      tier: "gold",
      unlocked: eliteStaff.length > 0,
      progress: Math.min(1, eliteStaff.length),
      target: 1,
    },
  ];

  return res.json({
    honours: {
      worldChampionships,
      continentalChampionships,
      continentalFinalsByContinent,
      grandFinals,
      runnerUps,
      bronzes,
    },
    olympicMedals: {
      gold: olympicGold.length,
      silver: olympicSilver.length,
      bronze: olympicBronze.length,
      appearances: olympicAppearances.length + (olympicSelection ? 1 : 0),
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

router.get("/trophies/hall-of-fame", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });

  const team = await getActiveTeam(req);
  if (!team) return res.status(404).json({ error: "Team not found" });

  const retired = await db
    .select()
    .from(playersTable)
    .where(and(eq(playersTable.teamId, team.id), eq(playersTable.isRetired, true)))
    .orderBy(desc(playersTable.legendScore));

  return res.json(
    retired.map((p) => ({
      id: p.id,
      name: p.name,
      nationality: p.nationality,
      position: p.position,
      imageUrl: p.imageUrl ?? null,
      peakOverallRating: p.peakOverallRating ?? 0,
      careerSeasons: p.careerSeasons ?? 1,
      careerWins: p.careerWins ?? 0,
      careerTitles: p.careerTitles ?? 0,
      continentalTitles: p.continentalTitles ?? 0,
      worldTitles: p.worldTitles ?? 0,
      olympicMedalsCount: p.olympicMedalsCount ?? 0,
      retiredSeasonYear: p.retiredSeasonYear ?? null,
      yearsActive: p.yearsActive ?? null,
      legendScore: p.legendScore ?? 0,
    })),
  );
});

export default router;
