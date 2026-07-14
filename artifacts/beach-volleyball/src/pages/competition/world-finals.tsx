import { useGetCurrentSeason, useGetSeasonLadder } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Crown, Trophy, Lock, AlertCircle } from "lucide-react";

function TeamSlot({
  teamName,
  seed,
  isWinner,
  isPending,
}: {
  teamName?: string;
  seed?: number;
  isWinner?: boolean;
  isPending?: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center gap-2 rounded-lg border px-3 py-2 min-w-[180px]",
      isWinner ? "bg-yellow-500/10 border-yellow-500/40" :
      isPending ? "bg-muted/30 border-border/40 opacity-50" :
      "bg-card border-border",
    )}>
      {seed != null && (
        <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">#{seed}</span>
      )}
      {isPending ? (
        <div className="flex items-center gap-1.5 flex-1">
          <Lock className="h-3 w-3 text-muted-foreground/40" />
          <span className="text-sm text-muted-foreground italic">TBD</span>
        </div>
      ) : (
        <span className={cn("text-sm flex-1 truncate", isWinner && "font-semibold")}>{teamName}</span>
      )}
      {isWinner && <Crown className="h-4 w-4 text-yellow-500 shrink-0" />}
    </div>
  );
}

function MatchPair({
  label,
  top,
  bottom,
}: {
  label: string;
  top: { teamName?: string; seed?: number; isPending?: boolean };
  bottom: { teamName?: string; seed?: number; isPending?: boolean };
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">{label}</p>
      <div className="space-y-1">
        <TeamSlot {...top} />
        <div className="flex items-center px-3">
          <div className="flex-1 border-t border-dashed border-border/40" />
          <span className="text-[10px] text-muted-foreground px-1.5">vs</span>
          <div className="flex-1 border-t border-dashed border-border/40" />
        </div>
        <TeamSlot {...bottom} />
      </div>
    </div>
  );
}

export default function WorldFinals() {
  const { data: season, isLoading: seasonLoading } = useGetCurrentSeason();
  const seasonId = season?.id;
  const { data: ladder, isLoading: ladderLoading, isError } = useGetSeasonLadder(seasonId ?? 0);

  const isLoading = seasonLoading || ladderLoading;

  // Top 4 by rank (LadderEntry.rank is already 1-based position)
  const top4 = (ladder ?? [])
    .filter(e => e.rank >= 1 && e.rank <= 4)
    .sort((a, b) => a.rank - b.rank);

  const seed = (n: number) => top4.find(e => e.rank === n);
  const hasData = top4.length >= 4;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">World Finals</h1>
        <p className="text-muted-foreground mt-1">
          Top 4 from the World Tour standings — two semi-finals then a grand final
        </p>
      </div>

      {season && (
        <div className="flex items-center gap-2 text-sm">
          <Trophy className="h-4 w-4 text-yellow-500" />
          <span className="font-medium">Season {season.year} — World Finals</span>
          {!hasData && (
            <Badge variant="outline" className="ml-2 text-xs">Pending WT completion</Badge>
          )}
        </div>
      )}

      {isLoading && (
        <div className="space-y-6">
          <Skeleton className="h-28 w-full max-w-xs rounded-lg" />
          <Skeleton className="h-28 w-full max-w-xs rounded-lg" />
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 text-destructive text-sm p-3 rounded-lg border border-destructive/30 bg-destructive/5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load World Finals data.
        </div>
      )}

      {!isLoading && !isError && (
        <div className="space-y-8">
          <div className="rounded-lg border bg-muted/20 p-4 text-sm space-y-1 max-w-xl">
            <p className="font-medium">Format</p>
            <p className="text-muted-foreground">
              Semi-final 1: Seed #1 vs Seed #4 · Semi-final 2: Seed #2 vs Seed #3
              <br />
              Winners meet in the Grand Final. Third-place playoff is also played.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-8 items-start">
            <div className="space-y-6">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Semi-finals</p>
              <MatchPair
                label="Semi-final 1"
                top={{ teamName: seed(1)?.teamName, seed: 1, isPending: !seed(1) }}
                bottom={{ teamName: seed(4)?.teamName, seed: 4, isPending: !seed(4) }}
              />
              <MatchPair
                label="Semi-final 2"
                top={{ teamName: seed(2)?.teamName, seed: 2, isPending: !seed(2) }}
                bottom={{ teamName: seed(3)?.teamName, seed: 3, isPending: !seed(3) }}
              />
            </div>

            <div className="hidden lg:flex flex-col justify-center h-full pt-16">
              <div className="text-muted-foreground text-2xl">→</div>
            </div>

            <div className="space-y-6">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Grand Final</p>
              <MatchPair
                label="Final"
                top={{ isPending: true }}
                bottom={{ isPending: true }}
              />
              <MatchPair
                label="3rd Place"
                top={{ isPending: true }}
                bottom={{ isPending: true }}
              />
            </div>
          </div>

          {hasData && (
            <div className="rounded-xl border bg-card overflow-hidden max-w-md">
              <div className="px-4 py-3 border-b bg-muted/30">
                <p className="text-sm font-semibold">WT Standings — Top 4</p>
              </div>
              <div className="divide-y">
                {top4.map(e => (
                  <div key={e.teamId} className="px-4 py-2.5 flex items-center gap-3">
                    <span className="text-sm font-bold text-yellow-600 dark:text-yellow-400 w-5 text-center">
                      #{e.rank}
                    </span>
                    <span className="text-sm font-medium flex-1 truncate">{e.teamName}</span>
                    <span className="text-xs text-muted-foreground">{e.points} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
