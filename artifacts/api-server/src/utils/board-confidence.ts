/**
 * R-53 — the board judges each season against what it expected of it.
 * R-55 — and what it expects is a BAND, not a rank.
 *
 * Design: docs/r53-design.md, approved as written, amended by R-55. This
 * REPLACED R-09's meter, which moved a stored 0-100 value on every result
 * (+3 a win, +8 a Grand Final, -5 a loss or forfeit), read it through an
 * absolute money bracket that made $300k unsackable, sacked whenever it read
 * zero, and carried a "forced sale" that never sold anyone.
 *
 * Now:
 *   expectation  set once the World Tour is drawn, from where the club's best
 *                contracted pair ranks in that field (R). A finish within 3
 *                places of R meets it; 4-7 places below is below expectations
 *                (a warning, no strike); 8 or more below fails the season (a
 *                strike). An established starting pair ranks #1, so: top-4 met,
 *                5th-8th below, 9th or worse failed (Rob, R-55). A #19 squad
 *                cannot fail on position.
 *   patience     results never sack mid-season. Every 30 game days the board
 *                projects the band from the standings; that can warn and freeze
 *                spending, nothing more
 *   review       met +5, below 0, failed -25; honours; money (debt, a collapsing
 *                balance)
 *   sacking      only at a review: a second strike — two failed seasons in a
 *                row, where a below season between them resets nothing and adds
 *                nothing, and a met season clears the strikes — or confidence
 *                of 20 or less. Mid-season, only abandonment: 30 game days
 *                unable to field a side, sacked at the next forfeit
 *   no last season: every season's review can sack. Until L-01 (22 Sep 2026)
 *                season 5 was terminal and its review a "verdict" that could
 *                not sack; a career now runs until the board ends it
 *
 * R-55 replaced R-53's rank target (strength rank + difficulty allowance -
 * money places, graded on six steps): the strongest pair in the field finishes
 * 6th-10th in about one season in five by ordinary results variance, and
 * against a #2 target two such seasons sacked an established club.
 *
 * The pure rules come first (the rollover, the monthly check and the dev
 * review-table endpoint all call them); the database steps follow.
 */
import {
  db,
  boardSeasonsTable,
  teamsTable,
  careerPlayerStateTable,
  matchesTable,
  worldTourFixturesTable,
  type BoardSeason,
} from "@workspace/db";
import { and, desc, eq, gte, isNotNull, lt, or } from "drizzle-orm";
import { worldTourFieldTx, poolClubRatingsTx, worldTourStandingsTx, worldFinalsSummaryTx } from "./worldTour.js";
import { sideRating } from "./matchEngine.js";
import { WORLD_TOUR_START } from "./calendarSlots.js";
import { seasonNumberForYear } from "./seasonRollover.js";
import { getActiveSeasonForCareer } from "../lib/getActiveSeason.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ── The numbers ──────────────────────────────────────────────────────────────

export const CONFIDENCE_START = 60;
/** The World Tour field: 18 qualifiers and the player's club. */
export const FIELD_CLUBS = 19;
/** Met: a finish no more than this many places below the pair's strength rank. */
export const MET_WITHIN = 3;
/** Failed: a finish this many places or more below the pair's strength rank. */
export const FAILED_FROM = 8;
export const STRIKES_TO_SACK = 2;
export const SACK_AT = 20;
export const FINAL_WARNING_AT = 35;
export const FREEZE_AT = 30;
export const UNFREEZE_ABOVE = 35;
export const CHECK_EVERY_DAYS = 30;
export const ABANDONMENT_DAYS = 30;
/** Two players on the sand: with fewer contracted, active players a club cannot play (R-48). */
export const PAIR_SIZE = 2;

export type Grade = "met" | "below" | "failed";
export const GRADE_POINTS: Record<Grade, number> = { met: 5, below: 0, failed: -25 };
export const GRADE_WORDS: Record<Grade, string> = {
  met: "met expectations", below: "below expectations", failed: "failed",
};
export type FinalsResult = "champion" | "runner-up" | "semi-finalist" | "did not qualify" | null;
export type Outcome = "safe" | "warning" | "final_warning" | "sacked";
export type BoardStage = "safe" | "warning" | "spending_freeze" | "final_warning";

