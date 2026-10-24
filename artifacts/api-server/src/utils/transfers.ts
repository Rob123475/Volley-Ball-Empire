/**
 * 1.1.1, Parts 2 to 4 (Rob, 16 Oct): buying a senior from another club, the
 * transfer window, one chance to keep her, and perks. One set of rules for
 * every club, the player's and the AI clubs'.
 *
 *   bid       any club may bid for a senior under contract at another club, at
 *             any time of year (bidTx): her fee (marketPrice), and its terms:
 *             wage, length and perks. The cap is checked now, against the
 *             buyer's bill ON HER ARRIVAL DATE (seniorWageBillTx `on`).
 *   counter   the holding club has one chance to keep her (COUNTER_OFFER): an
 *             AI club answers at once (aiCounterFor), the player has
 *             answerDays to answer from his Team page. She weighs both offers
 *             (schema/transfers.ts offerValue, staysForCounter, her mood).
 *             No answer by then: she goes.
 *   agreed    she goes: the fee is paid that day (agreeTx) and she is locked:
 *             her club can't renew her (renewalRefusalTx).
 *   arrival   on the day the window opens (or the day after her contract ends,
 *             if that comes first: nothing holds her then) she joins on the
 *             bid's terms (completeTx); her wage and perks start that day.
 *   no dumping  outside the window a club can't release or sell a senior
 *             (releaseRefusalTx); a contract that simply runs out still ends,
 *             and cover taken on for a player on the injured list may go once
 *             she is fit (the injured-list rule keeps working).
 */
import {
  careerPlayerStateTable, playersTable, contractsTable, teamsTable, financeTransactionsTable, careerPoolTeamStateTable,
  continentalPoolTeamsTable, careerSavesTable, transferDealsTable, COUNTER_OFFER, AI_TRANSFER_TERMS, PERKS,
  perksMonthly, perksText, offerValue, staysForCounter, type TransferDeal,
} from "@workspace/db";
import { and, eq, inArray, lt, lte } from "drizzle-orm";
import type { CareerStateTx } from "../lib/playerDto.js";
import { seniorWageBillTx, committedWageBillTx, wageCapRefusal } from "./salaryCap.js";
import { inTransferWindow, nextWindowOpening, contractEndFrom } from "./transferWindow.js";
import { seasonEndsForCareerTx, playerContractPartyTx } from "./seasonDates.js";
import { worldTourStandingsTx } from "./worldTour.js";
import { coverOnRoster, clubInjuredListTx } from "./injuredList.js";
import { balanceOf, addToBalance, aiTrimSquadsTx, aiCapOnArrivalTx, keepAiSquadsTx, AI_BUY_RESERVE } from "./aiSquads.js";
import { seasonLength, type ContractLength } from "./contractTerms.js";
import { MAX_STARTERS } from "./squadRules.js";
import { monthlySalaryFor } from "./clubFinances.js";
import { overallRating } from "./overallRating.js";

type Tx = CareerStateTx["tx"];
export type Club = { teamId: number } | { poolTeamId: number };
export type TransferTerms = { wage: number; length: ContractLength; perks: string; squadRole?: "starter" | "interchange" | null };
export type BidResult =
  | { ok: false; reason: string }
  | { ok: true; deal: TransferDeal; outcome: "offered" | "agreed" | "kept" | "moved" | "fell_through" };

const addDays = (date: string, days: number) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const dateText = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const sameClub = (a: Club, b: Club) => ("teamId" in a ? "teamId" in b && a.teamId === b.teamId : "poolTeamId" in b && a.poolTeamId === b.poolTeamId);
const fromOf = (d: TransferDeal): Club => (d.fromTeamId != null ? { teamId: d.fromTeamId } : { poolTeamId: d.fromPoolTeamId! });
const toOf = (d: TransferDeal): Club => (d.toTeamId != null ? { teamId: d.toTeamId } : { poolTeamId: d.toPoolTeamId! });

/** The player's own club in this career (his teams row). */
export function careerTeamIdTx(tx: Tx, careerSaveId: number): number | null {
  return tx.select({ t: careerSavesTable.teamId }).from(careerSavesTable).where(eq(careerSavesTable.id, careerSaveId)).get()?.t ?? null;
}

