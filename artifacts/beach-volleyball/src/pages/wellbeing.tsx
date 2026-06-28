import {
  useGetWellbeingStatus,
  useRunWellbeingCamp,
  useGetFacilities,
  getGetWellbeingStatusQueryKey,
  getGetMyTeamQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertTriangle, Sparkles, Clock } from "lucide-react";
import { useState } from "react";

// ── Camp definitions (mirrors backend CAMPS) ─────────────────────────────────

const CAMP_DEFS = [
  {
    id: "team_retreat",
    emoji: "🏖️",
    name: "Team Retreat",
    tagline: "A relaxing getaway to bond and recharge",
    cost: 15_000,
    costTier: "Low" as const,
    benefits: ["Morale +15 for all active players", "Fatigue −8 for all active players"],
    downsides: [] as string[],
    facilityNote: "Psychology Centre: +bonus morale at higher levels",
    facilityType: "psychology_centre",
    temporaryEffect: null as string | null,
    durationLabel: "1 round (~1 week)",
    durationRounds: 1,
  },
  {
    id: "sports_psychology",
    emoji: "🧠",
    name: "Sports Psychology Camp",
    tagline: "Expert mental coaching for high-pressure performance",
    cost: 30_000,
    costTier: "Medium" as const,
    benefits: ["Morale +10 for all active players", "Lower stat threshold in Grand Finals (8 matches)"],
    downsides: [] as string[],
    facilityNote: "Psychology Centre: longer duration + extra morale",
    facilityType: "psychology_centre",
    temporaryEffect: "psych_camp",
    durationLabel: "2 rounds (~2 weeks)",
    durationRounds: 2,
  },
  {
    id: "recovery_retreat",
    emoji: "🌿",
    name: "Recovery Retreat",
    tagline: "Deep physical restoration and injury prevention",
    cost: 25_000,
    costTier: "Medium" as const,
    benefits: ["Fatigue −20 for all active players", "Fitness +5 for all active players", "Reduced injury risk (6 matches)"],
    downsides: [] as string[],
    facilityNote: "Medical Centre + Sports Science Lab: more fatigue reduction & longer duration",
    facilityType: "medical_centre",
    temporaryEffect: "recovery_camp",
    durationLabel: "2 rounds (~2 weeks)",
    durationRounds: 2,
  },
  {
    id: "holiday_break",
    emoji: "✈️",
    name: "Holiday Break",
    tagline: "Full rest away from volleyball — morale soars",
    cost: 10_000,
    costTier: "Low" as const,
    benefits: ["Morale +25 for all active players"],
    downsides: ["Fitness −5 for all active players"],
    facilityNote: null,
    facilityType: null,
    temporaryEffect: null,
    durationLabel: "3 rounds (~3 weeks)",
    durationRounds: 3,
  },
  {
    id: "intensive_training",
    emoji: "💪",
    name: "Intensive Training Block",
    tagline: "Push-limits development to fast-track skill growth",
    cost: 20_000,
    costTier: "Medium" as const,
    benefits: ["Bonus training XP for all active players", "Skills may improve sooner"],
    downsides: ["Fatigue +12 for all active players", "Morale −5 for all active players"],
    facilityNote: "Training Complex: more XP bonus at higher levels",
    facilityType: "training_complex",
    temporaryEffect: null,
    durationLabel: "3 rounds (~3 weeks)",
    durationRounds: 3,
  },
];

const COST_COLORS = {
  Low:    "bg-green-500/10  text-green-400  border-green-500/30",
  Medium: "bg-amber-500/10  text-amber-400  border-amber-500/30",
};

const EFFECT_LABELS: Record<string, string> = {
  psych_camp:    "Sports Psychology Camp",
  recovery_camp: "Recovery Retreat",
};