export const SPENDING_FROZEN_MESSAGE =
  "The board has frozen new signings, staff hires and facility upgrades until results improve against its expectation.";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ── The rules ────────────────────────────────────────────────────────────────

export type Bands = {
  /** The worst finish that meets expectations. */
  metLine: number;
  /** The first finish that is below expectations, or null when none is. */
  belowFrom: number | null;
  /** The first finish that fails the season, or null when none does. */
  failedFrom: number | null;
};

/** The board's bands for a pair ranked `strengthRank` in the drawn field. */
export function bandsFor(strengthRank: number): Bands {
  const rank = clamp(Math.round(strengthRank), 1, FIELD_CLUBS);
  const metLine = Math.min(FIELD_CLUBS, rank + MET_WITHIN);
  const failedFrom = rank + FAILED_FROM;
  return {
    metLine,
    belowFrom: metLine < FIELD_CLUBS ? metLine + 1 : null,
    failedFrom: failedFrom <= FIELD_CLUBS ? failedFrom : null,
  };
}

/** The band a finish falls in; a season with at least half its matches forfeited is failed. */
export function gradeFor(strengthRank: number, finish: number, forfeitedHalf = false): { grade: Grade; points: number } {
  const b = bandsFor(strengthRank);
  const grade: Grade = forfeitedHalf ? "failed"
    : finish <= b.metLine ? "met"
    : b.failedFrom != null && finish >= b.failedFrom ? "failed"
    : "below";
  return { grade, points: GRADE_POINTS[grade] };
}

/** A failed season is a strike; a below season leaves the strikes as they are; a met season clears them. */
export function strikesAfter(previousStrikes: number, grade: Grade): number {
  if (grade === "failed") return previousStrikes + 1;
  if (grade === "below") return previousStrikes;
  return 0;
}

export function honoursPoints(result: FinalsResult): number {
  return result === "champion" ? 15 : result === "runner-up" ? 8 : result === "semi-finalist" ? 4 : 0;
}

/** Money is a modifier, never an immunity: debt costs, a collapsing balance costs, riches earn nothing. */
export function moneyPoints(seasonStartBalance: number, seasonEndBalance: number): number {
  if (seasonEndBalance < 0) return -15;
  if (seasonStartBalance > 0 && seasonEndBalance < seasonStartBalance * 0.75) return -5;
  return 0;
}

export type ReviewInput = {
  confidenceBefore: number;
  strengthRank: number;
  finish: number;
  forfeits: number;
  worldTourMatches: number;
  finalsResult: FinalsResult;
  seasonStartBalance: number;
  seasonEndBalance: number;
  previousStrikes: number;
};

export type ReviewResult = {
  grade: Grade;
  forfeitedHalf: boolean;
  gradePoints: number;
  honoursPoints: number;
  moneyPoints: number;
  confidenceBefore: number;
  confidenceAfter: number;
  strikes: number;
  outcome: Outcome;
};

export function reviewSeason(input: ReviewInput): ReviewResult {
  const forfeitedHalf = input.worldTourMatches > 0 && input.forfeits * 2 >= input.worldTourMatches;
  const g = gradeFor(input.strengthRank, input.finish, forfeitedHalf);
  const hp = honoursPoints(input.finalsResult);
  const mp = moneyPoints(input.seasonStartBalance, input.seasonEndBalance);
  const confidenceBefore = clamp(input.confidenceBefore, 0, 100);
  const confidenceAfter = clamp(confidenceBefore + g.points + hp + mp, 0, 100);
  const strikes = strikesAfter(input.previousStrikes, g.grade);
  const outcome: Outcome = strikes >= STRIKES_TO_SACK || confidenceAfter <= SACK_AT ? "sacked"
    : strikes > 0 || confidenceAfter <= FINAL_WARNING_AT ? "final_warning"
    : g.grade === "below" ? "warning"
    : "safe";
  return {
    grade: g.grade, forfeitedHalf,
    gradePoints: g.points, honoursPoints: hp, moneyPoints: mp,
    confidenceBefore, confidenceAfter, strikes, outcome,
  };
}

