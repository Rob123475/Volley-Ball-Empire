import { CONTINENT_KEYS, continentLabel } from "@shared/continents";
import { useQueries } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Globe, AlertCircle } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  season: { id: number; seasonYear: number; continent: string; status: string; teamIds: number[] };
  fixtures: Array<{ id: number; round: number; status: string }>;
  ladder: LadderEntry[];
};

// ── Data fetching ─────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentRound(data: RegionalLeagueData): number {
  const completed = data.fixtures.filter(f => f.status === "completed");
  if (completed.length === 0) return 0;
  const rounds = completed.map(f => f.round);
  return Math.max(...rounds);
}

function teamInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return name.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[words.length - 1]![0]!).toUpperCase();
}

const CONTINENT_ABBR: Record<string, string> = {
  europe:             "EUR",
  asia:               "ASI",
  north_america:      "NAM",
  south_america:      "SAM",
  africa_middle_east: "AFM",
  oceania:            "OCE",
};

// ── Row component ─────────────────────────────────────────────────────────────

function LadderRow({ entry }: { entry: LadderEntry }) {
  const pos = entry.position;
  const bandClass =
    pos <= 3 ? "border-l-2 border-l-emerald-500 bg-emerald-500/5" :
    pos <= 5 ? "border-l-2 border-l-slate-400/40 bg-transparent" :
               "border-l-2 border-l-red-500 bg-red-500/5";

  return (
    <tr className={cn("border-b last:border-0 hover:bg-muted/30 transition-colors", bandClass)}>
      <td className="py-1.5 px-2 w-8 text-center">
        <span className={cn(
          "text-xs font-bold",
          pos <= 3 ? "text-emerald-600 dark:text-emerald-400" :
          pos === 6 ? "text-red-600 dark:text-red-400" :
          "text-muted-foreground",
        )}>
          {pos}
        </span>
      </td>
      <td className="py-1.5 px-2">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold bg-muted text-muted-foreground shrink-0">
            {teamInitials(entry.teamName)}
          </span>
          <span className="text-xs font-medium truncate max-w-[110px]">{entry.teamName}</span>
        </div>
      </td>
      <td className="py-1.5 px-1.5 text-center text-xs text-muted-foreground hidden sm:table-cell">{entry.played}</td>
      <td className="py-1.5 px-1.5 text-center text-xs font-medium text-emerald-600 dark:text-emerald-400">{entry.wins}</td>
      <td className="py-1.5 px-1.5 text-center text-xs font-medium text-red-500 dark:text-red-400">{entry.losses}</td>
      <td className="py-1.5 px-1.5 text-center text-xs text-muted-foreground hidden md:table-cell">
        {entry.setDiff >= 0 ? `+${entry.setDiff}` : entry.setDiff}
      </td>
      <td className="py-1.5 px-2 text-right text-xs font-bold">{entry.points}</td>
    </tr>
  );
}

// ── Divider row ───────────────────────────────────────────────────────────────

function DividerRow({
  label,
  colSpan,
  color,
}: {
  label: string;
  colSpan: number;
  color: "emerald" | "red";
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-0">
        <div className={cn(
          "flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border-t",
          color === "emerald"
            ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5"
            : "text-red-600 dark:text-red-400 border-red-500/30 bg-red-500/5",
        )}>
          <span>{label}</span>
        </div>
      </td>
    </tr>
  );
}

// ── Continent card ────────────────────────────────────────────────────────────

function ContinentCard({
  continent,
  data,
}: {
  continent: string;
  data: RegionalLeagueData;
}) {
  const round = currentRound(data);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Globe className="h-4 w-4 text-primary shrink-0" />
          <h3 className="font-semibold text-sm truncate">{continentLabel(continent)}</h3>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            ({CONTINENT_ABBR[continent]})
          </span>
        </div>
        <Badge variant="outline" className="text-xs shrink-0">
          {round === 0 ? "Pre-season" : round >= 10 ? "Complete" : `Round ${round}/10`}
        </Badge>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/20">
              <th className="h-7 px-2 text-left text-[10px] font-medium text-muted-foreground w-8">#</th>
              <th className="h-7 px-2 text-left text-[10px] font-medium text-muted-foreground">Team</th>
              <th className="h-7 px-1.5 text-center text-[10px] font-medium text-muted-foreground w-8 hidden sm:table-cell">P</th>
              <th className="h-7 px-1.5 text-center text-[10px] font-medium text-muted-foreground w-8">W</th>
              <th className="h-7 px-1.5 text-center text-[10px] font-medium text-muted-foreground w-8">L</th>
              <th className="h-7 px-1.5 text-center text-[10px] font-medium text-muted-foreground w-12 hidden md:table-cell">S+/−</th>
              <th className="h-7 px-2 text-right text-[10px] font-medium text-muted-foreground w-10">Pts</th>
            </tr>
          </thead>
          <tbody>
            {data.ladder.map((entry, idx) => (
              <>
                {idx === 3 && (
                  <DividerRow key="divider-wt" label="▲ World Tour Qualification" colSpan={7} color="emerald" />
                )}
                {idx === 5 && (
                  <DividerRow key="divider-rel" label="▼ Relegation" colSpan={7} color="red" />
                )}
                <LadderRow key={entry.poolTeamId} entry={entry} />
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="px-3 py-2 border-t bg-muted/10 flex flex-wrap gap-x-4 gap-y-0.5">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="inline-block h-2 w-0.5 rounded bg-emerald-500" />
          1–3 World Tour Qualification
        </span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="inline-block h-2 w-0.5 rounded bg-slate-400" />
          4–5 Remain Regional
        </span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="inline-block h-2 w-0.5 rounded bg-red-500" />
          6 Relegation
        </span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RegionalOverview() {
  const results = useAllRegionalLeagues();
  const isLoading = results.some(r => r.isLoading);
  const hasError = results.some(r => r.isError);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Regional Overview</h1>
        <p className="text-muted-foreground mt-1">
          Six continental leagues — each producing three World Tour qualifiers
        </p>
      </div>

      {/* Legend summary */}
      <div className="flex flex-wrap gap-4 text-sm">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-emerald-500" />
          Positions 1–3 qualify for the World Tour
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-slate-400" />
          Positions 4–5 remain in regional competition
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-red-500" />
          Position 6 is relegated to the continental pool
        </span>
      </div>

      {hasError && (
        <div className="flex items-center gap-2 text-destructive text-sm p-3 rounded-lg border border-destructive/30 bg-destructive/5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Some continental data failed to load. Check if the regional season has started.
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {CONTINENTS.map(c => (
            <div key={c} className="rounded-xl border bg-card p-4 space-y-3">
              <Skeleton className="h-5 w-40" />
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {CONTINENTS.map((continent, idx) => {
            const result = results[idx];
            if (!result?.data) return (
              <div key={continent} className="rounded-xl border bg-card p-6 text-center text-muted-foreground text-sm">
                <Globe className="h-6 w-6 mx-auto mb-2 opacity-40" />
                {continentLabel(continent)} — No active season found
              </div>
            );
            return (
              <ContinentCard key={continent} continent={continent} data={result.data} />
            );
          })}
        </div>
      )}
    </div>
  );
}