export function clubNameTx(tx: Tx, club: Club): string {
  if ("teamId" in club) return tx.select({ n: teamsTable.name }).from(teamsTable).where(eq(teamsTable.id, club.teamId)).get()?.n ?? "Her club";
  return tx.select({ n: continentalPoolTeamsTable.teamName }).from(continentalPoolTeamsTable).where(eq(continentalPoolTeamsTable.id, club.poolTeamId)).get()?.n ?? "Her club";
}

function stateOf(tx: Tx, careerSaveId: number, playerId: number) {
  return tx.select({
    teamId: careerPlayerStateTable.teamId, poolTeamId: careerPlayerStateTable.poolTeamId, salary: careerPlayerStateTable.salary,
    perks: careerPlayerStateTable.perks, contractEndDate: careerPlayerStateTable.contractEndDate, morale: careerPlayerStateTable.morale,
    isRetired: careerPlayerStateTable.isRetired, isPromoted: careerPlayerStateTable.isPromoted, playerType: playersTable.playerType, name: playersTable.name,
    speed: careerPlayerStateTable.speed, power: careerPlayerStateTable.power, defense: careerPlayerStateTable.defense,
    serve: careerPlayerStateTable.serve, block: careerPlayerStateTable.block, stamina: careerPlayerStateTable.stamina,
  }).from(careerPlayerStateTable).innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
    .where(and(eq(careerPlayerStateTable.careerSaveId, careerSaveId), eq(careerPlayerStateTable.playerId, playerId))).get() ?? null;
}

/** Her open deal (a bid not yet answered, or agreed and waiting for her to arrive), if any. */
export function openDealForTx(tx: Tx, careerSaveId: number, playerId: number): TransferDeal | null {
  return tx.select().from(transferDealsTable).where(and(eq(transferDealsTable.careerSaveId, careerSaveId),
    eq(transferDealsTable.playerId, playerId), inArray(transferDealsTable.status, ["offered", "agreed"]))).get() ?? null;
}

/** When a player bought on `today` arrives: the window's opening, or the day after her contract ends if that is sooner. */
export function arrivalDateFor(today: string, contractEnd: string | null): string {
  const opens = nextWindowOpening(today);
  if (contractEnd && contractEnd < opens) return addDays(contractEnd, 1);
  return opens;
}

/**
 * Her mood about her club, -1 to +1: her morale (0-100 about 50) and her club's
 * form this season (its World Tour record), equally. Low morale at a losing
 * club is near -1, high morale at a winning one near +1.
 */
export function moodTx(tx: Tx, careerSaveId: number, playerId: number, club: Club, today: string): number {
  const morale = Number(stateOf(tx, careerSaveId, playerId)?.morale ?? 50);
  const moraleTerm = Math.max(-1, Math.min(1, (morale - 50) / 50));
  const row = worldTourStandingsTx(tx, careerSaveId, Number(today.slice(0, 4)))
    .find((s) => ("teamId" in club ? s.teamId === club.teamId : s.poolTeamId === club.poolTeamId));
  const played = (row?.wins ?? 0) + (row?.losses ?? 0);
  const formTerm = played > 0 ? (row!.wins - row!.losses) / played : 0;
  return (moraleTerm + formTerm) / 2;
}

/** Pay (or, `sign` -1, give back) a deal's fee: the buyer pays, the club she leaves is paid. */
export function moveFeeTx(tx: Tx, careerSaveId: number, deal: TransferDeal, today: string, name: string, sign: 1 | -1): void {
  const from = fromOf(deal), to = toOf(deal), fee = Number(deal.fee) * sign;
  if (fee === 0) return;
  const fromName = clubNameTx(tx, from), toName = clubNameTx(tx, to);
  const teamPays = (teamId: number, amount: number, type: "expense" | "income", description: string) => {
    const b = Number(tx.select({ b: teamsTable.budget }).from(teamsTable).where(eq(teamsTable.id, teamId)).get()?.b ?? 0);
    tx.update(teamsTable).set({ budget: b + (type === "income" ? amount : -amount) }).where(eq(teamsTable.id, teamId)).run();
    tx.insert(financeTransactionsTable).values({ teamId, type, amount: Math.abs(amount), category: "transfer_fee", date: today, description }).run();
  };
  if ("teamId" in to) teamPays(to.teamId, fee, sign > 0 ? "expense" : "income", sign > 0 ? `Transfer fee: ${name} from ${fromName}` : `Transfer fee returned: ${name} (the move fell through)`);
  else addToBalance(tx, careerSaveId, to.poolTeamId, -fee);
  if ("teamId" in from) teamPays(from.teamId, fee, sign > 0 ? "income" : "expense", sign > 0 ? `Transfer fee: ${name} sold to ${toName}` : `Transfer fee repaid: ${name} (the move fell through)`);
  else addToBalance(tx, careerSaveId, from.poolTeamId, fee);
}

