/**
 * Overnight brief 30 Sep, item 24: a forfeited match has no score; every
 * results list shows "Forfeit" in its place. The club is always the home
 * side of its own matches, and a forfeit is always the club's loss.
 */
export function scoreText(m: { homeScore?: number | null; awayScore?: number | null; forfeit?: boolean | null }): string {
  return m.forfeit ? "Forfeit" : `${m.homeScore ?? 0} – ${m.awayScore ?? 0}`;
}
