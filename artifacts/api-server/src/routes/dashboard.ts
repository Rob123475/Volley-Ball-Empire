import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { db } from "@workspace/db";
import { matchesTable, financeTransactionsTable, careerSavesTable, competitorRankingsTable, competitorsTable } from "@workspace/db";
import { eq, desc, and, asc, gte } from "drizzle-orm";
import { getGameDate } from "../utils/gameDate.js";
import { getActiveSeasonForCareer } from "../lib/getActiveSeason.js";
import { loadPlayers, requireCareerSaveId } from "../lib/playerDto.js";
import { ensureSeasonFixture } from "./matches.js";
import { ensureCompetitorRanking } from "../utils/competitors.js";
import { worldTourStandings, BYE } from "../utils/worldTour.js";
import { selectPair, isAvailable, fitnessFactor, PAIR_SIZE } from "../utils/condition.js";

const router = Router();


router.get("/dashboard", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const cid = requireCareerSaveId(req.activeCareerSaveId);

  // R-26: a career could reach the dashboard with zero matches — fixture
  // generation was only ever triggered by the Fixtures page. POST /careers
  // now generates it eagerly for new careers; this call is the repair net
  // for any career (like ones created before this fix) that still doesn't
  // have one — idempotent, returns immediately once the fixture exists.
  const activeSeason = await getActiveSeasonForCareer(cid);
  if (activeSeason) {
    await ensureSeasonFixture(team, activeSeason.year);
    // Same repair net for the ladder — see utils/competitors.ts.
    await ensureCompetitorRanking(team.id, cid, activeSeason.year);
  }

  const recentMatches = await db.select().from(matchesTable)
    .where(and(eq(matchesTable.homeTeamId, team.id), eq(matchesTable.status, "completed")))
    .orderBy(desc(matchesTable.createdAt)).limit(5);

  // Ordered by round: with no order, findFirst returned whichever row SQLite
  // handed back first, which only matched round order by accident.
  const nextMatch = await db.query.matchesTable.findFirst({
    where: and(eq(matchesTable.homeTeamId, team.id), eq(matchesTable.status, "scheduled")),
    orderBy: [asc(matchesTable.round)],
  });

  // R-44: the club's next World Tour round may be a bye. It is the next thing on
  // the card only if it has not passed and comes before the next real match.
  const nextByeRow = activeSeason
    ? (await db.select().from(matchesTable).where(and(
        eq(matchesTable.homeTeamId, team.id),
        eq(matchesTable.season, activeSeason.year),
        eq(matchesTable.status, BYE),
        gte(matchesTable.round, activeSeason.currentRound),
      )).orderBy(asc(matchesTable.round)).limit(1))[0] ?? null
    : null;
  const nextBye = nextByeRow && (!nextMatch || nextByeRow.round < nextMatch.round)
    ? { round: nextByeRow.round, scheduledAt: nextByeRow.scheduledAt, locationName: nextByeRow.locationName }
    : null;

  const allTx = await db.select().from(financeTransactionsTable)
    .where(eq(financeTransactionsTable.teamId, team.id));
  const balance = Number(team.budget);
  // Month filter must come from the in-game clock: finance_transactions.date
  // holds in-game dates, so a real-world month prefix never matched and
  // monthly income/expenses were always $0.
  const monthStr = (await getGameDate(team.id)).slice(0, 7);
  const monthIncome = allTx.filter(t => t.type === "income" && t.date.startsWith(monthStr)).reduce((a, t) => a + Number(t.amount), 0);
  const monthExpenses = allTx.filter(t => t.type === "expense" && t.date.startsWith(monthStr)).reduce((a, t) => a + Number(t.amount), 0);

  const players = await loadPlayers(cid, { teamId: team.id });
  const topPlayers = players.sort((a, b) => (b.power + b.serve + b.defense) - (a.power + a.serve + a.defense))
    .slice(0, 5).map(p => ({ ...p, height: Number(p.height), salary: Number(p.salary) }));
  const injuredCount = players.filter(p => p.isInjured).length;

  // R-50: who would take the court for the next match, how fit they are, and
  // who cannot be selected — the same selection /simulate will make.
  const nextPair = nextMatch
    ? selectPair(players, Array.isArray(nextMatch.lineup) ? (nextMatch.lineup as number[]) : [])
    : [];
  const nextMatchSelection = nextMatch ? {
    players: nextPair.map((p) => ({
      id: p.id, name: p.name, fitness: p.fitness, contribution: Math.round(fitnessFactor(p.fitness) * 100),
    })),
    unavailable: players.filter((p) => p.isActive && !isAvailable(p)).map((p) => ({
      id: p.id, name: p.name, injuryStatus: p.injuryStatus, weeksOut: Math.ceil(Number(p.injuryWeeksRemaining ?? 0)),
    })),
    willForfeit: nextPair.length < PAIR_SIZE,
  } : null;

  // R-20: this used to rank against every team in the whole table with no
  // filter at all — other profiles' teams, live or retired. Excluding
  // retired careers was not enough: a rank compared against a career you are
  // not even playing is not a rank. Rank now comes from competitor_rankings,
  // the same source and the same (career_save_id, season_year) scope as the
  // season ladder — this career's own standing, nothing else's.
  // R-29: rank within this career's own World Tour standings — the same
  // function the ladder reads, so the two can never disagree about position.
  const hasPlayed = (team.wins ?? 0) + (team.losses ?? 0) > 0;
  const myStanding = hasPlayed && activeSeason
    ? worldTourStandings(cid, activeSeason.year).find((s) => s.teamId === team.id) ?? null
    : null;
  const myRank = myStanding?.rank ?? 0;

  // Career save: the session-tracked save ID is the only source of truth —
  // R-20 removed the fallback that looked a career up by teamId when it was
  // missing, which could return a DIFFERENT career for the same team (a team
  // can be resigned from and re-taken across saves) or silently guess. A
  // request with no activeCareerSaveId genuinely has no active career.
  const careerSave = await db.query.careerSavesTable.findFirst({
    where: and(
      eq(careerSavesTable.id, cid),
      eq(careerSavesTable.userId, req.user!.id),
    ),
  });

  // Resolved display name: career-save club name is authoritative (handles custom
  // names entered during career creation). Fall back to team.name in the DB.
  const clubDisplayName  = careerSave?.clubName ?? team.name;
  const managerDisplayName = careerSave?.managerName ?? null;
  const userDisplayName  = (req.user as any)?.name ?? null;

  res.json({
    team: { ...team, budget: Number(team.budget) },
    clubName:        clubDisplayName,
    managerName:     managerDisplayName,
    userDisplayName: userDisplayName,
    nextMatch: nextMatch ? {
      ...nextMatch,
      prizeAmount: nextMatch.prizeAmount ? Number(nextMatch.prizeAmount) : null,
      windSpeed: nextMatch.windSpeed ? Number(nextMatch.windSpeed) : null,
      temperature: nextMatch.temperature ? Number(nextMatch.temperature) : null,
    } : null,
    nextBye,
    nextMatchSelection,
    financeSummary: { balance, monthlyNet: monthIncome - monthExpenses },
    recentResults: recentMatches.map(m => ({
      ...m,
      prizeAmount: m.prizeAmount ? Number(m.prizeAmount) : null,
      windSpeed: m.windSpeed ? Number(m.windSpeed) : null,
      temperature: m.temperature ? Number(m.temperature) : null,
    })),
    topPlayers,
    // R-29: this season's real standing; points were `team.wins * 3`, a number
    // no table in the game awards.
    seasonStanding: myStanding
      ? { rank: myStanding.rank, wins: myStanding.wins, losses: myStanding.losses, points: myStanding.points }
      : null,
    injuredCount,
  });
});

export default router;
