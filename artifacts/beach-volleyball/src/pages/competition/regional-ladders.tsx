import { CONTINENT_KEYS, continentLabel } from "@shared/continents";
import { useQueries } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BarChart2, AlertCircle } from "lucide-react";

/**
 * Driven by the canonical KEYS. Each of these screens used to declare its own
 * array of continent LABELS; the copies drifted, and any screen whose spelling
 * did not match the data silently rendered nothing for that region. Labels are
 * looked up at render time via continentLabel().
 */
const CONTINENTS = CONTINENT_KEYS;

type LadderEntry = {
  position: number;
  poolTeamId: number;
  teamName: string;
  played: number;
  wins: number;
  losses: number;
  points: number;
  setDiff: number;
  matchPointDiff: number;
};

type RegionalLeagueData = {
  season: { id: number; seasonYear: number; continent: string; status: string };
  fixtures: Array<{ id: number; round: number; status: string }>;
  ladder: LadderEntry[];
};

function useAllRegionalLeagues() {
  return useQueries({
    queries: CONTINENTS.map(continent => ({
      queryKey: ["regional-league", continent],
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const res = await fetch(`/api/regional-league/${encodeURIComponent(continent)}`, { signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<RegionalLeagueData>;
      },
      staleTime: 30_000,
    })),
  });
}

function currentRound(data: RegionalLeagueData): number {
  const completed = data.fixtures.filter(f => f.status === "completed");
  if (completed.length === 0) return 0;
  return Math.max(...completed.map(f => f.round));
}

function positionBand(pos: number) {
  if (pos <= 3) return { label: "WT Qual", cls: "border-l-2 border-l-emerald-500 bg-emerald-500/5" };
  if (pos <= 5) return { label: "Regional", cls: "border-l-2 border-l-slate-400/30" };
  return { label: "Relegation", cls: "border-l-2 border-l-red-500 bg-red-500/5" };
}

function ContinentLadder({ continent, data }: { continent: string; data: RegionalLeagueData }) {
  const round = currentRound(data);
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">{continentLabel(continent)}</h3>
        </div>
        <Badge variant="outline" className="text-xs">
          {round === 0 ? "Pre-season" : round >= 10 ? "Complete" : `Round ${round}/10`}
        </Badge>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/20">
              <th className="h-8 px-3 text-center text-[10px] font-medium text-muted-foreground w-10">#</th>
              <th className="h-8 px-3 text-left text-[10px] font-medium text-muted-foreground">Team</th>
              <th className="h-8 px-2 text-center text-[10px] font-medium text-muted-foreground w-10 hidden sm:table-cell">P</th>
              <th className="h-8 px-2 text-center text-[10px] font-medium text-muted-foreground w-10">W</th>
              <th className="h-8 px-2 text-center text-[10px] font-medium text-muted-foreground w-10">L</th>
              <th className="h-8 px-2 text-center text-[10px] font-medium text-muted-foreground w-14 hidden md:table-cell">Sets +/−</th>
              <th className="h-8 px-2 text-center text-[10px] font-medium text-muted-foreground w-16 hidden lg:table-cell">MP +/−</th>
              <th className="h-8 px-3 text-right text-[10px] font-medium text-muted-foreground w-12">Pts</th>
            </tr>
          </thead>
          <tbody>
            {data.ladder.map((entry, idx) => {
              const band = positionBand(entry.position);
              const isQualLine = idx === 3;
              const isRelLine = idx === 5;
              return (
                <>
                  {isQualLine && (
                    <tr key={`q-${idx}`}>
                      <td colSpan={8} className="py-0">
                        <div className="text-[9px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 px-3 py-0.5 bg-emerald-500/5 border-y border-emerald-500/20">
                          ▲ World Tour Qualification
                        </div>
                      </td>
                    </tr>
                  )}
                  {isRelLine && (
                    <tr key={`r-${idx}`}>
                      <td colSpan={8} className="py-0">
                        <div className="text-[9px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400 px-3 py-0.5 bg-red-500/5 border-y border-red-500/20">
                          ▼ Relegation Zone
                        </div>
                      </td>
                    </tr>
                  )}
                  <tr
                    key={entry.poolTeamId}
                    className={cn(
                      "border-b last:border-0 hover:bg-muted/30 transition-colors",
                      band.cls,
                    )}
                  >
                    <td className="py-2 px-3 text-center">
                      <span className={cn(
                        "text-xs font-bold",
                        entry.position <= 3 ? "text-emerald-600 dark:text-emerald-400" :
                        entry.position === 6 ? "text-red-600 dark:text-red-400" :
                        "text-muted-foreground",
                      )}>
                        {entry.position}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-sm font-medium truncate max-w-[140px] block">{entry.teamName}</span>
                    </td>
                    <td className="py-2 px-2 text-center text-xs text-muted-foreground hidden sm:table-cell">{entry.played}</td>
                    <td className="py-2 px-2 text-center text-xs font-medium text-emerald-600 dark:text-emerald-400">{entry.wins}</td>
                    <td className="py-2 px-2 text-center text-xs font-medium text-red-500 dark:text-red-400">{entry.losses}</td>
                    <td className="py-2 px-2 text-center text-xs text-muted-foreground hidden md:table-cell">
                      {entry.setDiff >= 0 ? `+${entry.setDiff}` : entry.setDiff}
                    </td>
                    <td className="py-2 px-2 text-center text-xs text-muted-foreground hidden lg:table-cell">
                      {entry.matchPointDiff >= 0 ? `+${entry.matchPointDiff}` : entry.matchPointDiff}
                    </td>
                    <td className="py-2 px-3 text-right text-sm font-bold">{entry.points}</td>
                  </tr>
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RegionalLadders() {
  const results = useAllRegionalLeagues();
  const isLoading = results.some(r => r.isLoading);
  const hasError = results.some(r => r.isError && !r.data);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Regional Ladders</h1>
        <p className="text-muted-foreground mt-1">
          Independent standings for all six continental leagues
        </p>
      </div>

      {/* Band legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-1 rounded-full bg-emerald-500" />
          Positions 1–3 — World Tour Qualification
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-1 rounded-full bg-slate-400" />
          Positions 4–5 — Remain Regional
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-1 rounded-full bg-red-500" />
          Position 6 — Relegated to Pool
        </span>
      </div>

      {hasError && (
        <div className="flex items-center gap-2 text-destructive text-sm p-3 rounded-lg border border-destructive/30 bg-destructive/5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Some continental data failed to load.
        </div>
      )}

      {isLoading ? (
        <div className="space-y-6">
          {CONTINENTS.map(c => (
            <div key={c} className="rounded-xl border bg-card p-4 space-y-2">
              <Skeleton className="h-5 w-40" />
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {CONTINENTS.map((continent, idx) => {
            const r = results[idx];
            if (!r?.data) return (
              <div key={continent} className="rounded-xl border bg-card p-6 text-center text-muted-foreground text-sm">
                {continentLabel(continent)} — No active season data
              </div>
            );
            return <ContinentLadder key={continent} continent={continent} data={r.data} />;
          })}
        </div>
      )}
    </div>
  );
}
