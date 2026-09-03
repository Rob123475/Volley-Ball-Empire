import {
  db,
  playersTable,
  staffTable,
  careerSavesTable,
  careerPlayerStateTable,
  careerStaffStateTable,
  careerPoolTeamStateTable,
  regionalLeagueSeasonsTable,
  regionalLeagueFixturesTable,
} from "@workspace/db";
import { sql } from "drizzle-orm";
import { generateDoubleRoundRobin } from "./fixtures.js";
import { monthlyWage } from "./wageCurve.js";

/** A regional league is six clubs playing a double round-robin. */
const LEAGUE_SIZE = 6;

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
 * Idempotent: a career that already has state is skipped. The per-career skip
 * counts career_player_state only, so a save holding staff state without player
 * state used to collide on the staff insert and abort the WHOLE transaction —
 * permanently, on every boot, with the save never migrating. Both inserts are
 * onConflictDoNothing for that reason; the skip is the fast path, not the
 * guarantee.
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

/** Everything the player snapshot would like to read, newest additions last. */
const PLAYER_SNAPSHOT_COLUMNS = [
  "id", "team_id", "squad_role", "is_active", "salary", "contract_end_date",
  "academy_contract_years", "age", "base_age", "fitness", "fatigue", "morale",
  "speed", "power", "defense", "serve", "block", "stamina",
  "injury_status", "injury_weeks_remaining", "is_injured",
  "consecutive_matches_played", "training_points", "training_focus",
  "focus_xp", "scouted_potential", "discovered_by", "is_retired",
  "retired_season_year", "career_wins", "is_draft_player", "outfit_id",
] as const;

const STAFF_SNAPSHOT_COLUMNS = [
  "id", "team_id", "salary", "base_salary",
  "is_available", "contract_length", "is_scout_revealed",
] as const;

/** What a NEW career copies off the reference row when it is created. */
const SEED_REFERENCE_COLUMNS = [
  // Both names: an old save still calls it `age`, a current one `base_age`.
  // presentColumns() keeps whichever this database actually has.
  "id", "age", "base_age", "asking_price",
  "speed", "power", "defense", "serve", "block", "stamina",
  // Who starts in the draft pool. Without this a new career sees the column
  // default (false) for all 268 athletes and the draft pool is empty.
  "is_draft_player",
] as const;

/** What a NEW career copies off the staff reference row. */
const SEED_STAFF_REFERENCE_COLUMNS = ["id", "salary", "base_salary"] as const;

/** What a NEW career copies off the pool-club reference row. */
const SEED_POOL_REFERENCE_COLUMNS = ["id", "starts_in_league", "is_active_in_league"] as const;

/** Season 1. Regional league years are league-local, not calendar years. */
const FIRST_LEAGUE_SEASON_YEAR = 1;

/**
 * Build one career's regional league from the clubs that career has in it.
 *
 * Reads career_pool_team_state, which the caller has just populated in this
 * same transaction, so the league is built from THIS career's league membership
 * rather than from the shared reference flag. If a career ever starts with a
 * different set of clubs, its league follows automatically.
 *
 * A continent without exactly 6 active clubs is skipped with a warning rather
 * than throwing: a broken league in one continent should not stop a career from
 * being created at all.
 */
function seedRegionalLeagueTx(tx: DbTx, careerSaveId: number): void {
  const rows = tx.all<{ continent: string; pool_team_id: number }>(sql.raw(`
    SELECT p.continent AS continent, s.pool_team_id AS pool_team_id
    FROM career_pool_team_state s
    JOIN continental_pool_teams p ON p.id = s.pool_team_id
    WHERE s.career_save_id = ${careerSaveId} AND s.is_active_in_league = 1
    ORDER BY p.continent, p.pool_ranking
  `));

  const byContinent = new Map<string, number[]>();
  for (const r of rows) {
    const list = byContinent.get(r.continent) ?? [];
    list.push(r.pool_team_id);
    byContinent.set(r.continent, list);
  }

  for (const [continent, teamIds] of byContinent) {
    if (teamIds.length !== LEAGUE_SIZE) {
      console.warn(
        `[seed] ${continent} has ${teamIds.length} active clubs, expected ${LEAGUE_SIZE} — league skipped`);
      continue;
    }

    const [season] = tx.insert(regionalLeagueSeasonsTable).values({
      careerSaveId,
      seasonYear: FIRST_LEAGUE_SEASON_YEAR,
      continent,
      teamIds,
      status: "active",
    }).returning().all();

    tx.insert(regionalLeagueFixturesTable).values(
      generateDoubleRoundRobin(teamIds).map((f) => ({
        careerSaveId,
        regionalLeagueSeasonId: season!.id,
        round:          f.round,
        homePoolTeamId: f.home,
        awayPoolTeamId: f.away,
        status:         "scheduled",
      })),
    ).run();
  }
}