/** The spending freeze: on at confidence + projected grade <= 30, lifted above 35, kept in between. */
export function nextFreeze(confidence: number, projectedPoints: number, wasFrozen: boolean): boolean {
  const sum = confidence + projectedPoints;
  if (sum <= FREEZE_AT) return true;
  if (sum > UNFREEZE_ABOVE) return false;
  return wasFrozen;
}

// ── The rules over fixed inputs (the dev review-table endpoint) ─────────────

export type BoardTableSeason = {
  strengthRank: number;
  finish: number;
  seasonStartBalance: number;
  seasonEndBalance: number;
  finalsResult?: FinalsResult;
  forfeits?: number;
  worldTourMatches?: number;
};
export type BoardTableCareer = {
  label?: string;
  confidence?: number;
  seasons: BoardTableSeason[];
};
export type BoardTableRow = ReviewResult & Bands & { season: number; strengthRank: number; finish: number };

/** A career's reviews, season by season, stopping at a sacking — exactly as the rollover chains them. */
export function boardReviewTable(career: BoardTableCareer): { label: string | null; rows: BoardTableRow[] } {
  let confidence = career.confidence ?? CONFIDENCE_START;
  let strikes = 0;
  const rows: BoardTableRow[] = [];
  for (const [i, s] of career.seasons.entries()) {
    const r = reviewSeason({
      confidenceBefore: confidence,
      strengthRank: s.strengthRank,
      finish: s.finish,
      forfeits: s.forfeits ?? 0,
      worldTourMatches: s.worldTourMatches ?? 54,
      finalsResult: s.finalsResult ?? null,
      seasonStartBalance: s.seasonStartBalance,
      seasonEndBalance: s.seasonEndBalance,
      previousStrikes: strikes,
    });
    rows.push({ ...r, ...bandsFor(s.strengthRank), season: i + 1, strengthRank: s.strengthRank, finish: s.finish });
    confidence = r.confidenceAfter;
    strikes = r.strikes;
    if (r.outcome === "sacked") break;
  }
  return { label: career.label ?? null, rows };
}

export type BoardProjectionInput = { confidence: number; strengthRank: number; rank: number; wasFrozen?: boolean };

/** What the monthly check makes of a standings rank. */
export function boardProjection(p: BoardProjectionInput) {
  const g = gradeFor(p.strengthRank, p.rank);
  return {
    ...p,
    grade: g.grade,
    points: g.points,
    warning: g.grade !== "met",
    frozen: nextFreeze(p.confidence, g.points, p.wasFrozen ?? false),
  };
}

// ── Plain words ──────────────────────────────────────────────────────────────

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
const dollars = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const signed = (v: number) => (v > 0 ? `+${v}` : `${v}`);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function targetWords(metLine: number): string {
  return metLine >= FIELD_CLUBS ? "any finish" : `a top-${metLine} finish`;
}

/** R-58: the dashboard's short form — "top 4", "any finish". */
function expectsShort(metLine: number): string {
  return metLine >= FIELD_CLUBS ? "any finish" : `top ${metLine}`;
}

const STANDING_WORDS: Record<Grade, string> = {
  met: "On track",
  below: "Below expectations",
  failed: "Failing expectations",
};

/** "5th-8th is below expectations, a warning with no strike; 9th or worse fails the season". */
export function bandWords(b: Bands): string {
  if (b.belowFrom == null) return "no finish counts against you";
  const belowTo = b.failedFrom != null ? b.failedFrom - 1 : FIELD_CLUBS;
  const below = b.belowFrom === belowTo
    ? `${ordinal(b.belowFrom)} is below expectations`
    : `${ordinal(b.belowFrom)}-${ordinal(belowTo)} is below expectations`;
  return b.failedFrom == null
    ? `${below}, a warning with no strike; no finish fails the season`
    : `${below}, a warning with no strike; ${ordinal(b.failedFrom)} or worse fails the season`;
}

const OUTCOME_WORDS: Record<Outcome, string> = {
  safe: "Safe.",
  warning: "Below expectations: a warning, but no strike.",
  final_warning: "Final warning: a failed season before one that meets expectations, or confidence of 20 or less at a review, ends your time here.",
  sacked: "Sacked.",
};

