import { CONTINENT_KEYS, continentLabel } from "@shared/continents";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Users, TrendingUp, AlertCircle, Star } from "lucide-react";

/**
 * Driven by the canonical KEYS. Each of these screens used to declare its own
 * array of continent LABELS; the copies drifted, and any screen whose spelling
 * did not match the data silently rendered nothing for that region. Labels are
 * looked up at render time via continentLabel().
 */
const CONTINENTS = CONTINENT_KEYS;

type PoolPlayer = {
  id: number;
  name: string;
  nationality: string;
  age: number;
  speed: number;
  power: number;
  defense: number;
  serve: number;
  block: number;
  stamina: number;
  imageUrl: string | null;
};

type PoolTeam = {
  id: number;
  teamName: string;
  stableId: string;
  rating: number;
  form: number;
  fitness: number;
  poolRanking: number;
  promotionCount: number;
  relegationCount: number;
  isActiveInLeague: boolean;
  players: PoolPlayer[];
};

type PoolData = {
  continent: string;
  poolTeams: PoolTeam[];
};

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

function ratingBar(value: number) {
  const pct = Math.min(100, Math.max(0, value));
  const color =
    pct >= 80 ? "bg-emerald-500" :
    pct >= 65 ? "bg-blue-500" :
    pct >= 50 ? "bg-amber-500" :
    "bg-red-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums w-6 text-right">{value}</span>
    </div>
  );
}

function formBar(form: number) {
  const color =
    form >= 70 ? "text-emerald-600 dark:text-emerald-400" :
    form >= 50 ? "text-amber-600 dark:text-amber-400" :
    "text-red-600 dark:text-red-400";
  return <span className={cn("text-xs font-semibold", color)}>{form}</span>;
}

function PoolTeamCard({ team, isLeader }: { team: PoolTeam; isLeader: boolean }) {
  return (
    <div className={cn(
      "rounded-lg border bg-card p-4 space-y-3",
      isLeader && "ring-2 ring-emerald-500/40 border-emerald-500/30",
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {isLeader && <Star className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
            <h4 className="font-semibold text-sm truncate">{team.teamName}</h4>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Pool Rank #{team.poolRanking || "—"}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {isLeader && (
            <Badge className="text-xs bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
              <TrendingUp className="h-3 w-3 mr-1" />
              Promotion Contender
            </Badge>
          )}
          {team.isActiveInLeague && (
            <Badge variant="secondary" className="text-xs">In League</Badge>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Rating</p>
          {ratingBar(team.rating)}
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Form</p>
          <div className="flex items-center gap-1.5">{formBar(team.form)}</div>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Promotions</p>
          <span className="text-xs font-medium">{team.promotionCount}×</span>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Relegations</p>
          <span className="text-xs font-medium">{team.relegationCount}×</span>
        </div>
      </div>

      {/* Players */}
      {team.players.length > 0 && (
        <div className="border-t pt-2.5 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Players</p>
          {team.players.slice(0, 2).map(p => (
            <div key={p.id} className="flex items-center justify-between text-xs">
              <div>
                <span className="font-medium">{p.name}</span>
                {p.nationality && (
                  <span className="text-muted-foreground ml-1.5">· {p.nationality}</span>
                )}
              </div>
              <span className="text-muted-foreground">Age {p.age}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ContinentalPools() {
  const [continent, setContinent] = useState<string>(CONTINENTS[0]);
  const { data, isLoading, isError } = usePoolTeams(continent);

  const poolTeams = data?.poolTeams ?? [];
  const inPool = poolTeams.filter(t => !t.isActiveInLeague).sort((a, b) => a.poolRanking - b.poolRanking);
  const inLeague = poolTeams.filter(t => t.isActiveInLeague);
  const leaderTeam = inPool[0] ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Continental Pools</h1>
        <p className="text-muted-foreground mt-1">
          Pool teams competing for promotion to the regional league
        </p>
      </div>

      <Select value={continent} onValueChange={setContinent}>
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CONTINENTS.map(c => <SelectItem key={c} value={c}>{continentLabel(c)}</SelectItem>)}
        </SelectContent>
      </Select>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-52 rounded-lg" />)}
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 text-destructive text-sm p-3 rounded-lg border border-destructive/30 bg-destructive/5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load pool data for {continentLabel(continent)}.
        </div>
      )}

      {!isLoading && !isError && (
        <div className="space-y-6">
          {/* Active league teams */}
          {inLeague.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Currently in Regional League
                </h2>
                <Badge variant="secondary">{inLeague.length} teams</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {inLeague.map(t => (
                  <PoolTeamCard key={t.id} team={t} isLeader={false} />
                ))}
              </div>
            </div>
          )}

          {/* Pool teams */}
          {inPool.length > 0 ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Continental Pool — Promotion Candidates
                </h2>
                <Badge variant="secondary">{inPool.length} teams</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {inPool.map(t => (
                  <PoolTeamCard key={t.id} team={t} isLeader={leaderTeam?.id === t.id} />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p>No pool teams found for {continentLabel(continent)}.</p>
              <p className="text-xs mt-1 opacity-60">All available teams may be active in the regional league.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
