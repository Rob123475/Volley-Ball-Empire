/**
 * Update 1, night 2 (Rob, 15 Oct, O-7, O-8, O-10): real injuries, treated by
 * the right person, for every club. The numbers are lib/db schema/injuries.ts.
 *
 *   what      a hurt player gets a named injury (by its share), or, if it is her
 *             third to the same body area within a year (her history, at any
 *             club; 1-week injuries don't count), that area's reconstruction (O-8)
 *   how long  base weeks x the treatment factor of her club's medical staff on
 *             duty: a doctor or physio, the right one, both (O-9), or for a
 *             reconstruction the medical specialist (O-8)
 *   live      she keeps her base weeks still to heal (injury_base_weeks_left);
 *             a week of rest takes (1 + the Medical Centre's share) / factor of
 *             them off, and her weeks out are always base left x today's
 *             factor. Hire the right person and what is left shrinks; lose them
 *             and it grows back. Nothing already healed is ever given back.
 *   serious   4+ weeks out when she is hurt, or any reconstruction (B-2: -1
 *             speed and stamina, -5% XP), and an injured free agent asks less (4c)
 *   the list  more than INJURED_LIST.overWeeks out: the injured list (O-10,
 *             utils/injuredList.ts)
 *
 * How often a player is hurt is the one match injury roll, unchanged
 * (utils/condition.ts matchInjuryRoll).
 */
import {
  careerPlayerStateTable, careerInjuriesTable, playersTable, facilitiesTable, careerPoolTeamStateTable, careerSavesTable, db, sqlite, MONEY,
  INJURY_TYPES, INJURY_TREATMENT, RECONSTRUCTION, INJURED_LIST, LEGACY_INJURIES, injuryInfo, reconstructionName,
  type BodyArea,
} from "@workspace/db";
import { and, eq, gte, inArray, isNotNull, isNull, ne, or } from "drizzle-orm";
import { loadStaffTx, withCareerStateTx, type CareerStateTx, type CareerPlayerFields } from "../lib/playerDto.js";
import { medicalTeam, skillScale } from "./staffBonuses.js";

type Member = { role: string; skillLevel: number; offDaysLeft?: number | null };
type Team = ReturnType<typeof medicalTeam<Member>>;

/** Whose players: a club (the player's or an AI club) or the free agents (no staff). */
export type InjuryClub = { teamId: number } | { poolTeamId: number } | "free agents";

const round2 = (x: number) => Math.round(x * 100) / 100;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The club's staff, as utils/staffBonuses.ts reads them (none for the free agents). */
export function staffOfTx(w: CareerStateTx, careerSaveId: number, club: InjuryClub): Member[] {
  return club === "free agents" ? [] : loadStaffTx(w.tx, careerSaveId, club);
}

/** O-7 / O-8: the treatment factor on this injury's base weeks, with this medical team on duty. */
export function treatmentFactor(injuryName: string | null | undefined, team: Team): number {
  const info = injuryInfo(injuryName);
  const doctorOrPhysio = !!team.doctor || !!team.physiotherapist;
  if (info?.reconstruction) {
    const f = RECONSTRUCTION.factor;
    return team.specialist ? (doctorOrPhysio ? f.specialistWithDoctorOrPhysio : f.specialist) : doctorOrPhysio ? f.doctorOrPhysio : f.none;
  }
  const treater = info?.treatedBy === "doctor" ? "doctor" : "physiotherapist";
  const right = team[treater], other = treater === "doctor" ? team.physiotherapist : team.doctor;
  const T = INJURY_TREATMENT;
  if (right && other) return lerp(T.both.at50, T.both.at95, skillScale(right));
  if (right) return lerp(T.right.at50, T.right.at95, skillScale(right));
  return other ? T.wrong : T.none;
}

/** A named injury, by its share of all injuries. */
export function rollInjuryType(random: () => number = Math.random): (typeof INJURY_TYPES)[number] {
  let r = random();
  for (const t of INJURY_TYPES) { if (r < t.share) return t; r -= t.share; }
  return INJURY_TYPES[0]!;
}

