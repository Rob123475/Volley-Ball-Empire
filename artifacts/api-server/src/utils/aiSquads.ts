/**
 * Daytime brief 2 Oct, U-6 ("have a crack"): an AI club's squad, in a career.
 *
 * Until now an AI club was its two continental_pool_players, fixed reference
 * rows nobody could buy. Now its squad is whoever plays for it in THIS career:
 *
 *   - the pool players still on a live pool contract with it (a career that
 *     has never needed more is exactly what it was), and
 *   - its career seniors: career_player_state rows with pool_team_id set and a
 *     senior (player_type 'senior' or promoted). A pool player becomes one when
 *     the Player Market first lists the AI clubs' players
 *     (materializeAiSeniorsTx: her pool contract then reads "moved"), and a
 *     free agent becomes one when an AI club signs her to refill its pair.
 *
 * Everything that reads an AI club's players reads them here: its strength
 * (utils/worldTour.ts), who earns its ranking points (utils/rankingPoints.ts),
 * its Olympic athletes (utils/olympics.ts), its wage bill
 * (utils/poolClubFinances.ts), the 3D court's opponents (routes/unity.ts) and
 * the regional league page. An AI club plays its best two available (item 4c:
 * an injured senior is not picked; with fewer than two fit it forfeits).
 *
 * The rules an AI club follows with its squad live here too:
 *   - keepAiSquadsTx (weekly, and after the season rollover): a career
 *     senior's contract that ran out is renewed, re-priced to her rating, only
 *     if she is the club's best and it has renewed nobody else that season
 *     (1.1.3, 25 Oct); else, or if that breaks the cap, or if she is out
 *     injured MONEY.salaryCap.injuredLongWeeks or more, she is released; a
 *     club with fewer than three signs the best free agent it can afford and
 *     fit (AI_MAX_SQUAD, item 4c).
 *   - aiMatchInjuriesTx (after each of its matches, item 4c): the injury roll.
 *   - aiTransfersWeekTx (weekly): the club's market (below), and a few bids
 *     for the player's seniors (AI_TRANSFERS_PER_WEEK).
 *   - 1.1.3 (Rob, 25 Oct; AI market brief item 1), the market: an AI club
 *     renews ONE player a season, its best by overall rating; every other
 *     contract runs out and the player leaves for the free-agent market. A
 *     club with a contract ending this season scouts the market through the
 *     year (aiMarketScoutingWeekTx) and, in the transfer window, signs a
 *     replacement for each from the free agents at her price
 *     (aiMarketWindowTx): the best it can afford, else a cheaper one, else its
 *     academy's best youth, else the place stays open and the reason is
 *     recorded. AI clubs no longer buy from each other.
 *   - 1.1.3 (Rob, 25 Oct; AI market brief item 4), the interchange: a club near
 *     its cap holds a third senior rather than run on two, inside the cap. It
 *     renews its best only if its other places still fit at the cheapest free
 *     agents' wages; a refill keeps room for three; the third place is the best
 *     free agent that fits, else its academy's best youth if she fits; and a
 *     senior going on the injured list after a match is covered that day.
 *   - canSellTx: an AI club only sells if it still has two to play, or can
 *     sign a free agent at once to make two.
 *   - aiSeniorsTrainWeekTx (weekly, Update 1 item 3): its seniors train.
 */
