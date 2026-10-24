/**
 * 1.1.1, Part 5 (Rob, 16 Oct, AC-6 A): the AI clubs' youths.
 *
 * Any AI club's own academy youth can be asked for at any time, on loan or to
 * buy. The selling club answers by its own position (YOUTH_DEALS in lib/db
 * schema/transfers.ts):
 *
 *   a loan  is always agreed while her age allows one (6 or 12 months, the
 *           loan market's rules: utils/youthLoans.ts borrowTx)
 *   a sale  is a chance: the buyer's scout negotiates (youthSaleChance). With
 *           a weak scout, or none, the club offers only a loan. It sells more
 *           readily when it has youths to spare or needs cash, less when she
 *           plays in its youth team.
 *
 * The buyer's scout is its best Scout on duty; a club with no Scout is
 * represented by its best coach (Head or Assistant Coach) on duty, by their
 * scouting rating. One rule for every club: the AI clubs hire no Scouts, so
 * their coaches negotiate.
 *
 * 1.1.1, Part 10 (Rob, S-1 A): the negotiator works on at most
 * SCOUT_REPORTS_AT_ONCE jobs at a time, as a report: asking to buy a youth puts
 * a negotiation (SCOUT_DAYS long) on that person's list. With every Scout and
 * coach busy, no sale can be asked for (a loan needs no negotiation). The same
 * person keeps a youth's negotiation while it runs: asking again then adds no job.
 *
 * The club's answer for a youth and a buyer holds for YOUTH_DEALS.answerDays
 * (asking again the same week gets the same answer): the roll is fixed by the
 * career, the youth, the buyer and the week.
 *
 * A bought youth joins the buyer's academy (ACADEMY_CAP places) and the
 * selling club is paid her youth price (utils/marketScouting.ts youthPrice).
 * The sale is recorded in transfer_deals (squad_role "academy", status moved).
 * AI clubs buy each other's youths the same way, in their weekly academy step.
 * A youth of the player's own club is his to list for loan (Team > Youth Loans);
 * the AI clubs ask only each other.
 */
