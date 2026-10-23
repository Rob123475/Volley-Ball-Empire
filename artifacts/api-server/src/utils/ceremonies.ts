/**
 * 1.1.3 (Rob, 23 Oct; brief A5): the medal ceremonies.
 *
 *   World Finals and the Empire Nations Cup: a 3D podium in Unity (the court
 *   iframe in ceremony mode). The 6 players (gold, silver and bronze pairs) on
 *   steps 1, 2 and 3, medals round their necks, waving; behind them a banner,
 *   "BEACH VOLLEYBALL EMPIRE WORLD TOUR" or "EMPIRE NATIONS CUP {year}". Cup
 *   players wear their nation's colours, World Tour players their club's kit;
 *   each has her nation's flag by her name plate.
 *
 *   It plays every time, whoever is on the podium: a row in career_ceremonies
 *   when the final is decided (the Cup's: utils/olympics.ts; the World Finals':
 *   queued here the first time the Dashboard asks after the final), until he
 *   watches or skips it (seenOn).
 *
 *   World Finals bronze: the losing semi-finalist higher on the season's ladder
 *   (utils/worldTour.ts worldFinalsBronzeTx); dead level, the third-place match.
 */
import {
  careerCeremoniesTable, olympicMedalsTable, careerPlayerStateTable, playersTable, continentalPoolPlayersTable,
  continentalPoolTeamsTable, teamsTable, competitorsTable, worldTourFixturesTable,
  nationalKit, flagCode, nationName,
} from "@workspace/db";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { CareerStateTx } from "../lib/playerDto.js";
import { aiPairTx } from "./aiSquads.js";
import { worldFinalsBronzeTx, FINAL_TIER } from "./worldTour.js";
import { FINALS_END } from "./calendarSlots.js";
import { sideRating } from "./matchEngine.js";

type Tx = CareerStateTx["tx"];
export type CeremonyEvent = "world_finals" | "nations_cup";

export const CEREMONY_BANNER: Record<CeremonyEvent, (year: number) => string> = {
  world_finals: () => "BEACH VOLLEYBALL EMPIRE WORLD TOUR",
  nations_cup: (year) => `EMPIRE NATIONS CUP ${year}`,
};

/** The season's World Final, once it is decided. */
function worldFinalTx(tx: Tx, careerSaveId: number, seasonYear: number) {
  return tx.select().from(worldTourFixturesTable).where(and(
    eq(worldTourFixturesTable.careerSaveId, careerSaveId), eq(worldTourFixturesTable.seasonYear, seasonYear),
    eq(worldTourFixturesTable.round, FINALS_END), eq(worldTourFixturesTable.tier, FINAL_TIER), eq(worldTourFixturesTable.status, "completed"),
  )).get() ?? null;
}

/**
 * Queue this season's World Finals ceremony once its final is decided (the Cup's is queued
 * when its medals are decided). Only the season being played: an old save does not get
 * ceremonies for seasons long gone.
 */
export function queueCeremoniesTx(tx: Tx, careerSaveId: number, seasonYear: number, today: string): void {
  if (worldFinalTx(tx, careerSaveId, seasonYear) && worldFinalsBronzeTx(tx, careerSaveId, seasonYear).competitorId != null) {
    tx.insert(careerCeremoniesTable).values({ careerSaveId, event: "world_finals", seasonYear, readyOn: today }).onConflictDoNothing().run();
  }
}

/** The ceremony waiting to be watched, oldest first, or null. */
export function pendingCeremonyTx(tx: Tx, careerSaveId: number) {
  return tx.select().from(careerCeremoniesTable)
    .where(and(eq(careerCeremoniesTable.careerSaveId, careerSaveId), isNull(careerCeremoniesTable.seenOn)))
    .orderBy(asc(careerCeremoniesTable.readyOn), asc(careerCeremoniesTable.id)).get() ?? null;
}

export function markCeremonySeenTx(tx: Tx, careerSaveId: number, event: string, seasonYear: number, today: string): boolean {
  const r = tx.update(careerCeremoniesTable).set({ seenOn: today }).where(and(
    eq(careerCeremoniesTable.careerSaveId, careerSaveId), eq(careerCeremoniesTable.event, event), eq(careerCeremoniesTable.seasonYear, seasonYear),
  )).run();
  return Number(r.changes ?? 0) > 0;
}

export type PodiumPlayer = {
  name: string; nationality: string; flag: string | null; skinTone: string | null;
  primaryColor: string | null; secondaryColor: string | null;
};
export type PodiumPlace = { place: 1 | 2 | 3; medal: "gold" | "silver" | "bronze"; label: string; players: PodiumPlayer[] };
export type CeremonyState = { event: CeremonyEvent; seasonYear: number; banner: string; places: PodiumPlace[] };

/** A career player's skin tone: her own picture's band, else her pool player's. */
function skinOf(tx: Tx, careerSaveId: number, playerId: number): string | null {
  const r = tx.select({ v4: playersTable.playerV4, pool: careerPlayerStateTable.poolPlayerId }).from(playersTable)
    .leftJoin(careerPlayerStateTable, and(eq(careerPlayerStateTable.playerId, playersTable.id), eq(careerPlayerStateTable.careerSaveId, careerSaveId)))
    .where(eq(playersTable.id, playerId)).get();
  const own = (r?.v4 as { visual_identity?: { skin_tone?: string } } | null)?.visual_identity?.skin_tone ?? null;
  if (own) return own;
  return r?.pool != null ? tx.select({ s: continentalPoolPlayersTable.skinTone }).from(continentalPoolPlayersTable).where(eq(continentalPoolPlayersTable.id, r.pool)).get()?.s ?? null : null;
}

