/**
 * Update 1, item 3 (Rob, 14 Oct): the AI clubs' seniors train.
 *
 * Every AI club's seniors each get one training session in the weekly block
 * (utils/aiSquads.ts aiSeniorsTrainWeekTx), through the player's own XP rule
 * (utils/trainingXp.ts). This file holds the parts that are rules only (no
 * database): how often, and which programme.
 */

/**
 * AI seniors train in the weeks whose career week number is a multiple of
 * this. One knob for item 6 (Easy = 4, Hard = 1); nothing reads difficulty yet.
 */
export const AI_TRAIN_EVERY_WEEKS = 1;

/** The career's week number on `today`: whole weeks since its first season began. */
export function careerWeekOf(careerStart: string, today: string): number {
  const days = Math.round((Date.parse(`${today.slice(0, 10)}T00:00:00Z`) - Date.parse(`${careerStart.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
  return Math.floor(days / 7);
}

/** Whether the AI seniors train in this career week. */
export function aiTrainsThisWeek(careerWeek: number, every: number = AI_TRAIN_EVERY_WEEKS): boolean {
  return careerWeek % every === 0;
}

/**
 * The programme an AI senior trains: the one whose primary stat is her lowest
 * of power, speed, defense, serve and block (ties in that order). No programme
 * has block as its primary stat; a senior whose lowest is block trains Power
 * Camp, which trains block as its secondary (Rob, 14 Oct, 1A). Never
 * Conditioning or Recovery.
 */
const PROGRAMME_FOR: ReadonlyArray<[stat: "power" | "speed" | "defense" | "serve" | "block", programme: string]> = [
  ["power", "Power Camp"],
  ["speed", "Agility Camp"],
  ["defense", "Defensive Systems"],
  ["serve", "Serving Academy"],
  ["block", "Power Camp"],
];

export function aiProgrammeFor(p: { power: number; speed: number; defense: number; serve: number; block: number }): string {
  let lowest = PROGRAMME_FOR[0]!;
  for (const entry of PROGRAMME_FOR) if (p[entry[0]] < p[lowest[0]]) lowest = entry;
  return lowest[1];
}
