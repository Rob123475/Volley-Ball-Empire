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
 * Update 1, night 2 (Rob, 15 Oct, O-6: "each job has its own distinct
 * advantage"): every role does its own job, by the numbers in STAFF_EFFECTS.
 * Each bonus scales with the member's skill above 50 and is full at 95; the
 * best member of the role on duty counts (one off ill or hurt gives nothing);
 * no member of the role: no bonus. For every club, the player's and the AI
 * clubs'. The pairs (O-9) add an extra on top of each one's own bonus. The
 * injury treatment the doctor, physio and medical specialist give is
 * utils/injuries.ts (the numbers are lib/db schema/injuries.ts).
 */
import { isRole, staffOnDuty, type StaffRoleKey } from "@workspace/db";

type Member = { role: string; skillLevel: number; offDaysLeft?: number | null };

/** Night 2 (O-6, O-9): what every role and every pair does, in one place. */
export const STAFF_EFFECTS = {
  /** A member helps from skill `from` and fully at `fullAt`. */
  from: 50,
  fullAt: 95,
  headCoachXp: 0.15,          // training XP, every programme
  assistantCoachXp: 0.08,     // training XP, every programme
  fitnessTrainerFatigue: 5,   // tiredness off each training session
  promotionsSponsor: 0.18,    // sponsor money
  strengthCoachXp: 0.10,      // training XP for these stats' programmes
  strengthCoachStats: ["power", "block"] as readonly string[],
  massageDailyFatigue: 5,     // more tiredness off every day, on top of the daily rest
  nutritionistXp: 0.10,       // training XP for these stats' programmes
  nutritionistStats: ["stamina"] as readonly string[],
  sportsScientistRiskCut: 0.15, // the whole squad's match injury risk
  pairs: {
    /** A Strength Coach and a Fitness Trainer: training adds this share of the tiredness. */
    strengthAndFitness: { fatigueFactor: 0.8 },
    /** A Sports Scientist and a Nutritionist ("better training techniques"): all training XP. */
    scienceAndNutrition: { xp: 0.05 },
  },
} as const;

// Final brief 5 Oct, Part B: a member off ill or hurt gives no bonus.
function best<M extends Member>(staff: readonly M[], key: StaffRoleKey): M | undefined {
  return staff
    .filter((s) => isRole(s.role, key) && staffOnDuty(s))
    .sort((a, b) => b.skillLevel - a.skillLevel)[0];
}

/** 0 at skill `from` or below, 1 at `fullAt` and above. */
export function skillScale(m: Member | undefined | null): number {
  if (!m) return 0;
  const { from, fullAt } = STAFF_EFFECTS;
  return Math.min(1, Math.max(0, (m.skillLevel - from) / (fullAt - from)));
}

const pairOn = (staff: readonly Member[], a: StaffRoleKey, b: StaffRoleKey) => !!best(staff, a) && !!best(staff, b);

/**
 * Training: the head coach and assistant coach multiply every session's XP, a
 * Sports Scientist with a Nutritionist adds 5% more (O-9); the strength coach
 * (power and block) and nutritionist (stamina) add to their own programmes'
 * XP (`statXp`, by the programme's main stat). The fitness trainer takes up to
 * 5 off the tiredness a session adds, and with a strength coach a session adds
 * 20% less (`fatigueFactor`).
 */
export function trainingStaffBonuses(staff: readonly Member[]): {
  xpMultiplier: number; statXp: Readonly<Record<string, number>>; fatigueReduction: number; fatigueFactor: number;
} {
  const E = STAFF_EFFECTS;
  const statXp: Record<string, number> = {};
  const strength = best(staff, "strength_conditioner"), nutritionist = best(staff, "nutritionist");
  for (const s of E.strengthCoachStats) statXp[s] = (statXp[s] ?? 1) * (1 + skillScale(strength) * E.strengthCoachXp);
  for (const s of E.nutritionistStats) statXp[s] = (statXp[s] ?? 1) * (1 + skillScale(nutritionist) * E.nutritionistXp);
  return {
    xpMultiplier: (1 + skillScale(best(staff, "head_coach")) * E.headCoachXp)
      * (1 + skillScale(best(staff, "assistant_coach")) * E.assistantCoachXp)
      * (pairOn(staff, "sports_scientist", "nutritionist") ? 1 + E.pairs.scienceAndNutrition.xp : 1),
    statXp,
    fatigueReduction: skillScale(best(staff, "fitness_trainer")) * E.fitnessTrainerFatigue,
    fatigueFactor: pairOn(staff, "strength_conditioner", "fitness_trainer") ? E.pairs.strengthAndFitness.fatigueFactor : 1,
  };
}

/** Night 2 (O-6): the massage therapist's tiredness off every day, on top of the daily rest. */
export function dailyRestBonus(staff: readonly Member[]): number {
  return skillScale(best(staff, "massage_therapist")) * STAFF_EFFECTS.massageDailyFatigue;
}

/**
 * Sponsorship: the promotions manager adds up to +18% to every sponsorship
 * payment while employed — weekly commercial income, contract signing bonuses
 * and monthly contract payments — as the Staff page promises.
 */
export function promotionsMultiplier(staff: readonly Member[]): number {
  return 1 + skillScale(best(staff, "promotions_manager")) * STAFF_EFFECTS.promotionsSponsor;
}

/** Night 2 (O-6): the sports scientist's factor on the whole squad's match injury risk, 1 to 0.85. */
export function injuryRiskStaffFactor(staff: readonly Member[]): number {
  return 1 - skillScale(best(staff, "sports_scientist")) * STAFF_EFFECTS.sportsScientistRiskCut;
}

/** The club's medical team on duty, best of each role (utils/injuries.ts treats injuries with it). */
export function medicalTeam<M extends Member>(staff: readonly M[]): { doctor?: M; physiotherapist?: M; specialist?: M } {
  return { doctor: best(staff, "doctor"), physiotherapist: best(staff, "physiotherapist"), specialist: best(staff, "medical_specialist") };
}

export type StaffPairKey = "doctor_physio" | "specialist_doctor_or_physio" | "strength_fitness" | "science_nutrition";

/** O-9: the four pairs, and whether these staff (on duty) make each one. */
export function staffPairs(staff: readonly Member[]): Array<{ key: StaffPairKey; label: string; effect: string; has: boolean }> {
  const E = STAFF_EFFECTS.pairs;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return [
    { key: "doctor_physio", label: "Doctor + Physio", effect: "Every injury heals at the \"both\" rate", has: pairOn(staff, "doctor", "physiotherapist") },
    { key: "specialist_doctor_or_physio", label: "Medical Specialist + Doctor or Physio", effect: "A reconstruction's time halves again",
      has: !!best(staff, "medical_specialist") && (!!best(staff, "doctor") || !!best(staff, "physiotherapist")) },
    { key: "strength_fitness", label: "Strength Coach + Fitness Trainer", effect: `Training adds ${pct(1 - E.strengthAndFitness.fatigueFactor)} less tiredness`,
      has: pairOn(staff, "strength_conditioner", "fitness_trainer") },
    { key: "science_nutrition", label: "Sports Scientist + Nutritionist", effect: `Better training techniques: all training XP +${pct(E.scienceAndNutrition.xp)}`,
      has: pairOn(staff, "sports_scientist", "nutritionist") },
  ];
}
