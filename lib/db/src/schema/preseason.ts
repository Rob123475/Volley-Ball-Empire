/**
 * Update 1, overnight brief part 5 (Rob, 14 Oct, item 5): the pre-season
 * camp, every number in one place, for the server (utils/preseasonCamp.ts)
 * and the Pre-season page.
 *
 * On day `choiceDay` of the off-season (the club's last match is day 1) the
 * club chooses: a camp, Rest or Skip. Seniors only; the academy carries on.
 *
 *   a camp      one of three locations, each building two stats (its sessions
 *               alternate between those stats' programmes), on one of three
 *               lengths: sessions through the shared XP rule times the
 *               length's XP multiplier, the cost from the club's balance
 *               (ledger "Pre-season camp"), and fatigue added at the end that
 *               carries into the season. It must end before the club's first
 *               match of the new season. No normal training while at camp.
 *   Rest        free; no training for the rest of the off-season; every
 *               senior who isn't injured starts the season with fitness 100,
 *               fatigue 0 and morale +5.
 *   Skip        nothing special.
 *
 * Pure data, no imports: the client aliases this exact file.
 */
export const PRESEASON_LOCATIONS = ["altitude", "power_house", "beach_academy"] as const;
export type PreseasonLocation = (typeof PRESEASON_LOCATIONS)[number];
export const PRESEASON_LENGTHS = ["1w", "2w", "4w"] as const;
export type PreseasonLength = (typeof PRESEASON_LENGTHS)[number];

export const PRESEASON = {
  choiceDay: 7,
  locations: {
    // Each stat's programme (lib PROGRAM_CONFIG): speed Agility Camp, stamina
    // Conditioning, power Power Camp, block Power Camp (no programme builds
    // block first; Power Camp builds it second), serve Serving Academy,
    // defense Defensive Systems.
    altitude:      { name: "Altitude Camp", builds: "speed + stamina",  programmes: ["Agility Camp", "Conditioning"],          stats: ["speed", "stamina"], morale: 0 },
    power_house:   { name: "Power House",   builds: "power + block",    programmes: ["Power Camp", "Power Camp"],              stats: ["power", "block"],   morale: 0 },
    beach_academy: { name: "Beach Academy", builds: "serve + defense, and teamwork (morale +5)", programmes: ["Serving Academy", "Defensive Systems"], stats: ["serve", "defense"], morale: 5 },
  } as Record<PreseasonLocation, { name: string; builds: string; programmes: readonly string[]; stats: readonly string[]; morale: number }>,
  lengths: {
    "1w": { label: "1 week",  days: 7,  sessions: 3,  xp: 1.5,  cost: 10_000, fatigue: 10 },
    "2w": { label: "2 weeks", days: 14, sessions: 6,  xp: 1.75, cost: 20_000, fatigue: 20 },
    "4w": { label: "4 weeks", days: 28, sessions: 12, xp: 2,    cost: 35_000, fatigue: 30 },
  } as Record<PreseasonLength, { label: string; days: number; sessions: number; xp: number; cost: number; fatigue: number }>,
  rest: { fitness: 100, fatigue: 0, morale: 5 },
  /** An AI club goes only if its balance is at least this many times the camp's cost (the 4a rule: three months of a wage in the bank). */
  aiAffordTimes: 3,
} as const;
