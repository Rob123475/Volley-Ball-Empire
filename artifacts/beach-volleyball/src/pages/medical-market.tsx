import {
  useGetMedicalStaffMarket,
  useHireMedicalStaff,
  useListMedicalStaff,
  getGetMedicalStaffMarketQueryKey,
  getListMedicalStaffQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
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
  Stethoscope,
  FlaskConical,
  Salad,
  Activity,
  Microscope,
  HeartPulse,
  HelpCircle,
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

const MAX_MEDICAL_STAFF = 4;

const ROLE_LABELS: Record<string, string> = {
  all:                "All Roles",
  team_doctor:        "Team Doctor",
  "Doctor":           "Team Doctor",
  medical_specialist: "Medical Specialist",
  "Medical Specialist": "Medical Specialist",
  physiotherapist:    "Physiotherapist",
  "Physiotherapist":  "Physiotherapist",
  nutritionist:       "Nutritionist",
  "Nutritionist":     "Nutritionist",
  sports_chemist:     "Sports Chemist",
  sports_scientist:   "Sports Scientist",
  "Sports Scientist": "Sports Scientist",
};

const ROLE_COLORS: Record<string, string> = {
  team_doctor:          "bg-red-500",
  "Doctor":             "bg-red-500",
  medical_specialist:   "bg-blue-600",
  "Medical Specialist": "bg-blue-600",
  physiotherapist:      "bg-teal-500",
  "Physiotherapist":    "bg-teal-500",
  nutritionist:         "bg-green-500",
  "Nutritionist":       "bg-green-500",
  sports_chemist:       "bg-purple-500",
  sports_scientist:     "bg-indigo-500",
  "Sports Scientist":   "bg-indigo-500",
};

type IconFC = React.FC<{ className?: string }>;

const ROLE_ICONS: Record<string, IconFC> = {
  team_doctor:          Stethoscope as IconFC,
  "Doctor":             Stethoscope as IconFC,
  medical_specialist:   Microscope as IconFC,
  "Medical Specialist": Microscope as IconFC,
  physiotherapist:      Activity as IconFC,
  "Physiotherapist":    Activity as IconFC,
  nutritionist:         Salad as IconFC,
  "Nutritionist":       Salad as IconFC,
  sports_chemist:       FlaskConical as IconFC,
  sports_scientist:     FlaskConical as IconFC,
  "Sports Scientist":   FlaskConical as IconFC,
};

const ROLE_FILTERS = ["all", "team_doctor", "medical_specialist", "physiotherapist", "nutritionist", "sports_scientist"] as const;

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
      <Progress value={revealed ? value : undefined} className={cn("h-1.5", !revealed && "opacity-30")} />
    </div>
  );
}

