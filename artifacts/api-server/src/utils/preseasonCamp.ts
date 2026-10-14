/**
 * Update 1, overnight brief part 5 (Rob, 14 Oct, item 5): the pre-season camp.
 * The numbers are lib/db/src/schema/preseason.ts (PRESEASON); the AI clubs'
 * appetite is the career's difficulty (lib/db/src/schema/game-difficulty.ts).
 *
 *   - The off-season starts with the club's last match (utils/managerMoves.ts
 *     openWindowIfDue stamps career_saves.offseason_started_on); on its day
 *     PRESEASON.choiceDay the choice opens (Dashboard notice, Pre-season page).
 *   - A camp must end before the club's first match of the new season, so a
 *     length that would not is not offered (with the reason). The Olympics and
 *     their qualifying never fall in the off-season: the Olympic tournament is
 *     played between World Tour round 70 and the World Finals, and qualifying
 *     is the season's World Tour points (utils/olympics.ts), so no length is
 *     ever withheld for them.
 *   - A camp's sessions run on its last day, through the shared XP rule
 *     (utils/trainingXp.ts: age, profile, potential and serious injuries, the
 *     club's staff and its manager's Coach), times the length's multiplier,
 *     alternating between the location's two stats' programmes. Then the
 *     fatigue is added (it carries into the season) and Beach Academy's morale.
 *   - Rest: no training for the rest of the off-season; when the new season
 *     opens, every senior who isn't injured is at fitness 100, fatigue 0 and
 *     morale +5 (applyRestTx, after the rollover).
 *   - The AI clubs choose on the player's choice day, by difficulty: never,
 *     a coin flip each, or every club, and only if it can afford one
 *     (PRESEASON.aiAffordTimes x the cost in the bank). It goes for its weakest
 *     pair of stats, and the longest length it can afford, with a coin flip to
 *     go one shorter. Fitness and fatigue stay off for AI players (item 4c),
 *     so an AI camp adds no fatigue.
 */
import {
  careerSavesTable, careerPlayerStateTable, careerPoolTeamStateTable, playersTable, preseasonChoicesTable,
  seasonsTable, teamsTable, financeTransactionsTable, matchesTable,
  PRESEASON, PRESEASON_LENGTHS, PRESEASON_LOCATIONS, GAME_DIFFICULTY, gameDifficultyOf,
  type PreseasonLength, type PreseasonLocation,
} from "@workspace/db";
import { and, desc, eq, isNotNull, isNull, or } from "drizzle-orm";
import { loadStaffTx, type CareerStateTx } from "../lib/playerDto.js";
import { trainingSessionXp } from "./trainingXp.js";
import { trainingStaffBonuses } from "./staffBonuses.js";
import { specialityFactor } from "./managerFaces.js";
import { roundToDate } from "./roundDates.js";
import { isInjured } from "./condition.js";
import { gameDateText } from "./gameDate.js";

type Tx = CareerStateTx["tx"];
export type CampClub = { teamId: number } | { poolTeamId: number };

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The season being played (its year), or null. */
function activeSeasonTx(tx: Tx, careerSaveId: number) {
  return tx.select().from(seasonsTable)
    .where(and(eq(seasonsTable.careerSaveId, careerSaveId), eq(seasonsTable.status, "active")))
    .orderBy(desc(seasonsTable.year)).limit(1).get() ?? null;
}

/**
 * The club's first match of next season: the first round it plays this season,
 * on next season's dates (the schedule is the same shape every season).
 */
export function firstMatchNextSeasonTx(tx: Tx, careerSaveId: number, teamId: number, seasonYear: number): string {
  const season = tx.select().from(seasonsTable)
    .where(and(eq(seasonsTable.careerSaveId, careerSaveId), eq(seasonsTable.year, seasonYear))).get();
  const rounds = tx.select({ round: matchesTable.round }).from(matchesTable)
    .where(and(eq(matchesTable.season, seasonYear), or(eq(matchesTable.homeTeamId, teamId), eq(matchesTable.awayTeamId, teamId)))).all();
  const first = rounds.length ? Math.min(...rounds.map((r) => r.round)) : 1;
  return roundToDate(`${seasonYear + 1}-01-01`, `${seasonYear + 1}-12-31`, first, season?.totalRounds ?? 78);
}

export type PreseasonState = {
  /** The season whose off-season it is. */
  seasonYear: number;
  offseasonStartedOn: string | null;
  /** The day the choice opens (day PRESEASON.choiceDay). */
  choiceOn: string;
  firstMatchOn: string;
  open: boolean;
  choice: { choice: string; location: string | null; length: string | null; startsOn: string | null; endsOn: string | null; cost: number; done: boolean } | null;
  balance: number;
  lengths: Array<{ length: PreseasonLength; endsOn: string; allowed: boolean; reason: string | null }>;
};

