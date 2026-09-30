/**
 * Overnight brief 30 Sep, item 2: ONE measure of a manager's standing, one
 * wording, everywhere. The Manager Profile's stars ("Experienced Manager")
 * came from career_saves.manager_reputation, which nothing ever changed (50 for
 * everyone, so always 3 stars and a $6,000 salary), while the dashboard and the
 * Trophy Cabinet said "Level 1 Local Coach" from teams.manager_rep_points, which
 * wins, titles, facility upgrades and developing young players move. The moving
 * one is the measure; its levels are named here, once, for the server and every
 * page. Stars are the level (Level 1 = one star).
 */
export const MANAGER_LEVELS = [
  { level: 1, name: "Local Coach",       min: 0,    next: 100  },
  { level: 2, name: "Regional Coach",    min: 100,  next: 300  },
  { level: 3, name: "National Coach",    min: 300,  next: 700  },
  { level: 4, name: "World Class Coach", min: 700,  next: 1500 },
  { level: 5, name: "Legend",            min: 1500, next: null },
] as const;

export type ManagerLevel = (typeof MANAGER_LEVELS)[number];

export function managerLevelFor(points: number): ManagerLevel {
  return [...MANAGER_LEVELS].reverse().find((l) => points >= l.min) ?? MANAGER_LEVELS[0];
}

/**
 * The manager's salary, a season. It was 2,000 + 80 x manager_reputation, and
 * that reputation never moved, so every manager was paid $6,000 (Rob, 30 Sep:
 * "salary $6k/season"). Stated as the figure it always was.
 */
export const MANAGER_SALARY_PER_SEASON = 6_000;
