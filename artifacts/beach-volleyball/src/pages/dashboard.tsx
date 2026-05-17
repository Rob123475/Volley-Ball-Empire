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
  KeyRound,
  TrendingUp,
  HeartPulse,
  Star,
  Swords,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const weatherIcons: Record<string, string> = {
  sunny: "☀️", windy: "💨", stormy: "⛈️", hot: "🔥", cloudy: "☁️", overcast: "⛅", perfect: "✨",
};

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ");
}

// ── Stat Pill ──────────────────────────────────────────────────────────────────
function StatPill({
  icon,
  label,
  value,
  sub,
  gradient,
  iconBg,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  gradient: string;
  iconBg: string;
}) {
  return (
    <div className={`flex items-center gap-4 rounded-2xl px-5 py-4 ${gradient} shadow-md`}>
      <div className={`flex-shrink-0 h-11 w-11 rounded-xl flex items-center justify-center ${iconBg} shadow-inner`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-0.5">{label}</div>
        <div className="text-2xl font-black text-white leading-none truncate">{value}</div>
        {sub && <div className="text-xs text-white/60 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
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
    query: { enabled: !!season, queryKey: getGetSeasonLadderQueryKey(seasonId) }
  });

  const updateProfile = useUpdateProfile();

  if (dashLoading || seasonLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const formatCurrency = (val: number | null | undefined) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val ?? 0);

  const team = dashboard?.team;
  const financeSummary = dashboard?.financeSummary;
  const monthlyNet = financeSummary?.monthlyNet ?? 0;

  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Welcome back, Coach. Here's your team status.</p>
      </div>

      {/* ── Top pill row ── */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* W/L record */}
        <StatPill
          gradient="bg-gradient-to-br from-blue-400 to-blue-600"
          iconBg="bg-blue-300/40"
          icon={<Swords className="h-5 w-5 text-white" />}
          label="Record"
          value={<span>{team?.wins ?? 0}<span className="text-white/40 text-lg font-bold mx-1">-</span>{team?.losses ?? 0}</span>}
          sub={`Rep: ${team?.reputation ?? 50}`}
        />

        {/* Season rank */}
        <StatPill
          gradient="bg-gradient-to-br from-violet-400 to-purple-600"
          iconBg="bg-violet-300/40"
          icon={<Award className="h-5 w-5 text-white" />}
          label="Season Rank"
          value={dashboard?.seasonStanding ? `#${dashboard.seasonStanding.rank}` : "—"}
          sub={`${dashboard?.seasonStanding?.points ?? 0} pts · ${season?.name ?? "Season 1"}`}
        />

        {/* Titles won */}
        <StatPill
          gradient="bg-gradient-to-br from-amber-300 to-orange-400"
          iconBg="bg-amber-200/40"
          icon={<Trophy className="h-5 w-5 text-white" />}
          label="Titles Won"
          value={team?.titlesWon ?? 0}
          sub="Championship titles"
        />

        {/* Injuries */}
        <StatPill
          gradient={
            (dashboard?.injuredCount ?? 0) > 0
              ? "bg-gradient-to-br from-red-400 to-rose-600"
              : "bg-gradient-to-br from-emerald-400 to-teal-500"
          }
          iconBg={
            (dashboard?.injuredCount ?? 0) > 0 ? "bg-red-300/40" : "bg-emerald-200/40"
          }
          icon={<HeartPulse className="h-5 w-5 text-white" />}
          label="Injuries"
          value={dashboard?.injuredCount ?? 0}
          sub={(dashboard?.injuredCount ?? 0) === 0 ? "All players fit" : "Player(s) injured"}
        />
      </div>

      {/* ── Second pill row ── */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Profile */}
        <div className="sm:col-span-2 lg:col-span-1">
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
        </div>

        {/* Budget */}
        <StatPill
          gradient="bg-gradient-to-br from-green-400 to-emerald-600"
          iconBg="bg-green-200/40"
          icon={<DollarSign className="h-5 w-5 text-white" />}
          label="Budget"
          value={formatCurrency(financeSummary?.balance)}
          sub={
            <span className="flex items-center gap-0.5">
              {monthlyNet >= 0
                ? <ArrowUpRight className="h-3 w-3 text-green-300 inline" />
                : <ArrowDownRight className="h-3 w-3 text-red-300 inline" />
              }
              {formatCurrency(Math.abs(monthlyNet))} monthly
            </span>
          }
        />

        {/* Next match */}
        {dashboard?.nextMatch ? (
          <StatPill
            gradient="bg-gradient-to-br from-sky-300 to-cyan-500"
            iconBg="bg-sky-200/40"
            icon={<Calendar className="h-5 w-5 text-white" />}
            label="Next Match"
            value={
              <span className="flex items-center gap-2">
                <span className="text-xl">{weatherIcons[(dashboard.nextMatch as any).weather] || "☀️"}</span>
                <span className="text-lg font-bold truncate">{(dashboard.nextMatch as any).locationName ?? "TBD"}</span>
              </span>
            }
            sub={`Prize: ${formatCurrency((dashboard.nextMatch as any).prizeAmount)}`}
          />
        ) : (
          <StatPill
            gradient="bg-gradient-to-br from-slate-400 to-slate-600"
            iconBg="bg-slate-300/40"
            icon={<Calendar className="h-5 w-5 text-white/50" />}
            label="Next Match"
            value={<span className="text-white/40 text-base">Not scheduled</span>}
          />
        )}

        {/* Reputation pill */}
        <StatPill
          gradient="bg-gradient-to-br from-pink-400 to-fuchsia-600"
          iconBg="bg-pink-200/40"
          icon={<Star className="h-5 w-5 text-white" />}
          label="Reputation"
          value={team?.reputation ?? 50}
          sub={
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full bg-white/70 rounded-full transition-all" style={{ width: `${team?.reputation ?? 50}%` }} />
              </div>
              <span className="text-[10px] text-white/50">/ 100</span>
            </div>
          }
        />
      </div>

      {/* ── Players + Results ── */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Top Players</CardTitle>
            <CardDescription>Performance leaders in your squad.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboard?.topPlayers.map((player) => {
              const rating = Math.round((player.power + player.speed + player.defense + player.serve + player.block) / 5);
              const isInjured = (player as any).isInjured;
              return (
                <div key={player.id} className="flex items-center gap-4" data-testid={`row-player-${player.id}`}>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "flex-shrink-0",
                      isInjured ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400" : "bg-secondary/20 text-secondary-foreground"
                    )}
                  >
                    {isInjured ? "⚕ Injured" : player.position.replace(/_/g, " ")}
                  </Badge>
                  <div className="flex-1 space-y-1 min-w-0">
                    <p className="text-sm font-medium leading-none">{player.name}</p>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={rating}
                        className={cn("h-1.5", isInjured ? "[&>div]:bg-red-500" : "")}
                      />
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
                    <Badge className={isWin ? 'bg-green-500 hover:bg-green-500' : 'bg-red-500 hover:bg-red-500'}>
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

      {/* ── Season Ladder ── */}
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

  const commitName = () => { onSave(nameVal.trim() || coachName, savePin); setEditingName(false); };
  const commitPin  = () => {
    const cleaned = pinVal.replace(/\s/g, "").slice(0, 20);
    onSave(coachName, cleaned || savePin);
    setEditingPin(false);
  };

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-500 to-slate-700 shadow-md px-5 py-4 h-full flex flex-col justify-center" data-testid="card-profile">
      {loading ? (
        <Skeleton className="h-16 w-full bg-white/10" />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-indigo-500 flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-inner">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-0.5">Coach</div>
              {editingName ? (
                <div className="flex items-center gap-1">
                  <Input autoFocus value={nameVal} onChange={e => setNameVal(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") commitName(); if (e.key === "Escape") setEditingName(false); }}
                    className="h-6 text-sm px-1 py-0 bg-white/10 border-white/20 text-white" maxLength={40} data-testid="input-coach-name" />
                  <button onClick={commitName} disabled={saving} className="text-green-400 hover:text-green-300"><Check className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setEditingName(false)} className="text-white/40 hover:text-white"><X className="h-3.5 w-3.5" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-1 group/name">
                  <span className="text-sm font-semibold truncate text-white">{coachName || <span className="text-white/30 italic text-xs">Set name…</span>}</span>
                  <button onClick={startEditName} className="opacity-0 group-hover/name:opacity-100 transition-opacity ml-1 text-white/40 hover:text-white">
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <KeyRound className="h-3.5 w-3.5 text-white/40 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Password</div>
                  {editingPin ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Input autoFocus value={pinVal} onChange={e => setPinVal(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") commitPin(); if (e.key === "Escape") setEditingPin(false); }}
                        className="h-6 text-sm px-1 py-0 w-28 font-mono bg-white/10 border-white/20 text-white" maxLength={20} data-testid="input-save-pin" />
                      <button onClick={commitPin} disabled={saving} className="text-green-400 hover:text-green-300"><Check className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setEditingPin(false)} className="text-white/40 hover:text-white"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mt-0.5 group/pin">
                      <span className="font-mono text-sm font-bold tracking-widest text-white">
                        {pinVisible ? savePin : "•".repeat(Math.min(savePin.length, 8))}
                      </span>
                      <button onClick={startEditPin} className="opacity-0 group-hover/pin:opacity-100 transition-opacity text-white/40 hover:text-white">
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <button onClick={() => setPinVisible(v => !v)} className="flex-shrink-0 text-white/40 hover:text-white transition-colors" data-testid="button-toggle-pin">
                {pinVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