/** Where the player's club's pre-season stands today, or null in-season. */
export function preseasonStateTx(tx: Tx, careerSaveId: number, teamId: number, today: string): PreseasonState | null {
  const season = activeSeasonTx(tx, careerSaveId);
  const save = tx.select({ w: careerSavesTable.windowSeason, started: careerSavesTable.offseasonStartedOn })
    .from(careerSavesTable).where(eq(careerSavesTable.id, careerSaveId)).get();
  if (!season || save?.w !== season.year) return null;
  const started = save.started ?? null;
  const choiceOn = started ? addDays(started, PRESEASON.choiceDay - 1) : today;
  const firstMatchOn = firstMatchNextSeasonTx(tx, careerSaveId, teamId, season.year);
  const row = tx.select().from(preseasonChoicesTable).where(and(
    eq(preseasonChoicesTable.careerSaveId, careerSaveId), eq(preseasonChoicesTable.seasonYear, season.year), eq(preseasonChoicesTable.teamId, teamId),
  )).get();
  const balance = Number(tx.select({ b: teamsTable.budget }).from(teamsTable).where(eq(teamsTable.id, teamId)).get()?.b ?? 0);
  const lengths = PRESEASON_LENGTHS.map((length) => {
    const L = PRESEASON.lengths[length];
    const endsOn = addDays(today, L.days);
    const reason = endsOn >= firstMatchOn ? `It would end on ${gameDateText(endsOn)}, after your first match of next season (${gameDateText(firstMatchOn)}).`
      : balance < L.cost ? `It costs $${L.cost.toLocaleString("en-US")}; the club has $${Math.round(balance).toLocaleString("en-US")}.`
      : null;
    return { length, endsOn, allowed: reason == null, reason };
  });
  return {
    seasonYear: season.year, offseasonStartedOn: started, choiceOn, firstMatchOn,
    open: today >= choiceOn && !row,
    choice: row ? { choice: row.choice, location: row.location, length: row.length, startsOn: row.startsOn, endsOn: row.endsOn, cost: Number(row.cost), done: row.done } : null,
    balance, lengths,
  };
}

/** The player's choice. Returns an error in plain words, or null. */
export function choosePreseasonTx(
  w: CareerStateTx, careerSaveId: number, teamId: number, today: string,
  pick: { choice: "camp" | "rest" | "skip"; location?: string; length?: string },
): string | null {
  const st = preseasonStateTx(w.tx, careerSaveId, teamId, today);
  if (!st) return "It is not the off-season.";
  if (st.choice) return "You have already chosen for this off-season.";
  if (today < st.choiceOn) return `The pre-season choice opens on ${gameDateText(st.choiceOn)}, day ${PRESEASON.choiceDay} of the off-season.`;
  if (pick.choice === "camp") {
    if (!(PRESEASON_LOCATIONS as readonly string[]).includes(pick.location ?? "")) return "Pick a camp: Altitude Camp, Power House or Beach Academy.";
    const len = st.lengths.find((l) => l.length === pick.length);
    if (!len) return "Pick a length: 1, 2 or 4 weeks.";
    if (!len.allowed) return len.reason;
    bookCampTx(w, careerSaveId, st.seasonYear, { teamId }, pick.location as PreseasonLocation, len.length, today);
    return null;
  }
  w.tx.insert(preseasonChoicesTable).values({ careerSaveId, seasonYear: st.seasonYear, teamId, choice: pick.choice === "rest" ? "rest" : "skip" }).run();
  return null;
}

/** Book a camp for a club and pay for it from its balance (the player's with a ledger line). */
function bookCampTx(w: CareerStateTx, careerSaveId: number, seasonYear: number, club: CampClub, location: PreseasonLocation, length: PreseasonLength, today: string): void {
  const L = PRESEASON.lengths[length];
  w.tx.insert(preseasonChoicesTable).values({
    careerSaveId, seasonYear, ...("teamId" in club ? { teamId: club.teamId } : { poolTeamId: club.poolTeamId }),
    choice: "camp", location, length, startsOn: today, endsOn: addDays(today, L.days), cost: L.cost,
  }).run();
  if ("teamId" in club) {
    const budget = Number(w.tx.select({ b: teamsTable.budget }).from(teamsTable).where(eq(teamsTable.id, club.teamId)).get()?.b ?? 0);
    w.tx.update(teamsTable).set({ budget: budget - L.cost }).where(eq(teamsTable.id, club.teamId)).run();
    w.tx.insert(financeTransactionsTable).values({
      teamId: club.teamId, type: "expense", amount: L.cost, category: "training", date: today,
      description: `Pre-season camp (${PRESEASON.locations[location].name}, ${L.label})`,
    }).run();
  } else {
    const st = w.tx.select({ b: careerPoolTeamStateTable.balance }).from(careerPoolTeamStateTable)
      .where(and(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), eq(careerPoolTeamStateTable.poolTeamId, club.poolTeamId))).get();
    w.tx.update(careerPoolTeamStateTable).set({ balance: Number(st?.b ?? 0) - L.cost, updatedAt: new Date() })
      .where(and(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), eq(careerPoolTeamStateTable.poolTeamId, club.poolTeamId))).run();
  }
}

