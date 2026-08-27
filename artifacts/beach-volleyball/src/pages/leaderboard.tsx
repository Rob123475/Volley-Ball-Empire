import {
  useGetLeaderboard,
  getGetLeaderboardQueryKey,
  getGetDashboardQueryKey,
  useGetDashboard,
  useListLocations,
  getListLocationsQueryKey,
  useGetCurrentSeason,
  getGetCurrentSeasonQueryKey,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Medal, Star, TrendingUp, Globe, Zap, Crown } from "lucide-react";

const CHAMP_IMAGE = "/images/hero-women-volleyball.webp";

function cn(...inputs: (string | false | null | undefined)[]) {
  return inputs.filter(Boolean).join(" ");
}

const RANK_STYLES: Record<
  number,
  { bg: string; border: string; text: string; glow: string }
> = {
  1: {
    bg: "bg-gradient-to-r from-amber-400/20 via-yellow-300/10 to-amber-400/20",
    border: "border-l-4 border-l-amber-400",
    text: "text-amber-500",
    glow: "shadow-[0_0_12px_rgba(251,191,36,0.25)]",
  },
  2: {
    bg: "bg-gradient-to-r from-slate-300/15 via-gray-200/10 to-slate-300/15",
    border: "border-l-4 border-l-slate-400",
    text: "text-slate-400",
    glow: "shadow-[0_0_8px_rgba(148,163,184,0.2)]",
  },
  3: {
    bg: "bg-gradient-to-r from-orange-400/15 via-amber-600/10 to-orange-400/15",
    border: "border-l-4 border-l-orange-500",
    text: "text-orange-500",
    glow: "shadow-[0_0_8px_rgba(249,115,22,0.2)]",
  },
};

const getMedalIcon = (rank: number) => {
  if (rank === 1)
    return (
      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-400/20">
        <Crown className="h-4 w-4 text-amber-400 fill-amber-400" />
      </span>
    );
  if (rank === 2)
    return (
      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-300/20">
        <Medal className="h-4 w-4 text-slate-400 fill-slate-400" />
      </span>
    );
  if (rank === 3)
    return (
      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-400/20">
        <Medal className="h-4 w-4 text-orange-500 fill-orange-500" />
      </span>
    );
  return (
    <span className="w-8 h-8 flex items-center justify-center text-sm font-bold text-muted-foreground">
      #{rank}
    </span>
  );
};

const WinBar = ({ rate }: { rate: number }) => (
  <div className="flex flex-col items-center gap-1">
    <span className="text-xs font-bold tabular-nums">{rate}%</span>
    <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className={cn(
          "h-full rounded-full",
          rate >= 70
            ? "bg-emerald-500"
            : rate >= 50
            ? "bg-sky-500"
            : rate >= 30
            ? "bg-amber-400"
            : "bg-rose-400"
        )}
        style={{ width: `${rate}%` }}
      />
    </div>
  </div>
);

