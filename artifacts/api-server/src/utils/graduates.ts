/**
 * Graduates: the players a club has brought out of its own academy.
 *
 * ── Rob's rule (22 Sep, final) ──────────────────────────────────────────────
 * "Max 4 graduates held per club." A club may develop as many youth players as
 * its academy holds, but it cannot hoard the ones it promotes: past four, the
 * surplus goes back to the pool at the season boundary, where any club can
 * sign them.
 *
 * ── What this fixes ─────────────────────────────────────────────────────────
 * Nothing capped promotion. A signing is refused past MAX_SENIORS (three: two
 * on the sand and one interchange), but the rollover's own promotion and the
 * Team page's role change both wrote straight past it — so a long career piled
 * graduates up on its own books for ever. The thirty-season run (L-01) finished
 * with a squad of 23, all of them paid every week, which is most of why a club
 * that never signed anybody still went broke.
 *
 * ── Who goes ────────────────────────────────────────────────────────────────
 * The weakest first, by the same overall rating every screen shows. A club
 * keeps its best four; the rest are released with their contracts closed, so
 * they are free agents the moment the season opens and can be signed by anyone
 * — including the club that let them go.
 */
import { playersTable, careerPlayerStateTable, contractsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import type { CareerStateTx } from "../lib/playerDto.js";
import { GRADUATE_CAP } from "./squadRules.js";
import { overallRating } from "./overallRating.js";

export type ReleasedGraduate = { playerId: number; name: string; overall: number };

/**
 * Every player this career promoted out of THIS club's academy and still holds.
 *
 * "Promoted out of the academy" is `players.player_type = 'youth'` with this
 * career's `is_promoted` set — the same pair utils/playerClassification.ts uses
 * to tell a first-team player from an academy one. A player signed from the
 * market is not a graduate, however young: nobody developed her here.
 */
export function clubGraduatesTx(
  w: CareerStateTx, careerSaveId: number, teamId: number,
): Array<{ playerId: number; name: string; overall: number }> {
  return w.tx.select({
    playerId: careerPlayerStateTable.playerId,
    name:     playersTable.name,
    speed:    careerPlayerStateTable.speed,
    power:    careerPlayerStateTable.power,
    defense:  careerPlayerStateTable.defense,
    serve:    careerPlayerStateTable.serve,
    block:    careerPlayerStateTable.block,
    stamina:  careerPlayerStateTable.stamina,
  })
    .from(careerPlayerStateTable)
    .innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
    .where(and(
      eq(careerPlayerStateTable.careerSaveId, careerSaveId),
      eq(careerPlayerStateTable.teamId, teamId),
      eq(careerPlayerStateTable.isRetired, false),
      eq(playersTable.playerType, "youth"),
      eq(careerPlayerStateTable.isPromoted, true),
    ))
    .all()
    .map((r) => ({ playerId: r.playerId, name: r.name, overall: overallRating(r) }));
}

/**
 * Release whatever a club holds over the cap, weakest first.
 *
 * Runs at the season boundary, after that boundary's promotions, so the count
 * is what the club is actually carrying into the new season.
 */
export function releaseSurplusGraduatesTx(
  w: CareerStateTx, careerSaveId: number, teamId: number,
): ReleasedGraduate[] {
  const held = clubGraduatesTx(w, careerSaveId, teamId);
  if (held.length <= GRADUATE_CAP) return [];

  const surplus = [...held].sort((a, b) => a.overall - b.overall).slice(0, held.length - GRADUATE_CAP);
  for (const g of surplus) {
    // Back to the pool: no club, no squad place, no contract. The contract row
    // is closed rather than left active, for the reason retirement closes one
    // (L-02b) — an open row on a player who has left is a renewal the club is
    // offered and refused.
    w.setPlayerState(careerSaveId, g.playerId, {
      teamId: null,
      isActive: false,
      squadRole: "reserve",
      contractEndDate: null,
    });
    w.tx.update(contractsTable)
      .set({ status: "terminated" })
      .where(and(
        eq(contractsTable.playerId, g.playerId),
        eq(contractsTable.teamId, teamId),
        eq(contractsTable.status, "active"),
      ))
      .run();
  }
  return surplus;
}
