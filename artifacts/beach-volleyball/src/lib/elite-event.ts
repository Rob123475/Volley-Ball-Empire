/**
 * Trademark cleanup (19 Oct): a youth's rare scouting event is stored and sent
 * as "Olympic Wonderkid" (DB values, API enum), but the word Olympic must not
 * be shown. This is what the card says instead.
 */
const ELITE_EVENT_LABELS: Record<string, string> = {
  "Olympic Wonderkid": "Nations Cup Wonderkid",
};

export function eliteEventLabel(event: string): string {
  return ELITE_EVENT_LABELS[event] ?? event;
}
