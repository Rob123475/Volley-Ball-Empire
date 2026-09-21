import { Router } from "express";
import type { Request } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { db, isContinentKey, type Team } from "@workspace/db";
import { matchesTable, teamsTable, playersTable, financeTransactionsTable, locationsTable, staffTable, facilitiesTable, wellbeingEffectsTable, seasonInjuryStatsTable, injuryHistoryTable, promoDealsTable, seasonFinalStandingsTable, managerSeasonSummaryTable, seasonsTable, matchLiveStateTable, continentalPoolTeamsTable } from "@workspace/db";
import { eq, desc, gt, gte, and, sql, inArray } from "drizzle-orm";
import { WORLD_TOUR } from "../data/worldTour";
import { seasonNumberForYear, FIRST_SEASON_YEAR } from "../utils/seasonRollover.js";
import { generateWeather, LOCATION_WEATHER_POOLS } from "../utils/weather.js";
import { ensureSeasonFixtureRows, FINALS_TIERS, shiftDateToYear } from "../utils/seasonFixture.js";
import { creditRankingPoints, purseAccessTierFor } from "../utils/rankingPoints.js";
import { purseAccessFor, type Tier } from "../utils/tierQualification.js";
import { prizeFor } from "../utils/prizeDistribution.js";
import type { WorldTourEvent } from "../data/worldTour";
import { generateScoutingProspects } from "../utils/prospect-generator";
import { developAcademyPlayers, tickAcademyContracts } from "../utils/academyDevelopment.js";
import { autoCompleteContinentalMissions } from "./continental-scouting";
import { updateCareerStats, checkAchievements } from "../utils/check-achievements";
import { recordBoardForfeit, ABANDONMENT_DAYS } from "../utils/board-confidence.js";
import { endCareer } from "../utils/careerLifecycle.js";
import { startMatchTick } from "../utils/match-tick-engine.js";
import { MAX_STARTERS } from "../utils/squadRules.js";
import {
  selectPair, pairSideRating, isAvailable, matchCosts, injuryRisk, rollInjury,
} from "../utils/condition.js";
import {
  worldTourGate, recordPlayerMatchResult, fixtureForMatch, competitorRating, worldTourStandings,
} from "../utils/worldTour.js";
import { getGameDate } from "../utils/gameDate.js";
import { careerSaveIdForTeam } from "../lib/getActiveSeason.js";
import {
  sideRating, pointProbability, simulateMatch,
  opponentRatingFromTier, clampRating,
} from "../utils/matchEngine.js";
import { getActiveSeason } from "../lib/getActiveSeason.js";
import { loadPlayers, requireCareerSaveId, updatePlayerState, careerSaveIdForTeamOrThrow, type CareerPlayerFields, loadStaff } from "../lib/playerDto.js";
import type { Match } from "@workspace/db";

const router = Router();


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

export const serializeMatch = (m: Match) => ({
  ...m,
  prizeAmount: m.prizeAmount ? Number(m.prizeAmount) : null,
  windSpeed:   m.windSpeed   ? Number(m.windSpeed)   : null,
  temperature: m.temperature ? Number(m.temperature) : null,
  lineup:     Array.isArray(m.lineup)     ? m.lineup     : [],
  highlights: Array.isArray(m.highlights) ? m.highlights : [],
});

// ── Post-match health mechanics (R-50: the rules live in utils/condition.ts) ──

export type PlayerEvent = {
  playerId: number;
  playerName: string;
  event: "injury_new" | "injury_worsened" | "recovery_complete";
  injuryStatus?: string;
  weeksOut?: number;
};

/**
 * Applies post-match health effects (R-50):
 *  - the pair that played: fitness ↓, fatigue ↑, an injury roll, consecutive streak ↑
 *  - everyone else rested: their consecutive streak resets. Fitness and fatigue
 *    recover on the calendar's game days, and injuries heal a week every 7 game
 *    days there — not here, per match rested, which never happened to a player
 *    who was selected for every match.
 * Returns new injuries for the UI to surface.
 */
