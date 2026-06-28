import {
  useGetCurrentSeason,
  getGetCurrentSeasonQueryKey,
  useGetSeasonLadder,
  getGetSeasonLadderQueryKey,
  useGetYouthLadder,
  getGetYouthLadderQueryKey,
  useGetMyTeam,
  getGetMyTeamQueryKey,
} from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function teamInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return name.slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function teamColor(name: string): string {
  const COLORS = [
    "bg-rose-500",    "bg-orange-500", "bg-amber-500",  "bg-yellow-500",
    "bg-lime-500",    "bg-green-500",  "bg-emerald-500","bg-teal-500",
    "bg-cyan-500",    "bg-sky-500",    "bg-blue-500",   "bg-indigo-500",
    "bg-violet-500",  "bg-purple-500", "bg-fuchsia-500","bg-pink-500",
  ];
  const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return COLORS[hash % COLORS.length];
}

function mockForm(name: string, wins: number, losses: number): ("W" | "L")[] {
  const total = wins + losses;
  if (total === 0) return ["L", "L", "L", "L", "L"];
  const winRate = wins / total;
  let seed = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) + wins * 7 + losses * 13;
  return Array.from({ length: 5 }, () => {
    seed = ((seed * 1103515245) + 12345) & 0x7fffffff;
    return (seed / 0x7fffffff) < winRate ? "W" : "L";
  });
}

function rankDisplay(rank: number) {
  if (rank === 1) return <span className="text-lg leading-none">🥇</span>;
  if (rank === 2) return <span className="text-lg leading-none">🥈</span>;
  if (rank === 3) return <span className="text-lg leading-none">🥉</span>;
  return <span className="font-bold text-muted-foreground text-sm">#{rank}</span>;
}

function bandClass(rank: number): string {
  if (rank <= 4) return "border-l-2 border-l-green-500 bg-green-500/5";
  if (rank <= 16) return "border-l-2 border-l-blue-500 bg-blue-500/5";
  return "border-l-2 border-l-amber-500/40 bg-amber-500/5";
}

function BandLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground mb-4">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-1 rounded-full bg-green-500" />
        Top 4 — World Finals
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-1 rounded-full bg-blue-500" />
        Positions 5–16 — Continental
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-1 rounded-full bg-amber-500/60" />
        Remaining — Standard ranking
      </span>
    </div>
  );
}

// ── Seniors Ladder ────────────────────────────────────────────────────────────

