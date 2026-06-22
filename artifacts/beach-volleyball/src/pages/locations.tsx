import {
  useListOlympicCountries, getListOlympicCountriesQueryKey,
  useGetOlympicSelection, getGetOlympicSelectionQueryKey,
  useSaveOlympicSelection,
  useClearOlympicSelection,
  useGetCurrentSeason, getGetCurrentSeasonQueryKey,
} from "@workspace/api-client-react";
import type { OlympicPlayer } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, CheckCircle2, ChevronRight, Timer, Globe, Medal } from "lucide-react";
import { FacilityBonusBanner } from "@/components/facility-bonus-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

// ── Olympic constants ─────────────────────────────────────────────────────
const OLYMPICS_BASE_YEAR = 2024;
const OLYMPICS_CYCLE     = 4;
// Window opens this many seasons BEFORE the Olympics year
const WINDOW_OPENS_SEASONS_BEFORE = 1;
// Fallback year used only while season data is loading
const CURRENT_YEAR_FALLBACK = 2026;

type OlympicPhase = "pre_window" | "window_open" | "olympic_active" | "concluded";

function getNextOlympicsYear(fromYear: number): number {
  let y = OLYMPICS_BASE_YEAR;
  while (y <= fromYear) y += OLYMPICS_CYCLE;
  return y;
}

function getOlympicPhase(currentYear: number, nextOlympicsYear: number): OlympicPhase {
  if (currentYear > nextOlympicsYear)  return "concluded";
  if (currentYear === nextOlympicsYear) return "olympic_active";
  if (currentYear >= nextOlympicsYear - WINDOW_OPENS_SEASONS_BEFORE) return "window_open";
  return "pre_window";
}

const OLYMPICS_HOSTS: Record<number, { city: string; flag: string; country: string }> = {
  2024: { city: "Paris",       flag: "🇫🇷", country: "France"    },
  2028: { city: "Los Angeles", flag: "🇺🇸", country: "USA"       },
  2032: { city: "Brisbane",    flag: "🇦🇺", country: "Australia" },
  2036: { city: "TBD",         flag: "🌍", country: "TBD"        },
};

