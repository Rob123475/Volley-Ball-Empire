import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { db } from "@workspace/db";
import { matchesTable, teamsTable, playersTable, financeTransactionsTable, locationsTable, staffTable, facilitiesTable, wellbeingEffectsTable, seasonInjuryStatsTable, injuryHistoryTable, promoDealsTable, careerSavesTable, careerHistoryEntriesTable, seasonFinalStandingsTable, managerSeasonSummaryTable, seasonsTable, youthChampionshipTrophiesTable, matchLiveStateTable } from "@workspace/db";
import { eq, desc, gt, gte, and, sql } from "drizzle-orm";
import { WORLD_TOUR } from "../data/worldTour";
import type { WorldTourEvent } from "../data/worldTour";
import { generateScoutingProspects } from "../utils/prospect-generator";
import { simulateYouthLeague, tickAcademyContracts } from "./youth-league";
import { autoCompleteContinentalMissions } from "./continental-scouting";
import { updateCareerStats, checkAchievements } from "../utils/check-achievements";
import { getSession, getSessionId, updateSession } from "../lib/auth.js";
import { startMatchTick } from "../utils/match-tick-engine.js";

const router = Router();

// ── Weather system ────────────────────────────────────────────────────────────
// Location pools: biased toward the typical climate of each real-world venue.
// Each string appears multiple times to weight probability.
// Types: clear, sunny, windy, rain, hot, extreme_heat, stormy, perfect, cloudy, overcast
const LOCATION_WEATHER_POOLS: Record<number, string[]> = {
  1:  ["sunny","sunny","hot","hot","rain","stormy","perfect","cloudy"],           // Copacabana – tropical
  11: ["hot","hot","extreme_heat","hot","sunny","sunny","windy","perfect"],       // Hurghada – Red Sea desert
  2:  ["sunny","sunny","windy","windy","cloudy","perfect","overcast","clear"],    // Bondi – breezy southern
  3:  ["sunny","sunny","sunny","hot","perfect","cloudy","windy","clear"],         // Waikiki – balmy trade-winds
  4:  ["sunny","hot","hot","stormy","rain","cloudy","windy","overcast"],          // Clearwater – Florida heat/storms
  5:  ["hot","hot","sunny","stormy","rain","cloudy","sunny","overcast"],          // Varadero – Caribbean
  6:  ["sunny","hot","hot","perfect","rain","stormy","cloudy","sunny"],           // Ipanema – tropical
  7:  ["hot","hot","stormy","rain","rain","cloudy","sunny","overcast"],           // Kata Beach – Southeast Asia
  8:  ["sunny","sunny","windy","windy","perfect","cloudy","hot","clear"],         // Mykonos – Mediterranean meltemi
  9:  ["hot","sunny","stormy","rain","cloudy","sunny","overcast","perfect"],      // Bali – tropical
  10: ["cloudy","cloudy","windy","overcast","perfect","sunny","stormy","rain"],   // Nice – Mediterranean, variable
};

// Fallback for unknown location ids
const DEFAULT_POOL = ["sunny","clear","cloudy","windy","hot","overcast","stormy","perfect","rain"];

type WeatherResult = { weather: string; windSpeed: number; temperature: number };

function generateWeather(locId?: number | null): WeatherResult {
  const pool = (locId != null ? LOCATION_WEATHER_POOLS[locId] : null) ?? DEFAULT_POOL;
  const weather = pool[Math.floor(Math.random() * pool.length)];

  // Weather-conditional wind & temperature ranges for realism
  let wind: number, temp: number;
  switch (weather) {
    case "stormy":
      wind = 22 + Math.random() * 32;   // 22–54 km/h — genuinely dangerous
      temp = 17 + Math.random() * 9;    // 17–26°C — cooled by storm
      break;
    case "windy":
      wind = 20 + Math.random() * 24;   // 20–44 km/h
      temp = 16 + Math.random() * 16;   // 16–32°C
      break;
    case "rain":
      wind = 8 + Math.random() * 20;    // 8–28 km/h — moderate wind with rain
      temp = 14 + Math.random() * 12;   // 14–26°C — cooler in rain
      break;
    case "hot":
      wind = Math.random() * 9;         // 0–9 km/h — still & sweltering
      temp = 34 + Math.random() * 13;   // 34–47°C
      break;
    case "extreme_heat":
      wind = Math.random() * 6;         // 0–6 km/h — barely any breeze
      temp = 44 + Math.random() * 10;   // 44–54°C — dangerously hot
      break;
    case "perfect":
      wind = 6 + Math.random() * 10;    // 6–16 km/h — pleasant sea breeze
      temp = 22 + Math.random() * 9;    // 22–31°C
      break;
    case "clear":
      wind = 2 + Math.random() * 10;    // 2–12 km/h — calm & bright
      temp = 22 + Math.random() * 12;   // 22–34°C
      break;
    case "overcast":
      wind = 10 + Math.random() * 18;   // 10–28 km/h
      temp = 15 + Math.random() * 13;   // 15–28°C
      break;
    case "cloudy":
      wind = 6 + Math.random() * 17;    // 6–23 km/h
      temp = 17 + Math.random() * 14;   // 17–31°C
      break;
    case "sunny":
    default:
      wind = Math.random() * 16;        // 0–16 km/h
      temp = 24 + Math.random() * 15;   // 24–39°C
      break;
  }

  // 8% chance of extreme conditions (heatwave spike, gale burst, cold snap)
  if (Math.random() < 0.08) {
    const roll = Math.random();
    if (roll < 0.4) {
      temp  = Math.min(temp + 6 + Math.random() * 6, 54);  // Heatwave
    } else if (roll < 0.75) {
      wind  = Math.min(wind * 1.8 + Math.random() * 10, 65); // Gale
    } else {
      temp  = Math.max(temp - 8 - Math.random() * 6, 8);   // Cold snap
    }
  }

  return {
    weather,
    windSpeed:   Number(wind.toFixed(1)),
    temperature: Number(temp.toFixed(1)),
  };
}

// ── Weather effect modifiers ──────────────────────────────────────────────────
// Returns a structured set of multipliers/addends for simulation and post-match.
export type WeatherEffects = {
  /** Performance penalty applied to avgStat (0 = none, 0.3 = 30% disadvantage) */
  performancePenalty: number;
  /** Extra fatigue added on top of the base 15–25 fatigue cost */
  extraFatigue: number;
  /** Multiplier on base injury risk (1.0 = unchanged) */
  injuryRiskMultiplier: number;
  /** Penalty to serve accuracy — reduces effective serve stat by this fraction */
  serveAccuracyPenalty: number;
  /** Modifier to home/away score randomness (+N means scores can vary more) */
  rallyRandomness: number;
  /** Label describing conditions for the UI */
  label: string;
  /** Severity: 'favorable' | 'neutral' | 'moderate' | 'harsh' | 'extreme' */
  severity: "favorable" | "neutral" | "moderate" | "harsh" | "extreme";
};

