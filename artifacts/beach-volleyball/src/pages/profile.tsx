import {
  useGetCareerSummary,
  getGetCareerSummaryQueryKey,
  useGetTrophyCabinet,
  getGetTrophyCabinetQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UserCog,
  Globe,
  Building2,
  DollarSign,
  CalendarDays,
  Activity,
  TrendingUp,
  TrendingDown,
  Trophy,
  Medal,
  Star,
  Percent,
  Sunset,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { RetireModal } from "@/components/career/RetireModal";

// ── Helpers ───────────────────────────────────────────────────────────────────

function repToStars(rep: number): number {
  if (rep >= 80) return 5;
  if (rep >= 60) return 4;
  if (rep >= 40) return 3;
  if (rep >= 20) return 2;
  return 1;
}

const REP_LABELS = ["Novice", "Developing", "Experienced", "Elite", "Legendary"] as const;

function calcWinPct(wins: number, total: number): string {
  if (total === 0) return "—";
  return `${Math.round((wins / total) * 100)}%`;
}

function fmtMoney(val: string | number): string {
  const n = Number(val);
  if (isNaN(n) || n === 0) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000).toLocaleString()}k`;
  return `$${n.toLocaleString()}`;
}

// ── RepStars ──────────────────────────────────────────────────────────────────

function RepStars({ stars }: { stars: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "h-5 w-5 transition-colors",
            n <= stars
              ? "text-amber-400 fill-amber-400"
              : "text-white/12 fill-white/5",
          )}
        />
      ))}
    </div>
  );
}

// ── StatTile ──────────────────────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  label,
  value,
  iconBg,
  iconColour,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  iconBg: string;
  iconColour: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/3 p-5 flex flex-col gap-3">
      <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", iconBg)}>
        <Icon className={cn("h-4 w-4", iconColour)} />
      </div>
      <div>
        <p className="text-[9px] uppercase tracking-widest text-white/40 font-semibold leading-none mb-1.5">
          {label}
        </p>
        <p className="text-2xl font-black text-white tabular-nums">{value}</p>
      </div>
    </div>
  );
}

// ── IdentityChip ──────────────────────────────────────────────────────────────

function IdentityChip({
  icon: Icon,
  label,
  value,
  isPlaceholder = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  isPlaceholder?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-white/30 shrink-0" />
        <span className="text-[9px] uppercase tracking-widest text-white/35 font-semibold truncate">
          {label}
        </span>
      </div>
      <span
        className={cn(
          "text-sm font-bold truncate",
          isPlaceholder ? "text-white/25 italic" : "text-white",
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ── HighlightRow ──────────────────────────────────────────────────────────────

function HighlightRow({
  icon: Icon,
  label,
  value,
  iconColour,
  note,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  iconColour: string;
  note?: string;
}) {
  return (
    <div className="flex items-center gap-4 py-4 border-b border-white/5 last:border-0">
      <div className="h-9 w-9 shrink-0 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center">
        <Icon className={cn("h-4 w-4", iconColour)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white/80">{label}</p>
        {note && (
          <p className="text-[10px] text-white/25 italic leading-tight mt-0.5">{note}</p>
        )}
      </div>
      <span className="text-lg font-black text-white tabular-nums shrink-0">{value}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ManagerProfile() {
  const [showRetire, setShowRetire] = useState(false);
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const { data: summary, isLoading: summaryLoading } = useGetCareerSummary({
    query: { queryKey: getGetCareerSummaryQueryKey() },
  });
  const { data: cabinet, isLoading: cabinetLoading } = useGetTrophyCabinet({
    query: { queryKey: getGetTrophyCabinetQueryKey() },
  });

  const isLoading = summaryLoading || cabinetLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-7 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const records = cabinet?.records;

  // ── Data (real or safe placeholder) ──
  const managerName    = summary?.managerName   ?? "Manager";
  const clubName       = summary?.clubName      ?? "No Club";
  const season         = summary?.season        ?? "Season 1";
  const worldRanking   = summary?.worldRanking  ?? null;
  const totalWins      = summary?.totalWins     ?? 0;
  const totalLosses    = summary?.totalLosses   ?? 0;
  const worldTitles    = summary?.worldTitles   ?? 0;
  const olympicMedals  = summary?.olympicMedals ?? 0;
  const matchesPlayed  = totalWins + totalLosses;
  const seasonsManaged = records?.seasonsManaged ?? 0;
  const careerEarnings = records?.mostPrizeMoney ?? "0";

  // TODO: expose reputation (0–100) from team record via API
  const PLACEHOLDER_REPUTATION = 50;
  const stars = repToStars(PLACEHOLDER_REPUTATION);

  // TODO: expose manager salary from contracts table via API
  const PLACEHOLDER_SALARY = "$5,000 / season";

  const seasonsLabel =
    seasonsManaged === 0
      ? "< 1 season"
      : `${seasonsManaged} season${seasonsManaged === 1 ? "" : "s"}`;

  return (
    <>
    <div className="space-y-6">

      {/* ── Page heading ── */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">Manager Profile</h1>
        <p className="text-sm text-white/50 mt-1">
          Your identity, reputation and career at a glance.
        </p>
      </div>

      {/* ── Hero card ── */}
      <div className="rounded-2xl border border-white/10 bg-white/3 p-6 flex flex-col sm:flex-row sm:items-center gap-5">
        {/* Avatar */}
        <div className="h-20 w-20 shrink-0 rounded-2xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
          <UserCog className="h-10 w-10 text-purple-400" />
        </div>

        {/* Name + rep */}
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <h2 className="text-3xl font-black text-white leading-none truncate">{managerName}</h2>
            <p className="text-sm text-white/45 mt-1 font-medium">
              Head Coach · {clubName} · {season}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <RepStars stars={stars} />
            <span className="text-[10px] text-white/35 uppercase tracking-widest font-semibold">
              {REP_LABELS[stars - 1]} Manager
            </span>
          </div>
        </div>

        {/* Right column: rank + retire */}
        <div className="flex flex-col items-end gap-3 shrink-0">
          {worldRanking != null && (
            <div className="text-center px-5 py-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
              <p className="text-[9px] text-white/40 uppercase tracking-widest font-semibold">World Rank</p>
              <p className="text-2xl font-black text-amber-400 tabular-nums">#{worldRanking}</p>
            </div>
          )}
          <button
            onClick={() => setShowRetire(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-orange-500/25 bg-orange-500/8 text-[11px] font-bold text-orange-300/80 hover:bg-orange-500/15 hover:text-orange-300 transition-colors"
          >
            <Sunset className="h-3.5 w-3.5" />
            Retire
          </button>
        </div>
      </div>

      {/* ── Identity strip ── */}
      <div className="rounded-2xl border border-white/10 bg-white/3 px-6 py-5 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-5">
        <IdentityChip
          icon={Globe}
          label="Nationality"
          value="Not set"
          isPlaceholder
        />
        <IdentityChip
          icon={Building2}
          label="Current Club"
          value={clubName}
        />
        <IdentityChip
          icon={DollarSign}
          label="Current Salary"
          value={PLACEHOLDER_SALARY}
          isPlaceholder
        />
        <IdentityChip
          icon={CalendarDays}
          label="Years Managed"
          value={seasonsLabel}
        />
      </div>

      {/* ── Match stat tiles ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile
          icon={Activity}
          label="Matches Played"
          value={matchesPlayed}
          iconBg="bg-slate-500/20"
          iconColour="text-slate-300"
        />
        <StatTile
          icon={TrendingUp}
          label="Wins"
          value={totalWins}
          iconBg="bg-emerald-500/15"
          iconColour="text-emerald-400"
        />
        <StatTile
          icon={TrendingDown}
          label="Losses"
          value={totalLosses}
          iconBg="bg-rose-500/15"
          iconColour="text-rose-400"
        />
        <StatTile
          icon={Percent}
          label="Win Rate"
          value={calcWinPct(totalWins, matchesPlayed)}
          iconBg="bg-amber-500/15"
          iconColour="text-amber-400"
        />
      </div>

      {/* ── Career highlights ── */}
      <div className="rounded-2xl border border-white/10 bg-white/3 px-6">
        <div className="pt-5 pb-1">
          <p className="text-[9px] uppercase tracking-widest text-white/35 font-semibold">
            Career Highlights
          </p>
        </div>

        <HighlightRow
          icon={Trophy}
          label="Titles Won"
          value={worldTitles}
          iconColour="text-yellow-400"
        />
        <HighlightRow
          icon={Medal}
          label="Olympic Medals"
          value={olympicMedals}
          iconColour="text-amber-300"
        />
        <HighlightRow
          icon={CalendarDays}
          label="Years Managed"
          value={seasonsLabel}
          iconColour="text-blue-400"
        />
        <HighlightRow
          icon={DollarSign}
          label="Career Earnings"
          value={fmtMoney(careerEarnings)}
          iconColour="text-emerald-400"
        />
        <HighlightRow
          icon={DollarSign}
          label="Current Salary"
          value={PLACEHOLDER_SALARY}
          iconColour="text-violet-400"
          note="Placeholder — contract data coming soon"
        />
      </div>

    </div>

    {/* ── Retire modal ── */}
    {showRetire && (
      <RetireModal
        onClose={() => setShowRetire(false)}
        onRetired={() => {
          setShowRetire(false);
          sessionStorage.removeItem("bvp-title-dismissed");
          window.location.href = "/";
        }}
      />
    )}
    </>
  );
}
