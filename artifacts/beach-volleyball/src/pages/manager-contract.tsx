import { useState } from "react";
import { useLocation } from "wouter";
import {
  useGetCareerSummary,
  getGetCareerSummaryQueryKey,
  useGetBoardConfidence,
  getGetBoardConfidenceQueryKey,
  useResignCareer,
  useBreakContract,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  FileText,
  DollarSign,
  CalendarDays,
  Building2,
  Clock,
  ShieldAlert,
  Users,
  Heart,
  Target,
  CheckCircle2,
  Handshake,
  Wallet,
  LogOut,
  Scissors,
  Info,
  AlertTriangle,
  AlertCircle,
  Flame,
  TrendingUp,
  Landmark,
  AlertOctagon,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type ModalKey = "negotiate" | "budget" | "resign" | "break" | null;

// ── Placeholder data (TODO: replace with contract API endpoint) ───────────────

const PLACEHOLDER_CONTRACT = {
  salary:         5_000,
  startSeason:    "Season 1",
  endSeason:      "Season 3",
  yearsRemaining: 2,
  releaseFee:     25_000,
  fanApproval:    68,
  status:         "Active" as const,
  objectives: [
    { id: 1, text: "Finish in the top 4 of the World Tour ranking",  done: false },
    { id: 2, text: "Develop at least two youth players to the squad", done: true  },
    { id: 3, text: "Reach the World Tour Grand Final",                done: false },
    { id: 4, text: "Maintain a positive team budget",                 done: true  },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtSalary(n: number) {
  return `$${n.toLocaleString()} / season`;
}

function fmtFee(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toLocaleString()}`;
}

// ── Warning banner ────────────────────────────────────────────────────────────

function WarningBanner({ score, warning }: { score: number; warning: string }) {
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

function BoardConfidenceBar({
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

// ── Fan approval bar ──────────────────────────────────────────────────────────

function ApprovalBar({ value }: { value: number }) {
  const barColour =
    value >= 70 ? "bg-emerald-500" :
    value >= 50 ? "bg-blue-500"    :
    value >= 30 ? "bg-amber-500"   : "bg-rose-500";

  const levelLabel =
    value >= 80 ? "Excellent" :
    value >= 60 ? "Good"      :
    value >= 40 ? "Fair"      : "Poor";

  const levelColour =
    value >= 60 ? "text-emerald-400" :
    value >= 40 ? "text-amber-400"   : "text-rose-400";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-white/40" />
          <span className="text-sm font-semibold text-white/80">Fan Approval</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-semibold", levelColour)}>{levelLabel}</span>
          <span className="text-lg font-black text-white tabular-nums">{value}%</span>
        </div>
      </div>
      <div className="h-3 w-full bg-white/8 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", barColour)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

// ── Contract detail row ───────────────────────────────────────────────────────

function ContractRow({
  icon: Icon, label, value, iconColour, isPlaceholder,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string;
  iconColour?: string; isPlaceholder?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 py-4 border-b border-white/5 last:border-0">
      <div className="h-9 w-9 shrink-0 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center">
        <Icon className={cn("h-4 w-4", iconColour ?? "text-white/50")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] uppercase tracking-widest text-white/35 font-semibold">{label}</p>
      </div>
      <span className={cn(
        "text-sm font-bold tabular-nums shrink-0",
        isPlaceholder ? "text-white/30 italic" : "text-white",
      )}>
        {value}
      </span>
    </div>
  );
}

// ── Action button ─────────────────────────────────────────────────────────────

function ActionButton({
  icon: Icon, label, sublabel, onClick, variant = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; sublabel: string; onClick: () => void;
  variant?: "default" | "destructive";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 px-5 py-4 rounded-xl border text-left transition-all",
        "hover:bg-white/5 active:scale-[0.99]",
        variant === "destructive"
          ? "border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10"
          : "border-white/8 bg-white/3",
      )}
    >
      <div className={cn(
        "h-9 w-9 shrink-0 rounded-xl flex items-center justify-center",
        variant === "destructive"
          ? "bg-rose-500/15 border border-rose-500/20"
          : "bg-white/8 border border-white/10",
      )}>
        <Icon className={cn("h-4 w-4", variant === "destructive" ? "text-rose-400" : "text-white/60")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-bold", variant === "destructive" ? "text-rose-300" : "text-white")}>
          {label}
        </p>
        <p className="text-xs text-white/40 mt-0.5">{sublabel}</p>
      </div>
      <span className="text-white/20 text-lg">›</span>
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ManagerContract() {
  const [, navigate] = useLocation();
  const queryClient  = useQueryClient();
  const [openModal, setOpenModal] = useState<ModalKey>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: summary, isLoading: summaryLoading } = useGetCareerSummary({
    query: { queryKey: getGetCareerSummaryQueryKey() },
  });
  const { data: confidence, isLoading: confLoading } = useGetBoardConfidence({
    query: { queryKey: getGetBoardConfidenceQueryKey() },
  });

  const resignMutation = useResignCareer({
    mutation: {
      onSuccess: () => {
        queryClient.clear();
        navigate("/career");
      },
      onError: () => setActionError("Something went wrong. Please try again."),
    },
  });

  const breakMutation = useBreakContract({
    mutation: {
      onSuccess: () => {
        queryClient.clear();
        navigate("/career");
      },
      onError: () => setActionError("Something went wrong. Please try again."),
    },
  });

  const isLoading = summaryLoading || confLoading;

  const clubName = summary?.clubName ?? "Your Club";
  const c = PLACEHOLDER_CONTRACT;

  const confScore     = confidence?.score              ?? 60;
  const confLabel     = confidence?.label              ?? "Good";
  const confWarning   = confidence?.warning            ?? null;
  const confAdj       = confidence?.financeAdjustment  ?? 0;
  const financeHealth = confidence?.breakdown?.financeHealth ?? "Stable";
  const recentForm    = confidence?.breakdown?.recentForm    ?? "—";

  function closeModal() {
    setOpenModal(null);
    setActionError(null);
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-7 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  const objectivesDone = c.objectives.filter(o => o.done).length;

  return (
    <>
      <div className="space-y-6">

        {/* ── Page heading ── */}
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Contract</h1>
          <p className="text-sm text-white/50 mt-1">Your current employment terms and board expectations.</p>
        </div>

        {/* ── Warning banner ── */}
        {confWarning && <WarningBanner score={confScore} warning={confWarning} />}

        {/* ── Status banner ── */}
        <div className="rounded-2xl border border-white/10 bg-white/3 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="h-14 w-14 shrink-0 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
            <FileText className="h-7 w-7 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl font-black text-white">Employment Contract</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {c.status}
              </span>
            </div>
            <p className="text-sm text-white/45 mt-0.5 font-medium">Club Manager · {clubName}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[9px] uppercase tracking-widest text-white/35 font-semibold">Expires</p>
            <p className="text-lg font-black text-white">{c.endSeason}</p>
            <p className="text-xs text-white/40">
              {c.yearsRemaining} season{c.yearsRemaining === 1 ? "" : "s"} remaining
            </p>
          </div>
        </div>

        {/* ── Contract terms ── */}
        <div className="rounded-2xl border border-white/10 bg-white/3 px-6">
          <div className="pt-5 pb-1">
            <p className="text-[9px] uppercase tracking-widest text-white/35 font-semibold">Contract Terms</p>
            <p className="text-[10px] text-white/25 italic mt-0.5">
              Salary and clause values are placeholders — contract system coming soon
            </p>
          </div>
          <ContractRow icon={Building2}    label="Current Club"      value={clubName}              iconColour="text-blue-400" />
          <ContractRow icon={DollarSign}   label="Annual Salary"     value={fmtSalary(c.salary)}   iconColour="text-emerald-400" isPlaceholder />
          <ContractRow icon={CalendarDays} label="Contract Started"  value={c.startSeason}         iconColour="text-slate-400" />
          <ContractRow icon={CalendarDays} label="Contract Expires"  value={c.endSeason}           iconColour="text-slate-400" />
          <ContractRow icon={Clock}        label="Seasons Remaining" value={`${c.yearsRemaining} season${c.yearsRemaining === 1 ? "" : "s"}`} iconColour="text-amber-400" />
          <ContractRow icon={ShieldAlert}  label="Release Clause"    value={fmtFee(c.releaseFee)}  iconColour="text-rose-400" isPlaceholder />
        </div>

        {/* ── Board & fan sentiment ── */}
        <div className="rounded-2xl border border-white/10 bg-white/3 p-6 space-y-6">
          <p className="text-[9px] uppercase tracking-widest text-white/35 font-semibold -mb-2">Sentiment</p>
          <BoardConfidenceBar
            score={confScore} label={confLabel}
            financeHealth={financeHealth} recentForm={recentForm}
            financeAdjustment={confAdj}
          />
          <ApprovalBar value={c.fanApproval} />
          <p className="text-[10px] text-white/25 italic -mt-3">Fan approval is a placeholder — full system coming soon</p>
        </div>

        {/* ── Season objectives ── */}
        <div className="rounded-2xl border border-white/10 bg-white/3 px-6">
          <div className="pt-5 pb-1 flex items-center justify-between">
            <p className="text-[9px] uppercase tracking-widest text-white/35 font-semibold">Season Objectives</p>
            <span className="text-[10px] font-bold text-white/40 tabular-nums">
              {objectivesDone} / {c.objectives.length} met
            </span>
          </div>
          {c.objectives.map((obj) => (
            <div key={obj.id} className="flex items-start gap-4 py-4 border-b border-white/5 last:border-0">
              <div className={cn(
                "mt-0.5 h-5 w-5 shrink-0 rounded-full flex items-center justify-center border",
                obj.done ? "bg-emerald-500/20 border-emerald-500/40" : "bg-white/5 border-white/12",
              )}>
                {obj.done
                  ? <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  : <Target className="h-3 w-3 text-white/30" />}
              </div>
              <p className={cn(
                "text-sm leading-snug flex-1",
                obj.done ? "text-white/55 line-through decoration-white/20" : "text-white/85",
              )}>
                {obj.text}
              </p>
              {obj.done && (
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide shrink-0 mt-0.5">Done</span>
              )}
            </div>
          ))}
        </div>

        {/* ── Actions ── */}
        <div className="space-y-3">
          <p className="text-[9px] uppercase tracking-widest text-white/35 font-semibold px-1">Actions</p>
          <ActionButton
            icon={Handshake} label="Negotiate Contract"
            sublabel="Propose improved salary or contract length to the board"
            onClick={() => setOpenModal("negotiate")}
          />
          <ActionButton
            icon={Wallet} label="Request More Budget"
            sublabel="Ask the board to increase your transfer and wage budget"
            onClick={() => setOpenModal("budget")}
          />
          <ActionButton
            icon={LogOut} label="Resign"
            sublabel="Leave your role voluntarily — no compensation paid"
            onClick={() => { setActionError(null); setOpenModal("resign"); }}
          />
          <ActionButton
            icon={Scissors} label="Break Contract"
            sublabel={`Exit early by paying the ${fmtFee(c.releaseFee)} release clause`}
            onClick={() => { setActionError(null); setOpenModal("break"); }}
            variant="destructive"
          />
        </div>

      </div>

      {/* ── Modals ── */}
      <Dialog open={openModal !== null} onOpenChange={(o) => { if (!o) closeModal(); }}>
        <DialogContent className="max-w-md border-white/10 bg-[#0f1117]">

          {/* ── Negotiate ── */}
          {openModal === "negotiate" && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-1">
                  <div className="h-10 w-10 shrink-0 rounded-xl border bg-emerald-500/15 border-emerald-500/20 flex items-center justify-center">
                    <Handshake className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-black text-white leading-tight">Negotiate Contract</DialogTitle>
                    <DialogDescription className="text-xs text-white/40 mt-0.5">Propose improved terms to the board.</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="rounded-xl border border-white/8 bg-white/3 p-4 flex items-start gap-3 mt-1">
                <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                <p className="text-sm text-white/60 leading-relaxed">
                  Contract negotiations will be fully interactive in a future update. Your board will evaluate your win rate, board confidence, and season objectives.
                </p>
              </div>
              <DialogFooter className="mt-2">
                <DialogClose asChild>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500">OK, understood</Button>
                </DialogClose>
              </DialogFooter>
            </>
          )}

          {/* ── Budget ── */}
          {openModal === "budget" && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-1">
                  <div className="h-10 w-10 shrink-0 rounded-xl border bg-blue-500/15 border-blue-500/20 flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-black text-white leading-tight">Request More Budget</DialogTitle>
                    <DialogDescription className="text-xs text-white/40 mt-0.5">Ask the board to increase your transfer and wage budget.</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="rounded-xl border border-white/8 bg-white/3 p-4 flex items-start gap-3 mt-1">
                <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                <p className="text-sm text-white/60 leading-relaxed">
                  Budget requests are coming in a future update. Approval will depend on your board confidence level and overall financial position.
                </p>
              </div>
              <DialogFooter className="mt-2">
                <DialogClose asChild>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white border border-blue-500">OK, understood</Button>
                </DialogClose>
              </DialogFooter>
            </>
          )}

          {/* ── Resign ── */}
          {openModal === "resign" && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-1">
                  <div className="h-10 w-10 shrink-0 rounded-xl border bg-amber-500/15 border-amber-500/20 flex items-center justify-center">
                    <LogOut className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-black text-white leading-tight">Resign from {clubName}</DialogTitle>
                    <DialogDescription className="text-xs text-white/40 mt-0.5">This action cannot be undone.</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-3 mt-1">
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-4">
                  <p className="text-sm text-amber-300/80 leading-relaxed">
                    Resigning ends your contract immediately at{" "}
                    <span className="font-black text-amber-200">{clubName}</span>.
                    You will become unemployed and receive no compensation.
                  </p>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-2 text-sm text-white/55">
                  <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-white/30 shrink-0" /> Career save is kept — your history is preserved</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-white/30 shrink-0" /> Club and players are not deleted</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-white/30 shrink-0" /> A history entry will be recorded</div>
                </div>
                {actionError && (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-400">
                    <AlertOctagon className="h-4 w-4 shrink-0" />
                    {actionError}
                  </div>
                )}
              </div>

              <DialogFooter className="mt-2 gap-2">
                <Button variant="ghost" size="sm" className="text-white/50" onClick={closeModal} disabled={resignMutation.isPending}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-500 text-white border border-amber-500 min-w-[120px]"
                  onClick={() => resignMutation.mutate()}
                  disabled={resignMutation.isPending}
                >
                  {resignMutation.isPending
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Resigning…</>
                    : "Confirm Resignation"}
                </Button>
              </DialogFooter>
            </>
          )}

          {/* ── Break Contract ── */}
          {openModal === "break" && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-1">
                  <div className="h-10 w-10 shrink-0 rounded-xl border bg-rose-500/15 border-rose-500/20 flex items-center justify-center">
                    <Scissors className="h-5 w-5 text-rose-400" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-black text-white leading-tight">Break Contract</DialogTitle>
                    <DialogDescription className="text-xs text-white/40 mt-0.5">This action cannot be undone.</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-3 mt-1">
                {/* Fee callout */}
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/8 p-4">
                  <p className="text-[9px] uppercase tracking-widest text-rose-400/60 font-semibold mb-2">Release Clause</p>
                  <p className="text-3xl font-black text-rose-300">{fmtFee(c.releaseFee)}</p>
                  <p className="text-xs text-rose-300/60 mt-1">
                    This amount will be deducted from{" "}
                    <span className="font-bold text-rose-300">{clubName}</span>'s budget immediately.
                    You will then become unemployed.
                  </p>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-2 text-sm text-white/55">
                  <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-white/30 shrink-0" /> Career save is kept — your history is preserved</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-white/30 shrink-0" /> Club and players are not deleted</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-white/30 shrink-0" /> A history entry will be recorded</div>
                </div>
                {actionError && (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-400">
                    <AlertOctagon className="h-4 w-4 shrink-0" />
                    {actionError}
                  </div>
                )}
              </div>

              <DialogFooter className="mt-2 gap-2">
                <Button variant="ghost" size="sm" className="text-white/50" onClick={closeModal} disabled={breakMutation.isPending}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-rose-600 hover:bg-rose-500 text-white border border-rose-500 min-w-[140px]"
                  onClick={() => breakMutation.mutate()}
                  disabled={breakMutation.isPending}
                >
                  {breakMutation.isPending
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Processing…</>
                    : `Pay ${fmtFee(c.releaseFee)} & Leave`}
                </Button>
              </DialogFooter>
            </>
          )}

        </DialogContent>
      </Dialog>
    </>
  );
}
