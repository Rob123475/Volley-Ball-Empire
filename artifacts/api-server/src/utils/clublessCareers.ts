/**
 * R-60 — no career save is ever left without a club.
 *
 * Before R-60, resigning or breaking a contract set a save's team_id to null and
 * left the manager "unemployed", waiting for a Job Market that was invented
 * (R-43 deleted it). Such a save cannot be loaded (POST /careers/:id/load refuses
 * a save with no team) and has nothing to play. Resigning now ends the career, so
 * any save an older build left like that is finished here, at boot, the same
 * way: marked retired. Its resignation or contract-break history entry was
 * written at the time. It is not archived to the Hall of Fame — that archive is
 * built from the club's record, and the link to the club was cleared.
 *
 * Safe on every boot: a save with a club, or one already finished, is untouched.
 */
import { db, careerSavesTable } from "@workspace/db";
import { and, isNull } from "drizzle-orm";

export function finishClublessCareers(): { finished: number } {
  const result = db.update(careerSavesTable)
    .set({ retiredAt: new Date() })
    .where(and(isNull(careerSavesTable.teamId), isNull(careerSavesTable.retiredAt)))
    .run();
  return { finished: Number(result.changes ?? 0) };
}
