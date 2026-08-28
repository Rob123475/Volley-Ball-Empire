import { db, playersTable, careerPlayerStateTable, staffTable, careerStaffStateTable,
  continentalPoolTeamsTable, careerPoolTeamStateTable,
  regionalLeagueSeasonsTable, regionalLeagueFixturesTable,
  regionalLeagueResultsTable } from "@workspace/db";
import type { CareerPlayerState, CareerStaffState, CareerPoolTeamState } from "@workspace/db";
import { and, eq, gte, isNull, isNotNull, sql, type SQL } from "drizzle-orm";

/**
 * The single place a player is assembled from its two halves.
 *
 * `players` is immutable reference data; everything a career changes lives in
 * `career_player_state`. The API must keep returning ONE merged object —
 * `player.salary`, `player.age` — or every consumer and the whole frontend
 * would have to change.
 *
 * That merge is the one place TypeScript cannot protect us: a hand-assembled
 * DTO that forgets a field still compiles and silently serves base data or
 * undefined, which the frontend renders. So the career-state fields are
 * REQUIRED on PlayerDTO and there is exactly one assembler. An endpoint that
 * builds a response without the merge fails to compile rather than lying.
 */

export type PlayerReference = typeof playersTable.$inferSelect;

/** Career-scoped fields. All required — that requirement is the safety net. */
export type CareerPlayerFields = {
  teamId: number | null;
  squadRole: string;
  isActive: boolean;
  salary: number;
  contractEndDate: string | null;
  academyContractYears: number | null;
  age: number;
  fitness: number;
  fatigue: number;
  morale: number;
  injuryStatus: string;
  injuryWeeksRemaining: number;
  isInjured: boolean;
  consecutiveMatchesPlayed: number;
  speed: number;
  power: number;
  defense: number;
  serve: number;
  block: number;
  stamina: number;
  trainingPoints: number;
  trainingFocus: string | null;
  focusXp: number;
  scoutedPotential: string | null;
  discoveredBy: string | null;
  isRetired: boolean;
  retiredSeasonYear: number | null;
  careerWins: number;
  careerSeasons: number;
  careerTitles: number;
  continentalTitles: number;
  worldTitles: number;
  olympicMedalsCount: number;
  peakOverallRating: number;
  yearsActive: string | null;
  legendScore: number;
  isDraftPlayer: boolean;
  outfitId: number | null;
};

/**
 * What every endpoint returns and every consumer reads.
 *
 * The intersection is deliberate and transition-safe: while a column still
 * exists on `players` it appears in both halves with the same type, and once it
 * is dropped only CareerPlayerFields supplies it. Either way the field stays
 * REQUIRED, so a response assembled without the merge does not compile.
 */
export type PlayerDTO = PlayerReference & CareerPlayerFields;

export function assemblePlayer(
  reference: PlayerReference,
  state: CareerPlayerState,
): PlayerDTO {
  return {
    ...reference,
    teamId:               state.teamId,
    squadRole:            state.squadRole,
    isActive:             state.isActive,
    salary:               Number(state.salary),
    contractEndDate:      state.contractEndDate,
    academyContractYears: state.academyContractYears,
    age:                  state.age,
    fitness:              state.fitness,
    fatigue:              state.fatigue,
    morale:               state.morale,
    injuryStatus:         state.injuryStatus,
    injuryWeeksRemaining: state.injuryWeeksRemaining,
    isInjured:            state.isInjured,
    consecutiveMatchesPlayed: state.consecutiveMatchesPlayed,
    speed:                state.speed,
    power:                state.power,
    defense:              state.defense,
    serve:                state.serve,
    block:                state.block,
    stamina:              state.stamina,
    trainingPoints:       state.trainingPoints,
    trainingFocus:        state.trainingFocus,
    focusXp:              state.focusXp,
    scoutedPotential:     state.scoutedPotential,
    discoveredBy:         state.discoveredBy,
    isRetired:            state.isRetired,
    retiredSeasonYear:    state.retiredSeasonYear,
    careerWins:           state.careerWins,
    careerSeasons:        state.careerSeasons,
    careerTitles:         state.careerTitles,
    continentalTitles:    state.continentalTitles,
    worldTitles:          state.worldTitles,
    olympicMedalsCount:   state.olympicMedalsCount,
    peakOverallRating:    state.peakOverallRating,
    yearsActive:          state.yearsActive,
    legendScore:          state.legendScore,
    isDraftPlayer:        state.isDraftPlayer,
    outfitId:             state.outfitId,
  };
}