/** The game date a year (RECONSTRUCTION.windowDays) before `today`. */
function windowStart(today: string): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - RECONSTRUCTION.windowDays);
  return d.toISOString().slice(0, 10);
}

/** Her injuries to `area` in the year to `today` (any club) that count toward a reconstruction (not a 1-week one). */
export function injuriesInAreaTx(w: CareerStateTx, careerSaveId: number, playerId: number, area: BodyArea | string, today: string): number {
  return w.tx.select({ id: careerInjuriesTable.id }).from(careerInjuriesTable)
    .where(and(eq(careerInjuriesTable.careerSaveId, careerSaveId), eq(careerInjuriesTable.playerId, playerId),
      eq(careerInjuriesTable.area, area), gte(careerInjuriesTable.gameDate, windowStart(today)),
      gte(careerInjuriesTable.baseWeeks, RECONSTRUCTION.minBaseWeeks)))
    .all().length;
}

/** O-10: the squad role of a player on the injured list (her starter or interchange place is free). */
export const INJURED_LIST_ROLE = "injured";

export type NewInjury = { name: string; area: BodyArea; baseWeeks: number; weeks: number; reconstruction: boolean; serious: boolean; onInjuredList: boolean };

/**
 * A player has just been hurt (the match roll said so): what it is, how long,
 * and everything it writes to her (state and history). Every club's injuries
 * start here, the player's (routes/matches.ts) and the AI clubs'
 * (utils/aiSquads.ts).
 */
export function startInjuryTx(
  w: CareerStateTx, careerSaveId: number, club: InjuryClub,
  p: { id: number; speed: number; stamina: number; seriousInjuries?: number | null },
  today: string, random: () => number = Math.random, injuryName?: string,
): NewInjury {
  // `injuryName`: the harness's probe (routes/dev.ts) chooses the injury; the game always rolls it.
  const rolled = (injuryName ? INJURY_TYPES.find((t) => t.name === injuryName) : undefined) ?? rollInjuryType(random);
  // A 1-week injury is never the third (Rob, 16 Oct): it stays what it is.
  const reconstruction = rolled.baseWeeks >= RECONSTRUCTION.minBaseWeeks
    && injuriesInAreaTx(w, careerSaveId, p.id, rolled.area, today) >= RECONSTRUCTION.injuriesInArea - 1;
  const name = reconstruction ? reconstructionName(rolled.area) : rolled.name;
  const baseWeeks = reconstruction ? RECONSTRUCTION.baseWeeks : rolled.baseWeeks;
  const weeks = round2(baseWeeks * treatmentFactor(name, medicalTeam(staffOfTx(w, careerSaveId, club))));
  const serious = reconstruction || weeks >= MONEY.salaryCap.injuredLongWeeks;
  // A free agent has no senior place to give up: only a club's player goes on the list.
  const onInjuredList = club !== "free agents" && weeks > INJURED_LIST.overWeeks;
  const patch: Partial<CareerPlayerFields> = {
    injuryStatus: name, injuryArea: rolled.area, injuryBaseWeeksLeft: baseWeeks, injuryWeeksRemaining: weeks, isInjured: true,
    // O-10: on the list she leaves her match place (squad role "injured", not active).
    ...(onInjuredList ? { onInjuredList: true, injuredListSince: today, injuredListSquad: seniorIdsTx(w, careerSaveId, club, p.id).join(","), squadRole: INJURED_LIST_ROLE, isActive: false } : {}),
    // B-2: a serious injury costs 1 speed and 1 stamina at once (never below 1) and goes on her record.
    ...(serious ? { speed: Math.max(1, p.speed - 1), stamina: Math.max(1, p.stamina - 1), seriousInjuries: Number(p.seriousInjuries ?? 0) + 1 } : {}),
  };
  w.setPlayerState(careerSaveId, p.id, patch);
  w.tx.insert(careerInjuriesTable).values({
    careerSaveId, playerId: p.id, injury: name, area: rolled.area, gameDate: today, weeksOut: weeks, baseWeeks, reconstruction,
    teamId: club !== "free agents" && "teamId" in club ? club.teamId : null,
    poolTeamId: club !== "free agents" && "poolTeamId" in club ? club.poolTeamId : null,
  }).run();
  return { name, area: rolled.area, baseWeeks, weeks, reconstruction, serious, onInjuredList };
}

