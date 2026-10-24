/**
 * The season end dates a contract length is measured against.
 *
 * L-02a: a "season" contract must end when the season ends. A season is
 * 418-421 days, not 365, so the old `addOneYear` arithmetic drifted off the
 * season it was meant to cover — and because it also capped every deal at one
 * year, no multi-season contract could exist at all.
 *
 * Shared by the places that start or renew a player contract (routes/contracts.ts
 * and the rest). One lookup, so they cannot disagree about when a season ends.
 * Staff and medical contracts end on 7 January instead (staffContractPatch).
 *
 * Also which lengths a club may offer a player (Rob, 24 Oct): the 6-month
 * option is the career's current club's (playerContractPartyFor).
 */
import { db, seasonsTable, careerSavesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import {
  staffContractEndDate, playerContractParty, type ContractLength, type ContractParty,
} from "./contractTerms.js";

/** Every season end this career knows about, from `from` onwards, in order. */
export async function seasonEndsFrom(careerSaveId: number, from: string): Promise<string[]> {
  const rows = await db.select({ endDate: seasonsTable.endDate })
    .from(seasonsTable)
    .where(eq(seasonsTable.careerSaveId, careerSaveId))
    .orderBy(asc(seasonsTable.endDate));
  return rows.map((r) => r.endDate).filter((e) => e >= from);
}

/**
 * The same list, inside a transaction.
 *
 * The sixty AI clubs sign and renew on the same season ends the player's club
 * does (utils/poolClubFinances.ts), and they do it inside the transaction that
 * is already charging them, which better-sqlite3 cannot await.
 */
export function seasonEndsForCareerTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0], careerSaveId: number, from?: string,
): string[] {
  const rows = tx.select({ endDate: seasonsTable.endDate })
    .from(seasonsTable)
    .where(eq(seasonsTable.careerSaveId, careerSaveId))
    .orderBy(asc(seasonsTable.endDate))
    .all();
  const ends = rows.map((r) => r.endDate);
  return from ? ends.filter((e) => e >= from) : ends;
}

/**
 * The three career-state columns that make a staff or medical contract real.
 *
 * `career_staff_state.contract_length` was a months integer that no code path
 * ever read, so a coach hired in season 1 was still on the payroll in season 30
 * and the only way out was a manual termination. These columns are what the
 * calendar tick expires. Rob, 24 Oct: the deal ends on 7 January.
 */
export function staffContractPatch(
  length: ContractLength,
  today: string,
): { contractTerm: string; contractStartDate: string; contractEndDate: string } {
  return {
    contractTerm: length,
    contractStartDate: today,
    contractEndDate: staffContractEndDate(length, today),
  };
}

/** Rob, 24 Oct (B3): whether `teamId` is the club this career controls now, as the party a player deal there is with. */
export async function playerContractPartyFor(careerSaveId: number, teamId: number): Promise<ContractParty> {
  const [save] = await db.select({ teamId: careerSavesTable.teamId }).from(careerSavesTable).where(eq(careerSavesTable.id, careerSaveId));
  return playerContractParty(save?.teamId === teamId);
}

/** The same, inside a transaction. */
export function playerContractPartyTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0], careerSaveId: number, teamId: number,
): ContractParty {
  const save = tx.select({ teamId: careerSavesTable.teamId }).from(careerSavesTable).where(eq(careerSavesTable.id, careerSaveId)).get();
  return playerContractParty(save?.teamId === teamId);
}
