import { useState } from "react";
import {
  useGetCurrentSeason,
  getGetCurrentSeasonQueryKey,
  useGetSeasonLadder,
  getGetSeasonLadderQueryKey,
  useGetYouthLadder,
  getGetYouthLadderQueryKey,
  useGetMyTeam,
  getGetMyTeamQueryKey,
  useListHistorySeasons,
  getListHistorySeasonsQueryKey,
  useGetHistoryStandings,
  getGetHistoryStandingsQueryKey,
  useGetHistorySeasonSummary,
  getGetHistorySeasonSummaryQueryKey,
  useGetHistoryRecords,
  getGetHistoryRecordsQueryKey,
  useGetHistoryManagerSeasons,
  getGetHistoryManagerSeasonsQueryKey,
  useGetHistoryHallOfFame,
  getGetHistoryHallOfFameQueryKey,
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

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-primary">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
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

// ── History: Season Archive ───────────────────────────────────────────────────

function HistoryStandingsTable({
  rows,
  cols,
}: {
  rows: { rank: number; name: string; isPlayer: boolean; wins: number; losses: number; points: number; setDiff?: number }[];
  cols: { key: string; label: string }[];
}) {
  if (rows.length === 0) return null;
  return (
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
            {cols.map((c) => (
              <th key={c.key} className="h-9 px-2 text-center font-medium text-muted-foreground w-16 hidden md:table-cell">{c.label}</th>
            ))}
            <th className="h-9 px-2 text-right font-medium text-muted-foreground w-12">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((entry) => {
            const initials = teamInitials(entry.name);
            const color = teamColor(entry.name);
            return (
              <tr
                key={entry.rank}
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
                  <span>{entry.name}</span>
                  {entry.isPlayer && <Badge variant="outline" className="ml-2 text-[10px] py-0">You</Badge>}
                </td>
                <td className="px-2 py-2 text-center text-muted-foreground hidden sm:table-cell">{entry.wins + entry.losses}</td>
                <td className="px-2 py-2 text-center text-emerald-600 font-semibold">{entry.wins}</td>
                <td className="px-2 py-2 text-center text-red-500 font-semibold">{entry.losses}</td>
                {cols.map((c) => (
                  <td key={c.key} className={cn(
                    "px-2 py-2 text-center hidden md:table-cell",
                    c.key === "setDiff"
                      ? (entry.setDiff ?? 0) > 0 ? "text-emerald-600" : (entry.setDiff ?? 0) < 0 ? "text-red-500" : "text-muted-foreground"
                      : "text-muted-foreground"
                  )}>
                    {c.key === "setDiff"
                      ? ((entry.setDiff ?? 0) > 0 ? `+${entry.setDiff}` : entry.setDiff)
                      : (entry as Record<string, unknown>)[c.key] as string}
                  </td>
                ))}
                <td className="px-2 py-2 text-right font-bold">{entry.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SeasonChampionsPodium({ year }: { year: number }) {
  const { data: summary, isLoading } = useGetHistorySeasonSummary(year, {
    query: { queryKey: getGetHistorySeasonSummaryQueryKey(year) },
  });

  if (isLoading) return <div className="space-y-2"><Skeleton className="h-24 w-full" /></div>;
  if (!summary) return null;

  const hasTrophies = summary.trophies.length > 0;
  const hasAnyResult = summary.worldResult || summary.continentalResult || summary.youthResult;

  if (!hasTrophies && !hasAnyResult) return null;

  const worldBadge = (result: string | null | undefined) => {
    if (!result) return null;
    const isChamp = result.includes("World Champion");
    const isRunner = result.includes("Runner Up");
    const isThird = result.includes("3rd");
    const isFourth = result.includes("4th");
    return (
      <div className={cn(
        "flex flex-col items-center gap-1 rounded-xl p-4 border",
        isChamp ? "bg-yellow-500/10 border-yellow-500/30" :
        isRunner ? "bg-slate-400/10 border-slate-400/30" :
        isThird  ? "bg-orange-400/10 border-orange-400/30" :
        isFourth ? "bg-blue-400/10 border-blue-400/30" :
        "bg-muted/50 border-border"
      )}>
        <span className="text-3xl">{isChamp ? "🏆" : isRunner ? "🥈" : isThird ? "🥉" : isFourth ? "🏅" : "🎽"}</span>
        <span className="text-xs font-semibold text-center leading-tight">{result}</span>
        <span className="text-xs text-muted-foreground">Senior World Series</span>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {worldBadge(summary.worldResult)}
        {summary.continentalResult && (
          <div className="flex flex-col items-center gap-1 rounded-xl p-4 border bg-violet-500/10 border-violet-500/30">
            <span className="text-3xl">🌍</span>
            <span className="text-xs font-semibold text-center">{summary.continentalResult}</span>
            <span className="text-xs text-muted-foreground">Continental Championship</span>
          </div>
        )}
        {summary.youthResult && (
          <div className="flex flex-col items-center gap-1 rounded-xl p-4 border bg-emerald-500/10 border-emerald-500/30">
            <span className="text-3xl">{summary.youthResult.includes("Champion") ? "🏆" : "🌱"}</span>
            <span className="text-xs font-semibold text-center">{summary.youthResult}</span>
            <span className="text-xs text-muted-foreground">Youth World Series</span>
          </div>
        )}
      </div>
      {summary.wins > 0 && (
        <div className="flex gap-6 text-sm text-muted-foreground px-1">
          <span>W <span className="font-semibold text-emerald-600">{summary.wins}</span></span>
          <span>L <span className="font-semibold text-red-500">{summary.losses}</span></span>
          {summary.leaguePosition && <span>Final Position <span className="font-semibold text-foreground">#{summary.leaguePosition}</span></span>}
          {summary.budgetSnapshot != null && (
            <span>Budget <span className="font-semibold text-foreground">${(summary.budgetSnapshot / 1_000_000).toFixed(1)}M</span></span>
          )}
        </div>
      )}
      {summary.trophies.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {summary.trophies.map((t, i) => (
            <Badge key={i} variant="secondary" className="gap-1">
              {t.type === "world_championship" ? "🏆" :
               t.type === "continental_championship" ? "🌍" :
               t.type === "olympic_gold" ? "🥇" :
               t.type === "runner_up" ? "🥈" :
               t.type === "bronze" ? "🥉" : "🏅"}
              {t.name}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function HistorySeasonArchive() {
  const { data: seasons, isLoading: seasonsLoading } = useListHistorySeasons({
    query: { queryKey: getListHistorySeasonsQueryKey() },
  });

  const completed = seasons?.filter((s) => s.status === "completed") ?? [];
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const activeYear = selectedYear ?? completed[completed.length - 1]?.year ?? null;

  const { data: standings, isLoading: standingsLoading } = useGetHistoryStandings(
    activeYear ?? 0,
    { query: { enabled: !!activeYear, queryKey: getGetHistoryStandingsQueryKey(activeYear ?? 0) } },
  );

  if (seasonsLoading) {
    return <div className="space-y-3"><Skeleton className="h-10 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (completed.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-2xl mb-2">📅</p>
        <p className="font-medium">No completed seasons yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Season history is captured automatically when the World Final is played.
        </p>
      </div>
    );
  }

  const seniorRows = standings?.seniors.map((r) => ({
    rank: r.rank,
    name: r.competitorName,
    isPlayer: r.isPlayer,
    wins: r.wins,
    losses: r.losses,
    points: r.points,
    setDiff: r.setDiff,
  })) ?? [];

  const youthRows = standings?.youth.map((r) => ({
    rank: r.rank,
    name: r.teamName,
    isPlayer: r.isPlayer,
    wins: r.wins,
    losses: r.losses,
    points: r.points,
  })) ?? [];

  return (
    <div className="space-y-6">
      {/* Season selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {completed.map((s) => (
          <button
            key={s.year}
            onClick={() => setSelectedYear(s.year)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors",
              activeYear === s.year
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:border-primary/50 hover:bg-muted/50"
            )}
          >
            {s.year}
          </button>
        ))}
      </div>

      {activeYear && (
        <div className="space-y-6">
          {/* Season results / champions */}
          <div>
            <SectionHeader title={`${activeYear} Season Results`} />
            <SeasonChampionsPodium year={activeYear} />
          </div>

          {/* Final standings */}
          {standingsLoading ? (
            <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <>
              {/* Senior */}
              <div>
                <SectionHeader title="Senior World Beach Pro Series — Final Standings" />
                {standings?.hasSnapshot && seniorRows.length > 0 ? (
                  <>
                    <BandLegend />
                    <HistoryStandingsTable
                      rows={seniorRows}
                      cols={[{ key: "setDiff", label: "+/−" }]}
                    />
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Final standings are captured at the end of each World Final going forward. No snapshot exists for {activeYear}.
                  </div>
                )}
              </div>

              {/* Youth */}
              <div>
                <SectionHeader title="Youth World Beach Pro Series — Final Standings" />
                {youthRows.length > 0 ? (
                  <>
                    <BandLegend />
                    <HistoryStandingsTable
                      rows={youthRows}
                      cols={[]}
                    />
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No youth standings recorded for {activeYear}.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── History: Career Records ───────────────────────────────────────────────────

function HistoryRecords() {
  const { data: records, isLoading } = useGetHistoryRecords({
    query: { queryKey: getGetHistoryRecordsQueryKey() },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }

  if (!records) return null;

  const totalMatches = records.totalWins + records.totalLosses;
  const winPct = totalMatches > 0 ? `${records.winRate}%` : "—";

  const stats = [
    { label: "World Championships", value: records.worldChampionships, sub: "All-time titles" },
    { label: "Continental Titles", value: records.continentalTitles, sub: "All-time" },
    { label: "Olympic Golds", value: records.olympicGolds, sub: "Career" },
    { label: "Seasons Completed", value: records.seasonsCompleted, sub: "World Finals played" },
    { label: "Perfect Seasons", value: records.perfectSeasons, sub: "Zero losses" },
    { label: "Best Win Streak", value: records.bestStreak, sub: "Consecutive wins" },
    { label: "Win Rate", value: winPct, sub: `${records.totalWins}W – ${records.totalLosses}L` },
    { label: "Peak Balance", value: `$${(records.highestBalance / 1_000_000).toFixed(1)}M`, sub: "Highest ever" },
    { label: "Total Wins", value: records.totalWins, sub: "All competitions" },
    { label: "Total Losses", value: records.totalLosses, sub: "All competitions" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} sub={s.sub} />
        ))}
      </div>
      {totalMatches === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Records accumulate as you play matches and complete seasons.
        </p>
      )}
    </div>
  );
}

// ── History: Manager History ──────────────────────────────────────────────────

function HistoryManagerSeasons() {
  const { data: rows, isLoading } = useGetHistoryManagerSeasons({
    query: { queryKey: getGetHistoryManagerSeasonsQueryKey() },
  });

  if (isLoading) {
    return <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-2xl mb-2">📊</p>
        <p className="font-medium">No season history yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Your per-season stats are recorded automatically when the World Final is simulated.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="h-9 px-3 text-left font-medium text-muted-foreground">Season</th>
            <th className="h-9 px-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Club</th>
            <th className="h-9 px-3 text-center font-medium text-muted-foreground">Pos</th>
            <th className="h-9 px-3 text-center font-medium text-muted-foreground">W</th>
            <th className="h-9 px-3 text-center font-medium text-muted-foreground">L</th>
            <th className="h-9 px-3 text-left font-medium text-muted-foreground hidden md:table-cell">World</th>
            <th className="h-9 px-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Continental</th>
            <th className="h-9 px-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Youth</th>
            <th className="h-9 px-3 text-right font-medium text-muted-foreground hidden xl:table-cell">Budget</th>
          </tr>
        </thead>
        <tbody>
          {[...rows].reverse().map((row) => (
            <tr key={row.seasonYear} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
              <td className="px-3 py-2.5 font-semibold">{row.seasonYear}</td>
              <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">{row.clubName}</td>
              <td className="px-3 py-2.5 text-center">
                {row.leaguePosition != null
                  ? <span className={cn("font-medium", row.leaguePosition <= 4 && "text-emerald-600")}>#{row.leaguePosition}</span>
                  : <span className="text-muted-foreground">—</span>}
              </td>
              <td className="px-3 py-2.5 text-center text-emerald-600 font-semibold">{row.wins}</td>
              <td className="px-3 py-2.5 text-center text-red-500 font-semibold">{row.losses}</td>
              <td className="px-3 py-2.5 hidden md:table-cell">
                {row.worldResult
                  ? <span className={cn("text-xs font-medium", row.worldResult.includes("Champion") && "text-yellow-600")}>{row.worldResult}</span>
                  : <span className="text-muted-foreground text-xs">—</span>}
              </td>
              <td className="px-3 py-2.5 hidden lg:table-cell">
                {row.continentalResult
                  ? <span className="text-xs text-violet-600 font-medium">{row.continentalResult}</span>
                  : <span className="text-muted-foreground text-xs">—</span>}
              </td>
              <td className="px-3 py-2.5 hidden lg:table-cell">
                {row.youthResult
                  ? <span className="text-xs text-emerald-600 font-medium">{row.youthResult}</span>
                  : <span className="text-muted-foreground text-xs">—</span>}
              </td>
              <td className="px-3 py-2.5 text-right text-muted-foreground hidden xl:table-cell">
                {row.budgetSnapshot != null ? `$${(row.budgetSnapshot / 1_000_000).toFixed(1)}M` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── History: Hall of Fame ─────────────────────────────────────────────────────

function HistoryHallOfFame() {
  const { data: hof, isLoading } = useGetHistoryHallOfFame({
    query: { queryKey: getGetHistoryHallOfFameQueryKey() },
  });

  if (isLoading) {
    return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32" />)}</div>;
  }

  const hasPlayers = hof?.players && hof.players.length > 0;
  const hasManagers = hof?.managerEntries && hof.managerEntries.length > 0;

  if (!hasPlayers && !hasManagers) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-3xl mb-2">🌟</p>
        <p className="font-medium">Hall of Fame awaits</p>
        <p className="text-sm text-muted-foreground mt-1">
          Legendary players who retire from your club are inducted here. Build a dynasty to fill these halls.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {hasPlayers && (
        <div>
          <SectionHeader title="Player Hall of Fame" description="Legendary players who defined the club" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {hof!.players.map((p) => (
              <div key={p.id} className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0",
                    teamColor(p.name)
                  )}>
                    {teamInitials(p.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{p.position} · {p.retiredSeason}</p>
                  </div>
                  <span className="text-2xl shrink-0">⭐</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-primary">{p.peakRating}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Peak OVR</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-yellow-600">{p.worldTitles}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Titles</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-emerald-600">{p.careerWins}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Club Wins</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasManagers && (
        <div>
          <SectionHeader title="Manager Hall of Fame" description="Greatest managers in club history" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {hof!.managerEntries.map((m, i) => (
              <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-lg shrink-0">
                    👩‍💼
                  </div>
                  <div>
                    <p className="font-semibold">{m.managerName}</p>
                    <p className="text-xs text-muted-foreground">{m.clubName} · {m.season}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-yellow-600">{m.worldTitles}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Titles</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-amber-500">{m.olympicMedals}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Olympic</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-emerald-600">{m.totalWins}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Wins</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-red-500">{m.totalLosses}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Losses</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── History & Records Tab ─────────────────────────────────────────────────────

function HistoryAndRecords() {
  return (
    <div className="space-y-10">
      {/* Season Archive */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">📅</span>
          <h3 className="text-xl font-bold">Season Archive</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Final standings and results for every completed season.
        </p>
        <HistorySeasonArchive />
      </section>

      <div className="border-t" />

      {/* Career Records */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">📈</span>
          <h3 className="text-xl font-bold">Career Records</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          All-time statistics and milestones across your entire career.
        </p>
        <HistoryRecords />
      </section>

      <div className="border-t" />

      {/* Manager History */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">📋</span>
          <h3 className="text-xl font-bold">Manager History</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Your season-by-season results as a manager.
        </p>
        <HistoryManagerSeasons />
      </section>

      <div className="border-t" />

      {/* Hall of Fame */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">🌟</span>
          <h3 className="text-xl font-bold">Hall of Fame</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Legends who left their mark on the club.
        </p>
        <HistoryHallOfFame />
      </section>
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
          Full standings for all competitions — season rankings, qualification zones, and career history.
        </p>
      </div>

      <Tabs defaultValue="seniors">
        <TabsList className="mb-4">
          <TabsTrigger value="seniors">Seniors</TabsTrigger>
          <TabsTrigger value="youth">Youth</TabsTrigger>
          <TabsTrigger value="history">History & Records</TabsTrigger>
        </TabsList>

        <TabsContent value="seniors">
          <SeniorsLadder myTeamName={team?.name ?? ""} />
        </TabsContent>

        <TabsContent value="youth">
          <YouthLadder />
        </TabsContent>

        <TabsContent value="history">
          <HistoryAndRecords />
        </TabsContent>
      </Tabs>
    </div>
  );
}
