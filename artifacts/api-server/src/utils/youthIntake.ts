/**
 * R-62 — an academy intake at every season boundary.
 *
 * Rob's decisions (15 Sep):
 *   who        the player's club only; the AI clubs stay fixed pairs this release
 *              (AI squad turnover is V2, docs/triage.md)
 *   how many   3 per club per intake — R-63: never past the academy's cap
 *              (ACADEMY_CAP, 12). An intake takes the places left, up to 3; an
 *              academy already full takes no one and says so
 *   when       every rollover that opens a new season, for as long as the career
 *              runs — one intake at the start of every season from season 2 on
 *   image      the same blank youth template card as the 72 shipped youth; the 89
 *              unused adult portraits are NOT for youth (a senior free-agent refresh,
 *              V2)
 *   age        16 to 18
 *   ratings    drawn from the distribution the 72 shipped youth were seeded with:
 *              each stat and height a normal draw on their mean and spread, kept
 *              inside the range they span; position and potential in their mix
 *   identity   nationality from the club's country and region: half from the
 *              club's own country, half from the other nations of its region.
 *              The name is a real first name and a real surname of that nation's
 *              shipped players (and pool-club players), recombined into a name no
 *              athlete already has — nothing is invented from outside the game
 *   joins      the club's academy: reserve, not active, an academy contract
 *              (managed by the academy, never renewed or expired as a senior
 *              contract). R-63: paid the academy's weekly wage for her potential,
 *              billed once in the weekly wage run; the stored salary is its
 *              monthly figure, so she is paid the same once promoted
 *   news       one youth_intakes row per intake; Club News reports it — who joined,
 *              that the academy is now full, that it was full, or that it found
 *              no one
 *
 * Every athlete it creates is owned by this career (players.origin_career_save_id),
 * so it never appears in another save.
 */
import {
  playersTable,
  careerPlayerStateTable,
  continentalPoolPlayersTable,
  teamsTable,
  locationsTable,
  youthIntakesTable,
  CORE_NATIONS,
  continentKeyForNationality,
  nationName,
  type ContinentKey,
} from "@workspace/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { CareerStateTx } from "../lib/playerDto.js";
import { generateDevelopment } from "./player-development.js";
import { ACADEMY_CAP, academyMonthlySalary } from "./academy.js";

export const INTAKE_SIZE = 3;
export const INTAKE_AGE_MIN = 16;
export const INTAKE_AGE_MAX = 18;

/** The blank card every youth player wears (the 72 shipped youth all point at it). */
export const YOUTH_TEMPLATE_IMAGE = "/images/players/youth/player_youth_all_01_1783432743064.webp";

/**
 * The 72 shipped youth, measured from the starter DB on 15 Sep: mean, spread
 * (population standard deviation) and the range they span. harness/youth-intake.mjs
 * re-measures the starter DB and fails if these drift from it.
 */
export const SEEDED_YOUTH_STATS = {
  speed:   { mean: 53.22,  sd: 5.17,  min: 44,  max: 64 },
  power:   { mean: 50.83,  sd: 9.12,  min: 34,  max: 74 },
  defense: { mean: 49.53,  sd: 6.84,  min: 34,  max: 64 },
  serve:   { mean: 49.25,  sd: 8.12,  min: 36,  max: 68 },
  block:   { mean: 50.39,  sd: 10.24, min: 32,  max: 76 },
  stamina: { mean: 52.83,  sd: 6.89,  min: 40,  max: 66 },
  height:  { mean: 177.49, sd: 8.2,   min: 163, max: 193 },
} as const;

/** How many of the 72 hold each position and each potential. */
export const SEEDED_YOUTH_POSITIONS: Record<string, number> = { blocker: 27, defender: 23, all_rounder: 22 };
export const SEEDED_YOUTH_POTENTIAL: Record<string, number> = { High: 47, Elite: 15, Average: 10 };

/** Half of each intake comes from the club's own country. */
const HOME_SHARE = 0.5;

