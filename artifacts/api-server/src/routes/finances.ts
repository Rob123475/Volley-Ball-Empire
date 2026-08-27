import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { db } from "@workspace/db";
import { financeTransactionsTable, matchesTable, playersTable, promoDealsTable, staffTable, teamsTable, calendarStateTable } from "@workspace/db";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { generateOfferBatch } from "../utils/sponsor-generator.js";
import { getGameDate } from "../utils/gameDate.js";
import { isSeniorPlayer, isActiveYouthPlayer } from "../utils/playerClassification.js";

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
  // staff.salary is a MONTHLY figure — that is how the source data is written
  // (a head coach is ~9,800 on a 12-month contract) and how the staff market
  // labels it ("/mo"). Reading it as weekly and multiplying by 4.33 overstated
  // the staff wage bill by 4.33x on the finances page.
  const staff = await db.select().from(staffTable).where(eq(staffTable.teamId, teamId));
  const roster = staff.map(s => ({
    id:            s.id,
    name:          s.name,
    role:          s.role,
    monthlySalary: Number(s.salary),
    weeklySalary:  Math.round(Number(s.salary) / WEEKS_PER_MONTH),
  }));
  const monthlyWages = Math.round(roster.reduce((sum, s) => sum + s.monthlySalary, 0));
  const weeklyWages  = Math.round(monthlyWages / WEEKS_PER_MONTH);
  return { weeklyWages, monthlyWages, staffCount: roster.length, staff: roster };
}

async function computeWageBill(teamId: number) {
  const players = await db.select().from(playersTable).where(eq(playersTable.teamId, teamId));
  // Exclude youth academy players — they have a separate wage system. Keyed on
  // player_type, not an age guess: 9 shipped academy players are 19, and the
  // old age test billed them at senior tier rates.
  const seniorPlayers = players.filter(isSeniorPlayer);
  const roster = seniorPlayers.map(p => {
    const overallRating = Math.round((p.speed + p.power + p.defense + p.serve + p.block + p.stamina) / 6);
    const tier       = getPlayerTier(overallRating);
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
  const youthPlayers = players.filter(isActiveYouthPlayer);
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


// Returns at most 100 rows and always has. That is fine for the ledger table
// this feeds — no caller sums these rows, and every total on the finances page
// comes from /finances/summary, which aggregates server-side over the full
// history. It is NOT fine as the only way to read your history: a season
// generates a transaction most weeks plus one per event, so a player passes
// 100 partway through season one and the older half of their ledger simply
// stops existing. Use /finances/history for anything that needs to page or
// needs to know how many there really are.
router.get("/finances", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.json([]); return; }
  const txs = await db.select().from(financeTransactionsTable)
    .where(eq(financeTransactionsTable.teamId, team.id))
    .orderBy(desc(financeTransactionsTable.createdAt)).limit(100);
  res.json(txs.map(serializeTx));
});

/**
 * GET /finances/history?limit=&offset=
 *
 * Paged ledger with a real total counted server-side, so the UI can say
 * "showing 50 of 431" instead of silently ending at 100.
 */
router.get("/finances/history", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.json({ transactions: [], total: 0, limit: 0, offset: 0 }); return; }

  const rawLimit  = Number(req.query.limit);
  const rawOffset = Number(req.query.offset);
  const limit  = Number.isFinite(rawLimit)  ? Math.min(Math.max(Math.trunc(rawLimit), 1), 200) : 50;
  const offset = Number.isFinite(rawOffset) ? Math.max(Math.trunc(rawOffset), 0) : 0;

  const [{ total }] = await db
    .select({ total: count() })
    .from(financeTransactionsTable)
    .where(eq(financeTransactionsTable.teamId, team.id));

  const txs = await db.select().from(financeTransactionsTable)
    .where(eq(financeTransactionsTable.teamId, team.id))
    .orderBy(desc(financeTransactionsTable.createdAt))
    .limit(limit).offset(offset);

  res.json({ transactions: txs.map(serializeTx), total: Number(total), limit, offset });
});

