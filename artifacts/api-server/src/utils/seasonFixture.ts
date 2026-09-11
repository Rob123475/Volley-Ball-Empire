/**
 * The season fixture generator — one generator, every caller.
 *
 * R-35: `rolloverSeason` opened the next season but never built its fixture, so
 * a rolled-over season existed with nothing to play. The only things that ever
 * generated one were `POST /careers` (hardcoded to 2026) and the two read paths
 * `GET /dashboard` / `GET /matches/fixture`, which call `ensureSeasonFixture`
 * defensively — so the dashboard silently repaired the season the first time a
 * player happened to open it, and any path that did not open a page saw an
 * empty season indefinitely. That is why the five-season harness walked seasons
 * 2-5 at 0W 0L: it advances the calendar and plays whatever is scheduled, never
 * opens the dashboard, and so found nothing to play.
 *
 * The fix is for the rollover to build the fixture itself, in the same
 * transaction that creates the season — a season and its fixture are one atomic
 * thing, not a season plus whatever a later page visit happens to repair.
 *
 * That required the generator to be callable from inside an existing
 * better-sqlite3 transaction, which cannot await. So it lives here as
 * `ensureSeasonFixtureRows(tx, ...)`, fully synchronous, and
 * `ensureSeasonFixture` in routes/matches.ts is now a thin async wrapper that
 * opens a transaction around it for the three callers that already had one.
 * Still one generator — it takes its transaction from the caller now.
 *
 * It lives in utils/ rather than routes/matches.ts to keep the import graph
 * one-directional: utils/seasonRollover.ts needs the generator, and
 * routes/matches.ts needs seasonRollover's season-number helpers, so leaving
 * the generator in matches.ts would have made that a cycle.
 */
