import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { db } from "@workspace/db";
import { financeTransactionsTable, matchesTable, playersTable, promoDealsTable, staffTable, teamsTable, calendarStateTable } from "@workspace/db";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { generateOfferBatch } from "../utils/sponsor-generator.js";
import { getGameDate } from "../utils/gameDate.js";
import { isSeniorPlayer, isActiveYouthPlayer } from "../utils/playerClassification.js";
import { academyWeeklyWage } from "../utils/academy.js";
import { loadPlayers, careerSaveIdForTeamOrThrow, loadStaff } from "../lib/playerDto.js";
import type { FinanceTransaction, PromoDeal } from "@workspace/db";
import { promotionsMultiplier } from "../utils/staffBonuses.js";
import { getActiveSeasonForCareer } from "../lib/getActiveSeason.js";
import { purseAccessTierFor } from "../utils/rankingPoints.js";
import { weeklyRunningCost } from "../utils/runningCosts.js";
import { WEEKS_PER_MONTH, SPONSOR_REP_BASELINE, decayedReputation, sponsorWeeklyIncome, managerWeeklySalary } from "../utils/clubFinances.js";
import { managerSalaryFor } from "@workspace/db";

/* ── Sponsor reputation helper ──────────────────────────────── */

function scoreSponsorReputation(score: number): { label: string; stars: number } {
  if (score <= 20) return { label: "Poor",       stars: 1 };
  if (score <= 40) return { label: "Developing", stars: 2 };
  if (score <= 60) return { label: "Reliable",   stars: 3 };
  if (score <= 80) return { label: "Attractive", stars: 4 };
  return               { label: "Elite",       stars: 5 };
}

