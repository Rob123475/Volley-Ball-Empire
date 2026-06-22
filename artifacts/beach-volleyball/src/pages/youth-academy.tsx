import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetYouthScouting,
  useStartYouthScouting,
  useCancelYouthScouting,
  getGetYouthScoutingQueryKey,
  useGetYouthProspects,
  useSignYouthProspect,
  useIgnoreYouthProspect,
  getGetYouthProspectsQueryKey,
  getGetTeamRosterQueryKey,
  useGetYouthLeagueResults,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Globe,
  MapPin,
  Clock,
  Star,
  Radar,
  CheckCircle2,
  CircleDashed,
  XCircle,
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
} from "lucide-react";

// ── Continent data ─────────────────────────────────────────────────────────

type Continent = {
  name: string;
  emoji: string;
  talentLevel: string;
  talentStars: number;
  description: string;
  color: string;
  border: string;
  bg: string;
};

const CONTINENTS: Continent[] = [
  {
    name: "Europe",
    emoji: "🌍",
    talentLevel: "Elite",
    talentStars: 4,
    description: "Deep volleyball tradition and elite academies.",
    color: "text-blue-700 dark:text-blue-400",
    border: "border-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
  },
  {
    name: "South America",
    emoji: "🌎",
    talentLevel: "High",
    talentStars: 3,
    description: "Explosive athletes raised on beach culture.",
    color: "text-green-700 dark:text-green-400",
    border: "border-green-400",
    bg: "bg-green-50 dark:bg-green-950/30",
  },
  {
    name: "North America",
    emoji: "🌎",
    talentLevel: "High",
    talentStars: 3,
    description: "College pipeline producing versatile players.",
    color: "text-amber-700 dark:text-amber-400",
    border: "border-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
  },
  {
    name: "Africa",
    emoji: "🌍",
    talentLevel: "High",
    talentStars: 3,
    description: "Raw athleticism and emerging talent hubs.",
    color: "text-orange-700 dark:text-orange-400",
    border: "border-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/30",
  },
  {
    name: "Asia",
    emoji: "🌏",
    talentLevel: "Average",
    talentStars: 2,
    description: "Growing programmes with disciplined prospects.",
    color: "text-rose-700 dark:text-rose-400",
    border: "border-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/30",
  },
  {
    name: "Oceania",
    emoji: "🌏",
    talentLevel: "Average",
    talentStars: 2,
    description: "Small pool but consistent beach volleyball culture.",
    color: "text-teal-700 dark:text-teal-400",
    border: "border-teal-400",
    bg: "bg-teal-50 dark:bg-teal-950/30",
  },
];

const TALENT_COLOR: Record<string, string> = {
  Elite:   "text-blue-600",
  High:    "text-emerald-600",
  Average: "text-amber-600",
};

// ── Status helpers ─────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: string }) {
  if (status === "active")   return <Radar    className="h-5 w-5 text-emerald-500 animate-pulse" />;
  if (status === "complete") return <CheckCircle2 className="h-5 w-5 text-blue-500" />;
  return <CircleDashed className="h-5 w-5 text-muted-foreground" />;
}

