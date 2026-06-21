import {
  useListMatches, getListMatchesQueryKey,
  useListOlympicCountries, getListOlympicCountriesQueryKey,
  useGetOlympicSelection, getGetOlympicSelectionQueryKey,
  useSaveOlympicSelection,
} from "@workspace/api-client-react";
import type { OlympicPlayer } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, CheckCircle2, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

// ── Olympics constants ─────────────────────────────────────────────────────
const CURRENT_YEAR = 2026;
const OLYMPICS_BASE_YEAR = 2024;
const OLYMPICS_CYCLE = 4;

function getNextOlympicsYear(fromYear: number): number {
  let y = OLYMPICS_BASE_YEAR;
  while (y <= fromYear) y += OLYMPICS_CYCLE;
  return y;
}

const NEXT_OLYMPICS_YEAR = getNextOlympicsYear(CURRENT_YEAR);
const SEASONS_UNTIL_OLYMPICS = NEXT_OLYMPICS_YEAR - CURRENT_YEAR;

const OLYMPICS_HOSTS: Record<number, { city: string; flag: string; country: string }> = {
  2024: { city: "Paris",       flag: "🇫🇷", country: "France"    },
  2028: { city: "Los Angeles", flag: "🇺🇸", country: "USA"       },
  2032: { city: "Brisbane",    flag: "🇦🇺", country: "Australia" },
  2036: { city: "TBD",         flag: "🌍", country: "TBD"        },
};

const STAGES = [
  { id: "group",  label: "Group Stage",        sublabel: "12 teams · 3 groups of 4",              medal: null,     },
  { id: "qf",     label: "Quarter Finals",     sublabel: "Top 2 from each group + 2 best 3rd",    medal: null,     },
  { id: "sf",     label: "Semi Finals",        sublabel: "4 teams compete for finals spots",       medal: null,     },
  { id: "bronze", label: "Bronze Medal Match", sublabel: "Semi-final losers compete for 🥉",       medal: "bronze", },
  { id: "gold",   label: "Gold Medal Match",   sublabel: "Champions crowned on the sand",          medal: "gold",   },
];

function qualPointsForWin(prizeAmount: number | null | undefined): number {
  const p = prizeAmount ?? 0;
  if (p >= 500_000) return 200;
  if (p >= 80_000)  return 120;
  if (p >= 50_000)  return 80;
  if (p >= 20_000)  return 40;
  if (p >= 10_000)  return 20;
  return 10;
}

const QUAL_POINTS_LEGEND = [
  { label: "Bronze",            pts: 10  },
  { label: "Silver",            pts: 20  },
  { label: "Gold",              pts: 40  },
  { label: "Elite",             pts: 80  },
  { label: "Continental Final", pts: 120 },
];
const QUAL_TARGET = 400;

// ── Helpers ────────────────────────────────────────────────────────────────
function avgRating(p: OlympicPlayer) {
  return Math.round((p.speed + p.power + p.defense + p.serve + p.block + p.stamina) / 6);
}

function OlympicRings() {
  const rings = [
    { color: "#0085C7", cx: 20,  cy: 20 },
    { color: "#F4C300", cx: 48,  cy: 20 },
    { color: "#000000", cx: 76,  cy: 20 },
    { color: "#009F6B", cx: 104, cy: 20 },
    { color: "#DF0024", cx: 132, cy: 20 },
  ];
  return (
    <svg viewBox="0 0 152 40" className="h-7 w-auto opacity-80" aria-label="Olympic rings">
      {rings.map((r, i) => (
        <circle key={i} cx={r.cx} cy={r.cy} r={16} fill="none" stroke={r.color} strokeWidth="4.5" />
      ))}
    </svg>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-4 text-center", accent ? "bg-primary/5 border-primary/30" : "bg-muted/30 border-border")}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-black mt-1", accent && "text-primary")}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function MedalBadge({ type }: { type: "gold" | "silver" | "bronze" }) {
  const cfg = {
    gold:   { bg: "bg-yellow-400/20 border-yellow-400/50", text: "text-yellow-600 dark:text-yellow-400", emoji: "🥇", label: "GOLD"   },
    silver: { bg: "bg-slate-300/20 border-slate-400/40",   text: "text-slate-600  dark:text-slate-400",  emoji: "🥈", label: "SILVER" },
    bronze: { bg: "bg-amber-700/15 border-amber-600/30",   text: "text-amber-700  dark:text-amber-500",  emoji: "🥉", label: "BRONZE" },
  }[type];
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border-2 py-6 px-4", cfg.bg)}>
      <span className="text-5xl mb-2">{cfg.emoji}</span>
      <span className={cn("text-xs font-black uppercase tracking-widest", cfg.text)}>{cfg.label}</span>
    </div>
  );
}

