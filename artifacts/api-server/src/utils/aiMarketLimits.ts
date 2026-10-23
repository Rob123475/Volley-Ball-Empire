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
 *             (utils/aiSquads.ts aiTransfersWeekTx).
 *   bids      a senior bid (utils/transfers.ts bidTx) and a youth buy offer
 *             (utils/youthDeals.ts aiYouthBuysWeekTx) are each a row here,
 *             refused or countered too; at most `bids` a season, `bidsPerClub`
 *             to any one club (her club that day).
 *
 * Counted from ai_market_moves, a table in the save, never from memory: a
 * reload, a crash or a second boot can't reset them. Continental youth
 * missions are not covered (AI clubs send none).
 */
import { aiMarketMovesTable, AI_SEASON_LIMITS } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import type { CareerStateTx } from "../lib/playerDto.js";
import type { Club } from "./transfers.js";

type Tx = CareerStateTx["tx"];
export type AiMoveKind = "scout" | "bid";

/** The season a game date counts in (seasons run from 1 January). */
export const seasonYearOf = (today: string): number => Number(today.slice(0, 4));

const clubKey = (c: Club) => ("teamId" in c ? `t${c.teamId}` : `p${c.poolTeamId}`);

export type AiSeasonMoves = { scouts: number; scoutsAt: Map<string, number>; bids: number; bidsAt: Map<string, number>; reports: Map<number, string> };

/** An AI club's scouting and bids this season: totals, per club held at, and its reports by player (ready day). */
export function aiSeasonMovesTx(tx: Tx, careerSaveId: number, poolTeamId: number, today: string): AiSeasonMoves {
  const rows = tx.select().from(aiMarketMovesTable).where(and(
    eq(aiMarketMovesTable.careerSaveId, careerSaveId), eq(aiMarketMovesTable.poolTeamId, poolTeamId),
    eq(aiMarketMovesTable.seasonYear, seasonYearOf(today)),
  )).all();
  const out: AiSeasonMoves = { scouts: 0, scoutsAt: new Map(), bids: 0, bidsAt: new Map(), reports: new Map() };
  for (const r of rows) {
    const at = r.targetTeamId != null ? `t${r.targetTeamId}` : `p${r.targetPoolTeamId}`;
    if (r.kind === "scout") {
      out.scouts++; out.scoutsAt.set(at, (out.scoutsAt.get(at) ?? 0) + 1);
      out.reports.set(r.playerId, r.readyOn ?? r.onDate);
    } else {
      out.bids++; out.bidsAt.set(at, (out.bidsAt.get(at) ?? 0) + 1);
    }
  }
  return out;
}

/** Whether the club may still scout a player at `at` this season. */
export function mayScout(m: AiSeasonMoves, at: Club): boolean {
  return m.scouts < AI_SEASON_LIMITS.scoutingReports && (m.scoutsAt.get(clubKey(at)) ?? 0) < AI_SEASON_LIMITS.scoutingPerClub;
}

/** Whether the club may still bid to `at` this season. */
export function mayBid(m: AiSeasonMoves, at: Club): boolean {
  return m.bids < AI_SEASON_LIMITS.bids && (m.bidsAt.get(clubKey(at)) ?? 0) < AI_SEASON_LIMITS.bidsPerClub;
}

/** Record a scouting report or a bid (and keep the in-hand counts in step). */
export function recordAiMoveTx(tx: Tx, careerSaveId: number, poolTeamId: number, kind: AiMoveKind, playerId: number, at: Club, today: string,
  readyOn: string | null = null, m?: AiSeasonMoves): void {
  tx.insert(aiMarketMovesTable).values({
    careerSaveId, poolTeamId, kind, playerId,
    targetTeamId: "teamId" in at ? at.teamId : null, targetPoolTeamId: "poolTeamId" in at ? at.poolTeamId : null,
    seasonYear: seasonYearOf(today), onDate: today, readyOn,
  }).run();
  if (!m) return;
  const k = clubKey(at);
  if (kind === "scout") { m.scouts++; m.scoutsAt.set(k, (m.scoutsAt.get(k) ?? 0) + 1); m.reports.set(playerId, readyOn ?? today); }
  else { m.bids++; m.bidsAt.set(k, (m.bidsAt.get(k) ?? 0) + 1); }
}