/**
 * Narrow a wish-list of columns to the ones this database actually has.
 *
 * `id` is the one column that must exist; without it there is nothing to key
 * the state row on, and a save missing it is not a save we can migrate.
 */
function presentColumns(table: string, wanted: readonly string[]): string {
  const have = new Set(
    db.all<{ name: string }>(sql.raw(`PRAGMA table_info(${table})`)).map((r) => r.name),
  );
  const usable = wanted.filter((c) => have.has(c));
  if (!usable.includes("id")) {
    throw new Error(`${table} has no id column — cannot snapshot this database`);
  }
  return usable.join(", ");
}

export function migrateCareerStateOnce(): CareerStateMigrationResult {
  const result: CareerStateMigrationResult = {
    careersMigrated: 0, playerRowsCreated: 0, staffRowsCreated: 0, skipped: 0,
  };

  // If the legacy columns are already gone the snapshot has been taken.
  // Key the check on columns SQLite can actually DROP. staff.team_id and
  // players.outfit_id both carry foreign keys and survive the drop forever, so
  // testing those would leave this running its full scan on every boot.
  const legacyPlayers = tableHasColumn("players", "squad_role");
  const legacyStaff   = tableHasColumn("staff", "is_available");
  if (!legacyPlayers && !legacyStaff) return result;

  db.transaction((tx) => {
    const saves = tx.select({ id: careerSavesTable.id }).from(careerSavesTable).all();
    if (saves.length === 0) return;

    // Select only the columns this database actually HAS.
    //
    // A fixed column list is a trap here: this runs against saves written by
    // builds we cannot enumerate, and naming one column an old schema never had
    // throws and takes the whole snapshot with it — the save then never
    // migrates, on every boot, forever. Every field below is read with a
    // fallback, so a column that is absent simply takes its default.
    const players = legacyPlayers ? tx.all<any>(sql.raw(
      `SELECT ${presentColumns("players", PLAYER_SNAPSHOT_COLUMNS)} FROM players`)) : [];

    const staff = legacyStaff ? tx.all<any>(sql.raw(
      `SELECT ${presentColumns("staff", STAFF_SNAPSHOT_COLUMNS)} FROM staff`)) : [];

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
          age:          Number(p.base_age ?? p.age ?? 20),
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
        }).onConflictDoNothing().run();
        result.playerRowsCreated++;
      }

      for (const st of staff) {
        tx.insert(careerStaffStateTable).values({
          careerSaveId: save.id,
          staffId:      st.id,
          teamId:       st.team_id ?? null,
          salary:       Number(st.salary ?? st.base_salary ?? 0),
          isAvailable:  st.is_available == null ? true : !!st.is_available,
          contractLength: Number(st.contract_length ?? 12),
          isScoutRevealed: !!st.is_scout_revealed,
        }).onConflictDoNothing().run();
        result.staffRowsCreated++;
      }

      result.careersMigrated++;
    }
  });

  return result;
}

/**
 * Snapshot pool-club league state into per-career state.
 *
 * Separate from the player/staff snapshot and separately guarded: a save can
 * already have player and staff state while predating the pool split, so
 * folding it into the same early-return would skip it forever on exactly the
 * databases that need it.
 */
export function migratePoolTeamStateOnce(): { careersMigrated: number; rowsCreated: number } {
  const result = { careersMigrated: 0, rowsCreated: 0 };

  // is_active_in_league is the sentinel: it is the column the split removes,
  // and unlike a foreign-key-bound column it can actually be dropped, so this
  // check clears once the migration is done.
  if (!tableHasColumn("continental_pool_teams", "is_active_in_league")) return result;

  db.transaction((tx) => {
    const saves = tx.select({ id: careerSavesTable.id }).from(careerSavesTable).all();
    if (saves.length === 0) return;

    const pools = tx.all<any>(sql.raw(
      `SELECT ${presentColumns("continental_pool_teams", POOL_SNAPSHOT_COLUMNS)} ` +
      `FROM continental_pool_teams`));

    for (const save of saves) {
      const [already] = tx.all<{ n: number }>(sql.raw(
        `SELECT COUNT(*) AS n FROM career_pool_team_state WHERE career_save_id = ${save.id}`));
      if (Number(already?.n ?? 0) > 0) continue;

      for (const t of pools) {
        tx.insert(careerPoolTeamStateTable).values({
          careerSaveId: save.id,
          poolTeamId:   t.id,
          isActiveInLeague: t.is_active_in_league == null
            ? !!t.starts_in_league
            : !!t.is_active_in_league,
          promotionCount:  Number(t.promotion_count ?? 0),
          relegationCount: Number(t.relegation_count ?? 0),
        }).onConflictDoNothing().run();
        result.rowsCreated++;
      }
      result.careersMigrated++;
    }
  });

  return result;
}

