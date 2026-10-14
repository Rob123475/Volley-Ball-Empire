/**
 * Update 1, overnight brief part 6 (Rob, 14 Oct, item 6): the game's
 * difficulty, Easy / Medium / Hard, picked in the new-career wizards beside
 * Underdog / Established (career-difficulty.ts, the starting money) and fixed
 * for the career. Nobody's player ratings change; it sets how hard the AI
 * clubs work:
 *
 *   aiTrainEveryWeeks  the AI clubs' seniors train in 1 career week of this
 *                      many (utils/aiTraining.ts aiTrainsThisWeek)
 *   aiCamp             whether an AI club goes to a pre-season camp
 *                      (utils/preseasonCamp.ts): never, a coin flip each (if it
 *                      can afford one), or every club that can afford one
 *
 * A career made before this is Medium. Pure data, no imports: the client
 * aliases this exact file.
 */
export const GAME_DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type GameDifficulty = (typeof GAME_DIFFICULTIES)[number];

export const GAME_DIFFICULTY: Record<GameDifficulty, {
  label: string; aiTrainEveryWeeks: number; aiCamp: "never" | "coin" | "always"; blurb: string;
}> = {
  easy:   { label: "Easy",   aiTrainEveryWeeks: 4, aiCamp: "never",  blurb: "AI clubs train every 4 weeks and never go to a pre-season camp." },
  medium: { label: "Medium", aiTrainEveryWeeks: 2, aiCamp: "coin",   blurb: "AI clubs train every 2 weeks; about half go to a pre-season camp, if they can afford one." },
  hard:   { label: "Hard",   aiTrainEveryWeeks: 1, aiCamp: "always", blurb: "AI clubs train every week, and every club that can afford one goes to a pre-season camp." },
};

export const DEFAULT_GAME_DIFFICULTY: GameDifficulty = "medium";

/** The career's difficulty from its stored value (null: a career made before this, Medium). */
export function gameDifficultyOf(v: string | null | undefined): GameDifficulty {
  return (GAME_DIFFICULTIES as readonly string[]).includes(v ?? "") ? (v as GameDifficulty) : DEFAULT_GAME_DIFFICULTY;
}
