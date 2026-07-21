import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import {
  useCalendar,
  useAnnualCalendar,
  type AnnualEvent,
  type AnnualEventType,
  type CalendarSpeed,
} from "@/hooks/use-calendar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays, Pause, Gauge } from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const EVENT_DOT: Record<AnnualEventType, string> = {
  regional:   "bg-blue-500",
  world_tour: "bg-amber-500",
  finals:     "bg-red-500",
  holiday:    "bg-slate-400",
  financial:  "bg-emerald-500",
  contract:   "bg-purple-500",
  facility:   "bg-cyan-500",
};

const LEGEND = [
  { type: "regional"   as AnnualEventType, label: "Regional / Pool",   dot: "bg-blue-500"    },
  { type: "world_tour" as AnnualEventType, label: "World Tour",        dot: "bg-amber-500"   },
  { type: "finals"     as AnnualEventType, label: "World Finals",      dot: "bg-red-500"     },
  { type: "holiday"    as AnnualEventType, label: "Off-Season",        dot: "bg-slate-400"   },
  { type: "financial"  as AnnualEventType, label: "Financial",         dot: "bg-emerald-500" },
  { type: "contract"   as AnnualEventType, label: "Contract Deadline", dot: "bg-purple-500"  },
  { type: "facility"   as AnnualEventType, label: "Facility / Club",   dot: "bg-cyan-500"    },
];

const SPEED_LABELS: Record<CalendarSpeed, string> = {
  pause:  "Paused",
  slow:   "Slow",
  medium: "Medium",
  fast:   "Fast",
};

// ── EventDropdown ─────────────────────────────────────────────────────────────