function PlayerSquadCard({ player }: { player: OlympicPlayer }) {
  const rating = avgRating(player);
  return (
    <div className={cn(
      "rounded-xl border p-3 flex items-center gap-3",
      player.isReserve
        ? "bg-amber-500/5 border-amber-500/20"
        : "bg-muted/20 border-border"
    )}>
      <img
        src={player.imageUrl ?? `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=b6e3f4,c0aede&backgroundType=gradientLinear`}
        alt={player.name}
        className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-sm truncate">{player.name}</span>
          {player.isReserve && (
            <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-[9px] px-1.5 h-4 flex-shrink-0">
              Olympic Reserve
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">Age {player.age}</span>
          <span className="text-xs font-bold text-primary">OVR {rating}</span>
        </div>
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {(["speed", "power", "defense", "serve", "block", "stamina"] as const).map((stat) => (
            <div key={stat} className="text-center">
              <div className="text-[9px] text-muted-foreground uppercase">{stat.slice(0, 3)}</div>
              <div className="text-[10px] font-black text-foreground">{player[stat]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CountryCard({
  country, flag, playerCount, squad, onSelect, saving,
}: {
  country: string;
  flag: string;
  playerCount: number;
  squad: OlympicPlayer[];
  onSelect: () => void;
  saving: boolean;
}) {
  const reserveCount = squad.filter((p) => p.isReserve).length;
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 hover:border-primary/40 hover:shadow-md transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-3xl">{flag}</span>
          <div>
            <p className="font-black text-sm">{country}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <Badge variant="outline" className="text-[9px] h-4 px-1.5">{playerCount} pro player{playerCount !== 1 ? "s" : ""}</Badge>
              {reserveCount > 0 && (
                <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-[9px] h-4 px-1.5">+{reserveCount} reserve</Badge>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-1">
        {squad.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-3.5 h-3.5 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold flex-shrink-0">{i + 1}</span>
            <span className={cn("truncate", p.isReserve && "italic text-amber-600")}>{p.name}{p.isReserve ? " (Reserve)" : ""}</span>
            <span className="ml-auto font-bold text-foreground flex-shrink-0">OVR {avgRating(p)}</span>
          </div>
        ))}
      </div>
      <Button
        size="sm"
        className="w-full mt-1"
        onClick={onSelect}
        disabled={saving}
      >
        {saving ? "Saving…" : `Represent ${flag} ${country}`}
        <ChevronRight className="h-3.5 w-3.5 ml-1" />
      </Button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function WorldTourLocations() {
  const queryClient = useQueryClient();
  const [isChanging, setIsChanging] = useState(false);

  const { data: matches, isLoading: matchLoading } = useListMatches({
    query: { queryKey: getListMatchesQueryKey() },
  });
  const { data: countries, isLoading: countriesLoading } = useListOlympicCountries({
    query: { queryKey: getListOlympicCountriesQueryKey() },
  });
  const {
    data: selection,
    isLoading: selectionLoading,
    isError: noSelection,
  } = useGetOlympicSelection({
    query: {
      queryKey: getGetOlympicSelectionQueryKey(),
      retry: false,
    },
  });
  const saveMutation = useSaveOlympicSelection();

  const isLoading = matchLoading || countriesLoading || selectionLoading;

  const handleSelectCountry = (country: string, flag: string, squad: OlympicPlayer[]) => {
    saveMutation.mutate(
      { data: { country, flag, squad } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetOlympicSelectionQueryKey() });
          setIsChanging(false);
        },
      }
    );
  };

  const hasSelection = !!selection && !noSelection;
  const showSelectionUI = !hasSelection || isChanging;

  // Qualification points from wins
  const completed = (matches ?? []).filter((m) => m.status === "completed");
  const wins = completed.filter((m) => (m.homeScore ?? 0) > (m.awayScore ?? 0));
  const qualPoints = wins.reduce((acc, m) => acc + qualPointsForWin(m.prizeAmount), 0);
  const qualPct = Math.min(Math.round((qualPoints / QUAL_TARGET) * 100), 100);

  const nextHost = OLYMPICS_HOSTS[NEXT_OLYMPICS_YEAR];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-10">

      {/* ── Hero banner ───────────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-6 py-8 shadow-xl">
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='1.5'/%3E%3Ccircle cx='23' cy='23' r='1.5'/%3E%3C/g%3E%3C/svg%3E\")" }}
        />
        <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="mb-3"><OlympicRings /></div>
            <div className="text-blue-300 text-xs font-bold uppercase tracking-widest mb-1">National Team Coach</div>
            <h1 className="text-3xl md:text-4xl font-black text-white leading-tight">
              Beach Volleyball<br />Olympics
            </h1>
            <p className="text-white/50 text-sm mt-2">
              {nextHost.flag} {nextHost.city} {NEXT_OLYMPICS_YEAR} · {SEASONS_UNTIL_OLYMPICS} seasons away
            </p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-2">
            {hasSelection && !isChanging ? (
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs px-3 py-1 font-bold gap-1.5">
                <CheckCircle2 className="h-3 w-3" />
                {selection.flag} {selection.country} Selected
              </Badge>
            ) : (
              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs px-3 py-1 font-bold">
                🏅 QUALIFYING PERIOD OPEN
              </Badge>
            )}
            <p className="text-white/40 text-xs">Seasons 2026–2027 count</p>
          </div>
        </div>
      </div>

      {/* ── Olympic Nation selection / display ──────────────────────── */}
      {showSelectionUI ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black uppercase tracking-wide">
                {hasSelection ? "Choose a Different Nation" : "Choose Your Olympic Nation"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Nations with enough eligible women players to form a 3-player squad
              </p>
            </div>
            {hasSelection && (
              <Button variant="outline" size="sm" onClick={() => setIsChanging(false)}>
                Cancel
              </Button>
            )}
          </div>

          {(!countries || countries.length === 0) ? (
            <div className="rounded-xl border border-border bg-muted/20 p-8 text-center">
              <p className="text-muted-foreground text-sm">No eligible countries found. Add players to the database first.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {countries.map((c) => (
                <CountryCard
                  key={c.country}
                  country={c.country}
                  flag={c.flag}
                  playerCount={c.playerCount}
                  squad={c.squad}
                  onSelect={() => handleSelectCountry(c.country, c.flag, c.squad)}
                  saving={saveMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── Selected country + squad ─────────────────────────────── */
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-r from-blue-600/10 to-primary/5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{selection!.flag}</span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Your Olympic Nation</p>
                <p className="font-black text-lg">{selection!.country}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setIsChanging(true)}>
              Change Nation
            </Button>
          </div>

          <div className="p-5 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Olympic Squad</p>
            <div className="grid gap-3 md:grid-cols-3">
              {(selection!.squad ?? []).map((player, i) => (
                <PlayerSquadCard key={i} player={player} />
              ))}
            </div>
            {(selection!.squad ?? []).some((p) => p.isReserve) && (
              <p className="text-[10px] text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                ⚡ Your squad includes an Olympic Reserve player — an athlete on the fringe of the pro tour.
                Reserve players are only available for the Olympics and do not join your regular club.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Key stats ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Next Olympics" value={String(NEXT_OLYMPICS_YEAR)} sub={`${nextHost.flag} ${nextHost.city}, ${nextHost.country}`} accent />
        <StatCard label="Seasons Remaining" value={String(SEASONS_UNTIL_OLYMPICS)} sub="to qualify" />
        <StatCard label="Qual. Points" value={String(qualPoints)} sub={`of ${QUAL_TARGET} target`} accent={qualPoints >= QUAL_TARGET} />
        <StatCard label="Season Wins" value={String(wins.length)} sub={`from ${completed.length} played`} />
      </div>

      {/* ── Qualification progress ────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black uppercase tracking-wide">Olympic Qualification</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Accumulate points across 2026 & 2027 World Tour seasons</p>
          </div>
          {qualPoints >= QUAL_TARGET ? (
            <Badge className="bg-emerald-500 text-white gap-1 px-3"><CheckCircle2 className="h-3 w-3" /> QUALIFIED</Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground gap-1 px-3"><Lock className="h-3 w-3" /> In Progress</Badge>
          )}
        </div>
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>{qualPoints} pts earned</span>
            <span>{QUAL_TARGET} pts needed</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-700", qualPct >= 100 ? "bg-emerald-500" : "bg-gradient-to-r from-blue-500 to-blue-400")}
              style={{ width: `${qualPct}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">{qualPct}% of qualification target</p>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2 pt-1">
          {QUAL_POINTS_LEGEND.map(({ label, pts }) => (
            <div key={label} className="rounded-lg bg-muted/40 p-2 text-center">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className="text-sm font-black text-primary">+{pts}</p>
              <p className="text-[9px] text-muted-foreground">pts/win</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tournament format ────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground px-1">Tournament Format</h2>
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {STAGES.map((stage, idx) => (
            <div key={stage.id} className={cn(
              "flex items-center gap-4 px-5 py-4 border-b last:border-b-0 border-border",
              stage.medal === "gold"   && "bg-yellow-400/5",
              stage.medal === "bronze" && "bg-amber-700/5",
            )}>
              <div className={cn(
                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black",
                stage.medal === "gold"   ? "bg-yellow-400 text-yellow-900" :
                stage.medal === "bronze" ? "bg-amber-600 text-white" :
                "bg-muted text-muted-foreground"
              )}>{idx + 1}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{stage.label}</span>
                  {stage.medal === "gold"   && <span className="text-base">🥇</span>}
                  {stage.medal === "bronze" && <span className="text-base">🥉</span>}
                </div>
                <p className="text-xs text-muted-foreground">{stage.sublabel}</p>
              </div>
              <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1 flex-shrink-0">
                <Lock className="h-2.5 w-2.5" /> {NEXT_OLYMPICS_YEAR}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {/* ── Medal cabinet ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground px-1">Medal Cabinet</h2>
        <div className="grid grid-cols-3 gap-4">
          <MedalBadge type="gold" />
          <MedalBadge type="silver" />
          <MedalBadge type="bronze" />
        </div>
        <p className="text-center text-xs text-muted-foreground pt-1">
          No Olympic medals yet · Qualify for {NEXT_OLYMPICS_YEAR} to compete
        </p>
      </div>

      {/* ── Past Olympics ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground px-1">Olympic History</h2>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
            <span className="text-3xl">🇫🇷</span>
            <div className="flex-1">
              <p className="font-black text-sm">Paris 2024</p>
              <p className="text-xs text-muted-foreground">Beach Volleyball completed · 24 nations competed</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-muted-foreground">YOUR RESULT</p>
              <Badge variant="outline" className="text-[10px] gap-1 mt-1"><Lock className="h-2.5 w-2.5" /> Pre-career</Badge>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