import {
  youthLoansTable, perksMonthly, careerPlayerStateTable, playersTable, continentalPoolPlayersTable, continentalPoolTeamsTable,
  poolPlayerContractsTable, careerPoolTeamStateTable, seasonsTable, careerSavesTable, db, MONEY, rollPotential,
  GAME_DIFFICULTY, gameDifficultyOf, type DevelopmentProfile, transferDealsTable, contractsTable, AI_TRANSFER_TERMS,
} from "@workspace/db";
import { and, asc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { loadStaffTx, type CareerStateTx } from "../lib/playerDto.js";
import { trainingStaffBonuses, injuryRiskStaffFactor } from "./staffBonuses.js";
import { generateDevelopment } from "./player-development.js";
import { overallRating } from "./overallRating.js";
import { sideRating } from "./matchEngine.js";
import { monthlySalaryFor } from "./clubFinances.js";
import { renewalEndDate, DEFAULT_CONTRACT_LENGTH } from "./contractTerms.js";
import { lengthForRating } from "./poolClubFinances.js";
import { marketPrice } from "./marketScouting.js";
import { trainingSessionXp } from "./trainingXp.js";
import { aiProgrammeFor, aiTrainsThisWeek, careerWeekOf } from "./aiTraining.js";
import { specialityFactor } from "./managerFaces.js";
import { seniorWageBillTx, committedWageBillTx, fitsUnderCap, renewalCapRefusalTx, SALARY_CAP } from "./salaryCap.js";
import { contractEndFrom, inTransferWindow, transferWindowFor } from "./transferWindow.js";
import { coverOnRoster } from "./injuredList.js";
import { bidTx, aiOfferPerks, arrivalDateFor, openDealForTx, careerTeamIdTx, hasAgreedMoveTx, type Club } from "./transfers.js";
import { isInjured, matchInjuryRoll } from "./condition.js";
import { startInjuryTx } from "./injuries.js";
import { careerGameDateTx } from "./gameDate.js";
import { askingWage } from "./wageCurve.js";
import { reconstructionsTx } from "./retirement.js";
import { terminationPayout } from "./contractTerms.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

import { PROMOTION_MIN_AGE } from "@workspace/db";
import { seasonEndsForCareerTx } from "./seasonDates.js";
import { pickScouterTx, addScoutingJobTx } from "./scoutingWork.js";
import { SCOUT_DAYS } from "./marketScouting.js";
import { aiSeasonMovesTx, mayBid, mayScout, recordAiMoveTx, aiRenewalsTx, leftClubTx, seasonYearOf, type AiSeasonMoves, type MoveTarget } from "./aiMarketLimits.js";

/** Two on the sand: an AI club never goes below this (Rob, U-6), and needs this many fit to play. */
export const AI_MIN_SQUAD = 2;
/** Two on the sand and one interchange: what an AI club holds and refills to (item 4c). */
export const AI_MAX_SQUAD = 3;
/** AI-to-AI moves a week, at most (modest, like the AI youth loans). */
export const AI_TRANSFERS_PER_WEEK = 2;
/** An AI club only buys a player at least this much better than its weaker starter. */
export const AI_BUY_GAP = 5;
/** What an AI club keeps in the bank after buying, beyond the fee. */
export const AI_BUY_RESERVE = 150_000;
/** An AI club keeps a player it signed this long before selling her on to another AI club. */
export const AI_KEEP_DAYS = 365;
/**
 * 1.1.1 (Rob, 18 Oct): a senior on the transfer list (career_player_state.transfer_listed, by the
 * player's club or an AI club) is wanted without AI_BUY_GAP and for feeShare of her market price.
 */
export const LISTED_TERMS = { feeShare: 0.75 } as const;
/**
 * 1.1.1 (Rob, 18 Oct): an AI club's deadwood (aiDeadwoodTx). It asks a senior to retire when she is
 * broken down (a reconstruction, or on the injured list) and at least brokenAge, at any time; in the
 * transfer window, also its weakest senior at askAge or more. In the window it lists its weakest at
 * listAge or more. One a club a week, and only a club that keeps two to play.
 */
export const AI_DEADWOOD = { brokenAge: 30, askAge: 35, listAge: 31 } as const;

export type AiMember = {
  kind: "pool" | "player";
  /** continental_pool_players.id for "pool", players.id for "player". */
  id: number;
  poolTeamId: number;
  name: string;
  nationality: string;
  age: number;
  speed: number; power: number; defense: number; serve: number; block: number; stamina: number;
  rating: number;
  /** Monthly. */
  salary: number;
  contractEndDate: string | null;
  imageUrl: string | null;
  skinTone: string | null;
  /** The pool player she was, for a career senior made from one. */
  poolPlayerId: number | null;
  /** The game date she joined this AI club (null: she has always been there). */
  joinedOn: string | null;
  /** Item 4c: injured (utils/condition.ts isInjured), and the weeks she is still out. A pool player never is. */
  injured: boolean;
  injuryWeeks: number;
  /** Night 2 (O-10): on the injured list (utils/injuredList.ts): she gives up her place. A pool player never is. */
  onList: boolean;
  /** Part 4: her development profile (players.development) and serious injuries, for the injury roll. */
  development: DevelopmentProfile | null;
  seriousInjuries: number;
};

const byRating = (a: AiMember, b: AiMember) => b.rating - a.rating || a.kind.localeCompare(b.kind) || a.id - b.id;

/** Every AI club's squad in this career, best first. */
export function aiSquadsTx(tx: Tx, careerSaveId: number): Map<number, AiMember[]> {
  const contracts = tx.select({
    poolPlayerId: poolPlayerContractsTable.poolPlayerId, poolTeamId: poolPlayerContractsTable.poolTeamId,
    status: poolPlayerContractsTable.status, salary: poolPlayerContractsTable.salary, endDate: poolPlayerContractsTable.endDate,
  }).from(poolPlayerContractsTable).where(eq(poolPlayerContractsTable.careerSaveId, careerSaveId)).all();
  const live = new Map(contracts.filter((c) => c.status === "active").map((c) => [c.poolPlayerId, c]));
  const moved = new Set(contracts.filter((c) => c.status === "moved").map((c) => c.poolPlayerId));

  const squads = new Map<number, AiMember[]>();
  // A free agent an AI club signed has no pool player's look: she gets a skin
  // tone of her nation's, drawn from its pool players the way R-75 seeded them.
  const tonesByNation = new Map<string, string[]>();
  const poolRows = tx.select().from(continentalPoolPlayersTable).all();
  for (const p of poolRows) if (p.skinTone) tonesByNation.set(p.nationality, [...(tonesByNation.get(p.nationality) ?? []), p.skinTone]);
  const allTones = poolRows.map((p) => p.skinTone).filter((t): t is string => !!t);
  const toneFor = (nationality: string, id: number) => { const l = tonesByNation.get(nationality) ?? allTones; return l.length ? l[id % l.length]! : null; };
  const add = (m: AiMember) => { const l = squads.get(m.poolTeamId) ?? []; l.push(m); squads.set(m.poolTeamId, l); };

  for (const p of poolRows) {
    if (moved.has(p.id)) continue;
    const c = live.get(p.id);
    const stats = { speed: p.speed, power: p.power, defense: p.defense, serve: p.serve, block: p.block, stamina: p.stamina };
    add({
      kind: "pool", id: p.id, poolTeamId: c?.poolTeamId ?? p.poolTeamId, name: p.name, nationality: p.nationality,
      age: p.baseAge, ...stats, rating: overallRating(stats),
      salary: c ? Number(c.salary) : monthlySalaryFor(overallRating(stats)), contractEndDate: c?.endDate ?? null,
      imageUrl: p.imageUrl ?? null, skinTone: p.skinTone ?? null, poolPlayerId: p.id, joinedOn: null,
      injured: false, injuryWeeks: 0, onList: false, development: null, seriousInjuries: 0,
    });
  }

  const seniors = tx.select({
    id: playersTable.id, name: playersTable.name, nationality: playersTable.nationality, imageUrl: playersTable.imageUrl,
    poolTeamId: careerPlayerStateTable.poolTeamId, age: careerPlayerStateTable.age,
    speed: careerPlayerStateTable.speed, power: careerPlayerStateTable.power, defense: careerPlayerStateTable.defense,
    serve: careerPlayerStateTable.serve, block: careerPlayerStateTable.block, stamina: careerPlayerStateTable.stamina,
    salary: careerPlayerStateTable.salary, contractEndDate: careerPlayerStateTable.contractEndDate,
    poolPlayerId: careerPlayerStateTable.poolPlayerId, skinTone: continentalPoolPlayersTable.skinTone,
    joinedOn: careerPlayerStateTable.poolJoinedOn,
    isInjured: careerPlayerStateTable.isInjured, injuryStatus: careerPlayerStateTable.injuryStatus,
    injuryWeeks: careerPlayerStateTable.injuryWeeksRemaining, onList: careerPlayerStateTable.onInjuredList,
    development: playersTable.development, seriousInjuries: careerPlayerStateTable.seriousInjuries,
  }).from(careerPlayerStateTable)
    .innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
    .leftJoin(continentalPoolPlayersTable, eq(continentalPoolPlayersTable.id, careerPlayerStateTable.poolPlayerId))
    .where(and(
      eq(careerPlayerStateTable.careerSaveId, careerSaveId),
      isNotNull(careerPlayerStateTable.poolTeamId),
      isNull(careerPlayerStateTable.teamId),
      eq(careerPlayerStateTable.isRetired, false),
      or(eq(playersTable.playerType, "senior"), eq(careerPlayerStateTable.isPromoted, true)),
    )).all();
  for (const s of seniors) {
    const stats = { speed: s.speed, power: s.power, defense: s.defense, serve: s.serve, block: s.block, stamina: s.stamina };
    add({
      kind: "player", id: s.id, poolTeamId: s.poolTeamId!, name: s.name, nationality: s.nationality, age: s.age,
      ...stats, rating: overallRating(stats), salary: Number(s.salary), contractEndDate: s.contractEndDate,
      imageUrl: s.imageUrl ?? null, skinTone: s.skinTone ?? toneFor(s.nationality, s.id), poolPlayerId: s.poolPlayerId, joinedOn: s.joinedOn,
      injured: isInjured({ isInjured: s.isInjured, injuryStatus: s.injuryStatus ?? "Healthy" }), injuryWeeks: Number(s.injuryWeeks ?? 0), onList: !!s.onList,
      development: s.development ?? null, seriousInjuries: Number(s.seriousInjuries ?? 0),
    });
  }
  for (const l of squads.values()) l.sort(byRating);
  return squads;
}

/**
 * Item 4c: the two an AI club plays, its best two AVAILABLE (not injured), the
 * player's club's rule (utils/condition.ts selectPair). With fewer than two
 * fit it would forfeit (aiMatchRatingsTx); for everything that needs two names
 * all the same (the 3D court, whose ranking points) the best injured make up
 * the pair.
 */
function pairOf(squad: readonly AiMember[]): AiMember[] {
  return [...squad.filter((m) => !m.injured), ...squad.filter((m) => m.injured)].slice(0, AI_MIN_SQUAD);
}

export function aiPairTx(tx: Tx, careerSaveId: number, poolTeamId: number): AiMember[] {
  return pairOf(aiSquadsTx(tx, careerSaveId).get(poolTeamId) ?? []);
}

/** Every AI club's strength: sideRating over the two it plays (the player's club's rule). */
export function aiClubRatingsTx(tx: Tx, careerSaveId: number): Map<number, number> {
  const ratings = new Map<number, number>();
  for (const [id, squad] of aiSquadsTx(tx, careerSaveId)) ratings.set(id, sideRating(pairOf(squad)));
  return ratings;
}

/**
 * Item 4c: the AI clubs that can play a match, and their strength: only a club
 * with two fit seniors has one. A club without forfeits, as the player's club
 * does with fewer than two available (squad-forfeit; utils/worldTour.ts and
 * utils/regionalSeason.ts play a missing rating as a walkover).
 */
export function aiMatchRatingsTx(tx: Tx, careerSaveId: number): Map<number, number> {
  const ratings = new Map<number, number>();
  for (const [id, squad] of aiSquadsTx(tx, careerSaveId)) {
    const fit = squad.filter((m) => !m.injured);
    if (fit.length >= AI_MIN_SQUAD) ratings.set(id, sideRating(fit.slice(0, AI_MIN_SQUAD)));
  }
  return ratings;
}

/**
 * Item 4c: after an AI club's match, the two who played get the injury roll the
 * player's players get (utils/condition.ts matchInjuryRoll): the same odds, the
 * event's weather, and the club's manager's Fitness Guru (x0.8). Fitness and
 * fatigue stay off for AI players (the roll runs without them: fatigue 0, no
 * run of matches), so only her stamina and the multipliers count. Returns the
 * names of those hurt.
 */
export function aiMatchInjuriesTx(w: CareerStateTx, careerSaveId: number, poolTeamId: number, weatherMultiplier = 1, random: () => number = Math.random, today?: string): string[] {
  const played = (aiSquadsTx(w.tx, careerSaveId).get(poolTeamId) ?? []).filter((m) => !m.injured).slice(0, AI_MIN_SQUAD);
  const fitnessGuru = specialityFactor({ careerSaveId, poolTeamId }, "Fitness Guru");
  // Night 2 (O-6): its sports scientist, on duty, as the player's club's.
  const staffFactor = injuryRiskStaffFactor(loadStaffTx(w.tx, careerSaveId, { poolTeamId }));
  const date = today ?? careerGameDateTx(w.tx, careerSaveId);
  const hurt: string[] = [];
  for (const m of played) {
    if (m.kind !== "player") continue;   // a pool player is not a career row yet: nothing to injure
    if (!matchInjuryRoll({ stamina: m.stamina, development: m.development }, { weatherMultiplier, fitnessGuru, staffFactor }, random)) continue;
    // Night 2 (O-7): what it is and how long, by its own medical staff (utils/injuries.ts).
    startInjuryTx(w, careerSaveId, { poolTeamId }, { id: m.id, speed: m.speed, stamina: m.stamina, seriousInjuries: m.seriousInjuries }, date, random);
    hurt.push(m.name);
  }
  // 1.1.3 (Rob, 25 Oct; item 4): a senior on the injured list is covered the day she goes on it, not the next
  // morning (the day's step, utils/injuredList.ts), so her club is never a day without two to play.
  if (hurt.length > 0) aiInjuredListDayTx(w, careerSaveId, date, poolTeamId);
  return hurt;
}

/**
 * The Player Market lists AI clubs' seniors as players like any other: the
 * first time it does in a career, every pool player still at an AI club becomes
 * a career senior at that club, on her pool contract's wage and end date, and
 * the pool contract reads "moved". Her strength, club and wage are unchanged,
 * so the world plays on exactly as before. Returns how many were made.
 */
export function materializeAiSeniorsTx(w: CareerStateTx, careerSaveId: number): number {
  const pool = [...aiSquadsTx(w.tx, careerSaveId).values()].flat().filter((m) => m.kind === "pool");
  if (pool.length === 0) return 0;
  const refs = new Map(w.tx.select().from(continentalPoolPlayersTable)
    .where(inArray(continentalPoolPlayersTable.id, pool.map((m) => m.id))).all().map((p) => [p.id, p]));
  const continents = new Map(w.tx.select({ id: continentalPoolTeamsTable.id, continent: continentalPoolTeamsTable.continent })
    .from(continentalPoolTeamsTable).all().map((t) => [t.id, t.continent]));
  for (const m of pool) {
    const ref = refs.get(m.id)!;
    const stats = { speed: m.speed, power: m.power, defense: m.defense, serve: m.serve, block: m.block, stamina: m.stamina };
    w.createPlayer(careerSaveId, {
      name: ref.name, nationality: ref.nationality, baseAge: ref.baseAge, ...stats, imageUrl: ref.imageUrl,
      continent: continents.get(m.poolTeamId) ?? null, playerType: "senior", peakOverallRating: m.rating,
      // Overnight part 4 (B-1): a profile and a weighted potential of her own, fixed for good.
      development: generateDevelopment(), potential: rollPotential(),
    }, {
      age: ref.baseAge, ...stats, teamId: null, poolTeamId: m.poolTeamId, poolPlayerId: m.id,
      salary: m.salary, contractEndDate: m.contractEndDate, isActive: false, squadRole: "starter",
      peakOverallRating: m.rating,
    });
    w.tx.update(poolPlayerContractsTable).set({ status: "moved" }).where(and(
      eq(poolPlayerContractsTable.careerSaveId, careerSaveId),
      eq(poolPlayerContractsTable.poolPlayerId, m.id),
      eq(poolPlayerContractsTable.status, "active"),
    )).run();
    // A pool player that never had a pool contract in this career gets a
    // "moved" row too, so nothing signs her to a pool contract again.
    w.tx.insert(poolPlayerContractsTable).values({
      careerSaveId, poolPlayerId: m.id, poolTeamId: m.poolTeamId, length: DEFAULT_CONTRACT_LENGTH,
      startDate: m.contractEndDate ?? "", endDate: m.contractEndDate ?? "", salary: m.salary, status: "moved",
    }).onConflictDoNothing().run();
  }
  return pool.length;
}

/**
 * Update 1, item 3 (Rob, 14 Oct): the AI clubs' seniors train, in the weekly
 * block straight after materializeAiSeniorsTx. Each senior at an AI club gets
 * one session through the player's own XP rule (utils/trainingXp.ts): the
 * programme for her lowest stat (utils/aiTraining.ts aiProgrammeFor), her age
 * and potential, and her club's manager's Coach speciality (+10%), and since
 * the overnight brief's part 3 its staff's bonus (its Head and Assistant Coach,
 * utils/staffBonuses.ts); an AI club books no session coach and has no
 * philosophy or facilities, so those are 1. XP and stats
 * only: no fatigue, morale, injury or focus. Her training points carry over
 * week to week. Only in the career weeks the career's difficulty picks
 * (aiTrainEveryWeeks: Easy 4, Medium 2, Hard 1; overnight part 6). Returns
 * how many trained.
 */
export function aiSeniorsTrainWeekTx(w: CareerStateTx, careerSaveId: number, today: string): number {
  const every = GAME_DIFFICULTY[gameDifficultyOf(w.tx.select({ d: careerSavesTable.gameDifficulty }).from(careerSavesTable)
    .where(eq(careerSavesTable.id, careerSaveId)).get()?.d)].aiTrainEveryWeeks;
  const start = w.tx.select({ d: seasonsTable.startDate }).from(seasonsTable)
    .where(eq(seasonsTable.careerSaveId, careerSaveId)).orderBy(asc(seasonsTable.year)).limit(1).get()?.d ?? today;
  if (!aiTrainsThisWeek(careerWeekOf(start, today), every)) return 0;
  const seniors = w.tx.select({
    id: playersTable.id, potential: playersTable.potential, playerType: playersTable.playerType,
    development: playersTable.development, seriousInjuries: careerPlayerStateTable.seriousInjuries,
    poolTeamId: careerPlayerStateTable.poolTeamId, age: careerPlayerStateTable.age,
    trainingPoints: careerPlayerStateTable.trainingPoints, isPromoted: careerPlayerStateTable.isPromoted, isRetired: careerPlayerStateTable.isRetired,
    speed: careerPlayerStateTable.speed, power: careerPlayerStateTable.power, defense: careerPlayerStateTable.defense,
    serve: careerPlayerStateTable.serve, block: careerPlayerStateTable.block, stamina: careerPlayerStateTable.stamina,
  }).from(careerPlayerStateTable)
    .innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
    .where(and(
      eq(careerPlayerStateTable.careerSaveId, careerSaveId),
      isNotNull(careerPlayerStateTable.poolTeamId),
      isNull(careerPlayerStateTable.teamId),
      eq(careerPlayerStateTable.isRetired, false),
      or(eq(playersTable.playerType, "senior"), eq(careerPlayerStateTable.isPromoted, true)),
    )).all();
  const coach = new Map<number, number>();
  const staff = new Map<number, ReturnType<typeof trainingStaffBonuses>>();
  for (const s of seniors) {
    const club = s.poolTeamId!;
    if (!coach.has(club)) coach.set(club, specialityFactor({ careerSaveId, poolTeamId: club }, "Coach"));
    // Overnight part 3 (B-4): its Head Coach and Assistant Coach multiply the XP
    // through the player's own rule (utils/staffBonuses.ts); one off ill gives nothing.
    if (!staff.has(club)) staff.set(club, trainingStaffBonuses(loadStaffTx(w.tx, careerSaveId, { poolTeamId: club })));
    const bonus = staff.get(club)!;
    const xp = trainingSessionXp(s, aiProgrammeFor(s), { manager: coach.get(club), staff: bonus.xpMultiplier, statStaff: bonus.statXp });
    w.setPlayerState(careerSaveId, s.id, { trainingPoints: xp.newPoints, ...xp.statUpdates });
  }
  return seniors.length;
}

/** An AI club's best academy youth (not out on loan; `minAge` and up), for when no free agent can be signed. */
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
    // 1.1.1 (found by the AI-squad trace): a youth on loan to the club is not its to promote: she goes
    // back when the loan ends, and the club would be left short of two.
    .filter((p) => !onLoanIn.has(p.id))
    .map((p) => ({ id: p.id, rating: overallRating(p) }))
    .sort((a, b) => b.rating - a.rating || a.id - b.id)[0] ?? null;
}

