import { 
  useGetDashboard, 
  useGetCurrentSeason, 
  useGetSeasonLadder,
  getGetDashboardQueryKey,
  getGetCurrentSeasonQueryKey,
  getGetSeasonLadderQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Trophy, 
  DollarSign, 
  Users, 
  Calendar, 
  Award,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const weatherIcons: Record<string, string> = {
  sunny: "☀️",
  windy: "💨",
  stormy: "⛈️",
  hot: "🔥",
  cloudy: "☁️",
  overcast: "⛅",
  perfect: "✨",
};

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ");
}

export default function Dashboard() {
  const { data: dashboard, isLoading: dashLoading } = useGetDashboard({
    query: { queryKey: getGetDashboardQueryKey() }
  });

  const { data: season, isLoading: seasonLoading } = useGetCurrentSeason({
    query: { queryKey: getGetCurrentSeasonQueryKey() }
  });

  const seasonId = season?.id ?? 1;
  const { data: ladder } = useGetSeasonLadder(seasonId, {
    query: { 
      enabled: !!season,
      queryKey: getGetSeasonLadderQueryKey(seasonId)
    }
  });

  if (dashLoading || seasonLoading) {
    return <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
    </div>;
  }

  const formatCurrency = (val: number | null | undefined) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val ?? 0);

  const team = dashboard?.team;
  const financeSummary = dashboard?.financeSummary;
  const monthlyNet = financeSummary?.monthlyNet ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Welcome back, Coach. Here's your team status.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20" data-testid="card-team-overview">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Team Overview</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-team-name">{team?.name ?? "—"}</div>
            <div className="flex gap-4 mt-1">
              <span className="text-sm text-green-600 font-bold" data-testid="text-wins">{team?.wins ?? 0}W</span>
              <span className="text-sm text-red-600 font-bold" data-testid="text-losses">{team?.losses ?? 0}L</span>
              <Badge variant="outline" className="ml-auto text-primary border-primary/30">
                Rep: {team?.reputation ?? 50}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-secondary/10 to-transparent border-secondary/20" data-testid="card-budget">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Budget</CardTitle>
            <DollarSign className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-balance">{formatCurrency(financeSummary?.balance)}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              {monthlyNet >= 0 ? (
                <ArrowUpRight className="h-3 w-3 text-green-500" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-500" />
              )}
              {formatCurrency(Math.abs(monthlyNet))} net monthly
            </p>
          </CardContent>
        </Card>

        {dashboard?.nextMatch && (
          <Card className="bg-gradient-to-br from-accent/10 to-transparent border-accent/20" data-testid="card-next-match">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Next Match</CardTitle>
              <Calendar className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{weatherIcons[(dashboard.nextMatch as any).weather] || "☀️"}</span>
                <div className="text-lg font-bold truncate">{(dashboard.nextMatch as any).locationName ?? "TBD"}</div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Prize: <span className="font-semibold text-foreground">{formatCurrency((dashboard.nextMatch as any).prizeAmount)}</span>
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20" data-testid="card-season-standing">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Season Standing</CardTitle>
            <Award className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-rank">
              {dashboard?.seasonStanding ? `Rank #${dashboard.seasonStanding.rank}` : "Unranked"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {dashboard?.seasonStanding?.points ?? 0} Points • {season?.name ?? "Season 1"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Top Players</CardTitle>
            <CardDescription>Performance leaders in your squad.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboard?.topPlayers.map((player) => {
              const rating = Math.round((player.power + player.speed + player.defense + player.serve + player.block) / 5);
              return (
                <div key={player.id} className="flex items-center gap-4" data-testid={`row-player-${player.id}`}>
                  <Badge variant="secondary" className="bg-secondary/20 text-secondary-foreground">
                    {player.position.replace(/_/g, " ")}
                  </Badge>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">{player.name}</p>
                    <div className="flex items-center gap-2">
                      <Progress value={rating} className="h-1" />
                      <span className="text-xs text-muted-foreground w-6" data-testid={`text-rating-${player.id}`}>{rating}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {(!dashboard?.topPlayers || dashboard.topPlayers.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No players in your squad yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent Results</CardTitle>
            <CardDescription>Your last appearances.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboard?.recentResults.map((match) => {
              const hs = match.homeScore ?? 0;
              const as_ = match.awayScore ?? 0;
              const isWin = hs > as_;
              return (
                <div key={match.id} data-testid={`row-match-${match.id}`} className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{match.awayTeamName ?? "Opponent"}</span>
                    <span className="text-xs text-muted-foreground">{match.locationName ?? "Beach"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold">{hs} – {as_}</span>
                    <Badge className={isWin ? 'bg-green-500' : 'bg-red-500'}>
                      {isWin ? "WIN" : "LOSS"}
                    </Badge>
                  </div>
                </div>
              );
            })}
            {(!dashboard?.recentResults || dashboard.recentResults.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No matches played yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {ladder && ladder.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Season Ladder</CardTitle>
            <CardDescription>{season?.name} - World Rankings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="h-10 px-2 text-left font-medium text-muted-foreground">Rank</th>
                    <th className="h-10 px-2 text-left font-medium text-muted-foreground">Team</th>
                    <th className="h-10 px-2 text-left font-medium text-muted-foreground">Wins</th>
                    <th className="h-10 px-2 text-left font-medium text-muted-foreground">Losses</th>
                    <th className="h-10 px-2 text-right font-medium text-muted-foreground">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {ladder.map((entry) => (
                    <tr 
                      key={entry.teamId} 
                      data-testid={`row-ladder-${entry.teamId}`}
                      className={cn(
                        "border-b transition-colors hover:bg-muted/50",
                        entry.teamName === team?.name ? "bg-primary/5 border-l-4 border-l-primary" : undefined
                      )}
                    >
                      <td className="p-2 font-medium">#{entry.rank}</td>
                      <td className="p-2">{entry.teamName}</td>
                      <td className="p-2 text-green-600 font-semibold">{entry.wins}</td>
                      <td className="p-2 text-red-600 font-semibold">{entry.losses}</td>
                      <td className="p-2 text-right font-bold">{entry.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
