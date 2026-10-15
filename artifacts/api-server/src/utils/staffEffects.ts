/**
 * Update 1, night 2 (O-6): what each member of a club's staff really does,
 * worded from the numbers the game uses (utils/staffBonuses.ts STAFF_EFFECTS,
 * lib/db schema/injuries.ts), for the Staff and Medical pages
 * (GET /staff/effects). Nothing here is a promise the game does not keep: the
 * figures are the functions' own.
 */
import { isRole, staffOnDuty, STAFF_ROLE_NAMES, INJURY_TYPES, reconstructionName, type StaffRoleKey } from "@workspace/db";
import { STAFF_EFFECTS, skillScale, medicalTeam, staffPairs, injuryRiskStaffFactor, dailyRestBonus } from "./staffBonuses.js";
import { treatmentFactor } from "./injuries.js";

type Member = { id: number; name: string; role: string; skillLevel: number; offDaysLeft?: number | null };

const ROLE_KEYS = Object.keys(STAFF_ROLE_NAMES) as StaffRoleKey[];
const pct = (x: number) => `${Math.round(x * 100)}%`;
const one = (x: number) => (Math.round(x * 10) / 10).toString();
const roleOf = (m: Member) => ROLE_KEYS.find((k) => isRole(m.role, k)) ?? null;
const first = (treatedBy: string) => INJURY_TYPES.find((i) => i.treatedBy === treatedBy)!.name;

/** The treatment factors today: a doctor's injuries, a physio's, and a reconstruction. */
export function treatmentNow(staff: readonly Member[]) {
  const team = medicalTeam(staff);
  return {
    doctorInjuries: treatmentFactor(first("doctor"), team),
    physioInjuries: treatmentFactor(first("physiotherapist"), team),
    reconstruction: treatmentFactor(reconstructionName("ankle"), team),
  };
}

function effectOf(key: StaffRoleKey, m: Member, staff: readonly Member[]): string {
  const E = STAFF_EFFECTS, k = skillScale(m), t = treatmentNow(staff);
  switch (key) {
    case "head_coach":           return `+${pct(k * E.headCoachXp)} training XP`;
    case "assistant_coach":      return `+${pct(k * E.assistantCoachXp)} training XP`;
    case "fitness_trainer":      return `−${one(k * E.fitnessTrainerFatigue)} tiredness from each training session`;
    case "promotions_manager":   return `+${pct(k * E.promotionsSponsor)} sponsor money`;
    case "scout":                return "Scouts players for you (report accuracy by skill)";
    case "strength_conditioner": return `+${pct(k * E.strengthCoachXp)} power and block training XP`;
    case "massage_therapist":    return `−${one(dailyRestBonus([m]))} more tiredness every day`;
    case "nutritionist":         return `+${pct(k * E.nutritionistXp)} stamina training XP`;
    case "sports_scientist":     return `−${pct(1 - injuryRiskStaffFactor([m]))} injury risk for the whole squad`;
    case "medical_specialist":   return `Reconstructions: time out ×${t.reconstruction} (×0.5 alone, ×0.25 with a doctor or physio)`;
    case "doctor":               return `Treats concussions and broken bones: time out ×${t.doctorInjuries.toFixed(2)}`;
    case "physiotherapist":      return `Treats muscle, ankle, hamstring and shoulder injuries: time out ×${t.physioInjuries.toFixed(2)}`;
  }
}

/** Each member's real effect now, the pairs, and the treatment factors (GET /staff/effects). */
export function staffEffects(staff: readonly Member[]) {
  const members = staff.map((m) => {
    const key = roleOf(m);
    const onDuty = staffOnDuty(m);
    const bestOfRole = key == null ? null : staff.filter((s) => isRole(s.role, key) && staffOnDuty(s)).sort((a, b) => b.skillLevel - a.skillLevel)[0];
    const counts = onDuty && bestOfRole?.id === m.id;
    const effect = key == null ? "No effect"
      : !onDuty ? "Off: gives nothing until back"
      : !counts ? `Gives nothing while a better ${STAFF_ROLE_NAMES[key]} is on duty (the best one counts)`
      : effectOf(key, m, staff);
    return { id: m.id, name: m.name, role: m.role, roleKey: key, onDuty, counts, effect };
  });
  return { members, pairs: staffPairs(staff), treatment: treatmentNow(staff), injuryRiskFactor: injuryRiskStaffFactor(staff) };
}
