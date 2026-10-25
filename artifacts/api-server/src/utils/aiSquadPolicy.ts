/**
 * 1.1.3 (Rob, 26 Oct; squad policy brief, item A): THE AI clubs' squad policy. Every decision about who an
 * AI club holds is made here, and only here (harness/squad-policy.mjs asserts it): renewals, releases, the
 * market, the third place, injured-list cover, deadwood, the age rule, the cap rule and arrivals, its bids for
 * the player's seniors and its counter-offers, and the Day 1 academies. The game calls one function,
 * aiSquadPolicyTx, at six moments:
 *
 *   day1     the Day 1 draft closes (utils/day1Draft.ts): the AI academies are filled, then every club fills
 *            its places, in random order
 *   week     the weekly block (routes/calendar.ts): deadwood, the market (scouting; in the transfer window the
 *            signings), the bids for the player's seniors, then every club is settled
 *   day      every game day (utils/injuredList.ts): every club is settled
 *   injury   one of its seniors went on the injured list after a match (utils/aiSquads.ts): that club settled,
 *            so she is covered the same day
 *   arrival  a player bought ahead joined it (utils/transfers.ts completeTx): that club settled, trimming
 *   turn     the season's turn (utils/seasonRollover.ts): every club is settled
 *
 * Settling a club (settleClubTx) applies its rules in this order:
 *
 *   1. contracts. A contract that has run out is renewed only for the club's best senior by overall rating
 *      (Rob, 25 Oct), once a season, if it fits under the cap with room left for its other places at the
 *      cheapest free agents' wages (three rather than two); every other one is released to the market. In
 *      the transfer window its best is renewed early on the same terms, so the market knows its places.
 *      A senior out MONEY.salaryCap.injuredLongWeeks or more is never renewed. One who has agreed to go is
 *      left to her move.
 *   2. returns. A senior on the injured list who is fit again comes off it; with AI_MAX_SQUAD already
 *      holding places, her cover goes (outside the window only her cover, a senior who joined while she was
 *      on the list; in it, its weakest).
 *   3. trim. Over its places (more than AI_MAX_SQUAD holding one) it lets its weakest go: in the window, and
 *      on the day a player it bought arrives (its bid counted that weakest's wage gone). Never the one who has
 *      just arrived, never one who has agreed to go, never below AI_MIN_SQUAD.
 *   4. the cap on arrival. The day a bought player joins, it is under its cap: its weakest goes until it is
 *      (never below AI_MIN_SQUAD). So every other test of its cap counts the wage of its bid still waiting for an
 *      answer (heldBillTx): a bid he leaves unanswered goes through with no second look at the cap.
 *   5. places. Below AI_MAX_SQUAD holding places, it fills them, one rule for every reason a place is open
 *      (a release, a retirement, a move, a senior on the injured list):
 *        to make two: the best free agent it can pay and fit, keeping room for the cheapest who would make
 *          three where it can (two first); else its academy's best youth of PROMOTION_MIN_AGE (16) or more,
 *          who is never blocked by the cap (Rob's C-5); else the cheapest-wage free agent on credit, the best
 *          of those (five loss-making seasons sell a club, and the sale clears its debts). Any age.
 *        the third place (the interchange, item 4): the best free agent it can pay and fit under its cap,
 *          younger than AI_DEADWOOD.askAge (its deadwood rule would ask an older one to retire); else its
 *          academy's best youth (16+) if her wage fits under its cap; else it stays on two.
 *        A place open because a senior is on the injured list (cover) is filled from the academy first, then
 *        the market (Night 2, O-10); any other from the market first, then the academy.
 *
 * And at the weekly block only, before settling:
 *
 *   deadwood. It asks a senior to retire when she is broken down (a reconstruction, or on the injured list)
 *     and AI_DEADWOOD.brokenAge or more, at any time; in the window also its weakest at askAge or more; and
 *     in the window lists its weakest at listAge or more. One a club a week, and only a club that keeps two.
 *   the market (Rob, 25 Oct; brief item 1). Through the year a club with places to fill for next season
 *     scouts for them; in the window it signs from the free agents for each, paying her price, and lets a
 *     player whose contract ends go when her place or wage is needed (marketWindowTx). Never one of
 *     askAge or more. AI clubs never buy from each other.
 *   bids for the player's seniors (his 16 Oct counter-offer feature, which his Team page answers).
 *     THE BID BAR (Rob, 26 Oct): an AI club bids for one of his seniors only if she is at least AI_BUY_GAP (5)
 *     better than its WEAKER STARTER (the second best of its seniors holding a place): a player who would walk
 *     into its starting pair. A club doesn't pay a transfer fee for an interchange, so its third senior plays
 *     no part (until 26 Oct the bar was its weakest, and the cheap third that item 4 gives every club dragged
 *     it down, so more of his seniors cleared it by accident). A senior he has transfer-listed is wanted at
 *     the weaker starter's level itself (LISTED_TERMS). The soak reports the rate per season.
 *   counter-offers. An AI club whose senior the player bids for answers at once (aiCounterFor).
 */
import {
  youthLoansTable, perksMonthly, careerPlayerStateTable, playersTable, continentalPoolTeamsTable, careerPoolTeamStateTable,
  contractsTable, transferDealsTable, MONEY, PROMOTION_MIN_AGE, AI_TRANSFER_TERMS, db,
} from "@workspace/db";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import type { CareerStateTx } from "../lib/playerDto.js";
import { aiSquadsTx, balanceOf, addToBalance, AI_MIN_SQUAD, AI_MAX_SQUAD, type AiMember } from "./aiSquads.js";
import { overallRating } from "./overallRating.js";
import { monthlySalaryFor } from "./clubFinances.js";
import { renewalEndDate, terminationPayout, seasonLength } from "./contractTerms.js";
import { lengthForRating } from "./poolClubFinances.js";
import { marketPrice, SCOUT_DAYS } from "./marketScouting.js";
import { seniorWageBillTx, committedWageBillTx, fitsUnderCap, renewalCapRefusalTx, wageCapRefusal, SALARY_CAP } from "./salaryCap.js";
import { contractEndFrom, inTransferWindow, transferWindowFor } from "./transferWindow.js";
import { coverOnRoster } from "./injuredList.js";
import { bidTx, aiOfferPerks, arrivalDateFor, openDealForTx, careerTeamIdTx, hasAgreedMoveTx, type Club, type TransferTerms } from "./transfers.js";
import { askingWage } from "./wageCurve.js";
import { isInjured } from "./condition.js";
import { reconstructionsTx } from "./retirement.js";
import { seasonEndsForCareerTx } from "./seasonDates.js";
import { pickScouterTx, addScoutingJobTx } from "./scoutingWork.js";
import { aiSeasonMovesTx, mayBid, mayScout, recordAiMoveTx, aiRenewalsTx, leftClubTx, seasonYearOf, type MoveTarget } from "./aiMarketLimits.js";
import { fillAiAcademiesTx } from "./youthLoans.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Bids for the player's seniors a week, at most, across all AI clubs. */
export const AI_TRANSFERS_PER_WEEK = 2;
/** The bid bar: a player at least this much better than the club's weaker starter (see the header). */
export const AI_BUY_GAP = 5;
/** What an AI club keeps in the bank after buying, beyond the fee. */
export const AI_BUY_RESERVE = 150_000;
/** The player's senior must have been his this long (her contract's start) before an AI club bids for her. */
export const AI_KEEP_DAYS = 365;
/**
 * 1.1.1 (Rob, 18 Oct): a senior on the transfer list (career_player_state.transfer_listed, by the
 * player's club or an AI club) is wanted without AI_BUY_GAP and for feeShare of her market price.
 */
