import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, AlertCircle } from "lucide-react";

const CONTINENTS = [
  "Europe", "Asia", "North America", "South America",
  "Africa and Middle East", "Australia and Pacific Islands",
] as const;

type RegionalFixture = {
  id: number;
  round: number;
  status: "scheduled" | "completed";
  homeTeamName: string;
  awayTeamName: string;
  homePoolTeamId: number;
  awayPoolTeamId: number;
  result: {
    winnerId: number;
    homeSets: number;
    awaySets: number;
    homeMatchPoints: number;
    awayMatchPoints: number;
  } | null;
};

type RegionalLeagueData = {
  season: { id: number; seasonYear: number; continent: string };
  fixtures: RegionalFixture[];
  ladder: unknown[];
};

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

function ResultRow({ fixture }: { fixture: RegionalFixture }) {
  if (!fixture.result) return null;
  const homeWon = fixture.result.homeSets > fixture.result.awaySets;

  return (
    <div className="flex items-center gap-3 py-3 px-4 border-b last:border-0 hover:bg-muted/30 transition-colors">
      <span className="text-xs text-muted-foreground w-16 shrink-0">Rd {fixture.round}</span>

      <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <span className={homeWon ? "font-semibold text-sm truncate" : "text-sm opacity-60 truncate"}>
          {fixture.homeTeamName}
        </span>
        <span className="text-sm font-bold tabular-nums text-center">
          {fixture.result.homeSets} – {fixture.result.awaySets}
        </span>
        <span className={!homeWon ? "font-semibold text-sm truncate text-right" : "text-sm opacity-60 truncate text-right"}>
          {fixture.awayTeamName}
        </span>
      </div>

      <div className="text-xs text-muted-foreground shrink-0 hidden md:block">
        {fixture.result.homeMatchPoints} / {fixture.result.awayMatchPoints} pts
      </div>
    </div>
  );
}

export default function RegionalResults() {
  const [continent, setContinent] = useState<string>(CONTINENTS[0]);
  const { data, isLoading, isError } = useRegionalLeague(continent);

  const completed = data
    ? data.fixtures.filter(f => f.status === "completed").sort((a, b) => b.round - a.round)
    : [];

  const rounds = Array.from(new Set(completed.map(f => f.round))).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Regional Results</h1>
        <p className="text-muted-foreground mt-1">Completed match results — continental ladders only</p>
      </div>

      <Select value={continent} onValueChange={setContinent}>
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CONTINENTS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>

      {isLoading && (
        <div className="rounded-lg border bg-card overflow-hidden">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full border-b" />)}
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 text-destructive text-sm p-3 rounded-lg border border-destructive/30 bg-destructive/5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load results for {continent}.
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {completed.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p>No completed matches in {continent} yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {rounds.map(round => {
                const roundFixtures = completed.filter(f => f.round === round);
                return (
                  <div key={round} className="rounded-lg border bg-card overflow-hidden">
                    <div className="px-4 py-2 bg-muted/30 border-b flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-sm font-medium">Round {round}</span>
                      <Badge variant="secondary" className="text-xs ml-auto">
                        {roundFixtures.length} match{roundFixtures.length !== 1 ? "es" : ""}
                      </Badge>
                    </div>
                    {roundFixtures.map(f => <ResultRow key={f.id} fixture={f} />)}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
