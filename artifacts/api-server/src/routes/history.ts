import { Router } from "express";
import { db } from "@workspace/db";
import {
  teamsTable,
  seasonsTable,
  trophiesTable,
  seasonFinalStandingsTable,
  managerSeasonSummaryTable,
  hallOfFameTable,
  matchesTable,
  playersTable,
} from "@workspace/db";
import { eq, and, desc, asc } from "drizzle-orm";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { loadPlayers, requireCareerSaveId } from "../lib/playerDto.js";
import { careerStatsFor } from "../utils/check-achievements.js";

const router = Router();

// ── GET /history/seasons ─────────────────────────────────────────────────────
router.get("/history/seasons", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const seasons = await db
    .select()
    .from(seasonsTable)
    .orderBy(asc(seasonsTable.year));

  res.json(
    seasons.map((s) => ({
      id: s.id,
      year: s.year,
      name: s.name,
      status: s.status,
    })),
  );
});

// ── GET /history/seasons/:year/standings ─────────────────────────────────────
router.get("/history/seasons/:year/standings", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  const year = parseInt(req.params.year, 10);
  if (isNaN(year)) { res.status(400).json({ error: "Invalid year" }); return; }

  const seniorRows = await db
    .select()
    .from(seasonFinalStandingsTable)
    .where(
      and(
        eq(seasonFinalStandingsTable.teamId, team.id),
        eq(seasonFinalStandingsTable.seasonYear, year),
      ),
    )
    .orderBy(asc(seasonFinalStandingsTable.rank));

  const hasSnapshot = seniorRows.length > 0;

  res.json({
    seniors: seniorRows.map((r) => ({
      rank: r.rank,
      competitorName: r.competitorName,
      isPlayer: r.isPlayer,
      wins: r.wins,
      losses: r.losses,
      points: r.points,
      setDiff: r.setDiff,
    })),
    hasSnapshot,
  });
});

// ── GET /history/seasons/:year/summary ───────────────────────────────────────
router.get("/history/seasons/:year/summary", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  const year = parseInt(req.params.year, 10);
  if (isNaN(year)) { res.status(400).json({ error: "Invalid year" }); return; }

  const trophies = await db
    .select()
    .from(trophiesTable)
    .where(and(eq(trophiesTable.teamId, team.id), eq(trophiesTable.year, year)));

  const [managerRow] = await db
    .select()
    .from(managerSeasonSummaryTable)
    .where(
      and(
        eq(managerSeasonSummaryTable.userId, req.user.id),
        eq(managerSeasonSummaryTable.seasonYear, year),
      ),
    );

  const byType = (type: string) => trophies.find((t) => t.type === type);

  let worldResult: string | null =
    byType("world_championship") ? "World Champion 🏆"
    : byType("runner_up")       ? "Runner Up 🥈"
    : byType("bronze")          ? "World Finals semi-finalist 🥉"
    : byType("grand_final")     ? "4th Place 🏅"
    : (managerRow?.worldResult ?? null);

  let continentalResult: string | null =
    byType("continental_championship") ? "Continental Champion"
    : byType("continental_final")      ? "Continental Finalist"
    : (managerRow?.continentalResult ?? null);

  res.json({
    year,
    trophies: trophies.map((t) => ({
      type: t.type,
      name: t.name,
      continent: t.continent ?? null,
      locationName: t.locationName ?? null,
    })),
    worldResult,
    continentalResult,
    wins: managerRow?.wins ?? 0,
    losses: managerRow?.losses ?? 0,
    leaguePosition: managerRow?.leaguePosition ?? null,
    budgetSnapshot: managerRow?.budgetSnapshot
      ? Number(managerRow.budgetSnapshot)
      : null,
  });
});

// ── GET /history/records ─────────────────────────────────────────────────────
router.get("/history/records", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  const trophies = await db
    .select()
    .from(trophiesTable)
    .where(eq(trophiesTable.teamId, team.id));

  const byType = (type: string) => trophies.filter((t) => t.type === type);

  const completedMatches = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.status, "completed"))
    .orderBy(asc(matchesTable.createdAt));

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

  const myMatches = completedMatches.filter(
    (m) => m.homeTeamId === team.id || m.awayTeamId === team.id,
  );
  const myWins = myMatches.filter(
    (m) =>
      (m.homeTeamId === team.id && (m.homeScore ?? 0) > (m.awayScore ?? 0)) ||
      (m.awayTeamId === team.id && (m.awayScore ?? 0) > (m.homeScore ?? 0)),
  ).length;
  const totalMatches = myMatches.length;
  const winRate = totalMatches > 0 ? Math.round((myWins / totalMatches) * 100) : 0;

  // ACH moved the manager's record onto the career save, because a manager can
  // now change clubs. `teams.career_stats` has not been written since: read
  // here it showed a career that has completed nine seasons as having completed
  // none.
  const cs = await careerStatsFor(team.id);
  res.json({
    worldChampionships: byType("world_championship").length,
    continentalTitles: byType("continental_championship").length,
    olympicGolds: byType("olympic_gold").length,
    totalWins: team.wins,
    totalLosses: team.losses,
    winRate,
    bestStreak,
    seasonsCompleted: cs.seasonsCompleted,
    perfectSeasons: cs.perfectSeasons,
    highestBalance: cs.highestBalanceReached,
  });
});

// ── GET /history/manager-seasons ─────────────────────────────────────────────
router.get("/history/manager-seasons", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select()
    .from(managerSeasonSummaryTable)
    .where(eq(managerSeasonSummaryTable.userId, req.user.id))
    .orderBy(asc(managerSeasonSummaryTable.seasonYear));

  res.json(
    rows.map((r) => ({
      seasonYear: r.seasonYear,
      clubName: r.clubName,
      leaguePosition: r.leaguePosition ?? null,
      wins: r.wins,
      losses: r.losses,
      budgetSnapshot: r.budgetSnapshot ? Number(r.budgetSnapshot) : null,
      worldResult: r.worldResult ?? null,
      continentalResult: r.continentalResult ?? null,
    })),
  );
});

// ── GET /history/hall-of-fame ─────────────────────────────────────────────────
router.get("/history/hall-of-fame", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  const retiredPlayers = (await loadPlayers(requireCareerSaveId(req.activeCareerSaveId), { teamId: team.id, includeRetired: true }))
    .filter((p) => p.isRetired)
    .sort((a, b) => (b.legendScore ?? 0) - (a.legendScore ?? 0));

  const managerEntries = await db
    .select()
    .from(hallOfFameTable)
    .where(eq(hallOfFameTable.userId, req.user.id))
    .orderBy(desc(hallOfFameTable.worldTitles));

  // The club's titles, which is what this column has always shown against each
  // of its retired players. Read from the career save since ACH moved the
  // manager's record there; `teams.career_stats` is no longer written.
  const hofStats = await careerStatsFor(team.id);

  res.json({
    players: retiredPlayers.slice(0, 20).map((p) => ({
      id: p.id,
      name: p.name,
      position: p.position,
      peakRating: Math.round((p.power + p.speed + p.defense + p.serve + p.block) / 5),
      worldTitles: hofStats.championshipsWon,
      careerWins: team.wins,
      retiredSeason: "Retired",
    })),
    managerEntries: managerEntries.map((e) => ({
      managerName: e.managerName,
      clubName: e.clubName,
      worldTitles: e.worldTitles,
      olympicMedals: e.olympicMedals,
      totalWins: e.totalWins,
      totalLosses: e.totalLosses,
      season: e.season,
    })),
  });
});

export default router;
