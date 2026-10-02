/**
 * Daytime brief 2 Oct, U-3 ("have a crack", branch feat-job-market): the AI
 * clubs' managers, their boards, and the jobs that come of it.
 *
 *   - Every AI club has a named AI manager in a career (career_pool_team_state
 *     .manager_name), appointed when the career first needs one.
 *   - At each season's end its board judges her by the player's board's own
 *     rules (utils/board-confidence.ts): the club's strength rank in the drawn
 *     World Tour field sets the bands, its finish grades the season (met /
 *     below / failed). Two failed seasons running and she is sacked: the job is
 *     vacant (vacant_since, vacancy_reason). A club outside the field plays its
 *     regional league, which no board here grades, so its manager stays.
 *   - A vacancy stays open through the next season, and the player can apply
 *     for it (routes/job-market.ts). At the season end after, the club appoints
 *     a new AI manager if the player has not taken it.
 *   - The player's application is decided by his manager level (the one
 *     measure, lib/db/src/schema/manager-levels.ts) against the club's
 *     standing (its strength, the same sideRating its matches use):
 *     levelNeededFor. The answer says why.
 */
import {
  careerPoolTeamStateTable, continentalPoolTeamsTable, competitorRankingsTable, competitorsTable, careerSavesTable,
  boardSeasonsTable, CONTINENT_LABEL, MANAGER_LEVELS, db, type ContinentKey,
} from "@workspace/db";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { worldTourFieldTx, worldTourStandingsTx, poolClubRatingsTx } from "./worldTour.js";
import { bandsFor, gradeFor, targetWords, FIELD_CLUBS } from "./board-confidence.js";
import { tierForPoints } from "./tierQualification.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Failed seasons running that cost an AI manager her job (the brief: two). */
export const AI_SACKED_AFTER = 2;

const FIRST = ["Marco", "Ana", "Kenji", "Lucia", "Tomas", "Priya", "Jonas", "Amara", "Diego", "Sofia", "Erik", "Leila", "Rafael", "Hannah", "Mateo",
  "Ines", "Nikolai", "Chloe", "Samir", "Elena", "Bruno", "Yara", "Oskar", "Mei", "Pablo", "Freya", "Kofi", "Valeria", "Henrik", "Nadia"];
const LAST = ["Rossi", "Silva", "Tanaka", "Moreno", "Novak", "Sharma", "Berg", "Okafor", "Ramos", "Costa", "Lund", "Haddad", "Duarte", "Weber", "Garcia",
  "Ferreira", "Petrov", "Martin", "Aziz", "Popescu", "Santos", "Ali", "Nilsson", "Chen", "Ortega", "Hansen", "Mensah", "Rojas", "Larsen", "Karimi"];

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h;
}

/** A fixed name for the club's n-th manager in this career. */
export function aiManagerName(careerSaveId: number, poolTeamId: number, n: number): string {
  const h = hash(`${careerSaveId}:${poolTeamId}:${n}:manager`);
  return `${FIRST[h % FIRST.length]} ${LAST[(h >>> 8) % LAST.length]}`;
}

type ClubRow = typeof careerPoolTeamStateTable.$inferSelect;

function clubsTx(tx: Tx, careerSaveId: number): ClubRow[] {
  return tx.select().from(careerPoolTeamStateTable)
    .where(and(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), isNull(careerPoolTeamStateTable.takenOverAt))).all();
}

function appoint(tx: Tx, careerSaveId: number, c: ClubRow, year: number, n: number): string {
  const name = aiManagerName(careerSaveId, c.poolTeamId, n);
  tx.update(careerPoolTeamStateTable).set({
    managerName: name, managerSinceYear: year, managerFailedSeasons: 0, vacantSince: null, vacancyReason: null, updatedAt: new Date(),
  }).where(eq(careerPoolTeamStateTable.id, c.id)).run();
  return name;
}

/** Every AI club without a manager and without a vacancy gets one (a career's first). */
export function ensureAiManagersTx(tx: Tx, careerSaveId: number, year: number): number {
  let n = 0;
  for (const c of clubsTx(tx, careerSaveId)) {
    if (c.managerName == null && c.vacantSince == null) { appoint(tx, careerSaveId, c, year, 0); n++; }
  }
  return n;
}

/** Where each club in this season's field finished, by competitor standings. */
function finishesTx(tx: Tx, careerSaveId: number, seasonYear: number): Map<number, number> {
  const map = new Map<number, number>();
  worldTourStandingsTx(tx, careerSaveId, seasonYear).forEach((row, i) => { if (row.poolTeamId != null) map.set(row.poolTeamId, i + 1); });
  return map;
}

