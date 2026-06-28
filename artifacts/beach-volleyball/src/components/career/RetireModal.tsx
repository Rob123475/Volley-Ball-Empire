import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCareerSummary,
  getGetCareerSummaryQueryKey,
  useEndCareer,
} from "@workspace/api-client-react";
import type { CareerSummary } from "@workspace/api-client-react";
import {
  Sunset,
  Trophy,
  Award,
  Star,
  Activity,
  TrendingUp,
  Globe,
  DollarSign,
  CheckCircle2,
  Loader2,
  X,
  ChevronRight,
} from "lucide-react";

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ");
}

function fmtMoney(val: string | number | undefined): string {
  const n = Number(val ?? 0);
  if (isNaN(n) || n === 0) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000).toLocaleString()}k`;
  return `$${n.toLocaleString()}`;
}

// ── Stat cell used in the final summary ───────────────────────────────────────

function SummaryCell({
  label,
  value,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  accent: string;
  icon: React.FC<{ className?: string }>;
}) {
  return (
    <div className={cn("rounded-xl border px-3 py-2.5", accent)}>
      <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">
        <Icon className="h-2.5 w-2.5" />
        {label}
      </div>
      <div className="text-xl font-black text-white leading-none tabular-nums">{value}</div>
    </div>
  );
}

// ── Step 1: Confirm retirement ────────────────────────────────────────────────

function ConfirmStep({
  summary,
  isLoading,
  onConfirm,
  onClose,
  isPending,
}: {
  summary: CareerSummary | undefined;
  isLoading: boolean;
  onConfirm: () => void;
  onClose: () => void;
  isPending: boolean;
}) {
  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center shrink-0">
            <Sunset className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-base font-black text-white">Retire from Management?</h2>
            <p className="text-[11px] text-white/40 mt-0.5">Your career will be archived · save data kept</p>
          </div>
        </div>
        <button onClick={onClose} disabled={isPending} className="text-white/30 hover:text-white/60 transition-colors shrink-0 mt-0.5">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Summary preview */}
      {isLoading ? (
        <div className="px-6 pb-4 space-y-2">
          <div className="h-12 rounded-xl bg-white/5 animate-pulse" />
          <div className="grid grid-cols-2 gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        </div>
      ) : summary ? (
        <div className="px-6 pb-4 space-y-2">
          {/* Identity */}
          <div className="rounded-xl border border-white/8 bg-white/4 px-4 py-3">
            <p className="text-sm font-black text-white">{summary.managerName}</p>
            <p className="text-[11px] text-white/40 mt-0.5">{summary.clubName} · {summary.season}</p>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-2">
            <SummaryCell label="Wins" value={summary.totalWins} accent="border-emerald-500/20 bg-emerald-500/8 text-emerald-300" icon={TrendingUp} />
            <SummaryCell label="Titles" value={summary.worldTitles} accent="border-amber-500/20 bg-amber-500/8 text-amber-300" icon={Trophy} />
            <SummaryCell label="Olympic Medals" value={summary.olympicMedals} accent="border-sky-500/20 bg-sky-500/8 text-sky-300" icon={Award} />
            <SummaryCell label="Reputation" value={`${summary.managerReputation} / 100`} accent="border-violet-500/20 bg-violet-500/8 text-violet-300" icon={Star} />
          </div>
        </div>
      ) : null}

      {/* Warning */}
      <div className="mx-6 mb-4 rounded-xl bg-orange-500/8 border border-orange-500/20 px-4 py-3">
        <p className="text-[11px] text-orange-200/80 leading-relaxed">
          Retirement is permanent for this career. Your stats and achievements will be saved to the Hall of Fame, and you can start fresh from the Career screen. Your save data will not be deleted.
        </p>
      </div>

      {/* Actions */}
      <div className="px-6 pb-6 flex gap-3">
        <button
          onClick={onClose}
          disabled={isPending}
          className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-bold text-white/60 hover:bg-white/10 transition-all"
        >
          Not Yet
        </button>
        <button
          onClick={onConfirm}
          disabled={isPending || isLoading}
          className="flex-1 rounded-xl bg-orange-600 hover:bg-orange-500 py-2.5 text-sm font-black text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isPending
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Retiring…</>
            : <><Sunset className="h-4 w-4" /> Retire Now</>
          }
        </button>
      </div>
    </>
  );
}

// ── Step 2: Final career summary ──────────────────────────────────────────────

function FinalSummary({
  summary,
  onDone,
}: {
  summary: CareerSummary;
  onDone: () => void;
}) {
  const totalMatches = summary.totalWins + summary.totalLosses;
  const winPct = totalMatches > 0 ? `${Math.round((summary.totalWins / totalMatches) * 100)}%` : "—";

  return (
    <>
      {/* Header */}
      <div className="px-6 pt-6 pb-4 text-center">
        <div className="h-14 w-14 mx-auto rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center mb-3">
          <Sunset className="h-7 w-7 text-amber-400" />
        </div>
        <h2 className="text-lg font-black text-white">Career Complete</h2>
        <p className="text-[11px] text-white/40 mt-0.5">
          {summary.managerName} has retired from management
        </p>
      </div>

      {/* Main stat strip */}
      <div className="mx-6 mb-3 rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-950/40 to-orange-950/20 px-4 py-3.5">
        <div className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-400/60 mb-2">Final Club</div>
        <div className="text-base font-black text-white">{summary.clubName}</div>
        <div className="text-[11px] text-white/40 mt-0.5">{summary.season}</div>
      </div>

      {/* Stats grid */}
      <div className="px-6 pb-4 grid grid-cols-2 gap-2">
        <SummaryCell
          label="Matches Played"
          value={totalMatches}
          accent="border-white/10 bg-white/4 text-white"
          icon={Activity}
        />
        <SummaryCell
          label="Wins"
          value={`${summary.totalWins} (${winPct})`}
          accent="border-emerald-500/20 bg-emerald-500/8 text-emerald-300"
          icon={TrendingUp}
        />
        <SummaryCell
          label="World Titles"
          value={summary.worldTitles}
          accent="border-amber-500/20 bg-amber-500/8 text-amber-300"
          icon={Trophy}
        />
        <SummaryCell
          label="Olympic Medals"
          value={summary.olympicMedals}
          accent="border-sky-500/20 bg-sky-500/8 text-sky-300"
          icon={Award}
        />
        <SummaryCell
          label="Reputation"
          value={`${summary.managerReputation} / 100`}
          accent="border-violet-500/20 bg-violet-500/8 text-violet-300"
          icon={Star}
        />
        <SummaryCell
          label="World Ranking"
          value={summary.worldRanking != null ? `#${summary.worldRanking}` : "—"}
          accent="border-blue-500/20 bg-blue-500/8 text-blue-300"
          icon={Globe}
        />
      </div>

      {/* Achievements bar */}
      {summary.totalAchievements != null && (
        <div className="mx-6 mb-4 rounded-xl border border-violet-500/20 bg-violet-500/8 px-4 py-3 flex items-center gap-3">
          <CheckCircle2 className="h-4 w-4 text-violet-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-violet-400/70">Achievements Unlocked</span>
              <span className="text-xs font-black text-violet-300">
                {summary.achievementsCompleted} / {summary.totalAchievements}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-violet-400 transition-all"
                style={{ width: `${Math.round((summary.achievementsCompleted / summary.totalAchievements) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Done button */}
      <div className="px-6 pb-6">
        <button
          onClick={onDone}
          className="w-full rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 py-2.5 text-sm font-bold text-white/80 transition-all flex items-center justify-center gap-2"
        >
          Back to Career Screen
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  onRetired: () => void;
}

export function RetireModal({ onClose, onRetired }: Props) {
  const [step, setStep] = useState<"confirm" | "done">("confirm");
  const [finalSummary, setFinalSummary] = useState<CareerSummary | undefined>();

  const queryClient = useQueryClient();

  const { data: summary, isLoading } = useGetCareerSummary({
    query: { queryKey: getGetCareerSummaryQueryKey() },
  });

  const { mutate: endCareer, isPending } = useEndCareer({
    mutation: {
      onSuccess: () => {
        setFinalSummary(summary);
        setStep("done");
        void queryClient.invalidateQueries();
      },
    },
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-orange-500/20 bg-slate-900 shadow-2xl overflow-hidden">

        {step === "confirm" && (
          <ConfirmStep
            summary={summary}
            isLoading={isLoading}
            onConfirm={() => endCareer(undefined)}
            onClose={onClose}
            isPending={isPending}
          />
        )}

        {step === "done" && finalSummary && (
          <FinalSummary
            summary={finalSummary}
            onDone={onRetired}
          />
        )}

      </div>
    </div>
  );
}