/**
 * Attribute globally-seeded regional-league rows to careers.
 *
 * The league was keyed by season alone, so an existing save with two careers has
 * ONE set of 6 seasons and 180 fixtures that both careers were reading and both
 * were writing results into. Giving those rows a career_save_id has to answer:
 * which career gets them?
 *
 * The same answer as the player-state migration: EVERY career gets its own copy
 * of the current global rows. That is exactly what each of them sees today, so
 * nothing is lost and nothing is invented. The first career adopts the originals
 * in place; every other career gets a duplicate set, with fixtures and results
 * repointed at the copies.
 *
 * Idempotent: rows that already carry a career_save_id are left alone, and a
 * career that already has seasons is skipped.
 */
export function attributeRegionalLeagueOnce(): {
  careersAttributed: number; seasonsCopied: number; fixturesCopied: number;
} {
  const result = { careersAttributed: 0, seasonsCopied: 0, fixturesCopied: 0 };

  if (!tableHasColumn("regional_league_seasons", "career_save_id")) return result;

  db.transaction((tx) => {
    const saves = tx.select({ id: careerSavesTable.id }).from(careerSavesTable).all();
    if (saves.length === 0) return;

    const orphans = tx.all<{ id: number }>(sql.raw(
      `SELECT id FROM regional_league_seasons WHERE career_save_id IS NULL`));
    if (orphans.length === 0) return;

    saves.forEach((save, index) => {
      const [has] = tx.all<{ n: number }>(sql.raw(
        `SELECT COUNT(*) AS n FROM regional_league_seasons WHERE career_save_id = ${save.id}`));
      if (Number(has?.n ?? 0) > 0) return;

      if (index === 0) {
        // The first career adopts the originals — no copying, no id churn.
        const ids = orphans.map((o) => o.id).join(",");
        tx.run(sql.raw(
          `UPDATE regional_league_seasons SET career_save_id = ${save.id} WHERE id IN (${ids})`));
        tx.run(sql.raw(
          `UPDATE regional_league_fixtures SET career_save_id = ${save.id} ` +
          `WHERE regional_league_season_id IN (${ids})`));
        tx.run(sql.raw(
          `UPDATE regional_league_results SET career_save_id = ${save.id} ` +
          `WHERE fixture_id IN (SELECT id FROM regional_league_fixtures ` +
          `WHERE regional_league_season_id IN (${ids}))`));
        result.seasonsCopied += orphans.length;
      } else {
        // Every other career gets its own copy of the same league.
        for (const orphan of orphans) {
          tx.run(sql.raw(
            `INSERT INTO regional_league_seasons ` +
            `(career_save_id, season_year, continent, team_ids, status, created_at) ` +
            `SELECT ${save.id}, season_year, continent, team_ids, status, created_at ` +
            `FROM regional_league_seasons WHERE id = ${orphan.id}`));
          const [row] = tx.all<{ id: number }>(sql.raw(`SELECT last_insert_rowid() AS id`));
          const newSeasonId = row!.id;
          result.seasonsCopied++;

          tx.run(sql.raw(
            `INSERT INTO regional_league_fixtures ` +
            `(career_save_id, regional_league_season_id, round, home_pool_team_id, ` +
            ` away_pool_team_id, home_score, away_score, status, created_at) ` +
            `SELECT ${save.id}, ${newSeasonId}, round, home_pool_team_id, ` +
            ` away_pool_team_id, home_score, away_score, status, created_at ` +
            `FROM regional_league_fixtures WHERE regional_league_season_id = ${orphan.id}`));
          const [n] = tx.all<{ n: number }>(sql.raw(
            `SELECT COUNT(*) AS n FROM regional_league_fixtures ` +
            `WHERE regional_league_season_id = ${newSeasonId}`));
          result.fixturesCopied += Number(n?.n ?? 0);
        }
        // Results are NOT copied: regional_league_results.fixture_id is UNIQUE,
        // so a copied result would collide. A second career inherits the same
        // fixtures with the same recorded scores on the fixture row, which is
        // what it already saw; the per-result rows belong to the originals.
      }
      result.careersAttributed++;
    });
  });

  return result;
}

