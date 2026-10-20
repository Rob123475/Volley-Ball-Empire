/**
 * 1.1.1 (Rob, 18 Oct; Downloads/NEW-SENIORS-BRIEF-18OCT.md, v4): new seniors, and the picture
 * decides the nation.
 *
 * About 20 new seniors enter the free-agent market at every season's turn (the rollover, 1 January
 * of the new season: the day academy graduates reach the market too):
 *
 *   NEW_SENIOR_YOUTHS (15) AI academy youths stay on at 19 instead of leaving the game: the best by
 *     potential across all AI academies, ties by a hash of the career and the player. She keeps her
 *     name and nation; her card is an unused new picture of HER OWN nation, else an unused graduate
 *     picture of her continent (utils/graduatePortraits.ts), else her flag card.
 *   NEW_SENIOR_PICTURE_PLAYERS (5) players made from unused new pictures: the nation is the
 *     picture's folder; a real name of that nation (utils/youthIntake.ts intakeNamePoolTx, which
 *     carries data/nationNames.ts for nations the game has no athletes of), a retiree's name of that nation
 *     first (the name-respawn rule); 19 to 21; stats by the
 *     youth generator (drawYouthStats) moved onto the scale of this turn's AI youths turning 19 (the
 *     mean of each stat among them, against the generator's mean); potential by the generator's mix.
 *     Nations no AI academy youth holds come first, so a nation Rob adds actually arrives.
 *
 * Every picture goes in career_graduate_portraits, so none is used twice in a career; a new picture is
 * never given to a player of another nation. When the new pictures run out, picture players stop and
 * youths fall back as above (career_new_seniors records which card each got).
 * Both are free agents at the free-agent wage rule (clubFinances.ts monthlySalaryFor her rating).
 * An existing save gets its first at its next season's turn; nothing is back-filled.
 */
import {
  careerPlayerStateTable, playersTable, careerGraduatePortraitsTable, careerNewSeniorsTable, playerRetirementsTable,
  continentKeyForNationality, nationName, type ContinentKey,
} from "@workspace/db";
import { and, eq, isNotNull } from "drizzle-orm";
import type { CareerStateTx } from "../lib/playerDto.js";
import { NEW_SENIOR_PICTURES, type NewSeniorPicture } from "../data/newSeniorPictures.js";
import { GRADUATE_PORTRAITS } from "../data/graduatePortraits.js";
import { GRADUATION_AGE, loansTx } from "./youthLoans.js";
import {
  drawYouthStats, intakeNamePoolTx, recycledNamesTx, normal, weighted,
  SEEDED_YOUTH_STATS, SEEDED_YOUTH_POSITIONS, SEEDED_YOUTH_POTENTIAL, type YouthStats,
} from "./youthIntake.js";
import { generateDevelopment } from "./player-development.js";
import { overallRating } from "./overallRating.js";
import { monthlySalaryFor } from "./clubFinances.js";

type Tx = CareerStateTx["tx"];

export const NEW_SENIOR_YOUTHS = 15;
export const NEW_SENIOR_PICTURE_PLAYERS = 5;
export const PICTURE_PLAYER_AGE = { min: 19, max: 21 } as const;

const POTENTIAL_RANK: Record<string, number> = { Elite: 3, High: 2, Average: 1 };
const STATS = ["speed", "power", "defense", "serve", "block", "stamina"] as const;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}

export type StayingOn = {
  /** The youths kept on, best first. */
  playerIds: number[];
  /** Each stat's mean among every AI youth turning 19 this turn, less the youth generator's mean. */
  shift: YouthStats;
};

/**
 * At the season's turn, after the ages move on and BEFORE releaseAiAcademyGraduatesTx: the AI academy
 * youths of 19 who stay on (the rest leave as before), and the scale of this year's 19-year-olds.
 */
export function youthsStayingOnTx(tx: Tx, careerSaveId: number, count = NEW_SENIOR_YOUTHS): StayingOn {
  const s = careerPlayerStateTable;
  const theirs = new Set(loansTx(tx, careerSaveId, "active").filter((l) => l.ownerTeamId != null).map((l) => l.playerId));
  const turning = tx.select({
    id: s.playerId, age: s.age, potential: playersTable.potential,
    speed: s.speed, power: s.power, defense: s.defense, serve: s.serve, block: s.block, stamina: s.stamina,
  }).from(s).innerJoin(playersTable, eq(playersTable.id, s.playerId))
    .where(and(eq(s.careerSaveId, careerSaveId), isNotNull(s.poolTeamId), eq(playersTable.playerType, "youth"),
      eq(s.isPromoted, false), eq(s.isRetired, false)))
    .all().filter((r) => r.age >= GRADUATION_AGE && !theirs.has(r.id));
  const shift = Object.fromEntries(STATS.map((k) => [k, turning.length === 0 ? 0
    : Math.round(turning.reduce((t, r) => t + r[k], 0) / turning.length - SEEDED_YOUTH_STATS[k].mean)])) as YouthStats;
  const playerIds = [...turning]
    .sort((a, b) => (POTENTIAL_RANK[b.potential ?? ""] ?? 0) - (POTENTIAL_RANK[a.potential ?? ""] ?? 0)
      || hash(`${careerSaveId}:${a.id}`) - hash(`${careerSaveId}:${b.id}`))
    .slice(0, count).map((r) => r.id);
  return { playerIds, shift };
}

