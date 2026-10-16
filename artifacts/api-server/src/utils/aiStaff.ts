/**
 * Update 1, overnight brief part 1a (Rob, 14 Oct): the AI clubs take staff
 * from the market on Day 8. Rob, 16 Oct: on Jan 8 of every season, and only
 * then. An AI staff contract that ends goes back to the market that day; the
 * gap it leaves stays until the next Jan 8, when every AI club with a gap hires
 * from what is on the market by the same rules.
 *
 * Every AI club employs at least one coach (a Head Coach or an Assistant Coach)
 * and one medical member, picked at random: a Doctor or Physiotherapist while
 * one is spare, a Massage Therapist or Medical Specialist only after (Rob,
 * 16 Oct: those two don't treat injuries alone). On a normal contract of a random
 * length (6m / 1s / 2s, utils/contractTerms.ts). The signing fee (one month's
 * salary, routes/staff.ts) and the weekly wages come out of the AI club's
 * balance (utils/poolClubFinances.ts), never the salary cap. Someone at an AI
 * club is off the market (career_staff_state.pool_team_id) until the contract
 * ends; then they are back on it, the same as when the player's contract ends.
 *
 * The world has only 10 of each role and every member has a portrait made for
 * them (images/staff/), so new staff cannot be made without new pictures. So
 * the deal takes only what is spare: at least AI_STAFF.marketFloor of every
 * role stays on the market for the player. A club that misses out waits for
 * the next Jan 8. docs/STATUS-UPDATE1-OVERNIGHT.md says how many pictures of
 * which roles would let every club have both.
 *
 * An AI club's staff are stored exactly as the player's are, so the shared
 * bonus rules read either (loadStaffTx(tx, cid, { poolTeamId })).
 */
import {
  careerSavesTable, careerStaffStateTable, staffTable, careerPoolTeamStateTable, calendarStateTable,
  normaliseRole, type StaffRoleKey,
} from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { withCareerStateTx, type CareerStateTx, type CareerStaffFields } from "../lib/playerDto.js";
import { CONTRACT_LENGTHS, contractEndDate } from "./contractTerms.js";
import { seasonEndsForCareerTx } from "./seasonDates.js";

/** Every tunable number of the AI staff deal, in one place. */
export const AI_STAFF = {
  /** The day of January the AI clubs take their staff, every season (Day 8 of a new career: it starts on Jan 1). */
  dealDay: 8,
  /** At least this many of every role stay on the market for the player. */
  marketFloor: 5,
  /** One of these per AI club... */
  coachingRoles: ["head_coach", "assistant_coach"] as readonly StaffRoleKey[],
  /** ...and one of these. */
  medicalRoles: ["doctor", "physiotherapist", "massage_therapist", "medical_specialist"] as readonly StaffRoleKey[],
  /** The roles a club takes first while one is spare (the medic: a doctor or physio before the other two). */
  firstChoice: ["doctor", "physiotherapist"] as readonly StaffRoleKey[],
} as const;

/** What a staff contract ending leaves: back on the market, wage as it was (routes/calendar.ts, here). */
export const STAFF_BACK_ON_MARKET: Partial<CareerStaffFields> = {
  teamId: null, poolTeamId: null, isAvailable: true,
  contractTerm: null, contractStartDate: null, contractEndDate: null,
  offCause: null, offSince: null, offDaysLeft: 0,
};

/** The game date of Day `AI_STAFF.dealDay`, for a career whose first day is `firstDay` (Jan 1: Jan 8). */
/** Rob, 16 Oct: the AI clubs hire staff on this day of every season (Jan 8) and on no other. */
export function isAiStaffDealDay(today: string): boolean {
  return today.slice(5, 10) === `01-${String(AI_STAFF.dealDay).padStart(2, "0")}`;
}

