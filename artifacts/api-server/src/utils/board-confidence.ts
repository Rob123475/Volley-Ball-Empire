import type { Team } from "@workspace/db";

// ── Win/loss deltas ───────────────────────────────────────────────────────────

/** Board confidence gained per win.
 *  Grand Final (+8) > Continental Final (+5) > normal match (+3). */
export function winConfidenceDelta(isFinal: boolean, isContFinal: boolean): number {
  if (isFinal && !isContFinal) return 8;  // Grand Final
  if (isContFinal)             return 5;  // Continental Final
  return 3;                               // regular match
}

/** Board confidence lost per loss (always -5, floor enforced at write time). */
export const LOSS_CONFIDENCE_DELTA = -5;

// ── Finance adjustment (applied at read-time, not stored) ─────────────────────

function financeAdjustment(budget: number): number {
  if (budget >= 300_000) return  5;
  if (budget >= 100_000) return  0;
  if (budget >=  50_000) return -5;
  if (budget >=       0) return -15;
  return -25; // in debt
}

function financeHealthLabel(budget: number): string {
  if (budget >= 300_000) return "Strong";
  if (budget >= 100_000) return "Stable";
  if (budget >=  50_000) return "Tight";
  if (budget >=       0) return "Poor";
  return "Critical";
}

// ── Labels & warnings ─────────────────────────────────────────────────────────

function recentFormLabel(winStreak: number, wins: number, losses: number): string {
  if (winStreak >= 3) return "Winning streak";
  const total = wins + losses;
  if (total === 0) return "No matches yet";
  const rate = wins / total;
  if (rate >= 0.6) return "Good form";
  if (rate >= 0.4) return "Mixed form";
  return "Poor form";
}

function confidenceLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  if (score >= 30) return "Low";
  return "Critical";
}

function warningText(score: number): string | null {
  if (score <  5) return "Dismissal likely";
  if (score < 15) return "Job at risk";
  if (score < 30) return "Board is concerned";
  return null;
}

// ── Escalation ladder (docs/economy-design.md §5 "Fail state") ────────────────
//
// The four visible stages the board walks a manager through, in order. Each
// stage's threshold reuses the exact score boundaries `warningText` already
// drew (5 / 15 / 30) rather than inventing new ones, so the ladder and the
// warning copy always describe the same board mood.

export type ConfidenceStage =
  | "safe"
  | "warning"
  | "spending_blocked"
  | "forced_sale_pending"
  | "sacked";

export function stageForScore(score: number): ConfidenceStage {
  if (score <= 0) return "sacked";
  if (score <  5) return "forced_sale_pending";
  if (score < 15) return "spending_blocked";
  if (score < 30) return "warning";
  return "safe";
}

/** Stages at and beyond which the board freezes new financial commitments. */
export function isSpendingBlocked(stage: ConfidenceStage): boolean {
  return stage === "spending_blocked" || stage === "forced_sale_pending" || stage === "sacked";
}

export const SPENDING_BLOCKED_MESSAGE =
  "The board has frozen new spending until confidence improves. Win matches or improve finances to lift the freeze.";

/**
 * Returns the refusal message for a new signing/hire/upgrade, or null when
 * spending is allowed. Call at the top of every route that commits new
 * money — signing a player, hiring staff, upgrading a facility — so the
 * "Spending Blocked" ladder stage is an actual gate, not just a label.
 */
export function checkSpendingAllowed(team: Team): string | null {
  const { spendingBlocked } = buildBoardConfidenceResult(team);
  return spendingBlocked ? SPENDING_BLOCKED_MESSAGE : null;
}

export const CONFIDENCE_LADDER: ReadonlyArray<{
  stage: Exclude<ConfidenceStage, "safe">;
  label: string;
  description: string;
}> = [
  { stage: "warning",             label: "Warning",              description: "The board is concerned. Avoid further losses and improve finances." },
  { stage: "spending_blocked",    label: "Spending Blocked",      description: "The board has frozen new signings, staff hires and facility upgrades." },
  { stage: "forced_sale_pending", label: "Forced Sale Pending",   description: "The board is preparing to force the sale of a player to cut costs." },
  { stage: "sacked",              label: "Sacked",                description: "The board has terminated your contract. Your career ends here." },
];

// ── Public result builder ─────────────────────────────────────────────────────

export interface BoardConfidenceResult {
  score: number;
  rawScore: number;
  financeAdjustment: number;
  label: string;
  warning: string | null;
  isJobAtRisk: boolean;
  stage: ConfidenceStage;
  spendingBlocked: boolean;
  breakdown: {
    financeHealth: string;
    recentForm: string;
  };
}

export function buildBoardConfidenceResult(team: Team): BoardConfidenceResult {
  const rawScore = Math.min(100, Math.max(0, team.boardConfidence ?? 60));
  const budget   = Number(team.budget ?? 0);
  const adj      = financeAdjustment(budget);
  const score    = Math.min(100, Math.max(0, rawScore + adj));
  const warning  = warningText(score);
  const stage    = stageForScore(score);

  return {
    score,
    rawScore,
    financeAdjustment: adj,
    label:       confidenceLabel(score),
    warning,
    isJobAtRisk: score < 15,
    stage,
    spendingBlocked: isSpendingBlocked(stage),
    breakdown: {
      financeHealth: financeHealthLabel(budget),
      recentForm:    recentFormLabel(team.winStreak ?? 0, team.wins, team.losses),
    },
  };
}

/**
 * The single player the board would force a sale of, or null if the squad
 * has nobody sellable (the academy player is never a target — release fees
 * come from wages, and an unpaid academy contract isn't a wage burden).
 * Picks the highest-salary senior — same "biggest line item first" logic a
 * real board would apply, and deterministic for the harness to assert on.
 */
export function forcedSaleTarget<T extends { id: number; name: string; salary: number; age: number }>(
  squad: T[],
): T | null {
  const seniors = squad.filter(p => !(p.age >= 14 && p.age <= 18));
  if (seniors.length === 0) return null;
  return seniors.reduce((highest, p) => (p.salary > highest.salary ? p : highest));
}
