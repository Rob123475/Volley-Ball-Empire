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
  Heart,
  AlertTriangle,
  Trophy,
  Loader2,
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

function FatigueBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.round((value / max) * 100);
  const color =
    pct > 70 ? "bg-red-500" :
    pct > 40 ? "bg-amber-500" :
    "bg-emerald-500";
  return (
    <div className="h-1 w-full rounded-full bg-sidebar-border overflow-hidden">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
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
      <div className="px-3 py-2 border-t border-sidebar-border">
        <div className="flex items-center gap-2 text-sidebar-foreground/30 text-xs">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Loading calendar…</span>
        </div>
      </div>
    );
  }

  const dateLabel = formatGameDate(calendar.currentDate);
  const speed     = calendar.calendarSpeed;

  const speedLabel: Record<CalendarSpeed, string> = {
    pause:  "PAUSED",
    slow:   "SLOW",
    medium: "MEDIUM",
    fast:   "FAST",
  };

  const speedColor: Record<CalendarSpeed, string> = {
    pause:  "text-sidebar-foreground/40",
    slow:   "text-blue-400",
    medium: "text-amber-400",
    fast:   "text-emerald-400",
  };

  const { avgFitness, avgFatigue, injuredCount, totalActive } = calendar.teamFitness;

  return (
    <div className="px-3 pb-2 pt-2 border-t border-sidebar-border shrink-0 space-y-2">

      {/* Date + speed state */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-sidebar-foreground/40 leading-none">
            In-Game Date
          </p>
          <p className="text-sm font-bold leading-tight mt-0.5 tabular-nums">{dateLabel.short}, {new Date(calendar.currentDate + "T00:00:00Z").getUTCFullYear()}</p>
        </div>
        <span className={cn("text-[9px] font-black uppercase tracking-widest leading-none", speedColor[speed])}>
          {speedLabel[speed]}
        </span>
      </div>

      {/* Season progress */}
      <div className="text-[10px] text-sidebar-foreground/45 font-medium">
        Season {calendar.seasonYear} · Round {calendar.seasonRound}/{calendar.seasonTotalRounds}
      </div>

      {/* Next match */}
      {calendar.nextMatch ? (
        <div className="rounded-md bg-sidebar-accent/30 px-2 py-1.5 space-y-0.5">
          <p className="text-[9px] font-black uppercase tracking-widest text-sidebar-foreground/40 leading-none flex items-center gap-1">
            <Trophy className="h-2.5 w-2.5" />
            Next Match
          </p>
          <p className="text-[11px] font-semibold leading-tight truncate">
            R{calendar.nextMatch.round} · {calendar.nextMatch.homeTeamId === undefined
              ? "vs Opponent"
              : calendar.nextMatch.awayTeamName ?? "Opponent"}
          </p>
          {calendar.daysToNextMatch !== null && (
            <p className="text-[10px] text-sidebar-foreground/50">
              {calendar.daysToNextMatch === 0
                ? "Today!"
                : calendar.daysToNextMatch === 1
                ? "Tomorrow"
                : `In ${calendar.daysToNextMatch} days`}
              {calendar.nextMatchDate && ` · ${formatGameDate(calendar.nextMatchDate).short}`}
            </p>
          )}
        </div>
      ) : (
        <div className="text-[10px] text-sidebar-foreground/30 italic px-1">No upcoming matches</div>
      )}

      {/* Match day alert */}
      {calendar.pendingMatchId && (
        <div className="rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-1.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 leading-none flex items-center gap-1">
            <AlertTriangle className="h-2.5 w-2.5" />
            Match Day!
          </p>
          <p className="text-[10px] text-amber-300/70 mt-0.5">Waiting for your decision…</p>
        </div>
      )}

      {/* Team fitness summary */}
      {totalActive > 0 && (
        <div className="space-y-1">
          <p className="text-[9px] font-black uppercase tracking-widest text-sidebar-foreground/40 leading-none flex items-center gap-1">
            <Heart className="h-2.5 w-2.5" />
            Squad Condition
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-sidebar-foreground/60 w-8 shrink-0">Fit</span>
            <FatigueBar value={avgFitness} />
            <span className="text-[10px] tabular-nums text-sidebar-foreground/50 w-7 text-right shrink-0">{avgFitness}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-sidebar-foreground/60 w-8 shrink-0">Tired</span>
            <FatigueBar value={avgFatigue} />
            <span className="text-[10px] tabular-nums text-sidebar-foreground/50 w-7 text-right shrink-0">{avgFatigue}%</span>
          </div>
          {injuredCount > 0 && (
            <p className="text-[10px] text-red-400 font-medium">
              {injuredCount} player{injuredCount !== 1 ? "s" : ""} injured
            </p>
          )}
        </div>
      )}

      {/* Speed controls */}
      <div className="space-y-1">
        <div className="grid grid-cols-4 gap-0.5">
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
                  "flex flex-col items-center gap-0.5 py-1.5 px-1 rounded text-[9px] font-bold uppercase tracking-wide transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Manual advance */}
        <Button
          size="sm"
          variant="outline"
          className="w-full h-7 text-[11px] font-semibold gap-1.5 border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={advance}
          disabled={isAdvancing || !!calendar.pendingMatchId}
        >
          {isAdvancing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          Advance Day
        </Button>
      </div>
    </div>
  );
}
