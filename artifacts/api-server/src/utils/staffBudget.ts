/**
 * 1.1.1, Part 11 (Rob, SB-1 to SB-5): the staff budget, on the sponsor system
 * that exists (promo_deals, slot "primary"; names, tiers and categories from
 * utils/sponsor-generator.ts). Every number is in lib/db schema/staff-budget.ts.
 *
 *   SB-1  a hard staff cap: a club's staff and medical wages together stay
 *         under its main sponsor's staff budget. A hire, or a renewal while
 *         over, is refused in plain words with the amount to free up. AI clubs
 *         too: their Jan 8 hiring respects it (utils/aiStaff.ts).
 *   SB-2  on Day 1 (beside the draft) and at each season's start the club
 *         chooses 1 of 3 main sponsor offers: a staff budget and a bonus each
 *         (a win, a share of prize money, reaching the World Finals). The level
 *         grows with the club's World Tour finish and its money. AI clubs choose
 *         too (the biggest staff budget while they lack a coach or a medic,
 *         otherwise any).
 *   SB-4  staff already hired keep their jobs: a club over its budget can't
 *         hire or renew staff until it is back under.
 *
 * Until the player's club has chosen, its budget is its level (a new club's:
 * STAFF_BUDGET.firstSeason).
 */
import {
  promoDealsTable, teamsTable, careerPoolTeamStateTable, seasonsTable, financeTransactionsTable, normaliseRole,
  STAFF_BUDGET, nextStaffBudgetLevel, mainSponsorTerms, bonusText,
} from "@workspace/db";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { loadStaffTx, type CareerStateTx } from "../lib/playerDto.js";
import { generateOffer, type SponsorTier } from "./sponsor-generator.js";

type Tx = CareerStateTx["tx"];
export type BudgetClub = { teamId: number } | { poolTeamId: number };
const isTeam = (c: BudgetClub): c is { teamId: number } => "teamId" in c;
const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** The sponsor's standing for a level: a bigger budget is a bigger name. */
function tierFor(level: number): SponsorTier {
  return level >= 75_000 ? "Global" : level >= 60_000 ? "International" : level >= 47_000 ? "Continental" : "Regional";
}

/** The season being played (its year). */
export function activeSeasonYearTx(tx: Tx, careerSaveId: number): number | null {
  return tx.select({ y: seasonsTable.year }).from(seasonsTable)
    .where(and(eq(seasonsTable.careerSaveId, careerSaveId), eq(seasonsTable.status, "active"))).orderBy(desc(seasonsTable.year)).get()?.y ?? null;
}

/** All the club's staff and medical wages, a month. */
export function staffWagesTx(tx: Tx, careerSaveId: number, club: BudgetClub): number {
  return loadStaffTx(tx, careerSaveId, isTeam(club) ? { teamId: club.teamId } : { poolTeamId: club.poolTeamId })
    .reduce((t, s) => t + Number(s.salary ?? 0), 0);
}

/** The player's club's main sponsor deal for a season (chosen), if any. */
export function mainSponsorDealTx(tx: Tx, teamId: number, seasonYear: number | null) {
  if (seasonYear == null) return null;
  return tx.select().from(promoDealsTable).where(and(
    eq(promoDealsTable.teamId, teamId), eq(promoDealsTable.slot, "primary"), eq(promoDealsTable.status, "accepted"),
    eq(promoDealsTable.seasonYear, seasonYear),
  )).get() ?? null;
}

/** The three offers waiting for the player's club's choice this season. */
export function mainSponsorOffersTx(tx: Tx, teamId: number, seasonYear: number | null) {
  if (seasonYear == null) return [];
  return tx.select().from(promoDealsTable).where(and(
    eq(promoDealsTable.teamId, teamId), eq(promoDealsTable.status, "main_offer"), eq(promoDealsTable.seasonYear, seasonYear),
  )).all();
}

function levelOfTx(tx: Tx, careerSaveId: number, club: BudgetClub): number {
  const stored = isTeam(club)
    ? tx.select({ l: teamsTable.staffBudgetLevel }).from(teamsTable).where(eq(teamsTable.id, club.teamId)).get()?.l
    : tx.select({ l: careerPoolTeamStateTable.staffBudgetLevel }).from(careerPoolTeamStateTable)
      .where(and(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), eq(careerPoolTeamStateTable.poolTeamId, club.poolTeamId))).get()?.l;
  return Number(stored ?? STAFF_BUDGET.firstSeason);
}

