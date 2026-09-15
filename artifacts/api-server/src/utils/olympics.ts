/**
 * R-61 — a real Olympic tournament.
 *
 * Rob's decisions (15 Sep): the Olympics are played in OLYMPIC YEARS only (years
 * divisible by 4 — 2028 for a career that starts in 2026), at the end of the World
 * Tour and before the World Finals. The 12 nations qualified under R-46 (this
 * season's World Tour ranking points, summed across a nation's players) play a real
 * event on the same match engine as every World Tour match:
 *
 *   field      the first 12 nations in qualifying order that can field a pair. A
 *              nation's pair is its two highest-rated players at ANY club — the 60
 *              AI pool clubs and the player's club — never a free agent, never an
 *              injured player (R-50), never an invented one. A qualified nation that
 *              cannot field two gives its place to the next nation that can, and is
 *              recorded as passed over.
 *   groups     4 groups of 3, drawn serpentine by qualifying seed (A B C D D C B A A
 *              B C D); each group a round robin — 12 matches.
 *   knockout   the top two of each group: quarter-finals A1–C2, B1–D2, A2–C1, B2–D1;
 *              semi-finals QF1–QF2 and QF3–QF4; a bronze match for the losing
 *              semi-finalists and the gold match — 8 matches. (The brief's harness
 *              line said 16; 4 + 2 + 1 + 1 is what this format plays.)
 *   engine     sideRating of each pair, pointProbability with no home advantage,
 *              simulateMatch — exactly what the World Tour plays.
 *   when       once every regular World Tour fixture is decided, inside the same
 *              transaction and BEFORE the semi-finals are seeded, so qualifying uses
 *              the season's regular World Tour points. Dated between round 70 and
 *              the World Finals' first day.
 *   honours    a medal row for every medallist; a trophy for the player's club for
 *              each medal one of its players won, and an appearance when one of
 *              them played; a medal added to that player's own record.
 *
 * It replaced a schedule endpoint that drew a projected bracket and, in an Olympic
 * year, filled in scores it re-rolled on every read (R-43 removed the scores; this
 * removes the draw), and a "national coach" selection where the manager picked a
 * three-player squad including invented wildcard players.
 */
import {
  db,
  sqlite,
  olympicTournamentsTable,
  olympicMatchesTable,
  olympicMedalsTable,
  careerPlayerStateTable,
  playersTable,
  continentalPoolPlayersTable,
  continentalPoolTeamsTable,
  teamsTable,
  trophiesTable,
  worldTourFixturesTable,
  nationName,
  countryFlag,
  type OlympicFieldEntry,
  type OlympicPassedOver,
  type OlympicPlayerEntry,
} from "@workspace/db";
import { and, asc, desc, eq, lte } from "drizzle-orm";
import { sideRating, pointProbability, simulateMatch, type SetScore } from "./matchEngine.js";
import { olympicQualification, OLYMPIC_SPOTS } from "./olympicQualification.js";
import { WORLD_TOUR } from "../data/worldTour.js";
import { WORLD_TOUR_END, FINALS_START } from "./calendarSlots.js";
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

/** The day between World Tour round 70 and the World Finals' first day, in that season's year. */
export function olympicDate(seasonYear: number): string {
  const last = WORLD_TOUR.find((e) => e.round === WORLD_TOUR_END)!.date;
  const finals = WORLD_TOUR.find((e) => e.round === FINALS_START)!.date;
  const mid = new Date((Date.parse(`${last}T00:00:00Z`) + Date.parse(`${finals}T00:00:00Z`)) / 2)
    .toISOString().slice(0, 10);
  return `${seasonYear}${mid.slice(4)}`;
}

/** Keep seasons.is_olympic_season true exactly for Olympic years. Every season row used to say false. */
export function syncOlympicSeasonFlags(): { updated: number } {
  const r = sqlite.prepare(
    `UPDATE seasons SET is_olympic_season = CASE WHEN year % ${OLYMPIC_CYCLE} = 0 THEN 1 ELSE 0 END
     WHERE is_olympic_season <> CASE WHEN year % ${OLYMPIC_CYCLE} = 0 THEN 1 ELSE 0 END`,
  ).run();
  return { updated: Number(r.changes ?? 0) };
}

// ── National pairs ───────────────────────────────────────────────────────────

export type NationalPair = {
  nation: string;
  flag: string;
  /** Real contracted players of this nation, at any club, fit to play. */
  eligible: number;
  /** The two highest-rated of them (fewer when the nation has fewer). */
  pair: OlympicPlayerEntry[];
};