/** The six trainable stats. Typed so an update cannot target an arbitrary key. */
export type StatKey = "speed" | "power" | "defense" | "serve" | "block" | "stamina";

export type PlayerFilter = {
  /** Players signed to this team in this career. */
  teamId?: number;
  /** Free agents — the market, per career. */
  freeAgents?: boolean;
  playerType?: "senior" | "youth";
  isActive?: boolean;
  includeRetired?: boolean;
};

/**
 * The only way to read players. Always career-scoped, always merged.
 */
export async function loadPlayers(
  careerSaveId: number,
  filter: PlayerFilter = {},
): Promise<PlayerDTO[]> {
  const conds: SQL[] = [eq(careerPlayerStateTable.careerSaveId, careerSaveId)];

  if (filter.teamId != null)   conds.push(eq(careerPlayerStateTable.teamId, filter.teamId));
  if (filter.freeAgents)       conds.push(isNull(careerPlayerStateTable.teamId));
  if (filter.isActive != null) conds.push(eq(careerPlayerStateTable.isActive, filter.isActive));
  if (filter.playerType)       conds.push(eq(playersTable.playerType, filter.playerType));
  if (!filter.includeRetired)  conds.push(eq(careerPlayerStateTable.isRetired, false));

  const rows = await db
    .select({ reference: playersTable, state: careerPlayerStateTable })
    .from(careerPlayerStateTable)
    .innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
    .where(and(...conds));

  return rows.map((r) => assemblePlayer(r.reference, r.state));
}

/** One player, career-scoped. Null when the career has no state for them. */
export async function loadPlayer(
  careerSaveId: number,
  playerId: number,
): Promise<PlayerDTO | null> {
  const [row] = await db
    .select({ reference: playersTable, state: careerPlayerStateTable })
    .from(careerPlayerStateTable)
    .innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
    .where(and(
      eq(careerPlayerStateTable.careerSaveId, careerSaveId),
      eq(careerPlayerStateTable.playerId, playerId),
    ))
    .limit(1);
  return row ? assemblePlayer(row.reference, row.state) : null;
}

/** Update a player's career state. The only write path. */
export async function updatePlayerState(
  careerSaveId: number,
  playerId: number,
  patch: Partial<CareerPlayerFields>,
): Promise<void> {
  await db.update(careerPlayerStateTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(
      eq(careerPlayerStateTable.careerSaveId, careerSaveId),
      eq(careerPlayerStateTable.playerId, playerId),
    ));
}

/**
 * Bulk career-state update across a team, for the weekly condition pass.
 * A per-player loop would be 12+ round trips a week for no benefit, so this is
 * the sanctioned bulk path — still career-scoped, still typed.
 */
export async function updateTeamPlayerState(
  careerSaveId: number,
  teamId: number,
  patch: Partial<CareerPlayerFields> | Record<string, SQL>,
  extra?: SQL,
): Promise<void> {
  const conds: SQL[] = [
    eq(careerPlayerStateTable.careerSaveId, careerSaveId),
    eq(careerPlayerStateTable.teamId, teamId),
  ];
  if (extra) conds.push(extra);
  await db.update(careerPlayerStateTable)
    .set({ ...(patch as Partial<CareerPlayerFields>), updatedAt: new Date() })
    .where(and(...conds));
}