export async function applyPostMatchEffects(
  teamId: number, playedIds: readonly number[], weather: string,
  facilityLevels: Record<string, number> = {}, hasRecoveryCamp = false, windSpeed = 0, temperature = 25,
): Promise<PlayerEvent[]> {
  const cid = await careerSaveIdForTeamOrThrow(teamId);
  const players = await loadPlayers(cid, { teamId });
  const sportsLabLevel = facilityLevels.sports_science_lab ?? 1;
  const wx = getWeatherEffects(weather, windSpeed, temperature);
  const events: PlayerEvent[] = [];

  for (const player of players) {
    const updates: Partial<CareerPlayerFields> = {};
    const consecutive = player.consecutiveMatchesPlayed ?? 0;

    if (playedIds.includes(player.id)) {
      const cost = matchCosts(wx.extraFatigue);
      updates.fatigue = Math.min(100, (player.fatigue ?? 0) + cost.fatigue);
      updates.fitness = Math.max(0, (player.fitness ?? 100) - cost.fitness);
      updates.consecutiveMatchesPlayed = consecutive + 1;

      const risk = Math.min(
        injuryRisk(player.fatigue ?? 0, player.stamina, consecutive, sportsLabLevel, hasRecoveryCamp) * wx.injuryRiskMultiplier,
        0.70,
      );
      if (Math.random() < risk) {
        const inj = rollInjury();
        updates.injuryStatus         = inj.status;
        updates.injuryWeeksRemaining = inj.weeks;
        updates.isInjured            = true;
        events.push({
          playerId:     player.id,
          playerName:   player.name,
          event:        "injury_new",
          injuryStatus: inj.status,
          weeksOut:     inj.weeks,
        });
      }
    } else if (consecutive !== 0) {
      updates.consecutiveMatchesPlayed = 0;
    }

    if (Object.keys(updates).length > 0) {
      await updatePlayerState(cid, player.id, updates);
    }
  }

  return events;
}


/**
 * Losing the World Semi Final eliminates you from the Grand Final.
 *
 * Enforced on the server because the UI gate is a convenience, not the rule:
 * without this a player who lost the semi could POST the final directly and
 * bank the 500,000. Returns an error message, or null when the match may
 * proceed.
 */
/**
 * Strength of the side the player is facing. In priority order:
 *   1. a genuine opposing roster, when the fixture has a real second team
 *   2. R-29: the drawn World Tour opponent — the real pool club on this
 *      match's world_tour_fixtures row, rated by sideRating over its own two
 *      players, the function that rates the player's squad. This used to look
 *      a pool club up BY NAME and read its stored rating column, which is off
 *      from that club's own players by up to 14 points — and no World Tour
 *      opponent name was ever a pool club, so it never matched at all.
 *   3. the tier ladder plus a stable per-name offset — reachable only by a
 *      match that is not a World Tour fixture (a friendly)
 */
async function resolveOpponentRating(
  match: { id: number; awayTeamId: number | null; awayTeamName: string | null; tier: string | null; season?: number },
  playerTeamId: number,
): Promise<number> {
  const name = match.awayTeamName ?? "";

  if (match.awayTeamId != null && match.awayTeamId !== playerTeamId) {
    const roster = await loadPlayers(await careerSaveIdForTeamOrThrow(playerTeamId), { teamId: match.awayTeamId, isActive: true });
    if (roster.length > 0) return clampRating(sideRating(roster));
  }

  const fixture = fixtureForMatch(match.id);
  if (fixture) {
    const rating = competitorRating(fixture.awayCompetitorId);
    if (rating != null) return clampRating(rating);
  }

  // matches.season carries the calendar year (2026..2030); the engine wants
  // the season NUMBER, so the tier stiffens once per season rather than by
  // two thousand.
  return opponentRatingFromTier(
    match.tier, name || "Opponent", seasonNumberForYear(match.season ?? FIRST_SEASON_YEAR),
  );
}

async function bracketBlockReason(teamId: number, match: { tier: string | null; season: number }): Promise<string | null> {
  if (match.tier !== "World Final") return null;

  const [semi] = await db.select().from(matchesTable).where(and(
    eq(matchesTable.homeTeamId, teamId),
    eq(matchesTable.season, match.season),
    eq(matchesTable.tier, "World Semi Final"),
  )).limit(1);

  if (!semi || semi.status !== "completed") return "The World Semi Final must be played first.";
  if ((semi.homeScore ?? 0) <= (semi.awayScore ?? 0)) {
    // awayTeamName can still be "TBD" if the semi was resolved early (e.g.
    // forfeited before the regular season completed), so never print it raw.
    const beatenBy = semi.awayTeamName && semi.awayTeamName !== "TBD"
      ? ` by ${semi.awayTeamName}` : "";
    return `You were eliminated in the World Semi Final${beatenBy}.`;
  }
  return null;
}

router.get("/matches", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.json([]); return; }
  const matches = await db.select().from(matchesTable)
    .where(eq(matchesTable.homeTeamId, team.id))
    .orderBy(desc(matchesTable.createdAt)).limit(50);

  // Purse access travels WITH each fixture (R-54), never only on payment: what
  // the event pays this club and why. Every fixture is played and every win
  // scores; only the purse depends on the tier the club finished the season
  // before (its difficulty's tier in season 1).
  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const accessBySeason = new Map<number, Tier>();
  for (const year of new Set(matches.map((m) => m.season))) {
    accessBySeason.set(year, await purseAccessTierFor(cid, team.id, year));
  }

  res.json(matches.map((m) => ({
    ...serializeMatch(m),
    purse: purseAccessFor(m.tier, accessBySeason.get(m.season)!),
  })));
});

