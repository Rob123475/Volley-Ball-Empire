/**
 * D-3 — every facility's name, defined ONCE for server and client.
 *
 * Rob, 29 Sep: the dashboard said "Training Complex", the Facilities page
 * "Training Centre". The names had been typed separately into the Attention
 * cards, the dashboard tiles, the Facilities page, the upcoming-events list
 * (which spelled its keys differently and so never matched at all), the
 * season calendar and the finance ledger (both printed the raw key, "training
 * complex"). The Facilities page is each building's own card, so its names
 * are the names; everything a player reads takes them from here.
 *
 * Pure data, no imports: the client aliases this exact file (vite.config.ts),
 * and nothing here may pull drizzle into the browser bundle.
 */

/** The nine buildings on the Facilities page, in its order. */
export const FACILITY_PAGE_TYPES = [
  "training_complex",
  "medical_centre",
  "gymnasium",
  "nutrition_centre",
  "youth_academy",
  "scouting_department",
  "sports_science_lab",
  "commercial_department",
  "beach_resort",
] as const;

export type FacilityPageType = (typeof FACILITY_PAGE_TYPES)[number];

export const FACILITY_NAMES: Record<string, string> = {
  training_complex:           "Training Centre",
  medical_centre:             "Medical Centre",
  gymnasium:                  "Gymnasium",
  nutrition_centre:           "Nutrition Centre",
  youth_academy:              "Youth Academy",
  scouting_department:        "Scouting Department",
  sports_science_lab:         "Performance Centre",
  commercial_department:      "Commercial Department",
  beach_resort:               "Beach Resort",
  // Rows every club has, but not on the Facilities page and never upgradeable.
  psychology_centre:          "Psychology Centre",
  olympic_performance_centre: "Olympic Performance Centre",
};

/** A facility's name as a player reads it. Never the raw key. */
export function facilityName(type: string): string {
  return FACILITY_NAMES[type]
    ?? type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isFacilityPageType(type: string): type is FacilityPageType {
  return (FACILITY_PAGE_TYPES as readonly string[]).includes(type);
}