function normal(mean: number, sd: number, min: number, max: number): number {
  const u = 1 - Math.random(), v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(min, Math.min(max, Math.round(mean + z * sd)));
}

function weighted(counts: Record<string, number>): string {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [k, n] of Object.entries(counts)) { r -= n; if (r < 0) return k; }
  return Object.keys(counts)[0]!;
}

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;

type Tx = CareerStateTx["tx"];

/** The club's country, and the nations of its region (the club's country first). */
export function intakeNationsTx(tx: Tx, teamId: number): { home: string | null; region: ContinentKey | null; nations: string[] } {
  const [row] = tx.select({ country: locationsTable.country })
    .from(teamsTable)
    .innerJoin(locationsTable, eq(locationsTable.id, teamsTable.locationId))
    .where(eq(teamsTable.id, teamId))
    .limit(1)
    .all();
  const home = row?.country ?? null;
  const region = continentKeyForNationality(home);
  const nations = region
    ? [...CORE_NATIONS[region]]
    : Object.values(CORE_NATIONS).flatMap((l) => [...l]);
  return { home: home && nations.includes(home) ? home : null, region, nations };
}

/**
 * The names this intake may use: every first name and surname of each nation's
 * shipped athletes and pool-club players, recombined, less every full name an
 * athlete anywhere already has.
 */
export function intakeNamePoolTx(tx: Tx, nations: readonly string[]): Map<string, string[]> {
  const shipped = tx.select({ name: playersTable.name, nationality: playersTable.nationality })
    .from(playersTable).where(isNull(playersTable.originCareerSave)).all();
  const pool = tx.select({ name: continentalPoolPlayersTable.name, nationality: continentalPoolPlayersTable.nationality })
    .from(continentalPoolPlayersTable).all();
  const taken = new Set([
    ...tx.select({ name: playersTable.name }).from(playersTable).all().map((r) => r.name),
    ...pool.map((r) => r.name),
  ]);

  const result = new Map<string, string[]>();
  for (const nation of nations) {
    const firsts = new Set<string>(), lasts = new Set<string>();
    for (const r of [...shipped, ...pool]) {
      if (!r.nationality || nationName(r.nationality) !== nationName(nation)) continue;
      const parts = r.name.trim().split(/\s+/);
      if (parts.length < 2) continue;
      const last = parts.slice(1).join(" ");
      if (last.includes(".")) continue; // an initial, not a surname
      firsts.add(parts[0]!);
      lasts.add(last);
    }
    const names: string[] = [];
    for (const f of firsts) for (const l of lasts) {
      const full = `${f} ${l}`;
      if (!taken.has(full)) names.push(full);
    }
    result.set(nation, names);
  }
  return result;
}

/** R-63: the academy's size — youth players at the club this career has not promoted. */
export function academySizeTx(tx: Tx, careerSaveId: number, teamId: number): number {
  const [row] = tx.select({ n: sql<number>`COUNT(*)` })
    .from(careerPlayerStateTable)
    .innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
    .where(and(
      eq(careerPlayerStateTable.careerSaveId, careerSaveId),
      eq(careerPlayerStateTable.teamId, teamId),
      eq(careerPlayerStateTable.isRetired, false),
      eq(careerPlayerStateTable.isPromoted, false),
      eq(playersTable.playerType, "youth"),
    ))
    .all();
  return Number(row?.n ?? 0);
}

export type IntakePlayer = { id: number; name: string; nationality: string; age: number; position: string; potential: string };
/** joined: someone came; full: the academy was at its cap; no_names: no name left in the region. */
export type IntakeOutcome = "joined" | "full" | "no_names";
export type IntakeResult = {
  seasonYear: number; intakeOn: string; players: IntakePlayer[];
  outcome: IntakeOutcome; academySize: number;
};

/**
 * Bring this season's intake into the club's academy, inside the rollover's
 * transaction, after the boundary's promotions. Idempotent: a season that
 * already has its intake returns it.
 */
