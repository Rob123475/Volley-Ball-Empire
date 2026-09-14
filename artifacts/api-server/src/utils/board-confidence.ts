/**
 * R-53 — the board judges each season against what it expected of it.
 *
 * Design approved by Rob on 14 Sep 2026 with every proposed number:
 * docs/r53-design.md. This REPLACES R-09's meter, which:
 *   - moved a stored 0-100 value on every result (+3 a win, +8 a Grand Final,
 *     -5 a loss or forfeit) and read it with an absolute budget bracket
 *     (+5 at $300k or more ... -25 in debt), sacking whenever it read zero
 *   - so $300k in the bank made a club unsackable, an underdog could be sacked
 *     for a bad month, and every club had to win 62.5% of its matches to stand
 *     still whatever its squad
 *   - and carried a "forced sale" stage that never sold anyone (deleted)
 *
 * Now:
 *   target    set once the World Tour is drawn: the club's best contracted pair
 *             ranked against the field, plus a difficulty allowance, less money
 *             places for a club that could have bought a better squad
 *   patience  results never sack mid-season. Every 30 game days the board
 *             projects a grade from the standings; that can warn and freeze
 *             spending, nothing more
 *   review    at the season boundary: finish against target, honours, money
 *   sacking   only at a review (confidence <= 20, or a second failed season in
 *             a row) — or for abandonment: 30 game days unable to field a side,
 *             sacked at the next forfeit
 *   season 5  the review is the career verdict and cannot sack
 *
 * The pure rules come first (the rollover, the monthly check and the dev
 * review-table endpoint all call them); the database steps follow.
 */
import {
  db,
  boardSeasonsTable,
  teamsTable,
  careerSavesTable,
  careerPlayerStateTable,
  matchesTable,
  worldTourFixturesTable,
  type BoardSeason,
} from "@workspace/db";
import { and, desc, eq, gte, lt, or } from "drizzle-orm";
import { worldTourFieldTx, poolClubRatingsTx, worldTourStandingsTx, worldFinalsSummaryTx } from "./worldTour.js";
import { sideRating } from "./matchEngine.js";
import { WORLD_TOUR_START } from "./calendarSlots.js";
import { seasonNumberForYear, FINAL_SEASON } from "./seasonRollover.js";
import { getActiveSeasonForCareer } from "../lib/getActiveSeason.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type Difficulty = "underdog" | "established";

// ── The numbers (docs/r53-design.md §4) ──────────────────────────────────────

export const CONFIDENCE_START = 60;
export const DIFFICULTY_ALLOWANCE: Record<Difficulty, number> = { established: 1, underdog: 3 };
export const MONEY_FREE_BALANCE = 300_000;
export const MONEY_PER_PLACE = 150_000;
export const MONEY_PLACES_MAX = 6;
export const TARGET_BEST = 2;
export const TARGET_WORST = 19;
export const SACK_AT = 20;
export const FINAL_WARNING_AT = 35;
export const WARNING_AT = 45;
export const FREEZE_AT = 30;
export const UNFREEZE_ABOVE = 35;
export const CHECK_EVERY_DAYS = 30;
export const ABANDONMENT_DAYS = 30;
/** Two players on the sand: with fewer contracted, active players a club cannot play (R-48). */
export const PAIR_SIZE = 2;

export type Grade = "far_exceeded" | "exceeded" | "met" | "missed" | "failed" | "failed_badly";
export const GRADE_POINTS: Record<Grade, number> = {
  far_exceeded: 20, exceeded: 10, met: 5, missed: -10, failed: -25, failed_badly: -40,
};
export const GRADE_WORDS: Record<Grade, string> = {
  far_exceeded: "far exceeded", exceeded: "exceeded", met: "met", missed: "missed", failed: "failed", failed_badly: "failed badly",
};
export type FinalsResult = "champion" | "runner-up" | "semi-finalist" | "did not qualify" | null;
export type Outcome = "safe" | "final_warning" | "sacked" | "verdict";
export type BoardStage = "safe" | "warning" | "spending_freeze" | "final_warning";