export type StaffBudgetView = {
  budget: number; wages: number; room: number; over: boolean;
  sponsor: { name: string; type: string | null; tier: string | null; bonus: string; bonusType: string | null; bonusValue: number; paid: number } | null;
};

/** Where a club stands: its staff budget, its wages, the room left, and its main sponsor. */
export function staffBudgetTx(tx: Tx, careerSaveId: number, club: BudgetClub): StaffBudgetView {
  const wages = staffWagesTx(tx, careerSaveId, club);
  let budget: number, sponsor: StaffBudgetView["sponsor"] = null;
  if (isTeam(club)) {
    const deal = mainSponsorDealTx(tx, club.teamId, activeSeasonYearTx(tx, careerSaveId));
    budget = deal?.staffBudget != null ? Number(deal.staffBudget) : levelOfTx(tx, careerSaveId, club);
    if (deal) sponsor = { name: deal.sponsor, type: deal.category, tier: deal.tier, bonus: bonusText(deal.bonusType, deal.bonusValue), bonusType: deal.bonusType, bonusValue: Number(deal.bonusValue ?? 0), paid: Number(deal.bonusPaid ?? 0) };
  } else {
    const st = tx.select().from(careerPoolTeamStateTable)
      .where(and(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), eq(careerPoolTeamStateTable.poolTeamId, club.poolTeamId))).get();
    budget = st?.staffBudget != null ? Number(st.staffBudget) : levelOfTx(tx, careerSaveId, club);
    if (st?.mainSponsor) sponsor = { name: st.mainSponsor, type: null, tier: null, bonus: bonusText(st.sponsorBonusType, st.sponsorBonusValue), bonusType: st.sponsorBonusType, bonusValue: Number(st.sponsorBonusValue ?? 0), paid: Number(st.sponsorBonusPaid ?? 0) };
  }
  return { budget, wages, room: Math.max(0, budget - wages), over: wages > budget, sponsor };
}

/**
 * The harness runs its other suites with VBE_STAFF_BUDGET=off (harness/run-all.mjs), as it does
 * VBE_STAFF_ABSENCES: a suite about something else hires the staff it needs. Off only lifts the
 * refusals; the budget, the offers and the bonuses still run. The game itself never sets it.
 */
const CAP_ON = process.env.VBE_STAFF_BUDGET !== "off";

/** SB-1: a hire (`adding` a month) that takes the wages over the budget is refused, saying what to free up. */
export function staffBudgetRefusal(v: StaffBudgetView, adding: number, who: string): string | null {
  if (!CAP_ON || v.wages + adding <= v.budget) return null;
  const free = v.wages + adding - v.budget;
  return `${who} would take your staff wages to ${money(v.wages + adding)} a month, over your staff budget of ${money(v.budget)} from your main sponsor. `
    + `Free up ${money(free)} first (release a member of staff), or choose a main sponsor with a bigger staff budget at the season's start.`;
}

/** SB-4: a renewal while over the budget is refused until the club is back under. */
export function staffRenewalRefusal(v: StaffBudgetView, who: string): string | null {
  if (!CAP_ON || !v.over) return null;
  return `You can't renew ${who} while your staff wages (${money(v.wages)} a month) are over your staff budget of ${money(v.budget)}. Free up ${money(v.wages - v.budget)} first.`;
}

/** Make three main sponsor offers at a level (names and types from the sponsor generator). */
function makeOffers(level: number, gameDate: string, used: Set<string>) {
  return mainSponsorTerms(level).map((t) => {
    const g = generateOffer({ tier: tierFor(level), slot: "primary", usedNames: used, gameDate, appealScore: 50 });
    used.add(g.sponsor);
    return { ...t, sponsor: g.sponsor, tier: g.tier, category: g.category };
  });
}

/**
 * SB-2: the player's club's three offers for `seasonYear`, made once (on Day 1,
 * at the season's start, or on first load of a save from before 1.1.1). None
 * when it has chosen already.
 */
