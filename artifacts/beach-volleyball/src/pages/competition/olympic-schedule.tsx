/**
 * The Empire Nations Cup — R-61: the tournament this career plays.
 *
 * 1.1.3 (Rob, 23 Oct; brief A4): played over days after the last regular World
 * Tour round (utils/olympics.ts): group day, quarter-finals, semi-finals, medal
 * day. Every match is a fixture, scheduled, then live while it is watched, then
 * decided. On its day a match has a Watch button: it opens on the 3D court in
 * the two nations' colours (Auto; Manual too for the nation the player coaches).
 * One not watched is decided by the engine at the end of its day. Before the
 * draw there is nothing to show but when the Cup is.
 */
import { gameDateText } from "@/lib/game-date";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Trophy, Medal, Flame, CalendarDays, MonitorPlay } from "lucide-react";
import { Flag } from "@/components/flag";

type SetScore = { home: number; away: number };
type Player = { kind: "player" | "pool"; id: number; name: string; club: string; rating: number };
type Side = { nation: string; seed: number; pair: Player[] };
export type CupFixture = {
  id: number; stage: string; label: string; groupName: string | null; scheduledOn: string;
  status: "scheduled" | "live" | "decided"; decidedBy: string | null;
  home: Side; away: Side;
  result: { homeSets: number; awaySets: number; sets: SetScore[]; winner: string } | null;
  watchable: boolean; yourNation: boolean;
};
type Entry = { seed: number; nation: string; points: number; qualifyingRank: number; rating: number; pair: Player[] };
type Standing = { nation: string; seed: number; played: number; won: number; lost: number; setsFor: number; setsAgainst: number };
type Days = { lastRound: string; group: string; quarter_final: string; semi_final: string; medal: string };
type Cup = {
  seasonYear: number; drawn: boolean; days: Days; finished: boolean;
  field: Entry[];
  passedOver: Array<{ nation: string; qualifyingRank: number; eligible: number }>;
  schedule: Array<{ date: string; label: string; fixtures: CupFixture[] }>;
  groups: Array<{ name: string; standings: Standing[] }>;
  medals: { gold: Entry; silver: Entry; bronze: Entry } | null;
};
type ScheduleData = {
  seasonYear: number; today: string; isOlympicYear: boolean; olympicsYear: number; olympicsDate: string;
  days: Days; coached: string | null; cup: Cup | null;
};

const STAGE_LABEL: Record<string, string> = {
  group: "Group", quarter_final: "Quarter-final", semi_final: "Semi-final", bronze: "Bronze medal match", gold: "Gold medal match",
};

/** The court for a Cup match: Auto, or Manual too when it is his nation's. */
export function watchCupHref(f: Pick<CupFixture, "id" | "yourNation">): string {
  return `/court?nationsMatchId=${f.id}${f.yourNation ? "&nationsManual=1" : ""}`;
}

export function CupMatchRow({ m, onWatch }: { m: CupFixture; onWatch?: (m: CupFixture) => void }) {
  const r = m.result;
  const homeWon = r?.winner === m.home.nation;
  return (
    <div className={cn("flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/30", m.yourNation && "ring-1 ring-amber-400/60")} data-testid="olympic-match">
      <div className={cn("flex items-center gap-1.5 flex-1 justify-end min-w-0", r && homeWon && "font-bold")}>
        <span className="text-sm truncate text-right">{m.home.nation}</span>
        <Flag nation={m.home.nation} size={14} />
      </div>
      <div className="shrink-0 text-center min-w-[6.5rem]">
        {r ? (
          <>
            <div className="font-black text-sm tabular-nums">{r.homeSets}–{r.awaySets}</div>
            <div className="text-[10px] text-muted-foreground tabular-nums">
              {r.sets.map((s) => `${s.home}-${s.away}`).join(", ")}{m.decidedBy === "court" ? " · watched" : ""}
            </div>
          </>
        ) : (
          <div className="text-[11px] font-semibold text-muted-foreground">
            {m.status === "live" ? <span className="text-emerald-400">Live</span> : `${m.groupName ? `Group ${m.groupName}` : STAGE_LABEL[m.stage] ?? m.label}`}
          </div>
        )}
      </div>
      <div className={cn("flex items-center gap-1.5 flex-1 min-w-0", r && !homeWon && "font-bold")}>
        <Flag nation={m.away.nation} size={14} />
        <span className="text-sm truncate">{m.away.nation}</span>
      </div>
      {m.watchable && onWatch && (
        <Button size="sm" variant={m.yourNation ? "default" : "outline"} className="h-7 gap-1 shrink-0" onClick={() => onWatch(m)} data-testid="button-watch-cup-match">
          <MonitorPlay className="h-3.5 w-3.5" /> Watch
        </Button>
      )}
    </div>
  );
}

