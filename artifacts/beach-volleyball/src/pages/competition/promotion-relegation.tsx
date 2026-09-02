import { CONTINENT_KEYS, continentLabel } from "@shared/continents";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, Clock, AlertCircle } from "lucide-react";

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
};

type RegionalLeagueData = {
  season: { id: number; seasonYear: number; continent: string; status: string };
  fixtures: Array<{ id: number; round: number; status: string }>;
  ladder: LadderEntry[];
};

type PoolTeam = {
  id: number;
  teamName: string;
  rating: number;
  form: number;
  poolRanking: number;
  promotionCount: number;
  isActiveInLeague: boolean;
};

type PoolData = { continent: string; poolTeams: PoolTeam[] };

function useRegionalLeague(continent: string) {
  return useQuery<RegionalLeagueData>({
    queryKey: ["regional-league", continent],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/regional-league/${encodeURIComponent(continent)}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 30_000,
  });
}

function usePoolTeams(continent: string) {
  return useQuery<PoolData>({
    queryKey: ["continental-pools", continent],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/regional-league/${encodeURIComponent(continent)}/pools`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 30_000,
  });
}

function roundsCompleted(data: RegionalLeagueData): number {
  const completed = data.fixtures.filter(f => f.status === "completed");
  if (completed.length === 0) return 0;
  return Math.max(...completed.map(f => f.round));
}

function ContinentCard({ continent }: { continent: string }) {
  const { data: leagueData, isLoading: leagueLoading } = useRegionalLeague(continent);
  const { data: poolData, isLoading: poolLoading } = usePoolTeams(continent);

  const isLoading = leagueLoading || poolLoading;

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const rounds = leagueData ? roundsCompleted(leagueData) : 0;
  const isComplete = rounds >= 10;
  const sixthPlace = leagueData?.ladder?.find(e => e.position === 6) ?? null;
  const poolTeams = poolData?.poolTeams ?? [];
  const leadingPoolTeam = poolTeams
    .filter(t => !t.isActiveInLeague)
    .sort((a, b) => (a.poolRanking || 99) - (b.poolRanking || 99))[0] ?? null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
        <h3 className="font-semibold text-sm">{continentLabel(continent)}</h3>
        <div className="flex items-center gap-2">
          {isComplete ? (
            <Badge className="text-xs bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Season Complete
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs gap-1">
              <Clock className="h-3 w-3" />
              Round {rounds}/10
            </Badge>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Current 6th place */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
            <ArrowDown className="inline h-3 w-3 mr-0.5" />
            Relegation Position (6th)
          </p>
          {sixthPlace ? (
            <div className="flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2">
              <div>
                <p className="text-sm font-medium">{sixthPlace.teamName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {sixthPlace.wins}W – {sixthPlace.losses}L · {sixthPlace.points} pts
                </p>
              </div>
              {isComplete ? (
                <Badge variant="destructive" className="text-xs">Relegated</Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-red-600 dark:text-red-400 border-red-500/30">
                  Projected
                </Badge>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic px-3">No data yet</p>
          )}
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center">
          <ArrowUpDown className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Leading pool team */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            <ArrowUp className="inline h-3 w-3 mr-0.5" />
            Leading Pool Contender
          </p>
          {leadingPoolTeam ? (
            <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
              <div>
                <p className="text-sm font-medium">{leadingPoolTeam.teamName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Rating {leadingPoolTeam.rating} · Form {leadingPoolTeam.form} · {leadingPoolTeam.promotionCount}× promoted
                </p>
              </div>
              {isComplete ? (
                <Badge className="text-xs bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
                  Promoted
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                  Projected
                </Badge>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic px-3">No pool teams available</p>
          )}
        </div>

        {/* Notice */}
        {!isComplete && sixthPlace && leadingPoolTeam && (
          <p className="text-[10px] text-muted-foreground italic">
            Movement not processed until Round 10 is complete.
          </p>
        )}
      </div>
    </div>
  );
}

export default function PromotionRelegation() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Promotion & Relegation</h1>
        <p className="text-muted-foreground mt-1">
          Each season, the 6th-place regional team swaps with the leading continental pool team
        </p>
      </div>

      <div className="rounded-lg border bg-muted/20 p-4 text-sm space-y-1">
        <p className="font-medium">How it works</p>
        <p className="text-muted-foreground">
          After Round 10 completes, the team finishing 6th in each regional league is relegated
          to the continental pool. The highest-ranked eligible pool team is promoted to take their place.
          Promotion is never processed early — "Projected" labels appear until the season ends.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {CONTINENTS.map(continent => (
          <ContinentCard key={continent} continent={continent} />
        ))}
      </div>
    </div>
  );
}
