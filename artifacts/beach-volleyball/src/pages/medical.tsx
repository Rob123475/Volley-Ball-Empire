import {
  useGetTeamRoster,
  getGetTeamRosterQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Heart,
  Stethoscope,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  Shield,
  UserCog,
  Link as LinkIcon,
  type LucideIcon,
} from "lucide-react";
import { Link } from "wouter";
import { FacilityBonusBanner } from "@/components/facility-bonus-banner";

const MEDICAL_ROLES = ["physio", "physiotherapist", "fitness_trainer"];

const INJURY_BASE_WEEKS: Record<string, number> = {
  Healthy: 0,
  "Minor Injury": 2,
  "Major Injury": 6,
  Unavailable: 12,
};

const INJURY_COLORS: Record<string, { text: string; border: string; bg: string }> = {
  Healthy: { text: "text-green-600", border: "border-green-500/30", bg: "bg-green-500/5" },
  "Minor Injury": { text: "text-yellow-600", border: "border-yellow-500/30", bg: "bg-yellow-500/5" },
  "Major Injury": { text: "text-orange-600", border: "border-orange-500/30", bg: "bg-orange-500/5" },
  Unavailable: { text: "text-red-600", border: "border-red-500/30", bg: "bg-red-500/5" },
};

const INJURY_ICONS: Record<string, LucideIcon> = {
  Healthy: CheckCircle2,
  "Minor Injury": AlertTriangle,
  "Major Injury": AlertTriangle,
  Unavailable: Shield,
};

function recoveryWeeks(injuryStatus: string, medicalSkill: number): number {
  const base = INJURY_BASE_WEEKS[injuryStatus] ?? 0;
  if (base === 0) return 0;
  const reduction = medicalSkill / 250;
  return Math.ceil(base * (1 - reduction));
}

function recoveryBonusPct(skillLevel: number): number {
  return Math.round((skillLevel / 250) * 100);
}

