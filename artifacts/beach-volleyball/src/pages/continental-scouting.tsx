import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetContinentalRegions,
  useStartContinentalScouting,
  useCollectContinentalMission,
  useCancelContinentalMission,
  useGetContinentalProspects,
  useDevCompleteContinentalMission,
  getGetContinentalRegionsQueryKey,
  getGetContinentalProspectsQueryKey,
  getGetYouthProspectsQueryKey,
  getGetTeamRosterQueryKey,
  useSignYouthProspect,
  useIgnoreYouthProspect,
  useListStaff,
  type ContinentalRegion,
  type YouthProspect,
  type StartContinentalScoutingInput,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import {
  Globe,
  Clock,
  Star,
  DollarSign,
  UserPlus,
  Ban,
  Zap,
  Shield,
  Trophy,
  Radar,
  CheckCircle2,
  CircleDashed,
  AlertCircle,
  MapPin,
  Sparkles,
  X,
  Users,
} from "lucide-react";

// ── Constants ────────────────────────────────────────────────────────────────

const REGION_GRADIENTS: Record<string, string> = {
  "Europe":        "from-blue-950/60 to-indigo-950/60 border-blue-700/30",
  "Asia":          "from-emerald-950/60 to-teal-950/60 border-emerald-700/30",
  "Africa":        "from-orange-950/60 to-amber-950/60 border-orange-700/30",
  "North America": "from-violet-950/60 to-purple-950/60 border-violet-700/30",
  "South America": "from-yellow-950/60 to-lime-950/60 border-yellow-700/30",
  "Oceania":       "from-cyan-950/60 to-sky-950/60 border-cyan-700/30",
};

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

const REGION_ACCENT: Record<string, string> = {
  "Europe":        "text-blue-400",
  "Asia":          "text-emerald-400",
  "Africa":        "text-orange-400",
  "North America": "text-violet-400",
  "South America": "text-yellow-400",
  "Oceania":       "text-cyan-400",
};

const DURATION_OPTIONS = [
  { months: 1, label: "1 Month",  cost: 20000, hint: "Quick scan — fewer prospects"   },
  { months: 3, label: "3 Months", cost: 45000, hint: "Thorough search"                },
  { months: 6, label: "6 Months", cost: 75000, hint: "Deep dive — most prospects"     },
] as const;