/** A club's seniors (career rows, signed or promoted, not retired) other than `except`. */
export function seniorIdsTx(w: CareerStateTx, careerSaveId: number, club: InjuryClub, except?: number): number[] {
  if (club === "free agents") return [];
  const s = careerPlayerStateTable;
  return w.tx.select({ id: s.playerId }).from(s).innerJoin(playersTable, eq(playersTable.id, s.playerId))
    .where(and(eq(s.careerSaveId, careerSaveId), eq(s.isRetired, false),
      "teamId" in club ? eq(s.teamId, club.teamId) : and(isNull(s.teamId), eq(s.poolTeamId, club.poolTeamId)),
      or(eq(playersTable.playerType, "senior"), eq(s.isPromoted, true))))
    .all().map((r) => r.id).filter((id) => id !== except);
}

/** One week of rest for an injury: the base weeks it takes off at this factor (and Medical Centre level). */
export function restWeek(baseLeft: number, factor: number, medCentreLevel = 1): number {
  const facilityWeeks = (medCentreLevel - 1) * (1 / 9);
  return Math.max(0, baseLeft - (1 + facilityWeeks) / factor);
}

/**
 * Her base weeks still to heal. An injury written without them (one an older
 * save carried in, the boot conversion's own rule) takes what gives her weeks
 * out at today's factor.
 */
export function baseLeftOf(p: { injuryBaseWeeksLeft?: number | null; injuryWeeksRemaining?: number | null }, factor: number): number {
  const base = Number(p.injuryBaseWeeksLeft ?? 0);
  return base > 0 ? base : Math.max(0, Number(p.injuryWeeksRemaining ?? 0)) / factor;
}

/** What one week of rest writes to an injured player: healed, or her new base left and weeks out. */
export function restWeekPatch(p: { injuryStatus: string; injuryBaseWeeksLeft: number; injuryWeeksRemaining?: number | null }, factor: number, medCentreLevel = 1): Partial<CareerPlayerFields> {
  const next = restWeek(baseLeftOf(p, factor), factor, medCentreLevel);
  return next <= 1e-9
    ? { injuryWeeksRemaining: 0, injuryBaseWeeksLeft: 0, injuryStatus: "Healthy", injuryArea: null, isInjured: false }
    : { injuryBaseWeeksLeft: round2(next), injuryWeeksRemaining: round2(next * factor) };
}

function injuredOfTx(w: CareerStateTx, careerSaveId: number, club: InjuryClub) {
  const s = careerPlayerStateTable;
  const at = club === "free agents" ? [isNull(s.teamId), isNull(s.poolTeamId)]
    : "teamId" in club ? [eq(s.teamId, club.teamId)] : [isNull(s.teamId), eq(s.poolTeamId, club.poolTeamId)];
  return w.tx.select({ id: s.playerId, name: playersTable.name, status: s.injuryStatus, base: s.injuryBaseWeeksLeft, weeks: s.injuryWeeksRemaining })
    .from(s).innerJoin(playersTable, eq(playersTable.id, s.playerId))
    .where(and(eq(s.careerSaveId, careerSaveId), eq(s.isRetired, false), ...at,
      or(eq(s.isInjured, true), and(isNotNull(s.injuryStatus), ne(s.injuryStatus, "Healthy")))))
    .all();
}

function medCentreLevelTx(w: CareerStateTx, club: InjuryClub): number {
  return club !== "free agents" && "teamId" in club
    ? w.tx.select({ level: facilitiesTable.level }).from(facilitiesTable)
      .where(and(eq(facilitiesTable.teamId, club.teamId), eq(facilitiesTable.type, "medical_centre"))).get()?.level ?? 1
    : 1;
}

/**
 * A week of injury recovery, run every 7 game days by the calendar, for one
 * club or the free agents: each injured player's base weeks fall by a week of
 * rest at her club's factor today. Returns the names of those fit again.
 */