export default function Leaderboard() {
  const { data: dashboard } = useGetDashboard({
    query: { queryKey: getGetDashboardQueryKey() },
  });

  const { data: rankings, isLoading } = useGetLeaderboard({
    query: { queryKey: getGetLeaderboardQueryKey() },
  });

  // These three figures were hardcoded as "128 Teams Active", "Across 10 world
  // locations" and "New season every 11 rounds" — all seed-era placeholders,
  // and all wrong. Derive them so they cannot go stale again as the world grows.
  const { data: locations } = useListLocations({
    query: { queryKey: getListLocationsQueryKey() },
  });
  const { data: currentSeason } = useGetCurrentSeason({
    query: { queryKey: getGetCurrentSeasonQueryKey(), retry: false },
  });

  const activeTeamCount = rankings?.length ?? 0;
  const venueCount      = locations?.length ?? 0;
  const roundsPerSeason = currentSeason?.totalRounds ?? null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-56 w-full rounded-2xl" />
        <Skeleton className="h-[400px] w-full rounded-2xl" />
      </div>
    );
  }

  const userTeam = dashboard?.team?.name;
  const top3 = rankings?.slice(0, 3) ?? [];
  const rest = rankings?.slice(3) ?? [];

  return (
    <div className="space-y-8">

      {/* ── Hero banner ─────────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden h-56 md:h-64 shadow-xl">
        <img
          src={CHAMP_IMAGE}
          alt="World Championship Beach Volleyball"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        {/* dark + colour gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#004d7a]/90 via-[#0077B6]/70 to-[#F4A261]/40" />
        {/* bottom fade so content doesn't clash */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        <div className="relative h-full flex flex-col justify-end p-6 md:p-8">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="h-5 w-5 text-amber-400 fill-amber-400" />
                <span className="text-amber-300 text-xs font-bold uppercase tracking-widest">
                  Volleyball Empire · World Tour
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-white leading-tight drop-shadow">
                Global Leaderboard
              </h1>
              <p className="text-white/70 text-sm mt-1">
                The finest women's beach volleyball teams competing worldwide.
              </p>
            </div>
            {/* live badge */}
            <div className="hidden md:flex items-center gap-1.5 bg-rose-500/90 px-3 py-1.5 rounded-full shadow">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span className="text-white text-xs font-bold uppercase tracking-wide">
                Live Season
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Podium top-3 ────────────────────────────────────────────── */}
      {top3.length > 0 && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          {/* 2nd — left */}
          {top3[1] && (
            <PodiumCard
              entry={top3[1]}
              isUser={top3[1].teamName === userTeam}
              gradient="from-slate-700 to-slate-900"
              ringColor="ring-slate-400"
              iconBg="bg-slate-400/20"
              medalBg="bg-slate-400"
              medalText="2nd"
              rankLabel="Silver"
              subtitleColor="text-slate-300"
              order="sm:order-first"
              height="sm:mt-6"
            />
          )}
          {/* 1st — centre / tallest */}
          <PodiumCard
            entry={top3[0]}
            isUser={top3[0].teamName === userTeam}
            gradient="from-amber-500 to-orange-600"
            ringColor="ring-amber-400"
            iconBg="bg-amber-400/20"
            medalBg="bg-amber-400"
            medalText="1st"
            rankLabel="Champion"
            subtitleColor="text-amber-200"
            order="sm:order-2"
            height=""
            champion
          />
          {/* 3rd — right */}
          {top3[2] && (
            <PodiumCard
              entry={top3[2]}
              isUser={top3[2].teamName === userTeam}
              gradient="from-orange-700 to-amber-900"
              ringColor="ring-orange-500"
              iconBg="bg-orange-500/20"
              medalBg="bg-orange-500"
              medalText="3rd"
              rankLabel="Bronze"
              subtitleColor="text-orange-300"
              order="sm:order-last"
              height="sm:mt-10"
            />
          )}
        </div>
      )}

      {/* ── Full rankings table ──────────────────────────────────────── */}
      <div className="rounded-2xl border border-border overflow-hidden shadow-md bg-card">
        {/* coloured header */}
        <div className="px-5 py-3 bg-gradient-to-r from-primary to-sky-700 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-white/80" />
          <span className="text-white font-bold text-sm uppercase tracking-wider">
            Full Rankings
          </span>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
              <th className="py-2.5 px-4 text-left w-16">Rank</th>
              <th className="py-2.5 px-4 text-left">Team</th>
              <th className="py-2.5 px-4 text-left hidden sm:table-cell">Manager</th>
              <th className="py-2.5 px-4 text-center">W</th>
              <th className="py-2.5 px-4 text-center">L</th>
              <th className="py-2.5 px-4 text-center hidden md:table-cell">Win %</th>
              <th className="py-2.5 px-4 text-right">Rep</th>
            </tr>
          </thead>
          <tbody>
            {rankings?.map((entry) => {
              const isUser = entry.teamName === userTeam;
              const winRate =
                entry.wins + entry.losses > 0
                  ? Math.round(
                      (entry.wins / (entry.wins + entry.losses)) * 100
                    )
                  : 0;
              const style = RANK_STYLES[entry.rank];

              return (
                <tr
                  key={entry.rank}
                  className={cn(
                    "border-b border-border/50 transition-colors hover:bg-muted/30",
                    style?.bg,
                    style?.border,
                    style?.glow,
                    isUser && !style &&
                      "bg-primary/5 border-l-4 border-l-primary"
                  )}
                >
                  <td className="py-3 px-4">{getMedalIcon(entry.rank)}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "font-bold",
                          style?.text ?? (isUser ? "text-primary" : "")
                        )}
                      >
                        {entry.teamName}
                      </span>
                      {isUser && (
                        <Badge
                          className="text-[9px] h-4 bg-primary/20 text-primary border-primary/30 px-1.5"
                          variant="outline"
                        >
                          YOU
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground hidden sm:table-cell">
                    {entry.username ?? "—"}
                  </td>
                  <td className="py-3 px-4 text-center font-semibold text-emerald-500">
                    {entry.wins}
                  </td>
                  <td className="py-3 px-4 text-center font-semibold text-rose-500">
                    {entry.losses}
                  </td>
                  <td className="py-3 px-4 text-center hidden md:table-cell">
                    <WinBar rate={winRate} />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={cn(
                        "flex items-center justify-end gap-1 font-black",
                        style?.text ?? "text-secondary"
                      )}
                    >
                      <Star className="h-3 w-3 fill-current" />
                      {entry.reputation}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Info cards ───────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard
          gradient="from-amber-500 to-orange-500"
          icon={<Trophy className="h-6 w-6 text-white" />}
          label="World Series Finals"
          sub="Qualification ends in 12 days"
          detail="Top 8 qualify automatically"
        />
        <InfoCard
          gradient="from-sky-500 to-primary"
          icon={<Zap className="h-6 w-6 text-white" />}
          label="Reputation Bonus"
          sub="Next tier at 2,500 REP"
          detail="Win streaks multiply your bonus"
        />
        <InfoCard
          gradient="from-fuchsia-500 to-violet-600"
          icon={<Globe className="h-6 w-6 text-white" />}
          label={`${activeTeamCount} ${activeTeamCount === 1 ? "Team" : "Teams"} Ranked`}
          sub={venueCount > 0 ? `Across ${venueCount} world venues` : "World Tour venues"}
          detail={roundsPerSeason ? `${roundsPerSeason} rounds per season` : "One season per calendar year"}
        />
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

interface PodiumEntry {
  rank: number;
  teamName: string;
  username?: string | null;
  wins: number;
  losses: number;
  reputation: number;
}

function PodiumCard({
  entry,
  isUser,
  gradient,
  ringColor,
  iconBg,
  medalBg,
  medalText,
  rankLabel,
  subtitleColor,
  order,
  height,
  champion,
}: {
  entry: PodiumEntry;
  isUser: boolean;
  gradient: string;
  ringColor: string;
  iconBg: string;
  medalBg: string;
  medalText: string;
  rankLabel: string;
  subtitleColor: string;
  order: string;
  height: string;
  champion?: boolean;
}) {
  const winRate =
    entry.wins + entry.losses > 0
      ? Math.round((entry.wins / (entry.wins + entry.losses)) * 100)
      : 0;

  return (
    <div
      className={cn(
        "relative rounded-2xl overflow-hidden shadow-lg",
        `bg-gradient-to-br ${gradient}`,
        champion && `ring-2 ${ringColor} ring-offset-2 ring-offset-background`,
        order,
        height
      )}
    >
      {/* sparkle bar at top for champion */}
      {champion && (
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-300 via-yellow-100 to-amber-300" />
      )}

      <div className="p-5 flex flex-col gap-3">
        {/* rank pill */}
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-full",
              medalBg,
              "text-white"
            )}
          >
            {rankLabel}
          </span>
          {champion && (
            <Crown className="h-5 w-5 text-amber-300 fill-amber-300 animate-pulse" />
          )}
          {isUser && (
            <Badge className="text-[9px] h-4 bg-white/20 text-white border-white/30 px-1.5">
              YOU
            </Badge>
          )}
        </div>

        {/* avatar placeholder */}
        <div
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center text-xl font-black text-white shadow-inner",
            iconBg,
            "ring-2 ring-white/30"
          )}
        >
          {entry.teamName.charAt(0)}
        </div>

        {/* team info */}
        <div>
          <p className="font-black text-white text-base leading-snug">
            {entry.teamName}
          </p>
          <p className={cn("text-xs", subtitleColor)}>
            {entry.username ?? "AI Manager"}
          </p>
        </div>

        {/* stats row */}
        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/20">
          <div className="text-center">
            <p className="text-white font-black text-lg leading-none">{entry.wins}</p>
            <p className="text-white/60 text-[10px] uppercase">Wins</p>
          </div>
          <div className="text-center">
            <p className="text-white font-black text-lg leading-none">{winRate}%</p>
            <p className="text-white/60 text-[10px] uppercase">Rate</p>
          </div>
          <div className="text-center">
            <p className="text-white font-black text-lg leading-none">{entry.reputation}</p>
            <p className="text-white/60 text-[10px] uppercase">Rep</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  gradient,
  icon,
  label,
  sub,
  detail,
}: {
  gradient: string;
  icon: React.ReactNode;
  label: string;
  sub: string;
  detail: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl p-5 bg-gradient-to-br shadow-md flex gap-4 items-start",
        gradient
      )}
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="font-black text-white text-base leading-snug">{label}</p>
        <p className="text-white/70 text-xs mt-0.5">{sub}</p>
        <p className="text-white/50 text-[11px] mt-1">{detail}</p>
      </div>
    </div>
  );
}
