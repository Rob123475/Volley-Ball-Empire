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
  CheckCircle2,
  Loader2,
  X,
  ChevronRight,
  LogOut,
  Save,
  Crown,
  AlertTriangle,
} from "lucide-react";

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ");
}

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

// ── Step 1: Three choices ─────────────────────────────────────────────────────

type Choice = "no-save" | "save" | "hof";

function ChoiceStep({
  onChoice,
  onClose,
  isPending,
}: {
  onChoice: (c: Choice) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const OPTIONS: {
    id: Choice;
    label: string;
    desc: string;
    icon: React.FC<{ className?: string }>;
    colour: string;
    border: string;
    bg: string;
    warn?: string;
  }[] = [
    {
      id: "no-save",
      label: "End Career (no save)",
      desc: "Exit to career selection. Progress is not saved to history.",
      icon: LogOut,
      colour: "text-red-400",
      border: "border-red-500/25",
      bg: "hover:bg-red-500/8",
      warn: "Career history will not be recorded",
    },
    {
      id: "save",
      label: "End Career & Save",
      desc: "Save your stats to career history and exit. Can view in Career History.",
      icon: Save,
      colour: "text-sky-400",
      border: "border-sky-500/25",
      bg: "hover:bg-sky-500/8",
    },
    {
      id: "hof",
      label: "Enter Hall of Fame",
      desc: "Officially retire and enshrine your legacy. Full career ceremony included.",
      icon: Crown,
      colour: "text-amber-400",
      border: "border-amber-500/30",
      bg: "hover:bg-amber-500/8",
    },
  ];

  return (
    <>
      <div className="flex items-start justify-between gap-3 p-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center shrink-0">
            <Sunset className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-base font-black text-white">Retire from Management</h2>
            <p className="text-[11px] text-white/40 mt-0.5">Choose how you want to end your career</p>
          </div>
        </div>
        <button onClick={onClose} disabled={isPending} className="text-white/30 hover:text-white/60 transition-colors shrink-0 mt-0.5">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-6 pb-6 space-y-2.5">
        {OPTIONS.map(({ id, label, desc, icon: Icon, colour, border, bg, warn }) => (
          <button
            key={id}
            onClick={() => onChoice(id)}
            disabled={isPending}
            className={cn(
              "w-full flex items-start gap-3.5 rounded-xl border px-4 py-3.5 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed",
              border,
              bg,
            )}
          >
            <div className="mt-0.5 h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
              <Icon className={cn("h-4 w-4", colour)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-bold leading-snug", colour)}>{label}</p>
              <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">{desc}</p>
              {warn && (
                <div className="flex items-center gap-1 mt-1.5">
                  <AlertTriangle className="h-2.5 w-2.5 text-red-400/70 shrink-0" />
                  <span className="text-[10px] text-red-400/70">{warn}</span>
                </div>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-white/20 mt-1 shrink-0" />
          </button>
        ))}
      </div>
    </>
  );
}

// ── Step 2: HoF confirm — query loaded lazily here, not at modal mount ────────

function HofConfirmStep({
  onConfirm,
  onBack,
  isPending,
}: {
  onConfirm: (summary: CareerSummary | undefined) => void;
  onBack: () => void;
  isPending: boolean;
}) {
  // Lazy: only fetch when user has already chosen the HoF path
  const { data: summary, isLoading } = useGetCareerSummary({
    query: {
      queryKey: getGetCareerSummaryQueryKey(),
      retry: false,
    },
  });

  return (
    <>
      <div className="flex items-start justify-between gap-3 p-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
            <Crown className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-black text-white">Enter Hall of Fame</h2>
            <p className="text-[11px] text-white/40 mt-0.5">Your career will be permanently enshrined</p>
          </div>
        </div>
        <button onClick={onBack} disabled={isPending} className="text-white/30 hover:text-white/60 transition-colors shrink-0 mt-0.5">
          <X className="h-4 w-4" />
        </button>
      </div>

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
          <div className="rounded-xl border border-white/8 bg-white/4 px-4 py-3">
            <p className="text-sm font-black text-white">{summary.managerName}</p>
            <p className="text-[11px] text-white/40 mt-0.5">{summary.clubName} · {summary.season}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SummaryCell label="Wins" value={summary.totalWins} accent="border-emerald-500/20 bg-emerald-500/8 text-emerald-300" icon={TrendingUp} />
            <SummaryCell label="Titles" value={summary.worldTitles} accent="border-amber-500/20 bg-amber-500/8 text-amber-300" icon={Trophy} />
            <SummaryCell label="Olympic Medals" value={summary.olympicMedals} accent="border-sky-500/20 bg-sky-500/8 text-sky-300" icon={Award} />
            <SummaryCell label="Reputation" value={`${summary.managerReputation} / 100`} accent="border-violet-500/20 bg-violet-500/8 text-violet-300" icon={Star} />
          </div>
        </div>
      ) : null}

      <div className="mx-6 mb-4 rounded-xl bg-amber-500/8 border border-amber-500/20 px-4 py-3">
        <p className="text-[11px] text-amber-200/80 leading-relaxed">
          This is permanent. Your stats and achievements will be saved to the Hall of Fame and you can start a new career from the Career screen.
        </p>
      </div>

      <div className="px-6 pb-6 flex gap-3">
        <button
          onClick={onBack}
          disabled={isPending}
          className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-bold text-white/60 hover:bg-white/10 transition-all"
        >
          Go Back
        </button>
        <button
          onClick={() => onConfirm(summary)}
          disabled={isPending || isLoading}
          className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-500 py-2.5 text-sm font-black text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isPending
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Enshrining…</>
            : <><Crown className="h-4 w-4" /> Enter Hall of Fame</>
          }
        </button>
      </div>
    </>
  );
}

// ── Step 3: Final summary (HoF path only) ────────────────────────────────────

function FinalSummary({ summary, onDone }: { summary: CareerSummary; onDone: () => void }) {
  const totalMatches = summary.totalWins + summary.totalLosses;
  const winPct = totalMatches > 0 ? `${Math.round((summary.totalWins / totalMatches) * 100)}%` : "—";

  return (
    <>
      <div className="px-6 pt-6 pb-4 text-center">
        <div className="h-14 w-14 mx-auto rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center mb-3">
          <Crown className="h-7 w-7 text-amber-400" />
        </div>
        <h2 className="text-lg font-black text-white">Hall of Fame</h2>
        <p className="text-[11px] text-white/40 mt-0.5">
          {summary.managerName} has been enshrined forever
        </p>
      </div>

      <div className="mx-6 mb-3 rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-950/40 to-orange-950/20 px-4 py-3.5">
        <div className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-400/60 mb-2">Final Club</div>
        <div className="text-base font-black text-white">{summary.clubName}</div>
        <div className="text-[11px] text-white/40 mt-0.5">{summary.season}</div>
      </div>

      <div className="px-6 pb-4 grid grid-cols-2 gap-2">
        <SummaryCell label="Matches Played" value={totalMatches} accent="border-white/10 bg-white/4 text-white" icon={Activity} />
        <SummaryCell label="Wins" value={`${summary.totalWins} (${winPct})`} accent="border-emerald-500/20 bg-emerald-500/8 text-emerald-300" icon={TrendingUp} />
        <SummaryCell label="World Titles" value={summary.worldTitles} accent="border-amber-500/20 bg-amber-500/8 text-amber-300" icon={Trophy} />
        <SummaryCell label="Olympic Medals" value={summary.olympicMedals} accent="border-sky-500/20 bg-sky-500/8 text-sky-300" icon={Award} />
        <SummaryCell label="Reputation" value={`${summary.managerReputation} / 100`} accent="border-violet-500/20 bg-violet-500/8 text-violet-300" icon={Star} />
        <SummaryCell label="World Ranking" value={summary.worldRanking != null ? `#${summary.worldRanking}` : "—"} accent="border-blue-500/20 bg-blue-500/8 text-blue-300" icon={Globe} />
      </div>

      {summary.totalAchievements != null && (
        <div className="mx-6 mb-4 rounded-xl border border-violet-500/20 bg-violet-500/8 px-4 py-3 flex items-center gap-3">
          <CheckCircle2 className="h-4 w-4 text-violet-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-violet-400/70">Achievements</span>
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
  const [step, setStep] = useState<"choice" | "hof-confirm" | "hof-done">("choice");
  const [finalSummary, setFinalSummary] = useState<CareerSummary | undefined>();
  const [isQuitting, setIsQuitting] = useState(false);

  const queryClient = useQueryClient();

  const { mutate: endCareer, isPending: isHofPending } = useEndCareer({
    mutation: {
      onSuccess: () => setStep("hof-done"),
    },
  });

  const isPending = isHofPending || isQuitting;

  async function handleQuit() {
    setIsQuitting(true);
    try {
      await fetch("/api/careers/quit", { method: "POST", credentials: "include" });
    } catch {
      // network error — still proceed to exit
    } finally {
      setIsQuitting(false);
    }
    onRetired();
  }

  function handleChoice(choice: Choice) {
    if (choice === "no-save" || choice === "save") {
      void handleQuit();
    } else {
      setStep("hof-confirm");
    }
  }

  function handleHofConfirm(summary: CareerSummary | undefined) {
    setFinalSummary(summary);
    endCareer(undefined);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-orange-500/20 bg-slate-900 shadow-2xl overflow-hidden">

        {step === "choice" && (
          <ChoiceStep
            onChoice={handleChoice}
            onClose={onClose}
            isPending={isPending}
          />
        )}

        {step === "hof-confirm" && (
          <HofConfirmStep
            onConfirm={handleHofConfirm}
            onBack={() => setStep("choice")}
            isPending={isPending}
          />
        )}

        {step === "hof-done" && finalSummary && (
          <FinalSummary
            summary={finalSummary}
            onDone={onRetired}
          />
        )}

        {step === "hof-done" && !finalSummary && (
          <FinalSummary
            summary={{
              managerName: "Manager",
              clubName: "—",
              season: "—",
              worldRanking: null,
              worldTitles: 0,
              olympicMedals: 0,
              achievementsCompleted: 0,
              totalAchievements: 25,
              totalWins: 0,
              totalLosses: 0,
              managerReputation: 50,
            }}
            onDone={onRetired}
          />
        )}

      </div>
    </div>
  );
}