router.post("/finances", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const { type, amount, description, category, date } = req.body;
  const [tx] = await db.insert(financeTransactionsTable).values({
    teamId: team.id, type, amount: Number(amount), description, category, date,
  }).returning();
  res.status(201).json(serializeTx(tx));
});

router.get("/finances/summary", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) {
    res.json({ totalBalance: 0, totalIncome: 0, totalExpenses: 0, monthlyIncome: 0, monthlyExpenses: 0, incomeSources: { prizeMoney: 0, sponsorships: 0, promoDeals: 0 }, expenseBreakdown: { playerSalaries: 0, staffSalaries: 0, trainingCosts: 0, other: 0 }, recentTransactions: [] });
    return;
  }
  const txs = await db.select().from(financeTransactionsTable)
    .where(eq(financeTransactionsTable.teamId, team.id))
    .orderBy(desc(financeTransactionsTable.createdAt));

  // Expense rows carry a positive magnitude and take their sign from `type`.
  // A few routes used to store negatives; normalise so old saves total up
  // correctly and the "other" bar cannot go negative.
  const income = txs.filter(t => t.type === "income").map(t => ({ ...t, amount: Math.abs(Number(t.amount)) }));
  const expenses = txs.filter(t => t.type === "expense").map(t => ({ ...t, amount: Math.abs(Number(t.amount)) }));
  const totalIncome = income.reduce((acc, t) => acc + Number(t.amount), 0);
  const totalExpenses = expenses.reduce((acc, t) => acc + Number(t.amount), 0);

  // In-game month, not the machine's — see dashboard.ts for the same fix.
  const monthStr = (await getGameDate(team.id)).slice(0, 7);
  const monthIncome = income.filter(t => t.date.startsWith(monthStr)).reduce((acc, t) => acc + Number(t.amount), 0);
  const monthExpenses = expenses.filter(t => t.date.startsWith(monthStr)).reduce((acc, t) => acc + Number(t.amount), 0);

  const [wageBill, staffWageBill, youthWageBill] = await Promise.all([
    computeWageBill(team.id),
    computeStaffWageBill(team.id),
    computeYouthWageBill(team.id),
  ]);
  // The weekly charge in calendar.ts writes categories "salaries" and "staff";
  // older/other rows use "player_salary" and "staff_salary". Accept both, or
  // every wage row falls through to "Other".
  const PLAYER_SALARY_CATEGORIES = ["player_salary", "salaries"];
  const STAFF_SALARY_CATEGORIES  = ["staff_salary", "staff"];
  const txPlayerSalaries = expenses.filter(t => PLAYER_SALARY_CATEGORIES.includes(t.category)).reduce((acc, t) => acc + Number(t.amount), 0);
  const txStaffSalaries  = expenses.filter(t => STAFF_SALARY_CATEGORIES.includes(t.category)).reduce((acc, t) => acc + Number(t.amount), 0);

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
      other: expenses.filter(t => ![...PLAYER_SALARY_CATEGORIES, ...STAFF_SALARY_CATEGORIES, "training_cost"].includes(t.category)).reduce((acc, t) => acc + Number(t.amount), 0),
    },
    recentTransactions: txs.slice(0, 10).map(serializeTx),
  });
});

router.get("/finances/wage-bill", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.json({ weeklyWages: 0, monthlyWages: 0, playerCount: 0, players: [] }); return; }
  res.json(await computeWageBill(team.id));
});

router.get("/finances/sponsor-reputation", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  const score = team ? Math.min(100, Math.max(0, team.sponsorReputation ?? 50)) : 50;
  const { label, stars } = scoreSponsorReputation(score);
  res.json({ score, label, stars });
});

router.get("/finances/staff-wage-bill", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
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
  const team = await getActiveTeam(req);
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
  const team = await getActiveTeam(req);
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
  const team = await getActiveTeam(req);
  const deals = await db.select().from(promoDealsTable)
    .where(and(eq(promoDealsTable.isGlobal, true), eq(promoDealsTable.isAccepted, false)));
  res.json(deals.map(serializeDeal));
});

