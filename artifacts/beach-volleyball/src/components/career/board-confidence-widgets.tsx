/**
 * Shared board-confidence UI (R-09, docs/economy-design.md §5 "Fail state").
 *
 * Extracted from manager-contract.tsx (which built these first) so the
 * dashboard's at-risk banner + confidence meter and the contract page's
 * banner + meter + ladder are the same components reading the same
 * GET /board-confidence response — one visual language for the whole fail
 * state, not two that can drift.
 */
import type { BoardConfidenceStage } from "@workspace/api-client-react";
import {
  AlertTriangle, AlertCircle, Flame, Users, TrendingUp, Landmark,
  Wallet, UserMinus, ShieldX, ShieldCheck,
} from "lucide-react";

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ");
}

// ── Warning banner ────────────────────────────────────────────────────────────

export function WarningBanner({ score, warning }: { score: number; warning: string }) {
  const isDismissal = score <  5;
  const isAtRisk    = score < 15;

  const config = isDismissal
    ? {
        bg:    "bg-rose-500/12 border-rose-500/30",
        icon:  Flame,
        colour: "text-rose-400",
        title: warning,
        sub:   "The board is actively discussing replacing you. Urgently improve results.",
      }
    : isAtRisk
    ? {
        bg:    "bg-orange-500/12 border-orange-500/30",
        icon:  AlertCircle,
        colour: "text-orange-400",
        title: warning,
        sub:   "Your position is under serious threat. A run of wins is essential.",
      }
    : {
        bg:    "bg-amber-500/10 border-amber-500/25",
        icon:  AlertTriangle,
        colour: "text-amber-400",
        title: warning,
        sub:   "The board is watching closely. Avoid further losses and improve finances.",
      };

  const Icon = config.icon;

  return (
    <div className={cn("rounded-2xl border p-4 flex items-start gap-4", config.bg)}>
      <div className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center bg-white/5 border border-white/10">
        <Icon className={cn("h-5 w-5", config.colour)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-black", config.colour)}>{config.title}</p>
        <p className="text-xs text-white/50 mt-0.5 leading-snug">{config.sub}</p>
      </div>
      <span className={cn("text-2xl font-black tabular-nums shrink-0", config.colour)}>
        {score}%
      </span>
    </div>
  );
}

// ── Board confidence bar ───────────────────────────────────────────────────────

export function BoardConfidenceBar({
  score, label, financeHealth, recentForm, financeAdjustment,
}: {
  score: number; label: string; financeHealth: string;
  recentForm: string; financeAdjustment: number;
}) {
  const barColour =
    score >= 70 ? "bg-emerald-500" :
    score >= 50 ? "bg-blue-500"    :
    score >= 30 ? "bg-amber-500"   :
    score >= 15 ? "bg-orange-500"  : "bg-rose-500";

  const labelColour =
    score >= 70 ? "text-emerald-400" :
    score >= 50 ? "text-blue-400"    :
    score >= 30 ? "text-amber-400"   :
    score >= 15 ? "text-orange-400"  : "text-rose-400";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-white/40" />
          <span className="text-sm font-semibold text-white/80">Board Confidence</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-semibold", labelColour)}>{label}</span>
          <span className="text-lg font-black text-white tabular-nums">{score}%</span>
        </div>
      </div>
      <div className="h-3 w-full bg-white/8 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", barColour)} style={{ width: `${score}%` }} />
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <div className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/3 px-2.5 py-1.5 text-[10px] font-semibold text-white/50">
          <Landmark className="h-3 w-3" />
          Finances: <span className={cn("ml-0.5",
            financeHealth === "Strong" ? "text-emerald-400" :
            financeHealth === "Stable" ? "text-blue-400"    :
            financeHealth === "Tight"  ? "text-amber-400"   :
            financeHealth === "Poor"   ? "text-orange-400"  : "text-rose-400",
          )}>{financeHealth}</span>
          {financeAdjustment !== 0 && (
            <span className={financeAdjustment > 0 ? "text-emerald-400" : "text-rose-400"}>
              ({financeAdjustment > 0 ? "+" : ""}{financeAdjustment})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/3 px-2.5 py-1.5 text-[10px] font-semibold text-white/50">
          <TrendingUp className="h-3 w-3" />
          Form: <span className="ml-0.5 text-white/70">{recentForm}</span>
        </div>
      </div>
    </div>
  );
}

// ── Escalation ladder ─────────────────────────────────────────────────────────
// Mirrors artifacts/api-server/src/utils/board-confidence.ts's CONFIDENCE_LADDER
// — same four stages, same order. Kept as frontend copy (not fetched) because
// it is display text for a fixed, small set of stages, same as every other
// label in this file.

const LADDER_STEPS: ReadonlyArray<{
  stage: Exclude<BoardConfidenceStage, "safe">;
  icon: typeof AlertTriangle;
  label: string;
  description: string;
}> = [
  { stage: "warning",             icon: AlertTriangle, label: "Warning",              description: "Board is concerned. Avoid further losses." },
  { stage: "spending_blocked",    icon: Wallet,         label: "Spending Blocked",     description: "New signings, hires and upgrades are frozen." },
  { stage: "forced_sale_pending", icon: UserMinus,      label: "Forced Sale Pending",  description: "The board is preparing to force a sale." },
  { stage: "sacked",              icon: ShieldX,        label: "Sacked",               description: "Contract terminated. Career ends." },
];

export function ConfidenceLadder({ stage }: { stage: BoardConfidenceStage }) {
  const currentIndex = stage === "safe" ? -1 : LADDER_STEPS.findIndex(s => s.stage === stage);

  if (stage === "safe") {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3">
        <div className="h-9 w-9 shrink-0 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-black text-emerald-400">In Good Standing</p>
          <p className="text-xs text-white/40 mt-0.5">
            The board has no concerns. The escalation ladder below only activates once confidence drops.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/3 p-5">
      <p className="text-[9px] uppercase tracking-widest text-white/35 font-semibold mb-4">Escalation Ladder</p>
      <div className="space-y-0">
        {LADDER_STEPS.map((step, i) => {
          const isCurrent = i === currentIndex;
          const isPast    = i < currentIndex;
          const isFuture  = i > currentIndex;
          const Icon = step.icon;

          const colour =
            isCurrent ? (step.stage === "sacked" ? "text-rose-400" : "text-orange-400") :
            isPast    ? "text-white/50" :
            "text-white/25";

          return (
            <div key={step.stage} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={cn(
                  "h-8 w-8 shrink-0 rounded-full flex items-center justify-center border",
                  isCurrent ? "bg-rose-500/15 border-rose-500/40" :
                  isPast    ? "bg-white/8 border-white/20" :
                  "bg-white/3 border-white/10",
                )}>
                  <Icon className={cn("h-4 w-4", colour)} />
                </div>
                {i < LADDER_STEPS.length - 1 && (
                  <div className={cn("w-px flex-1 min-h-[20px]", isPast ? "bg-white/20" : "bg-white/8")} />
                )}
              </div>
              <div className={cn("pb-5", isFuture && "opacity-50")}>
                <div className="flex items-center gap-2">
                  <p className={cn("text-sm font-bold", isCurrent ? colour : "text-white/70")}>{step.label}</p>
                  {isCurrent && (
                    <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/25">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/40 mt-0.5">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
