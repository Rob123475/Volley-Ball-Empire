/**
 * Match engine — one model, shared by the instant "Sim Result" path and the
 * live tick engine, so watching a match and simulating it are statistically
 * the same event.
 *
 * WHAT THIS REPLACES
 * ------------------
 * The instant sim was:
 *
 *   homeScore = random(baseRoll) + (avgStat * weatherFactor > 70 ? 2 : 1)
 *   awayScore = random(baseRoll) + 1
 *
 * Squad quality entered as a binary +1, opponent strength was never loaded at
 * all, and the 70 threshold meant a 71-rated squad and a 69-rated one played
 * completely differently while a 71 and a 90 played identically. Win rate was
 * bimodal — about 33-40% below the threshold, 60-67% above — with nothing in
 * between and no floor beneath ~33%.
 *
 * THE MODEL
 * ---------
 * A rating difference becomes a small PER-POINT edge, and real volleyball sets
 * are then played out. Volleyball compounds a per-point edge hard — a 0.55
 * per-point edge is already an ~83% match win — so the mapping is deliberately
 * shallow: 0.00213 of per-point probability per rating point.
 *
 *   diff  0  -> 50%      diff 15 -> ~73%
 *   diff  5 -> ~58%      diff 20 -> ~79%
 *   diff 10 -> ~65%      diff 25 -> ~85%   diff 30 -> ~88%
 *
 * Smooth, no thresholds, and clamped so no gap is ever a guaranteed win: the
 * per-point probability is capped at 0.58, an ~93% ceiling. Upsets stay live.
 */

export const POINT_EDGE_PER_RATING = 0.00213;
export const POINT_P_MIN = 0.42;
export const POINT_P_MAX = 0.58;

/** Weather never penalises a side. It compresses the skill edge toward a coin
 *  flip, which is what chaotic conditions actually do: more upsets, not a
 *  weaker favourite. Capped at 0.20, i.e. at worst it removes a fifth of the
 *  rating edge. */
export const MAX_WEATHER_CHAOS = 0.20;

/** Modifier weights, in RATING POINTS, deliberately small next to a squad
 *  spread that runs ~66-92 (26 points end to end):
 *    home advantage  +1.5   (~ +2.5% win probability)
 *    form            +/-1 per win-streak step, capped +/-3 (~ +/-5%)   */
export const HOME_ADVANTAGE_RATING = 1.5;
export const FORM_RATING_PER_STREAK = 1;
export const FORM_RATING_CAP = 3;

export type RatedPlayer = {
  power: number; defense: number; serve: number;
  block: number; speed: number; stamina: number;
};

/** The same six-stat mean the UI shows as OVR. The old code averaged three
 *  stats here and four in the tick engine, so the two engines disagreed about
 *  what a squad was even worth. */
export function sideRating(players: RatedPlayer[]): number {
  if (players.length === 0) return 60;
  const total = players.reduce(
    (sum, p) => sum + p.power + p.defense + p.serve + p.block + p.speed + p.stamina,
    0,
  );
  return total / (players.length * 6);
}

/** Stable pseudo-random offset in [-spread, +spread] derived from a name, so a
 *  given opponent is consistently a little stronger or weaker than its tier
 *  rather than being re-rolled every time it is met. */
export function nameVariance(name: string, spread = 4): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  const unit = ((h >>> 0) % 1000) / 1000;      // 0..1
  return (unit * 2 - 1) * spread;
}

/** Difficulty ladder for World Tour opponents, which exist only as a name on
 *  the fixture row — there is no opponent team entity to load. The tier is the
 *  game's own difficulty signal (it already drives the prize ladder), so it is
 *  what sets the band. */
const TIER_BASE_RATING: Record<string, number> = {
  "Bronze":            64,
  "Silver":            70,
  "Gold":              76,
  "Continental Final": 80,
  "World Semi Final":  82,
  "World Final":       86,
};

/**
 * How much every tier stiffens per season.
 *
 * TIER_BASE_RATING was constant across the whole arc, so every tier stayed at
 * its season-one difficulty while the player's ceiling rose — the senior pool
 * ends the arc able to field an 89.5 squad against a Bronze field rated 64.
 * The game got monotonically easier by construction, and I8 could not hold.
 *
 * k = 2 takes Bronze 64 -> 72 and the World Final 86 -> 94 across the first
 * five seasons; the curve keeps climbing for as long as the career runs.
 * Still favours a well-run club; it just stops the curve flattening.
 *
 * NOTE: this fixes EASING, not farming. Nothing here stops a club entering 30
 * Bronze events a season forever — that is tier qualification gating, which is
 * Phase 2. A green I8 is not evidence the difficulty curve is solved.
 */
export const TIER_RATING_PER_SEASON = 2;

export function opponentRatingFromTier(
  tier: string | null | undefined,
  opponentName: string,
  seasonNumber = 1,
): number {
  const base = TIER_BASE_RATING[tier ?? ""] ?? 70;
  const progression = (Math.max(1, seasonNumber) - 1) * TIER_RATING_PER_SEASON;
  return clampRating(base + progression + nameVariance(opponentName));
}

export function clampRating(r: number): number {
  return Math.min(99, Math.max(30, r));
}

export type MatchModifiers = {
  /** true when the player's club is the home side */
  homeAdvantage?: boolean;
  /** current win streak, used for a small form bump */
  winStreak?: number;
  /** getWeatherEffects(...).performancePenalty */
  weatherPenalty?: number;
};

/**
 * Effective rating difference (home minus away) after modifiers.
 * Kept separate from the probability so it can be logged and tested.
 */
