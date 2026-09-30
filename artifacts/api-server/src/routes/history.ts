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
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { careerSavesTable, financeTransactionsTable } from "@workspace/db";
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

  // Overnight 30 Sep item 1: the MANAGER's record (Career > Records), not the
  // club's honours (those are the Trophy Cabinet, under Club). It used to
  // count every completed match in the database, other careers' too, and read
  // every decisive match as a win (the fixture has the club as both home and
  // away), the same fault the Trophy Cabinet had until 29 Sep.
  const careerSaveId = requireCareerSaveId(req.activeCareerSaveId);
  const [save] = await db.select().from(careerSavesTable).where(eq(careerSavesTable.id, careerSaveId)).limit(1);
  // The clubs this manager has run in this career: the one now, and the one
  // before a change of club (L-02e), while the save still names it.
  const teamIds = [...new Set([team.id, save?.formerTeamId].filter((x): x is number => x != null))];
  const clubs = await db.select({ id: teamsTable.id, name: teamsTable.name }).from(teamsTable).where(inArray(teamsTable.id, teamIds));

  const matches = await db.select().from(matchesTable)
    .where(and(inArray(matchesTable.homeTeamId, teamIds), eq(matchesTable.status, "completed")))
    .orderBy(asc(matchesTable.season), asc(matchesTable.round));
  let wins = 0, bestStreak = 0, run = 0;
  for (const m of matches) {
    // The club is the home side of every one of its fixtures; a forfeit is 0-2.
    if ((m.homeScore ?? 0) > (m.awayScore ?? 0)) { wins++; run++; bestStreak = Math.max(bestStreak, run); }
    else run = 0;
  }
  const losses = matches.length - wins;

  const cs = await careerStatsFor(team.id);
  const seasons = await db.select().from(managerSeasonSummaryTable)
    .where(and(eq(managerSeasonSummaryTable.userId, req.user.id), inArray(managerSeasonSummaryTable.teamId, teamIds)))
    .orderBy(asc(managerSeasonSummaryTable.seasonYear));
  const finishes = seasons.map((s) => s.leaguePosition).filter((x): x is number => x != null);
  const prizeRows = await db.select({ amount: financeTransactionsTable.amount }).from(financeTransactionsTable)
    .where(and(inArray(financeTransactionsTable.teamId, teamIds), eq(financeTransactionsTable.type, "income"), eq(financeTransactionsTable.category, "prize_money")));
  const olympicGolds = (await db.select({ id: trophiesTable.id }).from(trophiesTable)
    .where(and(inArray(trophiesTable.teamId, teamIds), eq(trophiesTable.type, "olympic_gold")))).length;

  res.json({
    managerName:        save?.managerName ?? null,
    clubs:              clubs.map((c) => c.name),
    seasonsCompleted:   cs.seasonsCompleted,
    matches:            matches.length,
    wins,
    losses,
    winRate:            matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0,
    bestStreak,
    currentStreak:      run,
    worldFinalsWon:     cs.championshipsWon,
    goldEventsWon:      cs.goldEventsWon,
    perfectSeasons:     cs.perfectSeasons,
    olympicGolds,
    prizeMoneyWon:      prizeRows.reduce((a, r) => a + Math.abs(Number(r.amount)), 0),
    bestFinish:         finishes.length > 0 ? Math.min(...finishes) : null,
    youthSigned:        cs.youthSigned,
    youthPromoted:      cs.youthPromoted,
    hallOfFameInductions: cs.hallOfFameInductions,
    highestBalance:     cs.highestBalanceReached,
    seasons: seasons.map((s) => ({
      seasonYear: s.seasonYear, clubName: s.clubName, leaguePosition: s.leaguePosition ?? null,
      wins: s.wins, losses: s.losses, worldResult: s.worldResult ?? null,
    })),
  });
});

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