export const SPENDING_FROZEN_MESSAGE =
  "The board has frozen new signings, staff hires and facility upgrades until results improve against its target.";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ── The rules ────────────────────────────────────────────────────────────────

/** 1 place per full $150k of season-start balance above $300k, capped at 6. */
export function moneyPlaces(balance: number): number {
  return clamp(Math.floor(Math.max(0, balance - MONEY_FREE_BALANCE) / MONEY_PER_PLACE), 0, MONEY_PLACES_MAX);
}

/** The target finish: never #1 (winning outright exceeds any target), never below #19. */
export function targetFinish(strengthRank: number, difficulty: Difficulty, seasonStartBalance: number) {
  const allowance = DIFFICULTY_ALLOWANCE[difficulty];
  const places = moneyPlaces(seasonStartBalance);
  const target = clamp(clamp(strengthRank + allowance, TARGET_BEST, TARGET_WORST) - places, TARGET_BEST, TARGET_WORST);
  return { allowance, moneyPlaces: places, target };
}

/** G = target − finish; a season with at least half its matches forfeited is failed badly. */
export function gradeFor(target: number, finish: number, forfeitedHalf = false): { grade: Grade; points: number; delta: number } {
  const delta = target - finish;
  const grade: Grade = forfeitedHalf ? "failed_badly"
    : delta >= 5 ? "far_exceeded"
    : delta >= 2 ? "exceeded"
    : delta >= -1 ? "met"
    : delta >= -4 ? "missed"
    : delta >= -8 ? "failed"
    : "failed_badly";
  return { grade, points: GRADE_POINTS[grade], delta };
}

export function isFailingGrade(grade: string | null | undefined): boolean {
  return grade === "failed" || grade === "failed_badly";
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
  target: number;
  finish: number;
  forfeits: number;
  worldTourMatches: number;
  finalsResult: FinalsResult;
  seasonStartBalance: number;
  seasonEndBalance: number;
  previousGrade: Grade | null;
  isFinalSeason: boolean;
};

export type ReviewResult = {
  grade: Grade;
  delta: number;
  forfeitedHalf: boolean;
  gradePoints: number;
  honoursPoints: number;
  moneyPoints: number;
  confidenceBefore: number;
  confidenceAfter: number;
  outcome: Outcome;
};

