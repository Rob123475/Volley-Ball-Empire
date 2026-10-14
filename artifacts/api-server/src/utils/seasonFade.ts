/**
 * Update 1, overnight brief part 4 (Rob, 14 Oct, B-2): at each season's end,
 * after everyone has aged, every player's fading stats lose points, by the age
 * table in lib/db/src/schema/ageing.ts (her peak shift moves her ages; a
 * workEthic of 80 or more halves the loss). Every player at every club, the
 * AI clubs' and the free agents included; never below 1. Staff and medical
 * never change.
 *
 * Update 1, 15 Oct (O-4): an AI club's original (a continental pool player)
 * ages and retires like everyone now (the U-6 exception is gone).
 */
import { careerPlayerStateTable, playersTable, seasonFade, type AgeingStat } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import type { CareerStateTx } from "../lib/playerDto.js";

const STATS: readonly AgeingStat[] = ["speed", "power", "stamina", "defense", "serve", "block"];

/** Returns how many players lost at least one point. */
export function fadeAgedPlayersTx(w: CareerStateTx, careerSaveId: number, random: () => number = Math.random): number {
  const rows = w.tx.select({
    id: careerPlayerStateTable.playerId, age: careerPlayerStateTable.age, development: playersTable.development,
    speed: careerPlayerStateTable.speed, power: careerPlayerStateTable.power, stamina: careerPlayerStateTable.stamina,
    defense: careerPlayerStateTable.defense, serve: careerPlayerStateTable.serve, block: careerPlayerStateTable.block,
  }).from(careerPlayerStateTable)
    .innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
    .where(and(eq(careerPlayerStateTable.careerSaveId, careerSaveId), eq(careerPlayerStateTable.isRetired, false)))
    .all();
  let faded = 0;
  for (const p of rows) {
    const patch: Partial<Record<AgeingStat, number>> = {};
    for (const stat of STATS) {
      const loss = seasonFade(stat, p.age, p.development, random);
      if (loss > 0 && p[stat] > 1) patch[stat] = Math.max(1, p[stat] - loss);
    }
    if (Object.keys(patch).length > 0) { w.setPlayerState(careerSaveId, p.id, patch); faded++; }
  }
  return faded;
}
