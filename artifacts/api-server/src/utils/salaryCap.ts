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
 *     Renewals go through renewalCapRefusalTx (1.1.1: one whose contract ends
 *     before a player bought ahead arrives must fit on that day, even at the same wage).
 *     The wage checked is the one after any speciality (a Contracts Expert's
 *     -10% counts), because callers pass the wage she will be on.
 *   - A club already over the cap (C-5) keeps everyone; it just cannot add a
 *     penny until it is back under. A youth promoted into the seniors is never
 *     blocked: she counts, and the club then cannot add more.
 *   - 1.1.1 (Part 4): a contract's perks cost the club every month and count
 *     toward the cap with her wage (schema/transfers.ts perksMonthly).
 *   - 1.1.1 (Part 2, AC-8 A): a deal agreed now for a player arriving later is
 *     checked against the club's bill ON HER ARRIVAL DATE: contracts that end
 *     before then don't count, players it has sold ahead and who leave by then
 *     don't count, and players it has bought ahead who arrive by then do.
 */
import { MONEY, careerPlayerStateTable, playersTable, transferDealsTable, perksMonthly, db } from "@workspace/db";
import { and, eq, inArray, or } from "drizzle-orm";
import { aiSquadsTx, type AiMember } from "./aiSquads.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** A club: the player's (its teams row) or an AI club. */
export type WageClub = { teamId: number } | { poolTeamId: number };

export const SALARY_CAP = MONEY.salaryCap.monthlyCap;

type Senior = { playerId: number | null; salary: number; perks: string; contractEndDate: string | null };

/** The seniors on a club's books, each with her wage, perks and contract end. `squads`: the AI squads already built (aiSquadsTx), if the caller has them. */
function seniorsOfTx(tx: Tx, careerSaveId: number, club: WageClub, squads?: ReadonlyMap<number, AiMember[]>): Senior[] {
  if ("teamId" in club) {
    return tx.select({
      playerId: careerPlayerStateTable.playerId, salary: careerPlayerStateTable.salary,
      perks: careerPlayerStateTable.perks, contractEndDate: careerPlayerStateTable.contractEndDate,
    }).from(careerPlayerStateTable)
      .innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
      .where(and(
        eq(careerPlayerStateTable.careerSaveId, careerSaveId),
        eq(careerPlayerStateTable.teamId, club.teamId),
        eq(careerPlayerStateTable.isRetired, false),
        or(eq(playersTable.playerType, "senior"), eq(careerPlayerStateTable.isPromoted, true)),
      )).all().map((r) => ({ ...r, salary: Number(r.salary) }));
  }
  // An AI club's squad as every reader sees it (utils/aiSquads.ts): a pool
  // player not yet on a contract in this career is not on its books yet.
  const squad = ((squads ?? aiSquadsTx(tx, careerSaveId)).get(club.poolTeamId) ?? []).filter((m) => m.kind === "player" || m.contractEndDate != null);
  const ids = squad.filter((m) => m.kind === "player").map((m) => m.id);
  const perks = new Map(ids.length ? tx.select({ id: careerPlayerStateTable.playerId, perks: careerPlayerStateTable.perks }).from(careerPlayerStateTable)
    .where(and(eq(careerPlayerStateTable.careerSaveId, careerSaveId), inArray(careerPlayerStateTable.playerId, ids))).all().map((r) => [r.id, r.perks]) : []);
  return squad.map((m) => ({ playerId: m.kind === "player" ? m.id : null, salary: Number(m.salary), perks: m.kind === "player" ? (perks.get(m.id) ?? "") : "", contractEndDate: m.contractEndDate }));
}

/**
 * The club's monthly senior wage bill: wages and perks. With `on`, the bill on
 * that date (1.1.1, AC-8 A): contracts ending before it, and players sold ahead
 * who have left by then, are out; players bought ahead who have arrived by then are in.
 */