/** The free agents an AI club can sign: seniors at no club, best first (item 4c: injured or not, and how long). */
function freeAgentsTx(tx: Tx, careerSaveId: number) {
  return tx.select({
    id: playersTable.id, name: playersTable.name, askingPrice: playersTable.askingPrice, salary: careerPlayerStateTable.salary,
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

export function balanceOf(tx: Tx, careerSaveId: number, poolTeamId: number): number {
  return Number(tx.select({ b: careerPoolTeamStateTable.balance }).from(careerPoolTeamStateTable)
    .where(and(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), eq(careerPoolTeamStateTable.poolTeamId, poolTeamId)))
    .get()?.b ?? 0);
}

export function addToBalance(tx: Tx, careerSaveId: number, poolTeamId: number, amount: number): void {
  tx.update(careerPoolTeamStateTable).set({ balance: balanceOf(tx, careerSaveId, poolTeamId) + amount, updatedAt: new Date() })
    .where(and(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), eq(careerPoolTeamStateTable.poolTeamId, poolTeamId))).run();
}

function clubRating(tx: Tx, poolTeamId: number): number {
  return Number(tx.select({ r: continentalPoolTeamsTable.rating }).from(continentalPoolTeamsTable)
    .where(eq(continentalPoolTeamsTable.id, poolTeamId)).get()?.r ?? 70);
}

/**
 * Sign a player to an AI club on the AI's own terms: its wage for her rating,
 * its length for its rating. Item 4c: an injured free agent signs at her
 * injured wage (`injuryWeeks` out; utils/wageCurve.ts askingWage) for the
 * whole contract, as she would for the player.
 */
function signToAiClub(w: CareerStateTx, careerSaveId: number, poolTeamId: number, playerId: number, rating: number,
  today: string, seasonEnds: readonly string[], injuryWeeks = 0): void {
  const length = lengthForRating(clubRating(w.tx, poolTeamId));
  w.setPlayerState(careerSaveId, playerId, {
    teamId: null, poolTeamId, salary: askingWage(monthlySalaryFor(rating), 1, injuryWeeks), perks: "", contractEndDate: contractEndFrom(length, today, seasonEnds),
    // Overnight part 4 (B-3): the player's scout reports on her stay with her.
    isActive: false, squadRole: "starter", academyRole: null,
    poolJoinedOn: today,
  });
}

/**
 * The best free agent a club can afford (three months of her wage in the bank)
 * and fit under its salary cap (Update 1, item 4a), or null. The club's own
 * rule: the strongest it can pay. `freeing` is wage leaving the club with a
 * player it is about to let go. Item 4c: an injured one only when
 * `allowInjured` (it would still have two fit), at her injured wage.
 */
/** 1.1.1 (the soak, 17 Oct): the asking wages of the healthy free agents, cheapest first. */
function cheapestFreeWagesTx(tx: Tx, careerSaveId: number): number[] {
  return freeAgentsTx(tx, careerSaveId).filter((f) => !f.injured).map((f) => askingWage(monthlySalaryFor(f.rating), 1, 0)).sort((a, b) => a - b);
}

function bestAffordableFreeAgent(tx: Tx, careerSaveId: number, poolTeamId: number, freeing = 0, allowInjured = false, today?: string) {
  const balance = balanceOf(tx, careerSaveId, poolTeamId);
  const bill = committedWageBillTx(tx, careerSaveId, { poolTeamId }) - freeing;
  // 1.1.3 (25 Oct): never one who left it at the end of her contract this season or last (utils/aiMarketLimits.ts).
  const left = today ? leftClubTx(tx, careerSaveId, poolTeamId, today) : new Set<number>();
  return freeAgentsTx(tx, careerSaveId)
    .filter((f) => (allowInjured || !f.injured) && !left.has(f.id))
    .find((f) => {
      const wage = askingWage(monthlySalaryFor(f.rating), 1, f.injuryWeeks);
      return balance >= 3 * wage && fitsUnderCap(bill, wage);
    }) ?? null;
}

/**
 * Whether an AI club can let one of its players go: it still has two after, or
 * it can sign a free agent at once to make two (one that fits under its cap
 * once `freeing`, the departing player's wage, has left). The refusal is in
 * plain words.
 */
export function canSellTx(tx: Tx, careerSaveId: number, poolTeamId: number, clubName: string, freeing = 0, squads?: ReadonlyMap<number, AiMember[]>): { ok: true } | { ok: false; reason: string } {
  const squad = (squads ?? aiSquadsTx(tx, careerSaveId)).get(poolTeamId) ?? [];
  if (squad.length - 1 >= AI_MIN_SQUAD) return { ok: true };
  if (bestAffordableFreeAgent(tx, careerSaveId, poolTeamId, freeing)) return { ok: true };
  return { ok: false, reason: `${clubName} won't sell: it would be left without two players to put on the sand, and there is no free agent it can sign in her place.` };
}

/**
 * Keep every AI club playable: renew its career seniors' contracts that ran
 * out, and refill any club below two with the best free agent it can afford
 * and fit under its cap. Update 1, item 4a (C-4): a renewal re-prices her to
 * the wage for her current rating; if that fits under the club's cap she
 * renews (the club's own length), and if not the club lets her go and she is
 * a free agent on the market, asking that wage. Update 1, item 4b: `random`
 * puts the clubs in random order (the Day 1 draft's fill), so the same club is
 * not always first to the free agents. Returns what it did.
 */
export function keepAiSquadsTx(w: CareerStateTx, careerSaveId: number, today: string, seasonEnds: readonly string[], random?: () => number): { renewed: number; released: number; signed: number; short: number } {
  let renewed = 0, released = 0, signed = 0, short = 0;
  const squads = aiSquadsTx(w.tx, careerSaveId);
  // Every club still in the world, including one left with nobody.
  const listed = w.tx.select({ id: careerPoolTeamStateTable.poolTeamId }).from(careerPoolTeamStateTable)
    .where(and(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), isNull(careerPoolTeamStateTable.takenOverAt))).all();
  const clubs = random ? listed.map((c) => ({ c, k: random() })).sort((a, b) => a.k - b.k).map((e) => e.c) : listed;
  for (const { id: poolTeamId } of clubs) {
    const squad = squads.get(poolTeamId) ?? [];
    // Night 2 (O-10): a senior on the injured list does not hold a place (aiInjuredListDayTx covers it).
    let left = squad.filter((m) => !m.onList).length;
    let fit = squad.filter((m) => !m.injured).length;
    for (const m of squad) {
      if (m.kind !== "player" || !m.contractEndDate || m.contractEndDate >= today) continue;
      // 1.1.1: once she has agreed to go (her fee is paid) her club can't renew her.
      if (hasAgreedMoveTx(w.tx, careerSaveId, m.id)) continue;
      const wage = monthlySalaryFor(m.rating);
      // Item 4c (4): a senior out MONEY.salaryCap.injuredLongWeeks or more is
      // not renewed; she goes to the market, asking the injured wage there
      // (utils/wageCurve.ts askingWage). The player's own renewals are his call.
      const endedOn = m.contractEndDate < today ? m.contractEndDate : today;
      if (m.injured && m.injuryWeeks >= MONEY.salaryCap.injuredLongWeeks) {
        releaseToMarket(w, careerSaveId, m.id, wage, poolTeamId, endedOn);
        released++; left--;
        continue;
      }
      // 1.1.3 (Rob, 25 Oct): only its best, and only one a season (the season her contract ended in).
      const mayRenew = squad[0]?.id === m.id && squad[0]?.kind === "player" && aiRenewalsTx(w.tx, careerSaveId, poolTeamId, seasonYearOf(m.contractEndDate)) === 0;
      if (mayRenew && renewAiSeniorTx(w, careerSaveId, poolTeamId, m, seasonEnds, today, squad)) {
        renewed++;
      } else {
        releaseToMarket(w, careerSaveId, m.id, wage, poolTeamId, endedOn);
        released++; left--;
        if (!m.injured) fit--;
      }
    }
    // Item 4c (1): it refills to AI_MAX_SQUAD (two on the sand and an
    // interchange). (5): it may gamble on an injured free agent, at her injured
    // wage, only if it would still have two fit to play.
    for (let n = left; n < AI_MAX_SQUAD; n++) {
      // 1.1.1 (the soak, 17 Oct): short of two, it keeps room under its cap for the cheapest free agent who
      // would make two, so the first it signs can't take it all. 1.1.3 (25 Oct, item 4): and room for the
      // cheapest who would make three, if it can; two on the sand comes first.
      const cheapestWages = cheapestFreeWagesTx(w.tx, careerSaveId);
      const forTwo = n + 1 < AI_MIN_SQUAD ? (cheapestWages[1] ?? 0) : 0;
      const forThree = cheapestWages.slice(1, AI_MAX_SQUAD - n).reduce((t, x) => t + x, 0);
      const fa = bestAffordableFreeAgent(w.tx, careerSaveId, poolTeamId, -forThree, fit >= AI_MIN_SQUAD, today)
        ?? (forThree > forTwo ? bestAffordableFreeAgent(w.tx, careerSaveId, poolTeamId, -forTwo, fit >= AI_MIN_SQUAD, today) : null);
      if (fa) {
        signToAiClub(w, careerSaveId, poolTeamId, fa.id, fa.rating, today, seasonEnds, fa.injuryWeeks);
        recordAiMoveTx(w.tx, careerSaveId, poolTeamId, "refill", fa.id, null, today);
        signed++; if (!fa.injured) fit++;
        continue;
      }
      // 1.1.3 (Rob, 25 Oct; item 4): the interchange, rather than run on two: no free agent it can pay and fit,
      // so its academy's best youth (16 and up) steps up, if her wage fits under its cap. Else it stays on two.
      if (n >= AI_MIN_SQUAD) {
        const third = academyBestTx(w.tx, careerSaveId, poolTeamId, PROMOTION_MIN_AGE);
        if (!third || !fitsUnderCap(committedWageBillTx(w.tx, careerSaveId, { poolTeamId }), askingWage(monthlySalaryFor(third.rating), 1, 0))) break;
        w.setPlayerState(careerSaveId, third.id, { isPromoted: true, academyRole: null });
        signToAiClub(w, careerSaveId, poolTeamId, third.id, third.rating, today, seasonEnds);
        recordAiMoveTx(w.tx, careerSaveId, poolTeamId, "promote", third.id, null, today);
        signed++; fit++;
        continue;
      }
      // No free agent it can pay: its own academy's best youth steps up.
      const youth = academyBestTx(w.tx, careerSaveId, poolTeamId);
      if (youth) {
        w.setPlayerState(careerSaveId, youth.id, { isPromoted: true, academyRole: null });
        signToAiClub(w, careerSaveId, poolTeamId, youth.id, youth.rating, today, seasonEnds);
        recordAiMoveTx(w.tx, careerSaveId, poolTeamId, "promote", youth.id, null, today);
        signed++; fit++;
        continue;
      }
      // Final brief 5 Oct (found by the full harness, season 20 of a long
      // career): retirement can leave a broke club with nobody and no youth.
      // Two on the sand comes first, so it signs the cheapest free agent there
      // is, on credit: her wage goes on its books like any other, five
      // loss-making seasons sell it, and the sale clears its debts.
      const bill = committedWageBillTx(w.tx, careerSaveId, { poolTeamId });
      const gone = leftClubTx(w.tx, careerSaveId, poolTeamId, today);
      const cheapest = freeAgentsTx(w.tx, careerSaveId).filter((f) => !f.injured && !gone.has(f.id) && fitsUnderCap(bill, monthlySalaryFor(f.rating))).at(-1);
      if (!cheapest) { short++; break; }
      signToAiClub(w, careerSaveId, poolTeamId, cheapest.id, cheapest.rating, today, seasonEnds);
      recordAiMoveTx(w.tx, careerSaveId, poolTeamId, "refill", cheapest.id, null, today);
      signed++; fit++;
    }
  }
  return { renewed, released, signed, short };
}

