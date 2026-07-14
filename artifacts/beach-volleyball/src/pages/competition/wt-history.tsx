import { useListHistorySeasons, useGetHistoryStandings } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, Trophy, AlertCircle } from "lucide-react";

function SeasonRow({ seasonId, year }: { seasonId: number; year: number }) {
  const { data: standings, isLoading } = useGetHistoryStandings(seasonId);
  const top3 = standings?.seniors?.slice(0, 3) ?? [];

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-500" />
          <h3 className="font-semibold text-sm">Season {year}</h3>
        </div>
        <Badge variant="secondary" className="text-xs">World Tour Final</Badge>
      </div>
      {isLoading ? (
        <div className="p-4 space-y-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
      ) : top3.length === 0 ? (
        <div className="px-4 py-3 text-sm text-muted-foreground italic">No standings available</div>
      ) : (
        <div className="divide-y">
          {top3.map((entry, idx) => (
            <div key={idx} className="px-4 py-2.5 flex items-center gap-3">
              <span className="text-lg w-7 text-center shrink-0">
                {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
              </span>
              <span className="text-sm font-medium flex-1 truncate">{entry.competitorName}</span>
              <span className="text-xs text-muted-foreground">{entry.points} pts</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WtHistory() {
  const { data: seasons, isLoading, isError } = useListHistorySeasons();

  const completedSeasons = (seasons ?? [])
    .filter(s => s.status === "completed")
    .sort((a, b) => b.year - a.year);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">World Tour History</h1>
        <p className="text-muted-foreground mt-1">
          Champions and podium finishes from past World Tour seasons
        </p>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 text-destructive text-sm p-3 rounded-lg border border-destructive/30 bg-destructive/5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load history.
        </div>
      )}

      {!isLoading && !isError && completedSeasons.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No completed seasons yet</p>
          <p className="text-sm mt-1 opacity-70">
            History appears here after the first World Tour season concludes.
          </p>
        </div>
      )}

      {!isLoading && !isError && completedSeasons.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {completedSeasons.map(s => (
            <SeasonRow key={s.id} seasonId={s.id} year={s.year} />
          ))}
        </div>
      )}
    </div>
  );
}