/** Whether a club can pay `amount` now: the player's budget, or an AI club's balance above its reserve. */
export function canPayTx(tx: Tx, careerSaveId: number, club: Club, amount: number): boolean {
  if ("teamId" in club) return Number(tx.select({ b: teamsTable.budget }).from(teamsTable).where(eq(teamsTable.id, club.teamId)).get()?.b ?? 0) >= amount;
  return balanceOf(tx, careerSaveId, club.poolTeamId) >= amount + AI_BUY_RESERVE;
}

/**
 * An AI holding club's one chance (AC-10, "AI clubs counter too, by their money
 * and cap"): it matches the bid's terms if it can pay AI_TRANSFER_TERMS
 * .counterMonths of the extra cost from its balance above its reserve and the
 * match fits under its cap. Else no counter: she goes.
 */
export function aiCounterFor(tx: Tx, careerSaveId: number, poolTeamId: number, current: { salary: number; perks: string; rating: number }, bid: TransferTerms): TransferTerms | null {
  const wage = Math.min(bid.wage, Math.round(monthlySalaryFor(current.rating) * AI_TRANSFER_TERMS.counterCeiling));
  const extra = (wage + perksMonthly(bid.perks)) - (current.salary + perksMonthly(current.perks));
  if (extra > 0 && balanceOf(tx, careerSaveId, poolTeamId) - AI_BUY_RESERVE < extra * AI_TRANSFER_TERMS.counterMonths) return null;
  if (wageCapRefusal(committedWageBillTx(tx, careerSaveId, { poolTeamId }), extra)) return null;
  // Rob, 24 Oct: an AI club can't hold her on 6 months; it counters a 6-month bid with a season.
  return { wage, length: seasonLength(bid.length), perks: bid.perks };
}

/** An AI club's perks for an offer: cheapest first, while they cost at most perkShare of the wage and fit in `room`. */
export function aiOfferPerks(wage: number, room: number): string {
  const keys: string[] = [];
  let spent = 0;
  for (const p of [...PERKS].sort((a, b) => a.monthly - b.monthly)) {
    if (spent + p.monthly > AI_TRANSFER_TERMS.perkShare * wage || spent + p.monthly > room) break;
    keys.push(p.key); spent += p.monthly;
  }
  return perksText(keys);
}

/**
 * A bid for a senior under contract at another club. Refused (in plain words)
 * if she is not, if she already has an open deal, if it breaks the buyer's cap
 * on her arrival date, or if the buyer can't pay the fee. Otherwise it is
 * offered; an AI holding club answers at once, the player's club has
 * COUNTER_OFFER.answerDays, and a club nobody runs lets her go.
 */
