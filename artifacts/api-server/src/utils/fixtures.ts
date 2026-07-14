/**
 * Double round-robin fixture generator for 6-team leagues.
 *
 * Algorithm: fix team index 0, rotate indices 1–5 across 5 rounds.
 * Rounds 1–5 = first leg; rounds 6–10 = second leg (home/away swapped).
 * Guarantees: every pair appears exactly twice (once home, once away),
 * no team plays itself, no team plays twice in the same round,
 * every round has exactly 3 matches.
 */

export type FixtureSlot = {
  round: number;
  home: number;
  away: number;
};

/**
 * Generate all 30 fixture slots for a 6-team double round-robin.
 * @param teamIds – ordered array of exactly 6 pool team IDs
 * @returns array of 30 {round, home, away} objects using the real team IDs
 */
export function generateDoubleRoundRobin(teamIds: number[]): FixtureSlot[] {
  if (teamIds.length !== 6) {
    throw new Error(`generateDoubleRoundRobin requires exactly 6 teams, got ${teamIds.length}`);
  }

  const slots: FixtureSlot[] = [];
  const n = 6;

  // Circle method: pin index 0, rotate indices 1..5 anti-clockwise each round
  const rotating = [1, 2, 3, 4, 5];

  for (let round = 1; round <= 5; round++) {
    const indices = [0, ...rotating];
    for (let i = 0; i < n / 2; i++) {
      const homeIdx = indices[i]!;
      const awayIdx = indices[n - 1 - i]!;
      slots.push({ round, home: teamIds[homeIdx]!, away: teamIds[awayIdx]! });
    }
    // Rotate: move last element to position 1 (anti-clockwise)
    rotating.unshift(rotating.pop()!);
  }

  // Second leg: swap home/away, rounds 6–10
  const firstLeg = slots.slice();
  for (const s of firstLeg) {
    slots.push({ round: s.round + 5, home: s.away, away: s.home });
  }

  // ── Inline validation (runs only in test mode) ─────────────────────────────
  if (process.env.RUN_TESTS) {
    // Every round has exactly 3 matches
    for (let r = 1; r <= 10; r++) {
      const rMatches = slots.filter(s => s.round === r);
      if (rMatches.length !== 3) throw new Error(`Round ${r} has ${rMatches.length} matches (expected 3)`);

      // No team plays twice in the same round
      const roundTeams = new Set<number>();
      for (const m of rMatches) {
        if (roundTeams.has(m.home)) throw new Error(`Team ${m.home} plays twice in round ${r}`);
        if (roundTeams.has(m.away)) throw new Error(`Team ${m.away} plays twice in round ${r}`);
        roundTeams.add(m.home);
        roundTeams.add(m.away);
      }
    }

    // Every pair appears exactly twice (once each direction)
    for (let i = 0; i < teamIds.length; i++) {
      for (let j = i + 1; j < teamIds.length; j++) {
        const a = teamIds[i]!;
        const b = teamIds[j]!;
        const ab = slots.filter(s => s.home === a && s.away === b).length;
        const ba = slots.filter(s => s.home === b && s.away === a).length;
        if (ab !== 1 || ba !== 1) throw new Error(`Pair (${a},${b}) appears ${ab}+${ba} times (expected 1+1)`);
      }
      // No self-play
      const selfPlay = slots.filter(s => s.home === teamIds[i] && s.away === teamIds[i]).length;
      if (selfPlay > 0) throw new Error(`Team ${teamIds[i]} plays itself`);
    }

    console.log("generateDoubleRoundRobin: all assertions passed");
  }

  return slots;
}
