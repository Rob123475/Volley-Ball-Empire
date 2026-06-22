import { Router } from "express";
import { db } from "@workspace/db";
import { matchesTable, teamsTable, playersTable, financeTransactionsTable, locationsTable, staffTable, facilitiesTable, wellbeingEffectsTable, seasonInjuryStatsTable, injuryHistoryTable } from "@workspace/db";
import { eq, desc, gt, and } from "drizzle-orm";
import { WORLD_TOUR } from "../data/worldTour";
import type { WorldTourEvent } from "../data/worldTour";

const router = Router();

// ── Weather system ────────────────────────────────────────────────────────────
// Location pools: biased toward the typical climate of each real-world venue.
// Each string appears multiple times to weight probability.
const LOCATION_WEATHER_POOLS: Record<number, string[]> = {
  1:  ["sunny","sunny","hot","hot","stormy","perfect","cloudy"],           // Copacabana – tropical
  11: ["hot","hot","hot","sunny","sunny","windy","perfect"],               // Hurghada – Red Sea desert
  2:  ["sunny","sunny","windy","windy","cloudy","perfect","overcast"],     // Bondi – breezy southern
  3:  ["sunny","sunny","sunny","hot","perfect","cloudy","windy"],          // Waikiki – balmy trade-winds
  4:  ["sunny","hot","hot","stormy","cloudy","windy","overcast"],          // Clearwater – Florida heat/storms
  5:  ["hot","hot","sunny","stormy","cloudy","sunny","overcast"],          // Varadero – Caribbean
  6:  ["sunny","hot","hot","perfect","stormy","cloudy","sunny"],           // Ipanema – tropical
  7:  ["hot","hot","stormy","stormy","cloudy","sunny","overcast"],         // Kata Beach – Southeast Asia
  8:  ["sunny","sunny","windy","windy","perfect","cloudy","hot"],          // Mykonos – Mediterranean meltemi
  9:  ["hot","sunny","stormy","cloudy","sunny","overcast","perfect"],      // Bali – tropical
  10: ["cloudy","cloudy","windy","overcast","perfect","sunny","stormy"],   // Nice – Mediterranean, variable
};

// Fallback for unknown location ids
const DEFAULT_POOL = ["sunny","cloudy","windy","hot","overcast","stormy","perfect"];

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
    case "hot":
      wind = Math.random() * 9;         // 0–9 km/h — still & sweltering
      temp = 34 + Math.random() * 13;   // 34–47°C
      break;
    case "perfect":
      wind = 6 + Math.random() * 10;    // 6–16 km/h — pleasant sea breeze
      temp = 22 + Math.random() * 9;    // 22–31°C
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

  // 10% chance of extreme conditions (heatwave spike, gale burst, cold snap)
  if (Math.random() < 0.10) {
    const roll = Math.random();
    if (roll < 0.4) {
      // Heatwave
      temp  = Math.min(temp + 6 + Math.random() * 6, 52);
    } else if (roll < 0.75) {
      // Gale
      wind  = Math.min(wind * 1.8 + Math.random() * 10, 65);
    } else {
      // Cold snap
      temp  = Math.max(temp - 8 - Math.random() * 6, 8);
    }
  }

  return {
    weather,
    windSpeed:   wind.toFixed(1),
    temperature: temp.toFixed(1),
  };
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

