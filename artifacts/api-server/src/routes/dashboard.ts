import { Router } from "express";
import { db } from "@workspace/db";
import { teamsTable, matchesTable, playersTable, financeTransactionsTable, seasonsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

const getTeamForUser = async (userId: string) => {
  return db.query.teamsTable.findFirst({ where: eq(teamsTable.userId, userId) });
};

router.get("/dashboard", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
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
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthIncome = allTx.filter(t => t.type === "income" && t.date.startsWith(monthStr)).reduce((a, t) => a + Number(t.amount), 0);
  const monthExpenses = allTx.filter(t => t.type === "expense" && t.date.startsWith(monthStr)).reduce((a, t) => a + Number(t.amount), 0);

  const players = await db.select().from(playersTable).where(eq(playersTable.teamId, team.id));
  const topPlayers = players.sort((a, b) => (b.power + b.serve + b.defense) - (a.power + a.serve + a.defense))
    .slice(0, 5).map(p => ({ ...p, height: Number(p.height), salary: Number(p.salary) }));

  const allTeams = await db.select().from(teamsTable).orderBy(desc(teamsTable.wins)).limit(20);
  const myRank = allTeams.findIndex(t => t.id === team.id) + 1;

  res.json({
    team: { ...team, budget: Number(team.budget) },
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
  });
});

export default router;