const POOL_SNAPSHOT_COLUMNS = [
  "id", "is_active_in_league", "starts_in_league",
  "promotion_count", "relegation_count",
] as const;

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
  // chunk 5 — development and scouting
  "training_points", "training_focus", "focus_xp",
  "scouted_potential", "discovered_by",
  // chunk 6 — retirement. is_draft_player is NOT here: it stays on `players`
  // as the reference seed for who starts in the draft pool.
  "is_retired", "retired_season_year", "career_wins",
  // chunk 7 — the living age. Dropped only once base_age exists to carry the
  // starting value; dropMovedColumns checks that below.
  "age",
] as const;

/**
 * EMPTY ON PURPOSE. `staff` has not been split in the drizzle schema yet — it
 * still declares salary/team_id/is_available/contract_length/is_scout_revealed,
 * so dropping them here would break every staff query at runtime. They move
 * when the staff chunk lands, not before. The rule this encodes: a column may
 * only be dropped once the schema has already stopped declaring it.
 */
/** continental_pool_players: the rename's old name, dropped once base_age exists. */
const MOVED_POOL_PLAYER_COLUMNS: readonly string[] = ["age"];

/** continental_pool_teams: the three career-state columns plus the old name. */
const MOVED_POOL_TEAM_COLUMNS: readonly string[] = [
  "is_active_in_league", "promotion_count", "relegation_count",
];

const MOVED_STAFF_COLUMNS: readonly string[] = [
  "team_id", "is_available", "contract_length", "is_scout_revealed",
  // salary and age are RENAMED, not moved: base_salary / base_age replace them
  // on the reference row. The old names go once those exist to carry the value,
  // which the backfill below guarantees.
  "salary", "age",
];

/**
 * Columns dropMovedColumns() below creates itself, with a real value copied
 * from the old column it replaces — not the schema's bare default. ensureSchema's
 * generic column-diff (utils/ensureSchema.ts) must skip these: if it created one
 * first, the `tableHasColumn` guard below would see it already present, skip
 * the copy, and every renamed row would keep the schema default (age 35,
 * $3000/wk, etc.) instead of the value it actually had.
 */