/** Every picture this career has given (graduate and new senior pictures alike). */
function usedPicturesTx(tx: Tx, careerSaveId: number): Set<string> {
  return new Set(tx.select({ u: careerGraduatePortraitsTable.imageUrl }).from(careerGraduatePortraitsTable)
    .where(eq(careerGraduatePortraitsTable.careerSaveId, careerSaveId)).all().map((r) => r.u));
}

/** The unused new pictures of one nation, in this career's fixed order. */
function nationPictures(careerSaveId: number, nation: string, used: ReadonlySet<string>): NewSeniorPicture[] {
  return NEW_SENIOR_PICTURES.filter((p) => nationName(p.nation) === nation && !used.has(p.url))
    .sort((a, b) => hash(`${careerSaveId}:${a.url}`) - hash(`${careerSaveId}:${b.url}`));
}

export type NewSeniorsResult = {
  youths: Array<{ playerId: number; nation: string; picture: "nation" | "graduate" | "none" }>;
  pictures: Array<{ playerId: number; nation: string; name: string; imageUrl: string }>;
  /** Picture players this turn could not make: no unused new picture left, or no name left for its nation. */
  short: number;
};

/**
 * At the season's turn, after promoteAgedYouth has put the kept-on youths on the market: give them
 * their cards and wages, and make this year's picture players. `seasonYear` is the season they arrive in.
 */
