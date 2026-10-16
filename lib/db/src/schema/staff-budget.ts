/**
 * 1.1.1, Part 11 (Rob, SB-1 to SB-5): the staff budget, every number once, for
 * the server (api-server utils/staffBudget.ts) and the pages (Finances, the
 * Staff and Medical markets, the Day 1 draft, the Rules). Pure data, no
 * imports: the client aliases this exact file ("@shared/staff-budget").
 *
 * A club's main sponsor (the sponsors' "primary" slot) sets its monthly staff
 * budget: all its staff and medical wages together must stay under it. On Day 1
 * and at each season's start the club chooses one of three main sponsor offers;
 * each has its own staff budget and its own bonus. The offers grow with the
 * club's success and money: its budget LEVEL moves each season.
 *
 * The first season's level (SB-3, measured on the shipped staff, monthly wages):
 *   a good Head Coach (skill 79, $14,583) + a good Physiotherapist (skill 81,
 *   $13,500) + two average staff (a median Fitness Trainer $5,554 and Massage
 *   Therapist $5,625) = $39,262: affordable. The two highest-paid staff (two
 *   Head Coaches at $20,000, $40,000 together) are not: $39,500 is 98.75% of
 *   their $40,000.
 */

export type MainSponsorBonus = "per_win" | "prize_share" | "finals";

export const STAFF_BUDGET = {
  /** A new club's budget level, a month. */
  firstSeason: 39_500,
  /** The level never goes below the first season's or above this. */
  max: 90_000,
  /** Each season the level moves by its World Tour finish (the best first). */
  finishSteps: [
    { rankAtMost: 4,  step: 0.30 },
    { rankAtMost: 8,  step: 0.20 },
    { rankAtMost: 16, step: 0.10 },
  ] as ReadonlyArray<{ rankAtMost: number; step: number }>,
  /** ...a poor season (no World Tour place, or below the field's top 16) takes it back a little... */
  poorSeasonStep: -0.05,
  /** ...and by its money at the season's end (the first match). */
  moneySteps: [
    { balanceAtLeast: 3_000_000, step: 0.10 },
    { balanceAtLeast: 1_000_000, step: 0.05 },
  ] as ReadonlyArray<{ balanceAtLeast: number; step: number }>,
  /**
   * The three offers: their share of the level as a staff budget, and their
   * bonus. The money bonuses grow with the level (value x level / firstSeason).
   */
  offers: [
    { bonus: "per_win" as MainSponsorBonus,     budgetShare: 1.00, value: 1_500 },
    { bonus: "prize_share" as MainSponsorBonus, budgetShare: 0.95, value: 0.25 },
    { bonus: "finals" as MainSponsorBonus,      budgetShare: 0.90, value: 150_000 },
  ],
} as const;

/** The next season's level from this one, the club's World Tour finish (null: no place) and its balance. */
export function nextStaffBudgetLevel(level: number, worldTourRank: number | null, balance: number): number {
  const b = STAFF_BUDGET;
  const finish = worldTourRank == null ? null : b.finishSteps.find((s) => worldTourRank <= s.rankAtMost);
  const money = b.moneySteps.find((s) => balance >= s.balanceAtLeast);
  const step = (finish ? finish.step : b.poorSeasonStep) + (money ? money.step : 0);
  return Math.round(Math.min(b.max, Math.max(b.firstSeason, level * (1 + step))) / 100) * 100;
}

export type MainSponsorTerms = { bonus: MainSponsorBonus; staffBudget: number; bonusValue: number };

/** The three offers' terms at a level (the sponsor's name and type come from the sponsor generator). */
export function mainSponsorTerms(level: number): MainSponsorTerms[] {
  const scale = level / STAFF_BUDGET.firstSeason;
  return STAFF_BUDGET.offers.map((o) => ({
    bonus: o.bonus,
    staffBudget: Math.round((level * o.budgetShare) / 100) * 100,
    bonusValue: o.bonus === "prize_share" ? o.value : Math.round((o.value * scale) / 100) * 100,
  }));
}

/** A bonus in plain words ("$1,500 a win", "25% on top of prize money", "$150,000 for reaching the World Finals"). */
export function bonusText(bonus: string | null | undefined, value: number | null | undefined): string {
  const v = Number(value ?? 0);
  if (bonus === "per_win") return `$${v.toLocaleString("en-US")} a win`;
  if (bonus === "prize_share") return `${Math.round(v * 100)}% on top of prize money`;
  if (bonus === "finals") return `$${v.toLocaleString("en-US")} for reaching the World Finals`;
  return "no bonus";
}
