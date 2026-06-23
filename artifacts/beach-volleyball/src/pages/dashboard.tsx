import {
  useGetDashboard,
  useGetCurrentSeason,
  useGetSeasonLadder,
  useGetProfile,
  useGetClubRating,
  useGetAttentionItems,
  useGetFacilities,
  useGetTrophyCabinet,
  useGetTeamStrength,
  useGetWorldTourNews,
  useGetUpcomingEvents,
  getGetDashboardQueryKey,
  getGetCurrentSeasonQueryKey,
  getGetSeasonLadderQueryKey,
  getGetProfileQueryKey,
  getGetClubRatingQueryKey,
  getGetAttentionItemsQueryKey,
  getGetFacilitiesQueryKey,
  getGetTrophyCabinetQueryKey,
  getGetTeamStrengthQueryKey,
  getGetWorldTourNewsQueryKey,
  getGetUpcomingEventsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayerStatusBadge } from "@/components/player-status-badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Trophy,
  DollarSign,
  Calendar,
  Award,
  ArrowUpRight,
  ArrowDownRight,
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
  Dumbbell,
  Heart,
  FlameKindling,
  Salad,
  Users,
  Search,
  Beaker,
  Umbrella,
  ExternalLink,
  ChevronUp,
  Zap,
  Settings,
} from "lucide-react";
import { CareerOptionsMenu } from "@/components/career/CareerOptionsMenu";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
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
  const [showCareerOptions, setShowCareerOptions] = useState(false);

  const { data: dashboard, isLoading: dashLoading } = useGetDashboard({
    query: { queryKey: getGetDashboardQueryKey() },
  });
  const { data: season, isLoading: seasonLoading } = useGetCurrentSeason({
    query: { queryKey: getGetCurrentSeasonQueryKey() },
  });
  const { data: profile } = useGetProfile({
    query: { queryKey: getGetProfileQueryKey() },
  });

  const seasonId = season?.id ?? 1;
  const { data: ladder } = useGetSeasonLadder(seasonId, {
    query: { enabled: !!season, queryKey: getGetSeasonLadderQueryKey(seasonId) },
  });
  const { data: clubRating } = useGetClubRating({
    query: { queryKey: getGetClubRatingQueryKey() },
  });
  const { data: attention } = useGetAttentionItems({
    query: { queryKey: getGetAttentionItemsQueryKey() },
  });
  const { data: facilitiesData } = useGetFacilities({
    query: { queryKey: getGetFacilitiesQueryKey() },
  });
  const { data: cabinet } = useGetTrophyCabinet({
    query: { queryKey: getGetTrophyCabinetQueryKey() },
  });
  const { data: teamStrength } = useGetTeamStrength({
    query: { queryKey: getGetTeamStrengthQueryKey() },
  });
  const { data: worldNews } = useGetWorldTourNews({
    query: { queryKey: getGetWorldTourNewsQueryKey() },
  });
  const { data: upcomingEvents } = useGetUpcomingEvents({
    query: { queryKey: getGetUpcomingEventsQueryKey() },
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
    <>
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

          {/* ── Career Options ── */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowCareerOptions(true)}
              className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/25 hover:bg-black/40 backdrop-blur-sm px-3 py-1.5 text-[11px] font-bold text-white/55 hover:text-white/90 transition-all"
            >
              <Settings className="h-3 w-3" />
              Career Options
            </button>
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          ATTENTION REQUIRED
      ══════════════════════════════════════════════════════════════ */}
      <AttentionPanel items={attention?.items ?? []} />

      {/* ══════════════════════════════════════════════════════════════
          FACILITIES SNAPSHOT
      ══════════════════════════════════════════════════════════════ */}
      {facilitiesData && (
        <FacilitiesSnapshot
          facilities={facilitiesData.map(f => ({ type: f.type, level: f.level }))}
          budget={finance?.balance ?? 0}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════
          TROPHY CABINET PREVIEW
      ══════════════════════════════════════════════════════════════ */}
      {cabinet && <TrophyCabinetPreview cabinet={cabinet} />}

      {/* ══════════════════════════════════════════════════════════════
          UPCOMING EVENTS
      ══════════════════════════════════════════════════════════════ */}
      {upcomingEvents && <UpcomingEventsWidget items={upcomingEvents.items} />}

      {/* ══════════════════════════════════════════════════════════════
          WORLD TOUR NEWS FEED
      ══════════════════════════════════════════════════════════════ */}
      {worldNews && <WorldTourNewsFeed items={worldNews.items} />}

      {/* ══════════════════════════════════════════════════════════════
          TEAM STRENGTH OVERVIEW
      ══════════════════════════════════════════════════════════════ */}
      {teamStrength && <TeamStrengthOverview strength={teamStrength} />}

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


    </div>

    <CareerOptionsMenu
      isOpen={showCareerOptions}
      onClose={() => setShowCareerOptions(false)}
    />
    </>
  );
}

