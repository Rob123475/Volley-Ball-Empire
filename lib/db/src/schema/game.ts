import { pgTable, serial, varchar, integer, numeric, boolean, timestamp, text, json, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const locationsTable = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  country: varchar("country", { length: 100 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  description: text("description").notNull().default(""),
  weatherPatterns: json("weather_patterns").$type<string[]>().notNull().default([]),
  imageUrl: varchar("image_url", { length: 500 }),
  courtType: varchar("court_type", { length: 100 }).notNull().default("sand"),
  latitude: numeric("latitude", { precision: 9, scale: 6 }),
  longitude: numeric("longitude", { precision: 9, scale: 6 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Location = typeof locationsTable.$inferSelect;
export type InsertLocation = typeof locationsTable.$inferInsert;

export const outfitsTable = pgTable("outfits", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  primaryColor: varchar("primary_color", { length: 20 }).notNull(),
  secondaryColor: varchar("secondary_color", { length: 20 }).notNull(),
  description: varchar("description", { length: 255 }).notNull().default(""),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  imageUrl: varchar("image_url", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Outfit = typeof outfitsTable.$inferSelect;

export type CareerStats = {
  matchesWon: number;
  championshipsWon: number;
  highestBalanceReached: number;
  seasonsCompleted: number;
  seasonsInCurrentLocation: number;
  currentLocationId: number | null;
  continentsVisited: string[];
  youthSigned: number;
  youthPromoted: number;
  playersDevelopedToFiveStar: number;
  continentalTitles: number;
  olympicGolds: number;
  perfectSeasons: number;
  debtFreeSeasons: number;
  currentSeasonLosses: number;
};

export const teamsTable = pgTable("teams", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => usersTable.id),
  name: varchar("name", { length: 100 }).notNull(),
  budget: numeric("budget", { precision: 14, scale: 2 }).notNull().default("500000"),
  reputation: integer("reputation").notNull().default(50),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  titlesWon: integer("titles_won").notNull().default(0),
  locationId: integer("location_id").references(() => locationsTable.id),
  logoColor: varchar("logo_color", { length: 20 }),
  trainingPhilosophy: varchar("training_philosophy", { length: 30 }),
  managerRepPoints: integer("manager_rep_points").notNull().default(0),
  winStreak: integer("win_streak").notNull().default(0),
  sponsorReputation: integer("sponsor_reputation").notNull().default(50),
  youthScoutingContinent: varchar("youth_scouting_continent", { length: 50 }),
  youthScoutingStatus: varchar("youth_scouting_status", { length: 20 }).notNull().default("idle"),
  youthScoutingWeeksRemaining: integer("youth_scouting_weeks_remaining").notNull().default(0),
  careerStats: jsonb("career_stats").$type<CareerStats>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Team = typeof teamsTable.$inferSelect;
export const insertTeamSchema = createInsertSchema(teamsTable).omit({ id: true, createdAt: true });

export const achievementsTable = pgTable("achievements", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id),
  achievementKey: varchar("achievement_key", { length: 100 }).notNull(),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
  seasonUnlocked: integer("season_unlocked"),
});

export type AchievementRecord = typeof achievementsTable.$inferSelect;

export const userProfilesTable = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique().references(() => usersTable.id),
  teamName: varchar("team_name", { length: 100 }).notNull(),
  totalWins: integer("total_wins").notNull().default(0),
  totalLosses: integer("total_losses").notNull().default(0),
  totalEarnings: numeric("total_earnings", { precision: 14, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserProfile = typeof userProfilesTable.$inferSelect;

export const playersTable = pgTable("players", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  nationality: varchar("nationality", { length: 50 }).notNull(),
  age: integer("age").notNull(),
  height: numeric("height", { precision: 4, scale: 1 }).notNull().default("175"),
  position: varchar("position", { length: 30 }).notNull().default("universal"),
  speed: integer("speed").notNull().default(70),
  power: integer("power").notNull().default(70),
  defense: integer("defense").notNull().default(70),
  serve: integer("serve").notNull().default(70),
  block: integer("block").notNull().default(70),
  stamina: integer("stamina").notNull().default(70),
  morale: integer("morale").notNull().default(80),
  fatigue: integer("fatigue").notNull().default(0),
  trainingPoints: integer("training_points").notNull().default(0),
  salary: numeric("salary", { precision: 10, scale: 2 }).notNull().default("5000"),
  teamId: integer("team_id").references(() => teamsTable.id),
  outfitId: integer("outfit_id").references(() => outfitsTable.id),
  isActive: boolean("is_active").notNull().default(true),
  squadRole: varchar("squad_role", { length: 20 }).notNull().default("reserve"),
  fitness: integer("fitness").notNull().default(100),
  injuryStatus: varchar("injury_status", { length: 20 }).notNull().default("Healthy"),
  injuryWeeksRemaining: integer("injury_weeks_remaining").notNull().default(0),
  consecutiveMatchesPlayed: integer("consecutive_matches_played").notNull().default(0),
  doctorQuality: integer("doctor_quality").notNull().default(3),
  isInjured: boolean("is_injured").notNull().default(false),
  imageUrl: varchar("image_url", { length: 500 }),
  contractEndDate: varchar("contract_end_date", { length: 20 }),
  isDraftPlayer: boolean("is_draft_player").notNull().default(false),
  askingPrice: numeric("asking_price", { precision: 10, scale: 2 }),
  potential: varchar("potential", { length: 20 }).notNull().default("Average"),
  scoutedPotential: varchar("scouted_potential", { length: 20 }),
  discoveredBy:    varchar("discovered_by", { length: 200 }),
  eliteEventType:  varchar("elite_event_type", { length: 50 }),
  trainingFocus: varchar("training_focus", { length: 30 }),
  focusXp: integer("focus_xp").notNull().default(0),
  academyContractYears: numeric("academy_contract_years", { precision: 5, scale: 2 }),
  isRetired: boolean("is_retired").notNull().default(false),
  retiredSeasonYear: integer("retired_season_year"),
  careerSeasons: integer("career_seasons"),
  careerWins: integer("career_wins"),
  careerTitles: integer("career_titles"),
  continentalTitles: integer("continental_titles"),
  worldTitles: integer("world_titles"),
  olympicMedalsCount: integer("olympic_medals_count"),
  peakOverallRating: integer("peak_overall_rating"),
  yearsActive: varchar("years_active", { length: 20 }),
  legendScore: integer("legend_score"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Player = typeof playersTable.$inferSelect;
export const insertPlayerSchema = createInsertSchema(playersTable).omit({ id: true, createdAt: true });

export const contractsTable = pgTable("contracts", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id),
  teamId: integer("team_id").notNull().references(() => teamsTable.id),
  salary: numeric("salary", { precision: 10, scale: 2 }).notNull(),
  startDate: varchar("start_date", { length: 20 }).notNull(),
  endDate: varchar("end_date", { length: 20 }).notNull(),
  bonusPerWin: numeric("bonus_per_win", { precision: 8, scale: 2 }).notNull().default("0"),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Contract = typeof contractsTable.$inferSelect;

export const staffTable = pgTable("staff", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  role: varchar("role", { length: 30 }).notNull(),
  specialty: varchar("specialty", { length: 100 }).notNull().default("General"),
  salary: numeric("salary", { precision: 10, scale: 2 }).notNull().default("3000"),
  skillLevel: integer("skill_level").notNull().default(60),
  teamId: integer("team_id").references(() => teamsTable.id),
  nationality: varchar("nationality", { length: 50 }),
  imageUrl: varchar("image_url", { length: 500 }),
  isAvailable: boolean("is_available").notNull().default(true),
  age: integer("age").notNull().default(35),
  overallRating: integer("overall_rating").notNull().default(70),
  contractLength: integer("contract_length").notNull().default(12),
  coachSpeciality: varchar("coach_speciality", { length: 50 }).notNull().default("General"),
  personality: varchar("personality", { length: 50 }).notNull().default("Motivator"),
  attributes: jsonb("attributes").$type<Record<string, number>>().notNull().default({}),
  specialTrait: varchar("special_trait", { length: 100 }).notNull().default(""),
  isScoutRevealed: boolean("is_scout_revealed").notNull().default(false),
  scoutingRating:  integer("scouting_rating").notNull().default(50),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StaffMember = typeof staffTable.$inferSelect;

export const youthLeagueResultsTable = pgTable("youth_league_results", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id),
  playerId: integer("player_id").notNull().references(() => playersTable.id),
  playerName: varchar("player_name", { length: 100 }).notNull(),
  weekNumber: integer("week_number").notNull(),
  result: varchar("result", { length: 10 }).notNull(),
  oppositionName: varchar("opposition_name", { length: 100 }).notNull(),
  xpGained: integer("xp_gained").notNull().default(0),
  devPointsGained: integer("dev_points_gained").notNull().default(0),
  moraleChange: integer("morale_change").notNull().default(0),
  playerRatingAtTime: integer("player_rating_at_time").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type YouthLeagueResult = typeof youthLeagueResultsTable.$inferSelect;

export const trainingSessionsTable = pgTable("training_sessions", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id),
  playerId: integer("player_id").notNull().references(() => playersTable.id),
  type: varchar("type", { length: 30 }).notNull(),
  focus: varchar("focus", { length: 100 }).notNull(),
  durationHours: numeric("duration_hours", { precision: 4, scale: 1 }).notNull().default("2"),
  scheduledAt: varchar("scheduled_at", { length: 30 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("scheduled"),
  coachId: integer("coach_id").references(() => staffTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TrainingSession = typeof trainingSessionsTable.$inferSelect;

export const seasonsTable = pgTable("seasons", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("upcoming"),
  totalRounds: integer("total_rounds").notNull().default(10),
  currentRound: integer("current_round").notNull().default(0),
  startDate: varchar("start_date", { length: 20 }).notNull(),
  endDate: varchar("end_date", { length: 20 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Season = typeof seasonsTable.$inferSelect;

export const matchesTable = pgTable("matches", {
  id: serial("id").primaryKey(),
  homeTeamId: integer("home_team_id").notNull().references(() => teamsTable.id),
  awayTeamId: integer("away_team_id").notNull().references(() => teamsTable.id),
  locationId: integer("location_id").notNull().references(() => locationsTable.id),
  weather: varchar("weather", { length: 20 }).notNull().default("sunny"),
  windSpeed: numeric("wind_speed", { precision: 5, scale: 1 }),
  temperature: numeric("temperature", { precision: 5, scale: 1 }),
  status: varchar("status", { length: 20 }).notNull().default("scheduled"),
  season: integer("season").notNull().default(1),
  round: integer("round").notNull().default(1),
  teamSize: integer("team_size").notNull().default(2),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  homeTeamName: varchar("home_team_name", { length: 100 }),
  awayTeamName: varchar("away_team_name", { length: 100 }),
  locationName: varchar("location_name", { length: 100 }),
  prizeAmount: numeric("prize_amount", { precision: 10, scale: 2 }),
  scheduledAt: varchar("scheduled_at", { length: 30 }),
  lineup: json("lineup").$type<number[]>(),
  highlights: json("highlights").$type<string[]>(),
  continent: varchar("continent", { length: 100 }),
  tier: varchar("tier", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Match = typeof matchesTable.$inferSelect;

export const financeTransactionsTable = pgTable("finance_transactions", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id),
  type: varchar("type", { length: 10 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  date: varchar("date", { length: 20 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type FinanceTransaction = typeof financeTransactionsTable.$inferSelect;

export const promoDealsTable = pgTable("promo_deals", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teamsTable.id),
  sponsor: varchar("sponsor", { length: 100 }).notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  requirementWins: integer("requirement_wins").notNull().default(0),
  expiresAt: varchar("expires_at", { length: 20 }).notNull(),
  isAccepted: boolean("is_accepted").notNull().default(false),
  isGlobal: boolean("is_global").notNull().default(true),
  imageUrl: varchar("image_url", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PromoDeal = typeof promoDealsTable.$inferSelect;

export type OlympicPlayerData = {
  id: number | null;
  name: string;
  nationality: string;
  age: number;
  speed: number;
  power: number;
  defense: number;
  serve: number;
  block: number;
  stamina: number;
  isReserve: boolean;
  imageUrl?: string | null;
};

export const olympicSelectionsTable = pgTable("olympic_selections", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique().references(() => usersTable.id),
  selectedCountry: varchar("selected_country", { length: 100 }).notNull(),
  selectedFlag: varchar("selected_flag", { length: 20 }).notNull(),
  squad: json("squad").$type<OlympicPlayerData[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type OlympicSelection = typeof olympicSelectionsTable.$inferSelect;

export const facilitiesTable = pgTable("facilities", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id),
  type: varchar("type", { length: 50 }).notNull(),
  level: integer("level").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Facility = typeof facilitiesTable.$inferSelect;

export const trophiesTable = pgTable("trophies", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id),
  type: varchar("type", { length: 50 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  season: integer("season"),
  year: integer("year"),
  continent: varchar("continent", { length: 100 }),
  locationName: varchar("location_name", { length: 200 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TrophyRecord = typeof trophiesTable.$inferSelect;

export const wellbeingEffectsTable = pgTable("wellbeing_effects", {
  id:               serial("id").primaryKey(),
  teamId:           integer("team_id").notNull().references(() => teamsTable.id),
  effectType:       varchar("effect_type", { length: 50 }).notNull(),
  matchesRemaining: integer("matches_remaining").notNull().default(8),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WellbeingEffect = typeof wellbeingEffectsTable.$inferSelect;

export const injuryHistoryTable = pgTable("injury_history", {
  id:          serial("id").primaryKey(),
  teamId:      integer("team_id").notNull().references(() => teamsTable.id),
  seasonId:    integer("season_id").notNull(),
  playerId:    integer("player_id").notNull().references(() => playersTable.id),
  playerName:  varchar("player_name", { length: 100 }).notNull(),
  injuryType:  varchar("injury_type", { length: 30 }).notNull(),
  daysMissed:  integer("days_missed").notNull(),
  dateInjured: timestamp("date_injured", { withTimezone: true }).notNull().defaultNow(),
});

export type InjuryHistoryEntry = typeof injuryHistoryTable.$inferSelect;

export const seasonInjuryStatsTable = pgTable("season_injury_stats", {
  id:                  serial("id").primaryKey(),
  teamId:              integer("team_id").notNull().references(() => teamsTable.id),
  seasonId:            integer("season_id").notNull(),
  totalInjuries:       integer("total_injuries").notNull().default(0),
  daysLost:            integer("days_lost").notNull().default(0),
  minorInjuries:       integer("minor_injuries").notNull().default(0),
  majorInjuries:       integer("major_injuries").notNull().default(0),
  unavailableInjuries: integer("unavailable_injuries").notNull().default(0),
  updatedAt:           timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type SeasonInjuryStat = typeof seasonInjuryStatsTable.$inferSelect;

export const youthProspectsTable = pgTable("youth_prospects", {
  id:            serial("id").primaryKey(),
  teamId:        integer("team_id").notNull().references(() => teamsTable.id),
  name:          varchar("name", { length: 100 }).notNull(),
  age:           integer("age").notNull(),
  continent:     varchar("continent", { length: 50 }).notNull(),
  currentRating: integer("current_rating").notNull(),
  potentialStars: varchar("potential_stars", { length: 30 }).notNull(),
  speciality:    varchar("speciality", { length: 50 }).notNull(),
  signingCost:   integer("signing_cost").notNull(),
  status:               varchar("status", { length: 20 }).notNull().default("pending"),
  scoutingReportText:   text("scouting_report_text"),
  discoveredBy:         varchar("discovered_by", { length: 200 }),
  scoutedPotentialLabel: varchar("scouted_potential_label", { length: 30 }),
  continentalMissionId:  integer("continental_mission_id"),
  eliteEventType:        varchar("elite_event_type", { length: 50 }),
  createdAt:            timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type YouthProspect = typeof youthProspectsTable.$inferSelect;

export const youthLadderTable = pgTable("youth_ladder", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id),
  season: integer("season").notNull().default(1),
  competitorName: varchar("competitor_name", { length: 100 }).notNull(),
  isPlayer: boolean("is_player").notNull().default(false),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  points: integer("points").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type YouthLadderEntry = typeof youthLadderTable.$inferSelect;

export const youthChampionshipTrophiesTable = pgTable("youth_championship_trophies", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id),
  season: integer("season").notNull(),
  year: integer("year"),
  winningTeamName: varchar("winning_team_name", { length: 100 }).notNull(),
  isPlayerWin: boolean("is_player_win").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type YouthChampionshipTrophy = typeof youthChampionshipTrophiesTable.$inferSelect;

export const continentalScoutingMissionsTable = pgTable("continental_scouting_missions", {
  id:              serial("id").primaryKey(),
  teamId:          integer("team_id").notNull().references(() => teamsTable.id),
  region:          varchar("region", { length: 30 }).notNull(),
  status:          varchar("status", { length: 20 }).notNull().default("active"),
  durationMonths:  integer("duration_months").notNull().default(1),
  startDate:       timestamp("start_date", { withTimezone: true }).notNull().defaultNow(),
  endDate:         timestamp("end_date", { withTimezone: true }).notNull(),
  assignedStaffId: integer("assigned_staff_id").references(() => staffTable.id),
  prospectsFound:  integer("prospects_found").notNull().default(0),
  cost:            numeric("cost", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ContinentalScoutingMission = typeof continentalScoutingMissionsTable.$inferSelect;
