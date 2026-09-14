/**
 * The board, as the manager sees it (R-53, docs/r53-design.md).
 *
 * One card for the dashboard and the contract page: what the board expects
 * this season, its verdict so far, and its last season review — all in plain
 * words from GET /board-confidence. This replaced R-09's confidence meter,
 * finance/form chips and escalation ladder (with its "forced sale" step that
 * never sold anyone).
 */
import type { BoardConfidence } from "@workspace/api-client-react";
import { ShieldCheck, AlertTriangle, Wallet, Flame, Users, Target, Gavel, History } from "lucide-react";

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ");
}

const STAGE: Record<BoardConfidence["stage"], { label: string; icon: typeof ShieldCheck; colour: string; pill: string }> = {
  safe:            { label: "In good standing", icon: ShieldCheck,   colour: "text-emerald-400", pill: "bg-emerald-500/15 border-emerald-500/25 text-emerald-400" },
  warning:         { label: "Board is concerned", icon: AlertTriangle, colour: "text-amber-400", pill: "bg-amber-500/15 border-amber-500/25 text-amber-400" },
  spending_freeze: { label: "Spending frozen", icon: Wallet,          colour: "text-orange-400", pill: "bg-orange-500/15 border-orange-500/25 text-orange-400" },
  final_warning:   { label: "Final warning", icon: Flame,             colour: "text-rose-400", pill: "bg-rose-500/15 border-rose-500/25 text-rose-400" },
};

export function BoardStatusCard({ board }: { board: BoardConfidence }) {
  const stage = STAGE[board.stage] ?? STAGE.safe;
  const StageIcon = stage.icon;
  const barColour =
    board.confidence >= 70 ? "bg-emerald-500" :
    board.confidence >= 50 ? "bg-blue-500" :
    board.confidence >= 35 ? "bg-amber-500" :
    board.confidence > 20 ? "bg-orange-500" : "bg-rose-500";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/3 p-5 space-y-4" data-testid="board-status">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-white/40" />
          <span className="text-sm font-semibold text-white/80">The Board</span>
          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest", stage.pill)}>
            <StageIcon className="h-3 w-3" />
            {stage.label}
          </span>
        </div>
        <span className="text-lg font-black text-white tabular-nums">{board.confidence}%</span>
      </div>
      <div className="h-2 w-full bg-white/8 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", barColour)} style={{ width: `${board.confidence}%` }} />
      </div>

      <div className="space-y-3">
        <div className="flex gap-3">
          <Target className="h-4 w-4 shrink-0 text-blue-400 mt-0.5" />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/35 font-semibold">What the board expects</p>
            <p className="text-sm text-white/80 leading-snug" data-testid="board-expectation">{board.expectation}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Gavel className={cn("h-4 w-4 shrink-0 mt-0.5", stage.colour)} />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/35 font-semibold">The board's verdict so far</p>
            <p className="text-sm text-white/80 leading-snug" data-testid="board-verdict">{board.verdict}</p>
          </div>
        </div>
        {board.lastReview && board.lastReview.seasonYear !== board.seasonYear && (
          <div className="flex gap-3">
            <History className="h-4 w-4 shrink-0 text-white/40 mt-0.5" />
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/35 font-semibold">Last season review</p>
              <p className="text-sm text-white/60 leading-snug">{board.lastReview.text}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** How the board judges a manager, in plain words (the contract page). */
export function BoardRulesExplainer() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/3 p-5 space-y-2 text-xs text-white/50 leading-relaxed">
      <p className="text-[9px] uppercase tracking-widest text-white/35 font-semibold">How the board judges you</p>
      <p>When the World Tour field is drawn, the board sets a target finish from how your best pair ranks against the field. Established clubs get 1 place of slack, underdogs 3, and money you could have spent on a better squad raises the bar.</p>
      <p>Results never cost you your job mid-season. A month into the World Tour, and every month after, the board checks the standings: a poor projection brings a warning or freezes new signings, hires and upgrades.</p>
      <p>At the end of each season it reviews your finish against the target, plus any World Finals honours; debt or a collapsing balance counts against you. A season spent forfeiting counts as failed badly. Confidence of 20 or less, or two failed seasons in a row, ends your time at the club.</p>
      <p>The one exception: if you cannot put two contracted players on the sand for 30 days, you are sacked at your next forfeit. Season 5's review is the verdict on your career.</p>
    </div>
  );
}