/**
 * Night 2 (O-10): an AI club's injured list, every game day (utils/injuredList.ts).
 * A club with a senior on it and a place free fills it from its academy (best
 * 16+, PROMOTION_MIN_AGE), else with the best free agent it can afford and fit
 * under its cap. A senior on it who is fit again comes off it, and the club
 * releases its weakest other senior if it has no place for her.
 */
export function aiInjuredListDayTx(w: CareerStateTx, careerSaveId: number, today: string, onlyClub?: number): { covered: number; released: number } {
  let covered = 0, released = 0;
  let seasonEnds: string[] | null = null;
  for (const [poolTeamId, squad] of aiSquadsTx(w.tx, careerSaveId)) {
    if (onlyClub != null && poolTeamId !== onlyClub) continue;
    const listed = squad.filter((m) => m.kind === "player" && m.onList);
    if (listed.length === 0) continue;
    let others = squad.filter((m) => !m.onList);
    for (const m of listed) {
      if (m.injured) {
        if (others.length >= AI_MAX_SQUAD) continue;
        seasonEnds ??= seasonEndsForCareerTx(w.tx, careerSaveId);
        const youth = academyBestTx(w.tx, careerSaveId, poolTeamId, PROMOTION_MIN_AGE);
        // 1.1.3 (Rob, 25 Oct; item 4): the cap is never breached. A club that still has two to play promotes cover
        // only if her wage fits under its cap; C-5 (a promoted youth is never blocked) is kept for a club that would
        // otherwise have fewer than two.
        const youthFits = !!youth && (others.length < AI_MIN_SQUAD
          || fitsUnderCap(committedWageBillTx(w.tx, careerSaveId, { poolTeamId }), askingWage(monthlySalaryFor(youth.rating), 1, 0)));
        if (youth && youthFits) {
          w.setPlayerState(careerSaveId, youth.id, { isPromoted: true, academyRole: null });
          signToAiClub(w, careerSaveId, poolTeamId, youth.id, youth.rating, today, seasonEnds);
          recordAiMoveTx(w.tx, careerSaveId, poolTeamId, "promote", youth.id, null, today);
        } else {
          const fa = bestAffordableFreeAgent(w.tx, careerSaveId, poolTeamId, 0, false, today);
          if (!fa) continue;
          signToAiClub(w, careerSaveId, poolTeamId, fa.id, fa.rating, today, seasonEnds, fa.injuryWeeks);
          recordAiMoveTx(w.tx, careerSaveId, poolTeamId, "refill", fa.id, null, today);
        }
        covered++;
        others = (aiSquadsTx(w.tx, careerSaveId).get(poolTeamId) ?? []).filter((x) => !x.onList);
        continue;
      }
      if (others.length >= AI_MAX_SQUAD) {
        // 1.1.1 (no dumping): outside the transfer window only her cover may go
        // (a senior who joined while she was on the list); in it, the weakest.
        const squadThen = w.tx.select({ s: careerPlayerStateTable.injuredListSquad }).from(careerPlayerStateTable)
          .where(and(eq(careerPlayerStateTable.careerSaveId, careerSaveId), eq(careerPlayerStateTable.playerId, m.id))).get()?.s ?? null;
        const cover = new Set(coverOnRoster({ injuredListSquad: squadThen }, others.map((x) => x.id)));
        const weakest = [...others].filter((x) => x.kind === "player" && (inTransferWindow(today) || cover.has(x.id))).sort((a, b) => a.rating - b.rating)[0];
        if (!weakest) continue;
        releaseToMarket(w, careerSaveId, weakest.id, monthlySalaryFor(weakest.rating), poolTeamId, today);
        others = others.filter((x) => x !== weakest);
        released++;
      }
      w.setPlayerState(careerSaveId, m.id, { onInjuredList: false, injuredListSince: null, injuredListSquad: null, squadRole: "starter" });
      others.push(m);
    }
  }
  return { covered, released };
}

