import {
  useGetTeamRoster,
  getGetTeamRosterQueryKey,
  useGetFacilities,
  getGetFacilitiesQueryKey,
  useUpgradeFacility,
  useGetSeasonInjuryStats,
  useGetPlayerWorkloads,
  useGetInjuryHistory,
} from "@workspace/api-client-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
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
  ArrowUp,
  BarChart2,
  Activity,
  History,
  ChevronDown,
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
  return RISK_LEVELS.find(r => risk <= r.max) ?? RISK_LEVELS[3];
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

      {/* ── Medical Staff ─────────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-primary" /> Medical Staff
        </h3>

        <div className="grid gap-6 md:grid-cols-2">
          <StaffSlot
            member={physio}
            roleLabel="Physiotherapist"
            statLabel="Recovery Bonus"
            accentFrom="from-green-700/80"
            totalPlayers={allPlayers.length}
          />
          <StaffSlot
            member={fitnessTrainer}
            roleLabel="Fitness Trainer"
            statLabel="Fatigue Reduction"
            accentFrom="from-blue-700/80"
            totalPlayers={allPlayers.length}
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

      {/* ── Treatment Queue ───────────────────────────────────── */}
      <TreatmentQueue injuredPlayers={injuredPlayers} bestSkill={bestSkill} />

      {/* ── Recovery Forecast ─────────────────────────────────── */}
      <RecoveryForecastPanel injuredPlayers={injuredPlayers} bestSkill={bestSkill} />

      {/* ── Injury History ────────────────────────────────────── */}
      <InjuryHistorySection />

      {/* ── Season Injury Statistics ───────────────────────────── */}
      <SeasonInjuryStatsCard />

      {/* ── Workload Monitoring ────────────────────────────────── */}
      <WorkloadMonitoringCard />

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
                  const risk = calcInjuryRisk(fitness, fatigue);
                  const riskLevel = getRiskLevel(risk);

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

                      <div className="shrink-0 w-24 hidden md:block">
                        <p className="text-[10px] text-muted-foreground mb-1">Injury Risk</p>
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${riskLevel.dot}`} />
                          <span className={`text-xs font-semibold ${riskLevel.text}`}>{risk}%</span>
                        </div>
                        <p className={`text-[10px] mt-0.5 ${riskLevel.text}`}>{riskLevel.label}</p>
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

/* ── Treatment Queue ─────────────────────────────────────────── */

function TreatmentQueue({
  injuredPlayers,
  bestSkill,
}: {
  injuredPlayers: InjuredPlayer[];
  bestSkill: number;
}) {
  const queue = injuredPlayers
    .map((p) => {
      const status = p.injuryStatus as string;
      const baseWeeks = INJURY_BASE_WEEKS[status] ?? 0;
      const weeksLeft =
        (p.injuryWeeksRemaining as number) > 0
          ? (p.injuryWeeksRemaining as number)
          : recoveryWeeks(status, bestSkill);
      const daysLeft = weeksLeft * 7;
      const totalDays = baseWeeks * 7;
      const progress = totalDays > 0
        ? Math.round(Math.max(0, Math.min(100, ((totalDays - daysLeft) / totalDays) * 100)))
        : 0;
      return { ...p, status, daysLeft, progress };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <section className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Stethoscope className="h-5 w-5 text-primary" /> Treatment Queue
      </h3>

      {queue.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-5">
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
                const barColor =
                  player.progress >= 75 ? "bg-green-500" :
                  player.progress >= 40 ? "bg-yellow-500" : "bg-orange-500";

                return (
                  <div key={player.id} className="flex items-center gap-4 px-4 py-3">
                    {/* Rank */}
                    <span className="text-xs font-bold text-muted-foreground/50 w-4 shrink-0 text-right">
                      {idx + 1}
                    </span>

                    {/* Name + injury type */}
                    <div className="min-w-0 w-40 shrink-0">
                      <p className="font-semibold text-sm truncate">{player.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Icon className={`h-3 w-3 shrink-0 ${colors.text}`} />
                        <span className={`text-[11px] ${colors.text}`}>{player.status}</span>
                      </div>
                    </div>

                    {/* Progress bar + days */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          {player.daysLeft === 0
                            ? "Ready next week"
                            : `${player.daysLeft} day${player.daysLeft !== 1 ? "s" : ""} remaining`}
                        </span>
                        <span className="font-semibold text-muted-foreground">{player.progress}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-primary/15 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${barColor}`}
                          style={{ width: `${player.progress}%` }}
                        />
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