const POTENTIAL_CONFIG: Record<string, { stars: number; className: string }> = {
  "Very Low": { stars: 1, className: "text-gray-400 border-gray-500/30 bg-gray-500/10" },
  "Low":      { stars: 2, className: "text-slate-400 border-slate-500/30 bg-slate-500/10" },
  "Moderate": { stars: 3, className: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
  "High":     { stars: 4, className: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  "Elite":    { stars: 5, className: "text-yellow-300 border-yellow-400/30 bg-yellow-500/10" },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMissionLabel(durationMonths: number): string {
  return `${durationMonths}-month mission`;
}

function getMissionProgress(startDate: string, endDate: string): number {
  const start = new Date(startDate).getTime();
  const end   = new Date(endDate).getTime();
  const now   = Date.now();
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
}

function getScoutTier(rating: number | null | undefined): { label: string; className: string } {
  if (!rating) return { label: "Unrated", className: "text-muted-foreground" };
  if (rating >= 86) return { label: "Elite Scout",  className: "text-amber-400" };
  if (rating >= 71) return { label: "Great Scout",  className: "text-orange-400" };
  if (rating >= 51) return { label: "Good Scout",   className: "text-blue-400" };
  if (rating >= 31) return { label: "Fair Scout",   className: "text-slate-400" };
  return                    { label: "Poor Scout",  className: "text-red-400" };
}

function getTalentBadgeClass(level: string): string {
  if (level === "Elite") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  if (level === "High")  return "bg-orange-500/15 text-orange-400 border-orange-500/30";
  return "bg-blue-500/15 text-blue-400 border-blue-500/30";
}

// ── ProspectCard ─────────────────────────────────────────────────────────────

function ProspectCard({
  prospect,
  onSign,
  onIgnore,
  isMutating,
}: {
  prospect: YouthProspect;
  onSign: (id: number, name: string) => void;
  onIgnore: (id: number, name: string) => void;
  isMutating: boolean;
}) {
  const potCfg     = POTENTIAL_CONFIG[prospect.scoutedPotentialLabel ?? ""] ?? null;
  const eliteEvent = prospect.eliteEventType ?? null;
  const eliteCfg   = eliteEvent ? (ELITE_EVENT_CONFIG[eliteEvent] ?? null) : null;

  return (
    <div className={cn(
      "rounded-xl border bg-card p-4 flex flex-col gap-3",
      eliteCfg ? eliteCfg.cardClass : "border-border shadow-sm",
    )}>
      {/* Elite event banner */}
      {eliteCfg && eliteEvent && (
        <div className={cn(
          "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border -mx-0 -mt-0",
          eliteCfg.bannerClass,
        )}>
          {eliteCfg.icon}
          <span className="text-[11px] font-black uppercase tracking-wide">{eliteEvent}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-sm leading-tight truncate">{prospect.name}</p>
          <p className="text-xs text-muted-foreground">Age {prospect.age} · {prospect.continent}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-black text-primary leading-none">{prospect.currentRating}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">OVR</div>
        </div>
      </div>

      {/* Speciality + Scout potential */}
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="text-[10px] font-medium gap-1 text-muted-foreground">
          <Zap className="h-2.5 w-2.5" />
          {prospect.speciality}
        </Badge>
        {potCfg && (
          <Badge variant="outline" className={cn("text-[10px] font-bold gap-1 border", potCfg.className)}>
            <span className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn("h-2 w-2", i < potCfg.stars ? "fill-current" : "opacity-20")}
                />
              ))}
            </span>
            {prospect.scoutedPotentialLabel}
          </Badge>
        )}
      </div>

      {/* Scout attribution */}
      {prospect.discoveredBy && (
        <p className="text-[10px] text-muted-foreground/80 italic leading-tight">
          {prospect.discoveredBy}
        </p>
      )}

      {/* Scouting report */}
      {prospect.scoutingReportText && (
        <div className="rounded-lg bg-muted/30 border border-border/50 p-2.5">
          <p className="text-[11px] text-muted-foreground leading-relaxed italic line-clamp-4">
            "{prospect.scoutingReportText}"
          </p>
        </div>
      )}

      {/* Signing cost */}
      <div className="flex items-center gap-1 text-sm font-semibold text-amber-500">
        <DollarSign className="h-3.5 w-3.5" />
        {prospect.signingCost.toLocaleString()} signing fee
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-border mt-auto">
        <Button
          size="sm"
          className="flex-1 gap-1 text-xs h-8"
          onClick={() => onSign(prospect.id, prospect.name)}
          disabled={isMutating}
        >
          <UserPlus className="h-3.5 w-3.5" />
          Sign to Academy
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1 text-xs h-8 border-red-800/40 text-red-400 hover:bg-red-950/30"
          onClick={() => onIgnore(prospect.id, prospect.name)}
          disabled={isMutating}
        >
          <Ban className="h-3.5 w-3.5" />
          Dismiss
        </Button>
      </div>
    </div>
  );
}

// ── RegionCard ───────────────────────────────────────────────────────────────

function RegionCard({
  region,
  onSendScout,
  onCollect,
  onCancel,
  onDevComplete,
  isCollecting,
  isCancelling,
  disabled,
}: {
  region: ContinentalRegion;
  onSendScout: (region: ContinentalRegion) => void;
  onCollect:    (missionId: number) => void;
  onCancel:     (missionId: number) => void;
  onDevComplete:(missionId: number) => void;
  isCollecting: boolean;
  isCancelling: boolean;
  disabled: boolean;
}) {
  const gradient = REGION_GRADIENTS[region.id] ?? "from-muted/20 to-muted/40 border-border";
  const accent   = REGION_ACCENT[region.id]    ?? "text-primary";
  const mission  = region.activeMission;

  const isIdle      = !mission;
  const isActive    = mission?.status === "active";
  const isCompleted = mission?.status === "completed";
  const isCollected = mission?.status === "collected";

  const progress = isActive && mission
    ? getMissionProgress(mission.startDate, mission.endDate)
    : 0;

  return (
    <div
      className={cn(
        "rounded-xl border bg-gradient-to-br p-4 flex flex-col gap-3",
        gradient,
      )}
    >
      {/* Region header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">{region.emoji}</span>
            <h3 className={cn("font-bold text-sm", accent)}>{region.name}</h3>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
            {region.description}
          </p>
        </div>
        <Badge variant="outline" className={cn("text-[10px] shrink-0 border", getTalentBadgeClass(region.talentLevel))}>
          {region.talentLevel}
        </Badge>
      </div>

      {/* Specialties */}
      <div className="flex flex-wrap gap-1">
        {region.specialties.map((s) => (
          <span key={s} className="text-[10px] bg-muted/30 text-muted-foreground px-2 py-0.5 rounded-full border border-border/50">
            {s}
          </span>
        ))}
      </div>

      {/* Status section */}
      <div className="flex flex-col gap-2 mt-auto pt-2 border-t border-border/30">
        {isIdle && (
          <>
            <div className="grid grid-cols-3 gap-1 text-center">
              {DURATION_OPTIONS.map((opt) => (
                <div key={opt.months} className="rounded bg-muted/20 px-1 py-1.5">
                  <div className="text-[10px] font-bold text-foreground/80">{opt.label}</div>
                  <div className="text-[10px] text-muted-foreground">${(opt.cost / 1000).toFixed(0)}k</div>
                </div>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-8 w-full border-border/50"
              onClick={() => onSendScout(region)}
              disabled={disabled}
            >
              <Radar className="h-3.5 w-3.5" />
              Send Scout →
            </Button>
          </>
        )}

        {isActive && mission && (
          <>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <CircleDashed className="h-3 w-3 text-blue-400 animate-spin" style={{ animationDuration: "3s" }} />
                <span className="text-blue-400 font-medium">Scouting…</span>
              </div>
              <span className="font-medium">{getMissionLabel(mission.durationMonths)}</span>
            </div>
            <Progress value={progress} className="h-1.5" />
            <div className="flex gap-2">
              {import.meta.env.DEV && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 px-2 border-border/50 text-muted-foreground"
                  onClick={() => onDevComplete(mission.id)}
                >
                  ⚡ Finish
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1 text-xs h-7 border-red-800/40 text-red-400 hover:bg-red-950/30"
                onClick={() => onCancel(mission.id)}
                disabled={isCancelling}
              >
                <X className="h-3 w-3" />
                Cancel
              </Button>
            </div>
          </>
        )}

        {isCompleted && mission && (
          <>
            <div className="flex items-center gap-1.5 text-[11px]">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span className="font-semibold text-amber-400">
                {mission.prospectsFound} prospect{mission.prospectsFound !== 1 ? "s" : ""} found!
              </span>
            </div>
            <Button
              size="sm"
              className="gap-1.5 text-xs h-8 w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              onClick={() => onCollect(mission.id)}
              disabled={isCollecting}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isCollecting ? "Collecting…" : "Collect Prospects"}
            </Button>
          </>
        )}

        {isCollected && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/60" />
            <span>Prospects collected — send a new scout anytime</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ContinentalScouting() {
  const qc    = useQueryClient();
  const { toast } = useToast();

  const [dialogRegion,   setDialogRegion]   = useState<ContinentalRegion | null>(null);
  const [selDuration,    setSelDuration]    = useState<1 | 3 | 6>(1);
  const [selStaffId,     setSelStaffId]     = useState<string>("none");

  const { data: regions,   isLoading: regionsLoading   } = useGetContinentalRegions();
  const { data: prospects, isLoading: prospectsLoading } = useGetContinentalProspects();
  const { data: staff }                                   = useListStaff();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetContinentalRegionsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetContinentalProspectsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetYouthProspectsQueryKey() });
  };

  const startMission    = useStartContinentalScouting();
  const collectMission  = useCollectContinentalMission();
  const cancelMission   = useCancelContinentalMission();
  const devComplete     = useDevCompleteContinentalMission();
  const signProspect    = useSignYouthProspect();
  const ignoreProspect  = useIgnoreYouthProspect();

  const activeMissions  = regions?.filter((r) => r.activeMission?.status === "active").length  ?? 0;
  const completedCount  = regions?.filter((r) => r.activeMission?.status === "completed").length ?? 0;
  const prospectCount   = prospects?.length ?? 0;

  const hasScout = (staff ?? []).some((s: any) => s.role === "scout");

  function handleSendScout() {
    if (!dialogRegion) return;
    const payload: StartContinentalScoutingInput = {
      region:        dialogRegion.id,
      durationMonths: selDuration,
      staffId:       selStaffId !== "none" ? Number(selStaffId) : null,
    };
    startMission.mutate({ data: payload }, {
      onSuccess: () => {
        toast({ title: "Scout deployed!", description: `Scouting ${dialogRegion.name} for ${selDuration} month${selDuration > 1 ? "s" : ""}.` });
        invalidate();
        setDialogRegion(null);
      },
      onError: (err: any) => {
        toast({ title: "Failed to deploy scout", description: err?.message ?? "Unknown error", variant: "destructive" });
      },
    });
  }

  function handleCollect(id: number) {
    collectMission.mutate({ id }, {
      onSuccess: (result) => {
        toast({ title: "Prospects collected!", description: `${result.prospectsFound} prospect${result.prospectsFound !== 1 ? "s" : ""} added to your scouting list.` });
        invalidate();
      },
      onError: (err: any) => {
        toast({ title: "Collection failed", description: err?.message, variant: "destructive" });
      },
    });
  }

  function handleCancel(id: number) {
    cancelMission.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Mission cancelled" });
        invalidate();
      },
      onError: (err: any) => {
        toast({ title: "Cancel failed", description: err?.message, variant: "destructive" });
      },
    });
  }

  function handleDevComplete(id: number) {
    devComplete.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "[Dev] Mission fast-forwarded" });
        invalidate();
      },
    });
  }

  function handleSign(id: number, name: string) {
    signProspect.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Signed!", description: `${name} has joined the Youth Academy.` });
        invalidate();
        qc.invalidateQueries({ queryKey: getGetTeamRosterQueryKey() });
      },
      onError: (err: any) => {
        toast({ title: "Signing failed", description: err?.message, variant: "destructive" });
      },
    });
  }

  function handleIgnore(id: number, name: string) {
    ignoreProspect.mutate({ id }, {
      onSuccess: () => {
        toast({ description: `${name} dismissed.` });
        invalidate();
      },
    });
  }

  const selectedDurationOpt = DURATION_OPTIONS.find((d) => d.months === selDuration)!;
  const selectedStaff = staff?.find((s) => String(s.id) === selStaffId);
  const isMutating = signProspect.isPending || ignoreProspect.isPending;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-black">Continental Scouting</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Deploy scouts to 6 global regions and discover elite talent.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {activeMissions > 0 && (
            <Badge variant="secondary" className="gap-1.5 text-xs">
              <CircleDashed className="h-3 w-3 text-blue-400" />
              {activeMissions} active
            </Badge>
          )}
          {completedCount > 0 && (
            <Badge className="gap-1.5 text-xs bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20">
              <Sparkles className="h-3 w-3" />
              {completedCount} ready to collect
            </Badge>
          )}
          {prospectCount > 0 && (
            <Badge variant="secondary" className="gap-1.5 text-xs">
              <Users className="h-3 w-3 text-emerald-400" />
              {prospectCount} prospects available
            </Badge>
          )}
        </div>
      </div>

      {/* No-scout warning */}
      {!hasScout && staff !== undefined && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-400">No Scout hired</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              You need a Scout on your staff to send scouting missions.{" "}
              <Link href="/staff-market" className="text-primary underline underline-offset-2 hover:text-primary/80">
                Visit the Staff Market
              </Link>{" "}
              to hire one.
            </p>
          </div>
        </div>
      )}

      {/* Regions Grid */}
      {regionsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(regions ?? []).map((region) => (
            <RegionCard
              key={region.id}
              region={region}
              onSendScout={(r) => {
                setDialogRegion(r);
                setSelDuration(1);
                setSelStaffId("none");
              }}
              onCollect={handleCollect}
              onCancel={handleCancel}
              onDevComplete={handleDevComplete}
              isCollecting={collectMission.isPending}
              isCancelling={cancelMission.isPending}
              disabled={!hasScout}
            />
          ))}
        </div>
      )}

      {/* Collected Prospects */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Discovered Prospects</h2>
          {!prospectsLoading && (
            <Badge variant="secondary" className="text-xs ml-1">
              {prospectCount} available
            </Badge>
          )}
        </div>

        {prospectsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
          </div>
        ) : prospectCount === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/10 p-8 text-center">
            <Globe className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No prospects yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Send scouts to regions above and collect their reports when complete.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(prospects ?? []).map((p) => (
              <ProspectCard
                key={p.id}
                prospect={p}
                onSign={handleSign}
                onIgnore={handleIgnore}
                isMutating={isMutating}
              />
            ))}
          </div>
        )}
      </section>

      {/* Send Scout Dialog */}
      <Dialog open={dialogRegion !== null} onOpenChange={(open) => !open && setDialogRegion(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{dialogRegion?.emoji}</span>
              Scout {dialogRegion?.name}
            </DialogTitle>
            <DialogDescription>
              {dialogRegion?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Duration picker */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">Mission Duration</label>
              <div className="grid grid-cols-3 gap-2">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.months}
                    onClick={() => setSelDuration(opt.months)}
                    className={cn(
                      "rounded-lg border p-2.5 text-center transition-colors",
                      selDuration === opt.months
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/20 text-muted-foreground hover:border-muted-foreground/40",
                    )}
                  >
                    <div className="text-xs font-bold">{opt.label}</div>
                    <div className="text-[11px] mt-0.5 font-semibold">${(opt.cost / 1000).toFixed(0)}k</div>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Longer missions find more prospects and improve scouting accuracy.
              </p>
            </div>

            {/* Scout assignment */}
            {staff && staff.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-semibold">Assign Scout <span className="text-muted-foreground font-normal">(optional)</span></label>
                <Select value={selStaffId} onValueChange={setSelStaffId}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="No scout assigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No scout assigned</SelectItem>
                    {staff.map((s) => {
                      const tier = getScoutTier(s.scoutingRating);
                      return (
                        <SelectItem key={s.id} value={String(s.id)}>
                          <span className="flex items-center gap-2">
                            <span>{s.name}</span>
                            {s.scoutingRating != null && (
                              <span className={cn("text-[10px] font-semibold", tier.className)}>
                                {tier.label} ({s.scoutingRating})
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {selectedStaff?.scoutingRating != null && (
                  <p className={cn("text-[11px]", getScoutTier(selectedStaff.scoutingRating).className)}>
                    {getScoutTier(selectedStaff.scoutingRating).label} scouts find more prospects and assess potential more accurately.
                  </p>
                )}
              </div>
            )}

            {/* Cost summary */}
            <div className="rounded-lg bg-muted/20 border border-border/50 p-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-sm">
                <DollarSign className="h-4 w-4 text-amber-500" />
                <span className="font-semibold">${selectedDurationOpt.cost.toLocaleString()}</span>
                <span className="text-muted-foreground">mission cost</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{selDuration}-month mission</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogRegion(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendScout}
              disabled={startMission.isPending}
              className="gap-1.5"
            >
              <Radar className="h-4 w-4" />
              {startMission.isPending ? "Deploying…" : "Deploy Scout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
