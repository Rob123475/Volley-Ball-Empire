import { useEffect, useRef } from "react";
import { useCalendar, type CalendarSpeed, SPEED_MS } from "@/hooks/use-calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Pause,
  Clock,
  Zap,
  Gauge,
  ChevronRight,
  AlertTriangle,
  Trophy,
  Loader2,
  Heart,
} from "lucide-react";

const SPEED_OPTIONS: { id: CalendarSpeed; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "pause",  label: "Pause",  icon: Pause  },
  { id: "slow",   label: "Slow",   icon: Clock  },
  { id: "medium", label: "Med",    icon: Gauge  },
  { id: "fast",   label: "Fast",   icon: Zap    },
];

function formatGameDate(dateStr: string): { short: string; full: string } {
  const d = new Date(dateStr + "T00:00:00Z");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return {
    short: `${months[d.getUTCMonth()]} ${d.getUTCDate()}`,
    full:  `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`,
  };
}

function VDiv() {
  return <div className="w-px h-7 bg-sidebar-border shrink-0 mx-1" />;
}

export function CalendarPanel() {
  const { calendar, isLoading, isAdvancing, isSettingSpeed, advance, setSpeed, advanceMutation } = useCalendar();
  const tickingRef = useRef(false);

  // Auto-advance ticker — lives here (and only here) so only one interval ever runs
  useEffect(() => {
    if (!calendar) return;
    if (calendar.calendarSpeed === "pause") return;
    if (calendar.pendingMatchId) return;

    const ms = SPEED_MS[calendar.calendarSpeed];
    if (!ms) return;

    const timer = setInterval(() => {
      if (tickingRef.current) return;
      if (advanceMutation.isPending) return;
      tickingRef.current = true;
      advanceMutation.mutate(undefined, {
        onSettled: () => { tickingRef.current = false; },
      });
    }, ms);

    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendar?.calendarSpeed, calendar?.pendingMatchId, calendar?.currentDate]);

  if (isLoading || !calendar) {
    return (
      <div className="flex items-center gap-2 text-sidebar-foreground/30 text-xs shrink-0">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Loading…</span>
      </div>
    );
  }

  const dateLabel = formatGameDate(calendar.currentDate);
  const year      = new Date(calendar.currentDate + "T00:00:00Z").getUTCFullYear();
  const speed     = calendar.calendarSpeed;

  const speedColor: Record<CalendarSpeed, string> = {
    pause:  "text-sidebar-foreground/40",
    slow:   "text-blue-400",
    medium: "text-amber-400",
    fast:   "text-emerald-400",
  };

  const speedLabel: Record<CalendarSpeed, string> = {
    pause: "PAUSED", slow: "SLOW", medium: "MED", fast: "FAST",
  };

  const { avgFitness, avgFatigue, injuredCount, totalActive } = calendar.teamFitness;

  return (
    <div className="flex items-center gap-0 min-w-0 overflow-x-auto">

      {/* ── Date ── */}
      <div className="flex flex-col shrink-0 px-2">
        <span className="text-[9px] font-black uppercase tracking-widest text-sidebar-foreground/40 leading-none">
          Date
        </span>
        <span className="text-sm font-bold tabular-nums leading-tight mt-0.5">
          {dateLabel.short}, {year}
        </span>
      </div>

      <VDiv />

      {/* ── Season / Round ── */}
      <div className="flex flex-col shrink-0 px-2">
        <span className="text-[9px] font-black uppercase tracking-widest text-sidebar-foreground/40 leading-none">
          Season
        </span>
        <span className="text-xs font-bold leading-tight mt-0.5">
          {calendar.seasonYear} · R{calendar.seasonRound}/{calendar.seasonTotalRounds}
        </span>
      </div>

      <VDiv />

      {/* ── Match status ── */}
      {calendar.pendingMatchId ? (
        <div className="flex items-center gap-1 shrink-0 px-2 rounded bg-amber-500/15 border border-amber-500/30 h-7">
          <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-wide text-amber-400">Match Day!</span>
        </div>
      ) : calendar.nextMatch ? (
        <div className="flex items-center gap-1.5 shrink-0 px-2 rounded bg-sidebar-accent/30 h-7">
          <Trophy className="h-3 w-3 text-sidebar-foreground/50 shrink-0" />
          <span className="text-[11px] font-semibold leading-none max-w-[120px] truncate">
            R{calendar.nextMatch.round} · {calendar.nextMatch.awayTeamName ?? "Opponent"}
          </span>
          {calendar.daysToNextMatch !== null && (
            <span className="text-[10px] text-sidebar-foreground/45 shrink-0">
              {calendar.daysToNextMatch === 0 ? "Today" : calendar.daysToNextMatch === 1 ? "Tomorrow" : `in ${calendar.daysToNextMatch}d`}
            </span>
          )}
        </div>
      ) : null}

      <VDiv />

      {/* ── Speed controls ── */}
      <div className="flex items-center gap-0.5 shrink-0 px-1">
        {SPEED_OPTIONS.map(opt => {
          const Icon = opt.icon;
          const isActive = speed === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setSpeed(opt.id)}
              disabled={isSettingSpeed}
              title={opt.label}
              className={cn(
                "flex items-center justify-center w-7 h-7 rounded text-[9px] font-bold uppercase transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          );
        })}

        <span className={cn("text-[9px] font-black uppercase tracking-wide ml-1 shrink-0", speedColor[speed])}>
          {speedLabel[speed]}
        </span>
      </div>

      {/* ── Advance Day ── */}
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2.5 text-[11px] font-semibold gap-1 border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent shrink-0 ml-1"
        onClick={advance}
        disabled={isAdvancing || !!calendar.pendingMatchId}
      >
        {isAdvancing ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <span className="hidden sm:inline">Advance</span>
      </Button>

      {totalActive > 0 && (
        <>
          <VDiv />

          {/* ── Fitness / Fatigue ── */}
          <div className="flex items-center gap-3 shrink-0 px-2">
            <div className="flex items-center gap-1.5">
              <Heart className="h-3 w-3 text-emerald-400 shrink-0" />
              <span className="text-[11px] font-bold tabular-nums text-sidebar-foreground/75">
                {avgFitness}%
              </span>
              <span className="text-[9px] uppercase tracking-wide text-sidebar-foreground/35 font-black">Fit</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold tabular-nums text-sidebar-foreground/75">
                {avgFatigue}%
              </span>
              <span className="text-[9px] uppercase tracking-wide text-sidebar-foreground/35 font-black">Tired</span>
            </div>
            {injuredCount > 0 && (
              <span className="text-[10px] text-red-400 font-bold tabular-nums">
                {injuredCount}⚕
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