export function expectationText(row: BoardSeason, fieldClubs: number | null, previous: BoardSeason | null): string {
  if (row.target == null || row.strengthRank == null) {
    const base = `The board sets this season's expectation when the World Tour is drawn (round ${WORLD_TOUR_START}), from how your best pair ranks in the field.`;
    return previous?.target != null ? `${base} Last season it expected ${targetWords(previous.target)}.` : base;
  }
  const b = bandsFor(row.strengthRank);
  const clubs = fieldClubs ?? FIELD_CLUBS;
  const strength = row.pairRating == null
    ? "You did not have two contracted players at the draw, so your squad ranks last in the World Tour field."
    : `Your best pair (rated ${row.pairRating.toFixed(1)}) ranks ${ordinal(row.strengthRank)} of the ${clubs} clubs in this World Tour field.`;
  return `The board expects ${targetWords(b.metLine)} this season: ${bandWords(b)}. ${strength}`;
}

export function reviewText(row: BoardSeason): string {
  const n = seasonNumberForYear(row.seasonYear);
  const grade = row.grade as Grade;
  const forfeited = (row.worldTourMatches ?? 0) > 0 && row.forfeits * 2 >= (row.worldTourMatches ?? 0)
    ? " (at least half its matches forfeited)" : "";
  const gradePart = grade === "below" ? `${GRADE_WORDS.below}${forfeited}` : `${GRADE_WORDS[grade]}${forfeited} ${signed(row.gradePoints ?? 0)}`;
  const honours = row.honoursPoints ? `, ${row.honours} ${signed(row.honoursPoints)}` : "";
  const cash = row.moneyPoints ? `, money ${signed(row.moneyPoints)}` : "";
  return `Season ${n} review: finished ${ordinal(row.finish ?? FIELD_CLUBS)} against ${targetWords(row.target ?? FIELD_CLUBS)}, `
    + `${gradePart}${honours}${cash}. `
    + `Confidence ${row.confidenceBefore} → ${row.confidenceAfter}. ${outcomeWords(row.outcome)}`;
}

/**
 * A save from before L-01 can hold a season-5 review stored with the retired
 * outcome "verdict" (its career is over — `retiredAt` was set at the same
 * time). It is read as what it was: a review that did not sack.
 */
function outcomeWords(outcome: string | null): string {
  return OUTCOME_WORDS[outcome as Outcome] ?? OUTCOME_WORDS.safe;
}

export function verdictText(
  row: BoardSeason, previous: BoardSeason | null, strikes: number, confidence: number, gameDate: string,
): string {
  if (row.reviewedOn) return reviewText(row);
  const parts: string[] = [];
  if (strikes > 0) {
    parts.push("You carry a strike from a failed season: another failed season before one that meets expectations ends your time here.");
  } else if (previous?.outcome === "final_warning") {
    parts.push("You are on a final warning from last season's review.");
  }
  if (row.unfieldableSince) {
    const days = daysBetween(row.unfieldableSince, gameDate);
    parts.push(`You have not been able to put two contracted players on the sand for ${plural(days, "day")}. `
      + `At ${ABANDONMENT_DAYS} days the board sacks you at your next forfeit.`);
  }
  if (row.target == null || row.strengthRank == null) {
    parts.push("No verdict yet: the board judges the season once the World Tour is under way.");
  } else if (row.projectedFinish == null || row.projectedGrade == null) {
    parts.push("No verdict yet: the board first checks the standings a month after the World Tour draw.");
  } else {
    const grade = row.projectedGrade as Grade;
    const consequence = grade === "met" ? "" : grade === "below" ? " That would be a warning, not a strike." : " A failed season is a strike.";
    parts.push(`At its last monthly check you were ${ordinal(row.projectedFinish)} against ${targetWords(row.target)}: `
      + `so far the board would say you ${grade === "failed" ? "failed" : GRADE_WORDS[grade]}.${consequence}`);
  }
  parts.push(`Board confidence ${confidence}.`);
  if (row.spendingFrozen) {
    parts.push("New signings, staff hires and facility upgrades are frozen until the standings improve; renewing a contract on the same terms is still allowed.");
  }
  return parts.join(" ");
}