router.post("/matches", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  // `awayTeamId` from the body is ignored: this codebase models an opponent as
  // awayTeamId = the player's own team plus an awayTeamName label (see the
  // fixture generator), so callers passing a magic id have no effect.
  const { locationId, season, round, teamSize, scheduledAt, prizeAmount } = req.body;

  // Fall back to the active season rather than trusting the caller. The
  // friendlies UI hardcoded season 1, so those matches were written outside
  // the 2026 season every query filters on and were never visible anywhere.
  const activeSeason = await getActiveSeason(req);
  const seasonNumber = Number(season) > 1 ? Number(season) : (activeSeason?.year ?? Number(season));

  const { weather, windSpeed, temperature } = generateWeather(Number(locationId));
  const [match] = await db.insert(matchesTable).values({
    homeTeamId: team.id,
    awayTeamId: team.id,
    locationId: Number(locationId),
    weather,
    windSpeed,
    temperature,
    season:    seasonNumber,
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

/**
 * Ensure a team has its full season fixture for the given year, generating
 * whatever is missing.
 *
 * R-26: this used to run only from GET /matches/fixture, called only by the
 * Fixtures page — a career could sit with zero matches, "No match — Schedule
 * one" on the dashboard and an empty ladder, until the player happened to
 * open that one page. Extracted so POST /careers can call it eagerly at
 * creation and GET /dashboard can call it defensively (idempotent — a
 * career that already has its fixture returns immediately), so any career,
 * new or pre-existing, gets one the moment anything asks.
 *
 * R-35: the generator itself now lives in utils/seasonFixture.ts and is
 * synchronous, so the season rollover can build a new season fixture inside
 * the transaction that creates the season — the one caller that could not
 * await. This is the async entry point the three request-path callers already
 * used, wrapping the generator in a transaction so the whole fixture is still
 * written atomically. One generator, four callers, not four generators.
 */
export async function ensureSeasonFixture(team: { id: number; name: string }, seasonYear: number) {
  return db.transaction((tx) => ensureSeasonFixtureRows(tx, team, seasonYear));
}

// Full season fixture — every World Tour event for the season, finals included.
router.get("/matches/fixture", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.json([]); return; }

  const activeSeason = await getActiveSeason(req);
  if (!activeSeason) { res.status(400).json({ error: "No active season" }); return; }
  const seasonYear = activeSeason.year;

  const existing = await ensureSeasonFixture(team, seasonYear);

  // R-29: the World Finals opponents used to be resolved here, lazily, by
  // getWorldFinalsSeedings — every team in the database ranked by wins,
  // padded with nine hardcoded rival names, the player always seeded 1st or
  // 2nd. The finals are now seeded from this career's real standings by
  // utils/worldTour.ts when round 71 arrives, so this route only reads.
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
  const watchTeam = await getActiveTeam(req);
  if (watchTeam) {
    const blocked = await bracketBlockReason(watchTeam.id, match);
    if (blocked) { res.status(409).json({ error: blocked }); return; }
    // R-29: the live match needs its real drawn opponent before the first point.
    const wtBlocked = await worldTourGate(requireCareerSaveId(req.activeCareerSaveId), watchTeam.id, match);
    if (wtBlocked) { res.status(409).json({ error: wtBlocked }); return; }
    // R-48: a club without two players fit to play cannot take the court (R-50:
    // the same selection /simulate uses — injured players do not count).
    const watchSquad = await loadPlayers(requireCareerSaveId(req.activeCareerSaveId), { teamId: watchTeam.id });
    if (selectPair(watchSquad, Array.isArray(match.lineup) ? (match.lineup as number[]) : []).length < MAX_STARTERS) {
      res.status(409).json({ error: `${SQUAD_INCOMPLETE} Played or simulated, the match is forfeited.`, squadIncomplete: true });
      return;
    }
  }
  const result = await startMatchTick(id);
  if (!result.ok) {
    res.status(500).json({ error: result.error ?? "Failed to start match" });
    return;
  }
  res.json({ ok: true, matchId: id });
});

router.post("/matches/:id/simulate", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const match = await db.query.matchesTable.findFirst({ where: eq(matchesTable.id, id) });
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }

  // Simulating a completed match used to re-run the whole result: it credited
  // the purse a second time and wrote a second prize_money row, so any event
  // could be replayed for unlimited cash. /watch and the forfeit route already
  // guarded this; /simulate did not.
  if (match.status === "completed") {
    res.status(409).json({ error: "Match already completed" });
    return;
  }

  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }

  const blocked = await bracketBlockReason(team.id, match);
  if (blocked) { res.status(409).json({ error: blocked }); return; }

  // R-29: bring the World Tour up to this round first — the draw, the AI
  // fixtures due, the finals seeding — so the opponent is a real drawn club
  // and the whole field has played as far as the player has. Refuses a finals
  // match the club did not qualify for.
  const wtBlocked = await worldTourGate(requireCareerSaveId(req.activeCareerSaveId), team.id, match);
  if (wtBlocked) { res.status(409).json({ error: wtBlocked }); return; }
  // The gate may have just drawn this match's opponent; read the row again.
  const drawnMatch = await db.query.matchesTable.findFirst({ where: eq(matchesTable.id, id) });
  if (drawnMatch) Object.assign(match, drawnMatch);

  const squadForForfeit = await loadPlayers(requireCareerSaveId(req.activeCareerSaveId), { teamId: team.id });
  const pair = selectPair(squadForForfeit, Array.isArray(match.lineup) ? (match.lineup as number[]) : []);

  // R-48: a club that cannot put two players on the sand does not play. It used
  // to play anyway as a phantom side — sideRating([]) is a flat 60 — and could
  // even win, which is how a squad that walked out at the season boundary went
  // unnoticed. The match is forfeited through the same path as a manual
  // forfeit, and the result says why. Since R-50 an injured player does not count.
  if (pair.length < MAX_STARTERS) {
    const forfeit = await recordForfeit(req, team, match, requireCareerSaveId(req.activeCareerSaveId));
    res.json({
      ...forfeit,
      winner:         "away",
      prizeEarned:    0,
      isFinal:        false,
      highlights:     [`Forfeited. ${SQUAD_INCOMPLETE}`],
      squadIncomplete: true,
      reason:         SQUAD_INCOMPLETE,
    });
    return;
  }

  const result = await completeMatch(
    { careerSaveId: requireCareerSaveId(req.activeCareerSaveId), team, userId: req.user?.id ?? null, log: req.log },
    match,
    req.body?.precomputedResult,
  );
  if (!result) { res.status(409).json({ error: "Match already completed" }); return; }
  res.json(result);
});

