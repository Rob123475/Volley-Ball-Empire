/**
 * R-61 — a real Olympic tournament, the Empire Nations Cup (trademark cleanup,
 * 19 Oct: the name shown; keys and tables keep "olympic").
 *
 * Rob's decisions (15 Sep): the Cup is played in years divisible by 4 (2028 for a
 * career that starts in 2026), at the end of the World Tour and before the World
 * Finals. The 12 nations qualified under R-46 (this season's World Tour ranking
 * points, summed across a nation's players) play on the same match engine as
 * every World Tour match:
 *
 *   field      the first 12 nations in qualifying order that can field a pair. A
 *              nation's pair is its two highest-rated fit players at ANY club — the
 *              60 AI pool clubs and the player's club — never a free agent, never an
 *              injured player (R-50), never an invented one. A qualified nation that
 *              cannot field two gives its place to the next nation that can, and is
 *              recorded as passed over. 1.1.3: the nation the player coaches plays
 *              the pair he picked on the National Team page, if both are still fit
 *              (utils/nationalCoach.ts), with his pre-Cup camp's effect.
 *   groups     4 groups of 3, drawn serpentine by qualifying seed (A B C D D C B A A
 *              B C D); each group a round robin — 12 matches.
 *   knockout   the top two of each group: quarter-finals A1–C2, B1–D2, A2–C1, B2–D1;
 *              semi-finals QF1–QF2 and QF3–QF4; a bronze match for the losing
 *              semi-finalists and the gold match — 8 matches.
 *   engine     sideRating of each pair, pointProbability with no home advantage,
 *              simulateMatch — exactly what the World Tour plays.
 *   honours    a medal row for every medallist; a trophy for the player's club for
 *              each medal one of its players won, and an appearance when one of
 *              them played; a medal added to that player's own record.
 *
 * 1.1.3 (Rob, 23 Oct; brief A4a): PLAYED OVER DAYS. Until 1.1.2 the whole Cup
 * was played in one transaction when the last World Tour fixture was decided,
 * so nothing could be watched. Now:
 *
 *   draw       at the end of the last regular World Tour round's day (round 70),
 *              once every regular fixture is decided: the field, the pairs, the
 *              group draw, and the group day's 12 fixtures (nations_cup_fixtures).
 *   days       NATIONS_CUP_DAYS (lib/db schema/national-coach.ts): group day,
 *              quarter-finals, semi-finals, medal day, the days after round 70.
 *              Each stage's fixtures are made once the stage before is decided.
 *   a match    scheduled, then live while it is watched on the 3D court
 *              (routes/unity.ts ?nationsMatchId=), then decided: by the court's
 *              result, or, if not watched (or left part-way), by the engine at the
 *              end of its day (nationsCupDayTx, from the calendar's day), exactly
 *              as the one-shot Cup decided every match.
 *   results    each decided match is its olympic_matches row; medals, trophies,
 *              news and achievements read the same tables as before.
 */
import {
  db,
  sqlite,
  olympicTournamentsTable,
  olympicMatchesTable,
  olympicMedalsTable,
  nationsCupFixturesTable,
  nationsCupPrepTable,
  careerCeremoniesTable,
  careerPlayerStateTable,
  playersTable,
  continentalPoolTeamsTable,
  teamsTable,
  trophiesTable,
  worldTourFixturesTable,
  seasonsTable,
  nationName,
  NATIONS_CUP_DAYS,
  NATIONAL_CAMP,
  type OlympicFieldEntry,
  type OlympicPassedOver,
  type OlympicPlayerEntry,
  type NationsCupFixture,
} from "@workspace/db";
import { and, asc, desc, eq, lte, ne } from "drizzle-orm";
import type { CareerStateTx } from "../lib/playerDto.js";
import { aiSquadsTx } from "./aiSquads.js";
import { sideRating, pointProbability, simulateMatch, finishMatchFrom, type SetScore } from "./matchEngine.js";
import { olympicQualification, OLYMPIC_SPOTS } from "./olympicQualification.js";
import { WORLD_TOUR } from "../data/worldTour.js";
import { WORLD_TOUR_END } from "./calendarSlots.js";
import { roundToDate } from "./roundDates.js";
import { seasonNumberForYear } from "./seasonRollover.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const OLYMPIC_CYCLE = 4;
export const OLYMPIC_GROUPS = ["A", "B", "C", "D"] as const;
/** Seed index → group index. Seeds 1–12 in qualifying order. */
const SERPENTINE = [0, 1, 2, 3, 3, 2, 1, 0, 0, 1, 2, 3];

export function isOlympicYear(year: number): boolean {
  return year % OLYMPIC_CYCLE === 0;
}

export function nextOlympicsYear(fromYear: number): number {
  let y = fromYear;
  while (!isOlympicYear(y)) y++;
  return y;
}

const addDays = (date: string, days: number) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };

/** The season's dates, for the Cup's days (a season row; else the calendar's usual Jan 1 to Dec 31). */
function seasonDatesTx(tx: Tx | typeof db, careerSaveId: number | null, seasonYear: number) {
  const row = careerSaveId == null ? undefined : tx.select({ s: seasonsTable.startDate, e: seasonsTable.endDate, n: seasonsTable.totalRounds }).from(seasonsTable)
    .where(and(eq(seasonsTable.careerSaveId, careerSaveId), eq(seasonsTable.year, seasonYear))).get();
  return { start: row?.s ?? `${seasonYear}-01-01`, end: row?.e ?? `${seasonYear}-12-31`, rounds: row?.n ?? 78 };
}

export type NationsCupDays = { lastRound: string; group: string; quarter_final: string; semi_final: string; medal: string };

/** The Cup's days in a season: NATIONS_CUP_DAYS after the last regular World Tour round's day. */
export function nationsCupDays(seasonYear: number, careerSaveId: number | null = null, tx: Tx | typeof db = db): NationsCupDays {
  const s = seasonDatesTx(tx, careerSaveId, seasonYear);
  const lastRound = careerSaveId == null
    ? `${seasonYear}${WORLD_TOUR.find((e) => e.round === WORLD_TOUR_END)!.date.slice(4)}`
    : roundToDate(s.start, s.end, WORLD_TOUR_END, s.rounds);
  const day = (stage: string) => addDays(lastRound, NATIONS_CUP_DAYS.find((d) => d.stage === stage)!.daysAfterLastRound);
  return { lastRound, group: day("group"), quarter_final: day("quarter_final"), semi_final: day("semi_final"), medal: day("medal") };
}

/** The Cup's first day (its group day) in a season: what the calendar, events and pages show. */
export function olympicDate(seasonYear: number, careerSaveId: number | null = null): string {
  return nationsCupDays(seasonYear, careerSaveId).group;
}

/** Keep seasons.is_olympic_season true exactly for Olympic years. Every season row used to say false. */
export function syncOlympicSeasonFlags(): { updated: number } {
  const r = sqlite.prepare(
    `UPDATE seasons SET is_olympic_season = CASE WHEN year % ${OLYMPIC_CYCLE} = 0 THEN 1 ELSE 0 END
     WHERE is_olympic_season <> CASE WHEN year % ${OLYMPIC_CYCLE} = 0 THEN 1 ELSE 0 END`,
  ).run();
  return { updated: Number(r.changes ?? 0) };
}

// ── National players and pairs ───────────────────────────────────────────────

/** A nation's player at a club in this career, fit or not (the National Team page shows the injured too). */
export type NationalPlayer = OlympicPlayerEntry & { injured: boolean; injuryWeeks: number; fitness: number | null; fatigue: number | null };

const byRating = (a: OlympicPlayerEntry, b: OlympicPlayerEntry) =>
  b.rating - a.rating || a.name.localeCompare(b.name) || a.kind.localeCompare(b.kind) || a.id - b.id;

/** Every player of every nation at a club in this career (never a free agent), best first, injured included. */
export function nationalPlayersTx(tx: Tx, careerSaveId: number, playerTeamId: number | null): Map<string, NationalPlayer[]> {
  const nations = new Map<string, NationalPlayer[]>();
  const add = (nationality: string, p: NationalPlayer) => {
    const nation = nationName(nationality) ?? nationality;
    nations.set(nation, [...(nations.get(nation) ?? []), p]);
  };
  const condition = new Map(tx.select({ id: careerPlayerStateTable.playerId, fitness: careerPlayerStateTable.fitness, fatigue: careerPlayerStateTable.fatigue })
    .from(careerPlayerStateTable).where(eq(careerPlayerStateTable.careerSaveId, careerSaveId)).all().map((r) => [r.id, r]));

  // Every AI club's players in this career (U-6, utils/aiSquads.ts): its pool
  // players on a live contract and the seniors it has signed.
  const clubNames = new Map(tx.select({ id: continentalPoolTeamsTable.id, name: continentalPoolTeamsTable.teamName })
    .from(continentalPoolTeamsTable).all().map((t) => [t.id, t.name]));
  for (const m of [...aiSquadsTx(tx, careerSaveId).values()].flat()) {
    if (!m.nationality) continue;
    const c = m.kind === "player" ? condition.get(m.id) : undefined;
    add(m.nationality, {
      kind: m.kind, id: m.id, name: m.name, club: clubNames.get(m.poolTeamId) ?? "", teamId: null, poolTeamId: m.poolTeamId,
      rating: sideRating([m]), injured: m.injured || m.onList, injuryWeeks: m.injuryWeeks, fitness: c?.fitness ?? null, fatigue: c?.fatigue ?? null,
    });
  }

  // The player's club: contracted, not retired, not an academy junior.
  if (playerTeamId != null) {
    for (const p of tx.select({
      id: playersTable.id, name: playersTable.name, nationality: playersTable.nationality,
      playerType: playersTable.playerType, isPromoted: careerPlayerStateTable.isPromoted,
      isRetired: careerPlayerStateTable.isRetired, isInjured: careerPlayerStateTable.isInjured,
      injuryStatus: careerPlayerStateTable.injuryStatus, injuryWeeks: careerPlayerStateTable.injuryWeeksRemaining, club: teamsTable.name,
      fitness: careerPlayerStateTable.fitness, fatigue: careerPlayerStateTable.fatigue,
      speed: careerPlayerStateTable.speed, power: careerPlayerStateTable.power,
      defense: careerPlayerStateTable.defense, serve: careerPlayerStateTable.serve,
      block: careerPlayerStateTable.block, stamina: careerPlayerStateTable.stamina,
    }).from(careerPlayerStateTable)
      .innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
      .innerJoin(teamsTable, eq(teamsTable.id, careerPlayerStateTable.teamId))
      .where(and(eq(careerPlayerStateTable.careerSaveId, careerSaveId), eq(careerPlayerStateTable.teamId, playerTeamId)))
      .all()) {
      if (p.isRetired) continue;
      if (p.playerType === "youth" && !p.isPromoted) continue;
      if (p.playerType === "spare") continue;
      add(p.nationality, {
        kind: "player", id: p.id, name: p.name, club: p.club, teamId: playerTeamId, poolTeamId: null,
        rating: sideRating([p]), injured: !!p.isInjured || p.injuryStatus !== "Healthy", injuryWeeks: Number(p.injuryWeeks ?? 0),
        fitness: p.fitness, fatigue: p.fatigue,
      });
    }
  }
  for (const l of nations.values()) l.sort(byRating);
  return nations;
}