export function bidTx(w: CareerStateTx, careerSaveId: number, buyer: Club, playerId: number, terms: TransferTerms, fee: number, today: string, freeing = 0): BidResult {
  const tx = w.tx;
  const her = stateOf(tx, careerSaveId, playerId);
  if (!her || her.isRetired) return { ok: false, reason: "No such player." };
  if (her.playerType === "youth" && !her.isPromoted) return { ok: false, reason: `${her.name} is a youth: youths aren't covered by the transfer window.` };
  const holding: Club | null = her.teamId != null ? { teamId: her.teamId } : her.poolTeamId != null ? { poolTeamId: her.poolTeamId } : null;
  if (!holding || !her.contractEndDate) return { ok: false, reason: `${her.name} is not under contract at a club: sign her as a free agent.` };
  if (sameClub(holding, buyer)) return { ok: false, reason: `${her.name} is already at your club.` };
  const open = openDealForTx(tx, careerSaveId, playerId);
  if (open) {
    const other = clubNameTx(tx, toOf(open));
    return { ok: false, reason: open.status === "agreed"
      ? `${her.name} has already agreed to join ${other} on ${dateText(open.arrivesOn!)}.`
      : `${other} has already bid for ${her.name}; her club is answering it.` };
  }
  const arrivesOn = arrivalDateFor(today, her.contractEndDate);
  // `freeing`: the wage of a senior the buyer lets go when she arrives (a full AI club's weakest).
  const capRefused = wageCapRefusal(seniorWageBillTx(tx, careerSaveId, buyer, arrivesOn) - freeing, terms.wage + perksMonthly(terms.perks));
  if (capRefused) return { ok: false, reason: `On ${dateText(arrivesOn)}, when she would arrive: ${capRefused}` };
  if (!canPayTx(tx, careerSaveId, buyer, fee)) return { ok: false, reason: `Not enough money for her fee of ${money(fee)}.` };

  const deal = tx.insert(transferDealsTable).values({
    careerSaveId, playerId,
    fromTeamId: "teamId" in holding ? holding.teamId : null, fromPoolTeamId: "poolTeamId" in holding ? holding.poolTeamId : null,
    toTeamId: "teamId" in buyer ? buyer.teamId : null, toPoolTeamId: "poolTeamId" in buyer ? buyer.poolTeamId : null,
    fee, wage: terms.wage, length: terms.length, perks: perksText(terms.perks.split(",")), squadRole: terms.squadRole ?? null,
    status: "offered", offeredOn: today, answerBy: addDays(today, COUNTER_OFFER.answerDays), arrivesOn,
  }).returning().get();

  // The holding club's one chance.
  if ("poolTeamId" in holding) {
    const counter = aiCounterFor(tx, careerSaveId, holding.poolTeamId, { salary: Number(her.salary), perks: her.perks, rating: overallRating(her) }, terms);
    if (!counter) return { ok: true, deal, outcome: agreeTx(w, careerSaveId, deal.id, today) };
    return { ok: true, deal, outcome: answerWithCounterTx(w, careerSaveId, deal.id, counter, today) };
  }
  // The player's own club answers from his Team page; any other teams row has nobody to answer.
  if (holding.teamId === careerTeamIdTx(tx, careerSaveId)) return { ok: true, deal, outcome: "offered" };
  return { ok: true, deal, outcome: agreeTx(w, careerSaveId, deal.id, today) };
}

/**
 * The holding club's counter-offer: she weighs it against the bid (wage over the
 * contract plus her perks' pull), and when they are close her mood decides.
 * She stays (her contract becomes the counter's terms, from today) or goes.
 */
export function answerWithCounterTx(w: CareerStateTx, careerSaveId: number, dealId: number, counter: TransferTerms, today: string): "kept" | "agreed" | "moved" | "fell_through" {
  const tx = w.tx;
  const deal = tx.select().from(transferDealsTable).where(eq(transferDealsTable.id, dealId)).get()!;
  const holding = fromOf(deal);
  const bidValue = offerValue({ wage: Number(deal.wage), length: deal.length, perks: deal.perks });
  const counterPerks = perksText(counter.perks.split(","));
  const counterValue = offerValue({ wage: counter.wage, length: counter.length, perks: counterPerks });
  const verdict = staysForCounter(bidValue, counterValue, moodTx(tx, careerSaveId, deal.playerId, holding, today));
  tx.update(transferDealsTable).set({ counterWage: counter.wage, counterLength: counter.length, counterPerks, moodDecided: verdict.close })
    .where(eq(transferDealsTable.id, dealId)).run();
  if (!verdict.stays) return agreeTx(w, careerSaveId, dealId, today);

  // She stays, on the counter's terms from today.
  const ends = contractEndFrom(counter.length, today, seasonEndsForCareerTx(tx, careerSaveId, today));
  w.setPlayerState(careerSaveId, deal.playerId, { salary: counter.wage, perks: counterPerks, contractEndDate: ends });
  if ("teamId" in holding) {
    tx.update(contractsTable).set({ salary: counter.wage, endDate: ends })
      .where(and(eq(contractsTable.playerId, deal.playerId), eq(contractsTable.teamId, holding.teamId), eq(contractsTable.status, "active"))).run();
  }
  tx.update(transferDealsTable).set({ status: "kept", arrivesOn: null }).where(eq(transferDealsTable.id, dealId)).run();
  return "kept";
}

