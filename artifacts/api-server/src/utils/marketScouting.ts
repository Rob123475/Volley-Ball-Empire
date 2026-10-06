/**
 * Unity brief item 15 (Rob's design, 29 Sep): prices, scouting and buying blind.
 *
 * Every senior player on the market (no club, or at a club inside the transfer
 * window) has a PRICE: a one-off fee the buying club pays when she signs, on top
 * of the wage in her contract. The price is a fixed hidden value per player and
 * career, never re-rolled:
 *
 *   base  = one month of her market wage (utils/wageCurve.ts seniorMonthlyWage,
 *           the 1 Oct rise included), the figure her asking wage comes from;
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
import { seniorMonthlyWage } from "./wageCurve.js";
import { overallRating } from "./overallRating.js";
import type { PlayerDTO } from "../lib/playerDto.js";

export const SCOUT_DAYS = 5;
/**
 * Overnight brief 30 Sep, item 4 (Rob, 30 Sep): every scout costs $1,500:
 * players, youth, staff and medical alike, charged when the scout is sent
 * (utils/scoutingCharge.ts), and every report takes SCOUT_DAYS game days.
 */
export const SCOUT_COST = 1_500;
/**
 * Overnight brief 1 Oct, N-34 (Rob, 1 Oct): scouting a YOUTH costs $500 (it was
 * the $1,500 of everyone else), still SCOUT_DAYS game days. Senior players,
 * staff and medical stay at SCOUT_COST.
 */
export const YOUTH_SCOUT_COST = 500;
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

/** Her stats, for her rating: the 1 Oct wage rise is by rating (N-41). */
type PricedPlayer = Pick<PlayerDTO, "id" | "askingPrice" | "salary" | "speed" | "power" | "defense" | "serve" | "block" | "stamina"> & { poolTeamId?: number | null };

function basePrice(p: Omit<PricedPlayer, "id">): number {
  // Daytime 2 Oct, U-6: at an AI club, one month of the wage she is on there
  // (Rob, 30 Sep: one month of wage, ±15%).
  if (p.poolTeamId != null && Number(p.salary) > 0) return Number(p.salary);
  // Overnight 1 Oct, N-41: one month of her market wage, the 1 Oct rise included.
  const fromAsking = seniorMonthlyWage(p.askingPrice == null ? null : Number(p.askingPrice), overallRating(p));
  return fromAsking > 0 ? fromAsking : Math.max(1000, Number(p.salary) || 5000);
}

export interface MarketPrice { low: number; high: number; price: number }

export function marketPrice(careerSaveId: number, p: PricedPlayer): MarketPrice {
  const base = basePrice(p);
  const low  = Math.floor((base * RANGE_LOW) / RANGE_STEP) * RANGE_STEP;
  const high = Math.ceil((base * RANGE_HIGH) / RANGE_STEP) * RANGE_STEP;
  const price = Math.min(high, Math.max(low, Math.round((low + (high - low) * unitHash(careerSaveId, p.id)) / 100) * 100));
  return { low, high, price };
}

/**
 * Overnight brief 30 Sep, item 12 (Rob, 30 Sep): a youth player on the market
 * has a price too, $500 to $2,000 by her talent (her true potential tier), by
 * the same rules as a senior's: a range an unscouted card shows (85%-115% of
 * the tier's price, rounded out to $100, within $500-$2,000) and an exact
 * price inside it fixed per player and career.
 */
const YOUTH_TIER_PRICE: Record<string, number> = { Low: 600, Average: 900, High: 1300, Elite: 1700, Generational: 2000 };
export const YOUTH_PRICE_MIN = 500, YOUTH_PRICE_MAX = 2000;

export function youthPrice(careerSaveId: number, p: Pick<PlayerDTO, "id" | "potential">): MarketPrice {
  return youthTierPrice(p.potential, unitHash(careerSaveId, p.id));
}

/**
 * A youth's price by her potential tier, `unit` in [0, 1) placing it in the
 * tier's range. Item 13: a youth a scouting mission finds is priced by the
 * same rule (she cost $3,000-$35,000 before, up to $80,000).
 */
export function youthTierPrice(potential: string | null | undefined, unit: number): MarketPrice {
  const base = YOUTH_TIER_PRICE[potential ?? "Average"] ?? YOUTH_TIER_PRICE["Average"]!;
  const low  = Math.max(YOUTH_PRICE_MIN, Math.floor((base * RANGE_LOW) / 100) * 100);
  const high = Math.min(YOUTH_PRICE_MAX, Math.ceil((base * RANGE_HIGH) / 100) * 100);
  const price = Math.min(high, Math.max(low, Math.round((low + (high - low) * unit) / 50) * 50));
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

/**
 * Item 4: a staff or medical candidate's scouting, by the same clock as a
 * player's. A report from before the rule (revealed at once) counts as done.
 */
export function staffScoutState(m: { isScoutRevealed: boolean; scoutStartedOn: string | null }, today: string): ScoutState {
  if (m.isScoutRevealed && !m.scoutStartedOn) return { state: "done", readyOn: today };
  return scoutState({ scoutStartedOn: m.scoutStartedOn, scoutedPotential: null }, today);
}

/**
 * Item 4: a market card's scouting, and whether the report is in (on its 5th
 * game day). Item 7: until it is, the card carries no rating, stars or quality
 * of any kind: rating, scouting rating, skill level and attributes are not
 * sent (the page used to draw "Quality ★★★★★ Elite" from the true rating).
 */
export function withStaffScouting<T extends { isScoutRevealed: boolean; scoutStartedOn: string | null; salary: number }>(m: T, today: string) {
  const scouting = staffScoutState(m, today);
  const revealed = scouting.state === "done";
  return {
    ...m,
    ...(revealed ? {} : { overallRating: null, scoutingRating: null, skillLevel: null, attributes: {} }),
    // Item 8: her wage as a range until the report is in (exact once scouted or hired).
    ...(revealed ? { salaryRange: null } : { salary: null, salaryRange: staffWageRange(m.salary) }),
    isScoutRevealed: revealed,
    scouting,
  };
}

/**
 * Overnight brief 30 Sep, item 8: a staff or medical candidate's monthly wage
 * as an unscouted card shows it, by the same rule as a player's price range:
 * 85% to 115% of the wage, rounded out to $500.
 */
export function staffWageRange(salary: number): { low: number; high: number } {
  return {
    low:  Math.floor((salary * RANGE_LOW) / RANGE_STEP) * RANGE_STEP,
    high: Math.ceil((salary * RANGE_HIGH) / RANGE_STEP) * RANGE_STEP,
  };
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
  priceOf: (careerSaveId: number, p: PlayerDTO) => MarketPrice = marketPrice,
) {
  const revealed = isRevealed(p, myTeamId, today);
  const scouting = scoutState(p, today);
  const range = onMarket ? priceOf(careerSaveId, p) : null;
  // Her TRUE potential and development are never sent (item 12): a card shows
  // the scout's reading (scoutedPotential) once his report is in. The senior
  // market re-spread the full record and sent them.
  const { potential: _potential, development: _development, ...shown } = p as PlayerDTO & { development?: unknown };
  return {
    ...shown,
    ...(revealed ? {} : HIDDEN),
    revealed,
    scouting,
    priceRange: range ? { low: range.low, high: range.high } : null,
    price: range && revealed ? range.price : null,
  };
}