// ── Database ─────────────────────────────────────────────────────────────────

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** The club's contracted players able to play — active and not injured (R-48, R-50). */
function ablePlayersTx(tx: Tx, careerSaveId: number, teamId: number) {
  return tx.select({
    speed: careerPlayerStateTable.speed, power: careerPlayerStateTable.power,
    defense: careerPlayerStateTable.defense, serve: careerPlayerStateTable.serve,
    block: careerPlayerStateTable.block, stamina: careerPlayerStateTable.stamina,
  }).from(careerPlayerStateTable).where(and(
    eq(careerPlayerStateTable.careerSaveId, careerSaveId),
    eq(careerPlayerStateTable.teamId, teamId),
    eq(careerPlayerStateTable.isActive, true),
    eq(careerPlayerStateTable.isInjured, false),
    eq(careerPlayerStateTable.injuryStatus, "Healthy"),
  )).all();
}

type Rated = Parameters<typeof sideRating>[0][number];

/** The club's pair: sideRating over its best two players (the engine's own rating), or null without two. */
export function pairRating(players: Rated[]): number | null {
  if (players.length < PAIR_SIZE) return null;
  const best = [...players].sort((a, b) => sideRating([b]) - sideRating([a])).slice(0, PAIR_SIZE);
  return sideRating(best);
}

function playerRankTx(tx: Tx, careerSaveId: number, seasonYear: number, teamId: number): number | null {
  return worldTourStandingsTx(tx, careerSaveId, seasonYear).find((r) => r.isPlayer && r.teamId === teamId)?.rank ?? null;
}

function confidenceTx(tx: Tx, teamId: number): number {
  const row = tx.select({ c: teamsTable.boardConfidence }).from(teamsTable).where(eq(teamsTable.id, teamId)).get();
  return clamp(row?.c ?? CONFIDENCE_START, 0, 100);
}

function boardRowTx(tx: Tx, careerSaveId: number, seasonYear: number): BoardSeason | undefined {
  return tx.select().from(boardSeasonsTable).where(and(
    eq(boardSeasonsTable.careerSaveId, careerSaveId),
    eq(boardSeasonsTable.seasonYear, seasonYear),
  )).get();
}

/** Strikes carried into a season: its reviewed predecessors, newest first, counted back to the last met season. */
function strikesBeforeTx(tx: Tx, careerSaveId: number, seasonYear: number): number {
  const reviewed = tx.select({ grade: boardSeasonsTable.grade }).from(boardSeasonsTable).where(and(
    eq(boardSeasonsTable.careerSaveId, careerSaveId),
    lt(boardSeasonsTable.seasonYear, seasonYear),
    isNotNull(boardSeasonsTable.reviewedOn),
  )).orderBy(desc(boardSeasonsTable.seasonYear)).all();
  let strikes = 0;
  for (const r of reviewed) {
    if (r.grade === "failed") strikes++;
    else if (r.grade !== "below") break;
  }
  return strikes;
}

/** The season's board row, created with the club's balance at that moment. */
export function ensureBoardSeasonTx(tx: Tx, careerSaveId: number, seasonYear: number, teamId: number): BoardSeason {
  const existing = boardRowTx(tx, careerSaveId, seasonYear);
  if (existing) return existing;
  const team = tx.select({ budget: teamsTable.budget }).from(teamsTable).where(eq(teamsTable.id, teamId)).get();
  tx.insert(boardSeasonsTable)
    .values({ careerSaveId, seasonYear, seasonStartBalance: Number(team?.budget ?? 0) })
    .onConflictDoNothing()
    .run();
  return boardRowTx(tx, careerSaveId, seasonYear)!;
}

export function ensureBoardSeason(careerSaveId: number, seasonYear: number, teamId: number): BoardSeason {
  return db.transaction((tx) => ensureBoardSeasonTx(tx, careerSaveId, seasonYear, teamId));
}

