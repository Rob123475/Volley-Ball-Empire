import {
  db,
  regionalLeagueSeasonsTable,
  regionalLeagueFixturesTable,
  regionalLeagueResultsTable,
} from "@workspace/db";
import { and, eq, inArray, type SQL } from "drizzle-orm";

/**
 * The only way to read or write the regional league. Career-scoped by
 * construction.
 *
 * Adding career_save_id to these three tables produced ZERO compile errors,
 * because a nullable column addition is invisible to TypeScript. Every existing
 * query kept compiling and kept returning every career's rows — the exact
 * failure the players and staff splits were loud about, silent here.
 *
 * So the enforcement is a required parameter rather than a type error:
 * careerSaveId is the first argument of every function below, and the
 * write-boundary guard bans raw queries against these tables outside this file.
 * There is no way to write an unscoped league query that still compiles and
 * passes the build.
 *
 * `regional_league_seasons` is the authority for ownership; fixtures and results
 * carry the same id denormalised so round-level queries need no join.
 */

export type LeagueSeason = typeof regionalLeagueSeasonsTable.$inferSelect;
export type LeagueFixture = typeof regionalLeagueFixturesTable.$inferSelect;
export type LeagueResult = typeof regionalLeagueResultsTable.$inferSelect;

// ── Reads ───────────────────────────────────────────────────────────────────

export async function loadLeagueSeasons(
  careerSaveId: number,
  filter: { continent?: string; status?: string; seasonYear?: number } = {},
): Promise<LeagueSeason[]> {
  const conds: SQL[] = [eq(regionalLeagueSeasonsTable.careerSaveId, careerSaveId)];
  if (filter.continent)  conds.push(eq(regionalLeagueSeasonsTable.continent, filter.continent));
  if (filter.status)     conds.push(eq(regionalLeagueSeasonsTable.status, filter.status));
  if (filter.seasonYear != null) conds.push(eq(regionalLeagueSeasonsTable.seasonYear, filter.seasonYear));
  return db.select().from(regionalLeagueSeasonsTable).where(and(...conds));
}

export async function loadLeagueSeason(
  careerSaveId: number,
  seasonId: number,
): Promise<LeagueSeason | null> {
  const [row] = await db.select().from(regionalLeagueSeasonsTable).where(and(
    eq(regionalLeagueSeasonsTable.careerSaveId, careerSaveId),
    eq(regionalLeagueSeasonsTable.id, seasonId),
  )).limit(1);
  return row ?? null;
}

export async function loadFixtures(
  careerSaveId: number,
  filter: { seasonId?: number; seasonIds?: number[]; round?: number; status?: string } = {},
): Promise<LeagueFixture[]> {
  const conds: SQL[] = [eq(regionalLeagueFixturesTable.careerSaveId, careerSaveId)];
  if (filter.seasonId != null) conds.push(eq(regionalLeagueFixturesTable.regionalLeagueSeasonId, filter.seasonId));
  // Round simulation runs across every continent at once, so it needs the set
  // form rather than one season at a time.
  if (filter.seasonIds) {
    if (filter.seasonIds.length === 0) return [];
    conds.push(inArray(regionalLeagueFixturesTable.regionalLeagueSeasonId, filter.seasonIds));
  }
  if (filter.round != null)    conds.push(eq(regionalLeagueFixturesTable.round, filter.round));
  if (filter.status)           conds.push(eq(regionalLeagueFixturesTable.status, filter.status));
  return db.select().from(regionalLeagueFixturesTable).where(and(...conds));
}

export async function loadResultsForFixtures(
  careerSaveId: number,
  fixtureIds: number[],
): Promise<LeagueResult[]> {
  if (fixtureIds.length === 0) return [];
  return db.select().from(regionalLeagueResultsTable).where(and(
    eq(regionalLeagueResultsTable.careerSaveId, careerSaveId),
    inArray(regionalLeagueResultsTable.fixtureId, fixtureIds),
  ));
}

// ── Writes ──────────────────────────────────────────────────────────────────

export async function insertLeagueResult(
  careerSaveId: number,
  values: Omit<typeof regionalLeagueResultsTable.$inferInsert, "careerSaveId">,
): Promise<void> {
  await db.insert(regionalLeagueResultsTable).values({ ...values, careerSaveId });
}

export async function updateFixture(
  careerSaveId: number,
  fixtureId: number,
  patch: Partial<Pick<LeagueFixture, "status" | "homeScore" | "awayScore">>,
): Promise<void> {
  await db.update(regionalLeagueFixturesTable).set(patch).where(and(
    eq(regionalLeagueFixturesTable.careerSaveId, careerSaveId),
    eq(regionalLeagueFixturesTable.id, fixtureId),
  ));
}

/**
 * Build a whole league season: the season row and its fixtures, in one
 * transaction. Used by rollover and by career creation — season 1 is generated
 * the same way seasons 2-5 will be, so the generator is exercised on every new
 * save rather than first running at the first rollover.
 */
export function createLeagueSeasonWithFixtures(
  careerSaveId: number,
  season: Omit<typeof regionalLeagueSeasonsTable.$inferInsert, "careerSaveId">,
  fixtures: (seasonId: number) => Array<
    Omit<typeof regionalLeagueFixturesTable.$inferInsert, "careerSaveId" | "regionalLeagueSeasonId">
  >,
): number {
  return db.transaction((tx) => {
    const [created] = tx.insert(regionalLeagueSeasonsTable)
      .values({ ...season, careerSaveId })
      .returning()
      .all();
    const rows = fixtures(created!.id).map((f) => ({
      ...f,
      careerSaveId,
      regionalLeagueSeasonId: created!.id,
    }));
    if (rows.length > 0) tx.insert(regionalLeagueFixturesTable).values(rows).run();
    return created!.id;
  });
}