export function getWeatherEffects(weather: string, windSpeed: number, temperature: number): WeatherEffects {
  // Base wind penalty — scales with actual wind speed
  const windPenalty = Math.min(windSpeed / 50, 0.30);

  switch (weather) {
    case "extreme_heat":
      return {
        performancePenalty:   0.14 + windPenalty,
        extraFatigue:         18,
        injuryRiskMultiplier: 1.6,
        serveAccuracyPenalty: 0.10,
        rallyRandomness:      1,
        label:                `Extreme Heat ${temperature.toFixed(0)}°C`,
        severity:             "extreme",
      };
    case "stormy":
      return {
        performancePenalty:   windPenalty + 0.06,
        extraFatigue:         10,
        injuryRiskMultiplier: 1.4,
        serveAccuracyPenalty: windPenalty * 0.8,
        rallyRandomness:      2,
        label:                `Storm ${windSpeed.toFixed(0)} km/h`,
        severity:             windPenalty > 0.2 ? "extreme" : "harsh",
      };
    case "rain":
      return {
        performancePenalty:   0.08 + windPenalty * 0.5,
        extraFatigue:         6,
        injuryRiskMultiplier: 1.25,
        serveAccuracyPenalty: 0.08,
        rallyRandomness:      2,
        label:                `Rain ${temperature.toFixed(0)}°C`,
        severity:             "harsh",
      };
    case "hot":
      return {
        performancePenalty:   0.08 + windPenalty,
        extraFatigue:         8,
        injuryRiskMultiplier: 1.2,
        serveAccuracyPenalty: 0.04,
        rallyRandomness:      1,
        label:                `Hot ${temperature.toFixed(0)}°C`,
        severity:             "moderate",
      };
    case "windy":
      return {
        performancePenalty:   windPenalty,
        extraFatigue:         4,
        injuryRiskMultiplier: 1.1,
        serveAccuracyPenalty: windPenalty * 0.6,
        rallyRandomness:      1,
        label:                `Windy ${windSpeed.toFixed(0)} km/h`,
        severity:             windPenalty > 0.2 ? "harsh" : "moderate",
      };
    case "overcast":
      return {
        performancePenalty:   windPenalty * 0.5,
        extraFatigue:         2,
        injuryRiskMultiplier: 1.0,
        serveAccuracyPenalty: 0,
        rallyRandomness:      0,
        label:                `Overcast ${temperature.toFixed(0)}°C`,
        severity:             "neutral",
      };
    case "cloudy":
      return {
        performancePenalty:   windPenalty * 0.4,
        extraFatigue:         1,
        injuryRiskMultiplier: 1.0,
        serveAccuracyPenalty: 0,
        rallyRandomness:      0,
        label:                `Cloudy ${temperature.toFixed(0)}°C`,
        severity:             "neutral",
      };
    case "perfect":
      return {
        performancePenalty:   0,
        extraFatigue:         -2,  // slight recovery bonus
        injuryRiskMultiplier: 0.9,
        serveAccuracyPenalty: 0,
        rallyRandomness:      -1,  // more consistent rallies
        label:                `Perfect ${temperature.toFixed(0)}°C`,
        severity:             "favorable",
      };
    case "clear":
      return {
        performancePenalty:   0,
        extraFatigue:         0,
        injuryRiskMultiplier: 0.95,
        serveAccuracyPenalty: 0,
        rallyRandomness:      0,
        label:                `Clear ${temperature.toFixed(0)}°C`,
        severity:             "neutral",
      };
    case "sunny":
    default:
      return {
        performancePenalty:   windPenalty * 0.3,
        extraFatigue:         3,
        injuryRiskMultiplier: 1.0,
        serveAccuracyPenalty: 0,
        rallyRandomness:      0,
        label:                `Sunny ${temperature.toFixed(0)}°C`,
        severity:             "neutral",
      };
  }
}

export const serializeMatch = (m: any) => ({
  ...m,
  prizeAmount: m.prizeAmount ? Number(m.prizeAmount) : null,
  windSpeed:   m.windSpeed   ? Number(m.windSpeed)   : null,
  temperature: m.temperature ? Number(m.temperature) : null,
  lineup:     Array.isArray(m.lineup)     ? m.lineup     : [],
  highlights: Array.isArray(m.highlights) ? m.highlights : [],
});

// ── Post-match health mechanics ────────────────────────────────────────────────

const MEDICAL_ROLES = ["fitness_trainer", "strength_conditioner", "massage_therapist", "physio", "physiotherapist"];

async function getBestMedicalSkill(teamId: number): Promise<number> {
  const staff = await db.select().from(staffTable).where(eq(staffTable.teamId, teamId));
  const medics = staff.filter(s => MEDICAL_ROLES.includes(s.role));
  return medics.length > 0 ? Math.max(...medics.map(s => s.skillLevel)) : 0;
}

/** Returns probability (0–0.60) of a player getting injured this match. */
function calcInjuryRisk(fatigue: number, stamina: number, consecutive: number, injuryStatus: string, sportsLabLevel = 1, hasRecoveryCamp = false): number {
  let risk = 0.05;

  // Fatigue makes the body fragile
  if      (fatigue > 85) risk += 0.12;
  else if (fatigue > 70) risk += 0.06;
  else if (fatigue > 55) risk += 0.02;

  // Low stamina = poor physical resilience
  risk += ((100 - stamina) / 100) * 0.08;

  // Back-to-back matches wear the body down
  if      (consecutive >= 4) risk += 0.05;
  else if (consecutive >= 2) risk += 0.02;

  // Already hurt and still playing — 2.5× multiplier
  if (injuryStatus !== "Healthy") risk *= 2.5;

  // Sports Science Lab: reduces injury risk (0% at L1, −25% at L10)
  const labFactor  = 1 - (sportsLabLevel - 1) * (0.25 / 9);
  // Recovery Retreat camp: additional −15% while active
  const campFactor = hasRecoveryCamp ? 0.85 : 1.0;
  return Math.min(risk * labFactor * campFactor, 0.60);
}

/** Rolls the severity of a new injury (or worsening). */
function rollInjurySeverity(currentStatus: string): { status: string; weeks: number } {
  const roll = Math.random();
  if (currentStatus !== "Healthy") {
    // Playing through injury — high chance of making it much worse
    if (roll < 0.30) return { status: "Major Injury", weeks: 6  };
    if (roll < 0.70) return { status: "Unavailable",  weeks: 10 };
    return                  { status: "Unavailable",  weeks: 14 };
  }
  if (roll < 0.60) return   { status: "Minor Injury", weeks: 2  };
  if (roll < 0.90) return   { status: "Major Injury", weeks: 6  };
  return                    { status: "Unavailable",  weeks: 12 };
}