/** Set the season's expectation once the World Tour is drawn. Idempotent. */
export function setBoardTargetTx(tx: Tx, careerSaveId: number, seasonYear: number, teamId: number): BoardSeason {
  const row = ensureBoardSeasonTx(tx, careerSaveId, seasonYear, teamId);
  if (row.target != null) return row;
  const drawn = tx.select({ id: worldTourFixturesTable.id }).from(worldTourFixturesTable).where(and(
    eq(worldTourFixturesTable.careerSaveId, careerSaveId),
    eq(worldTourFixturesTable.seasonYear, seasonYear),
  )).limit(1).get();
  if (!drawn) return row;
  const field = worldTourFieldTx(tx, careerSaveId, seasonYear);
  if (field.length === 0) return row;

  const ratings = poolClubRatingsTx(tx);
  const pair = pairRating(ablePlayersTx(tx, careerSaveId, teamId));
  const strengthRank = 1 + field.filter((f) => pair == null || (ratings.get(f.poolTeamId) ?? 0) > pair).length;
  tx.update(boardSeasonsTable).set({
    pairRating: pair, strengthRank, target: bandsFor(strengthRank).metLine, updatedAt: new Date(),
  }).where(eq(boardSeasonsTable.id, row.id)).run();
  return boardRowTx(tx, careerSaveId, seasonYear)!;
}

/**
 * The board's day, run on every calendar advance: the expectation once the
 * World Tour is drawn, whether the club can still field a side, and — every 30
 * game days from the draw — the projected band that drives warnings and the
 * spending freeze. It never sacks.
 */
export function boardDay(careerSaveId: number, seasonYear: number, teamId: number, gameDate: string): void {
  db.transaction((tx) => {
    const row = setBoardTargetTx(tx, careerSaveId, seasonYear, teamId);
    if (row.reviewedOn) return;

    const unfieldable = ablePlayersTx(tx, careerSaveId, teamId).length < PAIR_SIZE;
    const unfieldableSince = unfieldable ? (row.unfieldableSince ?? gameDate) : null;

    let projectedOn = row.projectedOn;
    let projectedFinish = row.projectedFinish;
    let projectedGrade = row.projectedGrade;
    let spendingFrozen = row.spendingFrozen;
    if (row.target != null && row.strengthRank != null) {
      if (projectedOn == null) {
        projectedOn = gameDate;                         // the monthly clock starts at the draw
      } else if (daysBetween(projectedOn, gameDate) >= CHECK_EVERY_DAYS) {
        const rank = playerRankTx(tx, careerSaveId, seasonYear, teamId);
        if (rank != null) {
          const g = gradeFor(row.strengthRank, rank);
          projectedOn = gameDate;
          projectedFinish = rank;
          projectedGrade = g.grade;
          spendingFrozen = nextFreeze(confidenceTx(tx, teamId), g.points, row.spendingFrozen);
        }
      }
    }

    if (unfieldableSince !== row.unfieldableSince || projectedOn !== row.projectedOn
      || projectedFinish !== row.projectedFinish || projectedGrade !== row.projectedGrade
      || spendingFrozen !== row.spendingFrozen) {
      tx.update(boardSeasonsTable).set({
        unfieldableSince, projectedOn, projectedFinish, projectedGrade, spendingFrozen, updatedAt: new Date(),
      }).where(eq(boardSeasonsTable.id, row.id)).run();
    }
  });
}

/**
 * A forfeit, as the board sees it: a World Tour forfeit counts for the review,
 * and when the club cannot field a side, how many days that has been true.
 */
export function recordBoardForfeit(
  careerSaveId: number, seasonYear: number, teamId: number, round: number, gameDate: string,
): { abandonedDays: number | null } {
  return db.transaction((tx) => {
    const row = ensureBoardSeasonTx(tx, careerSaveId, seasonYear, teamId);
    const unfieldable = ablePlayersTx(tx, careerSaveId, teamId).length < PAIR_SIZE;
    const unfieldableSince = unfieldable ? (row.unfieldableSince ?? gameDate) : null;
    tx.update(boardSeasonsTable).set({
      forfeits: row.forfeits + (round >= WORLD_TOUR_START ? 1 : 0),
      unfieldableSince,
      updatedAt: new Date(),
    }).where(eq(boardSeasonsTable.id, row.id)).run();
    return { abandonedDays: unfieldableSince ? daysBetween(unfieldableSince, gameDate) : null };
  });
}

export type SeasonReview = ReviewResult & {
  seasonYear: number; strengthRank: number; finish: number; target: number; failedFrom: number | null; text: string;
};

