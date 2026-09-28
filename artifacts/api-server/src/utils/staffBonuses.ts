/**
 * P-09 — what hired staff add, in one place.
 *
 * These formulas lived inline where they were used, each finding its staff
 * member by comparing the stored role to a snake_case key. The rows store
 * "Head Coach" and "Promotional Manager", so none of them ever found anyone and
 * no hired coach, trainer or promotions manager did anything. They now find
 * staff through the shared normaliser, and live here so the places that pay a
 * bonus and the harness that proves it read the same numbers.
 *
 * Each bonus scales with the member's skill above 50, reaching its maximum at
 * 95. No member of that role on the staff: no bonus.
 */
import { isRole, type StaffRoleKey } from "@workspace/db";

type Member = { role: string; skillLevel: number };

function best(staff: readonly Member[], key: StaffRoleKey): Member | undefined {
  return staff
    .filter((s) => isRole(s.role, key))
    .sort((a, b) => b.skillLevel - a.skillLevel)[0];
}

const above50 = (m: Member | undefined) => (m ? Math.max(0, m.skillLevel - 50) : 0);

/**
 * Training: the head coach (up to +15%) and assistant coach (up to +8%)
 * multiply session XP; the fitness trainer takes up to 5 points off the
 * fatigue a session adds.
 */
export function trainingStaffBonuses(staff: readonly Member[]): { xpMultiplier: number; fatigueReduction: number } {
  const head      = best(staff, "head_coach");
  const assistant = best(staff, "assistant_coach");
  const trainer   = best(staff, "fitness_trainer");
  return {
    xpMultiplier:     (head ? 1 + above50(head) * (0.15 / 45) : 1) * (assistant ? 1 + above50(assistant) * (0.08 / 45) : 1),
    fatigueReduction: trainer ? above50(trainer) * (5 / 45) : 0,
  };
}

/**
 * Sponsorship: the promotions manager adds up to +18% to every sponsorship
 * payment while employed — weekly commercial income, contract signing bonuses
 * and monthly contract payments — as the Staff page promises.
 */
export function promotionsMultiplier(staff: readonly Member[]): number {
  const manager = best(staff, "promotions_manager");
  return manager ? 1 + above50(manager) * (0.18 / 45) : 1;
}