function SeniorsLadder({ myTeamName }: { myTeamName: string }) {
  const { data: season, isLoading: seasonLoading } = useGetCurrentSeason({
    query: { queryKey: getGetCurrentSeasonQueryKey() },
  });
  const seasonId = season?.id ?? 0;
  const { data: rawLadder, isLoading: ladderLoading } = useGetSeasonLadder(seasonId, {
    query: { enabled: !!season, queryKey: getGetSeasonLadderQueryKey(seasonId) },
  });

  if (seasonLoading || ladderLoading) {
    return <div className="space-y-2">{[...Array(10)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  }

  if (!rawLadder || rawLadder.length === 0) {
    return <p className="text-muted-foreground text-sm">No ladder data available.</p>;
  }

  const ladder = [...rawLadder]
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const aDiff = (a.goalsFor ?? 0) - (a.goalsAgainst ?? 0);
      const bDiff = (b.goalsFor ?? 0) - (b.goalsAgainst ?? 0);
      return bDiff - aDiff;
    })
    .map((e, i) => ({ ...e, rank: i + 1 }));

  return (
    <div>
      <BandLegend />
      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="h-9 px-2 text-left font-medium text-muted-foreground w-10">Rank</th>
              <th className="h-9 px-2 text-left font-medium text-muted-foreground w-8"></th>
              <th className="h-9 px-2 text-left font-medium text-muted-foreground">Club</th>
              <th className="h-9 px-2 text-center font-medium text-muted-foreground w-12 hidden sm:table-cell">P</th>
              <th className="h-9 px-2 text-center font-medium text-muted-foreground w-12">W</th>
              <th className="h-9 px-2 text-center font-medium text-muted-foreground w-12">L</th>
              <th className="h-9 px-2 text-center font-medium text-muted-foreground w-16 hidden md:table-cell">+/−</th>
              <th className="h-9 px-2 text-right font-medium text-muted-foreground w-12">Pts</th>
              <th className="h-9 px-2 text-center font-medium text-muted-foreground w-28 hidden lg:table-cell">Form</th>
            </tr>
          </thead>
          <tbody>
            {ladder.map((entry) => {
              const isMe = entry.teamName === myTeamName;
              const played = entry.wins + entry.losses;
              const setDiff = (entry.goalsFor ?? 0) - (entry.goalsAgainst ?? 0);
              const form = mockForm(entry.teamName, entry.wins, entry.losses);
              const initials = teamInitials(entry.teamName);
              const color = teamColor(entry.teamName);
              return (
                <tr
                  key={entry.teamId}
                  className={cn(
                    "border-b last:border-0 transition-colors",
                    bandClass(entry.rank),
                    isMe && "font-semibold"
                  )}
                >
                  <td className="px-2 py-2">{rankDisplay(entry.rank)}</td>
                  <td className="px-1 py-2">
                    <div className={cn("h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0", color)}>
                      {initials}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <span>{entry.teamName}</span>
                    {isMe && <Badge variant="outline" className="ml-2 text-[10px] py-0">You</Badge>}
                  </td>
                  <td className="px-2 py-2 text-center text-muted-foreground hidden sm:table-cell">{played}</td>
                  <td className="px-2 py-2 text-center text-emerald-600 font-semibold">{entry.wins}</td>
                  <td className="px-2 py-2 text-center text-red-500 font-semibold">{entry.losses}</td>
                  <td className={cn("px-2 py-2 text-center hidden md:table-cell", setDiff > 0 ? "text-emerald-600" : setDiff < 0 ? "text-red-500" : "text-muted-foreground")}>
                    {setDiff > 0 ? `+${setDiff}` : setDiff}
                  </td>
                  <td className="px-2 py-2 text-right font-bold">{entry.points}</td>
                  <td className="px-2 py-2 hidden lg:table-cell">
                    <div className="flex items-center justify-center gap-0.5">
                      {form.map((r, i) => (
                        <span
                          key={i}
                          className={cn(
                            "inline-flex items-center justify-center h-5 w-5 rounded text-[10px] font-bold",
                            r === "W" ? "bg-emerald-500/20 text-emerald-600" : "bg-red-500/15 text-red-500"
                          )}
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Youth Ladder ──────────────────────────────────────────────────────────────

function YouthLadder() {
  const { data: rawLadder, isLoading } = useGetYouthLadder({
    query: { queryKey: getGetYouthLadderQueryKey() },
  });

  if (isLoading) {
    return <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  }

  if (!rawLadder || rawLadder.length === 0) {
    return <p className="text-muted-foreground text-sm">No youth ladder data available.</p>;
  }

  const ladder = [...rawLadder]
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const aDiff = a.wins - a.losses;
      const bDiff = b.wins - b.losses;
      return bDiff - aDiff;
    })
    .map((e, i) => ({ ...e, rank: i + 1 }));

  return (
    <div>
      <BandLegend />
      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="h-9 px-2 text-left font-medium text-muted-foreground w-10">Rank</th>
              <th className="h-9 px-2 text-left font-medium text-muted-foreground w-8"></th>
              <th className="h-9 px-2 text-left font-medium text-muted-foreground">Club</th>
              <th className="h-9 px-2 text-center font-medium text-muted-foreground w-12 hidden sm:table-cell">P</th>
              <th className="h-9 px-2 text-center font-medium text-muted-foreground w-12">W</th>
              <th className="h-9 px-2 text-center font-medium text-muted-foreground w-12">L</th>
              <th className="h-9 px-2 text-right font-medium text-muted-foreground w-12">Pts</th>
              <th className="h-9 px-2 text-center font-medium text-muted-foreground w-28 hidden lg:table-cell">Form</th>
            </tr>
          </thead>
          <tbody>
            {ladder.map((entry) => {
              const played = entry.wins + entry.losses;
              const form = mockForm(entry.competitorName, entry.wins, entry.losses);
              const initials = teamInitials(entry.competitorName);
              const color = teamColor(entry.competitorName);
              return (
                <tr
                  key={entry.id}
                  className={cn(
                    "border-b last:border-0 transition-colors",
                    bandClass(entry.rank),
                    entry.isPlayer && "font-semibold"
                  )}
                >
                  <td className="px-2 py-2">{rankDisplay(entry.rank)}</td>
                  <td className="px-1 py-2">
                    <div className={cn("h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0", color)}>
                      {initials}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <span>{entry.competitorName}</span>
                    {entry.isPlayer && <Badge variant="outline" className="ml-2 text-[10px] py-0">You</Badge>}
                  </td>
                  <td className="px-2 py-2 text-center text-muted-foreground hidden sm:table-cell">{played}</td>
                  <td className="px-2 py-2 text-center text-emerald-600 font-semibold">{entry.wins}</td>
                  <td className="px-2 py-2 text-center text-red-500 font-semibold">{entry.losses}</td>
                  <td className="px-2 py-2 text-right font-bold">{entry.points}</td>
                  <td className="px-2 py-2 hidden lg:table-cell">
                    <div className="flex items-center justify-center gap-0.5">
                      {form.map((r, i) => (
                        <span
                          key={i}
                          className={cn(
                            "inline-flex items-center justify-center h-5 w-5 rounded text-[10px] font-bold",
                            r === "W" ? "bg-emerald-500/20 text-emerald-600" : "bg-red-500/15 text-red-500"
                          )}
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LeagueLadders() {
  const { data: team } = useGetMyTeam({
    query: { queryKey: getGetMyTeamQueryKey() },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
          League Ladders
        </h2>
        <p className="text-muted-foreground mt-1">
          Full standings for all competitions — season rankings and qualification zones.
        </p>
      </div>

      <Tabs defaultValue="seniors">
        <TabsList className="mb-4">
          <TabsTrigger value="seniors">Seniors</TabsTrigger>
          <TabsTrigger value="youth">Youth</TabsTrigger>
        </TabsList>

        <TabsContent value="seniors">
          <SeniorsLadder myTeamName={team?.name ?? ""} />
        </TabsContent>

        <TabsContent value="youth">
          <YouthLadder />
        </TabsContent>
      </Tabs>
    </div>
  );
}
