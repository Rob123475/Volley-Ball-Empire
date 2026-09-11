import { useQuery } from "@tanstack/react-query";
import { useGetCurrentSeason, useGetSeasonLadder } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Crown, Trophy, Lock, AlertCircle } from "lucide-react";

type Side = { competitorId: number; name: string; isPlayer: boolean; seed: number | null };
type Fixture = {
  id: number;
  status: string;
  home: Side;
  away: Side;
  homeSets: number | null;
  awaySets: number | null;
  winnerCompetitorId: number | null;
};
type FinalsData = {
  seasonYear: number;
  seeded: boolean;
  playerQualified: boolean | null;
  semis: Fixture[];
  final: Fixture | null;
  champion: Side | null;
};

function TeamSlot({ side, sets, isWinner, isPending }: {
  side?: Side | null;
  sets?: number | null;
  isWinner?: boolean;
  isPending?: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center gap-2 rounded-lg border px-3 py-2 min-w-[200px]",
      isWinner ? "bg-yellow-500/10 border-yellow-500/40" :
      isPending ? "bg-muted/30 border-border/40 opacity-50" :
      "bg-card border-border",
    )}>
      {side?.seed != null && (
        <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">#{side.seed}</span>
      )}
      {isPending || !side ? (
        <div className="flex items-center gap-1.5 flex-1">
          <Lock className="h-3 w-3 text-muted-foreground/40" />
          <span className="text-sm text-muted-foreground italic">TBD</span>
        </div>
      ) : (
        <span className={cn("text-sm flex-1 truncate", isWinner && "font-semibold")}>
          {side.name}
          {side.isPlayer && <Badge variant="outline" className="ml-2 text-[10px] py-0">You</Badge>}
        </span>
      )}
      {sets != null && <span className="text-sm font-bold tabular-nums">{sets}</span>}
      {isWinner && <Crown className="h-4 w-4 text-yellow-500 shrink-0" />}
    </div>
  );
}

function MatchPair({ label, fixture }: { label: string; fixture: Fixture | null }) {
  const done = fixture?.status === "completed";
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">{label}</p>
      <div className="space-y-1">
        <TeamSlot
          side={fixture?.home}
          sets={done ? fixture!.homeSets : null}
          isWinner={done && fixture!.winnerCompetitorId === fixture!.home.competitorId}
          isPending={!fixture}
        />
        <div className="flex items-center px-3">
          <div className="flex-1 border-t border-dashed border-border/40" />
          <span className="text-[10px] text-muted-foreground px-1.5">vs</span>
          <div className="flex-1 border-t border-dashed border-border/40" />
        </div>
        <TeamSlot
          side={fixture?.away}
          sets={done ? fixture!.awaySets : null}
          isWinner={done && fixture!.winnerCompetitorId === fixture!.away.competitorId}
          isPending={!fixture}
        />
      </div>
    </div>
  );
}

/**
 * R-29: the World Finals as they were actually seeded and played.
 *
 * This page used to draw its bracket from "the top 4 of the ladder" — a ladder
 * that held one row — and showed the final and a third-place playoff as TBD
 * forever. Neither the playoff nor any AI semi final existed. It now reads
 * GET /world-tour/finals: seeds from the real standings, both semis, the final
 * and the champion.
 */
export default function WorldFinals() {
  const { data: season, isLoading: seasonLoading } = useGetCurrentSeason();
  const { data: ladder } = useGetSeasonLadder(season?.id ?? 0);

  const { data, isLoading: finalsLoading, isError } = useQuery<FinalsData>({
    queryKey: ["world-tour-finals", season?.year],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/world-tour/finals", { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!season,
  });

  const isLoading = seasonLoading || finalsLoading;
  const semi1 = data?.semis.find((s) => s.home.seed === 1 || s.away.seed === 1) ?? null;
  const semi2 = data?.semis.find((s) => s.home.seed === 2 || s.away.seed === 2) ?? null;
  const playerRow = (ladder ?? []).find((e) => e.isPlayer);
  const provisionalTop4 = (ladder ?? []).filter((e) => e.rank <= 4);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">World Finals</h1>
        <p className="text-muted-foreground mt-1">
          Top 4 from the World Tour standings — two semi finals, then the World Final
        </p>
      </div>

      {season && (
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <Trophy className="h-4 w-4 text-yellow-500" />
          <span className="font-medium">Season {season.year} — World Finals</span>
          {data && !data.seeded && (
            <Badge variant="outline" className="ml-2 text-xs">Seeded when World Tour round 70 is complete</Badge>
          )}
          {data?.playerQualified === false && (
            <Badge variant="outline" className="ml-2 text-xs border-red-500/40 text-red-500">
              Your club did not qualify{playerRow ? ` — finished #${playerRow.rank}` : ""}
            </Badge>
          )}
          {data?.playerQualified === true && (
            <Badge variant="outline" className="ml-2 text-xs border-emerald-500/40 text-emerald-600">
              Your club qualified
            </Badge>
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

      {!isLoading && !isError && data && (
        <div className="space-y-8">
          <div className="rounded-lg border bg-muted/20 p-4 text-sm space-y-1 max-w-xl">
            <p className="font-medium">Format</p>
            <p className="text-muted-foreground">
              Semi final 1: Seed #1 vs Seed #4 · Semi final 2: Seed #2 vs Seed #3
              <br />
              The two winners meet in the World Final.
            </p>
          </div>

          {data.champion && (
            <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 flex items-center gap-3 max-w-xl">
              <Crown className="h-6 w-6 text-yellow-500" />
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">World Champion {data.seasonYear}</p>
                <p className="text-lg font-bold">{data.champion.name}</p>
              </div>
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-8 items-start">
            <div className="space-y-6">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Semi finals</p>
              <MatchPair label="Semi final 1" fixture={semi1} />
              <MatchPair label="Semi final 2" fixture={semi2} />
            </div>

            <div className="hidden lg:flex flex-col justify-center h-full pt-16">
              <div className="text-muted-foreground text-2xl">→</div>
            </div>

            <div className="space-y-6">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">World Final</p>
              <MatchPair label="Final" fixture={data.final} />
            </div>
          </div>

          {!data.seeded && provisionalTop4.length > 0 && (
            <div className="rounded-xl border bg-card overflow-hidden max-w-md">
              <div className="px-4 py-3 border-b bg-muted/30">
                <p className="text-sm font-semibold">Current top 4 (not yet seeded)</p>
              </div>
              <div className="divide-y">
                {provisionalTop4.map((e) => (
                  <div key={e.competitorId} className="px-4 py-2.5 flex items-center gap-3">
                    <span className="text-sm font-bold text-yellow-600 dark:text-yellow-400 w-5 text-center">#{e.rank}</span>
                    <span className="text-sm font-medium flex-1 truncate">
                      {e.teamName}
                      {e.isPlayer && <Badge variant="outline" className="ml-2 text-[10px] py-0">You</Badge>}
                    </span>
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
