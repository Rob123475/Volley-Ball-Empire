/**
 * Overnight brief 30 Sep, item 13 (Rob, 30 Sep): how many youths a scouting
 * mission comes back with. Missions find youth only (14-18) and never more
 * than 4. Pure: no database, so the harness runs this very file.
 *
 * Rob's numbers for an average scout: 0 about 12%, 1 about 35%, 2 about 30%,
 * 3 about 15%, 4 about 8%. A better scout and a better Scouting Department
 * shift it (the top of both: a blank about 5%, more 3s and 4s); a weak scout,
 * the other way (a blank about 20%).
 *
 * The mission's quality q runs from -1 (weak) through 0 (average) to +1 (top):
 *   scout       s = (scouting rating - 60) / 30, held to -1..+1
 *                   (30 or less -1, 60 average 0, 90 or more +1)
 *   department  d = (level - 1) / 9: level 1 adds nothing, level 10 the most
 *   length      +0.1 for a 3-month mission, +0.2 for 6 months (longer
 *               missions cost more and watch more players)
 *   q = (s below 0: s; above: 0.75 s) + 0.5 d + length, held to -1..+1
 *       (a scout of 30 or less with a level-1 department: the weak table)
 * The odds are Rob's average ones moved in a straight line toward the weak
 * table as q falls to -1, or toward the top table as q rises to +1.
 * An average scout (60) with a level-1 department on a 1-month mission gets
 * exactly Rob's average odds.
 */
export const FIND_ODDS = {
  weak:    [0.20, 0.40, 0.25, 0.10, 0.05],
  average: [0.12, 0.35, 0.30, 0.15, 0.08],
  top:     [0.05, 0.20, 0.30, 0.27, 0.18],
} as const;
export const MAX_FOUND = 4;

export function missionQuality(scoutingRating: number, departmentLevel: number, durationMonths: number): number {
  const s = Math.max(-1, Math.min(1, (scoutingRating - 60) / 30));
  const d = Math.max(0, Math.min(1, (departmentLevel - 1) / 9));
  const length = durationMonths >= 6 ? 0.2 : durationMonths >= 3 ? 0.1 : 0;
  // A weak scout pulls her full weight down; a good one three-quarters of it up.
  return Math.max(-1, Math.min(1, (s < 0 ? s : 0.75 * s) + 0.5 * d + length));
}

/** The chance of finding 0, 1, 2, 3 or 4 youths, for a mission of quality q. */
export function findOdds(q: number): number[] {
  const toward = q >= 0 ? FIND_ODDS.top : FIND_ODDS.weak;
  const t = Math.abs(q);
  return FIND_ODDS.average.map((a, i) => a + (toward[i]! - a) * t);
}

/** How many she finds, from the odds and a uniform roll in [0, 1). */
export function rollFound(odds: readonly number[], roll: number): number {
  let acc = 0;
  for (let i = 0; i < odds.length; i++) { acc += odds[i]!; if (roll < acc) return i; }
  return MAX_FOUND;
}

/** How many players the scout watched: the number a blank report gives. */
export function playersWatched(durationMonths: number, roll: number): number {
  const [lo, hi] = durationMonths >= 6 ? [30, 50] : durationMonths >= 3 ? [18, 30] : [8, 14];
  return lo + Math.floor(roll * (hi - lo + 1));
}

/** A mission that found nobody says why. */
export function blankReport(scoutName: string, watched: number, region: string): string {
  return `${scoutName} watched ${watched} players in ${region}; none were good enough to recommend.`;
}
