/**
 * Afternoon brief 2 Oct, item 7 (Rob's J-2, J-3, J-4; branch feat-job-market):
 * WHEN a manager can move.
 *
 *   - The off-season window: from the player's club's last match of the season
 *     (a club that misses the finals finishes a couple of weeks before the
 *     finalists) until the next season starts. Mid-season there are no
 *     sackings and no moves: Resign and Break Contract say so
 *     (LEAVE_MID_SEASON).
 *   - In the window: the board's verdict is known (the player's board sacks
 *     him after two failed seasons running, by the same bands as the AI
 *     boards: board-confidence.ts reviewSeason "sacked"); he can resign or break
 *     his contract (its penalty applies), apply to any club with a vacancy, and
 *     AI clubs make him offers (poaching): a club with a vacancy, or one whose
 *     board wants a better manager (its AI manager is on a failed season),
 *     judged on his level and his season. He accepts or declines.
 *   - A move takes effect at the start of the next season (executeMoveTx is
 *     run by the calendar right after the rollover): to the club he accepted;
 *     else, if he must go (sacked, sold, resigned), to the best open club he
 *     qualifies for; else the open club with the lowest rating takes him, and
 *     says so. He can always retire instead. Nobody is ever left without a club:
 *     this replaces the old "seeking a club" state.
 *   - A club that changes hands at a season's start is swapped out of this
 *     career's new World Tour field if it was drawn in it (the next club
 *     outside the field takes its seat), so no club is in the field twice (J-4).
 */
import {
  db, careerSavesTable, careerPoolTeamStateTable, continentalPoolTeamsTable, matchesTable, boardSeasonsTable,
  worldTourQualificationsTable, worldTourFixturesTable, competitorsTable, seasonsTable, managerLevelFor, teamsTable,
} from "@workspace/db";
import { and, desc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { levelNeededFor, decideApplication, vacanciesTx, ensureAiManagersTx, judgeAiManagersTx, appointOldVacanciesTx, type Vacancy } from "./aiManagers.js";
import { poolClubRatingsTx } from "./worldTour.js";
import { seasonNumberForYear } from "./seasonRollover.js";

/** Mid-season, in the words Rob gave (J-3). */
export const LEAVE_MID_SEASON = "You can leave once your season is over (penalties apply if you break your contract).";

export async function activeSeasonYearOf(careerSaveId: number): Promise<number | null> {
  const [s] = await db.select({ year: seasonsTable.year }).from(seasonsTable)
    .where(and(eq(seasonsTable.careerSaveId, careerSaveId), eq(seasonsTable.status, "active")))
    .orderBy(desc(seasonsTable.year)).limit(1);
  return s?.year ?? null;
}

/** The club's season is over: it has played this season and has no match left in it. */
export async function seasonOverFor(teamId: number, seasonYear: number): Promise<boolean> {
  const mine = or(eq(matchesTable.homeTeamId, teamId), eq(matchesTable.awayTeamId, teamId));
  const left = await db.select({ id: matchesTable.id }).from(matchesTable)
    .where(and(eq(matchesTable.season, seasonYear), eq(matchesTable.status, "scheduled"), mine)).limit(1);
  if (left.length > 0) return false;
  const played = await db.select({ id: matchesTable.id }).from(matchesTable)
    .where(and(eq(matchesTable.season, seasonYear), eq(matchesTable.status, "completed"), mine)).limit(1);
  return played.length > 0;
}

/**
 * The board's verdict, once the season is over: a sacking when last season
 * was failed and this one is too (the projected grade is final once the
 * club has played its last match). Null when it keeps him.
 */
export async function boardVerdict(careerSaveId: number, seasonYear: number, teamId: number): Promise<string | null> {
  const rows = await db.select({ year: boardSeasonsTable.seasonYear, grade: boardSeasonsTable.grade, projected: boardSeasonsTable.projectedGrade })
    .from(boardSeasonsTable).where(and(eq(boardSeasonsTable.careerSaveId, careerSaveId), eq(boardSeasonsTable.teamId, teamId),
      inArray(boardSeasonsTable.seasonYear, [seasonYear - 1, seasonYear])));
  const last = rows.find((r) => r.year === seasonYear - 1)?.grade;
  const now = rows.find((r) => r.year === seasonYear);
  const thisSeason = now?.grade ?? now?.projected ?? null;
  return last === "failed" && thisSeason === "failed"
    ? "The board sacks you at the season's end: a second failed season running, by its bands."
    : null;
}

export type Offer = { poolTeamId: number; name: string; rating: number; why: string };

function levelOfPoints(points: number) { return managerLevelFor(points); }

/**
 * AI clubs' offers in the window, judged on his level and his season: every
 * club with a vacancy whose level he meets, and every club whose board wants
 * a better manager (its AI manager on a failed season) whose level he meets.
 * Declined offers are not made again.
 *
 * Rob, 5 Oct (Q-4): a failed season means fewer offers, not none. Up to
 * MAX_OFFERS after a season that wasn't failed; after a failed one, half the
 * clubs that would have come for him (rounded up, so never none while any
 * would), at most FAILED_SEASON_MAX_OFFERS, and they are the weaker ones.
 */
export const MAX_OFFERS = 4;
export const FAILED_SEASON_MAX_OFFERS = 2;
export function offersTx(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], careerSaveId: number, seasonYear: number,
  managerName: string, repPoints: number, seasonFailed: boolean, declined: number[]): Offer[] {
  const level = levelOfPoints(repPoints);
  const ratings = poolClubRatingsTx(tx, careerSaveId);
  const names = new Map(tx.select({ id: continentalPoolTeamsTable.id, n: continentalPoolTeamsTable.teamName }).from(continentalPoolTeamsTable).all().map((t) => [t.id, t.n]));
  const out: Offer[] = [];
  for (const v of vacanciesTx(tx, careerSaveId, seasonYear)) {
    const d = decideApplication(v, managerName, level);
    if (d.accepted && !declined.includes(v.poolTeamId)) out.push({ poolTeamId: v.poolTeamId, name: v.name, rating: v.rating, why: `${v.name} have no manager and want you: ${d.reason}` });
  }
  const warned = tx.select().from(careerPoolTeamStateTable).where(and(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId),
    isNull(careerPoolTeamStateTable.takenOverAt), isNull(careerPoolTeamStateTable.vacantSince), isNotNull(careerPoolTeamStateTable.managerName))).all()
    .filter((c) => c.managerFailedSeasons >= 1);
  for (const c of warned) {
    const rating = Math.round(ratings.get(c.poolTeamId) ?? 0);
    if (level.level < levelNeededFor(rating) || declined.includes(c.poolTeamId)) continue;
    out.push({ poolTeamId: c.poolTeamId, name: names.get(c.poolTeamId) ?? "", rating,
      why: `${names.get(c.poolTeamId)}'s board wants a better manager than ${c.managerName} (a failed season behind her) and offers you the job.` });
  }
  const best = (a: Offer, b: Offer) => b.rating - a.rating || a.poolTeamId - b.poolTeamId;
  if (!seasonFailed) return out.sort(best).slice(0, MAX_OFFERS);
  const fewer = Math.min(FAILED_SEASON_MAX_OFFERS, Math.ceil(out.length / 2));
  return out.sort((a, b) => best(b, a)).slice(0, fewer).sort(best);
}