function storedReviewTx(tx: Tx, row: BoardSeason): SeasonReview {
  const grade = row.grade as Grade;
  const strengthRank = row.strengthRank ?? FIELD_CLUBS;
  return {
    grade,
    forfeitedHalf: (row.worldTourMatches ?? 0) > 0 && row.forfeits * 2 >= (row.worldTourMatches ?? 0),
    gradePoints: row.gradePoints ?? 0,
    honoursPoints: row.honoursPoints ?? 0,
    moneyPoints: row.moneyPoints ?? 0,
    confidenceBefore: row.confidenceBefore ?? 0,
    confidenceAfter: row.confidenceAfter ?? 0,
    strikes: strikesAfter(strikesBeforeTx(tx, row.careerSaveId, row.seasonYear), grade),
    outcome: row.outcome as Outcome,
    seasonYear: row.seasonYear,
    strengthRank,
    finish: row.finish ?? FIELD_CLUBS,
    target: row.target ?? FIELD_CLUBS,
    failedFrom: bandsFor(strengthRank).failedFrom,
    text: reviewText(row),
  };
}

/** The season-end review, inside the rollover's transaction. Idempotent. */
export function boardReviewTx(
  tx: Tx, careerSaveId: number, seasonYear: number, teamId: number,
): SeasonReview {
  const row = setBoardTargetTx(tx, careerSaveId, seasonYear, teamId);
  if (row.reviewedOn && row.outcome) return storedReviewTx(tx, row);

  // A season that somehow never reached a draw has no field to rank against:
  // it is judged as the weakest squad, so no finish fails it on position.
  const strengthRank = row.strengthRank ?? FIELD_CLUBS;
  const finish = playerRankTx(tx, careerSaveId, seasonYear, teamId) ?? FIELD_CLUBS;
  const worldTourMatches = tx.select({ id: matchesTable.id }).from(matchesTable).where(and(
    or(eq(matchesTable.homeTeamId, teamId), eq(matchesTable.awayTeamId, teamId)),
    eq(matchesTable.season, seasonYear),
    eq(matchesTable.status, "completed"),
    gte(matchesTable.round, WORLD_TOUR_START),
  )).all().length;
  const finalsResult = worldFinalsSummaryTx(tx, careerSaveId, seasonYear, teamId).playerResult;
  const team = tx.select({ budget: teamsTable.budget }).from(teamsTable).where(eq(teamsTable.id, teamId)).get();

  const r = reviewSeason({
    confidenceBefore: confidenceTx(tx, teamId),
    strengthRank, finish, forfeits: row.forfeits, worldTourMatches, finalsResult,
    seasonStartBalance: row.seasonStartBalance,
    seasonEndBalance: Number(team?.budget ?? 0),
    previousStrikes: strikesBeforeTx(tx, careerSaveId, seasonYear),
  });

  tx.update(boardSeasonsTable).set({
    strengthRank, target: bandsFor(strengthRank).metLine, finish, worldTourMatches,
    grade: r.grade, gradePoints: r.gradePoints,
    honours: finalsResult ?? "did not qualify", honoursPoints: r.honoursPoints, moneyPoints: r.moneyPoints,
    confidenceBefore: r.confidenceBefore, confidenceAfter: r.confidenceAfter,
    outcome: r.outcome, reviewedOn: `${seasonYear}-12-31`, spendingFrozen: false,
    updatedAt: new Date(),
  }).where(eq(boardSeasonsTable.id, row.id)).run();
  tx.update(teamsTable).set({ boardConfidence: r.confidenceAfter }).where(eq(teamsTable.id, teamId)).run();

  return storedReviewTx(tx, boardRowTx(tx, careerSaveId, seasonYear)!);
}

export type BoardStatus = {
  seasonYear: number;
  confidence: number;
  stage: BoardStage;
  spendingBlocked: boolean;
  expectation: string;
  verdict: string;
  target: number | null;
  failedFrom: number | null;
  strengthRank: number | null;
  strikes: number;
  projectedFinish: number | null;
  projectedGrade: string | null;
  /** R-58: the club's standings rank right now, once it has a World Tour result; null before. */
  currentFinish: number | null;
  /** R-58: that rank graded by the board's bands. */
  currentGrade: Grade | null;
  /** R-58: "Board expects: top 4 · Currently: 3rd · On track"; null before the draw. */
  standing: string | null;
  lastReview: {
    seasonYear: number; finish: number; target: number; grade: string; outcome: Outcome;
    confidenceBefore: number; confidenceAfter: number; text: string;
  } | null;
};