export type PlayerEvent = {
  playerId: number;
  playerName: string;
  event: "injury_new" | "injury_worsened" | "recovery_complete";
  injuryStatus?: string;
  weeksOut?: number;
};

/**
 * Applies post-match health effects to every player on the team:
 *  - Active players:  fatigue ↑, fitness ↓, injury risk roll, consecutive streak ↑
 *  - Bench/reserve:   fatigue ↓, fitness ↑, consecutive resets, injury weeks tick down
 * Returns events (new injuries, worsenings, recoveries) for the UI to surface.
 */
export async function applyPostMatchEffects(teamId: number, weather: string, facilityLevels: Record<string, number> = {}, hasRecoveryCamp = false, windSpeed = 0, temperature = 25): Promise<PlayerEvent[]> {
  const [players, physioSkill] = await Promise.all([
    db.select().from(playersTable).where(eq(playersTable.teamId, teamId)),
    getBestMedicalSkill(teamId),
  ]);

  const medCentreLevel  = facilityLevels.medical_centre     ?? 1;
  const sportsLabLevel  = facilityLevels.sports_science_lab ?? 1;

  const events: PlayerEvent[] = [];
  const wx = getWeatherEffects(weather, windSpeed, temperature);

  for (const player of players) {
    const updates: Record<string, unknown> = {};
    const prevStatus  = (player.injuryStatus  as string)  ?? "Healthy";
    const curFatigue  = player.fatigue  ?? 0;
    const curFitness  = (player.fitness  as number) ?? 100;
    const consecutive = (player.consecutiveMatchesPlayed as number) ?? 0;

    if (player.isActive) {
      // ── Played this match ──────────────────────────────────────────────────
      const fatigueCost = 15 + Math.floor(Math.random() * 11) + Math.max(0, wx.extraFatigue);
      updates.fatigue  = Math.min(100, curFatigue + fatigueCost);
      updates.fitness  = Math.max(0, curFitness - 3 - Math.floor(Math.random() * 6));
      updates.consecutiveMatchesPlayed = consecutive + 1;

      // Injury risk roll — weather, fatigue, stamina, and injury status all affect risk
      const baseRisk = calcInjuryRisk(curFatigue, player.stamina, consecutive, prevStatus, sportsLabLevel, hasRecoveryCamp);
      const risk = Math.min(baseRisk * wx.injuryRiskMultiplier, 0.70);
      if (Math.random() < risk) {
        const inj = rollInjurySeverity(prevStatus);
        updates.injuryStatus        = inj.status;
        updates.injuryWeeksRemaining = inj.weeks;
        updates.isInjured           = true;
        events.push({
          playerId:    player.id,
          playerName:  player.name,
          event:       prevStatus !== "Healthy" ? "injury_worsened" : "injury_new",
          injuryStatus: inj.status,
          weeksOut:    inj.weeks,
        });
      }
    } else {
      // ── Resting this match ────────────────────────────────────────────────
      updates.fatigue  = Math.max(0, curFatigue - 8 - Math.floor(Math.random() * 7));
      updates.fitness  = Math.min(100, curFitness + 3 + Math.floor(Math.random() * 4));
      updates.consecutiveMatchesPlayed = 0;

      // Injury recovery tick — physio skill + Medical Centre both speed recovery
      const weeksLeft = (player.injuryWeeksRemaining as number) ?? 0;
      if (weeksLeft > 0) {
        const extraTick        = Math.random() < physioSkill / 250 ? 1 : 0;
        // Medical Centre: +0 at L1, −1 extra week per tick at L10
        const facilityReduction = (medCentreLevel - 1) * (1.0 / 9);
        const newWeeks    = Math.max(0, weeksLeft - 1 - extraTick - facilityReduction);
        updates.injuryWeeksRemaining = newWeeks;
        if (newWeeks === 0) {
          updates.injuryStatus = "Healthy";
          updates.isInjured    = false;
          events.push({ playerId: player.id, playerName: player.name, event: "recovery_complete" });
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.update(playersTable).set(updates).where(eq(playersTable.id, player.id));
    }
  }

  return events;
}


// ── Season fixture (fixed 76-round structure) ─────────────────────────────────
// Returns all non-finals events (rounds 1–72: regular + continental finals).
// The 4-match World Finals (rounds 73–76) are handled separately.
const FINALS_TIERS = new Set(["World Semi Final", "All-Star Match", "World Final"]);

function generateSeasonFixture(): WorldTourEvent[] {
  return WORLD_TOUR.filter(e => !FINALS_TIERS.has(e.tier));
}

// ── World Finals rival team names (fallback when DB has no other teams) ────────
const WORLD_FINALS_RIVALS = [
  "Rio Diamonds FC", "Seoul Aces Elite", "Berlin Beach Masters",
  "Lagos Surf Queens", "Cape Town Eagles", "Manila Bay Stars",
  "Athens Olympians", "Dubai Desert Elite", "Sydney Thunderbirds",
];

async function getWorldFinalsSeedings(userTeamId: number, userTeamName: string): Promise<string[]> {
  const others = await db
    .select({ id: teamsTable.id, name: teamsTable.name, wins: teamsTable.wins })
    .from(teamsTable)
    .where(eq(teamsTable.id, userTeamId))
    .limit(1);

  const allTeams = await db
    .select({ id: teamsTable.id, name: teamsTable.name, wins: teamsTable.wins })
    .from(teamsTable)
    .orderBy(desc(teamsTable.wins));

  const rivalTeams = allTeams.filter(t => t.id !== userTeamId).slice(0, 3);
  const rivals: string[] = rivalTeams.map(t => t.name);
  while (rivals.length < 3) {
    const idx = (userTeamId * 17 + rivals.length * 31) % WORLD_FINALS_RIVALS.length;
    rivals.push(WORLD_FINALS_RIVALS[idx] ?? "World Select");
  }
  const userWins = others[0]?.wins ?? 0;
  const rival0Wins = rivalTeams[0]?.wins ?? 0;

  if (userWins >= rival0Wins) {
    return [userTeamName, rivals[0]!, rivals[1]!, rivals[2]!];
  }
  return [rivals[0]!, userTeamName, rivals[1]!, rivals[2]!];
}

router.get("/matches", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.json([]); return; }
  const matches = await db.select().from(matchesTable)
    .where(eq(matchesTable.homeTeamId, team.id))
    .orderBy(desc(matchesTable.createdAt)).limit(50);
  res.json(matches.map(serializeMatch));
});

