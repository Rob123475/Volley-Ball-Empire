/**
 * What each facility level gives, as a player reads it — the Facilities page
 * (long form, current and NEXT LEVEL) and the dashboard tiles (short form).
 *
 * D-4 (29 Sep): the Nutrition Centre's NEXT LEVEL read "−0 fatigue/session +
 * −1 in retreats". The level-2 session bonus is (2 − 1) × 3/9 = ⅓ of a fatigue
 * point, and fatigue is whole points: training rounds it away
 * (routes/training.ts, `Math.round(fatigueEffect - reduction)`), so on its own
 * level 2 takes nothing off a session. The text was not rounding wrongly; the
 * bonus really is 0 there. So a part that comes to 0 is left out of the text,
 * for every facility, rather than printed as "−0" or "+0".
 *
 * The two tables used to be typed separately into facilities.tsx and
 * dashboard.tsx. The formulas are unchanged; only where they live moved.
 * No imports, so harness/facility-benefits.mjs can load this file directly.
 */

type Benefit = (level: number) => string;

/** "+N<unit>" / "−N<unit>", or null when the bonus rounds to nothing. */
function part(sign: "+" | "−", perLevelOver9: number, level: number, unit: string): string | null {
  const n = Math.round((level - 1) * (perLevelOver9 / 9));
  return n === 0 ? null : `${sign}${n}${unit}`;
}

/** The parts that are not zero, joined; `base` when none is. */
function parts(base: string, ...ps: (string | null)[]): string {
  const shown = ps.filter((p): p is string => p !== null);
  return shown.length === 0 ? base : shown.join(" + ");
}

const YOUTH_LONG = [
  "Basic prospects only",
  "Slightly improved prospects",
  "Improved prospect quality",
  "Better chance of High potential",
  "Good chance of High potential",
  "Higher chance of Elite prospects",
  "Regular Elite prospects",
  "Strong Elite prospects",
  "High chance of Elite & Generational",
  "Maximum — Elite & Generational prospects",
];

const YOUTH_SHORT = ["Basic prospects", "Slightly improved", "Improved quality", "Better High potential",
  "Good High potential", "Higher Elite chance", "Regular Elite", "Strong Elite", "Elite & Generational", "Maximum"];

/** The Facilities page's text. */
export const FACILITY_BENEFIT: Record<string, Benefit> = {
  training_complex:      (l) => parts("Base training effectiveness", part("+", 20, l, "% training XP")),
  medical_centre:        (l) => parts("Base recovery speed", part("+", 25, l, "% recovery speed")),
  gymnasium:             (l) => parts("Base strength training", part("+", 15, l, "% strength/power development")),
  nutrition_centre:      (l) => parts("Base nutrition support", part("−", 3, l, " fatigue/session"), part("−", 5, l, " in retreats")),
  youth_academy:         (l) => YOUTH_LONG[l - 1] ?? YOUTH_LONG[0]!,
  scouting_department:   (l) => parts("Basic scouting capability", part("+", 30, l, "% scouting effectiveness")),
  sports_science_lab:    (l) => parts("Base injury prevention", part("−", 20, l, "% injury risk")),
  commercial_department: (l) => parts("Base commercial activity", part("+", 30, l, "% sponsorship value")),
  beach_resort:          (l) => parts("Base morale environment", part("+", 8, l, " morale per camp")),
};

/** The dashboard tiles' text. */
export const FACILITY_BENEFIT_SHORT: Record<string, Benefit> = {
  training_complex:      (l) => parts("Base training XP", part("+", 20, l, "% training XP")),
  medical_centre:        (l) => parts("Base recovery speed", part("+", 25, l, "% recovery speed")),
  gymnasium:             (l) => parts("Base strength training", part("+", 15, l, "% power dev.")),
  nutrition_centre:      (l) => parts("Base nutrition support", part("−", 3, l, " fatigue/session") ?? part("−", 5, l, " fatigue in retreats")),
  youth_academy:         (l) => YOUTH_SHORT[l - 1] ?? YOUTH_SHORT[0]!,
  scouting_department:   (l) => parts("Basic scouting", part("+", 30, l, "% effectiveness")),
  sports_science_lab:    (l) => parts("Base injury prevention", part("−", 20, l, "% injury risk")),
  commercial_department: (l) => parts("Base commercial", part("+", 30, l, "% sponsorship")),
  beach_resort:          (l) => parts("Base morale boost", part("+", 8, l, " morale/camp")),
};