async function computeStaffWageBill(teamId: number) {
  // staff.salary is a MONTHLY figure — that is how the source data is written
  // (a head coach is ~9,800 on a 12-month contract) and how the staff market
  // labels it ("/mo"). Reading it as weekly and multiplying by 4.33 overstated
  // the staff wage bill by 4.33x on the finances page.
  const staff = await loadStaff(await careerSaveIdForTeamOrThrow(teamId), { teamId: teamId });
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

// Unity brief item 13 (Rob, 29 Sep): the Player Wages box said $10,500 a week and
// $45,500 a month for three players whose contracts total $24,600 a month. It
// priced every player from a table by rating tier ("Star Player" $3,000 a week),
// not from her contract. It now reads the signed contracts' monthly salaries, and
// a week is the month / (52/12): exactly what routes/calendar.ts charges.
async function computeWageBill(teamId: number) {
  const players = await loadPlayers(await careerSaveIdForTeamOrThrow(teamId), { teamId });
  // Academy players are paid on the academy's weekly table (computeYouthWageBill),
  // as the weekly run pays them. Keyed on player_type, not an age guess.
  const roster = players.filter(isSeniorPlayer).map(p => ({
    id:            p.id,
    name:          p.name,
    monthlySalary: Number(p.salary),
    weeklySalary:  Math.round(Number(p.salary) / WEEKS_PER_MONTH),
    contractEnds:  p.contractEndDate ?? null,
  }));
  const monthlyWages = roster.reduce((sum, p) => sum + p.monthlySalary, 0);
  // Rounded once, on the total, as the weekly charge rounds it.
  const weeklyWages  = Math.round(monthlyWages / WEEKS_PER_MONTH);
  return { weeklyWages, monthlyWages, playerCount: roster.length, players: roster };
}

// R-63: the academy wage is utils/academy.ts's table — the same one the weekly
// wage run bills.
async function computeYouthWageBill(teamId: number) {
  const players = await loadPlayers(await careerSaveIdForTeamOrThrow(teamId), { teamId });
  const youthPlayers = players.filter(isActiveYouthPlayer);
  const roster = youthPlayers.map(p => ({
    id:           p.id,
    name:         p.name,
    potential:    p.potential,
    weeklySalary: academyWeeklyWage(p.potential),
  }));
  const weeklyWages  = roster.reduce((s, p) => s + p.weeklySalary, 0);
  const monthlyWages = Math.round(weeklyWages * WEEKS_PER_MONTH);
  return { weeklyWages, monthlyWages, playerCount: roster.length, players: roster };
}

const router = Router();

const serializeTx = (t: FinanceTransaction) => ({ ...t, amount: Number(t.amount) });
const serializeDeal = (d: PromoDeal) => ({ ...d, amount: Number(d.amount) });


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
  // Overnight 1 Oct, N-38: the page's "Show all" asks for every row (the cap was 200).
  const limit  = Number.isFinite(rawLimit)  ? Math.min(Math.max(Math.trunc(rawLimit), 1), 20_000) : 50;
  const offset = Number.isFinite(rawOffset) ? Math.max(Math.trunc(rawOffset), 0) : 0;

  const [{ total }] = await db
    .select({ total: count() })
    .from(financeTransactionsTable)
    .where(eq(financeTransactionsTable.teamId, team.id));

  const txs = await db.select().from(financeTransactionsTable)
    .where(eq(financeTransactionsTable.teamId, team.id))
    // N-38: newest game date first, then the row written last. By the PC's
    // timestamp alone, rows written in the same second (a week advanced at once)
    // came out in any order, so the list jumped about in time.
    .orderBy(desc(financeTransactionsTable.date), desc(financeTransactionsTable.id))
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

/**
 * GET /finances/summary. Unity brief item 13: every figure is one of three things.
 *   - Money that MOVED, summed from the ledger (finance_transactions) over a
 *     stated period: monthlyIncome/monthlyExpenses are the last 4 weeks (the 28
 *     game days to today); incomeSources/expenseBreakdown and
 *     seasonIncome/seasonExpenses are this season, from its first day.
 *   - Wages OWED: /finances/wage-bill and /finances/staff-wage-bill, from the
 *     signed contracts.
 *   - The one FORECAST: the next 4 weeks at this week's rates, labelled so.
 * The old monthly figures added a month of the (wrongly priced) wage bill on top
 * of what the ledger had already charged, and the page divided all-time
 * category totals by this month's, which is how 586% and 3145% appeared.
 */
router.get("/finances/summary", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) {
    res.json({ totalBalance: 0, totalIncome: 0, totalExpenses: 0, monthlyIncome: 0, monthlyExpenses: 0, seasonIncome: 0, seasonExpenses: 0, incomeSources: { prizeMoney: 0, sponsorships: 0, promoDeals: 0, other: 0 }, expenseBreakdown: { playerSalaries: 0, staffSalaries: 0, runningCosts: 0, trainingCosts: 0, other: 0 }, forecast: null, recentTransactions: [] });
    return;
  }
  const careerSaveId = await careerSaveIdForTeamOrThrow(team.id);
  const txs = await db.select().from(financeTransactionsTable)
    .where(eq(financeTransactionsTable.teamId, team.id))
    .orderBy(desc(financeTransactionsTable.createdAt));

  // Expense rows carry a positive magnitude and take their sign from `type`.
  // A few routes used to store negatives; normalise so old saves total up.
  const amountOf = (t: FinanceTransaction) => Math.abs(Number(t.amount));
  const total = (rows: FinanceTransaction[]) => rows.reduce((acc, t) => acc + amountOf(t), 0);
  const income   = txs.filter(t => t.type === "income");
  const expenses = txs.filter(t => t.type === "expense");

  // Periods on the GAME calendar, the ledger's own dates.
  const today = await getGameDate(team.id);
  const fourWeeksFrom = addDays(today, -27);
  const season = await getActiveSeasonForCareer(careerSaveId);
  const seasonFrom = season?.startDate ?? `${today.slice(0, 4)}-01-01`;
  const within = (from: string) => (t: FinanceTransaction) => t.date >= from && t.date <= today;
  const seasonIncomeRows  = income.filter(within(seasonFrom));
  const seasonExpenseRows = expenses.filter(within(seasonFrom));
  const inCategories = (rows: FinanceTransaction[], cats: string[]) => total(rows.filter(t => cats.includes(t.category)));

  // The weekly charge in calendar.ts writes "salaries" and "staff_salary"; older
  // rows use "player_salary" and "staff". Accept both, or wages fall into Other.
  const PLAYER_SALARY_CATEGORIES = ["player_salary", "salaries"];
  const STAFF_SALARY_CATEGORIES  = ["staff_salary", "staff"];
  // L-04's weekly charge writes "running_costs" (routes/calendar.ts).
  const RUNNING_COST_CATEGORIES  = ["running_costs"];
  const TRAINING_CATEGORIES      = ["training_cost"];
  // Overnight 1 Oct, N-41: the manager's salary, paid weekly by calendar.ts.
  const MANAGER_SALARY_CATEGORIES = ["manager_salary"];
  const NAMED_EXPENSES = [...PLAYER_SALARY_CATEGORIES, ...STAFF_SALARY_CATEGORIES, ...RUNNING_COST_CATEGORIES, ...TRAINING_CATEGORIES, ...MANAGER_SALARY_CATEGORIES];
  const NAMED_INCOME   = ["prize_money", "sponsorship", "promo_deal"];

  res.json({
    totalBalance: Number(team.budget),
    // Every row ever, for the ledger's own reconciliation.
    totalIncome:   total(income),
    totalExpenses: total(expenses),
    periods: { last4Weeks: { from: fourWeeksFrom, to: today }, season: { from: seasonFrom, to: today } },
    monthlyIncome:   total(income.filter(within(fourWeeksFrom))),
    monthlyExpenses: total(expenses.filter(within(fourWeeksFrom))),
    seasonIncome:    total(seasonIncomeRows),
    seasonExpenses:  total(seasonExpenseRows),
    incomeSources: {
      prizeMoney:   inCategories(seasonIncomeRows, ["prize_money"]),
      sponsorships: inCategories(seasonIncomeRows, ["sponsorship"]),
      promoDeals:   inCategories(seasonIncomeRows, ["promo_deal"]),
      other:        total(seasonIncomeRows.filter(t => !NAMED_INCOME.includes(t.category))),
    },
    expenseBreakdown: {
      playerSalaries: inCategories(seasonExpenseRows, PLAYER_SALARY_CATEGORIES),
      staffSalaries:  inCategories(seasonExpenseRows, STAFF_SALARY_CATEGORIES),
      runningCosts:   inCategories(seasonExpenseRows, RUNNING_COST_CATEGORIES),
      trainingCosts:  inCategories(seasonExpenseRows, TRAINING_CATEGORIES),
      managerSalary:  inCategories(seasonExpenseRows, MANAGER_SALARY_CATEGORIES),
      other:          total(seasonExpenseRows.filter(t => !NAMED_EXPENSES.includes(t.category))),
    },
    forecast: await forecastWeeks(team, careerSaveId, today, season?.year ?? Number(today.slice(0, 4))),
    recentTransactions: txs.slice(0, 10).map(serializeTx),
  });
});

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const FORECAST_WEEKS = 4;