/**
 * Where he goes at the season's start, and why, in plain words. Null when he
 * stays. `mustGo` = sacked, sold or leaving.
 */
export function destinationTx(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], careerSaveId: number, seasonYear: number,
  managerName: string, repPoints: number, pending: number | null, mustGo: boolean): { poolTeamId: number; why: string } | null {
  const level = levelOfPoints(repPoints);
  ensureAiManagersTx(tx, careerSaveId, seasonYear);
  const open = (id: number) => tx.select().from(careerPoolTeamStateTable).where(and(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId),
    eq(careerPoolTeamStateTable.poolTeamId, id), isNull(careerPoolTeamStateTable.takenOverAt))).get();
  if (pending != null && open(pending)) {
    const name = tx.select({ n: continentalPoolTeamsTable.teamName }).from(continentalPoolTeamsTable).where(eq(continentalPoolTeamsTable.id, pending)).get()?.n ?? "the club";
    return { poolTeamId: pending, why: `${managerName} joins ${name}, as agreed in the off-season.` };
  }
  if (!mustGo) return null;
  const vac: Vacancy[] = vacanciesTx(tx, careerSaveId, seasonYear);
  const fits = vac.filter((v) => decideApplication(v, managerName, level).accepted).sort((a, b) => b.rating - a.rating);
  if (fits[0]) return { poolTeamId: fits[0].poolTeamId, why: `${fits[0].name} take ${managerName} on: ${decideApplication(fits[0], managerName, level).reason}` };
  const lowest = [...vac].sort((a, b) => a.rating - b.rating)[0];
  if (lowest) return { poolTeamId: lowest.poolTeamId, why: `No club ${managerName} qualifies for has a vacancy: ${lowest.name}, the open club with the lowest rating (${lowest.rating}), takes ${managerName} on.` };
  // No vacancy anywhere: the lowest-rated AI club's manager steps aside for him.
  const ratings = poolClubRatingsTx(tx, careerSaveId);
  const clubs = tx.select({ id: careerPoolTeamStateTable.poolTeamId }).from(careerPoolTeamStateTable)
    .where(and(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), isNull(careerPoolTeamStateTable.takenOverAt))).all()
    .map((c) => ({ id: c.id, r: ratings.get(c.id) ?? 0 })).sort((a, b) => a.r - b.r);
  if (!clubs[0]) return null;
  const name = tx.select({ n: continentalPoolTeamsTable.teamName }).from(continentalPoolTeamsTable).where(eq(continentalPoolTeamsTable.id, clubs[0].id)).get()?.n ?? "";
  return { poolTeamId: clubs[0].id, why: `No club has a vacancy: ${name}, the lowest-rated club (${Math.round(clubs[0].r)}), takes ${managerName} on and its manager steps aside.` };
}

