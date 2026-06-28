import {
  useGetCareerHistory,
  getGetCareerHistoryQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { LucideProps } from "lucide-react";
import {
  CalendarDays,
  Building2,
  LogOut,
  Scissors,
  ShieldX,
  Trophy,
  Star,
  Medal,
  Handshake,
  Sunset,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ");
}

type EntryType = "resignation" | "contract_break" | "appointment" | "dismissal" | string;

interface EntryConfig {
  Icon:         React.FC<LucideProps>;
  dotRing:      string;
  dotBg:        string;
  iconColour:   string;
  cardBorder:   string;
  badgeBg:      string;
  badgeText:    string;
  label:        string;
}

function entryConfig(type: EntryType): EntryConfig {
  switch (type) {
    case "appointment":
      return {
        Icon:        Building2,
        dotRing:     "ring-emerald-500/40",
        dotBg:       "bg-emerald-500/20",
        iconColour:  "text-emerald-400",
        cardBorder:  "border-emerald-500/20",
        badgeBg:     "bg-emerald-500/15",
        badgeText:   "text-emerald-300",
        label:       "Appointed",
      };
    case "resignation":
      return {
        Icon:        LogOut,
        dotRing:     "ring-amber-500/40",
        dotBg:       "bg-amber-500/20",
        iconColour:  "text-amber-400",
        cardBorder:  "border-amber-500/20",
        badgeBg:     "bg-amber-500/15",
        badgeText:   "text-amber-300",
        label:       "Resigned",
      };
    case "contract_break":
      return {
        Icon:        Scissors,
        dotRing:     "ring-rose-500/40",
        dotBg:       "bg-rose-500/20",
        iconColour:  "text-rose-400",
        cardBorder:  "border-rose-500/20",
        badgeBg:     "bg-rose-500/15",
        badgeText:   "text-rose-300",
        label:       "Contract Broken",
      };
    case "dismissal":
      return {
        Icon:        ShieldX,
        dotRing:     "ring-red-500/40",
        dotBg:       "bg-red-500/20",
        iconColour:  "text-red-400",
        cardBorder:  "border-red-500/20",
        badgeBg:     "bg-red-500/15",
        badgeText:   "text-red-300",
        label:       "Dismissed",
      };
    case "trophy":
    case "championship":
      return {
        Icon:        Trophy,
        dotRing:     "ring-yellow-500/40",
        dotBg:       "bg-yellow-500/20",
        iconColour:  "text-yellow-400",
        cardBorder:  "border-yellow-500/20",
        badgeBg:     "bg-yellow-500/15",
        badgeText:   "text-yellow-300",
        label:       "Championship",
      };
    case "milestone":
      return {
        Icon:        Star,
        dotRing:     "ring-violet-500/40",
        dotBg:       "bg-violet-500/20",
        iconColour:  "text-violet-400",
        cardBorder:  "border-violet-500/20",
        badgeBg:     "bg-violet-500/15",
        badgeText:   "text-violet-300",
        label:       "Milestone",
      };
    case "medal":
      return {
        Icon:        Medal,
        dotRing:     "ring-sky-500/40",
        dotBg:       "bg-sky-500/20",
        iconColour:  "text-sky-400",
        cardBorder:  "border-sky-500/20",
        badgeBg:     "bg-sky-500/15",
        badgeText:   "text-sky-300",
        label:       "Olympic Medal",
      };
    case "poaching":
    case "offer":
      return {
        Icon:        Handshake,
        dotRing:     "ring-teal-500/40",
        dotBg:       "bg-teal-500/20",
        iconColour:  "text-teal-400",
        cardBorder:  "border-teal-500/20",
        badgeBg:     "bg-teal-500/15",
        badgeText:   "text-teal-300",
        label:       "Offer Accepted",
      };
    case "retirement":
      return {
        Icon:        Sunset,
        dotRing:     "ring-orange-500/40",
        dotBg:       "bg-orange-500/20",
        iconColour:  "text-orange-400",
        cardBorder:  "border-orange-500/20",
        badgeBg:     "bg-orange-500/15",
        badgeText:   "text-orange-300",
        label:       "Retired",
      };
    default:
      return {
        Icon:        CalendarDays,
        dotRing:     "ring-slate-500/40",
        dotBg:       "bg-slate-500/20",
        iconColour:  "text-slate-400",
        cardBorder:  "border-slate-500/20",
        badgeBg:     "bg-slate-500/15",
        badgeText:   "text-slate-300",
        label:       type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
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

function fmtYear(iso: string) {
  return new Date(iso).getFullYear().toString();
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className="relative pl-8 space-y-8">
      {/* Vertical line */}
      <div className="absolute left-[15px] top-0 bottom-0 w-px bg-white/8" />
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="relative flex gap-4">
          <Skeleton className="absolute -left-8 w-7 h-7 rounded-full shrink-0" />
          <div className="flex-1 space-y-2 pt-0.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-full max-w-xs" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/3 p-14 flex flex-col items-center justify-center text-center gap-4">
      <div className="h-16 w-16 rounded-2xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
        <CalendarDays className="h-8 w-8 text-blue-400" />
      </div>
      <div>
        <h2 className="text-base font-black text-white">No History Yet</h2>
        <p className="text-sm text-white/40 mt-1 max-w-xs leading-relaxed">
          Career events — appointments, resignations, dismissals — will appear here as they happen.
        </p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CareerHistory() {
  const { data: entries = [], isLoading } = useGetCareerHistory({
    query: { queryKey: getGetCareerHistoryQueryKey() },
  });

  // Group entries by year for year dividers
  let lastYear = "";

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">Career History</h1>
        <p className="text-sm text-white/40 mt-1">
          A chronological record of every club, role, and milestone in your managerial career.
        </p>
      </div>

      {/* Summary pill row */}
      {!isLoading && entries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(["appointment","resignation","dismissal","contract_break"] as EntryType[]).map(type => {
            const count = entries.filter(e => e.type === type).length;
            if (count === 0) return null;
            const cfg = entryConfig(type);
            const PillIcon = cfg.Icon;
            return (
              <div
                key={type}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold",
                  cfg.badgeBg, cfg.badgeText,
                  "border-white/10"
                )}
              >
                <PillIcon className="h-3 w-3" />
                {count} {cfg.label}
              </div>
            );
          })}
        </div>
      )}

      {/* Content */}
      {isLoading && <TimelineSkeleton />}

      {!isLoading && entries.length === 0 && <EmptyState />}

      {!isLoading && entries.length > 0 && (
        <div className="relative pl-9">

          {/* Vertical connector line */}
          <div className="absolute left-[15px] top-3 bottom-3 w-px bg-gradient-to-b from-white/5 via-white/10 to-transparent" />

          <div className="space-y-0">
            {entries.map((entry, idx) => {
              const cfg    = entryConfig(entry.type);
              const DotIcon = cfg.Icon;
              const year   = fmtYear(entry.occurredAt);
              const isLast = idx === entries.length - 1;
              const showYearDivider = year !== lastYear;
              lastYear = year;

              return (
                <div key={entry.id}>

                  {/* Year divider */}
                  {showYearDivider && (
                    <div className="relative flex items-center gap-3 mb-4 mt-2 first:mt-0">
                      <div
                        className="absolute -left-9 w-[30px] h-[1px] bg-white/15"
                        style={{ top: "50%" }}
                      />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/25 pl-0">
                        {year}
                      </span>
                    </div>
                  )}

                  {/* Timeline entry */}
                  <div className={cn("relative flex gap-4 pb-8", isLast && "pb-0")}>

                    {/* Dot on the line */}
                    <div className={cn(
                      "absolute -left-9 top-1 w-[30px] h-[30px] rounded-full ring-2 flex items-center justify-center shrink-0 z-10",
                      cfg.dotBg,
                      cfg.dotRing,
                    )}>
                      <DotIcon className={cn("h-3.5 w-3.5", cfg.iconColour)} />
                    </div>

                    {/* Card */}
                    <div className={cn(
                      "flex-1 rounded-2xl bg-white/3 border px-4 py-3.5 transition-colors hover:bg-white/5",
                      cfg.cardBorder,
                    )}>

                      {/* Top row: badge + date */}
                      <div className="flex items-center justify-between gap-3 mb-1.5 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-[0.18em] px-2 py-0.5 rounded-full border border-white/10",
                            cfg.badgeBg, cfg.badgeText,
                          )}>
                            {cfg.label}
                          </span>
                          <span className="text-[10px] font-bold text-white/50">
                            {entry.clubName}
                          </span>
                          {entry.season && (
                            <span className="text-[9px] text-white/25 font-semibold">
                              Season {entry.season}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-white/25 font-semibold tabular-nums shrink-0">
                          {fmtDate(entry.occurredAt)}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-[13px] text-white/70 leading-snug">
                        {entry.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