export type NationalPair = {
  nation: string;
  /** Real contracted players of this nation, at any club, fit to play. */
  eligible: number;
  /** The two highest-rated of them (fewer when the nation has fewer). */
  pair: OlympicPlayerEntry[];
};

const entryOf = (p: NationalPlayer): OlympicPlayerEntry =>
  ({ kind: p.kind, id: p.id, name: p.name, club: p.club, teamId: p.teamId, poolTeamId: p.poolTeamId, rating: p.rating });

export function nationalPairsTx(tx: Tx, careerSaveId: number, playerTeamId: number | null): NationalPair[] {
  return [...nationalPlayersTx(tx, careerSaveId, playerTeamId)]
    .map(([nation, players]) => {
      const fit = players.filter((p) => !p.injured);
      return { nation, eligible: fit.length, pair: fit.slice(0, 2).map(entryOf) };
    })
    .sort((a, b) => a.nation.localeCompare(b.nation));
}

/** A nation's chosen pair, when both are still fit players of it at a club; null otherwise (the best two play). */
function chosenPair(players: NationalPlayer[] | undefined, chosen: Array<{ kind: string; id: number }> | null | undefined): OlympicPlayerEntry[] | null {
  if (!players || !chosen || chosen.length !== 2) return null;
  const found = chosen.map((c) => players.find((p) => p.kind === c.kind && p.id === c.id && !p.injured));
  return found.every(Boolean) ? found.map((p) => entryOf(p!)) : null;
}

/** The 12 nations in qualifying order that can field a pair, and the qualified nations passed over. */
export function olympicFieldTx(
  tx: Tx, careerSaveId: number, seasonYear: number, playerTeamId: number | null,
  picked?: { nation: string; pair: Array<{ kind: string; id: number }> | null },
): { field: OlympicFieldEntry[]; passedOver: OlympicPassedOver[]; pickedUsed: boolean } {
  const players = nationalPlayersTx(tx, careerSaveId, playerTeamId);
  const field: OlympicFieldEntry[] = [];
  const passedOver: OlympicPassedOver[] = [];
  let pickedUsed = false;
  for (const c of olympicQualification(careerSaveId, seasonYear).countries) {
    if (field.length === OLYMPIC_SPOTS) break;
    const fit = (players.get(c.country) ?? []).filter((p) => !p.injured);
    if (fit.length < 2) {
      passedOver.push({ nation: c.country, qualifyingRank: c.rank, eligible: fit.length });
      continue;
    }
    const mine = picked && picked.nation === c.country ? chosenPair(players.get(c.country), picked.pair) : null;
    if (mine) pickedUsed = true;
    const pair = mine ?? fit.slice(0, 2).map(entryOf);
    field.push({
      seed: field.length + 1, nation: c.country, points: c.points, qualifyingRank: c.rank,
      rating: (pair[0]!.rating + pair[1]!.rating) / 2,
      pair,
    });
  }
  return { field, passedOver, pickedUsed };
}

// ── Standings ────────────────────────────────────────────────────────────────

type PlayedMatch = { homeNation: string; awayNation: string; homeSets: number; awaySets: number; sets: SetScore[]; winnerNation: string };

export type GroupStanding = {
  nation: string; seed: number;
  played: number; won: number; lost: number;
  setsFor: number; setsAgainst: number; pointsFor: number; pointsAgainst: number;
};

