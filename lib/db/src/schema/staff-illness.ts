/**
 * Final brief 5 Oct, Part B: staff and medical staff fall ill or get hurt too.
 *
 *   "Build it the same way as the player injury system, with these differences:
 *    half as often as players get injured; half the recovery time (staff only
 *    need to walk, not play at athletic standard); real-life causes, a mix of
 *    illness and accidents. Recovery is in game days, scaled to the cause."
 *
 * One table for the server (the daily roll, utils/staffIllness.ts), the Staff
 * and Medical pages (the "Off: flu, back in 4 days" badge) and Club News.
 */
import { INJURY_WEEKS } from "./injuries";

export type StaffAbsenceCause = {
  key: string;
  /** Illness or accident (Rob's "a mix of illness and accidents"). */
  kind: "illness" | "accident";
  /** For the badge: "Off: flu, back in 4 days". */
  short: string;
  /** For Club News: "Maria Lopez (Physiotherapist) caught the flu". */
  news: string;
  /** Game days off, scaled to the cause. */
  days: number;
  /** How often this is the cause, out of the table's total. */
  weight: number;
};

export const STAFF_ABSENCE_CAUSES: readonly StaffAbsenceCause[] = [
  { key: "cold",           kind: "illness",  short: "a cold",            news: "came down with a cold",                    days: 3,  weight: 24 },
  { key: "flu",            kind: "illness",  short: "flu",               news: "caught the flu",                           days: 7,  weight: 18 },
  { key: "gastro",         kind: "illness",  short: "gastro",            news: "went down with gastro",                    days: 3,  weight: 14 },
  { key: "food_poisoning", kind: "illness",  short: "food poisoning",    news: "has food poisoning",                       days: 2,  weight: 10 },
  { key: "tonsillitis",    kind: "illness",  short: "tonsillitis",       news: "has tonsillitis",                          days: 7,  weight: 5 },
  { key: "ankle",          kind: "accident", short: "a sprained ankle",  news: "sprained an ankle playing with the kids",  days: 10, weight: 10 },
  { key: "back",           kind: "accident", short: "a bad back",        news: "threw their back out",                     days: 7,  weight: 10 },
  { key: "knee",           kind: "accident", short: "a twisted knee",    news: "twisted a knee at the gym",                days: 12, weight: 6 },
  { key: "broken_leg",     kind: "accident", short: "a broken leg",      news: "broke a leg skiing",                       days: 42, weight: 3 },
];

export function staffAbsenceCause(key: string | null | undefined): StaffAbsenceCause | null {
  return STAFF_ABSENCE_CAUSES.find((c) => c.key === key) ?? null;
}

/**
 * How often a player is injured, per player and game day on a club's books.
 * Measured on 5 Oct over four runs of a new career (26 seasons in all, Sydney
 * Riptide, every match simmed, the squad as the game left it): 164 injuries in
 * about 48,100 player game-days. Single runs swing (2.3 to 5.2 per 1,000:
 * fatigue, who plays, the weather), which is why the figure is pooled.
 * harness/staff-injuries.mjs measures staff against it on every run.
 */
export const PLAYER_INJURIES_PER_PLAYER_DAY = 164 / 48092;

/** Half as often as players: the chance, each game day, that one member of staff goes off. */
export const STAFF_ABSENCE_DAILY_CHANCE = PLAYER_INJURIES_PER_PLAYER_DAY / 2;

/** The players' injury table's average time out, in days (utils/condition.ts rollInjury's odds). */
export const PLAYER_INJURY_MEAN_DAYS =
  7 * (0.65 * INJURY_WEEKS["Minor Injury"]! + 0.30 * INJURY_WEEKS["Major Injury"]! + 0.05 * INJURY_WEEKS.Unavailable!);

/** The staff table's average time out, in days: about half the players'. */
export const STAFF_ABSENCE_MEAN_DAYS =
  STAFF_ABSENCE_CAUSES.reduce((s, c) => s + c.days * c.weight, 0) / STAFF_ABSENCE_CAUSES.reduce((s, c) => s + c.weight, 0);

/** "Off: flu, back in 4 days" (the Staff and Medical pages' badge). */
export function staffAbsenceBadge(causeKey: string | null | undefined, daysLeft: number): string | null {
  const c = staffAbsenceCause(causeKey);
  if (!c || daysLeft <= 0) return null;
  return `Off: ${c.short}, back in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
}

/** On duty: not off ill or hurt. Only on-duty staff give their bonus. */
export function staffOnDuty(s: { offDaysLeft?: number | null }): boolean {
  return (s.offDaysLeft ?? 0) <= 0;
}
