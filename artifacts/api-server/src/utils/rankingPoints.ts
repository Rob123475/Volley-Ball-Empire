import {
  db,
  competitorRankingsTable,
  competitorsTable,
  continentalPoolPlayersTable,
  careerPlayerStateTable,
  playerRankingPointsTable,
  careerSavesTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { competitorIdForTeam, competitorIdForTeamTx } from "./competitors.js";
import { tierForPoints, type Tier } from "./tierQualification.js";
import { isCareerDifficulty, SEASON_ONE_PURSE_TIER } from "./careerDifficulty.js";

/**
 * Ranking points.
 *
 * competitor_rankings has existed since Phase 0 and NOTHING wrote to it — the
 * table that tier qualification is supposed to gate on was empty. This is the
 * accrual side; the gating that consumes it is the rest of Phase 2.
 *
 * Points are per career and per season, which is what competitor_rankings is
 * keyed on, so two careers cannot see each other's ranking and a new season
 * starts from zero rather than inheriting a lead earned before the arc moved on.
 */

/**
 * What a win at each tier is worth.
 *
 * PROVISIONAL — these weights shape the whole qualification curve and are one
 * of the open decisions. They are chosen to be defensible rather than tuned:
 * roughly doubling per tier so that climbing is worth more than farming, with
 * the finals worth a large multiple because they are once-a-season.
 *
 * A loss is worth zero.
 *
 * R-54: every win scores these, from the first round. There is no gate: a
 * Silver or Gold win used to score 0 until the club already held 15 or 40.
 */
export const TIER_RANKING_POINTS: Record<string, number> = {
  "Bronze":            1,
  "Silver":            2,
  "Gold":              4,
  "Continental Final": 6,
  "World Semi Final":  8,
  "World Final":       15,
};

export function rankingPointsFor(tier: string | null | undefined, won: boolean): number {
  if (!won) return 0;
  return TIER_RANKING_POINTS[tier ?? ""] ?? 0;
}

/**
 * Credit a result to this career's season ranking.
 *
 * Upserts, so the first result of a season creates the row. Wins and losses are
 * both counted, because "events entered" and the win/loss split are what the
 * standings need.
 */
export async function creditRankingPoints(args: {
  careerSaveId: number;
  teamId: number;
  seasonYear: number;
  tier: string | null;
  won: boolean;
}): Promise<number> {
  return db.transaction((tx) => creditCompetitorTx(tx, {
    careerSaveId: args.careerSaveId,
    seasonYear:   args.seasonYear,
    competitorId: competitorIdForTeamTx(tx, args.teamId),
    tier:         args.tier,
    won:          args.won,
  }));
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The one place a result becomes ranking points, for ANY competitor — the
 * player's club through creditRankingPoints above, and every AI club in the
 * World Tour (R-29, utils/worldTour.ts). One points table, one write, so an AI
 * club and the player cannot be scored by different rules.
 *
 * Synchronous and transaction-bound: AI fixtures are played inside the World
 * Tour's own transaction, which better-sqlite3 cannot await.
 */
export function creditCompetitorTx(tx: Tx, args: {
  careerSaveId: number;
  seasonYear: number;
  competitorId: number;
  tier: string | null;
  won: boolean;
}): number {
  const existing = tx.select().from(competitorRankingsTable).where(and(
    eq(competitorRankingsTable.competitorId, args.competitorId),
    eq(competitorRankingsTable.careerSaveId, args.careerSaveId),
    eq(competitorRankingsTable.seasonYear, args.seasonYear),
  )).get();

  // R-54: every win scores its tier's points, whatever the club already holds.
  const points = rankingPointsFor(args.tier, args.won);

  if (!existing) {
    tx.insert(competitorRankingsTable).values({
      competitorId:  args.competitorId,
      careerSaveId:  args.careerSaveId,
      seasonYear:    args.seasonYear,
      rankingPoints: points,
      eventsEntered: 1,
      wins:          args.won ? 1 : 0,
      losses:        args.won ? 0 : 1,
    }).run();
    creditPlayersTx(tx, { careerSaveId: args.careerSaveId, seasonYear: args.seasonYear, competitorId: args.competitorId, points });
    return points;
  }

  tx.update(competitorRankingsTable)
    .set({
      rankingPoints: sql`${competitorRankingsTable.rankingPoints} + ${points}`,
      eventsEntered: sql`${competitorRankingsTable.eventsEntered} + 1`,
      wins:          sql`${competitorRankingsTable.wins} + ${args.won ? 1 : 0}`,
      losses:        sql`${competitorRankingsTable.losses} + ${args.won ? 0 : 1}`,
      updatedAt:     new Date(),
    })
    .where(eq(competitorRankingsTable.id, existing.id))
    .run();

  creditPlayersTx(tx, { careerSaveId: args.careerSaveId, seasonYear: args.seasonYear, competitorId: args.competitorId, points });
  return points;
}

/**
 * R-46: the same result, credited to the players who played it.
 *
 * Olympic qualification counts the World Tour ranking points a country's
 * PLAYERS earned this season, whichever club they play for. So every result a
 * club is credited with is also written against its pair on the sand: an AI
 * club's two pool players (they never change club), or the player's club's two
 * starters at the moment of the result. Same points as the club; matches count
 * even when the points are zero.
 */
function creditPlayersTx(tx: Tx, args: {
  careerSaveId: number;
  seasonYear: number;
  competitorId: number;
  points: number;
}): void {
  const competitor = tx.select({ teamId: competitorsTable.teamId, poolTeamId: competitorsTable.poolTeamId })
    .from(competitorsTable)
    .where(eq(competitorsTable.id, args.competitorId))
    .get();
  if (!competitor) return;

  const pair: Array<{ playerId: number | null; poolPlayerId: number | null }> =
    competitor.poolTeamId != null
      ? tx.select({ id: continentalPoolPlayersTable.id })
          .from(continentalPoolPlayersTable)
          .where(eq(continentalPoolPlayersTable.poolTeamId, competitor.poolTeamId))
          .all()
          .map((p) => ({ playerId: null, poolPlayerId: p.id }))
      : competitor.teamId != null
        ? tx.select({ id: careerPlayerStateTable.playerId })
            .from(careerPlayerStateTable)
            .where(and(
              eq(careerPlayerStateTable.careerSaveId, args.careerSaveId),
              eq(careerPlayerStateTable.teamId, competitor.teamId),
              eq(careerPlayerStateTable.squadRole, "starter"),
            ))
            .all()
            .map((p) => ({ playerId: p.id, poolPlayerId: null }))
        : [];

  for (const who of pair) {
    const existing = tx.select({ id: playerRankingPointsTable.id })
      .from(playerRankingPointsTable)
      .where(and(
        eq(playerRankingPointsTable.careerSaveId, args.careerSaveId),
        eq(playerRankingPointsTable.seasonYear, args.seasonYear),
        eq(playerRankingPointsTable.competitorId, args.competitorId),
        who.playerId != null
          ? eq(playerRankingPointsTable.playerId, who.playerId)
          : eq(playerRankingPointsTable.poolPlayerId, who.poolPlayerId!),
      ))
      .get();

    if (existing) {
      tx.update(playerRankingPointsTable)
        .set({
          rankingPoints: sql`${playerRankingPointsTable.rankingPoints} + ${args.points}`,
          matches:       sql`${playerRankingPointsTable.matches} + 1`,
          updatedAt:     new Date(),
        })
        .where(eq(playerRankingPointsTable.id, existing.id))
        .run();
    } else {
      tx.insert(playerRankingPointsTable).values({
        careerSaveId:  args.careerSaveId,
        seasonYear:    args.seasonYear,
        competitorId:  args.competitorId,
        playerId:      who.playerId,
        poolPlayerId:  who.poolPlayerId,
        rankingPoints: args.points,
        matches:       1,
      }).run();
    }
  }
}

/** This career's ranking for a season, and the tier it reaches. Zero when nothing has been played. */
export async function currentRanking(
  careerSaveId: number,
  teamId: number,
  seasonYear: number,
): Promise<{ rankingPoints: number; eventsEntered: number; wins: number; losses: number; tier: Tier }> {
  const competitorId = await competitorIdForTeam(teamId);
  const [row] = await db.select().from(competitorRankingsTable).where(and(
    eq(competitorRankingsTable.competitorId, competitorId),
    eq(competitorRankingsTable.careerSaveId, careerSaveId),
    eq(competitorRankingsTable.seasonYear, seasonYear),
  )).limit(1);
  return {
    rankingPoints: row?.rankingPoints ?? 0,
    eventsEntered: row?.eventsEntered ?? 0,
    wins:          row?.wins ?? 0,
    losses:        row?.losses ?? 0,
    tier:          tierForPoints(row?.rankingPoints ?? 0),
  };
}

/**
 * R-54: the highest tier whose purses this club is paid in full in a season —
 * the tier its ranking points reached the season before. A career with no
 * ranking for the year before (its first season) starts on its difficulty's
 * access tier.
 */
export async function purseAccessTierFor(careerSaveId: number, teamId: number, seasonYear: number): Promise<Tier> {
  const competitorId = await competitorIdForTeam(teamId);
  const [previous] = await db.select({ points: competitorRankingsTable.rankingPoints })
    .from(competitorRankingsTable)
    .where(and(
      eq(competitorRankingsTable.competitorId, competitorId),
      eq(competitorRankingsTable.careerSaveId, careerSaveId),
      eq(competitorRankingsTable.seasonYear, seasonYear - 1),
    ))
    .limit(1);
  if (previous) return tierForPoints(previous.points);

  const [save] = await db.select({ difficulty: careerSavesTable.difficulty })
    .from(careerSavesTable)
    .where(eq(careerSavesTable.id, careerSaveId))
    .limit(1);
  const difficulty = save?.difficulty;
  return SEASON_ONE_PURSE_TIER[isCareerDifficulty(difficulty) ? difficulty : "established"];
}