router.post("/matches", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const { awayTeamId, locationId, season, round, teamSize, scheduledAt, prizeAmount } = req.body;
  const { weather, windSpeed, temperature } = generateWeather(Number(locationId));
  const [match] = await db.insert(matchesTable).values({
    homeTeamId: team.id,
    awayTeamId: team.id,
    locationId: Number(locationId),
    weather,
    windSpeed,
    temperature,
    season:    Number(season),
    round:     Number(round),
    teamSize:  Number(teamSize),
    scheduledAt,
    homeTeamName: team.name,
    prizeAmount: prizeAmount ? Number(prizeAmount) : 5000,
  }).returning();
  res.status(201).json(serializeMatch(match));
});

router.get("/matches/upcoming", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.json([]); return; }
  const matches = await db.select().from(matchesTable)
    .where(eq(matchesTable.homeTeamId, team.id))
    .orderBy(matchesTable.createdAt).limit(5);
  res.json(matches.filter(m => m.status === "scheduled").map(serializeMatch));
});

// Full season fixture — fixed 76-event schedule (72 regular/cont + 4 world finals)
router.get("/matches/fixture", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.json([]); return; }

  const [activeSeason] = await db.select().from(seasonsTable).where(eq(seasonsTable.status, "active")).limit(1);
  if (!activeSeason) { res.status(400).json({ error: "No active season" }); return; }
  const seasonYear = activeSeason.year;

  let existing = await db.select().from(matchesTable)
    .where(and(eq(matchesTable.homeTeamId, team.id), eq(matchesTable.season, seasonYear)))
    .orderBy(matchesTable.round);

  // Migration: has old fixtures but is missing the World Finals events (e.g. saves
  // created before Finals matches existed) — remove any stale rounds >= 67 and
  // re-add the current World Finals events (see the `else if (!hasWorldFinals)`
  // branch below).
  const hasWorldFinals = existing.some(m => FINALS_TIERS.has(m.tier ?? ""));
  if (existing.length > 0 && !hasWorldFinals) {
    await db.delete(matchesTable).where(
      and(
        eq(matchesTable.homeTeamId, team.id),
        eq(matchesTable.season, seasonYear),
        gte(matchesTable.round, 67),
      )
    );
    existing = existing.filter(m => (m.round ?? 0) < 67);
  }

  if (existing.length === 0) {
    // Full fresh fixture: 72 regular/continental events + 4 World Finals
    const regularEvents = generateSeasonFixture();
    const worldFinalsEvents = WORLD_TOUR.filter(e => FINALS_TIERS.has(e.tier));
    const finalLocIds = Object.keys(LOCATION_WEATHER_POOLS).map(Number);
    const finalLocId = finalLocIds[Math.floor(Math.random() * finalLocIds.length)];
    const [finalLoc] = await db.select().from(locationsTable).where(eq(locationsTable.id, finalLocId));
    const finalsLocationName = finalLoc ? `${finalLoc.name} • ${finalLoc.country}` : "Copacabana Beach • Brazil";

    for (const f of regularEvents) {
      const { weather, windSpeed, temperature } = generateWeather(f.locId);
      await db.insert(matchesTable).values({
        homeTeamId:   team.id,
        awayTeamId:   team.id,
        locationId:   f.locId,
        locationName: f.locName,
        homeTeamName: team.name,
        awayTeamName: f.opponent,
        weather,
        windSpeed,
        temperature,
        season:      seasonYear,
        round:       f.round,
        teamSize:    2,
        scheduledAt: `${f.date}T14:00:00.000Z`,
        prizeAmount:  f.prize,
        status:      "scheduled",
        continent:   f.continent,
        tier:        f.tier,
      });
    }

    for (const f of worldFinalsEvents) {
      const { weather, windSpeed, temperature } = generateWeather(finalLocId);
      const isAllStar = f.tier === "All-Star Match";
      await db.insert(matchesTable).values({
        homeTeamId:   team.id,
        awayTeamId:   team.id,
        locationId:   finalLocId,
        locationName: finalsLocationName,
        homeTeamName: isAllStar ? "Europe / Asia / Oceania All-Stars" : team.name,
        awayTeamName: f.opponent,
        weather,
        windSpeed,
        temperature,
        season:      seasonYear,
        round:       f.round,
        teamSize:    2,
        scheduledAt: `${f.date}T14:00:00.000Z`,
        prizeAmount:  f.prize,
        status:      "scheduled",
        continent:   f.continent,
        tier:        f.tier,
      });
    }

    existing = await db.select().from(matchesTable)
      .where(and(eq(matchesTable.homeTeamId, team.id), eq(matchesTable.season, seasonYear)))
      .orderBy(matchesTable.round);
  } else if (!hasWorldFinals) {
    // Only add the 4 World Finals matches (migration 2 path)
    const worldFinalsEvents = WORLD_TOUR.filter(e => FINALS_TIERS.has(e.tier));
    const finalLocIds = Object.keys(LOCATION_WEATHER_POOLS).map(Number);
    const finalLocId = finalLocIds[Math.floor(Math.random() * finalLocIds.length)];
    const [finalLoc] = await db.select().from(locationsTable).where(eq(locationsTable.id, finalLocId));
    const finalsLocationName = finalLoc ? `${finalLoc.name} • ${finalLoc.country}` : "Copacabana Beach • Brazil";

    for (const f of worldFinalsEvents) {
      const { weather, windSpeed, temperature } = generateWeather(finalLocId);
      const isAllStar = f.tier === "All-Star Match";
      await db.insert(matchesTable).values({
        homeTeamId:   team.id,
        awayTeamId:   team.id,
        locationId:   finalLocId,
        locationName: finalsLocationName,
        homeTeamName: isAllStar ? "Europe / Asia / Oceania All-Stars" : team.name,
        awayTeamName: f.opponent,
        weather,
        windSpeed,
        temperature,
        season:      seasonYear,
        round:       f.round,
        teamSize:    2,
        scheduledAt: `${f.date}T14:00:00.000Z`,
        prizeAmount:  f.prize,
        status:      "scheduled",
        continent:   f.continent,
        tier:        f.tier,
      });
    }

    existing = await db.select().from(matchesTable)
      .where(and(eq(matchesTable.homeTeamId, team.id), eq(matchesTable.season, seasonYear)))
      .orderBy(matchesTable.round);
  }

  // ── Lazy seeding resolution ────────────────────────────────────────────────
  // Once all 6 continental finals are completed, resolve the top-4 team seedings
  // and populate awayTeamName on SF1, SF2, and the World Final.
  const contFinals = existing.filter(m => m.tier === "Continental Final");
  const allContFinalsComplete = contFinals.length === 6 && contFinals.every(m => m.status === "completed");

  if (allContFinalsComplete) {
    const sf1 = existing.find(m => m.tier === "World Semi Final" && m.round === 73);
    const sf2 = existing.find(m => m.tier === "World Semi Final" && m.round === 74);
    const wf  = existing.find(m => m.tier === "World Final");

    // Populate SF seedings if not yet resolved
    if (sf1 && sf1.awayTeamName === "TBD") {
      const seeds = await getWorldFinalsSeedings(team.id, team.name);
      // seeds = [rank1, rank2, rank3, rank4]
      // SF1: player (rank1 or 2) vs their paired seed
      // SF2: the other pair
      const playerIdx = seeds.indexOf(team.name);
      const sf1Home = team.name;
      const sf1Away = playerIdx === 0 ? seeds[1]! : seeds[0]!;
      const sf2Home = playerIdx === 0 ? seeds[2]! : seeds[2]!;
      const sf2Away = playerIdx === 0 ? seeds[3]! : seeds[3]!;

      await db.update(matchesTable)
        .set({ awayTeamName: sf1Away })
        .where(eq(matchesTable.id, sf1.id));
      sf1.awayTeamName = sf1Away;

      if (sf2) {
        await db.update(matchesTable)
          .set({ homeTeamName: sf2Home, awayTeamName: sf2Away })
          .where(eq(matchesTable.id, sf2.id));
        sf2.homeTeamName = sf2Home;
        sf2.awayTeamName = sf2Away;
      }
    }

    // Populate World Final opponent from SF2 result
    if (wf && wf.awayTeamName === "TBD" && sf2 && sf2.status === "completed") {
      const sf2Winner = (sf2.homeScore ?? 0) > (sf2.awayScore ?? 0)
        ? (sf2.homeTeamName ?? "SF2 Winner")
        : (sf2.awayTeamName ?? "SF2 Winner");
      await db.update(matchesTable)
        .set({ awayTeamName: sf2Winner })
        .where(eq(matchesTable.id, wf.id));
      wf.awayTeamName = sf2Winner;
    }
  }

  res.json(existing.map(serializeMatch));
});

