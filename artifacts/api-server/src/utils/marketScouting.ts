/**
 * Unity brief item 15 (Rob's design, 29 Sep): prices, scouting and buying blind.
 *
 * Every senior player on the market (no club, or at a club inside the transfer
 * window) has a PRICE: a one-off fee the buying club pays when she signs, on top
 * of the wage in her contract. The price is a fixed hidden value per player and
 * career, never re-rolled:
 *
 *   base  = one month of her asking wage (utils/wageCurve.ts monthlyWage), the
 *           same figure her opening wage comes from;
 *   range = base x 0.85 to base x 1.15, rounded out to $500: what an UNSCOUTED
 *           card shows;
 *   price = a point inside the range fixed by a hash of (career, player),
 *           rounded to $100.
 *
 * An unscouted card shows the range, rating "?" and no attributes. Signing her
 * blind charges the hidden price and reveals her. Scouting her (a Scout, Head
 * Coach or Assistant Coach on staff, as before) takes SCOUT_DAYS game days, then
 * shows her exact price and attributes. Scouting lapses at season end for every
 * player without a club (utils/seasonRollover.ts).
 */
import { monthlyWage } from "./wageCurve.js";
import type { PlayerDTO } from "../lib/playerDto.js";

export const SCOUT_DAYS = 5;
const RANGE_LOW = 0.85, RANGE_HIGH = 1.15, RANGE_STEP = 500;

/** A fixed number in [0, 1) for this player in this career (FNV-1a over the ids). */
function unitHash(careerSaveId: number, playerId: number): number {
  let h = 0x811c9dc5;
  for (const ch of `${careerSaveId}:${playerId}:market-price`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h / 0x100000000;
}

function basePrice(p: Pick<PlayerDTO, "askingPrice" | "salary">): number {
  const fromAsking = monthlyWage(p.askingPrice == null ? null : Number(p.askingPrice));
  return fromAsking > 0 ? fromAsking : Math.max(1000, Number(p.salary) || 5000);
}

export interface MarketPrice { low: number; high: number; price: number }

export function marketPrice(careerSaveId: number, p: Pick<PlayerDTO, "id" | "askingPrice" | "salary">): MarketPrice {
  const base = basePrice(p);
  const low  = Math.floor((base * RANGE_LOW) / RANGE_STEP) * RANGE_STEP;
  const high = Math.ceil((base * RANGE_HIGH) / RANGE_STEP) * RANGE_STEP;
  const price = Math.min(high, Math.max(low, Math.round((low + (high - low) * unitHash(careerSaveId, p.id)) / 100) * 100));
  return { low, high, price };
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type ScoutState = { state: "none" } | { state: "in_progress"; readyOn: string; daysLeft: number } | { state: "done"; readyOn: string };

/**
 * Where this club's scouting of her stands on the game date `today`. A player
 * scouted before this rule (a potential on record, no start date: scouting was
 * instant then) counts as scouted.
 */
export function scoutState(p: Pick<PlayerDTO, "scoutStartedOn" | "scoutedPotential">, today: string): ScoutState {
  if (!p.scoutStartedOn) return p.scoutedPotential ? { state: "done", readyOn: today } : { state: "none" };
  const readyOn = addDays(p.scoutStartedOn, SCOUT_DAYS);
  if (today >= readyOn) return { state: "done", readyOn };
  const daysLeft = Math.round((Date.parse(`${readyOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return { state: "in_progress", readyOn, daysLeft };
}

/** Attributes, rating and exact price are shown: her own club's player, or scouted. */
export function isRevealed(p: Pick<PlayerDTO, "teamId" | "scoutStartedOn" | "scoutedPotential">, myTeamId: number | null, today: string): boolean {
  return (myTeamId != null && p.teamId === myTeamId) || scoutState(p, today).state === "done";
}

/** What an unrevealed card does not get: her attributes, rating inputs and potential. */
const HIDDEN = {
  speed: null, power: null, defense: null, serve: null, block: null, stamina: null,
  scoutedPotential: null, peakOverallRating: null, legendScore: null,
} as const;

/**
 * The market card's view of a player: an unrevealed player's attributes are not
 * sent at all (they used to be sent and only greyed out by the page).
 */
export function marketView(
  careerSaveId: number, p: PlayerDTO, myTeamId: number | null, today: string, onMarket: boolean,
) {
  const revealed = isRevealed(p, myTeamId, today);
  const scouting = scoutState(p, today);
  const range = onMarket ? marketPrice(careerSaveId, p) : null;
  return {
    ...p,
    ...(revealed ? {} : HIDDEN),
    revealed,
    scouting,
    priceRange: range ? { low: range.low, high: range.high } : null,
    price: range && revealed ? range.price : null,
  };
}