export function ensureMainSponsorOffersTx(tx: Tx, careerSaveId: number, teamId: number, seasonYear: number | null, today: string): void {
  if (seasonYear == null || mainSponsorDealTx(tx, teamId, seasonYear) || mainSponsorOffersTx(tx, teamId, seasonYear).length > 0) return;
  const level = levelOfTx(tx, careerSaveId, { teamId });
  const used = new Set(tx.select({ n: promoDealsTable.sponsor }).from(promoDealsTable).where(eq(promoDealsTable.teamId, teamId)).all().map((r) => r.n));
  for (const o of makeOffers(level, today, used)) {
    tx.insert(promoDealsTable).values({
      teamId, sponsor: o.sponsor, description: `Main sponsor: a staff budget of ${money(o.staffBudget)} a month, and ${bonusText(o.bonus, o.bonusValue)}.`,
      amount: 0, requirementWins: 0, expiresAt: `${seasonYear}-12-31`, isAccepted: false, isGlobal: false,
      tier: o.tier, slot: "primary", category: o.category, signingBonus: 0, monthlyPayment: 0, contractLengthSeasons: 1,
      status: "main_offer", staffBudget: o.staffBudget, bonusType: o.bonus, bonusValue: o.bonusValue, bonusPaid: 0, seasonYear,
    }).run();
  }
}

/** The player's club chooses one of its offers. Returns an error in plain words, or null. */
export function chooseMainSponsorTx(tx: Tx, careerSaveId: number, teamId: number, dealId: number, today: string): string | null {
  const year = activeSeasonYearTx(tx, careerSaveId);
  if (mainSponsorDealTx(tx, teamId, year)) return "You have chosen your main sponsor for this season.";
  const offers = mainSponsorOffersTx(tx, teamId, year);
  const pick = offers.find((o) => o.id === dealId);
  if (!pick) return "That offer is not open.";
  tx.update(promoDealsTable).set({ status: "accepted", isAccepted: true, contractStartDate: today, contractEndDate: `${year}-12-31` })
    .where(eq(promoDealsTable.id, pick.id)).run();
  for (const o of offers.filter((x) => x.id !== pick.id)) tx.update(promoDealsTable).set({ status: "rejected" }).where(eq(promoDealsTable.id, o.id)).run();
  return null;
}

/** An AI club chooses: the biggest staff budget while it lacks a coach or a medic, otherwise any of the three. */
function aiChooseTx(tx: Tx, careerSaveId: number, poolTeamId: number, level: number, today: string, used: Set<string>): void {
  const offers = makeOffers(level, today, used);
  const roles = loadStaffTx(tx, careerSaveId, { poolTeamId }).map((s) => normaliseRole(s.role ?? ""));
  const lacks = !roles.some((r) => r === "head_coach" || r === "assistant_coach")
    || !roles.some((r) => r === "doctor" || r === "physiotherapist" || r === "massage_therapist" || r === "medical_specialist");
  const pick = lacks ? offers.reduce((a, b) => (b.staffBudget > a.staffBudget ? b : a)) : offers[Math.floor(Math.random() * offers.length)]!;
  tx.update(careerPoolTeamStateTable).set({
    mainSponsor: pick.sponsor, staffBudget: pick.staffBudget, staffBudgetLevel: level,
    sponsorBonusType: pick.bonus, sponsorBonusValue: pick.bonusValue, sponsorBonusPaid: 0, updatedAt: new Date(),
  }).where(and(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), eq(careerPoolTeamStateTable.poolTeamId, poolTeamId))).run();
}

/** Every AI club in the career chooses for the season, at `levelFor` (the first season's on Day 1). */
export function aiChooseMainSponsorsTx(tx: Tx, careerSaveId: number, today: string, levelFor: (poolTeamId: number) => number): number {
  const clubs = tx.select({ id: careerPoolTeamStateTable.poolTeamId }).from(careerPoolTeamStateTable)
    .where(and(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), isNull(careerPoolTeamStateTable.takenOverAt))).all();
  const used = new Set<string>();
  for (const c of clubs) aiChooseTx(tx, careerSaveId, c.id, levelFor(c.id), today, used);
  return clubs.length;
}

/** Day 1 (beside the draft): the player's offers and the AI clubs' choice, at the first season's level. */
export function openMainSponsorsTx(tx: Tx, careerSaveId: number, teamId: number, today: string): void {
  ensureMainSponsorOffersTx(tx, careerSaveId, teamId, activeSeasonYearTx(tx, careerSaveId), today);
  aiChooseMainSponsorsTx(tx, careerSaveId, today, () => STAFF_BUDGET.firstSeason);
}

