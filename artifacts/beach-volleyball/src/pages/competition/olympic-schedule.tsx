import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Trophy, Medal, Flame } from "lucide-react";

type GSMatch = {
  home: string; homeflag: string;
  away: string; awayflag: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "projected" | "completed";
  day: number;
};

type KOMatch = {
  label: string;
  home: string; homeflag: string;
  away: string; awayflag: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "projected" | "completed";
  day: number;
};

type GroupStanding = {
  country: string; flag: string; continent: string;
  played: number; won: number; lost: number; points: number;
};

type GroupData = {
  group: string;
  standings: GroupStanding[];
};

type GroupStage = {
  name: string;
  teams: { country: string; flag: string; continent: string; teamRating: number }[];
  matches: GSMatch[];
};

type ScheduleData = {
  olympicsYear: number;
  isOlympicYear: boolean;
  groupStage: GroupStage[];
  groupStandings: GroupData[];
  knockout: { qf: KOMatch[]; sf: KOMatch[]; finals: KOMatch[] };
};

function MatchRow({ m, compact }: { m: GSMatch | KOMatch; compact?: boolean }) {
  const done = m.status === "completed";
  const homeWon = done && (m.homeScore ?? 0) > (m.awayScore ?? 0);
  const awayWon = done && (m.awayScore ?? 0) > (m.homeScore ?? 0);
  return (
    <div className={cn("flex items-center gap-3 py-2 px-3 rounded-lg", done ? "bg-muted/30" : "bg-muted/10", compact && "py-1.5")}>
      <div className={cn("flex items-center gap-1.5 flex-1 justify-end min-w-0", homeWon && "font-bold")}>
        <span className="text-sm truncate text-right">{m.home}</span>
        <span className="text-base leading-none shrink-0">{m.homeflag}</span>
      </div>
      <div className="shrink-0 w-16 text-center">
        {done ? (
          <span className="font-black text-sm tabular-nums">
            <span className={homeWon ? "text-foreground" : "text-muted-foreground"}>{m.homeScore}</span>
            <span className="text-muted-foreground mx-0.5">–</span>
            <span className={awayWon ? "text-foreground" : "text-muted-foreground"}>{m.awayScore}</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground font-semibold">vs</span>
        )}
      </div>
      <div className={cn("flex items-center gap-1.5 flex-1 min-w-0", awayWon && "font-bold")}>
        <span className="text-base leading-none shrink-0">{m.awayflag}</span>
        <span className="text-sm truncate">{m.away}</span>
      </div>
      {!done && (
        <Badge variant="outline" className="text-[10px] shrink-0 text-muted-foreground">Projected</Badge>
      )}
    </div>
  );
}

export default function OlympicSchedule() {
  const { data, isLoading } = useQuery<ScheduleData>({
    queryKey: ["olympic-schedule"],
    queryFn: () => fetch("/api/olympics/schedule").then(r => r.json()),
    staleTime: 120_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1,2,3].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
      </div>
    );
  }

  if (!data) return null;

  const { olympicsYear, isOlympicYear, groupStage, groupStandings, knockout } = data;

  const goldMatch = knockout.finals.find(f => f.label === "Gold");
  const goldMedalist = goldMatch?.status === "completed"
    ? ((goldMatch.homeScore ?? 0) > (goldMatch.awayScore ?? 0)
        ? `${goldMatch.homeflag} ${goldMatch.home}`
        : `${goldMatch.awayflag} ${goldMatch.away}`)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Flame className="h-5 w-5 text-amber-400" />
            <h2 className="text-xl font-bold">{olympicsYear} Olympic Beach Volleyball</h2>
            {isOlympicYear ? (
              <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30">Live</Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">Projected</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {isOlympicYear
              ? "Olympic tournament bracket — results below."
              : `Projected draw based on current qualification standings. Final bracket confirmed at ${olympicsYear - 1} season end.`}
          </p>
        </div>
        {goldMedalist && (
          <div className="flex items-center gap-2 bg-amber-950/30 border border-amber-500/30 rounded-xl px-4 py-2 shrink-0">
            <Trophy className="h-4 w-4 text-amber-400" />
            <div>
              <div className="text-[10px] text-amber-400/70 font-black uppercase tracking-wider">Gold Medal</div>
              <div className="font-bold text-sm text-amber-300">{goldMedalist}</div>
            </div>
          </div>
        )}
      </div>

      {/* Group Stage */}
      <div>
        <h3 className="text-base font-bold mb-3 flex items-center gap-2">
          <Medal className="h-4 w-4 text-muted-foreground" />
          Group Stage
          <span className="text-xs text-muted-foreground font-normal">Days 1–4</span>
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {groupStage.map((g, gi) => {
            const standings = groupStandings[gi];
            return (
              <div key={g.name} className="rounded-xl border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
                  <span className="font-black text-sm">Group {g.name}</span>
                  <span className="text-xs text-muted-foreground">
                    Days {g.matches[0]?.day}–{g.matches[2]?.day}
                  </span>
                </div>

                {standings && (
                  <div className="px-3 pt-2 pb-1">
                    <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 text-[10px] font-black uppercase tracking-wide text-muted-foreground/60 px-1 mb-1">
                      <span>Team</span><span>P</span><span>W</span><span>L</span><span>Pts</span>
                    </div>
                    {standings.standings.map((t, ri) => (
                      <div key={t.country} className={cn(
                        "grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 items-center px-1 py-1 rounded text-sm",
                        ri < 2 ? "text-foreground" : "text-muted-foreground",
                      )}>
                        <div className="flex items-center gap-1.5 min-w-0">
                          {ri < 2 && <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />}
                          <span className="text-base leading-none">{t.flag}</span>
                          <span className="truncate text-xs font-semibold">{t.country}</span>
                        </div>
                        <span className="text-xs tabular-nums text-center">{t.played}</span>
                        <span className="text-xs tabular-nums text-center">{t.won}</span>
                        <span className="text-xs tabular-nums text-center">{t.lost}</span>
                        <span className="text-xs tabular-nums font-bold text-center">{t.points}</span>
                      </div>
                    ))}
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5 mb-1 px-1">● = advance to QF</p>
                  </div>
                )}

                <div className="px-3 pb-3 space-y-1 border-t pt-2">
                  {g.matches.map((m, mi) => <MatchRow key={mi} m={m} compact />)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Knockout */}
      <div>
        <h3 className="text-base font-bold mb-3 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400" />
          Knockout Rounds
          <span className="text-xs text-muted-foreground font-normal">Days 5–7</span>
        </h3>

        <div className="mb-4">
          <div className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">
            Quarter Finals — Day 5
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {knockout.qf.map(m => <MatchRow key={m.label} m={m} />)}
          </div>
        </div>

        <div className="mb-4">
          <div className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">
            Semi Finals — Day 6
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {knockout.sf.map(m => <MatchRow key={m.label} m={m} />)}
          </div>
        </div>

        <div>
          <div className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">
            Finals — Day 7
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {[...knockout.finals].reverse().map(m => (
              <div key={m.label}>
                <div className={cn("text-[10px] font-black uppercase tracking-wide mb-1",
                  m.label === "Gold" ? "text-amber-400" : "text-orange-600/80")}>
                  {m.label === "Gold" ? "🥇 Gold Medal Match" : "🥉 Bronze Medal Match"}
                </div>
                <MatchRow m={m} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
