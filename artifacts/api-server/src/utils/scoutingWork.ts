/**
 * 1.1.1, Part 10 (Rob, S-1 A): the scouting limit.
 *
 * Each person who scouts (a Scout, a Head Coach or an Assistant Coach) works on
 * at most SCOUT_REPORTS_AT_ONCE reports at a time: players, youths, staff and
 * medical alike, and a youth deal's negotiation (utils/youthDeals.ts). A report
 * goes to the best of the right people who is on duty and free; with nobody
 * free, the request is refused in plain words, naming who is busy and the day
 * the next report finishes. A Scout away on a continental youth mission
 * (continental_scouting_missions.assigned_staff_id, until its end date) works on
 * no reports until it ends. AI clubs follow the same rule (they send no
 * missions). The work is kept in scouting_jobs.
 *
 * Who may do what (the rules before this one, unchanged):
 *   a player or youth report     a Scout (routes/players.ts)
 *   a staff or medical report    a Scout, Head Coach or Assistant Coach (routes/staff.ts)
 *   a youth deal's negotiation   a Scout, else a Head or Assistant Coach (utils/youthDeals.ts)
 */
import {
  scoutingJobsTable, continentalScoutingMissionsTable, normaliseRole, staffOnDuty, SCOUT_REPORTS_AT_ONCE, type StaffRoleKey,
} from "@workspace/db";
import { and, eq, gt } from "drizzle-orm";
import { loadStaffTx, type CareerStateTx } from "../lib/playerDto.js";
import { gameDateText } from "./gameDate.js";

type Tx = CareerStateTx["tx"];
export type ScoutClub = { teamId: number } | { poolTeamId: number };
const isTeam = (c: ScoutClub): c is { teamId: number } => "teamId" in c;

export type ScoutJobKind = "player" | "youth" | "staff" | "medical" | "youth_deal";
export type Scouter = { id: number; name: string; role: StaffRoleKey; rating: number };

const day = (d: Date | string) => (typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10));

/** A club's work still in progress on `today` (ready later than today). */
export function jobsInProgressTx(tx: Tx, careerSaveId: number, club: ScoutClub, today: string) {
  return tx.select().from(scoutingJobsTable).where(and(
    eq(scoutingJobsTable.careerSaveId, careerSaveId),
    isTeam(club) ? eq(scoutingJobsTable.teamId, club.teamId) : eq(scoutingJobsTable.poolTeamId, club.poolTeamId),
    gt(scoutingJobsTable.readyOn, today),
  )).all();
}

/** The continental youth mission a Scout of the player's club is away on today, if any. */
export function missionAwayTx(tx: Tx, teamId: number, staffId: number, today: string): { region: string; endsOn: string } | null {
  const m = tx.select().from(continentalScoutingMissionsTable).where(and(
    eq(continentalScoutingMissionsTable.teamId, teamId), eq(continentalScoutingMissionsTable.assignedStaffId, staffId),
    eq(continentalScoutingMissionsTable.status, "active"),
  )).all().find((r) => day(r.endDate) > today);
  return m ? { region: m.region, endsOn: day(m.endDate) } : null;
}

/** Everyone at the club who scouts, with what each is working on (the Staff page). */
export function scoutingWorkTx(tx: Tx, careerSaveId: number, club: ScoutClub, today: string) {
  const jobs = jobsInProgressTx(tx, careerSaveId, club, today);
  return loadStaffTx(tx, careerSaveId, isTeam(club) ? { teamId: club.teamId } : { poolTeamId: club.poolTeamId })
    .filter((s) => ["scout", "head_coach", "assistant_coach"].includes(normaliseRole(s.role ?? "") ?? ""))
    .map((s) => {
      const mine = jobs.filter((j) => j.staffId === s.id).sort((a, b) => a.readyOn.localeCompare(b.readyOn));
      const mission = isTeam(club) ? missionAwayTx(tx, club.teamId, s.id, today) : null;
      return {
        id: s.id, name: s.name, role: s.role, imageUrl: s.imageUrl, rating: s.scoutingRating ?? s.overallRating, onDuty: staffOnDuty(s),
        reports: mine.map((j) => ({ kind: j.kind, name: j.targetName, startedOn: j.startedOn, readyOn: j.readyOn })),
        mission, free: mission ? 0 : Math.max(0, SCOUT_REPORTS_AT_ONCE - mine.length),
      };
    });
}

/**
 * The person who takes the next job: among `roles` (in order of preference:
 * a Scout before a coach where both may), those on duty and free, the best by
 * scouting rating. `busy` is the plain refusal when everyone who could is
 * busy; null when nobody of those roles is on duty at all (the caller's own
 * message then: no Scout hired, or off ill).
 */
export function pickScouterTx(tx: Tx, careerSaveId: number, club: ScoutClub, roleGroups: StaffRoleKey[][], today: string):
  { scouter: Scouter; busy: null } | { scouter: null; busy: string | null } {
  const work = scoutingWorkTx(tx, careerSaveId, club, today).filter((w) => w.onDuty);
  const roleOf = (w: { role: string | null }) => normaliseRole(w.role ?? "") as StaffRoleKey;
  for (const roles of roleGroups) {
    const free = work.filter((w) => roles.includes(roleOf(w)) && w.free > 0).sort((a, b) => b.rating - a.rating || a.id - b.id)[0];
    if (free) return { scouter: { id: free.id, name: free.name, role: roleOf(free), rating: free.rating }, busy: null };
  }
  const able = work.filter((w) => roleGroups.flat().includes(roleOf(w)));
  if (able.length === 0) return { scouter: null, busy: null };
  // Everyone who could is busy: who, and the first day one of them is free again.
  const parts = able.map((w) => w.mission
    ? `${w.name} is away on a scouting mission in ${w.mission.region} until ${gameDateText(w.mission.endsOn)}`
    : `${w.name} is working on ${w.reports.length} reports (the next is ready on ${gameDateText(w.reports[0]!.readyOn)})`);
  const nextFree = able.map((w) => w.mission ? w.mission.endsOn : w.reports[0]!.readyOn).sort()[0]!;
  const who = parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
  return { scouter: null, busy: `${who}. Each can work on ${SCOUT_REPORTS_AT_ONCE} reports at a time: no one can start another until ${gameDateText(nextFree)}.` };
}

/** Put a job on someone's list. */
export function addScoutingJobTx(tx: Tx, careerSaveId: number, club: ScoutClub, staffId: number,
  job: { kind: ScoutJobKind; targetId: number; targetName: string; startedOn: string; readyOn: string }): void {
  tx.insert(scoutingJobsTable).values({
    careerSaveId, staffId, teamId: isTeam(club) ? club.teamId : null, poolTeamId: isTeam(club) ? null : club.poolTeamId, ...job,
  }).run();
}