/** She goes: the fee is paid today and she is the buyer's from her arrival date (today, in the window). */
export function agreeTx(w: CareerStateTx, careerSaveId: number, dealId: number, today: string): "agreed" | "moved" | "fell_through" {
  const tx = w.tx;
  const deal = tx.select().from(transferDealsTable).where(eq(transferDealsTable.id, dealId)).get()!;
  const her = stateOf(tx, careerSaveId, deal.playerId);
  // The buyer must still be able to pay (a bid answered days later).
  if (!her || !("teamId" in toOf(deal) ? canPayTx(tx, careerSaveId, toOf(deal), Number(deal.fee)) : balanceOf(tx, careerSaveId, deal.toPoolTeamId!) >= Number(deal.fee))) {
    tx.update(transferDealsTable).set({ status: "fell_through" }).where(eq(transferDealsTable.id, dealId)).run();
    return "fell_through";
  }
  const arrivesOn = deal.arrivesOn ?? arrivalDateFor(today, her.contractEndDate);
  moveFeeTx(tx, careerSaveId, deal, today, her.name, 1);
  tx.update(transferDealsTable).set({ status: "agreed", agreedOn: today, arrivesOn }).where(eq(transferDealsTable.id, dealId)).run();
  if (arrivesOn <= today) return completeTx(w, careerSaveId, dealId, today);
  return "agreed";
}

/** The day she arrives: she joins the buyer on the deal's terms; her wage and perks start today. */
export function completeTx(w: CareerStateTx, careerSaveId: number, dealId: number, today: string): "moved" | "fell_through" {
  const tx = w.tx;
  const deal = tx.select().from(transferDealsTable).where(eq(transferDealsTable.id, dealId)).get()!;
  const her = stateOf(tx, careerSaveId, deal.playerId);
  const from = fromOf(deal), to = toOf(deal);
  const stillThere = her && !her.isRetired && ("teamId" in from ? her.teamId === from.teamId : her.poolTeamId === from.poolTeamId && her.teamId == null);
  if (!stillThere) {
    // Nothing to move (she retired, or she is no longer there): the fee goes back.
    moveFeeTx(tx, careerSaveId, deal, today, her?.name ?? "the player", -1);
    tx.update(transferDealsTable).set({ status: "fell_through" }).where(eq(transferDealsTable.id, dealId)).run();
    return "fell_through";
  }
  // Rob, 24 Oct (B3): her new deal runs 6 months only at the club the career controls now.
  const length = "teamId" in to && playerContractPartyTx(tx, careerSaveId, to.teamId) === "career_player"
    ? deal.length as ContractLength : seasonLength(deal.length as ContractLength);
  const ends = contractEndFrom(length, today, seasonEndsForCareerTx(tx, careerSaveId, today));
  // Her contract with the club she leaves ends today.
  if ("teamId" in from) {
    tx.update(contractsTable).set({ status: "terminated" })
      .where(and(eq(contractsTable.playerId, deal.playerId), eq(contractsTable.teamId, from.teamId), eq(contractsTable.status, "active"))).run();
  }
  const leftTheList = { onInjuredList: false, injuredListSince: null, injuredListSquad: null };
  if ("teamId" in to) {
    tx.insert(contractsTable).values({ playerId: deal.playerId, teamId: to.teamId, salary: Number(deal.wage), startDate: today, endDate: ends, bonusPerWin: 0 }).run();
    const starters = tx.select({ id: careerPlayerStateTable.playerId }).from(careerPlayerStateTable).where(and(
      eq(careerPlayerStateTable.careerSaveId, careerSaveId), eq(careerPlayerStateTable.teamId, to.teamId),
      eq(careerPlayerStateTable.squadRole, "starter"), eq(careerPlayerStateTable.isRetired, false))).all().length;
    // The place he chose for her, if it is free; else the interchange.
    const squadRole = deal.squadRole !== "interchange" && starters < MAX_STARTERS ? "starter" : "interchange";
    w.setPlayerState(careerSaveId, deal.playerId, {
      teamId: to.teamId, poolTeamId: null, salary: Number(deal.wage), perks: deal.perks, contractEndDate: ends,
      isActive: true, squadRole, poolJoinedOn: null, ...leftTheList,
    });
  } else {
    w.setPlayerState(careerSaveId, deal.playerId, {
      teamId: null, poolTeamId: to.poolTeamId, salary: Number(deal.wage), perks: deal.perks, contractEndDate: ends,
      isActive: false, squadRole: "starter", academyRole: null, poolJoinedOn: today, ...leftTheList,
    });
  }
  tx.update(transferDealsTable).set({ status: "moved", movedOn: today }).where(eq(transferDealsTable.id, dealId)).run();
  // The player's club she left: its injured list follows (a fit player may come back now).
  if ("teamId" in from) clubInjuredListTx(w, careerSaveId, from.teamId);
  return "moved";
}

