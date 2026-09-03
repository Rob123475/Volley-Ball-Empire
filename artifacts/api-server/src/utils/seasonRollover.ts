import {
  db, seasonsTable, careerSavesTable, calendarStateTable, teamsTable,
  seasonFinalStandingsTable, careerHistoryEntriesTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { withCareerStateTx } from "../lib/playerDto.js";

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
 * Retirement age.
 *
 * Set to 40 on 3 September 2026, on Rob's call. It was 34, and that number had
 * been chosen from the shipped roster rather than picked: the senior pool peaks
 * at 22-25, so retirement is back-loaded, and 34 retired [1, 0, 2, 1, 5] over a
 * five-season arc — a handful per season, never a cliff.
 *
 * ── What 40 costs, measured against the shipped roster ──────────────────────
 * The oldest senior in the world is 37 and the next oldest is 31, so at 40 the
 * same arc retires [0, 0, 1, 0, 0]: ONE player across five seasons, and that
 * player is Martha Kera, the 37-year-old this change was made to accommodate.
 * Nobody else ever reaches the threshold.
 *
 * So retirement is now effectively off for a five-season career. That is a real
 * loss of a mechanic, not a tuning tweak, and it is recorded here rather than
 * discovered later: `retireAgedPlayers` still runs every boundary, the rule is
 * still live and still tested, it just has almost nothing to act on.
 *
 * If retirement should bite again without moving this number back, the lever is
 * the roster's age spread, not the threshold — the world would need seniors in
 * their mid-to-late thirties rather than one outlier at 37.
 *
 * Deliberately a flat threshold and not a probability curve: the spec asks for
 * "a handful per season, not a system", and a bounded five-season arc does not
 * need decline modelling.
 */
export const RETIREMENT_AGE = 40;

/**
 * Academy players graduate the season after they pass the youth age band.
 *
 * The shipped academy is 14-18 (YOUTH_AGE_MAX), so 19 is the first age that is
 * no longer youth. All 72 of them cross it during a five-season arc — which is
 * exactly why the spec deletes senior generation: the academy IS the pipeline.
 */
export const PROMOTION_AGE = 19;

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
  return withCareerStateTx(({ tx, ageAllPlayers, retireAgedPlayers, promoteAgedYouth }) => {
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

    // Everyone this career owns gets a year older. Nothing did this before: a
    // five-season career finished with the squad ages it started with.
    const agedCount = ageAllPlayers(careerSaveId);
    void agedCount;

    // Retire AFTER ageing, so the threshold is applied to the age a player has
    // reached rather than the one they are leaving behind.
    const retired = retireAgedPlayers(careerSaveId, RETIREMENT_AGE, season.year);

    // Promote after retiring, so a squad slot freed this boundary can be filled
    // at the same one rather than sitting empty for a season.
    const promoted = promoteAgedYouth(careerSaveId, PROMOTION_AGE);

    tx.update(seasonsTable)
      .set({ status: "completed" })
      .where(eq(seasonsTable.id, season.id))
      .run();

    // ── Carry the season's record forward ──────────────────────────────────
    //
    // The standings snapshot used to be written from matches.ts and ONLY on
    // isChampionshipWin — so a career that did not win the World Final never
    // recorded a final table at all, for any season. Every season ends, won or
    // not, so the snapshot belongs at the boundary.
    const [team] = tx.select().from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1).all();
    if (team) {
      const already = tx.all<{ n: number }>(sql.raw(
        `SELECT COUNT(*) AS n FROM season_final_standings ` +
        `WHERE team_id = ${teamId} AND season_year = ${season.year}`))[0];

      if (Number(already?.n ?? 0) === 0) {
        const allTeams = tx.select().from(teamsTable).all();
        const sorted = [...allTeams].sort((a, b) => b.wins * 3 - a.wins * 3);
        tx.insert(seasonFinalStandingsTable).values(
          sorted.map((t, i) => ({
            teamId,
            seasonYear:     season.year,
            rank:           i + 1,
            competitorName: t.name,
            isPlayer:       t.id === teamId,
            wins:           t.wins,
            losses:         t.losses,
            points:         t.wins * 3,
            setDiff:        t.wins - t.losses,
          })),
        ).run();
      }

      const [save] = tx.select().from(careerSavesTable)
        .where(eq(careerSavesTable.id, careerSaveId)).limit(1).all();
      if (save) {
        tx.insert(careerHistoryEntriesTable).values({
          userId:       save.userId,
          careerSaveId,
          type:         "season_completed",
          clubName:     team.name,
          season:       `Season ${current}`,
          description:
            `Season ${current} complete — ${team.wins}W ${team.losses}L, ` +
            `balance $${Math.round(Number(team.budget)).toLocaleString()}` +
            (retired.length > 0 ? `, ${retired.length} player${retired.length > 1 ? "s" : ""} retired` : "") +
            (promoted.length > 0 ? `, ${promoted.length} promoted from the academy` : "") +
            `.`,
        }).run();
      }
    }

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
