import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  useGetCareerSummary,
  getGetCareerSummaryQueryKey,
  useGetBoardConfidence,
  getGetBoardConfidenceQueryKey,
  useGetManagerContract,
  getGetManagerContractQueryKey,
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
  Building2,
  ShieldAlert,
  LogOut,
  Scissors,
  AlertOctagon,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WarningBanner, BoardConfidenceBar, ConfidenceLadder } from "@/components/career/board-confidence-widgets";

// ── Types ─────────────────────────────────────────────────────────────────────

// R-12: "negotiate" and "budget" removed — both actions opened a modal that
// was itself the whole stub, a bare "coming in a future update" notice with
// an OK button. Not built, deleted along with the buttons that opened them.
type ModalKey = "resign" | "break" | null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtSalary(n: number) {
  return `$${n.toLocaleString()} / season`;
}

function fmtFee(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toLocaleString()}`;
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
  const { data: contract, isLoading: contractLoading } = useGetManagerContract({
    query: { queryKey: getGetManagerContractQueryKey() },
  });

  // R-09: GET /board-confidence ends the career itself the instant it reads
  // as "sacked" (see routes/board-confidence.ts) — this is the client
  // noticing that already happened and routing to the dedicated end screen,
  // not the client deciding to end it.
  useEffect(() => {
    if (confidence?.careerEnded) {
      queryClient.clear();
      window.location.href = "/career-end";
    }
  }, [confidence?.careerEnded, queryClient]);

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

  const isLoading = summaryLoading || confLoading || contractLoading;

  const clubName = summary?.clubName ?? "Your Club";
  const salary     = contract?.salary     ?? 0;
  const releaseFee = contract?.releaseFee ?? 25_000;
  const status     = contract?.status     ?? "Active";

  const confScore     = confidence?.score              ?? 60;
  const confLabel     = confidence?.label              ?? "Good";
  const confWarning   = confidence?.warning            ?? null;
  const confAdj       = confidence?.financeAdjustment  ?? 0;
  const confStage     = confidence?.stage              ?? "safe";
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
                {status}
              </span>
            </div>
            <p className="text-sm text-white/45 mt-0.5 font-medium">Club Manager · {clubName}</p>
          </div>
        </div>

        {/* ── Contract terms ── */}
        <div className="rounded-2xl border border-white/10 bg-white/3 px-6">
          <div className="pt-5 pb-1">
            <p className="text-[9px] uppercase tracking-widest text-white/35 font-semibold">Contract Terms</p>
          </div>
          <ContractRow icon={Building2}   label="Current Club"   value={clubName}             iconColour="text-blue-400" />
          <ContractRow icon={DollarSign}  label="Annual Salary"  value={fmtSalary(salary)}     iconColour="text-emerald-400" />
          <ContractRow icon={ShieldAlert} label="Release Clause" value={fmtFee(releaseFee)}    iconColour="text-rose-400" />
        </div>

        {/* ── Board sentiment ── */}
        <div className="rounded-2xl border border-white/10 bg-white/3 p-6 space-y-6">
          <p className="text-[9px] uppercase tracking-widest text-white/35 font-semibold -mb-2">Sentiment</p>
          <BoardConfidenceBar
            score={confScore} label={confLabel}
            financeHealth={financeHealth} recentForm={recentForm}
            financeAdjustment={confAdj}
          />
        </div>

        {/* ── Escalation ladder ── */}
        <ConfidenceLadder stage={confStage} />

        {/* ── Actions ── */}
        <div className="space-y-3">
          <p className="text-[9px] uppercase tracking-widest text-white/35 font-semibold px-1">Actions</p>
          <ActionButton
            icon={LogOut} label="Resign"
            sublabel="Leave your role voluntarily — no compensation paid"
            onClick={() => { setActionError(null); setOpenModal("resign"); }}
          />
          <ActionButton
            icon={Scissors} label="Break Contract"
            sublabel={`Exit early by paying the ${fmtFee(releaseFee)} release clause`}
            onClick={() => { setActionError(null); setOpenModal("break"); }}
            variant="destructive"
          />
        </div>

      </div>

      {/* ── Modals ── */}
      <Dialog open={openModal !== null} onOpenChange={(o) => { if (!o) closeModal(); }}>
        <DialogContent className="max-w-md border-white/10 bg-[#0f1117]">

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
                  <p className="text-3xl font-black text-rose-300">{fmtFee(releaseFee)}</p>
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
                    : `Pay ${fmtFee(releaseFee)} & Leave`}
                </Button>
              </DialogFooter>
            </>
          )}

        </DialogContent>
      </Dialog>
    </>
  );
}
