import { CONTINENT_KEYS, continentLabel } from "@shared/continents";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Calendar, CheckCircle2, Clock, AlertCircle } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Driven by the canonical KEYS. Each of these screens used to declare its own
 * array of continent LABELS; the copies drifted, and any screen whose spelling
 * did not match the data silently rendered nothing for that region. Labels are
 * looked up at render time via continentLabel().
 */
const CONTINENTS = CONTINENT_KEYS;

type RegionalFixture = {
  id: number;
  round: number;
  status: "scheduled" | "completed";
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  result: {
    winnerId: number;
    homeSets: number;
    awaySets: number;
    homeMatchPoints: number;
    awayMatchPoints: number;
  } | null;
  homePoolTeamId: number;
  awayPoolTeamId: number;
};

type RegionalLeagueData = {
  season: { id: number; seasonYear: number; continent: string; status: string };
  fixtures: RegionalFixture[];
  ladder: Array<{ poolTeamId: number; teamName: string }>;
};

// ── Hook ──────────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function latestRound(fixtures: RegionalFixture[]): number {
  const completed = fixtures.filter(f => f.status === "completed");
  if (completed.length === 0) return 1;
  return Math.min(Math.max(...completed.map(f => f.round)), 10);
}

// ── Fixture card ──────────────────────────────────────────────────────────────

function FixtureCard({
  fixture,
  isCurrentRound,
  teamFilter,
}: {
  fixture: RegionalFixture;
  isCurrentRound: boolean;
  teamFilter: string;
}) {
  const matchesFilter =
    !teamFilter ||
    fixture.homeTeamName.toLowerCase().includes(teamFilter.toLowerCase()) ||
    fixture.awayTeamName.toLowerCase().includes(teamFilter.toLowerCase());

  if (!matchesFilter) return null;

  const completed = fixture.status === "completed";
  const homeWon = completed && fixture.result
    ? fixture.result.homeSets > fixture.result.awaySets
    : null;

  return (
    <div className={cn(
      "rounded-lg border p-4 transition-colors",
      completed
        ? "bg-card border-border"
        : isCurrentRound
          ? "bg-primary/5 border-primary/30"
          : "bg-muted/20 border-border/60 opacity-70",
    )}>
      {/* Status badge */}
      <div className="flex items-center justify-between mb-3">
        {completed ? (
          <Badge className="gap-1 text-xs bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            Final
          </Badge>
        ) : isCurrentRound ? (
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
        <span className="text-xs text-muted-foreground">Round {fixture.round}</span>
      </div>

      {/* Teams + Score */}
      <div className="space-y-2">
        {/* Home team */}
        <div className={cn(
          "flex items-center justify-between gap-2",
          homeWon === true && "font-semibold",
          homeWon === false && "opacity-60",
        )}>
          <span className="text-sm truncate flex-1">{fixture.homeTeamName}</span>
          {completed && fixture.result && (
            <span className="text-lg font-bold tabular-nums min-w-[20px] text-right">
              {fixture.result.homeSets}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 border-t border-dashed border-border/60" />
          <span className="text-xs text-muted-foreground shrink-0">vs</span>
          <div className="flex-1 border-t border-dashed border-border/60" />
        </div>
        {/* Away team */}
        <div className={cn(
          "flex items-center justify-between gap-2",
          homeWon === false && "font-semibold",
          homeWon === true && "opacity-60",
        )}>
          <span className="text-sm truncate flex-1">{fixture.awayTeamName}</span>
          {completed && fixture.result && (
            <span className="text-lg font-bold tabular-nums min-w-[20px] text-right">
              {fixture.result.awaySets}
            </span>
          )}
        </div>
      </div>

      {/* Match point details */}
      {completed && fixture.result && (
        <div className="mt-3 pt-2 border-t border-border/40 flex justify-between text-xs text-muted-foreground">
          <span>{fixture.result.homeMatchPoints} pts</span>
          <span className="font-medium text-foreground/60">Match Pts</span>
          <span>{fixture.result.awayMatchPoints} pts</span>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RegionalFixtures() {
  const [selectedContinent, setSelectedContinent] = useState<string>(CONTINENTS[0]);
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [teamFilter, setTeamFilter] = useState("");

  const { data, isLoading, isError } = useRegionalLeague(selectedContinent);

  const currentRound = data ? latestRound(data.fixtures) : 1;

  const roundFixtures = data
    ? data.fixtures.filter(f => f.round === selectedRound)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Regional Fixtures</h1>
        <p className="text-muted-foreground mt-1">
          Three matches per round for each continental league
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={selectedContinent} onValueChange={v => { setSelectedContinent(v); setSelectedRound(1); }}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Select continent" />
          </SelectTrigger>
          <SelectContent>
            {CONTINENTS.map(c => (
              <SelectItem key={c} value={c}>{continentLabel(c)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(selectedRound)} onValueChange={v => setSelectedRound(Number(v))}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Round" />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 10 }, (_, i) => i + 1).map(r => (
              <SelectItem key={r} value={String(r)}>
                Round {r} {r === currentRound ? "(current)" : ""}
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

      {/* Season info */}
      {data && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{continentLabel(data.season.continent)} — Season {data.season.seasonYear}</span>
          {selectedRound === currentRound && (
            <Badge variant="outline" className="text-xs ml-2">Current Round</Badge>
          )}
          {selectedRound < currentRound && (
            <Badge variant="outline" className="text-xs ml-2 text-muted-foreground">Past Round</Badge>
          )}
          {selectedRound > currentRound && (
            <Badge variant="outline" className="text-xs ml-2 text-muted-foreground">Upcoming Round</Badge>
          )}
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-lg" />)}
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 text-destructive text-sm p-3 rounded-lg border border-destructive/30 bg-destructive/5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load fixtures. The regional season may not have started yet.
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {roundFixtures.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p>No fixtures found for Round {selectedRound} in {continentLabel(selectedContinent)}.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {roundFixtures.map(fixture => (
                <FixtureCard
                  key={fixture.id}
                  fixture={fixture}
                  isCurrentRound={selectedRound === currentRound}
                  teamFilter={teamFilter}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