/**
 * J-4: a club taken at the season's start that was drawn into this career's
 * new World Tour field gives its seat to the best club outside the field, in
 * this career's qualifications and fixtures, so no club plays it twice.
 */
export function swapOutOfFieldTx(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], careerSaveId: number, seasonYear: number, poolTeamId: number): string | null {
  const leagueSeason = seasonNumberForYear(seasonYear);
  const quals = tx.select().from(worldTourQualificationsTable).where(and(eq(worldTourQualificationsTable.careerSaveId, careerSaveId),
    eq(worldTourQualificationsTable.seasonYear, leagueSeason))).all();
  const mine = quals.find((q) => q.poolTeamId === poolTeamId);
  if (!mine) return null;
  const inField = new Set(quals.map((q) => q.poolTeamId));
  const taken = new Set(tx.select({ id: careerPoolTeamStateTable.poolTeamId }).from(careerPoolTeamStateTable)
    .where(and(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), isNotNull(careerPoolTeamStateTable.takenOverAt))).all().map((r) => r.id));
  const ratings = poolClubRatingsTx(tx, careerSaveId);
  const next = [...ratings.entries()].filter(([id]) => id !== poolTeamId && !inField.has(id) && !taken.has(id)).sort((a, b) => b[1] - a[1])[0];
  if (!next) return null;
  const from = tx.select({ id: competitorsTable.id }).from(competitorsTable).where(eq(competitorsTable.poolTeamId, poolTeamId)).get()?.id;
  const to = tx.select({ id: competitorsTable.id }).from(competitorsTable).where(eq(competitorsTable.poolTeamId, next[0])).get()?.id;
  if (from == null || to == null) return null;
  tx.update(worldTourQualificationsTable).set({ poolTeamId: next[0] }).where(eq(worldTourQualificationsTable.id, mine.id)).run();
  tx.update(worldTourFixturesTable).set({ homeCompetitorId: to }).where(and(eq(worldTourFixturesTable.careerSaveId, careerSaveId),
    eq(worldTourFixturesTable.seasonYear, seasonYear), eq(worldTourFixturesTable.homeCompetitorId, from))).run();
  tx.update(worldTourFixturesTable).set({ awayCompetitorId: to }).where(and(eq(worldTourFixturesTable.careerSaveId, careerSaveId),
    eq(worldTourFixturesTable.seasonYear, seasonYear), eq(worldTourFixturesTable.awayCompetitorId, from))).run();
  return tx.select({ n: continentalPoolTeamsTable.teamName }).from(continentalPoolTeamsTable).where(eq(continentalPoolTeamsTable.id, next[0])).get()?.n ?? null;
}

/**
 * The window opens: the player's club has played its last match of the
 * season. The AI boards judge their managers now (J-3: "sackings are
 * announced"), once a season; the jobs that open stay open into the next
 * season for him to apply. Returns the day's news.
 */
export async function openWindowIfDue(careerSaveId: number, teamId: number, today: string): Promise<string[]> {
  const year = await activeSeasonYearOf(careerSaveId);
  if (year == null) return [];
  const [save] = await db.select({ w: careerSavesTable.windowSeason }).from(careerSavesTable).where(eq(careerSavesTable.id, careerSaveId));
  if (save?.w === year || !(await seasonOverFor(teamId, year))) return [];
  const sacked = db.transaction((tx) => {
    ensureAiManagersTx(tx, careerSaveId, year);
    appointOldVacanciesTx(tx, careerSaveId, year);
    const s = judgeAiManagersTx(tx, careerSaveId, year, today);
    tx.update(careerSavesTable).set({ windowSeason: year }).where(eq(careerSavesTable.id, careerSaveId)).run();
    return s;
  });
  return [
    "Your season is over: the off-season window is open (Job Market) until the new season starts.",
    ...sacked.map((s) => `${s.club} sack ${s.manager}: the job is open (Job Market)`),
  ];
}

/** His manager level points, from his club now. */
export async function repPointsOf(teamId: number | null): Promise<number> {
  if (teamId == null) return 0;
  const [t] = await db.select({ p: teamsTable.managerRepPoints }).from(teamsTable).where(eq(teamsTable.id, teamId));
  return t?.p ?? 0;
}

export { careerSavesTable };
