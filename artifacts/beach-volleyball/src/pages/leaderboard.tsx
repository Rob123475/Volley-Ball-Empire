import { 
  useGetLeaderboard,
  getGetLeaderboardQueryKey,
  getGetDashboardQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Trophy, Medal, Star, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetDashboard } from "@workspace/api-client-react";

export default function Leaderboard() {
  const { data: dashboard } = useGetDashboard({
    query: { queryKey: getGetDashboardQueryKey() }
  });
  
  const { data: rankings, isLoading } = useGetLeaderboard({
    query: { queryKey: getGetLeaderboardQueryKey() }
  });

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-48" /><Skeleton className="h-[500px] w-full" /></div>;
  }

  const getMedal = (rank: number) => {
    if (rank === 1) return <Medal className="h-5 w-5 text-yellow-500 fill-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400 fill-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600 fill-amber-600" />;
    return <span className="text-muted-foreground font-bold">#{rank}</span>;
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
          <Trophy className="h-8 w-8 text-secondary" />
          Global Leaderboard
        </h2>
        <p className="text-muted-foreground">The best beach volleyball teams in the world.</p>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-20">Rank</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead className="text-center">Wins</TableHead>
                <TableHead className="text-center">Losses</TableHead>
                <TableHead className="text-center">Win Rate</TableHead>
                <TableHead className="text-right">Reputation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankings?.map((entry) => {
                const isUser = entry.teamName === dashboard?.team?.name;
                const winRate = entry.wins + entry.losses > 0 
                  ? Math.round((entry.wins / (entry.wins + entry.losses)) * 100) 
                  : 0;

                return (
                  <TableRow 
                    key={entry.rank} 
                    className={cn(
                      "transition-colors",
                      isUser && "bg-primary/5 border-l-4 border-l-primary shadow-[inset_0_0_20px_rgba(0,119,182,0.05)]"
                    )}
                  >
                    <TableCell className="font-bold">{getMedal(entry.rank)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{entry.teamName}</span>
                        {isUser && <Badge variant="secondary" className="text-[10px] h-4">MY TEAM</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{entry.username ?? "—"}</TableCell>
                    <TableCell className="text-center font-semibold text-green-600">{entry.wins}</TableCell>
                    <TableCell className="text-center font-semibold text-red-600">{entry.losses}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs font-bold">{winRate}%</span>
                        <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${winRate}%` }} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 font-black text-primary">
                        <Star className="h-3 w-3 fill-current" />
                        {entry.reputation}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-yellow-500/10 to-transparent border-yellow-500/20">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-yellow-600">Top Prospect</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-lg font-bold">World Series Finals</div>
            <p className="text-xs text-muted-foreground">Qualification ends in 12 days</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-primary">Rising Stars</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-lg font-bold">Reputation Bonus</div>
            <p className="text-xs text-muted-foreground">Next tier at 2,500 REP</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-secondary/10 to-transparent border-secondary/20">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-secondary">Global Tour</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-lg font-bold">128 Teams Active</div>
            <p className="text-xs text-muted-foreground">In 10 world locations</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