import { db } from "@workspace/db";
import { matchesTable, matchLiveStateTable, locationsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { WORLD_TOUR } from "../data/worldTour.js";
import type { WorldTourEvent } from "../data/worldTour.js";
import { generateWeather, LOCATION_WEATHER_POOLS } from "./weather.js";

/** The transaction object better-sqlite3 hands a `db.transaction` callback. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ── Season fixture ────────────────────────────────────────────────────────────
// Every non-finals event is the regular World Tour season; the World Finals
// events are scheduled together at a single venue picked per season.
export const FINALS_TIERS = new Set(["World Semi Final", "All-Star Match", "World Final"]);

/** Shift a hardcoded 2026 schedule date onto the season being played. */
export function shiftDateToYear(date: string, year: number): string {
  return `${year}${date.slice(4)}`;
}

/**
 * The season's events, with the schedule's hardcoded 2026 dates shifted onto
 * the year actually being played. Season 2 used to generate fixtures dated
 * 2026 while the calendar sat in 2027, so nothing was ever "today".
 */
function generateSeasonFixture(year: number): WorldTourEvent[] {
  return WORLD_TOUR
    .filter(e => !FINALS_TIERS.has(e.tier))
    .map(e => ({ ...e, date: shiftDateToYear(e.date, year) }));
}

/**
 * How many events a complete fixture has — derived from the schedule itself,
 * never a literal, so a change to worldTour.ts cannot leave a caller asserting
 * against a count the data no longer produces.
 */
export const FIXTURE_EVENT_COUNT = WORLD_TOUR.length;

/**
 * Ensure a team has its full season fixture for `seasonYear`, generating
 * whatever is missing, and return the fixture.
 *
 * Synchronous, and takes the caller's transaction: the season rollover builds
 * its fixture inside the same transaction that creates the season, while
 * `ensureSeasonFixture` wraps this in a transaction of its own.
 *
 * Idempotent — a season that already has a complete fixture gets it back
 * untouched, which is what lets the read paths keep calling this defensively.
 */
export function ensureSeasonFixtureRows(
  tx: Tx,
  team: { id: number; name: string },
  seasonYear: number,
) {
  let existing = tx.select().from(matchesTable)
    .where(and(eq(matchesTable.homeTeamId, team.id), eq(matchesTable.season, seasonYear)))
    .orderBy(matchesTable.round)
    .all();

  // Migration: has old fixtures but is missing the World Finals events (e.g.
  // saves created before Finals matches existed) — remove any stale rounds
  // >= 67 and re-add the current World Finals events (the `!hasWorldFinals`
  // branch below).
  const hasWorldFinals = existing.some(m => FINALS_TIERS.has(m.tier ?? ""));
  if (existing.length > 0 && !hasWorldFinals) {
    // match_live_state rows are created when a live match starts and are never
    // cleaned up, so deleting the matches they reference is a FOREIGN KEY
    // failure — a permanent 500 on the fixture screen for that save. Clear the
    // dependents first, in the same transaction as the delete.
    const staleIds = existing.filter(m => (m.round ?? 0) >= 67).map(m => m.id);
    if (staleIds.length > 0) {
      tx.delete(matchLiveStateTable)
        .where(inArray(matchLiveStateTable.matchId, staleIds))
        .run();
      tx.delete(matchesTable)
        .where(inArray(matchesTable.id, staleIds))
        .run();
    }
    existing = existing.filter(m => (m.round ?? 0) < 67);
  }

  if (existing.length === 0) {
    const regularEvents = generateSeasonFixture(seasonYear);
    const { finalLocId, finalsLocationName } = pickFinalsVenue(tx);

    for (const f of regularEvents) {
      const { weather, windSpeed, temperature } = generateWeather(f.locId);
      tx.insert(matchesTable).values({
        homeTeamId:   team.id,
        awayTeamId:   team.id,
        locationId:   f.locId,
        locationName: f.locName,
        homeTeamName: team.name,
        // R-29: drawn from the real field when the World Tour begins
        // (utils/worldTour.ts); there is no opponent to name before then.
        awayTeamName: "TBD",
        weather,
        windSpeed,
        temperature,
        season:      seasonYear,
        round:       f.round,
        teamSize:    2,
        scheduledAt: `${f.date}T14:00:00.000Z`,
        prizeAmount: f.prize,
        status:      "scheduled",
        continent:   f.continent,
        tier:        f.tier,
      }).run();
    }

    insertWorldFinals(tx, team, seasonYear, finalLocId, finalsLocationName);

    existing = tx.select().from(matchesTable)
      .where(and(eq(matchesTable.homeTeamId, team.id), eq(matchesTable.season, seasonYear)))
      .orderBy(matchesTable.round)
      .all();
  } else if (!hasWorldFinals) {
    // Only the World Finals events are missing (migration 2 path).
    const { finalLocId, finalsLocationName } = pickFinalsVenue(tx);

    insertWorldFinals(tx, team, seasonYear, finalLocId, finalsLocationName);

    existing = tx.select().from(matchesTable)
      .where(and(eq(matchesTable.homeTeamId, team.id), eq(matchesTable.season, seasonYear)))
      .orderBy(matchesTable.round)
      .all();
  }

  return existing;
}

/** One venue for the season's World Finals, named from the locations table. */
function pickFinalsVenue(tx: Tx) {
  const finalLocIds = Object.keys(LOCATION_WEATHER_POOLS).map(Number);
  const finalLocId = finalLocIds[Math.floor(Math.random() * finalLocIds.length)]!;
  const [finalLoc] = tx.select().from(locationsTable)
    .where(eq(locationsTable.id, finalLocId)).limit(1).all();
  return {
    finalLocId,
    finalsLocationName: finalLoc
      ? `${finalLoc.name} • ${finalLoc.country}`
      : "Copacabana Beach • Brazil",
  };
}

function insertWorldFinals(
  tx: Tx,
  team: { id: number; name: string },
  seasonYear: number,
  finalLocId: number,
  finalsLocationName: string,
) {
  const events = WORLD_TOUR
    .filter(e => FINALS_TIERS.has(e.tier))
    .map(e => ({ ...e, date: shiftDateToYear(e.date, seasonYear) }));

  for (const f of events) {
    const { weather, windSpeed, temperature } = generateWeather(finalLocId);
    const isAllStar = f.tier === "All-Star Match";
    tx.insert(matchesTable).values({
      homeTeamId:   team.id,
      awayTeamId:   team.id,
      locationId:   finalLocId,
      locationName: finalsLocationName,
      homeTeamName: isAllStar ? "Europe / Asia / Oceania All-Stars" : team.name,
      awayTeamName: "TBD",
      weather,
      windSpeed,
      temperature,
      season:      seasonYear,
      round:       f.round,
      teamSize:    2,
      scheduledAt: `${f.date}T14:00:00.000Z`,
      prizeAmount: f.prize,
      status:      "scheduled",
      continent:   f.continent,
      tier:        f.tier,
    }).run();
  }
}