function statusLabel(status: string) {
  if (status === "active")   return "Scouting in Progress";
  if (status === "complete") return "Report Ready";
  return "No Active Mission";
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function YouthAcademy() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: mission, isLoading } = useGetYouthScouting({
    query: { queryKey: getGetYouthScoutingQueryKey() },
  });

  const startMutation   = useStartYouthScouting();
  const cancelMutation  = useCancelYouthScouting();
  const signMutation    = useSignYouthProspect();
  const ignoreMutation  = useIgnoreYouthProspect();

  const { data: prospects = [] } = useGetYouthProspects({
    query: { queryKey: getGetYouthProspectsQueryKey() },
  });

  const { data: leagueResults = [] } = useGetYouthLeagueResults();

  const [selected, setSelected] = useState<string | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getGetYouthScoutingQueryKey() });

  const invalidateProspects = () =>
    queryClient.invalidateQueries({ queryKey: getGetYouthProspectsQueryKey() });

  const handleSign = (id: number, name: string) => {
    signMutation.mutate({ id }, {
      onSuccess: () => {
        invalidateProspects();
        queryClient.invalidateQueries({ queryKey: getGetTeamRosterQueryKey() });
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
        invalidateProspects();
        toast({ title: "Prospect Dismissed", description: `${name} has been passed over.` });
      },
    });
  };

  const handleStart = () => {
    if (!selected) return;
    startMutation.mutate(
      { data: { continent: selected } },
      {
        onSuccess: () => {
          invalidate();
          setSelected(null);
          toast({ title: "Scouts Deployed", description: `Scouting mission to ${selected} has begun.` });
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error ?? "Could not start scouting mission.";
          toast({ title: "Mission Failed", description: msg, variant: "destructive" });
        },
      },
    );
  };

  const handleCancel = () => {
    cancelMutation.mutate(undefined, {
      onSuccess: () => {
        invalidate();
        toast({ title: "Mission Cancelled", description: "Scouts recalled." });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}
        </div>
      </div>
    );
  }

  const status        = mission?.status ?? "idle";
  const isActive      = status === "active";
  const isComplete    = status === "complete";
  const continent     = mission?.continent ?? null;
  const weeksLeft     = mission?.weeksRemaining ?? 0;
  const talentLevel   = mission?.expectedTalentLevel ?? null;
  const activeCont    = CONTINENTS.find(c => c.name === continent);
  const scoutingCost  = mission?.scoutingCost ?? 15_000;
  const costFormatted = `$${scoutingCost.toLocaleString()}`;
  const pendingProspects = prospects.filter((p) => p.status === "pending");

  return (
    <div className="space-y-10">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary">Youth Academy</h2>
        <p className="text-muted-foreground mt-1">
          Develop the next generation. Scout globally and build your Youth Academy roster.
        </p>
      </div>

      {/* ── Mission Status panel ────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Radar className="h-5 w-5 text-primary" />
          <h3 className="text-xl font-bold">Scouting Mission</h3>
        </div>

        <div className={cn(
          "rounded-xl border-2 p-5",
          isActive
            ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20"
            : "border-border bg-muted/30",
        )}>
          {/* Status row */}
          <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
            <div className="flex items-center gap-2">
              <StatusIcon status={status} />
              <span className={cn(
                "text-sm font-bold",
                isActive ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
              )}>
                {statusLabel(status)}
              </span>
            </div>
            {isActive && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={handleCancel}
                disabled={cancelMutation.isPending}
              >
                <XCircle className="h-3 w-3" />
                Recall Scouts
              </Button>
            )}
          </div>

          {/* Four info tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Scout Status */}
            <div className="rounded-lg bg-background border border-border p-3 text-center">
              <div className={cn("text-sm font-black", isActive ? "text-emerald-600" : "text-muted-foreground")}>
                {isActive ? "Active" : "Idle"}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-0.5">
                Scout Status
              </div>
            </div>

            {/* Selected Continent */}
            <div className="rounded-lg bg-background border border-border p-3 text-center">
              <div className="flex items-center justify-center gap-1">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                <span className={cn(
                  "text-sm font-black",
                  activeCont ? activeCont.color : "text-muted-foreground",
                )}>
                  {continent ?? "—"}
                </span>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-0.5">
                Destination
              </div>
            </div>

            {/* Weeks Remaining */}
            <div className="rounded-lg bg-background border border-border p-3 text-center">
              <div className="flex items-center justify-center gap-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className={cn(
                  "text-sm font-black",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )}>
                  {isActive ? `${weeksLeft} wk${weeksLeft !== 1 ? "s" : ""}` : "—"}
                </span>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-0.5">
                Weeks Remaining
              </div>
            </div>

            {/* Expected Talent Level */}
            <div className="rounded-lg bg-background border border-border p-3 text-center">
              {talentLevel ? (
                <>
                  <div className={cn("text-sm font-black", TALENT_COLOR[talentLevel] ?? "text-foreground")}>
                    {talentLevel}
                  </div>
                  <div className="flex justify-center gap-0.5 mt-0.5">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const stars = activeCont?.talentStars ?? 0;
                      return (
                        <Star
                          key={i}
                          className={cn(
                            "h-2.5 w-2.5",
                            i < stars ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30",
                          )}
                        />
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="text-sm font-black text-muted-foreground">—</div>
              )}
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-0.5">
                Expected Talent
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Scout Report — prospects panel ─────────────────────── */}
      {isComplete && pendingProspects.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-blue-500" />
            <h3 className="text-xl font-bold">Scout Report — {continent}</h3>
            <Badge variant="secondary" className="text-xs ml-1">
              {pendingProspects.length} prospect{pendingProspects.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground -mt-2">
            Your scouts found {pendingProspects.length} promising players. Sign to reserve them or ignore to pass.
          </p>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {pendingProspects.map((p) => {
              const potColor =
                p.potentialStars === "Generational" ? "text-purple-600 border-purple-400 bg-purple-50 dark:bg-purple-950/30" :
                p.potentialStars === "Elite"         ? "text-blue-600 border-blue-400 bg-blue-50 dark:bg-blue-950/30" :
                p.potentialStars === "High"          ? "text-emerald-600 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30" :
                                                       "text-amber-600 border-amber-400 bg-amber-50 dark:bg-amber-950/30";
              const potStars =
                p.potentialStars === "Generational" ? 5 :
                p.potentialStars === "Elite"         ? 4 :
                p.potentialStars === "High"          ? 3 : 2;

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
                  className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 shadow-sm"
                >
                  {/* Name + Age */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-sm leading-tight">{p.name}</p>
                      <p className="text-xs text-muted-foreground">Age {p.age} · {p.continent}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-black text-primary leading-none">{p.currentRating}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Rating</div>
                    </div>
                  </div>

                  {/* Potential + Speciality */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={cn("text-[10px] font-bold border gap-1", potColor)}>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              "h-2 w-2",
                              i < potStars ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/25",
                            )}
                          />
                        ))}
                      </div>
                      {p.potentialStars}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] font-medium gap-1 text-muted-foreground">
                      {specialityIcon}
                      {p.speciality}
                    </Badge>
                  </div>

                  {/* Signing cost */}
                  <div className="flex items-center gap-1 text-sm font-semibold text-amber-600">
                    <DollarSign className="h-3.5 w-3.5" />
                    {p.signingCost.toLocaleString()} signing fee
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1 border-t border-border mt-auto">
                    <Button
                      size="sm"
                      className="flex-1 gap-1 text-xs h-8"
                      onClick={() => handleSign(p.id, p.name)}
                      disabled={signMutation.isPending || ignoreMutation.isPending}
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
                      disabled={signMutation.isPending || ignoreMutation.isPending}
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
        </section>
      )}

      {/* ── Continent Selector ───────────────────────────────────── */}
      {!isActive && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <h3 className="text-xl font-bold">Select Scout Destination</h3>
          </div>
          <div className="flex items-center gap-3 -mt-2 flex-wrap">
            <p className="text-sm text-muted-foreground">
              Choose a continent to deploy your scouts. The mission takes 4 weeks.
            </p>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-full px-2.5 py-0.5 shrink-0">
              <DollarSign className="h-3 w-3" />
              {costFormatted} per mission
            </span>
          </div>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {CONTINENTS.map((c) => {
              const isSelected = selected === c.name;
              return (
                <button
                  key={c.name}
                  onClick={() => setSelected(isSelected ? null : c.name)}
                  className={cn(
                    "rounded-xl border-2 p-4 text-left transition-all duration-150 hover:shadow-md w-full",
                    isSelected
                      ? cn("shadow-md", c.border, c.bg)
                      : "border-border bg-card hover:border-muted-foreground/30",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{c.emoji}</span>
                      <div>
                        <p className={cn("font-bold text-sm", isSelected ? c.color : "text-foreground")}>
                          {c.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{c.description}</p>
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className={cn("h-4 w-4 shrink-0 mt-0.5", c.color)} />
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-bold border",
                        isSelected ? cn(c.color, c.border) : "text-muted-foreground",
                      )}
                    >
                      {c.talentLevel} Talent
                    </Badge>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "h-3 w-3",
                            i < c.talentStars
                              ? "text-yellow-500 fill-yellow-500"
                              : "text-muted-foreground/25",
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Deploy button */}
          {selected && (
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleStart}
                disabled={startMutation.isPending}
                className="gap-2"
                data-testid="button-start-scouting"
              >
                <Radar className="h-4 w-4" />
                Deploy Scouts to {selected}
                <span className="ml-1 opacity-75 text-xs font-normal">· {costFormatted}</span>
              </Button>
            </div>
          )}
        </section>
      )}

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
                const wins   = weekRows.filter(r => r.result === "win").length;
                const losses = weekRows.filter(r => r.result === "loss").length;
                const draws  = weekRows.filter(r => r.result === "draw").length;
                return (
                  <div key={week} className="rounded-xl border border-border bg-card overflow-hidden">
                    {/* Week header */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border">
                      <span className="text-sm font-bold">Week {week}</span>
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <span className="text-emerald-600">{wins}W</span>
                        <span className="text-muted-foreground">{draws}D</span>
                        <span className="text-red-500">{losses}L</span>
                      </div>
                    </div>

                    {/* Player rows */}
                    <div className="divide-y divide-border">
                      {weekRows.map(row => {
                        const isWin  = row.result === "win";
                        const isDraw = row.result === "draw";
                        const ResultIcon = isWin ? TrendingUp : isDraw ? Minus : TrendingDown;
                        const resultColor = isWin
                          ? "text-emerald-600"
                          : isDraw
                          ? "text-amber-500"
                          : "text-red-500";
                        const resultBg = isWin
                          ? "bg-emerald-50 dark:bg-emerald-950/20"
                          : isDraw
                          ? "bg-amber-50 dark:bg-amber-950/20"
                          : "bg-red-50 dark:bg-red-950/20";

                        return (
                          <div key={row.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                            {/* Result badge */}
                            <div className={cn("flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-black uppercase tracking-wide min-w-[52px] justify-center", resultColor, resultBg)}>
                              <ResultIcon className="h-3 w-3" />
                              {row.result}
                            </div>

                            {/* Player + opposition */}
                            <div className="flex-1 min-w-0">
                              <span className="font-semibold truncate block leading-tight">{row.playerName}</span>
                              <span className="text-[11px] text-muted-foreground">vs {row.oppositionName}</span>
                            </div>

                            {/* Gains */}
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
    </div>
  );
}