function MedicalMarketCard({
  member,
  isOwned,
  onHire,
  isHiring,
  canHire,
}: {
  member: any;
  isOwned: boolean;
  onHire: (id: number) => void;
  isHiring: boolean;
  canHire: boolean;
}) {
  const RoleIcon = ROLE_ICONS[member.role] ?? Stethoscope;
  const revealed = member.isScoutRevealed ?? true;

  function extractSkillAttrs(attributes: Record<string, unknown>): [string, number][] {
    for (const [key, val] of Object.entries(attributes)) {
      if (key.endsWith("Attributes") && val && typeof val === "object" && !Array.isArray(val)) {
        return Object.entries(val as Record<string, number>).filter(
          ([, v]) => typeof v === "number"
        ) as [string, number][];
      }
    }
    // Legacy flat: only take numeric values that look like skill ratings (not meta like age/salary)
    const META_KEYS = new Set(["age","salary","stars","experienceYears","nutritionBonus","morale","fatigue"]);
    return Object.entries(attributes).filter(
      ([k, v]) => typeof v === "number" && !META_KEYS.has(k)
    ) as [string, number][];
  }
  const attrs = extractSkillAttrs(member.attributes ?? {});

  function normaliseImageUrl(url: string | null | undefined): string | undefined {
    if (!url) return undefined;
    if (url.startsWith("/objects/")) return `/api/storage${url}`;
    return url;
  }

  return (
    <Card className={cn(
      "overflow-hidden transition-all group",
      isOwned ? "ring-2 ring-primary/40" : "hover:shadow-xl hover:border-border/80"
    )}>
      <div className="relative h-52 overflow-hidden">
        <img
          src={normaliseImageUrl(member.imageUrl)}
          alt={member.name}
          className="w-full h-full object-cover object-[center_15%] group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

        <div className="absolute top-2 left-2 flex gap-1.5">
          <Badge className={cn("text-white text-[10px] gap-1 shadow", ROLE_COLORS[member.role] ?? "bg-slate-500")}>
            <RoleIcon className="h-2.5 w-2.5" />
            {ROLE_LABELS[member.role] ?? member.role}
          </Badge>
          {isOwned && (
            <Badge className="bg-primary/80 text-white text-[10px] shadow">On Staff</Badge>
          )}
        </div>

        <OvrDisplay rating={member.overallRating} revealed={revealed} />

        <div className="absolute bottom-0 left-0 right-0 p-3 pr-16">
          <div className="font-bold text-base text-white drop-shadow leading-tight">{member.name}</div>
          <div className="text-xs text-white/70">{member.nationality} · Age {member.age}</div>
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        {member.specialTrait && (
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{member.specialTrait}</span>
          </div>
        )}

        {attrs.length > 0 && (
          <div className="space-y-1.5">
            {attrs.map(([name, value]) => (
              <AttributeBar key={name} name={name} value={value} revealed={true} />
            ))}
          </div>
        )}

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

        {!isOwned && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                className="w-full gap-1.5 text-xs"
                disabled={isHiring || !canHire}
              >
                <UserPlus className="h-3.5 w-3.5" />
                {isHiring ? "Hiring…" : !canHire ? "Department Full" : "Hire"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Hire {member.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will add {member.name} to your Medical Department as {ROLE_LABELS[member.role]}.
                  Monthly salary: {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(member.salary)}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onHire(member.id)}>
                  Hire
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardContent>
    </Card>
  );
}

export default function MedicalMarket() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [search, setSearch]         = useState("");

  const params = {
    ...(roleFilter !== "all" ? { role: roleFilter } : {}),
    ...(search ? { search } : {}),
  };

  const { data: marketStaff = [], isLoading } = useGetMedicalStaffMarket(
    params,
    { query: { queryKey: getGetMedicalStaffMarketQueryKey(params) } }
  );
  const { data: myMedStaff = [] } = useListMedicalStaff({
    query: { queryKey: getListMedicalStaffQueryKey() },
  });

  const hireMutation = useHireMedicalStaff();

  const myStaffIds = new Set(myMedStaff.map((s: any) => s.id));
  const canHire = myMedStaff.length < MAX_MEDICAL_STAFF;

  const handleHire = (staffId: number) => {
    hireMutation.mutate({ data: { staffId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMedicalStaffQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMedicalStaffMarketQueryKey() });
        toast({ title: "Staff Hired!", description: "Your new specialist has joined the Medical Department." });
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? "Could not hire this staff member.";
        toast({ title: "Hire Failed", description: msg, variant: "destructive" });
      },
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
            <HeartPulse className="h-8 w-8 text-secondary" />
            Medical Staff Market
          </h2>
          <p className="text-muted-foreground">
            Find specialists for your Medical Department.{" "}
            <span className={cn("font-semibold", canHire ? "text-green-600" : "text-destructive")}>
              {myMedStaff.length}/{MAX_MEDICAL_STAFF} slots used.
            </span>
          </p>
        </div>
        <Link href="/medical">
          <Button variant="outline" className="gap-2 shrink-0">
            <SlidersHorizontal className="h-4 w-4" />
            Medical Centre
          </Button>
        </Link>
      </div>

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
              {ROLE_LABELS[role]}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-80 w-full rounded-xl" />)}
        </div>
      ) : marketStaff.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <HeartPulse className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">No medical staff matching your filters.</p>
          <p className="text-sm mt-1">Try adjusting your search or role filter.</p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {marketStaff.map((member: any) => (
            <MedicalMarketCard
              key={member.id}
              member={member}
              isOwned={myStaffIds.has(member.id)}
              onHire={handleHire}
              isHiring={hireMutation.isPending && (hireMutation.variables as any)?.data?.staffId === member.id}
              canHire={canHire}
            />
          ))}
        </div>
      )}
    </div>
  );
}
