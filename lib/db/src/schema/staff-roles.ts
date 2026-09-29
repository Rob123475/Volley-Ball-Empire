/**
 * P-09 — staff roles, defined ONCE for the whole repo, server and client.
 *
 * The same split as continents.ts, and the same bug. The staff table stores
 * roles in Title Case ("Head Coach", "Promotional Manager", "Strength Coach"),
 * because that is how the seeded cards were written. The code that reads them
 * compared against snake_case keys ("head_coach", "promotions_manager",
 * "strength_conditioner"), because that is how the generators and the UI maps
 * were written. `"Head Coach" === "head_coach"` is false, so no hired head
 * coach, assistant coach, fitness trainer or promotions manager ever gave a
 * bonus, and the Staff page said "Hire staff to unlock bonuses" with every
 * slot full. Three copies of a lower-case-and-underscore helper had grown up to
 * paper over it in the places someone happened to notice.
 *
 * So a role is never compared as stored. Anything that asks "is this a head
 * coach?" goes through `normaliseRole`, which maps every spelling the game has
 * ever written — Title Case, snake_case, and the two names that differ outright
 * — to one key. The stored value is not rewritten: saves keep what they have.
 *
 * Pure data, no imports: the client aliases this exact file (vite.config.ts),
 * and nothing here may pull drizzle into the browser bundle.
 */

export const STAFF_ROLE_KEYS = [
  "head_coach",
  "assistant_coach",
  "fitness_trainer",
  "strength_conditioner",
  "massage_therapist",
  "promotions_manager",
  "scout",
  "doctor",
  "medical_specialist",
  "physiotherapist",
  "nutritionist",
  "sports_scientist",
] as const;

export type StaffRoleKey = (typeof STAFF_ROLE_KEYS)[number];

/** The role as the starter database stores it, and as the player sees it. */
export const STAFF_ROLE_NAMES: Record<StaffRoleKey, string> = {
  head_coach:           "Head Coach",
  assistant_coach:      "Assistant Coach",
  fitness_trainer:      "Fitness Trainer",
  strength_conditioner: "Strength Coach",
  massage_therapist:    "Massage Therapist",
  promotions_manager:   "Promotional Manager",
  scout:                "Scout",
  doctor:               "Doctor",
  medical_specialist:   "Medical Specialist",
  physiotherapist:      "Physiotherapist",
  nutritionist:         "Nutritionist",
  sports_scientist:     "Sports Scientist",
};

/**
 * Spellings that are not simply the key with spaces for underscores. Each one
 * is written somewhere — a generator, a filter pill, an older seed — and every
 * one of them has to land on the same key.
 */
const ALIASES: Record<string, StaffRoleKey> = {
  strength_coach:      "strength_conditioner",
  promotional_manager: "promotions_manager",
  team_doctor:         "doctor",
  physio:              "physiotherapist",
  scouting:            "scout",
  talent_scout:        "scout",
  sports_chemist:      "sports_scientist",
};

const KEYS = new Set<string>(STAFF_ROLE_KEYS);

/** Any stored or UI spelling of a role -> its one key, or null if it is not a staff role. */
export function normaliseRole(role: string | null | undefined): StaffRoleKey | null {
  if (!role) return null;
  const k = role.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (KEYS.has(k)) return k as StaffRoleKey;
  return ALIASES[k] ?? null;
}

/** True when `role`, however it is spelled, is `key`. */
export function isRole(role: string | null | undefined, key: StaffRoleKey): boolean {
  return normaliseRole(role) === key;
}

/**
 * Unity brief item 16: how many staff a club may employ, stated once for the
 * server and every page. My Staff said "of 4" and the Staff Market "of 8"; the
 * server has always refused the 9th hire. A club may employ MAX_STAFF people in
 * all, medical staff included, and of those at most MAX_MEDICAL_STAFF in the
 * medical department. Nothing in the game raises either number.
 */
export const MAX_STAFF = 8;
export const MAX_MEDICAL_STAFF = 4;

/** Roles that unlock scouting (staff market, continental scouting, youth prospects). */
export const SCOUTING_ROLE_KEYS: ReadonlySet<StaffRoleKey> = new Set(["head_coach", "assistant_coach", "scout"]);

/** The medical department's six roles (routes/medical-staff.ts, pages/medical.tsx). */
export const MEDICAL_ROLE_KEYS: ReadonlySet<StaffRoleKey> = new Set([
  "doctor", "medical_specialist", "physiotherapist", "nutritionist", "sports_scientist", "massage_therapist",
]);

/** True for a medical-department role, in any spelling. */
export function isMedicalRole(role: string | null | undefined): boolean {
  const k = normaliseRole(role);
  return k !== null && MEDICAL_ROLE_KEYS.has(k);
}