export function effectiveRatingDiff(
  homeRating: number,
  awayRating: number,
  mods: MatchModifiers = {},
): number {
  let diff = homeRating - awayRating;
  if (mods.homeAdvantage) diff += HOME_ADVANTAGE_RATING;
  if (mods.winStreak && mods.winStreak > 0) {
    diff += Math.min(FORM_RATING_CAP, mods.winStreak * FORM_RATING_PER_STREAK);
  }
  return diff;
}

/** Per-point win probability for the home side. */
export function pointProbability(
  homeRating: number,
  awayRating: number,
  mods: MatchModifiers = {},
): number {
  const diff = effectiveRatingDiff(homeRating, awayRating, mods);
  let p = 0.5 + diff * POINT_EDGE_PER_RATING;
  p = Math.min(POINT_P_MAX, Math.max(POINT_P_MIN, p));

  const chaos = Math.min(MAX_WEATHER_CHAOS, Math.max(0, mods.weatherPenalty ?? 0));
  return 0.5 + (p - 0.5) * (1 - chaos);
}

export type SetScore = { home: number; away: number };
export type MatchResult = {
  /** sets won — this is what matches.home_score / away_score store */
  homeScore: number;
  awayScore: number;
  sets: SetScore[];
  homeWon: boolean;
};

/**
 * Rob, 29 Sep (Unity match brief): one format everywhere, the 3D court and
 * this engine alike: best of 3 sets, EVERY set to 11, win by 2. It was 21, 21
 * and a deciding 15; the court played its own 21-point, two-halves match.
 * The court's copy is Unity's Assets/Scripts/PointModel.cs, and
 * harness/one-set-of-odds.mjs holds the two to the same results.
 */
export const POINTS_TO_WIN_SET = 11;

export function pointTarget(_setNumber: number): number {
  return POINTS_TO_WIN_SET;
}

/** A set, played on from `from` until one side has the target with a lead of two. No cap: a deuce ends with probability 1. */
function playSet(pPoint: number, target: number, from: SetScore = { home: 0, away: 0 }): SetScore {
  let home = from.home, away = from.away;
  for (;;) {
    if (home >= target && home - away >= 2) break;
    if (away >= target && away - home >= 2) break;
    if (Math.random() < pPoint) home++; else away++;
  }
  return { home, away };
}

/**
 * A finished set that could really happen: 11 against 9 or fewer, or, past
 * 10-10, a lead of exactly two.
 */
export function isLegalSet(home: number, away: number): boolean {
  const w = Math.max(home, away), l = Math.min(home, away);
  if (!Number.isInteger(home) || !Number.isInteger(away) || l < 0) return false;
  if (w < POINTS_TO_WIN_SET) return false;
  if (w === POINTS_TO_WIN_SET) return l <= POINTS_TO_WIN_SET - 2;
  return w - l === 2;
}

/**
 * Play a best-of-three match at a fixed per-point probability.
 * Scorelines come out as real volleyball (11-7, 13-11) rather than numbers
 * that expose the roll.
 */
export function simulateMatch(pPoint: number): MatchResult {
  return finishMatchFrom(pPoint, [], { home: 0, away: 0 });
}

/**
 * Unity brief item 4: finish a match from a score part-way through: the sets
 * already finished, and the points of the set in play. A watched match the
 * player leaves early is completed this way, from the last score the 3D court
 * sent, at the same per-point chance. From 0-0 it is simulateMatch.
 */
export function finishMatchFrom(pPoint: number, finished: SetScore[], current: SetScore): MatchResult {
  const sets: SetScore[] = finished.map((s) => ({ ...s }));
  let homeSets = sets.filter((s) => s.home > s.away).length;
  let awaySets = sets.length - homeSets;
  let from = { ...current };
  while (homeSets < 2 && awaySets < 2) {
    const s = playSet(pPoint, pointTarget(sets.length + 1), from);
    sets.push(s);
    if (s.home > s.away) homeSets++; else awaySets++;
    from = { home: 0, away: 0 };
  }
  return { homeScore: homeSets, awayScore: awaySets, sets, homeWon: homeSets > awaySets };
}

/** A whole result that could really happen: 2 or 3 legal sets, the match decided by the last. */
export function isLegalResult(sets: SetScore[]): boolean {
  if (!Array.isArray(sets) || sets.length < 2 || sets.length > 3) return false;
  let h = 0, a = 0;
  for (const s of sets) {
    if (h === 2 || a === 2) return false;
    if (!isLegalSet(s?.home, s?.away)) return false;
    if (s.home > s.away) h++; else a++;
  }
  return h === 2 || a === 2;
}

/** A score part-way through: finished sets legal and undecided, and the set in play not yet won. */
export function isLegalProgress(finished: SetScore[], current: SetScore): boolean {
  if (!Array.isArray(finished) || finished.length > 2) return false;
  let h = 0, a = 0;
  for (const s of finished) {
    if (!isLegalSet(s?.home, s?.away)) return false;
    if (s.home > s.away) h++; else a++;
  }
  if (h === 2 || a === 2) return false;
  const { home, away } = current ?? ({} as SetScore);
  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) return false;
  const won = (x: number, y: number) => x >= POINTS_TO_WIN_SET && x - y >= 2;
  if (won(home, away) || won(away, home)) return false;
  // Past 10-10 the lead can never be more than one while the set is open.
  if (home >= POINTS_TO_WIN_SET && away >= POINTS_TO_WIN_SET && Math.abs(home - away) > 1) return false;
  return true;
}
