/**
 * 1.1.1 (Rob, 16 Oct): every number of the transfer window, the counter-offer
 * and perks, once, for the server (api-server utils/transfers.ts) and the pages
 * (the contract box, the Rules). Pure data, no imports: the client aliases this
 * exact file (vite.config.ts "@shared/transfers").
 *
 * The window itself has no number here: it is the calendar's Off-Season, the
 * season's holiday slots (api-server utils/calendarSlots.ts HOLIDAY_START to
 * HOLIDAY_END), so the calendar and the rule can never disagree.
 */

/** The perks a senior contract can carry (AC-11): monthly cost and how much she wants it. */
export type PerkPull = "small" | "medium" | "large";
export type Perk = { key: string; label: string; monthly: number; pull: PerkPull };

export const PERKS: readonly Perk[] = [
  { key: "phone",       label: "Phone and internet",   monthly: 220,  pull: "small"  },
  { key: "gym",         label: "Gym membership",       monthly: 270,  pull: "small"  },
  { key: "car",         label: "New car",              monthly: 450,  pull: "medium" },
  { key: "clothing",    label: "Clothing allowance",   monthly: 540,  pull: "small"  },
  { key: "salon",       label: "Beauty salon",         monthly: 670,  pull: "medium" },
  { key: "flights",     label: "Family flights home",  monthly: 900,  pull: "medium" },
  { key: "media_agent", label: "Personal media agent", monthly: 900,  pull: "medium" },
  { key: "chef",        label: "Private chef",         monthly: 1120, pull: "medium" },
  { key: "trainer",     label: "Personal trainer",     monthly: 1350, pull: "large"  },
  { key: "beach_house", label: "Beach house",          monthly: 3580, pull: "large"  },
];

/**
 * What a perk is worth to her, a month, when she weighs two offers: she counts
 * it like this much extra wage. A large perk is worth more to her than it costs
 * the club on average; a small one less (it's nice, not a reason to move).
 */
export const PERK_PULL_VALUE: Readonly<Record<PerkPull, number>> = { small: 300, medium: 900, large: 2500 };

/** The months a contract length runs, for weighing an offer (wage x months). */
export const CONTRACT_MONTHS: Readonly<Record<string, number>> = { "6m": 6, "1s": 12, "2s": 24 };

/**
 * One chance to keep her (Part 3). The holding club has `answerDays` game days
 * to counter a bid (no answer: she goes). She stays if the counter is worth at
 * least the bid; within `closeShare` of each other, her mood decides: the
 * counter is worth (1 + moraleWeight x mood) to her, where mood runs from -1
 * (low morale at a losing club) to +1 (high morale at a winning club).
 */
export const COUNTER_OFFER = { answerDays: 14, closeShare: 0.05, moraleWeight: 0.10 } as const;

/**
 * An AI club's bid (AC-9): her current wage times `wageRise`, the bidder's own
 * length for its rating, and perks, cheapest first, while they cost no more
 * than `perkShare` of the wage. An AI holding club counters with the bid's
 * terms but pays her at most `counterCeiling` times what it thinks she is
 * worth (the wage for her rating), and only when it can pay `counterMonths` of
 * the extra cost from its balance above its reserve and it fits under its cap.
 * So an AI club's bid (+15%) against an AI club's counter (at most +10% over
 * her worth) is close, and her mood decides; outbid it by more and she goes.
 */
export const AI_TRANSFER_TERMS = { wageRise: 1.15, perkShare: 0.10, counterMonths: 12, counterCeiling: 1.10 } as const;

/**
 * 1.1.3 (Rob, 23 Oct): "AI clubs can scout no more than 10 scouting missions in
 * a year and no more than 2 from 1 club; this applies for buying as well."
 * Each AI club, each season: at most `scoutingReports` scouting reports on
 * seniors at other clubs, never more than `scoutingPerClub` on players at any
 * one club; at most `bids` bids (seniors and youth buy offers together; a
 * refused or countered bid still counts), never more than `bidsPerClub` to any
 * one club. An AI club bids for a senior only once its report on her is ready.
 * Continental youth missions are not covered.
 */
export const AI_SEASON_LIMITS = { scoutingReports: 10, scoutingPerClub: 2, bids: 10, bidsPerClub: 2 } as const;

