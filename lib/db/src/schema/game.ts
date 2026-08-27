import { sqliteTable, text, integer, real, check, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const locationsTable = sqliteTable("locations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  country: text("country").notNull(),
  city: text("city").notNull(),
  description: text("description").notNull().default(""),
  weatherPatterns: text("weather_patterns", { mode: "json" }).$type<string[]>().notNull().default([]),
  imageUrl: text("image_url"),
  courtType: text("court_type").notNull().default("sand"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type Location = typeof locationsTable.$inferSelect;
export type InsertLocation = typeof locationsTable.$inferInsert;

export const outfitsTable = sqliteTable("outfits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  primaryColor: text("primary_color").notNull(),
  secondaryColor: text("secondary_color").notNull(),
  description: text("description").notNull().default(""),
  price: real("price").notNull().default(0),
  imageUrl: text("image_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type Outfit = typeof outfitsTable.$inferSelect;

export type PlayerDevelopment = {
  workEthic:       number;
  coachability:    number;
  consistency:     number;
  leadership:      number;
  injuryProneness: number;
};

export type PlayerV4 = {
  schema_version: string;
  player_type: "Senior" | "Youth" | "Draft" | "Regen";
  status: {
    active: boolean; retired: boolean; draft_eligible: boolean;
    youth_player: boolean; free_agent: boolean; injured: boolean; suspended: boolean;
  };
  contract: {
    status: string; years_remaining: number | null; salary: number | null;
    release_clause: number | null; loyalty: number | null; transfer_interest: number | null;
    wage_demand_growth: number | null; renewal_likelihood: number | null;
  };
  draft: {
    draft_year: number | null; draft_rank: number | null; projected_pick_range: string | null;
    combine_score: number | null; interview_score: number | null; boom_bust_rating: number | null;
  };
  core_attributes: {
    serve: number; attack: number; defence: number; block: number; set: number; dig: number;
    speed: number; stamina: number; jump: number; power: number; accuracy: number;
    reaction: number; vision: number; composure: number; teamwork: number;
  };
  advanced_attributes: {
    serve_pressure: number; spike_timing: number; shot_selection: number;
    line_defence: number; cross_defence: number; net_awareness: number;
    clutch: number; consistency: number; error_control: number;
    rally_iq: number; momentum_control: number; adaptability: number;
  };
  match_engine: {
    winner_chance_modifier: number; error_chance_modifier: number;
    dig_success_modifier: number; block_success_modifier: number;
    serve_ace_modifier: number; fatigue_drop_rate: number;
    pressure_bonus: number; bad_form_penalty: number;
    boost_response: {
      attack_boost_effect: number; defence_boost_effect: number;
      risk_under_attack_boost: number; stamina_cost_under_boost: number;
    };
  };
  development: {
    development_curve: string; growth_rate: number; training_response: number;
    peak_age_start: number; peak_age_end: number; decline_rate: number;
    hidden_ceiling: number; same_rating_variance_enabled: boolean;
    development_personality: string; potential_can_rise: boolean; potential_can_fall: boolean;
    breakout_probability: number; bust_probability: number;
    late_bloomer_probability: number; position_change_probability: number;
  };
  youth_development: {
    enabled_if_player_type_youth: boolean; physical_growth: number; mental_growth: number;
    skill_growth: number; growth_variance: number; late_growth_chance: number;
    early_peak_chance: number; personality_shift: boolean; position_change_probability: number;
    breakout_probability: number; bust_probability: number; academy_quality_modifier: number;
  };
  hidden_dna: {
    competitiveness: number; work_ethic: number; coachability: number;
    confidence_growth: number; pressure_resistance: number; injury_resilience: number;
    adaptability: number; consistency_gene: number; leadership_growth: number;
    professionalism_growth: number;
  };
  regen: {
    regen_enabled: boolean; regen_seed: string | null;
    regen_quality_min: number; regen_quality_max: number;
    inheritance_strength: number; can_create_family_style_successor: boolean;
    lineage_id: string | null; parent_player_id: string | null;
    generation_number: number; regen_notes: string | null;
  };
  health: {
    current_fitness: number; injury_status: string; injury_type: string | null;
    weeks_out: number; injury_proneness: number; recovery_speed: number;
    fatigue: number; morale: number; confidence: number; burnout_risk: number;
  };
  personality: {
    professionalism: number; ambition: number; temperament: number;
    leadership: number; coachability: number; marketability: number;
    ego: number; loyalty: number; media_handling: number;
  };
  form: {
    current_form: number; last_5_matches_average: number;
    confidence_trend: string; morale_trend: string;
    hot_streak: boolean; cold_streak: boolean;
  };
  specialities: string[];
  weaknesses: string[];
  visual_identity: {
    card_image: string | null; unity_model: string | null; skin_tone: string | null;
    hair_style: string | null; hair_colour: string | null; body_type: string | null;
    height_scale: number; face_variant: string | null; animation_style: string | null;
  };
  visual_kit: {
    kit_source: string; top_primary_colour: string; top_secondary_colour: string;
    bottom_primary_colour: string; bottom_secondary_colour: string;
    trim_colour: string; accessory_colour: string; unity_material_rule: string;
  };
  scouting: {
    scouted_accuracy: number | null; known_potential: boolean; hidden_gem: boolean;
    risk_level: string | null; scout_summary: string | null;
    scout_confidence: number | null; false_positive_risk: number | null; false_negative_risk: number | null;
  };
  career_stats: {
    matches_played: number; wins: number; losses: number; aces: number;
    blocks: number; kills: number; digs: number; errors: number;
    tournament_wins: number; championships: number; mvp_awards: number; all_star_selections: number;
  };
  hall_of_fame: {
    eligible: boolean; score: number; legacy_rating: number;
    retired_number: boolean; legend_status: string;
  };
};

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

export const teamsTable = sqliteTable("teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => usersTable.id),
  name: text("name").notNull(),
  budget: real("budget").notNull().default(500000),
  reputation: integer("reputation").notNull().default(50),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  titlesWon: integer("titles_won").notNull().default(0),
  locationId: integer("location_id").references(() => locationsTable.id),
  logoColor: text("logo_color"),
  secondaryLogoColor: text("secondary_logo_color"),
  // Player-chosen crest shape index (0-based, into ClubCrest's VARIANTS). Null
  // for existing/AI teams — ClubCrest falls back to a name-hash shape for those.
  crestShapeIndex: integer("crest_shape_index"),
  trainingPhilosophy: text("training_philosophy"),
  managerRepPoints: integer("manager_rep_points").notNull().default(0),
  winStreak: integer("win_streak").notNull().default(0),
  sponsorReputation: integer("sponsor_reputation").notNull().default(50),
  boardConfidence: integer("board_confidence").notNull().default(60),
  youthScoutingContinent: text("youth_scouting_continent"),
  youthScoutingStatus: text("youth_scouting_status").notNull().default("idle"),
  youthScoutingWeeksRemaining: integer("youth_scouting_weeks_remaining").notNull().default(0),
  careerStats: text("career_stats", { mode: "json" }).$type<CareerStats>(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type Team = typeof teamsTable.$inferSelect;
export const insertTeamSchema = createInsertSchema(teamsTable).omit({ id: true, createdAt: true });

export const achievementsTable = sqliteTable("achievements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("team_id").notNull().references(() => teamsTable.id),
  achievementKey: text("achievement_key").notNull(),
  unlockedAt: integer("unlocked_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  seasonUnlocked: integer("season_unlocked"),
});

export type AchievementRecord = typeof achievementsTable.$inferSelect;

export const userProfilesTable = sqliteTable("user_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().unique().references(() => usersTable.id),
  teamName: text("team_name").notNull(),
  coachName: text("coach_name"),
  savePin: text("save_pin"),
  totalWins: integer("total_wins").notNull().default(0),
  totalLosses: integer("total_losses").notNull().default(0),
  totalEarnings: real("total_earnings").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type UserProfile = typeof userProfilesTable.$inferSelect;

export const playersTable = sqliteTable("players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  nationality: text("nationality").notNull(),
  age: integer("age").notNull(),
  height: real("height").notNull().default(175),
  position: text("position").notNull().default("universal"),
  speed: integer("speed").notNull().default(70),
  power: integer("power").notNull().default(70),
  defense: integer("defense").notNull().default(70),
  serve: integer("serve").notNull().default(70),
  block: integer("block").notNull().default(70),
  stamina: integer("stamina").notNull().default(70),
  trainingPoints: integer("training_points").notNull().default(0),
  salary: real("salary").notNull().default(5000),
  outfitId: integer("outfit_id").references(() => outfitsTable.id),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  squadRole: text("squad_role").notNull().default("reserve"),
  doctorQuality: integer("doctor_quality").notNull().default(3),
  imageUrl: text("image_url"),
  continent: text("continent"),
  playerType: text("player_type").notNull().default("senior"),
  contractEndDate: text("contract_end_date"),
  isDraftPlayer: integer("is_draft_player", { mode: "boolean" }).notNull().default(false),
  askingPrice: real("asking_price"),
  potential: text("potential").notNull().default("Average"),
  scoutedPotential: text("scouted_potential"),
  discoveredBy: text("discovered_by"),
  eliteEventType: text("elite_event_type"),
  trainingFocus: text("training_focus"),
  focusXp: integer("focus_xp").notNull().default(0),
  academyContractYears: real("academy_contract_years"),
  isRetired: integer("is_retired", { mode: "boolean" }).notNull().default(false),
  retiredSeasonYear: integer("retired_season_year"),
  careerSeasons: integer("career_seasons"),
  careerWins: integer("career_wins"),
  careerTitles: integer("career_titles"),
  continentalTitles: integer("continental_titles"),
  worldTitles: integer("world_titles"),
  olympicMedalsCount: integer("olympic_medals_count"),
  peakOverallRating: integer("peak_overall_rating"),
  yearsActive: text("years_active"),
  legendScore: integer("legend_score"),
  development: text("development", { mode: "json" }).$type<PlayerDevelopment>(),
  playerV4: text("player_v4", { mode: "json" }).$type<PlayerV4>(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type Player = typeof playersTable.$inferSelect;
export const insertPlayerSchema = createInsertSchema(playersTable).omit({ id: true, createdAt: true });

// ── Per-career mutable player state ──────────────────────────────────────────
/**
 * Everything about a player that ONE CAREER changes.
 *
 * `players` is the global reference pool — 196 seniors and 72 youth, shared by
 * every save on the machine, as it must be: they are the world's athletes. But
 * the columns a career mutates lived there too, so signing a player in career A
 * removed them from career B's market permanently, and A's injuries, fitness,
 * contracts and (once rollover lands) ages applied to B as well.
 *
 * Splitting it this way means `players` is genuinely immutable reference data
 * and every career keeps its own copy of the parts that move. The mutable
 * columns are DROPPED from `players` rather than merely abandoned, so a read
 * that was never migrated is a compile error instead of a silently global value.
 */
export const careerPlayerStateTable = sqliteTable("career_player_state", {
  id:           integer("id").primaryKey({ autoIncrement: true }),
  careerSaveId: integer("career_save_id").notNull().references(() => careerSavesTable.id),
  playerId:     integer("player_id").notNull().references(() => playersTable.id),

  // squad membership
  teamId:       integer("team_id").references(() => teamsTable.id),
  squadRole:    text("squad_role").notNull().default("reserve"),
  isActive:     integer("is_active", { mode: "boolean" }).notNull().default(false),

  // contract
  salary:            real("salary").notNull().default(0),
  contractEndDate:   text("contract_end_date"),
  academyContractYears: integer("academy_contract_years"),

  // condition
  age:                    integer("age").notNull(),
  fitness:                integer("fitness").notNull().default(100),
  fatigue:                integer("fatigue").notNull().default(0),
  morale:                 integer("morale").notNull().default(75),
  injuryStatus:           text("injury_status").notNull().default("Healthy"),
  injuryWeeksRemaining:   integer("injury_weeks_remaining").notNull().default(0),
  isInjured:              integer("is_injured", { mode: "boolean" }).notNull().default(false),
  consecutiveMatchesPlayed: integer("consecutive_matches_played").notNull().default(0),

  // Current stats. The reference row holds the athlete's BASE stats; training
  // and development move these, and they must be per career — otherwise
  // training a player in one save improves them in every other save too.
  speed:   integer("speed").notNull().default(70),
  power:   integer("power").notNull().default(70),
  defense: integer("defense").notNull().default(70),
  serve:   integer("serve").notNull().default(70),
  block:   integer("block").notNull().default(70),
  stamina: integer("stamina").notNull().default(70),

  // development and scouting
  trainingPoints:   integer("training_points").notNull().default(0),
  trainingFocus:    text("training_focus"),
  focusXp:          integer("focus_xp").notNull().default(0),
  scoutedPotential: text("scouted_potential"),
  discoveredBy:     text("discovered_by"),

  // career-long record
  isRetired:        integer("is_retired", { mode: "boolean" }).notNull().default(false),
  retiredSeasonYear: integer("retired_season_year"),
  careerWins:       integer("career_wins").notNull().default(0),
  isDraftPlayer:    integer("is_draft_player", { mode: "boolean" }).notNull().default(false),
  outfitId:         integer("outfit_id"),

  updatedAt:    integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (t) => [
  uniqueIndex("career_player_state_unique").on(t.careerSaveId, t.playerId),
]);

export type CareerPlayerState = typeof careerPlayerStateTable.$inferSelect;

/** Per-career mutable staff state. Same disease, same cure. */
export const careerStaffStateTable = sqliteTable("career_staff_state", {
  id:           integer("id").primaryKey({ autoIncrement: true }),
  careerSaveId: integer("career_save_id").notNull().references(() => careerSavesTable.id),
  staffId:      integer("staff_id").notNull().references(() => staffTable.id),
  teamId:       integer("team_id").references(() => teamsTable.id),
  salary:       real("salary").notNull().default(0),
  isAvailable:  integer("is_available", { mode: "boolean" }).notNull().default(true),
  contractLength: integer("contract_length").notNull().default(12),
  isScoutRevealed: integer("is_scout_revealed", { mode: "boolean" }).notNull().default(false),
  updatedAt:    integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (t) => [
  uniqueIndex("career_staff_state_unique").on(t.careerSaveId, t.staffId),
]);

export type CareerStaffState = typeof careerStaffStateTable.$inferSelect;

export const contractsTable = sqliteTable("contracts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerId: integer("player_id").notNull().references(() => playersTable.id),
  teamId: integer("team_id").notNull().references(() => teamsTable.id),
  salary: real("salary").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  bonusPerWin: real("bonus_per_win").notNull().default(0),
  status: text("status").notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type Contract = typeof contractsTable.$inferSelect;

export const staffTable = sqliteTable("staff", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  role: text("role").notNull(),
  specialty: text("specialty").notNull().default("General"),
  salary: real("salary").notNull().default(3000),
  skillLevel: integer("skill_level").notNull().default(60),
  teamId: integer("team_id").references(() => teamsTable.id),
  nationality: text("nationality"),
  imageUrl: text("image_url"),
  isAvailable: integer("is_available", { mode: "boolean" }).notNull().default(true),
  age: integer("age").notNull().default(35),
  overallRating: integer("overall_rating").notNull().default(70),
  contractLength: integer("contract_length").notNull().default(12),
  coachSpeciality: text("coach_speciality").notNull().default("General"),
  personality: text("personality").notNull().default("Motivator"),
  attributes: text("attributes", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
  specialTrait: text("special_trait").notNull().default(""),
  isScoutRevealed: integer("is_scout_revealed", { mode: "boolean" }).notNull().default(false),
  scoutingRating: integer("scouting_rating").notNull().default(50),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type StaffMember = typeof staffTable.$inferSelect;

export const youthLeagueResultsTable = sqliteTable("youth_league_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("team_id").notNull().references(() => teamsTable.id),
  playerId: integer("player_id").notNull().references(() => playersTable.id),
  playerName: text("player_name").notNull(),
  weekNumber: integer("week_number").notNull(),
  result: text("result").notNull(),
  oppositionName: text("opposition_name").notNull(),
  xpGained: integer("xp_gained").notNull().default(0),
  devPointsGained: integer("dev_points_gained").notNull().default(0),
  moraleChange: integer("morale_change").notNull().default(0),
  playerRatingAtTime: integer("player_rating_at_time").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type YouthLeagueResult = typeof youthLeagueResultsTable.$inferSelect;

export const trainingSessionsTable = sqliteTable("training_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("team_id").notNull().references(() => teamsTable.id),
  playerId: integer("player_id").notNull().references(() => playersTable.id),
  type: text("type").notNull(),
  focus: text("focus").notNull(),
  durationHours: real("duration_hours").notNull().default(2),
  scheduledAt: text("scheduled_at").notNull(),
  status: text("status").notNull().default("scheduled"),
  coachId: integer("coach_id").references(() => staffTable.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type TrainingSession = typeof trainingSessionsTable.$inferSelect;

export const seasonsTable = sqliteTable("seasons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // Seasons are per CAREER. Multiple careers per install is a shipped feature —
  // the local profile picker exists for it — and without this column career
  // creation reused whatever season row already had status "active", so a second
  // career inherited the first one's timeline and could start mid-season or at
  // season end. Nullable only so pre-existing rows survive the migration.
  careerSaveId: integer("career_save_id"),
  year: integer("year").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("upcoming"),
  totalRounds: integer("total_rounds").notNull().default(78),
  currentRound: integer("current_round").notNull().default(0),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  isOlympicSeason: integer("is_olympic_season", { mode: "boolean" }).notNull().default(false),
  regionalRoundsProcessed: integer("regional_rounds_processed").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type Season = typeof seasonsTable.$inferSelect;

export const matchesTable = sqliteTable("matches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  homeTeamId: integer("home_team_id").notNull().references(() => teamsTable.id),
  awayTeamId: integer("away_team_id").notNull().references(() => teamsTable.id),
  locationId: integer("location_id").notNull().references(() => locationsTable.id),
  weather: text("weather").notNull().default("sunny"),
  windSpeed: real("wind_speed"),
  temperature: real("temperature"),
  status: text("status").notNull().default("scheduled"),
  season: integer("season").notNull().default(1),
  round: integer("round").notNull().default(1),
  teamSize: integer("team_size").notNull().default(2),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  homeTeamName: text("home_team_name"),
  awayTeamName: text("away_team_name"),
  locationName: text("location_name"),
  prizeAmount: real("prize_amount"),
  scheduledAt: text("scheduled_at"),
  lineup: text("lineup", { mode: "json" }).$type<number[]>(),
  highlights: text("highlights", { mode: "json" }).$type<string[]>(),
  continent: text("continent"),
  tier: text("tier"),
  // Set-by-set scores for the point-tick engine, e.g. [{home:21,away:18},{home:19,away:21},{home:15,away:9}]
  // Populated as the live tick engine progresses; homeScore/awayScore remain the authoritative
  // final-set (or match-level) totals used everywhere else once status = 'completed'.
  sets: text("sets", { mode: "json" }).$type<{ home: number; away: number }[]>(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type Match = typeof matchesTable.$inferSelect;

// ── Live match state ──────────────────────────────────────────────────────
// One row per match while status = 'in_progress'. Written by the point-tick
// engine (see matches.ts `startMatchTick`) and read by GET /unity/match-state.
// Row is left in place after completion (rallyState becomes 'finished') so a
// late Unity poll still gets a coherent final frame instead of a 404.
export const matchLiveStateTable = sqliteTable("match_live_state", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id").notNull().unique().references(() => matchesTable.id),
  currentSet: integer("current_set").notNull().default(1),
  homeSetScore: integer("home_set_score").notNull().default(0),
  awaySetScore: integer("away_set_score").notNull().default(0),
  setsWonHome: integer("sets_won_home").notNull().default(0),
  setsWonAway: integer("sets_won_away").notNull().default(0),
  servingTeam: text("serving_team"), // 'home' | 'away'
  currentServerId: integer("current_server_id").references(() => playersTable.id),
  ballOwnerId: integer("ball_owner_id").references(() => playersTable.id),
  // 'serving' | 'in_rally' | 'dead_ball' | 'set_break' | 'finished'
  rallyState: text("rally_state").notNull().default("serving"),
  lastAction: text("last_action"),
  lastActionPlayerId: integer("last_action_player_id").references(() => playersTable.id),
  lastActionTeam: text("last_action_team"), // 'home' | 'away'
  lastOutcome: text("last_outcome"),
  pointWinner: text("point_winner"), // 'home' | 'away'
  matchTimeSeconds: integer("match_time_seconds").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type MatchLiveState = typeof matchLiveStateTable.$inferSelect;

export const financeTransactionsTable = sqliteTable("finance_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("team_id").notNull().references(() => teamsTable.id),
  type: text("type").notNull(),
  amount: real("amount").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  date: text("date").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type FinanceTransaction = typeof financeTransactionsTable.$inferSelect;

export const promoDealsTable = sqliteTable("promo_deals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("team_id").references(() => teamsTable.id),
  sponsor: text("sponsor").notNull(),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  requirementWins: integer("requirement_wins").notNull().default(0),
  expiresAt: text("expires_at").notNull(),
  isAccepted: integer("is_accepted", { mode: "boolean" }).notNull().default(false),
  isGlobal: integer("is_global", { mode: "boolean" }).notNull().default(true),
  imageUrl: text("image_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  // Regenerative sponsor system (v2) — new columns with safe defaults
  tier: text("tier"),
  slot: text("slot"),
  category: text("category"),
  signingBonus: real("signing_bonus").default(0),
  monthlyPayment: real("monthly_payment").default(0),
  contractLengthSeasons: integer("contract_length_seasons"),
  contractStartDate: text("contract_start_date"),
  contractEndDate: text("contract_end_date"),
  appealReason: text("appeal_reason"),
  status: text("status").default("available"),
  lastPaymentDate: text("last_payment_date"),
  signingBonusPaid: integer("signing_bonus_paid", { mode: "boolean" }).default(false),
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

export const olympicSelectionsTable = sqliteTable("olympic_selections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().unique().references(() => usersTable.id),
  selectedCountry: text("selected_country").notNull(),
  selectedFlag: text("selected_flag").notNull(),
  squad: text("squad", { mode: "json" }).$type<OlympicPlayerData[]>().notNull().default([]),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export type OlympicSelection = typeof olympicSelectionsTable.$inferSelect;

export const facilitiesTable = sqliteTable("facilities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("team_id").notNull().references(() => teamsTable.id),
  type: text("type").notNull(),
  level: integer("level").notNull().default(1),
  upgradingToLevel: integer("upgrading_to_level"),
  upgradeCompletesAtRound: integer("upgrade_completes_at_round"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type Facility = typeof facilitiesTable.$inferSelect;

export const trophiesTable = sqliteTable("trophies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("team_id").notNull().references(() => teamsTable.id),
  type: text("type").notNull(),
  name: text("name").notNull(),
  season: integer("season"),
  year: integer("year"),
  continent: text("continent"),
  locationName: text("location_name"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type TrophyRecord = typeof trophiesTable.$inferSelect;

export const wellbeingEffectsTable = sqliteTable("wellbeing_effects", {
  id:               integer("id").primaryKey({ autoIncrement: true }),
  teamId:           integer("team_id").notNull().references(() => teamsTable.id),
  effectType:       text("effect_type").notNull(),
  matchesRemaining: integer("matches_remaining").notNull().default(8),
  createdAt:        integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type WellbeingEffect = typeof wellbeingEffectsTable.$inferSelect;

type PendingCampEffects = {
  moraleBonus: number;
  fatigueChange: number;
  fitnessChange: number;
  trainingPtBonus: number;
  duration: number;
  effectType: string | null;
};

export const activeCampsTable = sqliteTable("active_camps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("team_id").notNull().references(() => teamsTable.id),
  campType: text("camp_type").notNull(),
  campName: text("camp_name").notNull(),
  completesAtRound: integer("completes_at_round").notNull(),
  pendingEffects: text("pending_effects", { mode: "json" }).$type<PendingCampEffects>().notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type ActiveCamp = typeof activeCampsTable.$inferSelect;

export const seasonFinalStandingsTable = sqliteTable("season_final_standings", {
  id:             integer("id").primaryKey({ autoIncrement: true }),
  teamId:         integer("team_id").notNull().references(() => teamsTable.id),
  seasonYear:     integer("season_year").notNull(),
  rank:           integer("rank").notNull(),
  competitorName: text("competitor_name").notNull(),
  isPlayer:       integer("is_player", { mode: "boolean" }).notNull().default(false),
  wins:           integer("wins").notNull().default(0),
  losses:         integer("losses").notNull().default(0),
  points:         integer("points").notNull().default(0),
  setDiff:        integer("set_diff").notNull().default(0),
  createdAt:      integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type SeasonFinalStanding = typeof seasonFinalStandingsTable.$inferSelect;

export const managerSeasonSummaryTable = sqliteTable("manager_season_summaries", {
  id:                integer("id").primaryKey({ autoIncrement: true }),
  userId:            text("user_id").notNull().references(() => usersTable.id),
  teamId:            integer("team_id").references(() => teamsTable.id),
  seasonYear:        integer("season_year").notNull(),
  clubName:          text("club_name").notNull(),
  leaguePosition:    integer("league_position"),
  wins:              integer("wins").notNull().default(0),
  losses:            integer("losses").notNull().default(0),
  budgetSnapshot:    real("budget_snapshot"),
  worldResult:       text("world_result"),
  continentalResult: text("continental_result"),
  youthResult:       text("youth_result"),
  createdAt:         integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type ManagerSeasonSummary = typeof managerSeasonSummaryTable.$inferSelect;

export const injuryHistoryTable = sqliteTable("injury_history", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  teamId:      integer("team_id").notNull().references(() => teamsTable.id),
  seasonId:    integer("season_id").notNull(),
  playerId:    integer("player_id").notNull().references(() => playersTable.id),
  playerName:  text("player_name").notNull(),
  injuryType:  text("injury_type").notNull(),
  daysMissed:  integer("days_missed").notNull(),
  dateInjured: integer("date_injured", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type InjuryHistoryEntry = typeof injuryHistoryTable.$inferSelect;

export const seasonInjuryStatsTable = sqliteTable("season_injury_stats", {
  id:                  integer("id").primaryKey({ autoIncrement: true }),
  teamId:              integer("team_id").notNull().references(() => teamsTable.id),
  seasonId:            integer("season_id").notNull(),
  totalInjuries:       integer("total_injuries").notNull().default(0),
  daysLost:            integer("days_lost").notNull().default(0),
  minorInjuries:       integer("minor_injuries").notNull().default(0),
  majorInjuries:       integer("major_injuries").notNull().default(0),
  unavailableInjuries: integer("unavailable_injuries").notNull().default(0),
  updatedAt:           integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export type SeasonInjuryStat = typeof seasonInjuryStatsTable.$inferSelect;

export const youthProspectsTable = sqliteTable("youth_prospects", {
  id:            integer("id").primaryKey({ autoIncrement: true }),
  teamId:        integer("team_id").notNull().references(() => teamsTable.id),
  name:          text("name").notNull(),
  age:           integer("age").notNull(),
  continent:     text("continent").notNull(),
  currentRating: integer("current_rating").notNull(),
  potentialStars: text("potential_stars").notNull(),
  speciality:    text("speciality").notNull(),
  signingCost:   integer("signing_cost").notNull(),
  status:               text("status").notNull().default("pending"),
  scoutingReportText:   text("scouting_report_text"),
  discoveredBy:         text("discovered_by"),
  scoutedPotentialLabel: text("scouted_potential_label"),
  continentalMissionId:  integer("continental_mission_id"),
  eliteEventType:        text("elite_event_type"),
  createdAt:            integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type YouthProspect = typeof youthProspectsTable.$inferSelect;

export const youthLadderTable = sqliteTable("youth_ladder", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("team_id").notNull().references(() => teamsTable.id),
  season: integer("season").notNull().default(1),
  competitorName: text("competitor_name").notNull(),
  isPlayer: integer("is_player", { mode: "boolean" }).notNull().default(false),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  points: integer("points").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type YouthLadderEntry = typeof youthLadderTable.$inferSelect;

export const youthChampionshipTrophiesTable = sqliteTable("youth_championship_trophies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("team_id").notNull().references(() => teamsTable.id),
  season: integer("season").notNull(),
  year: integer("year"),
  winningTeamName: text("winning_team_name").notNull(),
  isPlayerWin: integer("is_player_win", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type YouthChampionshipTrophy = typeof youthChampionshipTrophiesTable.$inferSelect;

export const continentalScoutingMissionsTable = sqliteTable("continental_scouting_missions", {
  id:              integer("id").primaryKey({ autoIncrement: true }),
  teamId:          integer("team_id").notNull().references(() => teamsTable.id),
  region:          text("region").notNull(),
  status:          text("status").notNull().default("active"),
  durationMonths:  integer("duration_months").notNull().default(1),
  startDate:       integer("start_date", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  endDate:         integer("end_date", { mode: "timestamp" }).notNull(),
  assignedStaffId: integer("assigned_staff_id").references(() => staffTable.id),
  prospectsFound:  integer("prospects_found").notNull().default(0),
  cost:            real("cost").notNull().default(0),
  createdAt:       integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type ContinentalScoutingMission = typeof continentalScoutingMissionsTable.$inferSelect;

// ── Competitors ──────────────────────────────────────────────────────────────
/**
 * One row per entity that can appear in a ranking table or a set of standings.
 *
 * Identity ONLY. Name and rating are read through the join to whichever parent
 * is set, never copied here, so there is nothing to keep in sync.
 *
 * Exactly one parent is set: `teamId` for a player's club, `poolTeamId` for one
 * of the 60 AI clubs. This is deliberately NOT solved by making teams.user_id
 * nullable — that column is a structural guarantee that a teams row belongs to a
 * person, and every existing read of teams that forgets a filter would silently
 * start including AI clubs. Nor by a polymorphic type+id key, which cannot carry
 * referential integrity. One FK target per parent, both enforced.
 */
export const competitorsTable = sqliteTable("competitors", {
  id:         integer("id").primaryKey({ autoIncrement: true }),
  teamId:     integer("team_id").references(() => teamsTable.id),
  poolTeamId: integer("pool_team_id").references(() => continentalPoolTeamsTable.id),
  createdAt:  integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (t) => [
  // Exactly one parent, never both, never neither.
  check("competitor_exactly_one_parent",
    sql`(${t.teamId} IS NULL) <> (${t.poolTeamId} IS NULL)`),
  uniqueIndex("competitors_team_id_unique").on(t.teamId),
  uniqueIndex("competitors_pool_team_id_unique").on(t.poolTeamId),
]);

export type Competitor = typeof competitorsTable.$inferSelect;

/**
 * Ranking points and season record, per competitor, PER CAREER.
 *
 * Career-scoped, not merely season-scoped, because `seasons` is global: it has
 * no user or career column and career creation reuses whatever active season
 * already exists. Two careers on one machine would otherwise share a ranking
 * table, and under tier qualification one career's points would gate another's
 * tier access. The competitor identity is global; its RESULTS are per career.
 */
export const competitorRankingsTable = sqliteTable("competitor_rankings", {
  id:            integer("id").primaryKey({ autoIncrement: true }),
  competitorId:  integer("competitor_id").notNull().references(() => competitorsTable.id),
  careerSaveId:  integer("career_save_id").notNull().references(() => careerSavesTable.id),
  seasonYear:    integer("season_year").notNull(),
  rankingPoints: integer("ranking_points").notNull().default(0),
  eventsEntered: integer("events_entered").notNull().default(0),
  wins:          integer("wins").notNull().default(0),
  losses:        integer("losses").notNull().default(0),
  updatedAt:     integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (t) => [
  uniqueIndex("competitor_rankings_unique")
    .on(t.competitorId, t.careerSaveId, t.seasonYear),
]);

export type CompetitorRanking = typeof competitorRankingsTable.$inferSelect;

export const clubTemplatesTable = sqliteTable("club_templates", {
  id:             integer("id").primaryKey({ autoIncrement: true }),
  name:           text("name").notNull(),
  continent:      text("continent").notNull(),
  town:           text("town").notNull().default("Unknown"),
  rating:         integer("rating").notNull().default(50),
  startingBudget: real("starting_budget").notNull().default(500000),
  reputation:     integer("reputation").notNull().default(50),
  primaryColor:   text("primary_color").notNull().default("#E05A00"),
  secondaryColor: text("secondary_color").notNull().default("#FFFFFF"),
  createdAt:      integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type ClubTemplate = typeof clubTemplatesTable.$inferSelect;

export const careerHistoryEntriesTable = sqliteTable("career_history_entries", {
  id:           integer("id").primaryKey({ autoIncrement: true }),
  userId:       text("user_id").notNull().references(() => usersTable.id),
  careerSaveId: integer("career_save_id").references(() => careerSavesTable.id),
  type:         text("type").notNull(),
  clubName:     text("club_name").notNull(),
  season:       text("season"),
  description:  text("description").notNull(),
  occurredAt:   integer("occurred_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type CareerHistoryEntry    = typeof careerHistoryEntriesTable.$inferSelect;
export type InsertCareerHistoryEntry = typeof careerHistoryEntriesTable.$inferInsert;

export const careerSavesTable = sqliteTable("career_saves", {
  id:           integer("id").primaryKey({ autoIncrement: true }),
  userId:       text("user_id").notNull().references(() => usersTable.id),
  teamId:       integer("team_id").references(() => teamsTable.id),
  slotNumber:   integer("slot_number").notNull(),
  managerName:      text("manager_name").notNull(),
  managerNationality: text("manager_nationality"),
  clubName:         text("club_name").notNull(),
  originalClubName: text("original_club_name"),
  season:       text("season").notNull().default("Season 1"),
  worldRanking: integer("world_ranking"),
  budget:       real("budget"),
  managerReputation: integer("manager_reputation").notNull().default(50),
  retiredAt:    integer("retired_at", { mode: "timestamp" }),
  lastPlayedAt: integer("last_played_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  createdAt:    integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type CareerSave    = typeof careerSavesTable.$inferSelect;
export type InsertCareerSave = typeof careerSavesTable.$inferInsert;

export const hallOfFameTable = sqliteTable("hall_of_fame", {
  id:                   integer("id").primaryKey({ autoIncrement: true }),
  userId:               text("user_id").notNull().references(() => usersTable.id),
  managerName:          text("manager_name").notNull(),
  clubName:             text("club_name").notNull(),
  season:               text("season").notNull(),
  worldRanking:         integer("world_ranking"),
  worldTitles:          integer("world_titles").notNull().default(0),
  olympicMedals:        integer("olympic_medals").notNull().default(0),
  achievementsCompleted: integer("achievements_completed").notNull().default(0),
  totalWins:            integer("total_wins").notNull().default(0),
  totalLosses:          integer("total_losses").notNull().default(0),
  retiredAt:            integer("retired_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type HallOfFameRecord = typeof hallOfFameTable.$inferSelect;

export const poachingOffersTable = sqliteTable("poaching_offers", {
  id:                integer("id").primaryKey({ autoIncrement: true }),
  userId:            text("user_id").notNull().references(() => usersTable.id),
  careerSaveId:      integer("career_save_id").notNull().references(() => careerSavesTable.id),
  clubName:          text("club_name").notNull(),
  continent:         text("continent").notNull(),
  country:           text("country").notNull(),
  logoColor:         text("logo_color").notNull(),
  salary:            integer("salary").notNull(),
  contractLength:    integer("contract_length").notNull(),
  transferBudget:    real("transfer_budget").notNull(),
  seasonExpectation: text("season_expectation").notNull(),
  clubReputation:    integer("club_reputation").notNull(),
  status:            text("status").notNull().default("pending"),
  createdAt:         integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type PoachingOffer       = typeof poachingOffersTable.$inferSelect;
export type InsertPoachingOffer = typeof poachingOffersTable.$inferInsert;

// ── AI Manager World Simulation ───────────────────────────────────────────────

export const aiManagersTable = sqliteTable("ai_managers", {
  id:                    integer("id").primaryKey({ autoIncrement: true }),
  name:                  text("name").notNull(),
  reputation:            integer("reputation").notNull().default(50),
  currentClub:           text("current_club"),
  currentClubReputation: integer("current_club_reputation"),
  status:                text("status").notNull().default("active"),
  hiredAt:               integer("hired_at", { mode: "timestamp" }),
  createdAt:             integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const aiManagerEventsTable = sqliteTable("ai_manager_events", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  managerName: text("manager_name").notNull(),
  eventType:   text("event_type").notNull(),
  fromClub:    text("from_club"),
  toClub:      text("to_club"),
  description: text("description").notNull(),
  occurredAt:  integer("occurred_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type AiManager      = typeof aiManagersTable.$inferSelect;
export type AiManagerEvent = typeof aiManagerEventsTable.$inferSelect;

// Unity Game API — per-player match stats submitted by the Unity client
export const unityMatchStatsTable = sqliteTable("unity_match_stats", {
  id:            integer("id").primaryKey({ autoIncrement: true }),
  matchId:       integer("match_id").notNull(),
  teamId:        integer("team_id").notNull().references(() => teamsTable.id),
  playerId:      integer("player_id").notNull().references(() => playersTable.id),
  points:        integer("points").notNull().default(0),
  errors:        integer("errors").notNull().default(0),
  aces:          integer("aces").notNull().default(0),
  kills:         integer("kills").notNull().default(0),
  blocks:        integer("blocks").notNull().default(0),
  digs:          integer("digs").notNull().default(0),
  servesIn:      integer("serves_in").notNull().default(0),
  servesTotal:   integer("serves_total").notNull().default(0),
  attacksIn:     integer("attacks_in").notNull().default(0),
  attacksTotal:  integer("attacks_total").notNull().default(0),
  minutesPlayed: integer("minutes_played").notNull().default(0),
  createdAt:     integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type UnityMatchStats       = typeof unityMatchStatsTable.$inferSelect;
export type InsertUnityMatchStats = typeof unityMatchStatsTable.$inferInsert;

// Calendar progression system
export const calendarStateTable = sqliteTable("calendar_state", {
  id:             integer("id").primaryKey({ autoIncrement: true }),
  teamId:         integer("team_id").notNull().unique().references(() => teamsTable.id),
  currentDate:    text("current_date").notNull().default("2026-01-15"),
  calendarSpeed:  text("calendar_speed").notNull().default("pause"),
  pendingMatchId: integer("pending_match_id"),
  preMatchSpeed:  text("pre_match_speed"),
  lastSalaryDate: text("last_salary_date"),
  updatedAt:      integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type CalendarState       = typeof calendarStateTable.$inferSelect;
export type InsertCalendarState = typeof calendarStateTable.$inferInsert;

// ── Regional League Competition ───────────────────────────────────────────────
// Stable AI pool teams per continent (seeded once, reused across seasons)
export const continentalPoolTeamsTable = sqliteTable("continental_pool_teams", {
  id:             integer("id").primaryKey({ autoIncrement: true }),
  continent:      text("continent").notNull(),
  stableId:       text("stable_id").notNull().unique(),
  teamName:       text("team_name").notNull(),
  rating:         integer("rating").notNull().default(70),
  form:           integer("form").notNull().default(50),
  fitness:        integer("fitness").notNull().default(80),
  fatigue:        integer("fatigue").notNull().default(0),
  poolRanking:    integer("pool_ranking").notNull().default(0),
  promotionCount: integer("promotion_count").notNull().default(0),
  relegationCount:integer("relegation_count").notNull().default(0),
  isActiveInLeague:integer("is_active_in_league", { mode: "boolean" }).notNull().default(true),
  createdAt:      integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type ContinentalPoolTeam       = typeof continentalPoolTeamsTable.$inferSelect;
export type InsertContinentalPoolTeam = typeof continentalPoolTeamsTable.$inferInsert;

// Two players per pool team — stable across seasons
export const continentalPoolPlayersTable = sqliteTable("continental_pool_players", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  poolTeamId:  integer("pool_team_id").notNull().references(() => continentalPoolTeamsTable.id),
  stableId:    text("stable_id").notNull().unique(),
  name:        text("name").notNull(),
  nationality: text("nationality").notNull().default(""),
  age:         integer("age").notNull().default(22),
  speed:       integer("speed").notNull().default(60),
  power:       integer("power").notNull().default(60),
  defense:     integer("defense").notNull().default(60),
  serve:       integer("serve").notNull().default(60),
  block:       integer("block").notNull().default(60),
  stamina:     integer("stamina").notNull().default(60),
  imageUrl:    text("image_url"),
  createdAt:   integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type ContinentalPoolPlayer       = typeof continentalPoolPlayersTable.$inferSelect;
export type InsertContinentalPoolPlayer = typeof continentalPoolPlayersTable.$inferInsert;

// One season record per continent per season year
export const regionalLeagueSeasonsTable = sqliteTable("regional_league_seasons", {
  id:         integer("id").primaryKey({ autoIncrement: true }),
  seasonYear: integer("season_year").notNull(),
  continent:  text("continent").notNull(),
  teamIds:    text("team_ids", { mode: "json" }).notNull().default([]),
  status:     text("status").notNull().default("active"),
  createdAt:  integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type RegionalLeagueSeason       = typeof regionalLeagueSeasonsTable.$inferSelect;
export type InsertRegionalLeagueSeason = typeof regionalLeagueSeasonsTable.$inferInsert;

// Double round-robin: 10 rounds × 3 matches = 30 fixtures per season per continent
export const regionalLeagueFixturesTable = sqliteTable("regional_league_fixtures", {
  id:                    integer("id").primaryKey({ autoIncrement: true }),
  regionalLeagueSeasonId:integer("regional_league_season_id").notNull().references(() => regionalLeagueSeasonsTable.id),
  round:                 integer("round").notNull(),
  homePoolTeamId:        integer("home_pool_team_id").notNull().references(() => continentalPoolTeamsTable.id),
  awayPoolTeamId:        integer("away_pool_team_id").notNull().references(() => continentalPoolTeamsTable.id),
  homeScore:             integer("home_score"),
  awayScore:             integer("away_score"),
  status:                text("status").notNull().default("scheduled"),
  createdAt:             integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type RegionalLeagueFixture       = typeof regionalLeagueFixturesTable.$inferSelect;
export type InsertRegionalLeagueFixture = typeof regionalLeagueFixturesTable.$inferInsert;

// Match result for each fixture
export const regionalLeagueResultsTable = sqliteTable("regional_league_results", {
  id:              integer("id").primaryKey({ autoIncrement: true }),
  fixtureId:       integer("fixture_id").notNull().unique().references(() => regionalLeagueFixturesTable.id),
  winnerId:        integer("winner_id").references(() => continentalPoolTeamsTable.id),
  homeSets:        integer("home_sets").notNull().default(0),
  awaySets:        integer("away_sets").notNull().default(0),
  homeMatchPoints: integer("home_match_points").notNull().default(0),
  awayMatchPoints: integer("away_match_points").notNull().default(0),
  playedAt:        integer("played_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  createdAt:       integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type RegionalLeagueResult       = typeof regionalLeagueResultsTable.$inferSelect;
export type InsertRegionalLeagueResult = typeof regionalLeagueResultsTable.$inferInsert;

// Season-end World Tour qualification records
export const worldTourQualificationsTable = sqliteTable("world_tour_qualifications", {
  id:                integer("id").primaryKey({ autoIncrement: true }),
  seasonYear:        integer("season_year").notNull(),
  continent:         text("continent").notNull(),
  poolTeamId:        integer("pool_team_id").notNull().references(() => continentalPoolTeamsTable.id),
  qualifyingPosition:integer("qualifying_position").notNull(),
  createdAt:         integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type WorldTourQualification       = typeof worldTourQualificationsTable.$inferSelect;
export type InsertWorldTourQualification = typeof worldTourQualificationsTable.$inferInsert;
