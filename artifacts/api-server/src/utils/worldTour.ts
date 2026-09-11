/**
 * R-29 — the World Tour as a real competition.
 *
 * Before this, the player's club was the only real entrant. Its opponents were
 * ten name strings in data/worldTour.ts, the ladder held one row, "AI results"
 * were a 55% coin flip written onto other careers' matches, and the World Finals
 * were seeded from every team in the database padded with hardcoded names.
 *
 * Now, per career per season:
 *
 *   field      = this season's regional qualifiers (3 per continent, the rules
 *                page's "18 teams total") + the player's club
 *   draw       = every World Tour round (11-70) paired up front, stored in
 *                world_tour_fixtures; the player's side links to its own
 *                `matches` row, so lineup, economy and Unity are untouched
 *   AI games   = played through the SAME engine as the player's match —
 *                sideRating over real players, pointProbability, simulateMatch
 *   points     = the SAME ranking table and tier gate, via creditCompetitorTx
 *   standings  = competitor_rankings for this career and season, nothing else
 *   finals     = seeded top 4 from those standings (D5): 1v4, 2v3, winners meet
 *
 * Everything here that writes is synchronous and takes the caller's
 * transaction (better-sqlite3 transactions cannot await), the same shape as
 * utils/seasonFixture.ts. advanceWorldTour() is the async entry point.
 *
 * Design and reasoning: docs/r29-design.md.
 */
