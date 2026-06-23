import {
  useGetTeamRoster,
  getGetTeamRosterQueryKey,
  useGetFacilities,
  getGetFacilitiesQueryKey,
  useUpgradeFacility,
  useGetSeasonInjuryStats,
  useGetPlayerWorkloads,
  useGetInjuryHistory,
  useListMedicalStaff,
  useFireMedicalStaff,
  getListMedicalStaffQueryKey,
  getGetMedicalStaffMarketQueryKey,
} from "@workspace/api-client-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Heart,
  Stethoscope,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  Shield,
  ArrowUp,
  BarChart2,
  Activity,
  History,
  ChevronDown,
  DollarSign,
  Calendar,
  Sparkles,
  UserMinus,
  UserPlus,
  Users,
  FlaskConical,
  Salad,
  Microscope,
  TrendingUp,
  HeartPulse,
  type LucideIcon,
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
import { Link } from "wouter";
import { FacilityBonusBanner } from "@/components/facility-bonus-banner";
import { cn } from "@/lib/utils";

/* ── Constants ─────────────────────────────────────────────── */

const MAX_MEDICAL_STAFF = 4;

const INJURY_BASE_WEEKS: Record<string, number> = {
  Healthy: 0,
  "Minor Injury": 2,
  "Major Injury": 6,
  Unavailable: 12,
};

const INJURY_COLORS: Record<string, { text: string; border: string; bg: string }> = {
  Healthy:        { text: "text-green-600",  border: "border-green-500/30",  bg: "bg-green-500/5"  },
  "Minor Injury": { text: "text-yellow-600", border: "border-yellow-500/30", bg: "bg-yellow-500/5" },
  "Major Injury": { text: "text-orange-600", border: "border-orange-500/30", bg: "bg-orange-500/5" },
  Unavailable:    { text: "text-red-600",    border: "border-red-500/30",    bg: "bg-red-500/5"    },
};

const INJURY_ICONS: Record<string, LucideIcon> = {
  Healthy:        CheckCircle2,
  "Minor Injury": AlertTriangle,
  "Major Injury": AlertTriangle,
  Unavailable:    Shield,
};

/* ── Medical Roles ─────────────────────────────────────────── */

type IconFC = React.FC<{ className?: string }>;

const MEDICAL_ROLE_LABELS: Record<string, string> = {
  team_doctor:        "Team Doctor",
  medical_specialist: "Medical Specialist",
  physiotherapist:    "Physiotherapist",
  nutritionist:       "Nutritionist",
  sports_chemist:     "Sports Chemist",
};

const MEDICAL_ROLE_COLORS: Record<string, string> = {
  team_doctor:        "bg-red-500",
  medical_specialist: "bg-blue-600",
  physiotherapist:    "bg-teal-500",
  nutritionist:       "bg-green-500",
  sports_chemist:     "bg-purple-500",
};

const MEDICAL_ROLE_ICONS: Record<string, IconFC> = {
  team_doctor:        Stethoscope as IconFC,
  medical_specialist: Microscope as IconFC,
  physiotherapist:    Activity as IconFC,
  nutritionist:       Salad as IconFC,
  sports_chemist:     FlaskConical as IconFC,
};

const MEDICAL_BONUS_DESCRIPTIONS: Record<string, { icon: IconFC; color: string; label: string; detail: string }> = {
  team_doctor:        { icon: HeartPulse as IconFC,  color: "text-red-600",    label: "Injury Recovery",     detail: "+10–20% recovery speed, boosts player morale when injured" },
  medical_specialist: { icon: Shield as IconFC,      color: "text-blue-600",   label: "Injury Prevention",   detail: "−8–15% injury risk, faster complex injury recovery" },
  physiotherapist:    { icon: Activity as IconFC,    color: "text-teal-600",   label: "Fatigue Recovery",    detail: "+8–15% post-match fatigue recovery, stamina growth boost" },
  nutritionist:       { icon: Salad as IconFC,       color: "text-green-600",  label: "Stamina & Nutrition", detail: "+5–12% stamina growth, improved match-day conditioning" },
  sports_chemist:     { icon: FlaskConical as IconFC, color: "text-purple-600", label: "Training Effectiveness", detail: "+5–12% training XP gains, legal performance optimisation" },
};

/* ── Helpers ───────────────────────────────────────────────── */

const formatPosition = (pos: string | null | undefined): string => {
  if (!pos) return "—";
  const map: Record<string, string> = {
    setter: "Setter", spiker: "Spiker", defender: "Defender",
    blocker: "Blocker", server: "Server", all_rounder: "All-Rounder",
    opposite: "Spiker", universal: "All-Rounder",
  };
  return map[pos.toLowerCase()] ?? pos.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
};

function recoveryWeeks(injuryStatus: string, medSkill: number): number {
  const base = INJURY_BASE_WEEKS[injuryStatus] ?? 0;
  if (base === 0) return 0;
  return Math.ceil(base * (1 - medSkill / 250));
}

