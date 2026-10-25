/**
 * 1.1.3 (Rob, 23 Oct; brief A3): the AI clubs' scouting and buying limits.
 *
 * Rob: "AI clubs can scout no more than 10 scouting missions in a year and no
 * more than 2 from 1 club; this applies for buying as well." The numbers are
 * AI_SEASON_LIMITS (lib/db schema/transfers.ts). Each AI club, each season (a
 * season runs from 1 January, as the seasons table's do):
 *
 *   scouting  a report on a senior at another club (the player's included) is
 *             a scouting job for one of its Scouts or coaches (utils/
 *             scoutingWork.ts, SCOUT_DAYS long) and a row here; at most
 *             `scoutingReports` a season, `scoutingPerClub` on players at any
 *             one club. Before 1.1.3 an AI club bid with no report at all; now
 *             it bids for a senior only once its report on her is ready
 *             (utils/aiSquadPolicy.ts, the bids).
 *   bids      a senior bid (utils/transfers.ts bidTx) and a youth buy offer
 *             (utils/youthDeals.ts aiYouthBuysWeekTx) are each a row here,
 *             refused or countered too; at most `bids` a season, `bidsPerClub`
 *             to any one club (her club that day).
 *
 * Counted from ai_market_moves, a table in the save, never from memory: a
 * reload, a crash or a second boot can't reset them. Continental youth
 * missions are not covered (AI clubs send none).
 *
 * 1.1.3 (Rob, 25 Oct; AI market brief item 1): AI clubs buy from the
 * free-agent market, not from each other (utils/aiSquadPolicy.ts, the market).
 * A free agent is at no club: a report on her counts toward `scoutingReports`
 * but no club's two, and signing her ("sign", her price paid) counts toward
 * `bids` but no club's two. The table also keeps the club's other squad
 * moves, which no limit counts: "renew" (the one renewal a season its rule
 * allows), "leave" (a player whose contract ended, or ends this season, gone to
 * the market: the club does not sign her back that season or the next), "refill" (a free agent signed to
 * keep its places, injured-list cover included: utils/aiSquadPolicy.ts), "promote" (an academy youth
 * stepping up) and "open:<why>" (a place for next season it could not fill:
 * cap, money or none).
 */
import { aiMarketMovesTable, AI_SEASON_LIMITS } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import type { CareerStateTx } from "../lib/playerDto.js";
import type { Club } from "./transfers.js";

type Tx = CareerStateTx["tx"];
export type AiMoveKind = "scout" | "bid" | "sign" | "renew" | "leave" | "refill" | "promote" | `open:${"cap" | "money" | "none" | "limit"}`;

/** The season a game date counts in (seasons run from 1 January). */
export const seasonYearOf = (today: string): number => Number(today.slice(0, 4));

const clubKey = (c: Club) => ("teamId" in c ? `t${c.teamId}` : `p${c.poolTeamId}`);
/** Where she is held: a club, or null for a free agent (no club's two). */
export type MoveTarget = Club | null;

export type AiSeasonMoves = { scouts: number; scoutsAt: Map<string, number>; bids: number; bidsAt: Map<string, number>; reports: Map<number, string> };

/** An AI club's scouting and bids this season: totals, per club held at, and its reports by player (ready day). */
export function aiSeasonMovesTx(tx: Tx, careerSaveId: number, poolTeamId: number, today: string): AiSeasonMoves {
  const rows = tx.select().from(aiMarketMovesTable).where(and(
    eq(aiMarketMovesTable.careerSaveId, careerSaveId), eq(aiMarketMovesTable.poolTeamId, poolTeamId),
    eq(aiMarketMovesTable.seasonYear, seasonYearOf(today)),
  )).all();
  const out: AiSeasonMoves = { scouts: 0, scoutsAt: new Map(), bids: 0, bidsAt: new Map(), reports: new Map() };
  for (const r of rows) {
    const at = r.targetTeamId != null ? `t${r.targetTeamId}` : r.targetPoolTeamId != null ? `p${r.targetPoolTeamId}` : null;
    if (r.kind === "scout") {
      out.scouts++; if (at) out.scoutsAt.set(at, (out.scoutsAt.get(at) ?? 0) + 1);
      out.reports.set(r.playerId, r.readyOn ?? r.onDate);
    } else if (r.kind === "bid" || r.kind === "sign") {
      out.bids++; if (at) out.bidsAt.set(at, (out.bidsAt.get(at) ?? 0) + 1);
    }
  }
  return out;
}

