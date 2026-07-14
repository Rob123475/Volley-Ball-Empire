/**
 * Calendar slot constants and helpers for the 78-slot season structure.
 *
 * Season layout (sequential schedule slots):
 *   Slots  1–10  Regional Period   (10 rounds — all 6 continents play round N simultaneously)
 *   Slots 11–70  World Tour Period  (60 events, 10 per continent)
 *   Slots 71–72  Finals Period      (Day 1 = Semifinals, Day 2 = World Final)
 *   Slots 73–78  Holiday Period     (rest / off-season prep)
 *
 * Total: 78 slots = totalRounds on the season record.
 */

export const REGIONAL_SLOTS   = 10;
export const WORLD_TOUR_SLOTS = 60;
export const FINALS_SLOTS     = 2;
export const HOLIDAY_SLOTS    = 6;
export const TOTAL_SLOTS      = 78;

export const REGIONAL_START    = 1;
export const REGIONAL_END      = 10;
export const WORLD_TOUR_START  = 11;
export const WORLD_TOUR_END    = 70;
export const FINALS_START      = 71;
export const FINALS_END        = 72;
export const HOLIDAY_START     = 73;
export const HOLIDAY_END       = 78;

export type SlotType = "regional" | "world_tour" | "finals" | "holiday";

/** Return the category of a schedule slot (1-indexed). */
export function getSlotType(slot: number): SlotType {
  if (slot >= REGIONAL_START && slot <= REGIONAL_END)    return "regional";
  if (slot >= WORLD_TOUR_START && slot <= WORLD_TOUR_END) return "world_tour";
  if (slot >= FINALS_START && slot <= FINALS_END)         return "finals";
  return "holiday";
}

/** True when slot is in the regional period (slots 1-10). */
export function isRegionalSlot(slot: number): boolean {
  return slot >= REGIONAL_START && slot <= REGIONAL_END;
}

/** True when all 10 regional rounds have just been processed. */
export function isLastRegionalSlot(slot: number): boolean {
  return slot === REGIONAL_END;
}

/** For a regional slot (1–10), return the regional round number (same value). */
export function getRegionalRound(slot: number): number {
  return slot;
}

/** For a WT slot (11–70), return the internal WT round (matches the round field in matchesTable). */
export function getWorldTourRound(slot: number): number {
  return slot;
}
