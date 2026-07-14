import { useGetCurrentSeason, useGetSeasonLadder } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Trophy, AlertCircle } from "lucide-react";

function rankBand(rank: number) {
  if (rank <= 4)  return { cls: "border-l-2 border-l-yellow-500 bg-yellow-500/5" };
  if (rank <= 8)  return { cls: "border-l-2 border-l-blue-500 bg-blue-500/5" };
  if (rank <= 12) return { cls: "border-l-2 border-l-muted-foreground/30" };
  return { cls: "border-l-2 border-l-muted-foreground/20 opacity-70" };
}

export default function WtLadder() {
  const { data: season, isLoading: seasonLoading } = useGetCurrentSeason();
  const seasonId = season?.id;
  // enabled: !!(id) is built into the generated hook when id is 0
  const { data: ladder, isLoading: ladderLoading, isError } = useGetSeasonLadder(seasonId ?? 0);

  const isLoading = seasonLoading || ladderLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">World Tour Standings</h1>
        <p className="text-muted-foreground mt-1">
          Accumulated points from WT rounds determine World Finals seeding
        </p>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-1 rounded-full bg-yellow-500" />
          Top 4 — World Finals
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-1 rounded-full bg-blue-500" />
          5–8 — Quarter-finals
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-1 rounded-full bg-muted-foreground" />
          9–12 — Round of 16
        </span>
      </div>

      {isLoading && (
        <div className="rounded-xl border bg-card overflow-hidden">
          {[...Array(18)].map((_, i) => <Skeleton key={i} className="h-11 w-full border-b" />)}
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 text-destructive text-sm p-3 rounded-lg border border-destructive/30 bg-destructive/5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load World Tour standings.
        </div>
      )}

      {!isLoading && !isError && !ladder?.length && (
        <div className="text-center py-16 text-muted-foreground">
          <Trophy className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No World Tour standings yet</p>
          <p className="text-sm mt-1 opacity-70">
            Standings appear once the World Tour begins after regional leagues.
          </p>
        </div>
      )}

      {!isLoading && !isError && (ladder?.length ?? 0) > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              <h3 className="font-semibold text-sm">
                Season {season?.year} — World Tour Ladder
              </h3>
            </div>
            <Badge variant="outline" className="text-xs">{ladder!.length} teams</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="h-8 px-3 text-center text-[10px] font-medium text-muted-foreground w-10">#</th>
                  <th className="h-8 px-3 text-left text-[10px] font-medium text-muted-foreground">Team</th>
                  <th className="h-8 px-2 text-center text-[10px] font-medium text-muted-foreground w-10">W</th>
                  <th className="h-8 px-2 text-center text-[10px] font-medium text-muted-foreground w-10">L</th>
                  <th className="h-8 px-2 text-center text-[10px] font-medium text-muted-foreground w-20 hidden md:table-cell">Goals +/−</th>
                  <th className="h-8 px-3 text-right text-[10px] font-medium text-muted-foreground w-14">Pts</th>
                </tr>
              </thead>
              <tbody>
                {ladder!.map((entry, idx) => {
                  const band = rankBand(entry.rank);
                  const isDivider = [4, 8, 12].includes(idx);
                  const dividerLabel =
                    idx === 4 ? "▲ World Finals (top 4)" :
                    idx === 8 ? "Quarter-finals (5–8)" :
                    "Round of 16 (9–12)";
                  return (
                    <>
                      {isDivider && (
                        <tr key={`div-${idx}`}>
                          <td colSpan={6} className="py-0">
                            <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-0.5 bg-muted/30 border-y border-border/60">
                              {dividerLabel}
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr
                        key={entry.teamId}
                        className={cn("border-b last:border-0 hover:bg-muted/30 transition-colors", band.cls)}
                      >
                        <td className="py-2.5 px-3 text-center">
                          <span className={cn(
                            "text-xs font-bold",
                            entry.rank <= 4 ? "text-yellow-600 dark:text-yellow-400" :
                            entry.rank <= 8 ? "text-blue-600 dark:text-blue-400" :
                            "text-muted-foreground",
                          )}>
                            {entry.rank}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-sm font-medium truncate max-w-[160px] block">{entry.teamName}</span>
                        </td>
                        <td className="py-2.5 px-2 text-center text-xs font-medium text-emerald-600 dark:text-emerald-400">{entry.wins}</td>
                        <td className="py-2.5 px-2 text-center text-xs font-medium text-red-500">{entry.losses}</td>
                        <td className="py-2.5 px-2 text-center text-xs text-muted-foreground hidden md:table-cell">
                          {entry.goalsFor} : {entry.goalsAgainst}
                        </td>
                        <td className="py-2.5 px-3 text-right text-sm font-bold">{entry.points}</td>
                      </tr>
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
