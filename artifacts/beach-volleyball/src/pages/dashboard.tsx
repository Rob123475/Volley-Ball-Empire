import {
  useGetDashboard,
  useGetCurrentSeason,
  useGetSeasonLadder,
  useGetProfile,
  useUpdateProfile,
  useGetClubRating,
  useGetAttentionItems,
  getGetDashboardQueryKey,
  getGetCurrentSeasonQueryKey,
  getGetSeasonLadderQueryKey,
  getGetProfileQueryKey,
  getGetClubRatingQueryKey,
  getGetAttentionItemsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayerStatusBadge } from "@/components/player-status-badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Trophy,
  DollarSign,
  Calendar,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  EyeOff,
  Pencil,
  Check,
  X,
  KeyRound,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  HeartPulse,
  Flame,
  MapPin,
  ChevronRight,
  Building2,
  Shield,
  Swords,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type { AttentionItem } from "@workspace/api-client-react";

const weatherIcons: Record<string, string> = {
  sunny: "☀️", windy: "💨", stormy: "⛈️", hot: "🔥", cloudy: "☁️", overcast: "⛅", perfect: "✨",
};

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ");
}

const REP_LEVELS = [
  { name: "Local Coach",       min: 0,    next: 100,  colour: "text-slate-300"  },
  { name: "Regional Coach",    min: 100,  next: 300,  colour: "text-blue-300"   },
  { name: "National Coach",    min: 300,  next: 700,  colour: "text-violet-300" },
  { name: "World Class Coach", min: 700,  next: 1500, colour: "text-amber-300"  },
  { name: "Legend",            min: 1500, next: null, colour: "text-yellow-300" },
];

function getRepLevel(pts: number) {
  return REP_LEVELS.slice().reverse().find(l => pts >= l.min) ?? REP_LEVELS[0]!;
}

// ── Hero stat tile ─────────────────────────────────────────────────────────────
function HeroStat({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-1 bg-white/5 hover:bg-white/10 transition-colors backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10">
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/40">
        {icon}
        {label}
      </div>
      <div className={cn("text-xl font-black text-white leading-none", accent)}>{value}</div>
      {sub && <div className="text-[11px] text-white/50 mt-0.5 leading-tight">{sub}</div>}
    </div>
  );
}

