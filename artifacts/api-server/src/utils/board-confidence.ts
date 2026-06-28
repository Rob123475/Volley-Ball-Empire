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

// ── Public result builder ─────────────────────────────────────────────────────

export interface BoardConfidenceResult {
  score: number;
  rawScore: number;
  financeAdjustment: number;
  label: string;
  warning: string | null;
  isJobAtRisk: boolean;
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

  return {
    score,
    rawScore,
    financeAdjustment: adj,
    label:       confidenceLabel(score),
    warning,
    isJobAtRisk: score < 15,
    breakdown: {
      financeHealth: financeHealthLabel(budget),
      recentForm:    recentFormLabel(team.winStreak ?? 0, team.wins, team.losses),
    },
  };
}
