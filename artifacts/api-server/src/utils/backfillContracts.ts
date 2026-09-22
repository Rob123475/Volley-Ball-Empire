/**
 * Nobody at a club is there without a contract.
 *
 * ── Rob's rule (22 Sep, final) ──────────────────────────────────────────────
 * "EVERY player, staff member and medical staff member has a contract." That
 * has to be true of saves made before contracts covered staff at all, and of
 * anyone a code path attaches to a club without writing one — otherwise a club
 * quietly carries people who can never expire, never renew and never cost a
 * termination.
 *
 * Runs at boot, like the other derived repairs, and again at every season
 * rollover, so a gap opened during a season is closed at the boundary rather
 * than surviving into the next one.
 *
 * ── What it does NOT do ─────────────────────────────────────────────────────
 * It never touches anyone who already has a live contract, and it does not
 * invent a length: a backfilled deal is one season (DEFAULT_CONTRACT_LENGTH),
 * the shortest term that carries someone to a natural decision point instead of
 * expiring them mid-season out of nowhere.
 *
 * Academy players are excluded. Their terms are the academy's (R-63), they are
 * not senior contracts, and routes/contracts.ts refuses to renew or terminate
 * them for the same reason. "In the academy" is the game's own definition —
 * a youth player this career has not promoted (utils/playerClassification.ts) —
 * not "has academy contract years left", which is a number that counts down to
 * zero and is cleared on promotion.
 *
 * ── Why there is no raw SQL here ────────────────────────────────────────────
 * Career state is written through lib/playerDto.ts and nowhere else
 * (scripts/check-write-boundaries.cjs enforces it): two of these columns also
 * still exist on the old tables holding stale data, so a raw UPDATE naming one
 * can silently write to the wrong place. Everything below goes through the
 * transaction wrapper's typed setters.
 */
import {
  careerSavesTable, careerPlayerStateTable, careerStaffStateTable,
  calendarStateTable, seasonsTable, contractsTable, playersTable,
} from "@workspace/db";
import { and, eq, isNotNull, asc, or, ne } from "drizzle-orm";
import { withCareerStateTx, type CareerStateTx } from "../lib/playerDto.js";
import { DEFAULT_CONTRACT_LENGTH, contractEndDate } from "./contractTerms.js";

export type ContractBackfill = {
  players: number;
  staff: number;
  careersScanned: number;
};

/**
 * Give everyone at this club who has no contract the default one.
 *
 * Synchronous on purpose: the rollover calls it inside its own transaction, so
 * the backfill commits or rolls back with the season it belongs to.
 */
export function backfillCareerContracts(
  w: CareerStateTx, careerSaveId: number, today: string,
): { players: number; staff: number } {
  const { tx } = w;
  const out = { players: 0, staff: 0 };

  const ends = tx.select({ endDate: seasonsTable.endDate }).from(seasonsTable)
    .where(eq(seasonsTable.careerSaveId, careerSaveId))
    .orderBy(asc(seasonsTable.endDate))
    .all()
    .map((r) => r.endDate)
    .filter((e) => e >= today);
  const end = contractEndDate(DEFAULT_CONTRACT_LENGTH, today, ends);

  // ── Players at a club with no live contract row ───────────────────────────
  const live = new Set(
    tx.select({ playerId: contractsTable.playerId, teamId: contractsTable.teamId })
      .from(contractsTable)
      .where(eq(contractsTable.status, "active"))
      .all()
      .map((c) => `${c.playerId}:${c.teamId}`),
  );

  const atClub = tx.select({
    playerId: careerPlayerStateTable.playerId,
    teamId:   careerPlayerStateTable.teamId,
    salary:   careerPlayerStateTable.salary,
  })
    .from(careerPlayerStateTable)
    .innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
    .where(and(
      eq(careerPlayerStateTable.careerSaveId, careerSaveId),
      isNotNull(careerPlayerStateTable.teamId),
      eq(careerPlayerStateTable.isRetired, false),
      or(ne(playersTable.playerType, "youth"), eq(careerPlayerStateTable.isPromoted, true)),
    ))
    .all();

  for (const p of atClub) {
    if (live.has(`${p.playerId}:${p.teamId}`)) continue;
    tx.insert(contractsTable).values({
      playerId: p.playerId,
      teamId: p.teamId!,
      salary: Number(p.salary ?? 0),
      startDate: today,
      endDate: end,
      bonusPerWin: 0,
    }).run();
    w.setPlayerState(careerSaveId, p.playerId, { contractEndDate: end });
    out.players++;
  }

  // ── Staff and medical at a club with no contract dates ────────────────────
  const staff = tx.select().from(careerStaffStateTable)
    .where(and(
      eq(careerStaffStateTable.careerSaveId, careerSaveId),
      isNotNull(careerStaffStateTable.teamId),
    ))
    .all();

  for (const m of staff) {
    if (m.contractEndDate) continue;
    w.setStaffState(careerSaveId, m.staffId, {
      contractTerm: DEFAULT_CONTRACT_LENGTH,
      contractStartDate: today,
      contractEndDate: end,
    });
    out.staff++;
  }

  return out;
}

/** The rollover's entry point: the boundary date is the new season's first day. */
export function backfillContractsTx(
  w: CareerStateTx, careerSaveId: number, today: string,
): { players: number; staff: number } {
  return backfillCareerContracts(w, careerSaveId, today);
}

/** Every career in the save, at boot. */
export function backfillContracts(): ContractBackfill {
  return withCareerStateTx((w) => {
    const { tx } = w;
    const out: ContractBackfill = { players: 0, staff: 0, careersScanned: 0 };

    for (const career of tx.select().from(careerSavesTable).all()) {
      // The clock this career is on, or its first season's start if it has
      // never advanced a day.
      const cal = career.teamId == null ? undefined
        : tx.select({ d: calendarStateTable.currentDate }).from(calendarStateTable)
            .where(eq(calendarStateTable.teamId, career.teamId)).all()[0];
      const firstSeason = tx.select({ d: seasonsTable.startDate }).from(seasonsTable)
        .where(eq(seasonsTable.careerSaveId, career.id))
        .orderBy(asc(seasonsTable.startDate)).all()[0];
      const today = cal?.d ?? firstSeason?.d;
      if (!today) continue;

      out.careersScanned++;
      const filled = backfillCareerContracts(w, career.id, today);
      out.players += filled.players;
      out.staff += filled.staff;
    }

    return out;
  });
}