/** A group's table: wins, then set difference, then point difference, then seed. */
export function groupStandings(entries: OlympicFieldEntry[], matches: PlayedMatch[]): GroupStanding[] {
  const rows = new Map(entries.map((e) => [e.nation, {
    nation: e.nation, seed: e.seed,
    played: 0, won: 0, lost: 0, setsFor: 0, setsAgainst: 0, pointsFor: 0, pointsAgainst: 0,
  }]));
  for (const m of matches) {
    const home = rows.get(m.homeNation), away = rows.get(m.awayNation);
    if (!home || !away) continue;
    const homePts = m.sets.reduce((s, x) => s + x.home, 0);
    const awayPts = m.sets.reduce((s, x) => s + x.away, 0);
    home.played++; away.played++;
    home.setsFor += m.homeSets; home.setsAgainst += m.awaySets;
    away.setsFor += m.awaySets; away.setsAgainst += m.homeSets;
    home.pointsFor += homePts; home.pointsAgainst += awayPts;
    away.pointsFor += awayPts; away.pointsAgainst += homePts;
    if (m.winnerNation === m.homeNation) { home.won++; away.lost++; } else { away.won++; home.lost++; }
  }
  return [...rows.values()].sort((a, b) =>
    b.won - a.won
    || (b.setsFor - b.setsAgainst) - (a.setsFor - a.setsAgainst)
    || (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst)
    || a.seed - b.seed);
}

export function groupOf(seed: number): (typeof OLYMPIC_GROUPS)[number] {
  return OLYMPIC_GROUPS[SERPENTINE[seed - 1]!]!;
}

// ── The draw ─────────────────────────────────────────────────────────────────

function regularWorldTourDecidedTx(tx: Tx, careerSaveId: number, seasonYear: number): boolean {
  const scope = and(
    eq(worldTourFixturesTable.careerSaveId, careerSaveId),
    eq(worldTourFixturesTable.seasonYear, seasonYear),
    lte(worldTourFixturesTable.round, WORLD_TOUR_END),
  );
  const drawn = tx.select({ id: worldTourFixturesTable.id }).from(worldTourFixturesTable).where(scope).limit(1).get();
  if (!drawn) return false;
  const open = tx.select({ id: worldTourFixturesTable.id }).from(worldTourFixturesTable)
    .where(and(scope, eq(worldTourFixturesTable.status, "scheduled"))).limit(1).get();
  return !open;
}

function tournamentTx(tx: Tx, careerSaveId: number, seasonYear: number) {
  return tx.select().from(olympicTournamentsTable)
    .where(and(eq(olympicTournamentsTable.careerSaveId, careerSaveId), eq(olympicTournamentsTable.seasonYear, seasonYear))).get() ?? null;
}

function fixturesTx(tx: Tx, tournamentId: number): NationsCupFixture[] {
  return tx.select().from(nationsCupFixturesTable).where(eq(nationsCupFixturesTable.tournamentId, tournamentId))
    .orderBy(asc(nationsCupFixturesTable.id)).all();
}

export type NationsCupDraw = { seasonYear: number; nations: number; pickedUsed: boolean; coached: string | null };

/**
 * Draw this season's Cup if it is due: a Cup year, not drawn yet, `today` at or after the
 * last regular World Tour round's day, every regular World Tour fixture decided, and 12
 * nations able to field a pair. The nation the player coaches (`coached`) plays his picked
 * pair and his camp (nations_cup_prep), applied here. Makes the group day's fixtures.
 */
export function drawNationsCupTx(w: CareerStateTx, careerSaveId: number, seasonYear: number, playerTeamId: number | null, today: string,
  coached: string | null): NationsCupDraw | null {
  const tx = w.tx;
  if (!isOlympicYear(seasonYear)) return null;
  if (tournamentTx(tx, careerSaveId, seasonYear)) return null;
  const days = nationsCupDays(seasonYear, careerSaveId, tx);
  if (today < days.lastRound) return null;
  if (!regularWorldTourDecidedTx(tx, careerSaveId, seasonYear)) return null;

  const prep = coached == null ? undefined : tx.select().from(nationsCupPrepTable)
    .where(and(eq(nationsCupPrepTable.careerSaveId, careerSaveId), eq(nationsCupPrepTable.seasonYear, seasonYear), eq(nationsCupPrepTable.nation, coached))).get();
  const { field, passedOver, pickedUsed } = olympicFieldTx(tx, careerSaveId, seasonYear, playerTeamId,
    coached ? { nation: coached, pair: prep?.pair ?? null } : undefined);
  if (field.length < OLYMPIC_SPOTS) return null;

  // His pre-Cup camp (NATIONAL_CAMP): training, the pair plays a little better and comes out more tired;
  // recovery, it starts the Cup fresh. Only his nation's pair, only for the Cup.
  if (coached && prep?.camp) {
    const entry = field.find((e) => e.nation === coached);
    if (entry) {
      for (const p of entry.pair.filter((x) => x.kind === "player")) {
        const st = tx.select({ fitness: careerPlayerStateTable.fitness, fatigue: careerPlayerStateTable.fatigue }).from(careerPlayerStateTable)
          .where(and(eq(careerPlayerStateTable.careerSaveId, careerSaveId), eq(careerPlayerStateTable.playerId, p.id))).get();
        if (!st) continue;
        w.setPlayerState(careerSaveId, p.id, prep.camp === "training"
          ? { fatigue: Math.min(100, Number(st.fatigue ?? 0) + NATIONAL_CAMP.trainingFatigue) }
          : { fitness: NATIONAL_CAMP.recoveryFitness, fatigue: 0 });
      }
      if (prep.camp === "training") entry.rating += NATIONAL_CAMP.trainingBonus;
    }
  }
  if (prep) tx.update(nationsCupPrepTable).set({ appliedOn: today }).where(eq(nationsCupPrepTable.id, prep.id)).run();

  const tournament = tx.insert(olympicTournamentsTable)
    .values({ careerSaveId, seasonYear, playedOn: days.group, field, passedOver })
    .returning().get();
  for (const g of OLYMPIC_GROUPS) {
    const entries = field.filter((e) => groupOf(e.seed) === g);
    ([[0, 1], [0, 2], [1, 2]] as const).forEach(([a, b], i) => tx.insert(nationsCupFixturesTable).values({
      careerSaveId, tournamentId: tournament.id, seasonYear, stage: "group", label: `${g}${i + 1}`, groupName: g,
      homeNation: entries[a]!.nation, awayNation: entries[b]!.nation, scheduledOn: days.group,
    }).run());
  }
  return { seasonYear, nations: field.length, pickedUsed, coached };
}

