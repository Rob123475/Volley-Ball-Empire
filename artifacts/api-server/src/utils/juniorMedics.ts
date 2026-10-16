/**
 * 1.1.1 (Rob, 17 Oct): junior medics (JUNIOR_MEDICS, JUNIOR_PROMOTION in lib/db
 * schema/staff-roles.ts).
 *
 * A Registrar (a Doctor) or a Physio Assistant (a Physiotherapist) at a club is
 * promoted to the full role on a fixed day between one and three years after
 * joining it (her contract's start there; a move to another club starts the
 * clock again): her title becomes her role's, her skill rises by the grade's
 * `skillGain`, and her wage rises to the full role's wage for her new skill
 * (the line the role's own staff follow), from that day. Staff she already
 * had keep their jobs if that takes the club over its staff budget (SB-4).
 * The same for AI clubs. Promotion is this career's: the staff table keeps her
 * as she was, so another career starts her as a junior again.
 */
import { staffTable, careerStaffStateTable, JUNIOR_MEDICS, JUNIOR_PROMOTION } from "@workspace/db";
import { and, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import type { CareerStateTx } from "../lib/playerDto.js";

type Tx = CareerStateTx["tx"];
type Grade = { label: string; of: string; promotes: boolean; skillGain: number };
const GRADES = JUNIOR_MEDICS as unknown as Record<string, Grade>;

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Her promotion day at a club she joined on `joined`: fixed per person, between one and three years on. */
export function promotionDayFor(staffId: number, joined: string): string {
  const lo = JUNIOR_PROMOTION.promoteAfterYears * 365, hi = JUNIOR_PROMOTION.promoteWithinYears * 365;
  let h = 0x811c9dc5;
  for (const ch of `${staffId}:junior-promotion`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return addDays(joined, lo + (h % (hi - lo + 1)));
}

/** The full role's wage for a skill: straight between its own staff (juniors left out), flat past the ends. */
function roleWageTx(tx: Tx, role: string, skill: number): number {
  const rows = tx.select({ s: staffTable.skillLevel, w: staffTable.baseSalary }).from(staffTable)
    .where(and(eq(staffTable.role, role), isNull(staffTable.grade))).all().sort((a, b) => a.s - b.s);
  if (rows.length === 0) return 0;
  if (skill <= rows[0]!.s) return Math.round(Number(rows[0]!.w));
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1]!, b = rows[i]!;
    if (skill <= b.s) return Math.round(Number(a.w) + ((Number(b.w) - Number(a.w)) * (skill - a.s)) / Math.max(1, b.s - a.s));
  }
  return Math.round(Number(rows[rows.length - 1]!.w));
}

export type Promotion = { staffId: number; name: string; title: string; role: string; skill: number; wage: number; teamId: number | null; poolTeamId: number | null };

/** The day's promotions, at every club (the player's and the AI clubs'). */
export function juniorPromotionsDayTx(w: CareerStateTx, careerSaveId: number, today: string): Promotion[] {
  const promoting = Object.entries(GRADES).filter(([, g]) => g.promotes).map(([k]) => k);
  const rows = w.tx.select({ ref: staffTable, st: careerStaffStateTable }).from(careerStaffStateTable)
    .innerJoin(staffTable, eq(staffTable.id, careerStaffStateTable.staffId))
    .where(and(
      eq(careerStaffStateTable.careerSaveId, careerSaveId),
      inArray(staffTable.grade, promoting),
      isNull(careerStaffStateTable.careerGrade),
      isNotNull(careerStaffStateTable.contractStartDate),
      or(isNotNull(careerStaffStateTable.teamId), isNotNull(careerStaffStateTable.poolTeamId)),
    )).all();
  const out: Promotion[] = [];
  for (const { ref, st } of rows) {
    if (promotionDayFor(ref.id, st.contractStartDate!) > today) continue;
    const g = GRADES[ref.grade!]!;
    const skill = Math.min(99, ref.skillLevel + g.skillGain);
    const wage = Math.max(Number(st.salary), roleWageTx(w.tx, ref.role, skill));
    w.setStaffState(careerSaveId, ref.id, { careerGrade: "promoted", careerSkill: skill, promotedOn: today, salary: wage });
    out.push({ staffId: ref.id, name: ref.name, title: g.label, role: ref.role, skill, wage, teamId: st.teamId, poolTeamId: st.poolTeamId ?? null });
  }
  return out;
}
