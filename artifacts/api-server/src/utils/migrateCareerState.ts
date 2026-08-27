import {
  db,
  playersTable,
  staffTable,
  careerSavesTable,
  careerPlayerStateTable,
  careerStaffStateTable,
} from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * Snapshot the CURRENT global player/staff state into per-career state, once
 * per existing career save.
 *
 * This has to run BEFORE the mutable columns are dropped from `players` and
 * `staff`, and it must not create empty state: an empty career_player_state
 * would delete every existing career's roster. Because the state is global
 * today there is no way to reconstruct which career owned what — so every
 * career inherits the same snapshot, which is exactly what every career sees
 * today. Nothing is lost.
 *
 * Reads the old columns through raw SQL rather than the drizzle schema, because
 * the schema no longer declares them — this function has to survive the very
 * migration it performs.
 *
 * Idempotent: a career that already has state is skipped.
 */
export type CareerStateMigrationResult = {
  careersMigrated: number;
  playerRowsCreated: number;
  staffRowsCreated: number;
  skipped: number;
};

function tableHasColumn(table: string, column: string): boolean {
  const rows = db.all<{ name: string }>(sql.raw(`PRAGMA table_info(${table})`));
  return rows.some((r) => r.name === column);
}

export function migrateCareerStateOnce(): CareerStateMigrationResult {
  const result: CareerStateMigrationResult = {
    careersMigrated: 0, playerRowsCreated: 0, staffRowsCreated: 0, skipped: 0,
  };

  // If the legacy columns are already gone the snapshot has been taken.
  const legacyPlayers = tableHasColumn("players", "team_id");
  const legacyStaff   = tableHasColumn("staff", "team_id");
  if (!legacyPlayers && !legacyStaff) return result;

  db.transaction((tx) => {
    const saves = tx.select({ id: careerSavesTable.id }).from(careerSavesTable).all();
    if (saves.length === 0) return;

    const players = legacyPlayers
      ? tx.all<any>(sql.raw(`
          SELECT id, team_id, squad_role, is_active, salary, contract_end_date,
                 academy_contract_years, age, fitness, fatigue, morale,
                 injury_status, injury_weeks_remaining, is_injured,
                 consecutive_matches_played, training_points, training_focus,
                 focus_xp, scouted_potential, discovered_by, is_retired,
                 retired_season_year, career_wins, is_draft_player, outfit_id
          FROM players`))
      : [];

    const staff = legacyStaff
      ? tx.all<any>(sql.raw(`
          SELECT id, team_id, salary, is_available, contract_length, is_scout_revealed
          FROM staff`))
      : [];

    for (const save of saves) {
      const already = tx.all<{ n: number }>(sql.raw(
        `SELECT COUNT(*) AS n FROM career_player_state WHERE career_save_id = ${save.id}`))[0];
      if ((already?.n ?? 0) > 0) { result.skipped++; continue; }

      for (const p of players) {
        tx.insert(careerPlayerStateTable).values({
          careerSaveId: save.id,
          playerId:     p.id,
          teamId:       p.team_id ?? null,
          squadRole:    p.squad_role ?? "reserve",
          isActive:     !!p.is_active,
          salary:       Number(p.salary ?? 0),
          contractEndDate:      p.contract_end_date ?? null,
          academyContractYears: p.academy_contract_years ?? null,
          age:          Number(p.age ?? 20),
          fitness:      Number(p.fitness ?? 100),
          fatigue:      Number(p.fatigue ?? 0),
          morale:       Number(p.morale ?? 75),
          injuryStatus: p.injury_status ?? "Healthy",
          injuryWeeksRemaining: Number(p.injury_weeks_remaining ?? 0),
          isInjured:    !!p.is_injured,
          consecutiveMatchesPlayed: Number(p.consecutive_matches_played ?? 0),
          trainingPoints:   Number(p.training_points ?? 0),
          trainingFocus:    p.training_focus ?? null,
          focusXp:          Number(p.focus_xp ?? 0),
          scoutedPotential: p.scouted_potential ?? null,
          discoveredBy:     p.discovered_by ?? null,
          isRetired:        !!p.is_retired,
          retiredSeasonYear: p.retired_season_year ?? null,
          careerWins:       Number(p.career_wins ?? 0),
          isDraftPlayer:    !!p.is_draft_player,
          outfitId:         p.outfit_id ?? null,
        }).run();
        result.playerRowsCreated++;
      }

      for (const st of staff) {
        tx.insert(careerStaffStateTable).values({
          careerSaveId: save.id,
          staffId:      st.id,
          teamId:       st.team_id ?? null,
          salary:       Number(st.salary ?? 0),
          isAvailable:  st.is_available == null ? true : !!st.is_available,
          contractLength: Number(st.contract_length ?? 12),
          isScoutRevealed: !!st.is_scout_revealed,
        }).run();
        result.staffRowsCreated++;
      }

      result.careersMigrated++;
    }
  });

  return result;
}

/**
 * Create state rows for a brand-new career, copying the pristine reference
 * defaults. A new career starts with every player a free agent.
 */
export function seedCareerState(careerSaveId: number): void {
  db.transaction((tx) => {
    const players = tx.select({ id: playersTable.id }).from(playersTable).all();
    const staff   = tx.select({ id: staffTable.id }).from(staffTable).all();
    const baseAges = new Map(
      tx.all<{ id: number; age: number }>(
        sql.raw(`SELECT id, age FROM players`),
      ).map((r) => [r.id, r.age]),
    );

    for (const p of players) {
      tx.insert(careerPlayerStateTable).values({
        careerSaveId, playerId: p.id, age: baseAges.get(p.id) ?? 20,
      }).onConflictDoNothing().run();
    }
    for (const st of staff) {
      tx.insert(careerStaffStateTable).values({
        careerSaveId, staffId: st.id,
      }).onConflictDoNothing().run();
    }
  });
}
