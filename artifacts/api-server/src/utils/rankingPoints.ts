import { db, competitorRankingsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { competitorIdForTeam } from "./competitors.js";
import { eligibilityFor } from "./tierQualification.js";

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
 * A loss is worth zero. That is also provisional: a participation point would
 * make entering everything strictly better than choosing, which is the exact
 * behaviour the push-out rule exists to prevent.
 */
export const TIER_RANKING_POINTS: Record<string, number> = {
  "Bronze":            1,
  "Silver":            2,
  "Gold":              4,
  "Continental Final": 6,
  "World Semi Final":  8,
  "World Final":       15,
  // Exhibition. Deliberately zero — it awards no prize either.
  "All-Star Match":    0,
};

export function rankingPointsFor(tier: string | null | undefined, won: boolean): number {
  if (!won) return 0;
  return TIER_RANKING_POINTS[tier ?? ""] ?? 0;
}

/**
 * Points actually awarded, after the tier gate.
 *
 * A club pushed out of a tier scores nothing there (D4b) — that is the rule
 * that stops a strong club farming Bronze, and it has to be applied where the
 * points are credited rather than trusted to the entry check, because a fixture
 * can be entered by a club whose ranking has moved since it was scheduled.
 */
export function awardedPoints(
  tier: string | null | undefined,
  won: boolean,
  currentPoints: number,
): number {
  if (!won) return 0;
  const elig = eligibilityFor(tier, currentPoints);
  return elig.scores ? rankingPointsFor(tier, won) : 0;
}

/**
 * Credit a result to this career's season ranking.
 *
 * Upserts, so the first result of a season creates the row. Wins and losses are
 * both counted even when the points are zero, because "events entered" and the
 * win/loss split are what the push-out rule and the standings need.
 */
export async function creditRankingPoints(args: {
  careerSaveId: number;
  teamId: number;
  seasonYear: number;
  tier: string | null;
  won: boolean;
}): Promise<number> {
  const competitorId = await competitorIdForTeam(args.teamId);

  // The gate is applied against the ranking as it stands BEFORE this result,
  // which is the ranking the club had when it entered.
  const before = await currentRanking(args.careerSaveId, args.teamId, args.seasonYear);
  const points = awardedPoints(args.tier, args.won, before.rankingPoints);

  const [existing] = await db.select().from(competitorRankingsTable).where(and(
    eq(competitorRankingsTable.competitorId, competitorId),
    eq(competitorRankingsTable.careerSaveId, args.careerSaveId),
    eq(competitorRankingsTable.seasonYear, args.seasonYear),
  )).limit(1);

  if (!existing) {
    await db.insert(competitorRankingsTable).values({
      competitorId,
      careerSaveId:  args.careerSaveId,
      seasonYear:    args.seasonYear,
      rankingPoints: points,
      eventsEntered: 1,
      wins:          args.won ? 1 : 0,
      losses:        args.won ? 0 : 1,
    }).onConflictDoNothing();
    return points;
  }

  await db.update(competitorRankingsTable)
    .set({
      rankingPoints: sql`${competitorRankingsTable.rankingPoints} + ${points}`,
      eventsEntered: sql`${competitorRankingsTable.eventsEntered} + 1`,
      wins:          sql`${competitorRankingsTable.wins} + ${args.won ? 1 : 0}`,
      losses:        sql`${competitorRankingsTable.losses} + ${args.won ? 0 : 1}`,
      updatedAt:     new Date(),
    })
    .where(eq(competitorRankingsTable.id, existing.id));

  return points;
}

/** This career's ranking for a season. Zero when nothing has been played. */
export async function currentRanking(
  careerSaveId: number,
  teamId: number,
  seasonYear: number,
): Promise<{ rankingPoints: number; eventsEntered: number; wins: number; losses: number }> {
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
  };
}
