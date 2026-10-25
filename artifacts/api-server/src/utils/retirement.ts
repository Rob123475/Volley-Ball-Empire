/**
 * 1.1.1 (Rob, 18 Oct; Downloads/NEW-SENIORS-BRIEF-18OCT.md, "Retirement"): retirement rebuilt.
 * It replaces "everyone retires at 40".
 *
 *   no retirement age  a senior may retire at the end of any season. Her chance (retirementChance)
 *                      rises with her age (small in her late 20s, growing through her 30s), with her
 *                      injuries (each reconstruction, and serious injuries past the first: two knee
 *                      reconstructions can end a career at 28), with a falling rating (against the
 *                      last season's turn), and with a season unsigned on the free-agent market
 *   the hard limit     a player still playing in the season she turns 40 retires at its end
 *                      (RETIREMENT_LIMIT_AGE: the age she reaches at that turn)
 *   inputs             the game's own records only: her age, career_injuries (the reconstruction
 *                      rule), her serious-injury count, her rating and the turn's snapshot of it
 *   what happens       lib/playerDto.ts retirePlayers: the Hall of Fame, the records and the
 *                      name and face pools as before; her contract ends with no payout either way;
 *                      Club News lists the season's retirements (routes/news.ts)
 *   asked to retire    her club may ask her (askToRetireRefusal): she retires at once and the club
 *                      pays out the rest of her contract, as ending it early does. Only in the
 *                      transfer window, as releasing is, unless she has had a reconstruction or is
 *                      on the injured list. The AI clubs ask and list by the same rules (utils/aiSquadPolicy.ts deadwood)
 *
 * The chances were tuned so that, with about 20 new seniors a season (utils/newSeniors.ts), the
 * number of seniors holds roughly steady over 30 seasons and the free-agent market stays roughly
 * 30 to 60 (docs/STATUS-1.1.1.md, 18 October).
 */
import { careerPlayerStateTable, careerInjuriesTable, playersTable } from "@workspace/db";
import { and, eq, or, sql } from "drizzle-orm";
import type { CareerStateTx } from "../lib/playerDto.js";
import { overallRating } from "./overallRating.js";

type Tx = CareerStateTx["tx"];

/** The age she reaches at the season's turn that ends her career: she turned 40 that season. */
export const RETIREMENT_LIMIT_AGE = 40;

/** The chance from age alone, by the age she reaches at the turn (an age below the first: the first). */
export const AGE_CHANCE: ReadonlyArray<readonly [age: number, chance: number]> = [
  [25, 0.004], [26, 0.008], [27, 0.012], [28, 0.018], [29, 0.026], [30, 0.036], [31, 0.05], [32, 0.068],
  [33, 0.09], [34, 0.12], [35, 0.16], [36, 0.21], [37, 0.28], [38, 0.36], [39, 0.46],
];
export const RETIREMENT_CHANCES = {
  /** Each reconstruction in her career. */
  perReconstruction: 0.14,
  /** Each serious injury (4 weeks or more) after her first. */
  perSeriousAfterFirst: 0.03,
  /** Her rating has fallen since the last turn: this much per point, from 26, up to fallCap. */
  perRatingPointFallen: 0.02, fallFrom: 2, fallAge: 26, fallCap: 0.2,
  /** Unsigned at both turns (a whole season on the market), by the age she reaches. */
  unsigned: [[22, 0.04], [25, 0.1], [28, 0.18], [99, 0.28]] as ReadonlyArray<readonly [number, number]>,
  /** Never more than this short of the limit. */
  max: 0.95,
} as const;

export type RetirementReason = "limit" | "age" | "injury" | "rating" | "unsigned" | "asked";

export type RetirementInput = {
  /** The age she reaches at this turn. */
  age: number;
  reconstructions: number;
  seriousInjuries: number;
  rating: number;
  /** Her rating at the last turn; null when there was none (her first turn, or a save from before). */
  lastRating: number | null;
  /** A free agent at the last turn and now. */
  unsigned: boolean;
};