/**
 * Update 1, item 4a: an AI club lets her go; she is a free agent, asking `wage`. 1.1.3 (25 Oct): recorded as her
 * leaving the club on `onDate` ("leave", utils/aiMarketLimits.ts), so it does not sign her back that season or the next.
 */
function releaseToMarket(w: CareerStateTx, careerSaveId: number, playerId: number, wage: number, poolTeamId: number, onDate: string): void {
  w.setPlayerState(careerSaveId, playerId, {
    teamId: null, poolTeamId: null, salary: wage, perks: "", contractEndDate: null, isActive: false, poolJoinedOn: null,
  });
  recordAiMoveTx(w.tx, careerSaveId, poolTeamId, "leave", playerId, null, onDate);
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const addDaysTo = (date: string, days: number) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };

/** A fixed shuffle for the week (the game date), so a run is repeatable. */
function weekOrder<T>(items: T[], seed: string): T[] {
  const key = (s: string) => { let h = 0x811c9dc5; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
  return items.map((x, i) => ({ x, k: key(`${seed}:${i}`) })).sort((a, b) => a.k - b.k).map((e) => e.x);
}

/**
 * 1.1.3 (Rob, 25 Oct): an AI club renews `m`, re-priced to the wage for her
 * rating and on its own length, if that fits under its cap (renewalCapRefusalTx);
 * the renewal is recorded in the season her contract ends in, so the club's one
 * renewal a season is counted there (a contract that ran out on 31 December is
 * renewed at the turn, a day later). Returns whether she renewed.
 */
function renewAiSeniorTx(w: CareerStateTx, careerSaveId: number, poolTeamId: number, m: AiMember, seasonEnds: readonly string[], today: string,
  squad: readonly AiMember[]): boolean {
  if (!m.contractEndDate) return false;
  const wage = monthlySalaryFor(m.rating);
  const perks = perksMonthly(w.tx.select({ p: careerPlayerStateTable.perks }).from(careerPlayerStateTable)
    .where(and(eq(careerPlayerStateTable.careerSaveId, careerSaveId), eq(careerPlayerStateTable.playerId, m.id))).get()?.p ?? "");
  if (renewalCapRefusalTx(w.tx, careerSaveId, { poolTeamId }, m.contractEndDate, m.salary + perks, wage + perks) != null) return false;
  // 1.1.3 (Rob, 25 Oct; item 4): three rather than two. On the day her new deal starts, the club's bill with her
  // re-priced must leave room for its other places at the cheapest free agents' wages, or it lets her go and
  // fills all three for less.
  const starts = m.contractEndDate < today ? today : nextDay(m.contractEndDate);
  const others = squad.filter((x) => x !== m && !x.onList && (!x.contractEndDate || x.contractEndDate >= starts)).length;
  const coming = w.tx.select({ id: transferDealsTable.id }).from(transferDealsTable).where(and(eq(transferDealsTable.careerSaveId, careerSaveId),
    eq(transferDealsTable.toPoolTeamId, poolTeamId), eq(transferDealsTable.status, "agreed"))).all().length;
  const toFill = Math.max(0, AI_MAX_SQUAD - 1 - others - coming);
  const room = cheapestFreeWagesTx(w.tx, careerSaveId).slice(0, toFill).reduce((t, x) => t + x, 0);
  if (seniorWageBillTx(w.tx, careerSaveId, { poolTeamId }, starts) + wage + perks + room > SALARY_CAP) return false;
  const length = lengthForRating(clubRating(w.tx, poolTeamId));
  w.setPlayerState(careerSaveId, m.id, { salary: wage, contractEndDate: renewalEndDate(length, m.contractEndDate, seasonEnds) });
  recordAiMoveTx(w.tx, careerSaveId, poolTeamId, "renew", m.id, null, m.contractEndDate < today ? m.contractEndDate : today);
  return true;
}

const nextDay = (date: string) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
/** The last day of `today`'s season, and the first of the next (seasons run 1 January to 31 December). */
const seasonEndOf = (today: string) => `${seasonYearOf(today)}-12-31`;
const nextSeasonStartOf = (today: string) => `${seasonYearOf(today) + 1}-01-01`;
/** Whether her contract runs into next season (a senior with no end date is the club's for good). */
const runsPastSeason = (m: AiMember, today: string) => !m.contractEndDate || m.contractEndDate > seasonEndOf(today);

/**
 * 1.1.3 (25 Oct): who an AI club has for next season. Its seniors holding a
 * place whose contracts run past this season, and its best if her contract ends
 * this season and it has not used its renewal (it will renew her, cap allowing).
 * `need` is the places it must fill for next season (AI_MAX_SQUAD less those).
 */
function nextSeasonOf(tx: Tx, careerSaveId: number, poolTeamId: number, squad: readonly AiMember[], today: string) {
  const best = squad[0];
  const bestRenews = !!best && best.kind === "player" && !runsPastSeason(best, today) && !best.onList
    && aiRenewalsTx(tx, careerSaveId, poolTeamId, seasonYearOf(today)) === 0;
  const staying = squad.filter((m) => !m.onList && (runsPastSeason(m, today) || (bestRenews && m === best)));
  return { staying, bestRenews, best, need: Math.max(0, AI_MAX_SQUAD - staying.length) };
}

/** Her price on the market (marketPrice: a free agent, one month of her market wage, ±15%) and her asking wage. */
function marketTerms(careerSaveId: number, f: ReturnType<typeof freeAgentsTx>[number]) {
  const priced = { id: f.id, askingPrice: f.askingPrice == null ? null : Number(f.askingPrice), salary: Number(f.salary ?? 0),
    speed: f.speed, power: f.power, defense: f.defense, serve: f.serve, block: f.block, stamina: f.stamina, poolTeamId: null, teamId: null };
  return { price: marketPrice(careerSaveId, priced as Parameters<typeof marketPrice>[1]).price, wage: askingWage(monthlySalaryFor(f.rating), 1, 0) };
}

/**
 * 1.1.3 (Rob, 25 Oct): through the year, an AI club with places to fill for
 * next season (nextSeasonOf `need`: a contract ending this season it will not
 * renew) scouts the market for them: one report a week, on the best player it
 * could fit under its cap next season (her asking wage, room kept for its other
 * places at the cheapest free agents' wages) that it has no report on yet, a
 * free agent or a player whose contract with another AI club ends this season
 * and who is not that club's best (she will be on the market at the turn). It
 * keeps one report more than its places, and stays within its season's limits
 * (utils/aiMarketLimits.ts: 10 reports, 2 on players at any one club). The
 * report is a Scout's or coach's job (utils/scoutingWork.ts), SCOUT_DAYS long.
 * Not in the window's last week: there is nothing left to scout for. Returns
 * how many reports it started.
 */
export function aiMarketScoutingWeekTx(w: CareerStateTx, careerSaveId: number, today: string): number {
  const year = seasonYearOf(today);
  if (inTransferWindow(today) && addDaysTo(today, 7) > transferWindowFor(year).closes) return 0;
  const active = w.tx.select({ id: careerPoolTeamStateTable.poolTeamId }).from(careerPoolTeamStateTable)
    .where(and(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), isNull(careerPoolTeamStateTable.takenOverAt))).all().map((r) => r.id);
  const squads = aiSquadsTx(w.tx, careerSaveId);
  // The players each AI club will let go at the turn: a contract ending this season, not its best.
  const leaving: Array<{ id: number; name: string; rating: number; at: MoveTarget }> = [];
  for (const club of active) {
    const squad = squads.get(club) ?? [];
    for (const m of squad) if (m.kind === "player" && m !== squad[0] && !runsPastSeason(m, today)) leaving.push({ id: m.id, name: m.name, rating: m.rating, at: { poolTeamId: club } });
  }
  const free = freeAgentsTx(w.tx, careerSaveId).filter((f) => !f.injured).map((f) => ({ id: f.id, name: f.name, rating: f.rating, at: null as MoveTarget }));
  const available = new Set([...free, ...leaving].map((c) => c.id));
  const cheapest = cheapestFreeWagesTx(w.tx, careerSaveId);
  let started = 0;
  for (const club of weekOrder(active, `${careerSaveId}:${today}:ai-market-scouting`)) {
    const squad = squads.get(club) ?? [];
    const { need, bestRenews, best } = nextSeasonOf(w.tx, careerSaveId, club, squad, today);
    if (need === 0) continue;
    const moves = aiSeasonMovesTx(w.tx, careerSaveId, club, today);
    const held = [...moves.reports.keys()].filter((id) => available.has(id)).length;
    if (held > need) continue;
    // Next season's bill: the contracts that run past this one (and the players bought ahead who arrive), its
    // best re-priced if it renews her, and the cheapest free agents for its other places.
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
    started++;
  }
  return started;
}