router.get("/matches/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const match = await db.query.matchesTable.findFirst({ where: eq(matchesTable.id, id) });
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }
  res.json(serializeMatch(match));
});

/**
 * POST /matches/:id/watch
 * Starts the point-tick engine for a match and marks it in_progress.
 * The frontend navigates to /court after calling this; Unity then polls
 * GET /unity/match-state?matchId=:id to see each tick update.
 */
router.post("/matches/:id/watch", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid match id" }); return; }
  const match = await db.query.matchesTable.findFirst({ where: eq(matchesTable.id, id) });
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }
  if (match.status === "completed") {
    res.status(409).json({ error: "Match already completed" });
    return;
  }
  const result = await startMatchTick(id);
  if (!result.ok) {
    res.status(500).json({ error: result.error ?? "Failed to start match" });
    return;
  }
  res.json({ ok: true, matchId: id });
});

/**
 * GET /matches/:id/live-state
 * Returns the latest tick state from matchLiveStateTable. Returns 404 if
 * the match hasn't been started via /watch yet.
 */
router.get("/matches/:id/live-state", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid match id" }); return; }
  const liveState = await db.query.matchLiveStateTable.findFirst({
    where: eq(matchLiveStateTable.matchId, id),
  });
  if (!liveState) { res.status(404).json({ error: "No live state for this match" }); return; }
  res.json(liveState);
});

