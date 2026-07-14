import { useState } from "react";
import { useListMatches, useGetCurrentSeason } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Globe, CheckCircle2, Clock, Calendar, AlertCircle } from "lucide-react";

const WT_ROUND_MIN = 11;
const WT_ROUND_MAX = 70;
const WT_ROUNDS = Array.from({ length: WT_ROUND_MAX - WT_ROUND_MIN + 1 }, (_, i) => i + WT_ROUND_MIN);

export default function WtFixtures() {
  const { data: season } = useGetCurrentSeason();
  const { data: allMatches, isLoading, isError } = useListMatches();

  const wtMatches = (allMatches ?? []).filter(
    m => typeof m.round === "number" && m.round >= WT_ROUND_MIN && m.round <= WT_ROUND_MAX,
  );

  const completedRounds = wtMatches
    .filter(m => m.status === "completed")
    .map(m => m.round as number);
  const currentRound = completedRounds.length > 0 ? Math.max(...completedRounds) : WT_ROUND_MIN;

  const [selectedRound, setSelectedRound] = useState<number>(currentRound);
  const [teamFilter, setTeamFilter] = useState("");

  const roundMatches = wtMatches
    .filter(m => m.round === selectedRound)
    .filter(m =>
      !teamFilter ||
      (m.homeTeamName ?? "").toLowerCase().includes(teamFilter.toLowerCase()) ||
      (m.awayTeamName ?? "").toLowerCase().includes(teamFilter.toLowerCase()),
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">World Tour Fixtures</h1>
        <p className="text-muted-foreground mt-1">
          Rounds 11–70 — 18 qualified teams compete in the international circuit
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={String(selectedRound)} onValueChange={v => setSelectedRound(Number(v))}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Round" />
          </SelectTrigger>
          <SelectContent className="max-h-64 overflow-auto">
            {WT_ROUNDS.map(r => (
              <SelectItem key={r} value={String(r)}>
                WT Round {r - 10} {r === currentRound ? "(current)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <input
          type="text"
          value={teamFilter}
          onChange={e => setTeamFilter(e.target.value)}
          placeholder="Filter by team…"
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-48"
        />
      </div>

      {season && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Globe className="h-4 w-4" />
          <span>Season {season.year} · WT Round {selectedRound - 10} of {WT_ROUND_MAX - WT_ROUND_MIN + 1}</span>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-lg" />)}
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 text-destructive text-sm p-3 rounded-lg border border-destructive/30 bg-destructive/5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load World Tour fixtures.
        </div>
      )}

      {!isLoading && !isError && roundMatches.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p>No matches found for WT Round {selectedRound - 10}.</p>
          <p className="text-xs mt-1 opacity-60">World Tour begins after regional leagues complete.</p>
        </div>
      )}

      {!isLoading && !isError && roundMatches.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {roundMatches.map(match => {
            const completed = match.status === "completed";
            const homeWon = completed && match.homeScore != null && match.awayScore != null
              ? match.homeScore > match.awayScore
              : null;

            return (
              <div
                key={match.id}
                className={cn(
                  "rounded-lg border p-4",
                  completed ? "bg-card" : "bg-muted/20 border-border/60",
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  {completed ? (
                    <Badge className="gap-1 text-xs bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
                      <CheckCircle2 className="h-3 w-3" />
                      Final
                    </Badge>
                  ) : selectedRound === currentRound ? (
                    <Badge className="gap-1 text-xs bg-primary/15 text-primary border-primary/30">
                      <Clock className="h-3 w-3" />
                      Current
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      Upcoming
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">WT Rd {selectedRound - 10}</span>
                </div>

                <div className="space-y-2">
                  <div className={cn(
                    "flex items-center justify-between",
                    homeWon === true && "font-semibold",
                    homeWon === false && "opacity-60",
                  )}>
                    <span className="text-sm truncate flex-1">{match.homeTeamName ?? "TBD"}</span>
                    {completed && <span className="text-lg font-bold tabular-nums ml-2">{match.homeScore}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 border-t border-dashed border-border/60" />
                    <span className="text-xs text-muted-foreground shrink-0">vs</span>
                    <div className="flex-1 border-t border-dashed border-border/60" />
                  </div>
                  <div className={cn(
                    "flex items-center justify-between",
                    homeWon === false && "font-semibold",
                    homeWon === true && "opacity-60",
                  )}>
                    <span className="text-sm truncate flex-1">{match.awayTeamName ?? "TBD"}</span>
                    {completed && <span className="text-lg font-bold tabular-nums ml-2">{match.awayScore}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
