import { useGetFacilities, useUpgradeFacility, getGetFacilitiesQueryKey, useGetMyTeam, getGetMyTeamQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dumbbell,
  Heart,
  Shield,
  Star,
  Users,
  Medal,
  ArrowUp,
  CheckCircle2,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_LEVEL = 10;

function upgradeCost(level: number): number {
  return level * 20000;
}

type FacilityConfig = {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  purpose: string;
  colour: string;
  bg: string;
  border: string;
  text: string;
  benefitAt: (level: number) => string;
};

const FACILITY_CONFIG: Record<string, FacilityConfig> = {
  training_complex: {
    name: "Training Complex",
    icon: Dumbbell,
    purpose: "Improves player development",
    colour: "blue",
    bg: "bg-blue-50 dark:bg-blue-950/20",
    border: "border-blue-400/50",
    text: "text-blue-600",
    benefitAt: (l) => {
      if (l === 1) return "+0% — Base training effectiveness";
      const pct = Math.round((l - 1) * (20 / 9));
      return `+${pct}% training effectiveness`;
    },
  },
  medical_centre: {
    name: "Medical Centre",
    icon: Heart,
    purpose: "Improves recovery from injuries",
    colour: "rose",
    bg: "bg-rose-50 dark:bg-rose-950/20",
    border: "border-rose-400/50",
    text: "text-rose-600",
    benefitAt: (l) => {
      if (l === 1) return "+0% — Base recovery speed";
      const pct = Math.round((l - 1) * (25 / 9));
      return `+${pct}% recovery speed`;
    },
  },
  sports_science_lab: {
    name: "Sports Science Lab",
    icon: Shield,
    purpose: "Reduces injury risk",
    colour: "green",
    bg: "bg-green-50 dark:bg-green-950/20",
    border: "border-green-400/50",
    text: "text-green-600",
    benefitAt: (l) => {
      if (l === 1) return "+0% — Base injury prevention";
      const pct = Math.round((l - 1) * (20 / 9));
      return `-${pct}% injury risk`;
    },
  },
  psychology_centre: {
    name: "Psychology Centre",
    icon: Star,
    purpose: "Improves morale and pressure handling",
    colour: "purple",
    bg: "bg-purple-50 dark:bg-purple-950/20",
    border: "border-purple-400/50",
    text: "text-purple-600",
    benefitAt: (l) => {
      if (l === 1) return "+0% — Base morale support";
      const pct = Math.round((l - 1) * (20 / 9));
      return `+${pct}% morale recovery & finals confidence`;
    },
  },
  youth_academy: {
    name: "Youth Academy",
    icon: Users,
    purpose: "Generates better youth prospects",
    colour: "amber",
    bg: "bg-amber-50 dark:bg-amber-950/20",
    border: "border-amber-400/50",
    text: "text-amber-600",
    benefitAt: (l) => {
      const labels = [
        "Basic prospects only",
        "Slightly improved prospects",
        "Improved prospects",
        "Better chance of High potential",
        "Good chance of High potential",
        "Higher chance of Elite prospects",
        "Regular Elite prospects",
        "Strong Elite prospects",
        "High chance of Elite & Generational",
        "Maximum: much higher Elite & Generational",
      ];
      return labels[l - 1] ?? labels[0];
    },
  },
  olympic_performance_centre: {
    name: "Olympic Performance Centre",
    icon: Medal,
    purpose: "Improves national team Olympic preparation",
    colour: "yellow",
    bg: "bg-yellow-50 dark:bg-yellow-950/20",
    border: "border-yellow-400/50",
    text: "text-yellow-600",
    benefitAt: (l) => {
      if (l === 1) return "+0% — Base Olympic preparation";
      const pct = Math.round((l - 1) * (20 / 9));
      return `+${pct}% Olympic performance preparation`;
    },
  },
};

const DISPLAY_ORDER = [
  "training_complex",
  "medical_centre",
  "sports_science_lab",
  "psychology_centre",
  "youth_academy",
  "olympic_performance_centre",
];

export default function FacilitiesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: facilities, isLoading } = useGetFacilities({
    query: { queryKey: getGetFacilitiesQueryKey() },
  });
  const { data: team } = useGetMyTeam({ query: { queryKey: getGetMyTeamQueryKey() } });
  const upgradeMutation = useUpgradeFacility();

  const budget = Number(team?.budget ?? 0);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetFacilitiesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetMyTeamQueryKey() });
  };

  const handleUpgrade = (type: string, name: string, currentLevel: number) => {
    const cost = upgradeCost(currentLevel);
    upgradeMutation.mutate(
      { type },
      {
        onSuccess: () => {
          invalidate();
          toast({
            title: `${name} upgraded to Level ${currentLevel + 1}`,
            description: `$${cost.toLocaleString()} deducted from budget.`,
          });
        },
        onError: (err: any) => {
          toast({
            title: "Upgrade failed",
            description: err?.message ?? "Unknown error",
            variant: "destructive",
          });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      </div>
    );
  }

  const facilityMap = Object.fromEntries((facilities ?? []).map((f) => [f.type, f]));

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary" /> Facilities
          </h1>
          <p className="text-muted-foreground mt-1">Upgrade your club's infrastructure to gain competitive advantages.</p>
        </div>
        {team && (
          <div className="text-right">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Club Budget</div>
            <div className="text-2xl font-black text-emerald-600">${budget.toLocaleString()}</div>
          </div>
        )}
      </div>

      {/* ── Facility Cards ── */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {DISPLAY_ORDER.map((type) => {
          const cfg = FACILITY_CONFIG[type];
          if (!cfg) return null;
          const facility = facilityMap[type];
          const level = facility?.level ?? 1;
          const isMaxed = level >= MAX_LEVEL;
          const cost = upgradeCost(level);
          const canAfford = budget >= cost;
          const Icon = cfg.icon;

          return (
            <Card key={type} className={cn("border-2 transition-all duration-200 hover:shadow-md", cfg.border, cfg.bg)}>
              {/* Header strip */}
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

              <CardContent className="space-y-4">
                {/* Level bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground font-semibold">
                    <span>Level {level} / {MAX_LEVEL}</span>
                    {isMaxed && <span className={cn("font-black", cfg.text)}>Maxed</span>}
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: MAX_LEVEL }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-2 flex-1 rounded-full transition-colors",
                          i < level
                            ? cn(
                                cfg.colour === "blue"   ? "bg-blue-500"   :
                                cfg.colour === "rose"   ? "bg-rose-500"   :
                                cfg.colour === "green"  ? "bg-green-500"  :
                                cfg.colour === "purple" ? "bg-purple-500" :
                                cfg.colour === "amber"  ? "bg-amber-500"  :
                                "bg-yellow-500"
                              )
                            : "bg-muted"
                        )}
                      />
                    ))}
                  </div>
                </div>

                {/* Current benefit */}
                <div className="rounded-lg bg-background/60 border border-border/50 p-3 space-y-2">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-0.5">Current Benefit</div>
                    <div className={cn("text-sm font-semibold", cfg.text)}>{cfg.benefitAt(level)}</div>
                  </div>

                  {!isMaxed && (
                    <div className="border-t border-border/40 pt-2">
                      <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-0.5">Next Level</div>
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

                {/* Upgrade button */}
                {!isMaxed ? (
                  <Button
                    className={cn(
                      "w-full gap-2 font-bold",
                      !canAfford && "opacity-60"
                    )}
                    variant={canAfford ? "default" : "outline"}
                    disabled={upgradeMutation.isPending || !canAfford}
                    onClick={() => handleUpgrade(type, cfg.name, level)}
                    data-testid={`button-upgrade-${type}`}
                  >
                    <ArrowUp className="h-4 w-4" />
                    {canAfford
                      ? `Upgrade — $${cost.toLocaleString()}`
                      : `Need $${cost.toLocaleString()}`}
                  </Button>
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
    </div>
  );
}