export function youthIntakeTx(
  w: CareerStateTx, careerSaveId: number, teamId: number, seasonYear: number, intakeOn: string,
): IntakeResult {
  const { tx } = w;
  const [existing] = tx.select().from(youthIntakesTable)
    .where(eq(youthIntakesTable.careerSaveId, careerSaveId))
    .all()
    .filter((r) => r.seasonYear === seasonYear);
  if (existing) {
    return { seasonYear, intakeOn: existing.intakeOn, players: [], outcome: existing.outcome as IntakeOutcome, academySize: existing.academySize };
  }

  // R-63: the places left under the academy's cap, up to an intake's size.
  const sizeBefore = academySizeTx(tx, careerSaveId, teamId);
  const places = Math.max(0, Math.min(INTAKE_SIZE, ACADEMY_CAP - sizeBefore));
  const players: IntakePlayer[] = [];

  if (places > 0) {
    const { home, nations } = intakeNationsTx(tx, teamId);
    const names = intakeNamePoolTx(tx, nations);
    const others = nations.filter((n) => n !== home);

    for (let i = 0; i < places; i++) {
      // The club's country half the time, the rest of its region otherwise; a
      // nation with no name left gives way to one that has.
      const preferred = home && (others.length === 0 || Math.random() < HOME_SHARE) ? home : pick(others);
      const order = [preferred, ...nations.filter((n) => n !== preferred).sort(() => Math.random() - 0.5)];
      const nationality = order.find((n) => (names.get(n)?.length ?? 0) > 0);
      if (!nationality) break; // no name left anywhere in the club's region

      const available = names.get(nationality)!;
      const name = available.splice(Math.floor(Math.random() * available.length), 1)[0]!;
      const age = INTAKE_AGE_MIN + Math.floor(Math.random() * (INTAKE_AGE_MAX - INTAKE_AGE_MIN + 1));
      const s = SEEDED_YOUTH_STATS;
      const stats = {
        speed:   normal(s.speed.mean, s.speed.sd, s.speed.min, s.speed.max),
        power:   normal(s.power.mean, s.power.sd, s.power.min, s.power.max),
        defense: normal(s.defense.mean, s.defense.sd, s.defense.min, s.defense.max),
        serve:   normal(s.serve.mean, s.serve.sd, s.serve.min, s.serve.max),
        block:   normal(s.block.mean, s.block.sd, s.block.min, s.block.max),
        stamina: normal(s.stamina.mean, s.stamina.sd, s.stamina.min, s.stamina.max),
      };
      const position = weighted(SEEDED_YOUTH_POSITIONS);
      const potential = weighted(SEEDED_YOUTH_POTENTIAL);

      const id = w.createPlayer(careerSaveId, {
        name,
        nationality,
        baseAge: age,
        height: normal(s.height.mean, s.height.sd, s.height.min, s.height.max),
        position,
        ...stats,
        imageUrl: YOUTH_TEMPLATE_IMAGE,
        continent: continentKeyForNationality(nationality),
        playerType: "youth",
        potential,
        development: generateDevelopment(),
      }, {
        age,
        ...stats,
        teamId,
        squadRole: "reserve",
        isActive: false,
        salary: academyMonthlySalary(potential),
        academyContractYears: 2,
        morale: 75 + Math.floor(Math.random() * 16),
        fatigue: 0,
        fitness: 100,
        injuryStatus: "Healthy",
      });
      players.push({ id, name, nationality, age, position, potential });
    }
  }

  const outcome: IntakeOutcome = places === 0 ? "full" : players.length > 0 ? "joined" : "no_names";
  const academySize = sizeBefore + players.length;
  tx.insert(youthIntakesTable).values({
    careerSaveId, teamId, seasonYear, intakeOn, playerIds: players.map((p) => p.id), outcome, academySize,
  }).run();
  return { seasonYear, intakeOn, players, outcome, academySize };
}