/** A club's seniors, with what the XP rule and the camp need. */
function seniorsOfTx(tx: Tx, careerSaveId: number, club: CampClub) {
  const s = careerPlayerStateTable;
  return tx.select({
    id: s.playerId, age: s.age, trainingPoints: s.trainingPoints, isPromoted: s.isPromoted, isRetired: s.isRetired,
    speed: s.speed, power: s.power, defense: s.defense, serve: s.serve, block: s.block, stamina: s.stamina,
    fatigue: s.fatigue, fitness: s.fitness, morale: s.morale, isInjured: s.isInjured, injuryStatus: s.injuryStatus,
    seriousInjuries: s.seriousInjuries, potential: playersTable.potential, playerType: playersTable.playerType, development: playersTable.development,
  }).from(s).innerJoin(playersTable, eq(playersTable.id, s.playerId))
    .where(and(
      eq(s.careerSaveId, careerSaveId), eq(s.isRetired, false),
      "teamId" in club ? eq(s.teamId, club.teamId) : and(isNull(s.teamId), eq(s.poolTeamId, club.poolTeamId)),
      or(eq(playersTable.playerType, "senior"), eq(s.isPromoted, true)),
    )).all();
}

/** A camp's sessions, on its last day. Returns how many seniors trained. */
function runCampTx(w: CareerStateTx, careerSaveId: number, club: CampClub, location: PreseasonLocation, length: PreseasonLength): number {
  const loc = PRESEASON.locations[location], L = PRESEASON.lengths[length];
  const ref = "teamId" in club ? club.teamId : { careerSaveId, poolTeamId: club.poolTeamId };
  const staff = trainingStaffBonuses(loadStaffTx(w.tx, careerSaveId, club)).xpMultiplier;
  const manager = specialityFactor(ref, "Coach");
  const seniors = seniorsOfTx(w.tx, careerSaveId, club);
  for (const p of seniors) {
    let me = { ...p };
    for (let i = 0; i < L.sessions; i++) {
      const xp = trainingSessionXp(me, loc.programmes[i % loc.programmes.length]!, { staff, manager, camp: L.xp });
      me = { ...me, trainingPoints: xp.newPoints, ...xp.statUpdates };
    }
    w.setPlayerState(careerSaveId, p.id, {
      trainingPoints: me.trainingPoints, speed: me.speed, power: me.power, defense: me.defense, serve: me.serve, block: me.block, stamina: me.stamina,
      // Fitness and fatigue are the player's club's (item 4c: off for AI players).
      ...("teamId" in club ? { fatigue: Math.min(100, Number(p.fatigue ?? 0) + L.fatigue) } : {}),
      ...(loc.morale ? { morale: Math.min(100, Number(p.morale ?? 0) + loc.morale) } : {}),
    });
  }
  return seniors.length;
}

/**
 * The game day's pre-season step (routes/calendar.ts): on the player's choice
 * day the AI clubs choose; every camp whose last day has come runs. Returns
 * the lines for the player's day.
 */
export function preseasonDayTx(w: CareerStateTx, careerSaveId: number, teamId: number, today: string, random: () => number = Math.random): string[] {
  const lines: string[] = [];
  const st = preseasonStateTx(w.tx, careerSaveId, teamId, today);
  if (st && today >= st.choiceOn) {
    if (today === st.choiceOn && st.open) lines.push("Pre-season: choose a camp, Rest or Skip (Dashboard, Pre-season)");
    aiClubsChooseTx(w, careerSaveId, st.seasonYear, st.firstMatchOn, today, random);
  }
  const due = w.tx.select().from(preseasonChoicesTable).where(and(
    eq(preseasonChoicesTable.careerSaveId, careerSaveId), eq(preseasonChoicesTable.choice, "camp"), eq(preseasonChoicesTable.done, false),
  )).all().filter((c) => c.endsOn != null && c.endsOn <= today);
  for (const c of due) {
    const club: CampClub = c.teamId != null ? { teamId: c.teamId } : { poolTeamId: c.poolTeamId! };
    runCampTx(w, careerSaveId, club, c.location as PreseasonLocation, c.length as PreseasonLength);
    w.tx.update(preseasonChoicesTable).set({ done: true }).where(eq(preseasonChoicesTable.id, c.id)).run();
    if (c.teamId === teamId) lines.push(`Pre-season camp over: ${PRESEASON.locations[c.location as PreseasonLocation].name}, ${PRESEASON.lengths[c.length as PreseasonLength].label}`);
  }
  return lines;
}

