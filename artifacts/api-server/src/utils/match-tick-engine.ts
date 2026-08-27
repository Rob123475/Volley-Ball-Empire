/**
 * Point-tick engine for the "Watch Match" live view.
 *
 * Turns a match from a single instant random roll into a real, timed
 * sequence of points that gets written to `matchLiveStateTable` after every
 * point. `GET /unity/match-state` (and the web `/matches/:id/live-state`
 * endpoint) just read the latest row — they don't know or care that a tick
 * loop produced it.
 *
 * This module deliberately does NOT touch team wins/losses, budget, board
 * confidence, injuries, or any other match economy — that logic already
 * lives in POST /matches/:id/simulate and stays there unchanged. Once the
 * tick loop decides a winner, the caller (frontend) calls that same
 * /simulate endpoint, passing the real result via `precomputedResult` so
 * the economy runs exactly as it always has, just with a real score instead
 * of a fresh random one.
 */

import { db, matchesTable, matchLiveStateTable, playersTable, teamsTable } from "@workspace/db";
import { sideRating, pointProbability, pointTarget as sharedPointTarget } from "./matchEngine.js";
import { eq, and, inArray, isNull, notInArray, desc, sql } from "drizzle-orm";
import { getWeatherEffects } from "../routes/matches.js";
import { logger } from "../lib/logger.js";

const TICK_MS = 1800; // ~1 point every 1.8s of real time
const SECONDS_PER_POINT = 22; // in-fiction rally duration, for matchTimeSeconds
const SET_BREAK_TICKS = 3; // extra idle ticks between sets
const WIN_BY = 2;

// Guards against double-starting the same match's tick loop (e.g. a double click).
const activeMatches = new Set<number>();

type Side = "home" | "away";

// speed/stamina included so the roster satisfies the shared engine's six-stat
// rating. `select()` already returns full player rows, so nothing extra is
// fetched — the type was simply narrower than the data.
type RosterPlayer = {
  id: number; power: number; serve: number; defense: number;
  block: number; speed: number; stamina: number;
};

const overallExpr = sql<number>`(${playersTable.speed}+${playersTable.power}+${playersTable.defense}+${playersTable.serve}+${playersTable.block}+${playersTable.stamina})`;

async function loadRoster(teamId: number | null, excludeIds: number[]): Promise<RosterPlayer[]> {
  if (teamId == null) return [];
  const rows = await db
    .select()
    .from(playersTable)
    .where(and(
      eq(playersTable.teamId, teamId),
      eq(playersTable.isActive, true),
      eq(playersTable.playerType, "senior"),
    ))
    .orderBy(desc(overallExpr))
    .limit(2);
  return rows.filter(p => !excludeIds.includes(p.id));
}

async function loadFallbackPool(excludeIds: number[]): Promise<RosterPlayer[]> {
  const rows = await db
    .select()
    .from(playersTable)
    .where(and(
      isNull(playersTable.teamId),
      eq(playersTable.playerType, "senior"),
      eq(playersTable.isActive, true),
      excludeIds.length > 0 ? notInArray(playersTable.id, excludeIds) : undefined,
    ))
    .orderBy(desc(overallExpr))
    .limit(2);
  return rows;
}

// Rating now comes from the shared engine (six-stat mean, the OVR the UI
// shows). This file used a four-stat average while the instant sim used a
// three-stat one, so the two engines disagreed about what a squad was worth.
function sideAvg(roster: RosterPlayer[]): number {
  return sideRating(roster);
}

const pointTarget = sharedPointTarget;

function isSetWon(a: number, b: number, target: number): boolean {
  return a >= target && a - b >= WIN_BY;
}

const ACTIONS: { label: string; stat: keyof RosterPlayer }[] = [
  { label: "spikes it down for the point!", stat: "power" },
  { label: "aces the serve!", stat: "serve" },
  { label: "digs it up and the point continues!", stat: "defense" },
  { label: "gets a huge block at the net!", stat: "block" },
];

function pickPlayer(roster: RosterPlayer[], stat: keyof RosterPlayer): RosterPlayer | undefined {
  if (roster.length === 0) return undefined;
  // Weighted pick toward whoever's stronger in that stat, with a little randomness.
  const weights = roster.map(p => Math.max(1, p[stat] as number));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < roster.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return roster[i];
  }
  return roster[roster.length - 1];
}

/**
 * Kicks off the live tick loop for a match. Fire-and-forget — the HTTP
 * handler that calls this should respond immediately; the loop runs on its
 * own timer and writes state as it goes.
 */
export async function startMatchTick(matchId: number): Promise<{ ok: boolean; error?: string }> {
  if (activeMatches.has(matchId)) {
    return { ok: true }; // already running — treat as success, idempotent
  }

  const match = await db.query.matchesTable.findFirst({ where: eq(matchesTable.id, matchId) });
  if (!match) return { ok: false, error: "Match not found" };
  if (match.status === "completed") return { ok: false, error: "Match already completed" };

  const homeRoster = await loadRoster(match.homeTeamId, []);
  let awayRoster = match.awayTeamId != null && match.awayTeamId !== match.homeTeamId
    ? await loadRoster(match.awayTeamId, homeRoster.map(p => p.id))
    : [];
  if (awayRoster.length < 2) {
    const exclude = [...homeRoster.map(p => p.id), ...awayRoster.map(p => p.id)];
    awayRoster = [...awayRoster, ...(await loadFallbackPool(exclude))];
  }

  const homeAvg = sideAvg(homeRoster);
  const awayAvg = sideAvg(awayRoster);
  const wx = getWeatherEffects(
    match.weather,
    Number(match.windSpeed ?? 0),
    Number(match.temperature ?? 25),
  );
  const weatherFactor = 1 - wx.performancePenalty;

  await db.update(matchesTable).set({ status: "in_progress" }).where(eq(matchesTable.id, matchId));
  await db.insert(matchLiveStateTable).values({
    matchId,
    currentSet: 1,
    homeSetScore: 0,
    awaySetScore: 0,
    setsWonHome: 0,
    setsWonAway: 0,
    servingTeam: Math.random() < 0.5 ? "home" : "away",
    rallyState: "serving",
    matchTimeSeconds: 0,
  }).onConflictDoNothing();

  activeMatches.add(matchId);

  runLoop(matchId, homeRoster, awayRoster, homeAvg, awayAvg, weatherFactor, wx.rallyRandomness).catch(err => {
    logger.error({ matchId, err }, "match tick loop crashed");
    activeMatches.delete(matchId);
  });

  return { ok: true };
}