export function reviewSeason(input: ReviewInput): ReviewResult {
  const forfeitedHalf = input.worldTourMatches > 0 && input.forfeits * 2 >= input.worldTourMatches;
  const g = gradeFor(input.target, input.finish, forfeitedHalf);
  const hp = honoursPoints(input.finalsResult);
  const mp = moneyPoints(input.seasonStartBalance, input.seasonEndBalance);
  const confidenceBefore = clamp(input.confidenceBefore, 0, 100);
  const confidenceAfter = clamp(confidenceBefore + g.points + hp + mp, 0, 100);
  const outcome: Outcome = input.isFinalSeason ? "verdict"
    : confidenceAfter <= SACK_AT || (isFailingGrade(g.grade) && isFailingGrade(input.previousGrade)) ? "sacked"
    : confidenceAfter <= FINAL_WARNING_AT || isFailingGrade(g.grade) ? "final_warning"
    : "safe";
  return {
    grade: g.grade, delta: g.delta, forfeitedHalf,
    gradePoints: g.points, honoursPoints: hp, moneyPoints: mp,
    confidenceBefore, confidenceAfter, outcome,
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
  seasonStartBalance: number;
  seasonEndBalance: number;
  finish: number;
  finalsResult?: FinalsResult;
  forfeits?: number;
  worldTourMatches?: number;
};
export type BoardTableCareer = {
  label?: string;
  difficulty: Difficulty;
  strengthRank: number;
  confidence?: number;
  seasons: BoardTableSeason[];
};
export type BoardTableRow = ReviewResult & { season: number; moneyPlaces: number; target: number; finish: number };

/** A career's reviews, season by season, stopping at a sacking — exactly as the rollover chains them. */
export function boardReviewTable(career: BoardTableCareer): { label: string | null; rows: BoardTableRow[] } {
  let confidence = career.confidence ?? CONFIDENCE_START;
  let previousGrade: Grade | null = null;
  const rows: BoardTableRow[] = [];
  for (const [i, s] of career.seasons.entries()) {
    const t = targetFinish(career.strengthRank, career.difficulty, s.seasonStartBalance);
    const r = reviewSeason({
      confidenceBefore: confidence,
      target: t.target,
      finish: s.finish,
      forfeits: s.forfeits ?? 0,
      worldTourMatches: s.worldTourMatches ?? 54,
      finalsResult: s.finalsResult ?? null,
      seasonStartBalance: s.seasonStartBalance,
      seasonEndBalance: s.seasonEndBalance,
      previousGrade,
      isFinalSeason: i + 1 >= FINAL_SEASON,
    });
    rows.push({ ...r, season: i + 1, moneyPlaces: t.moneyPlaces, target: t.target, finish: s.finish });
    confidence = r.confidenceAfter;
    previousGrade = r.grade;
    if (r.outcome === "sacked") break;
  }
  return { label: career.label ?? null, rows };
}

export type BoardProjectionInput = { confidence: number; target: number; rank: number; wasFrozen?: boolean };

/** What the monthly check makes of a standings rank. */
export function boardProjection(p: BoardProjectionInput) {
  const g = gradeFor(p.target, p.rank);
  return {
    ...p,
    grade: g.grade,
    points: g.points,
    warning: p.confidence + g.points <= WARNING_AT,
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

export function targetWords(target: number): string {
  return target >= TARGET_WORST ? "any finish" : `a top-${target} finish`;
}

const OUTCOME_WORDS: Record<Outcome, string> = {
  safe: "Safe.",
  final_warning: "Final warning: another failed season, or confidence of 20 or less at the next review, ends your time here.",
  sacked: "Sacked.",
  verdict: "This review is the verdict on your career.",
};

export function expectationText(
  row: BoardSeason, difficulty: Difficulty, fieldClubs: number | null, previous: BoardSeason | null,
): string {
  const who = difficulty === "underdog" ? "an underdog club" : "an established club";
  if (row.target == null) {
    const base = `The board sets this season's target when the World Tour is drawn (round ${WORLD_TOUR_START}).`;
    if (previous?.target != null) return `${base} Last season it expected ${targetWords(previous.target)}.`;
    return `${base} Until then it expects ${targetWords(difficulty === "underdog" ? TARGET_WORST : TARGET_BEST)} from ${who}.`;
  }
  const clubs = fieldClubs ?? TARGET_WORST;
  const strength = row.pairRating == null
    ? "You did not have two contracted players at the draw, so your squad ranks last in the World Tour field"
    : `Your best pair (rated ${row.pairRating.toFixed(1)}) ranks ${ordinal(row.strengthRank ?? clubs)} of the ${clubs} clubs in this World Tour field`;
  const slack = `as ${who} you are given ${plural(row.allowance ?? 0, "place")} of slack`;
  const cash = (row.moneyPlaces ?? 0) > 0
    ? `, and the ${dollars(row.seasonStartBalance)} you started the season with raises the bar by ${plural(row.moneyPlaces ?? 0, "place")}`
    : "";
  return `The board expects ${targetWords(row.target)} this season. ${strength}; ${slack}${cash}.`;
}

export function reviewText(row: BoardSeason): string {
  const n = seasonNumberForYear(row.seasonYear);
  const grade = row.grade as Grade;
  const forfeited = (row.worldTourMatches ?? 0) > 0 && row.forfeits * 2 >= (row.worldTourMatches ?? 0)
    ? " (at least half its matches forfeited)" : "";
  const honours = row.honoursPoints ? `, ${row.honours} ${signed(row.honoursPoints)}` : "";
  const cash = row.moneyPoints ? `, money ${signed(row.moneyPoints)}` : "";
  return `Season ${n} review: finished ${ordinal(row.finish ?? TARGET_WORST)} against ${targetWords(row.target ?? TARGET_WORST)}, `
    + `${GRADE_WORDS[grade]}${forfeited} ${signed(row.gradePoints ?? 0)}${honours}${cash}. `
    + `Confidence ${row.confidenceBefore} → ${row.confidenceAfter}. ${OUTCOME_WORDS[row.outcome as Outcome]}`;
}

export function verdictText(row: BoardSeason, previous: BoardSeason | null, confidence: number, gameDate: string): string {
  if (row.reviewedOn) return reviewText(row);
  const parts: string[] = [];
  if (!row.reviewedOn && previous?.outcome === "final_warning") {
    parts.push("You are on a final warning from last season's review.");
  }
  if (row.unfieldableSince) {
    const days = daysBetween(row.unfieldableSince, gameDate);
    parts.push(`You have not been able to put two contracted players on the sand for ${plural(days, "day")}. `
      + `At ${ABANDONMENT_DAYS} days the board sacks you at your next forfeit.`);
  }
  if (row.target == null) {
    parts.push("No verdict yet: the board judges the season once the World Tour is under way.");
  } else if (row.projectedFinish == null || row.projectedGrade == null) {
    parts.push("No verdict yet: the board first checks the standings a month after the World Tour draw.");
  } else {
    const grade = row.projectedGrade as Grade;
    parts.push(`At its last monthly check you were ${ordinal(row.projectedFinish)} against ${targetWords(row.target)}: `
      + `so far the board would call this season ${GRADE_WORDS[grade]} (${signed(GRADE_POINTS[grade])}).`);
    if (!row.spendingFrozen && confidence + GRADE_POINTS[grade] <= WARNING_AT) {
      parts.push("The board is concerned.");
    }
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

function difficultyTx(tx: Tx, careerSaveId: number): Difficulty {
  const row = tx.select({ difficulty: careerSavesTable.difficulty }).from(careerSavesTable)
    .where(eq(careerSavesTable.id, careerSaveId)).get();
  return row?.difficulty === "underdog" ? "underdog" : "established";
}

/** The club's contracted players able to play — the same set /simulate fields (R-48). */
function ablePlayersTx(tx: Tx, careerSaveId: number, teamId: number) {
  return tx.select({
    speed: careerPlayerStateTable.speed, power: careerPlayerStateTable.power,
    defense: careerPlayerStateTable.defense, serve: careerPlayerStateTable.serve,
    block: careerPlayerStateTable.block, stamina: careerPlayerStateTable.stamina,
  }).from(careerPlayerStateTable).where(and(
    eq(careerPlayerStateTable.careerSaveId, careerSaveId),
    eq(careerPlayerStateTable.teamId, teamId),
    eq(careerPlayerStateTable.isActive, true),
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

/** Set the season's target once the World Tour is drawn. Idempotent. */
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
  const t = targetFinish(strengthRank, difficultyTx(tx, careerSaveId), row.seasonStartBalance);
  tx.update(boardSeasonsTable).set({
    pairRating: pair, strengthRank, allowance: t.allowance, moneyPlaces: t.moneyPlaces, target: t.target,
    updatedAt: new Date(),
  }).where(eq(boardSeasonsTable.id, row.id)).run();
  return boardRowTx(tx, careerSaveId, seasonYear)!;
}

/**
 * The board's day, run on every calendar advance: the target once the World
 * Tour is drawn, whether the club can still field a side, and — every 30 game
 * days from the target — the projected grade that drives warnings and the
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
    if (row.target != null) {
      if (projectedOn == null) {
        projectedOn = gameDate;                         // the monthly clock starts at the target
      } else if (daysBetween(projectedOn, gameDate) >= CHECK_EVERY_DAYS) {
        const rank = playerRankTx(tx, careerSaveId, seasonYear, teamId);
        if (rank != null) {
          const g = gradeFor(row.target, rank);
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

export type SeasonReview = ReviewResult & { seasonYear: number; finish: number; target: number; text: string };

function storedReview(row: BoardSeason): SeasonReview {
  return {
    grade: row.grade as Grade,
    delta: (row.target ?? 0) - (row.finish ?? 0),
    forfeitedHalf: (row.worldTourMatches ?? 0) > 0 && row.forfeits * 2 >= (row.worldTourMatches ?? 0),
    gradePoints: row.gradePoints ?? 0,
    honoursPoints: row.honoursPoints ?? 0,
    moneyPoints: row.moneyPoints ?? 0,
    confidenceBefore: row.confidenceBefore ?? 0,
    confidenceAfter: row.confidenceAfter ?? 0,
    outcome: row.outcome as Outcome,
    seasonYear: row.seasonYear,
    finish: row.finish ?? TARGET_WORST,
    target: row.target ?? TARGET_WORST,
    text: reviewText(row),
  };
}

/** The season-end review, inside the rollover's transaction. Idempotent. */
export function boardReviewTx(
  tx: Tx, careerSaveId: number, seasonYear: number, teamId: number, isFinalSeason: boolean,
): SeasonReview {
  const row = setBoardTargetTx(tx, careerSaveId, seasonYear, teamId);
  if (row.reviewedOn && row.outcome) return storedReview(row);

  const difficulty = difficultyTx(tx, careerSaveId);
  const target = row.target ?? (difficulty === "underdog" ? TARGET_WORST : TARGET_BEST);
  const finish = playerRankTx(tx, careerSaveId, seasonYear, teamId) ?? TARGET_WORST;
  const worldTourMatches = tx.select({ id: matchesTable.id }).from(matchesTable).where(and(
    or(eq(matchesTable.homeTeamId, teamId), eq(matchesTable.awayTeamId, teamId)),
    eq(matchesTable.season, seasonYear),
    eq(matchesTable.status, "completed"),
    gte(matchesTable.round, WORLD_TOUR_START),
  )).all().length;
  const finalsResult = worldFinalsSummaryTx(tx, careerSaveId, seasonYear, teamId).playerResult;
  const team = tx.select({ budget: teamsTable.budget }).from(teamsTable).where(eq(teamsTable.id, teamId)).get();
  const previous = boardRowTx(tx, careerSaveId, seasonYear - 1);

  const r = reviewSeason({
    confidenceBefore: confidenceTx(tx, teamId),
    target, finish, forfeits: row.forfeits, worldTourMatches, finalsResult,
    seasonStartBalance: row.seasonStartBalance,
    seasonEndBalance: Number(team?.budget ?? 0),
    previousGrade: (previous?.grade ?? null) as Grade | null,
    isFinalSeason,
  });

  tx.update(boardSeasonsTable).set({
    target, finish, worldTourMatches,
    grade: r.grade, gradePoints: r.gradePoints,
    honours: finalsResult ?? "did not qualify", honoursPoints: r.honoursPoints, moneyPoints: r.moneyPoints,
    confidenceBefore: r.confidenceBefore, confidenceAfter: r.confidenceAfter,
    outcome: r.outcome, reviewedOn: `${seasonYear}-12-31`, spendingFrozen: false,
    updatedAt: new Date(),
  }).where(eq(boardSeasonsTable.id, row.id)).run();
  tx.update(teamsTable).set({ boardConfidence: r.confidenceAfter }).where(eq(teamsTable.id, teamId)).run();

  return storedReview(boardRowTx(tx, careerSaveId, seasonYear)!);
}

export type BoardStatus = {
  seasonYear: number;
  confidence: number;
  stage: BoardStage;
  spendingBlocked: boolean;
  expectation: string;
  verdict: string;
  target: number | null;
  strengthRank: number | null;
  projectedFinish: number | null;
  projectedGrade: string | null;
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

    const stage: BoardStage = !row.reviewedOn && previous?.outcome === "final_warning" ? "final_warning"
      : row.spendingFrozen ? "spending_freeze"
      : row.projectedGrade != null && confidence + GRADE_POINTS[row.projectedGrade as Grade] <= WARNING_AT ? "warning"
      : "safe";

    return {
      seasonYear,
      confidence,
      stage,
      spendingBlocked: row.spendingFrozen,
      expectation: expectationText(row, difficultyTx(tx, careerSaveId), fieldClubs, previous),
      verdict: verdictText(row, previous, confidence, gameDate),
      target: row.target,
      strengthRank: row.strengthRank,
      projectedFinish: row.projectedFinish,
      projectedGrade: row.projectedGrade,
      lastReview: reviewed ? {
        seasonYear: reviewed.seasonYear,
        finish: reviewed.finish ?? TARGET_WORST,
        target: reviewed.target ?? TARGET_WORST,
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