// ── Trophy Cabinet Preview ─────────────────────────────────────────────────────
type TierKey = "bronze" | "silver" | "gold" | "platinum";

const TIER_META: Record<TierKey, { label: string; emoji: string; bg: string; text: string; border: string }> = {
  bronze:   { label: "Bronze",   emoji: "🥉", bg: "bg-amber-800/20",   text: "text-amber-700 dark:text-amber-400",   border: "border-amber-700/30"   },
  silver:   { label: "Silver",   emoji: "🥈", bg: "bg-slate-400/20",   text: "text-slate-600 dark:text-slate-300",   border: "border-slate-400/40"   },
  gold:     { label: "Gold",     emoji: "🥇", bg: "bg-yellow-400/20",  text: "text-yellow-700 dark:text-yellow-400", border: "border-yellow-500/40"  },
  platinum: { label: "Platinum", emoji: "💎", bg: "bg-cyan-400/15",    text: "text-cyan-700 dark:text-cyan-300",     border: "border-cyan-400/40"    },
};

type TrophyTile = {
  emoji: string;
  label: string;
  count: number;
  accent: string;
  glow: string;
};

function TrophyCabinetPreview({ cabinet }: { cabinet: import("@workspace/api-client-react").TrophyCabinet }) {
  const [, navigate] = useLocation();
  const h = cabinet.honours;
  const o = cabinet.olympicMedals;
  const r = cabinet.records;

  const tiles: TrophyTile[] = [
    { emoji: "🏆", label: "World Tour Titles",        count: h.worldChampionships.length,      accent: "text-yellow-500",  glow: "shadow-yellow-500/20" },
    { emoji: "🌍", label: "Continental Championships",count: h.continentalChampionships.length, accent: "text-violet-400",  glow: "shadow-violet-500/20" },
    { emoji: "🏅", label: "Grand Finals",             count: h.grandFinals.length,              accent: "text-blue-400",    glow: "shadow-blue-500/20"   },
    { emoji: "🥇", label: "Olympic Gold",             count: o.gold,                            accent: "text-yellow-400",  glow: "shadow-yellow-400/20" },
    { emoji: "🥈", label: "Olympic Silver",           count: o.silver,                          accent: "text-slate-300",   glow: "shadow-slate-400/20"  },
    { emoji: "🥉", label: "Olympic Bronze",           count: o.bronze,                          accent: "text-amber-600",   glow: "shadow-amber-500/20"  },
  ];

  const totalTrophies = h.worldChampionships.length + h.continentalChampionships.length +
    h.grandFinals.length + o.gold + o.silver + o.bronze + h.runnerUps.length + h.bronzes.length;

  const achs = cabinet.achievements;
  const unlockedCount = achs.filter(a => a.unlocked).length;
  const achPct = achs.length > 0 ? Math.round((unlockedCount / achs.length) * 100) : 0;

  const tierCounts = (["bronze", "silver", "gold", "platinum"] as TierKey[]).map(tier => ({
    tier,
    unlocked: achs.filter(a => a.tier === tier && a.unlocked).length,
    total:    achs.filter(a => a.tier === tier).length,
  }));

  const formatMoney = (s: string | number) => {
    const n = typeof s === "string" ? parseFloat(s) : s;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n}`;
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-yellow-950/30 shadow-xl">
      {/* Background shimmer */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(234,179,8,0.08),_transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(139,92,246,0.06),_transparent_60%)] pointer-events-none" />

      <div className="relative z-10 p-5 md:p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-yellow-400/15 border border-yellow-400/30 flex items-center justify-center text-xl">
              🏆
            </div>
            <div>
              <h3 className="text-base font-black text-white leading-none">Trophy Cabinet</h3>
              <div className="text-[11px] text-white/50 mt-0.5">
                {totalTrophies} total trophy{totalTrophies !== 1 ? "ies" : "y"} earned
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate("/trophy-cabinet")}
            className="flex items-center gap-1.5 text-xs font-semibold text-yellow-400 hover:text-yellow-300 transition-colors bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/20 rounded-lg px-3 py-1.5"
          >
            <Trophy className="h-3.5 w-3.5" />
            View Full Cabinet
          </button>
        </div>

        {/* Trophy Tiles */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {tiles.map((t) => (
            <div
              key={t.label}
              className={cn(
                "flex flex-col items-center text-center rounded-xl bg-white/5 border border-white/8 px-2 py-3 gap-1 transition-all",
                t.count > 0 && `shadow-lg ${t.glow}`
              )}
            >
              <span className={cn("text-2xl leading-none", t.count === 0 && "grayscale opacity-30")}>
                {t.emoji}
              </span>
              <span className={cn("text-xl font-black leading-none mt-1", t.count > 0 ? t.accent : "text-white/20")}>
                {t.count}
              </span>
              <span className="text-[9px] text-white/40 leading-tight text-center mt-0.5 font-semibold">
                {t.label}
              </span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-white/8" />

        {/* Achievement Progress + Records row */}
        <div className="grid md:grid-cols-2 gap-4">

          {/* Achievements */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-widest text-white/50">Achievements</span>
              <span className="text-[11px] font-bold text-white/60">{unlockedCount} / {achs.length}</span>
            </div>

            {/* Tier pills */}
            <div className="flex flex-wrap gap-1.5">
              {tierCounts.map(({ tier, unlocked, total }) => {
                const meta = TIER_META[tier];
                return (
                  <span
                    key={tier}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border",
                      unlocked > 0 ? cn(meta.bg, meta.text, meta.border) : "bg-white/5 text-white/25 border-white/10"
                    )}
                  >
                    {meta.emoji} {unlocked}/{total}
                  </span>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/40">Hall of Fame Progress</span>
                <span className="text-[10px] font-bold text-yellow-400">{achPct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-amber-400 transition-all"
                  style={{ width: `${achPct}%` }}
                />
              </div>
              <div className="text-[10px] text-white/30">
                {achPct >= 100 ? "🌟 Legend status achieved!" :
                 achPct >= 75 ? "Elite manager — Legend within reach" :
                 achPct >= 50 ? "Experienced manager — keep building" :
                 achPct >= 25 ? "Rising coach — more trophies needed" :
                                "Career just beginning — win your first titles"}
              </div>
            </div>
          </div>

          {/* Manager Records */}
          <div className="space-y-3">
            <span className="text-[11px] font-black uppercase tracking-widest text-white/50">Manager Records</span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: "🔥", label: "Best Streak",    value: `${r.bestWinStreak}W` },
                { icon: "🎯", label: "Most Wins",      value: `${r.mostWins}` },
                { icon: "📅", label: "Seasons",        value: `${r.seasonsManaged}` },
                { icon: "💰", label: "Most Earnings",  value: formatMoney(r.mostPrizeMoney) },
              ].map(({ icon, label, value }) => (
                <div key={label} className="flex items-center gap-2 bg-white/5 rounded-lg px-2.5 py-2">
                  <span className="text-base leading-none">{icon}</span>
                  <div>
                    <div className="text-[9px] text-white/40 font-semibold uppercase tracking-wider">{label}</div>
                    <div className="text-sm font-black text-white leading-none">{value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Upcoming Events ────────────────────────────────────────────────────────────

type UpcomingEventItem = import("@workspace/api-client-react").UpcomingEvent;

const EVENT_META: Record<string, { icon: string; label: string; color: string; bg: string; border: string; barColor: string }> = {
  match:           { icon: "🏐", label: "Match",    color: "text-sky-300",     bg: "bg-sky-500/10",     border: "border-sky-500/25",     barColor: "bg-sky-500"     },
  season_end:      { icon: "📅", label: "Season",   color: "text-violet-300",  bg: "bg-violet-500/10",  border: "border-violet-500/25",  barColor: "bg-violet-500"  },
  scouting_return: { icon: "🔭", label: "Scouting", color: "text-amber-300",   bg: "bg-amber-500/10",   border: "border-amber-500/25",   barColor: "bg-amber-500"   },
  olympic:         { icon: "🏅", label: "Olympic",  color: "text-yellow-300",  bg: "bg-yellow-500/10",  border: "border-yellow-500/25",  barColor: "bg-yellow-500"  },
  youth_league:    { icon: "⭐", label: "Youth",    color: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/25", barColor: "bg-emerald-500" },
  facility_action: { icon: "🏗️",  label: "Facility", color: "text-rose-300",   bg: "bg-rose-500/10",    border: "border-rose-500/25",    barColor: "bg-rose-500"    },
};

const URGENCY_CONFIG: Record<string, { label: string; dot: string; pill: string }> = {
  critical: { label: "Today",    dot: "bg-red-500 animate-pulse",   pill: "bg-red-500/20 text-red-300 border-red-500/30"     },
  soon:     { label: "Soon",     dot: "bg-orange-400",              pill: "bg-orange-400/15 text-orange-300 border-orange-400/25" },
  upcoming: { label: "Upcoming", dot: "bg-sky-400",                 pill: "bg-sky-400/15 text-sky-300 border-sky-400/25"       },
  planning: { label: "Planning", dot: "bg-white/25",                pill: "bg-white/8 text-white/40 border-white/15"           },
};

function countdownLabel(days: number | null): string {
  if (days === null)   return "No date set";
  if (days <= 0)       return "Today";
  if (days === 1)      return "Tomorrow";
  if (days <= 7)       return `${days} days`;
  if (days <= 30)      return `${days} days`;
  const weeks = Math.round(days / 7);
  return `${weeks} week${weeks !== 1 ? "s" : ""}`;
}

function UpcomingEventsWidget({ items }: { items: UpcomingEventItem[] }) {
  const [, navigate] = useLocation();

  // Split into two sections: time-bound (has daysRemaining) and planning items
  const timeBound = items.filter(e => e.daysRemaining !== null || e.urgency === "critical" || e.urgency === "soon");
  const planning  = items.filter(e => e.daysRemaining === null && e.urgency !== "critical" && e.urgency !== "soon");

  const renderCard = (evt: UpcomingEventItem) => {
    const meta    = EVENT_META[evt.type]    ?? EVENT_META.match;
    const urg     = URGENCY_CONFIG[evt.urgency] ?? URGENCY_CONFIG.planning;
    const hasDays = evt.daysRemaining !== null;
    const facilityNav = (t: string): string => {
      const low = t.toLowerCase();
      if (low.includes("training"))  return "/training";
      if (low.includes("medical"))   return "/medical";
      if (low.includes("scouting"))  return "/continental-scouting";
      if (low.includes("youth"))     return "/youth-academy";
      return "/facilities";
    };
    const nav     = evt.type === "match"           ? "/matches"
                  : evt.type === "scouting_return" ? "/continental-scouting"
                  : evt.type === "olympic"         ? "/locations"
                  : evt.type === "youth_league"    ? "/youth-academy"
                  : evt.type === "facility_action" ? facilityNav(evt.title)
                  : null;

    return (
      <div
        key={evt.id}
        onClick={() => nav && navigate(nav)}
        className={cn(
          "rounded-xl border p-3.5 flex gap-3 items-start transition-all",
          meta.bg, meta.border,
          nav && "cursor-pointer hover:brightness-110",
        )}
      >
        {/* Icon circle */}
        <div className={cn(
          "h-9 w-9 rounded-lg flex items-center justify-center text-lg shrink-0 border",
          meta.bg, meta.border,
        )}>
          {meta.icon}
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          {/* Top row: title + urgency pill */}
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="text-sm font-bold text-white leading-tight">{evt.title}</div>
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black border shrink-0",
              urg.pill,
            )}>
              <span className={cn("inline-block h-1.5 w-1.5 rounded-full", urg.dot)} />
              {urg.label}
            </span>
          </div>

          {/* Subtitle */}
          <div className="text-[11px] text-white/50">{evt.subtitle}</div>

          {/* Location + prize row */}
          {(evt.location || evt.prizeMoney) && (
            <div className="flex items-center gap-3 text-[10px] text-white/40 font-semibold">
              {evt.location && <span>📍 {evt.location}</span>}
              {evt.prizeMoney && <span className="text-emerald-400">💰 {evt.prizeMoney}</span>}
            </div>
          )}

          {/* Countdown bar (only when days known) */}
          {hasDays && (
            <div className="flex items-center gap-2 pt-0.5">
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", meta.barColor)}
                  style={{
                    width: `${Math.max(4, Math.min(100, 100 - ((evt.daysRemaining ?? 0) / 90) * 100))}%`,
                  }}
                />
              </div>
              <div className={cn("text-[10px] font-black shrink-0 tabular-nums", meta.color)}>
                {countdownLabel(evt.daysRemaining ?? null)}
              </div>
            </div>
          )}

          {/* Detail */}
          {evt.detail && (
            <div className="text-[10px] text-white/35 leading-relaxed pt-0.5">{evt.detail}</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800/80 shadow-xl">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(139,92,246,0.07),_transparent_55%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(16,185,129,0.05),_transparent_55%)] pointer-events-none" />

      <div className="relative z-10 p-5 md:p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-violet-400/15 border border-violet-400/30 flex items-center justify-center text-xl">
            📆
          </div>
          <div>
            <h3 className="text-base font-black text-white leading-none">Upcoming Events</h3>
            <div className="text-[11px] text-white/50 mt-0.5">{items.length} events on your calendar</div>
          </div>
        </div>

        {/* Time-bound events */}
        {timeBound.length > 0 && (
          <div className="space-y-2.5">
            <div className="text-[10px] font-black uppercase tracking-widest text-white/35">Scheduled</div>
            <div className="space-y-2">{timeBound.map(renderCard)}</div>
          </div>
        )}

        {/* Divider */}
        {timeBound.length > 0 && planning.length > 0 && (
          <div className="border-t border-white/8" />
        )}

        {/* Planning items */}
        {planning.length > 0 && (
          <div className="space-y-2.5">
            <div className="text-[10px] font-black uppercase tracking-widest text-white/35">Planning</div>
            <div className="space-y-2">{planning.map(renderCard)}</div>
          </div>
        )}

        {items.length === 0 && (
          <div className="text-center py-6 text-white/30 text-sm">
            No upcoming events — play your next match to generate fixtures.
          </div>
        )}
      </div>
    </div>
  );
}

// ── World Tour News Feed ───────────────────────────────────────────────────────

const NEWS_META: Record<string, { icon: string; label: string; pill: string; dot: string }> = {
  tournament:   { icon: "🏆", label: "Tournament",   pill: "bg-yellow-400/15 text-yellow-300 border-yellow-400/25",  dot: "bg-yellow-400"  },
  transfer:     { icon: "🔄", label: "Transfer",     pill: "bg-sky-400/15 text-sky-300 border-sky-400/25",           dot: "bg-sky-400"     },
  staff_signing:{ icon: "📋", label: "Signing",      pill: "bg-violet-400/15 text-violet-300 border-violet-400/25",  dot: "bg-violet-400"  },
  youth:        { icon: "⭐", label: "Youth",        pill: "bg-emerald-400/15 text-emerald-300 border-emerald-400/25",dot: "bg-emerald-400" },
  injury:       { icon: "🩹", label: "Injury",       pill: "bg-red-400/15 text-red-300 border-red-400/25",           dot: "bg-red-400"     },
  olympic:      { icon: "🥇", label: "Olympic",      pill: "bg-amber-400/15 text-amber-300 border-amber-400/25",     dot: "bg-amber-400"   },
  facility:     { icon: "🏗️",  label: "Facility",    pill: "bg-slate-400/15 text-slate-300 border-slate-400/25",     dot: "bg-slate-400"   },
  record:       { icon: "📈", label: "Record",       pill: "bg-pink-400/15 text-pink-300 border-pink-400/25",        dot: "bg-pink-400"    },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  return `${days}d ago`;
}

function WorldTourNewsFeed({ items }: { items: import("@workspace/api-client-react").WorldTourNewsItem[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800/80 shadow-xl">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.07),_transparent_55%)] pointer-events-none" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-400/15 border border-indigo-400/30 flex items-center justify-center text-xl">
              🌍
            </div>
            <div>
              <h3 className="text-base font-black text-white leading-none">World Tour News</h3>
              <div className="text-[11px] text-white/50 mt-0.5">Live circuit updates</div>
            </div>
          </div>
          {/* Live indicator */}
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            LIVE
          </div>
        </div>

        {/* News list */}
        <div className="divide-y divide-white/5">
          {items.slice(0, 10).map((item) => {
            const meta = NEWS_META[item.type] ?? NEWS_META.record;
            const isOpen = expanded === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setExpanded(isOpen ? null : item.id)}
                className={cn(
                  "w-full text-left px-5 py-3.5 transition-colors",
                  item.isUserTeam
                    ? "bg-yellow-400/5 hover:bg-yellow-400/10"
                    : "hover:bg-white/4",
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Colour dot */}
                  <div className={cn("mt-1.5 h-2 w-2 rounded-full shrink-0", meta.dot)} />

                  <div className="flex-1 min-w-0">
                    {/* Top row */}
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold border",
                        meta.pill
                      )}>
                        {meta.icon} {meta.label}
                      </span>
                      <span className="text-[10px] text-white/30 font-semibold">{item.flag} {item.nation}</span>
                      {item.isUserTeam && (
                        <span className="text-[9px] font-black text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-full px-1.5 py-0.5">
                          YOUR TEAM
                        </span>
                      )}
                    </div>

                    {/* Headline */}
                    <div className={cn(
                      "text-sm font-bold leading-snug",
                      item.isUserTeam ? "text-yellow-100" : "text-white/90"
                    )}>
                      {item.headline}
                    </div>

                    {/* Detail (expandable) */}
                    {isOpen && (
                      <div className="mt-1.5 text-[11px] text-white/55 leading-relaxed">
                        {item.detail}
                      </div>
                    )}
                  </div>

                  {/* Time */}
                  <div className="text-[10px] text-white/30 shrink-0 mt-0.5 font-semibold">
                    {timeAgo(item.publishedAt)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/8 text-[10px] text-white/25 font-semibold">
          Tap any story to expand · World Tour stories refresh daily
        </div>
      </div>
    </div>
  );
}

// ── Team Strength Overview ─────────────────────────────────────────────────────
const POSITION_META: Record<string, { label: string; emoji: string; accent: string; bar: string; desc: string }> = {
  setter:      { label: "Setter",      emoji: "🏐", accent: "text-sky-400",    bar: "bg-sky-500",    desc: "Serve · Speed · Defense" },
  spiker:      { label: "Spiker",      emoji: "⚡", accent: "text-rose-400",   bar: "bg-rose-500",   desc: "Power · Speed · Block"   },
  defender:    { label: "Defender",    emoji: "🛡️",  accent: "text-emerald-400",bar: "bg-emerald-500",desc: "Defense · Speed"          },
  blocker:     { label: "Blocker",     emoji: "🧱", accent: "text-amber-400",  bar: "bg-amber-500",  desc: "Block · Power"           },
  server:      { label: "Server",      emoji: "🎯", accent: "text-violet-400", bar: "bg-violet-500", desc: "Serve · Power"           },
  all_rounder: { label: "All-Rounder",emoji: "⭐",  accent: "text-yellow-400", bar: "bg-yellow-500", desc: "Balanced all stats"      },
};

const POSITION_ORDER = ["setter", "spiker", "defender", "blocker", "server", "all_rounder"] as const;

function ratingLabel(r: number) {
  if (r === 0)  return { text: "No Players", color: "text-white/30" };
  if (r >= 90)  return { text: "World Class", color: "text-yellow-400" };
  if (r >= 80)  return { text: "Elite",       color: "text-green-400"  };
  if (r >= 70)  return { text: "Strong",      color: "text-sky-400"    };
  if (r >= 60)  return { text: "Average",     color: "text-white/60"   };
  if (r >= 50)  return { text: "Weak",        color: "text-orange-400" };
  return               { text: "Critical",    color: "text-red-400"    };
}

function TeamStrengthOverview({ strength }: { strength: import("@workspace/api-client-react").TeamStrength }) {
  const [, navigate] = useLocation();
  const positions = strength.positions as Record<string, { rating: number; playerCount: number; topPlayer: string | null }>;

  const overall = strength.overallRating;
  const { text: overallLabel, color: overallColor } = ratingLabel(overall);

  const maxRating = Math.max(...POSITION_ORDER.map(p => positions[p]?.rating ?? 0), 1);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 shadow-xl">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(56,189,248,0.07),_transparent_55%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(244,63,94,0.06),_transparent_55%)] pointer-events-none" />

      <div className="relative z-10 p-5 md:p-6 space-y-5">

        {/* Header row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-400/15 border border-sky-400/30 flex items-center justify-center text-xl">
              📊
            </div>
            <div>
              <h3 className="text-base font-black text-white leading-none">Team Strength</h3>
              <div className="text-[11px] text-white/50 mt-0.5">
                {strength.totalActivePlayers} active player{strength.totalActivePlayers !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate("/players")}
            className="flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors bg-sky-400/10 hover:bg-sky-400/20 border border-sky-400/20 rounded-lg px-3 py-1.5"
          >
            <Users className="h-3.5 w-3.5" />
            Manage Squad
          </button>
        </div>

        {/* Overall rating hero */}
        <div className="flex items-center gap-4 bg-white/5 rounded-xl px-4 py-3 border border-white/8">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Overall Team Rating</div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 via-emerald-500 to-yellow-500 transition-all"
                style={{ width: `${overall}%` }}
              />
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-3xl font-black text-white leading-none">{overall}</div>
            <div className={cn("text-[10px] font-bold mt-0.5", overallColor)}>{overallLabel}</div>
          </div>
        </div>

        {/* Strongest / Weakest callouts */}
        {(strength.strongestPosition || strength.weakestPosition) && (
          <div className="grid grid-cols-2 gap-2">
            {strength.strongestPosition && (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                <span className="text-base">{POSITION_META[strength.strongestPosition]?.emoji ?? "⭐"}</span>
                <div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Strongest</div>
                  <div className="text-xs font-bold text-white">{POSITION_META[strength.strongestPosition]?.label}</div>
                </div>
                <div className="ml-auto text-sm font-black text-emerald-400">{positions[strength.strongestPosition]?.rating}</div>
              </div>
            )}
            {strength.weakestPosition && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                <span className={cn("text-base", positions[strength.weakestPosition]?.playerCount === 0 && "grayscale opacity-40")}>
                  {POSITION_META[strength.weakestPosition]?.emoji ?? "⚠️"}
                </span>
                <div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-red-400">Weakest</div>
                  <div className="text-xs font-bold text-white">{POSITION_META[strength.weakestPosition]?.label}</div>
                </div>
                <div className="ml-auto text-sm font-black text-red-400">
                  {positions[strength.weakestPosition]?.playerCount === 0 ? "—" : positions[strength.weakestPosition]?.rating}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Per-position bars */}
        <div className="space-y-2.5">
          <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Position Breakdown</div>
          {POSITION_ORDER.map(pos => {
            const meta  = POSITION_META[pos];
            const data  = positions[pos] ?? { rating: 0, playerCount: 0, topPlayer: null };
            const pct   = maxRating > 0 ? (data.rating / maxRating) * 100 : 0;
            const rl    = ratingLabel(data.rating);
            const isStrongest = strength.strongestPosition === pos;
            const isWeakest   = strength.weakestPosition === pos && data.playerCount > 0;

            return (
              <div key={pos} className={cn(
                "grid items-center gap-2 rounded-lg px-3 py-2 transition-colors",
                "grid-cols-[1.5rem_5rem_1fr_2.5rem]",
                isStrongest && "bg-emerald-500/8 border border-emerald-500/15",
                isWeakest   && "bg-red-500/8 border border-red-500/15",
                !isStrongest && !isWeakest && "bg-white/4 border border-transparent",
              )}>
                {/* Emoji */}
                <span className={cn("text-base leading-none", data.playerCount === 0 && "grayscale opacity-30")}>
                  {meta.emoji}
                </span>

                {/* Label + top player */}
                <div className="min-w-0">
                  <div className={cn("text-[11px] font-bold leading-none", data.playerCount > 0 ? meta.accent : "text-white/30")}>
                    {meta.label}
                  </div>
                  <div className="text-[9px] text-white/30 truncate mt-0.5">
                    {data.topPlayer ?? (data.playerCount === 0 ? "No players" : "")}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", data.playerCount > 0 ? meta.bar : "bg-white/5")}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Rating + label */}
                <div className="text-right">
                  <div className={cn("text-sm font-black leading-none", data.playerCount > 0 ? meta.accent : "text-white/20")}>
                    {data.playerCount > 0 ? data.rating : "—"}
                  </div>
                  <div className={cn("text-[8px] font-semibold leading-none mt-0.5", rl.color)}>{rl.text}</div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

// ── Facilities Snapshot ────────────────────────────────────────────────────────
const MAX_FAC_LEVEL = 10;

type FacSnap = {
  key: string;
  name: string;
  navigateTo: string;
  Icon: React.ComponentType<{ className?: string }>;
  colour: string;         // tailwind colour name
  bar: string;            // bg-* for progress bar
  iconBg: string;         // bg-*/10 pill
  iconText: string;       // text-* for icon
  benefitAt: (l: number) => string;
};

const FAC_SNAPS: FacSnap[] = [
  {
    key: "training_complex", name: "Training Centre", navigateTo: "/training",
    Icon: Dumbbell, colour: "blue",
    bar: "bg-blue-500", iconBg: "bg-blue-500/15", iconText: "text-blue-500",
    benefitAt: (l) => l === 1 ? "Base training XP" : `+${Math.round((l - 1) * (20 / 9))}% training XP`,
  },
  {
    key: "medical_centre", name: "Medical Centre", navigateTo: "/medical",
    Icon: Heart, colour: "rose",
    bar: "bg-rose-500", iconBg: "bg-rose-500/15", iconText: "text-rose-500",
    benefitAt: (l) => l === 1 ? "Base recovery speed" : `+${Math.round((l - 1) * (25 / 9))}% recovery speed`,
  },
  {
    key: "gymnasium", name: "Gymnasium", navigateTo: "/facilities",
    Icon: FlameKindling, colour: "orange",
    bar: "bg-orange-500", iconBg: "bg-orange-500/15", iconText: "text-orange-500",
    benefitAt: (l) => l === 1 ? "Base strength training" : `+${Math.round((l - 1) * (15 / 9))}% power dev.`,
  },
  {
    key: "nutrition_centre", name: "Nutrition Centre", navigateTo: "/facilities",
    Icon: Salad, colour: "lime",
    bar: "bg-lime-500", iconBg: "bg-lime-500/15", iconText: "text-lime-500",
    benefitAt: (l) => l === 1 ? "Base nutrition support" : `−${Math.round((l - 1) * (3 / 9))} fatigue/session`,
  },
  {
    key: "youth_academy", name: "Youth Academy", navigateTo: "/youth-academy",
    Icon: Users, colour: "amber",
    bar: "bg-amber-500", iconBg: "bg-amber-500/15", iconText: "text-amber-500",
    benefitAt: (l) => {
      const labels = ["Basic prospects","Slightly improved","Improved quality","Better High potential",
        "Good High potential","Higher Elite chance","Regular Elite","Strong Elite","Elite & Generational","Maximum"];
      return labels[l - 1] ?? labels[0]!;
    },
  },
  {
    key: "scouting_department", name: "Scouting Dept", navigateTo: "/continental-scouting",
    Icon: Search, colour: "indigo",
    bar: "bg-indigo-500", iconBg: "bg-indigo-500/15", iconText: "text-indigo-500",
    benefitAt: (l) => l === 1 ? "Basic scouting" : `+${Math.round((l - 1) * (30 / 9))}% effectiveness`,
  },
  {
    key: "sports_science_lab", name: "Performance Centre", navigateTo: "/facilities",
    Icon: Beaker, colour: "teal",
    bar: "bg-teal-500", iconBg: "bg-teal-500/15", iconText: "text-teal-500",
    benefitAt: (l) => l === 1 ? "Base injury prevention" : `−${Math.round((l - 1) * (20 / 9))}% injury risk`,
  },
  {
    key: "commercial_department", name: "Commercial Dept", navigateTo: "/facilities",
    Icon: TrendingUp, colour: "violet",
    bar: "bg-violet-500", iconBg: "bg-violet-500/15", iconText: "text-violet-500",
    benefitAt: (l) => l === 1 ? "Base commercial" : `+${Math.round((l - 1) * (30 / 9))}% sponsorship`,
  },
  {
    key: "beach_resort", name: "Beach Resort", navigateTo: "/facilities",
    Icon: Umbrella, colour: "cyan",
    bar: "bg-cyan-500", iconBg: "bg-cyan-500/15", iconText: "text-cyan-500",
    benefitAt: (l) => l === 1 ? "Base morale boost" : `+${Math.round((l - 1) * (8 / 9))} morale/camp`,
  },
];

function FacilitiesSnapshot({
  facilities,
  budget,
}: {
  facilities: { type: string; level: number }[];
  budget: number;
}) {
  const [, navigate] = useLocation();
  if (!facilities || facilities.length === 0) return null;

  const byType = Object.fromEntries(facilities.map(f => [f.type, f.level]));

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Facilities
            </CardTitle>
          </div>
          <button
            onClick={() => navigate("/facilities")}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            Manage <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-9 gap-2">
          {FAC_SNAPS.map((fac) => {
            const level = byType[fac.key] ?? 1;
            const pct = (level / MAX_FAC_LEVEL) * 100;
            const upgradeCost = level * 20_000;
            const canUpgrade = level < MAX_FAC_LEVEL && budget >= upgradeCost;
            const isMax = level >= MAX_FAC_LEVEL;

            return (
              <button
                key={fac.key}
                onClick={() => navigate(fac.navigateTo)}
                className={cn(
                  "group relative flex flex-col items-center text-center rounded-xl border p-3 transition-all hover:shadow-md",
                  canUpgrade
                    ? "border-amber-400/60 bg-amber-50/50 dark:bg-amber-950/10 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                    : isMax
                    ? "border-yellow-400/40 bg-yellow-50/30 dark:bg-yellow-950/10 hover:border-yellow-400/60"
                    : "border-border/60 bg-card hover:border-border hover:bg-muted/30"
                )}
              >
                {/* Upgrade badge */}
                {canUpgrade && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 shadow-sm">
                    <ChevronUp className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                  </span>
                )}
                {isMax && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 shadow-sm">
                    <Star className="h-2.5 w-2.5 text-white fill-white" strokeWidth={0} />
                  </span>
                )}

                {/* Icon */}
                <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center mb-2 transition-transform group-hover:scale-110", fac.iconBg)}>
                  <fac.Icon className={cn("h-4.5 w-4.5", fac.iconText)} />
                </div>

                {/* Name */}
                <div className="text-[10px] font-bold text-foreground leading-tight mb-2 min-h-[2.4em] flex items-center justify-center">
                  {fac.name}
                </div>

                {/* Level */}
                <div className="w-full mb-1.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground font-semibold">Lv {level}</span>
                    <span className="text-[10px] text-muted-foreground/60">{MAX_FAC_LEVEL}</span>
                  </div>
                  {/* Segmented level bar */}
                  <div className="flex gap-px h-1.5 w-full">
                    {Array.from({ length: MAX_FAC_LEVEL }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "flex-1 rounded-sm transition-all",
                          i < level ? fac.bar : "bg-muted/50"
                        )}
                      />
                    ))}
                  </div>
                </div>

                {/* Bonus */}
                <div className="text-[9px] text-muted-foreground leading-tight line-clamp-2 min-h-[2em]">
                  {fac.benefitAt(level)}
                </div>

                {/* Upgrade cost hint */}
                {canUpgrade && (
                  <div className="mt-1.5 text-[9px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                    <Zap className="h-2.5 w-2.5" />
                    ${(upgradeCost / 1000).toFixed(0)}k
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
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