router.post("/finances/promo-deals/:id/accept", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const id = parseInt(req.params.id);
  const deal = await db.query.promoDealsTable.findFirst({ where: eq(promoDealsTable.id, id) });
  if (!deal) { res.status(404).json({ error: "Deal not found" }); return; }

  const teamStaff = await db.select().from(staffTable).where(eq(staffTable.teamId, team.id));
  const promoMgr = teamStaff.find(s => s.role === "promotions_manager");
  const promoBonus = promoMgr
    ? 1.0 + Math.max(0, promoMgr.skillLevel - 50) * (0.18 / 45)
    : 1.0;
  const finalAmount = Math.round(Number(deal.amount) * promoBonus);

  await db.update(promoDealsTable).set({ isAccepted: true, teamId: team.id }).where(eq(promoDealsTable.id, id));
  const today = await getGameDate(team.id);
  const [tx] = await db.insert(financeTransactionsTable).values({
    teamId: team.id,
    type: "income",
    amount: finalAmount,
    description: promoMgr
      ? `Promo deal: ${deal.sponsor} (+${Math.round((promoBonus - 1) * 100)}% Promotions Manager bonus)`
      : `Promo deal: ${deal.sponsor}`,
    category: "promo_deal",
    date: today,
  }).returning();
  await db.update(teamsTable).set({ budget: Number(team.budget) + finalAmount }).where(eq(teamsTable.id, team.id));

  res.json(serializeTx(tx));
});

/* ── Sponsor system helpers ──────────────────────────────────── */

function daysDiff(from: string, to: string): number {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

/* ── Regenerative sponsor offers ─────────────────────────────── */

router.get("/finances/sponsor-offers", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.json([]); return; }

  const gameDate = await getGameDate(team.id);

  // Expire offers past their expiresAt date
  await db.update(promoDealsTable)
    .set({ status: "expired" })
    .where(and(
      eq(promoDealsTable.teamId, team.id),
      eq(promoDealsTable.status, "available"),
      sql`${promoDealsTable.expiresAt} < ${gameDate}`,
    ));

  // Fetch current available offers
  let available = await db.select().from(promoDealsTable)
    .where(and(eq(promoDealsTable.teamId, team.id), eq(promoDealsTable.status, "available")));

  if (available.length < 6) {
    // Get all sponsor names ever used by this team to avoid repeats
    const allTeamDeals = await db.select({ sponsor: promoDealsTable.sponsor })
      .from(promoDealsTable).where(eq(promoDealsTable.teamId, team.id));
    const usedNames = new Set(allTeamDeals.map(d => d.sponsor));

    const toGenerate = 6 - available.length;
    const newOffers = generateOfferBatch({ team, usedNames, gameDate, count: toGenerate });

    for (const offer of newOffers) {
      await db.insert(promoDealsTable).values({
        teamId:                team.id,
        sponsor:               offer.sponsor,
        description:           offer.description,
        amount:                offer.amount,
        requirementWins:       offer.requirementWins,
        expiresAt:             offer.expiresAt,
        isAccepted:            false,
        isGlobal:              false,
        tier:                  offer.tier,
        slot:                  offer.slot,
        category:              offer.category,
        signingBonus:          offer.signingBonus,
        monthlyPayment:        offer.monthlyPayment,
        contractLengthSeasons: offer.contractLengthSeasons,
        contractStartDate:     null,
        contractEndDate:       null,
        appealReason:          offer.appealReason,
        status:                "available",
        lastPaymentDate:       null,
        signingBonusPaid:      false,
      });
    }

    available = await db.select().from(promoDealsTable)
      .where(and(eq(promoDealsTable.teamId, team.id), eq(promoDealsTable.status, "available")));
  }

  res.json(available.map(d => ({
    ...d,
    amount:        Number(d.amount),
    signingBonus:  Number(d.signingBonus ?? 0),
    monthlyPayment: Number(d.monthlyPayment ?? 0),
  })));
});

