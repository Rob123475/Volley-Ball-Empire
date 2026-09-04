import {
  db,
  usersTable,
  teamsTable,
  playersTable,
  staffTable,
  matchesTable,
  matchLiveStateTable,
  contractsTable,
  injuryHistoryTable,
  trainingSessionsTable,
  unityMatchStatsTable,
  youthLeagueResultsTable,
  continentalScoutingMissionsTable,
  achievementsTable,
  activeCampsTable,
  calendarStateTable,
  facilitiesTable,
  financeTransactionsTable,
  managerSeasonSummaryTable,
  promoDealsTable,
  seasonFinalStandingsTable,
  seasonInjuryStatsTable,
  trophiesTable,
  wellbeingEffectsTable,
  youthChampionshipTrophiesTable,
  youthLadderTable,
  youthProspectsTable,
  hallOfFameTable,
  olympicSelectionsTable,
  userProfilesTable,
  careerSavesTable,
  careerPlayerStateTable,
  careerStaffStateTable,
  regionalLeagueSeasonsTable,
  regionalLeagueFixturesTable,
  regionalLeagueResultsTable,
  seasonsTable,
  worldTourQualificationsTable,
  aiManagersTable,
} from "@workspace/db";
import { eq, inArray, or } from "drizzle-orm";
import { deleteCareerSave } from "./deleteCareerSave.js";

/**
 * Delete a local profile and everything that belongs to it.
 *
 * Every `user_id` column in the schema is NOT NULL, so there is no way to
 * orphan a profile's rows and leave them "unreachable" — the previous
 * implementation deleted only the `users` row and relied on that idea, which
 * stopped being true once foreign keys were enforced. Any profile that had
 * ever started a career failed with FOREIGN KEY constraint failed.
 *
 * Deleting a manager therefore deletes their careers too. Rows are removed
 * children-first; `defer_foreign_keys` is also set so the whole teardown is
 * validated once at COMMIT rather than statement by statement, which keeps
 * the ordering below from being load-bearing if the schema gains a new table.
 */