const EFFECT_DESCS: Record<string, string> = {
  psych_camp:    "Finals advantage active — lower stat threshold in Grand Finals",
  recovery_camp: "Recovery mode active — reduced injury risk each match",
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WellbeingCamps() {
  const queryClient = useQueryClient();
  const { toast }   = useToast();

  const { data: status, isLoading } = useGetWellbeingStatus({
    query: { queryKey: getGetWellbeingStatusQueryKey() },
  });
  const { data: facilities } = useGetFacilities();
  const runCamp = useRunWellbeingCamp();

  const [confirming, setConfirming] = useState<typeof CAMP_DEFS[0] | null>(null);

  const facilityLevel = (type: string | null) => {
    if (!type) return 1;
    return facilities?.find(f => f.type === type)?.level ?? 1;
  };

  const handleConfirm = () => {
    if (!confirming) return;
    runCamp.mutate({ data: { campType: confirming.id } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetWellbeingStatusQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyTeamQueryKey() });
        toast({
          title: `${confirming.emoji} ${confirming.name} started`,
          description: `Camp underway — effects apply in ${confirming.durationLabel}.`,
        });
        setConfirming(null);
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Something went wrong";
        toast({ title: "Camp failed", description: msg, variant: "destructive" });
        setConfirming(null);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-72 w-full" />)}
        </div>
      </div>
    );
  }

  const budget     = status?.teamBudget ?? 0;
  const activeFx   = status?.activeEffects ?? [];
  const activeCamp = status?.activeCamp;

  return (
    <div className="space-y-8">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
          <Sparkles className="h-8 w-8" /> Wellbeing Camps
        </h2>
        <p className="text-muted-foreground mt-1">
          Between tournaments, invest in your team's physical and mental state.
        </p>
      </div>

      {/* ── Active effects ────────────────────────────────────────────── */}
      {activeFx.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Active Effects</h3>
          <div className="flex flex-wrap gap-3">
            {activeFx.map(e => (
              <div key={e.id} className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <span className="font-semibold text-primary">{EFFECT_LABELS[e.effectType] ?? e.effectType}</span>
                  <span className="text-muted-foreground"> — {EFFECT_DESCS[e.effectType]}</span>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <Clock className="h-3 w-3" />
                    {e.matchesRemaining} {e.matchesRemaining === 1 ? "match" : "matches"} remaining
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Active camp countdown ─────────────────────────────────────── */}
      {activeCamp && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Camp In Progress</h3>
          <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <span className="text-2xl">{CAMP_DEFS.find(c => c.id === activeCamp.campType)?.emoji ?? "🏕️"}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{activeCamp.campName}</p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <Clock className="h-3 w-3" />
                {activeCamp.roundsRemaining === 0
                  ? "Ready — play a match to apply effects"
                  : `${activeCamp.roundsRemaining} round${activeCamp.roundsRemaining !== 1 ? "s" : ""} remaining — effects pending`}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Budget ───────────────────────────────────────────────────── */}
      <div className="text-sm text-muted-foreground">
        Team budget: <span className="font-semibold text-foreground">${Math.round(budget).toLocaleString()}</span>
      </div>

      {/* ── Camp cards ───────────────────────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {CAMP_DEFS.map(camp => {
          const canAfford  = budget >= camp.cost;
          const facLevel   = facilityLevel(camp.facilityType);
          const hasFacBoost = facLevel > 1 && camp.facilityNote;
          const alreadyActive = camp.temporaryEffect
            ? activeFx.some(e => e.effectType === camp.temporaryEffect)
            : false;

          return (
            <Card
              key={camp.id}
              className={`flex flex-col transition-all ${!canAfford ? "opacity-60" : "hover:border-primary/50 hover:shadow-md"}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-3xl">{camp.emoji}</div>
                  <Badge variant="outline" className={`text-xs shrink-0 ${COST_COLORS[camp.costTier]}`}>
                    {camp.costTier} — ${camp.cost.toLocaleString()}
                  </Badge>
                </div>
                <CardTitle className="text-base mt-1">{camp.name}</CardTitle>
                <CardDescription className="text-sm">{camp.tagline}</CardDescription>
              </CardHeader>

              <CardContent className="flex flex-col flex-1 gap-4">
                {/* Effects */}
                <div className="space-y-1.5">
                  {camp.benefits.map(b => (
                    <div key={b} className="flex items-start gap-1.5 text-sm text-green-400">
                      <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{b}</span>
                    </div>
                  ))}
                  {camp.downsides.map(d => (
                    <div key={d} className="flex items-start gap-1.5 text-sm text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{d}</span>
                    </div>
                  ))}
                </div>

                {/* Facility boost note */}
                {hasFacBoost && (
                  <div className="text-xs text-primary/70 border border-primary/15 bg-primary/5 rounded px-2 py-1.5">
                    ✦ {camp.facilityNote} (Level {facLevel})
                  </div>
                )}

                <div className="mt-auto pt-2">
                  {alreadyActive && (
                    <p className="text-xs text-primary mb-2">
                      ✓ Effect currently active — running again will reset the duration
                    </p>
                  )}
                  {activeCamp && (
                    <p className="text-xs text-amber-500 mb-2">
                      🏕️ A camp is already in progress — wait for it to finish
                    </p>
                  )}
                  <Button
                    className="w-full"
                    variant={canAfford && !activeCamp ? "default" : "outline"}
                    disabled={!canAfford || runCamp.isPending || !!activeCamp}
                    onClick={() => setConfirming(camp)}
                  >
                    {activeCamp ? "Camp in progress" : !canAfford ? "Insufficient funds" : "Run Camp"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Confirmation dialog ───────────────────────────────────────── */}
      <Dialog open={!!confirming} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <span>{confirming?.emoji}</span>
              {confirming?.name}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground pt-1">
              {confirming?.tagline}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
              <span className="text-sm font-medium">Cost</span>
              <span className="font-bold text-primary">${confirming?.cost.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
              <span className="text-sm font-medium flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Camp Duration
              </span>
              <span className="font-bold">{confirming?.durationLabel}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Funds are deducted immediately. Effects are applied to your squad after the camp ends.
            </p>

            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Effects on all active players</p>
              {confirming?.benefits.map(b => (
                <div key={b} className="flex items-start gap-1.5 text-sm text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{b}</span>
                </div>
              ))}
              {confirming?.downsides.map(d => (
                <div key={d} className="flex items-start gap-1.5 text-sm text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{d}</span>
                </div>
              ))}
            </div>

            {confirming?.facilityNote && facilityLevel(confirming.facilityType) > 1 && (
              <div className="text-xs text-primary/80 border border-primary/20 bg-primary/5 rounded px-2 py-1.5">
                ✦ {confirming.facilityNote} (Level {facilityLevel(confirming.facilityType)}) will enhance this camp
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirming(null)}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={runCamp.isPending}>
              {runCamp.isPending ? "Running…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
