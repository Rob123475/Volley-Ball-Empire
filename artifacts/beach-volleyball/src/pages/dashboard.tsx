import { 
  useGetDashboard, 
  useGetCurrentSeason, 
  useGetSeasonLadder,
  useGetProfile,
  useUpdateProfile,
  getGetDashboardQueryKey,
  getGetCurrentSeasonQueryKey,
  getGetSeasonLadderQueryKey,
  getGetProfileQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Trophy, 
  DollarSign, 
  Users, 
  Calendar, 
  Award,
  ArrowUpRight,
  ArrowDownRight,
  User,
  Eye,
  EyeOff,
  Pencil,
  Check,
  X,
  KeyRound
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

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
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: dashboard, isLoading: dashLoading } = useGetDashboard({
    query: { queryKey: getGetDashboardQueryKey() }
  });
  const { data: season, isLoading: seasonLoading } = useGetCurrentSeason({
    query: { queryKey: getGetCurrentSeasonQueryKey() }
  });
  const { data: profile, isLoading: profileLoading } = useGetProfile({
    query: { queryKey: getGetProfileQueryKey() }
  });

  const seasonId = season?.id ?? 1;
  const { data: ladder } = useGetSeasonLadder(seasonId, {
    query: { 
      enabled: !!season,
      queryKey: getGetSeasonLadderQueryKey(seasonId)
    }
  });

  const updateProfile = useUpdateProfile();

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
        {/* Profile box */}
        <ProfileCard
          profile={profile}
          loading={profileLoading}
          onSave={(coachName, savePin) => {
            updateProfile.mutate(
              { data: { coachName, savePin } as any },
              {
                onSuccess: () => {
                  queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
                  toast({ title: "Profile saved!" });
                },
              }
            );
          }}
          saving={updateProfile.isPending}
        />

        <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20" data-testid="card-team-overview">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Team Overview</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate" data-testid="text-team-name">{team?.name ?? "—"}</div>
            <div className="flex items-center gap-2 mt-1 min-w-0">
              <span className="text-sm text-green-600 font-bold flex-shrink-0" data-testid="text-wins">{team?.wins ?? 0}W</span>
              <span className="text-sm text-red-600 font-bold flex-shrink-0" data-testid="text-losses">{team?.losses ?? 0}L</span>
              <Badge variant="outline" className="flex-shrink-0 ml-auto text-primary border-primary/30 whitespace-nowrap">
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

// ── Profile card ──────────────────────────────────────────────────────────────
function ProfileCard({ profile, loading, onSave, saving }: {
  profile: any;
  loading: boolean;
  onSave: (coachName: string, savePin: string) => void;
  saving: boolean;
}) {
  const [editingName, setEditingName] = useState(false);
  const [editingPin, setEditingPin]   = useState(false);
  const [nameVal, setNameVal]         = useState("");
  const [pinVal, setPinVal]           = useState("");
  const [pinVisible, setPinVisible]   = useState(false);

  const coachName = (profile as any)?.coachName ?? "";
  const savePin   = (profile as any)?.savePin   ?? "——————";
  const initials  = coachName
    ? coachName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : (profile?.teamName?.[0] ?? "C").toUpperCase();

  const startEditName = () => { setNameVal(coachName); setEditingName(true); };
  const startEditPin  = () => { setPinVal(savePin);    setEditingPin(true);  };

  const commitName = () => {
    onSave(nameVal.trim() || coachName, savePin);
    setEditingName(false);
  };
  const commitPin = () => {
    // Keep it to max 20 chars, strip spaces
    const cleaned = pinVal.replace(/\s/g, "").slice(0, 20);
    onSave(coachName, cleaned || savePin);
    setEditingPin(false);
  };

  return (
    <Card className="bg-gradient-to-br from-muted/60 to-transparent border-border" data-testid="card-profile">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium">My Profile</CardTitle>
        <User className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <>
            {/* Avatar + name row */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-black text-sm flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Coach Name</div>
                {editingName ? (
                  <div className="flex items-center gap-1">
                    <Input
                      autoFocus
                      value={nameVal}
                      onChange={e => setNameVal(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") commitName(); if (e.key === "Escape") setEditingName(false); }}
                      className="h-6 text-sm px-1 py-0"
                      maxLength={40}
                      data-testid="input-coach-name"
                    />
                    <button onClick={commitName} disabled={saving} className="text-green-600 hover:text-green-700"><Check className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setEditingName(false)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 group/name">
                    <span className="text-sm font-semibold truncate">{coachName || <span className="text-muted-foreground italic">Set name…</span>}</span>
                    <button onClick={startEditName} className="opacity-0 group-hover/name:opacity-100 transition-opacity ml-1 text-muted-foreground hover:text-foreground">
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Save PIN row */}
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <KeyRound className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Save Password</div>
                    {editingPin ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Input
                          autoFocus
                          value={pinVal}
                          onChange={e => setPinVal(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") commitPin(); if (e.key === "Escape") setEditingPin(false); }}
                          className="h-6 text-sm px-1 py-0 w-28 font-mono"
                          maxLength={20}
                          data-testid="input-save-pin"
                        />
                        <button onClick={commitPin} disabled={saving} className="text-green-600 hover:text-green-700"><Check className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setEditingPin(false)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 mt-0.5 group/pin">
                        <span className="font-mono text-sm font-bold tracking-widest">
                          {pinVisible ? savePin : "•".repeat(Math.min(savePin.length, 8))}
                        </span>
                        <button onClick={startEditPin} className="opacity-0 group-hover/pin:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setPinVisible(v => !v)}
                  className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-toggle-pin"
                >
                  {pinVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
