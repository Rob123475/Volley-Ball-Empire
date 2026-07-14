import { useState } from "react";
import { useListMatches, useGetCurrentSeason } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle } from "lucide-react";

const WT_ROUND_MIN = 11;
const WT_ROUND_MAX = 70;

export default function WtResults() {
  const { data: season } = useGetCurrentSeason();
  const { data: allMatches, isLoading, isError } = useListMatches();

  const completed = (allMatches ?? [])
    .filter(
      m =>
        m.status === "completed" &&
        typeof m.round === "number" &&
        m.round >= WT_ROUND_MIN &&
        m.round <= WT_ROUND_MAX,
    )
    .sort((a, b) => (b.round as number) - (a.round as number));

  const [teamFilter, setTeamFilter] = useState("");

  const filtered = teamFilter
    ? completed.filter(
        m =>
          (m.homeTeamName ?? "").toLowerCase().includes(teamFilter.toLowerCase()) ||
          (m.awayTeamName ?? "").toLowerCase().includes(teamFilter.toLowerCase()),
      )
    : completed;

  const rounds = Array.from(new Set(filtered.map(m => m.round as number))).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">World Tour Results</h1>
        <p className="text-muted-foreground mt-1">
          Completed World Tour match results{season ? ` — Season ${season.year}` : ""}
        </p>
      </div>

      <input
        type="text"
        value={teamFilter}
        onChange={e => setTeamFilter(e.target.value)}
        placeholder="Filter by team…"
        className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-56"
      />

      {isLoading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-lg border bg-card overflow-hidden">
              <Skeleton className="h-8 w-full border-b" />
              {[...Array(3)].map((_, j) => <Skeleton key={j} className="h-12 w-full border-b" />)}
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 text-destructive text-sm p-3 rounded-lg border border-destructive/30 bg-destructive/5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load World Tour results.
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle2 className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p>No completed World Tour matches yet.</p>
          <p className="text-xs mt-1 opacity-60">Results appear once regional leagues finish.</p>
        </div>
      )}

      {!isLoading && !isError && rounds.length > 0 && (
        <div className="space-y-4">
          {rounds.map(round => {
            const roundMatches = filtered.filter(m => m.round === round);
            return (
              <div key={round} className="rounded-lg border bg-card overflow-hidden">
                <div className="px-4 py-2.5 bg-muted/30 border-b flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-sm font-medium">WT Round {round - 10}</span>
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {roundMatches.length} match{roundMatches.length !== 1 ? "es" : ""}
                  </Badge>
                </div>
                {roundMatches.map(match => {
                  const homeWon =
                    match.homeScore != null && match.awayScore != null
                      ? match.homeScore > match.awayScore
                      : null;
                  return (
                    <div
                      key={match.id}
                      className="flex items-center gap-3 py-3 px-4 border-b last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <span className={homeWon === true ? "font-semibold text-sm truncate" : "text-sm opacity-60 truncate"}>
                          {match.homeTeamName ?? "TBD"}
                        </span>
                        <span className="text-sm font-bold tabular-nums text-center">
                          {match.homeScore} – {match.awayScore}
                        </span>
                        <span className={homeWon === false ? "font-semibold text-sm truncate text-right" : "text-sm opacity-60 truncate text-right"}>
                          {match.awayTeamName ?? "TBD"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
