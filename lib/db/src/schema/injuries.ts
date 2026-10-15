/**
 * Update 1, night 2 (Rob, 15 Oct, O-7 to O-10): what an injury is, who treats
 * it and how long it keeps a player out. Every number of the injury system is
 * here, once, for the server (api-server utils/injuries.ts) and the pages.
 *
 * How often a player is hurt is not here: that is the one match injury roll
 * (api-server utils/condition.ts injuryRisk), unchanged. This is what the
 * injury is once she is hurt, and how long it lasts.
 *
 * Time out = base weeks x the treatment factor of the club's medical staff on
 * duty (O-7). The factor is live: each week of rest takes 1 / factor base weeks
 * off, so hiring the right person shortens what is left and losing them
 * lengthens it again, and hiring and firing can't buy time back.
 */

export type BodyArea = "leg" | "head" | "ankle" | "hand_foot" | "hamstring" | "shoulder" | "knee";
export type Treater = "doctor" | "physiotherapist";

export const BODY_AREA_LABELS: Readonly<Record<BodyArea, string>> = {
  leg: "Leg", head: "Head", ankle: "Ankle", hand_foot: "Hand/foot", hamstring: "Hamstring", shoulder: "Shoulder", knee: "Knee",
};

export type InjuryType = { name: string; area: BodyArea; treatedBy: Treater; baseWeeks: number; share: number };

/** O-7: the injuries, their body area, who treats them, base weeks and share of all injuries (sums to 1). */
export const INJURY_TYPES: readonly InjuryType[] = [
  { name: "Cramp or strained muscle", area: "leg",       treatedBy: "physiotherapist", baseWeeks: 1,  share: 0.40 },
  { name: "Concussion",               area: "head",      treatedBy: "doctor",          baseWeeks: 2,  share: 0.08 },
  { name: "Sprained ankle",           area: "ankle",     treatedBy: "physiotherapist", baseWeeks: 3,  share: 0.20 },
  { name: "Broken finger or toe",     area: "hand_foot", treatedBy: "doctor",          baseWeeks: 4,  share: 0.12 },
  { name: "Torn hamstring",           area: "hamstring", treatedBy: "physiotherapist", baseWeeks: 6,  share: 0.10 },
  { name: "Broken wrist",             area: "hand_foot", treatedBy: "doctor",          baseWeeks: 8,  share: 0.05 },
  { name: "Torn shoulder",            area: "shoulder",  treatedBy: "physiotherapist", baseWeeks: 10, share: 0.03 },
  { name: "Broken leg",               area: "leg",       treatedBy: "doctor",          baseWeeks: 20, share: 0.015 },
  { name: "Torn knee ligament (ACL)", area: "knee",      treatedBy: "doctor",          baseWeeks: 30, share: 0.005 },
];

/**
 * O-7: the treatment factor on an injury's base weeks. "Right" is the role the
 * injury is treated by; its factor runs from `at50` (skill 50 or below) to
 * `at95` (skill 95 and above), on the staff bonuses' scale. "Both" is a doctor
 * and a physio on duty together (O-9), scaled by the right one's skill.
 */
export const INJURY_TREATMENT = {
  none:  2,
  wrong: 1,
  right: { at50: 0.7, at95: 0.6 },
  both:  { at50: 0.5, at95: 0.4 },
} as const;

/**
 * O-8: a third injury to the same body area within `windowDays` (by game date,
 * from her injury history, at any club) is a reconstruction instead: surgery and
 * rehab, `baseWeeks`, always serious. Its factor: no medical staff, a doctor or
 * physio, a medical specialist, or a specialist with a doctor or physio (O-9).
 */
export const RECONSTRUCTION = {
  injuriesInArea: 3,
  windowDays: 365,
  baseWeeks: 30,
  factor: { none: 2, doctorOrPhysio: 1, specialist: 0.5, specialistWithDoctorOrPhysio: 0.25 },
} as const;

/** "Ankle reconstruction". */
export function reconstructionName(area: BodyArea): string {
  return `${BODY_AREA_LABELS[area]} reconstruction`;
}

/**
 * O-10: an injury of more than `overWeeks` (her time out when she is hurt) puts
 * her on the injured list at once, at every club: she gives up her senior place
 * until she is fit and there is a place for her again.
 */
export const INJURED_LIST = { overWeeks: 6 } as const;

/**
 * O-10: the youngest an academy player may be promoted into the seniors (a
 * match place), so a club can cover from its academy. Was 18. Graduation at the
 * season rollover (api-server utils/seasonRollover.ts PROMOTION_AGE, 19) is unchanged.
 */
export const PROMOTION_MIN_AGE = 16;

/** Night 2: an older save's injuries become a named one of the same length. */
export const LEGACY_INJURIES: Readonly<Record<string, string>> = {
  "Minor Injury": "Cramp or strained muscle",
  "Major Injury": "Sprained ankle",
  Unavailable:    "Torn hamstring",
};

/** The injury a name stands for: one of INJURY_TYPES, or a reconstruction of an area. */
export function injuryInfo(name: string | null | undefined): { area: BodyArea | null; treatedBy: Treater | "specialist" | null; baseWeeks: number; reconstruction: boolean } | null {
  if (!name || name === "Healthy") return null;
  const t = INJURY_TYPES.find((i) => i.name === name);
  if (t) return { area: t.area, treatedBy: t.treatedBy, baseWeeks: t.baseWeeks, reconstruction: false };
  const area = (Object.keys(BODY_AREA_LABELS) as BodyArea[]).find((a) => reconstructionName(a) === name);
  if (area) return { area, treatedBy: "specialist", baseWeeks: RECONSTRUCTION.baseWeeks, reconstruction: true };
  return null;
}

/** The average base weeks of an injury, by the shares above (staff absences are half as long: staff-illness.ts). */
export const INJURY_MEAN_BASE_WEEKS = INJURY_TYPES.reduce((s, i) => s + i.baseWeeks * i.share, 0);
