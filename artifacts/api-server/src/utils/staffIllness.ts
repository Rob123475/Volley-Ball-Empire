/**
 * Final brief 5 Oct, Part B: staff and medical staff go off ill or hurt, built
 * the way the player injury system is (utils/condition.ts), with Rob's
 * differences (lib/db/src/schema/staff-illness.ts):
 *
 *   - half as often as players are injured: each game day, each member of the
 *     club's staff on duty goes off with STAFF_ABSENCE_DAILY_CHANCE;
 *   - half the time out: real-life causes, illness and accidents, each with its
 *     own number of game days (a cold 3, the flu 7, a broken leg skiing 42 ...);
 *   - while off, their bonus does not apply (every reader of a bonus takes only
 *     staff on duty, staffOnDuty); nothing else changes: they stay hired, are
 *     paid, and the club carries on;
 *   - Club News says when someone goes off and when they come back
 *     (staff_absences, routes/news.ts); the Staff and Medical pages show
 *     "Off: flu, back in 4 days".
 *
 * Who: the manager's club. AI clubs have no staff in this game (no rows exist
 * for them), so there is no one there to fall ill.
 */
import {
  careerStaffStateTable, staffTable, staffAbsencesTable,
  STAFF_ABSENCE_CAUSES, STAFF_ABSENCE_DAILY_CHANCE, staffAbsenceCause, type StaffAbsenceCause,
} from "@workspace/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { CareerStateTx } from "../lib/playerDto.js";

export type StaffAbsenceDay = {
  wentOff: Array<{ staffId: number; name: string; role: string; cause: StaffAbsenceCause }>;
  cameBack: Array<{ staffId: number; name: string; role: string }>;
};

/**
 * The harness runs its other suites with VBE_STAFF_ABSENCES=off (harness/run-all.mjs):
 * a coach going down with the flu in the middle of a suite about something else
 * would make it fail at random. Off only stops new absences; those under way
 * still count down. The game itself never sets it.
 */
const ROLLS = process.env.VBE_STAFF_ABSENCES !== "off";

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to.slice(0, 10)}T00:00:00Z`) - Date.parse(`${from.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
}

function pickCause(roll: number): StaffAbsenceCause {
  const total = STAFF_ABSENCE_CAUSES.reduce((s, c) => s + c.weight, 0);
  let at = roll * total;
  for (const c of STAFF_ABSENCE_CAUSES) { if (at < c.weight) return c; at -= c.weight; }
  return STAFF_ABSENCE_CAUSES[STAFF_ABSENCE_CAUSES.length - 1]!;
}

/**
 * One game day for the club's staff: those off count a day down (and are back
 * when it reaches 0), then each member on duty may go off. `today` is the game
 * date being played. `rng` is Math.random in the game; the harness passes its own.
 */
export function staffAbsenceDayTx(
  w: CareerStateTx, careerSaveId: number, teamId: number, today: string, rng: () => number = Math.random,
): StaffAbsenceDay {
  const { tx } = w;
  const out: StaffAbsenceDay = { wentOff: [], cameBack: [] };
  const hired = tx.select({
    staffId: careerStaffStateTable.staffId, offDaysLeft: careerStaffStateTable.offDaysLeft,
    offCause: careerStaffStateTable.offCause, offSince: careerStaffStateTable.offSince,
    name: staffTable.name, role: staffTable.role,
  }).from(careerStaffStateTable)
    .innerJoin(staffTable, eq(staffTable.id, careerStaffStateTable.staffId))
    .where(and(eq(careerStaffStateTable.careerSaveId, careerSaveId), eq(careerStaffStateTable.teamId, teamId)))
    .all();

  for (const m of hired) {
    if (m.offDaysLeft > 0) {
      // Counted on the game calendar from the day they went off, so a date the
      // calendar does not play (the season's turn) is not a day lost.
      const open = tx.select({ days: staffAbsencesTable.days }).from(staffAbsencesTable).where(and(
        eq(staffAbsencesTable.careerSaveId, careerSaveId), eq(staffAbsencesTable.staffId, m.staffId),
        isNull(staffAbsencesTable.returnedOn),
      )).orderBy(desc(staffAbsencesTable.id)).get();
      const days = open?.days ?? staffAbsenceCause(m.offCause)?.days ?? m.offDaysLeft;
      const left = m.offSince ? days - daysBetween(m.offSince, today) : m.offDaysLeft - 1;
      if (left > 0) { w.setStaffState(careerSaveId, m.staffId, { offDaysLeft: left }); continue; }
      w.setStaffState(careerSaveId, m.staffId, { offDaysLeft: 0, offCause: null, offSince: null });
      tx.update(staffAbsencesTable).set({ returnedOn: today }).where(and(
        eq(staffAbsencesTable.careerSaveId, careerSaveId), eq(staffAbsencesTable.staffId, m.staffId),
        isNull(staffAbsencesTable.returnedOn),
      )).run();
      out.cameBack.push({ staffId: m.staffId, name: m.name, role: m.role });
      continue;
    }
    if (!ROLLS || rng() >= STAFF_ABSENCE_DAILY_CHANCE) continue;
    const cause = pickCause(rng());
    w.setStaffState(careerSaveId, m.staffId, { offCause: cause.key, offSince: today, offDaysLeft: cause.days });
    tx.insert(staffAbsencesTable).values({
      careerSaveId, teamId, staffId: m.staffId, staffName: m.name, role: m.role,
      cause: cause.key, days: cause.days, startedOn: today,
    }).run();
    out.wentOff.push({ staffId: m.staffId, name: m.name, role: m.role, cause });
  }
  return out;
}