export const LISTED_TERMS = { feeShare: 0.75 } as const;
/**
 * 1.1.1 (Rob, 18 Oct): an AI club's deadwood. It asks a senior to retire when she is broken down (a
 * reconstruction, or on the injured list) and at least brokenAge, at any time; in the transfer window, also
 * its weakest senior at askAge or more. In the window it lists its weakest at listAge or more. One a club a
 * week, and only a club that keeps two to play. askAge is also the age rule: the market, the third place and
 * cover while two still play never sign a free agent that old (1.1.3, 25 Oct).
 */
export const AI_DEADWOOD = { brokenAge: 30, askAge: 35, listAge: 31 } as const;

export type SquadEvent =
  | { kind: "day1"; today: string; random?: () => number }
  | { kind: "week"; today: string }
  | { kind: "day"; today: string }
  | { kind: "injury"; today: string; poolTeamId: number }
  | { kind: "arrival"; today: string; poolTeamId: number; arrived: number }
  | { kind: "turn"; today: string };

export type SquadPolicyResult = {
  renewed: number; released: number; signed: number; promoted: number; open: number; asked: number; listed: number; short: number;
  bids: Array<{ player: string; from: string; to: number; fee: number; outcome: string }>;
};

type Ctx = {
  w: CareerStateTx; careerSaveId: number; today: string; out: SquadPolicyResult;
  seasonEnds: () => readonly string[];
  /** The squads, rebuilt only after a change. */
  squads: () => Map<number, AiMember[]>; dirty: () => void;
};

/** THE entry point: the policy at one of its six moments (see the header). */
export function aiSquadPolicyTx(w: CareerStateTx, careerSaveId: number, event: SquadEvent): SquadPolicyResult {
  const out: SquadPolicyResult = { renewed: 0, released: 0, signed: 0, promoted: 0, open: 0, asked: 0, listed: 0, short: 0, bids: [] };
  let ends: readonly string[] | null = null, squads: Map<number, AiMember[]> | null = null;
  const ctx: Ctx = {
    w, careerSaveId, today: event.today, out,
    seasonEnds: () => (ends ??= seasonEndsForCareerTx(w.tx, careerSaveId)),
    squads: () => (squads ??= aiSquadsTx(w.tx, careerSaveId)),
    dirty: () => { squads = null; },
  };
  const clubs = activeClubsTx(w.tx, careerSaveId);
  switch (event.kind) {
    case "day1": {
      fillAiAcademiesTx(w, careerSaveId);
      const order = event.random ? clubs.map((c) => ({ c, k: event.random!() })).sort((a, b) => a.k - b.k).map((e) => e.c) : clubs;
      for (const club of order) settleClubTx(ctx, club);
      break;
    }
    case "week":
      deadwoodTx(ctx, clubs);
      // Contracts first (its best renewed early in the window), so the market knows each club's places.
      for (const club of clubs) contractsRuleTx(ctx, club);
      marketScoutingTx(ctx, clubs);
      marketWindowTx(ctx, clubs);
      bidsForHisSeniorsTx(ctx, clubs);
      for (const club of clubs) settleClubTx(ctx, club);
      break;
    case "day":
    case "turn":
      for (const club of clubs) settleClubTx(ctx, club);
      break;
    case "injury":
      settleClubTx(ctx, event.poolTeamId);
      break;
    case "arrival":
      settleClubTx(ctx, event.poolTeamId, event.arrived);
      break;
  }
  return out;
}

function activeClubsTx(tx: Tx, careerSaveId: number): number[] {
  return tx.select({ id: careerPoolTeamStateTable.poolTeamId }).from(careerPoolTeamStateTable)
    .where(and(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), isNull(careerPoolTeamStateTable.takenOverAt))).all().map((r) => r.id);
}

// ── Settling a club: its rules in order ─────────────────────────────────────

function settleClubTx(ctx: Ctx, club: number, arrived?: number): void {
  contractsRuleTx(ctx, club);
  returnsRuleTx(ctx, club);
  if (arrived != null || inTransferWindow(ctx.today)) trimRuleTx(ctx, club, arrived);
  if (arrived != null) capOnArrivalRuleTx(ctx, club, arrived);
  placesRuleTx(ctx, club);
}

/** Rule 1: contracts that ran out, and the one renewal a season (its best). */
function contractsRuleTx(ctx: Ctx, club: number): void {
  const { w, careerSaveId, today } = ctx;
  const squad = ctx.squads().get(club) ?? [];
  const window = inTransferWindow(today);
  let changed = false;
  for (const m of squad) {
    if (m.kind !== "player" || !m.contractEndDate) continue;
    const expired = m.contractEndDate < today;
    // In the window a contract ending this season is decided early (its best renewed), so the market knows its places.
    if (!expired && !(window && m.contractEndDate <= seasonEndOf(today))) continue;
    // 1.1.1: once she has agreed to go (her fee is paid) her club can't renew her.
    if (hasAgreedMoveTx(w.tx, careerSaveId, m.id)) continue;
    const longInjured = m.injured && m.injuryWeeks >= MONEY.salaryCap.injuredLongWeeks;
    const isBest = squad[0]?.id === m.id && squad[0]?.kind === "player";
    const mayRenew = isBest && !longInjured && (expired || !m.onList) && aiRenewalsTx(w.tx, careerSaveId, club, seasonYearOf(m.contractEndDate)) === 0;
    if (mayRenew && renewTx(ctx, club, m, squad)) { changed = true; continue; }
    if (expired) {
      // Item 4c (4): a senior out injuredLongWeeks or more goes to the market at her injured wage there.
      releaseTx(ctx, club, m, m.contractEndDate);
      changed = true;
    }
  }
  if (changed) ctx.dirty();
}

/**
 * The renewal: re-priced to the wage for her rating, on its own length, if that fits under its cap
 * (renewalCapRefusalTx) and leaves room for its other places at the cheapest free agents' wages on the day her
 * new deal starts (three rather than two). Recorded in the season her contract ends in (one a season).
 */