export function injuryRecoveryWeekTx(w: CareerStateTx, careerSaveId: number, club: InjuryClub): string[] {
  const players = injuredOfTx(w, careerSaveId, club);
  if (players.length === 0) return [];
  const team = medicalTeam(staffOfTx(w, careerSaveId, club));
  const level = medCentreLevelTx(w, club);
  const recovered: string[] = [];
  for (const p of players) {
    const patch = restWeekPatch({ injuryStatus: p.status, injuryBaseWeeksLeft: Number(p.base ?? 0), injuryWeeksRemaining: Number(p.weeks ?? 0) }, treatmentFactor(p.status, team), level);
    w.setPlayerState(careerSaveId, p.id, patch);
    if (patch.injuryStatus === "Healthy") recovered.push(p.name);
  }
  return recovered;
}

/** The player's club's week of recovery (routes/calendar.ts). */
export function applyWeeklyInjuryRecovery(careerSaveId: number, teamId: number): string[] {
  return withCareerStateTx((w) => injuryRecoveryWeekTx(w, careerSaveId, { teamId }));
}

function aiClubsTx(w: CareerStateTx, careerSaveId: number): number[] {
  return w.tx.select({ id: careerPoolTeamStateTable.poolTeamId }).from(careerPoolTeamStateTable)
    .where(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId)).all().map((r) => r.id);
}

/** Item 4c: the same week for every AI club's players and for the free agents. */
export function aiInjuryRecoveryWeekTx(w: CareerStateTx, careerSaveId: number): number {
  let healed = 0;
  for (const id of aiClubsTx(w, careerSaveId)) healed += injuryRecoveryWeekTx(w, careerSaveId, { poolTeamId: id }).length;
  return healed + injuryRecoveryWeekTx(w, careerSaveId, "free agents").length;
}

/**
 * Live (O-7): each injured player's weeks out, from her base weeks left and
 * her club's factor today. Run every game day for every club (routes/calendar.ts)
 * and at once when the player's club hires or loses staff. Returns how many changed.
 */
export function refreshInjuryClocksTx(w: CareerStateTx, careerSaveId: number, club: InjuryClub): number {
  const players = injuredOfTx(w, careerSaveId, club);
  if (players.length === 0) return 0;
  const team = medicalTeam(staffOfTx(w, careerSaveId, club));
  let changed = 0;
  for (const p of players) {
    const factor = treatmentFactor(p.status, team);
    if (!(Number(p.base ?? 0) > 0)) {
      // An injury with no base weeks yet (baseLeftOf): give it them, her weeks out unchanged.
      const base = round2(baseLeftOf({ injuryBaseWeeksLeft: 0, injuryWeeksRemaining: Number(p.weeks ?? 0) }, factor));
      if (base > 0) { w.setPlayerState(careerSaveId, p.id, { injuryBaseWeeksLeft: base }); changed++; }
      continue;
    }
    const weeks = round2(Number(p.base) * factor);
    if (weeks > 0 && Math.abs(weeks - Number(p.weeks ?? 0)) > 0.005) { w.setPlayerState(careerSaveId, p.id, { injuryWeeksRemaining: weeks }); changed++; }
  }
  return changed;
}

/** Every club's and the free agents' clocks (the calendar's daily step). */
export function refreshAllInjuryClocksTx(w: CareerStateTx, careerSaveId: number, teamIds: readonly number[]): number {
  let n = 0;
  for (const teamId of teamIds) n += refreshInjuryClocksTx(w, careerSaveId, { teamId });
  for (const id of aiClubsTx(w, careerSaveId)) n += refreshInjuryClocksTx(w, careerSaveId, { poolTeamId: id });
  return n + refreshInjuryClocksTx(w, careerSaveId, "free agents");
}

/** The player's club's clocks now (after a staff hire, release or contract end). */
export function refreshClubInjuryClocks(careerSaveId: number, teamId: number): number {
  return withCareerStateTx((w) => refreshInjuryClocksTx(w, careerSaveId, { teamId }));
}