export const RENAME_MANAGED_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ["staff", "base_salary"],
  ["staff", "base_age"],
  ["continental_pool_teams", "starts_in_league"],
  ["continental_pool_players", "base_age"],
  ["players", "base_age"],
];

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

  // `age` is about to go the same way, but unlike salary it has no existing
  // reference column to land in — base_age is new. Create it and carry the
  // value across BEFORE the drop, or every athlete in an upgrading save loses
  // the age they started at.
  //
  // A DEFAULT is required: SQLite cannot add a NOT NULL column to a populated
  // table without one. The model declares base_age without a default, which the
  // starter-DB drift check tolerates because it compares column names.
  // Staff renames, same shape as players.age -> base_age. base_salary is the
  // isDraftPlayer-shaped trap here: all 120 staff carry a wage and nothing else
  // records it, so losing it would make every new career's staff market free.
  if (!tableHasColumn("staff", "base_salary")) {
    db.run(sql.raw(`ALTER TABLE staff ADD COLUMN base_salary real NOT NULL DEFAULT 3000`));
    if (tableHasColumn("staff", "salary")) {
      db.run(sql.raw(`UPDATE staff SET base_salary = salary WHERE salary IS NOT NULL`));
    }
  }
  if (!tableHasColumn("staff", "base_age")) {
    db.run(sql.raw(`ALTER TABLE staff ADD COLUMN base_age integer NOT NULL DEFAULT 35`));
    if (tableHasColumn("staff", "age")) {
      db.run(sql.raw(`UPDATE staff SET base_age = age WHERE age IS NOT NULL`));
    }
  }

  // continental_pool_teams.is_active_in_league -> starts_in_league. The
  // reference seed for who BEGINS in the league; the live value lives in
  // career_pool_team_state and is seeded from it.
  if (!tableHasColumn("continental_pool_teams", "starts_in_league")) {
    db.run(sql.raw(`ALTER TABLE continental_pool_teams ADD COLUMN starts_in_league integer NOT NULL DEFAULT 1`));
    if (tableHasColumn("continental_pool_teams", "is_active_in_league")) {
      db.run(sql.raw(`UPDATE continental_pool_teams SET starts_in_league = is_active_in_league`));
    }
  }

  // continental_pool_players.age -> base_age. Pure reference data, never
  // mutated, so the rename is the whole migration for that table.
  if (!tableHasColumn("continental_pool_players", "base_age")) {
    db.run(sql.raw(`ALTER TABLE continental_pool_players ADD COLUMN base_age integer NOT NULL DEFAULT 22`));
    if (tableHasColumn("continental_pool_players", "age")) {
      db.run(sql.raw(`UPDATE continental_pool_players SET base_age = age WHERE age IS NOT NULL`));
    }
  }

  if (!tableHasColumn("players", "base_age")) {
    db.run(sql.raw(`ALTER TABLE players ADD COLUMN base_age integer NOT NULL DEFAULT 20`));
    if (tableHasColumn("players", "age")) {
      db.run(sql.raw(`UPDATE players SET base_age = age WHERE age IS NOT NULL`));
    }
  }

  for (const [table, columns] of [
    ["players", MOVED_PLAYER_COLUMNS],
    ["staff",   MOVED_STAFF_COLUMNS],
    ["continental_pool_players", MOVED_POOL_PLAYER_COLUMNS],
    ["continental_pool_teams", MOVED_POOL_TEAM_COLUMNS],
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
    // Same rule as the snapshot: name only columns this database HAS.
    //
    // This list is the more dangerous of the two, because it runs on EVERY
    // career creation rather than once per save. `age` is the next column
    // scheduled to move; with a fixed list, the chunk that moves it silently
    // breaks the creation of every new career. Every field is read with a
    // fallback, so an absent column takes its default instead.
    const refs = new Map(
      tx.all<any>(sql.raw(
        `SELECT ${presentColumns("players", SEED_REFERENCE_COLUMNS)} FROM players`,
      )).map((r) => [r.id, r]),
    );

    // The same problem for staff: base_salary is the only record of what a
    // staff member costs, and seeding at the column default made every hire in
    // a new career free.
    const staffRefs = new Map(
      tx.all<any>(sql.raw(
        `SELECT ${presentColumns("staff", SEED_STAFF_REFERENCE_COLUMNS)} FROM staff`,
      )).map((r) => [r.id, r]),
    );

    for (const p of players) {
      tx.insert(careerPlayerStateTable).values({
        careerSaveId, playerId: p.id,
        age:     Number(refs.get(p.id)?.base_age ?? refs.get(p.id)?.age ?? 20),
        salary:  monthlyWage(refs.get(p.id)?.asking_price),
        speed:   Number(refs.get(p.id)?.speed   ?? 70),
        power:   Number(refs.get(p.id)?.power   ?? 70),
        defense: Number(refs.get(p.id)?.defense ?? 70),
        serve:   Number(refs.get(p.id)?.serve   ?? 70),
        block:   Number(refs.get(p.id)?.block   ?? 70),
        stamina: Number(refs.get(p.id)?.stamina ?? 70),
        isDraftPlayer: !!refs.get(p.id)?.is_draft_player,
      }).onConflictDoNothing().run();
    }
    // Pool clubs: seed this career's league membership from the reference
    // startsInLeague flag. 36 of the 60 begin in the league; without this a new
    // career gets the column default and the regional league is empty.
    const poolTeams = tx.all<any>(sql.raw(
      `SELECT ${presentColumns("continental_pool_teams", SEED_POOL_REFERENCE_COLUMNS)} ` +
      `FROM continental_pool_teams`));
    for (const t of poolTeams) {
      tx.insert(careerPoolTeamStateTable).values({
        careerSaveId, poolTeamId: t.id,
        isActiveInLeague: t.starts_in_league == null
          ? !!t.is_active_in_league
          : !!t.starts_in_league,
      }).onConflictDoNothing().run();
    }

    // Build this career's regional league: one season per continent plus its
    // 30 fixtures, 6 x 30 = 180.
    //
    // Generated rather than shipped. Season rollover needs a fixture generator
    // for seasons 2-5 regardless, so using it at career creation means every
    // new save exercises it and a bug surfaces on the next career rather than
    // at the first rollover, months in.
    seedRegionalLeagueTx(tx, careerSaveId);

    for (const st of staff) {
      // Seed the live wage from base_salary. Leaving it at the column default
      // gave every new career a staff market where every hire was free — a
      // latent bug the split would otherwise have exposed as a feature.
      tx.insert(careerStaffStateTable).values({
        careerSaveId, staffId: st.id,
        salary: Number(staffRefs.get(st.id)?.base_salary ?? staffRefs.get(st.id)?.salary ?? 0),
      }).onConflictDoNothing().run();
    }
  });
}