function renewTx(ctx: Ctx, club: number, m: AiMember, squad: readonly AiMember[]): boolean {
  const { w, careerSaveId, today } = ctx;
  if (!m.contractEndDate) return false;
  const wage = monthlySalaryFor(m.rating);
  const perks = perksOfTx(w.tx, careerSaveId, m.id);
  if (renewalCapRefusalTx(w.tx, careerSaveId, { poolTeamId: club }, m.contractEndDate, m.salary + perks, wage + perks) != null) return false;
  const starts = m.contractEndDate < today ? today : nextDay(m.contractEndDate);
  const others = squad.filter((x) => x !== m && !x.onList && (!x.contractEndDate || x.contractEndDate >= starts)).length;
  const toFill = Math.max(0, AI_MAX_SQUAD - 1 - others - comingToTx(w.tx, careerSaveId, club));
  const room = cheapestFreeWagesTx(w.tx, careerSaveId).slice(0, toFill).reduce((t, x) => t + x, 0);
  if (seniorWageBillTx(w.tx, careerSaveId, { poolTeamId: club }, starts) + wage + perks + room > SALARY_CAP) return false;
  const length = lengthForRating(clubRating(w.tx, club));
  w.setPlayerState(careerSaveId, m.id, { salary: wage, contractEndDate: renewalEndDate(length, m.contractEndDate, ctx.seasonEnds()) });
  recordAiMoveTx(w.tx, careerSaveId, club, "renew", m.id, null, m.contractEndDate < today ? m.contractEndDate : today);
  ctx.out.renewed++;
  return true;
}

/** Rule 2: a senior on the injured list who is fit again comes off it; her cover goes if the places are full. */
function returnsRuleTx(ctx: Ctx, club: number): void {
  const { w, careerSaveId, today } = ctx;
  const squad = ctx.squads().get(club) ?? [];
  const back = squad.filter((m) => m.kind === "player" && m.onList && !m.injured);
  if (back.length === 0) return;
  let others = squad.filter((m) => !m.onList);
  for (const m of back) {
    if (others.length >= AI_MAX_SQUAD) {
      // 1.1.1 (no dumping): outside the window only her cover may go (a senior who joined while she was on the list).
      const squadThen = w.tx.select({ s: careerPlayerStateTable.injuredListSquad }).from(careerPlayerStateTable)
        .where(and(eq(careerPlayerStateTable.careerSaveId, careerSaveId), eq(careerPlayerStateTable.playerId, m.id))).get()?.s ?? null;
      const cover = new Set(coverOnRoster({ injuredListSquad: squadThen }, others.map((x) => x.id)));
      const weakest = [...others].filter((x) => x.kind === "player" && (inTransferWindow(today) || cover.has(x.id))).sort((a, b) => a.rating - b.rating)[0];
      if (!weakest) continue;
      releaseTx(ctx, club, weakest, today);
      others = others.filter((x) => x !== weakest);
    }
    w.setPlayerState(careerSaveId, m.id, { onInjuredList: false, injuredListSince: null, injuredListSquad: null, squadRole: "starter" });
    others.push(m);
  }
  ctx.dirty();
}

/** Rule 3: over its places, its weakest goes (in the window, or the day a player it bought arrives). */
function trimRuleTx(ctx: Ctx, club: number, arrived?: number): void {
  const placed = (ctx.squads().get(club) ?? []).filter((m) => !m.onList);
  const spare = placed.filter((m) => m.kind === "player" && m.id !== arrived).sort((a, b) => a.rating - b.rating);
  let changed = false;
  for (let n = placed.length; n > AI_MAX_SQUAD && spare.length > 0;) {
    const weakest = spare.shift()!;
    if (hasAgreedMoveTx(ctx.w.tx, ctx.careerSaveId, weakest.id)) continue;
    releaseTx(ctx, club, weakest, ctx.today);
    changed = true; n--;
  }
  if (changed) ctx.dirty();
}

/** Rule 4: the day a bought player joins, the club is under its cap (her bid counted on it). */
function capOnArrivalRuleTx(ctx: Ctx, club: number, arrived: number): void {
  for (;;) {
    const squad = (ctx.squads().get(club) ?? []).filter((m) => !m.onList);
    // (A plain comparison: fitsUnderCap passes any change of nothing, so it can't say whether a bill is over.)
    if (seniorWageBillTx(ctx.w.tx, ctx.careerSaveId, { poolTeamId: club }) <= SALARY_CAP || squad.length <= AI_MIN_SQUAD) return;
    const weakest = squad.filter((m) => m.kind === "player" && m.id !== arrived).sort((a, b) => a.rating - b.rating)[0];
    if (!weakest) return;
    releaseTx(ctx, club, weakest, ctx.today);
    ctx.dirty();
  }
}

/** Rule 5: its places (see the header): to make two, then the third place; cover from the academy first. */
function placesRuleTx(ctx: Ctx, club: number): void {
  const { w, careerSaveId, today } = ctx;
  const squad = ctx.squads().get(club) ?? [];
  let placed = squad.filter((m) => !m.onList).length;
  if (placed >= AI_MAX_SQUAD) return;
  let fit = squad.filter((m) => !m.injured).length;
  const cover = squad.some((m) => m.onList && m.injured);
  for (let n = placed; n < AI_MAX_SQUAD; n++) {
    const toMakeTwo = n < AI_MIN_SQUAD;
    const youth = academyBestTx(w.tx, careerSaveId, club, PROMOTION_MIN_AGE);
    // C-5 (Rob, 14 Oct): a youth promoted to make two is never blocked by the cap; for the third place she must fit.
    const youthOk = !!youth && (toMakeTwo || fitsUnderCap(heldBillTx(w.tx, careerSaveId, club), askingWage(monthlySalaryFor(youth.rating), 1, 0)));
    const freeAgent = () => {
      if (!toMakeTwo) return bestAffordableFreeAgent(w.tx, careerSaveId, club, 0, fit >= AI_MIN_SQUAD, today, AI_DEADWOOD.askAge);
      // 1.1.1 (the soak, 17 Oct): room kept for the cheapest who would make two, and (item 4) three where it can.
      const cheapest = cheapestFreeWagesTx(w.tx, careerSaveId);
      const forTwo = n + 1 < AI_MIN_SQUAD ? (cheapest[1] ?? 0) : 0;
      const forThree = cheapest.slice(1, AI_MAX_SQUAD - n).reduce((t, x) => t + x, 0);
      return bestAffordableFreeAgent(w.tx, careerSaveId, club, -forThree, fit >= AI_MIN_SQUAD, today)
        ?? (forThree > forTwo ? bestAffordableFreeAgent(w.tx, careerSaveId, club, -forTwo, fit >= AI_MIN_SQUAD, today) : null);
    };
    const tryYouth = () => { if (!youth || !youthOk) return false; promoteTx(ctx, club, youth); fit++; return true; };
    const tryFreeAgent = () => { const fa = freeAgent(); if (!fa) return false; signTx(ctx, club, fa, "refill"); if (!fa.injured) fit++; return true; };
    if (cover ? (tryYouth() || tryFreeAgent()) : (tryFreeAgent() || tryYouth())) { placed++; continue; }
    if (!toMakeTwo) break;   // the third place stays open: nobody fits under the cap
    // Final brief 5 Oct: two on the sand comes first, so a broke club with no youth signs on credit; 1.1.3 (25 Oct):
    // the cheapest wage, and of those (every free agent rated about 62 or less asks the floor wage) the best.
    const bill = heldBillTx(w.tx, careerSaveId, club);
    const gone = leftClubTx(w.tx, careerSaveId, club, today);
    const fitting = freeAgentsTx(w.tx, careerSaveId).filter((f) => !f.injured && !gone.has(f.id) && fitsUnderCap(bill, monthlySalaryFor(f.rating)));
    const floor = Math.min(...fitting.map((f) => monthlySalaryFor(f.rating)));
    const cheapest = fitting.find((f) => monthlySalaryFor(f.rating) === floor);
    if (!cheapest) { ctx.out.short++; break; }
    signTx(ctx, club, cheapest, "refill");
    fit++; placed++;
  }
}