router.post("/matches/:id/simulate", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const match = await db.query.matchesTable.findFirst({ where: eq(matchesTable.id, id) });
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }

  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }

  // Load all facility levels and active wellbeing effects for match bonuses
  const [facilityRows, wellbeingEffects] = await Promise.all([
    db.select().from(facilitiesTable).where(eq(facilitiesTable.teamId, team.id)),
    db.select().from(wellbeingEffectsTable).where(
      and(eq(wellbeingEffectsTable.teamId, team.id), gt(wellbeingEffectsTable.matchesRemaining, 0))
    ),
  ]);
  const facilityLevels: Record<string, number> = Object.fromEntries(facilityRows.map(f => [f.type, f.level]));
  const hasPsychCamp    = wellbeingEffects.some(e => e.effectType === "psych_camp");
  const hasRecoveryCamp = wellbeingEffects.some(e => e.effectType === "recovery_camp");

  const players = await db.select().from(playersTable).where(eq(playersTable.teamId, team.id));
  const activePlayers = players.filter(p => p.isActive);
  const avgStat = activePlayers.length > 0
    ? activePlayers.reduce((acc, p) => acc + p.power + p.defense + p.serve, 0) / (activePlayers.length * 3)
    : 65;

  // Weather impact on match difficulty
  const matchWindSpeed = Number(match.windSpeed ?? 0);
  const matchTemp      = Number(match.temperature ?? 25);
  const wx = getWeatherEffects(match.weather, matchWindSpeed, matchTemp);
  const weatherFactor = 1 - wx.performancePenalty;

  const isFinal        = match.tier === "World Final";
  const isAllStar      = match.tier === "All-Star Match";
  const isWorldSemiFinal = match.tier === "World Semi Final";
  const isHighPressure = isFinal || isWorldSemiFinal || match.tier === "Continental Final";

  // Psychology Centre: lowers stat threshold in finals (70→61, L1→L10)
  // Sports Psychology Camp: additional −3 while active
  const psychLevel         = facilityLevels.psychology_centre ?? 1;
  const psychBonusFromCamp = hasPsychCamp ? 3 : 0;
  const statThreshold = isHighPressure ? Math.max(58, 70 - (psychLevel - 1) - psychBonusFromCamp) : 70;

  // Score source: either the point-tick engine already played this match live
  // (body carries the real outcome) or we fall back to the instant random roll
  // used by the "Sim Result" button.
  const precomputed: { homeScore: number; awayScore: number; sets?: { home: number; away: number }[] } | undefined =
    req.body?.precomputedResult;

  let homeScore: number;
  let awayScore: number;
  if (precomputed && Number.isInteger(precomputed.homeScore) && Number.isInteger(precomputed.awayScore)) {
    homeScore = precomputed.homeScore;
    awayScore = precomputed.awayScore;
  } else {
    // Rally randomness: harsh weather = more chaos, perfect = consistent play
    const baseRoll = Math.max(2, 3 + wx.rallyRandomness);
    homeScore = Math.floor(Math.random() * baseRoll) + (avgStat * weatherFactor > statThreshold ? 2 : 1);
    awayScore = Math.floor(Math.random() * baseRoll) + 1;
  }
  const homeWon = homeScore > awayScore;

  const weatherHighlights: Record<string, string> = {
    stormy:       "Players battle through gusting winds and dramatic conditions!",
    windy:        "A powerful gust deflects the serve at a crucial moment!",
    rain:         "The rain-soaked sand makes every dive a heart-stopping moment!",
    hot:          "The searing heat takes its toll — fatigue is a real factor today!",
    extreme_heat: "Brutal heat pushes both teams to their absolute limits!",
    overcast:     "Cool overcast conditions let both teams play at full intensity.",
    perfect:      "Perfect beach volleyball weather produces spectacular play!",
    clear:        "Crystal-clear skies and calm winds — ideal conditions!",
  };

  const highlightTemplates = [
    "Spectacular dive save keeps the rally alive!",
    "Thunderous spike from the back row!",
    "Perfect set leads to a crushing attack!",
    "A powerful jump serve aces the opposition!",
    "Incredible block at the net turns the momentum!",
    "The team battles back from match point!",
    "A pinpoint drop shot catches everyone off guard!",
    weatherHighlights[match.weather] ?? "The crowd erupts — what a match!",
    isFinal ? "The crowd erupts as the championship is decided!" : isWorldSemiFinal ? "A place in the Final is on the line!" : "The home crowd goes wild!",
    isFinal ? "History is made on the sands!" : isWorldSemiFinal ? "One step from the World Final!" : isAllStar ? "The All-Star crowd is electric!" : "A defining moment in the season!",
  ];
  const highlights = Array.from({ length: 4 }, () =>
    highlightTemplates[Math.floor(Math.random() * highlightTemplates.length)]
  );

  const mvp = activePlayers.length > 0
    ? activePlayers.reduce((best, p) => (p.power + p.serve) > (best.power + best.serve) ? p : best, activePlayers[0])
    : null;

  // All-Star match is an exhibition: prize is always 0 for standings purposes.
  const prizeEarned = (homeWon && !isAllStar) ? Number(match.prizeAmount || 5000) : 0;

  const [updatedMatch] = await db.update(matchesTable).set({
    homeScore,
    awayScore,
    status: "completed",
    highlights,
    ...(precomputed?.sets ? { sets: precomputed.sets } : {}),
  }).where(eq(matchesTable.id, id)).returning();

  // All-Star exhibition: no standings updates (wins/losses/prize/board confidence unchanged).
  if (isAllStar) {
    const playerEvents = await applyPostMatchEffects(team.id, match.weather, facilityLevels, hasRecoveryCamp, matchWindSpeed, matchTemp);
    res.json({
      match:        serializeMatch(updatedMatch),
      highlights,
      homeScore,
      awayScore,
      winner:       homeWon ? "home" : "away",
      prizeEarned:  0,
      mvp:          mvp ? { ...mvp, height: Number(mvp.height), salary: Number(mvp.salary) } : null,
      isFinal:      false,
      fired:        false,
      dismissalClubName: null,
      weather:      match.weather,
      windSpeed:    matchWindSpeed,
      temperature:  matchTemp,
      locationName: match.locationName,
      weatherImpact: wx.performancePenalty > 0.05 ? match.weather : null,
      playerEvents,
      isAllStar:    true,
    });
    return;
  }

  if (homeWon) {
    const isChampionship = isFinal && homeWon;
    const isContFinal    = match.tier === "Continental Final";
    const newStreak      = (team.winStreak ?? 0) + 1;
    // Rep gain: +10 every win, +15 for Continental Final, +15 for Semi Final, +40 for World Final, +5 if on a 3+ streak
    const tierRepBonus   = isFinal ? 40 : isWorldSemiFinal ? 15 : isContFinal ? 15 : 0;
    const streakRepBonus = newStreak >= 3 ? 5 : 0;
    const repGain        = 10 + tierRepBonus + streakRepBonus;

    // Sponsor reputation gain: +1 base, +3 Continental Final / Semi Final, +5 World Final
    const newWins        = team.wins + 1;
    const sponsorTierBonus = isFinal ? 5 : (isWorldSemiFinal || isContFinal) ? 3 : 0;

    // Check if any accepted promo deal just completed with this win (+5 per deal)
    const acceptedDeals = await db.select()
      .from(promoDealsTable)
      .where(and(eq(promoDealsTable.teamId, team.id), eq(promoDealsTable.isAccepted, true)));
    const newlyCompleted = acceptedDeals.filter(d => d.requirementWins === newWins).length;
    const sponsorDealBonus = newlyCompleted * 5;

    const sponsorRepGain = 1 + sponsorTierBonus + sponsorDealBonus;
    const newSponsorRep  = Math.min(100, (team.sponsorReputation ?? 50) + sponsorRepGain);

    // Board confidence: +3 normal, +5 cont/semi final, +8 world final
    const confWinDelta     = isFinal ? 8 : (isContFinal || isWorldSemiFinal) ? 5 : 3;

    await db.update(teamsTable).set({
      wins:              newWins,
      budget:            Number(team.budget) + prizeEarned,
      winStreak:         newStreak,
      managerRepPoints:  (team.managerRepPoints ?? 0) + repGain,
      sponsorReputation: newSponsorRep,
      boardConfidence:   Math.min(100, (team.boardConfidence ?? 60) + confWinDelta),
      ...(isChampionship ? { titlesWon: team.titlesWon + 1 } : {}),
    }).where(eq(teamsTable.id, team.id));
    const today = new Date().toISOString().split("T")[0];
    await db.insert(financeTransactionsTable).values({
      teamId:      team.id,
      type:        "income",
      amount:      prizeEarned,
      description: `Prize money: ${isFinal ? "WORLD FINAL" : isWorldSemiFinal ? "SEMI FINAL" : `Round ${match.round}`} vs ${match.awayTeamName ?? "Opponent"}`,
      category:    "prize_money",
      date:        today,
    });
  } else {
    // Sponsor reputation: -1 per loss, clamped at 0
    const newSponsorRep = Math.max(0, (team.sponsorReputation ?? 50) - 1);
    await db.update(teamsTable).set({
      losses:            team.losses + 1,
      winStreak:         0,
      sponsorReputation: newSponsorRep,
      boardConfidence:   Math.max(0, (team.boardConfidence ?? 60) - 5),
    }).where(eq(teamsTable.id, team.id));
  }

  const playerEvents = await applyPostMatchEffects(team.id, match.weather, facilityLevels, hasRecoveryCamp, matchWindSpeed, matchTemp);

  // Record new injuries into season injury stats
  const newInjuryEvents = playerEvents.filter(e => e.event === "injury_new");
  if (newInjuryEvents.length > 0) {
    const totalAdd       = newInjuryEvents.length;
    const daysLostAdd    = newInjuryEvents.reduce((sum, e) => sum + (e.weeksOut ?? 2) * 7, 0);
    const minorAdd       = newInjuryEvents.filter(e => e.injuryStatus === "Minor Injury").length;
    const majorAdd       = newInjuryEvents.filter(e => e.injuryStatus === "Major Injury").length;
    const unavailAdd     = newInjuryEvents.filter(e => e.injuryStatus === "Unavailable").length;

    const [existing] = await db.select()
      .from(seasonInjuryStatsTable)
      .where(and(
        eq(seasonInjuryStatsTable.teamId, team.id),
        eq(seasonInjuryStatsTable.seasonId, match.season),
      ))
      .limit(1);

    if (existing) {
      await db.update(seasonInjuryStatsTable).set({
        totalInjuries:       existing.totalInjuries       + totalAdd,
        daysLost:            existing.daysLost            + daysLostAdd,
        minorInjuries:       existing.minorInjuries       + minorAdd,
        majorInjuries:       existing.majorInjuries       + majorAdd,
        unavailableInjuries: existing.unavailableInjuries + unavailAdd,
      }).where(eq(seasonInjuryStatsTable.id, existing.id));
    } else {
      await db.insert(seasonInjuryStatsTable).values({
        teamId:              team.id,
        seasonId:            match.season,
        totalInjuries:       totalAdd,
        daysLost:            daysLostAdd,
        minorInjuries:       minorAdd,
        majorInjuries:       majorAdd,
        unavailableInjuries: unavailAdd,
      });
    }

    // Record individual injury history entries
    const now = new Date();
    await db.insert(injuryHistoryTable).values(
      newInjuryEvents.map(e => ({
        teamId:      team.id,
        seasonId:    match.season,
        playerId:    e.playerId,
        playerName:  e.playerName,
        injuryType:  e.injuryStatus ?? "Unknown",
        daysMissed:  (e.weeksOut ?? 2) * 7,
        dateInjured: now,
      }))
    );
  }

  // Decrement wellbeing effect match counters
  for (const effect of wellbeingEffects) {
    await db.update(wellbeingEffectsTable)
      .set({ matchesRemaining: Math.max(0, effect.matchesRemaining - 1) })
      .where(eq(wellbeingEffectsTable.id, effect.id));
  }

  // Tick academy contracts (decrement years, charge weekly wages)
  const academyWages = await tickAcademyContracts(team.id);
  if (academyWages.totalWeeklyWages > 0) {
    const wageDate = new Date().toISOString().split("T")[0];
    await db.update(teamsTable)
      .set({ budget: sql`${teamsTable.budget} - ${academyWages.totalWeeklyWages}` })
      .where(eq(teamsTable.id, team.id));
    await db.insert(financeTransactionsTable).values({
      teamId:      team.id,
      type:        "expense",
      amount:      academyWages.totalWeeklyWages,
      description: `Youth Academy wages — ${academyWages.playerCount} player${academyWages.playerCount !== 1 ? "s" : ""}`,
      category:    "player_salary",
      date:        wageDate,
    });
  }

  // Update career stats and check achievements (non-critical — never breaks match sim)
  try {
    const isContFinalWin = match.tier === "Continental Final" && homeWon;
    const isChampionshipWin = isFinal && homeWon;
    const freshTeam = await db.query.teamsTable.findFirst({ where: eq(teamsTable.id, team.id) });
    const freshBudget = Number(freshTeam?.budget ?? team.budget);
    await updateCareerStats(team.id, (s) => {
      const u = { ...s };
      if (homeWon) u.matchesWon = s.matchesWon + 1;
      else u.currentSeasonLosses = s.currentSeasonLosses + 1;
      if (match.continent && !s.continentsVisited.includes(match.continent)) {
        u.continentsVisited = [...s.continentsVisited, match.continent];
      }
      if (isContFinalWin) u.continentalTitles = s.continentalTitles + 1;
      if (isChampionshipWin) {
        u.championshipsWon = s.championshipsWon + 1;
        u.seasonsCompleted = s.seasonsCompleted + 1;
        if (s.currentSeasonLosses === 0) u.perfectSeasons = s.perfectSeasons + 1;
        if (freshBudget > 0) u.debtFreeSeasons = s.debtFreeSeasons + 1;
        u.currentSeasonLosses = 0;
        if (team.locationId !== null && team.locationId === s.currentLocationId) {
          u.seasonsInCurrentLocation = s.seasonsInCurrentLocation + 1;
        } else {
          u.seasonsInCurrentLocation = 1;
          u.currentLocationId = team.locationId ?? null;
        }
      }
      if (freshBudget > s.highestBalanceReached) u.highestBalanceReached = freshBudget;
      return u;
    });
    await checkAchievements(team.id, match.season);
  } catch {
    // achievements are non-critical; never let them break match simulation
  }

  // ── End-of-season history snapshot (World Final only) ────────────────────
  if (isFinal && req.user?.id) {
    (async () => {
      try {
        // Determine current season year
        const [activeSeason] = await db
          .select({ year: seasonsTable.year })
          .from(seasonsTable)
          .orderBy(desc(seasonsTable.year))
          .limit(1);
        const seasonYear = activeSeason?.year ?? new Date().getFullYear();

        // Only snapshot once per team per year
        const existing = await db
          .select({ id: seasonFinalStandingsTable.id })
          .from(seasonFinalStandingsTable)
          .where(
            and(
              eq(seasonFinalStandingsTable.teamId, team.id),
              eq(seasonFinalStandingsTable.seasonYear, seasonYear),
            ),
          )
          .limit(1);

        if (existing.length === 0) {
          // Snapshot all teams sorted by points (wins × 3)
          const allTeams = await db.select().from(teamsTable);
          const sorted = [...allTeams].sort((a, b) => b.wins * 3 - a.wins * 3);
          await db.insert(seasonFinalStandingsTable).values(
            sorted.map((t, i) => ({
              teamId: team.id,
              seasonYear,
              rank: i + 1,
              competitorName: t.name,
              isPlayer: t.id === team.id,
              wins: t.wins,
              losses: t.losses,
              points: t.wins * 3,
              setDiff: t.wins - t.losses,
            })),
          );
        }

        // Manager season summary — only once per user per year
        const existingSummary = await db
          .select({ id: managerSeasonSummaryTable.id })
          .from(managerSeasonSummaryTable)
          .where(
            and(
              eq(managerSeasonSummaryTable.userId, req.user!.id),
              eq(managerSeasonSummaryTable.seasonYear, seasonYear),
            ),
          )
          .limit(1);

        if (existingSummary.length === 0) {
          // World result from this match
          const worldResult = homeWon ? "World Champion 🏆" : "Runner Up 🥈";

          // Find player rank from snapshot
          const [playerRow] = await db
            .select({ rank: seasonFinalStandingsTable.rank })
            .from(seasonFinalStandingsTable)
            .where(
              and(
                eq(seasonFinalStandingsTable.teamId, team.id),
                eq(seasonFinalStandingsTable.seasonYear, seasonYear),
                eq(seasonFinalStandingsTable.isPlayer, true),
              ),
            );

          // Youth champion from this season
          const [youthChamp] = await db
            .select()
            .from(youthChampionshipTrophiesTable)
            .where(
              and(
                eq(youthChampionshipTrophiesTable.teamId, team.id),
                eq(youthChampionshipTrophiesTable.year, seasonYear),
              ),
            );
          const youthResult = youthChamp
            ? youthChamp.winningTeamName === team.name
              ? "Youth Champion 🏆"
              : "Youth season completed"
            : null;

          await db.insert(managerSeasonSummaryTable).values({
            userId: req.user!.id,
            teamId: team.id,
            seasonYear,
            clubName: team.name,
            leaguePosition: playerRow?.rank ?? null,
            wins: team.wins,
            losses: team.losses,
            budgetSnapshot: team.budget,
            worldResult,
            continentalResult: null,
            youthResult,
          });
        }
      } catch {
        // non-critical: never break match simulation
      }
    })();
  }

  // Simulate Youth Development League for all signed youth players (fire-and-forget)
  simulateYouthLeague(team.id).catch(() => {});

  // Advance youth scouting mission by one week
  if (team.youthScoutingStatus === "active" && (team.youthScoutingWeeksRemaining ?? 0) > 0) {
    const newWeeks = (team.youthScoutingWeeksRemaining ?? 0) - 1;
    if (newWeeks === 0) {
      await db.update(teamsTable).set({
        youthScoutingStatus:         "complete",
        youthScoutingWeeksRemaining: 0,
      }).where(eq(teamsTable.id, team.id));
      await generateScoutingProspects(team.id, team.youthScoutingContinent!);
    } else {
      await db.update(teamsTable)
        .set({ youthScoutingWeeksRemaining: newWeeks })
        .where(eq(teamsTable.id, team.id));
    }
  }

  // Auto-complete any continental scouting missions whose time has elapsed
  autoCompleteContinentalMissions(team.id).catch(() => {});

  // ── End-of-season board review: fire manager if confidence < 5 ────────────
  // Only triggered after the World Championship Final (the season-ending match).
  let fired = false;
  let dismissalClubName: string | null = null;

  if (isFinal && req.user?.id) {
    const confWinDeltaCheck = 8;
    const updatedConfidence = homeWon
      ? Math.min(100, (team.boardConfidence ?? 60) + confWinDeltaCheck)
      : Math.max(0,   (team.boardConfidence ?? 60) - 5);

    if (updatedConfidence < 5) {
      const [save] = await db
        .select()
        .from(careerSavesTable)
        .where(and(
          eq(careerSavesTable.teamId,  team.id),
          eq(careerSavesTable.userId,  req.user.id),
        ));

      if (save) {
        dismissalClubName = save.clubName;

        await db.insert(careerHistoryEntriesTable).values({
          userId:       req.user.id,
          careerSaveId: save.id,
          type:         "dismissal",
          clubName:     save.clubName,
          season:       save.season,
          description:  `Fired by ${save.clubName} following the end-of-season board review`,
        });

        await db
          .update(careerSavesTable)
          .set({ teamId: null, lastPlayedAt: new Date() })
          .where(eq(careerSavesTable.id, save.id));

        const sid = getSessionId(req);
        if (sid) {
          const session = await getSession(sid);
          if (session) {
            const { activeTeamId: _, ...rest } = session;
            await updateSession(sid, rest);
          }
        }

        fired = true;
      }
    }
  }

  res.json({
    match:        serializeMatch(updatedMatch),
    highlights,
    homeScore,
    awayScore,
    winner:       homeWon ? "home" : "away",
    prizeEarned,
    mvp:          mvp ? { ...mvp, height: Number(mvp.height), salary: Number(mvp.salary) } : null,
    isFinal,
    fired,
    dismissalClubName,
    weather:      match.weather,
    windSpeed:    matchWindSpeed,
    temperature:  matchTemp,
    locationName: match.locationName,
    weatherImpact: wx.performancePenalty > 0.05 ? match.weather : null,
    playerEvents,
  });
});

