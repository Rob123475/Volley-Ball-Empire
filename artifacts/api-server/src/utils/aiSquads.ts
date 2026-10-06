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
 * the regional league page. An AI club plays its best two.
 *
 * The rules an AI club follows with its squad live here too:
 *   - keepAiSquadsTx (weekly, and after the season rollover): a career
 *     senior's contract that ran out is renewed; a club left with fewer than
 *     two signs the best free agent it can afford (AI_MIN_SQUAD).
 *   - aiTransfersWeekTx (weekly): a few AI-to-AI moves, by squad need
 *     (AI_TRANSFERS_PER_WEEK, like the youth loans' AI_BORROWS_PER_WEEK).
 *   - canSellTx: an AI club only sells if it still has two to play, or can
 *     sign a free agent at once to make two.
 */
import {
  careerPlayerStateTable, playersTable, continentalPoolPlayersTable, continentalPoolTeamsTable,
  poolPlayerContractsTable, careerPoolTeamStateTable, db,
} from "@workspace/db";
import { and, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import type { CareerStateTx } from "../lib/playerDto.js";
import { overallRating } from "./overallRating.js";
import { sideRating } from "./matchEngine.js";
import { monthlySalaryFor } from "./clubFinances.js";
import { contractEndDate, renewalEndDate, CONTRACT_LENGTHS, isContractLength } from "./contractTerms.js";
import { lengthForRating } from "./poolClubFinances.js";
import { marketPrice } from "./marketScouting.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Two on the sand: an AI club never goes below this (Rob, U-6). */
export const AI_MIN_SQUAD = 2;
/** Two on the sand and one interchange: the most an AI club holds. */
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
    });
  }
  for (const l of squads.values()) l.sort(byRating);
  return squads;
}

/** The two an AI club plays: its best two. */
export function aiPairTx(tx: Tx, careerSaveId: number, poolTeamId: number): AiMember[] {
  return (aiSquadsTx(tx, careerSaveId).get(poolTeamId) ?? []).slice(0, AI_MIN_SQUAD);
}

