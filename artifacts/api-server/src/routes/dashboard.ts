import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { db } from "@workspace/db";
import { teamsTable, matchesTable, playersTable, financeTransactionsTable, seasonsTable, careerSavesTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { getGameDate } from "../utils/gameDate.js";

const router = Router();


router.get("/dashboard", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }

  const recentMatches = await db.select().from(matchesTable)
    .where(and(eq(matchesTable.homeTeamId, team.id), eq(matchesTable.status, "completed")))
    .orderBy(desc(matchesTable.createdAt)).limit(5);

  const nextMatch = await db.query.matchesTable.findFirst({
    where: and(eq(matchesTable.homeTeamId, team.id), eq(matchesTable.status, "scheduled")),
  });

  const allTx = await db.select().from(financeTransactionsTable)
    .where(eq(financeTransactionsTable.teamId, team.id));
  const balance = Number(team.budget);
  // Month filter must come from the in-game clock: finance_transactions.date
  // holds in-game dates, so a real-world month prefix never matched and
  // monthly income/expenses were always $0.
  const monthStr = (await getGameDate(team.id)).slice(0, 7);
  const monthIncome = allTx.filter(t => t.type === "income" && t.date.startsWith(monthStr)).reduce((a, t) => a + Number(t.amount), 0);
  const monthExpenses = allTx.filter(t => t.type === "expense" && t.date.startsWith(monthStr)).reduce((a, t) => a + Number(t.amount), 0);

  const players = await db.select().from(playersTable).where(eq(playersTable.teamId, team.id));
  const topPlayers = players.sort((a, b) => (b.power + b.serve + b.defense) - (a.power + a.serve + a.defense))
    .slice(0, 5).map(p => ({ ...p, height: Number(p.height), salary: Number(p.salary) }));
  const injuredCount = players.filter(p => p.isInjured).length;

  const allTeams = await db.select().from(teamsTable).orderBy(desc(teamsTable.wins)).limit(20);
  const myRank = allTeams.findIndex(t => t.id === team.id) + 1;

  // Career save: prefer session-tracked save ID (set on career creation/load),
  // fall back to teamId lookup so legacy saves still work.
  const careerSave = req.activeCareerSaveId
    ? await db.query.careerSavesTable.findFirst({
        where: and(
          eq(careerSavesTable.id, req.activeCareerSaveId),
          eq(careerSavesTable.userId, req.user!.id),
        ),
      })
    : await db.query.careerSavesTable.findFirst({
        where: eq(careerSavesTable.teamId, team.id),
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
    financeSummary: { balance, monthlyNet: monthIncome - monthExpenses },
    recentResults: recentMatches.map(m => ({
      ...m,
      prizeAmount: m.prizeAmount ? Number(m.prizeAmount) : null,
      windSpeed: m.windSpeed ? Number(m.windSpeed) : null,
      temperature: m.temperature ? Number(m.temperature) : null,
    })),
    topPlayers,
    seasonStanding: myRank > 0 ? { rank: myRank, wins: team.wins, losses: team.losses, points: team.wins * 3 } : null,
    injuredCount,
  });
});

export default router;