// ── The week: deadwood, the market, the bids ────────────────────────────────

/** Deadwood (see the header). Off under VBE_RETIREMENT=limit, as the chance at the turn is. */
function deadwoodTx(ctx: Ctx, clubs: readonly number[]): void {
  // A suite's switch (utils/retirement.ts): VBE_RETIREMENT=limit keeps only the age limit, so squads hold still.
  if (process.env.VBE_RETIREMENT === "limit") return;
  const { w, careerSaveId, today } = ctx;
  const window = inTransferWindow(today);
  const recon = reconstructionsTx(w.tx, careerSaveId);
  const already = listedIdsTx(w.tx, careerSaveId);
  for (const club of clubs) {
    const squad = ctx.squads().get(club) ?? [];
    const players = squad.filter((m) => m.kind === "player");
    if (players.length === 0) continue;
    const weakest = [...players].sort((a, b) => a.rating - b.rating || b.id - a.id)[0]!;
    const canLose = squad.length - 1 >= AI_MIN_SQUAD;
    const broken = players.filter((m) => (m.onList || (recon.get(m.id) ?? 0) > 0) && m.age >= AI_DEADWOOD.brokenAge).sort((a, b) => a.rating - b.rating)[0];
    const ask = canLose ? (broken ?? (window && weakest.age >= AI_DEADWOOD.askAge ? weakest : null)) : null;
    if (ask) {
      const payout = ask.contractEndDate ? terminationPayout(ask.salary, today, ask.contractEndDate) : 0;
      if (payout > 0) addToBalance(w.tx, careerSaveId, club, -payout);
      w.retirePlayers(careerSaveId, [{ playerId: ask.id, reason: "asked" }], Number(today.slice(0, 4)), today);
      ctx.out.asked++;
      ctx.dirty();
      continue;
    }
    if (window && weakest.age >= AI_DEADWOOD.listAge && !already.has(weakest.id) && !hasAgreedMoveTx(w.tx, careerSaveId, weakest.id)) {
      w.setPlayerState(careerSaveId, weakest.id, { transferListed: true });
      ctx.out.listed++;
    }
  }
}

/**
 * The market's scouting, through the year: a club with places to fill for next season scouts one player a week
 * for them, the best it could fit under its cap next season that it has no report on yet: a free agent, or a
 * player whose contract with another AI club ends this season and who is not that club's best (she will be on the
 * market at the turn). Never one of AI_DEADWOOD.askAge or more. One report more than its places, within its
 * season's limits (utils/aiMarketLimits.ts); a Scout's or coach's job, SCOUT_DAYS long. Not in the window's last week.
 */
function marketScoutingTx(ctx: Ctx, clubs: readonly number[]): void {
  const { w, careerSaveId, today } = ctx;
  if (inTransferWindow(today) && addDaysTo(today, 7) > transferWindowFor(seasonYearOf(today)).closes) return;
  const squads = ctx.squads();
  const leaving: Array<{ id: number; name: string; rating: number; at: MoveTarget }> = [];
  for (const club of clubs) {
    const squad = squads.get(club) ?? [];
    for (const m of squad) if (m.kind === "player" && m !== squad[0] && !runsPastSeason(m, today) && m.age < AI_DEADWOOD.askAge) leaving.push({ id: m.id, name: m.name, rating: m.rating, at: { poolTeamId: club } });
  }
  const free = freeAgentsTx(w.tx, careerSaveId).filter((f) => !f.injured && f.age < AI_DEADWOOD.askAge).map((f) => ({ id: f.id, name: f.name, rating: f.rating, at: null as MoveTarget }));
  const available = new Set([...free, ...leaving].map((c) => c.id));
  const cheapest = cheapestFreeWagesTx(w.tx, careerSaveId);
  for (const club of weekOrder([...clubs], `${careerSaveId}:${today}:ai-market-scouting`)) {
    const squad = squads.get(club) ?? [];
    const { need, bestRenews, best } = nextSeasonOf(w.tx, careerSaveId, club, squad, today);
    if (need === 0) continue;
    const moves = aiSeasonMovesTx(w.tx, careerSaveId, club, today);
    if ([...moves.reports.keys()].filter((id) => available.has(id)).length > need) continue;
    const bill = seniorWageBillTx(w.tx, careerSaveId, { poolTeamId: club }, nextSeasonStartOf(today), squads)
      + (bestRenews && best ? monthlySalaryFor(best.rating) : 0) + cheapest.slice(0, need - 1).reduce((t, x) => t + x, 0);
    const gone = leftClubTx(w.tx, careerSaveId, club, today);
    const target = [...free, ...leaving]
      .filter((c) => !(c.at && "poolTeamId" in c.at && c.at.poolTeamId === club) && !gone.has(c.id) && !moves.reports.has(c.id) && mayScout(moves, c.at)
        && bill + monthlySalaryFor(c.rating) <= SALARY_CAP)
      .sort((a, b) => b.rating - a.rating || a.id - b.id)[0];
    if (!target) continue;
    const pick = pickScouterTx(w.tx, careerSaveId, { poolTeamId: club }, [["scout"], ["head_coach", "assistant_coach"]], today);
    if (!pick.scouter) continue;
    const readyOn = addDaysTo(today, SCOUT_DAYS);
    addScoutingJobTx(w.tx, careerSaveId, { poolTeamId: club }, pick.scouter.id, { kind: "player", targetId: target.id, targetName: target.name, startedOn: today, readyOn });
    recordAiMoveTx(w.tx, careerSaveId, club, "scout", target.id, target.at, today, readyOn, moves);
  }
}

/**
 * The market's signings, each weekly block in the transfer window (7 to 31 December). Each club (its best already
 * renewed by rule 1) fills each place it has for next season from the free agents, paying her price and her asking
 * wage on its own length (a contract signed in the window runs from next season): the best healthy free agent under
 * AI_DEADWOOD.askAge it can pay (her price and three months of her wage) and fit under its cap today and next
 * season, with room kept for its other places. Before the window's last week only a player it has a ready report
 * on, or one within AI_BUY_GAP of the player she replaces; it waits a week for a report coming on a player it could
 * fit, and with none coming signs the best it can now; in the last week the best it can
 * afford, else its academy's best youth (16+) if she fits under its cap, else the place is recorded open and why
 * ("open:cap", "open:money", "open:none", "open:limit"). A player whose contract ends this season and is not renewed
 * leaves the day her place or wage is needed for her replacement (weakest first), never leaving fewer than
 * AI_MIN_SQUAD holding a place; one not needed by then leaves at the turn (rule 1).
 */
