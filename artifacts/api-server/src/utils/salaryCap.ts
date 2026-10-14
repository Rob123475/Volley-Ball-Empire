/**
 * Update 1, item 4a (Rob, 14 Oct; C-2, C-3, C-5): the salary cap.
 *
 * One rule for every club, the player's and the sixty AI clubs (Rob's 23 Sep
 * rule): a club's SENIOR wages may add up to at most MONEY.salaryCap.monthlyCap
 * a month. What counts (C-2 A): the seniors on the club's books, its starters,
 * interchange and promoted graduates. Academy youths, youths out on loan, staff
 * and the manager do not.
 *
 *   - seniorWageBillTx(club): the one figure every check and screen reads.
 *   - wageCapRefusal(bill, adding): a signing, a renewal at a higher wage, or any
 *     raise is refused if it takes the bill over the cap, in plain words (C-3 A).
 *     The wage checked is the one after any speciality (a Contracts Expert's
 *     -10% counts), because callers pass the wage she will be on.
 *   - A club already over the cap (C-5) keeps everyone; it just cannot add a
 *     penny until it is back under. A youth promoted into the seniors is never
 *     blocked: she counts, and the club then cannot add more.
 */
import { MONEY, careerPlayerStateTable, playersTable, db } from "@workspace/db";
import { and, eq, or } from "drizzle-orm";
import { aiSquadsTx } from "./aiSquads.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** A club: the player's (its teams row) or an AI club. */
export type WageClub = { teamId: number } | { poolTeamId: number };

export const SALARY_CAP = MONEY.salaryCap.monthlyCap;

/** The club's monthly senior wage bill. */
export function seniorWageBillTx(tx: Tx, careerSaveId: number, club: WageClub): number {
  if ("teamId" in club) {
    return tx.select({ salary: careerPlayerStateTable.salary }).from(careerPlayerStateTable)
      .innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
      .where(and(
        eq(careerPlayerStateTable.careerSaveId, careerSaveId),
        eq(careerPlayerStateTable.teamId, club.teamId),
        eq(careerPlayerStateTable.isRetired, false),
        or(eq(playersTable.playerType, "senior"), eq(careerPlayerStateTable.isPromoted, true)),
      )).all().reduce((sum, r) => sum + Number(r.salary), 0);
  }
  // An AI club's squad as every reader sees it (utils/aiSquads.ts): a pool
  // player not yet on a contract in this career is not on its books yet.
  return (aiSquadsTx(tx, careerSaveId).get(club.poolTeamId) ?? [])
    .filter((m) => m.kind === "player" || m.contractEndDate != null)
    .reduce((sum, m) => sum + Number(m.salary), 0);
}

/** Outside a transaction (the routes). */
export function seniorWageBill(careerSaveId: number, club: WageClub): number {
  return db.transaction((tx) => seniorWageBillTx(tx, careerSaveId, club));
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/**
 * Null when adding `adding` a month to a bill of `bill` keeps it under the cap
 * (or adds nothing); else why not, in Rob's words.
 */
export function wageCapRefusal(bill: number, adding: number): string | null {
  if (adding <= 0) return null;
  const after = bill + adding;
  if (after <= SALARY_CAP) return null;
  return `That takes your wages to ${money(after)}. The cap is ${money(SALARY_CAP)}. Free up ${money(after - SALARY_CAP)} first.`;
}

/** Whether `adding` a month fits under the cap on a bill of `bill`. */
export const fitsUnderCap = (bill: number, adding: number): boolean => wageCapRefusal(bill, adding) == null;

/** What the screens show: the bill, the cap and the room left (never below zero). */
export function wageCapView(bill: number): { seniorWages: number; cap: number; room: number } {
  return { seniorWages: Math.round(bill), cap: SALARY_CAP, room: Math.max(0, Math.round(SALARY_CAP - bill)) };
}
