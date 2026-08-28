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
                 speed, power, defense, serve, block, stamina,
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
          speed:        Number(p.speed   ?? 70),
          power:        Number(p.power   ?? 70),
          defense:      Number(p.defense ?? 70),
          serve:        Number(p.serve   ?? 70),
          block:        Number(p.block   ?? 70),
          stamina:      Number(p.stamina ?? 70),
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
 * Columns that have moved to career state. Once the snapshot above has run they
 * are dead weight on the reference row, and worse: a raw query that still reads
 * one keeps returning a stale value instead of failing.
 *
 * Dropping them in the schema alone only protects THIS checkout — a real save
 * on disk keeps the columns forever. So the drop runs here, idempotently, as
 * part of the same boot migration that took the snapshot.
 */
const MOVED_PLAYER_COLUMNS = [
  "team_id", "squad_role", "is_active",
  "salary", "contract_end_date", "academy_contract_years", "outfit_id",
  "fitness", "fatigue", "morale", "injury_status", "injury_weeks_remaining",
  "is_injured", "consecutive_matches_played", "doctor_quality",
] as const;

/**
 * EMPTY ON PURPOSE. `staff` has not been split in the drizzle schema yet — it
 * still declares salary/team_id/is_available/contract_length/is_scout_revealed,
 * so dropping them here would break every staff query at runtime. They move
 * when the staff chunk lands, not before. The rule this encodes: a column may
 * only be dropped once the schema has already stopped declaring it.
 */
const MOVED_STAFF_COLUMNS: readonly string[] = [];

/**
 * Drop the moved columns. MUST run after migrateCareerStateOnce() — it reads
 * them. Safe to call every boot: a column that is already gone is skipped.
 *
 * Deliberately NOT in one transaction with the snapshot. SQLite rebuilds the
 * table for each DROP COLUMN, and a half-applied drop set is recoverable — the
 * next boot finishes it — whereas a rolled-back snapshot is not.
 */
export function dropMovedColumns(): { dropped: string[] } {
  const dropped: string[] = [];

  // Nothing may be dropped until every career has its state, or the snapshot
  // source disappears while a career still depends on it.
  const [row] = db.all<{ n: number }>(sql.raw(`
    SELECT COUNT(*) AS n FROM career_saves cs
    WHERE NOT EXISTS (
      SELECT 1 FROM career_player_state ps WHERE ps.career_save_id = cs.id
    )
  `));
  if (Number(row?.n ?? 0) > 0) return { dropped };

  // players.salary is about to go, and it is the only source a NEW career has
  // for a player's starting wage. asking_price is reference data that stays,
  // and asking_price = salary * 12 holds for every priced player in the shipped
  // data (196/196), so backfill it before the column disappears. The unpriced
  // rows are youth on a salary of 0 — nothing to carry across.
  if (tableHasColumn("players", "salary")) {
    db.run(sql.raw(`
      UPDATE players SET asking_price = salary * 12
      WHERE asking_price IS NULL AND salary IS NOT NULL AND salary > 0
    `));
  }

  for (const [table, columns] of [
    ["players", MOVED_PLAYER_COLUMNS],
    ["staff",   MOVED_STAFF_COLUMNS],
  ] as const) {
    for (const column of columns) {
      if (!tableHasColumn(table, column)) continue;
      try {
        db.run(sql.raw(`ALTER TABLE ${table} DROP COLUMN ${column}`));
        dropped.push(`${table}.${column}`);
      } catch (err) {
        // A column carrying an index or a generated-column reference cannot be
        // dropped by SQLite. Leaving it is safe — nothing reads it any more —
        // whereas failing the boot over it is not.
        console.warn(`[migrate] could not drop ${table}.${column}:`, (err as Error).message);
      }
    }
  }

  return { dropped };
}

/**
 * Create state rows for a brand-new career, copying the pristine reference
 * defaults. A new career starts with every player a free agent.
 */
export function seedCareerState(careerSaveId: number): void {
  db.transaction((tx) => {
    const players = tx.select({ id: playersTable.id }).from(playersTable).all();
    const staff   = tx.select({ id: staffTable.id }).from(staffTable).all();
    // Copy the reference age, base stats, and starting wage. Seeding salary at
    // the column default left every player in a new career priced at 0.
    //
    // The wage comes from asking_price, not from players.salary: salary has
    // moved to career state and the column is dropped at boot, so reading it
    // here would throw the moment the migration completes. asking_price is
    // reference data — what the player COSTS — and asking_price = salary * 12
    // holds across the shipped data.
    const refs = new Map(
      tx.all<any>(
        sql.raw(`SELECT id, age, asking_price, speed, power, defense, serve, block, stamina FROM players`),
      ).map((r) => [r.id, r]),
    );

    for (const p of players) {
      tx.insert(careerPlayerStateTable).values({
        careerSaveId, playerId: p.id,
        age:     refs.get(p.id)?.age ?? 20,
        salary:  Math.round(Number(refs.get(p.id)?.asking_price ?? 0) / 12),
        speed:   Number(refs.get(p.id)?.speed   ?? 70),
        power:   Number(refs.get(p.id)?.power   ?? 70),
        defense: Number(refs.get(p.id)?.defense ?? 70),
        serve:   Number(refs.get(p.id)?.serve   ?? 70),
        block:   Number(refs.get(p.id)?.block   ?? 70),
        stamina: Number(refs.get(p.id)?.stamina ?? 70),
      }).onConflictDoNothing().run();
    }
    for (const st of staff) {
      tx.insert(careerStaffStateTable).values({
        careerSaveId, staffId: st.id,
      }).onConflictDoNothing().run();
    }
  });
}