// ── Decorative beach court SVG overlay ────────────────────────────────────────
function BeachCourtDecor() {
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none"
      viewBox="0 0 800 400"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Court outline */}
      <rect x="80" y="60" width="640" height="280" rx="4" fill="none" stroke="white" strokeWidth="3" />
      {/* Centre net */}
      <line x1="400" y1="60" x2="400" y2="340" stroke="white" strokeWidth="3" />
      {/* Net posts */}
      <line x1="400" y1="40" x2="400" y2="60" stroke="white" strokeWidth="5" />
      {/* Court service lines */}
      <line x1="80" y1="200" x2="740" y2="200" stroke="white" strokeWidth="1.5" strokeDasharray="8 6" />
      <line x1="240" y1="60" x2="240" y2="340" stroke="white" strokeWidth="1" strokeDasharray="6 5" />
      <line x1="560" y1="60" x2="560" y2="340" stroke="white" strokeWidth="1" strokeDasharray="6 5" />
      {/* Volleyball */}
      <circle cx="620" cy="120" r="28" fill="none" stroke="white" strokeWidth="2" />
      <path d="M594 108 Q620 92 646 108" fill="none" stroke="white" strokeWidth="1.5" />
      <path d="M594 132 Q620 148 646 132" fill="none" stroke="white" strokeWidth="1.5" />
      <line x1="620" y1="92" x2="620" y2="148" stroke="white" strokeWidth="1.5" />
      {/* Sand texture dots */}
      {[...Array(40)].map((_, i) => (
        <circle
          key={i}
          cx={100 + (i % 10) * 65}
          cy={300 + Math.floor(i / 10) * 12}
          r="1.5"
          fill="white"
          opacity="0.6"
        />
      ))}
    </svg>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: dashboard, isLoading: dashLoading } = useGetDashboard({
    query: { queryKey: getGetDashboardQueryKey() },
  });
  const { data: season, isLoading: seasonLoading } = useGetCurrentSeason({
    query: { queryKey: getGetCurrentSeasonQueryKey() },
  });
  const { data: profile, isLoading: profileLoading } = useGetProfile({
    query: { queryKey: getGetProfileQueryKey() },
  });

  const seasonId = season?.id ?? 1;
  const { data: ladder } = useGetSeasonLadder(seasonId, {
    query: { enabled: !!season, queryKey: getGetSeasonLadderQueryKey(seasonId) },
  });

  const updateProfile = useUpdateProfile();
  const { data: clubRating } = useGetClubRating({
    query: { queryKey: getGetClubRatingQueryKey() },
  });
  const { data: attention } = useGetAttentionItems({
    query: { queryKey: getGetAttentionItemsQueryKey() },
  });

  if (dashLoading || seasonLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-[340px] w-full rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Skeleton className="lg:col-span-4 h-64 w-full" />
          <Skeleton className="lg:col-span-3 h-64 w-full" />
        </div>
      </div>
    );
  }

  const formatCurrency = (val: number | null | undefined) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val ?? 0);

  const team        = dashboard?.team;
  const finance     = dashboard?.financeSummary;
  const monthlyNet  = finance?.monthlyNet ?? 0;
  const wins        = team?.wins  ?? 0;
  const losses      = team?.losses ?? 0;
  const streak      = team?.winStreak ?? 0;
  const rank        = dashboard?.seasonStanding?.rank ?? null;
  const rankPts     = dashboard?.seasonStanding?.points ?? 0;
  const repPts      = team?.managerRepPoints ?? 0;
  const repLvl      = getRepLevel(repPts);
  const repPct      = repLvl.next === null ? 100 : Math.round(((repPts - repLvl.min) / (repLvl.next - repLvl.min)) * 100);
  const coachName   = (profile as any)?.coachName ?? "";
  const initials    = (team?.name ?? "C").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  const avgMorale   = dashboard?.topPlayers && dashboard.topPlayers.length > 0
    ? Math.round(dashboard.topPlayers.reduce((s, p) => s + (p.morale ?? 75), 0) / dashboard.topPlayers.length)
    : 0;
  const moraleColour = avgMorale >= 80 ? "text-emerald-300" : avgMorale >= 60 ? "text-yellow-300" : "text-red-300";

  // World ranking trend from win/loss ratio
  const totalGames  = wins + losses;
  const winRate     = totalGames > 0 ? wins / totalGames : 0.5;
  const rankTrend   = streak >= 3 ? "hot" : winRate > 0.6 ? "up" : winRate < 0.4 ? "down" : "neutral";

  // Rating gradient
  const totalRating = clubRating?.totalRating ?? 0;
  const heroGradient =
    totalRating >= 80 ? "from-amber-900 via-slate-900 to-blue-950" :
    totalRating >= 65 ? "from-violet-950 via-slate-900 to-blue-950" :
    totalRating >= 50 ? "from-blue-950 via-slate-900 to-teal-950"  :
                        "from-slate-900 via-slate-900 to-slate-950";

  const ratingAccent =
    totalRating >= 80 ? "text-amber-300" :
    totalRating >= 65 ? "text-violet-300" :
    totalRating >= 50 ? "text-blue-300"   :
                        "text-slate-300";

  const ratingBarColour =
    totalRating >= 80 ? "bg-amber-400"  :
    totalRating >= 65 ? "bg-violet-400" :
    totalRating >= 50 ? "bg-blue-400"   :
                        "bg-slate-400";

  const ratingBorder =
    totalRating >= 80 ? "border-amber-500/30"  :
    totalRating >= 65 ? "border-violet-500/30" :
    totalRating >= 50 ? "border-blue-500/30"   :
                        "border-slate-500/30";

  const nextMatch = dashboard?.nextMatch as any;

  return (
    <div className="space-y-5">

      {/* ══════════════════════════════════════════════════════════════
          HERO SECTION
      ══════════════════════════════════════════════════════════════ */}
      <div className={cn("relative overflow-hidden rounded-2xl bg-gradient-to-br shadow-2xl border border-white/5", heroGradient)}>
        <BeachCourtDecor />

        {/* Subtle vignette overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

        <div className="relative z-10 p-6 md:p-8 flex flex-col gap-7">

          {/* ── Top: Identity + Club Rating ── */}
          <div className="flex flex-col lg:flex-row gap-6 justify-between">

            {/* Club Identity */}
            <div className="flex items-start gap-5 flex-1 min-w-0">
              {/* Logo */}
              <div className={cn(
                "shrink-0 h-20 w-20 rounded-2xl flex items-center justify-center border-2 shadow-xl bg-white/10 backdrop-blur-sm",
                ratingBorder
              )}>
                <span className={cn("text-3xl font-black", ratingAccent)}>{initials}</span>
              </div>

              <div className="min-w-0 flex-1">
                {/* Club name */}
                <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-0.5">Club</div>
                <h1 className="text-3xl md:text-4xl font-black text-white leading-none truncate">
                  {team?.name ?? "My Club"}
                </h1>

                {/* Manager row */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1">
                    <Star className="h-3 w-3 text-white/60" />
                    <span className="text-xs font-semibold text-white/80">
                      {coachName || "Set coach name"}
                    </span>
                  </div>
                  <div className={cn("flex items-center gap-1 text-xs font-bold", repLvl.colour)}>
                    <Award className="h-3 w-3" />
                    {repLvl.name}
                  </div>
                </div>

                {/* Rep progress */}
                <div className="flex items-center gap-2 mt-2 max-w-[280px]">
                  <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", ratingBarColour.replace("bg-", "bg-").replace("400", "400").replace("bg-amber-400", "bg-amber-400").replace("bg-violet-400", "bg-violet-400").replace("bg-blue-400", "bg-blue-400").replace("bg-slate-400", "bg-white/50"))}
                      style={{ width: `${repPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-white/40 shrink-0">
                    {repPts}{repLvl.next !== null ? `/${repLvl.next} rep` : " rep (max)"}
                  </span>
                </div>

                {/* Season badge */}
                <div className="flex items-center gap-1.5 mt-2">
                  <Badge variant="outline" className="text-[10px] border-white/20 text-white/50 font-semibold">
                    {season?.name ?? "Season 1"}
                  </Badge>
                  {streak >= 3 && (
                    <Badge className="text-[10px] bg-orange-500/20 text-orange-300 border-orange-500/30 font-bold gap-1">
                      <Flame className="h-2.5 w-2.5" /> {streak}-Win Streak
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Club Rating Panel */}
            {clubRating && (
              <div className={cn("shrink-0 bg-white/8 backdrop-blur-sm rounded-2xl p-5 border min-w-[220px] max-w-[280px] w-full lg:w-auto", ratingBorder)}
                style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-3 flex items-center gap-1.5">
                  <Building2 className="h-3 w-3" /> Club Rating
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className={cn("text-5xl font-black leading-none", ratingAccent)}>{totalRating}</span>
                  <span className="text-sm text-white/50 font-semibold">/100</span>
                </div>
                <div className="text-sm font-bold text-white/70 mb-4">{clubRating.label}</div>

                {/* Component breakdown */}
                <div className="space-y-2">
                  {(["players", "staff", "medical", "facilities", "youthAcademy"] as const).map((key) => {
                    const comp = clubRating.breakdown[key];
                    const labels: Record<string, string> = {
                      players: "Players", staff: "Staff", medical: "Medical",
                      facilities: "Facilities", youthAcademy: "Youth",
                    };
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <div className="text-[10px] text-white/40 w-[58px] font-semibold shrink-0">{labels[key]}</div>
                        <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all", ratingBarColour)}
                            style={{ width: `${comp.score}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-white/50 w-5 text-right font-bold shrink-0">{comp.score}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Bottom: Stats Strip ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">

            {/* World Rank */}
            <HeroStat
              label="World Rank"
              icon={<Award className="h-2.5 w-2.5" />}
              value={rank !== null ? `#${rank}` : "—"}
              sub={
                <span className="flex items-center gap-1">
                  {rankTrend === "hot"     && <><Flame className="h-3 w-3 text-orange-400" /><span className="text-orange-300">On Fire</span></>}
                  {rankTrend === "up"      && <><TrendingUp className="h-3 w-3 text-emerald-400" /><span className="text-emerald-300">Rising</span></>}
                  {rankTrend === "down"    && <><TrendingDown className="h-3 w-3 text-red-400" /><span className="text-red-300">Falling</span></>}
                  {rankTrend === "neutral" && <><Minus className="h-3 w-3 text-white/30" /><span>Steady</span></>}
                </span>
              }
            />

            {/* Season Record */}
            <HeroStat
              label="Season Record"
              icon={<Swords className="h-2.5 w-2.5" />}
              value={<span>{wins}<span className="text-white/30 text-base mx-1">—</span>{losses}</span>}
              sub={`${rankPts} season pts`}
            />

            {/* Budget */}
            <HeroStat
              label="Budget"
              icon={<DollarSign className="h-2.5 w-2.5" />}
              value={formatCurrency(finance?.balance)}
              sub={
                <span className="flex items-center gap-0.5">
                  {monthlyNet >= 0
                    ? <ArrowUpRight className="h-3 w-3 text-emerald-400" />
                    : <ArrowDownRight className="h-3 w-3 text-red-400" />}
                  {formatCurrency(Math.abs(monthlyNet))} / mo
                </span>
              }
            />

            {/* Team Morale */}
            <HeroStat
              label="Team Morale"
              icon={<HeartPulse className="h-2.5 w-2.5" />}
              value={<span className={moraleColour}>{avgMorale > 0 ? `${avgMorale}%` : "—"}</span>}
              sub={
                avgMorale > 0 ? (
                  <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden mt-1">
                    <div
                      className={cn("h-full rounded-full", avgMorale >= 80 ? "bg-emerald-400" : avgMorale >= 60 ? "bg-yellow-400" : "bg-red-400")}
                      style={{ width: `${avgMorale}%` }}
                    />
                  </div>
                ) : undefined
              }
            />

            {/* Injuries */}
            <HeroStat
              label="Fitness"
              icon={<Shield className="h-2.5 w-2.5" />}
              value={
                (dashboard?.injuredCount ?? 0) === 0
                  ? <span className="text-emerald-300">All Fit</span>
                  : <span className="text-red-300">{dashboard?.injuredCount} Injured</span>
              }
              sub={(dashboard?.injuredCount ?? 0) === 0 ? "Squad fully available" : "Check medical centre"}
            />

            {/* Next Match */}
            <HeroStat
              label="Next Match"
              icon={<Calendar className="h-2.5 w-2.5" />}
              value={
                nextMatch
                  ? <span className="text-base">{weatherIcons[nextMatch.weather] ?? "☀️"} {nextMatch.locationName ?? "TBD"}</span>
                  : <span className="text-white/30 text-base">No match</span>
              }
              sub={nextMatch ? `Prize: ${formatCurrency(nextMatch.prizeAmount)}` : "Schedule a match"}
            />
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          ATTENTION REQUIRED
      ══════════════════════════════════════════════════════════════ */}
      <AttentionPanel items={attention?.items ?? []} />

      {/* ══════════════════════════════════════════════════════════════
          PLAYERS + RESULTS
      ══════════════════════════════════════════════════════════════ */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Top Players</CardTitle>
            <CardDescription>Performance leaders in your squad.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboard?.topPlayers.map((player) => {
              const rating = Math.round((player.power + player.speed + player.defense + player.serve + player.block) / 5);
              return (
                <div key={player.id} className="flex items-center gap-3" data-testid={`row-player-${player.id}`}>
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium leading-none">{player.name}</p>
                      <PlayerStatusBadge player={player as any} size="xs" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={rating} className="h-1.5" />
                      <span className="text-xs text-muted-foreground w-6" data-testid={`text-rating-${player.id}`}>{rating}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs font-bold text-muted-foreground">OVR {rating}</span>
                    <span className="text-[10px] text-muted-foreground/60">{player.nationality}</span>
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
          <CardContent className="space-y-3">
            {dashboard?.recentResults.map((match) => {
              const hs = match.homeScore ?? 0;
              const as_ = match.awayScore ?? 0;
              const isWin = hs > as_;
              return (
                <div key={match.id} data-testid={`row-match-${match.id}`}
                  className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0">
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">{match.awayTeamName ?? "Opponent"}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-2.5 w-2.5" />{match.locationName ?? "Beach"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-bold tabular-nums">{hs} – {as_}</span>
                    <Badge className={isWin ? "bg-emerald-500 hover:bg-emerald-500 text-white" : "bg-red-500 hover:bg-red-500 text-white"}>
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

      {/* ══════════════════════════════════════════════════════════════
          SEASON LADDER
      ══════════════════════════════════════════════════════════════ */}
      {ladder && ladder.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Season Ladder</CardTitle>
            <CardDescription>{season?.name} — World Rankings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="h-9 px-2 text-left font-medium text-muted-foreground w-12">Rank</th>
                    <th className="h-9 px-2 text-left font-medium text-muted-foreground">Team</th>
                    <th className="h-9 px-2 text-center font-medium text-muted-foreground w-16">W</th>
                    <th className="h-9 px-2 text-center font-medium text-muted-foreground w-16">L</th>
                    <th className="h-9 px-2 text-right font-medium text-muted-foreground w-20">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {ladder.map((entry) => {
                    const isMyTeam = entry.teamName === team?.name;
                    return (
                      <tr
                        key={entry.teamId}
                        data-testid={`row-ladder-${entry.teamId}`}
                        className={cn(
                          "border-b transition-colors hover:bg-muted/50",
                          isMyTeam && "bg-primary/5 border-l-4 border-l-primary font-semibold"
                        )}
                      >
                        <td className="p-2 font-bold">
                          {entry.rank <= 3
                            ? <span className={cn("text-base", entry.rank === 1 ? "text-yellow-500" : entry.rank === 2 ? "text-slate-400" : "text-amber-600")}>
                                {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : "🥉"}
                              </span>
                            : `#${entry.rank}`}
                        </td>
                        <td className="p-2">{entry.teamName}{isMyTeam && <Badge variant="outline" className="ml-2 text-[10px]">You</Badge>}</td>
                        <td className="p-2 text-center text-emerald-600 font-semibold">{entry.wins}</td>
                        <td className="p-2 text-center text-red-500 font-semibold">{entry.losses}</td>
                        <td className="p-2 text-right font-bold">{entry.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════
          PROFILE — Manager Settings
      ══════════════════════════════════════════════════════════════ */}
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
  );
}

// ── Attention Required panel ───────────────────────────────────────────────────
const PRIORITY_META = {
  red:    { dot: "bg-red-500",    border: "border-l-red-500",    badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",    label: "Urgent"      },
  orange: { dot: "bg-orange-400", border: "border-l-orange-400", badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300", label: "Important" },
  blue:   { dot: "bg-blue-400",   border: "border-l-blue-400",   badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",   label: "Info"        },
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Medical:        <HeartPulse className="h-3.5 w-3.5" />,
  Contract:       <KeyRound className="h-3.5 w-3.5" />,
  Finances:       <DollarSign className="h-3.5 w-3.5" />,
  Morale:         <Star className="h-3.5 w-3.5" />,
  "Youth Academy":<Trophy className="h-3.5 w-3.5" />,
  Scouting:       <MapPin className="h-3.5 w-3.5" />,
  Facilities:     <Building2 className="h-3.5 w-3.5" />,
};

function AttentionPanel({ items }: { items: AttentionItem[] }) {
  const [, navigate] = useLocation();
  if (items.length === 0) return null;

  const urgentCount  = items.filter(i => i.priority === "red").length;
  const importantCount = items.filter(i => i.priority === "orange").length;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Attention Required</CardTitle>
            <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs font-bold">
              {items.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {urgentCount > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
                <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
                {urgentCount} urgent
              </span>
            )}
            {importantCount > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold text-orange-600 dark:text-orange-400">
                <span className="h-2 w-2 rounded-full bg-orange-400 inline-block" />
                {importantCount} important
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const meta = PRIORITY_META[item.priority as "red" | "orange" | "blue"];
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.navigateTo)}
                className={cn(
                  "text-left w-full rounded-lg border border-border/60 border-l-4 bg-card px-3 py-2.5 hover:bg-muted/50 transition-colors group",
                  meta.border
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="text-muted-foreground shrink-0">
                      {CATEGORY_ICONS[item.category] ?? <Shield className="h-3.5 w-3.5" />}
                    </span>
                    <span className="text-xs font-bold text-foreground leading-tight truncate">{item.title}</span>
                  </div>
                  <span className={cn("shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full", meta.badge)}>
                    {meta.label}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug line-clamp-2">{item.description}</p>
                <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground/60 group-hover:text-primary transition-colors">
                  <ChevronRight className="h-3 w-3" />
                  Go to {item.category}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Profile card ───────────────────────────────────────────────────────────────
function ProfileCard({
  profile,
  loading,
  onSave,
  saving,
}: {
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
  const savePin   = (profile as any)?.savePin   ?? "——";

  const startEditName = () => { setNameVal(coachName); setEditingName(true); };
  const startEditPin  = () => { setPinVal(savePin);    setEditingPin(true);  };
  const commitName    = () => { onSave(nameVal.trim() || coachName, savePin); setEditingName(false); };
  const commitPin     = () => {
    const cleaned = pinVal.replace(/\s/g, "").slice(0, 20);
    onSave(coachName, cleaned || savePin);
    setEditingPin(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Star className="h-4 w-4 text-muted-foreground" /> Manager Profile
        </CardTitle>
        <CardDescription>Your coach identity and save password.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-12 w-full" />
        ) : (
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Coach Name */}
            <div className="flex-1 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 space-y-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Coach Name</div>
              {editingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus value={nameVal}
                    onChange={e => setNameVal(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") commitName(); if (e.key === "Escape") setEditingName(false); }}
                    className="h-7 text-sm px-2" maxLength={40}
                    data-testid="input-coach-name"
                  />
                  <button onClick={commitName} disabled={saving} className="text-emerald-600 hover:text-emerald-500">
                    <Check className="h-4 w-4" />
                  </button>
                  <button onClick={() => setEditingName(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <span className="text-sm font-semibold">{coachName || <span className="text-muted-foreground italic">Not set</span>}</span>
                  <button onClick={startEditName}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Save PIN */}
            <div className="flex-1 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 space-y-1">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                  <KeyRound className="h-3 w-3" /> Save Password
                </div>
                <button
                  onClick={() => setPinVisible(v => !v)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-toggle-pin">
                  {pinVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              {editingPin ? (
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus value={pinVal}
                    onChange={e => setPinVal(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") commitPin(); if (e.key === "Escape") setEditingPin(false); }}
                    className="h-7 text-sm px-2 font-mono w-32" maxLength={20}
                    data-testid="input-save-pin"
                  />
                  <button onClick={commitPin} disabled={saving} className="text-emerald-600 hover:text-emerald-500">
                    <Check className="h-4 w-4" />
                  </button>
                  <button onClick={() => setEditingPin(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <span className="font-mono text-sm font-bold tracking-widest">
                    {pinVisible ? savePin : "•".repeat(Math.min(savePin.length, 8))}
                  </span>
                  <button onClick={startEditPin}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
