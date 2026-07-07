import {
  useGetStaffMarket,
  useHireStaff,
  useScoutStaff,
  useListStaff,
  getGetStaffMarketQueryKey,
  getListStaffQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { StaffPortrait } from "@/components/ui/staff-portrait";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  UserPlus,
  DollarSign,
  Calendar,
  Sparkles,
  Search,
  SlidersHorizontal,
  Eye,
  HelpCircle,
  Star,
  Users,
  Zap,
  Dumbbell,
  Heart,
  BadgeDollarSign,
  ChevronDown,
  Radar,
  Binoculars,
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
import { useState } from "react";
import { Link } from "wouter";

const MAX_STAFF = 8;

const ROLE_LABELS: Record<string, string> = {
  all:                  "All Roles",
  head_coach:           "Head Coach",
  assistant_coach:      "Assistant Coach",
  fitness_trainer:      "Fitness Trainer",
  strength_conditioner: "Strength Coach",
  massage_therapist:    "Massage Therapist",
  promotions_manager:   "Promotional Manager",
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

const ROLE_FILTERS = ["all", "head_coach", "assistant_coach", "fitness_trainer", "strength_conditioner", "massage_therapist", "promotions_manager", "scout"] as const;

function OvrDisplay({ rating, revealed }: { rating: number; revealed: boolean }) {
  if (!revealed) {
    return (
      <div className="absolute bottom-3 right-3 flex flex-col items-center justify-center rounded-md w-12 h-12 bg-black/50 border border-white/20 leading-none">
        <span className="text-[8px] text-white/50 font-bold uppercase tracking-wider">OVR</span>
        <HelpCircle className="h-5 w-5 text-white/40 mt-0.5" />
      </div>
    );
  }
  const color =
    rating >= 85 ? "bg-yellow-400 text-yellow-900" :
    rating >= 75 ? "bg-blue-500 text-white" :
    rating >= 65 ? "bg-slate-500 text-white" :
                   "bg-slate-300 text-slate-700";
  return (
    <div className={cn("absolute bottom-3 right-3 flex flex-col items-center justify-center rounded-md w-12 h-12 font-black leading-none shadow-lg", color)}>
      <span className="text-[8px] font-bold opacity-70 uppercase tracking-wider">OVR</span>
      <span className="text-lg">{rating}</span>
    </div>
  );
}

function AttributeBar({ name, value, revealed }: { name: string; value: number; revealed: boolean }) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px]">
        <span className="text-muted-foreground font-medium truncate pr-2">{name}</span>
        {revealed ? (
          <span className="font-bold tabular-nums shrink-0">{value}</span>
        ) : (
          <span className="text-muted-foreground/40 shrink-0">??</span>
        )}
      </div>
      <Progress
        value={revealed ? value : undefined}
        className={cn("h-1.5", !revealed && "opacity-30")}
      />
    </div>
  );
}

const STAFF_SCOUT_COST = 1_000;

