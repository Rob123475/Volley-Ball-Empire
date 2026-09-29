/**
 * Unity brief item 10 (Rob, 29 Sep): the only way into a match is the MATCH DAY
 * box, on the day. The player may close it with its X without playing; the
 * dashboard's Next Match card then offers "Play match", which reopens the same
 * box, on that day only. Closing it only hides it: the match day stays pending
 * on the server, so the calendar cannot move on without the match.
 *
 * One value for the whole app: the pending match whose box the player closed.
 * A new match day (a different pending match) shows its box again.
 */
import { useSyncExternalStore } from "react";

let hiddenFor: number | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function hideMatchDayBox(matchId: number) { hiddenFor = matchId; notify(); }
export function showMatchDayBox() { hiddenFor = null; notify(); }

/** True when the player closed the box for this pending match. */
export function useMatchDayBoxHidden(pendingMatchId: number | null | undefined): boolean {
  const hidden = useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => hiddenFor,
  );
  return pendingMatchId != null && hidden === pendingMatchId;
}
