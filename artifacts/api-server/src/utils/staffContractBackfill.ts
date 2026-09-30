/**
 * Overnight brief 30 Sep, item 33b: every staff and medical hire is on a
 * contract of one of Rob's three lengths, with an end the calendar acts on
 * (4-week warning, renew, or she leaves and the place frees up). A hire from
 * an older save with no end date gets one at boot: the end of the current
 * season (a "1 season" contract from today, utils/seasonDates.ts). Idempotent:
 * it only touches hires with no end date.
 */
import { db, careerStaffStateTable } from "@workspace/db";
import { and, isNotNull, isNull } from "drizzle-orm";
import { staffContractPatch } from "./seasonDates.js";
import { getGameDate } from "./gameDate.js";
import { updateStaffState } from "../lib/playerDto.js";

export async function giveOpenStaffContractsAnEnd(): Promise<Array<{ staffId: number; ends: string }>> {
  const open = await db
    .select({ careerSaveId: careerStaffStateTable.careerSaveId, staffId: careerStaffStateTable.staffId, teamId: careerStaffStateTable.teamId })
    .from(careerStaffStateTable)
    .where(and(isNotNull(careerStaffStateTable.teamId), isNull(careerStaffStateTable.contractEndDate)));
  const done: Array<{ staffId: number; ends: string }> = [];
  for (const row of open) {
    const today = await getGameDate(row.teamId!);
    const patch = await staffContractPatch(row.careerSaveId, "1s", today);
    await updateStaffState(row.careerSaveId, row.staffId, patch);
    done.push({ staffId: row.staffId, ends: patch.contractEndDate });
  }
  return done;
}