export type AiMarketWeek = { renewed: number; signed: number; promoted: number; released: number; open: number };

/**
 * 1.1.3 (Rob, 25 Oct; AI market brief item 1): the AI clubs' market, each
 * weekly block in the transfer window (7 to 31 December, the end of the season
 * the contracts end in). Each AI club, in a fixed order for the week:
 *
 *   renews its best, if her contract ends this season and it has not renewed
 *   anyone this season (one a season; cap allowing);
 *   then fills each place it has for next season (nextSeasonOf `need`) from
 *   the free-agent market, paying her price (marketTerms) and her asking wage
 *   on its own length (a contract signed in the window runs from next season):
 *   the best healthy free agent it can pay (her price and three months of her
 *   wage in the bank) and fit under its cap both today and next season, with
 *   room kept for its other places at the cheapest free agents' wages. Before
 *   the window's last week it signs only a player it has a ready report on or
 *   one as good as the player she replaces (within AI_BUY_GAP), and otherwise
 *   waits a week for the market to fill; in the last week it takes the best it
 *   can afford (a cheaper player), else promotes its academy's best youth
 *   (PROMOTION_MIN_AGE and up) if she fits under its cap, else the place stays
 *   open and the reason is recorded ("open:cap", "open:money", "open:none").
 *
 * A player whose contract ends this season and is not renewed leaves the day
 * her place or her wage is needed for her replacement (weakest first): she is
 * released to the free-agent market then, where the other clubs (and the
 * player) can sign her, and never leaves the club with fewer than AI_MIN_SQUAD
 * holding a place. One not needed by then leaves at the turn (keepAiSquadsTx).
 */
