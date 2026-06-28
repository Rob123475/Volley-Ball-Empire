import { useState } from "react";
import {
  useListStaff,
  useFireStaff,
  useGetMyTeam,
  getListStaffQueryKey,
  getGetStaffMarketQueryKey,
  getGetMyTeamQueryKey,
} from "@workspace/api-client-react";
import { StaffPortrait } from "@/components/ui/staff-portrait";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  UserMinus,
  UserPlus,
  DollarSign,
  Calendar,
  Sparkles,
  TrendingUp,
  Heart,
  Shield,
  Zap,
  Target,
  BadgeDollarSign,
  Dumbbell,
  Users,
  Star,
  Radar,
  Binoculars,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

const MAX_STAFF = 8;

type StaffRole =
  | "head_coach"
  | "assistant_coach"
  | "fitness_trainer"
  | "strength_conditioner"
  | "massage_therapist"
  | "promotions_manager"
  | "scout";

const ROLE_LABELS: Record<string, string> = {
  head_coach:           "Head Coach",
  assistant_coach:      "Assistant Coach",
  fitness_trainer:      "Fitness Trainer",
  strength_conditioner: "Strength Conditioner",
  massage_therapist:    "Massage Therapist",
  promotions_manager:   "Promotions Manager",
  scout:                "Scout",
};

const ROLE_COLORS: Record<string, string> = {
  head_coach:           "bg-amber-500",
  assistant_coach:      "bg-blue-500",
  fitness_trainer:      "bg-green-500",
  strength_conditioner: "bg-red-500",
  massage_therapist:    "bg-teal-500",
  promotions_manager:   "bg-purple-500",
  scout:                "bg-cyan-600",
};

type IconFC = React.FC<{ className?: string }>;

const ROLE_ICONS: Record<string, IconFC> = {
  head_coach:           Star as IconFC,
  assistant_coach:      Users as IconFC,
  fitness_trainer:      Zap as IconFC,
  strength_conditioner: Dumbbell as IconFC,
  massage_therapist:    Heart as IconFC,
  promotions_manager:   BadgeDollarSign as IconFC,
  scout:                Binoculars as IconFC,
};

const BONUS_DESCRIPTIONS: Record<string, { icon: IconFC; color: string; label: string; detail: string }> = {
  head_coach:           { icon: TrendingUp as IconFC,      color: "text-amber-600",  label: "Training XP",         detail: "+15–24% training XP based on OVR"              },
  assistant_coach:      { icon: Target as IconFC,          color: "text-blue-600",   label: "Set Play Design",      detail: "+8–12% serve & block training"                 },
  fitness_trainer:      { icon: Zap as IconFC,             color: "text-green-600",  label: "Fatigue Recovery",     detail: "Speeds post-match fatigue recovery"             },
  strength_conditioner: { icon: Dumbbell as IconFC,        color: "text-red-600",    label: "Injury Prevention",    detail: "Reduces injury chance & recovery time"          },
  massage_therapist:    { icon: Heart as IconFC,           color: "text-teal-600",   label: "Faster Healing",       detail: "Extra injury recovery ticks per week"           },
  promotions_manager:   { icon: BadgeDollarSign as IconFC, color: "text-purple-600", label: "Sponsorship Boost",    detail: "+10–18% sponsorship income"                    },
  scout:                { icon: Binoculars as IconFC,      color: "text-cyan-600",   label: "Scouting Network",     detail: "Unlocks staff scouting & improves prospect quality" },
};

function OvrBadge({ rating }: { rating: number }) {
  const color =
    rating >= 85 ? "bg-yellow-400 text-yellow-900" :
    rating >= 75 ? "bg-blue-500 text-white" :
    rating >= 65 ? "bg-slate-500 text-white" :
                   "bg-slate-300 text-slate-700";
  return (
    <div className={cn(
      "absolute bottom-3 right-3 flex flex-col items-center justify-center rounded-md w-12 h-12 font-black leading-none shadow-lg",
      color
    )}>
      <span className="text-[8px] font-bold opacity-70 uppercase tracking-wider">OVR</span>
      <span className="text-lg">{rating}</span>
    </div>
  );
}

function AttributeBar({ name, value }: { name: string; value: number }) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px]">
        <span className="text-muted-foreground font-medium truncate pr-2">{name}</span>
        <span className="font-bold tabular-nums shrink-0">{value}</span>
      </div>
      <Progress
        value={value}
        className="h-1.5"
      />
    </div>
  );
}

