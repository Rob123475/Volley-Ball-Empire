import { db, seasonsTable, careerSavesTable, calendarStateTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

/**
 * Season rollover.
 *
 * The arc is bounded at five seasons, so this is deliberately minimal: no deep
 * ageing curves, no procedural player generation, no self-sustaining world.
 * Those are only needed for an endless mode, which is deferred.
 *
 * Before this existed a career simply ran off the end of season one: the date
 * advanced past endDate, `atSeasonEnd` was computed and returned to the client,
 * and nothing acted on it.
 */

/** The arc. Season five is terminal. */
export const FINAL_SEASON = 5;

/**
 * Seasons are numbered from their year. Career creation starts at 2026, so
 * 2026 is season 1 and 2030 is season 5. Keeping the mapping in one place stops
 * "season 3" meaning two different things in two files.
 */
export const FIRST_SEASON_YEAR = 2026;
export const seasonNumberForYear = (year: number) => year - FIRST_SEASON_YEAR + 1;
export const yearForSeasonNumber = (n: number) => FIRST_SEASON_YEAR + n - 1;

/** Shift a hardcoded 2026 schedule date onto the season being played. */
export function shiftDateToYear(date: string, year: number): string {
  return `${year}${date.slice(4)}`;
}

export type RolloverResult =
  | { kind: "none" }
  | { kind: "career-complete"; finalSeason: number }
  | { kind: "rolled"; fromSeason: number; toSeason: number; newSeasonId: number };

/**
 * Close the active season and open the next one, or end the career.
 *
 * Idempotent by construction: it reads the ACTIVE season and completes it, so a
 * second call finds nothing active and returns "none" rather than creating a
 * duplicate season. That matters because the calendar can reach the boundary
 * more than once — advancing several days at a time crosses it in one step.
 */
export function rolloverSeason(careerSaveId: number, teamId: number): RolloverResult {
  return db.transaction((tx) => {
    const [season] = tx
      .select()
      .from(seasonsTable)
      .where(and(
        eq(seasonsTable.careerSaveId, careerSaveId),
        eq(seasonsTable.status, "active"),
      ))
      .limit(1)
      .all();

    if (!season) return { kind: "none" } as const;

    const current = seasonNumberForYear(season.year);

    tx.update(seasonsTable)
      .set({ status: "completed" })
      .where(eq(seasonsTable.id, season.id))
      .run();

    if (current >= FINAL_SEASON) {
      // Terminal. Phase 6 renders the career-end result and score; this only
      // records that the arc is over so nothing keeps advancing.
      tx.update(careerSavesTable)
        .set({ retiredAt: new Date() })
        .where(eq(careerSavesTable.id, careerSaveId))
        .run();
      return { kind: "career-complete", finalSeason: current } as const;
    }

    const nextNumber = current + 1;
    const nextYear = yearForSeasonNumber(nextNumber);

    const [created] = tx.insert(seasonsTable).values({
      careerSaveId,
      year:                    nextYear,
      name:                    `Season ${nextNumber}`,
      status:                  "active",
      totalRounds:             season.totalRounds,
      currentRound:            1,
      // Same bounds as season one, shifted a year, so calendar.ts's
      // round->date interpolation keeps landing where worldTour expects.
      startDate:               `${nextYear}-01-01`,
      endDate:                 `${nextYear}-12-31`,
      isOlympicSeason:         false,
      regionalRoundsProcessed: 0,
    }).returning().all();

    tx.update(careerSavesTable)
      .set({ season: `Season ${nextNumber}` })
      .where(eq(careerSavesTable.id, careerSaveId))
      .run();

    // Put the calendar at the first day of the new season, or the player wakes
    // up on 31 December of a season that no longer exists.
    tx.update(calendarStateTable)
      .set({ currentDate: `${nextYear}-01-01`, updatedAt: new Date() })
      .where(eq(calendarStateTable.teamId, teamId))
      .run();

    return {
      kind: "rolled",
      fromSeason: current,
      toSeason: nextNumber,
      newSeasonId: created!.id,
    } as const;
  });
}