/**
 * The ONLY sanctioned write to the athlete reference row.
 *
 * Reference fields are what a player starts with — name, portrait, base stats,
 * nationality, position, potential. Anything a player ACHIEVES belongs in
 * career state and must go through updatePlayerState instead. Keeping both
 * behind typed functions is what makes `any` and `as` harmless: there is no
 * untyped path to a raw write left to exploit.
 */
export type PlayerReferenceFields = Partial<Pick<PlayerReference,
  "name" | "nationality" | "position" | "height" | "imageUrl" |
  "continent" | "potential" | "askingPrice" | "eliteEventType" | "development"
>>;

export async function updatePlayerReference(
  playerId: number,
  patch: PlayerReferenceFields,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await db.update(playersTable).set(patch).where(eq(playersTable.id, playerId));
}

/**
 * Create a new athlete: the immutable reference row AND this career's state for
 * them. Both halves or neither — a reference row with no state is invisible to
 * every career, and state without a reference cannot be joined.
 */
export async function createCareerPlayer(
  careerSaveId: number,
  reference: typeof playersTable.$inferInsert,
  state: Partial<CareerPlayerFields> & { age: number },
): Promise<PlayerDTO> {
  const [created] = await db.insert(playersTable).values(reference).returning();
  const [st] = await db.insert(careerPlayerStateTable)
    .values({ careerSaveId, playerId: created!.id, ...state })
    .returning();
  return assemblePlayer(created!, st!);
}

// ── Staff, same shape ────────────────────────────────────────────────────────

export type StaffReference = typeof staffTable.$inferSelect;

export type CareerStaffFields = {
  teamId: number | null;
  salary: number;
  isAvailable: boolean;
  contractLength: number;
  isScoutRevealed: boolean;
};

export type StaffDTO = StaffReference & CareerStaffFields;

export function assembleStaff(reference: StaffReference, state: CareerStaffState): StaffDTO {
  return {
    ...reference,
    teamId:          state.teamId,
    salary:          Number(state.salary),
    isAvailable:     state.isAvailable,
    contractLength:  state.contractLength,
    isScoutRevealed: state.isScoutRevealed,
  };
}

export async function loadStaff(
  careerSaveId: number,
  filter: { teamId?: number; unhired?: boolean } = {},
): Promise<StaffDTO[]> {
  const conds: SQL[] = [eq(careerStaffStateTable.careerSaveId, careerSaveId)];
  if (filter.teamId != null) conds.push(eq(careerStaffStateTable.teamId, filter.teamId));
  if (filter.unhired)        conds.push(isNull(careerStaffStateTable.teamId));

  const rows = await db
    .select({ reference: staffTable, state: careerStaffStateTable })
    .from(careerStaffStateTable)
    .innerJoin(staffTable, eq(staffTable.id, careerStaffStateTable.staffId))
    .where(and(...conds));

  return rows.map((r) => assembleStaff(r.reference, r.state));
}

/** One staff member, career-scoped. Null when this career has no state row. */
export async function loadStaffMember(
  careerSaveId: number,
  staffId: number,
): Promise<StaffDTO | null> {
  const [row] = await db
    .select({ reference: staffTable, state: careerStaffStateTable })
    .from(careerStaffStateTable)
    .innerJoin(staffTable, eq(staffTable.id, careerStaffStateTable.staffId))
    .where(and(
      eq(careerStaffStateTable.careerSaveId, careerSaveId),
      eq(careerStaffStateTable.staffId, staffId),
    ))
    .limit(1);
  return row ? assembleStaff(row.reference, row.state) : null;
}

export async function updateStaffState(
  careerSaveId: number,
  staffId: number,
  patch: Partial<CareerStaffFields>,
): Promise<void> {
  await db.update(careerStaffStateTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(
      eq(careerStaffStateTable.careerSaveId, careerSaveId),
      eq(careerStaffStateTable.staffId, staffId),
    ));
}