/** Her chance of retiring at this turn, and the biggest reason in it. */
export function retirementChance(p: RetirementInput): { chance: number; reason: RetirementReason } {
  if (p.age >= RETIREMENT_LIMIT_AGE) return { chance: 1, reason: "limit" };
  const C = RETIREMENT_CHANCES;
  const age = (AGE_CHANCE.find(([a]) => p.age <= a) ?? AGE_CHANCE[AGE_CHANCE.length - 1]!)[1];
  const injury = p.reconstructions * C.perReconstruction + Math.max(0, p.seriousInjuries - 1) * C.perSeriousAfterFirst;
  const fallen = p.lastRating == null ? 0 : p.lastRating - p.rating;
  const rating = p.age >= C.fallAge && fallen >= C.fallFrom ? Math.min(C.fallCap, fallen * C.perRatingPointFallen) : 0;
  const unsigned = p.unsigned ? (C.unsigned.find(([a]) => p.age <= a) ?? C.unsigned[C.unsigned.length - 1]!)[1] : 0;
  const parts: Array<[RetirementReason, number]> = [["age", age], ["injury", injury], ["rating", rating], ["unsigned", unsigned]];
  const reason = parts.reduce((best, x) => (x[1] > best[1] ? x : best))[0];
  return { chance: Math.min(C.max, age + injury + rating + unsigned), reason };
}

/** Each senior's reconstructions in this career. */
export function reconstructionsTx(tx: Tx, careerSaveId: number): Map<number, number> {
  const map = new Map<number, number>();
  for (const r of tx.select({ p: careerInjuriesTable.playerId }).from(careerInjuriesTable)
    .where(and(eq(careerInjuriesTable.careerSaveId, careerSaveId), eq(careerInjuriesTable.reconstruction, true))).all()) {
    map.set(r.p, (map.get(r.p) ?? 0) + 1);
  }
  return map;
}

/**
 * The season's turn, after the ages move on: every senior (not an academy youth) at the limit
 * retires, and every other rolls her chance. Retires them (playerDto retirePlayers) and returns who
 * went, with why, then records this turn's ratings and free agents for the next.
 * VBE_RETIREMENT=limit (a suite's switch) keeps only the limit, so a short suite's squads hold still.
 */
export function seasonEndRetirementsTx(
  w: CareerStateTx, careerSaveId: number, seasonYear: number, random: () => number = Math.random,
): Array<{ playerId: number; teamId: number | null; age: number; reason: RetirementReason }> {
  const s = careerPlayerStateTable;
  const rows = w.tx.select({
    id: s.playerId, age: s.age, teamId: s.teamId, poolTeamId: s.poolTeamId, serious: s.seriousInjuries,
    last: s.lastRolloverRating, lastFree: s.lastRolloverFreeAgent,
    speed: s.speed, power: s.power, defense: s.defense, serve: s.serve, block: s.block, stamina: s.stamina,
  }).from(s).innerJoin(playersTable, eq(playersTable.id, s.playerId))
    .where(and(eq(s.careerSaveId, careerSaveId), eq(s.isRetired, false),
      or(sql`${playersTable.playerType} = 'senior'`, eq(s.isPromoted, true), sql`${s.age} >= ${RETIREMENT_LIMIT_AGE}`)))
    .all();
  const limitOnly = process.env.VBE_RETIREMENT === "limit";
  const recon = reconstructionsTx(w.tx, careerSaveId);
  const picks: Array<{ playerId: number; reason: RetirementReason }> = [];
  for (const r of rows) {
    const { chance, reason } = retirementChance({
      age: r.age, reconstructions: recon.get(r.id) ?? 0, seriousInjuries: Number(r.serious ?? 0),
      rating: overallRating(r), lastRating: r.last == null ? null : Number(r.last),
      unsigned: r.lastFree && r.teamId == null && r.poolTeamId == null,
    });
    if (reason === "limit" || (!limitOnly && random() < chance)) picks.push({ playerId: r.id, reason });
  }
  const reasonOf = new Map(picks.map((p) => [p.playerId, p.reason]));
  const gone = w.retirePlayers(careerSaveId, picks, seasonYear, `${seasonYear + 1}-01-01`);
  return gone.map((g) => ({ ...g, reason: reasonOf.get(g.playerId) ?? "age" }));
}

/** A broken-down player may be asked to retire at any time: a reconstruction in her career, or on the injured list. */
export function brokenDownTx(tx: Tx, careerSaveId: number, playerId: number): boolean {
  const her = tx.select({ list: careerPlayerStateTable.onInjuredList }).from(careerPlayerStateTable)
    .where(and(eq(careerPlayerStateTable.careerSaveId, careerSaveId), eq(careerPlayerStateTable.playerId, playerId))).get();
  if (her?.list) return true;
  return (reconstructionsTx(tx, careerSaveId).get(playerId) ?? 0) > 0;
}