export type MatchContext = {
  careerSaveId: number;
  team: Team;
  userId: string | null;
  log: { error: (obj: object, msg?: string) => void };
};

/**
 * R-77: the whole result of a played match — the score, the purse, ranking
 * points, the World Tour fixture, injuries, career stats and achievements.
 *
 * POST /matches/:id/simulate calls it for "Sim Result". The live point-tick
 * engine calls it when a watched match ends, with the score it played. A watched
 * match used to stop at "finished" in the live-state table and never reach any
 * of this: the engine expected the page to call /simulate, and nothing did.
 *
 * Returns null when the match is already completed (the other path got there first).
 */
export async function completeMatch(
  ctx: MatchContext,
  match: Match,
  precomputedResult?: { homeScore: number; awayScore: number; sets?: { home: number; away: number }[] },
) {
  const team = ctx.team;
  const current = await db.query.matchesTable.findFirst({ where: eq(matchesTable.id, match.id) });
  if (!current || current.status === "completed") return null;

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

  const players = await loadPlayers(ctx.careerSaveId, { teamId: team.id });
  // R-50: the side is a pair of AVAILABLE players — contracted, active and not
  // injured — picked by the one selection every match path uses, the stored
  // lineup first where its players are available. It used to be every active
  // player on the team, starters and interchange alike, injured or not.
  const pair = selectPair(players, Array.isArray(match.lineup) ? (match.lineup as number[]) : []);

  // The caller has already forfeited a club that cannot put two players on the
  // sand (R-48); a pair short here means the squad changed underneath it.
  if (pair.length < MAX_STARTERS) throw new Error(SQUAD_INCOMPLETE);
  // Six-stat mean, the same OVR the UI shows, over the pair — each player scaled
  // by her fitness (R-50: 0.6 + 0.4 × fitness / 100).
  const squadRating = pairSideRating(pair);

  // Weather impact on match difficulty
  const matchWindSpeed = Number(match.windSpeed ?? 0);
  const matchTemp      = Number(match.temperature ?? 25);
  const wx = getWeatherEffects(match.weather, matchWindSpeed, matchTemp);

  const isFinal        = match.tier === "World Final";
  const isWorldSemiFinal = match.tier === "World Semi Final";
  const isHighPressure = isFinal || isWorldSemiFinal || match.tier === "Continental Final";

  // Psychology Centre: lowers stat threshold in finals (70→61, L1→L10)
  // Sports Psychology Camp: additional −3 while active
  const psychLevel         = facilityLevels.psychology_centre ?? 1;
  const psychBonusFromCamp = hasPsychCamp ? 3 : 0;
  // The Psychology Centre used to work by lowering a pass/fail stat threshold,
  // which no longer exists. Its purpose is preserved as what it always meant:
  // your squad performs closer to its true level when the pressure is on. In
  // high-pressure matches only, it is worth up to +9 rating from the facility
  // (L1-L10) plus +3 while a Sports Psychology Camp is active — comparable to
  // the 12-15 points of threshold it used to buy.
  const pressureRatingBonus = isHighPressure
    ? (psychLevel - 1) + psychBonusFromCamp
    : 0;

  // Score source: either the point-tick engine already played this match live
  // (body carries the real outcome) or we fall back to the instant random roll
  // used by the "Sim Result" button.
  const precomputed: { homeScore: number; awayScore: number; sets?: { home: number; away: number }[] } | undefined =
    precomputedResult;

  // Opponent strength is REAL — see resolveOpponentRating. For a World Tour
  // match that is the drawn club's own players (R-29).
  const opponentRating = await resolveOpponentRating(match, team.id);

  let homeScore: number;
  let awayScore: number;
  let resolvedSets: Array<{ home: number; away: number }> | undefined;

  if (precomputed && Number.isInteger(precomputed.homeScore) && Number.isInteger(precomputed.awayScore)) {
    // The live tick engine already played this match point by point.
    homeScore = precomputed.homeScore;
    awayScore = precomputed.awayScore;
    resolvedSets = precomputed.sets;
  } else {
    const pPoint = pointProbability(squadRating + pressureRatingBonus, opponentRating, {
      homeAdvantage: true,
      winStreak:     team.winStreak ?? 0,
      weatherPenalty: wx.performancePenalty,
    });
    const result = simulateMatch(pPoint);
    homeScore    = result.homeScore;   // sets won
    awayScore    = result.awayScore;
    resolvedSets = result.sets;
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
    isFinal ? "History is made on the sands!" : isWorldSemiFinal ? "One step from the World Final!" : "A defining moment in the season!",
  ];
  const highlights = Array.from({ length: 4 }, () =>
    highlightTemplates[Math.floor(Math.random() * highlightTemplates.length)]
  );

  const mvp = pair.length > 0
    ? pair.reduce((best, p) => (p.power + p.serve) > (best.power + best.serve) ? p : best, pair[0])
    : null;

  // Pay exactly what the fixture advertises. The `|| 5000` fallback here meant
  // a match with a zero/absent purse displayed "$0" on the fixture card but
  // still credited $5,000 — the paid figure has to be the quoted figure.
  //
  // R-54: the purse is paid in full up to the tier the club finished last
  // season (its difficulty's tier in season 1) and at LOCKED_PURSE_MULTIPLIER
  // above it — the same access the fixture list shows. It used to follow this
  // season's running points against Silver 15 / Gold 40.
  const purse = purseAccessFor(
    match.tier,
    await purseAccessTierFor(ctx.careerSaveId, team.id, match.season),
  );
  const prizeMultiplier = purse.multiplier;

  // Both finishers are paid. The purse used to go entirely to the winner, which
  // made every event an all-or-nothing coin flip and was the mechanical cause of
  // I4 failing at 41.5% deviation. See utils/prizeDistribution.ts for why the
  // runner-up share is the design rather than a softening of it.
  const prizeEarned = prizeFor(Number(match.prizeAmount ?? 0), homeWon, prizeMultiplier);

  const [updatedMatch] = await db.update(matchesTable).set({
    homeScore,
    awayScore,
    status: "completed",
    highlights,
    // R-50: who actually played. The medical page counts matches from this.
    lineup: pair.map((p) => p.id),
    ...(resolvedSets ? { sets: resolvedSets } : {}),
  }).where(eq(matchesTable.id, match.id)).returning();

  // Ranking points. competitor_rankings existed since Phase 0 with nothing
  // writing to it — the table tier qualification gates on was always empty.
  try {
    await creditRankingPoints({
      careerSaveId: ctx.careerSaveId,
      teamId:       team.id,
      seasonYear:   match.season,
      tier:         match.tier,
      won:          homeWon,
    });
  } catch (err) {
    // A ranking write must never cost the player the match they just played.
    ctx.log.error({ err }, "ranking point accrual failed");
  }

  // R-29: the other half of this result belongs to a real club — recorded on
  // its World Tour fixture and credited to the opponent from the same table.
  try {
    recordPlayerMatchResult({
      careerSaveId: ctx.careerSaveId,
      matchId:      match.id,
      playerWon:    homeWon,
      homeSets:     homeScore,
      awaySets:     awayScore,
      sets:         resolvedSets ?? null,
    });
  } catch (err) {
    ctx.log.error({ err }, "World Tour fixture result failed");
  }

  // The live-tick scratch row has served its purpose once the match is over.
  // Leaving it behind pinned the match row in place and broke any later
  // fixture rebuild with a FOREIGN KEY failure.
  await db.delete(matchLiveStateTable).where(eq(matchLiveStateTable.matchId, match.id));

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

    const today = await getGameDate(team.id);

    // Credit and record in ONE transaction: these were two separate awaits, so
    // a failure between them either paid the purse with no record of it or
    // logged income that was never banked. The budget is incremented with a
    // SQL expression rather than a read-modify-write, so a concurrent write
    // (the auto-advance ticker can overlap a manual sim) cannot silently drop
    // the prize.
    db.transaction((tx) => {
      tx.update(teamsTable).set({
        wins:              newWins,
        budget:            sql`${teamsTable.budget} + ${prizeEarned}`,
        winStreak:         newStreak,
        managerRepPoints:  (team.managerRepPoints ?? 0) + repGain,
        sponsorReputation: newSponsorRep,
        ...(isChampionship ? { titlesWon: team.titlesWon + 1 } : {}),
      }).where(eq(teamsTable.id, team.id)).run();

      if (prizeEarned > 0) {
        tx.insert(financeTransactionsTable).values({
          teamId:      team.id,
          type:        "income",
          amount:      prizeEarned,
          description: `Prize money: ${isFinal ? "WORLD FINAL" : isWorldSemiFinal ? "SEMI FINAL" : `Round ${match.round}`} vs ${match.awayTeamName ?? "Opponent"}`,
          category:    "prize_money",
          date:        today,
        }).run();
      }
    });
  } else {
    // Sponsor reputation: -1 per loss, clamped at 0
    const newSponsorRep = Math.max(0, (team.sponsorReputation ?? 50) - 1);
    const today = await getGameDate(team.id);

    // A loss still pays the runner-up share. Credited in ONE transaction with
    // the result, for the same reason the win branch is: two separate awaits
    // either banked money with no record of it or logged income that was never
    // banked. The budget moves by a SQL expression rather than a
    // read-modify-write so an overlapping auto-advance tick cannot drop it.
    db.transaction((tx) => {
      tx.update(teamsTable).set({
        losses:            team.losses + 1,
        budget:            sql`${teamsTable.budget} + ${prizeEarned}`,
        winStreak:         0,
        sponsorReputation: newSponsorRep,
      }).where(eq(teamsTable.id, team.id)).run();

      if (prizeEarned > 0) {
        tx.insert(financeTransactionsTable).values({
          teamId:      team.id,
          type:        "income",
          amount:      prizeEarned,
          description: `Runner-up prize: ${isFinal ? "WORLD FINAL" : isWorldSemiFinal ? "SEMI FINAL" : `Round ${match.round}`} vs ${match.awayTeamName ?? "Opponent"}`,
          category:    "prize_money",
          date:        today,
        }).run();
      }
    });
  }

  const playerEvents = await applyPostMatchEffects(team.id, pair.map((p) => p.id), match.weather, facilityLevels, hasRecoveryCamp, matchWindSpeed, matchTemp);

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

  // Take a week off each academy contract. R-63: an academy player's wage is
  // billed once, in the weekly wage run (routes/calendar.ts); it used to be
  // charged again here after every match.
  await tickAcademyContracts(team.id);

  // Update career stats and check achievements (non-critical — never breaks match sim)
  try {
    // R-77: seasons completed and the season's loss count reset at the season
    // boundary (routes/calendar.ts), where every season ends — they used to be
    // counted only here, on a World Final win. The continental title count is
    // gone: no match is a continental final.
    const isChampionshipWin = isFinal && homeWon;
    const freshTeam = await db.query.teamsTable.findFirst({ where: eq(teamsTable.id, team.id) });
    const freshBudget = Number(freshTeam?.budget ?? team.budget);
    await updateCareerStats(team.id, (s) => {
      const u = { ...s };
      if (homeWon) u.matchesWon = s.matchesWon + 1;
      else u.currentSeasonLosses = s.currentSeasonLosses + 1;
      if (homeWon && match.tier === "Gold") u.goldEventsWon = s.goldEventsWon + 1;
      // Where the match was played. The World Finals are "world", not a continent.
      if (isContinentKey(match.continent) && !s.continentsVisited.includes(match.continent)) {
        u.continentsVisited = [...s.continentsVisited, match.continent];
      }
      if (isChampionshipWin) {
        u.championshipsWon = s.championshipsWon + 1;
        if (s.currentSeasonLosses === 0) u.perfectSeasons = s.perfectSeasons + 1;
        if (freshBudget > 0) u.debtFreeSeasons = s.debtFreeSeasons + 1;
      }
      if (freshBudget > s.highestBalanceReached) u.highestBalanceReached = freshBudget;
      return u;
    });
    await checkAchievements(team.id, match.season);
  } catch {
    // achievements are non-critical; never let them break match simulation
  }

  // ── End-of-season history snapshot (World Final only) ────────────────────
  if (isFinal && ctx.userId) {
    (async () => {
      try {
        // The season this final belongs to. This used to read the latest season
        // row in the whole database, which in a multi-career install could be
        // another career's.
        const seasonYear = match.season;

        // R-29: the final standings snapshot is written once, at the season
        // boundary (utils/seasonRollover.ts), from this career's World Tour
        // standings. This branch wrote a second one — every team in the
        // database ranked by wins * 3 — whenever the player reached a final.

        // Manager season summary — only once per user per year
        const existingSummary = await db
          .select({ id: managerSeasonSummaryTable.id })
          .from(managerSeasonSummaryTable)
          .where(
            and(
              eq(managerSeasonSummaryTable.userId, ctx.userId!),
              eq(managerSeasonSummaryTable.seasonYear, seasonYear),
            ),
          )
          .limit(1);

        if (existingSummary.length === 0) {
          // World result from this match
          const worldResult = homeWon ? "World Champion 🏆" : "Runner Up 🥈";

          // The player's World Tour position, from the standings every screen reads.
          const playerRow = worldTourStandings(ctx.careerSaveId, seasonYear)
            .find((s) => s.isPlayer && s.teamId === team.id) ?? null;

          await db.insert(managerSeasonSummaryTable).values({
            userId: ctx.userId!,
            teamId: team.id,
            seasonYear,
            clubName: team.name,
            leaguePosition: playerRow?.rank ?? null,
            wins: team.wins,
            losses: team.losses,
            budgetSnapshot: team.budget,
            worldResult,
            continentalResult: null,
          });
        }
      } catch {
        // non-critical: never break match simulation
      }
    })();
  }

  // Academy development for signed youth players (fire-and-forget). R-43: no
  // invented youth match any more; see utils/academyDevelopment.ts.
  developAcademyPlayers(team.id).catch(() => {});

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

  // R-53: no result sacks a manager, and no result moves board confidence. The
  // board judges the season at its review (utils/seasonRollover.ts); the one
  // mid-season sacking is abandonment, in recordForfeit. R-09 moved confidence
  // +3/+8 on a win and -5 on a loss above, and sacked here at a read-time score
  // of zero after every result.
  return {
    match:        serializeMatch(updatedMatch),
    highlights,
    homeScore,
    awayScore,
    winner:       homeWon ? "home" : "away",
    prizeEarned,
    mvp:          mvp ? { ...mvp, height: Number(mvp.height), salary: Number(mvp.salary) } : null,
    isFinal,
    lineup:       pair.map((p) => p.id),
    squadRating,
    weather:      match.weather,
    windSpeed:    matchWindSpeed,
    temperature:  matchTemp,
    locationName: match.locationName,
    weatherImpact: wx.performancePenalty > 0.05 ? match.weather : null,
    playerEvents,
  };
}

