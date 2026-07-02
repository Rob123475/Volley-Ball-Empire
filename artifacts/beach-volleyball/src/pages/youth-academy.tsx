import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  useGetContinentalRegions,
  useGetContinentalProspects,
  useGetYouthProspects,
  useSignYouthProspect,
  useIgnoreYouthProspect,
  getGetContinentalRegionsQueryKey,
  getGetContinentalProspectsQueryKey,
  getGetYouthProspectsQueryKey,
  getGetTeamRosterQueryKey,
  useGetYouthLeagueResults,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AvatarPortrait } from "@/components/player-portrait";
import { YouthPlayerCard, type YouthPlayerData } from "@/components/youth-player-card";
import rawYouthPlayers from "@/data/youthPlayers.json";
import {
  Globe,
  MapPin,
  Clock,
  Star,
  Radar,
  CheckCircle2,
  CircleDashed,
  DollarSign,
  UserPlus,
  Ban,
  Zap,
  Shield,
  Wind,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Sparkles,
  ExternalLink,
  AlertCircle,
  Search,
  CreditCard,
} from "lucide-react";

const ALL_YOUTH_PLAYERS = rawYouthPlayers as YouthPlayerData[];

// ── Elite event config ─────────────────────────────────────────────────────

const ELITE_EVENT_CONFIG: Record<string, {
  cardClass:   string;
  bannerClass: string;
  icon:        React.ReactNode;
}> = {
  "Generational Talent": {
    cardClass:   "border-purple-500/60 shadow-purple-500/15 shadow-lg",
    bannerClass: "bg-purple-500/10 border-purple-500/30 text-purple-300",
    icon:        <Sparkles className="h-3 w-3 text-purple-400" />,
  },
  "Olympic Wonderkid": {
    cardClass:   "border-amber-400/60 shadow-amber-400/15 shadow-lg",
    bannerClass: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    icon:        <Trophy className="h-3 w-3 text-amber-400" />,
  },
  "Physical Freak": {
    cardClass:   "border-orange-500/60 shadow-orange-500/15 shadow-lg",
    bannerClass: "bg-orange-500/10 border-orange-500/30 text-orange-300",
    icon:        <Zap className="h-3 w-3 text-orange-400" />,
  },
  "Local Hero": {
    cardClass:   "border-emerald-500/60 shadow-emerald-500/15 shadow-lg",
    bannerClass: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    icon:        <Star className="h-3 w-3 text-emerald-400" />,
  },
};

const POTENTIAL_COLOR: Record<string, string> = {
  Generational: "text-purple-600 border-purple-400 bg-purple-50 dark:bg-purple-950/30",
  Elite:        "text-blue-600 border-blue-400 bg-blue-50 dark:bg-blue-950/30",
  High:         "text-emerald-600 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30",
  Moderate:     "text-amber-600 border-amber-400 bg-amber-50 dark:bg-amber-950/30",
  Average:      "text-amber-600 border-amber-400 bg-amber-50 dark:bg-amber-950/30",
  Low:          "text-gray-500 border-gray-400 bg-gray-50 dark:bg-gray-900/30",
};

const REGION_ACCENT: Record<string, string> = {
  "Europe":        "text-blue-400",
  "Asia":          "text-emerald-400",
  "Africa":        "text-orange-400",
  "North America": "text-violet-400",
  "South America": "text-yellow-400",
  "Oceania":       "text-cyan-400",
};

const REGION_EMOJI: Record<string, string> = {
  "Europe": "🌍", "Asia": "🌏", "Africa": "🌍",
  "North America": "🌎", "South America": "🌎", "Oceania": "🌏",
};

// ── Page ──────────────────────────────────────────────────────────────────