/* ── Active sponsorship contracts ────────────────────────────── */

router.get("/finances/sponsor-active", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.json([]); return; }

  const gameDate = await getGameDate(team.id);

  // Expire contracts past their contractEndDate
  await db.update(promoDealsTable)
    .set({ status: "expired" })
    .where(and(
      eq(promoDealsTable.teamId, team.id),
      eq(promoDealsTable.isAccepted, true),
      eq(promoDealsTable.status, "accepted"),
      sql`${promoDealsTable.contractEndDate} IS NOT NULL AND ${promoDealsTable.contractEndDate} < ${gameDate}`,
    ));

  // Fetch active contracts
  const active = await db.select().from(promoDealsTable)
    .where(and(
      eq(promoDealsTable.teamId, team.id),
      eq(promoDealsTable.isAccepted, true),
      eq(promoDealsTable.status, "accepted"),
    ));

  // Process due monthly payments
  let teamBudget = Number(team.budget);
  for (const contract of active) {
    const monthly = Number(contract.monthlyPayment ?? 0);
    if (monthly <= 0) continue;
    const lastPaid = contract.lastPaymentDate;
    if (!lastPaid || daysDiff(lastPaid, gameDate) >= 30) {
      await db.update(promoDealsTable)
        .set({ lastPaymentDate: gameDate })
        .where(eq(promoDealsTable.id, contract.id));
      await db.insert(financeTransactionsTable).values({
        teamId:      team.id,
        type:        "income",
        amount:      monthly,
        description: `Monthly sponsorship: ${contract.sponsor}`,
        category:    "sponsorship",
        date:        gameDate,
      });
      teamBudget += monthly;
    }
  }
  if (teamBudget !== Number(team.budget)) {
    await db.update(teamsTable)
      .set({ budget: teamBudget })
      .where(eq(teamsTable.id, team.id));
  }

  const refreshed = await db.select().from(promoDealsTable)
    .where(and(
      eq(promoDealsTable.teamId, team.id),
      eq(promoDealsTable.isAccepted, true),
      eq(promoDealsTable.status, "accepted"),
    ));

  res.json(refreshed.map(d => ({
    ...d,
    amount:         Number(d.amount),
    signingBonus:   Number(d.signingBonus ?? 0),
    monthlyPayment: Number(d.monthlyPayment ?? 0),
    currentWins:    team.wins,
    progressPct:    d.requirementWins > 0
      ? Math.min(100, Math.round((team.wins / d.requirementWins) * 100))
      : 100,
    isComplete:     team.wins >= d.requirementWins,
    daysRemaining:  d.contractEndDate
      ? Math.max(0, daysDiff(gameDate, d.contractEndDate))
      : null,
  })));
});

/* ── Accept a new-system sponsor offer ───────────────────────── */

router.post("/finances/sponsor-offers/:id/accept", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const id   = parseInt(req.params.id);

  const deal = await db.query.promoDealsTable.findFirst({ where: eq(promoDealsTable.id, id) });
  if (!deal) { res.status(404).json({ error: "Deal not found" }); return; }
  if (deal.status !== "available") { res.status(400).json({ error: "Offer is no longer available" }); return; }

  const slot = deal.slot ?? "supporting";
  const activeContracts = await db.select().from(promoDealsTable)
    .where(and(eq(promoDealsTable.teamId, team.id), eq(promoDealsTable.status, "accepted")));

  if (slot === "primary" && activeContracts.some(d => d.slot === "primary")) {
    res.status(400).json({ error: "Primary sponsor slot already occupied." }); return;
  }
  if (slot === "kit" && activeContracts.some(d => d.slot === "kit")) {
    res.status(400).json({ error: "Kit sponsor slot already occupied." }); return;
  }
  if (slot === "supporting" && activeContracts.filter(d => d.slot === "supporting").length >= 3) {
    res.status(400).json({ error: "All 3 supporting slots are occupied." }); return;
  }

  const gameDate        = await getGameDate(team.id);
  const contractLength  = deal.contractLengthSeasons ?? 1;
  const endDate         = new Date(gameDate);
  endDate.setDate(endDate.getDate() + contractLength * 90);
  const contractEndDate = endDate.toISOString().split("T")[0];
  const signingBonus    = Number(deal.signingBonus ?? 0);

  await db.update(promoDealsTable).set({
    isAccepted:       true,
    status:           "accepted",
    contractStartDate: gameDate,
    contractEndDate,
    signingBonusPaid: signingBonus > 0,
    lastPaymentDate:  null,
  }).where(eq(promoDealsTable.id, id));

  if (signingBonus > 0) {
    await db.insert(financeTransactionsTable).values({
      teamId:      team.id,
      type:        "income",
      amount:      signingBonus,
      description: `Signing bonus: ${deal.sponsor}`,
      category:    "sponsorship",
      date:        gameDate,
    });
    await db.update(teamsTable)
      .set({ budget: Number(team.budget) + signingBonus })
      .where(eq(teamsTable.id, team.id));
  }

  res.json({ success: true, signingBonus });
});