/** A World Finals club's pair (as it plays: its best two fit) and its kit. */
function clubPodiumTx(tx: Tx, careerSaveId: number, competitorId: number): { label: string; players: PodiumPlayer[] } {
  const c = tx.select({ teamId: competitorsTable.teamId, poolTeamId: competitorsTable.poolTeamId }).from(competitorsTable)
    .where(eq(competitorsTable.id, competitorId)).get();
  if (c?.poolTeamId != null) {
    const team = tx.select().from(continentalPoolTeamsTable).where(eq(continentalPoolTeamsTable.id, c.poolTeamId)).get();
    return {
      label: team?.teamName ?? "",
      players: aiPairTx(tx, careerSaveId, c.poolTeamId).map((m) => ({
        name: m.name, nationality: nationName(m.nationality) ?? m.nationality, flag: flagCode(m.nationality), skinTone: m.skinTone,
        primaryColor: team?.primaryColor ?? null, secondaryColor: team?.secondaryColor ?? null,
      })),
    };
  }
  const team = c?.teamId != null ? tx.select().from(teamsTable).where(eq(teamsTable.id, c.teamId)).get() : undefined;
  const rows = c?.teamId == null ? [] : tx.select({
    id: playersTable.id, name: playersTable.name, nationality: playersTable.nationality,
    speed: careerPlayerStateTable.speed, power: careerPlayerStateTable.power, defense: careerPlayerStateTable.defense,
    serve: careerPlayerStateTable.serve, block: careerPlayerStateTable.block, stamina: careerPlayerStateTable.stamina,
    injured: careerPlayerStateTable.isInjured, active: careerPlayerStateTable.isActive,
  }).from(careerPlayerStateTable).innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
    .where(and(eq(careerPlayerStateTable.careerSaveId, careerSaveId), eq(careerPlayerStateTable.teamId, c.teamId), eq(careerPlayerStateTable.isRetired, false))).all();
  const pair = rows.filter((r) => r.active && !r.injured).sort((a, b) => sideRating([b]) - sideRating([a])).slice(0, 2);
  return {
    label: team?.name ?? "",
    players: pair.map((p) => ({
      name: p.name, nationality: nationName(p.nationality) ?? p.nationality, flag: flagCode(p.nationality), skinTone: skinOf(tx, careerSaveId, p.id),
      primaryColor: team?.logoColor ?? null, secondaryColor: team?.secondaryLogoColor ?? null,
    })),
  };
}

/** The podium: who stands where, in what, with which flag, under which banner. Null until it is decided. */
export function ceremonyStateTx(tx: Tx, careerSaveId: number, event: CeremonyEvent, seasonYear: number): CeremonyState | null {
  if (event === "world_finals") {
    const final = worldFinalTx(tx, careerSaveId, seasonYear);
    const bronze = worldFinalsBronzeTx(tx, careerSaveId, seasonYear);
    if (!final || bronze.competitorId == null) return null;
    const homeWon = (final.homeSets ?? 0) > (final.awaySets ?? 0);
    const order: Array<[1 | 2 | 3, "gold" | "silver" | "bronze", number]> = [
      [1, "gold", homeWon ? final.homeCompetitorId : final.awayCompetitorId],
      [2, "silver", homeWon ? final.awayCompetitorId : final.homeCompetitorId],
      [3, "bronze", bronze.competitorId],
    ];
    return {
      event, seasonYear, banner: CEREMONY_BANNER.world_finals(seasonYear),
      places: order.map(([place, medal, competitorId]) => ({ place, medal, ...clubPodiumTx(tx, careerSaveId, competitorId) })),
    };
  }
  const medals = tx.select().from(olympicMedalsTable)
    .where(and(eq(olympicMedalsTable.careerSaveId, careerSaveId), eq(olympicMedalsTable.seasonYear, seasonYear))).orderBy(asc(olympicMedalsTable.id)).all();
  if (medals.length === 0) return null;
  const place = { gold: 1, silver: 2, bronze: 3 } as const;
  return {
    event, seasonYear, banner: CEREMONY_BANNER.nations_cup(seasonYear),
    places: (["gold", "silver", "bronze"] as const).map((medal) => {
      const of = medals.filter((m) => m.medal === medal);
      const nation = of[0]?.nation ?? "";
      const kit = nationalKit(nation);
      return {
        place: place[medal], medal, label: nation,
        players: of.map((m) => ({
          name: m.playerName, nationality: nation, flag: flagCode(nation),
          skinTone: m.playerKind === "player" && m.playerId != null ? skinOf(tx, careerSaveId, m.playerId)
            : m.poolPlayerId != null ? tx.select({ s: continentalPoolPlayersTable.skinTone }).from(continentalPoolPlayersTable).where(eq(continentalPoolPlayersTable.id, m.poolPlayerId)).get()?.s ?? null : null,
          primaryColor: kit?.primary ?? null, secondaryColor: kit?.secondary ?? null,
        })),
      };
    }),
  };
}

/** The career's latest ceremony of this event (any season), for a request that names no year. */
export function latestCeremonyYearTx(tx: Tx, careerSaveId: number, event: CeremonyEvent): number | null {
  return tx.select({ y: careerCeremoniesTable.seasonYear }).from(careerCeremoniesTable)
    .where(and(eq(careerCeremoniesTable.careerSaveId, careerSaveId), eq(careerCeremoniesTable.event, event)))
    .orderBy(asc(careerCeremoniesTable.seasonYear)).all().at(-1)?.y ?? null;
}