function Podium({ medals }: { medals: NonNullable<Cup["medals"]> }) {
  const place = [
    { key: "gold",   label: "Gold",   entry: medals.gold,   tone: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300" },
    { key: "silver", label: "Silver", entry: medals.silver, tone: "border-zinc-300/40 bg-zinc-300/10 text-zinc-200" },
    { key: "bronze", label: "Bronze", entry: medals.bronze, tone: "border-amber-700/40 bg-amber-700/10 text-amber-500" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3" data-testid="olympic-medals">
      {place.map(({ key, label, entry, tone }) => (
        <div key={key} className={cn("rounded-xl border p-4", tone)}>
          <div className="text-[10px] font-black uppercase tracking-widest">{label}</div>
          <div className="mt-1 flex items-center gap-2 text-lg font-bold"><Flag nation={entry.nation} size={18} />{entry.nation}</div>
          <div className="text-xs text-muted-foreground">{entry.pair.map((p) => `${p.name} (${p.club})`).join(" · ")}</div>
        </div>
      ))}
    </div>
  );
}

export default function OlympicSchedule() {
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery<ScheduleData>({
    queryKey: ["olympic-schedule"],
    queryFn: () => fetch("/api/olympics/schedule").then((r) => r.json()),
    staleTime: 15_000,
  });

  if (isLoading) {
    return <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}</div>;
  }
  if (!data) return null;

  const cup = data.cup;
  if (!cup) {
    const d = data.days;
    return (
      <div className="rounded-xl border bg-card p-8 text-center space-y-3" data-testid="olympic-not-played">
        <CalendarDays className="h-8 w-8 text-muted-foreground mx-auto" />
        <h2 className="text-lg font-bold">Empire Nations Cup {data.olympicsYear}</h2>
        <p className="text-sm text-muted-foreground">
          {data.isOlympicYear ? "This season" : `In ${data.olympicsYear}`}, after the last regular World Tour round and before the World Finals.
          {" "}The 12 nations with the most World Tour ranking points that season qualify.
        </p>
        <p className="text-sm">
          Group day {gameDateText(d.group)} · quarter-finals {gameDateText(d.quarter_final)} · semi-finals {gameDateText(d.semi_final)} · medal day {gameDateText(d.medal)}
        </p>
      </div>
    );
  }

  const watch = (m: CupFixture) => navigate(watchCupHref(m));
  return (
    <div className="space-y-6" data-testid="olympic-tournament">
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <Flame className="h-5 w-5 text-amber-400" />
          <h2 className="text-xl font-bold">{cup.seasonYear} Empire Nations Cup</h2>
          <Badge variant="outline">{cup.finished ? "Finished" : `From ${gameDateText(cup.days.group)}`}</Badge>
          {data.coached && <Badge className="gap-1"><Flag nation={data.coached} size={11} /> You coach {data.coached}</Badge>}
        </div>
        {cup.passedOver.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Passed over — could not field two fit players at any club:{" "}
            {cup.passedOver.map((p, i) => <span key={p.nation}>{i > 0 && ", "}<Flag nation={p.nation} size={11} className="mr-1" />{p.nation} ({p.eligible})</span>)}.
          </p>
        )}
      </div>

      {cup.medals && <Podium medals={cup.medals} />}

      <div>
        <h3 className="text-base font-bold mb-3 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" /> Schedule
        </h3>
        <div className="space-y-4">
          {cup.schedule.map((d) => (
            <div key={d.date} className={cn("rounded-xl border bg-card overflow-hidden", d.date === data.today && "border-emerald-500/50")} data-testid="cup-day">
              <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center justify-between gap-2">
                <span className="font-black text-sm">{d.label}</span>
                <span className="text-xs text-muted-foreground">{gameDateText(d.date)}{d.date === data.today ? " · today" : ""}</span>
              </div>
              <div className="p-3 space-y-1.5">
                {d.fixtures.length === 0
                  ? <p className="text-xs text-muted-foreground px-1">Drawn when the day before is decided.</p>
                  : d.fixtures.map((m) => <CupMatchRow key={m.id} m={m} onWatch={watch} />)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-base font-bold mb-3 flex items-center gap-2">
          <Medal className="h-4 w-4 text-muted-foreground" /> Group Tables
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {cup.groups.map((g) => (
            <div key={g.name} className="rounded-xl border bg-card overflow-hidden">
              <div className="px-4 py-2.5 border-b bg-muted/30 font-black text-sm">Group {g.name}</div>
              <div className="px-3 pt-2 pb-2">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 text-[10px] font-black uppercase tracking-wide text-muted-foreground/60 px-1 mb-1">
                  <span>Nation</span><span>W</span><span>L</span><span>Sets</span>
                </div>
                {g.standings.map((s, i) => (
                  <div key={s.nation} className={cn("grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center px-1 py-1 text-sm", i < 2 ? "text-foreground" : "text-muted-foreground")}>
                    <span className="flex items-center gap-1.5 truncate text-xs font-semibold"><Flag nation={s.nation} size={11} />{s.nation}</span>
                    <span className="text-xs tabular-nums">{s.won}</span>
                    <span className="text-xs tabular-nums">{s.lost}</span>
                    <span className="text-xs tabular-nums">{s.setsFor}-{s.setsAgainst}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <Trophy className="h-3.5 w-3.5" />
        Each nation plays its two best fit players at any club. Matches not watched are decided at the end of their day.
      </div>
    </div>
  );
}
