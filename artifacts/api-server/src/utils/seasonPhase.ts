/**
 * R-70: where the season is, in the rounds of the competition being played.
 *
 * The season record's totalRounds (78) is the SCHEDULE's slot count — the
 * number roundToDate() spreads across the year — not a count of anything the
 * player plays. The top bar showed it raw ("R7/78"), and match screens showed
 * a match's slot as its round ("Round 42" for World Tour round 31). The 78
 * slots are:
 *
 *   10  continental rounds            slots  1–10
 *   60  World Tour slots              slots 11–70 — 57 events, and the three
 *                                     open dates R-44 made (41, 51, 61)
 *    2  World Finals days             slots 71–72 (semi-finals, final)
 *    6  off-season                    slots 73–78, no matches
 *
 * The season a club plays is 10 + 57 + 2 = 69 rounds. Derived from the
 * schedule itself, so a change to the World Tour's events changes it too.
 */
import {
  FINALS_SLOTS, FINALS_START, REGIONAL_SLOTS, getSlotType,
} from "./calendarSlots.js";
import { WORLD_TOUR_EVENT_ROUNDS } from "./worldTour.js";

export type SeasonPhaseKey = "continental" | "world_tour" | "finals" | "off_season";

export interface SeasonPhase {
  phase:  SeasonPhaseKey;
  /** The top bar: "Continental R7/10", "World Tour R12/57", "Finals · Semi-finals", "Off-season". */
  label:  string;
  /** A match's round: "Continental R7", "World Tour R12", "World Finals semi-final", "World Final". */
  name:   string;
  /** The same, where space is tight: "Cont. R7", "WT R12", "Semi-final", "Final". */
  short:  string;
  /** The round within this phase, or null in the off-season. */
  round:  number | null;
  /** How many rounds this phase has, or null in the off-season. */
  of:     number | null;
  /** Rounds of the season reached so far, 1..length. */
  played: number;
  /** Rounds in the whole season: continental + World Tour events + finals days. */
  length: number;
}

export const CONTINENTAL_ROUNDS = REGIONAL_SLOTS;
export const WORLD_TOUR_ROUNDS  = WORLD_TOUR_EVENT_ROUNDS.length;
export const FINALS_ROUNDS      = FINALS_SLOTS;
export const SEASON_LENGTH      = CONTINENTAL_ROUNDS + WORLD_TOUR_ROUNDS + FINALS_ROUNDS;

/**
 * The phase for a schedule slot (season.currentRound, or a match's round). On a
 * World Tour open date the round is the last event reached, so the count never
 * skips or repeats an event.
 */
export function seasonPhase(slot: number): SeasonPhase {
  switch (getSlotType(slot)) {
    case "regional":
      return {
        phase: "continental", label: `Continental R${slot}/${CONTINENTAL_ROUNDS}`,
        name: `Continental R${slot}`, short: `Cont. R${slot}`,
        round: slot, of: CONTINENTAL_ROUNDS, played: slot, length: SEASON_LENGTH,
      };
    case "world_tour": {
      const n = WORLD_TOUR_EVENT_ROUNDS.filter((r) => r <= slot).length;
      return {
        phase: "world_tour", label: `World Tour R${n}/${WORLD_TOUR_ROUNDS}`,
        name: `World Tour R${n}`, short: `WT R${n}`,
        round: n, of: WORLD_TOUR_ROUNDS, played: CONTINENTAL_ROUNDS + n, length: SEASON_LENGTH,
      };
    }
    case "finals": {
      const n = slot - FINALS_START + 1;
      const semi = n === 1;
      return {
        phase: "finals", label: semi ? "Finals · Semi-finals" : "Finals · Final",
        name: semi ? "World Finals semi-final" : "World Final", short: semi ? "Semi-final" : "Final",
        round: n, of: FINALS_ROUNDS, played: CONTINENTAL_ROUNDS + WORLD_TOUR_ROUNDS + n, length: SEASON_LENGTH,
      };
    }
    default:
      return {
        phase: "off_season", label: "Off-season", name: "Off-season", short: "Off-season",
        round: null, of: null, played: SEASON_LENGTH, length: SEASON_LENGTH,
      };
  }
}
