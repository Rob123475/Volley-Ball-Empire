import { useState } from "react";
import {
  useGetCareerSummary,
  getGetCareerSummaryQueryKey,
  useEndCareer,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  XCircle,
  Trophy,
  Award,
  Star,
  Globe,
  CheckCircle2,
} from "lucide-react";

const END_PHRASE = "END CAREER";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function EndCareerModal({ onClose, onSuccess }: Props) {
  const [typed, setTyped] = useState("");
  const queryClient = useQueryClient();

  const { data: summary, isLoading } = useGetCareerSummary({
    query: { queryKey: getGetCareerSummaryQueryKey() },
  });

  const endMutation = useEndCareer();
  const confirmed = typed.trim() === END_PHRASE;

  const handleConfirm = () => {
    endMutation.mutate(undefined, {
      onSuccess: () => {
        onSuccess(); // navigate / close first
        void queryClient.invalidateQueries(); // then invalidate so AuthGuard transitions cleanly
      },
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-orange-500/20 bg-slate-900 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center shrink-0">
              <XCircle className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">End Career?</h2>
              <p className="text-[11px] text-white/40 mt-0.5">This cannot be undone · Career saved to Hall of Fame</p>
            </div>
          </div>
        </div>

        {/* Stats content */}
        {isLoading ? (
          <div className="px-6 pb-4 space-y-2">
            <div className="h-14 rounded-xl bg-white/5 animate-pulse" />
            <div className="grid grid-cols-2 gap-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)}
            </div>
            <div className="h-12 rounded-xl bg-white/5 animate-pulse" />
          </div>
        ) : summary ? (
          <div className="px-6 pb-4 space-y-2.5">

            {/* Identity */}
            <div className="rounded-xl border border-white/8 bg-white/4 px-4 py-3">
              <div className="text-sm font-black text-white">{summary.managerName}</div>
              <div className="text-xs text-white/45 mt-0.5">{summary.clubName} · {summary.season}</div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2.5">
                <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-white/35 mb-1">
                  <Globe className="h-2.5 w-2.5" /> World Ranking
                </div>
                <div className="text-2xl font-black text-white leading-none">
                  {summary.worldRanking != null ? `#${summary.worldRanking}` : "—"}
                </div>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2.5">
                <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-white/35 mb-1">
                  <Star className="h-2.5 w-2.5" /> Win / Loss
                </div>
                <div className="text-2xl font-black text-white leading-none">
                  {summary.totalWins}<span className="text-white/30 text-base mx-1">—</span>{summary.totalLosses}
                </div>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2.5">
                <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-amber-400/70 mb-1">
                  <Trophy className="h-2.5 w-2.5" /> World Titles
                </div>
                <div className="text-2xl font-black text-amber-300 leading-none">{summary.worldTitles}</div>
              </div>
              <div className="rounded-xl border border-sky-500/20 bg-sky-500/8 px-3 py-2.5">
                <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-sky-400/70 mb-1">
                  <Award className="h-2.5 w-2.5" /> Olympic Medals
                </div>
                <div className="text-2xl font-black text-sky-300 leading-none">{summary.olympicMedals}</div>
              </div>
            </div>

            {/* Achievements bar */}
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/8 px-4 py-3 flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-violet-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-violet-400/70">Achievements</span>
                  <span className="text-xs font-black text-violet-300">
                    {summary.achievementsCompleted}{summary.totalAchievements != null ? ` / ${summary.totalAchievements}` : ""}
                  </span>
                </div>
                {summary.totalAchievements != null && (
                  <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-violet-400 transition-all"
                      style={{ width: `${Math.round((summary.achievementsCompleted / summary.totalAchievements) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Confirmation input */}
        <div className="px-6 pb-2 space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">
            Type <span className="text-orange-400 font-black">{END_PHRASE}</span> to confirm
          </label>
          <input
            autoFocus
            value={typed}
            onChange={e => setTyped(e.target.value)}
            onKeyDown={e => e.key === "Enter" && confirmed && !endMutation.isPending && handleConfirm()}
            placeholder={END_PHRASE}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30 transition-all font-mono tracking-wider"
          />
        </div>

        {/* Actions */}
        <div className="p-6 pt-4 flex gap-3">
          <button
            onClick={onClose}
            disabled={endMutation.isPending}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-bold text-white/60 hover:bg-white/10 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!confirmed || endMutation.isPending}
            className="flex-1 rounded-xl bg-orange-600 hover:bg-orange-500 py-2.5 text-sm font-black text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {endMutation.isPending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Retiring…</>
              : <><XCircle className="h-4 w-4" /> End Career</>}
          </button>
        </div>
      </div>
    </div>
  );
}
