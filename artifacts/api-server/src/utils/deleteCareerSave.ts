import {
  db,
  careerSavesTable,
  careerPlayerStateTable,
  careerStaffStateTable,
  careerPoolTeamStateTable,
  competitorRankingsTable,
  worldTourFixturesTable,
  playerRankingPointsTable,
  boardSeasonsTable,
  careerHistoryEntriesTable,
  olympicTournamentsTable,
  olympicMatchesTable,
  olympicMedalsTable,
  youthIntakesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Deletes every row that references this career save, then the career_saves
 * row itself. Global world data (teams, players, matches, finances, ...) is
 * NOT touched — only save-slot-owned data.
 *
 * career_player_state, career_staff_state, career_pool_team_state and
 * competitor_rankings carry NOT NULL, non-cascading FKs to career_saves, and
 * every new career seeds rows into the first three immediately (see
 * migrateCareerState.ts), so both the overwrite and delete paths fail on a
 * foreign key unless these go first. career_history_entries is included for the
 * same reason. This is the one place that knows the full list — overwrite,
 * delete, and profile deletion all call it rather than each keeping their own
 * copy.
 *
 * Pass an existing transaction (`tx`) to run inside a larger transaction
 * already in progress; omit it to run as its own standalone transaction.
 */
export function deleteCareerSave(careerSaveId: number, tx?: DbTx): void {
  const run = (t: DbTx) => {
    t.delete(careerHistoryEntriesTable).where(eq(careerHistoryEntriesTable.careerSaveId, careerSaveId)).run();
    t.delete(careerPlayerStateTable).where(eq(careerPlayerStateTable.careerSaveId, careerSaveId)).run();
    t.delete(careerStaffStateTable).where(eq(careerStaffStateTable.careerSaveId, careerSaveId)).run();
    t.delete(careerPoolTeamStateTable).where(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId)).run();
    t.delete(competitorRankingsTable).where(eq(competitorRankingsTable.careerSaveId, careerSaveId)).run();
    // R-29: World Tour fixtures reference the save (NOT NULL) and its competitors.
    t.delete(worldTourFixturesTable).where(eq(worldTourFixturesTable.careerSaveId, careerSaveId)).run();
    // R-46: per-player World Tour points reference the save (NOT NULL).
    t.delete(playerRankingPointsTable).where(eq(playerRankingPointsTable.careerSaveId, careerSaveId)).run();
    // R-53: the board's season rows reference the save (NOT NULL).
    t.delete(boardSeasonsTable).where(eq(boardSeasonsTable.careerSaveId, careerSaveId)).run();
    // R-61: the Olympic tournaments reference the save (NOT NULL); medals and
    // matches reference their tournament, so they go first.
    t.delete(olympicMedalsTable).where(eq(olympicMedalsTable.careerSaveId, careerSaveId)).run();
    t.delete(olympicMatchesTable).where(eq(olympicMatchesTable.careerSaveId, careerSaveId)).run();
    t.delete(olympicTournamentsTable).where(eq(olympicTournamentsTable.careerSaveId, careerSaveId)).run();
    // R-62: the academy intakes reference the save (NOT NULL).
    t.delete(youthIntakesTable).where(eq(youthIntakesTable.careerSaveId, careerSaveId)).run();
    t.delete(careerSavesTable).where(eq(careerSavesTable.id, careerSaveId)).run();
  };

  if (tx) { run(tx); return; }
  db.transaction((t) => run(t));
}