/**
 * The ONLY sanctioned write to the staff reference row. Same rule as players:
 * these are the fields a staff member IS, not what a career has done with them.
 */
export type StaffReferenceFields = Partial<Pick<StaffReference,
  "name" | "nationality" | "role" | "specialty" | "imageUrl" | "personality" |
  "attributes" | "specialTrait" | "coachSpeciality" | "skillLevel" |
  "overallRating" | "scoutingRating" | "baseSalary" | "baseAge"
>>;

export async function updateStaffReference(
  staffId: number,
  patch: StaffReferenceFields,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await db.update(staffTable).set(patch).where(eq(staffTable.id, staffId));
}

/**
 * Create a staff member: reference row AND this career's state for them.
 *
 * The live wage is seeded from baseSalary. Getting that wrong is not a visible
 * error — it is a market where every hire is free — so it is done here rather
 * than left to each caller.
 */
export async function createCareerStaff(
  careerSaveId: number,
  reference: typeof staffTable.$inferInsert,
  state: Partial<CareerStaffFields> = {},
): Promise<StaffDTO> {
  const [created] = await db.insert(staffTable).values(reference).returning();
  const [st] = await db.insert(careerStaffStateTable)
    .values({
      careerSaveId,
      staffId: created!.id,
      salary: Number(created!.baseSalary),
      ...state,
    })
    .returning();
  return assembleStaff(created!, st!);
}

/**
 * Run a synchronous transaction that needs to write career state alongside
 * other tables — hiring a staff member moves money and assigns the staff in one
 * atomic step, and splitting those leaves a window where the budget is spent
 * and the hire never happened.
 *
 * The raw career-state write stays inside this file; the caller gets a typed
 * setter plus the transaction handle for everything else. That keeps the write
 * boundary intact instead of exempting each route that needs a transaction.
 */
export type CareerStateTx = {
  setStaffState(careerSaveId: number, staffId: number, patch: Partial<CareerStaffFields>): void;
  setPlayerState(careerSaveId: number, playerId: number, patch: Partial<CareerPlayerFields>): void;
  setPoolTeamState(careerSaveId: number, poolTeamId: number, patch: Partial<CareerPoolTeamFields>): void;
  /**
   * League rollover creates next season and its fixtures in the SAME
   * transaction as the promotion/relegation that decides who is in it, so these
   * live here rather than in regionalLeague.ts — splitting them would leave a
   * window with a promoted club and no season to play in.
   */
  insertLeagueSeason(careerSaveId: number, values: {
    seasonYear: number; continent: string; teamIds: number[]; status: string;
  }): number;
  insertLeagueFixtures(careerSaveId: number, seasonId: number, rows: Array<{
    round: number; homePoolTeamId: number; awayPoolTeamId: number; status: string;
  }>): void;
  setLeagueSeasonStatus(careerSaveId: number, seasonId: number, status: string): void;
  /**
   * Age every living athlete in this career by a year, at the season boundary.
   * A bulk pass rather than 268 round trips, and career-scoped: a player who is
   * 24 in one save and 27 in another is correct, not a bug.
   */
  ageAllPlayers(careerSaveId: number): number;
  /**
   * Retire everyone at or past the age threshold, returning who went. They also
   * leave their club, so the squad slot is free for the youth promotion that
   * follows in the same boundary.
   */
  retireAgedPlayers(careerSaveId: number, minAge: number, seasonYear: number): Array<{
    playerId: number; teamId: number | null; age: number;
  }>;
  insertLeagueResult(careerSaveId: number, values: {
    fixtureId: number; winnerId: number | null;
    homeSets: number; awaySets: number;
    homeMatchPoints: number; awayMatchPoints: number;
  }): void;
  setFixtureResult(careerSaveId: number, fixtureId: number, patch: {
    status: string; homeScore: number; awayScore: number;
  }): void;
  /** For non-career-state tables in the same transaction (teams, finance, ...). */
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0];
};