/** Whether the club may still scout a player at `at` (null: a free agent) this season. */
export function mayScout(m: AiSeasonMoves, at: MoveTarget): boolean {
  return m.scouts < AI_SEASON_LIMITS.scoutingReports && (at == null || (m.scoutsAt.get(clubKey(at)) ?? 0) < AI_SEASON_LIMITS.scoutingPerClub);
}

/** Whether the club may still bid to `at` (null: sign a free agent) this season. */
export function mayBid(m: AiSeasonMoves, at: MoveTarget): boolean {
  return m.bids < AI_SEASON_LIMITS.bids && (at == null || (m.bidsAt.get(clubKey(at)) ?? 0) < AI_SEASON_LIMITS.bidsPerClub);
}

/** Record a scouting report, a bid or another squad move (and keep the in-hand counts in step). */
export function recordAiMoveTx(tx: Tx, careerSaveId: number, poolTeamId: number, kind: AiMoveKind, playerId: number, at: MoveTarget, today: string,
  readyOn: string | null = null, m?: AiSeasonMoves): void {
  tx.insert(aiMarketMovesTable).values({
    careerSaveId, poolTeamId, kind, playerId,
    targetTeamId: at && "teamId" in at ? at.teamId : null, targetPoolTeamId: at && "poolTeamId" in at ? at.poolTeamId : null,
    seasonYear: seasonYearOf(today), onDate: today, readyOn,
  }).run();
  if (!m) return;
  const k = at ? clubKey(at) : null;
  if (kind === "scout") { m.scouts++; if (k) m.scoutsAt.set(k, (m.scoutsAt.get(k) ?? 0) + 1); m.reports.set(playerId, readyOn ?? today); }
  else if (kind === "bid" || kind === "sign") { m.bids++; if (k) m.bidsAt.set(k, (m.bidsAt.get(k) ?? 0) + 1); }
}

/**
 * The players who left the club for the market at the end of their contracts (a "leave" row) this season or
 * the last: it does not sign them back (that would be a second renewal by the back door).
 */
export function leftClubTx(tx: Tx, careerSaveId: number, poolTeamId: number, today: string): Set<number> {
  const year = seasonYearOf(today);
  return new Set(tx.select({ id: aiMarketMovesTable.playerId }).from(aiMarketMovesTable).where(and(
    eq(aiMarketMovesTable.careerSaveId, careerSaveId), eq(aiMarketMovesTable.poolTeamId, poolTeamId), eq(aiMarketMovesTable.kind, "leave"),
    inArray(aiMarketMovesTable.seasonYear, [year, year - 1]),
  )).all().map((r) => r.id));
}

/** How many players the club renewed in season `seasonYear` (its rule allows one: utils/aiSquadPolicy.ts). */
export function aiRenewalsTx(tx: Tx, careerSaveId: number, poolTeamId: number, seasonYear: number): number {
  return tx.select({ id: aiMarketMovesTable.id }).from(aiMarketMovesTable).where(and(
    eq(aiMarketMovesTable.careerSaveId, careerSaveId), eq(aiMarketMovesTable.poolTeamId, poolTeamId),
    eq(aiMarketMovesTable.seasonYear, seasonYear), eq(aiMarketMovesTable.kind, "renew"),
  )).all().length;
}