function marketWindowTx(ctx: Ctx, clubs: readonly number[]): void {
  const { w, careerSaveId, today } = ctx;
  if (!inTransferWindow(today)) return;
  const lastWeek = addDaysTo(today, 7) > transferWindowFor(seasonYearOf(today)).closes;
  for (const club of weekOrder([...clubs], `${careerSaveId}:${today}:ai-market`)) {
    const moves = aiSeasonMovesTx(w.tx, careerSaveId, club, today);
    for (let guard = 0; guard < AI_MAX_SQUAD; guard++) {
      const squad = ctx.squads().get(club) ?? [];
      const placed = squad.filter((m) => !m.onList);
      const staying = placed.filter((m) => runsPastSeason(m, today));
      const need = AI_MAX_SQUAD - staying.length - comingToTx(w.tx, careerSaveId, club);
      if (need <= 0) break;
      const leavers = placed.filter((m) => m.kind === "player" && !runsPastSeason(m, today) && !hasAgreedMoveTx(w.tx, careerSaveId, m.id))
        .sort((a, b) => a.rating - b.rating || a.id - b.id);
      const replacing = leavers.at(-1)?.rating ?? 0;
      const costOf = new Map(leavers.map((l) => [l.id, l.salary + perksOfTx(w.tx, careerSaveId, l.id)]));
      const todayBill = heldBillTx(w.tx, careerSaveId, club);
      const nextBill = seniorWageBillTx(w.tx, careerSaveId, { poolTeamId: club }, nextSeasonStartOf(today));
      const keepRoom = cheapestFreeWagesTx(w.tx, careerSaveId).slice(0, need - 1).reduce((t, x) => t + x, 0);
      // The leavers who would go for a newcomer on `wage`: as many as its places or today's cap need, weakest first.
      const goingFor = (wage: number): AiMember[] | null => {
        const going: AiMember[] = [];
        let bill = todayBill, holding = placed.length + 1;
        for (const l of leavers) {
          if (holding <= AI_MAX_SQUAD && bill + wage <= SALARY_CAP) break;
          if (holding - 1 < AI_MIN_SQUAD) break;
          going.push(l); bill -= costOf.get(l.id)!; holding--;
        }
        return holding <= AI_MAX_SQUAD && bill + wage <= SALARY_CAP ? going : null;
      };
      const fitsNext = (wage: number) => nextBill + wage + keepRoom <= SALARY_CAP;
      const balance = balanceOf(w.tx, careerSaveId, club);
      const gone = leftClubTx(w.tx, careerSaveId, club, today);
      const free = freeAgentsTx(w.tx, careerSaveId).filter((f) => !f.injured && !gone.has(f.id) && f.age < AI_DEADWOOD.askAge)
        .map((f) => ({ f, ...marketTerms(careerSaveId, f) }));
      const fitting = free.filter((c) => fitsNext(c.wage) && goingFor(c.wage) != null);
      const affordable = fitting.filter((c) => balance >= c.price + 3 * c.wage);
      const wanted = affordable.filter((c) => (moves.reports.get(c.f.id) ?? "9999") <= today || c.f.rating >= replacing - AI_BUY_GAP);
      // 1.1.3 (26 Oct, the window trace): it waits a week only for what a week can bring, a report coming on a player
      // it could fit. With none coming it signs the best it can fit now: clubs that waited with nothing coming found
      // the free agents their cap had room for all signed by the last week, and started the season on two.
      const reportComing = fitting.some((c) => (moves.reports.get(c.f.id) ?? "") > today);
      const pick = wanted[0] ?? (lastWeek || !reportComing ? affordable[0] : undefined);
      if (pick && mayBid(moves, null)) {
        for (const l of goingFor(pick.wage)!) releaseTx(ctx, club, l, today);
        signTx(ctx, club, pick.f, "sign", pick.price, moves);
        continue;
      }
      if (!lastWeek) break;   // it waits a week for the market
      const youth = academyBestTx(w.tx, careerSaveId, club, PROMOTION_MIN_AGE);
      const youthWage = youth ? askingWage(monthlySalaryFor(youth.rating), 1, 0) : 0;
      const youthGoing = youth && fitsNext(youthWage) ? goingFor(youthWage) : null;
      if (youth && youthGoing) {
        for (const l of youthGoing) releaseTx(ctx, club, l, today);
        promoteTx(ctx, club, youth);
        continue;
      }
      const why = pick ? "limit" : fitting.length > 0 ? "money" : free.length === 0 && !youth ? "none" : "cap";
      for (let n = 0; n < need; n++) recordAiMoveTx(w.tx, careerSaveId, club, `open:${why}`, -1, null, today);
      ctx.out.open += need;
      break;
    }
  }
}

