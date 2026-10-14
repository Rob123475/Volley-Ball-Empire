/**
 * Update 1, item 4b (Rob, 14 Oct, C-5 B): the Day 1 draft.
 *
 * A new career no longer opens with a squad picked for the player. After the
 * wizard (club, manager's face), before the first day is played, he picks his
 * seniors from every senior in the world: the free agents and every AI club's
 * seniors. On Day 1 no club owns anyone, so there is no transfer fee, only the
 * wage (her asking wage, 10% less for a Contracts Expert), and the salary cap
 * holds. Each pick signs through POST /contracts (routes/contracts.ts, which
 * knows the draft is open). He must take 2 or 3.
 *
 * Then (Day 2) each AI club keeps the seniors he did not take, and every club
 * with a gap fills it from what is left by item 4a's rule (keepAiSquadsTx:
 * the best free agent who fits under its cap and that it can afford), clubs in
 * random order. The AI managers' faces are dealt then, as before.
 *
 * A career made before the draft (career_saves.day1_draft null) never sees it.
 */
import {
  db, careerSavesTable, careerPlayerStateTable, playersTable, continentalPoolTeamsTable, seasonsTable,
} from "@workspace/db";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import type { CareerStateTx } from "../lib/playerDto.js";
import { materializeAiSeniorsTx, keepAiSquadsTx } from "./aiSquads.js";
import { ensureAiManagersTx } from "./aiManagers.js";
import { recordFreeFacesTx, specialityFactor } from "./managerFaces.js";
import { seasonEndsForCareerTx } from "./seasonDates.js";
import { overallRating } from "./overallRating.js";
import { askingWage } from "./wageCurve.js";
import { MAX_STARTERS, MAX_INTERCHANGE } from "./squadRules.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** He must take at least the two who play; the interchange is his choice. */
export const DRAFT_MIN = MAX_STARTERS;
export const DRAFT_MAX = MAX_STARTERS + MAX_INTERCHANGE;

/** Whether this career's Day 1 draft is open. */
export function day1DraftOpen(careerSaveId: number | null | undefined): boolean {
  if (careerSaveId == null) return false;
  return db.select({ d: careerSavesTable.day1Draft }).from(careerSavesTable).where(eq(careerSavesTable.id, careerSaveId)).get()?.d === "open";
}

/**
 * Opened with the career: the AI clubs' players are made career seniors (as
 * the first week makes them), so every senior in the world can be signed the
 * same way.
 */
export function openDay1DraftTx(w: CareerStateTx, careerSaveId: number): void {
  materializeAiSeniorsTx(w, careerSaveId);
  w.tx.update(careerSavesTable).set({ day1Draft: "open" }).where(eq(careerSavesTable.id, careerSaveId)).run();
}

export type DraftCard = {
  id: number; name: string; nationality: string; age: number; rating: number; imageUrl: string | null;
  /** Monthly: her asking wage at this club (after a Contracts Expert's -10%). */
  wage: number;
  /** The AI club she plays for, or null for a free agent. */
  club: string | null;
};

/** Every senior in the world not yet at the player's club, best first. */
export function day1DraftListTx(tx: Tx, careerSaveId: number, teamId: number): DraftCard[] {
  const contractsExpert = specialityFactor(teamId, "Contracts Expert");
  const clubs = new Map(tx.select({ id: continentalPoolTeamsTable.id, n: continentalPoolTeamsTable.teamName }).from(continentalPoolTeamsTable).all().map((c) => [c.id, c.n]));
  return tx.select({
    id: playersTable.id, name: playersTable.name, nationality: playersTable.nationality, imageUrl: playersTable.imageUrl,
    age: careerPlayerStateTable.age, salary: careerPlayerStateTable.salary, poolTeamId: careerPlayerStateTable.poolTeamId,
    speed: careerPlayerStateTable.speed, power: careerPlayerStateTable.power, defense: careerPlayerStateTable.defense,
    serve: careerPlayerStateTable.serve, block: careerPlayerStateTable.block, stamina: careerPlayerStateTable.stamina,
  }).from(careerPlayerStateTable)
    .innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
    .where(and(
      eq(careerPlayerStateTable.careerSaveId, careerSaveId),
      isNull(careerPlayerStateTable.teamId),
      eq(careerPlayerStateTable.isRetired, false),
      or(eq(playersTable.playerType, "senior"), eq(careerPlayerStateTable.isPromoted, true)),
    )).all()
    .map((p) => ({
      id: p.id, name: p.name, nationality: p.nationality, age: p.age, rating: overallRating(p), imageUrl: p.imageUrl ?? null,
      wage: askingWage(p.salary, contractsExpert), club: p.poolTeamId != null ? clubs.get(p.poolTeamId) ?? null : null,
    }))
    .sort((a, b) => b.rating - a.rating || a.wage - b.wage || a.id - b.id);
}

/** How many seniors the player's club has on its books. */
export function seniorsAtTx(tx: Tx, careerSaveId: number, teamId: number): number {
  return tx.select({ id: careerPlayerStateTable.playerId }).from(careerPlayerStateTable)
    .innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
    .where(and(
      eq(careerPlayerStateTable.careerSaveId, careerSaveId),
      eq(careerPlayerStateTable.teamId, teamId),
      eq(careerPlayerStateTable.isRetired, false),
      or(eq(playersTable.playerType, "senior"), eq(careerPlayerStateTable.isPromoted, true)),
    )).all().length;
}

/**
 * The draft closes once he has 2 or 3: the AI clubs fill their gaps from what
 * is left (Day 2), in random order, by item 4a's rule, and the AI managers'
 * faces are dealt. Null when it closed; else why not.
 */
export function finishDay1DraftTx(w: CareerStateTx, careerSaveId: number, teamId: number): string | null {
  const n = seniorsAtTx(w.tx, careerSaveId, teamId);
  if (n < DRAFT_MIN || n > DRAFT_MAX) return `Pick ${DRAFT_MIN} or ${DRAFT_MAX} seniors to start: ${DRAFT_MIN} to play and an optional interchange (you have ${n}).`;
  const season = w.tx.select({ year: seasonsTable.year, start: seasonsTable.startDate }).from(seasonsTable)
    .where(eq(seasonsTable.careerSaveId, careerSaveId)).orderBy(asc(seasonsTable.year)).limit(1).get();
  if (!season) return "The career has no season yet.";
  keepAiSquadsTx(w, careerSaveId, season.start, seasonEndsForCareerTx(w.tx, careerSaveId), Math.random);
  // Update 1, item 2: the AI managers' faces, dealt after the draft; the faces
  // left over are out of work from the career's first day.
  ensureAiManagersTx(w.tx, careerSaveId, season.year);
  recordFreeFacesTx(w.tx, careerSaveId, season.start);
  w.tx.update(careerSavesTable).set({ day1Draft: "done" }).where(eq(careerSavesTable.id, careerSaveId)).run();
  return null;
}
