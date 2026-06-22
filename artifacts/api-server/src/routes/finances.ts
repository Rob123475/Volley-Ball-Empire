import { Router } from "express";
import { db } from "@workspace/db";
import { financeTransactionsTable, promoDealsTable, teamsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

const serializeTx = (t: any) => ({ ...t, amount: Number(t.amount) });
const serializeDeal = (d: any) => ({ ...d, amount: Number(d.amount) });

const getTeamForUser = async (userId: string) => {
  return db.query.teamsTable.findFirst({ where: eq(teamsTable.userId, userId) });
};

router.get("/finances", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.json([]); return; }
  const txs = await db.select().from(financeTransactionsTable)
    .where(eq(financeTransactionsTable.teamId, team.id))
    .orderBy(desc(financeTransactionsTable.createdAt)).limit(100);
  res.json(txs.map(serializeTx));
});

router.post("/finances", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const { type, amount, description, category, date } = req.body;
  const [tx] = await db.insert(financeTransactionsTable).values({
    teamId: team.id, type, amount: String(amount), description, category, date,
  }).returning();
  res.status(201).json(serializeTx(tx));
});

router.get("/finances/summary", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) {
    res.json({ totalBalance: 0, totalIncome: 0, totalExpenses: 0, monthlyIncome: 0, monthlyExpenses: 0, incomeSources: { prizeMoney: 0, sponsorships: 0, promoDeals: 0 }, expenseBreakdown: { playerSalaries: 0, staffSalaries: 0, trainingCosts: 0, other: 0 }, recentTransactions: [] });
    return;
  }
  const txs = await db.select().from(financeTransactionsTable)
    .where(eq(financeTransactionsTable.teamId, team.id))
    .orderBy(desc(financeTransactionsTable.createdAt));

  const income = txs.filter(t => t.type === "income");
  const expenses = txs.filter(t => t.type === "expense");
  const totalIncome = income.reduce((acc, t) => acc + Number(t.amount), 0);
  const totalExpenses = expenses.reduce((acc, t) => acc + Number(t.amount), 0);

  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthIncome = income.filter(t => t.date.startsWith(monthStr)).reduce((acc, t) => acc + Number(t.amount), 0);
  const monthExpenses = expenses.filter(t => t.date.startsWith(monthStr)).reduce((acc, t) => acc + Number(t.amount), 0);

  res.json({
    totalBalance: Number(team.budget),
    totalIncome,
    totalExpenses,
    monthlyIncome: monthIncome,
    monthlyExpenses: monthExpenses,
    incomeSources: {
      prizeMoney: income.filter(t => t.category === "prize_money").reduce((acc, t) => acc + Number(t.amount), 0),
      sponsorships: income.filter(t => t.category === "sponsorship").reduce((acc, t) => acc + Number(t.amount), 0),
      promoDeals: income.filter(t => t.category === "promo_deal").reduce((acc, t) => acc + Number(t.amount), 0),
    },
    expenseBreakdown: {
      playerSalaries: expenses.filter(t => t.category === "player_salary").reduce((acc, t) => acc + Number(t.amount), 0),
      staffSalaries: expenses.filter(t => t.category === "staff_salary").reduce((acc, t) => acc + Number(t.amount), 0),
      trainingCosts: expenses.filter(t => t.category === "training_cost").reduce((acc, t) => acc + Number(t.amount), 0),
      other: expenses.filter(t => !["player_salary","staff_salary","training_cost"].includes(t.category)).reduce((acc, t) => acc + Number(t.amount), 0),
    },
    recentTransactions: txs.slice(0, 10).map(serializeTx),
  });
});

router.get("/finances/sponsor-progress", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.json([]); return; }

  const deals = await db.select().from(promoDealsTable)
    .where(and(eq(promoDealsTable.teamId, team.id), eq(promoDealsTable.isAccepted, true)));

  const currentWins = team.wins;

  res.json(deals.map(d => ({
    id: d.id,
    sponsor: d.sponsor,
    description: d.description,
    amount: Number(d.amount),
    requirementWins: d.requirementWins,
    expiresAt: d.expiresAt,
    imageUrl: d.imageUrl,
    currentWins,
    progressPct: d.requirementWins > 0
      ? Math.min(100, Math.round((currentWins / d.requirementWins) * 100))
      : 100,
    isComplete: currentWins >= d.requirementWins,
  })));
});

router.get("/finances/promo-deals", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  const deals = await db.select().from(promoDealsTable)
    .where(and(eq(promoDealsTable.isGlobal, true), eq(promoDealsTable.isAccepted, false)));
  res.json(deals.map(serializeDeal));
});

router.post("/finances/promo-deals/:id/accept", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const id = parseInt(req.params.id);
  const deal = await db.query.promoDealsTable.findFirst({ where: eq(promoDealsTable.id, id) });
  if (!deal) { res.status(404).json({ error: "Deal not found" }); return; }

  await db.update(promoDealsTable).set({ isAccepted: true, teamId: team.id }).where(eq(promoDealsTable.id, id));
  const today = new Date().toISOString().split("T")[0];
  const [tx] = await db.insert(financeTransactionsTable).values({
    teamId: team.id,
    type: "income",
    amount: deal.amount,
    description: `Promo deal: ${deal.sponsor}`,
    category: "promo_deal",
    date: today,
  }).returning();
  await db.update(teamsTable).set({ budget: String(Number(team.budget) + Number(deal.amount)) }).where(eq(teamsTable.id, team.id));

  res.json(serializeTx(tx));
});

export default router;