/** Each field club's strength rank in this season's drawn field (the player's pair counted, as his board counts it). */
function strengthRanksTx(tx: Tx, careerSaveId: number, seasonYear: number): Map<number, number> {
  const field = worldTourFieldTx(tx, careerSaveId, seasonYear);
  const ratings = poolClubRatingsTx(tx, careerSaveId);
  const player = tx.select({ r: boardSeasonsTable.pairRating }).from(boardSeasonsTable)
    .where(and(eq(boardSeasonsTable.careerSaveId, careerSaveId), eq(boardSeasonsTable.seasonYear, seasonYear))).get()?.r ?? null;
  const all = [...field.map((f) => ratings.get(f.poolTeamId) ?? 0), ...(player != null ? [Number(player)] : [])];
  return new Map(field.map((f) => {
    const mine = ratings.get(f.poolTeamId) ?? 0;
    return [f.poolTeamId, 1 + all.filter((r) => r > mine).length];
  }));
}

/**
 * A season's end for the AI clubs' managers: last season's vacancies the
 * player did not take are filled; then every field club's board grades the
 * season just played, and a manager on her second failed season running is
 * sacked. Returns who was appointed and who was sacked.
 */
export function aiManagersSeasonEndTx(tx: Tx, careerSaveId: number, endedYear: number, nextYear: number, _today: string):
  { appointed: Array<{ club: string; manager: string }>; sacked: Array<{ club: string; manager: string; reason: string }> } {
  ensureAiManagersTx(tx, careerSaveId, endedYear);
  // Afternoon 2 Oct (J-3): the boards act when the player's season ends (the
  // off-season window: openWindowIfDue in utils/managerMoves.ts). Only a
  // season whose window never opened is dealt with here, at its end.
  const judged = tx.select({ y: careerSavesTable.windowSeason }).from(careerSavesTable).where(eq(careerSavesTable.id, careerSaveId)).get()?.y;
  if (judged === endedYear) return { appointed: [], sacked: [] };
  const appointed = appointOldVacanciesTx(tx, careerSaveId, endedYear);
  return { appointed, sacked: judgeAiManagersTx(tx, careerSaveId, endedYear, `${nextYear}-01-01`) };
}

/**
 * A job opened before this season (in an earlier window, or at the rollover
 * before) has been open a season: the club appoints a new AI manager. One
 * opened in this season's window stays open into the next season.
 */
export function appointOldVacanciesTx(tx: Tx, careerSaveId: number, year: number): Array<{ club: string; manager: string }> {
  const names = new Map(tx.select({ id: continentalPoolTeamsTable.id, n: continentalPoolTeamsTable.teamName }).from(continentalPoolTeamsTable).all().map((t) => [t.id, t.n]));
  const appointed: Array<{ club: string; manager: string }> = [];
  for (const c of clubsTx(tx, careerSaveId)) {
    if (c.vacantSince != null && c.vacantSince <= `${year}-01-01`) {
      const n = 1 + (hash(`${c.poolTeamId}:${c.vacantSince}`) % 1000);
      appointed.push({ club: names.get(c.poolTeamId) ?? "", manager: appoint(tx, careerSaveId, c, year, n) });
    }
  }
  return appointed;
}

/** Each field club's board grades the season; a second failed season running is a sacking (vacant from `vacantFrom`). */
export function judgeAiManagersTx(tx: Tx, careerSaveId: number, endedYear: number, vacantFrom: string): Array<{ club: string; manager: string; reason: string }> {
  const names = new Map(tx.select({ id: continentalPoolTeamsTable.id, n: continentalPoolTeamsTable.teamName }).from(continentalPoolTeamsTable).all().map((t) => [t.id, t.n]));
  const finishes = finishesTx(tx, careerSaveId, endedYear);
  const ranks = strengthRanksTx(tx, careerSaveId, endedYear);
  const sacked: Array<{ club: string; manager: string; reason: string }> = [];
  for (const c of clubsTx(tx, careerSaveId)) {
    const rank = ranks.get(c.poolTeamId), finish = finishes.get(c.poolTeamId);
    if (rank == null || finish == null || c.managerName == null) continue;
    const { grade } = gradeFor(rank, finish);
    const failed = grade === "failed" ? c.managerFailedSeasons + 1 : 0;
    if (failed >= AI_SACKED_AFTER) {
      const club = names.get(c.poolTeamId) ?? "";
      const reason = `${c.managerName} was sacked after ${failed} failed seasons running: ranked ${rank} of ${FIELD_CLUBS} on strength, the board expected ${targetWords(bandsFor(rank).metLine)} and the club finished ${finish}.`;
      tx.update(careerPoolTeamStateTable).set({ managerName: null, managerFailedSeasons: 0, vacantSince: vacantFrom, vacancyReason: reason, updatedAt: new Date() })
        .where(eq(careerPoolTeamStateTable.id, c.id)).run();
      sacked.push({ club, manager: c.managerName, reason });
    } else {
      tx.update(careerPoolTeamStateTable).set({ managerFailedSeasons: failed, updatedAt: new Date() }).where(eq(careerPoolTeamStateTable.id, c.id)).run();
    }
  }
  return sacked;
}