import {
  careerPlayerStateTable, playersTable, contractsTable, youthLoansTable, transferDealsTable,
  normaliseRole, YOUTH_DEALS, youthSaleChance, type TransferDeal,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { loadStaffTx, type CareerStateTx } from "../lib/playerDto.js";
import { pickScouterTx, addScoutingJobTx, jobsInProgressTx } from "./scoutingWork.js";
import { addDays } from "./scoutReports.js";
import { ACADEMY_CAP, ACADEMY_YOUTH_TEAM } from "./squadRules.js";
import {
  academyAtTx, academyCountTx, allowedMonths, borrowTx, ensureYouthTeamTx, loansTx, placeSignedYouthTx, youthRating, AI_BORROW_GAP,
  type Club,
} from "./youthLoans.js";
import { balanceOf, AI_BUY_RESERVE } from "./aiSquads.js";
import { canPayTx, moveFeeTx } from "./transfers.js";
import { youthPrice, SCOUT_DAYS } from "./marketScouting.js";
import { academyMonthlySalary } from "./academy.js";
import { contractEndDate, seasonLength, type ContractLength } from "./contractTerms.js";
import { seasonEndsForCareerTx } from "./seasonDates.js";
import { aiSeasonMovesTx, mayBid, recordAiMoveTx } from "./aiMarketLimits.js";

type Tx = CareerStateTx["tx"];
const isTeam = (c: Club): c is { teamId: number } => "teamId" in c;
const clubKey = (c: Club) => (isTeam(c) ? `t${c.teamId}` : `p${c.poolTeamId}`);

export type Negotiator = { id: number | null; skill: number; name: string | null; role: string | null; busy: string | null; already: boolean };

/**
 * The buyer's negotiator for this youth: whoever already has her negotiation in
 * hand, else its best Scout on duty with a job free, else its best coach on
 * duty with one free; skill 0 with nobody (`busy` says why when everyone is).
 */
export function negotiatorSkillTx(tx: Tx, careerSaveId: number, club: Club, today: string, playerId?: number): Negotiator {
  const staff = loadStaffTx(tx, careerSaveId, isTeam(club) ? { teamId: club.teamId } : { poolTeamId: club.poolTeamId });
  const running = playerId == null ? undefined
    : jobsInProgressTx(tx, careerSaveId, club, today).find((j) => j.kind === "youth_deal" && j.targetId === playerId);
  const holder = running ? staff.find((s) => s.id === running.staffId) : undefined;
  if (holder) return { id: holder.id, skill: holder.scoutingRating ?? holder.overallRating, name: holder.name, role: normaliseRole(holder.role ?? ""), busy: null, already: true };
  const pick = pickScouterTx(tx, careerSaveId, club, [["scout"], ["head_coach", "assistant_coach"]], today);
  if (pick.scouter) return { id: pick.scouter.id, skill: pick.scouter.rating, name: pick.scouter.name, role: pick.scouter.role, busy: null, already: false };
  return { id: null, skill: 0, name: null, role: null, busy: pick.busy, already: false };
}

/** A fixed number in [0, 1): this career, youth, buyer and week (FNV-1a). */
function weekRoll(careerSaveId: number, playerId: number, buyer: Club, today: string): number {
  const week = Math.floor(Date.parse(`${today}T00:00:00Z`) / (YOUTH_DEALS.answerDays * 86_400_000));
  let h = 0x811c9dc5;
  for (const ch of `${careerSaveId}:${playerId}:${clubKey(buyer)}:${week}:youth-deal`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h / 0x100000000;
}

type Youth = { playerId: number; name: string; age: number; potential: string | null; academyRole: string | null; poolTeamId: number };

/** An AI club's own youth, at home (not on loan either way). */
function aiYouthTx(tx: Tx, careerSaveId: number, playerId: number): Youth | { error: string } {
  const r = tx.select({
    playerId: careerPlayerStateTable.playerId, name: playersTable.name, age: careerPlayerStateTable.age, potential: playersTable.potential,
    academyRole: careerPlayerStateTable.academyRole, poolTeamId: careerPlayerStateTable.poolTeamId, teamId: careerPlayerStateTable.teamId,
    type: playersTable.playerType, promoted: careerPlayerStateTable.isPromoted,
  }).from(careerPlayerStateTable).innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
    .where(and(eq(careerPlayerStateTable.careerSaveId, careerSaveId), eq(careerPlayerStateTable.playerId, playerId))).get();
  const loan = loansTx(tx, careerSaveId, "active").find((l) => l.playerId === playerId);
  if (r && loan) return { error: `${r.name} is on loan until ${loan.endsOn}: ask again when she is back at her own club.` };
  if (!r || r.type !== "youth" || r.promoted || r.poolTeamId == null || r.teamId != null) return { error: "She is not in an AI club's academy." };
  return { ...r, poolTeamId: r.poolTeamId };
}

/** The selling club's position for her: own youths (at home and away on loan, less any borrowed in), her place, its cash. */
export function sellerPositionTx(tx: Tx, careerSaveId: number, poolTeamId: number, playerId: number) {
  const borrowedIn = loansTx(tx, careerSaveId, "active").filter((l) => l.borrowerPoolTeamId === poolTeamId).length;
  const ownYouths = academyCountTx(tx, careerSaveId, { poolTeamId }) - borrowedIn;
  const inYouthTeam = academyAtTx(tx, careerSaveId, { poolTeamId }).find((r) => r.playerId === playerId)?.academyRole === "youth_team";
  const needsCash = balanceOf(tx, careerSaveId, poolTeamId) < AI_BUY_RESERVE;
  return { ownYouths, inYouthTeam, needsCash };
}

export type YouthAsk = {
  chance: number; roll: number; sells: boolean; scout: Negotiator;
  position: ReturnType<typeof sellerPositionTx>; loanMonths: number[]; price: number;
};

/** What her club would answer this buyer this week (nothing changes). */
export function askYouthTx(tx: Tx, careerSaveId: number, buyer: Club, playerId: number, today: string, priceFactor = 1): YouthAsk | { error: string } {
  const her = aiYouthTx(tx, careerSaveId, playerId);
  if ("error" in her) return her;
  if (!isTeam(buyer) && buyer.poolTeamId === her.poolTeamId) return { error: "She is the club's own youth." };
  const scout = negotiatorSkillTx(tx, careerSaveId, buyer, today, playerId);
  const position = sellerPositionTx(tx, careerSaveId, her.poolTeamId, playerId);
  const chance = youthSaleChance(scout.skill, position.ownYouths, position.inYouthTeam, position.needsCash);
  const roll = weekRoll(careerSaveId, playerId, buyer, today);
  return {
    chance, roll, sells: roll < chance, scout, position, loanMonths: allowedMonths(her.age, today),
    price: youthPrice(careerSaveId, { id: her.playerId, potential: her.potential ?? "Average" }, priceFactor).price,
  };
}

export type YouthDealResult =
  | { outcome: "loaned"; loanId: number; months: number; endsOn: string | null; weeklyWage: number; yourHalf: number }
  | { outcome: "bought"; dealId: number; fee: number; academyPlace: "youth_team" | "reserve" | null }
  | { outcome: "loan_only"; chance: number; loanMonths: number[]; scout: YouthAsk["scout"] }
  | { error: string };

/**
 * Ask her club for her: `kind` "loan" (for `months`) or "buy". A refused sale
 * answers "loan_only": the club offers her on loan instead.
 */
export function youthDealTx(
  w: CareerStateTx, careerSaveId: number, buyer: Club, playerId: number, kind: "loan" | "buy", today: string,
  opts: { months?: number; length?: ContractLength; academyRole?: "youth_team" | "reserve"; priceFactor?: number } = {},
): YouthDealResult {
  const { tx } = w;
  const ask = askYouthTx(tx, careerSaveId, buyer, playerId, today, opts.priceFactor);
  if ("error" in ask) return ask;
  if (academyCountTx(tx, careerSaveId, buyer) >= ACADEMY_CAP) return { error: `The academy is full (${ACADEMY_CAP}).` };
  const her = aiYouthTx(tx, careerSaveId, playerId) as Youth;
  const seller = { poolTeamId: her.poolTeamId };

  if (kind === "loan") {
    const months = opts.months ?? Math.max(0, ...ask.loanMonths);
    if (!ask.loanMonths.includes(months)) {
      return { error: ask.loanMonths.length === 0 ? `${her.name} leaves the academy on 1 January: too late for a loan.` : `A loan for her is ${ask.loanMonths.join(" or ")} months.` };
    }
    // Her club agrees: she is listed for this loan (an open listing of hers is used) and borrowed.
    let listing = loansTx(tx, careerSaveId, "listed").find((l) => l.playerId === playerId);
    if (!listing) {
      listing = tx.insert(youthLoansTable).values({ careerSaveId, playerId, status: "listed", listedOn: today, ownerTeamId: null, ownerPoolTeamId: her.poolTeamId })
        .returning().all()[0]!;
    }
    const r = borrowTx(w, careerSaveId, buyer, listing.id, months, today);
    if ("error" in r) return r;
    return { outcome: "loaned", loanId: r.loan.id, months, endsOn: r.loan.endsOn, weeklyWage: r.loan.weeklyWage ?? 0, yourHalf: r.halves.borrower };
  }

  // Part 10: asking to buy is a negotiation, one of the negotiator's jobs. With everyone busy it can't be asked.
  if (ask.scout.id == null && ask.scout.busy) return { error: ask.scout.busy };
  if (ask.scout.id != null && !ask.scout.already) {
    addScoutingJobTx(tx, careerSaveId, buyer, ask.scout.id, { kind: "youth_deal", targetId: playerId, targetName: her.name, startedOn: today, readyOn: addDays(today, SCOUT_DAYS) });
  }
  if (!ask.sells) return { outcome: "loan_only", chance: ask.chance, loanMonths: ask.loanMonths, scout: ask.scout };
  if (!canPayTx(tx, careerSaveId, buyer, ask.price)) {
    return { error: isTeam(buyer) ? `Not enough money: ${her.name} costs $${ask.price.toLocaleString()}.` : "The club can't pay her price." };
  }
  // Sold: the deal on record, the fee paid (buyer to seller), and she joins the buyer's academy.
  const deal = tx.insert(transferDealsTable).values({
    careerSaveId, playerId, fromTeamId: null, fromPoolTeamId: her.poolTeamId,
    toTeamId: isTeam(buyer) ? buyer.teamId : null, toPoolTeamId: isTeam(buyer) ? null : buyer.poolTeamId,
    fee: ask.price, wage: academyMonthlySalary(her.potential), length: isTeam(buyer) ? opts.length ?? "1s" : seasonLength(opts.length ?? "1s"), perks: "", squadRole: "academy",
    status: "moved", offeredOn: today, answerBy: today, agreedOn: today, arrivesOn: today, movedOn: today, createdAt: new Date(),
  }).returning().all()[0]! as TransferDeal;
  moveFeeTx(tx, careerSaveId, deal, today, her.name, 1);
  tx.update(youthLoansTable).set({ status: "withdrawn" })
    .where(and(eq(youthLoansTable.careerSaveId, careerSaveId), eq(youthLoansTable.playerId, playerId), eq(youthLoansTable.status, "listed"))).run();
  let academyPlace: "youth_team" | "reserve" | null = null;
  if (isTeam(buyer)) {
    // The player's club: an academy contract, as a youth signed off the market (routes/contracts.ts).
    const wage = academyMonthlySalary(her.potential);
    const endDate = contractEndDate(opts.length ?? "1s", today, seasonEndsForCareerTx(tx, careerSaveId, today));
    tx.insert(contractsTable).values({ playerId, teamId: buyer.teamId, salary: wage, startDate: today, endDate, bonusPerWin: 0 }).run();
    w.setPlayerState(careerSaveId, playerId, { teamId: buyer.teamId, poolTeamId: null, salary: wage, contractEndDate: endDate, isActive: false, squadRole: "reserve", perks: "" });
    academyPlace = placeSignedYouthTx(w, careerSaveId, buyer.teamId, playerId, opts.academyRole ?? "youth_team");
  } else {
    w.setPlayerState(careerSaveId, playerId, { poolTeamId: buyer.poolTeamId, academyRole: "reserve" });
    ensureYouthTeamTx(w, careerSaveId, buyer);
  }
  ensureYouthTeamTx(w, careerSaveId, seller);
  return { outcome: "bought", dealId: deal.id, fee: ask.price, academyPlace };
}

/**
 * The AI clubs' youth buys for a week (in their academy step, after borrowing):
 * up to YOUTH_DEALS.aiBuysPerWeek clubs with academy room, money above their
 * reserve and a Scout or coach to negotiate (the best negotiators first) ask
 * another AI club for the best youth who beats their weakest
 * youth-team player by AI_BORROW_GAP. Sold, she joins; offered only a loan,
 * the club takes the loan if it has no loan in already.
 */
export function aiYouthBuysWeekTx(w: CareerStateTx, careerSaveId: number, today: string, clubs: number[]):
  { bought: Array<{ playerId: number; from: number; to: number; fee: number }>; loaned: number } {
  const { tx } = w;
  const bought: Array<{ playerId: number; from: number; to: number; fee: number }> = [];
  let loaned = 0, asked = 0;
  // The clubs with the best negotiators go looking first (ties in a random order).
  const order = clubs.map((id) => ({ id, skill: negotiatorSkillTx(tx, careerSaveId, { poolTeamId: id }, today).skill, r: Math.random() }))
    .sort((a, b) => b.skill - a.skill || a.r - b.r).map((c) => c.id);
  for (const poolTeamId of order) {
    if (asked >= YOUTH_DEALS.aiBuysPerWeek) break;
    const club = { poolTeamId };
    if (academyCountTx(tx, careerSaveId, club) >= ACADEMY_CAP) continue;
    if (balanceOf(tx, careerSaveId, poolTeamId) < AI_BUY_RESERVE) continue;
    // No one to negotiate a sale (no Scout or coach above the floor): it borrows from the loan list instead.
    if (negotiatorSkillTx(tx, careerSaveId, club, today).skill <= YOUTH_DEALS.scoutFloor) continue;
    const team = academyAtTx(tx, careerSaveId, club).filter((r) => r.academyRole === "youth_team");
    const weakest = team.length < ACADEMY_YOUTH_TEAM ? 0 : Math.min(...team.map(youthRating));
    const onLoan = new Set(loansTx(tx, careerSaveId, "active").map((l) => l.playerId));
    const others = clubs.filter((c) => c !== poolTeamId);
    // 1.1.3 (A3): a buy offer is one of the club's season's bids (AI_SEASON_LIMITS: 10, 2 to any one club).
    const moves = aiSeasonMovesTx(tx, careerSaveId, poolTeamId, today);
    const best = others.flatMap((c) => academyAtTx(tx, careerSaveId, { poolTeamId: c }))
      .filter((r) => r.poolTeamId != null && !onLoan.has(r.playerId) && youthRating(r) >= weakest + AI_BORROW_GAP && mayBid(moves, { poolTeamId: r.poolTeamId }))
      .sort((a, b) => youthRating(b) - youthRating(a))[0];
    if (!best) continue;
    asked++;
    const r = youthDealTx(w, careerSaveId, club, best.playerId, "buy", today);
    // Asked (sold, or refused with a loan offered instead): the bid counts. An ask that couldn't be made (no one
    // free to negotiate, no money) is not a bid.
    if ("outcome" in r) recordAiMoveTx(tx, careerSaveId, poolTeamId, "bid", best.playerId, { poolTeamId: best.poolTeamId! }, today);
    if ("outcome" in r && r.outcome === "bought") bought.push({ playerId: best.playerId, from: best.poolTeamId!, to: poolTeamId, fee: r.fee });
    else if ("outcome" in r && r.outcome === "loan_only" && r.loanMonths.length > 0
      && !loansTx(tx, careerSaveId, "active").some((l) => l.borrowerPoolTeamId === poolTeamId)) {
      const l = youthDealTx(w, careerSaveId, club, best.playerId, "loan", today);
      if ("outcome" in l && l.outcome === "loaned") loaned++;
    }
  }
  return { bought, loaned };
}

