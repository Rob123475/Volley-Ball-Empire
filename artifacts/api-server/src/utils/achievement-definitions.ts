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
    description: "Manage teams on all 6 continents.",
    category: "legacy",
    check: (_t, stats) => stats.continentsVisited.length >= 6,
    progress: (_t, stats) => ({ current: Math.min(stats.continentsVisited.length, 6), target: 6 }),
  },
  {
    key: "hall_of_fame",
    name: "Hall of Fame",
    description: "Reach 30 career seasons.",
    category: "legacy",
    check: (_t, stats) => stats.seasonsCompleted >= 30,
    progress: (_t, stats) => ({ current: Math.min(stats.seasonsCompleted, 30), target: 30 }),
  },
];