function StaffCard({
  member,
  teamBudget,
  onFire,
  isFiring,
}: {
  member: any;
  teamBudget: number;
  onFire: (id: number) => void;
  isFiring: boolean;
}) {
  const [open, setOpen] = useState(false);
  const RoleIcon = ROLE_ICONS[member.role] ?? Star;
  const attrs = Object.entries(member.attributes ?? {}) as [string, number][];

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  const monthlySalary   = Number(member.salary);
  const monthsRemaining = member.contractLength as number;
  const remainingValue  = monthlySalary * monthsRemaining;
  const terminationFee  = Math.round(remainingValue * 0.5);
  const balanceAfter    = teamBudget - terminationFee;
  const canAfford       = teamBudget >= terminationFee;

  return (
    <Card className="overflow-hidden hover:shadow-xl transition-all border-border">
      <div className="relative h-56 overflow-hidden">
        <StaffPortrait
          name={member.name}
          imageUrl={member.imageUrl}
          role={member.role}
          heightClass="h-56"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

        {/* Role badge */}
        <div className="absolute top-2 left-2">
          <Badge className={cn("text-white text-[10px] gap-1 shadow", ROLE_COLORS[member.role] ?? "bg-slate-500")}>
            <RoleIcon className="h-2.5 w-2.5" />
            {ROLE_LABELS[member.role] ?? member.role}
          </Badge>
        </div>

        {/* Terminate Contract button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(true)}
          className="absolute top-2 right-2 h-7 w-7 bg-black/40 hover:bg-red-600/80 text-white"
        >
          <UserMinus className="h-3.5 w-3.5" />
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <UserMinus className="h-5 w-5" />
                Terminate Contract
              </DialogTitle>
              <DialogDescription>
                Review the termination details carefully before confirming.
              </DialogDescription>
            </DialogHeader>

            {/* Staff details */}
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Staff member</span>
                  <span className="font-semibold">{member.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Role</span>
                  <span className="font-semibold">{ROLE_LABELS[member.role] ?? member.role}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly salary</span>
                  <span className="font-semibold">{fmt(monthlySalary)}/mo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Months remaining</span>
                  <span className="font-semibold">{monthsRemaining} months</span>
                </div>
              </div>

              {/* Fee calculation */}
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Remaining contract value</span>
                  <span>{fmt(remainingValue)}</span>
                </div>
                <div className="flex justify-between font-bold text-destructive text-base">
                  <span>Termination fee (50%)</span>
                  <span>{fmt(terminationFee)}</span>
                </div>
              </div>

              {/* Balance impact */}
              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Club balance now</span>
                  <span className={cn("font-semibold", teamBudget < terminationFee ? "text-destructive" : "")}>
                    {fmt(teamBudget)}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <ArrowRight className="h-4 w-4" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Balance after</span>
                  <span className={cn("font-bold text-base", canAfford ? "text-foreground" : "text-destructive")}>
                    {canAfford ? fmt(balanceAfter) : "—"}
                  </span>
                </div>
              </div>

              {!canAfford && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="font-medium">Insufficient funds to terminate this contract.</span>
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center font-medium">
                ⚠️ This cannot be undone.
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isFiring}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={!canAfford || isFiring}
                onClick={() => {
                  onFire(member.id);
                  setOpen(false);
                }}
              >
                {isFiring ? "Terminating…" : "Terminate Contract"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* OVR */}
        <OvrBadge rating={member.overallRating} />

        {/* Name & info */}
        <div className="absolute bottom-0 left-0 right-0 p-3 pr-16">
          <div className="font-bold text-base text-white drop-shadow leading-tight">{member.name}</div>
          <div className="text-xs text-white/70">{member.nationality} · Age {member.age}</div>
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Special Trait */}
        {member.specialTrait && (
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{member.specialTrait}</span>
          </div>
        )}

        {/* Scouting Rating */}
        {member.scoutingRating != null && (() => {
          const r = member.scoutingRating as number;
          const { label, color } = r >= 86 ? { label: "Elite Scout",  color: "text-amber-400"  } :
                                   r >= 71 ? { label: "Great Scout",  color: "text-orange-400" } :
                                   r >= 51 ? { label: "Good Scout",   color: "text-blue-400"   } :
                                   r >= 31 ? { label: "Fair Scout",   color: "text-slate-400"  } :
                                             { label: "Poor Scout",   color: "text-red-400"    };
          return (
            <div className="flex items-center gap-1.5 text-xs">
              <Radar className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Scouting:</span>
              <span className={cn("font-semibold", color)}>{label} ({r})</span>
            </div>
          );
        })()}

        {/* Attributes */}
        {attrs.length > 0 && (
          <div className="space-y-1.5">
            {attrs.map(([name, value]) => (
              <AttributeBar key={name} name={name} value={value} />
            ))}
          </div>
        )}

        {/* Contract & Salary */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {member.contractLength}mo contract
          </span>
          <span className="flex items-center gap-1 font-bold text-foreground">
            <DollarSign className="h-3 w-3 text-green-600" />
            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(member.salary)}/mo
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptySlot({ slotNumber }: { slotNumber: number }) {
  return (
    <Card className="border-2 border-dashed border-border/50 bg-muted/20">
      <div className="h-56 flex flex-col items-center justify-center gap-3 text-muted-foreground/40">
        <Users className="h-10 w-10" />
        <span className="text-sm font-medium">Staff Slot {slotNumber}</span>
        <span className="text-xs">Vacant</span>
      </div>
      <CardContent className="p-4 border-t border-dashed border-border/40">
        <Link href="/staff-market">
          <Button variant="outline" className="w-full gap-2 border-dashed text-muted-foreground">
            <UserPlus className="h-4 w-4" />
            Browse Staff Market
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function BonusPanel({ staff }: { staff: any[] }) {
  const roleSet = new Set(staff.map(s => s.role));
  const activeBonuses = Object.entries(BONUS_DESCRIPTIONS).filter(([role]) => roleSet.has(role));
  const missingBonuses = Object.entries(BONUS_DESCRIPTIONS).filter(([role]) => !roleSet.has(role));

  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Active Staff Bonuses
        </h3>
        {activeBonuses.length === 0 && (
          <p className="text-xs text-muted-foreground">Hire staff to unlock bonuses.</p>
        )}
        <div className="space-y-2">
          {activeBonuses.map(([role, bonus]) => {
            const Icon = bonus.icon;
            return (
              <div key={role} className="flex items-start gap-2.5 text-xs">
                <div className={cn("mt-0.5 rounded-full bg-muted p-1", bonus.color)}>
                  <Icon className="h-3 w-3" />
                </div>
                <div>
                  <span className="font-semibold text-foreground">{bonus.label}</span>
                  <span className="text-muted-foreground ml-1.5">{bonus.detail}</span>
                </div>
              </div>
            );
          })}
          {missingBonuses.length > 0 && activeBonuses.length > 0 && (
            <div className="pt-2 border-t border-border mt-2">
              <p className="text-[10px] text-muted-foreground mb-1.5">Unlock more bonuses by hiring:</p>
              <div className="flex flex-wrap gap-1">
                {missingBonuses.map(([role]) => (
                  <Badge key={role} variant="outline" className="text-[9px] text-muted-foreground border-dashed">
                    {ROLE_LABELS[role]}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function StaffManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: myStaff = [], isLoading } = useListStaff({
    query: { queryKey: getListStaffQueryKey() },
  });

  const { data: team } = useGetMyTeam({ query: { queryKey: getGetMyTeamQueryKey() } });
  const teamBudget = Number(team?.budget ?? 0);

  const fireMutation = useFireStaff();

  const handleFire = (staffId: number) => {
    fireMutation.mutate({ id: staffId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStaffMarketQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyTeamQueryKey() });
        toast({
          title: "Contract Terminated",
          description: "The termination fee has been deducted from your club balance.",
        });
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? "Could not terminate contract.";
        toast({ title: "Termination Failed", description: msg, variant: "destructive" });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-56" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-80 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  const emptySlots = Math.max(0, MAX_STAFF - myStaff.length);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Staff Management</h2>
          <p className="text-muted-foreground">
            {myStaff.length} of {MAX_STAFF} staff slots filled
          </p>
        </div>
        {myStaff.length < MAX_STAFF && (
          <Link href="/staff-market">
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Browse Staff Market
            </Button>
          </Link>
        )}
      </div>

      {/* Staff Slots */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {myStaff.map((member) => (
          <StaffCard
            key={member.id}
            member={member}
            teamBudget={teamBudget}
            onFire={handleFire}
            isFiring={fireMutation.isPending}
          />
        ))}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <EmptySlot key={`empty-${i}`} slotNumber={myStaff.length + i + 1} />
        ))}
      </div>

      {/* Bonuses panel */}
      <BonusPanel staff={myStaff} />
    </div>
  );
}