export function deleteProfileCascade(userId: string): void {
  db.transaction((tx) => {
    tx.run("PRAGMA defer_foreign_keys = ON");

    const teamIds = tx
      .select({ id: teamsTable.id })
      .from(teamsTable)
      .where(eq(teamsTable.userId, userId))
      .all()
      .map((r) => r.id);

    if (teamIds.length > 0) {
      // players is global reference data now — a career owns only its state
      // rows, so deleting a profile must not delete athletes.
      const playerIds = tx
        .select({ playerId: careerPlayerStateTable.playerId })
        .from(careerPlayerStateTable)
        .where(inArray(careerPlayerStateTable.teamId, teamIds))
        .all()
        .map((r) => r.playerId);

      const matchIds = tx
        .select({ id: matchesTable.id })
        .from(matchesTable)
        .where(or(
          inArray(matchesTable.homeTeamId, teamIds),
          inArray(matchesTable.awayTeamId, teamIds),
        ))
        .all()
        .map((r) => r.id);

      // ── Grandchildren: rows pointing at this profile's matches/players ────
      if (matchIds.length > 0) {
        tx.delete(matchLiveStateTable)
          .where(inArray(matchLiveStateTable.matchId, matchIds))
          .run();
      }
      if (playerIds.length > 0) {
        // A live-state row can also reference our players via the server /
        // ball-owner / last-action columns even when the match itself is not
        // ours, so clear those before the players go.
        tx.delete(matchLiveStateTable)
          .where(or(
            inArray(matchLiveStateTable.currentServerId, playerIds),
            inArray(matchLiveStateTable.ballOwnerId, playerIds),
            inArray(matchLiveStateTable.lastActionPlayerId, playerIds),
          ))
          .run();
      }

      // ── Children of teams ─────────────────────────────────────────────────
      for (const table of [
        contractsTable,
        injuryHistoryTable,
        trainingSessionsTable,
        unityMatchStatsTable,
        youthLeagueResultsTable,
        continentalScoutingMissionsTable,
        achievementsTable,
        activeCampsTable,
        calendarStateTable,
        facilitiesTable,
        financeTransactionsTable,
        promoDealsTable,
        seasonFinalStandingsTable,
        seasonInjuryStatsTable,
        trophiesTable,
        wellbeingEffectsTable,
        youthChampionshipTrophiesTable,
        youthLadderTable,
        youthProspectsTable,
      ] as const) {
        tx.delete(table).where(inArray((table as any).teamId, teamIds)).run();
      }

      if (matchIds.length > 0) {
        tx.delete(matchesTable).where(inArray(matchesTable.id, matchIds)).run();
      }
      // Only this career's state rows go; the athletes themselves are shared.
      tx.delete(careerPlayerStateTable).where(inArray(careerPlayerStateTable.teamId, teamIds)).run();
      tx.delete(careerStaffStateTable).where(inArray(careerStaffStateTable.teamId, teamIds)).run();
    }

    // ── Career-save children, then the saves ───────────────────────────────
    // career_player_state / career_staff_state FK career_save_id, so they must
    // go for EVERY save this user owns, not only those whose team matched above.
    const saveIds = tx
      .select({ id: careerSavesTable.id })
      .from(careerSavesTable)
      .where(eq(careerSavesTable.userId, userId))
      .all()
      .map((r) => r.id);
    if (saveIds.length > 0) {
      // deleteCareerSave deletes careerPlayerStateTable, careerStaffStateTable,
      // careerPoolTeamStateTable, competitorRankingsTable, poachingOffersTable,
      // careerHistoryEntriesTable and the careerSavesTable row itself — the
      // same shared cascade the career-slot routes use. Passing our own `tx`
      // keeps this part of the one profile-deletion transaction rather than
      // opening a nested one.
      for (const saveId of saveIds) {
        deleteCareerSave(saveId, tx);
      }
      // seasons does NOT FK career_saves (career_save_id is deliberately
      // unreferenced so pre-migration rows survive), so it never blocked a
      // delete — but it's still career-scoped and must go, or an orphaned
      // season silently survives a profile deletion that returns 200.
      tx.delete(seasonsTable).where(inArray(seasonsTable.careerSaveId, saveIds)).run();
      // Results before fixtures before seasons: results FK fixtures, fixtures
      // FK seasons. defer_foreign_keys makes the order non-load-bearing, but
      // getting it right costs nothing and survives that pragma changing.
      tx.delete(regionalLeagueResultsTable).where(inArray(regionalLeagueResultsTable.careerSaveId, saveIds)).run();
      tx.delete(regionalLeagueFixturesTable).where(inArray(regionalLeagueFixturesTable.careerSaveId, saveIds)).run();
      tx.delete(regionalLeagueSeasonsTable).where(inArray(regionalLeagueSeasonsTable.careerSaveId, saveIds)).run();
      tx.delete(worldTourQualificationsTable).where(inArray(worldTourQualificationsTable.careerSaveId, saveIds)).run();
      tx.delete(aiManagersTable).where(inArray(aiManagersTable.careerSaveId, saveIds)).run();
    }

    // ── Remaining direct references to the user ────────────────────────────
    tx.delete(managerSeasonSummaryTable).where(eq(managerSeasonSummaryTable.userId, userId)).run();
    tx.delete(hallOfFameTable).where(eq(hallOfFameTable.userId, userId)).run();
    tx.delete(olympicSelectionsTable).where(eq(olympicSelectionsTable.userId, userId)).run();
    tx.delete(userProfilesTable).where(eq(userProfilesTable.userId, userId)).run();

    if (teamIds.length > 0) {
      tx.delete(teamsTable).where(inArray(teamsTable.id, teamIds)).run();
    }

    tx.delete(usersTable).where(eq(usersTable.id, userId)).run();
  });
}