function recoveryBonusPct(skill: number): number {
  return Math.round((skill / 250) * 100);
}

function fitnessColor(v: number) {
  return v >= 80 ? "bg-green-500" : v >= 55 ? "bg-yellow-500" : "bg-red-500";
}
function fatigueColor(v: number) {
  return v <= 30 ? "bg-green-500" : v <= 60 ? "bg-yellow-500" : "bg-red-500";
}
function calcInjuryRisk(fitness: number, fatigue: number): number {
  return Math.min(95, Math.round(1 + fatigue / 2 + (100 - fitness) / 4));
}
const RISK_LEVELS = [
  { max: 10,  label: "Low",      dot: "bg-green-500",  text: "text-green-600"  },
  { max: 25,  label: "Moderate", dot: "bg-yellow-500", text: "text-yellow-600" },
  { max: 50,  label: "High",     dot: "bg-orange-500", text: "text-orange-600" },
  { max: 100, label: "Severe",   dot: "bg-red-500",    text: "text-red-600"    },
];
function getRiskLevel(risk: number) {
  return RISK_LEVELS.find(r => risk <= r.max) ?? RISK_LEVELS[3]!;
}

function MiniProgress({ value, colorClass }: { value: number; colorClass: string }) {
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-primary/20">
      <div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/* ── Department Rating ─────────────────────────────────────── */

function DepartmentRatingBadge({ rating }: { rating: number }) {
  const { color, label } =
    rating === 0  ? { color: "bg-slate-300 text-slate-700",         label: "No Staff" } :
    rating >= 85  ? { color: "bg-yellow-400 text-yellow-900",       label: "World Class" } :
    rating >= 75  ? { color: "bg-blue-500 text-white",              label: "Elite" } :
    rating >= 65  ? { color: "bg-teal-500 text-white",              label: "Strong" } :
    rating >= 55  ? { color: "bg-slate-500 text-white",             label: "Decent" } :
                    { color: "bg-slate-300 text-slate-700",         label: "Developing" };

  return (
    <div className="flex items-center gap-3">
      <div className={cn("flex flex-col items-center justify-center rounded-lg px-4 py-2 font-black leading-none shadow", color)}>
        <span className="text-[10px] font-bold opacity-70 uppercase tracking-wider">DEPT</span>
        <span className="text-2xl">{rating > 0 ? rating : "—"}</span>
      </div>
      {rating > 0 && (
        <div>
          <p className="font-bold text-sm">{label}</p>
          <p className="text-xs text-muted-foreground">Medical Department</p>
        </div>
      )}
    </div>
  );
}

/* ── Medical Staff Card ────────────────────────────────────── */

function OvrBadge({ rating }: { rating: number }) {
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

function AttributeBar({ name, value }: { name: string; value: number }) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px]">
        <span className="text-muted-foreground font-medium truncate pr-2">{name}</span>
        <span className="font-bold tabular-nums shrink-0">{value}</span>
      </div>
      <Progress value={value} className="h-1.5" />
    </div>
  );
}

function MedicalStaffCard({ member, onFire }: { member: any; onFire: (id: number) => void }) {
  const RoleIcon = MEDICAL_ROLE_ICONS[member.role] ?? Stethoscope;
  const attrs = Object.entries(member.attributes ?? {}) as [string, number][];

  return (
    <Card className="overflow-hidden hover:shadow-xl transition-all border-border">
      <div className="relative h-52 overflow-hidden">
        <img
          src={member.imageUrl ?? undefined}
          alt={member.name}
          className="w-full h-full object-cover object-[center_15%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

        <div className="absolute top-2 left-2">
          <Badge className={cn("text-white text-[10px] gap-1 shadow", MEDICAL_ROLE_COLORS[member.role] ?? "bg-slate-500")}>
            <RoleIcon className="h-2.5 w-2.5" />
            {MEDICAL_ROLE_LABELS[member.role] ?? member.role}
          </Badge>
        </div>

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
                This will free up a medical staff slot. The {MEDICAL_ROLE_LABELS[member.role]} position will be vacant.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => onFire(member.id)} className="bg-destructive text-destructive-foreground">
                Release
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <OvrBadge rating={member.overallRating} />

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
              <AttributeBar key={name} name={name} value={value} />
            ))}
          </div>
        )}

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

