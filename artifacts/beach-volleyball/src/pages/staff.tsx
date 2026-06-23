import {
  useListStaff,
  useFireStaff,
  getListStaffQueryKey,
  getGetStaffMarketQueryKey,
} from "@workspace/api-client-react";
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
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

const MAX_STAFF = 4;

type StaffRole =
  | "head_coach"
  | "assistant_coach"
  | "fitness_trainer"
  | "strength_conditioner"
  | "massage_therapist"
  | "promotions_manager";

const ROLE_LABELS: Record<string, string> = {
  head_coach:           "Head Coach",
  assistant_coach:      "Assistant Coach",
  fitness_trainer:      "Fitness Trainer",
  strength_conditioner: "Strength Conditioner",
  massage_therapist:    "Massage Therapist",
  promotions_manager:   "Promotions Manager",
};

const ROLE_COLORS: Record<string, string> = {
  head_coach:           "bg-amber-500",
  assistant_coach:      "bg-blue-500",
  fitness_trainer:      "bg-green-500",
  strength_conditioner: "bg-red-500",
  massage_therapist:    "bg-teal-500",
  promotions_manager:   "bg-purple-500",
};

type IconFC = React.FC<{ className?: string }>;

const ROLE_ICONS: Record<string, IconFC> = {
  head_coach:           Star as IconFC,
  assistant_coach:      Users as IconFC,
  fitness_trainer:      Zap as IconFC,
  strength_conditioner: Dumbbell as IconFC,
  massage_therapist:    Heart as IconFC,
  promotions_manager:   BadgeDollarSign as IconFC,
};

const BONUS_DESCRIPTIONS: Record<string, { icon: IconFC; color: string; label: string; detail: string }> = {
  head_coach:           { icon: TrendingUp as IconFC,      color: "text-amber-600",  label: "Training XP",       detail: "+15–24% training XP based on OVR" },
  assistant_coach:      { icon: Target as IconFC,          color: "text-blue-600",   label: "Set Play Design",    detail: "+8–12% serve & block training" },
  fitness_trainer:      { icon: Zap as IconFC,             color: "text-green-600",  label: "Fatigue Recovery",   detail: "Speeds post-match fatigue recovery" },
  strength_conditioner: { icon: Dumbbell as IconFC,        color: "text-red-600",    label: "Injury Prevention",  detail: "Reduces injury chance & recovery time" },
  massage_therapist:    { icon: Heart as IconFC,           color: "text-teal-600",   label: "Faster Healing",     detail: "Extra injury recovery ticks per week" },
  promotions_manager:   { icon: BadgeDollarSign as IconFC, color: "text-purple-600", label: "Sponsorship Boost",  detail: "+10–18% sponsorship income" },
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

function StaffCard({ member, onFire }: { member: any; onFire: (id: number) => void }) {
  const RoleIcon = ROLE_ICONS[member.role] ?? Star;
  const attrs = Object.entries(member.attributes ?? {}) as [string, number][];

  return (
    <Card className="overflow-hidden hover:shadow-xl transition-all border-border">
      <div className="relative h-56 overflow-hidden">
        <img
          src={member.imageUrl ?? undefined}
          alt={member.name}
          className="w-full h-full object-cover object-[center_15%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

        {/* Role badge */}
        <div className="absolute top-2 left-2">
          <Badge className={cn("text-white text-[10px] gap-1 shadow", ROLE_COLORS[member.role] ?? "bg-slate-500")}>
            <RoleIcon className="h-2.5 w-2.5" />
            {ROLE_LABELS[member.role] ?? member.role}
          </Badge>
        </div>

        {/* Fire button */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7 bg-black/40 hover:bg-red-600/80 text-white"
            >
              <UserMinus className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Release {member.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will free up a staff slot. The {ROLE_LABELS[member.role]} position will be vacant.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onFire(member.id)}
                className="bg-destructive text-destructive-foreground"
              >
                Release
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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

  const fireMutation = useFireStaff();

  const handleFire = (staffId: number) => {
    fireMutation.mutate({ id: staffId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStaffMarketQueryKey() });
        toast({ title: "Staff Released", description: "The position is now vacant." });
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
          <StaffCard key={member.id} member={member} onFire={handleFire} />
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
