import {
  db, seasonsTable, careerSavesTable, calendarStateTable, teamsTable,
  seasonFinalStandingsTable, careerHistoryEntriesTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { withCareerStateTx } from "../lib/playerDto.js";
import { ensureSeasonFixtureRows } from "./seasonFixture.js";
import { worldTourStandingsTx } from "./worldTour.js";
import { boardReviewTx, ensureBoardSeasonTx, type SeasonReview } from "./board-confidence.js";
import { awardSeasonTrophiesTx } from "./seasonTrophies.js";
import { isOlympicYear } from "./olympics.js";
import { youthIntakeTx, type IntakeResult } from "./youthIntake.js";
import { releaseSurplusGraduatesTx, type ReleasedGraduate } from "./graduates.js";
import { backfillContractsTx } from "./backfillContracts.js";
import {
  sellBrokePoolClubsTx, openPoolClubSeasonsTx, renewExpiredPoolContractsTx,
  reconcileLeagueSizesTx,
  type PoolClubSale,
} from "./poolClubFinances.js";
import { seasonEndsForCareerTx } from "./seasonDates.js";

/**
 * Season rollover.
 *
 * A career has no fixed length (L-01, 22 Sep 2026, Rob's call): it runs for as
 * many seasons as the manager keeps the job. Until L-01 the arc was capped at
 * five seasons by a `FINAL_SEASON` constant and season five's review was a
 * "verdict" that could not sack; that cap and everything that hung off it
 * (the `career-complete` result, `careerComplete`, `isFinalSeason`) are gone.
 * A career now ends ONLY by sacking at a season review, abandonment at a
 * forfeit, resignation, or breaking the contract — never by a season number.
 *
 * Everything here already runs at every boundary with no season number in it:
 * ageing, retirement at RETIREMENT_AGE, academy promotion at PROMOTION_AGE,
 * the academy intake (R-62, utils/youthIntake.ts), the standings snapshot, the
 * board review (R-53), trophies (R-42) and the next season's fixture (R-35).
 *
 * Before this existed a career simply ran off the end of season one: the date
 * advanced past endDate, `atSeasonEnd` was computed and returned to the client,
 * and nothing acted on it.
 */

/**
 * Retirement age.
 *
 * Set to 40 on 3 September 2026, on Rob's call. It was 34, and that number had
 * been chosen from the shipped roster rather than picked: the senior pool peaks
 * at 22-25, so retirement is back-loaded, and 34 retired [1, 0, 2, 1, 5] over
 * the first five seasons — a handful per season, never a cliff.
 *
 * ── What 40 costs, measured against the shipped roster ──────────────────────
 * The oldest senior in the world is 37 and the next oldest is 31, so at 40 the
 * same five seasons retire [0, 0, 1, 0, 0]: ONE player, and that player is
 * Martha Kera, the 37-year-old this change was made to accommodate.
 *
 * Over a long career the threshold does bite: a 25-year-old in 2026 reaches it
 * in season 16, so the shipped seniors retire in a wave around seasons 15-18
 * and the academy is what keeps the squad alive after that. That is the world
 * the 30-season harness run (harness/rollover.mjs) measures.
 *
 * Deliberately a flat threshold and not a probability curve: the spec asks for
 * "a handful per season, not a system".
 */
export const RETIREMENT_AGE = 40;

/**
 * Academy players graduate the season after they pass the youth age band.
 *
 * The shipped academy is 14-18 (YOUTH_AGE_MAX), so 19 is the first age that is
 * no longer youth. Every academy player crosses it within five seasons of
 * joining — which is exactly why the spec deletes senior generation: the
 * academy IS the pipeline.
 */
export const PROMOTION_AGE = 19;

/**
 * Seasons are numbered from their year. Career creation starts at 2026, so
 * 2026 is season 1, 2035 is season 10 and 2055 is season 30. Keeping the
 * mapping in one place stops "season 3" meaning two different things in two
 * files. It is arithmetic, so there is no table to outgrow.
 */
export const FIRST_SEASON_YEAR = 2026;
export const seasonNumberForYear = (year: number) => year - FIRST_SEASON_YEAR + 1;
export const yearForSeasonNumber = (n: number) => FIRST_SEASON_YEAR + n - 1;

/** Every closed season carries the board's review of it (R-53). */
export type RolloverResult =
  | { kind: "none" }
  | {
      kind: "rolled"; fromSeason: number; toSeason: number; newSeasonId: number;
      review: SeasonReview; intake: IntakeResult | null;
      /** L-02e: the club was sold at this review. The season still opened. */
      clubSold?: boolean;
    };


/**
 * Close the active season and open the next one.
 *
 * Idempotent by construction: it reads the ACTIVE season and completes it, so a
 * second call finds nothing active and returns "none" rather than creating a
 * duplicate season. That matters because the calendar can reach the boundary
 * more than once — advancing several days at a time crosses it in one step.
 */
export function rolloverSeason(careerSaveId: number, teamId: number): RolloverResult {
  return withCareerStateTx((w) => {
    const { tx, ageAllPlayers, retireAgedPlayers, promoteAgedYouth } = w;
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
    // career finished with the squad ages it started with.
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
        // R-29: this career's World Tour standings — its own field of real
        // clubs with real records. It used to snapshot every team in the
        // database, every career's, ranked by wins * 3.
        const standings = worldTourStandingsTx(tx, careerSaveId, season.year);
        if (standings.length > 0) {
          tx.insert(seasonFinalStandingsTable).values(
            standings.map((s) => ({
              teamId,
              seasonYear:     season.year,
              rank:           s.rank,
              competitorName: s.name,
              isPlayer:       s.isPlayer && s.teamId === teamId,
              wins:           s.wins,
              losses:         s.losses,
              points:         s.points,
              setDiff:        s.setsFor - s.setsAgainst,
            })),
          ).run();
        }
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

    // ── R-53: the board's season review ────────────────────────────────────
    // Finish against the target set at the draw, honours, money. In the same
    // transaction as the season closing, so no season closes without its
    // verdict. A sacking closes this season and opens no other: the calendar
    // route ends the career once this commits. Every season's review can sack;
    // there is no final season (L-01).
    const review = boardReviewTx(tx, careerSaveId, season.year, teamId);
    // R-42: the season's honours are the club's whatever the board decided —
    // written once, here, from the finals and the season's ranking points.
    awardSeasonTrophiesTx(tx, careerSaveId, season.year, current, teamId);

    // L-02e: the club has been sold out from under the manager after five
    // loss-making seasons.
    //
    // The rollover carries on regardless, and deliberately: the new season
    // opens, the world plays it, and the manager is the one who is not there.
    // Stopping here instead would have left the career in a season that had
    // ended and no season that had begun — nowhere for the club the manager
    // takes next to play. The flag rides out with the roll and the calendar
    // route detaches the manager once it has committed.
    const clubSold = review.outcome === "sold";

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
      isOlympicSeason:         isOlympicYear(nextYear),
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

    // R-35: build the new season's fixture here, in the same transaction that
    // created the season. Before this, rollover opened a season with nothing in
    // it, and the fixture appeared only when a page that calls
    // ensureSeasonFixture (the dashboard, or the fixtures screen) happened to be
    // opened — so the dashboard silently repaired the season for a player, while
    // any path that never opens a page (the rollover harness, and any future
    // headless or scripted run) saw an empty season and played no matches at
    // all. A season and its fixture are one atomic thing.
    //
    // `team` is read above for the standings snapshot and is the same club the
    // fixture belongs to. Guarded because that read is itself conditional: a
    // career whose team row has gone is already in a state the standings
    // snapshot skips, and there is nothing to schedule for it.
    if (team) {
      ensureSeasonFixtureRows(tx, { id: teamId, name: team.name }, nextYear);
    }

    // R-53: the board's row for the new season, opened on the balance the
    // club carries into it — what next season's money places are measured from.
    ensureBoardSeasonTx(tx, careerSaveId, nextYear, teamId);

    // Rob, 23 Sep: the same judgement, on the same rule, for the sixty. The
    // season that just ended is closed against the balance each club finished
    // it on, five loss-making seasons in a row sells one, and the club that
    // takes its place in the world's league is the best one not already in it.
    // Then next season is opened for everybody on what they carry into it,
    // which is the chain the rule is read from.
    const poolSales = sellBrokePoolClubsTx(tx, careerSaveId, season.year);
    // Six clubs to a continent, every season, whether anything was sold or not:
    // the regional season's thirty fixtures are built on that number and it
    // throws on any other. Restored rather than reasoned about
    // (utils/poolClubFinances.ts).
    reconcileLeagueSizesTx(tx, careerSaveId);
    openPoolClubSeasonsTx(tx, careerSaveId, nextYear);
    renewExpiredPoolContractsTx(
      tx, careerSaveId, `${nextYear}-01-01`, seasonEndsForCareerTx(tx, careerSaveId),
    );

    // R-62: the new season's academy intake, in the transaction that opened the
    // season, dated its first day — so no season opens without its intake.
    // L-02c: whoever went up is replaced, so the academy a career builds does
    // not drain away one graduate at a time. The club's own graduates only —
    // `promoted` covers every youth player in the career, including the ones no
    // club owns, who simply age into the senior market.
    const clubGraduates = promoted.filter((p) => p.teamId === teamId).length;
    const intake = team
      ? youthIntakeTx(w, careerSaveId, teamId, nextYear, `${nextYear}-01-01`, clubGraduates)
      : null;

    // L-02d: a club keeps four of its own graduates, not everything it ever
    // promoted. Run after the intake so the count is what the club carries into
    // the new season, and before the contract backfill so nobody is released
    // and handed a contract in the same boundary.
    const releasedGraduates: ReleasedGraduate[] = team
      ? releaseSurplusGraduatesTx(w, careerSaveId, teamId)
      : [];

    // L-02a: nobody crosses a season boundary without a contract. A gap opened
    // during the season (any path that attaches someone to a club without
    // writing one) is closed here rather than surviving into the next season.
    // Boot does the same for saves made before staff contracts existed.
    const contractsFilled = backfillContractsTx(w, careerSaveId, `${nextYear}-01-01`);

    return {
      kind: "rolled",
      fromSeason: current,
      toSeason: nextNumber,
      newSeasonId: created!.id,
      poolSales,
      review,
      intake,
      clubSold,
      releasedGraduates,
      contractsFilled,
    } as const;
  });
}