// ── Deciding a match ─────────────────────────────────────────────────────────

function fieldRatingTx(tx: Tx, tournamentId: number) {
  const t = tx.select({ field: olympicTournamentsTable.field }).from(olympicTournamentsTable).where(eq(olympicTournamentsTable.id, tournamentId)).get();
  return (nation: string) => t?.field.find((e) => e.nation === nation)?.rating ?? 60;
}

/** The per-point chance the home pair wins a point in this fixture (no home advantage), as the engine plays it. */
export function fixturePointChanceTx(tx: Tx, f: NationsCupFixture): number {
  const rating = fieldRatingTx(tx, f.tournamentId);
  return pointProbability(rating(f.homeNation), rating(f.awayNation), { homeAdvantage: false });
}

/** Decide one fixture: its olympic_matches row, and the fixture marked decided (by the court or the engine). */
export function decideNationsCupFixtureTx(tx: Tx, f: NationsCupFixture, result: { homeSets: number; awaySets: number; sets: SetScore[] }, by: "court" | "engine"): void {
  const rating = fieldRatingTx(tx, f.tournamentId);
  const winnerNation = result.homeSets > result.awaySets ? f.homeNation : f.awayNation;
  const row = tx.insert(olympicMatchesTable).values({
    tournamentId: f.tournamentId, careerSaveId: f.careerSaveId, seasonYear: f.seasonYear,
    stage: f.stage, label: f.label, groupName: f.groupName,
    homeNation: f.homeNation, awayNation: f.awayNation, homeRating: rating(f.homeNation), awayRating: rating(f.awayNation),
    homeSets: result.homeSets, awaySets: result.awaySets, sets: result.sets, winnerNation, playedOn: f.scheduledOn,
  }).returning().get();
  tx.update(nationsCupFixturesTable).set({ status: "decided", matchId: row.id, decidedBy: by, progress: null })
    .where(eq(nationsCupFixturesTable.id, f.id)).run();
}

/** The engine's result for a fixture: from the court's last score when it was left part-way, else from 0-0. */
function engineResultTx(tx: Tx, f: NationsCupFixture) {
  const p = fixturePointChanceTx(tx, f);
  const r = f.progress ? finishMatchFrom(p, f.progress.sets, f.progress.current) : simulateMatch(p);
  return { homeSets: r.homeScore, awaySets: r.awayScore, sets: r.sets };
}

type Played = { f: NationsCupFixture; m: typeof olympicMatchesTable.$inferSelect };

/**
 * After a fixture is decided: make the next stage's fixtures once a stage is all decided
 * (quarter-finals from the group tables, semi-finals from the quarter-finals, bronze and
 * gold from the semi-finals), and finish the Cup once both medal matches are decided.
 */