/** The AI clubs' choice, once per off-season, by the career's difficulty. */
function aiClubsChooseTx(w: CareerStateTx, careerSaveId: number, seasonYear: number, firstMatchOn: string, today: string, random: () => number): void {
  const already = w.tx.select({ id: preseasonChoicesTable.id }).from(preseasonChoicesTable).where(and(
    eq(preseasonChoicesTable.careerSaveId, careerSaveId), eq(preseasonChoicesTable.seasonYear, seasonYear), isNotNull(preseasonChoicesTable.poolTeamId),
  )).limit(1).get();
  if (already) return;
  const level = GAME_DIFFICULTY[gameDifficultyOf(w.tx.select({ d: careerSavesTable.gameDifficulty }).from(careerSavesTable).where(eq(careerSavesTable.id, careerSaveId)).get()?.d)];
  const clubs = w.tx.select({ id: careerPoolTeamStateTable.poolTeamId, balance: careerPoolTeamStateTable.balance }).from(careerPoolTeamStateTable)
    .where(and(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), isNull(careerPoolTeamStateTable.takenOverAt))).all();
  for (const c of clubs) {
    const fits = PRESEASON_LENGTHS.filter((l) => addDays(today, PRESEASON.lengths[l].days) < firstMatchOn
      && Number(c.balance) >= PRESEASON.aiAffordTimes * PRESEASON.lengths[l].cost);
    const goes = fits.length > 0 && (level.aiCamp === "always" || (level.aiCamp === "coin" && random() < 0.5));
    if (!goes) {
      w.tx.insert(preseasonChoicesTable).values({ careerSaveId, seasonYear, poolTeamId: c.id, choice: "skip" }).run();
      continue;
    }
    // Its weakest pair of stats picks the camp; the longest it can afford, or one shorter on a coin flip.
    const seniors = seniorsOfTx(w.tx, careerSaveId, { poolTeamId: c.id });
    const pairScore = (loc: PreseasonLocation) => seniors.reduce((t, p) => t + PRESEASON.locations[loc].stats.reduce((u, k) => u + Number((p as Record<string, unknown>)[k] ?? 0), 0), 0);
    const location = [...PRESEASON_LOCATIONS].sort((a, b) => pairScore(a) - pairScore(b))[0]!;
    const longest = fits.length - 1;
    const length = fits[Math.max(0, longest - (longest > 0 && random() < 0.5 ? 1 : 0))]!;
    bookCampTx(w, careerSaveId, seasonYear, { poolTeamId: c.id }, location, length, today);
  }
}

/** Rest: when the new season opens, the club's fit seniors are fresh. Called straight after the rollover. */
export function applyRestTx(w: CareerStateTx, careerSaveId: number, seasonYear: number): number {
  const rests = w.tx.select().from(preseasonChoicesTable).where(and(
    eq(preseasonChoicesTable.careerSaveId, careerSaveId), eq(preseasonChoicesTable.seasonYear, seasonYear), eq(preseasonChoicesTable.choice, "rest"),
  )).all();
  let n = 0;
  for (const r of rests) {
    const club: CampClub = r.teamId != null ? { teamId: r.teamId } : { poolTeamId: r.poolTeamId! };
    for (const p of seniorsOfTx(w.tx, careerSaveId, club)) {
      if (isInjured({ isInjured: p.isInjured, injuryStatus: p.injuryStatus ?? "Healthy" })) continue;
      w.setPlayerState(careerSaveId, p.id, {
        fitness: PRESEASON.rest.fitness, fatigue: PRESEASON.rest.fatigue, morale: Math.min(100, Number(p.morale ?? 0) + PRESEASON.rest.morale),
      });
      n++;
    }
  }
  return n;
}

/** Why the club can't book normal training today (at camp, or resting), or null. */
export function preseasonTrainingBlockTx(tx: Tx, careerSaveId: number, teamId: number, today: string): string | null {
  const season = activeSeasonTx(tx, careerSaveId);
  if (!season) return null;
  const row = tx.select().from(preseasonChoicesTable).where(and(
    eq(preseasonChoicesTable.careerSaveId, careerSaveId), eq(preseasonChoicesTable.seasonYear, season.year), eq(preseasonChoicesTable.teamId, teamId),
  )).get();
  if (!row) return null;
  if (row.choice === "rest") return "Your squad is resting for the rest of the off-season: no training until the new season.";
  if (row.choice === "camp" && !row.done && row.startsOn != null && row.startsOn <= today) {
    return `Your seniors are at ${PRESEASON.locations[row.location as PreseasonLocation].name} until ${gameDateText(row.endsOn)}: no normal training while at camp.`;
  }
  return null;
}
