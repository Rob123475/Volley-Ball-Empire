import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Crown, DollarSign, Flame, Medal, Star, Trophy, TrendingUp, Users } from "lucide-react";

/**
 * Overnight 30 Sep item 1: Career > Records is the MANAGER's own record: every
 * match she has managed, her titles, her best finish, season by season. It
 * used to open the club's Trophy Cabinet (Club Honours), which lives under
 * Club.
 */
type ManagerRecords = {
  managerName: string | null; clubs: string[];
  seasonsCompleted: number; matches: number; wins: number; losses: number; winRate: number;
  bestStreak: number; currentStreak: number;
  worldFinalsWon: number; goldEventsWon: number; perfectSeasons: number; olympicGolds: number;
  prizeMoneyWon: number; bestFinish: number | null;
  youthSigned: number; youthPromoted: number; hallOfFameInductions: number; highestBalance: number;
  seasons: { seasonYear: number; clubName: string; leaguePosition: number | null; wins: number; losses: number; worldResult: string | null }[];
};

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const ordinal = (n: number) => {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${n}${teen ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;
};

function Row({ icon: Icon, label, value, colour }: { icon: any; label: string; value: string | number; colour: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className={`h-4 w-4 ${colour}`} />{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export default function ManagerRecords() {
  const { data: r, isLoading } = useQuery<ManagerRecords>({
    queryKey: ["manager-records"],
    queryFn: () => fetch("/api/history/records").then((res) => res.json()),
  });
  if (isLoading || !r) return <Skeleton className="h-96 w-full rounded-2xl" />;
  return (
    <div className="space-y-5" data-testid="manager-records">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-primary">Manager Records</h2>
        <p className="text-muted-foreground text-sm">
          {r.managerName ?? "Your"} record as a manager{r.clubs.length > 0 ? `, at ${r.clubs.join(" and ")}` : ""}. The club's own honours are in Club &gt; Trophy Cabinet.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-500" /> Matches</CardTitle>
            <CardDescription>Every match you have managed</CardDescription>
          </CardHeader>
          <CardContent>
            <Row icon={Users} label="Matches managed" value={r.matches} colour="text-sky-500" />
            <Row icon={Star} label="Won - lost" value={`${r.wins} - ${r.losses}`} colour="text-green-500" />
            <Row icon={TrendingUp} label="Win rate" value={`${r.winRate}%`} colour="text-emerald-500" />
            <Row icon={Flame} label="Best winning streak" value={`${r.bestStreak} in a row`} colour="text-orange-500" />
            <Row icon={Flame} label="Current streak" value={`${r.currentStreak} in a row`} colour="text-orange-400" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4 text-yellow-500" /> Titles and seasons</CardTitle>
            <CardDescription>What you have won, and for how long</CardDescription>
          </CardHeader>
          <CardContent>
            <Row icon={Calendar} label="Seasons completed" value={r.seasonsCompleted} colour="text-blue-500" />
            <Row icon={Crown} label="Best season finish" value={r.bestFinish != null ? ordinal(r.bestFinish) : "No season finished yet"} colour="text-violet-500" />
            <Row icon={Trophy} label="World Finals won" value={r.worldFinalsWon} colour="text-yellow-500" />
            <Row icon={Medal} label="Gold events won" value={r.goldEventsWon} colour="text-amber-500" />
            <Row icon={Star} label="Unbeaten seasons" value={r.perfectSeasons} colour="text-pink-500" />
            <Row icon={Medal} label="Olympic golds (your players)" value={r.olympicGolds} colour="text-yellow-400" />
            <Row icon={DollarSign} label="Prize money won" value={money(r.prizeMoneyWon)} colour="text-emerald-500" />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Season by season</CardTitle></CardHeader>
        <CardContent>
          {r.seasons.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Your first season is still under way.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground"><th className="py-1">Season</th><th>Club</th><th>Finish</th><th>W-L</th><th>World</th></tr></thead>
              <tbody>
                {r.seasons.map((s) => (
                  <tr key={`${s.seasonYear}-${s.clubName}`} className="border-t border-border/50">
                    <td className="py-1.5">{s.seasonYear}</td><td>{s.clubName}</td>
                    <td>{s.leaguePosition != null ? ordinal(s.leaguePosition) : "-"}</td>
                    <td className="tabular-nums">{s.wins}-{s.losses}</td><td>{s.worldResult ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