// ─── POST /api/matches/:id/forfeit ───────────────────────────────────────────
/**
 * Forfeit a scheduled match — records it as a straight-sets loss, applies
 * the standard loss-side team penalties (losses, sponsor reputation,
 * win-streak reset) and post-match player effects, and counts it for the
 * board's season review (R-53).
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

  // R-29: a forfeit is a result the whole field sees, so the World Tour must be
  // up to this round and the match must have its real opponent.
  const forfeitCid = requireCareerSaveId(req.activeCareerSaveId);
  const wtBlocked = await worldTourGate(forfeitCid, team.id, match);
  if (wtBlocked) { res.status(409).json({ error: wtBlocked }); return; }

  res.json(await recordForfeit(req, team, match, forfeitCid));
});

/** R-48: why a club without two contracted players cannot play. */
const SQUAD_INCOMPLETE =
  `Your club has fewer than ${MAX_STARTERS} contracted players fit to play — injured players cannot be selected. Sign or renew players on the Contracts page.`;

/**
 * Record a forfeit: a straight-sets loss with the standard loss-side team
 * penalties (losses, sponsor reputation, win streak), ranking credit to both
 * sides, post-match effects, the board's forfeit count and its abandonment rule.
 *
 * Shared by POST /matches/:id/forfeit and by R-48's empty-squad rule in
 * /simulate, so a forfeit means exactly one thing wherever it comes from. The
 * caller has already passed the World Tour gate.
 */