export function advanceNationsCupTx(w: CareerStateTx, careerSaveId: number, seasonYear: number, playerTeamId: number | null, today: string): { finished: boolean } {
  const tx = w.tx;
  const t = tournamentTx(tx, careerSaveId, seasonYear);
  if (!t) return { finished: false };
  const days = nationsCupDays(seasonYear, careerSaveId, tx);
  const all = fixturesTx(tx, t.id);
  const matches = new Map(tx.select().from(olympicMatchesTable).where(eq(olympicMatchesTable.tournamentId, t.id)).all().map((m) => [m.id, m]));
  const played = (stage: string): Played[] | null => {
    const of = all.filter((f) => f.stage === stage);
    if (of.length === 0 || of.some((f) => f.status !== "decided" || f.matchId == null)) return null;
    return of.map((f) => ({ f, m: matches.get(f.matchId!)! }));
  };
  const has = (stage: string) => all.some((f) => f.stage === stage);
  const entry = (nation: string) => t.field.find((e) => e.nation === nation)!;
  const make = (stage: string, label: string, home: string, away: string, on: string) => tx.insert(nationsCupFixturesTable).values({
    careerSaveId, tournamentId: t.id, seasonYear, stage, label, groupName: null, homeNation: home, awayNation: away, scheduledOn: on,
  }).run();
  const winner = (p: Played) => p.m.winnerNation;
  const loser = (p: Played) => (p.m.winnerNation === p.m.homeNation ? p.m.awayNation : p.m.homeNation);

  const groups = played("group");
  if (groups && !has("quarter_final")) {
    const topTwo = OLYMPIC_GROUPS.map((g) => {
      const entries = t.field.filter((e) => groupOf(e.seed) === g);
      return groupStandings(entries, groups.filter((p) => p.f.groupName === g).map((p) => p.m)).slice(0, 2).map((s) => s.nation);
    });
    const [A, B, C, D] = topTwo as [string[], string[], string[], string[]];
    [[A[0], C[1]], [B[0], D[1]], [A[1], C[0]], [B[1], D[0]]].forEach(([h, a], i) => make("quarter_final", `QF${i + 1}`, h!, a!, days.quarter_final));
  }
  const qf = played("quarter_final");
  if (qf && !has("semi_final")) {
    const byLabel = (l: string) => qf.find((p) => p.f.label === l)!;
    make("semi_final", "SF1", winner(byLabel("QF1")), winner(byLabel("QF2")), days.semi_final);
    make("semi_final", "SF2", winner(byLabel("QF3")), winner(byLabel("QF4")), days.semi_final);
  }
  const sf = played("semi_final");
  if (sf && !has("gold")) {
    const byLabel = (l: string) => sf.find((p) => p.f.label === l)!;
    make("bronze", "Bronze", loser(byLabel("SF1")), loser(byLabel("SF2")), days.medal);
    make("gold", "Gold", winner(byLabel("SF1")), winner(byLabel("SF2")), days.medal);
  }
  const gold = played("gold"), bronze = played("bronze");
  if (!gold || !bronze) return { finished: false };
  if (tx.select({ id: olympicMedalsTable.id }).from(olympicMedalsTable).where(eq(olympicMedalsTable.tournamentId, t.id)).limit(1).get()) return { finished: false };

  // The medals, trophies and honours, exactly as the one-shot Cup gave them.
  const medals: Array<["gold" | "silver" | "bronze", OlympicFieldEntry]> = [
    ["gold", entry(winner(gold[0]!))], ["silver", entry(loser(gold[0]!))], ["bronze", entry(winner(bronze[0]!))],
  ];
  const season = seasonNumberForYear(seasonYear);
  const title = (m: string) => m[0]!.toUpperCase() + m.slice(1);
  for (const [medal, e] of medals) {
    for (const p of e.pair) {
      tx.insert(olympicMedalsTable).values({
        tournamentId: t.id, careerSaveId, seasonYear, medal, nation: e.nation,
        playerKind: p.kind, playerId: p.kind === "player" ? p.id : null, poolPlayerId: p.kind === "pool" ? p.id : null,
        playerName: p.name, clubName: p.club, teamId: p.teamId, poolTeamId: p.poolTeamId,
      }).run();
      if (p.kind === "player") {
        const state = tx.select({ count: careerPlayerStateTable.olympicMedalsCount }).from(careerPlayerStateTable)
          .where(and(eq(careerPlayerStateTable.careerSaveId, careerSaveId), eq(careerPlayerStateTable.playerId, p.id))).get();
        if (state) w.setPlayerState(careerSaveId, p.id, { olympicMedalsCount: (state.count ?? 0) + 1 });
      }
    }
    const ours = playerTeamId == null ? [] : e.pair.filter((p) => p.kind === "player" && p.teamId === playerTeamId);
    if (ours.length > 0) {
      tx.insert(trophiesTable).values({
        teamId: playerTeamId!, type: `olympic_${medal}`, year: seasonYear, season,
        name: `Nations Cup ${title(medal)} ${seasonYear} — ${e.nation}`,
        notes: `${ours.map((p) => p.name).join(" & ")} for ${e.nation}`,
      }).run();
    }
  }
  const appearing = playerTeamId == null ? [] : t.field.flatMap((e) =>
    e.pair.filter((p) => p.kind === "player" && p.teamId === playerTeamId).map((p) => `${p.name} (${e.nation})`));
  if (appearing.length > 0) {
    tx.insert(trophiesTable).values({
      teamId: playerTeamId!, type: "olympic_appearance", year: seasonYear, season,
      name: `Empire Nations Cup ${seasonYear}`, notes: appearing.join(", "),
    }).run();
  }
  // A5: the podium plays every time (the dashboard opens it).
  tx.insert(careerCeremoniesTable).values({ careerSaveId, event: "nations_cup", seasonYear, readyOn: today }).onConflictDoNothing().run();
  return { finished: true };
}

/**
 * The calendar's day (routes/calendar.ts, at the end of `today`): draw the Cup when it is
 * due, decide by the engine every fixture of today (and any day before) not decided on
 * the court, and move the Cup on. Returns Club News lines for the day.
 */
