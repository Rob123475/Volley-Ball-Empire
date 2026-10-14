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
import { isRole, staffOnDuty, type StaffRoleKey } from "@workspace/db";

type Member = { role: string; skillLevel: number; offDaysLeft?: number | null };

// Final brief 5 Oct, Part B: a member off ill or hurt gives no bonus.
function best(staff: readonly Member[], key: StaffRoleKey): Member | undefined {
  return staff
    .filter((s) => isRole(s.role, key) && staffOnDuty(s))
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

/**
 * Update 1, 15 Oct (O-3): the medical department, for every club (the
 * player's and the AI clubs', whose medics come from the Day 8 deal).
 *
 * Healing: each week an injured player may get an extra week off; the chance
 * is the best healer's skill / 250 (skill 95: 38%). The healers are the fitness
 * trainer, strength coach, massage therapist, physiotherapist and, since O-3,
 * the doctor. They don't stack: the best one on duty counts, as before. Used by
 * the weekly recovery (utils/condition.ts) and the Recovery Program
 * (routes/training.ts).
 *
 * Prevention: the medical specialist takes up to 15% off a match's injury risk
 * at skill 95 (skill above 50, like the other bonuses here), in the one
 * injuryRisk (utils/condition.ts).
 */
export const MEDICAL_BONUS = {
  healerKeys: ["fitness_trainer", "strength_conditioner", "massage_therapist", "physiotherapist", "doctor"] as readonly StaffRoleKey[],
  healChanceDivisor: 250,
  specialistMaxRiskCut: 0.15,
} as const;

/** The weekly chance of an extra week off, and who gives it (the best healer on duty). */
export function healingBonus<M extends Member & { name?: string }>(staff: readonly M[]): { chance: number; healer: M | undefined } {
  const healer = staff
    .filter((s) => MEDICAL_BONUS.healerKeys.some((k) => isRole(s.role, k)) && staffOnDuty(s))
    .sort((a, b) => b.skillLevel - a.skillLevel)[0];
  return { chance: healer ? healer.skillLevel / MEDICAL_BONUS.healChanceDivisor : 0, healer };
}

/** The medical specialist's factor on a match's injury risk: 1 to 0.85. */
export function injuryRiskStaffFactor(staff: readonly Member[]): number {
  const specialist = best(staff, "medical_specialist");
  return specialist ? 1 - above50(specialist) * (MEDICAL_BONUS.specialistMaxRiskCut / 45) : 1;
}