const MEDICAL_ROLES = ["physio", "physiotherapist", "fitness_trainer"];

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
async function applyPostMatchEffects(teamId: number, weather: string, facilityLevels: Record<string, number> = {}, hasRecoveryCamp = false): Promise<PlayerEvent[]> {
  const [players, physioSkill] = await Promise.all([
    db.select().from(playersTable).where(eq(playersTable.teamId, teamId)),
    getBestMedicalSkill(teamId),
  ]);

  const medCentreLevel  = facilityLevels.medical_centre     ?? 1;
  const sportsLabLevel  = facilityLevels.sports_science_lab ?? 1;

  const events: PlayerEvent[] = [];
  const isHot = weather === "hot";

  for (const player of players) {
    const updates: Record<string, unknown> = {};
    const prevStatus  = (player.injuryStatus  as string)  ?? "Healthy";
    const curFatigue  = player.fatigue  ?? 0;
    const curFitness  = (player.fitness  as number) ?? 100;
    const consecutive = (player.consecutiveMatchesPlayed as number) ?? 0;

    if (player.isActive) {
      // ── Played this match ──────────────────────────────────────────────────
      const fatigueCost = 15 + Math.floor(Math.random() * 11) + (isHot ? 8 : 0);
      updates.fatigue  = Math.min(100, curFatigue + fatigueCost);
      updates.fitness  = Math.max(0, curFitness - 3 - Math.floor(Math.random() * 6));
      updates.consecutiveMatchesPlayed = consecutive + 1;

      // Injury risk roll — higher fatigue, lower stamina, and playing hurt all raise it
      const risk = calcInjuryRisk(curFatigue, player.stamina, consecutive, prevStatus, sportsLabLevel, hasRecoveryCamp);
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

const getTeamForUser = async (userId: string) =>
  db.query.teamsTable.findFirst({ where: eq(teamsTable.userId, userId) });

// ── Season fixture (fixed 67-round continental tour structure) ────────────────
// Returns all non-Grand-Final events in the fixed continental tour order.
// The Grand Final (round 67) is handled separately with a random host location.
function generateSeasonFixture(): WorldTourEvent[] {
  return WORLD_TOUR.filter(e => e.tier !== "Grand Final");
}

router.get("/matches", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.json([]); return; }
  const matches = await db.select().from(matchesTable)
    .where(eq(matchesTable.homeTeamId, team.id))
    .orderBy(desc(matchesTable.createdAt)).limit(50);
  res.json(matches.map(serializeMatch));
});

router.post("/matches", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
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
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.json([]); return; }
  const matches = await db.select().from(matchesTable)
    .where(eq(matchesTable.homeTeamId, team.id))
    .orderBy(matchesTable.createdAt).limit(5);
  res.json(matches.filter(m => m.status === "scheduled").map(serializeMatch));
});

// Full season fixture — fixed 67-event continental tour schedule
router.get("/matches/fixture", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
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

  const team = await getTeamForUser(req.user.id);
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
  const windPenalty = Math.min(Number(match.windSpeed ?? 0) / 50, 0.3); // up to 30% disadvantage in gales
  const heatPenalty = match.weather === "hot" ? 0.08 : 0;
  const weatherFactor = 1 - windPenalty - heatPenalty;

  const isFinal       = match.tier === "Grand Final";
  const isHighPressure = isFinal || match.tier === "Continental Final";

  // Psychology Centre: lowers stat threshold in finals (70→61, L1→L10)
  // Sports Psychology Camp: additional −3 while active
  const psychLevel         = facilityLevels.psychology_centre ?? 1;
  const psychBonusFromCamp = hasPsychCamp ? 3 : 0;
  const statThreshold = isHighPressure ? Math.max(58, 70 - (psychLevel - 1) - psychBonusFromCamp) : 70;

  const homeScore = Math.floor(Math.random() * 3) + (avgStat * weatherFactor > statThreshold ? 2 : 1);
  const awayScore = Math.floor(Math.random() * 3) + 1;
  const homeWon   = homeScore > awayScore;

  const weatherHighlights: Record<string, string> = {
    stormy:   "Players battle through gusting winds and dramatic conditions!",
    windy:    "A powerful gust deflects the serve at a crucial moment!",
    hot:      "The searing heat takes its toll — fatigue is a real factor today!",
    overcast: "Cool overcast conditions let both teams play at full intensity.",
    perfect:  "Perfect beach volleyball weather produces spectacular play!",
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
    await db.update(teamsTable).set({
      wins:             team.wins + 1,
      budget:           String(Number(team.budget) + prizeEarned),
      winStreak:        newStreak,
      managerRepPoints: (team.managerRepPoints ?? 0) + repGain,
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
    await db.update(teamsTable).set({
      losses:    team.losses + 1,
      winStreak: 0,
    }).where(eq(teamsTable.id, team.id));
  }

  const playerEvents = await applyPostMatchEffects(team.id, match.weather, facilityLevels, hasRecoveryCamp);

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

  res.json({
    match: serializeMatch(updatedMatch),
    highlights,
    homeScore,
    awayScore,
    winner:      homeWon ? "home" : "away",
    prizeEarned,
    mvp: mvp ? { ...mvp, height: Number(mvp.height), salary: Number(mvp.salary) } : null,
    isFinal,
    weatherImpact: windPenalty > 0.1 || heatPenalty > 0 ? match.weather : null,
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
