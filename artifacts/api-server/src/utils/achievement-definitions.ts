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

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  {
    key: "first_steps",
    name: "First Steps",
    description: "Win your first match.",
    category: "career",
    check: (team) => team.wins >= 1,
    progress: (team) => ({ current: Math.min(team.wins, 1), target: 1 }),
  },
  {
    key: "tournament_winner",
    name: "Tournament Winner",
    description: "Win your first tournament.",
    category: "competition",
    check: (team, stats) => stats.continentalTitles + team.titlesWon >= 1,
    progress: (team, stats) => ({ current: Math.min(stats.continentalTitles + team.titlesWon, 1), target: 1 }),
  },
  {
    key: "champion",
    name: "Champion",
    description: "Win your first league championship.",
    category: "competition",
    check: (team) => team.titlesWon >= 1,
    progress: (team) => ({ current: Math.min(team.titlesWon, 1), target: 1 }),
  },
  {
    key: "dynasty_begins",
    name: "Dynasty Begins",
    description: "Win 3 championships.",
    category: "competition",
    check: (team) => team.titlesWon >= 3,
    progress: (team) => ({ current: Math.min(team.titlesWon, 3), target: 3 }),
  },
  {
    key: "volleyball_empire",
    name: "Volleyball Empire",
    description: "Win 10 championships.",
    category: "competition",
    check: (team) => team.titlesWon >= 10,
    progress: (team) => ({ current: Math.min(team.titlesWon, 10), target: 10 }),
  },
  {
    key: "first_pay_day",
    name: "First Pay Day",
    description: "Reach $100,000 club balance.",
    category: "finance",
    check: (_t, stats) => stats.highestBalanceReached >= 100_000,
    progress: (_t, stats) => ({ current: Math.min(Math.round(stats.highestBalanceReached), 100_000), target: 100_000 }),
  },
  {
    key: "making_money",
    name: "Making Money",
    description: "Reach $1,000,000 club balance.",
    category: "finance",
    check: (_t, stats) => stats.highestBalanceReached >= 1_000_000,
    progress: (_t, stats) => ({ current: Math.min(Math.round(stats.highestBalanceReached), 1_000_000), target: 1_000_000 }),
  },
  {
    key: "debt_free",
    name: "Debt Free",
    description: "Complete a season with a positive balance and no outstanding loans.",
    category: "finance",
    check: (_t, stats) => stats.debtFreeSeasons >= 1,
    progress: (_t, stats) => ({ current: Math.min(stats.debtFreeSeasons, 1), target: 1 }),
  },
  {
    key: "talent_spotter",
    name: "Talent Spotter",
    description: "Sign your first youth player.",
    category: "youth",
    check: (_t, stats) => stats.youthSigned >= 1,
    progress: (_t, stats) => ({ current: Math.min(stats.youthSigned, 1), target: 1 }),
  },
  {
    key: "youth_graduate",
    name: "Youth Graduate",
    description: "Promote a youth player to the senior squad.",
    category: "youth",
    check: (_t, stats) => stats.youthPromoted >= 1,
    progress: (_t, stats) => ({ current: Math.min(stats.youthPromoted, 1), target: 1 }),
  },
  {
    key: "youth_factory",
    name: "Youth Factory",
    description: "Promote 10 youth players during your career.",
    category: "youth",
    check: (_t, stats) => stats.youthPromoted >= 10,
    progress: (_t, stats) => ({ current: Math.min(stats.youthPromoted, 10), target: 10 }),
  },
  {
    key: "future_superstar",
    name: "Future Superstar",
    description: "Develop a player to 5-star overall rating.",
    category: "youth",
    check: (_t, stats) => stats.playersDevelopedToFiveStar >= 1,
    progress: (_t, stats) => ({ current: Math.min(stats.playersDevelopedToFiveStar, 1), target: 1 }),
  },
  {
    key: "continental_champion",
    name: "Continental Champion",
    description: "Win a continental championship.",
    category: "competition",
    check: (_t, stats) => stats.continentalTitles >= 1,
    progress: (_t, stats) => ({ current: Math.min(stats.continentalTitles, 1), target: 1 }),
  },
  {
    key: "world_champion",
    name: "World Champion",
    description: "Win the World Championship.",
    category: "competition",
    check: (team) => team.titlesWon >= 3,
    progress: (team) => ({ current: Math.min(team.titlesWon, 3), target: 3 }),
  },
  {
    key: "olympic_gold",
    name: "Olympic Gold",
    description: "Win an Olympic Gold Medal.",
    category: "competition",
    check: (_t, stats) => stats.olympicGolds >= 1,
    progress: (_t, stats) => ({ current: Math.min(stats.olympicGolds, 1), target: 1 }),
  },
  {
    key: "perfect_season",
    name: "Perfect Season",
    description: "Win a championship season without losing a match.",
    category: "career",
    check: (_t, stats) => stats.perfectSeasons >= 1,
    progress: (_t, stats) => ({ current: Math.min(stats.perfectSeasons, 1), target: 1 }),
  },
  {
    key: "local_legend",
    name: "Local Legend",
    description: "Stay in the same town for 5 seasons.",
    category: "legacy",
    check: (_t, stats) => stats.seasonsInCurrentLocation >= 5,
    progress: (_t, stats) => ({ current: Math.min(stats.seasonsInCurrentLocation, 5), target: 5 }),
  },
  {
    key: "mr_loyalty",
    name: "Mr Loyalty",
    description: "Stay in the same town for 10 seasons.",
    category: "legacy",
    check: (_t, stats) => stats.seasonsInCurrentLocation >= 10,
    progress: (_t, stats) => ({ current: Math.min(stats.seasonsInCurrentLocation, 10), target: 10 }),
  },
  {
    key: "world_traveller",
    name: "World Traveller",
    // Target derived, not typed: this said "6" in three places while the club
    // picker was showing four, and nothing could tell which was right.
    description: `Manage teams on all ${CONTINENT_COUNT} continents.`,
    category: "legacy",
    check: (_t, stats) => stats.continentsVisited.length >= CONTINENT_COUNT,
    progress: (_t, stats) => ({
      current: Math.min(stats.continentsVisited.length, CONTINENT_COUNT),
      target:  CONTINENT_COUNT,
    }),
  },
  {
    key: "hall_of_fame",
    name: "Hall of Fame",
    description: "Reach 30 career seasons.",
    category: "legacy",
    check: (_t, stats) => stats.seasonsCompleted >= 30,
    progress: (_t, stats) => ({ current: Math.min(stats.seasonsCompleted, 30), target: 30 }),
  },

  // ── 10 new achievements ────────────────────────────────────────────────────

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
    key: "decade_in_sand",
    name: "Decade in the Sand",
    description: "Complete 10 seasons as a beach volleyball manager.",
    category: "legacy",
    check: (_t, stats) => stats.seasonsCompleted >= 10,
    progress: (_t, stats) => ({ current: Math.min(stats.seasonsCompleted, 10), target: 10 }),
  },
  {
    key: "veteran_coach",
    name: "Veteran Coach",
    description: "Complete 20 seasons on the beach circuit.",
    category: "legacy",
    check: (_t, stats) => stats.seasonsCompleted >= 20,
    progress: (_t, stats) => ({ current: Math.min(stats.seasonsCompleted, 20), target: 20 }),
  },
  {
    key: "globe_trotter",
    name: "Globe Trotter",
    description: "Manage teams on 4 different continents.",
    category: "legacy",
    check: (_t, stats) => stats.continentsVisited.length >= 4,
    progress: (_t, stats) => ({ current: Math.min(stats.continentsVisited.length, 4), target: 4 }),
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
    key: "financially_secure",
    name: "Financially Secure",
    description: "Complete 5 debt-free seasons.",
    category: "finance",
    check: (_t, stats) => stats.debtFreeSeasons >= 5,
    progress: (_t, stats) => ({ current: Math.min(stats.debtFreeSeasons, 5), target: 5 }),
  },
  {
    key: "youth_pipeline",
    name: "Talent Pipeline",
    description: "Sign 20 youth players across your career.",
    category: "youth",
    check: (_t, stats) => stats.youthSigned >= 20,
    progress: (_t, stats) => ({ current: Math.min(stats.youthSigned, 20), target: 20 }),
  },
  {
    key: "star_factory",
    name: "Star Factory",
    description: "Develop 3 players to a 5-star overall rating.",
    category: "youth",
    check: (_t, stats) => stats.playersDevelopedToFiveStar >= 3,
    progress: (_t, stats) => ({ current: Math.min(stats.playersDevelopedToFiveStar, 3), target: 3 }),
  },
  {
    key: "double_olympic_gold",
    name: "Back-to-Back Gold",
    description: "Win 2 Olympic Gold Medals.",
    category: "competition",
    check: (_t, stats) => stats.olympicGolds >= 2,
    progress: (_t, stats) => ({ current: Math.min(stats.olympicGolds, 2), target: 2 }),
  },
];
