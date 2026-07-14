/**
 * Double round-robin fixture generator for 6-team leagues.
 *
 * Algorithm: fix team index 0, rotate indices 1–5 across 5 rounds.
 * Rounds 1–5 = first leg; rounds 6–10 = second leg (home/away swapped).
 * Yields 3 matches per round × 10 rounds = 30 matches total.
 */

export type FixtureSlot = {
  round: number;
  homeIdx: number;
  awayIdx: number;
};

/**
 * Generate all 30 fixture slots for a 6-team double round-robin.
 * Team indices 0–5 map to the ordered team list for a given continent.
 */
export function generateDoubleRoundRobin(): FixtureSlot[] {
  const slots: FixtureSlot[] = [];
  const n = 6;

  // Build single round-robin (5 rounds × 3 matches) using circle method
  // Pin team 0, rotate teams 1..5 anti-clockwise each round
  const rotating = [1, 2, 3, 4, 5];

  for (let round = 1; round <= 5; round++) {
    const teams = [0, ...rotating];
    for (let i = 0; i < n / 2; i++) {
      const home = teams[i]!;
      const away = teams[n - 1 - i]!;
      slots.push({ round, homeIdx: home, awayIdx: away });
    }
    // Rotate: move last element to position 1
    rotating.unshift(rotating.pop()!);
  }

  // Second leg: swap home/away, rounds 6–10
  const firstLeg = slots.slice();
  for (const s of firstLeg) {
    slots.push({ round: s.round + 5, homeIdx: s.awayIdx, awayIdx: s.homeIdx });
  }

  return slots;
}
