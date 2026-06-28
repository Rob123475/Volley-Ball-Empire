import {
  useGetFacilities,
  useUpgradeFacility,
  useGetClubRating,
  getGetFacilitiesQueryKey,
  getGetMyTeamQueryKey,
  getGetClubRatingQueryKey,
  useGetMyTeam,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Dumbbell,
  Heart,
  FlameKindling,
  Salad,
  Users,
  Search,
  Beaker,
  TrendingUp,
  Umbrella,
  ArrowUp,
  CheckCircle2,
  Building2,
  Star,
  Trophy,
  Zap,
  ChevronUp,
  Clock,
  Hammer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const MAX_LEVEL = 10;

function upgradeCost(level: number): number {
  return level * 20000;
}

const BUILD_LABELS: Record<number, string> = {
  1: "2 weeks (~3 rounds)",
  2: "1 month (~6 rounds)",
  3: "6 weeks (~8 rounds)",
  4: "2 months (~12 rounds)",
  5: "3 months (~18 rounds)",
  6: "4 months (~24 rounds)",
  7: "5 months (~29 rounds)",
  8: "6 months (~35 rounds)",
  9: "9 months (~52 rounds)",
};

type FacilityConfig = {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  purpose: string;
  colour: string;
  bg: string;
  border: string;
  text: string;
  affects: string[];
  benefitAt: (level: number) => string;
  nextBenefitAt?: (level: number) => string;
};

const colourBar: Record<string, string> = {
  blue:   "bg-blue-500",
  rose:   "bg-rose-500",
  orange: "bg-orange-500",
  lime:   "bg-lime-500",
  amber:  "bg-amber-500",
  indigo: "bg-indigo-500",
  teal:   "bg-teal-500",
  violet: "bg-violet-500",
  cyan:   "bg-cyan-500",
};

const FACILITY_CONFIG: Record<string, FacilityConfig> = {
  training_complex: {
    name: "Training Centre",
    icon: Dumbbell,
    purpose: "Boosts overall player development XP",
    colour: "blue",
    bg: "bg-blue-50 dark:bg-blue-950/20",
    border: "border-blue-400/50",
    text: "text-blue-600 dark:text-blue-400",
    affects: ["Player development", "XP gain rate"],
    benefitAt: (l) => l === 1 ? "Base training effectiveness" : `+${Math.round((l - 1) * (20 / 9))}% training XP`,
  },
  medical_centre: {
    name: "Medical Centre",
    icon: Heart,
    purpose: "Accelerates injury recovery speed",
    colour: "rose",
    bg: "bg-rose-50 dark:bg-rose-950/20",
    border: "border-rose-400/50",
    text: "text-rose-600 dark:text-rose-400",
    affects: ["Injury recovery", "Recovery retreats"],
    benefitAt: (l) => l === 1 ? "Base recovery speed" : `+${Math.round((l - 1) * (25 / 9))}% recovery speed`,
  },
  gymnasium: {
    name: "Gymnasium",
    icon: FlameKindling,
    purpose: "Increases strength and power growth",
    colour: "orange",
    bg: "bg-orange-50 dark:bg-orange-950/20",
    border: "border-orange-400/50",
    text: "text-orange-600 dark:text-orange-400",
    affects: ["Strength growth", "Power attribute", "Training effectiveness"],
    benefitAt: (l) => l === 1 ? "Base strength training" : `+${Math.round((l - 1) * (15 / 9))}% strength/power development`,
  },
  nutrition_centre: {
    name: "Nutrition Centre",
    icon: Salad,
    purpose: "Speeds fatigue recovery and stamina growth",
    colour: "lime",
    bg: "bg-lime-50 dark:bg-lime-950/20",
    border: "border-lime-400/50",
    text: "text-lime-600 dark:text-lime-400",
    affects: ["Fatigue recovery", "Stamina growth", "Session endurance"],
    benefitAt: (l) => l === 1 ? "Base nutrition support" : `−${Math.round((l - 1) * (3 / 9))} fatigue/session + −${Math.round((l - 1) * (5 / 9))} in retreats`,
  },
  youth_academy: {
    name: "Youth Academy",
    icon: Users,
    purpose: "Generates higher-potential youth prospects",
    colour: "amber",
    bg: "bg-amber-50 dark:bg-amber-950/20",
    border: "border-amber-400/50",
    text: "text-amber-600 dark:text-amber-400",
    affects: ["Youth development", "Prospect quality", "Free agent attraction"],
    benefitAt: (l) => {
      const labels = [
        "Basic prospects only",
        "Slightly improved prospects",
        "Improved prospect quality",
        "Better chance of High potential",
        "Good chance of High potential",
        "Higher chance of Elite prospects",
        "Regular Elite prospects",
        "Strong Elite prospects",
        "High chance of Elite & Generational",
        "Maximum — Elite & Generational prospects",
      ];
      return labels[l - 1] ?? labels[0];
    },
  },
  scouting_department: {
    name: "Scouting Department",
    icon: Search,
    purpose: "Improves scouting accuracy and player discovery",
    colour: "indigo",
    bg: "bg-indigo-50 dark:bg-indigo-950/20",
    border: "border-indigo-400/50",
    text: "text-indigo-600 dark:text-indigo-400",
    affects: ["Scouting effectiveness", "Free agent discovery", "Player recruitment"],
    benefitAt: (l) => l === 1 ? "Basic scouting capability" : `+${Math.round((l - 1) * (30 / 9))}% scouting effectiveness`,
  },
  sports_science_lab: {
    name: "Performance Centre",
    icon: Beaker,
    purpose: "Reduces injury risk and improves match performance",
    colour: "teal",
    bg: "bg-teal-50 dark:bg-teal-950/20",
    border: "border-teal-400/50",
    text: "text-teal-600 dark:text-teal-400",
    affects: ["Injury prevention", "Staff effectiveness", "Match performance"],
    benefitAt: (l) => l === 1 ? "Base injury prevention" : `−${Math.round((l - 1) * (20 / 9))}% injury risk`,
  },
  commercial_department: {
    name: "Commercial Department",
    icon: TrendingUp,
    purpose: "Increases sponsorship income and club prestige",
    colour: "violet",
    bg: "bg-violet-50 dark:bg-violet-950/20",
    border: "border-violet-400/50",
    text: "text-violet-600 dark:text-violet-400",
    affects: ["Sponsorship income", "Olympic prestige", "Club reputation"],
    benefitAt: (l) => l === 1 ? "Base commercial activity" : `+${Math.round((l - 1) * (30 / 9))}% sponsorship value`,
  },
  beach_resort: {
    name: "Beach Resort",
    icon: Umbrella,
    purpose: "Boosts player morale and attracts free agents",
    colour: "cyan",
    bg: "bg-cyan-50 dark:bg-cyan-950/20",
    border: "border-cyan-400/50",
    text: "text-cyan-600 dark:text-cyan-400",
    affects: ["Player morale", "Free agent attraction", "Camp bonuses"],
    benefitAt: (l) => l === 1 ? "Base morale environment" : `+${Math.round((l - 1) * (8 / 9))} morale per camp`,
  },
};

const DISPLAY_ORDER = [
  "training_complex",
  "medical_centre",
  "gymnasium",
  "nutrition_centre",
  "youth_academy",
  "scouting_department",
  "sports_science_lab",
  "commercial_department",
  "beach_resort",
];

function facilityRating(level: number): number {
  return Math.round((level / MAX_LEVEL) * 100);
}

function ratingLabel(r: number) {
  if (r >= 90) return { text: "World Class", cls: "text-yellow-600 dark:text-yellow-400" };
  if (r >= 70) return { text: "Elite",       cls: "text-violet-600 dark:text-violet-400" };
  if (r >= 50) return { text: "Good",        cls: "text-blue-600 dark:text-blue-400" };
  if (r >= 30) return { text: "Developing",  cls: "text-emerald-600 dark:text-emerald-400" };
  return              { text: "Basic",       cls: "text-muted-foreground" };
}

function clubRatingColour(total: number) {
  if (total >= 80) return "from-yellow-400 to-orange-500";
  if (total >= 65) return "from-violet-500 to-purple-600";
  if (total >= 50) return "from-blue-500 to-indigo-600";
  if (total >= 35) return "from-teal-400 to-emerald-500";
  return "from-slate-400 to-slate-600";
}

export default function FacilitiesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: facilities, isLoading } = useGetFacilities({
    query: { queryKey: getGetFacilitiesQueryKey() },
  });
  const { data: team } = useGetMyTeam({ query: { queryKey: getGetMyTeamQueryKey() } });
  const { data: clubRating, isLoading: ratingLoading } = useGetClubRating({
    query: { queryKey: getGetClubRatingQueryKey() },
  });
  const upgradeMutation = useUpgradeFacility();

  const [highlightedType, setHighlightedType] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{
    type: string; name: string; level: number; cost: number; buildLabel: string;
  } | null>(null);

  useEffect(() => {
    if (!facilities || facilities.length === 0) return;
    const hash = window.location.hash;
    if (!hash) return;
    const elementId = hash.slice(1);
    const timer = setTimeout(() => {
      const el = document.getElementById(elementId);
      if (!el) return;
      const headerOffset = 80;
      const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top, behavior: "smooth" });
      const facType = elementId.replace("facility-", "");
      setHighlightedType(facType);
      setTimeout(() => setHighlightedType(null), 1800);
    }, 150);
    return () => clearTimeout(timer);
  }, [facilities]);

  const budget = Number(team?.budget ?? 0);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetFacilitiesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetMyTeamQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetClubRatingQueryKey() });
  };

  const openUpgradeModal = (type: string, name: string, level: number) => {
    setConfirming({ type, name, level, cost: upgradeCost(level), buildLabel: BUILD_LABELS[level] ?? "Unknown" });
  };

  const handleConfirm = () => {
    if (!confirming) return;
    upgradeMutation.mutate(
      { type: confirming.type },
      {
        onSuccess: () => {
          invalidate();
          toast({
            title: `🏗️ ${confirming.name} upgrade started`,
            description: `$${confirming.cost.toLocaleString()} deducted. Completes in ${confirming.buildLabel}.`,
          });
          setConfirming(null);
        },
        onError: (err: any) => {
          toast({
            title: "Upgrade failed",
            description: err?.response?.data?.error ?? err?.message ?? "Unknown error",
            variant: "destructive",
          });
          setConfirming(null);
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(9)].map((_, i) => <Skeleton key={i} className="h-72 w-full" />)}
        </div>
      </div>
    );
  }

  const facilityMap = Object.fromEntries((facilities ?? []).map((f) => [f.type, f]));

  const overallFacilityRating = DISPLAY_ORDER.length > 0
    ? Math.round(DISPLAY_ORDER.reduce((sum, t) => sum + (facilityMap[t]?.level ?? 1), 0) / DISPLAY_ORDER.length / MAX_LEVEL * 100)
    : 0;

  const totalRating = clubRating?.totalRating ?? 0;
  const ratingGradient = clubRatingColour(totalRating);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary" /> Facilities
          </h1>
          <p className="text-muted-foreground mt-1">
            Upgrade your club's infrastructure to gain competitive advantages across all areas.
          </p>
        </div>
        {team && (
          <div className="text-right">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Club Budget</div>
            <div className="text-2xl font-black text-emerald-600">${budget.toLocaleString()}</div>
          </div>
        )}
      </div>

      {/* ── Club Rating Banner ── */}
      {ratingLoading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : clubRating && (
        <div className={cn("rounded-2xl bg-gradient-to-br p-5 text-white shadow-lg", ratingGradient)}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-white/60 mb-1">Club Rating</div>
              <div className="flex items-center gap-3">
                <span className="text-5xl font-black">{totalRating}</span>
                <div>
                  <div className="text-xl font-bold">{clubRating.label}</div>
                  <div className="text-sm text-white/70">Overall facility rating: {overallFacilityRating}/100</div>
                </div>
              </div>
            </div>
            <Trophy className="h-14 w-14 text-white/20" />
          </div>
          {/* Breakdown bar */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Object.entries(clubRating.breakdown).map(([key, comp]) => {
              const labels: Record<string, string> = {
                players: "Players", staff: "Staff", medical: "Medical",
                facilities: "Facilities", youthAcademy: "Youth",
              };
              return (
                <div key={key} className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">{labels[key]}</div>
                  <div className="text-lg font-black">{comp.score}</div>
                  <div className="text-[10px] text-white/50">{comp.weight}% weight</div>
                  <div className="mt-1.5 h-1 rounded-full bg-white/20 overflow-hidden">
                    <div className="h-full bg-white/60 rounded-full" style={{ width: `${comp.score}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Facility Cards ── */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {DISPLAY_ORDER.map((type) => {
          const cfg = FACILITY_CONFIG[type];
          if (!cfg) return null;
          const facility = facilityMap[type];
          const level = facility?.level ?? 1;
          const isMaxed = level >= MAX_LEVEL;
          const isUpgrading = facility?.upgradingToLevel != null;
          const cost = upgradeCost(level);
          const canAfford = budget >= cost;
          const Icon = cfg.icon;
          const fRating = facilityRating(level);
          const rl = ratingLabel(fRating);

          return (
            <Card
              key={type}
              id={`facility-${type}`}
              className={cn(
                "border-2 transition-all duration-300 hover:shadow-md flex flex-col",
                cfg.border,
                cfg.bg,
                highlightedType === type && "ring-2 ring-offset-2 ring-primary shadow-lg shadow-primary/30 scale-[1.01]",
              )}
            >
              {/* Header */}
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={cn("p-2 rounded-lg border-2", cfg.bg, cfg.border)}>
                      <Icon className={cn("h-5 w-5", cfg.text)} />
                    </div>
                    <div>
                      <CardTitle className="text-base leading-tight">{cfg.name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">{cfg.purpose}</CardDescription>
                    </div>
                  </div>
                  {isMaxed ? (
                    <Badge className="bg-yellow-500/15 text-yellow-700 border-yellow-500/30 text-[10px] font-black uppercase tracking-wider shrink-0">
                      Max
                    </Badge>
                  ) : (
                    <Badge variant="outline" className={cn("text-[10px] font-black uppercase tracking-wider shrink-0", cfg.text, cfg.border)}>
                      Lv {level}
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4 flex-1 flex flex-col">
                {/* Level bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground font-semibold">
                    <span>Level {level} / {MAX_LEVEL}</span>
                    <span className={cn("font-black text-[11px]", rl.cls)}>{rl.text}</span>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: MAX_LEVEL }).map((_, i) => (
                      <div
                        key={i}
                        className={cn("h-2 flex-1 rounded-full transition-colors", i < level ? (colourBar[cfg.colour] ?? "bg-primary") : "bg-muted")}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Facility Rating</span>
                    <span className={cn("font-black", cfg.text)}>{fRating}/100</span>
                  </div>
                </div>

                {/* Affects */}
                <div className="flex flex-wrap gap-1.5">
                  {cfg.affects.map((a) => (
                    <span key={a} className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", cfg.text, cfg.border, cfg.bg)}>
                      {a}
                    </span>
                  ))}
                </div>

                {/* Bonus panel */}
                <div className="rounded-lg bg-background/60 border border-border/50 p-3 space-y-2 flex-1">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-0.5">Current Bonus</div>
                    <div className={cn("text-sm font-semibold", cfg.text)}>{cfg.benefitAt(level)}</div>
                  </div>

                  {!isMaxed && (
                    <div className="border-t border-border/40 pt-2">
                      <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-0.5">
                        <ChevronUp className="h-3 w-3" /> Next Level
                      </div>
                      <div className="text-sm font-semibold text-foreground">{cfg.benefitAt(level + 1)}</div>
                    </div>
                  )}

                  {isMaxed && (
                    <div className="border-t border-border/40 pt-2 flex items-center gap-1.5">
                      <CheckCircle2 className={cn("h-4 w-4", cfg.text)} />
                      <span className={cn("text-sm font-bold", cfg.text)}>Maximum Effectiveness</span>
                    </div>
                  )}
                </div>

                {/* Upgrade in-progress / cost / button */}
                {isUpgrading ? (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 uppercase tracking-wide">
                      <Hammer className="h-3.5 w-3.5" /> Upgrading → Level {facility?.upgradingToLevel}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {(facility?.upgradeRoundsRemaining ?? 0) === 0
                        ? "Ready — play a match to complete"
                        : `${facility?.upgradeRoundsRemaining} round${facility?.upgradeRoundsRemaining !== 1 ? "s" : ""} remaining`}
                    </div>
                  </div>
                ) : !isMaxed ? (
                  <>
                    <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
                      <span className="font-semibold">Upgrade cost</span>
                      <span className={cn("font-black text-sm", canAfford ? "text-emerald-600" : "text-destructive")}>
                        ${cost.toLocaleString()}
                      </span>
                    </div>
                    <Button
                      className={cn("w-full gap-2 font-bold mt-auto", !canAfford && "opacity-60")}
                      variant={canAfford ? "default" : "outline"}
                      disabled={upgradeMutation.isPending || !canAfford}
                      onClick={() => openUpgradeModal(type, cfg.name, level)}
                      data-testid={`button-upgrade-${type}`}
                    >
                      <ArrowUp className="h-4 w-4" />
                      {canAfford ? `Upgrade to Level ${level + 1}` : `Need $${cost.toLocaleString()}`}
                    </Button>
                  </>
                ) : (
                  <div className="h-9 flex items-center justify-center rounded-md border border-dashed border-yellow-500/40 text-xs font-bold text-yellow-600 uppercase tracking-wider gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Fully Upgraded
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Upgrade Confirmation Dialog ── */}
      <Dialog open={!!confirming} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hammer className="h-5 w-5 text-primary" /> Confirm Facility Upgrade
            </DialogTitle>
            <DialogDescription>
              {confirming?.name} — Level {confirming?.level} → {(confirming?.level ?? 0) + 1}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
              <span className="text-sm font-medium">Upgrade Cost</span>
              <span className="font-bold text-primary">${confirming?.cost.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
              <span className="text-sm font-medium flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Build Time
              </span>
              <span className="font-bold">{confirming?.buildLabel}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Funds are deducted immediately. The upgrade completes automatically after the required rounds pass — no action needed.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirming(null)}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={upgradeMutation.isPending}>
              {upgradeMutation.isPending ? "Starting…" : "Confirm Upgrade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Facility Bonuses Summary ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-primary" /> How Facilities Affect Your Club
          </CardTitle>
          <CardDescription>Every facility level unlocks real gameplay advantages.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            {[
              { icon: "🏋️", label: "Player Development", desc: "Training Centre & Gymnasium raise XP gain and power growth" },
              { icon: "🏥", label: "Injury Recovery", desc: "Medical Centre & Performance Centre reduce injury weeks" },
              { icon: "🥗", label: "Fatigue Recovery", desc: "Nutrition Centre reduces fatigue per session and in camps" },
              { icon: "⚡", label: "Stamina Growth", desc: "Nutrition Centre improves endurance and session efficiency" },
              { icon: "🔍", label: "Scouting", desc: "Scouting Department improves prospect discovery quality" },
              { icon: "💰", label: "Sponsorship", desc: "Commercial Department boosts sponsor deal value" },
              { icon: "🌴", label: "Player Morale", desc: "Beach Resort adds morale bonus to every wellbeing camp" },
              { icon: "🏆", label: "Free Agent Attraction", desc: "Youth Academy + Beach Resort attract higher-quality signings" },
              { icon: "🎖️", label: "Olympic Prestige", desc: "Club Rating influences Olympic selection and national prestige" },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="flex gap-2 p-3 rounded-lg border border-border/50 bg-muted/30">
                <span className="text-lg shrink-0">{icon}</span>
                <div>
                  <div className="font-semibold text-xs">{label}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