/**
 * At the season boundary (after the new season opens): every club's level moves
 * on its World Tour finish in the season just ended and its money; the player's
 * club gets its three offers, the AI clubs choose.
 */
export function rolloverMainSponsorsTx(tx: Tx, careerSaveId: number, teamId: number, endedYear: number, newYear: number, today: string,
  standings: ReadonlyArray<{ rank: number; teamId: number | null; poolTeamId: number | null }>): void {
  // The season's World Tour standings come from the caller (utils/worldTour.ts): importing them here would close an import loop.
  const rankOf = (club: BudgetClub) => standings.find((s) => (isTeam(club) ? s.teamId === club.teamId : s.poolTeamId === club.poolTeamId))?.rank ?? null;
  // The player's club.
  const budget = Number(tx.select({ b: teamsTable.budget }).from(teamsTable).where(eq(teamsTable.id, teamId)).get()?.b ?? 0);
  const level = nextStaffBudgetLevel(levelOfTx(tx, careerSaveId, { teamId }), rankOf({ teamId }), budget);
  tx.update(teamsTable).set({ staffBudgetLevel: level }).where(eq(teamsTable.id, teamId)).run();
  tx.update(promoDealsTable).set({ status: "expired" }).where(and(eq(promoDealsTable.teamId, teamId), eq(promoDealsTable.slot, "primary"),
    eq(promoDealsTable.seasonYear, endedYear))).run();
  ensureMainSponsorOffersTx(tx, careerSaveId, teamId, newYear, today);
  // The AI clubs.
  const balances = new Map(tx.select({ id: careerPoolTeamStateTable.poolTeamId, b: careerPoolTeamStateTable.balance }).from(careerPoolTeamStateTable)
    .where(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId)).all().map((r) => [r.id, Number(r.b)]));
  aiChooseMainSponsorsTx(tx, careerSaveId, today,
    (id) => nextStaffBudgetLevel(levelOfTx(tx, careerSaveId, { poolTeamId: id }), rankOf({ poolTeamId: id }), balances.get(id) ?? 0));
}

/**
 * SB-2: the main sponsor's bonus on a result: a win's money, a share of the
 * prize, or (once a season) reaching the World Finals. Paid to the club (the
 * player's on its ledger as sponsorship). Returns what it paid.
 */
export function mainSponsorResultTx(tx: Tx, careerSaveId: number, club: BudgetClub, r: { won: boolean; prize: number; finals: boolean; today: string }): number {
  const pay = (type: string | null, value: number, paidSoFar: number): number => {
    if (type === "per_win") return r.won ? value : 0;
    if (type === "prize_share") return Math.round(r.prize * value);
    if (type === "finals") return r.finals && paidSoFar === 0 ? value : 0;
    return 0;
  };
  if (isTeam(club)) {
    const deal = mainSponsorDealTx(tx, club.teamId, activeSeasonYearTx(tx, careerSaveId));
    if (!deal) return 0;
    const amount = pay(deal.bonusType, Number(deal.bonusValue ?? 0), Number(deal.bonusPaid ?? 0));
    if (amount <= 0) return 0;
    tx.update(promoDealsTable).set({ bonusPaid: Number(deal.bonusPaid ?? 0) + amount }).where(eq(promoDealsTable.id, deal.id)).run();
    tx.update(teamsTable).set({ budget: sql`${teamsTable.budget} + ${amount}` }).where(eq(teamsTable.id, club.teamId)).run();
    tx.insert(financeTransactionsTable).values({
      teamId: club.teamId, type: "income", amount, category: "sponsorship", date: r.today,
      description: `Main sponsor bonus (${deal.sponsor}): ${bonusText(deal.bonusType, deal.bonusValue)}`,
    }).run();
    return amount;
  }
  const where = and(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), eq(careerPoolTeamStateTable.poolTeamId, club.poolTeamId));
  const st = tx.select().from(careerPoolTeamStateTable).where(where).get();
  if (!st?.sponsorBonusType) return 0;
  const amount = pay(st.sponsorBonusType, Number(st.sponsorBonusValue ?? 0), Number(st.sponsorBonusPaid ?? 0));
  if (amount <= 0) return 0;
  tx.update(careerPoolTeamStateTable).set({ balance: Number(st.balance) + amount, sponsorBonusPaid: Number(st.sponsorBonusPaid ?? 0) + amount }).where(where).run();
  return amount;
}