/**
 * The game day's transfer step (routes/calendar.ts), before contracts expire:
 * a bid the player's club has not answered in time goes through; every deal
 * whose arrival day has come completes; and in the window, AI clubs carrying
 * more seniors than their places let their weakest go. Returns Club News.
 */
export function transfersDayTx(w: CareerStateTx, careerSaveId: number, today: string): string[] {
  const tx = w.tx;
  const news: string[] = [];
  const myTeam = careerTeamIdTx(tx, careerSaveId);
  const nameOf = (id: number) => tx.select({ n: playersTable.name }).from(playersTable).where(eq(playersTable.id, id)).get()?.n ?? "A player";
  let aiSellerLeft = false;
  const aiBuyers = new Map<number, number>();   // AI club -> the player who joined it today
  for (const d of tx.select().from(transferDealsTable).where(and(eq(transferDealsTable.careerSaveId, careerSaveId),
    eq(transferDealsTable.status, "offered"), lt(transferDealsTable.answerBy, today))).all()) {
    const outcome = agreeTx(w, careerSaveId, d.id, today);
    if (d.fromTeamId === myTeam && outcome !== "fell_through") news.push(`${nameOf(d.playerId)} goes to ${clubNameTx(tx, toOf(d))}: no counter-offer by the deadline.`);
  }
  for (const d of tx.select().from(transferDealsTable).where(and(eq(transferDealsTable.careerSaveId, careerSaveId),
    eq(transferDealsTable.status, "agreed"), lte(transferDealsTable.arrivesOn, today))).all()) {
    const outcome = completeTx(w, careerSaveId, d.id, today);
    if (outcome === "moved" && d.fromPoolTeamId != null) aiSellerLeft = true;
    if (outcome === "moved" && d.toPoolTeamId != null) aiBuyers.set(d.toPoolTeamId, d.playerId);
    if (outcome === "moved" && (d.toTeamId === myTeam || d.fromTeamId === myTeam)) {
      news.push(d.toTeamId === myTeam ? `${nameOf(d.playerId)} arrives from ${clubNameTx(tx, fromOf(d))}.` : `${nameOf(d.playerId)} leaves for ${clubNameTx(tx, toOf(d))}.`);
    }
  }
  // A player who leaves an AI club mid-season (her contract ended before the window) can leave it short:
  // it refills that day, by the weekly rule (keepAiSquadsTx), so it never has a match day with one.
  if (aiSellerLeft) keepAiSquadsTx(w, careerSaveId, today, seasonEndsForCareerTx(tx, careerSaveId));
  // A full AI club that bought lets its weakest go the day the new one arrives (its bid counted her wage
  // gone, bidTx `freeing`), even outside the window; in the window every club over its places trims.
  if (inTransferWindow(today)) aiTrimSquadsTx(w, careerSaveId);
  else if (aiBuyers.size > 0) aiTrimSquadsTx(w, careerSaveId, new Set(aiBuyers.keys()));
  // And every AI club a bought player joined today is under its cap (its bid counted on it).
  if (aiBuyers.size > 0) aiCapOnArrivalTx(w, careerSaveId, aiBuyers);
  return news;
}

/**
 * Whether the player's club may release `playerId` today (no dumping): yes for
 * an academy player, while the Day 1 draft is open (taking a pick back), in the
 * transfer window, or if she is cover for a player on the injured list who is
 * fit again; otherwise not, in plain words.
 */
