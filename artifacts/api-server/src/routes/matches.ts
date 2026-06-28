import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { db } from "@workspace/db";
import { matchesTable, teamsTable, playersTable, financeTransactionsTable, locationsTable, staffTable, facilitiesTable, wellbeingEffectsTable, seasonInjuryStatsTable, injuryHistoryTable, promoDealsTable } from "@workspace/db";
import { eq, desc, gt, and, sql } from "drizzle-orm";
import { WORLD_TOUR } from "../data/worldTour";
import type { WorldTourEvent } from "../data/worldTour";
import { generateScoutingProspects } from "../utils/prospect-generator";
import { simulateYouthLeague, tickAcademyContracts } from "./youth-league";
import { updateCareerStats, checkAchievements } from "../utils/check-achievements";

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

type WeatherResult = { weather: string; windSpeed: string; temperature: string };

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
    windSpeed:   wind.toFixed(1),
    temperature: temp.toFixed(1),
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

const serializeMatch = (m: any) => ({
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

type PlayerEvent = {
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
async function applyPostMatchEffects(teamId: number, weather: string, facilityLevels: Record<string, number> = {}, hasRecoveryCamp = false, windSpeed = 0, temperature = 25): Promise<PlayerEvent[]> {
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


// ── Season fixture (fixed 67-round continental tour structure) ────────────────
// Returns all non-Grand-Final events in the fixed continental tour order.
// The Grand Final (round 67) is handled separately with a random host location.
function generateSeasonFixture(): WorldTourEvent[] {
  return WORLD_TOUR.filter(e => e.tier !== "Grand Final");
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
    prizeAmount: prizeAmount ? String(prizeAmount) : "5000",
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

// Full season fixture — fixed 67-event continental tour schedule
router.get("/matches/fixture", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.json([]); return; }

  const existing = await db.select().from(matchesTable)
    .where(and(eq(matchesTable.homeTeamId, team.id), eq(matchesTable.season, 1)))
    .orderBy(matchesTable.round);

  // If the fixture exists but lacks Continental Finals it is the old structure — regenerate.
  const hasNewStructure = existing.some(m => m.tier === "Continental Final");
  if (existing.length > 0 && !hasNewStructure) {
    await db.delete(matchesTable)
      .where(and(eq(matchesTable.homeTeamId, team.id), eq(matchesTable.season, 1)));
    existing.length = 0;
  }

  if (existing.length === 0) {
    const regularEvents = generateSeasonFixture();
    const grandFinal = WORLD_TOUR.find(e => e.tier === "Grand Final")!;
    const finalLocIds = Object.keys(LOCATION_WEATHER_POOLS).map(Number);
    const finalLocId = finalLocIds[Math.floor(Math.random() * finalLocIds.length)];
    const [finalLoc] = await db.select().from(locationsTable).where(eq(locationsTable.id, finalLocId));

    for (const f of [...regularEvents, grandFinal]) {
      let locId = f.locId;
      let locationName = f.locName;
      let prizeAmount = String(f.prize);

      if (f.tier === "Grand Final") {
        locId = finalLocId;
        locationName = finalLoc ? `${finalLoc.name} • ${finalLoc.country}` : f.locName;
        prizeAmount = "500000";
      }

      const { weather, windSpeed, temperature } = generateWeather(locId);
      await db.insert(matchesTable).values({
        homeTeamId:   team.id,
        awayTeamId:   team.id,
        locationId:   locId,
        locationName,
        homeTeamName: team.name,
        awayTeamName: f.opponent,
        weather,
        windSpeed,
        temperature,
        season:      1,
        round:       f.round,
        teamSize:    2,
        scheduledAt: `${f.date}T14:00:00.000Z`,
        prizeAmount,
        status:      "scheduled",
        continent:   f.continent,
        tier:        f.tier,
      });
    }
  }

  const all = await db.select().from(matchesTable)
    .where(and(eq(matchesTable.homeTeamId, team.id), eq(matchesTable.season, 1)))
    .orderBy(matchesTable.round);

  res.json(all.map(serializeMatch));
});

router.get("/matches/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const match = await db.query.matchesTable.findFirst({ where: eq(matchesTable.id, id) });
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }
  res.json(serializeMatch(match));
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

  const isFinal       = match.tier === "Grand Final";
  const isHighPressure = isFinal || match.tier === "Continental Final";

  // Psychology Centre: lowers stat threshold in finals (70→61, L1→L10)
  // Sports Psychology Camp: additional −3 while active
  const psychLevel         = facilityLevels.psychology_centre ?? 1;
  const psychBonusFromCamp = hasPsychCamp ? 3 : 0;
  const statThreshold = isHighPressure ? Math.max(58, 70 - (psychLevel - 1) - psychBonusFromCamp) : 70;

  // Rally randomness: harsh weather = more chaos, perfect = consistent play
  const baseRoll = Math.max(2, 3 + wx.rallyRandomness);
  const homeScore = Math.floor(Math.random() * baseRoll) + (avgStat * weatherFactor > statThreshold ? 2 : 1);
  const awayScore = Math.floor(Math.random() * baseRoll) + 1;
  const homeWon   = homeScore > awayScore;

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
    isFinal ? "The crowd erupts as the championship is decided!" : "The home crowd goes wild!",
    isFinal ? "History is made on the sands!" : "A defining moment in the season!",
  ];
  const highlights = Array.from({ length: 4 }, () =>
    highlightTemplates[Math.floor(Math.random() * highlightTemplates.length)]
  );

  const mvp = activePlayers.length > 0
    ? activePlayers.reduce((best, p) => (p.power + p.serve) > (best.power + best.serve) ? p : best, activePlayers[0])
    : null;

  const prizeEarned = homeWon ? Number(match.prizeAmount || 5000) : 0;

  const [updatedMatch] = await db.update(matchesTable).set({
    homeScore,
    awayScore,
    status: "completed",
    highlights,
  }).where(eq(matchesTable.id, id)).returning();

  if (homeWon) {
    const isChampionship = isFinal && homeWon;
    const isContFinal    = match.tier === "Continental Final";
    const newStreak      = (team.winStreak ?? 0) + 1;
    // Rep gain: +10 every win, +15 for Continental Final, +40 for Grand Final, +5 if on a 3+ streak
    const tierRepBonus   = isFinal ? 40 : isContFinal ? 15 : 0;
    const streakRepBonus = newStreak >= 3 ? 5 : 0;
    const repGain        = 10 + tierRepBonus + streakRepBonus;

    // Sponsor reputation gain: +1 base, +3 Continental Final, +5 Grand Final
    const newWins        = team.wins + 1;
    const sponsorTierBonus = isFinal ? 5 : isContFinal ? 3 : 0;

    // Check if any accepted promo deal just completed with this win (+5 per deal)
    const acceptedDeals = await db.select()
      .from(promoDealsTable)
      .where(and(eq(promoDealsTable.teamId, team.id), eq(promoDealsTable.isAccepted, true)));
    const newlyCompleted = acceptedDeals.filter(d => d.requirementWins === newWins).length;
    const sponsorDealBonus = newlyCompleted * 5;

    const sponsorRepGain = 1 + sponsorTierBonus + sponsorDealBonus;
    const newSponsorRep  = Math.min(100, (team.sponsorReputation ?? 50) + sponsorRepGain);

    // Board confidence: +3 normal, +5 continental final, +8 grand final
    const isGrandFinal     = isFinal && !isContFinal;
    const confWinDelta     = isGrandFinal ? 8 : isContFinal ? 5 : 3;

    await db.update(teamsTable).set({
      wins:              newWins,
      budget:            String(Number(team.budget) + prizeEarned),
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
      amount:      String(prizeEarned),
      description: `Prize money: ${isFinal ? "GRAND FINAL" : `Round ${match.round}`} vs ${match.awayTeamName ?? "Opponent"}`,
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
      amount:      String(academyWages.totalWeeklyWages),
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

  res.json({
    match:        serializeMatch(updatedMatch),
    highlights,
    homeScore,
    awayScore,
    winner:       homeWon ? "home" : "away",
    prizeEarned,
    mvp:          mvp ? { ...mvp, height: Number(mvp.height), salary: Number(mvp.salary) } : null,
    isFinal,
    weather:      match.weather,
    windSpeed:    matchWindSpeed,
    temperature:  matchTemp,
    locationName: match.locationName,
    weatherImpact: wx.performancePenalty > 0.05 ? match.weather : null,
    playerEvents,
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
