import { db, playersTable, careerPlayerStateTable, staffTable, careerStaffStateTable } from "@workspace/db";
import type { CareerPlayerState, CareerStaffState } from "@workspace/db";
import { and, eq, isNull, isNotNull, type SQL } from "drizzle-orm";

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
  trainingPoints: number;
  trainingFocus: string | null;
  focusXp: number;
  scoutedPotential: string | null;
  discoveredBy: string | null;
  isRetired: boolean;
  retiredSeasonYear: number | null;
  careerWins: number;
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
    trainingPoints:       state.trainingPoints,
    trainingFocus:        state.trainingFocus,
    focusXp:              state.focusXp,
    scoutedPotential:     state.scoutedPotential,
    discoveredBy:         state.discoveredBy,
    isRetired:            state.isRetired,
    retiredSeasonYear:    state.retiredSeasonYear,
    careerWins:           state.careerWins,
    isDraftPlayer:        state.isDraftPlayer,
    outfitId:             state.outfitId,
  };
}

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
