/**
 * Unity brief item 19 (Rob, 29 Sep: "no one trains in an instant"): how many
 * GAME days each training programme takes, approved by Rob on 29 Sep. A session
 * starts on the game date it is scheduled; its gains land when it finishes.
 * Stated once for the server (routes/training.ts) and the Training page.
 */
export const TRAINING_PROGRAM_DAYS: Readonly<Record<string, number>> = {
  "Power Camp":        7,
  "Agility Camp":      5,
  "Serving Academy":   5,
  "Defensive Systems": 5,
  "Conditioning":      7,
  "Recovery Program":  3,
};