/** Every AI club's strength: sideRating over the two it plays (the player's club's rule). */
export function aiClubRatingsTx(tx: Tx, careerSaveId: number): Map<number, number> {
  const ratings = new Map<number, number>();
  for (const [id, squad] of aiSquadsTx(tx, careerSaveId)) ratings.set(id, sideRating(squad.slice(0, AI_MIN_SQUAD)));
  return ratings;
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

/** The free agents an AI club can sign: seniors at no club, best first. */
function freeAgentsTx(tx: Tx, careerSaveId: number) {
  return tx.select({
    id: playersTable.id, name: playersTable.name,
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
    .map((p) => ({ ...p, rating: overallRating(p) }))
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

/** Sign a player to an AI club on the AI's own terms: its wage for her rating, its length for its rating. */
function signToAiClub(w: CareerStateTx, careerSaveId: number, poolTeamId: number, playerId: number, rating: number,
  today: string, seasonEnds: readonly string[]): void {
  const length = lengthForRating(clubRating(w.tx, poolTeamId));
  w.setPlayerState(careerSaveId, playerId, {
    teamId: null, poolTeamId, salary: monthlySalaryFor(rating), contractEndDate: contractEndDate(length, today, seasonEnds),
    isActive: false, squadRole: "starter", academyRole: null, scoutStartedOn: null, scoutReportBy: null,
    poolJoinedOn: today,
  });
}

/**
 * The best free agent a club can afford (three months of her wage in the bank),
 * or null. The club's own rule: the strongest it can pay.
 */
function bestAffordableFreeAgent(tx: Tx, careerSaveId: number, poolTeamId: number) {
  const balance = balanceOf(tx, careerSaveId, poolTeamId);
  return freeAgentsTx(tx, careerSaveId).find((f) => balance >= 3 * monthlySalaryFor(f.rating)) ?? null;
}

/**
 * Whether an AI club can let one of its players go: it still has two after, or
 * it can sign a free agent at once to make two. The refusal is in plain words.
 */
export function canSellTx(tx: Tx, careerSaveId: number, poolTeamId: number, clubName: string): { ok: true } | { ok: false; reason: string } {
  const squad = aiSquadsTx(tx, careerSaveId).get(poolTeamId) ?? [];
  if (squad.length - 1 >= AI_MIN_SQUAD) return { ok: true };
  if (bestAffordableFreeAgent(tx, careerSaveId, poolTeamId)) return { ok: true };
  return { ok: false, reason: `${clubName} won't sell: it would be left without two players to put on the sand, and there is no free agent it can sign in her place.` };
}

/**
 * Keep every AI club playable: renew its career seniors' contracts that ran
 * out (on her same wage, the club's own length), and refill any club below two
 * with the best free agent it can afford. Returns what it did.
 */
export function keepAiSquadsTx(w: CareerStateTx, careerSaveId: number, today: string, seasonEnds: readonly string[]): { renewed: number; signed: number; short: number } {
  let renewed = 0, signed = 0, short = 0;
  const squads = aiSquadsTx(w.tx, careerSaveId);
  // Every club still in the world, including one left with nobody.
  const clubs = w.tx.select({ id: careerPoolTeamStateTable.poolTeamId }).from(careerPoolTeamStateTable)
    .where(and(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), isNull(careerPoolTeamStateTable.takenOverAt))).all();
  for (const { id: poolTeamId } of clubs) {
    const squad = squads.get(poolTeamId) ?? [];
    for (const m of squad) {
      if (m.kind !== "player" || !m.contractEndDate || m.contractEndDate >= today) continue;
      const length = lengthForRating(clubRating(w.tx, poolTeamId));
      w.setPlayerState(careerSaveId, m.id, { contractEndDate: renewalEndDate(isContractLength(length) ? length : CONTRACT_LENGTHS[0], m.contractEndDate, seasonEnds) });
      renewed++;
    }
    for (let n = squad.length; n < AI_MIN_SQUAD; n++) {
      const fa = bestAffordableFreeAgent(w.tx, careerSaveId, poolTeamId);
      if (fa) { signToAiClub(w, careerSaveId, poolTeamId, fa.id, fa.rating, today, seasonEnds); signed++; continue; }
      // No free agent it can pay: its own academy's best youth steps up.
      const youth = academyBestTx(w.tx, careerSaveId, poolTeamId);
      if (youth) {
        w.setPlayerState(careerSaveId, youth.id, { isPromoted: true, academyRole: null });
        signToAiClub(w, careerSaveId, poolTeamId, youth.id, youth.rating, today, seasonEnds);
        signed++;
        continue;
      }
      // Final brief 5 Oct (found by the full harness, season 20 of a long
      // career): retirement can leave a broke club with nobody and no youth.
      // Two on the sand comes first, so it signs the cheapest free agent there
      // is, on credit: her wage goes on its books like any other, five
      // loss-making seasons sell it, and the sale clears its debts.
      const cheapest = freeAgentsTx(w.tx, careerSaveId).at(-1);
      if (!cheapest) { short++; break; }
      signToAiClub(w, careerSaveId, poolTeamId, cheapest.id, cheapest.rating, today, seasonEnds);
      signed++;
    }
  }
  return { renewed, signed, short };
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** A fixed shuffle for the week (the game date), so a run is repeatable. */
function weekOrder<T>(items: T[], seed: string): T[] {
  const key = (s: string) => { let h = 0x811c9dc5; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
  return items.map((x, i) => ({ x, k: key(`${seed}:${i}`) })).sort((a, b) => a.k - b.k).map((e) => e.x);
}

/**
 * The AI clubs' own transfers, a few a week (AI_TRANSFERS_PER_WEEK). A club
 * with room (fewer than AI_MAX_SQUAD) and money (her price plus
 * AI_BUY_RESERVE) buys the best career senior at another AI club who is at
 * least AI_BUY_GAP better than its weaker starter, if that club can sell
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
    if (mine.length >= AI_MAX_SQUAD || mine.length < AI_MIN_SQUAD) continue;
    const weaker = mine[AI_MIN_SQUAD - 1]!.rating;
    const balance = balanceOf(w.tx, careerSaveId, buyer);
    const target = [...squads.entries()]
      .filter(([club]) => club !== buyer && active.has(club))
      .flatMap(([, squad]) => squad)
      .filter((m) => m.kind === "player" && !moved.has(m.id) && m.rating >= weaker + AI_BUY_GAP
        && (m.joinedOn == null || daysBetween(m.joinedOn, today) >= AI_KEEP_DAYS))
      .map((m) => ({ m, fee: marketPrice(careerSaveId, { ...m, askingPrice: null }).price }))
      .filter(({ m, fee }) => balance >= fee + AI_BUY_RESERVE && canSellTx(w.tx, careerSaveId, m.poolTeamId, names.get(m.poolTeamId) ?? "").ok)
      .sort((a, b) => b.m.rating - a.m.rating || a.m.id - b.m.id)[0];
    if (!target) continue;
    const from = target.m.poolTeamId;
    addToBalance(w.tx, careerSaveId, buyer, -target.fee);
    addToBalance(w.tx, careerSaveId, from, target.fee);
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