export function aiMarketWindowTx(w: CareerStateTx, careerSaveId: number, today: string, seasonEnds: readonly string[]): AiMarketWeek {
  const out: AiMarketWeek = { renewed: 0, signed: 0, promoted: 0, released: 0, open: 0 };
  if (!inTransferWindow(today)) return out;
  const year = seasonYearOf(today);
  const lastWeek = addDaysTo(today, 7) > transferWindowFor(year).closes;
  const active = w.tx.select({ id: careerPoolTeamStateTable.poolTeamId }).from(careerPoolTeamStateTable)
    .where(and(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), isNull(careerPoolTeamStateTable.takenOverAt))).all().map((r) => r.id);
  for (const club of weekOrder(active, `${careerSaveId}:${today}:ai-market`)) {
    // Rebuilt for each club: the clubs before it have signed and released.
    let squad = aiSquadsTx(w.tx, careerSaveId).get(club) ?? [];
    let next = nextSeasonOf(w.tx, careerSaveId, club, squad, today);
    if (next.bestRenews && next.best && !hasAgreedMoveTx(w.tx, careerSaveId, next.best.id)
      && !(next.best.injured && next.best.injuryWeeks >= MONEY.salaryCap.injuredLongWeeks)
      && renewAiSeniorTx(w, careerSaveId, club, next.best, seasonEnds, today, squad)) {
      out.renewed++;
      squad = aiSquadsTx(w.tx, careerSaveId).get(club) ?? [];
    }
    const moves = aiSeasonMovesTx(w.tx, careerSaveId, club, today);
    for (let guard = 0; guard < AI_MAX_SQUAD; guard++) {
      // Who stays for next season now counts its best only if it renewed her.
      const placed = squad.filter((m) => !m.onList);
      const staying = placed.filter((m) => runsPastSeason(m, today));
      const coming = w.tx.select({ id: transferDealsTable.id }).from(transferDealsTable).where(and(eq(transferDealsTable.careerSaveId, careerSaveId),
        eq(transferDealsTable.toPoolTeamId, club), eq(transferDealsTable.status, "agreed"))).all().length;
      const need = AI_MAX_SQUAD - staying.length - coming;
      if (need <= 0) break;
      // Its players leaving at the turn, weakest first: one may go now, to make room for her replacement.
      const leavers = placed.filter((m) => m.kind === "player" && !runsPastSeason(m, today) && !hasAgreedMoveTx(w.tx, careerSaveId, m.id))
        .sort((a, b) => a.rating - b.rating || a.id - b.id);
      const replacing = leavers.at(-1)?.rating ?? 0;
      const costOf = new Map(leavers.map((l) => [l.id, l.salary + perksMonthly(w.tx.select({ p: careerPlayerStateTable.perks }).from(careerPlayerStateTable)
        .where(and(eq(careerPlayerStateTable.careerSaveId, careerSaveId), eq(careerPlayerStateTable.playerId, l.id))).get()?.p ?? "")]));
      const todayBill = committedWageBillTx(w.tx, careerSaveId, { poolTeamId: club });
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
      const leaveForMarket = (l: AiMember) => {
        releaseToMarket(w, careerSaveId, l.id, monthlySalaryFor(l.rating), club, today);
        out.released++;
      };
      const balance = balanceOf(w.tx, careerSaveId, club);
      const gone = leftClubTx(w.tx, careerSaveId, club, today);
      const free = freeAgentsTx(w.tx, careerSaveId).filter((f) => !f.injured && !gone.has(f.id)).map((f) => ({ f, ...marketTerms(careerSaveId, f) }));
      const fitting = free.filter((c) => fitsNext(c.wage) && goingFor(c.wage) != null);
      const affordable = fitting.filter((c) => balance >= c.price + 3 * c.wage);
      const wanted = affordable.filter((c) => (moves.reports.get(c.f.id) ?? "9999") <= today || c.f.rating >= replacing - AI_BUY_GAP);
      const pick = (wanted[0] ?? (lastWeek ? affordable[0] : undefined));
      if (pick && mayBid(moves, null)) {
        for (const l of goingFor(pick.wage)!) leaveForMarket(l);
        signToAiClub(w, careerSaveId, club, pick.f.id, pick.f.rating, today, seasonEnds);
        addToBalance(w.tx, careerSaveId, club, -pick.price);
        recordAiMoveTx(w.tx, careerSaveId, club, "sign", pick.f.id, null, today, null, moves);
        out.signed++;
        squad = aiSquadsTx(w.tx, careerSaveId).get(club) ?? [];
        continue;
      }
      if (!lastWeek) break;   // it waits a week for the market
      // Nobody it can sign: its academy's best youth steps up, if she fits under its cap.
      const youth = academyBestTx(w.tx, careerSaveId, club, PROMOTION_MIN_AGE);
      const youthWage = youth ? askingWage(monthlySalaryFor(youth.rating), 1, 0) : 0;
      const youthGoing = youth && fitsNext(youthWage) ? goingFor(youthWage) : null;
      if (youth && youthGoing) {
        for (const l of youthGoing) leaveForMarket(l);
        w.setPlayerState(careerSaveId, youth.id, { isPromoted: true, academyRole: null });
        signToAiClub(w, careerSaveId, club, youth.id, youth.rating, today, seasonEnds);
        recordAiMoveTx(w.tx, careerSaveId, club, "promote", youth.id, null, today);
        out.promoted++;
        squad = aiSquadsTx(w.tx, careerSaveId).get(club) ?? [];
        continue;
      }
      // The place stays open for now (the turn's refill tries again), and why.
      const why = pick ? "limit" : fitting.length > 0 ? "money" : free.length === 0 && !youth ? "none" : "cap";
      for (let n = 0; n < need; n++) recordAiMoveTx(w.tx, careerSaveId, club, `open:${why}`, -1, null, today);
      out.open += need;
      break;
    }
  }
  return out;
}

/**
 * The AI clubs' week on the market. 1.1.3 (Rob, 25 Oct): first the market,
 * scouting for next season's places through the year and signing from the
 * free agents in the window (aiMarketScoutingWeekTx, aiMarketWindowTx); AI
 * clubs no longer bid for each other's players.
 *
 * Then their bids for the player's seniors, a few a week
 * (AI_TRANSFERS_PER_WEEK). A club with money (her price plus AI_BUY_RESERVE)
 * bids for the best fit senior of his who is at least AI_BUY_GAP better than
 * its weaker starter (with room) or its weakest senior (full, item 4c: it
 * releases her to the market), and fits under its cap. His club answers from
 * its Team page (utils/transfers.ts). 1.1.3 (A3): a club scouts her first and
 * bids once its report is ready, within its season's limits
 * (utils/aiMarketLimits.ts).
 */
export function aiTransfersWeekTx(w: CareerStateTx, careerSaveId: number, today: string, seasonEnds: readonly string[]): Array<{ player: string; from: string; to: number; fee: number; outcome: string }> {
  aiMarketScoutingWeekTx(w, careerSaveId, today);
  aiMarketWindowTx(w, careerSaveId, today, seasonEnds);
  const bids: Array<{ player: string; from: string; to: number; fee: number; outcome: string }> = [];
  const active = new Set(w.tx.select({ id: careerPoolTeamStateTable.poolTeamId }).from(careerPoolTeamStateTable)
    .where(and(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), isNull(careerPoolTeamStateTable.takenOverAt))).all().map((r) => r.id));
  const myTeam = careerTeamIdTx(w.tx, careerSaveId);
  let freeWages: number[] | undefined;
  // 1.1.1 (17 Oct, found by the full build's timings): the squads, his bid-able seniors, and each candidate's
  // price and open deal are the same for every buyer until a bid is made, so they are worked out once and
  // again only after a bid (each buyer had rebuilt them: half a second a game week once few clubs had a deal).
  let squadsNow: Map<number, AiMember[]> | null = null;
  let robsNow: ReturnType<typeof robsSeniorsForBidsTx> | null = null;
  let listedNow: Set<number> | null = null;
  const feeOf = new Map<number, number>(), openOf = new Map<number, boolean>();
  for (const buyer of weekOrder([...active], `${careerSaveId}:${today}:ai-transfers`)) {
    if (bids.length >= AI_TRANSFERS_PER_WEEK) break;
    // One deal at a time: a club already buying someone ahead waits for her.
    const buying = w.tx.select({ id: transferDealsTable.id }).from(transferDealsTable).where(and(eq(transferDealsTable.careerSaveId, careerSaveId),
      eq(transferDealsTable.toPoolTeamId, buyer), inArray(transferDealsTable.status, ["offered", "agreed"]))).get();
    if (buying) continue;
    const squads = (squadsNow ??= aiSquadsTx(w.tx, careerSaveId));
    const mine = (squads.get(buyer) ?? []).filter((m) => !m.onList);
    if (mine.length < AI_MIN_SQUAD) continue;
    // Update 1, item 4c (Rob, 14 Oct): a full club may buy too, a player at
    // least AI_BUY_GAP better than its WEAKEST senior, whom it lets go when she
    // arrives (in the window); the cap still applies (with that wage gone).
    const weakest = mine.length >= AI_MAX_SQUAD ? mine[mine.length - 1]! : null;
    if (weakest && weakest.kind !== "player") continue;
    const bar = (weakest ?? mine[AI_MIN_SQUAD - 1]!).rating + AI_BUY_GAP;
    const balance = balanceOf(w.tx, careerSaveId, buyer);
    // 1.1.1 (AC-9 A): his seniors held at his club at least AI_KEEP_DAYS, fit, with no deal already.
    // 1.1.3 (Rob, 25 Oct): only his: an AI club buys other AI clubs' players from the market, when their contracts end.
    const robs = myTeam == null ? [] : (robsNow ??= robsSeniorsForBidsTx(w.tx, careerSaveId, myTeam, today)).map((m) => ({ ...m, at: { teamId: myTeam } as Club }));
    if (robs.length === 0) break;
    listedNow ??= listedIdsTx(w.tx, careerSaveId);
    const listed = listedNow;
    const open = (id: number) => { let o = openOf.get(id); if (o == null) { o = !!openDealForTx(w.tx, careerSaveId, id); openOf.set(id, o); } return o; };
    const priceOf = (m: { id: number; priced: unknown }) => { let f = feeOf.get(m.id); if (f == null) {
      f = marketPrice(careerSaveId, m.priced as Parameters<typeof marketPrice>[1]).price;
      if (listed.has(m.id)) f = Math.round(f * LISTED_TERMS.feeShare);
      feeOf.set(m.id, f); } return f; };
    // 1.1.3 (A3): its season's scouting and bids (AI_SEASON_LIMITS, from the save). It bids for a senior
    // only once its report on her is ready; with none, it starts one (a Scout's or coach's job, SCOUT_DAYS)
    // and bids a later week. At most 10 reports and 10 bids a season, 2 of each at any one club.
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
    // Her weakest's wage counts as gone on the arrival date only if her contract still runs then (one that
    // ends sooner is already out of that day's bill: counting it again let a club land over its cap; the soak).
    const freeing = weakest && (!weakest.contractEndDate || weakest.contractEndDate >= arrivesOn) ? weakest.salary : 0;
    // 1.1.1 (the soak, 17 Oct): a contract that ends before she comes is room only for a player the club can
    // do without: renewing her must then fit on the arrival date (renewalCapRefusalTx), so she goes. It must
    // still field AI_MIN_SQUAD until then: it counts either the cheapest of those players, kept, or as many of
    // the cheapest healthy free agents (whom its refill signs when it is short), whichever costs less.
    const runsPast = (m: AiMember) => !m.contractEndDate || m.contractEndDate >= arrivesOn;
    const staying = mine.filter((m) => m !== weakest && runsPast(m)).length;
    const keep = mine.filter((m) => m !== weakest && !runsPast(m)).sort((a, b) => a.salary - b.salary).slice(0, Math.max(0, AI_MIN_SQUAD - staying));
    const keepCost = keep.reduce((t, m) => t + m.salary + (m.kind !== "player" ? 0 : perksMonthly(w.tx.select({ p: careerPlayerStateTable.perks }).from(careerPlayerStateTable)
      .where(and(eq(careerPlayerStateTable.careerSaveId, careerSaveId), eq(careerPlayerStateTable.playerId, m.id))).get()?.p ?? "")), 0);
    const free = keep.length === 0 ? [] : (freeWages ??= cheapestFreeWagesTx(w.tx, careerSaveId)).slice(0, keep.length);
    const fillCost = free.length === keep.length ? free.reduce((t, x) => t + x, 0) : Infinity;
    const room = SALARY_CAP - (seniorWageBillTx(w.tx, careerSaveId, { poolTeamId: buyer }, arrivesOn, squads) - freeing + Math.min(keepCost, fillCost)) - wage;
    if (room < 0) continue;
    const terms ={ wage, length: lengthForRating(clubRating(w.tx, buyer)), perks: aiOfferPerks(wage, room) };
    const r = bidTx(w, careerSaveId, { poolTeamId: buyer }, target.m.id, terms, target.fee, today, freeing);
    if (!r.ok) continue;
    // 1.1.3 (A3): a bid made counts, whatever her club answers.
    recordAiMoveTx(w.tx, careerSaveId, buyer, "bid", target.m.id, target.m.at, today, null, moves);
    squadsNow = null; robsNow = null; listedNow = null; feeOf.clear(); openOf.clear();
    bids.push({ player: target.m.name, from: r.deal.fromTeamId != null ? "player" : String(r.deal.fromPoolTeamId), to: buyer, fee: target.fee, outcome: r.outcome });
  }
  keepAiSquadsTx(w, careerSaveId, today, seasonEnds);
  return bids;
}