export function withCareerStateTx<T>(fn: (w: CareerStateTx) => T): T {
  return db.transaction((tx) => fn({
    tx,
    setStaffState(careerSaveId, staffId, patch) {
      tx.update(careerStaffStateTable)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(
          eq(careerStaffStateTable.careerSaveId, careerSaveId),
          eq(careerStaffStateTable.staffId, staffId),
        ))
        .run();
    },
    setPlayerState(careerSaveId, playerId, patch) {
      tx.update(careerPlayerStateTable)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(
          eq(careerPlayerStateTable.careerSaveId, careerSaveId),
          eq(careerPlayerStateTable.playerId, playerId),
        ))
        .run();
    },
    setPoolTeamState(careerSaveId, poolTeamId, patch) {
      tx.update(careerPoolTeamStateTable)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(
          eq(careerPoolTeamStateTable.careerSaveId, careerSaveId),
          eq(careerPoolTeamStateTable.poolTeamId, poolTeamId),
        ))
        .run();
    },
    insertLeagueSeason(careerSaveId, values) {
      const [created] = tx.insert(regionalLeagueSeasonsTable)
        .values({ ...values, careerSaveId })
        .returning()
        .all();
      return created!.id;
    },
    insertLeagueFixtures(careerSaveId, seasonId, rows) {
      if (rows.length === 0) return;
      tx.insert(regionalLeagueFixturesTable)
        .values(rows.map((r) => ({ ...r, careerSaveId, regionalLeagueSeasonId: seasonId })))
        .run();
    },
    setLeagueSeasonStatus(careerSaveId, seasonId, status) {
      tx.update(regionalLeagueSeasonsTable)
        .set({ status })
        .where(and(
          eq(regionalLeagueSeasonsTable.careerSaveId, careerSaveId),
          eq(regionalLeagueSeasonsTable.id, seasonId),
        ))
        .run();
    },
    ageAllPlayers(careerSaveId) {
      const r = tx.update(careerPlayerStateTable)
        .set({ age: sql`${careerPlayerStateTable.age} + 1`, updatedAt: new Date() })
        .where(and(
          eq(careerPlayerStateTable.careerSaveId, careerSaveId),
          eq(careerPlayerStateTable.isRetired, false),
        ))
        .run();
      return Number((r as { changes?: number }).changes ?? 0);
    },
    retireAgedPlayers(careerSaveId, minAge, seasonYear) {
      const going = tx.select({
        playerId: careerPlayerStateTable.playerId,
        teamId:   careerPlayerStateTable.teamId,
        age:      careerPlayerStateTable.age,
      })
        .from(careerPlayerStateTable)
        .where(and(
          eq(careerPlayerStateTable.careerSaveId, careerSaveId),
          eq(careerPlayerStateTable.isRetired, false),
          gte(careerPlayerStateTable.age, minAge),
        ))
        .all();

      if (going.length > 0) {
        tx.update(careerPlayerStateTable)
          .set({
            isRetired: true,
            retiredSeasonYear: seasonYear,
            // Leaving the club frees the squad slot; a retired player holding a
            // roster place would quietly shrink the squad every season.
            teamId: null,
            isActive: false,
            updatedAt: new Date(),
          })
          .where(and(
            eq(careerPlayerStateTable.careerSaveId, careerSaveId),
            eq(careerPlayerStateTable.isRetired, false),
            gte(careerPlayerStateTable.age, minAge),
          ))
          .run();
      }
      return going;
    },
    insertLeagueResult(careerSaveId, values) {
      tx.insert(regionalLeagueResultsTable).values({ ...values, careerSaveId }).run();
    },
    setFixtureResult(careerSaveId, fixtureId, patch) {
      tx.update(regionalLeagueFixturesTable)
        .set(patch)
        .where(and(
          eq(regionalLeagueFixturesTable.careerSaveId, careerSaveId),
          eq(regionalLeagueFixturesTable.id, fixtureId),
        ))
        .run();
    },
  }));
}

