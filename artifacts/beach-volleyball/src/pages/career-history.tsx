import {
  useGetCareerHistory,
  getGetCareerHistoryQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, Building2, LogOut, Scissors, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Type helpers ──────────────────────────────────────────────────────────────

type EntryType = "resignation" | "contract_break" | "appointment" | "dismissal";

function entryConfig(type: EntryType) {
  switch (type) {
    case "resignation":
      return {
        icon:       LogOut,
        iconBg:     "bg-amber-500/15 border-amber-500/20",
        iconColour: "text-amber-400",
        label:      "Resigned",
        labelColour: "text-amber-400",
      };
    case "contract_break":
      return {
        icon:       Scissors,
        iconBg:     "bg-rose-500/15 border-rose-500/20",
        iconColour: "text-rose-400",
        label:      "Contract Broken",
        labelColour: "text-rose-400",
      };
    case "appointment":
      return {
        icon:       Building2,
        iconBg:     "bg-emerald-500/15 border-emerald-500/20",
        iconColour: "text-emerald-400",
        label:      "Appointed",
        labelColour: "text-emerald-400",
      };
    case "dismissal":
      return {
        icon:       CalendarDays,
        iconBg:     "bg-slate-500/15 border-slate-500/20",
        iconColour: "text-slate-400",
        label:      "Dismissed",
        labelColour: "text-slate-400",
      };
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day:   "numeric",
    month: "short",
    year:  "numeric",
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CareerHistory() {
  const { data: entries, isLoading } = useGetCareerHistory({
    query: { queryKey: getGetCareerHistoryQueryKey() },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">Career History</h1>
        <p className="text-sm text-white/50 mt-1">A chronological record of every club and role you have held.</p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
        </div>
      )}

      {!isLoading && (!entries || entries.length === 0) && (
        <div className="rounded-2xl border border-white/10 bg-white/3 p-12 flex flex-col items-center justify-center text-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
            <CalendarDays className="h-8 w-8 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">No History Yet</h2>
            <p className="text-sm text-white/40 mt-1 max-w-sm">
              Career events — resignations, contract breaks, appointments — will appear here as they happen.
            </p>
          </div>
        </div>
      )}

      {!isLoading && entries && entries.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/3 divide-y divide-white/5 overflow-hidden">
          {entries.map((entry) => {
            const cfg = entryConfig(entry.type as EntryType);
            const Icon = cfg.icon;
            return (
              <div key={entry.id} className="flex items-start gap-4 p-5">
                <div className={cn(
                  "h-10 w-10 shrink-0 rounded-xl border flex items-center justify-center",
                  cfg.iconBg,
                )}>
                  <Icon className={cn("h-5 w-5", cfg.iconColour)} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={cn("text-[10px] font-black uppercase tracking-widest", cfg.labelColour)}>
                      {cfg.label}
                    </span>
                    <span className="text-[10px] text-white/30 font-semibold uppercase tracking-wide">
                      {entry.clubName}
                    </span>
                    {entry.season && (
                      <span className="text-[10px] text-white/20 font-semibold">
                        · {entry.season}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/70 leading-snug">{entry.description}</p>
                </div>

                <div className="flex items-center gap-1 text-[10px] text-white/30 shrink-0 mt-0.5">
                  <Clock className="h-3 w-3" />
                  {fmtDate(entry.occurredAt)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
