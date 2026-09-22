import { CONTINENT_COUNT } from "@workspace/db";
import type { Team, CareerStats } from "@workspace/db";

export type AchievementCategory = "career" | "finance" | "youth" | "competition" | "legacy";

export type AchievementDef = {
  key: string;
  name: string;
  description: string;
  category: AchievementCategory;
  check: (team: Team, stats: CareerStats) => boolean;
  progress: (team: Team, stats: CareerStats) => { current: number; target: number };
};

/**
 * R-77: every description says what actually unlocks it. A career has no
 * fixed length (L-01): it runs until the board ends it, with an Olympic Games
 * every fourth year from 2028. R-77 deleted eight achievements while careers
 * were capped at five seasons; L-01 step 4 restores the six the cap alone had
 * made unreachable ("10 seasons", "20 seasons", "30 seasons", "10 World
 * Finals", "2 Olympic golds" and "10 seasons with the same club"). Still out,
 * pending Rob's definition:
 *   - "Continental Champion": the player's club never plays a continental
 *     tournament, and no match is a continental final.
 *   - "First Pay Day" ($100,000): every new career starts above it.
 * A match counts whether it was simulated or watched to the end
 * (routes/matches.ts completeMatch).
 */
export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  // ── Career ────────────────────────────────────────────────────────────────
  {
    key: "first_steps",
    name: "First Steps",
    description: "Win your first match.",
    category: "career",
    check: (team) => team.wins >= 1,
    progress: (team) => ({ current: Math.min(team.wins, 1), target: 1 }),
  },
  {
    key: "battle_hardened",
    name: "Battle Hardened",
    description: "Win 50 matches across your career.",
    category: "career",
    check: (_t, stats) => stats.matchesWon >= 50,
    progress: (_t, stats) => ({ current: Math.min(stats.matchesWon, 50), target: 50 }),
  },
  {
    key: "century_wins",
    name: "Century Club",
    description: "Win 100 matches across your career.",
    category: "career",
    check: (_t, stats) => stats.matchesWon >= 100,
    progress: (_t, stats) => ({ current: Math.min(stats.matchesWon, 100), target: 100 }),
  },
  {
    key: "perfect_season",
    name: "Perfect Season",
    description: "Win the World Final in a season in which you lost no match.",
    category: "career",
    check: (_t, stats) => stats.perfectSeasons >= 1,
    progress: (_t, stats) => ({ current: Math.min(stats.perfectSeasons, 1), target: 1 }),
  },

  // ── Competition ───────────────────────────────────────────────────────────
  {
    key: "tournament_winner",
    name: "Tournament Winner",
    description: "Win a Gold-tier World Tour event.",
    category: "competition",
    check: (_t, stats) => stats.goldEventsWon >= 1,
    progress: (_t, stats) => ({ current: Math.min(stats.goldEventsWon, 1), target: 1 }),
  },
  {
    key: "champion",
    name: "Champion",
    description: "Win the World Final.",
    category: "competition",
    check: (team) => team.titlesWon >= 1,
    progress: (team) => ({ current: Math.min(team.titlesWon, 1), target: 1 }),
  },
  {
    key: "world_champion",
    name: "World Champion",
    // One World Final a season, so two titles are two different seasons.
    description: "Win the World Final in two different seasons.",
    category: "competition",
    check: (team) => team.titlesWon >= 2,
    progress: (team) => ({ current: Math.min(team.titlesWon, 2), target: 2 }),
  },
  {
    key: "dynasty_begins",
    name: "Dynasty Begins",
    description: "Win the World Final three times.",
    category: "competition",
    check: (team) => team.titlesWon >= 3,
    progress: (team) => ({ current: Math.min(team.titlesWon, 3), target: 3 }),
  },
  {
    // L-01: restored from R-77 (def721c~1), same key and name; the text follows
    // R-77's "World Final" wording. titlesWon moves on a World Final win.
    key: "volleyball_empire",
    name: "Beach Volleyball Empire",
    description: "Win the World Final ten times.",
    category: "competition",
    check: (team) => team.titlesWon >= 10,
    progress: (team) => ({ current: Math.min(team.titlesWon, 10), target: 10 }),
  },
  {
    key: "olympic_gold",
    name: "Olympic Gold",
    description: "Have a player from your club win Olympic gold.",
    category: "competition",
    check: (_t, stats) => stats.olympicGolds >= 1,
    progress: (_t, stats) => ({ current: Math.min(stats.olympicGolds, 1), target: 1 }),
  },
  {
    // L-01: restored from R-77. The Games are every fourth year (2028, 2032,
    // 2036, ...), so two golds need a career at least seven seasons long.
    key: "double_olympic_gold",
    name: "Back-to-Back Gold",
    description: "Have players from your club win Olympic gold at two Games.",
    category: "competition",
    check: (_t, stats) => stats.olympicGolds >= 2,
    progress: (_t, stats) => ({ current: Math.min(stats.olympicGolds, 2), target: 2 }),
  },

  // ── Finance ───────────────────────────────────────────────────────────────
  {
    key: "making_money",
    name: "Making Money",
    description: "Reach a club balance of $1,000,000.",
    category: "finance",
    check: (_t, stats) => stats.highestBalanceReached >= 1_000_000,
    progress: (_t, stats) => ({ current: Math.min(Math.round(stats.highestBalanceReached), 1_000_000), target: 1_000_000 }),
  },
  {
    key: "millionaires_club",
    name: "Millionaire's Club",
    description: "Reach a club balance of $5,000,000.",
    category: "finance",
    check: (_t, stats) => stats.highestBalanceReached >= 5_000_000,
    progress: (_t, stats) => ({ current: Math.min(Math.round(stats.highestBalanceReached), 5_000_000), target: 5_000_000 }),
  },
  {
    key: "debt_free",
    name: "Debt Free",
    description: "Win the World Final with the club's balance above $0.",
    category: "finance",
    check: (_t, stats) => stats.debtFreeSeasons >= 1,
    progress: (_t, stats) => ({ current: Math.min(stats.debtFreeSeasons, 1), target: 1 }),
  },
  {
    key: "financially_secure",
    name: "Financially Secure",
    description: "Win the World Final five times with the club's balance above $0.",
    category: "finance",
    check: (_t, stats) => stats.debtFreeSeasons >= 5,
    progress: (_t, stats) => ({ current: Math.min(stats.debtFreeSeasons, 5), target: 5 }),
  },

  // ── Youth ─────────────────────────────────────────────────────────────────
  {
    key: "talent_spotter",
    name: "Talent Spotter",
    description: "Sign a youth prospect found by scouting. The yearly academy intake does not count.",
    category: "youth",
    check: (_t, stats) => stats.youthSigned >= 1,
    progress: (_t, stats) => ({ current: Math.min(stats.youthSigned, 1), target: 1 }),
  },
  {
    key: "youth_pipeline",
    name: "Talent Pipeline",
    description: "Sign 20 youth prospects found by scouting. The yearly academy intake does not count.",
    category: "youth",
    check: (_t, stats) => stats.youthSigned >= 20,
    progress: (_t, stats) => ({ current: Math.min(stats.youthSigned, 20), target: 20 }),
  },
  {
    key: "youth_graduate",
    name: "Youth Graduate",
    description: "Promote an academy player to starter or interchange.",
    category: "youth",
    check: (_t, stats) => stats.youthPromoted >= 1,
    progress: (_t, stats) => ({ current: Math.min(stats.youthPromoted, 1), target: 1 }),
  },
  {
    key: "youth_factory",
    name: "Youth Factory",
    description: "Promote 10 academy players to starter or interchange.",
    category: "youth",
    check: (_t, stats) => stats.youthPromoted >= 10,
    progress: (_t, stats) => ({ current: Math.min(stats.youthPromoted, 10), target: 10 }),
  },
  {
    key: "future_superstar",
    name: "Future Superstar",
    description: "Have a player in your squad whose peak rating reaches 85.",
    category: "youth",
    check: (_t, stats) => stats.playersDevelopedToFiveStar >= 1,
    progress: (_t, stats) => ({ current: Math.min(stats.playersDevelopedToFiveStar, 1), target: 1 }),
  },
  {
    key: "star_factory",
    name: "Star Factory",
    description: "Have 3 players in your squad whose peak rating reaches 85.",
    category: "youth",
    check: (_t, stats) => stats.playersDevelopedToFiveStar >= 3,
    progress: (_t, stats) => ({ current: Math.min(stats.playersDevelopedToFiveStar, 3), target: 3 }),
  },

  // ── Legacy ────────────────────────────────────────────────────────────────
  {
    key: "local_legend",
    name: "Local Legend",
    // There is no job market: every season of a career is at the same club.
    description: "Complete 5 seasons with the same club.",
    category: "legacy",
    check: (_t, stats) => stats.seasonsCompleted >= 5,
    progress: (_t, stats) => ({ current: Math.min(stats.seasonsCompleted, 5), target: 5 }),
  },
  {
    // L-01: restored from R-77, reworded the way R-77 reworded Local Legend
    // (its old counter, seasonsInCurrentLocation, never moved and is gone).
    key: "mr_loyalty",
    name: "Mr Loyalty",
    description: "Complete 10 seasons with the same club.",
    category: "legacy",
    check: (_t, stats) => stats.seasonsCompleted >= 10,
    progress: (_t, stats) => ({ current: Math.min(stats.seasonsCompleted, 10), target: 10 }),
  },
  {
    // L-01: restored from R-77, unchanged.
    key: "decade_in_sand",
    name: "Decade in the Sand",
    description: "Complete 10 seasons as a beach volleyball manager.",
    category: "legacy",
    check: (_t, stats) => stats.seasonsCompleted >= 10,
    progress: (_t, stats) => ({ current: Math.min(stats.seasonsCompleted, 10), target: 10 }),
  },
  {
    // L-01: restored from R-77, unchanged.
    key: "veteran_coach",
    name: "Veteran Coach",
    description: "Complete 20 seasons on the beach circuit.",
    category: "legacy",
    check: (_t, stats) => stats.seasonsCompleted >= 20,
    progress: (_t, stats) => ({ current: Math.min(stats.seasonsCompleted, 20), target: 20 }),
  },
  {
    // L-01: restored from R-77, unchanged. The reason the cap had to go.
    key: "hall_of_fame",
    name: "Hall of Fame",
    description: "Reach 30 career seasons.",
    category: "legacy",
    check: (_t, stats) => stats.seasonsCompleted >= 30,
    progress: (_t, stats) => ({ current: Math.min(stats.seasonsCompleted, 30), target: 30 }),
  },
  {
    key: "world_traveller",
    name: "World Traveller",
    description: `Play matches on ${CONTINENT_COUNT} continents.`,
    category: "legacy",
    check: (_t, stats) => stats.continentsVisited.length >= CONTINENT_COUNT,
    progress: (_t, stats) => ({
      current: Math.min(stats.continentsVisited.length, CONTINENT_COUNT),
      target:  CONTINENT_COUNT,
    }),
  },
  {
    key: "globe_trotter",
    name: "Globe Trotter",
    description: "Play matches on 4 continents.",
    category: "legacy",
    check: (_t, stats) => stats.continentsVisited.length >= 4,
    progress: (_t, stats) => ({ current: Math.min(stats.continentsVisited.length, 4), target: 4 }),
  },
];