function EventDropdown({
  events,
  onClose,
  preferLeft,
}: {
  events: AnnualEvent[];
  onClose: () => void;
  preferLeft: boolean;
}) {
  const [, navigate] = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Events"
      onClick={e => e.stopPropagation()}
      className={cn(
        "absolute z-50 top-full mt-0.5 bg-popover border border-border rounded-lg shadow-lg p-1.5 space-y-0.5 min-w-[200px] max-w-[260px]",
        preferLeft ? "right-0" : "left-0",
      )}
    >
      {events.map((ev, i) => (
        <button
          key={i}
          className="w-full text-left flex items-start gap-2 px-2 py-1.5 rounded hover:bg-accent text-xs focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onClick={() => { navigate(ev.link); onClose(); }}
        >
          <div className={cn("w-2 h-2 rounded-full shrink-0 mt-0.5", EVENT_DOT[ev.type] ?? "bg-muted")} />
          <div className="min-w-0">
            <div className="font-medium leading-tight truncate">{ev.title}</div>
            {ev.subtitle && (
              <div className="text-muted-foreground leading-tight truncate">{ev.subtitle}</div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

// ── DayCell ───────────────────────────────────────────────────────────────────

function DayCell({
  day,
  dateStr,
  events,
  isToday,
  isPast,
  colIndex,
}: {
  day: number;
  dateStr: string;
  events: AnnualEvent[];
  isToday: boolean;
  isPast: boolean;
  colIndex: number;
}) {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();

  const handleClick = useCallback(() => {
    if (events.length === 0) return;
    if (events.length === 1) { navigate(events[0]!.link); return; }
    setOpen(o => !o);
  }, [events, navigate]);

  const hasEvents = events.length > 0;
  const preferLeft = colIndex >= 4;

  return (
    <div
      className={cn(
        "relative min-h-[32px] p-0.5 rounded text-[10px] select-none",
        isToday && "ring-1 ring-primary bg-primary/10",
        !isToday && isPast && "opacity-40",
        hasEvents && "cursor-pointer hover:bg-accent/60",
      )}
      onClick={handleClick}
      role={hasEvents ? "button" : undefined}
      tabIndex={hasEvents ? 0 : undefined}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") handleClick(); }}
      aria-label={hasEvents ? `${day} — ${events.length} event${events.length > 1 ? "s" : ""}` : undefined}
    >
      <span className={cn("font-medium", isToday && "text-primary font-bold")}>
        {day}
      </span>
      {hasEvents && (
        <div className="flex flex-wrap gap-px mt-px">
          {events.slice(0, 3).map((ev, i) => (
            <div
              key={i}
              className={cn("w-1.5 h-1.5 rounded-full", EVENT_DOT[ev.type] ?? "bg-muted")}
            />
          ))}
          {events.length > 3 && (
            <span className="text-[8px] leading-none text-muted-foreground">+{events.length - 3}</span>
          )}
        </div>
      )}
      {open && (
        <EventDropdown
          events={events}
          onClose={() => setOpen(false)}
          preferLeft={preferLeft}
        />
      )}
    </div>
  );
}

// ── MonthCard ─────────────────────────────────────────────────────────────────

function MonthCard({
  year,
  month,
  monthName,
  eventsByDate,
  currentDate,
}: {
  year: number;
  month: number;
  monthName: string;
  eventsByDate: Map<string, AnnualEvent[]>;
  currentDate: string;
}) {
  const firstDayOfWeek = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth    = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const cells: Array<number | null> = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthStr = String(month + 1).padStart(2, "0");

  return (
    <div className="rounded-lg border border-border bg-card p-2 space-y-1">
      <h3 className="text-xs font-semibold text-center text-foreground">{monthName}</h3>
      <div className="grid grid-cols-7 gap-px">
        {WEEKDAY_LABELS.map(wd => (
          <div key={wd} className="text-center text-[9px] font-medium text-muted-foreground pb-0.5">{wd}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const dayStr  = String(day).padStart(2, "0");
          const dateStr = `${year}-${monthStr}-${dayStr}`;
          const events  = eventsByDate.get(dateStr) ?? [];
          const isToday = dateStr === currentDate;
          const isPast  = dateStr < currentDate;
          const colIndex = i % 7;

          return (
            <DayCell
              key={dateStr}
              day={day}
              dateStr={dateStr}
              events={events}
              isToday={isToday}
              isPast={isPast}
              colIndex={colIndex}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

// ── AnnualCalendar page ───────────────────────────────────────────────────────

export default function AnnualCalendar() {
  const { calendar, setSpeed } = useCalendar();
  const [, navigate] = useLocation();

  const currentInGameDate = calendar?.currentDate ?? "";
  const currentInGameYear = currentInGameDate
    ? parseInt(currentInGameDate.split("-")[0]!, 10)
    : new Date().getUTCFullYear();

  const [viewYear, setViewYear] = useState<number>(currentInGameYear);

  // Sync viewYear once we have the current in-game year on first load
  useEffect(() => {
    if (currentInGameYear && !calendar) return;
    setViewYear(y => (y === new Date().getUTCFullYear() && currentInGameYear ? currentInGameYear : y));
  }, [currentInGameYear, calendar]);

  const { data, isLoading, error } = useAnnualCalendar(viewYear);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, AnnualEvent[]>();
    for (const ev of data?.events ?? []) {
      const existing = map.get(ev.date) ?? [];
      map.set(ev.date, [...existing, ev]);
    }
    return map;
  }, [data?.events]);

  const returnToCurrentYear = () => setViewYear(currentInGameYear);

  // Scroll current month into view
  const currentMonthRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (viewYear === currentInGameYear && currentMonthRef.current) {
      currentMonthRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [viewYear, currentInGameYear, data]);

  const currentMonthIndex = currentInGameDate
    ? parseInt(currentInGameDate.split("-")[1]!, 10) - 1
    : -1;

  const calendarSpeed = calendar?.calendarSpeed ?? "pause";

  const SPEED_BUTTONS: { label: string; speed: CalendarSpeed }[] = [
    { label: "⏸", speed: "pause"  },
    { label: "▶",  speed: "slow"   },
    { label: "▶▶", speed: "medium" },
    { label: "▶▶▶",speed: "fast"   },
  ];

  return (
    <div className="p-4 space-y-4 max-w-[1400px] mx-auto pb-10">

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewYear(y => y - 1)}
            disabled={viewYear <= 2024}
            aria-label="Previous year"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Season {viewYear} Calendar
          </h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewYear(y => y + 1)}
            disabled={viewYear >= 2035}
            aria-label="Next year"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Speed controls */}
          <div className="flex items-center gap-1">
            <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
            {SPEED_BUTTONS.map(({ label, speed }) => (
              <Button
                key={speed}
                size="sm"
                variant={calendarSpeed === speed ? "default" : "ghost"}
                className="h-7 px-2 text-xs font-mono"
                onClick={() => setSpeed(speed)}
              >
                {label}
              </Button>
            ))}
          </div>

          {currentInGameDate && (
            <span className="text-xs text-muted-foreground">
              {formatDateLabel(currentInGameDate)}
            </span>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={returnToCurrentYear}
            disabled={viewYear === currentInGameYear}
          >
            Return to Current Year
          </Button>
        </div>
      </div>

      {/* ── Season info bar ─────────────────────────────────────────── */}
      {data?.hasSeasonData ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            Season runs <strong className="text-foreground">{formatDateLabel(data.seasonStart!)}</strong>
            {" – "}
            <strong className="text-foreground">{formatDateLabel(data.seasonEnd!)}</strong>
          </span>
          {data.isOlympicSeason && (
            <span className="text-amber-400 font-semibold">🏅 Olympic Season</span>
          )}
          <span>{data.events.length} events scheduled</span>
        </div>
      ) : !isLoading ? (
        <p className="text-xs text-muted-foreground">
          No season data found for {viewYear}.{" "}
          <button className="underline" onClick={returnToCurrentYear}>
            Return to current year
          </button>
        </p>
      ) : null}

      {/* ── Color legend ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-3 py-2 rounded-lg bg-card border border-border text-xs">
        {LEGEND.map(item => (
          <div key={item.type} className="flex items-center gap-1.5">
            <div className={cn("w-2 h-2 rounded-full", item.dot)} />
            <span className="text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>

      {/* ── Calendar grid ─────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          Loading calendar…
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-48 text-destructive text-sm">
          Failed to load calendar data.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {MONTH_NAMES.map((monthName, monthIndex) => {
            const isCurrentMonth = viewYear === currentInGameYear && monthIndex === currentMonthIndex;
            return (
              <div key={monthIndex} ref={isCurrentMonth ? currentMonthRef : undefined}>
                <MonthCard
                  year={viewYear}
                  month={monthIndex}
                  monthName={monthName}
                  eventsByDate={eventsByDate}
                  currentDate={currentInGameDate}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