/** How many staff this career has signed to a team. */
export async function countTeamStaff(careerSaveId: number, teamId: number): Promise<number> {
  const rows = await db
    .select({ id: careerStaffStateTable.id })
    .from(careerStaffStateTable)
    .where(and(
      eq(careerStaffStateTable.careerSaveId, careerSaveId),
      eq(careerStaffStateTable.teamId, teamId),
    ));
  return rows.length;
}

// ── AI pool clubs, same shape ────────────────────────────────────────────────

export type PoolTeamReference = typeof continentalPoolTeamsTable.$inferSelect;

export type CareerPoolTeamFields = {
  isActiveInLeague: boolean;
  promotionCount: number;
  relegationCount: number;
};

export type PoolTeamDTO = PoolTeamReference & CareerPoolTeamFields;

export function assemblePoolTeam(
  reference: PoolTeamReference,
  state: CareerPoolTeamState,
): PoolTeamDTO {
  return {
    ...reference,
    isActiveInLeague: state.isActiveInLeague,
    promotionCount:   state.promotionCount,
    relegationCount:  state.relegationCount,
  };
}

export async function loadPoolTeams(
  careerSaveId: number,
  filter: { continent?: string; activeOnly?: boolean } = {},
): Promise<PoolTeamDTO[]> {
  const conds: SQL[] = [eq(careerPoolTeamStateTable.careerSaveId, careerSaveId)];
  if (filter.continent) conds.push(eq(continentalPoolTeamsTable.continent, filter.continent));
  if (filter.activeOnly) conds.push(eq(careerPoolTeamStateTable.isActiveInLeague, true));

  const rows = await db
    .select({ reference: continentalPoolTeamsTable, state: careerPoolTeamStateTable })
    .from(careerPoolTeamStateTable)
    .innerJoin(continentalPoolTeamsTable,
      eq(continentalPoolTeamsTable.id, careerPoolTeamStateTable.poolTeamId))
    .where(and(...conds));

  return rows.map((r) => assemblePoolTeam(r.reference, r.state));
}

export async function updatePoolTeamState(
  careerSaveId: number,
  poolTeamId: number,
  patch: Partial<CareerPoolTeamFields>,
): Promise<void> {
  await db.update(careerPoolTeamStateTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(
      eq(careerPoolTeamStateTable.careerSaveId, careerSaveId),
      eq(careerPoolTeamStateTable.poolTeamId, poolTeamId),
    ));
}

/**
 * Create a pool club: reference row AND this career's state.
 *
 * The live league membership is seeded from startsInLeague. Getting that wrong
 * is not a visible error — it is a league with the wrong number of clubs in it.
 */
export async function createCareerPoolTeam(
  careerSaveId: number,
  reference: typeof continentalPoolTeamsTable.$inferInsert,
): Promise<PoolTeamDTO> {
  const [created] = await db.insert(continentalPoolTeamsTable).values(reference).returning();
  const [st] = await db.insert(careerPoolTeamStateTable)
    .values({
      careerSaveId,
      poolTeamId: created!.id,
      isActiveInLeague: created!.startsInLeague,
    })
    .returning();
  return assemblePoolTeam(created!, st!);
}

/**
 * Career id for a team, for helpers that only receive a teamId. Throws rather
 * than silently falling back to global data.
 */
export async function careerSaveIdForTeamOrThrow(teamId: number): Promise<number> {
  const { careerSaveIdForTeam } = await import("./getActiveSeason.js");
  const id = await careerSaveIdForTeam(teamId);
  if (id == null) throw new Error(`No career save owns team ${teamId}`);
  return id;
}

/** Guard for code paths that must have a career context. */
export function requireCareerSaveId(id: number | undefined): number {
  if (id == null) {
    throw new Error(
      "No active career. Player and staff state is career-scoped — " +
      "this code path needs req.activeCareerSaveId.",
    );
  }
  return id;
}

export { isNotNull };
