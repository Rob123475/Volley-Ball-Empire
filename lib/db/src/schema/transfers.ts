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