/**
 * The next 4 salary weeks, charged the way routes/calendar.ts charges them:
 * sponsor income on the reputation as it decays toward the baseline week by
 * week, player wages (contracts / (52/12) plus the academy table), staff wages,
 * running costs; plus the monthly payments of signed sponsor contracts that fall
 * due inside the 28 days. Prize money is not forecast: it depends on results.
 */
async function forecastWeeks(team: typeof teamsTable.$inferSelect, careerSaveId: number, today: string, seasonYear: number) {
  const [wageBill, staffWageBill, youthWageBill, squad, staff, tier] = await Promise.all([
    computeWageBill(team.id), computeStaffWageBill(team.id), computeYouthWageBill(team.id),
    loadPlayers(careerSaveId, { teamId: team.id }), loadStaff(careerSaveId, { teamId: team.id }),
    purseAccessTierFor(careerSaveId, team.id, seasonYear),
  ]);
  const promoBonus = promotionsMultiplier(staff);
  let reputation = team.sponsorReputation ?? SPONSOR_REP_BASELINE;
  let sponsorIncome = 0;
  for (let w = 0; w < FORECAST_WEEKS; w++) {
    reputation = decayedReputation(reputation);
    sponsorIncome += sponsorWeeklyIncome(reputation, promoBonus);
  }
  const horizon = addDays(today, FORECAST_WEEKS * 7);
  const contracts = await db.select().from(promoDealsTable)
    .where(and(eq(promoDealsTable.teamId, team.id), eq(promoDealsTable.isAccepted, true), eq(promoDealsTable.status, "accepted")));
  let contractPayments = 0;
  for (const c of contracts) {
    const monthly = Math.round(Number(c.monthlyPayment ?? 0) * promoBonus);
    if (monthly <= 0) continue;
    // Paid when 30 days have passed since the last payment (GET /finances/sponsor-active).
    let due = c.lastPaymentDate ? addDays(c.lastPaymentDate, 30) : today;
    while (due <= horizon && (!c.contractEndDate || due <= c.contractEndDate)) {
      contractPayments += monthly;
      due = addDays(due, 30);
    }
  }
  const playerWages  = (wageBill.weeklyWages + youthWageBill.weeklyWages) * FORECAST_WEEKS;
  const staffWages   = staffWageBill.weeklyWages * FORECAST_WEEKS;
  const runningCosts = weeklyRunningCost(squad.length, tier) * FORECAST_WEEKS;
  const managerSalary = managerWeeklySalary(managerSalaryFor(`career:${careerSaveId}`)) * FORECAST_WEEKS;
  const income   = sponsorIncome + contractPayments;
  const expenses = playerWages + staffWages + runningCosts + managerSalary;
  return {
    weeks: FORECAST_WEEKS,
    from: today,
    to: horizon,
    income: { sponsorIncome, contractPayments, total: income },
    expenses: { playerWages, staffWages, runningCosts, managerSalary, total: expenses },
    net: income - expenses,
    projectedBalance: Number(team.budget) + income - expenses,
  };
}

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