export function nationsCupDayTx(w: CareerStateTx, careerSaveId: number, seasonYear: number, playerTeamId: number | null, today: string, coached: string | null): string[] {
  const tx = w.tx;
  const events: string[] = [];
  const draw = drawNationsCupTx(w, careerSaveId, seasonYear, playerTeamId, today, coached);
  if (draw) events.push(`Empire Nations Cup ${seasonYear}: the draw is made, 12 nations play from ${nationsCupDays(seasonYear, careerSaveId, tx).group}`);
  const t = tournamentTx(tx, careerSaveId, seasonYear);
  if (!t) return events;
  // A stage decided on the court during the day may already have made the next one: loop until nothing is due.
  for (let guard = 0; guard < 6; guard++) {
    const due = fixturesTx(tx, t.id).filter((f) => f.status !== "decided" && f.scheduledOn <= today);
    for (const f of due) decideNationsCupFixtureTx(tx, f, engineResultTx(tx, f), "engine");
    const { finished } = advanceNationsCupTx(w, careerSaveId, seasonYear, playerTeamId, today);
    if (finished) { events.push(`Empire Nations Cup ${seasonYear}: the medals are decided`); break; }
    if (due.length === 0) break;
  }
  return events;
}

/** The Cup fixtures on a day (the dashboard's and the schedule's Watch buttons). */
export function nationsCupFixturesOnTx(tx: Tx, careerSaveId: number, day: string): NationsCupFixture[] {
  return tx.select().from(nationsCupFixturesTable)
    .where(and(eq(nationsCupFixturesTable.careerSaveId, careerSaveId), eq(nationsCupFixturesTable.scheduledOn, day)))
    .orderBy(asc(nationsCupFixturesTable.id)).all();
}

export function nationsCupFixtureTx(tx: Tx, careerSaveId: number, id: number): NationsCupFixture | null {
  return tx.select().from(nationsCupFixturesTable)
    .where(and(eq(nationsCupFixturesTable.careerSaveId, careerSaveId), eq(nationsCupFixturesTable.id, id))).get() ?? null;
}

/** A fixture's two pairs (from the Cup's field). */
export function fixturePairsTx(tx: Tx, f: NationsCupFixture): { home: OlympicFieldEntry | null; away: OlympicFieldEntry | null } {
  const t = tx.select({ field: olympicTournamentsTable.field }).from(olympicTournamentsTable).where(eq(olympicTournamentsTable.id, f.tournamentId)).get();
  return { home: t?.field.find((e) => e.nation === f.homeNation) ?? null, away: t?.field.find((e) => e.nation === f.awayNation) ?? null };
}

/** The Cup fixtures of this career not yet decided. */
export function openNationsCupFixturesTx(tx: Tx, careerSaveId: number): NationsCupFixture[] {
  return tx.select().from(nationsCupFixturesTable)
    .where(and(eq(nationsCupFixturesTable.careerSaveId, careerSaveId), ne(nationsCupFixturesTable.status, "decided"))).all();
}

// ── Reading it back ──────────────────────────────────────────────────────────

export type OlympicSide = { nation: string; seed: number };
export type OlympicMatchView = {
  id: number; stage: string; label: string; groupName: string | null;
  home: OlympicSide; away: OlympicSide;
  homeSets: number; awaySets: number; sets: SetScore[]; winner: string;
};
export type OlympicTournamentView = {
  seasonYear: number;
  playedOn: string;
  field: OlympicFieldEntry[];
  passedOver: OlympicPassedOver[];
  groups: Array<{ name: string; standings: GroupStanding[]; matches: OlympicMatchView[] }>;
  knockout: { quarterFinals: OlympicMatchView[]; semiFinals: OlympicMatchView[]; bronze: OlympicMatchView; gold: OlympicMatchView };
  medals: Record<"gold" | "silver" | "bronze", OlympicFieldEntry>;
};