export function newSeniorsArriveTx(
  w: CareerStateTx, careerSaveId: number, staying: StayingOn, seasonYear: number, arrivedOn: string,
  pictureCount = NEW_SENIOR_PICTURE_PLAYERS,
): NewSeniorsResult {
  const { tx } = w;
  const used = usedPicturesTx(tx, careerSaveId);
  const result: NewSeniorsResult = { youths: [], pictures: [], short: 0 };
  const give = (playerId: number, imageUrl: string, continent: ContinentKey) => {
    tx.insert(careerGraduatePortraitsTable).values({ careerSaveId, playerId, imageUrl, continent, assignedOn: arrivedOn }).run();
    used.add(imageUrl);
  };

  // 1. The youths kept on: her own nation's new picture, else a graduate picture of her continent, else her flag.
  for (const playerId of staying.playerIds) {
    const p = tx.select({
      nationality: playersTable.nationality, continent: playersTable.continent,
      speed: careerPlayerStateTable.speed, power: careerPlayerStateTable.power, defense: careerPlayerStateTable.defense,
      serve: careerPlayerStateTable.serve, block: careerPlayerStateTable.block, stamina: careerPlayerStateTable.stamina,
    }).from(careerPlayerStateTable).innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
      .where(and(eq(careerPlayerStateTable.careerSaveId, careerSaveId), eq(careerPlayerStateTable.playerId, playerId))).get();
    if (!p) continue;
    const nation = nationName(p.nationality) ?? p.nationality ?? "";
    const continent = continentKeyForNationality(p.nationality);
    const hasCard = !!tx.select({ id: careerGraduatePortraitsTable.id }).from(careerGraduatePortraitsTable)
      .where(and(eq(careerGraduatePortraitsTable.careerSaveId, careerSaveId), eq(careerGraduatePortraitsTable.playerId, playerId))).get();
    let picture: "nation" | "graduate" | "none" = "none";
    let imageUrl: string | null = null;
    if (!hasCard) {
      const own = nationPictures(careerSaveId, nation, used)[0];
      const graduate = continent ? (GRADUATE_PORTRAITS[continent] ?? []).filter((u) => !used.has(u)) : [];
      if (own) { imageUrl = own.url; picture = "nation"; give(playerId, own.url, own.continent); }
      else if (graduate.length > 0 && continent) {
        imageUrl = graduate[hash(`${careerSaveId}:${playerId}`) % graduate.length]!; picture = "graduate"; give(playerId, imageUrl, continent);
      }
    }
    w.setPlayerState(careerSaveId, playerId, {
      teamId: null, poolTeamId: null, academyRole: null, academyContractYears: null, contractEndDate: null,
      isActive: false, squadRole: "reserve", perks: "", salary: monthlySalaryFor(overallRating(p)),
    });
    tx.insert(careerNewSeniorsTable).values({ careerSaveId, playerId, seasonYear, kind: "youth", nation, picture, imageUrl, arrivedOn }).run();
    result.youths.push({ playerId, nation, picture });
  }

  // 2. The picture players: nations no AI academy youth holds first, one per nation before a second.
  const held = new Set(tx.select({ n: playersTable.nationality }).from(careerPlayerStateTable)
    .innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
    .where(and(eq(careerPlayerStateTable.careerSaveId, careerSaveId), isNotNull(careerPlayerStateTable.poolTeamId),
      eq(playersTable.playerType, "youth"), eq(careerPlayerStateTable.isPromoted, false)))
    .all().map((r) => nationName(r.n) ?? r.n));
  const free = NEW_SENIOR_PICTURES.filter((p) => !used.has(p.url))
    .sort((a, b) => Number(held.has(nationName(a.nation) ?? a.nation)) - Number(held.has(nationName(b.nation) ?? b.nation))
      || hash(`${careerSaveId}:${seasonYear}:${a.url}`) - hash(`${careerSaveId}:${seasonYear}:${b.url}`));
  const order: NewSeniorPicture[] = [];
  const taken = new Set<string>();
  for (const p of free) { const n = nationName(p.nation) ?? p.nation; if (!taken.has(n)) { order.push(p); taken.add(n); } }
  for (const p of free) if (!order.includes(p)) order.push(p);

  const nameInUse = (n: string) => !!tx.select({ id: careerPlayerStateTable.id }).from(careerPlayerStateTable)
    .innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
    .where(and(eq(careerPlayerStateTable.careerSaveId, careerSaveId), eq(playersTable.name, n))).get();
  // The name-respawn rule (youthIntake.ts L-02c): a name a retiree of her nation gave back comes first, then a
  // new combination of her nation's names. The sixty AI academies use the combinations up within a few seasons.
  const recycled = recycledNamesTx(tx, careerSaveId);
  for (const pic of order) {
    if (result.pictures.length >= pictureCount) break;
    const nation = nationName(pic.nation) ?? pic.nation;
    let name: string | null = null;
    for (const r of recycled.filter((x) => (nationName(x.nationality) ?? x.nationality) === nation)) {
      recycled.splice(recycled.indexOf(r), 1);
      tx.update(playerRetirementsTable).set({ nameReusedAt: new Date() }).where(eq(playerRetirementsTable.id, r.id)).run();
      if (!nameInUse(r.name)) { name = r.name; break; }
    }
    if (name == null) {
      const names = (intakeNamePoolTx(tx, [nation]).get(nation) ?? []).filter((n) => !nameInUse(n));
      if (names.length === 0) continue;
      name = names[hash(`${careerSaveId}:${pic.url}`) % names.length]!;
    }
    const drawn = drawYouthStats().stats;
    const stats = Object.fromEntries(STATS.map((k) => [k, Math.max(1, Math.min(99, drawn[k] + staying.shift[k]))])) as YouthStats;
    const age = PICTURE_PLAYER_AGE.min + Math.floor(Math.random() * (PICTURE_PLAYER_AGE.max - PICTURE_PLAYER_AGE.min + 1));
    const h = SEEDED_YOUTH_STATS.height;
    const playerId = w.createPlayer(careerSaveId, {
      name, nationality: nation, baseAge: age,
      height: normal(h.mean, h.sd, h.min, h.max),
      position: weighted(SEEDED_YOUTH_POSITIONS),
      ...stats,
      imageUrl: pic.url,
      continent: pic.continent,
      playerType: "senior",
      potential: weighted(SEEDED_YOUTH_POTENTIAL),
      development: generateDevelopment(),
    }, {
      age, ...stats,
      teamId: null, poolTeamId: null, squadRole: "reserve", isActive: false,
      salary: monthlySalaryFor(overallRating(stats)),
      morale: 75 + Math.floor(Math.random() * 16), fatigue: 0, fitness: 100, injuryStatus: "Healthy",
    });
    give(playerId, pic.url, pic.continent);
    tx.insert(careerNewSeniorsTable).values({ careerSaveId, playerId, seasonYear, kind: "picture", nation, picture: "nation", imageUrl: pic.url, arrivedOn }).run();
    result.pictures.push({ playerId, nation, name, imageUrl: pic.url });
  }
  result.short = pictureCount - result.pictures.length;
  return result;
}