// Unity brief item 13: the tracker said "$14,500 (2 wins)" where the ledger held
// $14,950 from 4 prizes. It summed the ADVERTISED purses of won matches. It now
// sums the money PAID, from the ledger: winner's prizes and runner-up prizes,
// this season (and all seasons, for the record).
router.get("/finances/prize-money", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.json({ total: 0, allSeasons: 0, breakdown: [] }); return; }
  const rows = await db.select().from(financeTransactionsTable)
    .where(and(eq(financeTransactionsTable.teamId, team.id), eq(financeTransactionsTable.category, "prize_money"), eq(financeTransactionsTable.type, "income")));
  const season = await getActiveSeasonForCareer(await careerSaveIdForTeamOrThrow(team.id));
  const seasonFrom = season?.startDate ?? "0000-00-00";
  const thisSeason = rows.filter(r => r.date >= seasonFrom);
  const paid = (list: typeof rows) => list.reduce((acc, r) => acc + Math.abs(Number(r.amount)), 0);
  const isRunnerUp = (r: (typeof rows)[number]) => /^Runner-up prize/i.test(r.description);
  const breakdown = [
    { category: "Winner's prizes",  rows: thisSeason.filter(r => !isRunnerUp(r)) },
    { category: "Runner-up prizes", rows: thisSeason.filter(isRunnerUp) },
  ].filter(b => b.rows.length > 0).map(b => ({ category: b.category, amount: paid(b.rows), matches: b.rows.length }));
  res.json({ total: paid(thisSeason), allSeasons: paid(rows), breakdown });
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

  const teamStaff = await loadStaff(await careerSaveIdForTeamOrThrow(team.id), { teamId: team.id });
  const promoBonus = promotionsMultiplier(teamStaff);
  const finalAmount = Math.round(Number(deal.amount) * promoBonus);

  await db.update(promoDealsTable).set({ isAccepted: true, teamId: team.id }).where(eq(promoDealsTable.id, id));
  const today = await getGameDate(team.id);
  const [tx] = await db.insert(financeTransactionsTable).values({
    teamId: team.id,
    type: "income",
    amount: finalAmount,
    description: `Promo deal: ${deal.sponsor}${promotionsNote(promoBonus)}`,
    category: "promo_deal",
    date: today,
  }).returning();
  await db.update(teamsTable).set({ budget: Number(team.budget) + finalAmount }).where(eq(teamsTable.id, team.id));

  res.json(serializeTx(tx));
});

/* ── Sponsor system helpers ──────────────────────────────────── */

/** " (+17% Promotions Manager bonus)" on a boosted payment, nothing otherwise. */
function promotionsNote(multiplier: number): string {
  const pct = Math.round((multiplier - 1) * 100);
  return pct > 0 ? ` (+${pct}% Promotions Manager bonus)` : "";
}

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

  // Item 13: every offer said "Expires 0d". The page counted from the PC's
  // date, months past the game's. Counted here, on the game calendar.
  res.json(available.map(d => ({
    ...d,
    amount:        Number(d.amount),
    signingBonus:  Number(d.signingBonus ?? 0),
    monthlyPayment: Number(d.monthlyPayment ?? 0),
    daysLeft:      d.expiresAt ? Math.max(0, daysDiff(gameDate, d.expiresAt)) : null,
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

  // Process due monthly payments. P-09: the promotions manager's bonus is paid
  // on top, while one is employed.
  const promoBonus = promotionsMultiplier(await loadStaff(await careerSaveIdForTeamOrThrow(team.id), { teamId: team.id }));
  let teamBudget = Number(team.budget);
  for (const contract of active) {
    const monthly = Math.round(Number(contract.monthlyPayment ?? 0) * promoBonus);
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
        description: `Monthly sponsorship: ${contract.sponsor}${promotionsNote(promoBonus)}`,
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
  const promoBonus      = promotionsMultiplier(await loadStaff(await careerSaveIdForTeamOrThrow(team.id), { teamId: team.id }));
  const signingBonus    = Math.round(Number(deal.signingBonus ?? 0) * promoBonus);

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
      description: `Signing bonus: ${deal.sponsor}${promotionsNote(promoBonus)}`,
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

export default router;
