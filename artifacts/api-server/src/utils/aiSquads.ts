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
 * Who an AI club holds, and every rule about it, is decided in one place:
 * utils/aiSquadPolicy.ts (1.1.3, Rob 26 Oct, squad policy brief item A). This
 * file only reads the squads, and keeps what is not a squad decision:
 *   - aiMatchInjuriesTx (after each of its matches, item 4c): the injury roll
 *     (a senior hurt onto the injured list is then covered by the policy).
 *   - materializeAiSeniorsTx: the AI clubs' pool players become career seniors.
 *   - aiSeniorsTrainWeekTx (weekly, Update 1 item 3): its seniors train.
 */
import {
  careerPlayerStateTable, playersTable, continentalPoolPlayersTable, continentalPoolTeamsTable,
  poolPlayerContractsTable, careerPoolTeamStateTable, seasonsTable, careerSavesTable, db, rollPotential,
  GAME_DIFFICULTY, gameDifficultyOf, type DevelopmentProfile,
} from "@workspace/db";
import { and, asc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { loadStaffTx, type CareerStateTx } from "../lib/playerDto.js";
import { trainingStaffBonuses, injuryRiskStaffFactor } from "./staffBonuses.js";
import { generateDevelopment } from "./player-development.js";
import { overallRating } from "./overallRating.js";
import { sideRating } from "./matchEngine.js";
import { monthlySalaryFor } from "./clubFinances.js";
import { DEFAULT_CONTRACT_LENGTH } from "./contractTerms.js";
import { trainingSessionXp } from "./trainingXp.js";
import { aiProgrammeFor, aiTrainsThisWeek, careerWeekOf } from "./aiTraining.js";
import { specialityFactor } from "./managerFaces.js";
import { isInjured, matchInjuryRoll } from "./condition.js";
import { startInjuryTx } from "./injuries.js";
import { careerGameDateTx } from "./gameDate.js";
import { aiSquadPolicyTx } from "./aiSquadPolicy.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Two on the sand: an AI club never goes below this (Rob, U-6), and needs this many fit to play. */
export const AI_MIN_SQUAD = 2;
/** Two on the sand and one interchange: what an AI club holds and fills to (item 4c; utils/aiSquadPolicy.ts). */
export const AI_MAX_SQUAD = 3;

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

/**
 * A skin tone for a player with no pool player's look of her own (a free agent an AI club signed, a new senior, a
 * graduate): one of her nation's pool players' tones, the way R-75 seeded them, fixed by her id; any pool player's
 * if her nation has none. One rule for the 3D court (aiSquadsTx) and the podium (utils/ceremonies.ts).
 */
export function nationTones(poolRows: ReadonlyArray<{ nationality: string; skinTone: string | null }>): (nationality: string, id: number) => string | null {
  const tonesByNation = new Map<string, string[]>();
  for (const p of poolRows) if (p.skinTone) tonesByNation.set(p.nationality, [...(tonesByNation.get(p.nationality) ?? []), p.skinTone]);
  const allTones = poolRows.map((p) => p.skinTone).filter((t): t is string => !!t);
  return (nationality, id) => { const l = tonesByNation.get(nationality) ?? allTones; return l.length ? l[id % l.length]! : null; };
}

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
  const poolRows = tx.select().from(continentalPoolPlayersTable).all();
  const toneFor = nationTones(poolRows);
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
  if (hurt.length > 0) aiSquadPolicyTx(w, careerSaveId, { kind: "injury", today: date, poolTeamId });
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

export function balanceOf(tx: Tx, careerSaveId: number, poolTeamId: number): number {
  return Number(tx.select({ b: careerPoolTeamStateTable.balance }).from(careerPoolTeamStateTable)
    .where(and(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), eq(careerPoolTeamStateTable.poolTeamId, poolTeamId)))
    .get()?.b ?? 0);
}

export function addToBalance(tx: Tx, careerSaveId: number, poolTeamId: number, amount: number): void {
  tx.update(careerPoolTeamStateTable).set({ balance: balanceOf(tx, careerSaveId, poolTeamId) + amount, updatedAt: new Date() })
    .where(and(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), eq(careerPoolTeamStateTable.poolTeamId, poolTeamId))).run();
}