/**
 * Night 2: an older save's injuries ("Minor Injury", "Major Injury",
 * "Unavailable") become a named one (LEGACY_INJURIES) of the same length: her
 * weeks out stay as they are, her base weeks left are what gives that at her
 * club's factor today, and she gets no history. Boot, every save; idempotent.
 */
/**
 * 1.1.1 (Rob's check, 17 Oct): a save from before night 2 still keeps that season's injuries in the old
 * injury_history table (the player's club's only: AI players were never injured then), which nothing reads
 * since career_injuries replaced it. They are carried into career_injuries once, named as
 * convertLegacyInjuries names them, so the Other Clubs page's injuries this season, the Medical page's
 * figures and the reconstruction rule count them. Boot, every save; a row already carried is not carried again.
 */
export function carryLegacyInjuryHistory(): number {
  if (!sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'injury_history'").get()) return 0;
  const rows = sqlite.prepare("SELECT team_id AS teamId, player_id AS playerId, injury_type AS type, days_missed AS days, date_injured AS at FROM injury_history")
    .all() as Array<{ teamId: number | null; playerId: number | null; type: string | null; days: number | null; at: number | null }>;
  let carried = 0;
  db.transaction((tx) => {
    for (const r of rows) {
      if (r.teamId == null || r.playerId == null || r.at == null) continue;
      const save = tx.select({ id: careerSavesTable.id }).from(careerSavesTable)
        .where(or(eq(careerSavesTable.teamId, r.teamId), eq(careerSavesTable.formerTeamId, r.teamId))).get();
      if (!save) continue;
      const gameDate = new Date(Number(r.at) > 1e12 ? Number(r.at) : Number(r.at) * 1000).toISOString().slice(0, 10);
      const name = LEGACY_INJURIES[r.type ?? ""] ?? r.type ?? "Minor Injury";
      const info = injuryInfo(name);
      if (!info?.area) continue;
      const already = tx.select({ id: careerInjuriesTable.id }).from(careerInjuriesTable).where(and(
        eq(careerInjuriesTable.careerSaveId, save.id), eq(careerInjuriesTable.playerId, r.playerId), eq(careerInjuriesTable.gameDate, gameDate))).get();
      if (already) continue;
      const weeks = round2(Math.max(0, Number(r.days ?? 0)) / 7);
      tx.insert(careerInjuriesTable).values({
        careerSaveId: save.id, playerId: r.playerId, injury: name, area: info.area, gameDate, weeksOut: weeks, baseWeeks: weeks, reconstruction: false, teamId: r.teamId,
      }).run();
      carried++;
    }
  });
  return carried;
}

export function convertLegacyInjuries(): { converted: number } {
  return withCareerStateTx((w) => {
    const s = careerPlayerStateTable;
    const rows = w.tx.select({ careerSaveId: s.careerSaveId, id: s.playerId, status: s.injuryStatus, weeks: s.injuryWeeksRemaining, teamId: s.teamId, poolTeamId: s.poolTeamId })
      .from(s).where(inArray(s.injuryStatus, Object.keys(LEGACY_INJURIES))).all();
    const teams = new Map<string, Team>();
    for (const r of rows) {
      const name = LEGACY_INJURIES[r.status]!;
      const club: InjuryClub = r.teamId != null ? { teamId: r.teamId } : r.poolTeamId != null ? { poolTeamId: r.poolTeamId } : "free agents";
      const key = `${r.careerSaveId}:${JSON.stringify(club)}`;
      if (!teams.has(key)) teams.set(key, medicalTeam(staffOfTx(w, r.careerSaveId, club)));
      const weeks = Math.max(0, Number(r.weeks ?? 0));
      w.setPlayerState(r.careerSaveId, r.id, {
        injuryStatus: weeks > 0 ? name : "Healthy", injuryArea: weeks > 0 ? injuryInfo(name)!.area : null,
        injuryBaseWeeksLeft: weeks > 0 ? round2(weeks / treatmentFactor(name, teams.get(key)!)) : 0,
        ...(weeks > 0 ? {} : { isInjured: false }),
      });
    }
    return { converted: rows.length };
  });
}
