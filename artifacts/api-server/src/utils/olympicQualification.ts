/**
 * R-46 — Olympic qualification: national teams, on this season's World Tour
 * ranking points.
 *
 * Rob's rule (14 Sep): the Olympics are NATIONAL teams. A country qualifies on
 * the World Tour ranking points its players earned THIS SEASON — the sum across
 * that country's players, whichever club they play for. The top 12 countries
 * qualify; ties are broken by the best single-player total. Player ratings play
 * no part in qualifying.
 *
 * What it replaced: per-continent spots (Europe 3, Asia 2, ...) handed out by
 * the average rating of each nation's two best players — a table that moved
 * when a player trained and never when anyone won anything.
 *
 * Where the points come from: player_ranking_points, written by
 * creditCompetitorTx (utils/rankingPoints.ts) on every result that credits a
 * club. Same write, same points, so a player's points are exactly what their
 * club earned while they were on the sand for it.
 *
 * One nation, whatever the spelling: pool players store demonyms ("German")
 * where seniors store country names ("Germany"). nationName() resolves both to
 * one nation; a nationality it cannot resolve is kept under its own spelling
 * and flagged `resolved: false` — shown, never dropped.
 *
 * Order: points, then best single-player total, then country name. The last is
 * only there so an exact tie on both still gives one reproducible table.
 */
import {
  db,
  playerRankingPointsTable,
  playersTable,
  continentalPoolPlayersTable,
  continentalPoolTeamsTable,
  competitorsTable,
  teamsTable,
  nationName,
  countryFlag,
  continentKeyForNationality,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";

export const OLYMPIC_SPOTS = 12;

export type QualifyingPlayer = {
  kind: "player" | "pool";
  id: number;
  name: string;
  /** As stored — a country name or a demonym. */
  nationality: string;
  /** Every club this player earned points for this season. */
  clubs: string[];
  points: number;
  matches: number;
};

export type QualifyingCountry = {
  rank: number;
  country: string;
  flag: string;
  continent: ReturnType<typeof continentKeyForNationality>;
  points: number;
  bestPlayerPoints: number;
  qualified: boolean;
  /** False when a player's nationality is not a known nation (kept visible). */
  resolved: boolean;
  players: QualifyingPlayer[];
};

export function olympicQualification(careerSaveId: number, seasonYear: number): {
  seasonYear: number;
  spots: number;
  countries: QualifyingCountry[];
} {
  const rows = db.select({
    playerId:          playerRankingPointsTable.playerId,
    poolPlayerId:      playerRankingPointsTable.poolPlayerId,
    points:            playerRankingPointsTable.rankingPoints,
    matches:           playerRankingPointsTable.matches,
    playerName:        playersTable.name,
    playerNationality: playersTable.nationality,
    poolName:          continentalPoolPlayersTable.name,
    poolNationality:   continentalPoolPlayersTable.nationality,
    teamName:          teamsTable.name,
    poolTeamName:      continentalPoolTeamsTable.teamName,
  })
    .from(playerRankingPointsTable)
    .innerJoin(competitorsTable, eq(competitorsTable.id, playerRankingPointsTable.competitorId))
    .leftJoin(playersTable, eq(playersTable.id, playerRankingPointsTable.playerId))
    .leftJoin(continentalPoolPlayersTable, eq(continentalPoolPlayersTable.id, playerRankingPointsTable.poolPlayerId))
    .leftJoin(teamsTable, eq(teamsTable.id, competitorsTable.teamId))
    .leftJoin(continentalPoolTeamsTable, eq(continentalPoolTeamsTable.id, competitorsTable.poolTeamId))
    .where(and(
      eq(playerRankingPointsTable.careerSaveId, careerSaveId),
      eq(playerRankingPointsTable.seasonYear, seasonYear),
    ))
    .all();

  // A player's season is the sum of what they earned at every club.
  const players = new Map<string, QualifyingPlayer & { nation: string; resolved: boolean }>();
  for (const r of rows) {
    const kind: QualifyingPlayer["kind"] = r.playerId != null ? "player" : "pool";
    const id = (r.playerId ?? r.poolPlayerId)!;
    const key = `${kind}:${id}`;
    const club = r.teamName ?? r.poolTeamName ?? "Unknown club";
    let p = players.get(key);
    if (!p) {
      const nationality = (kind === "player" ? r.playerNationality : r.poolNationality) ?? "";
      const nation = nationName(nationality);
      p = {
        kind, id,
        name: (kind === "player" ? r.playerName : r.poolName) ?? "Unknown",
        nationality,
        clubs: [],
        points: 0,
        matches: 0,
        nation: nation ?? nationality,
        resolved: nation != null,
      };
      players.set(key, p);
    }
    p.points += r.points;
    p.matches += r.matches;
    if (!p.clubs.includes(club)) p.clubs.push(club);
  }

  // A country's total is the sum over its players; its tie-break is its best one.
  const nations = new Map<string, Array<QualifyingPlayer & { resolved: boolean }>>();
  for (const p of players.values()) {
    const list = nations.get(p.nation) ?? [];
    list.push(p);
    nations.set(p.nation, list);
  }

  const countries = [...nations].map(([country, list]) => ({
    country,
    flag: countryFlag(country),
    continent: continentKeyForNationality(country),
    points: list.reduce((s, p) => s + p.points, 0),
    bestPlayerPoints: Math.max(...list.map((p) => p.points)),
    resolved: list.every((p) => p.resolved),
    players: list
      .map(({ kind, id, name, nationality, clubs, points, matches }) => ({ kind, id, name, nationality, clubs, points, matches }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name)),
  }));

  countries.sort((a, b) =>
    b.points - a.points
    || b.bestPlayerPoints - a.bestPlayerPoints
    || a.country.localeCompare(b.country));

  return {
    seasonYear,
    spots: OLYMPIC_SPOTS,
    countries: countries.map((c, i) => ({ rank: i + 1, ...c, qualified: i < OLYMPIC_SPOTS })),
  };
}
