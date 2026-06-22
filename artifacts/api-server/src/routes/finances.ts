import { Router } from "express";
import { db } from "@workspace/db";
import { financeTransactionsTable, matchesTable, playersTable, promoDealsTable, staffTable, teamsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

/* ── Sponsor reputation helper ──────────────────────────────── */

function scoreSponsorReputation(score: number): { label: string; stars: number } {
  if (score <= 20) return { label: "Poor",       stars: 1 };
  if (score <= 40) return { label: "Developing", stars: 2 };
  if (score <= 60) return { label: "Reliable",   stars: 3 };
  if (score <= 80) return { label: "Attractive", stars: 4 };
  return               { label: "Elite",       stars: 5 };
}

/* ── Player salary helpers ──────────────────────────────────── */

type PlayerTier = "Rookie" | "Developing Player" | "Regular Player" | "Star Player" | "Elite Player";

const WEEKLY_SALARY: Record<PlayerTier, number> = {
  "Rookie":          400,
  "Developing Player": 900,
  "Regular Player":  1_500,
  "Star Player":     3_000,
  "Elite Player":    4_500,
};

function getPlayerTier(overallRating: number): PlayerTier {
  if (overallRating >= 85) return "Elite Player";
  if (overallRating >= 70) return "Star Player";
  if (overallRating >= 55) return "Regular Player";
  if (overallRating >= 40) return "Developing Player";
  return "Rookie";
}

const WEEKS_PER_MONTH = 52 / 12;

async function computeStaffWageBill(teamId: number) {
  const staff = await db.select().from(staffTable).where(eq(staffTable.teamId, teamId));
  const roster = staff.map(s => ({
    id:           s.id,
    name:         s.name,
    role:         s.role,
    weeklySalary: Number(s.salary),
  }));
  const weeklyWages  = roster.reduce((sum, s) => sum + s.weeklySalary, 0);
  const monthlyWages = Math.round(weeklyWages * WEEKS_PER_MONTH);
  return { weeklyWages, monthlyWages, staffCount: roster.length, staff: roster };
}

async function computeWageBill(teamId: number) {
  const players = await db.select().from(playersTable).where(eq(playersTable.teamId, teamId));
  // Exclude youth academy players (age 14–18, reserve role) — they have a separate wage system
  const seniorPlayers = players.filter(p => !(p.age >= 14 && p.age <= 18 && p.squadRole === "reserve"));
  const roster = seniorPlayers.map(p => {
    const tier       = getPlayerTier(p.overallRating);
    const weeklySalary = WEEKLY_SALARY[tier];
    return { id: p.id, name: p.name, tier, weeklySalary };
  });
  const weeklyWages  = roster.reduce((s, p) => s + p.weeklySalary, 0);
  const monthlyWages = Math.round(weeklyWages * WEEKS_PER_MONTH);
  return { weeklyWages, monthlyWages, playerCount: roster.length, players: roster };
}

const YOUTH_WEEKLY_WAGE: Record<string, number> = {
  Low: 50, Average: 75, High: 100, Elite: 150, Generational: 250,
};

async function computeYouthWageBill(teamId: number) {
  const players = await db.select().from(playersTable).where(eq(playersTable.teamId, teamId));
  const youthPlayers = players.filter(p => p.age >= 14 && p.age <= 18 && p.squadRole === "reserve" && !p.isRetired);
  const roster = youthPlayers.map(p => ({
    id:           p.id,
    name:         p.name,
    potential:    p.potential,
    weeklySalary: YOUTH_WEEKLY_WAGE[p.potential] ?? 75,
  }));
  const weeklyWages  = roster.reduce((s, p) => s + p.weeklySalary, 0);
  const monthlyWages = Math.round(weeklyWages * WEEKS_PER_MONTH);
  return { weeklyWages, monthlyWages, playerCount: roster.length, players: roster };
}

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

  const [wageBill, staffWageBill, youthWageBill] = await Promise.all([
    computeWageBill(team.id),
    computeStaffWageBill(team.id),
    computeYouthWageBill(team.id),
  ]);
  const txPlayerSalaries = expenses.filter(t => t.category === "player_salary").reduce((acc, t) => acc + Number(t.amount), 0);
  const txStaffSalaries  = expenses.filter(t => t.category === "staff_salary").reduce((acc, t) => acc + Number(t.amount), 0);

  res.json({
    totalBalance: Number(team.budget),
    totalIncome,
    totalExpenses,
    monthlyIncome: monthIncome,
    monthlyExpenses: monthExpenses + wageBill.monthlyWages + staffWageBill.monthlyWages + youthWageBill.monthlyWages,
    incomeSources: {
      prizeMoney: income.filter(t => t.category === "prize_money").reduce((acc, t) => acc + Number(t.amount), 0),
      sponsorships: income.filter(t => t.category === "sponsorship").reduce((acc, t) => acc + Number(t.amount), 0),
      promoDeals: income.filter(t => t.category === "promo_deal").reduce((acc, t) => acc + Number(t.amount), 0),
    },
    expenseBreakdown: {
      playerSalaries: txPlayerSalaries + wageBill.monthlyWages + youthWageBill.monthlyWages,
      staffSalaries: txStaffSalaries + staffWageBill.monthlyWages,
      trainingCosts: expenses.filter(t => t.category === "training_cost").reduce((acc, t) => acc + Number(t.amount), 0),
      other: expenses.filter(t => !["player_salary","staff_salary","training_cost"].includes(t.category)).reduce((acc, t) => acc + Number(t.amount), 0),
    },
    recentTransactions: txs.slice(0, 10).map(serializeTx),
  });
});