/** The manager level a club wants, by its strength: the stronger the club, the more it asks. */
export function levelNeededFor(rating: number): number {
  return rating >= 88 ? 4 : rating >= 80 ? 3 : rating >= 72 ? 2 : 1;
}

export type Vacancy = {
  poolTeamId: number; name: string; continent: string; continentName: string;
  /** Its strength now: sideRating over the two it plays. */
  rating: number;
  /** Its bank balance. */
  budget: number;
  /** The tier its last season's ranking points reach. */
  tier: string;
  /** What its board expects this season, in its words. */
  expectation: string;
  /** Why the job is open. */
  reason: string | null;
  vacantSince: string;
  levelNeeded: number;
  levelNeededName: string;
};

/** The real vacancies: AI clubs whose manager has gone and nobody has been appointed. */
export function vacanciesTx(tx: Tx, careerSaveId: number, seasonYear: number): Vacancy[] {
  const open = tx.select().from(careerPoolTeamStateTable).where(and(
    eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), isNull(careerPoolTeamStateTable.takenOverAt),
    isNotNull(careerPoolTeamStateTable.vacantSince))).all();
  if (open.length === 0) return [];
  const ratings = poolClubRatingsTx(tx, careerSaveId);
  const ranks = strengthRanksTx(tx, careerSaveId, seasonYear);
  const teams = new Map(tx.select().from(continentalPoolTeamsTable).all().map((t) => [t.id, t]));
  const lastPoints = new Map(tx.select({ poolTeamId: competitorsTable.poolTeamId, points: competitorRankingsTable.rankingPoints })
    .from(competitorRankingsTable).innerJoin(competitorsTable, eq(competitorsTable.id, competitorRankingsTable.competitorId))
    .where(and(eq(competitorRankingsTable.careerSaveId, careerSaveId), eq(competitorRankingsTable.seasonYear, seasonYear - 1), isNotNull(competitorsTable.poolTeamId)))
    .all().map((r) => [r.poolTeamId!, Number(r.points)]));
  return open.map((c) => {
    const t = teams.get(c.poolTeamId)!;
    const rating = Math.round(ratings.get(c.poolTeamId) ?? Number(t.rating));
    const rank = ranks.get(c.poolTeamId);
    const level = levelNeededFor(rating);
    return {
      poolTeamId: c.poolTeamId, name: t.teamName, continent: t.continent,
      continentName: CONTINENT_LABEL[t.continent as ContinentKey] ?? t.continent,
      rating, budget: Math.round(Number(c.balance)), tier: tierForPoints(lastPoints.get(c.poolTeamId) ?? 0),
      expectation: rank != null ? `${targetWords(bandsFor(rank).metLine)} on the World Tour (ranked ${rank} of ${FIELD_CLUBS} on strength)` : "a World Tour place: it plays its regional league this season",
      reason: c.vacancyReason, vacantSince: c.vacantSince!,
      levelNeeded: level, levelNeededName: MANAGER_LEVELS[level - 1]!.name,
    };
  }).sort((a, b) => b.rating - a.rating || a.poolTeamId - b.poolTeamId);
}

/** The club's answer to the player's application, in plain words. */
export function decideApplication(v: Vacancy, managerName: string, level: { level: number; name: string }): { accepted: boolean; reason: string } {
  if (level.level >= v.levelNeeded) {
    return { accepted: true, reason: `${v.name} offer ${managerName} the job: they wanted at least a Level ${v.levelNeeded} ${v.levelNeededName}, and ${managerName} is Level ${level.level} (${level.name}).` };
  }
  return { accepted: false, reason: `${v.name} turn ${managerName} down: a club of its strength (${v.rating}) wants at least a Level ${v.levelNeeded} ${v.levelNeededName}, and ${managerName} is Level ${level.level} (${level.name}).` };
}