/** Bids for the player's seniors, a few a week (AI_TRANSFERS_PER_WEEK), by THE BID BAR (see the header). */
function bidsForHisSeniorsTx(ctx: Ctx, clubs: readonly number[]): void {
  const { w, careerSaveId, today } = ctx;
  const myTeam = careerTeamIdTx(w.tx, careerSaveId);
  if (myTeam == null) return;
  let freeWages: number[] | undefined;
  // 1.1.1 (17 Oct, the full build's timings): his seniors, their prices and open deals are worked out once, and again after a bid.
  let robsNow: ReturnType<typeof robsSeniorsForBidsTx> | null = null;
  let listedNow: Set<number> | null = null;
  const feeOf = new Map<number, number>(), openOf = new Map<number, boolean>();
  for (const buyer of weekOrder([...clubs], `${careerSaveId}:${today}:ai-transfers`)) {
    if (ctx.out.bids.length >= AI_TRANSFERS_PER_WEEK) break;
    // One deal at a time: a club already buying someone ahead waits for her.
    const buying = w.tx.select({ id: transferDealsTable.id }).from(transferDealsTable).where(and(eq(transferDealsTable.careerSaveId, careerSaveId),
      eq(transferDealsTable.toPoolTeamId, buyer), inArray(transferDealsTable.status, ["offered", "agreed"]))).get();
    if (buying) continue;
    const squads = ctx.squads();
    const mine = (squads.get(buyer) ?? []).filter((m) => !m.onList);
    if (mine.length < AI_MIN_SQUAD) continue;
    // THE BID BAR: AI_BUY_GAP better than its weaker starter (its second best holding a place), whatever its third.
    const weakerStarter = mine[AI_MIN_SQUAD - 1]!;
    const bar = weakerStarter.rating + AI_BUY_GAP;
    // A full club lets its weakest go when she arrives (her wage counts as gone on that day, below).
    const weakest = mine.length >= AI_MAX_SQUAD ? mine[mine.length - 1]! : null;
    if (weakest && weakest.kind !== "player") continue;
    const balance = balanceOf(w.tx, careerSaveId, buyer);
    const robs = (robsNow ??= robsSeniorsForBidsTx(w.tx, careerSaveId, myTeam, today)).map((m) => ({ ...m, at: { teamId: myTeam } as Club }));
    if (robs.length === 0) return;
    const listed = (listedNow ??= listedIdsTx(w.tx, careerSaveId));
    const open = (id: number) => { let o = openOf.get(id); if (o == null) { o = !!openDealForTx(w.tx, careerSaveId, id); openOf.set(id, o); } return o; };
    const priceOf = (m: { id: number; priced: unknown }) => { let f = feeOf.get(m.id); if (f == null) {
      f = marketPrice(careerSaveId, m.priced as Parameters<typeof marketPrice>[1]).price;
      if (listed.has(m.id)) f = Math.round(f * LISTED_TERMS.feeShare);
      feeOf.set(m.id, f); } return f; };
    // 1.1.3 (A3): it bids for a senior only once its report on her is ready; with none, it starts one and bids a later week.
    const moves = aiSeasonMovesTx(w.tx, careerSaveId, buyer, today);
    const candidates = robs
      .filter((m) => m.rating >= (listed.has(m.id) ? bar - AI_BUY_GAP : bar) && !open(m.id) && mayBid(moves, m.at))
      .map((m) => ({ m, fee: priceOf(m) }))
      .filter(({ fee }) => balance >= fee + AI_BUY_RESERVE)
      .sort((a, b) => b.m.rating - a.m.rating || a.m.id - b.m.id);
    let target: (typeof candidates)[number] | undefined;
    for (const c of candidates) {
      const ready = moves.reports.get(c.m.id);
      if (ready == null) {
        if (!mayScout(moves, c.m.at)) continue;
        const pick = pickScouterTx(w.tx, careerSaveId, { poolTeamId: buyer }, [["scout"], ["head_coach", "assistant_coach"]], today);
        if (!pick.scouter) break;   // nobody free (or no Scout or coach): it waits
        const readyOn = addDaysTo(today, SCOUT_DAYS);
        addScoutingJobTx(w.tx, careerSaveId, { poolTeamId: buyer }, pick.scouter.id, { kind: "player", targetId: c.m.id, targetName: c.m.name, startedOn: today, readyOn });
        recordAiMoveTx(w.tx, careerSaveId, buyer, "scout", c.m.id, c.m.at, today, readyOn, moves);
        break;
      }
      if (ready > today) break;     // its report on her is not ready yet: it waits for it
      target = c;
      break;
    }
    if (!target) continue;
    // Its terms: her wage plus AI_TRANSFER_TERMS.wageRise, its own length, and perks it can afford under the cap.
    const arrivesOn = arrivalDateFor(today, target.m.contractEndDate);
    const wage = Math.round(target.m.salary * AI_TRANSFER_TERMS.wageRise);
    // Its weakest's wage counts as gone on the arrival date only if her contract still runs then (the soak, 16 Oct).
    const freeing = weakest && (!weakest.contractEndDate || weakest.contractEndDate >= arrivesOn) ? weakest.salary : 0;
    // 1.1.1 (the soak, 17 Oct): a contract ending before she comes is room only for a player it can do without; it must
    // still field AI_MIN_SQUAD until then: its cheapest such players kept, or the cheapest free agents, whichever is less.
    const runsPast = (m: AiMember) => !m.contractEndDate || m.contractEndDate >= arrivesOn;
    const staying = mine.filter((m) => m !== weakest && runsPast(m)).length;
    const keep = mine.filter((m) => m !== weakest && !runsPast(m)).sort((a, b) => a.salary - b.salary).slice(0, Math.max(0, AI_MIN_SQUAD - staying));
    const keepCost = keep.reduce((t, m) => t + m.salary + (m.kind !== "player" ? 0 : perksOfTx(w.tx, careerSaveId, m.id)), 0);
    const free = keep.length === 0 ? [] : (freeWages ??= cheapestFreeWagesTx(w.tx, careerSaveId)).slice(0, keep.length);
    const fillCost = free.length === keep.length ? free.reduce((t, x) => t + x, 0) : Infinity;
    const room = SALARY_CAP - (seniorWageBillTx(w.tx, careerSaveId, { poolTeamId: buyer }, arrivesOn, squads) - freeing + Math.min(keepCost, fillCost)) - wage;
    if (room < 0) continue;
    const terms = { wage, length: lengthForRating(clubRating(w.tx, buyer)), perks: aiOfferPerks(wage, room) };
    const r = bidTx(w, careerSaveId, { poolTeamId: buyer }, target.m.id, terms, target.fee, today, freeing);
    if (!r.ok) continue;
    // 1.1.3 (A3): a bid made counts, whatever her club answers.
    recordAiMoveTx(w.tx, careerSaveId, buyer, "bid", target.m.id, target.m.at, today, null, moves);
    ctx.dirty(); robsNow = null; listedNow = null; feeOf.clear(); openOf.clear();
    ctx.out.bids.push({ player: target.m.name, from: r.deal.fromTeamId != null ? "player" : String(r.deal.fromPoolTeamId), to: buyer, fee: target.fee, outcome: r.outcome });
  }
}

// ── Answers the rest of the game asks of the policy ──────────────────────────

/**
 * Whether an AI club can let one of its players go (the player buying her): it still has two after, or it can
 * sign a free agent at once to make two (one that fits under its cap once `freeing`, her wage, has left).
 */
export function canSellTx(tx: Tx, careerSaveId: number, poolTeamId: number, clubName: string, freeing = 0, squads?: ReadonlyMap<number, AiMember[]>): { ok: true } | { ok: false; reason: string } {
  const squad = (squads ?? aiSquadsTx(tx, careerSaveId)).get(poolTeamId) ?? [];
  if (squad.length - 1 >= AI_MIN_SQUAD) return { ok: true };
  if (bestAffordableFreeAgent(tx, careerSaveId, poolTeamId, freeing)) return { ok: true };
  return { ok: false, reason: `${clubName} won't sell: it would be left without two players to put on the sand, and there is no free agent it can sign in her place.` };
}

/**
 * An AI holding club's one chance (AC-10, "AI clubs counter too, by their money and cap"): it matches the bid's
 * terms if it can pay AI_TRANSFER_TERMS.counterMonths of the extra cost from its balance above its reserve and the
 * match fits under its cap. Else no counter: she goes. (utils/transfers.ts applies the answer.)
 */
export function aiCounterFor(tx: Tx, careerSaveId: number, poolTeamId: number, current: { salary: number; perks: string; rating: number }, bid: TransferTerms): TransferTerms | null {
  const wage = Math.min(bid.wage, Math.round(monthlySalaryFor(current.rating) * AI_TRANSFER_TERMS.counterCeiling));
  const extra = (wage + perksMonthly(bid.perks)) - (current.salary + perksMonthly(current.perks));
  if (extra > 0 && balanceOf(tx, careerSaveId, poolTeamId) - AI_BUY_RESERVE < extra * AI_TRANSFER_TERMS.counterMonths) return null;
  if (wageCapRefusal(heldBillTx(tx, careerSaveId, poolTeamId), extra)) return null;
  // Rob, 24 Oct: an AI club can't hold her on 6 months; it counters a 6-month bid with a season.
  return { wage, length: seasonLength(bid.length), perks: bid.perks };
}

// ── The policy's own hands: the only code that changes who an AI club holds ──

/**
 * Sign a free agent: the AI's own terms (its wage for her rating, at her injured wage if she is hurt; its length for
 * its rating), recorded ("sign" from the market, paying `price`; "refill" otherwise).
 */
