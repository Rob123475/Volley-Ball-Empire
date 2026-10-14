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
 *     senior's contract that ran out is renewed, re-priced to her rating (or
 *     she is released if that breaks the cap, or if she is out injured
 *     MONEY.salaryCap.injuredLongWeeks or more); a club with fewer than three
 *     signs the best free agent it can afford and fit (AI_MAX_SQUAD, item 4c).
 *   - aiMatchInjuriesTx (after each of its matches, item 4c): the injury roll.
 *   - aiTransfersWeekTx (weekly): a few AI-to-AI moves, by squad need
 *     (AI_TRANSFERS_PER_WEEK, like the youth loans' AI_BORROWS_PER_WEEK).
 *   - canSellTx: an AI club only sells if it still has two to play, or can
 *     sign a free agent at once to make two.
 *   - aiSeniorsTrainWeekTx (weekly, Update 1 item 3): its seniors train.
 */
import {
  careerPlayerStateTable, playersTable, continentalPoolPlayersTable, continentalPoolTeamsTable,
  poolPlayerContractsTable, careerPoolTeamStateTable, seasonsTable, db, MONEY, rollPotential, type DevelopmentProfile,
} from "@workspace/db";
import { and, asc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { loadStaffTx, type CareerStateTx } from "../lib/playerDto.js";
import { trainingStaffBonuses } from "./staffBonuses.js";
import { generateDevelopment } from "./player-development.js";
import { overallRating } from "./overallRating.js";
import { sideRating } from "./matchEngine.js";
import { monthlySalaryFor } from "./clubFinances.js";
import { contractEndDate, renewalEndDate, CONTRACT_LENGTHS, isContractLength } from "./contractTerms.js";
import { lengthForRating } from "./poolClubFinances.js";
import { marketPrice } from "./marketScouting.js";
import { trainingSessionXp } from "./trainingXp.js";
import { AI_TRAIN_EVERY_WEEKS, aiProgrammeFor, aiTrainsThisWeek, careerWeekOf } from "./aiTraining.js";
import { specialityFactor } from "./managerFaces.js";
import { seniorWageBillTx, fitsUnderCap } from "./salaryCap.js";
import { isInjured, matchInjuryRoll, newInjuryPatch } from "./condition.js";
import { askingWage } from "./wageCurve.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
      injured: false, injuryWeeks: 0, development: null, seriousInjuries: 0,
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
    injuryWeeks: careerPlayerStateTable.injuryWeeksRemaining,
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
      injured: isInjured({ isInjured: s.isInjured, injuryStatus: s.injuryStatus ?? "Healthy" }), injuryWeeks: Number(s.injuryWeeks ?? 0),
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
export function aiMatchInjuriesTx(w: CareerStateTx, careerSaveId: number, poolTeamId: number, weatherMultiplier = 1, random: () => number = Math.random): string[] {
  const played = (aiSquadsTx(w.tx, careerSaveId).get(poolTeamId) ?? []).filter((m) => !m.injured).slice(0, AI_MIN_SQUAD);
  const fitnessGuru = specialityFactor({ careerSaveId, poolTeamId }, "Fitness Guru");
  const hurt: string[] = [];
  for (const m of played) {
    if (m.kind !== "player") continue;   // a pool player is not a career row yet: nothing to injure
    const inj = matchInjuryRoll({ stamina: m.stamina, development: m.development }, { weatherMultiplier, fitnessGuru }, random);
    if (!inj) continue;
    w.setPlayerState(careerSaveId, m.id, newInjuryPatch({ speed: m.speed, stamina: m.stamina, seriousInjuries: m.seriousInjuries }, inj));
    hurt.push(m.name);
  }
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
      careerSaveId, poolPlayerId: m.id, poolTeamId: m.poolTeamId, length: CONTRACT_LENGTHS[0],
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
 * week to week. Only in the career weeks AI_TRAIN_EVERY_WEEKS picks. Returns
 * how many trained.
 */
export function aiSeniorsTrainWeekTx(w: CareerStateTx, careerSaveId: number, today: string, every: number = AI_TRAIN_EVERY_WEEKS): number {
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
  const staff = new Map<number, number>();
  for (const s of seniors) {
    const club = s.poolTeamId!;
    if (!coach.has(club)) coach.set(club, specialityFactor({ careerSaveId, poolTeamId: club }, "Coach"));
    // Overnight part 3 (B-4): its Head Coach and Assistant Coach multiply the XP
    // through the player's own rule (utils/staffBonuses.ts); one off ill gives nothing.
    if (!staff.has(club)) staff.set(club, trainingStaffBonuses(loadStaffTx(w.tx, careerSaveId, { poolTeamId: club })).xpMultiplier);
    const xp = trainingSessionXp(s, aiProgrammeFor(s), { manager: coach.get(club), staff: staff.get(club) });
    w.setPlayerState(careerSaveId, s.id, { trainingPoints: xp.newPoints, ...xp.statUpdates });
  }
  return seniors.length;
}

/** An AI club's best academy youth (not out on loan), for when no free agent can be signed. */
function academyBestTx(tx: Tx, careerSaveId: number, poolTeamId: number) {
  return tx.select({
    id: playersTable.id,
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
    .map((p) => ({ id: p.id, rating: overallRating(p) }))
    .sort((a, b) => b.rating - a.rating || a.id - b.id)[0] ?? null;
}

/** The free agents an AI club can sign: seniors at no club, best first (item 4c: injured or not, and how long). */
function freeAgentsTx(tx: Tx, careerSaveId: number) {
  return tx.select({
    id: playersTable.id, name: playersTable.name,
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

function balanceOf(tx: Tx, careerSaveId: number, poolTeamId: number): number {
  return Number(tx.select({ b: careerPoolTeamStateTable.balance }).from(careerPoolTeamStateTable)
    .where(and(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), eq(careerPoolTeamStateTable.poolTeamId, poolTeamId)))
    .get()?.b ?? 0);
}

function addToBalance(tx: Tx, careerSaveId: number, poolTeamId: number, amount: number): void {
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
    teamId: null, poolTeamId, salary: askingWage(monthlySalaryFor(rating), 1, injuryWeeks), contractEndDate: contractEndDate(length, today, seasonEnds),
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
function bestAffordableFreeAgent(tx: Tx, careerSaveId: number, poolTeamId: number, freeing = 0, allowInjured = false) {
  const balance = balanceOf(tx, careerSaveId, poolTeamId);
  const bill = seniorWageBillTx(tx, careerSaveId, { poolTeamId }) - freeing;
  return freeAgentsTx(tx, careerSaveId)
    .filter((f) => allowInjured || !f.injured)
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
export function canSellTx(tx: Tx, careerSaveId: number, poolTeamId: number, clubName: string, freeing = 0): { ok: true } | { ok: false; reason: string } {
  const squad = aiSquadsTx(tx, careerSaveId).get(poolTeamId) ?? [];
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
    let left = squad.length;
    let fit = squad.filter((m) => !m.injured).length;
    for (const m of squad) {
      if (m.kind !== "player" || !m.contractEndDate || m.contractEndDate >= today) continue;
      const wage = monthlySalaryFor(m.rating);
      // Item 4c (4): a senior out MONEY.salaryCap.injuredLongWeeks or more is
      // not renewed; she goes to the market, asking the injured wage there
      // (utils/wageCurve.ts askingWage). The player's own renewals are his call.
      if (m.injured && m.injuryWeeks >= MONEY.salaryCap.injuredLongWeeks) {
        releaseToMarket(w, careerSaveId, m.id, wage);
        released++; left--;
        continue;
      }
      if (fitsUnderCap(seniorWageBillTx(w.tx, careerSaveId, { poolTeamId }), wage - m.salary)) {
        const length = lengthForRating(clubRating(w.tx, poolTeamId));
        w.setPlayerState(careerSaveId, m.id, { salary: wage, contractEndDate: renewalEndDate(isContractLength(length) ? length : CONTRACT_LENGTHS[0], m.contractEndDate, seasonEnds) });
        renewed++;
      } else {
        releaseToMarket(w, careerSaveId, m.id, wage);
        released++; left--;
        if (!m.injured) fit--;
      }
    }
    // Item 4c (1): it refills to AI_MAX_SQUAD (two on the sand and an
    // interchange). (5): it may gamble on an injured free agent, at her injured
    // wage, only if it would still have two fit to play.
    for (let n = left; n < AI_MAX_SQUAD; n++) {
      const fa = bestAffordableFreeAgent(w.tx, careerSaveId, poolTeamId, 0, fit >= AI_MIN_SQUAD);
      if (fa) {
        signToAiClub(w, careerSaveId, poolTeamId, fa.id, fa.rating, today, seasonEnds, fa.injuryWeeks);
        signed++; if (!fa.injured) fit++;
        continue;
      }
      // The interchange only when it can pay one and fit her under its cap;
      // two on the sand comes first, by the steps below.
      if (n >= AI_MIN_SQUAD) break;
      // No free agent it can pay: its own academy's best youth steps up.
      const youth = academyBestTx(w.tx, careerSaveId, poolTeamId);
      if (youth) {
        w.setPlayerState(careerSaveId, youth.id, { isPromoted: true, academyRole: null });
        signToAiClub(w, careerSaveId, poolTeamId, youth.id, youth.rating, today, seasonEnds);
        signed++; fit++;
        continue;
      }
      // Final brief 5 Oct (found by the full harness, season 20 of a long
      // career): retirement can leave a broke club with nobody and no youth.
      // Two on the sand comes first, so it signs the cheapest free agent there
      // is, on credit: her wage goes on its books like any other, five
      // loss-making seasons sell it, and the sale clears its debts.
      const bill = seniorWageBillTx(w.tx, careerSaveId, { poolTeamId });
      const cheapest = freeAgentsTx(w.tx, careerSaveId).filter((f) => !f.injured && fitsUnderCap(bill, monthlySalaryFor(f.rating))).at(-1);
      if (!cheapest) { short++; break; }
      signToAiClub(w, careerSaveId, poolTeamId, cheapest.id, cheapest.rating, today, seasonEnds);
      signed++; fit++;
    }
  }
  return { renewed, released, signed, short };
}

/** Update 1, item 4a: an AI club lets her go; she is a free agent, asking `wage`. */
function releaseToMarket(w: CareerStateTx, careerSaveId: number, playerId: number, wage: number): void {
  w.setPlayerState(careerSaveId, playerId, {
    teamId: null, poolTeamId: null, salary: wage, contractEndDate: null, isActive: false, poolJoinedOn: null,
  });
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** A fixed shuffle for the week (the game date), so a run is repeatable. */
function weekOrder<T>(items: T[], seed: string): T[] {
  const key = (s: string) => { let h = 0x811c9dc5; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
  return items.map((x, i) => ({ x, k: key(`${seed}:${i}`) })).sort((a, b) => a.k - b.k).map((e) => e.x);
}

/**
 * The AI clubs' own transfers, a few a week (AI_TRANSFERS_PER_WEEK). A club
 * with money (her price plus AI_BUY_RESERVE) buys the best fit career senior at
 * another AI club who is at least AI_BUY_GAP better than its weaker starter
 * (with room) or its weakest senior (full, item 4c: it releases her to the
 * market), and fits under its cap, if that club can sell
 * (canSellTx). The fee goes to the seller, the seller refills from free agents
 * if it must, and she joins on the buyer's terms. Only career seniors move:
 * the Player Market has made the AI clubs' players into them.
 */
export function aiTransfersWeekTx(w: CareerStateTx, careerSaveId: number, today: string, seasonEnds: readonly string[]): Array<{ player: string; from: number; to: number; fee: number }> {
  const moves: Array<{ player: string; from: number; to: number; fee: number }> = [];
  const names = new Map(w.tx.select({ id: continentalPoolTeamsTable.id, name: continentalPoolTeamsTable.teamName }).from(continentalPoolTeamsTable).all().map((t) => [t.id, t.name]));
  const active = new Set(w.tx.select({ id: careerPoolTeamStateTable.poolTeamId }).from(careerPoolTeamStateTable)
    .where(and(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), isNull(careerPoolTeamStateTable.takenOverAt))).all().map((r) => r.id));
  const moved = new Set<number>();
  for (const buyer of weekOrder([...active], `${careerSaveId}:${today}:ai-transfers`)) {
    if (moves.length >= AI_TRANSFERS_PER_WEEK) break;
    const squads = aiSquadsTx(w.tx, careerSaveId);
    const mine = squads.get(buyer) ?? [];
    if (mine.length < AI_MIN_SQUAD) continue;
    // Update 1, item 4c (Rob, 14 Oct): a full club may buy too, a player at
    // least AI_BUY_GAP better than its WEAKEST senior, whom it then releases to
    // the market; the cap still applies (with her wage gone).
    const weakest = mine.length >= AI_MAX_SQUAD ? mine[mine.length - 1]! : null;
    if (weakest && weakest.kind !== "player") continue;
    const bar = (weakest ?? mine[AI_MIN_SQUAD - 1]!).rating + AI_BUY_GAP;
    const balance = balanceOf(w.tx, careerSaveId, buyer);
    // Update 1, item 4a: an AI club only buys a player who fits under its cap.
    const bill = seniorWageBillTx(w.tx, careerSaveId, { poolTeamId: buyer }) - (weakest?.salary ?? 0);
    const target = [...squads.entries()]
      .filter(([club]) => club !== buyer && active.has(club))
      .flatMap(([, squad]) => squad)
      // Item 4c: it does not buy an injured player (only a free agent is a gamble it takes).
      .filter((m) => m.kind === "player" && !m.injured && !moved.has(m.id) && m.rating >= bar
        && (m.joinedOn == null || daysBetween(m.joinedOn, today) >= AI_KEEP_DAYS))
      .map((m) => ({ m, fee: marketPrice(careerSaveId, { ...m, askingPrice: null }).price }))
      .filter(({ m, fee }) => balance >= fee + AI_BUY_RESERVE && fitsUnderCap(bill, monthlySalaryFor(m.rating))
        && canSellTx(w.tx, careerSaveId, m.poolTeamId, names.get(m.poolTeamId) ?? "", m.salary).ok)
      .sort((a, b) => b.m.rating - a.m.rating || a.m.id - b.m.id)[0];
    if (!target) continue;
    const from = target.m.poolTeamId;
    addToBalance(w.tx, careerSaveId, buyer, -target.fee);
    addToBalance(w.tx, careerSaveId, from, target.fee);
    if (weakest) releaseToMarket(w, careerSaveId, weakest.id, monthlySalaryFor(weakest.rating));
    signToAiClub(w, careerSaveId, buyer, target.m.id, target.m.rating, today, seasonEnds);
    moved.add(target.m.id);
    moves.push({ player: target.m.name, from, to: buyer, fee: target.fee });
    // The seller signs her replacement at once: it is never short, even for a day.
    keepAiSquadsTx(w, careerSaveId, today, seasonEnds);
  }
  keepAiSquadsTx(w, careerSaveId, today, seasonEnds);
  return moves;
}

/** Pay an AI club for a player Rob bought from it, and refill it if it must. */
export function aiClubSoldTx(w: CareerStateTx, careerSaveId: number, poolTeamId: number, fee: number, today: string, seasonEnds: readonly string[]): void {
  addToBalance(w.tx, careerSaveId, poolTeamId, fee);
  keepAiSquadsTx(w, careerSaveId, today, seasonEnds);
}
