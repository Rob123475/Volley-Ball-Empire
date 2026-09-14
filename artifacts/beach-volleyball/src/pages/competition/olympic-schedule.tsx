/**
 * The Olympic draw — R-43: projected only.
 *
 * This build plays no Olympic tournament. The schedule used to fill in scores in
 * an Olympic year from a roll made on every request, so a reload could change
 * who won gold. No result exists until a real tournament does, so every match
 * here is the drawn fixture and nothing more.
 */
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Trophy, Medal, Flame } from "lucide-react";

type Fixture = {
  label?: string;
  home: string; homeflag: string;
  away: string; awayflag: string;
  day: number;
};

type GroupData = {
  group: string;
  standings: { country: string; flag: string; continent: string }[];
};

type GroupStage = {
  name: string;
  teams: { country: string; flag: string; continent: string; points: number }[];
  matches: Fixture[];
};

type ScheduleData = {
  olympicsYear: number;
  isOlympicYear: boolean;
  groupStage: GroupStage[];
  groupStandings: GroupData[];
  knockout: { qf: Fixture[]; sf: Fixture[]; finals: Fixture[] };
};

function FixtureRow({ m, compact }: { m: Fixture; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/10", compact && "py-1.5")}>
      <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
        <span className="text-sm truncate text-right">{m.home}</span>
        <span className="text-base leading-none shrink-0">{m.homeflag}</span>
      </div>
      <div className="shrink-0 w-10 text-center">
        <span className="text-xs text-muted-foreground font-semibold">vs</span>
      </div>
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <span className="text-base leading-none shrink-0">{m.awayflag}</span>
        <span className="text-sm truncate">{m.away}</span>
      </div>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Flame className="h-5 w-5 text-amber-400" />
          <h2 className="text-xl font-bold">{olympicsYear} Olympic Beach Volleyball</h2>
          <Badge variant="outline" className="text-muted-foreground">Projected draw</Badge>
        </div>
        <p className="text-sm text-muted-foreground" data-testid="olympic-schedule-note">
          {isOlympicYear
            ? `The ${olympicsYear} draw from this season's qualifying. This build plays no Olympic tournament: no matches are played and no medals are awarded.`
            : `Projected draw based on current qualification standings. Final bracket confirmed at ${olympicsYear - 1} season end.`}
        </p>
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
                    {standings.standings.map((t, ri) => (
                      <div key={t.country} className={cn(
                        "flex items-center gap-1.5 px-1 py-1 rounded text-sm min-w-0",
                        ri < 2 ? "text-foreground" : "text-muted-foreground",
                      )}>
                        {ri < 2 && <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />}
                        <span className="text-base leading-none">{t.flag}</span>
                        <span className="truncate text-xs font-semibold">{t.country}</span>
                      </div>
                    ))}
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5 mb-1 px-1">● = top two seeds, projected into the quarter-finals</p>
                  </div>
                )}

                <div className="px-3 pb-3 space-y-1 border-t pt-2">
                  {g.matches.map((m, mi) => <FixtureRow key={mi} m={m} compact />)}
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
            {knockout.qf.map(m => <FixtureRow key={m.label} m={m} />)}
          </div>
        </div>

        <div className="mb-4">
          <div className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">
            Semi Finals — Day 6
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {knockout.sf.map(m => <FixtureRow key={m.label} m={m} />)}
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
                <FixtureRow m={m} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