function signTx(ctx: Ctx, club: number, f: { id: number; rating: number; injuryWeeks?: number }, kind: "sign" | "refill", price = 0,
  moves?: Parameters<typeof recordAiMoveTx>[8]): void {
  const { w, careerSaveId, today } = ctx;
  joinTx(ctx, club, f.id, f.rating, f.injuryWeeks ?? 0);
  if (price > 0) addToBalance(w.tx, careerSaveId, club, -price);
  recordAiMoveTx(w.tx, careerSaveId, club, kind, f.id, null, today, null, moves);
  ctx.out.signed++;
}

/** Promote its academy youth into the seniors (recorded "promote"). */
function promoteTx(ctx: Ctx, club: number, youth: { id: number; rating: number }): void {
  ctx.w.setPlayerState(ctx.careerSaveId, youth.id, { isPromoted: true, academyRole: null });
  joinTx(ctx, club, youth.id, youth.rating, 0);
  recordAiMoveTx(ctx.w.tx, ctx.careerSaveId, club, "promote", youth.id, null, ctx.today);
  ctx.out.promoted++;
}

function joinTx(ctx: Ctx, club: number, playerId: number, rating: number, injuryWeeks: number): void {
  const length = lengthForRating(clubRating(ctx.w.tx, club));
  ctx.w.setPlayerState(ctx.careerSaveId, playerId, {
    teamId: null, poolTeamId: club, salary: askingWage(monthlySalaryFor(rating), 1, injuryWeeks), perks: "",
    contractEndDate: contractEndFrom(length, ctx.today, ctx.seasonEnds()),
    // Overnight part 4 (B-3): the player's scout reports on her stay with her.
    isActive: false, squadRole: "starter", academyRole: null, poolJoinedOn: ctx.today,
  });
  ctx.dirty();
}

/**
 * Let her go: a free agent asking the wage for her rating (a club signing her while she is hurt pays her injured
 * wage, item 4c), recorded as leaving on `onDate` ("leave"), so the club does not sign her back that season or the next.
 */
function releaseTx(ctx: Ctx, club: number, m: AiMember, onDate: string): void {
  ctx.w.setPlayerState(ctx.careerSaveId, m.id, {
    teamId: null, poolTeamId: null, salary: monthlySalaryFor(m.rating), perks: "", contractEndDate: null, isActive: false, poolJoinedOn: null,
  });
  recordAiMoveTx(ctx.w.tx, ctx.careerSaveId, club, "leave", m.id, null, onDate);
  ctx.out.released++;
  ctx.dirty();
}

// ── What the policy reads ────────────────────────────────────────────────────

/** An AI club's best academy youth (not out on loan; `minAge` and up). */
function academyBestTx(tx: Tx, careerSaveId: number, poolTeamId: number, minAge = 0) {
  const onLoanIn = new Set(tx.select({ id: youthLoansTable.playerId }).from(youthLoansTable).where(and(
    eq(youthLoansTable.careerSaveId, careerSaveId), eq(youthLoansTable.status, "active"), eq(youthLoansTable.borrowerPoolTeamId, poolTeamId))).all().map((r) => r.id));
  return tx.select({
    id: playersTable.id, age: careerPlayerStateTable.age,
    speed: careerPlayerStateTable.speed, power: careerPlayerStateTable.power, defense: careerPlayerStateTable.defense,
    serve: careerPlayerStateTable.serve, block: careerPlayerStateTable.block, stamina: careerPlayerStateTable.stamina,
  }).from(careerPlayerStateTable)
    .innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
    .where(and(
      eq(careerPlayerStateTable.careerSaveId, careerSaveId),
      eq(careerPlayerStateTable.poolTeamId, poolTeamId),
      isNull(careerPlayerStateTable.teamId),
      eq(careerPlayerStateTable.isRetired, false),
      eq(playersTable.playerType, "youth"),
      eq(careerPlayerStateTable.isPromoted, false),
    )).all()
    .filter((p) => p.age >= minAge)
    // 1.1.1 (the AI-squad trace): a youth on loan to the club is not its to promote: she goes back when the loan ends.
    .filter((p) => !onLoanIn.has(p.id))
    .map((p) => ({ id: p.id, rating: overallRating(p) }))
    .sort((a, b) => b.rating - a.rating || a.id - b.id)[0] ?? null;
}

/** The free agents an AI club can sign: seniors at no club, best first (item 4c: injured or not, and how long). */
function freeAgentsTx(tx: Tx, careerSaveId: number) {
  return tx.select({
    id: playersTable.id, name: playersTable.name, askingPrice: playersTable.askingPrice, salary: careerPlayerStateTable.salary, age: careerPlayerStateTable.age,
    isInjured: careerPlayerStateTable.isInjured, injuryStatus: careerPlayerStateTable.injuryStatus,
    weeks: careerPlayerStateTable.injuryWeeksRemaining,
    speed: careerPlayerStateTable.speed, power: careerPlayerStateTable.power, defense: careerPlayerStateTable.defense,
    serve: careerPlayerStateTable.serve, block: careerPlayerStateTable.block, stamina: careerPlayerStateTable.stamina,
  }).from(careerPlayerStateTable)
    .innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
    .where(and(
      eq(careerPlayerStateTable.careerSaveId, careerSaveId),
      isNull(careerPlayerStateTable.teamId),
      isNull(careerPlayerStateTable.poolTeamId),
      eq(careerPlayerStateTable.isRetired, false),
      or(eq(playersTable.playerType, "senior"), eq(careerPlayerStateTable.isPromoted, true)),
    )).all()
    .map((p) => {
      const injured = isInjured({ isInjured: p.isInjured, injuryStatus: p.injuryStatus ?? "Healthy" });
      return { ...p, rating: overallRating(p), injured, injuryWeeks: injured ? Number(p.weeks ?? 0) : 0 };
    })
    .sort((a, b) => b.rating - a.rating || a.id - b.id);
}

/**
 * What an AI club has promised in wages: what it has committed to (salaryCap.ts committedWageBillTx: its seniors and
 * the players it has bought ahead) and its bid still waiting for an answer (1.1.3, 26 Oct). A bid he leaves
 * unanswered goes through on its answer-by date with no second look at the cap, so until then its wage is spoken for:
 * ai-market found a club that signed a $30,500 senior while its bid for one of his waited, and was over its cap the
 * day she arrived (holding two, it could let nobody go).
 */
function heldBillTx(tx: Tx, careerSaveId: number, poolTeamId: number): number {
  const bidding = tx.select({ wage: transferDealsTable.wage, perks: transferDealsTable.perks }).from(transferDealsTable)
    .where(and(eq(transferDealsTable.careerSaveId, careerSaveId), eq(transferDealsTable.toPoolTeamId, poolTeamId), eq(transferDealsTable.status, "offered"))).all();
  return committedWageBillTx(tx, careerSaveId, { poolTeamId }) + bidding.reduce((t, d) => t + Number(d.wage) + perksMonthly(d.perks), 0);
}