/** What the dashboard and the contract page show: the board's expectation and verdict, in words. */
export function boardStatus(careerSaveId: number, seasonYear: number, teamId: number, gameDate: string): BoardStatus {
  return db.transaction((tx): BoardStatus => {
    const row = setBoardTargetTx(tx, careerSaveId, seasonYear, teamId);
    const confidence = confidenceTx(tx, teamId);
    const previous = tx.select().from(boardSeasonsTable).where(and(
      eq(boardSeasonsTable.careerSaveId, careerSaveId),
      lt(boardSeasonsTable.seasonYear, seasonYear),
    )).orderBy(desc(boardSeasonsTable.seasonYear)).limit(1).get() ?? null;
    const reviewed = row.reviewedOn ? row : previous?.reviewedOn ? previous : null;
    const fieldClubs = row.target != null ? worldTourFieldTx(tx, careerSaveId, seasonYear).length + 1 : null;
    const strikes = strikesBeforeTx(tx, careerSaveId, seasonYear);

    const stage: BoardStage = !row.reviewedOn && (strikes > 0 || previous?.outcome === "final_warning") ? "final_warning"
      : row.spendingFrozen ? "spending_freeze"
      : row.projectedGrade != null && row.projectedGrade !== "met" ? "warning"
      : "safe";

    // R-58: where the club stands right now, against the same bands the review
    // will use — the monthly check's projection can be up to a month old.
    const mine = row.strengthRank != null
      ? worldTourStandingsTx(tx, careerSaveId, seasonYear).find((r) => r.isPlayer && r.teamId === teamId) ?? null
      : null;
    const currentFinish = mine != null && mine.wins + mine.losses > 0 ? mine.rank : null;
    const currentGrade = currentFinish != null && row.strengthRank != null ? gradeFor(row.strengthRank, currentFinish).grade : null;
    const standing = row.strengthRank == null ? null
      : `Board expects: ${expectsShort(bandsFor(row.strengthRank).metLine)} · ${currentFinish == null || currentGrade == null
        ? "No World Tour result yet"
        : `Currently: ${ordinal(currentFinish)} · ${STANDING_WORDS[currentGrade]}`}`;

    return {
      seasonYear,
      confidence,
      stage,
      spendingBlocked: row.spendingFrozen,
      expectation: expectationText(row, fieldClubs, previous),
      verdict: verdictText(row, previous, strikes, confidence, gameDate),
      target: row.target,
      failedFrom: row.strengthRank != null ? bandsFor(row.strengthRank).failedFrom : null,
      strengthRank: row.strengthRank,
      strikes,
      projectedFinish: row.projectedFinish,
      projectedGrade: row.projectedGrade,
      currentFinish,
      currentGrade,
      standing,
      lastReview: reviewed ? {
        seasonYear: reviewed.seasonYear,
        finish: reviewed.finish ?? FIELD_CLUBS,
        target: reviewed.target ?? FIELD_CLUBS,
        grade: reviewed.grade ?? "met",
        outcome: reviewed.outcome as Outcome,
        confidenceBefore: reviewed.confidenceBefore ?? 0,
        confidenceAfter: reviewed.confidenceAfter ?? 0,
        text: reviewText(reviewed),
      } : null,
    };
  });
}

/**
 * The refusal message for new spending (a signing, a hire, an upgrade, a
 * renewal at a raise), or null when allowed. Only the board's monthly check
 * freezes spending (R-53); the money bracket that used to decide this is gone.
 */
export async function checkSpendingAllowed(careerSaveId: number): Promise<string | null> {
  const season = await getActiveSeasonForCareer(careerSaveId);
  if (!season) return null;
  const [row] = await db.select({ frozen: boardSeasonsTable.spendingFrozen }).from(boardSeasonsTable).where(and(
    eq(boardSeasonsTable.careerSaveId, careerSaveId),
    eq(boardSeasonsTable.seasonYear, season.year),
  )).limit(1);
  return row?.frozen ? SPENDING_FROZEN_MESSAGE : null;
}