export function releaseRefusalTx(tx: Tx, careerSaveId: number, teamId: number, playerId: number, today: string, draftOpen: boolean): string | null {
  if (draftOpen || inTransferWindow(today)) return null;
  const her = stateOf(tx, careerSaveId, playerId);
  if (!her || (her.playerType === "youth" && !her.isPromoted)) return null;
  const s = careerPlayerStateTable;
  const seniors = tx.select({ id: s.playerId, onList: s.onInjuredList, injury: s.injuryStatus, squad: s.injuredListSquad })
    .from(s).innerJoin(playersTable, eq(playersTable.id, s.playerId))
    .where(and(eq(s.careerSaveId, careerSaveId), eq(s.teamId, teamId), eq(s.isRetired, false))).all();
  const fitListed = seniors.filter((p) => p.onList && (p.injury ?? "Healthy") === "Healthy");
  const now = seniors.filter((p) => !p.onList).map((p) => p.id);
  if (fitListed.some((p) => coverOnRoster({ injuredListSquad: p.squad }, now).includes(playerId))) return null;
  const w = nextWindowOpening(today);
  return `You can't release ${her.name} until the transfer window opens on ${dateText(w)}: a club carries its seniors until then. Her contract runs to ${dateText(her.contractEndDate ?? w)}.`;
}

/** Whether her club may renew her: not once she has agreed to go (her fee is paid). */
export function renewalRefusalTx(tx: Tx, careerSaveId: number, playerId: number): string | null {
  const d = openDealForTx(tx, careerSaveId, playerId);
  if (!d || d.status !== "agreed") return null;
  return `${stateOf(tx, careerSaveId, playerId)?.name ?? "She"} has agreed to join ${clubNameTx(tx, toOf(d))} on ${dateText(d.arrivesOn!)}: she can't be renewed.`;
}

/** The deals that touch the player's club, as his Team page shows them. */
export function myTransfersTx(tx: Tx, careerSaveId: number, teamId: number) {
  const rows = tx.select().from(transferDealsTable).where(eq(transferDealsTable.careerSaveId, careerSaveId)).all()
    .filter((d) => d.toTeamId === teamId || d.fromTeamId === teamId);
  const view = (d: TransferDeal) => ({
    id: d.id, playerId: d.playerId,
    player: tx.select({ n: playersTable.name, img: playersTable.imageUrl }).from(playersTable).where(eq(playersTable.id, d.playerId)).get() ?? null,
    from: clubNameTx(tx, fromOf(d)), to: clubNameTx(tx, toOf(d)), fee: Number(d.fee), wage: Number(d.wage), length: d.length, perks: d.perks,
    perksMonthly: perksMonthly(d.perks), status: d.status, offeredOn: d.offeredOn, answerBy: d.answerBy, arrivesOn: d.arrivesOn,
    counter: d.counterWage != null ? { wage: Number(d.counterWage), length: d.counterLength, perks: d.counterPerks ?? "" } : null, moodDecided: d.moodDecided,
  });
  return {
    /** Bids for his players that he has not answered (Counter or Let her go). */
    offers: rows.filter((d) => d.fromTeamId === teamId && d.status === "offered").map(view),
    /** Players he has bought ahead, and when they arrive. */
    incoming: rows.filter((d) => d.toTeamId === teamId && d.status === "agreed").map(view),
    /** His players sold ahead, and when they leave. */
    outgoing: rows.filter((d) => d.fromTeamId === teamId && d.status === "agreed").map(view),
    /** What became of the rest, newest first. */
    history: rows.filter((d) => !["offered", "agreed"].includes(d.status)).sort((a, b) => b.id - a.id).slice(0, 20).map(view),
  };
}

/** Each bought-ahead player's move, for the Player Market ("Joins [club] on [date]"). */
export function agreedMovesTx(tx: Tx, careerSaveId: number): Map<number, { club: string; on: string }> {
  return new Map(tx.select().from(transferDealsTable).where(and(eq(transferDealsTable.careerSaveId, careerSaveId), eq(transferDealsTable.status, "agreed"))).all()
    .map((d) => [d.playerId, { club: clubNameTx(tx, toOf(d)), on: d.arrivesOn! }]));
}

/** Whether `playerId` has agreed to go (an AI club's renewal skips her). */
export function hasAgreedMoveTx(tx: Tx, careerSaveId: number, playerId: number): boolean {
  return openDealForTx(tx, careerSaveId, playerId)?.status === "agreed";
}