/** 1.1.1 (the soak, 17 Oct): the asking wages of the healthy free agents, cheapest first. */
function cheapestFreeWagesTx(tx: Tx, careerSaveId: number): number[] {
  return freeAgentsTx(tx, careerSaveId).filter((f) => !f.injured).map((f) => askingWage(monthlySalaryFor(f.rating), 1, 0)).sort((a, b) => a - b);
}

/**
 * The best free agent a club can afford (three months of her wage in the bank) and fit under its salary cap, or
 * null: the strongest it can pay. `freeing` is wage leaving the club (or, negative, room kept). An injured one only
 * when `allowInjured`, at her injured wage. Never one who left it at the end of her contract this season or last,
 * nor one of `ageBelow` or more.
 */
function bestAffordableFreeAgent(tx: Tx, careerSaveId: number, poolTeamId: number, freeing = 0, allowInjured = false, today?: string, ageBelow = Infinity) {
  const balance = balanceOf(tx, careerSaveId, poolTeamId);
  const bill = heldBillTx(tx, careerSaveId, poolTeamId) - freeing;
  const left = today ? leftClubTx(tx, careerSaveId, poolTeamId, today) : new Set<number>();
  return freeAgentsTx(tx, careerSaveId)
    .filter((f) => (allowInjured || !f.injured) && !left.has(f.id) && f.age < ageBelow)
    .find((f) => {
      const wage = askingWage(monthlySalaryFor(f.rating), 1, f.injuryWeeks);
      return balance >= 3 * wage && fitsUnderCap(bill, wage);
    }) ?? null;
}

/** Her price on the market (marketPrice: a free agent, one month of her market wage, ±15%) and her asking wage. */
function marketTerms(careerSaveId: number, f: ReturnType<typeof freeAgentsTx>[number]) {
  const priced = { id: f.id, askingPrice: f.askingPrice == null ? null : Number(f.askingPrice), salary: Number(f.salary ?? 0),
    speed: f.speed, power: f.power, defense: f.defense, serve: f.serve, block: f.block, stamina: f.stamina, poolTeamId: null, teamId: null };
  return { price: marketPrice(careerSaveId, priced as Parameters<typeof marketPrice>[1]).price, wage: askingWage(monthlySalaryFor(f.rating), 1, 0) };
}

/**
 * Who an AI club has for next season: its seniors holding a place whose contracts run past this season, and its
 * best if her contract ends this season and it has not used its renewal. `need`: the places it must fill.
 */
function nextSeasonOf(tx: Tx, careerSaveId: number, poolTeamId: number, squad: readonly AiMember[], today: string) {
  const best = squad[0];
  const bestRenews = !!best && best.kind === "player" && !runsPastSeason(best, today) && !best.onList
    && aiRenewalsTx(tx, careerSaveId, poolTeamId, seasonYearOf(today)) === 0;
  const staying = squad.filter((m) => !m.onList && (runsPastSeason(m, today) || (bestRenews && m === best)));
  return { staying, bestRenews, best, need: Math.max(0, AI_MAX_SQUAD - staying.length) };
}

/** The player's fit seniors an AI club may bid for: held at his club at least AI_KEEP_DAYS (her contract's start). */
function robsSeniorsForBidsTx(tx: Tx, careerSaveId: number, teamId: number, today: string) {
  const s = careerPlayerStateTable;
  const rows = tx.select({
    id: s.playerId, name: playersTable.name, salary: s.salary, contractEndDate: s.contractEndDate, askingPrice: playersTable.askingPrice,
    speed: s.speed, power: s.power, defense: s.defense, serve: s.serve, block: s.block, stamina: s.stamina,
    isInjured: s.isInjured, onList: s.onInjuredList,
  }).from(s).innerJoin(playersTable, eq(playersTable.id, s.playerId)).where(and(
    eq(s.careerSaveId, careerSaveId), eq(s.teamId, teamId), eq(s.isRetired, false),
    or(eq(playersTable.playerType, "senior"), eq(s.isPromoted, true)),
  )).all();
  return rows.filter((r) => !r.isInjured && !r.onList && r.contractEndDate).filter((r) => {
    const since = tx.select({ d: contractsTable.startDate }).from(contractsTable).where(and(eq(contractsTable.playerId, r.id),
      eq(contractsTable.teamId, teamId), eq(contractsTable.status, "active"))).get()?.d;
    return since != null && daysBetween(since, today) >= AI_KEEP_DAYS;
  }).map((r) => ({ id: r.id, name: r.name, rating: overallRating(r), salary: Number(r.salary), contractEndDate: r.contractEndDate,
    priced: { ...r, salary: Number(r.salary), teamId } }));
}

/** 1.1.1: the seniors on the transfer list in this career. */
function listedIdsTx(tx: Tx, careerSaveId: number): Set<number> {
  return new Set(tx.select({ id: careerPlayerStateTable.playerId }).from(careerPlayerStateTable)
    .where(and(eq(careerPlayerStateTable.careerSaveId, careerSaveId), eq(careerPlayerStateTable.transferListed, true),
      eq(careerPlayerStateTable.isRetired, false))).all().map((r) => r.id));
}

function perksOfTx(tx: Tx, careerSaveId: number, playerId: number): number {
  return perksMonthly(tx.select({ p: careerPlayerStateTable.perks }).from(careerPlayerStateTable)
    .where(and(eq(careerPlayerStateTable.careerSaveId, careerSaveId), eq(careerPlayerStateTable.playerId, playerId))).get()?.p ?? "");
}

/** Players bought ahead who will join the club (agreed deals). */
function comingToTx(tx: Tx, careerSaveId: number, poolTeamId: number): number {
  return tx.select({ id: transferDealsTable.id }).from(transferDealsTable).where(and(eq(transferDealsTable.careerSaveId, careerSaveId),
    eq(transferDealsTable.toPoolTeamId, poolTeamId), eq(transferDealsTable.status, "agreed"))).all().length;
}

function clubRating(tx: Tx, poolTeamId: number): number {
  return Number(tx.select({ r: continentalPoolTeamsTable.rating }).from(continentalPoolTeamsTable)
    .where(eq(continentalPoolTeamsTable.id, poolTeamId)).get()?.r ?? 70);
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const addDaysTo = (date: string, days: number) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const nextDay = (date: string) => addDaysTo(date, 1);
/** The last day of `today`'s season, and the first of the next (seasons run 1 January to 31 December). */
const seasonEndOf = (today: string) => `${seasonYearOf(today)}-12-31`;
const nextSeasonStartOf = (today: string) => `${seasonYearOf(today) + 1}-01-01`;
/** Whether her contract runs into next season (a senior with no end date is the club's for good). */
const runsPastSeason = (m: AiMember, today: string) => !m.contractEndDate || m.contractEndDate > seasonEndOf(today);

/** A fixed shuffle for the week (the game date), so a run is repeatable. */
function weekOrder<T>(items: T[], seed: string): T[] {
  const key = (s: string) => { let h = 0x811c9dc5; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
  return items.map((x, i) => ({ x, k: key(`${seed}:${i}`) })).sort((a, b) => a.k - b.k).map((e) => e.x);
}
