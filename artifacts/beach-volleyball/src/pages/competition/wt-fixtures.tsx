import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGetCurrentSeason } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useCalendar } from "@/hooks/use-calendar";
import { Globe, CheckCircle2, Calendar, AlertCircle, Moon } from "lucide-react";

const FIRST_ROUND = 11;   // first World Tour slot
const LAST_WT_ROUND = 70; // last regular World Tour slot
const FINALS = [71, 72];  // 71 = semi finals, 72 = World Final

function roundLabel(round: number, eventRounds: readonly number[]) {
  if (round === 71) return "World Semi Finals";
  if (round === 72) return "World Final";
  const index = eventRounds.indexOf(round);
  return index >= 0 ? `WT Round ${index + 1}` : `Slot ${round} (open date)`;
}

type Side = { competitorId: number; name: string; isPlayer: boolean; seed: number | null };
type Fixture = {
  id: number;
  round: number;
  tier: string;
  status: string;
  bye: boolean;
  home: Side;
  away: Side;
  homeSets: number | null;
  awaySets: number | null;
  sets: { home: number; away: number }[] | null;
  winnerCompetitorId: number | null;
};
type RoundData = {
  seasonYear: number;
  round: number;
  drawn: boolean;
  fieldSize: number | null;
  fixtures: Fixture[];
  resting: { competitorId: number; name: string }[];
  eventRounds: number[];
  isEventRound: boolean;
};

/**
 * R-29: every fixture of a World Tour round, for the whole field.
 * R-44: the field is 19 clubs, so each round has a bye — shown as a Bye card for
 * the club that rests, never as a club that is simply missing. The round list
 * comes from the server's schedule (57 event rounds), so an open date is never
 * offered.
 */
export default function WtFixtures() {
  const { data: season } = useGetCurrentSeason();
  const { calendar } = useCalendar();
  const calendarRound = Math.min(72, Math.max(FIRST_ROUND, calendar?.scheduleSlot ?? FIRST_ROUND));

  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const round = selectedRound ?? calendarRound;
  useEffect(() => { setSelectedRound(null); }, [season?.year]);

  const [teamFilter, setTeamFilter] = useState("");

  const { data, isLoading, isError } = useQuery<RoundData>({
    queryKey: ["world-tour-fixtures", season?.year, round],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/world-tour/fixtures?round=${round}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!season,
  });

  const eventRounds = data?.eventRounds ?? [];
  // Land on the first event round at or after the calendar, not on an open date.
  useEffect(() => {
    if (selectedRound == null && eventRounds.length > 0 && round <= LAST_WT_ROUND && !eventRounds.includes(round)) {
      setSelectedRound(eventRounds.find((r) => r >= round) ?? FINALS[0]!);
    }
  }, [eventRounds, round, selectedRound]);

  const selectable = [...eventRounds, ...FINALS];
  const fixtures = (data?.fixtures ?? []).filter((f) =>
    !teamFilter ||
    f.home.name.toLowerCase().includes(teamFilter.toLowerCase()) ||
    f.away.name.toLowerCase().includes(teamFilter.toLowerCase()),
  );
  const matchCount = fixtures.filter((f) => !f.bye).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">World Tour Fixtures</h1>
        <p className="text-muted-foreground mt-1">
          {data?.drawn && data.fieldSize
            ? `${eventRounds.length} World Tour rounds, then the World Finals — ${data.fieldSize} clubs: ${data.fieldSize - 1} regional qualifiers and your club, one bye each round`
            : "The World Tour field is drawn once the regional leagues finish after round 10."}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={String(round)} onValueChange={(v) => setSelectedRound(Number(v))}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Round" />
          </SelectTrigger>
          <SelectContent className="max-h-64 overflow-auto">
            {selectable.map((r) => (
              <SelectItem key={r} value={String(r)}>
                {roundLabel(r, eventRounds)} {r === calendarRound ? "(current)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <input
          type="text"
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          placeholder="Filter by club…"
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-48"
        />
      </div>

      {season && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Globe className="h-4 w-4" />
          <span>
            Season {season.year} · {roundLabel(round, eventRounds)}
            {eventRounds.includes(round) ? ` of ${eventRounds.length}` : ""}
          </span>
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

      {!isLoading && !isError && fixtures.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p>No fixtures for {roundLabel(round, eventRounds)} yet.</p>
          <p className="text-xs mt-1 opacity-60">
            {!data?.drawn
              ? "The draw is made when the regional leagues finish."
              : round > LAST_WT_ROUND
                ? "The World Finals are seeded from the standings once the last World Tour round is complete."
                : "No club matches that filter."}
          </p>
        </div>
      )}

      {!isLoading && !isError && fixtures.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">
            {matchCount} match{matchCount === 1 ? "" : "es"}
            {fixtures.some((f) => f.bye) ? " · 1 bye" : ""}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {fixtures.map((f) => {
              if (f.bye) {
                return (
                  <div
                    key={f.id}
                    data-testid={`wt-bye-${f.home.competitorId}`}
                    className={cn(
                      "rounded-lg border border-dashed p-4 bg-muted/10",
                      f.home.isPlayer && "border-primary/50",
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                        <Moon className="h-3 w-3" />
                        Bye
                      </Badge>
                      <span className="text-xs text-muted-foreground">{f.tier}</span>
                    </div>
                    <div className="text-sm font-medium">
                      {f.home.name}
                      {f.home.isPlayer && <Badge variant="outline" className="ml-2 text-[10px] py-0">You</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Rests this round — no match, 0 ranking points</p>
                  </div>
                );
              }

              const completed = f.status === "completed";
              const involvesPlayer = f.home.isPlayer || f.away.isPlayer;
              const sideRow = (side: Side, sets: number | null) => {
                const won = completed && f.winnerCompetitorId === side.competitorId;
                const lost = completed && !won;
                return (
                  <div className={cn("flex items-center justify-between", won && "font-semibold", lost && "opacity-60")}>
                    <span className="text-sm truncate flex-1">
                      {side.seed != null && <span className="text-xs text-muted-foreground mr-1">#{side.seed}</span>}
                      {side.name}
                      {side.isPlayer && <Badge variant="outline" className="ml-2 text-[10px] py-0">You</Badge>}
                    </span>
                    {completed && <span className="text-lg font-bold tabular-nums ml-2">{sets}</span>}
                  </div>
                );
              };

              return (
                <div
                  key={f.id}
                  className={cn(
                    "rounded-lg border p-4",
                    completed ? "bg-card" : "bg-muted/20 border-border/60",
                    involvesPlayer && "border-primary/50",
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    {completed ? (
                      <Badge className="gap-1 text-xs bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3" />
                        Final
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Upcoming
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{f.tier}</span>
                  </div>

                  <div className="space-y-2">
                    {sideRow(f.home, f.homeSets)}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 border-t border-dashed border-border/60" />
                      <span className="text-xs text-muted-foreground shrink-0">vs</span>
                      <div className="flex-1 border-t border-dashed border-border/60" />
                    </div>
                    {sideRow(f.away, f.awaySets)}
                  </div>

                  {completed && f.sets && f.sets.length > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-3 tabular-nums">
                      {f.sets.map((s) => `${s.home}–${s.away}`).join(" · ")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