export default function YouthAcademy() {
  const [, navigate] = useLocation();
  const { toast }   = useToast();
  const qc          = useQueryClient();
  const [cardPlayer, setCardPlayer] = useState<YouthPlayerData | null>(null);
  const [search, setSearch]         = useState("");

  const { data: regions,   isLoading: regionsLoading }   = useGetContinentalRegions();
  const { data: contProspects = [], isLoading: contLoading } = useGetContinentalProspects();
  const { data: allProspects  = [], isLoading: allLoading  } = useGetYouthProspects({
    query: { queryKey: getGetYouthProspectsQueryKey() },
  });
  const { data: leagueResults = [] } = useGetYouthLeagueResults();

  const signMutation   = useSignYouthProspect();
  const ignoreMutation = useIgnoreYouthProspect();

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ALL_YOUTH_PLAYERS;
    return ALL_YOUTH_PLAYERS.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        p.nationality.toLowerCase().includes(q) ||
        p.primaryRole.toLowerCase().includes(q),
    );
  }, [search]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetContinentalRegionsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetContinentalProspectsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetYouthProspectsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetTeamRosterQueryKey() });
  };

  const handleSign = (id: number, name: string) => {
    signMutation.mutate({ id }, {
      onSuccess: () => {
        invalidate();
        toast({ title: "Youth Signed!", description: `${name} has joined the Youth Academy.` });
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? "Could not sign prospect.";
        toast({ title: "Signing Failed", description: msg, variant: "destructive" });
      },
    });
  };

  const handleIgnore = (id: number, name: string) => {
    ignoreMutation.mutate({ id }, {
      onSuccess: () => {
        invalidate();
        toast({ title: "Prospect Dismissed", description: `${name} has been passed over.` });
      },
    });
  };

  // Active / completed missions from continental scouting
  const activeMissions   = regions?.filter((r) => r.activeMission?.status === "active")   ?? [];
  const completedMissions = regions?.filter((r) => r.activeMission?.status === "completed") ?? [];

  // Pending prospects: prefer continental data (richer), fallback to all
  const pendingProspects = contLoading ? allProspects.filter(p => p.status === "pending") : contProspects;

  const isMutating = signMutation.isPending || ignoreMutation.isPending;

  return (
    <div className="space-y-10">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Youth Academy</h2>
          <p className="text-muted-foreground mt-1">
            Develop the next generation. Scouts are deployed via Continental Scouting.
          </p>
        </div>
        <Button
          onClick={() => navigate("/continental-scouting")}
          className="gap-2 shrink-0"
        >
          <Globe className="h-4 w-4" />
          Open Continental Scouting
          <ExternalLink className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </div>

      {/* ── Active Missions ─────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Radar className="h-5 w-5 text-primary" />
          <h3 className="text-xl font-bold">Active Scouting Missions</h3>
          {activeMissions.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {activeMissions.length} in progress
            </Badge>
          )}
        </div>

        {regionsLoading ? (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
        ) : activeMissions.length === 0 && completedMissions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/10 p-8 text-center">
            <Radar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No scouts deployed</p>
            <p className="text-xs text-muted-foreground/60 mt-1 mb-4">
              Deploy scouts to find talent from Europe, South America, Africa and beyond.
            </p>
            <Button size="sm" onClick={() => navigate("/continental-scouting")} className="gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              Open Continental Scouting
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Active missions */}
            {activeMissions.map((r) => {
              const m = r.activeMission!;
              const accent = REGION_ACCENT[r.id] ?? "text-primary";
              const emoji  = REGION_EMOJI[r.id]  ?? "🌍";
              return (
                <div key={r.id} className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <Radar className="h-4 w-4 text-emerald-400 animate-pulse" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span>{emoji}</span>
                        <span className={cn("font-bold text-sm", accent)}>{r.name}</span>
                        <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                          Scouting
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {m.durationMonths}-month mission · {r.talentLevel} talent region
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Advance seasons to complete</span>
                  </div>
                </div>
              );
            })}

            {/* Completed missions awaiting collection */}
            {completedMissions.map((r) => {
              const m = r.activeMission!;
              const accent = REGION_ACCENT[r.id] ?? "text-primary";
              const emoji  = REGION_EMOJI[r.id]  ?? "🌍";
              return (
                <div key={r.id} className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span>{emoji}</span>
                        <span className={cn("font-bold text-sm", accent)}>{r.name}</span>
                        <Badge className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          Report Ready
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {m.prospectsFound} prospect{m.prospectsFound !== 1 ? "s" : ""} found — collect in Continental Scouting
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate("/continental-scouting")} className="gap-1.5 text-xs border-amber-500/40 text-amber-400 hover:bg-amber-950/30 shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Collect Prospects
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Discovered Prospects ─────────────────────────────────── */}
      {(allLoading || pendingProspects.length > 0) && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-blue-500" />
            <h3 className="text-xl font-bold">Scouting Reports</h3>
            {!allLoading && (
              <Badge variant="secondary" className="text-xs ml-1">
                {pendingProspects.length} prospect{pendingProspects.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground -mt-2">
            Sign prospects to reserve them for your Academy, or dismiss them to pass.
          </p>

          {allLoading ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {pendingProspects.map((p) => {
                const potLabel  = (p as any).scoutedPotentialLabel ?? (p as any).potentialStars ?? "Unknown";
                const potColor  = POTENTIAL_COLOR[potLabel] ?? "text-gray-400 border-gray-400/50 bg-gray-50 dark:bg-gray-900/20";
                const eliteEvent = (p as any).eliteEventType ?? null;
                const eliteCfg   = eliteEvent ? (ELITE_EVENT_CONFIG[eliteEvent] ?? null) : null;

                const specialityIcon =
                  p.speciality === "Power"       ? <Zap    className="h-3 w-3" /> :
                  p.speciality === "Defense"     ? <Shield className="h-3 w-3" /> :
                  p.speciality === "Serve"       ? <Wind   className="h-3 w-3" /> :
                  p.speciality === "Block"       ? <Shield className="h-3 w-3" /> :
                  p.speciality === "All-Rounder" ? <Trophy className="h-3 w-3" /> :
                                                   <Zap    className="h-3 w-3" />;

                return (
                  <div
                    key={p.id}
                    className={cn(
                      "rounded-xl border bg-card p-4 flex flex-col gap-3",
                      eliteCfg ? eliteCfg.cardClass : "border-border shadow-sm",
                    )}
                  >
                    {eliteCfg && eliteEvent && (
                      <div className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border", eliteCfg.bannerClass)}>
                        {eliteCfg.icon}
                        <span className="text-[11px] font-black uppercase tracking-wide">{eliteEvent}</span>
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <AvatarPortrait
                        name={p.name}
                        imageUrl={(p as any).imageUrl}
                        continent={p.continent}
                        playerType="youth"
                        size={44}
                        className="mt-0.5 shrink-0"
                      />
                      <div className="flex items-start justify-between gap-2 flex-1 min-w-0">
                        <div className="min-w-0">
                          <p className="font-bold text-sm leading-tight truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground">Age {p.age} · {p.continent}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-lg font-black text-primary leading-none">{p.currentRating}</div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Rating</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={cn("text-[10px] font-bold border", potColor)}>
                        {potLabel}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-medium gap-1 text-muted-foreground">
                        {specialityIcon}
                        {p.speciality}
                      </Badge>
                    </div>

                    {(p as any).discoveredBy && (
                      <p className="text-[10px] text-muted-foreground/70 italic leading-tight -mt-1">
                        {(p as any).discoveredBy}
                      </p>
                    )}

                    {(p as any).scoutingReportText && (
                      <div className="rounded-md bg-muted/20 border border-border/40 px-2.5 py-2">
                        <p className="text-[10px] text-muted-foreground leading-relaxed italic line-clamp-3">
                          "{(p as any).scoutingReportText}"
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-1 text-sm font-semibold text-amber-600">
                      <DollarSign className="h-3.5 w-3.5" />
                      {p.signingCost.toLocaleString()} signing fee
                    </div>

                    <div className="flex gap-2 pt-1 border-t border-border mt-auto">
                      <Button
                        size="sm"
                        className="flex-1 gap-1 text-xs h-8"
                        onClick={() => handleSign(p.id, p.name)}
                        disabled={isMutating}
                        data-testid={`button-sign-prospect-${p.id}`}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Sign Prospect
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs h-8 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        onClick={() => handleIgnore(p.id, p.name)}
                        disabled={isMutating}
                        data-testid={`button-ignore-prospect-${p.id}`}
                      >
                        <Ban className="h-3.5 w-3.5" />
                        Ignore
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Youth Player Database ─────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <CreditCard className="h-5 w-5 text-primary" />
          <h3 className="text-xl font-bold">Youth Player Database</h3>
          <Badge variant="secondary" className="text-xs ml-1">
            {ALL_YOUTH_PLAYERS.length} players
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground -mt-2">
          Browse all youth players from the global talent pool. Click any player to view their full profile card.
        </p>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, nationality or role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {filteredPlayers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No players match your search.</p>
        ) : (
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPlayers.map((p) => {
              const potStars = Array.from({ length: 5 }, (_, i) =>
                i < p.potential ? "★" : "☆"
              ).join("");
              return (
                <button
                  key={p.id}
                  onClick={() => setCardPlayer(p)}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left hover:border-primary/50 hover:bg-muted/40 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-tight truncate group-hover:text-primary transition-colors">
                      {p.fullName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.nationality} · Age {p.age} · {p.primaryRole}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-amber-500 text-xs tracking-wider leading-none">{potStars}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Potential</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Youth Development League ──────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h3 className="text-xl font-bold">Development League</h3>
          <Badge variant="secondary" className="text-xs ml-1">Auto-simulated</Badge>
        </div>
        <p className="text-sm text-muted-foreground -mt-2">
          Every signed youth player competes in the Development League each week — no management required.
          Matches award experience, development points, and build confidence.
        </p>

        {leagueResults.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
            <Activity className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm font-semibold text-muted-foreground">No matches yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Simulate a senior match to kick off the first Development League week.
            </p>
          </div>
        ) : (() => {
          const weekNumbers = [...new Set(leagueResults.map(r => r.weekNumber))].sort((a, b) => b - a).slice(0, 3);
          return (
            <div className="space-y-5">
              {weekNumbers.map(week => {
                const weekRows = leagueResults.filter(r => r.weekNumber === week);
                const wins     = weekRows.filter(r => r.result === "win").length;
                const losses   = weekRows.filter(r => r.result === "loss").length;
                const draws    = weekRows.filter(r => r.result === "draw").length;
                return (
                  <div key={week} className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border">
                      <span className="text-sm font-bold">Week {week}</span>
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <span className="text-emerald-600">{wins}W</span>
                        <span className="text-muted-foreground">{draws}D</span>
                        <span className="text-red-500">{losses}L</span>
                      </div>
                    </div>
                    <div className="divide-y divide-border">
                      {weekRows.map(row => {
                        const isWin  = row.result === "win";
                        const isDraw = row.result === "draw";
                        const ResultIcon = isWin ? TrendingUp : isDraw ? Minus : TrendingDown;
                        const resultColor = isWin ? "text-emerald-600" : isDraw ? "text-amber-500" : "text-red-500";
                        const resultBg    = isWin
                          ? "bg-emerald-50 dark:bg-emerald-950/20"
                          : isDraw
                          ? "bg-amber-50 dark:bg-amber-950/20"
                          : "bg-red-50 dark:bg-red-950/20";
                        return (
                          <div key={row.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                            <div className={cn("flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-black uppercase tracking-wide min-w-[52px] justify-center", resultColor, resultBg)}>
                              <ResultIcon className="h-3 w-3" />
                              {row.result}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="font-semibold truncate block leading-tight">{row.playerName}</span>
                              <span className="text-[11px] text-muted-foreground">vs {row.oppositionName}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                              <div className="text-center">
                                <div className="font-bold text-foreground">+{row.xpGained}</div>
                                <div className="text-[9px] uppercase tracking-wider">XP</div>
                              </div>
                              <div className="text-center">
                                <div className="font-bold text-foreground">+{row.devPointsGained}</div>
                                <div className="text-[9px] uppercase tracking-wider">Dev</div>
                              </div>
                              <div className="text-center">
                                <div className={cn("font-bold", row.moraleChange > 0 ? "text-emerald-600" : row.moraleChange < 0 ? "text-red-500" : "text-foreground")}>
                                  {row.moraleChange > 0 ? "+" : ""}{row.moraleChange}
                                </div>
                                <div className="text-[9px] uppercase tracking-wider">Morale</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </section>
      {/* ── Player Card Modal ─────────────────────────────────── */}
      <Dialog open={cardPlayer !== null} onOpenChange={(open) => { if (!open) setCardPlayer(null); }}>
        <DialogContent className="flex flex-col items-center gap-4 max-w-fit bg-transparent border-none shadow-none p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>{cardPlayer?.fullName ?? "Player Card"}</DialogTitle>
          </DialogHeader>
          {cardPlayer && (
            <YouthPlayerCard player={cardPlayer} width={360} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