/** The perks of a stored list ("car,chef"), known ones only, in the table's order. */
export function parsePerks(stored: string | null | undefined): Perk[] {
  const keys = new Set((stored ?? "").split(",").map((k) => k.trim()).filter(Boolean));
  return PERKS.filter((p) => keys.has(p.key));
}

/** The stored form of a list of perk keys (unknown keys dropped). */
export function perksText(keys: readonly string[] | null | undefined): string {
  const want = new Set(keys ?? []);
  return PERKS.filter((p) => want.has(p.key)).map((p) => p.key).join(",");
}

/** What a contract's perks cost the club a month. */
export function perksMonthly(stored: string | null | undefined): number {
  return parsePerks(stored).reduce((t, p) => t + p.monthly, 0);
}

/** What a contract's perks are worth to her a month (their pull). */
export function perksPull(stored: string | null | undefined): number {
  return parsePerks(stored).reduce((t, p) => t + PERK_PULL_VALUE[p.pull], 0);
}

/** An offer as she weighs it: wage over the contract, plus her perks' pull over it. */
export function offerValue(offer: { wage: number; length: string; perks: string | null | undefined }): number {
  const months = CONTRACT_MONTHS[offer.length] ?? 12;
  return (offer.wage + perksPull(offer.perks)) * months;
}

/**
 * Whether she stays for the counter-offer (Part 3). `mood` is -1..+1 (her
 * morale and her club's form, utils/transfers.ts).
 */
export function staysForCounter(bidValue: number, counterValue: number, mood: number): { stays: boolean; close: boolean } {
  const close = Math.abs(counterValue - bidValue) <= COUNTER_OFFER.closeShare * bidValue;
  if (!close) return { stays: counterValue >= bidValue, close };
  return { stays: counterValue * (1 + COUNTER_OFFER.moraleWeight * mood) >= bidValue, close };
}

/**
 * Youth deals (Part 5, AC-6 A): any AI club's academy youth can be asked for, on
 * loan or to buy, at any time. A loan is always agreed (she can go for 6 or 12
 * months while her age allows it). A sale is the selling club's choice:
 *
 *   chance = scoutShare(buyer's scout skill) x position x plans x cash, at most maxChance
 *
 *   scoutShare  0 at `scoutFloor` skill or below (only a loan is offered), rising
 *               evenly to `scoutTopShare` at `scoutTop`
 *   position    the selling club's own youths past its youth team of 3: none
 *               spare `fewFactor`, one spare `oneSpareFactor`, two or more
 *               (many) `manyFactor`
 *   plans       she plays in its youth team: x `plansFactor`
 *   cash        its balance is below the AI clubs' reserve: x `cashFactor`
 *
 * The club's answer for a youth and a buyer holds for the week (`answerDays`):
 * asking again before then gets the same answer.
 */
export const YOUTH_DEALS = {
  scoutFloor: 40, scoutTop: 90, scoutTopShare: 0.8,
  fewFactor: 0.25, oneSpareFactor: 0.5, manyFactor: 1.0,
  plansFactor: 0.5, cashFactor: 1.5, maxChance: 0.95,
  answerDays: 7,
  /** AI clubs try this many youth buys a week (each at another AI club). */
  aiBuysPerWeek: 2,
} as const;

/** The youth team every academy plays (api-server utils/squadRules.ts ACADEMY_YOUTH_TEAM). */
const YOUTH_TEAM = 3;

/** The chance her club sells her to this buyer (0..maxChance). */
export function youthSaleChance(scoutSkill: number, ownYouths: number, inYouthTeam: boolean, needsCash: boolean): number {
  const d = YOUTH_DEALS;
  const scout = Math.max(0, Math.min(1, (scoutSkill - d.scoutFloor) / (d.scoutTop - d.scoutFloor))) * d.scoutTopShare;
  if (scout === 0) return 0;
  const spare = ownYouths - YOUTH_TEAM;
  const position = spare <= 0 ? d.fewFactor : spare === 1 ? d.oneSpareFactor : d.manyFactor;
  const chance = scout * position * (inYouthTeam ? d.plansFactor : 1) * (needsCash ? d.cashFactor : 1);
  return Math.min(d.maxChance, Math.round(chance * 1000) / 1000);
}
