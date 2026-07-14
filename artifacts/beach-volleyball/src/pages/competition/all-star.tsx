import { useListMatches, useGetCurrentSeason } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Sparkles, CheckCircle2, Clock, AlertCircle } from "lucide-react";

const ALL_STAR_ROUND = 72;

export default function AllStar() {
  const { data: season } = useGetCurrentSeason();
  const { data: allMatches, isLoading, isError } = useListMatches();

  const allStarMatches = (allMatches ?? []).filter(
    m => typeof m.round === "number" && m.round === ALL_STAR_ROUND,
  );

  const match = allStarMatches[0] ?? null;
  const completed = match?.status === "completed";
  const homeWon =
    completed && match?.homeScore != null && match?.awayScore != null
      ? match.homeScore > match.awayScore
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">All-Star Match</h1>
        <p className="text-muted-foreground mt-1">
          Season showpiece — the best players from the World Tour in one exhibition match
        </p>
      </div>

      {season && (
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-medium">Season {season.year} All-Star</span>
          {completed && (
            <Badge className="ml-2 text-xs bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Completed
            </Badge>
          )}
        </div>
      )}

      {isLoading && <Skeleton className="h-64 w-full max-w-md rounded-xl" />}

      {isError && (
        <div className="flex items-center gap-2 text-destructive text-sm p-3 rounded-lg border border-destructive/30 bg-destructive/5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load All-Star match data.
        </div>
      )}

      {!isLoading && !isError && !match && (
        <div className="rounded-xl border bg-card p-8 text-center space-y-3 max-w-md">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mx-auto">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <h3 className="font-semibold">All-Star Match Not Yet Scheduled</h3>
          <p className="text-sm text-muted-foreground">
            The All-Star match takes place in Round 72, after the World Finals.
            Check back once the World Tour season is nearing completion.
          </p>
          <Badge variant="outline" className="text-xs gap-1">
            <Clock className="h-3 w-3" />
            Pending World Tour
          </Badge>
        </div>
      )}

      {!isLoading && !isError && match && (
        <div className="max-w-md space-y-4">
          <div className={cn(
            "rounded-xl border p-6 space-y-4",
            completed ? "bg-card" : "bg-muted/20",
          )}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                All-Star Exhibition
              </span>
              {completed ? (
                <Badge className="text-xs bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Final
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs gap-1">
                  <Clock className="h-3 w-3" />
                  Upcoming
                </Badge>
              )}
            </div>

            <div className="space-y-3">
              <div className={cn(
                "flex items-center justify-between text-lg",
                homeWon === true && "font-bold",
                homeWon === false && "opacity-50",
              )}>
                <span className="truncate flex-1">{match.homeTeamName ?? "TBD"}</span>
                {completed && (
                  <span className="text-3xl font-black tabular-nums ml-3">{match.homeScore}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-dashed border-border/60" />
                <span className="text-sm text-muted-foreground px-2 font-medium">vs</span>
                <div className="flex-1 border-t border-dashed border-border/60" />
              </div>
              <div className={cn(
                "flex items-center justify-between text-lg",
                homeWon === false && "font-bold",
                homeWon === true && "opacity-50",
              )}>
                <span className="truncate flex-1">{match.awayTeamName ?? "TBD"}</span>
                {completed && (
                  <span className="text-3xl font-black tabular-nums ml-3">{match.awayScore}</span>
                )}
              </div>
            </div>

            {completed && homeWon !== null && (
              <div className="pt-2 border-t text-center">
                <p className="text-sm text-muted-foreground">Winner</p>
                <p className="font-semibold mt-0.5">
                  {homeWon ? match.homeTeamName : match.awayTeamName}
                </p>
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">About the All-Star Match</p>
            <p>
              The All-Star match is an exhibition fixture celebrating the season's top performers.
              It takes place in the final round of the calendar. Results do not affect standings.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
