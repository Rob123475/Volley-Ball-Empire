import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCalendar, useRoundNames, type CalendarSpeed, SPEED_MS } from "@/hooks/use-calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SeasonReviewDialog } from "@/components/season-review-dialog";
import {
  Pause,
  Clock,
  Zap,
  Gauge,
  ChevronRight,
  ChevronsRight,
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
  const { calendar, isLoading, isAdvancing, isSettingSpeed, advance, setSpeed, advanceMutation,
    isRunningToMatch, runToNextMatch, nextMatchMutation } = useCalendar();
  const roundName = useRoundNames();
  const tickingRef = useRef(false);
  // A season boundary is an event, not a place: it has to interrupt. Opening
  // the review also pauses the clock, otherwise the ticker keeps advancing days
  // behind the dialog and the player reads a review of a season they have
  // already left.
  const [reviewYear, setReviewYear] = useState<number | null>(null);
  // A failing advance never changes the date, so the ticker would otherwise
  // retry forever — at Fast speed that is five failing requests a second, in
  // silence. Give up after a few consecutive failures and pause the clock.
  const failuresRef = useRef(0);

  // Open the season review whenever an advance crossed a season boundary —
  // from the ticker OR from the manual Advance Day button, which goes through
  // useCalendar's own mutate() and has no callback of its own. Keyed on the
  // mutation's last result so both paths land here and neither can miss it.
  const lastReviewYear = advanceMutation.data?.reviewYear ?? null;
  useEffect(() => {
    if (lastReviewYear != null) setReviewYear(lastReviewYear);
  }, [lastReviewYear]);
  // F-1: Next match stops at a season boundary too, and says so the same way.
  const nextMatchReviewYear = nextMatchMutation.data?.reviewYear ?? null;
  useEffect(() => {
    if (nextMatchReviewYear != null) setReviewYear(nextMatchReviewYear);
  }, [nextMatchReviewYear]);

  // R-53: the board's season review can sack the manager at the boundary. The
  // career is over and there is no next season to show: go to the end screen,
  // which reads the review from the dismissal entry.
  const queryClient = useQueryClient();
  const sackedAtReview = advanceMutation.data?.fired === true || nextMatchMutation.data?.fired === true;
  useEffect(() => {
    if (!sackedAtReview) return;
    queryClient.clear();
    window.location.href = "/career-end";
  }, [sackedAtReview, queryClient]);

  // Auto-advance ticker — lives here (and only here) so only one interval ever runs
  useEffect(() => {
    if (!calendar) return;
    if (calendar.calendarSpeed === "pause") return;
    if (calendar.pendingMatchId) return;

    const ms = SPEED_MS[calendar.calendarSpeed];
    if (!ms) return;

    const MAX_CONSECUTIVE_FAILURES = 3;

    const timer = setInterval(() => {
      if (tickingRef.current) return;
      if (advanceMutation.isPending) return;
      // F-1: Next match is running the days; the ticker must not add one.
      if (nextMatchMutation.isPending) return;
      tickingRef.current = true;
      advanceMutation.mutate(undefined, {
        onSuccess: (result) => {
          failuresRef.current = 0;
          // useCalendar pauses the clock and tells the player; just stop the
          // ticker so it does not keep polling a finished season.
          if (result?.blocked === "season_end") clearInterval(timer);
          // The effect below opens the review; the ticker only has to stop.
          if (result?.reviewYear != null) { clearInterval(timer); setSpeed("pause"); }
        },
        onError:   () => {
          failuresRef.current += 1;
          if (failuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
            clearInterval(timer);
            failuresRef.current = 0;
            setSpeed("pause");
          }
        },
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
  // R-68: the clock is running when a speed is set and no match is waiting.
  // Between two simulated days the date sits still for the ticker's whole
  // interval (3 s at Slow), which read as frozen; the date now re-animates on
  // every new day and a bar fills across that interval.
  const isRunning = speed !== "pause" && !calendar.pendingMatchId;
  const tickMs    = SPEED_MS[speed];

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
    // N-42: wraps onto a second line at narrower windows; it scrolled sideways and
    // the Fit / Tired figures at its end were cut off.
    <div className="flex flex-wrap items-center gap-x-0 gap-y-1 min-w-0" data-testid="calendar-panel">

      {/* ── Date ── R-68: keyed on the date, so each simulated day replays the
          tick animation; the bar under it restarts with the day and fills over
          the ticker interval. */}
      <div className="relative flex flex-col shrink-0 px-2 pb-1" data-testid="calendar-date-block">
        <span className="text-[9px] font-black uppercase tracking-widest text-sidebar-foreground/40 leading-none">
          Date
        </span>
        <span
          key={calendar.currentDate}
          data-testid="calendar-date"
          className={cn("text-sm font-bold tabular-nums leading-tight mt-0.5", isRunning && "vbe-date-tick")}
        >
          {dateLabel.short}, {year}
        </span>
        {isRunning && tickMs != null && (
          <span
            key={`tick-${calendar.currentDate}`}
            data-testid="calendar-tick-bar"
            aria-hidden="true"
            className="vbe-tick-bar absolute left-2 right-2 bottom-0 h-0.5 rounded-full bg-emerald-400/80"
            style={{ animationDuration: `${tickMs}ms` }}
          />
        )}
      </div>

      <VDiv />

      {/* ── Season / Round ── */}
      <div className="flex flex-col shrink-0 px-2">
        <span className="text-[9px] font-black uppercase tracking-widest text-sidebar-foreground/40 leading-none">
          Season
        </span>
        <span className="text-xs font-bold leading-tight mt-0.5" data-testid="calendar-season-phase">
          {calendar.seasonYear} · {calendar.seasonPhase.label}
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
            {roundName(calendar.nextMatch.round, "short")} · {calendar.nextMatch.awayTeamName ?? "Opponent"}
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

        {/* R-68: a pulsing dot while the clock runs, so Play is obviously on. */}
        {isRunning && (
          <span
            data-testid="calendar-running-dot"
            aria-label="Clock running"
            className={cn("vbe-running-dot ml-1.5 h-1.5 w-1.5 rounded-full shrink-0", speed === "fast" ? "bg-emerald-400" : speed === "medium" ? "bg-amber-400" : "bg-blue-400")}
          />
        )}
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
        disabled={isAdvancing || isRunningToMatch || !!calendar.pendingMatchId}
      >
        {isAdvancing ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <span className="hidden sm:inline">Advance</span>
      </Button>

      {/* ── Next match ── F-1: the clock, run to the day of the next match. */}
      {(() => {
        const nextMatchBlockedReason = isRunningToMatch ? null : calendar.nextMatchBlockedReason;
        const disabled = isRunningToMatch || isAdvancing || nextMatchBlockedReason != null;
        const hint = nextMatchBlockedReason
          ?? "Run the calendar day by day to your next match";
        return (
          <Button
            size="sm"
            variant="outline"
            data-testid="button-next-match"
            className="h-7 px-2.5 text-[11px] font-semibold gap-1 border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent shrink-0 ml-1"
            onClick={runToNextMatch}
            disabled={disabled}
            title={hint}
            aria-label={nextMatchBlockedReason ? `Next match: ${nextMatchBlockedReason}` : "Next match"}
          >
            {isRunningToMatch ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ChevronsRight className="h-3 w-3" />
            )}
            <span className="hidden sm:inline">Next match</span>
            {nextMatchBlockedReason && (
              <span className="hidden md:inline text-[10px] font-normal text-sidebar-foreground/50">· {nextMatchBlockedReason}</span>
            )}
          </Button>
        );
      })()}

      {totalActive > 0 && (
        <>
          <VDiv />

          {/* ── Fitness / Fatigue ── */}
          <div className="flex items-center gap-3 shrink-0 px-2" data-testid="calendar-fitness">
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

      <SeasonReviewDialog year={reviewYear} onClose={() => setReviewYear(null)} />
    </div>
  );
}