function StaffMarketCard({
  member,
  isOwned,
  onHire,
  onScout,
  isHiring,
  isScouting,
  canHire,
  hasCoach,
}: {
  member: any;
  isOwned: boolean;
  onHire: (id: number) => void;
  onScout: (id: number) => void;
  isHiring: boolean;
  isScouting: boolean;
  canHire: boolean;
  hasCoach: boolean;
}) {
  const RoleIcon = ROLE_ICONS[member.role] ?? Star;
  const attrs = Object.entries(member.attributes ?? {}) as [string, number][];
  const revealed = member.isScoutRevealed;

  return (
    <Card className={cn(
      "overflow-hidden transition-all group",
      isOwned ? "ring-2 ring-primary/40" : "hover:shadow-xl hover:border-border/80"
    )}>
      <div className="relative h-52 overflow-hidden">
        <StaffPortrait
          name={member.name}
          imageUrl={member.imageUrl}
          role={member.role}
          heightClass="h-52"
          className="group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

        {/* Role badge */}
        <div className="absolute top-2 left-2 flex gap-1.5">
          <Badge className={cn("text-white text-[10px] gap-1 shadow", ROLE_COLORS[member.role] ?? "bg-slate-500")}>
            <RoleIcon className="h-2.5 w-2.5" />
            {ROLE_LABELS[member.role] ?? member.role}
          </Badge>
          {isOwned && (
            <Badge className="bg-primary/80 text-white text-[10px] shadow">On Staff</Badge>
          )}
        </div>

        {/* OVR */}
        <OvrDisplay rating={member.overallRating} revealed={revealed} />

        {/* Name */}
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
              <AttributeBar key={name} name={name} value={value} revealed={revealed} />
            ))}
          </div>
        )}

        {/* Contract & Salary */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {member.contractLength}mo
          </span>
          <span className="flex items-center gap-1 font-bold text-foreground">
            <DollarSign className="h-3 w-3 text-green-600" />
            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(member.salary)}/mo
          </span>
        </div>

        {/* Actions */}
        {!isOwned && (
          <div className="flex gap-2">
            {!revealed && (
              hasCoach ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs shrink-0"
                      disabled={isScouting}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {isScouting ? "Scouting…" : "Scout"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Scout {member.name}?</AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="space-y-3 text-sm text-muted-foreground">
                          <p>Scouting will reveal this staff member's true OVR, role-specific attributes, personality, speciality, and salary confidence.</p>
                          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-foreground">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Scout cost</span>
                              <span className="font-bold text-amber-400">${STAFF_SCOUT_COST.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Reveal time</span>
                              <span className="font-semibold text-green-400">Instant</span>
                            </div>
                          </div>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onScout(member.id)}>
                        Scout Staff
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs shrink-0 opacity-50 cursor-not-allowed"
                  disabled
                  title="Hire a Head Coach, Assistant Coach, or Scout to scout staff."
                >
                  <Eye className="h-3.5 w-3.5" />
                  Scout
                </Button>
              )
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  className="flex-1 gap-1.5 text-xs"
                  disabled={isHiring || !canHire}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  {isHiring ? "Hiring…" : !canHire ? "Staff Full" : "Hire"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Hire {member.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will hire {member.name} as your {ROLE_LABELS[member.role]}.
                    Monthly salary: {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(member.salary)}.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onHire(member.id)}>
                    Hire Staff
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function StaffMarket() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [search, setSearch]         = useState("");

  const params = {
    ...(roleFilter !== "all" ? { role: roleFilter } : {}),
    ...(search ? { search } : {}),
  };

  const { data: marketStaff = [], isLoading } = useGetStaffMarket(
    params,
    { query: { queryKey: getGetStaffMarketQueryKey(params) } }
  );
  const { data: myStaff = [] } = useListStaff({
    query: { queryKey: getListStaffQueryKey() },
  });

  const hireMutation  = useHireStaff();
  const scoutMutation = useScoutStaff();

  const myStaffIds = new Set(myStaff.map(s => s.id));
  const canHire  = myStaff.length < MAX_STAFF;
  const hasCoach = myStaff.some(s => s.role === "head_coach" || s.role === "assistant_coach" || s.role === "scout");

  const handleHire = (staffId: number) => {
    hireMutation.mutate({ data: { staffId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStaffMarketQueryKey() });
        toast({ title: "Staff Hired!", description: "Your new specialist has joined the team." });
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? "Could not hire staff member.";
        toast({ title: "Hire Failed", description: msg, variant: "destructive" });
      },
    });
  };

  const handleScout = (staffId: number) => {
    scoutMutation.mutate({ id: staffId }, {
      onSuccess: (staff) => {
        queryClient.invalidateQueries({ queryKey: getGetStaffMarketQueryKey() });
        toast({
          title: "Scout Report Ready",
          description: `${staff.name} rated ${staff.overallRating} OVR. Attributes revealed.`,
        });
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? "Could not scout this staff member.";
        toast({ title: "Scout Failed", description: msg, variant: "destructive" });
      },
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
            <Users className="h-8 w-8 text-secondary" />
            Staff Market
          </h2>
          <p className="text-muted-foreground">
            Find the perfect specialists for your team.{" "}
            <span className={cn("font-semibold", canHire ? "text-green-600" : "text-destructive")}>
              {myStaff.length}/{MAX_STAFF} staff slots used.
            </span>
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href="/continental-scouting">
            <Button variant="outline" className="gap-2">
              <Radar className="h-4 w-4" />
              Open Scouting Centre
            </Button>
          </Link>
          <Link href="/staff">
            <Button variant="outline" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Manage My Staff
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, trait, nationality…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {ROLE_FILTERS.map(role => (
            <Button
              key={role}
              variant={roleFilter === role ? "default" : "outline"}
              size="sm"
              onClick={() => setRoleFilter(role)}
              className="text-xs"
            >
              {role === "all" ? "All Roles" : ROLE_LABELS[role]}
            </Button>
          ))}
        </div>
      </div>

      {/* Scout hint */}
      {hasCoach ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-4 py-2.5 border border-border/40">
          <Eye className="h-3.5 w-3.5 shrink-0" />
          <span>
            <strong className="text-foreground">Hidden OVR:</strong> Scout staff to reveal their true rating, attributes, personality, and salary confidence. Cost: <span className="font-semibold text-foreground">$1,000</span> per scout.
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 rounded-lg px-4 py-2.5 border border-amber-500/30">
          <Eye className="h-3.5 w-3.5 shrink-0" />
          <span>
            <strong className="text-amber-400">Scouting locked:</strong> Hire a Head Coach, Assistant Coach, or Scout to unlock staff scouting.
          </span>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-80 w-full rounded-xl" />)}
        </div>
      ) : marketStaff.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">No staff available matching your filters.</p>
          <p className="text-sm mt-1">Try adjusting your search or role filter.</p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {marketStaff.map((member) => (
            <StaffMarketCard
              key={member.id}
              member={member}
              isOwned={myStaffIds.has(member.id)}
              onHire={handleHire}
              onScout={handleScout}
              isHiring={hireMutation.isPending && (hireMutation.variables as any)?.data?.staffId === member.id}
              isScouting={scoutMutation.isPending && (scoutMutation.variables as any)?.id === member.id}
              canHire={canHire}
              hasCoach={hasCoach}
            />
          ))}
        </div>
      )}
    </div>
  );
}