function MedicalEmptySlot({ slotNumber }: { slotNumber: number }) {
  return (
    <Card className="border-2 border-dashed border-border/50 bg-muted/20">
      <div className="h-52 flex flex-col items-center justify-center gap-3 text-muted-foreground/40">
        <HeartPulse className="h-10 w-10" />
        <span className="text-sm font-medium">Medical Slot {slotNumber}</span>
        <span className="text-xs">Vacant</span>
      </div>
      <CardContent className="p-4 border-t border-dashed border-border/40">
        <Link href="/medical-market">
          <Button variant="outline" className="w-full gap-2 border-dashed text-muted-foreground">
            <UserPlus className="h-4 w-4" />
            Browse Medical Market
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

/* ── Medical Bonus Panel ───────────────────────────────────── */

function MedicalBonusPanel({ staff }: { staff: any[] }) {
  const roleSet = new Set(staff.map((s: any) => s.role));
  const activeBonuses   = Object.entries(MEDICAL_BONUS_DESCRIPTIONS).filter(([role]) => roleSet.has(role));
  const missingBonuses  = Object.entries(MEDICAL_BONUS_DESCRIPTIONS).filter(([role]) => !roleSet.has(role));

  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Active Medical Bonuses
        </h3>
        {activeBonuses.length === 0 && (
          <p className="text-xs text-muted-foreground">Hire medical staff to unlock department bonuses.</p>
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
                    {MEDICAL_ROLE_LABELS[role]}
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

/* ── Medical Staff Management Section ─────────────────────── */

function MedicalStaffManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: medStaff = [], isLoading } = useListMedicalStaff({
    query: { queryKey: getListMedicalStaffQueryKey() },
  });

  const fireMutation = useFireMedicalStaff();

  const handleFire = (staffId: number) => {
    fireMutation.mutate({ id: staffId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMedicalStaffQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMedicalStaffMarketQueryKey() });
        toast({ title: "Staff Released", description: "The medical position is now vacant." });
      },
    });
  };

  const deptRating = medStaff.length > 0
    ? Math.round(medStaff.reduce((s: number, m: any) => s + m.overallRating, 0) / medStaff.length)
    : 0;

  const emptySlots = Math.max(0, MAX_MEDICAL_STAFF - medStaff.length);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-72 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <DepartmentRatingBadge rating={deptRating} />
          <div className="text-muted-foreground text-sm">
            {medStaff.length} of {MAX_MEDICAL_STAFF} slots filled
          </div>
        </div>
        {medStaff.length < MAX_MEDICAL_STAFF && (
          <Link href="/medical-market">
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Browse Medical Market
            </Button>
          </Link>
        )}
      </div>

      {/* Staff Slots */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {medStaff.map((member: any) => (
          <MedicalStaffCard key={member.id} member={member} onFire={handleFire} />
        ))}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <MedicalEmptySlot key={`empty-${i}`} slotNumber={medStaff.length + i + 1} />
        ))}
      </div>

      {/* Bonus Panel */}
      <MedicalBonusPanel staff={medStaff} />
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────── */

export default function MedicalCentre() {
  const { data: roster, isLoading } = useGetTeamRoster({
    query: { queryKey: getGetTeamRosterQueryKey() },
  });

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-56" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-72 w-full rounded-xl" />)}
        </div>
        <Skeleton className="h-52" />
      </div>
    );
  }

  const allPlayers = [...(roster?.activePlayers ?? []), ...(roster?.benchPlayers ?? [])];
  const injuredPlayers = allPlayers.filter(p => (p.injuryStatus as string) !== "Healthy");

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
          <HeartPulse className="h-8 w-8" />
          Medical Centre
        </h2>
        <p className="text-muted-foreground mt-0.5">
          Manage your medical department and monitor player health.
        </p>
      </div>

      {/* ── Medical Staff Management ── */}
      <MedicalStaffManagement />

      {/* ── Medical Centre Facility Card ── */}
      <MedicalCentreFacilityCard />

      {/* ── Squad Health Summary ── */}
      <SquadHealthSummary players={allPlayers} />

      <FacilityBonusBanner
        facilityType="medical_centre"
        facilityName="Medical Centre"
        getBonusText={(level) => {
          const pct = Math.round((level - 1) * (100 / 9));
          return `~${pct}% faster injury recovery — applies to match rest and Recovery training`;
        }}
      />

      {/* ── Medical Report ── */}
      <MedicalReportPanel injuredPlayers={injuredPlayers} allPlayers={allPlayers} />

      {/* ── Treatment Queue ── */}
      <TreatmentQueue injuredPlayers={injuredPlayers} bestSkill={0} />

      {/* ── Recovery Forecast ── */}
      <RecoveryForecastPanel injuredPlayers={injuredPlayers} bestSkill={0} />

      {/* ── Injury History ── */}
      <InjuryHistorySection />

      {/* ── Season Injury Statistics ── */}
      <SeasonInjuryStatsCard />

      {/* ── Workload Monitoring ── */}
      <WorkloadMonitoringCard />

      {/* ── Squad Fitness Overview ── */}
      <SquadFitnessOverview allPlayers={allPlayers} />
    </div>
  );
}

/* ── Medical Report Panel ──────────────────────────────────── */