async function recordForfeit(
  req: Request,
  team: NonNullable<Awaited<ReturnType<typeof getActiveTeam>>>,
  match: Match,
  careerSaveId: number,
) {
  const id = match.id;

  // home_score/away_score are SETS WON (the headline the UI prints), with the
  // per-set point scores in `sets`. A forfeit is a straight-sets loss; this
  // used to write 0-21, a point score, which rendered as "0 - 21".
  const homeScore = 0;
  const awayScore = 2;

  const [updatedMatch] = await db
    .update(matchesTable)
    .set({ homeScore, awayScore, status: "completed" })
    .where(eq(matchesTable.id, id))
    .returning();

  await db.delete(matchLiveStateTable).where(eq(matchLiveStateTable.matchId, id));

  const newSponsorRep = Math.max(0, (team.sponsorReputation ?? 50) - 1);
  await db.update(teamsTable).set({
    losses:            team.losses + 1,
    winStreak:         0,
    sponsorReputation: newSponsorRep,
  }).where(eq(teamsTable.id, team.id));

  // R-29: a forfeit used to count in teams.losses only, so the ranking table and
  // the club's own record disagreed, and the opponent was credited nothing.
  await creditRankingPoints({
    careerSaveId, teamId: team.id, seasonYear: match.season, tier: match.tier, won: false,
  });
  recordPlayerMatchResult({
    careerSaveId, matchId: id, playerWon: false, homeSets: homeScore, awaySets: awayScore, sets: null,
  });

  const [facilityRows] = await Promise.all([
    db.select().from(facilitiesTable).where(eq(facilitiesTable.teamId, team.id)),
  ]);
  const facilityLevels: Record<string, number> = Object.fromEntries(facilityRows.map(f => [f.type, f.level]));

  await applyPostMatchEffects(team.id, [], match.weather ?? "sunny", facilityLevels, false, 0, 25);

  // R-53: the board counts the forfeit for its season review, and applies the
  // one mid-season sacking there is — abandonment: a club that has been unable
  // to field a side for ABANDONMENT_DAYS game days is sacked at its next
  // forfeit. A forfeit no longer costs confidence (R-09's -5).
  const board = recordBoardForfeit(careerSaveId, match.season, team.id, match.round, await getGameDate(team.id));
  let fired = false;
  let dismissalClubName: string | null = null;

  if (req.user?.id && board.abandonedDays != null && board.abandonedDays >= ABANDONMENT_DAYS) {
    const days = board.abandonedDays;
    const summary = await endCareer(req, team.id, req.user.id, {
      type: "dismissal",
      description: (s) =>
        `${s.managerName} was sacked by ${s.clubName}: the club went ${days} days without two contracted players to put on the sand.`,
    });
    dismissalClubName = summary.clubName;
    fired = true;
  }

  return {
    ok:        true,
    matchId:   id,
    homeScore,
    awayScore,
    forfeit:   true,
    match:     serializeMatch(updatedMatch),
    fired,
    careerEnded: fired,
    dismissalClubName,
  };
}