const byRating = (a: OlympicPlayerEntry, b: OlympicPlayerEntry) =>
  b.rating - a.rating || a.name.localeCompare(b.name) || a.kind.localeCompare(b.kind) || a.id - b.id;

export function nationalPairsTx(tx: Tx, careerSaveId: number, playerTeamId: number): NationalPair[] {
  const nations = new Map<string, OlympicPlayerEntry[]>();
  const add = (nationality: string, p: OlympicPlayerEntry) => {
    const nation = nationName(nationality) ?? nationality;
    nations.set(nation, [...(nations.get(nation) ?? []), p]);
  };

  // Every AI pool club's two players: always at a club, reference stats.
  for (const p of tx.select({
    id: continentalPoolPlayersTable.id, name: continentalPoolPlayersTable.name,
    nationality: continentalPoolPlayersTable.nationality, poolTeamId: continentalPoolPlayersTable.poolTeamId,
    club: continentalPoolTeamsTable.teamName,
    speed: continentalPoolPlayersTable.speed, power: continentalPoolPlayersTable.power,
    defense: continentalPoolPlayersTable.defense, serve: continentalPoolPlayersTable.serve,
    block: continentalPoolPlayersTable.block, stamina: continentalPoolPlayersTable.stamina,
  }).from(continentalPoolPlayersTable)
    .innerJoin(continentalPoolTeamsTable, eq(continentalPoolTeamsTable.id, continentalPoolPlayersTable.poolTeamId))
    .all()) {
    if (!p.nationality) continue;
    add(p.nationality, {
      kind: "pool", id: p.id, name: p.name, club: p.club, teamId: null, poolTeamId: p.poolTeamId,
      rating: sideRating([p]),
    });
  }

  // The player's club: contracted, not retired, not an academy junior, fit to play.
  for (const p of tx.select({
    id: playersTable.id, name: playersTable.name, nationality: playersTable.nationality,
    playerType: playersTable.playerType, isPromoted: careerPlayerStateTable.isPromoted,
    isRetired: careerPlayerStateTable.isRetired, isInjured: careerPlayerStateTable.isInjured,
    injuryStatus: careerPlayerStateTable.injuryStatus, club: teamsTable.name,
    speed: careerPlayerStateTable.speed, power: careerPlayerStateTable.power,
    defense: careerPlayerStateTable.defense, serve: careerPlayerStateTable.serve,
    block: careerPlayerStateTable.block, stamina: careerPlayerStateTable.stamina,
  }).from(careerPlayerStateTable)
    .innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
    .innerJoin(teamsTable, eq(teamsTable.id, careerPlayerStateTable.teamId))
    .where(and(eq(careerPlayerStateTable.careerSaveId, careerSaveId), eq(careerPlayerStateTable.teamId, playerTeamId)))
    .all()) {
    if (p.isRetired || p.isInjured || p.injuryStatus !== "Healthy") continue;
    if (p.playerType === "youth" && !p.isPromoted) continue;
    if (p.playerType === "spare") continue;
    add(p.nationality, {
      kind: "player", id: p.id, name: p.name, club: p.club, teamId: playerTeamId, poolTeamId: null,
      rating: sideRating([p]),
    });
  }

  return [...nations]
    .map(([nation, players]) => {
      const sorted = [...players].sort(byRating);
      return { nation, flag: countryFlag(nation), eligible: sorted.length, pair: sorted.slice(0, 2) };
    })
    .sort((a, b) => a.nation.localeCompare(b.nation));
}

/** The 12 nations in qualifying order that can field a pair, and the qualified nations passed over. */
export function olympicFieldTx(
  tx: Tx, careerSaveId: number, seasonYear: number, playerTeamId: number,
): { field: OlympicFieldEntry[]; passedOver: OlympicPassedOver[] } {
  const pairs = new Map(nationalPairsTx(tx, careerSaveId, playerTeamId).map((p) => [p.nation, p]));
  const field: OlympicFieldEntry[] = [];
  const passedOver: OlympicPassedOver[] = [];
  for (const c of olympicQualification(careerSaveId, seasonYear).countries) {
    if (field.length === OLYMPIC_SPOTS) break;
    const np = pairs.get(c.country);
    if (!np || np.pair.length < 2) {
      passedOver.push({ nation: c.country, flag: c.flag, qualifyingRank: c.rank, eligible: np?.eligible ?? 0 });
      continue;
    }
    field.push({
      seed: field.length + 1, nation: c.country, flag: c.flag, points: c.points, qualifyingRank: c.rank,
      rating: (np.pair[0]!.rating + np.pair[1]!.rating) / 2,
      pair: np.pair,
    });
  }
  return { field, passedOver };
}