/** Simple inline progress bar so we can control indicator colour per-bar */
function MiniProgress({ value, colorClass }: { value: number; colorClass: string }) {
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-primary/20">
      <div
        className={`h-full rounded-full transition-all ${colorClass}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function fitnessColor(v: number) {
  return v >= 80 ? "bg-green-500" : v >= 55 ? "bg-yellow-500" : "bg-red-500";
}
function fatigueColor(v: number) {
  return v <= 30 ? "bg-green-500" : v <= 60 ? "bg-yellow-500" : "bg-red-500";
}

type StaffRow = {
  id: number;
  name: string;
  role: string;
  specialty: string;
  skillLevel: number;
  salary: number;
  imageUrl?: string | null;
};

export default function MedicalCentre() {
  const { data: roster, isLoading } = useGetTeamRoster({
    query: { queryKey: getGetTeamRosterQueryKey() },
  });

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-56" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-52" />
          <Skeleton className="h-52" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const allPlayers = [...(roster?.activePlayers ?? []), ...(roster?.benchPlayers ?? [])];
  const medicalStaff: StaffRow[] = (roster?.staff ?? []).filter((s) =>
    MEDICAL_ROLES.includes(s.role as string)
  );

  const physio = medicalStaff.find(
    (s) => (s.role as string) === "physio" || (s.role as string) === "physiotherapist"
  );
  const fitnessTrainer = medicalStaff.find((s) => (s.role as string) === "fitness_trainer");

  const bestSkill =
    medicalStaff.length > 0 ? Math.max(...medicalStaff.map((s) => s.skillLevel)) : 0;

  const injuredPlayers = allPlayers.filter((p) => (p.injuryStatus as string) !== "Healthy");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
          <Heart className="h-8 w-8" /> Medical Centre
        </h2>
        <p className="text-muted-foreground mt-1">
          Monitor player health, manage injuries, and track recovery progress.
        </p>
      </div>

      <FacilityBonusBanner
        facilityType="medical_centre"
        facilityName="Medical Centre"
        getBonusText={(level) => {
          const pct = Math.round((level - 1) * (100 / 9));
          return `~${pct}% faster injury recovery — applies to match rest and Recovery training`;
        }}
      />

      {/* ── Medical Staff ─────────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-primary" /> Medical Staff
        </h3>

        <div className="grid gap-6 md:grid-cols-2">
          <StaffSlot
            member={physio}
            roleLabel="Physiotherapist"
            emptyDescription="No physiotherapist hired. Injured players recover slower without one."
            accentFrom="from-green-700/80"
          />
          <StaffSlot
            member={fitnessTrainer}
            roleLabel="Fitness Trainer"
            emptyDescription="No fitness trainer hired. Player fitness declines faster without one."
            accentFrom="from-blue-700/80"
          />
        </div>

        {medicalStaff.length === 0 ? (
          <Alert className="border-yellow-500/30 bg-yellow-500/5">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-700 dark:text-yellow-400">
              You have no medical staff. Hire a physiotherapist or fitness trainer on the{" "}
              <Link href="/staff">
                <span className="underline font-semibold cursor-pointer">Staff page</span>
              </Link>{" "}
              to speed up player recovery.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="p-4 rounded-lg border bg-primary/5 flex flex-wrap gap-6">
            <Stat icon={Clock} label="Recovery speed bonus" value={`−${recoveryBonusPct(bestSkill)}%`} />
            <Stat icon={Zap} label="Minor injury" value={`${recoveryWeeks("Minor Injury", bestSkill)}w`} iconColor="text-yellow-500" />
            <Stat icon={Zap} label="Major injury" value={`${recoveryWeeks("Major Injury", bestSkill)}w`} iconColor="text-orange-500" />
            <Stat icon={Shield} label="Unavailable" value={`${recoveryWeeks("Unavailable", bestSkill)}w`} iconColor="text-red-500" />
          </div>
        )}
      </section>

      {/* ── Injury Report ─────────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-primary" /> Injury Report
        </h3>

        {injuredPlayers.length === 0 ? (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="flex items-center gap-4 py-6">
              <CheckCircle2 className="h-10 w-10 text-green-500 shrink-0" />
              <div>
                <p className="font-bold text-green-700 dark:text-green-400">All players are fit!</p>
                <p className="text-sm text-muted-foreground">
                  No injuries in your squad right now. Monitor fitness and fatigue to keep it that way.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {injuredPlayers.map((player) => {
              const status = (player.injuryStatus as string) ?? "Healthy";
              const colors = INJURY_COLORS[status] ?? INJURY_COLORS["Minor Injury"];
              const Icon = INJURY_ICONS[status] ?? AlertTriangle;
              const weeksLeft =
                (player.injuryWeeksRemaining as number) > 0
                  ? (player.injuryWeeksRemaining as number)
                  : recoveryWeeks(status, bestSkill);
              const unaidedWeeks = INJURY_BASE_WEEKS[status] ?? 0;
              const saved = unaidedWeeks - weeksLeft;

              return (
                <Card key={player.id} className={`border ${colors.border} ${colors.bg} overflow-hidden`}>
                  <CardContent className="p-0">
                    <div className="flex">
                      {player.imageUrl && (
                        <div className="w-24 h-28 shrink-0 overflow-hidden">
                          <img
                            src={player.imageUrl}
                            alt={player.name}
                            className="w-full h-full object-cover object-[center_15%]"
                          />
                        </div>
                      )}
                      <div className="flex-1 p-4 space-y-2 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold leading-tight truncate">{player.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {player.position.replace(/_/g, " ")}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] whitespace-nowrap shrink-0 ${colors.text} border-current`}
                          >
                            <Icon className="h-2.5 w-2.5 mr-1" />
                            {status}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-1.5 text-sm">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className={`font-bold ${colors.text}`}>
                            {weeksLeft === 0
                              ? "Ready next week"
                              : `${weeksLeft} week${weeksLeft !== 1 ? "s" : ""} to recover`}
                          </span>
                        </div>

                        {medicalStaff.length > 0 && saved > 0 && (
                          <p className="text-[11px] text-muted-foreground">
                            Medical staff saved{" "}
                            <span className="font-semibold text-green-600">
                              {saved} week{saved !== 1 ? "s" : ""}
                            </span>{" "}
                            vs. no treatment
                          </p>
                        )}

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1">Fitness</p>
                            <MiniProgress value={player.fitness as number} colorClass={fitnessColor(player.fitness as number)} />
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1">Fatigue</p>
                            <MiniProgress value={player.fatigue as number} colorClass={fatigueColor(player.fatigue as number)} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Squad Fitness Overview ─────────────────────────────── */}
      <section className="space-y-4">
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
                  const docQ = player.doctorQuality as number;

                  return (
                    <div
                      key={player.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                    >
                      {player.imageUrl ? (
                        <img
                          src={player.imageUrl}
                          alt={player.name}
                          className="w-9 h-9 rounded-full object-cover object-[center_10%] shrink-0 border border-border"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                          {player.name[0]}
                        </div>
                      )}

                      <div className="min-w-0 w-32 shrink-0">
                        <p className="font-medium text-sm truncate">{player.name}</p>
                        <p className="text-[11px] text-muted-foreground capitalize">
                          {player.position.replace(/_/g, " ")}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 w-28">
                        <Icon className={`h-3 w-3 ${colors.text} shrink-0`} />
                        <span className={`text-xs font-medium ${colors.text} truncate`}>{status}</span>
                      </div>

                      <div className="flex-1 grid grid-cols-2 gap-4 min-w-0">
                        <div>
                          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                            <span>Fitness</span>
                            <span className="font-semibold">{fitness}</span>
                          </div>
                          <MiniProgress value={fitness} colorClass={fitnessColor(fitness)} />
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                            <span>Fatigue</span>
                            <span className="font-semibold">{fatigue}</span>
                          </div>
                          <MiniProgress value={fatigue} colorClass={fatigueColor(fatigue)} />
                        </div>
                      </div>

                      <div className="shrink-0 text-right hidden sm:block pl-2">
                        <p className="text-[10px] text-muted-foreground mb-1">Doctor</p>
                        <div className="flex gap-0.5 justify-end">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-2 h-2 rounded-sm ${i < docQ ? "bg-primary" : "bg-muted"}`}
                            />
                          ))}
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
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────── */

function Stat({
  icon: Icon,
  label,
  value,
  iconColor = "text-primary",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  iconColor?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className={`h-4 w-4 ${iconColor}`} />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function StaffSlot({
  member,
  roleLabel,
  emptyDescription,
  accentFrom,
}: {
  member: StaffRow | undefined;
  roleLabel: string;
  emptyDescription: string;
  accentFrom: string;
}) {
  if (!member) {
    return (
      <Card className="border-dashed border-2 bg-muted/20">
        <CardContent className="flex flex-col items-center justify-center py-10 gap-3 text-center">
          <UserCog className="h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="font-semibold text-muted-foreground">{roleLabel} — Not Hired</p>
            <p className="text-sm text-muted-foreground/70 max-w-xs mt-1">{emptyDescription}</p>
          </div>
          <Link href="/staff">
            <Button variant="outline" size="sm" className="gap-1.5 mt-1">
              <LinkIcon className="h-3.5 w-3.5" /> Hire on Staff page
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const bonus = recoveryBonusPct(member.skillLevel);

  return (
    <Card className="overflow-hidden">
      <div className="relative h-48">
        {member.imageUrl ? (
          <img
            src={member.imageUrl}
            alt={member.name}
            className="w-full h-full object-cover object-[center_15%]"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <Stethoscope className="h-16 w-16 text-muted-foreground/30" />
          </div>
        )}
        <div className={`absolute inset-0 bg-gradient-to-t ${accentFrom} to-transparent`} />
        <div className="absolute top-2 left-2">
          <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 text-[10px]">
            {roleLabel.toUpperCase()}
          </Badge>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="font-bold text-white drop-shadow">{member.name}</p>
          <p className="text-xs text-white/70">{member.specialty}</p>
        </div>
      </div>
      <CardContent className="p-4 space-y-3">
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-medium">
            <span>Skill Level</span>
            <span>{member.skillLevel}%</span>
          </div>
          <MiniProgress value={member.skillLevel} colorClass="bg-primary" />
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5 text-green-600 font-semibold">
            <Clock className="h-4 w-4" />
            <span>Cuts recovery by {bonus}%</span>
          </div>
          <span className="text-muted-foreground text-xs">
            ${Number(member.salary).toLocaleString()}/mo
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