/* ── Reject a sponsor offer ──────────────────────────────────── */

router.post("/finances/sponsor-offers/:id/reject", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const id = parseInt(req.params.id);

  await db.update(promoDealsTable)
    .set({ status: "rejected" })
    .where(and(eq(promoDealsTable.id, id), eq(promoDealsTable.teamId, team.id)));

  res.json({ success: true });
});

/* ── Terminate an active contract ────────────────────────────── */

router.post("/finances/sponsor-active/:id/terminate", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const id   = parseInt(req.params.id);

  const contract = await db.query.promoDealsTable.findFirst({
    where: and(eq(promoDealsTable.id, id), eq(promoDealsTable.teamId, team.id)),
  });
  if (!contract)                    { res.status(404).json({ error: "Contract not found" }); return; }
  if (contract.status !== "accepted") { res.status(400).json({ error: "Contract is not active" }); return; }

  const gameDate   = await getGameDate(team.id);
  const monthly    = Number(contract.monthlyPayment ?? 0);
  const daysLeft   = contract.contractEndDate ? Math.max(0, daysDiff(gameDate, contract.contractEndDate)) : 0;
  const monthsLeft = Math.ceil(daysLeft / 30);
  const cancelFee  = Math.round(monthly * Math.min(monthsLeft, 2) / 100) * 100;

  await db.update(promoDealsTable)
    .set({ status: "expired" })
    .where(eq(promoDealsTable.id, id));

  if (cancelFee > 0) {
    await db.insert(financeTransactionsTable).values({
      teamId:      team.id,
      type:        "expense",
      amount:      cancelFee,
      description: `Contract termination fee: ${contract.sponsor}`,
      category:    "other",
      date:        gameDate,
    });
    await db.update(teamsTable)
      .set({ budget: Math.max(0, Number(team.budget) - cancelFee) })
      .where(eq(teamsTable.id, team.id));
  }

  res.json({ success: true, cancellationFee: cancelFee });
});

/* ── Get termination fee preview ─────────────────────────────── */

router.get("/finances/sponsor-active/:id/terminate-preview", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const id   = parseInt(req.params.id);

  const contract = await db.query.promoDealsTable.findFirst({
    where: and(eq(promoDealsTable.id, id), eq(promoDealsTable.teamId, team.id)),
  });
  if (!contract) { res.status(404).json({ error: "Contract not found" }); return; }

  const gameDate   = await getGameDate(team.id);
  const monthly    = Number(contract.monthlyPayment ?? 0);
  const daysLeft   = contract.contractEndDate ? Math.max(0, daysDiff(gameDate, contract.contractEndDate)) : 0;
  const monthsLeft = Math.ceil(daysLeft / 30);
  const cancelFee  = Math.round(monthly * Math.min(monthsLeft, 2) / 100) * 100;

  res.json({ cancellationFee: cancelFee, daysLeft, monthsLeft });
});

export default router;
