/**
 * R-42 — trophies are written at the season boundary, from what happened.
 *
 * Nothing in the game ever inserted a trophy: the Trophy Cabinet, "Titles
 * Won", the trophy news items and the Hall of Fame's trophy count read a table
 * that stayed empty forever. Now, once per season, inside the rollover's
 * transaction, from the season's own records:
 *
 *   World Final won          world_championship   "World Champions 2026"
 *   World Final lost         runner_up            "World Final runner-up 2026"
 *   World Semi Final lost    bronze               "World Finals semi-finalist 2026"
 *   season tier Silver/Gold  world_tour_tier      "World Tour Gold tier 2026"
 *
 * The tier is where the season's ranking points finished (R-54). A Bronze tier
 * is where every club starts, not an honour, so it earns nothing.
 *
 * Olympic medals are NOT written: this build plays no Olympic tournament. The
 * Olympic schedule's "results" were re-rolled at random on every read (R-43
 * removes them), so there is no result to award. The cabinet's Olympic row
 * stays at zero until a real tournament exists.
 */
import { db, competitorRankingsTable, trophiesTable, type TrophyRecord } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { worldFinalsSummaryTx } from "./worldTour.js";
import { competitorIdForTeamTx } from "./competitors.js";
import { tierForPoints, type Tier } from "./tierQualification.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const SEASON_TROPHY_TYPES = ["world_championship", "runner_up", "bronze", "world_tour_tier"] as const;
export type FinalsResult = "champion" | "runner-up" | "semi-finalist" | "did not qualify" | null;

/** The honours a season earned — pure, so the harness and the rollover agree on the rule. */
export function seasonTrophiesFor(
  finals: FinalsResult, tier: Tier, rankingPoints: number, year: number,
): Array<{ type: (typeof SEASON_TROPHY_TYPES)[number]; name: string; notes: string }> {
  const out: Array<{ type: (typeof SEASON_TROPHY_TYPES)[number]; name: string; notes: string }> = [];
  if (finals === "champion") out.push({ type: "world_championship", name: `World Champions ${year}`, notes: "Won the World Final" });
  if (finals === "runner-up") out.push({ type: "runner_up", name: `World Final runner-up ${year}`, notes: "Lost the World Final" });
  if (finals === "semi-finalist") out.push({ type: "bronze", name: `World Finals semi-finalist ${year}`, notes: "Lost a World Semi Final" });
  if (tier === "Silver" || tier === "Gold") {
    out.push({ type: "world_tour_tier", name: `World Tour ${tier} tier ${year}`, notes: `${rankingPoints} ranking points` });
  }
  return out;
}

/** Write the season's honours once. Idempotent: a season that already has them is left alone. */
export function awardSeasonTrophiesTx(
  tx: Tx, careerSaveId: number, seasonYear: number, seasonNumber: number, teamId: number,
): TrophyRecord[] {
  const existing = tx.select().from(trophiesTable).where(and(
    eq(trophiesTable.teamId, teamId),
    eq(trophiesTable.year, seasonYear),
    inArray(trophiesTable.type, [...SEASON_TROPHY_TYPES]),
  )).all();
  if (existing.length > 0) return existing;

  const finals = worldFinalsSummaryTx(tx, careerSaveId, seasonYear, teamId).playerResult;
  const ranking = tx.select({ points: competitorRankingsTable.rankingPoints }).from(competitorRankingsTable).where(and(
    eq(competitorRankingsTable.competitorId, competitorIdForTeamTx(tx, teamId)),
    eq(competitorRankingsTable.careerSaveId, careerSaveId),
    eq(competitorRankingsTable.seasonYear, seasonYear),
  )).get();
  const points = ranking?.points ?? 0;

  const rows = seasonTrophiesFor(finals, tierForPoints(points), points, seasonYear);
  if (rows.length === 0) return [];
  return tx.insert(trophiesTable).values(rows.map((r) => ({
    teamId, type: r.type, name: r.name, notes: r.notes,
    year: seasonYear, season: seasonNumber,
  }))).returning().all();
}
