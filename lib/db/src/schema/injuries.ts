/**
 * Unity brief item 20: how long each injury keeps a player out, in weeks, as the
 * game rolls them (api-server utils/condition.ts rollInjury). The Medical page
 * had its own table (Minor 2, Major 6, Unavailable 12), twice the game's, so a
 * 1-week injury with 7 days left showed its treatment bar half done. Stated once
 * for the server and the Medical page.
 */
export const INJURY_WEEKS: Readonly<Record<string, number>> = {
  "Minor Injury": 1,
  "Major Injury": 3,
  Unavailable:    6,
};