/** 1.1.1: the seniors on the transfer list in this career. */
function listedIdsTx(tx: Tx, careerSaveId: number): Set<number> {
  return new Set(tx.select({ id: careerPlayerStateTable.playerId }).from(careerPlayerStateTable)
    .where(and(eq(careerPlayerStateTable.careerSaveId, careerSaveId), eq(careerPlayerStateTable.transferListed, true),
      eq(careerPlayerStateTable.isRetired, false))).all().map((r) => r.id));
}

/**
 * 1.1.1 (Rob, 18 Oct): the AI clubs use "Ask her to retire" and the transfer list by the player's
 * rules (AI_DEADWOOD). Asking pays out the rest of her contract from the club's balance; she retires
 * at once (playerDto retirePlayers). Runs in the weekly block, before the AI clubs' buying.
 * Off under VBE_RETIREMENT=limit, as the chance at the turn is.
 */
export function aiDeadwoodTx(w: CareerStateTx, careerSaveId: number, today: string): { asked: number; listed: number } {
  let asked = 0, listed = 0;
  // A suite's switch (utils/retirement.ts): VBE_RETIREMENT=limit keeps only the age limit, so squads hold still.
  if (process.env.VBE_RETIREMENT === "limit") return { asked, listed };
  const window = inTransferWindow(today);
  const recon = reconstructionsTx(w.tx, careerSaveId);
  const already = listedIdsTx(w.tx, careerSaveId);
  const s = careerPlayerStateTable;
  for (const [poolTeamId, squad] of aiSquadsTx(w.tx, careerSaveId)) {
    const players = squad.filter((m) => m.kind === "player");
    if (players.length === 0) continue;
    const ages = new Map(w.tx.select({ id: s.playerId, age: s.age }).from(s)
      .where(and(eq(s.careerSaveId, careerSaveId), inArray(s.playerId, players.map((m) => m.id)))).all().map((r) => [r.id, r.age]));
    const ageOf = (m: AiMember) => ages.get(m.id) ?? 0;
    const weakest = [...players].sort((a, b) => a.rating - b.rating || b.id - a.id)[0]!;
    const canLose = squad.length - 1 >= AI_MIN_SQUAD;
    const broken = players.filter((m) => (m.onList || (recon.get(m.id) ?? 0) > 0) && ageOf(m) >= AI_DEADWOOD.brokenAge)
      .sort((a, b) => a.rating - b.rating)[0];
    const ask = canLose ? (broken ?? (window && ageOf(weakest) >= AI_DEADWOOD.askAge ? weakest : null)) : null;
    if (ask) {
      const payout = ask.contractEndDate ? terminationPayout(ask.salary, today, ask.contractEndDate) : 0;
      if (payout > 0) addToBalance(w.tx, careerSaveId, poolTeamId, -payout);
      w.retirePlayers(careerSaveId, [{ playerId: ask.id, reason: "asked" }], Number(today.slice(0, 4)), today);
      asked++;
      continue;
    }
    if (window && ageOf(weakest) >= AI_DEADWOOD.listAge && !already.has(weakest.id) && !hasAgreedMoveTx(w.tx, careerSaveId, weakest.id)) {
      w.setPlayerState(careerSaveId, weakest.id, { transferListed: true });
      listed++;
    }
  }
  return { asked, listed };
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

/**
 * 1.1.1 (found by the soak): the day a bought player joins an AI club, the club is under its cap. Its bid
 * counted its weakest senior's wage as gone; if she has not gone (the club was not over its places) or the
 * squad changed since, it lets its weakest go (never the one who has just arrived, never below two seniors)
 * until it is under. Returns how many it let go.
 */
export function aiCapOnArrivalTx(w: CareerStateTx, careerSaveId: number, buyers: ReadonlyMap<number, number>, today: string): number {
  let released = 0;
  for (const [poolTeamId, arrived] of buyers) {
    for (;;) {
      const squad = (aiSquadsTx(w.tx, careerSaveId).get(poolTeamId) ?? []).filter((m) => !m.onList);
      // (A plain comparison: fitsUnderCap passes any change of nothing, so it can't say whether a bill is over.)
      if (seniorWageBillTx(w.tx, careerSaveId, { poolTeamId }) <= SALARY_CAP || squad.length <= AI_MIN_SQUAD) break;
      const weakest = squad.filter((m) => m.kind === "player" && m.id !== arrived).sort((a, b) => a.rating - b.rating)[0];
      if (!weakest) break;
      releaseToMarket(w, careerSaveId, weakest.id, monthlySalaryFor(weakest.rating), poolTeamId, today);
      released++;
    }
  }
  return released;
}

/**
 * 1.1.1: in the transfer window, an AI club carrying more seniors than its
 * places (a bought-ahead player arrived, or a fit player came back) lets its
 * weakest go until it has AI_MAX_SQUAD. Outside the window it carries them.
 */
export function aiTrimSquadsTx(w: CareerStateTx, careerSaveId: number, today: string, onlyClubs?: ReadonlySet<number>): number {
  let released = 0;
  for (const [poolTeamId, squad] of aiSquadsTx(w.tx, careerSaveId)) {
    // Outside the window only a club a bought player has just joined trims (its bid counted the weakest gone).
    if (onlyClubs && !onlyClubs.has(poolTeamId)) continue;
    const placed = squad.filter((m) => !m.onList);
    const spare = placed.filter((m) => m.kind === "player").sort((a, b) => a.rating - b.rating);
    for (let n = placed.length; n > AI_MAX_SQUAD && spare.length > 0; n--) {
      const weakest = spare.shift()!;
      if (hasAgreedMoveTx(w.tx, careerSaveId, weakest.id)) continue;
      releaseToMarket(w, careerSaveId, weakest.id, monthlySalaryFor(weakest.rating), poolTeamId, today);
      released++;
    }
  }
  return released;
}