/* ── Recovery Forecast ───────────────────────────────────────── */

type InjuredPlayer = {
  id: number;
  name: string;
  injuryStatus: unknown;
  injuryWeeksRemaining: unknown;
};

function RecoveryForecastPanel({
  injuredPlayers,
  bestSkill,
}: {
  injuredPlayers: InjuredPlayer[];
  bestSkill: number;
}) {
  if (injuredPlayers.length === 0) {
    return (
      <section className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" /> Recovery Forecast
        </h3>
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="flex items-center gap-3 py-5">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            <p className="text-sm text-green-700 dark:text-green-400 font-medium">No active recoveries.</p>
          </CardContent>
        </Card>
      </section>
    );
  }

  const playersWithDays = injuredPlayers.map((p) => {
    const status = p.injuryStatus as string;
    const weeksLeft =
      (p.injuryWeeksRemaining as number) > 0
        ? (p.injuryWeeksRemaining as number)
        : recoveryWeeks(status, bestSkill);
    return { ...p, daysLeft: weeksLeft * 7 };
  });

  const recoveredIn7  = playersWithDays.filter((p) => p.daysLeft <= 7).length;
  const recoveredIn30 = playersWithDays.filter((p) => p.daysLeft <= 30).length;
  const longest = playersWithDays.reduce((a, b) => (b.daysLeft > a.daysLeft ? b : a));

  return (
    <section className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Clock className="h-5 w-5 text-primary" /> Recovery Forecast
      </h3>
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <ForecastStat
              label="Players recovering"
              value={injuredPlayers.length}
              valueClass="text-orange-600"
            />
            <ForecastStat
              label="Expected recovered in 7 days"
              value={recoveredIn7}
              valueClass={recoveredIn7 > 0 ? "text-green-600" : "text-muted-foreground"}
            />
            <ForecastStat
              label="Expected recovered in 30 days"
              value={recoveredIn30}
              valueClass={recoveredIn30 > 0 ? "text-green-600" : "text-muted-foreground"}
            />
          </div>

          <div className="border-t pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Longest current injury
            </p>
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
              <div>
                <p className="font-semibold text-sm">{longest.name}</p>
                <p className="text-xs text-muted-foreground">
                  {longest.daysLeft === 0
                    ? "Ready next week"
                    : `${longest.daysLeft} day${longest.daysLeft !== 1 ? "s" : ""} remaining`}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function ForecastStat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: number;
  valueClass?: string;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] text-muted-foreground leading-snug">{label}</p>
      <p className={`text-2xl font-bold ${valueClass ?? ""}`}>{value}</p>
    </div>
  );
}

/* ── Injury History Section ──────────────────────────────────── */

const INJURY_TYPE_COLORS: Record<string, string> = {
  "Minor Injury": "border-yellow-500/40 text-yellow-600",
  "Major Injury": "border-orange-500/40 text-orange-600",
  "Unavailable":  "border-red-500/40 text-red-600",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric",
  });
}