export function aiStaffDealDate(firstDay: string): string {
  const d = new Date(`${firstDay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + AI_STAFF.dealDay - 1);
  return d.toISOString().slice(0, 10);
}

type Row = { staffId: number; role: StaffRoleKey | null; teamId: number | null; poolTeamId: number | null; salary: number; contractEndDate: string | null };

function shuffle<T>(xs: T[], random: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Every career staff row with its role (AI clubs', the player's and the market's). */
function staffRowsTx(w: CareerStateTx, careerSaveId: number): Row[] {
  return w.tx.select({
    staffId: careerStaffStateTable.staffId, role: staffTable.role,
    teamId: careerStaffStateTable.teamId, poolTeamId: careerStaffStateTable.poolTeamId,
    salary: careerStaffStateTable.salary, contractEndDate: careerStaffStateTable.contractEndDate,
  }).from(careerStaffStateTable)
    .innerJoin(staffTable, eq(staffTable.id, careerStaffStateTable.staffId))
    .where(eq(careerStaffStateTable.careerSaveId, careerSaveId))
    .all()
    .map((r) => ({ ...r, role: normaliseRole(r.role), salary: Number(r.salary) }));
}

/** The AI clubs' staff contracts that have run out go back to the market (every day). */
export function endAiStaffContractsTx(w: CareerStateTx, careerSaveId: number, today: string): number {
  let ended = 0;
  for (const r of staffRowsTx(w, careerSaveId)) {
    if (r.poolTeamId != null && r.contractEndDate != null && r.contractEndDate < today) {
      w.setStaffState(careerSaveId, r.staffId, STAFF_BACK_ON_MARKET);
      ended++;
    }
  }
  return ended;
}

/**
 * Give every AI club that has no coach one coach, and every one with no
 * medical member one medical member (a doctor or physio while one is spare),
 * while at least AI_STAFF.marketFloor of each role stay on the market. Clubs go
 * in random order. A club that cannot pay the signing fee (one month's salary,
 * the player's rule) waits for the next deal.
 */
export function hireAiStaffTx(
  w: CareerStateTx, careerSaveId: number, today: string, seasonEnds: readonly string[], random: () => number = Math.random,
): number {
  const rows = staffRowsTx(w, careerSaveId);
  const clubs = w.tx.select({ poolTeamId: careerPoolTeamStateTable.poolTeamId, balance: careerPoolTeamStateTable.balance })
    .from(careerPoolTeamStateTable)
    .where(and(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), isNull(careerPoolTeamStateTable.takenOverAt)))
    .all();

  const market = rows.filter((r) => r.teamId == null && r.poolTeamId == null);
  const spare = (role: StaffRoleKey) => market.filter((r) => r.role === role).length - AI_STAFF.marketFloor;

  let hired = 0;
  for (const club of shuffle(clubs, random)) {
    let balance = Number(club.balance);
    const has = rows.filter((r) => r.poolTeamId === club.poolTeamId);
    for (const group of [AI_STAFF.coachingRoles, AI_STAFF.medicalRoles]) {
      if (has.some((r) => r.role != null && group.includes(r.role))) continue;
      const spareRoles = group.filter((role) => spare(role) > 0);
      if (spareRoles.length === 0) continue;
      const first = spareRoles.filter((role) => AI_STAFF.firstChoice.includes(role));
      const roles = first.length > 0 ? first : spareRoles;
      const role = roles[Math.floor(random() * roles.length)]!;
      const pool = market.filter((r) => r.role === role);
      const pick = pool[Math.floor(random() * pool.length)]!;
      if (balance < pick.salary) continue;
      const length = CONTRACT_LENGTHS[Math.floor(random() * CONTRACT_LENGTHS.length)]!;
      w.setStaffState(careerSaveId, pick.staffId, {
        poolTeamId: club.poolTeamId, isAvailable: false,
        contractTerm: length, contractStartDate: today, contractEndDate: contractEndDate(length, today, seasonEnds),
      });
      balance -= pick.salary;
      pick.poolTeamId = club.poolTeamId;
      market.splice(market.indexOf(pick), 1);
      hired++;
    }
    if (balance !== Number(club.balance)) {
      w.tx.update(careerPoolTeamStateTable).set({ balance, updatedAt: new Date() })
        .where(and(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), eq(careerPoolTeamStateTable.poolTeamId, club.poolTeamId)))
        .run();
    }
  }
  return hired;
}

/**
 * The day's AI staff step (routes/calendar.ts). Every day the AI clubs' ended
 * contracts go back to the market. On Jan 8 of every season, and on no other
 * day (Rob, 16 Oct), every AI club with a gap hires; a new career's first deal
 * is its Day 8 (aiStaffDealOn), marked dealt then.
 */
export function aiStaffDayTx(w: CareerStateTx, careerSaveId: number, today: string): { hired: number; ended: number } | null {
  const [save] = w.tx.select({ on: careerSavesTable.aiStaffDealOn, at: careerSavesTable.aiStaffDealtAt })
    .from(careerSavesTable).where(eq(careerSavesTable.id, careerSaveId)).all();
  if (!save) return null;
  const ended = endAiStaffContractsTx(w, careerSaveId, today);
  // An older career not dealt yet waits for the boot's deal (dealAiStaffToOlderCareers).
  if (save.at == null && save.on == null) return { hired: 0, ended };
  if (!isAiStaffDealDay(today) || (save.on != null && today < save.on)) return { hired: 0, ended };
  if (save.at == null) w.tx.update(careerSavesTable).set({ aiStaffDealtAt: today }).where(eq(careerSavesTable.id, careerSaveId)).run();
  return { hired: hireAiStaffTx(w, careerSaveId, today, seasonEndsForCareerTx(w.tx, careerSaveId, today)), ended };
}

/**
 * Boot: a career made before the AI clubs had staff (neither date set) is
 * dealt once, the same way, on its current game date. A career whose calendar
 * has not started yet waits for a later boot. Returns how many were dealt.
 */
export function dealAiStaffToOlderCareers(): number {
  const careers = withCareerStateTx((w) => w.tx.select({ id: careerSavesTable.id, today: calendarStateTable.currentDate })
    .from(careerSavesTable)
    .innerJoin(calendarStateTable, eq(calendarStateTable.teamId, careerSavesTable.teamId))
    .where(and(isNull(careerSavesTable.aiStaffDealOn), isNull(careerSavesTable.aiStaffDealtAt))).all());
  for (const { id, today } of careers) {
    withCareerStateTx((w) => {
      w.tx.update(careerSavesTable).set({ aiStaffDealOn: today, aiStaffDealtAt: today }).where(eq(careerSavesTable.id, id)).run();
      endAiStaffContractsTx(w, id, today);
      hireAiStaffTx(w, id, today, seasonEndsForCareerTx(w.tx, id, today));
    });
  }
  return careers.length;
}