router.get("/finances/wage-bill", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.json({ weeklyWages: 0, monthlyWages: 0, playerCount: 0, players: [] }); return; }
  res.json(await computeWageBill(team.id));
});

router.get("/finances/sponsor-reputation", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  const score = team ? Math.min(100, Math.max(0, team.sponsorReputation ?? 50)) : 50;
  const { label, stars } = scoreSponsorReputation(score);
  res.json({ score, label, stars });
});

router.get("/finances/staff-wage-bill", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.json({ weeklyWages: 0, monthlyWages: 0, staffCount: 0, staff: [] }); return; }
  res.json(await computeStaffWageBill(team.id));
});

const TIER_TO_CATEGORY: Record<string, string> = {
  Bronze:             "World Tour",
  Silver:             "World Tour",
  Gold:               "World Tour",
  Elite:              "World Tour",
  "Continental Final": "Continental Tour",
  "Grand Final":       "World Championship",
  Olympics:            "Olympics",
};
const CATEGORY_ORDER = ["Local Tour", "Continental Tour", "World Tour", "World Championship", "Olympics"];

router.get("/finances/prize-money", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.json({ total: 0, breakdown: [] }); return; }

  const completedMatches = await db.select().from(matchesTable)
    .where(and(eq(matchesTable.homeTeamId, team.id), eq(matchesTable.status, "completed")));

  const wonMatches = completedMatches.filter(
    m => (m.homeScore ?? 0) > (m.awayScore ?? 0) && m.prizeAmount && Number(m.prizeAmount) > 0
  );

  const grouped: Record<string, { amount: number; count: number }> = {};
  for (const m of wonMatches) {
    const cat = m.tier ? (TIER_TO_CATEGORY[m.tier] ?? "Local Tour") : "Local Tour";
    if (!grouped[cat]) grouped[cat] = { amount: 0, count: 0 };
    grouped[cat].amount += Number(m.prizeAmount);
    grouped[cat].count  += 1;
  }

  const breakdown = CATEGORY_ORDER
    .filter(cat => grouped[cat])
    .map(cat => ({ category: cat, amount: grouped[cat].amount, matches: grouped[cat].count }));

  res.json({ total: breakdown.reduce((s, b) => s + b.amount, 0), breakdown });
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
