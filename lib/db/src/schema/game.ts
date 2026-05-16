import { pgTable, serial, varchar, integer, numeric, boolean, timestamp, text, json } from "drizzle-orm/pg-core";
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

export const teamsTable = pgTable("teams", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => usersTable.id),
  name: varchar("name", { length: 100 }).notNull(),
  budget: numeric("budget", { precision: 14, scale: 2 }).notNull().default("500000"),
  reputation: integer("reputation").notNull().default(50),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  locationId: integer("location_id").references(() => locationsTable.id),
  logoColor: varchar("logo_color", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Team = typeof teamsTable.$inferSelect;
export const insertTeamSchema = createInsertSchema(teamsTable).omit({ id: true, createdAt: true });

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
  salary: numeric("salary", { precision: 10, scale: 2 }).notNull().default("5000"),
  teamId: integer("team_id").references(() => teamsTable.id),
  outfitId: integer("outfit_id").references(() => outfitsTable.id),
  isActive: boolean("is_active").notNull().default(true),
  imageUrl: varchar("image_url", { length: 500 }),
  contractEndDate: varchar("contract_end_date", { length: 20 }),
  isDraftPlayer: boolean("is_draft_player").notNull().default(false),
  askingPrice: numeric("asking_price", { precision: 10, scale: 2 }),
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StaffMember = typeof staffTable.$inferSelect;

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
