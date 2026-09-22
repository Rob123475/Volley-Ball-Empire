/**
 * The season end dates a contract length is measured against.
 *
 * L-02a: a "season" contract must end when the season ends. A season is
 * 418-421 days, not 365, so the old `addOneYear` arithmetic drifted off the
 * season it was meant to cover — and because it also capped every deal at one
 * year, no multi-season contract could exist at all.
 *
 * Shared by the three places that start or renew a contract: player signing and
 * renewal (routes/contracts.ts), staff hiring (routes/staff.ts) and medical
 * hiring (routes/medical-staff.ts). One lookup, so the three cannot disagree
 * about when a season ends.
 */
import { db, seasonsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import {
  contractEndDate, type ContractLength,
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
 * The three career-state columns that make a staff or medical contract real.
 *
 * `career_staff_state.contract_length` was a months integer that no code path
 * ever read, so a coach hired in season 1 was still on the payroll in season 30
 * and the only way out was a manual termination. These columns are what the
 * calendar tick expires.
 */
export async function staffContractPatch(
  careerSaveId: number,
  length: ContractLength,
  today: string,
): Promise<{ contractTerm: string; contractStartDate: string; contractEndDate: string }> {
  const ends = await seasonEndsFrom(careerSaveId, today);
  return {
    contractTerm: length,
    contractStartDate: today,
    contractEndDate: contractEndDate(length, today, ends),
  };
}