async function runLoop(
  matchId: number,
  homeRoster: RosterPlayer[],
  awayRoster: RosterPlayer[],
  homeAvg: number,
  awayAvg: number,
  weatherFactor: number,
  rallyRandomness: number,
) {
  let currentSet = 1;
  let homeSetScore = 0;
  let awaySetScore = 0;
  let setsWonHome = 0;
  let setsWonAway = 0;
  let matchTimeSeconds = 0;
  let servingTeam: Side = Math.random() < 0.5 ? "home" : "away";

  // weatherFactor is no longer a multiplier on strength — the shared model
  // treats bad weather as compression toward a coin flip (more upsets) rather
  // than as a penalty applied to both sides, which largely cancelled out.
  const pHome = pointProbability(homeAvg, awayAvg, {
    homeAdvantage:  true,
    weatherPenalty: 1 - weatherFactor,
  });

  while (setsWonHome < 2 && setsWonAway < 2) {
    const target = pointTarget(currentSet);

    // Serving announcement frame
    await writeState(matchId, {
      currentSet, homeSetScore, awaySetScore, setsWonHome, setsWonAway,
      servingTeam, rallyState: "serving", matchTimeSeconds,
      lastAction: null, lastActionTeam: null, lastActionPlayerId: null, lastOutcome: null, pointWinner: null,
    });
    await sleep(TICK_MS);

    // Same per-point probability the instant sim uses, so watching a match and
    // simulating it are the same event statistically. The old ratio-of-strengths
    // form here was far flatter than a rating difference should be: 70 vs 60
    // gave 0.538, where the shared model gives 0.521 per point but compounds
    // into a ~65% match — and it disagreed with the instant sim entirely.
    const winner: Side = Math.random() < pHome ? "home" : "away";
    const winnerRoster = winner === "home" ? homeRoster : awayRoster;
    const action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
    const scorer = pickPlayer(winnerRoster, action.stat);

    if (winner === "home") homeSetScore++; else awaySetScore++;
    matchTimeSeconds += SECONDS_PER_POINT;
    servingTeam = winner; // rally scoring — point winner serves next

    await writeState(matchId, {
      currentSet, homeSetScore, awaySetScore, setsWonHome, setsWonAway,
      servingTeam, rallyState: "dead_ball", matchTimeSeconds,
      lastAction: `${winner === "home" ? "Home" : "Away"} ${action.label}`,
      lastActionTeam: winner,
      lastActionPlayerId: scorer?.id ?? null,
      lastOutcome: action.label,
      pointWinner: winner,
    });
    await sleep(TICK_MS);

    if (isSetWon(homeSetScore, awaySetScore, target) || isSetWon(awaySetScore, homeSetScore, target)) {
      if (homeSetScore > awaySetScore) setsWonHome++; else setsWonAway++;

      if (setsWonHome === 2 || setsWonAway === 2) break; // match over

      // Set break
      await writeState(matchId, {
        currentSet, homeSetScore, awaySetScore, setsWonHome, setsWonAway,
        servingTeam, rallyState: "set_break", matchTimeSeconds,
        lastAction: `End of set ${currentSet}`, lastActionTeam: null, lastActionPlayerId: null,
        lastOutcome: null, pointWinner: null,
      });
      for (let i = 0; i < SET_BREAK_TICKS; i++) await sleep(TICK_MS);

      currentSet++;
      homeSetScore = 0;
      awaySetScore = 0;
    }
  }

  await finalizeTick(matchId, setsWonHome, setsWonAway, matchTimeSeconds);
  activeMatches.delete(matchId);
}

async function finalizeTick(matchId: number, setsWonHome: number, setsWonAway: number, matchTimeSeconds: number) {
  await db.update(matchLiveStateTable).set({
    rallyState: "finished",
    setsWonHome,
    setsWonAway,
    matchTimeSeconds,
    updatedAt: new Date(),
  }).where(eq(matchLiveStateTable.matchId, matchId));
  // NOTE: matchesTable.status stays 'in_progress' and homeScore/awayScore stay
  // unset here on purpose. The frontend detects rallyState === 'finished' via
  // polling and calls POST /matches/:id/simulate with `precomputedResult:
  // { homeScore: setsWonHome, awayScore: setsWonAway }` to run the real
  // economy logic and flip status to 'completed'.
}

async function writeState(matchId: number, fields: {
  currentSet: number; homeSetScore: number; awaySetScore: number;
  setsWonHome: number; setsWonAway: number; servingTeam: Side;
  rallyState: string; matchTimeSeconds: number;
  lastAction: string | null; lastActionTeam: Side | null; lastActionPlayerId: number | null;
  lastOutcome: string | null; pointWinner: Side | null;
}) {
  await db.update(matchLiveStateTable).set({
    ...fields,
    updatedAt: new Date(),
  }).where(eq(matchLiveStateTable.matchId, matchId));
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