function MedicalReportPanel({ injuredPlayers, allPlayers }: { injuredPlayers: any[]; allPlayers: any[] }) {
  const { data: medStaff = [] } = useListMedicalStaff({
    query: { queryKey: getListMedicalStaffQueryKey() },
  });

  const bestSkill = medStaff.length > 0
    ? Math.max(...medStaff.map((s: any) => s.skillLevel ?? s.overallRating ?? 0))
    : 0;

  const doctor     = medStaff.find((s: any) => s.role === "team_doctor");
  const specialist = medStaff.find((s: any) => s.role === "medical_specialist");
  const physio     = medStaff.find((s: any) => s.role === "physiotherapist");
  const nutritionist = medStaff.find((s: any) => s.role === "nutritionist");

  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Stethoscope className="h-5 w-5 text-primary" /> Medical Report
      </h3>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Injured Players */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Injured Players
              </p>
              <Badge variant={injuredPlayers.length > 0 ? "destructive" : "secondary"} className="text-xs">
                {injuredPlayers.length} of {allPlayers.length}
              </Badge>
            </div>

            {injuredPlayers.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="font-medium">All players fit and healthy!</span>
              </div>
            ) : (
              <div className="space-y-2">
                {injuredPlayers.map(player => {
                  const status = (player.injuryStatus as string) ?? "Healthy";
                  const colors = INJURY_COLORS[status] ?? INJURY_COLORS["Minor Injury"];
                  const Icon = INJURY_ICONS[status] ?? AlertTriangle;
                  const weeksLeft = (player.injuryWeeksRemaining as number) > 0
                    ? (player.injuryWeeksRemaining as number)
                    : recoveryWeeks(status, bestSkill);
                  return (
                    <div key={player.id} className={cn("flex items-center justify-between rounded-lg border px-3 py-2", colors.border, colors.bg)}>
                      <div className="flex items-center gap-2 min-w-0">
                        {player.imageUrl && (
                          <img src={player.imageUrl} alt={player.name} className="w-7 h-7 rounded-full object-cover object-[center_10%] shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{player.name}</p>
                          <div className="flex items-center gap-1">
                            <Icon className={cn("h-3 w-3 shrink-0", colors.text)} />
                            <span className={cn("text-[11px]", colors.text)}>{status}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className={cn("text-xs font-bold", colors.text)}>
                          {weeksLeft === 0 ? "Ready" : `${weeksLeft}w`}
                        </p>
                        {doctor && <p className="text-[10px] text-muted-foreground">Dr. {doctor.name.split(" ")[0]}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Staff Contributions */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="font-semibold text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Department Contributions
            </p>
            {medStaff.length === 0 ? (
              <p className="text-xs text-muted-foreground">No medical staff hired yet. Visit the Medical Market to build your department.</p>
            ) : (
              <div className="space-y-3">
                {doctor && (
                  <ContributionRow
                    label="Recovery Speed"
                    staff={doctor}
                    bonus={`+${recoveryBonusPct(doctor.skillLevel ?? doctor.overallRating)}%`}
                    color="text-red-600"
                  />
                )}
                {specialist && (
                  <ContributionRow
                    label="Injury Prevention"
                    staff={specialist}
                    bonus={`−${Math.round((specialist.skillLevel ?? specialist.overallRating) / 30)}%`}
                    color="text-blue-600"
                  />
                )}
                {physio && (
                  <ContributionRow
                    label="Fatigue Recovery"
                    staff={physio}
                    bonus={`+${recoveryBonusPct(physio.skillLevel ?? physio.overallRating)}%`}
                    color="text-teal-600"
                  />
                )}
                {nutritionist && (
                  <ContributionRow
                    label="Stamina Growth"
                    staff={nutritionist}
                    bonus={`+${Math.round((nutritionist.skillLevel ?? nutritionist.overallRating) / 20)}%`}
                    color="text-green-600"
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fatigue Overview */}
      {allPlayers.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="font-semibold text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Squad Fatigue Monitor
            </p>
            <div className="space-y-2">
              {allPlayers
                .sort((a, b) => (b.fatigue as number) - (a.fatigue as number))
                .slice(0, 6)
                .map(player => {
                  const fatigue = player.fatigue as number;
                  const fitness = player.fitness as number;
                  return (
                    <div key={player.id} className="flex items-center gap-3">
                      {player.imageUrl ? (
                        <img src={player.imageUrl} alt={player.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-muted shrink-0 flex items-center justify-center text-xs font-bold">
                          {player.name[0]}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="font-medium truncate">{player.name}</span>
                          <span className={cn("font-semibold shrink-0 ml-1", fatigue >= 70 ? "text-red-600" : fatigue >= 45 ? "text-yellow-600" : "text-green-600")}>
                            {fatigue}% fatigue
                          </span>
                        </div>
                        <MiniProgress value={fatigue} colorClass={fatigueColor(fatigue)} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function ContributionRow({ label, staff, bonus, color }: { label: string; staff: any; bonus: string; color: string }) {
  const RoleIcon = MEDICAL_ROLE_ICONS[staff.role] ?? Stethoscope;
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <RoleIcon className={cn("h-3.5 w-3.5 shrink-0", color)} />
        <span className="text-muted-foreground truncate">{label}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-muted-foreground/60 text-[10px] truncate max-w-[80px]">{staff.name.split(" ").pop()}</span>
        <span className={cn("font-bold", color)}>{bonus}</span>
      </div>
    </div>
  );
}

/* ── Squad Fitness Overview ────────────────────────────────── */

function SquadFitnessOverview({ allPlayers }: { allPlayers: any[] }) {
  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Zap className="h-5 w-5 text-primary" /> Squad Fitness Overview
      </h3>

      {allPlayers.length === 0 ? (
        <p className="text-muted-foreground text-sm">No players in your squad yet.</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {allPlayers.map((player) => {
                const status = (player.injuryStatus as string) ?? "Healthy";
                const colors = INJURY_COLORS[status] ?? INJURY_COLORS["Healthy"];
                const Icon = INJURY_ICONS[status] ?? CheckCircle2;
                const fitness = player.fitness as number;
                const fatigue = player.fatigue as number;
                const risk = calcInjuryRisk(fitness, fatigue);
                const riskLevel = getRiskLevel(risk);

                return (
                  <div key={player.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                    {player.imageUrl ? (
                      <img src={player.imageUrl} alt={player.name} className="w-8 h-8 rounded-full object-cover object-[center_10%] shrink-0 border border-border" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                        {player.name[0]}
                      </div>
                    )}

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate leading-tight">{player.name}</p>
                          <p className="text-[11px] text-muted-foreground leading-tight">{formatPosition(player.position)}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Icon className={`h-3 w-3 ${colors.text} shrink-0`} />
                          <span className={`text-xs font-medium ${colors.text} whitespace-nowrap`}>{status}</span>
                        </div>
                        <div className="hidden sm:flex items-center gap-1 shrink-0">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${riskLevel.dot}`} />
                          <span className={`text-xs font-semibold ${riskLevel.text}`}>{risk}%</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                            <span>Fitness</span>
                            <span className="font-semibold">{fitness}</span>
                          </div>
                          <MiniProgress value={fitness} colorClass={fitnessColor(fitness)} />
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                            <span>Fatigue</span>
                            <span className="font-semibold">{fatigue}</span>
                          </div>
                          <MiniProgress value={fatigue} colorClass={fatigueColor(fatigue)} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

/* ── Treatment Queue ─────────────────────────────────────────── */

type InjuredPlayer = { id: number; name: string; injuryStatus: unknown; injuryWeeksRemaining: unknown };

function TreatmentQueue({ injuredPlayers, bestSkill }: { injuredPlayers: InjuredPlayer[]; bestSkill: number }) {
  const queue = injuredPlayers
    .map(p => {
      const status = p.injuryStatus as string;
      const baseWeeks = INJURY_BASE_WEEKS[status] ?? 0;
      const weeksLeft = (p.injuryWeeksRemaining as number) > 0
        ? (p.injuryWeeksRemaining as number)
        : recoveryWeeks(status, bestSkill);
      const daysLeft = weeksLeft * 7;
      const totalDays = baseWeeks * 7;
      const progress = totalDays > 0 ? Math.round(Math.max(0, Math.min(100, ((totalDays - daysLeft) / totalDays) * 100))) : 0;
      return { ...p, status, daysLeft, progress };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Stethoscope className="h-5 w-5 text-primary" /> Treatment Queue
      </h3>

      {queue.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            <p className="text-sm text-muted-foreground">No players currently receiving treatment.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {queue.map((player, idx) => {
                const colors = INJURY_COLORS[player.status] ?? INJURY_COLORS["Minor Injury"];
                const Icon = INJURY_ICONS[player.status] ?? AlertTriangle;
                const barColor = player.progress >= 75 ? "bg-green-500" : player.progress >= 40 ? "bg-yellow-500" : "bg-orange-500";

                return (
                  <div key={player.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-xs font-bold text-muted-foreground/50 w-4 shrink-0 text-right">{idx + 1}</span>
                    <div className="min-w-0 w-32 shrink-0">
                      <p className="font-semibold text-sm truncate">{player.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Icon className={`h-3 w-3 shrink-0 ${colors.text}`} />
                        <span className={`text-[11px] ${colors.text}`}>{player.status}</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          {player.daysLeft === 0 ? "Ready next week" : `${player.daysLeft}d remaining`}
                        </span>
                        <span className="font-semibold text-muted-foreground">{player.progress}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-primary/15 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${player.progress}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

/* ── Recovery Forecast ─────────────────────────────────────── */

function RecoveryForecastPanel({ injuredPlayers, bestSkill }: { injuredPlayers: InjuredPlayer[]; bestSkill: number }) {
  if (injuredPlayers.length === 0) {
    return (
      <section className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" /> Recovery Forecast
        </h3>
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            <p className="text-sm text-green-700 dark:text-green-400 font-medium">No active recoveries.</p>
          </CardContent>
        </Card>
      </section>
    );
  }

  const playersWithDays = injuredPlayers.map(p => {
    const status = p.injuryStatus as string;
    const weeksLeft = (p.injuryWeeksRemaining as number) > 0
      ? (p.injuryWeeksRemaining as number)
      : recoveryWeeks(status, bestSkill);
    return { ...p, daysLeft: weeksLeft * 7 };
  });

  const recoveredIn7  = playersWithDays.filter(p => p.daysLeft <= 7).length;
  const recoveredIn30 = playersWithDays.filter(p => p.daysLeft <= 30).length;
  const longest = playersWithDays.reduce((a, b) => b.daysLeft > a.daysLeft ? b : a);

  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Clock className="h-5 w-5 text-primary" /> Recovery Forecast
      </h3>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <ForecastStat label="Players recovering" value={injuredPlayers.length} valueClass="text-orange-600" />
            <ForecastStat label="Expected recovered in 7 days" value={recoveredIn7} valueClass={recoveredIn7 > 0 ? "text-green-600" : "text-muted-foreground"} />
            <ForecastStat label="Expected recovered in 30 days" value={recoveredIn30} valueClass={recoveredIn30 > 0 ? "text-green-600" : "text-muted-foreground"} />
          </div>
          <div className="border-t pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Longest current injury</p>
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
              <div>
                <p className="font-semibold text-sm">{longest.name}</p>
                <p className="text-xs text-muted-foreground">{longest.daysLeft === 0 ? "Ready next week" : `${longest.daysLeft}d remaining`}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function ForecastStat({ label, value, valueClass }: { label: string; value: number; valueClass?: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] text-muted-foreground leading-snug">{label}</p>
      <p className={`text-2xl font-bold ${valueClass ?? ""}`}>{value}</p>
    </div>
  );
}

/* ── Injury History ─────────────────────────────────────────── */

const INJURY_TYPE_COLORS: Record<string, string> = {
  "Minor Injury": "border-yellow-500/40 text-yellow-600",
  "Major Injury": "border-orange-500/40 text-orange-600",
  "Unavailable":  "border-red-500/40 text-red-600",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function InjuryHistorySection() {
  const [open, setOpen] = useState(false);
  const { data: history, isLoading } = useGetInjuryHistory();
  const count = history?.length ?? 0;

  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between rounded-lg border bg-card px-5 py-3.5 hover:bg-muted/40 transition-colors"
      >
        <span className="flex items-center gap-2 text-base font-semibold">
          <History className="h-5 w-5 text-primary" />
          Injury History
          {count > 0 && <Badge variant="secondary" className="ml-1 text-xs">{count}</Badge>}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
              </div>
            ) : count === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                <History className="h-8 w-8 text-muted-foreground/30" />
                <p>No injuries recorded this season.</p>
              </div>
            ) : (
              <div className="divide-y">
                <div className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <span>Player</span>
                  <span className="w-24">Injury</span>
                  <span className="w-24 hidden sm:block">Date Injured</span>
                  <span className="w-14 text-right">Missed</span>
                </div>
                {history!.map(entry => (
                  <div key={entry.id} className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-4 py-2.5 hover:bg-muted/30 transition-colors">
                    <p className="font-medium text-sm truncate">{entry.playerName}</p>
                    <div className="w-24">
                      <Badge variant="outline" className={`text-xs ${INJURY_TYPE_COLORS[entry.injuryType] ?? "border-muted text-muted-foreground"}`}>
                        {entry.injuryType}
                      </Badge>
                    </div>
                    <span className="w-24 text-sm text-muted-foreground whitespace-nowrap hidden sm:block">{formatDate(entry.dateInjured as string)}</span>
                    <span className="w-14 text-right text-sm font-semibold">{entry.daysMissed}d</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

/* ── Workload Monitoring ───────────────────────────────────── */

const WORKLOAD_CONFIG = {
  Fresh:        { dot: "bg-green-500",  text: "text-green-600",  badge: "border-green-500/40 text-green-600",   label: "Fresh"      },
  "Heavy Load": { dot: "bg-yellow-500", text: "text-yellow-600", badge: "border-yellow-500/40 text-yellow-600", label: "Heavy Load" },
  Overworked:   { dot: "bg-red-500",    text: "text-red-600",    badge: "border-red-500/40 text-red-600",       label: "Overworked" },
} as const;

function WorkloadMonitoringCard() {
  const { data: workloads, isLoading } = useGetPlayerWorkloads();
  const sorted = [...(workloads ?? [])].sort((a, b) => {
    const order = { Overworked: 0, "Heavy Load": 1, Fresh: 2 };
    return (order[a.status as keyof typeof order] ?? 2) - (order[b.status as keyof typeof order] ?? 2);
  });

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" /> Workload Monitoring
        </h3>
        <span className="text-xs text-muted-foreground">Last 14 days · Monitoring only</span>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
            </div>
          ) : sorted.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No players found in your squad.</div>
          ) : (
            <div className="divide-y">
              <div className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <span>Player</span>
                <span className="text-center w-16">Matches</span>
                <span className="text-center w-20 hidden sm:block">Training</span>
                <span className="text-center w-20">Status</span>
              </div>
              {sorted.map(player => {
                const cfg = WORKLOAD_CONFIG[player.status as keyof typeof WORKLOAD_CONFIG] ?? WORKLOAD_CONFIG.Fresh;
                return (
                  <div key={player.id} className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-4 py-2.5 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {player.imageUrl ? (
                        <img src={player.imageUrl} alt={player.name} className="h-7 w-7 rounded-full object-cover object-[center_15%] shrink-0" />
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-muted shrink-0 flex items-center justify-center">
                          <span className="text-xs font-bold text-muted-foreground">{player.name.charAt(0)}</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate text-sm">{player.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{formatPosition(player.position)}</p>
                      </div>
                    </div>
                    <div className="w-16 text-center">
                      <span className="text-sm font-semibold">{player.matchesPlayed}</span>
                      <p className="text-[10px] text-muted-foreground">matches</p>
                    </div>
                    <div className="w-20 text-center hidden sm:block">
                      <span className="text-sm font-semibold">{player.trainingSessions}</span>
                      <p className="text-[10px] text-muted-foreground">sessions</p>
                    </div>
                    <div className="w-20 flex justify-center">
                      <Badge variant="outline" className={`gap-1 text-xs ${cfg.badge}`}>
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                        {cfg.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground px-1">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-500" />Fresh — &lt;2 matches &amp; &lt;3 sessions</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-yellow-500" />Heavy Load — 2–3 matches or 3–5 sessions</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" />Overworked — 4+ matches or 6+ sessions</span>
      </div>
    </section>
  );
}

/* ── Season Injury Statistics ──────────────────────────────── */

function SeasonInjuryStatsCard() {
  const { data: stats, isLoading } = useGetSeasonInjuryStats();

  const mostCommonColor: Record<string, string> = {
    "Minor Injury": "text-yellow-600",
    "Major Injury": "text-orange-600",
    "Unavailable":  "text-red-600",
    "None":         "text-muted-foreground",
  };

  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <BarChart2 className="h-5 w-5 text-primary" /> Season Injury Statistics
      </h3>
      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <StatBox label="Total Injuries" value={`${stats?.totalInjuries ?? 0}`} valueClass="text-primary" />
              <StatBox label="Days Lost" value={`${stats?.daysLost ?? 0}`} valueClass="text-orange-500" />
              <StatBox label="Avg Recovery" value={`${stats?.avgRecoveryDays ?? 0}d`} valueClass="text-blue-500" />
              <StatBox label="Most Common" value={stats?.mostCommon ?? "None"} valueClass={mostCommonColor[stats?.mostCommon ?? "None"] ?? "text-muted-foreground"} small />
              <StatBox label="Currently Injured" value={`${stats?.currentInjuryCount ?? 0}`} valueClass={(stats?.currentInjuryCount ?? 0) > 0 ? "text-red-500" : "text-green-500"} />
            </div>
          )}
          {!isLoading && (stats?.totalInjuries ?? 0) === 0 && (
            <p className="mt-3 text-center text-sm text-muted-foreground">No injuries recorded this season. Play matches to accumulate stats.</p>
          )}
          {!isLoading && (
            <p className="mt-3 text-xs text-muted-foreground text-right">Season {stats?.seasonId ?? 1} · Resets at the start of a new season</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function StatBox({ label, value, valueClass, small }: { label: string; value: string; valueClass?: string; small?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border bg-primary/5 p-3 text-center">
      <span className={cn(small ? "text-sm font-bold leading-snug" : "text-xl font-bold", valueClass)}>{value}</span>
      <span className="mt-0.5 text-xs text-muted-foreground leading-tight">{label}</span>
    </div>
  );
}

/* ── Medical Centre Facility Card ──────────────────────────── */

const MC_MAX_LEVEL = 10;

function MedicalCentreFacilityCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: facilities, isLoading } = useGetFacilities({
    query: { queryKey: getGetFacilitiesQueryKey() },
  });
  const upgradeMutation = useUpgradeFacility();

  const facility = facilities?.find(f => f.type === "medical_centre");
  const level = facility?.level ?? 1;
  const isMax = level >= MC_MAX_LEVEL;
  const recoveryBonus = (level - 1) * 5;
  const injuryReduction = (level - 1) * 2;

  const handleUpgrade = () => {
    upgradeMutation.mutate(
      { type: "medical_centre" },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetFacilitiesQueryKey() });
          toast({ title: `Medical Centre upgraded to Level ${level + 1}` });
        },
        onError: (err: any) => {
          toast({ title: "Upgrade failed", description: err?.message ?? "Insufficient funds.", variant: "destructive" });
        },
      },
    );
  };

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <Card className="border-rose-500/30 bg-rose-500/5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-rose-500 shrink-0" />
            <span className="font-semibold text-base">Medical Centre Facility</span>
          </div>
          <Badge variant="outline" className={isMax ? "border-rose-500/40 text-rose-600 bg-rose-500/10" : "border-rose-500/30 text-rose-600"}>
            {isMax ? "MAX" : `Level ${level} / ${MC_MAX_LEVEL}`}
          </Badge>
        </div>

        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>Level progress</span>
            <span>{level} / {MC_MAX_LEVEL}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-rose-500/15 overflow-hidden">
            <div className="h-full rounded-full bg-rose-500 transition-all" style={{ width: `${(level / MC_MAX_LEVEL) * 100}%` }} />
          </div>
        </div>

        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Current Bonuses</p>
            <div className="flex items-center gap-2 text-sm">
              <Zap className="h-3.5 w-3.5 text-rose-500 shrink-0" />
              <span className="text-muted-foreground">Recovery Speed</span>
              <span className={`font-bold ml-1 ${recoveryBonus > 0 ? "text-green-600" : "text-muted-foreground/60"}`}>
                {recoveryBonus > 0 ? `+${recoveryBonus}%` : "—"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Shield className="h-3.5 w-3.5 text-rose-500 shrink-0" />
              <span className="text-muted-foreground">Injury Prevention</span>
              <span className={`font-bold ml-1 ${injuryReduction > 0 ? "text-green-600" : "text-muted-foreground/60"}`}>
                {injuryReduction > 0 ? `-${injuryReduction}%` : "—"}
              </span>
            </div>
          </div>
          <Button size="sm" disabled={isMax || upgradeMutation.isPending} onClick={handleUpgrade} className="gap-1.5 shrink-0">
            <ArrowUp className="h-3.5 w-3.5" />
            {isMax ? "Max Level" : `Upgrade to Level ${level + 1}`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Squad Health Summary ──────────────────────────────────── */

type Player = { fitness: unknown; fatigue: unknown; injuryStatus: unknown };

const CONDITION_LEVELS = [
  { label: "Excellent", min: 90, ring: "border-green-500/40",  bg: "bg-green-500/8",  badge: "bg-green-500/15 text-green-600 border-green-500/30"  },
  { label: "Good",      min: 75, ring: "border-yellow-500/40", bg: "bg-yellow-500/8", badge: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30" },
  { label: "Fair",      min: 60, ring: "border-orange-500/40", bg: "bg-orange-500/8", badge: "bg-orange-500/15 text-orange-600 border-orange-500/30" },
  { label: "Poor",      min: 0,  ring: "border-red-500/40",    bg: "bg-red-500/8",    badge: "bg-red-500/15 text-red-600 border-red-500/30"          },
] as const;

function getCondition(avgFitness: number) {
  return CONDITION_LEVELS.find(c => avgFitness >= c.min) ?? CONDITION_LEVELS[3]!;
}

function SquadHealthSummary({ players }: { players: Player[] }) {
  if (players.length === 0) return null;

  const healthy    = players.filter(p => (p.injuryStatus as string) === "Healthy").length;
  const injured    = players.length - healthy;
  const avgFit     = Math.round(players.reduce((s, p) => s + (p.fitness as number), 0) / players.length);
  const avgFatigue = Math.round(players.reduce((s, p) => s + (p.fatigue as number), 0) / players.length);
  const condition  = getCondition(avgFit);

  return (
    <Card className={`border ${condition.ring} ${condition.bg}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Heart className="h-4 w-4 text-primary" /> Squad Health Status
          </h3>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-semibold ${condition.badge}`}>
            {condition.label}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <HealthStat label="Healthy Players" value={`${healthy}`} sub={`of ${players.length}`} valueClass="text-green-600" />
          <HealthStat label="Injured Players" value={`${injured}`} sub={`of ${players.length}`} valueClass={injured > 0 ? "text-red-600" : "text-muted-foreground"} />
          <HealthStat label="Avg Fitness" value={`${avgFit}%`} valueClass={avgFit >= 75 ? "text-green-600" : avgFit >= 55 ? "text-yellow-600" : "text-red-600"} bar={{ value: avgFit, colorClass: avgFit >= 75 ? "bg-green-500" : avgFit >= 55 ? "bg-yellow-500" : "bg-red-500" }} />
          <HealthStat label="Avg Fatigue" value={`${avgFatigue}%`} valueClass={avgFatigue <= 35 ? "text-green-600" : avgFatigue <= 65 ? "text-yellow-600" : "text-red-600"} bar={{ value: avgFatigue, colorClass: avgFatigue <= 35 ? "bg-green-500" : avgFatigue <= 65 ? "bg-yellow-500" : "bg-red-500" }} />
        </div>
      </CardContent>
    </Card>
  );
}

function HealthStat({ label, value, sub, valueClass, bar }: { label: string; value: string; sub?: string; valueClass?: string; bar?: { value: number; colorClass: string } }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-xl font-bold ${valueClass ?? ""}`}>{value}</span>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </div>
      {bar && <MiniProgress value={bar.value} colorClass={bar.colorClass} />}
    </div>
  );
}