const STAGES = [
  { id: "group",  label: "Group Stage",        sublabel: "12 teams · 3 groups of 4",            medal: null     },
  { id: "qf",     label: "Quarter Finals",     sublabel: "Top 2 from each group + 2 best 3rd",  medal: null     },
  { id: "sf",     label: "Semi Finals",        sublabel: "4 teams compete for finals spots",     medal: null     },
  { id: "bronze", label: "Bronze Medal Match", sublabel: "Semi-final losers compete for 🥉",     medal: "bronze" },
  { id: "gold",   label: "Gold Medal Match",   sublabel: "Champions crowned on the sand",        medal: "gold"   },
];

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
              <Badge variant="outline" className="text-[9px] h-4 px-1.5">{playerCount} active player{playerCount !== 1 ? "s" : ""}</Badge>
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
            <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", p.isReserve ? "bg-amber-400" : "bg-primary")} />
            <span className="truncate font-medium text-foreground">{p.name}</span>
            <span className="ml-auto flex-shrink-0 font-bold text-primary">OVR {avgRating(p)}</span>
          </div>
        ))}
      </div>
      <Button size="sm" className="w-full mt-1" onClick={onSelect} disabled={saving}>
        <ChevronRight className="h-4 w-4 mr-1" />
        Coach {country}
      </Button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function WorldTourLocations() {
  const queryClient = useQueryClient();
  const [isChanging, setIsChanging] = useState(false);
  const autoClearFired = useRef(false);

  const { data: season, isLoading: seasonLoading } = useGetCurrentSeason({
    query: { queryKey: getGetCurrentSeasonQueryKey() },
  });
  const { data: countries, isLoading: countriesLoading } = useListOlympicCountries({
    query: { queryKey: getListOlympicCountriesQueryKey() },
  });
  const {
    data: selection,
    isLoading: selectionLoading,
    isError: noSelection,
  } = useGetOlympicSelection({
    query: { queryKey: getGetOlympicSelectionQueryKey(), retry: false },
  });
  const saveMutation  = useSaveOlympicSelection();
  const clearMutation = useClearOlympicSelection();

  // ── Derived values ────────────────────────────────────────────────────
  const currentYear      = season?.year ?? CURRENT_YEAR_FALLBACK;
  const nextOlympicsYear = getNextOlympicsYear(currentYear);
  const phase            = getOlympicPhase(currentYear, nextOlympicsYear);
  const windowOpensYear  = nextOlympicsYear - WINDOW_OPENS_SEASONS_BEFORE;
  const seasonsUntilWindow  = Math.max(0, windowOpensYear - currentYear);
  const seasonsUntilOlympics = nextOlympicsYear - currentYear;
  const nextHost         = OLYMPICS_HOSTS[nextOlympicsYear] ?? { city: "TBD", flag: "🌍", country: "TBD" };
  const hasSelection     = !!selection && !noSelection;
  const showSelectionUI  = !hasSelection || isChanging;

  // ── Auto-clear wildcard players when Olympics conclude ─────────────────
  // Olympic Wildcard players exist only in olympic_selections.squad (id: null).
  // They are never in playersTable, contracts, draft, or rosters.
  // Deleting the selection row permanently removes them.
  useEffect(() => {
    if (phase === "concluded" && hasSelection && !autoClearFired.current && !clearMutation.isPending) {
      autoClearFired.current = true;
      clearMutation.mutate(undefined, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetOlympicSelectionQueryKey() });
        },
      });
    }
  }, [phase, hasSelection]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const isLoading = seasonLoading || countriesLoading || selectionLoading;

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

  // ── Hero badge per phase ─────────────────────────────────────────────
  const heroBadge = (() => {
    if (phase === "concluded")     return <Badge className="bg-slate-500/20 text-slate-300 border-slate-500/30 text-xs px-3 py-1 font-bold">✓ CONCLUDED</Badge>;
    if (phase === "olympic_active") return <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 text-xs px-3 py-1 font-bold">🏆 OLYMPICS {nextOlympicsYear}</Badge>;
    if (hasSelection && !isChanging) return (
      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs px-3 py-1 font-bold gap-1.5">
        <CheckCircle2 className="h-3 w-3" />
        {selection!.flag} {selection!.country} Selected
      </Badge>
    );
    if (phase === "window_open")   return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs px-3 py-1 font-bold">🏅 SELECTION WINDOW OPEN</Badge>;
    return (
      <Badge className="bg-slate-500/20 text-slate-300 border-slate-500/40 text-xs px-3 py-1 font-bold gap-1.5">
        <Lock className="h-3 w-3" /> WINDOW OPENS {windowOpensYear}
      </Badge>
    );
  })();

  const heroSub = (() => {
    if (phase === "concluded")      return `Season concluded · Next cycle begins ${nextOlympicsYear + 1}`;
    if (phase === "olympic_active") return `${nextHost.flag} ${nextHost.city} ${nextOlympicsYear} · Olympics are here!`;
    return `${nextHost.flag} ${nextHost.city} ${nextOlympicsYear} · ${seasonsUntilOlympics} season${seasonsUntilOlympics !== 1 ? "s" : ""} away`;
  })();

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
            <p className="text-white/50 text-sm mt-2">{heroSub}</p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-2">
            {heroBadge}
            {phase === "pre_window" && (
              <p className="text-white/30 text-xs">Eligibility scans active players by nationality</p>
            )}
            {(phase === "window_open" || phase === "olympic_active") && (
              <p className="text-white/40 text-xs">Eligibility based on active player pool · not win/loss</p>
            )}
          </div>
        </div>
      </div>

      <FacilityBonusBanner
        facilityType="olympic_performance_centre"
        facilityName="Olympic Performance Centre"
        getBonusText={(level) => `+${Math.round((level - 1) * (20 / 9))}% national squad preparation bonus`}
      />

      {/* ── Key stats ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Next Olympics" value={String(nextOlympicsYear)} sub={`${nextHost.flag} ${nextHost.city}`} accent />
        {phase === "pre_window" ? (
          <>
            <StatCard label="Window Opens" value={String(windowOpensYear)} sub={`${seasonsUntilWindow} season${seasonsUntilWindow !== 1 ? "s" : ""} away`} />
            <StatCard label="Eligible Nations" value={String(countries?.length ?? 0)} sub="based on current rosters" />
            <StatCard label="Selection" value="Locked" sub={`Opens season ${windowOpensYear}`} />
          </>
        ) : phase === "window_open" ? (
          <>
            <StatCard label="Window Open" value={`S${currentYear}`} sub="Select your nation" />
            <StatCard label="Eligible Nations" value={String(countries?.length ?? 0)} sub="active player pool" accent={!!countries?.length} />
            <StatCard label="Your Selection" value={hasSelection ? selection!.flag : "—"} sub={hasSelection ? selection!.country : "None chosen"} />
          </>
        ) : phase === "olympic_active" ? (
          <>
            <StatCard label="Olympics Season" value={String(nextOlympicsYear)} sub="Tournament active" accent />
            <StatCard label="Eligible Nations" value={String(countries?.length ?? 0)} sub="competing nations" />
            <StatCard label="Your Nation" value={hasSelection ? selection!.flag : "—"} sub={hasSelection ? selection!.country : "Not entered"} />
          </>
        ) : (
          <>
            <StatCard label="Next Cycle" value={String(getNextOlympicsYear(currentYear))} sub="Next Olympics" />
            <StatCard label="Window Opens" value={String(getNextOlympicsYear(currentYear) - WINDOW_OPENS_SEASONS_BEFORE)} sub="eligibility season" />
            <StatCard label="Status" value="Reset" sub="New cycle begins" />
          </>
        )}
      </div>

      {/* ── Phase: PRE_WINDOW — eligibility window closed ─────────────── */}
      {phase === "pre_window" && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-6 py-10 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
              <Timer className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-black">Eligibility Window Not Yet Open</h2>
              <p className="text-muted-foreground text-sm mt-1.5 max-w-md mx-auto">
                {seasonsUntilWindow === 1
                  ? "The eligibility window opens next season."
                  : `The eligibility window opens in ${seasonsUntilWindow} seasons.`}
                {" "}Active players are scanned by nationality — countries with 2+ players become eligible.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-5 max-w-lg mx-auto text-left space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">How eligibility works</p>
              <div className="space-y-2">
                {[
                  { icon: "🏅", label: "≥ 3 active players",  desc: "Country qualifies · top 3 form the squad" },
                  { icon: "⚡", label: "Exactly 2 players",   desc: "Qualifies + 1 Olympic Reserve wildcard added" },
                  { icon: "🔒", label: "Fewer than 2 players", desc: "Country cannot enter the Olympics" },
                ].map((r) => (
                  <div key={r.label} className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0">{r.icon}</span>
                    <div>
                      <p className="text-sm font-bold">{r.label}</p>
                      <p className="text-xs text-muted-foreground">{r.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground pt-1 border-t border-border">
                Eligibility is based on active player pool only — not win/loss record.
                Countries may appear or disappear as talent develops over multiple seasons.
                Olympic Reserve (Wildcard) players exist only during the eligibility window and Olympic competition.
              </p>
            </div>

            {countries && countries.length > 0 && (
              <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-3">
                  Current roster snapshot — {countries.length} nation{countries.length !== 1 ? "s" : ""} would be eligible today
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
                  {countries.map((c) => (
                    <div key={c.country} className="flex items-center gap-1.5 rounded-full bg-muted/40 border border-border px-3 py-1 text-xs">
                      <span>{c.flag}</span>
                      <span className="font-medium">{c.country}</span>
                      <Badge variant="outline" className="text-[9px] h-4 px-1 ml-0.5">{c.playerCount}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Phase: WINDOW_OPEN — nation selection ─────────────────────── */}
      {phase === "window_open" && (
        showSelectionUI ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black uppercase tracking-wide">
                  {hasSelection ? "Choose a Different Nation" : "Choose Your Olympic Nation"}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Nations with enough active players to form a 3-player squad · Eligibility based on player pool
                </p>
              </div>
              {hasSelection && (
                <Button variant="outline" size="sm" onClick={() => setIsChanging(false)}>Cancel</Button>
              )}
            </div>
            {(!countries || countries.length === 0) ? (
              <div className="rounded-xl border border-border bg-muted/20 p-8 text-center">
                <Globe className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No eligible countries found.</p>
                <p className="text-xs text-muted-foreground mt-1">Countries need at least 2 active players in the player pool.</p>
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
          <SelectedSquadCard
            selection={selection!}
            onChangeClick={() => setIsChanging(true)}
            allowChange
          />
        )
      )}

      {/* ── Phase: OLYMPIC_ACTIVE — squad locked in ───────────────────── */}
      {phase === "olympic_active" && hasSelection && (
        <SelectedSquadCard selection={selection!} allowChange={false} />
      )}
      {phase === "olympic_active" && !hasSelection && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
          <p className="font-bold text-amber-600">No nation selected</p>
          <p className="text-xs text-muted-foreground mt-1">You did not select an Olympic nation during the eligibility window.</p>
        </div>
      )}

      {/* ── Phase: CONCLUDED ──────────────────────────────────────────── */}
      {phase === "concluded" && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-4">
          <div className="text-4xl">🏅</div>
          <div>
            <h2 className="text-xl font-black">Olympic Season Concluded</h2>
            <p className="text-muted-foreground text-sm mt-1">
              The {nextOlympicsYear} Olympics are complete. Olympic Reserve (Wildcard) players have been removed.
              The next eligibility window opens in season {getNextOlympicsYear(currentYear) - WINDOW_OPENS_SEASONS_BEFORE}.
            </p>
          </div>
          {clearMutation.isPending && (
            <p className="text-xs text-muted-foreground animate-pulse">Clearing Olympic squad data…</p>
          )}
        </div>
      )}

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
                {phase === "olympic_active"
                  ? <><Medal className="h-2.5 w-2.5" /> LIVE</>
                  : <><Lock className="h-2.5 w-2.5" /> {nextOlympicsYear}</>
                }
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {/* ── Medal cabinet ─────────────────────────────────────────────── */}
      {phase !== "pre_window" && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground px-1">Medal Cabinet</h2>
          <div className="grid grid-cols-3 gap-4">
            <MedalBadge type="gold" />
            <MedalBadge type="silver" />
            <MedalBadge type="bronze" />
          </div>
          <p className="text-center text-xs text-muted-foreground pt-1">
            No Olympic medals yet · {phase === "olympic_active" ? "Tournament underway" : `Qualify for ${nextOlympicsYear} to compete`}
          </p>
        </div>
      )}

      {/* ── Olympic History ────────────────────────────────────────────── */}
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

// ── Sub-component: selected squad card ───────────────────────────────────
function SelectedSquadCard({
  selection,
  onChangeClick,
  allowChange,
}: {
  selection: { flag: string; country: string; squad: OlympicPlayer[] };
  onChangeClick?: () => void;
  allowChange: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 bg-gradient-to-r from-blue-600/10 to-primary/5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{selection.flag}</span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Your Olympic Nation</p>
            <p className="font-black text-lg">{selection.country}</p>
          </div>
        </div>
        {allowChange && onChangeClick && (
          <Button variant="outline" size="sm" onClick={onChangeClick}>Change Nation</Button>
        )}
        {!allowChange && (
          <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30 text-xs gap-1">
            <Lock className="h-3 w-3" /> Locked In
          </Badge>
        )}
      </div>
      <div className="p-5 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Olympic Squad</p>
        <div className="grid gap-3 md:grid-cols-3">
          {(selection.squad ?? []).map((player, i) => (
            <PlayerSquadCard key={i} player={player} />
          ))}
        </div>
        {(selection.squad ?? []).some((p) => p.isReserve) && (
          <p className="text-[10px] text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            ⚡ Your squad includes an Olympic Reserve player — an athlete on the fringe of the pro tour.
            Reserve players exist only during the Olympics and are automatically removed afterwards.
            They do not join your regular club or appear in transfers, drafts, or contracts.
          </p>
        )}
      </div>
    </div>
  );
}