// ─── POST /api/matches/:id/forfeit ───────────────────────────────────────────
/**
 * Forfeit a scheduled match — records it as a 0–21 loss, applies
 * the standard loss-side team penalties (losses, board confidence,
 * sponsor reputation, win-streak reset) and post-match player effects.
 */
router.post("/matches/:id/forfeit", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid match id" }); return; }

  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No active team" }); return; }

  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, id));
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }
  if (match.homeTeamId !== team.id && match.awayTeamId !== team.id) {
    res.status(403).json({ error: "This match does not belong to your team" }); return;
  }
  if (match.status === "completed") {
    res.status(400).json({ error: "Match is already completed" }); return;
  }

  const homeScore = 0;
  const awayScore = 21;

  const [updatedMatch] = await db
    .update(matchesTable)
    .set({ homeScore, awayScore, status: "completed" })
    .where(eq(matchesTable.id, id))
    .returning();

  const newSponsorRep = Math.max(0, (team.sponsorReputation ?? 50) - 1);
  await db.update(teamsTable).set({
    losses:            team.losses + 1,
    winStreak:         0,
    sponsorReputation: newSponsorRep,
    boardConfidence:   Math.max(0, (team.boardConfidence ?? 60) - 5),
  }).where(eq(teamsTable.id, team.id));

  const [facilityRows] = await Promise.all([
    db.select().from(facilitiesTable).where(eq(facilitiesTable.teamId, team.id)),
  ]);
  const facilityLevels: Record<string, number> = Object.fromEntries(facilityRows.map(f => [f.type, f.level]));

  await applyPostMatchEffects(team.id, match.weather ?? "sunny", facilityLevels, false, 0, 25);

  res.json({
    ok:        true,
    matchId:   id,
    homeScore,
    awayScore,
    forfeit:   true,
    match:     serializeMatch(updatedMatch),
  });
});

router.patch("/matches/:id/lineup", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const { playerIds } = req.body;
  const [match] = await db.update(matchesTable).set({ lineup: playerIds })
    .where(eq(matchesTable.id, id)).returning();
  res.json(serializeMatch(match));
});

export default router;