export function seniorWageBillTx(tx: Tx, careerSaveId: number, club: WageClub, on?: string, squads?: ReadonlyMap<number, AiMember[]>): number {
  let seniors = seniorsOfTx(tx, careerSaveId, club, squads);
  let extra = 0;
  if (on) {
    const deals = tx.select().from(transferDealsTable).where(and(eq(transferDealsTable.careerSaveId, careerSaveId), eq(transferDealsTable.status, "agreed"))).all()
      .filter((d) => d.arrivesOn != null && d.arrivesOn <= on);
    const isClub = (teamId: number | null, poolTeamId: number | null) => ("teamId" in club ? teamId === club.teamId : poolTeamId === club.poolTeamId);
    const leaving = new Set(deals.filter((d) => isClub(d.fromTeamId, d.fromPoolTeamId)).map((d) => d.playerId));
    seniors = seniors.filter((r) => (r.contractEndDate == null || r.contractEndDate >= on) && !(r.playerId != null && leaving.has(r.playerId)));
    extra = deals.filter((d) => isClub(d.toTeamId, d.toPoolTeamId)).reduce((t, d) => t + Number(d.wage) + perksMonthly(d.perks), 0);
  }
  return seniors.reduce((sum, r) => sum + r.salary + perksMonthly(r.perks), 0) + extra;
}

/**
 * 1.1.1 (found by the soak): what a club has committed to, for new spending (a
 * signing, a renewal, a raise, a counter-offer, an AI club's refill). Its
 * seniors today (one sold ahead is still paid until she goes) plus every
 * player it has bought ahead, on her new wage and perks. Without the players
 * bought ahead, a club could agree a deal that fits on her arrival date, then
 * sign or renew someone in the meantime, and be over the cap the day she
 * arrives. The pages show the bill today (seniorWageBillTx).
 */
export function committedWageBillTx(tx: Tx, careerSaveId: number, club: WageClub): number {
  const isClub = (teamId: number | null, poolTeamId: number | null) => ("teamId" in club ? teamId === club.teamId : poolTeamId === club.poolTeamId);
  const coming = tx.select().from(transferDealsTable).where(and(eq(transferDealsTable.careerSaveId, careerSaveId), eq(transferDealsTable.status, "agreed"))).all()
    .filter((d) => isClub(d.toTeamId, d.toPoolTeamId))
    .reduce((t, d) => t + Number(d.wage) + perksMonthly(d.perks), 0);
  return seniorWageBillTx(tx, careerSaveId, club) + coming;
}

/**
 * 1.1.1 (found by the soak): a renewal's cap check, for every club. Only a raise
 * is new spending (C-3 A), so a renewal at no more than her current cost passes
 * even over the cap (C-5). But a player bought ahead was agreed on the club's bill
 * on her arrival date, without the contracts that end before then (AC-8 A). So
 * renewing one of those puts her whole cost back on that date's bill. It has to
 * fit there, even at the same wage, or the club would be over its cap the day the
 * new player arrives.
 */
export function renewalCapRefusalTx(tx: Tx, careerSaveId: number, club: WageClub, contractEndDate: string | null, costNow: number, costAfter: number): string | null {
  const raise = wageCapRefusal(committedWageBillTx(tx, careerSaveId, club), costAfter - costNow);
  if (raise) return raise;
  if (!contractEndDate) return null;
  const isClub = (teamId: number | null, poolTeamId: number | null) => ("teamId" in club ? teamId === club.teamId : poolTeamId === club.poolTeamId);
  const arrivals = [...new Set(tx.select().from(transferDealsTable).where(and(eq(transferDealsTable.careerSaveId, careerSaveId), eq(transferDealsTable.status, "agreed"))).all()
    .filter((d) => isClub(d.toTeamId, d.toPoolTeamId) && d.arrivesOn != null && d.arrivesOn > contractEndDate).map((d) => d.arrivesOn!))].sort();
  for (const on of arrivals) {
    const refused = wageCapRefusal(seniorWageBillTx(tx, careerSaveId, club, on), costAfter);
    if (refused) return `On ${dayText(on)}, when a player bought ahead arrives: ${refused}`;
  }
  return null;
}

export function renewalCapRefusal(careerSaveId: number, club: WageClub, contractEndDate: string | null, costNow: number, costAfter: number): string | null {
  return db.transaction((tx) => renewalCapRefusalTx(tx, careerSaveId, club, contractEndDate, costNow, costAfter));
}

const dayText = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function committedWageBill(careerSaveId: number, club: WageClub): number {
  return db.transaction((tx) => committedWageBillTx(tx, careerSaveId, club));
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