function InjuryHistorySection() {
  const [open, setOpen] = useState(false);
  const { data: history, isLoading } = useGetInjuryHistory();

  const count = history?.length ?? 0;

  return (
    <section className="space-y-3">
      {/* Collapsible trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between rounded-lg border bg-card px-5 py-3.5 hover:bg-muted/40 transition-colors"
      >
        <span className="flex items-center gap-2 text-base font-semibold">
          <History className="h-5 w-5 text-primary" />
          Injury History
          {count > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs">{count}</Badge>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Collapsible body */}
      {open && (
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : count === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                <History className="h-8 w-8 text-muted-foreground/30" />
                <p>No injuries recorded this season.</p>
                <p className="text-xs">Records are created automatically when a player is injured during a match.</p>
              </div>
            ) : (
              <div className="divide-y">
                {/* Header */}
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <span>Player</span>
                  <span className="w-28">Injury</span>
                  <span className="w-28">Date Injured</span>
                  <span className="w-20 text-right">Days Missed</span>
                </div>

                {history!.map(entry => (
                  <div
                    key={entry.id}
                    className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-3 hover:bg-muted/30 transition-colors"
                  >
                    {/* Player name */}
                    <p className="font-medium text-sm truncate">{entry.playerName}</p>

                    {/* Injury type */}
                    <div className="w-28">
                      <Badge
                        variant="outline"
                        className={`text-xs ${INJURY_TYPE_COLORS[entry.injuryType] ?? "border-muted text-muted-foreground"}`}
                      >
                        {entry.injuryType}
                      </Badge>
                    </div>

                    {/* Date */}
                    <span className="w-28 text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(entry.dateInjured as string)}
                    </span>

                    {/* Days missed */}
                    <span className="w-20 text-right text-sm font-semibold">
                      {entry.daysMissed}d
                    </span>
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

/* ── Workload Monitoring Card ────────────────────────────────── */

const WORKLOAD_CONFIG = {
  Fresh:        { dot: "bg-green-500",  text: "text-green-600",  badge: "border-green-500/40 text-green-600",  label: "Fresh"       },
  "Heavy Load": { dot: "bg-yellow-500", text: "text-yellow-600", badge: "border-yellow-500/40 text-yellow-600", label: "Heavy Load"  },
  Overworked:   { dot: "bg-red-500",    text: "text-red-600",    badge: "border-red-500/40 text-red-600",      label: "Overworked"  },
} as const;

function WorkloadMonitoringCard() {
  const { data: workloads, isLoading } = useGetPlayerWorkloads();

  const sorted = [...(workloads ?? [])].sort((a, b) => {
    const order = { Overworked: 0, "Heavy Load": 1, Fresh: 2 };
    return (order[a.status as keyof typeof order] ?? 2) - (order[b.status as keyof typeof order] ?? 2);
  });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" /> Workload Monitoring
        </h3>
        <span className="text-xs text-muted-foreground">Last 14 days · Monitoring only</span>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No players found in your squad.
            </div>
          ) : (
            <div className="divide-y">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <span>Player</span>
                <span className="text-center w-20">Matches</span>
                <span className="text-center w-24">Training</span>
                <span className="text-center w-24">Status</span>
              </div>

              {sorted.map(player => {
                const cfg = WORKLOAD_CONFIG[player.status as keyof typeof WORKLOAD_CONFIG] ?? WORKLOAD_CONFIG.Fresh;
                return (
                  <div
                    key={player.id}
                    className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-3 hover:bg-muted/30 transition-colors"
                  >
                    {/* Player info */}
                    <div className="flex items-center gap-3 min-w-0">
                      {player.imageUrl ? (
                        <img
                          src={player.imageUrl}
                          alt={player.name}
                          className="h-8 w-8 rounded-full object-cover object-[center_15%] shrink-0"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-muted shrink-0 flex items-center justify-center">
                          <span className="text-xs font-bold text-muted-foreground">
                            {player.name.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate text-sm">{player.name}</p>
                        <p className="text-xs text-muted-foreground capitalize truncate">
                          {player.position.replace(/_/g, " ")}
                        </p>
                      </div>
                    </div>

                    {/* Matches */}
                    <div className="w-20 text-center">
                      <span className="text-sm font-semibold">{player.matchesPlayed}</span>
                      <p className="text-[10px] text-muted-foreground">matches</p>
                    </div>

                    {/* Training */}
                    <div className="w-24 text-center">
                      <span className="text-sm font-semibold">{player.trainingSessions}</span>
                      <p className="text-[10px] text-muted-foreground">sessions</p>
                    </div>

                    {/* Status badge */}
                    <div className="w-24 flex justify-center">
                      <Badge
                        variant="outline"
                        className={`gap-1.5 text-xs ${cfg.badge}`}
                      >
                        <span className={`h-2 w-2 rounded-full shrink-0 ${cfg.dot}`} />
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

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground px-1">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Fresh — &lt;2 matches &amp; &lt;3 training
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-yellow-500" />
          Heavy Load — 2–3 matches or 3–5 training
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          Overworked — 4+ matches or 6+ training
        </span>
      </div>
    </section>
  );
}

/* ── Season Injury Statistics Card ──────────────────────────── */

function SeasonInjuryStatsCard() {
  const { data: stats, isLoading } = useGetSeasonInjuryStats();

  const mostCommonColor: Record<string, string> = {
    "Minor Injury": "text-yellow-600",
    "Major Injury": "text-orange-600",
    "Unavailable":  "text-red-600",
    "None":         "text-muted-foreground",
  };

  return (
    <section className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <BarChart2 className="h-5 w-5 text-primary" /> Season Injury Statistics
      </h3>

      <Card>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {/* Total Injuries */}
              <div className="flex flex-col items-center justify-center rounded-lg border bg-primary/5 p-4 text-center">
                <span className="text-2xl font-bold text-primary">
                  {stats?.totalInjuries ?? 0}
                </span>
                <span className="mt-1 text-xs text-muted-foreground leading-tight">
                  Total Injuries
                </span>
              </div>

              {/* Days Lost */}
              <div className="flex flex-col items-center justify-center rounded-lg border bg-primary/5 p-4 text-center">
                <span className="text-2xl font-bold text-orange-500">
                  {stats?.daysLost ?? 0}
                </span>
                <span className="mt-1 text-xs text-muted-foreground leading-tight">
                  Days Lost
                </span>
              </div>

              {/* Average Recovery Time */}
              <div className="flex flex-col items-center justify-center rounded-lg border bg-primary/5 p-4 text-center">
                <span className="text-2xl font-bold text-blue-500">
                  {stats?.avgRecoveryDays ?? 0}
                  <span className="text-sm font-normal text-muted-foreground ml-0.5">d</span>
                </span>
                <span className="mt-1 text-xs text-muted-foreground leading-tight">
                  Avg Recovery
                </span>
              </div>

              {/* Most Common Injury */}
              <div className="flex flex-col items-center justify-center rounded-lg border bg-primary/5 p-4 text-center">
                <span className={`text-sm font-bold leading-tight ${mostCommonColor[stats?.mostCommon ?? "None"] ?? "text-muted-foreground"}`}>
                  {stats?.mostCommon ?? "None"}
                </span>
                <span className="mt-1 text-xs text-muted-foreground leading-tight">
                  Most Common
                </span>
              </div>

              {/* Current Injury Count */}
              <div className="flex flex-col items-center justify-center rounded-lg border bg-primary/5 p-4 text-center">
                <span className={`text-2xl font-bold ${(stats?.currentInjuryCount ?? 0) > 0 ? "text-red-500" : "text-green-500"}`}>
                  {stats?.currentInjuryCount ?? 0}
                </span>
                <span className="mt-1 text-xs text-muted-foreground leading-tight">
                  Currently Injured
                </span>
              </div>
            </div>
          )}

          {!isLoading && (stats?.totalInjuries ?? 0) === 0 && (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              No injuries recorded this season. Play matches to accumulate stats.
            </p>
          )}

          {!isLoading && (
            <p className="mt-4 text-xs text-muted-foreground text-right">
              Season {stats?.seasonId ?? 1} · Resets at the start of a new season
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

/* ── Medical Centre Facility Card ───────────────────────────── */

const MC_MAX_LEVEL = 10;

function MedicalCentreFacilityCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: facilities, isLoading } = useGetFacilities({
    query: { queryKey: getGetFacilitiesQueryKey() },
  });
  const upgradeMutation = useUpgradeFacility();

  const facility = facilities?.find((f) => f.type === "medical_centre");
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
          toast({
            title: "Upgrade failed",
            description: err?.message ?? "Insufficient funds or max level reached.",
            variant: "destructive",
          });
        },
      },
    );
  };

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <Card className="border-rose-500/30 bg-rose-500/5">
      <CardContent className="p-5">
        {/* Header row */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-rose-500 shrink-0" />
            <span className="font-semibold text-base">Medical Centre</span>
          </div>
          <Badge
            variant="outline"
            className={isMax
              ? "border-rose-500/40 text-rose-600 bg-rose-500/10"
              : "border-rose-500/30 text-rose-600"}
          >
            {isMax ? "MAX" : `Level ${level} / ${MC_MAX_LEVEL}`}
          </Badge>
        </div>

        {/* Level progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
            <span>Level progress</span>
            <span>{level} / {MC_MAX_LEVEL}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-rose-500/15 overflow-hidden">
            <div
              className="h-full rounded-full bg-rose-500 transition-all"
              style={{ width: `${(level / MC_MAX_LEVEL) * 100}%` }}
            />
          </div>
        </div>

        {/* Bonuses + Upgrade button */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Current Bonuses
            </p>
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

          <Button
            size="sm"
            disabled={isMax || upgradeMutation.isPending}
            onClick={handleUpgrade}
            className="gap-1.5 shrink-0"
          >
            <ArrowUp className="h-3.5 w-3.5" />
            {isMax ? "Max Level" : `Upgrade to Level ${level + 1}`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Squad Health Summary ────────────────────────────────────── */

type Player = { fitness: unknown; fatigue: unknown; injuryStatus: unknown };

const CONDITION_LEVELS = [
  { label: "Excellent", min: 90, ring: "border-green-500/40",  bg: "bg-green-500/8",  badge: "bg-green-500/15 text-green-600 border-green-500/30"  },
  { label: "Good",      min: 75, ring: "border-yellow-500/40", bg: "bg-yellow-500/8", badge: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30" },
  { label: "Fair",      min: 60, ring: "border-orange-500/40", bg: "bg-orange-500/8", badge: "bg-orange-500/15 text-orange-600 border-orange-500/30" },
  { label: "Poor",      min: 0,  ring: "border-red-500/40",    bg: "bg-red-500/8",    badge: "bg-red-500/15 text-red-600 border-red-500/30"          },
] as const;

function getCondition(avgFitness: number) {
  return CONDITION_LEVELS.find(c => avgFitness >= c.min) ?? CONDITION_LEVELS[3];
}

function SquadHealthSummary({ players }: { players: Player[] }) {
  if (players.length === 0) return null;

  const healthy  = players.filter(p => (p.injuryStatus as string) === "Healthy").length;
  const injured  = players.length - healthy;
  const avgFit   = Math.round(players.reduce((s, p) => s + (p.fitness as number), 0) / players.length);
  const avgFatigue = Math.round(players.reduce((s, p) => s + (p.fatigue as number), 0) / players.length);
  const condition = getCondition(avgFit);

  return (
    <Card className={`border ${condition.ring} ${condition.bg}`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Heart className="h-4 w-4 text-primary" />
            Squad Health Status
          </h3>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-semibold ${condition.badge}`}>
            {condition.label}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <HealthStat
            label="Healthy Players"
            value={`${healthy}`}
            sub={`of ${players.length}`}
            valueClass="text-green-600"
          />
          <HealthStat
            label="Injured Players"
            value={`${injured}`}
            sub={`of ${players.length}`}
            valueClass={injured > 0 ? "text-red-600" : "text-muted-foreground"}
          />
          <HealthStat
            label="Avg Fitness"
            value={`${avgFit}%`}
            valueClass={avgFit >= 75 ? "text-green-600" : avgFit >= 55 ? "text-yellow-600" : "text-red-600"}
            bar={{ value: avgFit, colorClass: avgFit >= 75 ? "bg-green-500" : avgFit >= 55 ? "bg-yellow-500" : "bg-red-500" }}
          />
          <HealthStat
            label="Avg Fatigue"
            value={`${avgFatigue}%`}
            valueClass={avgFatigue <= 35 ? "text-green-600" : avgFatigue <= 65 ? "text-yellow-600" : "text-red-600"}
            bar={{ value: avgFatigue, colorClass: avgFatigue <= 35 ? "bg-green-500" : avgFatigue <= 65 ? "bg-yellow-500" : "bg-red-500" }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function HealthStat({
  label,
  value,
  sub,
  valueClass,
  bar,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
  bar?: { value: number; colorClass: string };
}) {
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
  statLabel,
  accentFrom,
  totalPlayers,
}: {
  member: StaffRow | undefined;
  roleLabel: string;
  statLabel: string;
  accentFrom: string;
  totalPlayers: number;
}) {
  if (!member) {
    return (
      <Card className="border-dashed border-2 bg-muted/20">
        <CardContent className="flex flex-col items-center justify-center py-10 gap-3 text-center">
          <UserCog className="h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="font-semibold text-muted-foreground">{roleLabel}</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Not currently employed</p>
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
      <CardContent className="p-5">
        <div className="grid grid-cols-3 divide-x text-center">
          <div className="flex flex-col items-center gap-0.5 pr-3">
            <span className="text-2xl font-bold">{member.skillLevel}</span>
            <span className="text-xs text-muted-foreground">Level</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 px-3">
            <span className="text-2xl font-bold text-green-600">{bonus}%</span>
            <span className="text-xs text-muted-foreground text-center leading-tight">{statLabel}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 pl-3">
            <span className="text-2xl font-bold">{totalPlayers}</span>
            <span className="text-xs text-muted-foreground">Players Assigned</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