// ── Standings ────────────────────────────────────────────────────────────────

type PlayedMatch = { homeNation: string; awayNation: string; homeSets: number; awaySets: number; sets: SetScore[]; winnerNation: string };

export type GroupStanding = {
  nation: string; flag: string; seed: number;
  played: number; won: number; lost: number;
  setsFor: number; setsAgainst: number; pointsFor: number; pointsAgainst: number;
};

/** A group's table: wins, then set difference, then point difference, then seed. */
export function groupStandings(entries: OlympicFieldEntry[], matches: PlayedMatch[]): GroupStanding[] {
  const rows = new Map(entries.map((e) => [e.nation, {
    nation: e.nation, flag: e.flag, seed: e.seed,
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

// ── Playing it ───────────────────────────────────────────────────────────────

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

export type OlympicOutcome = {
  seasonYear: number;
  /** The player's club's medallists and their new medal counts, applied by the caller through playerDto. */
  honours: Array<{ playerId: number; olympicMedalsCount: number }>;
};

/**
 * Play this season's Olympic tournament if it is due: an Olympic year, not played
 * yet, every regular World Tour fixture decided, and 12 nations able to field a
 * pair. Returns what the caller must write to player state, or null.
 */
export function playOlympicsTx(tx: Tx, careerSaveId: number, seasonYear: number, playerTeamId: number): OlympicOutcome | null {
  if (!isOlympicYear(seasonYear)) return null;
  const existing = tx.select({ id: olympicTournamentsTable.id }).from(olympicTournamentsTable)
    .where(and(eq(olympicTournamentsTable.careerSaveId, careerSaveId), eq(olympicTournamentsTable.seasonYear, seasonYear)))
    .get();
  if (existing) return null;
  if (!regularWorldTourDecidedTx(tx, careerSaveId, seasonYear)) return null;

  const { field, passedOver } = olympicFieldTx(tx, careerSaveId, seasonYear, playerTeamId);
  if (field.length < OLYMPIC_SPOTS) return null;

  const playedOn = olympicDate(seasonYear);
  const tournament = tx.insert(olympicTournamentsTable)
    .values({ careerSaveId, seasonYear, playedOn, field, passedOver })
    .returning().get();

  const play = (stage: string, label: string, groupName: string | null, home: OlympicFieldEntry, away: OlympicFieldEntry) => {
    const result = simulateMatch(pointProbability(home.rating, away.rating, { homeAdvantage: false }));
    const winner = result.homeWon ? home : away;
    const loser = result.homeWon ? away : home;
    const row: PlayedMatch = {
      homeNation: home.nation, awayNation: away.nation,
      homeSets: result.homeScore, awaySets: result.awayScore, sets: result.sets, winnerNation: winner.nation,
    };
    tx.insert(olympicMatchesTable).values({
      tournamentId: tournament.id, careerSaveId, seasonYear, stage, label, groupName,
      homeNation: home.nation, awayNation: away.nation, homeRating: home.rating, awayRating: away.rating,
      homeSets: result.homeScore, awaySets: result.awayScore, sets: result.sets,
      winnerNation: winner.nation, playedOn,
    }).run();
    return { row, winner, loser };
  };

  const topTwo = OLYMPIC_GROUPS.map((g) => {
    const entries = field.filter((e) => groupOf(e.seed) === g);
    const played = ([[0, 1], [0, 2], [1, 2]] as const).map(([a, b], i) =>
      play("group", `${g}${i + 1}`, g, entries[a]!, entries[b]!).row);
    const table = groupStandings(entries, played);
    return table.slice(0, 2).map((s) => entries.find((e) => e.nation === s.nation)!);
  });
  const [A, B, C, D] = topTwo as [OlympicFieldEntry[], OlympicFieldEntry[], OlympicFieldEntry[], OlympicFieldEntry[]];

  const qf = ([[A[0], C[1]], [B[0], D[1]], [A[1], C[0]], [B[1], D[0]]] as Array<[OlympicFieldEntry, OlympicFieldEntry]>)
    .map(([h, a], i) => play("quarter_final", `QF${i + 1}`, null, h, a));
  const sf = ([[qf[0]!.winner, qf[1]!.winner], [qf[2]!.winner, qf[3]!.winner]] as Array<[OlympicFieldEntry, OlympicFieldEntry]>)
    .map(([h, a], i) => play("semi_final", `SF${i + 1}`, null, h, a));
  const bronze = play("bronze", "Bronze", null, sf[0]!.loser, sf[1]!.loser);
  const gold = play("gold", "Gold", null, sf[0]!.winner, sf[1]!.winner);

  const medals: Array<["gold" | "silver" | "bronze", OlympicFieldEntry]> = [
    ["gold", gold.winner], ["silver", gold.loser], ["bronze", bronze.winner],
  ];

  const honours: OlympicOutcome["honours"] = [];
  const season = seasonNumberForYear(seasonYear);
  const title = (m: string) => m[0]!.toUpperCase() + m.slice(1);

  for (const [medal, entry] of medals) {
    for (const p of entry.pair) {
      tx.insert(olympicMedalsTable).values({
        tournamentId: tournament.id, careerSaveId, seasonYear, medal, nation: entry.nation,
        playerKind: p.kind, playerId: p.kind === "player" ? p.id : null, poolPlayerId: p.kind === "pool" ? p.id : null,
        playerName: p.name, clubName: p.club, teamId: p.teamId, poolTeamId: p.poolTeamId,
      }).run();
      if (p.kind === "player") {
        const state = tx.select({ count: careerPlayerStateTable.olympicMedalsCount }).from(careerPlayerStateTable)
          .where(and(eq(careerPlayerStateTable.careerSaveId, careerSaveId), eq(careerPlayerStateTable.playerId, p.id)))
          .get();
        honours.push({ playerId: p.id, olympicMedalsCount: (state?.count ?? 0) + 1 });
      }
    }
    const ours = entry.pair.filter((p) => p.kind === "player" && p.teamId === playerTeamId);
    if (ours.length > 0) {
      tx.insert(trophiesTable).values({
        teamId: playerTeamId, type: `olympic_${medal}`, year: seasonYear, season,
        name: `Olympic ${title(medal)} ${seasonYear} — ${entry.nation}`,
        notes: `${ours.map((p) => p.name).join(" & ")} for ${entry.nation}`,
      }).run();
    }
  }

  const appearing = field.flatMap((e) =>
    e.pair.filter((p) => p.kind === "player" && p.teamId === playerTeamId).map((p) => `${p.name} (${e.nation})`));
  if (appearing.length > 0) {
    tx.insert(trophiesTable).values({
      teamId: playerTeamId, type: "olympic_appearance", year: seasonYear, season,
      name: `Olympic Games ${seasonYear}`, notes: appearing.join(", "),
    }).run();
  }

  return { seasonYear, honours };
}

// ── Reading it back ──────────────────────────────────────────────────────────

export type OlympicSide = { nation: string; flag: string; seed: number };
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

export function olympicTournament(careerSaveId: number, seasonYear: number): OlympicTournamentView | null {
  const t = db.select().from(olympicTournamentsTable)
    .where(and(eq(olympicTournamentsTable.careerSaveId, careerSaveId), eq(olympicTournamentsTable.seasonYear, seasonYear)))
    .get();
  if (!t) return null;
  const rows = db.select().from(olympicMatchesTable)
    .where(eq(olympicMatchesTable.tournamentId, t.id)).orderBy(asc(olympicMatchesTable.id)).all();
  const field = t.field;
  const byNation = new Map(field.map((e) => [e.nation, e]));
  const side = (nation: string): OlympicSide => ({ nation, flag: byNation.get(nation)?.flag ?? countryFlag(nation), seed: byNation.get(nation)?.seed ?? 0 });
  const view = (m: typeof rows[number]): OlympicMatchView => ({
    id: m.id, stage: m.stage, label: m.label, groupName: m.groupName,
    home: side(m.homeNation), away: side(m.awayNation),
    homeSets: m.homeSets, awaySets: m.awaySets, sets: m.sets, winner: m.winnerNation,
  });
  const stage = (s: string) => rows.filter((r) => r.stage === s).map(view);
  const gold = stage("gold")[0]!;
  const bronze = stage("bronze")[0]!;
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

/** Season years this career has played an Olympic tournament in, newest first. */
export function olympicYearsPlayed(careerSaveId: number): number[] {
  return db.select({ year: olympicTournamentsTable.seasonYear }).from(olympicTournamentsTable)
    .where(eq(olympicTournamentsTable.careerSaveId, careerSaveId))
    .orderBy(desc(olympicTournamentsTable.seasonYear)).all().map((r) => r.year);
}
