import {
  db,
  careerSavesTable,
  careerPlayerStateTable,
  careerStaffStateTable,
  careerPoolTeamStateTable,
  competitorRankingsTable,
  poachingOffersTable,
  careerHistoryEntriesTable,
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
 * foreign key unless these go first. poaching_offers and career_history_entries
 * are included for the same reason. This is the one place that knows the full
 * list — overwrite, delete, and profile deletion all call it rather than each
 * keeping their own copy.
 *
 * Pass an existing transaction (`tx`) to run inside a larger transaction
 * already in progress; omit it to run as its own standalone transaction.
 */
export function deleteCareerSave(careerSaveId: number, tx?: DbTx): void {
  const run = (t: DbTx) => {
    t.delete(poachingOffersTable).where(eq(poachingOffersTable.careerSaveId, careerSaveId)).run();
    t.delete(careerHistoryEntriesTable).where(eq(careerHistoryEntriesTable.careerSaveId, careerSaveId)).run();
    t.delete(careerPlayerStateTable).where(eq(careerPlayerStateTable.careerSaveId, careerSaveId)).run();
    t.delete(careerStaffStateTable).where(eq(careerStaffStateTable.careerSaveId, careerSaveId)).run();
    t.delete(careerPoolTeamStateTable).where(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId)).run();
    t.delete(competitorRankingsTable).where(eq(competitorRankingsTable.careerSaveId, careerSaveId)).run();
    t.delete(careerSavesTable).where(eq(careerSavesTable.id, careerSaveId)).run();
  };

  if (tx) { run(tx); return; }
  db.transaction((t) => run(t));
}
