/**
 * R-67 — staff salaries are MONTHLY figures.
 *
 * Every reader has always treated them that way: the staff page shows "/mo",
 * a hire costs one month up front, the termination fee is months remaining x
 * the monthly salary, the Finances wage bill is monthly, and the weekly wage run
 * drips it at salary / (52/12) like a player's. But the 118 staff the content
 * scripts seeded were written with ANNUAL figures (a Head Coach at 145,000),
 * so a hire took a year's salary as its "first month" — a new underdog club's
 * $150,000 became $5,000 on its first signing.
 *
 * The starter DB now carries monthly figures, and ensureReferenceData() (R-33)
 * brings base_salary forward in every existing save. What it cannot touch is
 * each career's live wage, career_staff_state.salary, copied from the old annual
 * base_salary when the career began. This finds those copies — a live wage
 * within a rounding step of 12 x the monthly base (the conversion was
 * round(annual / 12), so at most 6 away) — and sets them to the monthly base.
 * No game path gives a staff member a raise, so nothing else can be 12 x base.
 *
 * Runs after ensureReferenceData(); idempotent — a repaired wage equals base.
 */
import { careerStaffStateTable, staffTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { withCareerStateTx } from "../lib/playerDto.js";

export function repairStaffSalaryUnits(): { repaired: number } {
  return withCareerStateTx(({ tx, setStaffState }) => {
    const rows = tx.select({
      careerSaveId: careerStaffStateTable.careerSaveId,
      staffId:      careerStaffStateTable.staffId,
      salary:       careerStaffStateTable.salary,
      base:         staffTable.baseSalary,
    })
      .from(careerStaffStateTable)
      .innerJoin(staffTable, eq(staffTable.id, careerStaffStateTable.staffId))
      .all();

    let repaired = 0;
    for (const r of rows) {
      const base = Number(r.base);
      const live = Number(r.salary);
      if (base > 0 && Math.abs(live - base * 12) <= 6) {
        setStaffState(r.careerSaveId, r.staffId, { salary: base });
        repaired++;
      }
    }
    return { repaired };
  });
}
