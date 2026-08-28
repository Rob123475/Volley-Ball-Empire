// PlayerDTO, not Player: playerType is reference data but age and isRetired are
// career state, so no single table row carries all three any more. The DTO is
// the merged view and is what every caller already has.
import type { PlayerDTO } from "../lib/playerDto.js";

/**
 * Senior vs youth classification.
 *
 * `players.player_type` is the source of truth, and every other route already
 * treats it that way (players.ts, olympics.ts, draft.ts, unity.ts). finances.ts
 * was the lone exception: it inferred youth from `age 14-18 && squadRole ===
 * "reserve"`, which disagreed with the column for 9 shipped players who are
 * 19 and still in the academy. They were billed at senior tier rates on the
 * finances page — up to $4,500/week each of wage bill that does not exist.
 *
 * players.ts:170 already reports age/type mismatches as a data-integrity
 * warning, so the age range stays useful as a *validation* rule. It just must
 * not be used to decide who is a youth player.
 */
export type ClassifiablePlayer =
  Pick<PlayerDTO, "playerType" | "age" | "isRetired" | "isPromoted">;

/**
 * Academy player, in THIS career.
 *
 * players.player_type is reference data shared by every save, so a promoted
 * player keeps player_type = 'youth' forever. Promotion is career state, and
 * these two predicates are the only place the combination is interpreted.
 */
export function isYouthPlayer(p: ClassifiablePlayer): boolean {
  return p.playerType === "youth" && !p.isPromoted;
}

/**
 * Senior (first-team) player.
 *
 * This used to be `playerType !== "youth"` — an inversion, and the sharp edge
 * of the promotion change: a promoted academy player is still player_type
 * 'youth', so the negation would have reported them as NOT senior while the
 * positive test reported them as youth. Both wrong, in opposite directions.
 * Defined in terms of isYouthPlayer so the two can never disagree.
 */
export function isSeniorPlayer(p: ClassifiablePlayer): boolean {
  return !isYouthPlayer(p);
}

/** Youth players who are still on the books (not retired). */
export function isActiveYouthPlayer(p: ClassifiablePlayer): boolean {
  return isYouthPlayer(p) && !p.isRetired;
}

/** The age band a youth player is *expected* to fall in. Validation only. */
export const YOUTH_AGE_MIN = 14;
export const YOUTH_AGE_MAX = 18;