router.patch("/matches/:id/lineup", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const [existing] = await db.select().from(matchesTable).where(eq(matchesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Match not found" }); return; }
  if (existing.homeTeamId !== team.id && existing.awayTeamId !== team.id) {
    res.status(403).json({ error: "This match does not belong to your team" }); return;
  }
  const playerIds = Array.isArray(req.body?.playerIds)
    ? (req.body.playerIds as unknown[]).map(Number).filter(Number.isInteger)
    : null;
  if (!playerIds) { res.status(400).json({ error: "playerIds must be an array of player ids" }); return; }

  // R-50: an injured player cannot be selected, and neither can anyone outside
  // the club's active squad. This route used to store whatever it was sent.
  const squad = await loadPlayers(requireCareerSaveId(req.activeCareerSaveId), { teamId: team.id });
  const refused = playerIds
    .map((pid) => ({ pid, player: squad.find((p) => p.id === pid) }))
    .filter(({ player }) => !player || !isAvailable(player));
  if (refused.length > 0) {
    const why = refused.map(({ pid, player }) => !player
      ? `player ${pid} is not in your squad`
      : player.isInjured || player.injuryStatus !== "Healthy"
        ? `${player.name} is injured (${player.injuryStatus})`
        : `${player.name} is not in the active squad`);
    res.status(400).json({ error: `That lineup cannot be selected: ${why.join("; ")}.`, unavailable: refused.map((r) => r.pid) });
    return;
  }

  const [match] = await db.update(matchesTable).set({ lineup: playerIds })
    .where(eq(matchesTable.id, id)).returning();
  res.json(serializeMatch(match));
});

export default router;