import {
  db,
  matchesTable,
  competitorsTable,
  competitorRankingsTable,
  continentalPoolTeamsTable,
  continentalPoolPlayersTable,
  teamsTable,
  worldTourQualificationsTable,
  worldTourFixturesTable,
} from "@workspace/db";
import { and, asc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { sideRating, pointProbability, simulateMatch, type SetScore } from "./matchEngine.js";
import { creditCompetitorTx } from "./rankingPoints.js";
import { competitorIdForTeamTx, competitorIdForPoolTeamTx } from "./competitors.js";
import { WORLD_TOUR_START, WORLD_TOUR_END, FINALS_START, FINALS_END, REGIONAL_END } from "./calendarSlots.js";
import { seasonNumberForYear } from "./seasonRollover.js";
import { WORLD_TOUR } from "../data/worldTour.js";
import { getWeatherEffects } from "../routes/matches.js";
import { loadLeagueSeasons } from "../lib/regionalLeague.js";
import { simulateRegionalRound, resolveRegionalSeason } from "./regionalSeason.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const SEMI_FINAL_TIER = "World Semi Final";
export const FINAL_TIER = "World Final";

/** A player match the player did not earn a place in. Never played, never paid. */
export const NOT_QUALIFIED = "not_qualified";

/** The event tier for a World Tour round, from the schedule itself. */
function tierForRound(round: number): string {
  const event = WORLD_TOUR.find((e) => e.round === round);
  if (!event) throw new Error(`No World Tour event is scheduled for round ${round}`);
  return event.tier;
}

// ── Strength ─────────────────────────────────────────────────────────────────

/**
 * Every pool club's strength: `sideRating` over its two continental_pool_players
 * — the exact function that rates the player's own squad.
 *
 * Chosen over the two other numbers that existed for the same club: the stored
 * `continental_pool_teams.rating` (off from its own players by a mean of 4.1 and
 * up to 14.4 points) and the regional league's `100 - (poolRanking - 1) * 8`
 * (100 down to 28). Only the players are built by the same rule as the player's
 * side, so only they make "the same engine" true.
 */
export function poolClubRatingsTx(tx: Tx): Map<number, number> {
  const rows = tx.select({
    poolTeamId: continentalPoolPlayersTable.poolTeamId,
    speed:      continentalPoolPlayersTable.speed,
    power:      continentalPoolPlayersTable.power,
    defense:    continentalPoolPlayersTable.defense,
    serve:      continentalPoolPlayersTable.serve,
    block:      continentalPoolPlayersTable.block,
    stamina:    continentalPoolPlayersTable.stamina,
  }).from(continentalPoolPlayersTable).all();

  const byClub = new Map<number, typeof rows>();
  for (const r of rows) {
    const list = byClub.get(r.poolTeamId) ?? [];
    list.push(r);
    byClub.set(r.poolTeamId, list);
  }
  const ratings = new Map<number, number>();
  for (const [poolTeamId, players] of byClub) ratings.set(poolTeamId, sideRating(players));
  return ratings;
}

/** Async form for callers outside a transaction (the regional league). */
export function poolClubRatings(): Map<number, number> {
  return db.transaction((tx) => poolClubRatingsTx(tx));
}

// ── Field ────────────────────────────────────────────────────────────────────

export type FieldClub = {
  competitorId: number;
  poolTeamId: number;
  name: string;
  continent: string;
  qualifyingPosition: number;
};

/**
 * This career's qualifiers for a calendar season.
 *
 * world_tour_qualifications.season_year is the regional league's own ordinal
 * (1, 2, 3 …), which advances once per calendar season exactly as the career's
 * season number does — both start at 1 (FIRST_LEAGUE_SEASON_YEAR and
 * FIRST_SEASON_YEAR) and both bump once per season. So calendar year Y reads
 * ordinal seasonNumberForYear(Y), for THIS career only.
 */
export function worldTourFieldTx(tx: Tx, careerSaveId: number, seasonYear: number): FieldClub[] {
  const leagueSeason = seasonNumberForYear(seasonYear);
  const rows = tx.select({
    poolTeamId:         worldTourQualificationsTable.poolTeamId,
    continent:          worldTourQualificationsTable.continent,
    qualifyingPosition: worldTourQualificationsTable.qualifyingPosition,
    name:               continentalPoolTeamsTable.teamName,
  })
    .from(worldTourQualificationsTable)
    .innerJoin(continentalPoolTeamsTable,
      eq(continentalPoolTeamsTable.id, worldTourQualificationsTable.poolTeamId))
    .where(and(
      eq(worldTourQualificationsTable.careerSaveId, careerSaveId),
      eq(worldTourQualificationsTable.seasonYear, leagueSeason),
    ))
    .orderBy(asc(worldTourQualificationsTable.continent), asc(worldTourQualificationsTable.qualifyingPosition))
    .all();

  return rows.map((r) => ({ ...r, competitorId: competitorIdForPoolTeamTx(tx, r.poolTeamId) }));
}

function hasDrawTx(tx: Tx, careerSaveId: number, seasonYear: number): boolean {
  return !!tx.select({ id: worldTourFixturesTable.id }).from(worldTourFixturesTable)
    .where(and(
      eq(worldTourFixturesTable.careerSaveId, careerSaveId),
      eq(worldTourFixturesTable.seasonYear, seasonYear),
      lte(worldTourFixturesTable.round, WORLD_TOUR_END),
    ))
    .limit(1).get();
}

/**
 * A legacy save can reach the World Tour with its regional season unfinished
 * (the calendar once skipped resolution entirely — see calendar.ts). Those
 * rounds are overdue real fixtures, so they are played and resolved here rather
 * than a field being invented. Only the calendar may do this: its date is
 * already past round 10, so nothing is being decided early.
 */
async function catchUpRegionalSeason(careerSaveId: number, seasonYear: number): Promise<void> {
  const leagueSeason = seasonNumberForYear(seasonYear);
  const unresolved = (await loadLeagueSeasons(careerSaveId, { status: "active" }))
    .filter((s) => s.seasonYear === leagueSeason);
  if (unresolved.length === 0) return;

  for (let round = 1; round <= REGIONAL_END; round++) {
    await simulateRegionalRound(round, careerSaveId);
  }
  for (const s of unresolved) {
    await resolveRegionalSeason(s.id, careerSaveId);
  }
}

// ── The draw ─────────────────────────────────────────────────────────────────

export type DrawOutcome =
  | { drawn: true; fieldSize: number }
  | { drawn: false; reason: string };

/**
 * One round's pairings, as indexes into the AI field.
 *
 * The player plays every round. With n AI clubs:
 *   - the player meets field[k mod n]
 *   - if n is even (an odd field overall), field[(k + n/2) mod n] rests
 *   - everyone else is paired by the circle method over what remains
 *
 * Rotating the player's opponent and the rest by different offsets means every
 * club meets the player and rests an even number of times: with 18 clubs over
 * 60 rounds, each does both 3 or 4 times.
 */
export function roundPairings(n: number, k: number): {
  playerOpponent: number;
  resting: number | null;
  pairs: Array<[number, number]>;
} {
  if (n < 1) throw new Error("A World Tour field needs at least one AI club");
  const playerOpponent = k % n;
  const resting = n % 2 === 0 && n > 1 ? (k + n / 2) % n : null;

  const rest: number[] = [];
  for (let i = 0; i < n; i++) if (i !== playerOpponent && i !== resting) rest.push(i);

  const pairs: Array<[number, number]> = [];
  if (rest.length > 0) {
    const [fixed, ...rotating] = rest;
    const turned = rotating.map((_, i) => rotating[(i + k) % rotating.length]!);
    const order = [fixed!, ...turned];
    for (let i = 0; i < order.length / 2; i++) {
      pairs.push([order[i]!, order[order.length - 1 - i]!]);
    }
  }
  return { playerOpponent, resting, pairs };
}

/**
 * Draw the season's World Tour: rounds 11-70, every entrant, stored.
 * Idempotent — a season that is already drawn is left exactly as it is.
 */
export function drawWorldTourTx(
  tx: Tx, careerSaveId: number, seasonYear: number, playerTeamId: number,
): DrawOutcome {
  const field = worldTourFieldTx(tx, careerSaveId, seasonYear);
  if (hasDrawTx(tx, careerSaveId, seasonYear)) return { drawn: true, fieldSize: field.length + 1 };
  if (field.length === 0) {
    return { drawn: false, reason: "no regional qualifiers are recorded for this season yet" };
  }

  const playerCompetitorId = competitorIdForTeamTx(tx, playerTeamId);

  // Every entrant gets its ranking row now, at zero, so the standings are the
  // whole field from the first round rather than whoever has already played.
  // The player's row already exists (R-26) with its difficulty head start
  // (R-11); onConflictDoNothing leaves it alone.
  for (const competitorId of [playerCompetitorId, ...field.map((f) => f.competitorId)]) {
    tx.insert(competitorRankingsTable)
      .values({ competitorId, careerSaveId, seasonYear })
      .onConflictDoNothing()
      .run();
  }

  const playerMatches = tx.select().from(matchesTable).where(and(
    eq(matchesTable.homeTeamId, playerTeamId),
    eq(matchesTable.season, seasonYear),
    gte(matchesTable.round, WORLD_TOUR_START),
    lte(matchesTable.round, WORLD_TOUR_END),
  )).all();
  const matchByRound = new Map(playerMatches.map((m) => [m.round, m]));

  for (let round = WORLD_TOUR_START; round <= WORLD_TOUR_END; round++) {
    const k = round - WORLD_TOUR_START;
    const tier = tierForRound(round);
    const { playerOpponent, pairs } = roundPairings(field.length, k);
    const opponent = field[playerOpponent]!;

    // The player's side. A match that is already completed is history against
    // an opponent that was only ever a name, so it is not rewritten into a
    // game against a real club it never played; that club simply sits the
    // round out. Only legacy saves drawn mid-season can hit this.
    const event = matchByRound.get(round);
    // in_progress: the live tick engine has started it; still unplayed.
    if (event && (event.status === "scheduled" || event.status === "in_progress")) {
      tx.insert(worldTourFixturesTable).values({
        careerSaveId, seasonYear, round, tier,
        homeCompetitorId: playerCompetitorId,
        awayCompetitorId: opponent.competitorId,
        matchId:          event.id,
        status:           "scheduled",
      }).run();
      tx.update(matchesTable)
        .set({ awayTeamName: opponent.name })
        .where(eq(matchesTable.id, event.id))
        .run();
    }

    for (const [a, b] of pairs) {
      // Alternate which club is listed at home, so no club is always home.
      const [home, away] = k % 2 === 0 ? [field[a]!, field[b]!] : [field[b]!, field[a]!];
      tx.insert(worldTourFixturesTable).values({
        careerSaveId, seasonYear, round, tier,
        homeCompetitorId: home.competitorId,
        awayCompetitorId: away.competitorId,
        status:           "scheduled",
      }).run();
    }
  }

  return { drawn: true, fieldSize: field.length + 1 };
}

// ── Playing AI fixtures ──────────────────────────────────────────────────────

function poolTeamByCompetitorTx(tx: Tx, competitorIds: number[]): Map<number, number> {
  if (competitorIds.length === 0) return new Map();
  const rows = tx.select({ id: competitorsTable.id, poolTeamId: competitorsTable.poolTeamId })
    .from(competitorsTable)
    .where(inArray(competitorsTable.id, competitorIds))
    .all();
  const map = new Map<number, number>();
  for (const r of rows) if (r.poolTeamId != null) map.set(r.id, r.poolTeamId);
  return map;
}

function totalPoints(sets: SetScore[]): { home: number; away: number } {
  return sets.reduce((t, s) => ({ home: t.home + s.home, away: t.away + s.away }), { home: 0, away: 0 });
}

/**
 * Play every scheduled AI-vs-AI fixture up to and including `upToRound`, in
 * round order, each through the player's engine, crediting both sides from the
 * player's ranking table. Returns how many were played.
 *
 * The weather is the event's own — read from the player's match for the same
 * round, which is the same beach on the same day.
 */
export function playWorldTourUpToTx(
  tx: Tx, careerSaveId: number, seasonYear: number, playerTeamId: number, upToRound: number,
): number {
  const due = tx.select().from(worldTourFixturesTable).where(and(
    eq(worldTourFixturesTable.careerSaveId, careerSaveId),
    eq(worldTourFixturesTable.seasonYear, seasonYear),
    eq(worldTourFixturesTable.status, "scheduled"),
    isNull(worldTourFixturesTable.matchId),
    lte(worldTourFixturesTable.round, upToRound),
  )).orderBy(asc(worldTourFixturesTable.round), asc(worldTourFixturesTable.id)).all();
  if (due.length === 0) return 0;

  const ratings = poolClubRatingsTx(tx);
  const poolOf = poolTeamByCompetitorTx(tx, [
    ...new Set(due.flatMap((f) => [f.homeCompetitorId, f.awayCompetitorId])),
  ]);

  const weatherRows = tx.select({
    round: matchesTable.round, weather: matchesTable.weather,
    windSpeed: matchesTable.windSpeed, temperature: matchesTable.temperature,
  }).from(matchesTable).where(and(
    eq(matchesTable.homeTeamId, playerTeamId),
    eq(matchesTable.season, seasonYear),
  )).all();
  const weatherPenaltyByRound = new Map(weatherRows.map((w) => [
    w.round,
    getWeatherEffects(w.weather, Number(w.windSpeed ?? 0), Number(w.temperature ?? 25)).performancePenalty,
  ]));

  for (const fx of due) {
    const homePool = poolOf.get(fx.homeCompetitorId);
    const awayPool = poolOf.get(fx.awayCompetitorId);
    const home = homePool != null ? ratings.get(homePool) : undefined;
    const away = awayPool != null ? ratings.get(awayPool) : undefined;
    if (home == null || away == null) {
      throw new Error(`World Tour fixture ${fx.id} has a side that is not a rated pool club`);
    }

    const p = pointProbability(home, away, {
      homeAdvantage:  true,
      weatherPenalty: weatherPenaltyByRound.get(fx.round) ?? 0,
    });
    const result = simulateMatch(p);
    const points = totalPoints(result.sets);

    tx.update(worldTourFixturesTable).set({
      status:     "completed",
      homeSets:   result.homeScore,
      awaySets:   result.awayScore,
      homePoints: points.home,
      awayPoints: points.away,
      sets:       result.sets,
      playedAt:   new Date(),
    }).where(eq(worldTourFixturesTable.id, fx.id)).run();

    creditCompetitorTx(tx, {
      careerSaveId, seasonYear, competitorId: fx.homeCompetitorId, tier: fx.tier, won: result.homeWon,
    });
    creditCompetitorTx(tx, {
      careerSaveId, seasonYear, competitorId: fx.awayCompetitorId, tier: fx.tier, won: !result.homeWon,
    });
  }
  return due.length;
}

/**
 * The player's match has been decided: record it on the fixture and credit the
 * opponent with the other half of the result. The player's own ranking is
 * credited by the caller, exactly as before. Returns false when the match is
 * not a World Tour fixture (a friendly) or was already recorded.
 */
export function recordPlayerMatchResultTx(tx: Tx, args: {
  careerSaveId: number;
  matchId: number;
  playerWon: boolean;
  homeSets: number;
  awaySets: number;
  sets?: SetScore[] | null;
}): boolean {
  const fx = tx.select().from(worldTourFixturesTable)
    .where(eq(worldTourFixturesTable.matchId, args.matchId)).get();
  if (!fx || fx.status !== "scheduled") return false;

  const points = args.sets ? totalPoints(args.sets) : null;
  tx.update(worldTourFixturesTable).set({
    status:     "completed",
    homeSets:   args.homeSets,
    awaySets:   args.awaySets,
    homePoints: points?.home ?? null,
    awayPoints: points?.away ?? null,
    sets:       args.sets ?? null,
    playedAt:   new Date(),
  }).where(eq(worldTourFixturesTable.id, fx.id)).run();

  creditCompetitorTx(tx, {
    careerSaveId: args.careerSaveId,
    seasonYear:   fx.seasonYear,
    competitorId: fx.awayCompetitorId,
    tier:         fx.tier,
    won:          !args.playerWon,
  });
  return true;
}

export function recordPlayerMatchResult(args: Parameters<typeof recordPlayerMatchResultTx>[1]): boolean {
  return db.transaction((tx) => recordPlayerMatchResultTx(tx, args));
}

/** The World Tour fixture behind a player match, if it is one. */
export function fixtureForMatch(matchId: number) {
  return db.select().from(worldTourFixturesTable)
    .where(eq(worldTourFixturesTable.matchId, matchId)).get() ?? null;
}

/** An AI opponent's strength by competitor, for the player's own match. */
export function competitorRating(competitorId: number): number | null {
  return db.transaction((tx) => {
    const pool = poolTeamByCompetitorTx(tx, [competitorId]).get(competitorId);
    if (pool == null) return null;
    return poolClubRatingsTx(tx).get(pool) ?? null;
  });
}

// ── Standings ────────────────────────────────────────────────────────────────

export type StandingRow = {
  rank: number;
  competitorId: number;
  teamId: number | null;
  poolTeamId: number | null;
  name: string;
  isPlayer: boolean;
  wins: number;
  losses: number;
  points: number;
  setsFor: number;
  setsAgainst: number;
  /** Last five World Tour results, most recent first. */
  form: Array<"W" | "L">;
};

/**
 * The one standings function every reader uses: the ladder, the leaderboard,
 * the dashboard rank, the World Finals seeding and the season snapshot.
 *
 * Order: ranking points, then wins, then set difference, then fewer losses, then
 * competitor id so that a tie always resolves the same way.
 */
export function worldTourStandingsTx(tx: Tx, careerSaveId: number, seasonYear: number): StandingRow[] {
  const rows = tx.select({
    competitorId: competitorRankingsTable.competitorId,
    wins:         competitorRankingsTable.wins,
    losses:       competitorRankingsTable.losses,
    points:       competitorRankingsTable.rankingPoints,
    teamId:       competitorsTable.teamId,
    poolTeamId:   competitorsTable.poolTeamId,
    teamName:     teamsTable.name,
    poolName:     continentalPoolTeamsTable.teamName,
  })
    .from(competitorRankingsTable)
    .innerJoin(competitorsTable, eq(competitorsTable.id, competitorRankingsTable.competitorId))
    .leftJoin(teamsTable, eq(teamsTable.id, competitorsTable.teamId))
    .leftJoin(continentalPoolTeamsTable, eq(continentalPoolTeamsTable.id, competitorsTable.poolTeamId))
    .where(and(
      eq(competitorRankingsTable.careerSaveId, careerSaveId),
      eq(competitorRankingsTable.seasonYear, seasonYear),
    ))
    .all();

  const played = tx.select({
    round:            worldTourFixturesTable.round,
    homeCompetitorId: worldTourFixturesTable.homeCompetitorId,
    awayCompetitorId: worldTourFixturesTable.awayCompetitorId,
    homeSets:         worldTourFixturesTable.homeSets,
    awaySets:         worldTourFixturesTable.awaySets,
  }).from(worldTourFixturesTable).where(and(
    eq(worldTourFixturesTable.careerSaveId, careerSaveId),
    eq(worldTourFixturesTable.seasonYear, seasonYear),
    eq(worldTourFixturesTable.status, "completed"),
  )).orderBy(asc(worldTourFixturesTable.round), asc(worldTourFixturesTable.id)).all();

  const sets = new Map<number, { for: number; against: number; form: Array<"W" | "L"> }>();
  const entry = (id: number) => {
    let e = sets.get(id);
    if (!e) { e = { for: 0, against: 0, form: [] }; sets.set(id, e); }
    return e;
  };
  for (const f of played) {
    const hs = f.homeSets ?? 0, as = f.awaySets ?? 0;
    const home = entry(f.homeCompetitorId), away = entry(f.awayCompetitorId);
    home.for += hs; home.against += as; home.form.push(hs > as ? "W" : "L");
    away.for += as; away.against += hs; away.form.push(as > hs ? "W" : "L");
  }

  const standings = rows.map((r) => {
    const s = sets.get(r.competitorId);
    return {
      rank:         0,
      competitorId: r.competitorId,
      teamId:       r.teamId,
      poolTeamId:   r.poolTeamId,
      name:         r.teamName ?? r.poolName ?? "Unknown",
      isPlayer:     r.teamId != null,
      wins:         r.wins,
      losses:       r.losses,
      points:       r.points,
      setsFor:      s?.for ?? 0,
      setsAgainst:  s?.against ?? 0,
      form:         (s?.form ?? []).slice(-5).reverse(),
    };
  });

  standings.sort((a, b) =>
    (b.points - a.points)
    || (b.wins - a.wins)
    || ((b.setsFor - b.setsAgainst) - (a.setsFor - a.setsAgainst))
    || (a.losses - b.losses)
    || (a.competitorId - b.competitorId));
  standings.forEach((s, i) => { s.rank = i + 1; });
  return standings;
}

export function worldTourStandings(careerSaveId: number, seasonYear: number): StandingRow[] {
  return db.transaction((tx) => worldTourStandingsTx(tx, careerSaveId, seasonYear));
}

// ── World Finals ─────────────────────────────────────────────────────────────

function playerFinalsMatchTx(tx: Tx, playerTeamId: number, seasonYear: number, tier: string) {
  return tx.select().from(matchesTable).where(and(
    eq(matchesTable.homeTeamId, playerTeamId),
    eq(matchesTable.season, seasonYear),
    eq(matchesTable.tier, tier),
  )).limit(1).get() ?? null;
}

function competitorNameTx(tx: Tx, competitorId: number): string {
  const r = tx.select({ teamName: teamsTable.name, poolName: continentalPoolTeamsTable.teamName })
    .from(competitorsTable)
    .leftJoin(teamsTable, eq(teamsTable.id, competitorsTable.teamId))
    .leftJoin(continentalPoolTeamsTable, eq(continentalPoolTeamsTable.id, competitorsTable.poolTeamId))
    .where(eq(competitorsTable.id, competitorId))
    .get();
  return r?.teamName ?? r?.poolName ?? "Unknown";
}

function roundFixturesTx(tx: Tx, careerSaveId: number, seasonYear: number, round: number) {
  return tx.select().from(worldTourFixturesTable).where(and(
    eq(worldTourFixturesTable.careerSaveId, careerSaveId),
    eq(worldTourFixturesTable.seasonYear, seasonYear),
    eq(worldTourFixturesTable.round, round),
  )).orderBy(asc(worldTourFixturesTable.id)).all();
}

function markNotQualifiedTx(tx: Tx, match: { id: number; status: string } | null) {
  if (match && match.status === "scheduled") {
    tx.update(matchesTable).set({ status: NOT_QUALIFIED }).where(eq(matchesTable.id, match.id)).run();
  }
}

/**
 * Seed the semi finals from the standings as they stand once every regular
 * World Tour fixture — the player's included — is decided. 1v4 and 2v3.
 * A player outside the top four does not play the finals.
 */
export function seedWorldFinalsTx(
  tx: Tx, careerSaveId: number, seasonYear: number, playerTeamId: number,
): "seeded" | "already" | "waiting" {
  if (roundFixturesTx(tx, careerSaveId, seasonYear, FINALS_START).length > 0) return "already";
  if (!hasDrawTx(tx, careerSaveId, seasonYear)) return "waiting";

  const undecided = tx.select({ id: worldTourFixturesTable.id }).from(worldTourFixturesTable).where(and(
    eq(worldTourFixturesTable.careerSaveId, careerSaveId),
    eq(worldTourFixturesTable.seasonYear, seasonYear),
    lte(worldTourFixturesTable.round, WORLD_TOUR_END),
    eq(worldTourFixturesTable.status, "scheduled"),
  )).limit(1).get();
  if (undecided) return "waiting";

  const standings = worldTourStandingsTx(tx, careerSaveId, seasonYear);
  if (standings.length < 4) return "waiting";
  const seeds = standings.slice(0, 4);
  const playerSemi = playerFinalsMatchTx(tx, playerTeamId, seasonYear, SEMI_FINAL_TIER);
  const playerFinal = playerFinalsMatchTx(tx, playerTeamId, seasonYear, FINAL_TIER);
  const isThisPlayer = (s: StandingRow) => s.isPlayer && s.teamId === playerTeamId;

  let playerQualified = false;
  const semis: Array<[StandingRow, number, StandingRow, number]> = [
    [seeds[0]!, 1, seeds[3]!, 4],
    [seeds[1]!, 2, seeds[2]!, 3],
  ];
  for (const [a, seedA, b, seedB] of semis) {
    const playerSide = isThisPlayer(a) ? "a" : isThisPlayer(b) ? "b" : null;
    if (playerSide && playerSemi && (playerSemi.status === "scheduled" || playerSemi.status === "in_progress")) {
      playerQualified = true;
      const [p, ps, o, os] = playerSide === "a" ? [a, seedA, b, seedB] : [b, seedB, a, seedA];
      tx.insert(worldTourFixturesTable).values({
        careerSaveId, seasonYear, round: FINALS_START, tier: SEMI_FINAL_TIER,
        homeCompetitorId: p.competitorId, awayCompetitorId: o.competitorId,
        homeSeed: ps, awaySeed: os, matchId: playerSemi.id, status: "scheduled",
      }).run();
      tx.update(matchesTable).set({ awayTeamName: o.name }).where(eq(matchesTable.id, playerSemi.id)).run();
    } else {
      tx.insert(worldTourFixturesTable).values({
        careerSaveId, seasonYear, round: FINALS_START, tier: SEMI_FINAL_TIER,
        homeCompetitorId: a.competitorId, awayCompetitorId: b.competitorId,
        homeSeed: seedA, awaySeed: seedB, status: "scheduled",
      }).run();
    }
  }

  if (!playerQualified) {
    markNotQualifiedTx(tx, playerSemi);
    markNotQualifiedTx(tx, playerFinal);
  }
  return "seeded";
}

/** Once both semis are decided, the two winners meet in the World Final. */
export function seedWorldFinalTx(
  tx: Tx, careerSaveId: number, seasonYear: number, playerTeamId: number,
): "seeded" | "already" | "waiting" {
  if (roundFixturesTx(tx, careerSaveId, seasonYear, FINALS_END).length > 0) return "already";
  const semis = roundFixturesTx(tx, careerSaveId, seasonYear, FINALS_START);
  if (semis.length !== 2 || semis.some((s) => s.status !== "completed")) return "waiting";

  const winners = semis.map((s) => (s.homeSets ?? 0) > (s.awaySets ?? 0)
    ? { competitorId: s.homeCompetitorId, seed: s.homeSeed }
    : { competitorId: s.awayCompetitorId, seed: s.awaySeed });
  const [w1, w2] = winners as [typeof winners[0], typeof winners[0]];

  const playerCompetitorId = competitorIdForTeamTx(tx, playerTeamId);
  const playerFinal = playerFinalsMatchTx(tx, playerTeamId, seasonYear, FINAL_TIER);
  const playerWinner = w1.competitorId === playerCompetitorId ? w1
    : w2.competitorId === playerCompetitorId ? w2 : null;

  if (playerWinner && playerFinal && (playerFinal.status === "scheduled" || playerFinal.status === "in_progress")) {
    const other = playerWinner === w1 ? w2 : w1;
    tx.insert(worldTourFixturesTable).values({
      careerSaveId, seasonYear, round: FINALS_END, tier: FINAL_TIER,
      homeCompetitorId: playerCompetitorId, awayCompetitorId: other.competitorId,
      homeSeed: playerWinner.seed, awaySeed: other.seed, matchId: playerFinal.id, status: "scheduled",
    }).run();
    tx.update(matchesTable)
      .set({ awayTeamName: competitorNameTx(tx, other.competitorId) })
      .where(eq(matchesTable.id, playerFinal.id))
      .run();
  } else {
    tx.insert(worldTourFixturesTable).values({
      careerSaveId, seasonYear, round: FINALS_END, tier: FINAL_TIER,
      homeCompetitorId: w1.competitorId, awayCompetitorId: w2.competitorId,
      homeSeed: w1.seed, awaySeed: w2.seed, status: "scheduled",
    }).run();
    markNotQualifiedTx(tx, playerFinal);
  }
  return "seeded";
}

// ── Entry point ──────────────────────────────────────────────────────────────

export type WorldTourProgress = {
  drawn: boolean;
  /** Why the World Tour cannot move yet, for a 409. Null when it did. */
  blocked: string | null;
  aiPlayed: number;
};

/**
 * Bring this career's World Tour up to `upToRound`: draw it if needed, play the
 * AI fixtures that are due, seed the finals when their round arrives.
 *
 * `allowRegionalCatchUp` is for the calendar only — see catchUpRegionalSeason.
 * A route acting ahead of the calendar gets `blocked` instead, so a regional
 * season is never resolved before its round 10 has actually come.
 */
export async function advanceWorldTour(opts: {
  careerSaveId: number;
  seasonYear: number;
  playerTeamId: number;
  upToRound: number;
  allowRegionalCatchUp: boolean;
}): Promise<WorldTourProgress> {
  const { careerSaveId, seasonYear, playerTeamId, upToRound } = opts;
  if (upToRound < WORLD_TOUR_START) return { drawn: false, blocked: null, aiPlayed: 0 };

  const alreadyDrawn = db.transaction((tx) => hasDrawTx(tx, careerSaveId, seasonYear));
  if (!alreadyDrawn && opts.allowRegionalCatchUp) {
    await catchUpRegionalSeason(careerSaveId, seasonYear);
  }

  return db.transaction((tx): WorldTourProgress => {
    const draw = drawWorldTourTx(tx, careerSaveId, seasonYear, playerTeamId);
    if (!draw.drawn) {
      return {
        drawn: false,
        blocked: `The World Tour field is decided when the regional leagues finish after round ${REGIONAL_END} — ${draw.reason}.`,
        aiPlayed: 0,
      };
    }

    let aiPlayed = playWorldTourUpToTx(tx, careerSaveId, seasonYear, playerTeamId,
      Math.min(upToRound, WORLD_TOUR_END));
    if (upToRound >= FINALS_START) {
      seedWorldFinalsTx(tx, careerSaveId, seasonYear, playerTeamId);
      aiPlayed += playWorldTourUpToTx(tx, careerSaveId, seasonYear, playerTeamId, FINALS_START);
    }
    if (upToRound >= FINALS_END) {
      seedWorldFinalTx(tx, careerSaveId, seasonYear, playerTeamId);
      aiPlayed += playWorldTourUpToTx(tx, careerSaveId, seasonYear, playerTeamId, FINALS_END);
    }
    return { drawn: true, blocked: null, aiPlayed };
  });
}

export const NOT_QUALIFIED_MESSAGE = "Your club did not qualify for this World Finals match.";

/**
 * Before a player's World Tour match is played, watched, forfeited or reported
 * by Unity: bring the tour up to its round and make sure the match has a real,
 * drawn opponent. Returns a message for a 409, or null when it may proceed.
 *
 * Friendlies (no tier) and the All-Star exhibition are not World Tour fixtures
 * and pass straight through.
 */
export async function worldTourGate(
  careerSaveId: number,
  playerTeamId: number,
  match: { id: number; round: number; season: number; tier: string | null; status: string },
): Promise<string | null> {
  if (match.status === NOT_QUALIFIED) return NOT_QUALIFIED_MESSAGE;
  if (!match.tier || match.tier === "All-Star Match") return null;
  if (match.round < WORLD_TOUR_START || match.round > FINALS_END) return null;

  const wt = await advanceWorldTour({
    careerSaveId, seasonYear: match.season, playerTeamId,
    upToRound: match.round, allowRegionalCatchUp: false,
  });
  if (wt.blocked) return wt.blocked;
  if (fixtureForMatch(match.id)) return null;

  const now = db.select({ status: matchesTable.status }).from(matchesTable)
    .where(eq(matchesTable.id, match.id)).get();
  if (now?.status === NOT_QUALIFIED) return NOT_QUALIFIED_MESSAGE;
  return "This match's opponent is not decided yet: it is set once every match of the round before it has been played.";
}

export type WorldFinalsSummary = {
  seeded: boolean;
  playerQualified: boolean | null;
  /** Null while the finals are still being played. */
  playerResult: "champion" | "runner-up" | "semi-finalist" | "did not qualify" | null;
  champion: string | null;
  runnerUp: string | null;
};

/** How a season's World Finals went, for the season review. */
export function worldFinalsSummary(
  careerSaveId: number, seasonYear: number, playerTeamId: number,
): WorldFinalsSummary {
  return db.transaction((tx): WorldFinalsSummary => {
    const semis = roundFixturesTx(tx, careerSaveId, seasonYear, FINALS_START);
    if (semis.length === 0) {
      return { seeded: false, playerQualified: null, playerResult: null, champion: null, runnerUp: null };
    }
    const player = competitorIdForTeamTx(tx, playerTeamId);
    const inSemis = semis.some((s) => s.homeCompetitorId === player || s.awayCompetitorId === player);
    const final = roundFixturesTx(tx, careerSaveId, seasonYear, FINALS_END)[0];

    let championId: number | null = null;
    let runnerUpId: number | null = null;
    if (final && final.status === "completed") {
      const homeWon = (final.homeSets ?? 0) > (final.awaySets ?? 0);
      championId = homeWon ? final.homeCompetitorId : final.awayCompetitorId;
      runnerUpId = homeWon ? final.awayCompetitorId : final.homeCompetitorId;
    }
    const decided = championId != null;
    const playerResult: WorldFinalsSummary["playerResult"] = !inSemis ? "did not qualify"
      : championId === player ? "champion"
      : runnerUpId === player ? "runner-up"
      : decided ? "semi-finalist"
      : null;

    return {
      seeded: true,
      playerQualified: inSemis,
      playerResult,
      champion: championId != null ? competitorNameTx(tx, championId) : null,
      runnerUp: runnerUpId != null ? competitorNameTx(tx, runnerUpId) : null,
    };
  });
}