/** A finished Cup (its gold and bronze decided), or null: Club News and the medals read only finished ones. */
export function olympicTournament(careerSaveId: number, seasonYear: number): OlympicTournamentView | null {
  const t = db.select().from(olympicTournamentsTable)
    .where(and(eq(olympicTournamentsTable.careerSaveId, careerSaveId), eq(olympicTournamentsTable.seasonYear, seasonYear)))
    .get();
  if (!t) return null;
  const rows = db.select().from(olympicMatchesTable)
    .where(eq(olympicMatchesTable.tournamentId, t.id)).orderBy(asc(olympicMatchesTable.id)).all();
  const field = t.field;
  const byNation = new Map(field.map((e) => [e.nation, e]));
  const side = (nation: string): OlympicSide => ({ nation, seed: byNation.get(nation)?.seed ?? 0 });
  const view = (m: typeof rows[number]): OlympicMatchView => ({
    id: m.id, stage: m.stage, label: m.label, groupName: m.groupName,
    home: side(m.homeNation), away: side(m.awayNation),
    homeSets: m.homeSets, awaySets: m.awaySets, sets: m.sets, winner: m.winnerNation,
  });
  const stage = (s: string) => rows.filter((r) => r.stage === s).map(view);
  const gold = stage("gold")[0];
  const bronze = stage("bronze")[0];
  if (!gold || !bronze) return null;
  const loserOf = (m: OlympicMatchView) => (m.winner === m.home.nation ? m.away.nation : m.home.nation);

  return {
    seasonYear: t.seasonYear,
    playedOn: t.playedOn,
    field,
    passedOver: t.passedOver,
    groups: OLYMPIC_GROUPS.map((g) => {
      const matches = rows.filter((r) => r.stage === "group" && r.groupName === g);
      return {
        name: g,
        standings: groupStandings(field.filter((e) => groupOf(e.seed) === g), matches),
        matches: matches.map(view),
      };
    }),
    knockout: { quarterFinals: stage("quarter_final"), semiFinals: stage("semi_final"), bronze, gold },
    medals: {
      gold: byNation.get(gold.winner)!,
      silver: byNation.get(loserOf(gold))!,
      bronze: byNation.get(bronze.winner)!,
    },
  };
}

/** Season years this career has finished a Cup in, newest first. */
export function olympicYearsPlayed(careerSaveId: number): number[] {
  const years = db.select({ year: olympicTournamentsTable.seasonYear }).from(olympicTournamentsTable)
    .where(eq(olympicTournamentsTable.careerSaveId, careerSaveId))
    .orderBy(desc(olympicTournamentsTable.seasonYear)).all().map((r) => r.year);
  return years.filter((y) => olympicTournament(careerSaveId, y) != null);
}

export type NationsCupFixtureView = {
  id: number; stage: string; label: string; groupName: string | null; scheduledOn: string;
  status: "scheduled" | "live" | "decided"; decidedBy: string | null;
  home: { nation: string; seed: number; pair: OlympicPlayerEntry[] };
  away: { nation: string; seed: number; pair: OlympicPlayerEntry[] };
  result: { homeSets: number; awaySets: number; sets: SetScore[]; winner: string } | null;
  /** Today's and not decided: it may be watched on the 3D court. */
  watchable: boolean;
  /** The nation the player coaches plays in it: he may play it in Manual. */
  yourNation: boolean;
};

/** The Cup as it stands, day by day, for the schedule page and the dashboard. */
export function nationsCupView(careerSaveId: number, seasonYear: number, today: string, coached: string | null) {
  const t = db.select().from(olympicTournamentsTable)
    .where(and(eq(olympicTournamentsTable.careerSaveId, careerSaveId), eq(olympicTournamentsTable.seasonYear, seasonYear))).get();
  const days = nationsCupDays(seasonYear, careerSaveId);
  if (!t) return { seasonYear, drawn: false, days, field: [], passedOver: [], schedule: [], groups: [], medals: null, finished: false };
  const fixtures = db.transaction((tx) => fixturesTx(tx, t.id));
  const matches = new Map(db.select().from(olympicMatchesTable).where(eq(olympicMatchesTable.tournamentId, t.id)).all().map((m) => [m.id, m]));
  const byNation = new Map(t.field.map((e) => [e.nation, e]));
  const side = (n: string) => ({ nation: n, seed: byNation.get(n)?.seed ?? 0, pair: byNation.get(n)?.pair ?? [] });
  const view = (f: NationsCupFixture): NationsCupFixtureView => {
    const m = f.matchId != null ? matches.get(f.matchId) : undefined;
    return {
      id: f.id, stage: f.stage, label: f.label, groupName: f.groupName, scheduledOn: f.scheduledOn,
      status: f.status as NationsCupFixtureView["status"], decidedBy: f.decidedBy,
      home: side(f.homeNation), away: side(f.awayNation),
      result: m ? { homeSets: m.homeSets, awaySets: m.awaySets, sets: m.sets, winner: m.winnerNation } : null,
      watchable: f.status !== "decided" && f.scheduledOn === today,
      yourNation: coached != null && (f.homeNation === coached || f.awayNation === coached),
    };
  };
  const labelOf = (date: string) => NATIONS_CUP_DAYS.find((d) => days[d.stage] === date)?.label ?? "";
  const dates = [...new Set([days.group, days.quarter_final, days.semi_final, days.medal])];
  const decided = fixtures.filter((f) => f.status === "decided" && f.matchId != null).map((f) => matches.get(f.matchId!)!).filter(Boolean);
  const finished = olympicTournament(careerSaveId, seasonYear);
  return {
    seasonYear, drawn: true, days, field: t.field, passedOver: t.passedOver,
    schedule: dates.map((date) => ({ date, label: labelOf(date), fixtures: fixtures.filter((f) => f.scheduledOn === date).map(view) })),
    groups: OLYMPIC_GROUPS.map((g) => ({
      name: g, standings: groupStandings(t.field.filter((e) => groupOf(e.seed) === g), decided.filter((m) => m.stage === "group" && m.groupName === g)),
    })),
    medals: finished?.medals ?? null,
    finished: finished != null,
  };
}
