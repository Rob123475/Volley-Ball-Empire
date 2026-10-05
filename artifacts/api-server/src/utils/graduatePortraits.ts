/**
 * Final brief 5 Oct, A4: Rob's pictures for graduating youth.
 *
 *   "When a youth graduates, she gets an unused image from her own continent.
 *    No image is ever used twice in a career. If a continent runs out, choose
 *    the safest fallback and report it."
 *
 * - Who: every player of this career who has graduated out of an academy
 *   (is_promoted, player_type 'youth') and is an adult. Every picture is of a
 *   woman of 21, and the game never pictures a minor (components/player-portrait.tsx):
 *   a youth promoted by hand at 16 keeps her flag card until she is 18, and is
 *   given her picture at the first season boundary after that.
 * - Which: an unused picture of her own continent (players.continent, else her
 *   nationality's). Chosen by a hash of the career and the player, so a career
 *   is repeatable and two careers differ.
 * - Order: the manager's own club's graduates first, then everyone else's
 *   (AI academies, the youth who were nobody's), oldest graduates first.
 * - Never twice: career_graduate_portraits holds every picture given, for the
 *   whole career, even after she retires and her career row is gone; its unique
 *   index (career, picture) makes a second use impossible, not just unlikely.
 * - Run out: she keeps the card she had (her flag card). Nothing is reused and
 *   nothing invented; ranOut counts her, and the status file reports it.
 * - The 72 shipped youth on the market are untouched until they graduate.
 */
import {
  db, careerGraduatePortraitsTable, careerPlayerStateTable, careerSavesTable, playersTable, calendarStateTable,
  continentKeyFrom, continentKeyForNationality, type ContinentKey,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import type { CareerStateTx } from "../lib/playerDto.js";
import { GRADUATE_PORTRAITS } from "../data/graduatePortraits.js";

type Tx = CareerStateTx["tx"];

/** The game never pictures a minor. */
export const GRADUATE_PORTRAIT_MIN_AGE = 18;

export const GRADUATE_PORTRAIT_PREFIX = "/images/players/graduates/";

export type GraduatePortraitResult = {
  given: Array<{ playerId: number; imageUrl: string; continent: ContinentKey }>;
  /** Graduates who were owed one but whose continent had none left. */
  ranOut: Array<{ playerId: number; continent: ContinentKey }>;
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}

/** Give every adult graduate of this career without a picture an unused one of her continent. */
export function assignGraduatePortraitsTx(tx: Tx, careerSaveId: number, assignedOn: string): GraduatePortraitResult {
  const result: GraduatePortraitResult = { given: [], ranOut: [] };
  const given = tx.select({ playerId: careerGraduatePortraitsTable.playerId, imageUrl: careerGraduatePortraitsTable.imageUrl })
    .from(careerGraduatePortraitsTable).where(eq(careerGraduatePortraitsTable.careerSaveId, careerSaveId)).all();
  const has = new Set(given.map((g) => g.playerId));
  const used = new Set(given.map((g) => g.imageUrl));
  const ownTeam = tx.select({ t: careerSavesTable.teamId }).from(careerSavesTable).where(eq(careerSavesTable.id, careerSaveId)).get()?.t ?? null;

  const owed = tx.select({
    playerId: careerPlayerStateTable.playerId, teamId: careerPlayerStateTable.teamId, age: careerPlayerStateTable.age,
    continent: playersTable.continent, nationality: playersTable.nationality,
  }).from(careerPlayerStateTable)
    .innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
    .where(and(
      eq(careerPlayerStateTable.careerSaveId, careerSaveId),
      eq(careerPlayerStateTable.isPromoted, true),
      eq(careerPlayerStateTable.isRetired, false),
      eq(playersTable.playerType, "youth"),
    )).all()
    .filter((p) => !has.has(p.playerId) && p.age >= GRADUATE_PORTRAIT_MIN_AGE)
    .sort((a, b) => Number(b.teamId === ownTeam && ownTeam != null) - Number(a.teamId === ownTeam && ownTeam != null)
      || b.age - a.age || a.playerId - b.playerId);

  for (const p of owed) {
    const continent = continentKeyFrom(p.continent) ?? continentKeyForNationality(p.nationality);
    if (!continent) continue;
    const free = (GRADUATE_PORTRAITS[continent] ?? []).filter((u) => !used.has(u));
    if (free.length === 0) { result.ranOut.push({ playerId: p.playerId, continent }); continue; }
    const imageUrl = free[hash(`${careerSaveId}:${p.playerId}`) % free.length]!;
    tx.insert(careerGraduatePortraitsTable).values({ careerSaveId, playerId: p.playerId, imageUrl, continent, assignedOn }).run();
    used.add(imageUrl);
    result.given.push({ playerId: p.playerId, imageUrl, continent });
  }
  return result;
}

/**
 * At boot, every career: an older save's adult graduates get their pictures
 * now rather than at the next season boundary. Dated on each career's game day.
 * A no-op once they have them.
 */
export function assignGraduatePortraitsAtBoot(): { careers: number; given: number; ranOut: number } {
  return db.transaction((tx) => {
    let careers = 0, given = 0, ranOut = 0;
    for (const s of tx.select({ id: careerSavesTable.id, teamId: careerSavesTable.teamId }).from(careerSavesTable).all()) {
      const today = s.teamId == null ? null : tx.select({ d: calendarStateTable.currentDate }).from(calendarStateTable)
        .where(eq(calendarStateTable.teamId, s.teamId)).get()?.d ?? null;
      const r = assignGraduatePortraitsTx(tx, s.id, (today ?? "2026-01-01").slice(0, 10));
      careers++; given += r.given.length; ranOut += r.ranOut.length;
    }
    return { careers, given, ranOut };
  });
}

/** This career's graduate pictures, by player. */
export function graduatePortraitsOfTx(tx: Tx, careerSaveId: number): Map<number, string> {
  return new Map(tx.select({ playerId: careerGraduatePortraitsTable.playerId, imageUrl: careerGraduatePortraitsTable.imageUrl })
    .from(careerGraduatePortraitsTable).where(eq(careerGraduatePortraitsTable.careerSaveId, careerSaveId)).all()
    .map((r) => [r.playerId, r.imageUrl]));
}
