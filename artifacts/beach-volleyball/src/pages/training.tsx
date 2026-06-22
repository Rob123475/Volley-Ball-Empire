import {
  useGetTrainingPlan,
  useListTrainingSessions,
  useScheduleTraining,
  useScheduleTeamTraining,
  useCompleteTraining,
  useListStaff,
  useListPlayers,
  useGetMyTeam,
  useUpdateTeam,
  getListTrainingSessionsQueryKey,
  getGetTrainingPlanQueryKey,
  getGetMyTeamQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayerStatusBadge } from "@/components/player-status-badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  Dumbbell,
  Users,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Shield,
  Zap,
  Heart,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { FacilityBonusBanner } from "@/components/facility-bonus-banner";

// ── Training Programs data ────────────────────────────────────────────────────

const PROGRAMS = [
  {
    id: "Power Camp",
    emoji: "💪",
    label: "Power Camp",
    tagline: "Raw strength & hitting",
    primaryStat: "Power",
    secondaryStat: "Block",
    benefits: ["+Power", "+Block"],
    drawbacks: ["High Fatigue"],
    xpModifier: 1.00,
    color: "orange",
    cardClass: "border-orange-300 dark:border-orange-800",
    activeClass: "border-orange-500 bg-orange-50 dark:bg-orange-950/40 ring-2 ring-orange-400",
    dotClass: "bg-orange-500",
  },
  {
    id: "Agility Camp",
    emoji: "⚡",
    label: "Agility Camp",
    tagline: "Speed & court coverage",
    primaryStat: "Speed",
    secondaryStat: "Defense",
    benefits: ["+Speed", "+Defense"],
    drawbacks: ["Smaller Power gains"],
    xpModifier: 1.00,
    color: "blue",
    cardClass: "border-blue-300 dark:border-blue-800",
    activeClass: "border-blue-500 bg-blue-50 dark:bg-blue-950/40 ring-2 ring-blue-400",
    dotClass: "bg-blue-500",
  },
  {
    id: "Serving Academy",
    emoji: "🎯",
    label: "Serving Academy",
    tagline: "Precision & match confidence",
    primaryStat: "Serve",
    secondaryStat: null,
    benefits: ["+Serve", "+Morale"],
    drawbacks: [],
    xpModifier: 1.00,
    color: "purple",
    cardClass: "border-purple-300 dark:border-purple-800",
    activeClass: "border-purple-500 bg-purple-50 dark:bg-purple-950/40 ring-2 ring-purple-400",
    dotClass: "bg-purple-500",
  },
  {
    id: "Defensive Systems",
    emoji: "🛡️",
    label: "Defensive Systems",
    tagline: "Reading opponents",
    primaryStat: "Defense",
    secondaryStat: "Stamina",
    benefits: ["+Defense", "+Stamina"],
    drawbacks: ["Slower offensive dev"],
    xpModifier: 0.95,
    color: "green",
    cardClass: "border-green-300 dark:border-green-800",
    activeClass: "border-green-500 bg-green-50 dark:bg-green-950/40 ring-2 ring-green-400",
    dotClass: "bg-green-500",
  },
  {
    id: "Conditioning",
    emoji: "💚",
    label: "Conditioning",
    tagline: "Endurance & injury resistance",
    primaryStat: "Stamina",
    secondaryStat: null,
    benefits: ["+Stamina", "+Fitness"],
    drawbacks: ["Smaller skill gains"],
    xpModifier: 0.85,
    color: "emerald",
    cardClass: "border-emerald-300 dark:border-emerald-800",
    activeClass: "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 ring-2 ring-emerald-400",
    dotClass: "bg-emerald-500",
  },
  {
    id: "Recovery Program",
    emoji: "🌿",
    label: "Recovery Program",
    tagline: "Rest & heal injuries",
    primaryStat: null,
    secondaryStat: null,
    benefits: ["↓ Fatigue", "Heals Injuries"],
    drawbacks: ["Minimal development"],
    xpModifier: 0.15,
    color: "teal",
    cardClass: "border-teal-300 dark:border-teal-800",
    activeClass: "border-teal-500 bg-teal-50 dark:bg-teal-950/40 ring-2 ring-teal-400",
    dotClass: "bg-teal-500",
  },
] as const;

type ProgramId = typeof PROGRAMS[number]["id"];

const PHILOSOPHIES = [
  {
    id: "Power Volleyball",
    emoji: "💪",
    label: "Power Volleyball",
    description: "Power Camp +15% · Serving +5%",
    color: "orange",
    activeClass: "border-orange-500 bg-orange-50 dark:bg-orange-950/40 ring-2 ring-orange-400",
  },
  {
    id: "Fast Volleyball",
    emoji: "⚡",
    label: "Fast Volleyball",
    description: "Agility Camp +15% · Serving +10%",
    color: "blue",
    activeClass: "border-blue-500 bg-blue-50 dark:bg-blue-950/40 ring-2 ring-blue-400",
  },
  {
    id: "Defensive Volleyball",
    emoji: "🛡️",
    label: "Defensive Volleyball",
    description: "Defensive Systems +15% · Conditioning +10%",
    color: "green",
    activeClass: "border-green-500 bg-green-50 dark:bg-green-950/40 ring-2 ring-green-400",
  },
] as const;

// Philosophy bonuses (mirrors server logic — for preview only)
const PHILOSOPHY_BONUSES: Record<string, Record<string, number>> = {
  "Power Volleyball":     { "Power Camp": 1.15, "Serving Academy": 1.05 },
  "Fast Volleyball":      { "Agility Camp": 1.15, "Serving Academy": 1.10 },
  "Defensive Volleyball": { "Defensive Systems": 1.15, "Conditioning": 1.10 },
};

// Speciality bonuses (mirrors server)
const SPECIALITY_BONUSES: Record<string, Record<string, number>> = {
  "Technical":    { "Serving Academy": 1.10, "Power Camp": 1.05 },
  "Athletic":     { "Power Camp": 1.10, "Agility Camp": 1.10 },
  "Defensive":    { "Defensive Systems": 1.10 },
  "Conditioning": { "Recovery Program": 1.15, "Conditioning": 1.10 },
};

const PERSONALITY_MULT: Record<string, number> = {
  "Motivator": 1.05, "Demanding": 1.15, "Player Friendly": 0.90, "Disciplinarian": 1.00,
};

function getAgeModifier(age: number): number {
  if (age <= 20) return 1.25;
  if (age <= 25) return 1.10;
  if (age <= 29) return 1.00;
  if (age <= 33) return 0.90;
  return 0.80;
}

function getAgeLabel(age: number): string {
  if (age <= 20) return `Young Talent (×1.25)`;
  if (age <= 25) return `Peak Development (×1.10)`;
  if (age <= 29) return `Prime (×1.00)`;
  if (age <= 33) return `Experienced (×0.90)`;
  return `Veteran (×0.80)`;
}

function estimateXp(
  programId: string,
  ageMod: number,
  philosophyMult: number,
  coachMult: number,
  programXpMod: number,
): { min: number; max: number } {
  const total = programXpMod * ageMod * philosophyMult * coachMult;
  return { min: Math.round(25 * total), max: Math.round(35 * total) };
}

// ── Form schemas ──────────────────────────────────────────────────────────────

const programIds = PROGRAMS.map(p => p.id) as [ProgramId, ...ProgramId[]];

const individualSchema = z.object({
  playerId:     z.string().min(1, "Select a player"),
  type:         z.enum(programIds),
  scheduledAt:  z.string().min(1, "Required"),
  coachId:      z.string().optional(),
});

const teamSchema = z.object({
  type:        z.enum(programIds),
  scheduledAt: z.string().min(1, "Required"),
  coachId:     z.string().optional(),
});

type IndividualFormValues = z.infer<typeof individualSchema>;
type TeamFormValues       = z.infer<typeof teamSchema>;

// ── Load colors ───────────────────────────────────────────────────────────────

const loadColors: Record<string, string> = {
  light: "secondary", moderate: "secondary", intense: "destructive", peak: "destructive",
};
const loadValues: Record<string, number> = {
  light: 25, moderate: 50, intense: 75, peak: 95,
};

// ── Program card dot colors ───────────────────────────────────────────────────

const programDotClass: Record<string, string> = Object.fromEntries(
  PROGRAMS.map(p => [p.id, p.dotClass])
);

// ── BenefitsPreview ───────────────────────────────────────────────────────────

function BenefitsPreview({
  programId,
  player,
  coach,
  philosophy,
}: {
  programId: ProgramId;
  player?: any;
  coach?: any;
  philosophy?: string | null;
}) {
  const program = PROGRAMS.find(p => p.id === programId);
  if (!program) return null;

  const ageMod = player?.age ? getAgeModifier(player.age) : 1.0;
  const philosophyMult = philosophy ? (PHILOSOPHY_BONUSES[philosophy]?.[programId] ?? 1.0) : 1.0;
  const coachSpecMult = coach
    ? (SPECIALITY_BONUSES[coach.coachSpeciality]?.[programId] ?? 1.0)
    : 1.0;
  const coachPersonalityMult = coach ? (PERSONALITY_MULT[coach.personality] ?? 1.0) : 1.0;
  const coachRatingMult = coach ? Math.round((1 + (coach.overallRating - 75) / 100) * 100) / 100 : 1.0;
  const totalCoachMult = coachSpecMult * coachPersonalityMult * coachRatingMult;

  const { min, max } = estimateXp(programId, ageMod, philosophyMult, totalCoachMult, program.xpModifier);
  const avgXp = (min + max) / 2;

  const sessionsPerPrimary   = program.primaryStat   ? Math.ceil(100 / avgXp) : null;
  const sessionsPerSecondary = program.secondaryStat ? Math.ceil(200 / avgXp) : null;

  const hasBonus = ageMod !== 1.0 || philosophyMult !== 1.0 || totalCoachMult !== 1.0;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 text-xs">
      <div className="font-semibold text-foreground flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-primary" /> Estimated Benefits
      </div>

      <div className="space-y-1 text-muted-foreground">
        {program.primaryStat && (
          <div className="flex justify-between">
            <span>+{program.primaryStat}</span>
            {sessionsPerPrimary && <span className="text-foreground font-medium">+1 per ~{sessionsPerPrimary} sessions</span>}
          </div>
        )}
        {program.secondaryStat && (
          <div className="flex justify-between">
            <span>+{program.secondaryStat} (secondary)</span>
            {sessionsPerSecondary && <span className="text-foreground font-medium">+1 per ~{sessionsPerSecondary} sessions</span>}
          </div>
        )}
        {programId === "Recovery Program" && (
          <div className="flex justify-between">
            <span>Fatigue</span>
            <span className="text-green-600 font-medium">−30 per session</span>
          </div>
        )}
        {programId === "Serving Academy" && (
          <div className="flex justify-between">
            <span>Morale</span>
            <span className="text-yellow-600 font-medium">+2 per session</span>
          </div>
        )}
      </div>

      {hasBonus && (
        <div className="pt-1 border-t border-border space-y-0.5 text-muted-foreground">
          {player?.age && ageMod !== 1.0 && (
            <div className="flex justify-between">
              <span>{player.name} (age {player.age})</span>
              <span className={cn("font-medium", ageMod > 1 ? "text-green-600" : "text-orange-500")}>
                {getAgeLabel(player.age)}
              </span>
            </div>
          )}
          {philosophyMult !== 1.0 && (
            <div className="flex justify-between">
              <span>Philosophy bonus</span>
              <span className="text-primary font-medium">+{Math.round((philosophyMult - 1) * 100)}%</span>
            </div>
          )}
          {coach && totalCoachMult !== 1.0 && (
            <div className="flex justify-between">
              <span>{coach.name}</span>
              <span className={cn("font-medium", totalCoachMult >= 1 ? "text-green-600" : "text-orange-500")}>
                ×{totalCoachMult.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-border font-semibold text-foreground">
        <span>Expected XP / session</span>
        <span className="text-primary">~{min}–{max}</span>
      </div>
    </div>
  );
}

// ── ProgramGrid ───────────────────────────────────────────────────────────────

function ProgramGrid({ selected, onSelect }: { selected?: ProgramId; onSelect: (id: ProgramId) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {PROGRAMS.map((p) => {
        const isSelected = selected === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            className={cn(
              "text-left rounded-xl border p-3 transition-all hover:shadow-sm focus:outline-none",
              isSelected ? p.activeClass : "border-border hover:border-muted-foreground/40 bg-card"
            )}
          >
            <div className="text-lg mb-1">{p.emoji}</div>
            <div className="font-semibold text-xs leading-tight">{p.label}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{p.tagline}</div>
            <div className="mt-2 space-y-0.5">
              {p.benefits.map(b => (
                <div key={b} className="text-[10px] text-green-600 font-medium">{b}</div>
              ))}
              {p.drawbacks.map(d => (
                <div key={d} className="text-[10px] text-orange-500">{d}</div>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── TrainingForm ──────────────────────────────────────────────────────────────

function TrainingForm({
  scope,
  players,
  staff,
  philosophy,
  onDone,
}: {
  scope: "individual" | "team";
  players?: any[];
  staff?: any[];
  philosophy?: string | null;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const scheduleMutation     = useScheduleTraining();
  const scheduleTeamMutation = useScheduleTeamTraining();
  const isTeam = scope === "team";

  const individualForm = useForm<IndividualFormValues>({
    resolver: zodResolver(individualSchema),
    defaultValues: { scheduledAt: new Date().toISOString().slice(0, 16) },
  });
  const teamForm = useForm<TeamFormValues>({
    resolver: zodResolver(teamSchema),
    defaultValues: { scheduledAt: new Date().toISOString().slice(0, 16) },
  });

  const form: any = isTeam ? teamForm : individualForm;
  const selectedProgram = form.watch("type") as ProgramId | undefined;
  const selectedPlayerId = isTeam ? undefined : individualForm.watch("playerId");
  const selectedCoachId  = form.watch("coachId");

  const selectedPlayer = players?.find(p => p.id === Number(selectedPlayerId));
  const selectedCoach  = staff?.find(s => s.id === Number(selectedCoachId));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListTrainingSessionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetTrainingPlanQueryKey() });
  };

  const handleIndividual = (values: IndividualFormValues) => {
    scheduleMutation.mutate({
      data: {
        playerId: parseInt(values.playerId),
        type: values.type,
        focus: values.type,
        durationHours: 2,
        scheduledAt: values.scheduledAt,
        coachId: values.coachId ? parseInt(values.coachId) : undefined,
      }
    }, {
      onSuccess: () => {
        invalidate();
        toast({ title: "Session Scheduled", description: `${values.type} session added.` });
        onDone();
      }
    });
  };

  const handleTeam = (values: TeamFormValues) => {
    scheduleTeamMutation.mutate({
      data: {
        type: values.type,
        focus: values.type,
        durationHours: 2,
        scheduledAt: values.scheduledAt,
        coachId: values.coachId ? parseInt(values.coachId) : undefined,
      }
    }, {
      onSuccess: (result) => {
        invalidate();
        toast({
          title: "Team Training Scheduled",
          description: `${values.type} for ${Array.isArray(result) ? result.length : 0} players.`,
        });
        onDone();
      }
    });
  };

  const isPending = isTeam ? scheduleTeamMutation.isPending : scheduleMutation.isPending;

  return (
    <Form {...form}>
    <form onSubmit={form.handleSubmit(isTeam ? handleTeam : handleIndividual)} className="space-y-4">
      {/* Player selector (individual only) */}
      {!isTeam && (
        <FormField control={individualForm.control} name="playerId" render={({ field }: any) => (
          <FormItem>
            <FormLabel>Player</FormLabel>
            <Select onValueChange={field.onChange} value={field.value?.toString()}>
              <FormControl>
                <SelectTrigger data-testid="select-player">
                  <SelectValue placeholder="Select Player" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {players?.map(p => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    <div className="flex items-center gap-2">
                      <span>{p.name}</span>
                      <span className="text-xs text-muted-foreground">age {p.age}</span>
                      <PlayerStatusBadge player={p as any} size="xs" />
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
        )} />
      )}

      {isTeam && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <Users className="h-4 w-4" /> Team Training
          </div>
          <p className="text-muted-foreground text-xs mt-1">
            Creates sessions for all active players. Development speed varies by player age.
          </p>
        </div>
      )}

      {/* Program selection */}
      <FormField control={form.control} name="type" render={({ field }: any) => (
        <FormItem>
          <FormLabel>Training Program</FormLabel>
          <ProgramGrid
            selected={field.value as ProgramId | undefined}
            onSelect={(id) => field.onChange(id)}
          />
          {form.formState.errors.type && (
            <p className="text-xs text-destructive mt-1">Select a training program</p>
          )}
        </FormItem>
      )} />

      {/* Benefits preview */}
      {selectedProgram && (
        <BenefitsPreview
          programId={selectedProgram}
          player={selectedPlayer}
          coach={selectedCoach}
          philosophy={philosophy}
        />
      )}

      {/* Coach + Date row */}
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="coachId" render={({ field }: any) => (
          <FormItem>
            <FormLabel>Coach (Optional)</FormLabel>
            <Select onValueChange={field.onChange} value={field.value?.toString()}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {staff?.filter(s => ["head_coach", "assistant_coach", "strength_coach"].includes(s.role)).map(s => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    {s.name} · OVR {s.overallRating}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
        )} />

        <FormField control={form.control} name="scheduledAt" render={({ field }: any) => (
          <FormItem>
            <FormLabel>Scheduled At</FormLabel>
            <FormControl>
              <Input type="datetime-local" {...field} data-testid="input-scheduled-at" />
            </FormControl>
          </FormItem>
        )} />
      </div>

      <Button type="submit" className="w-full" disabled={isPending} data-testid="button-confirm-session">
        {isPending ? "Scheduling…" : isTeam ? "Schedule for Entire Team" : "Confirm Session"}
      </Button>
    </form>
    </Form>
  );
}

// ── PhilosophyCard ────────────────────────────────────────────────────────────

function PhilosophyCard({ currentPhilosophy }: { currentPhilosophy?: string | null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const updateTeam = useUpdateTeam();

  const handleSelect = (id: string) => {
    if (id === currentPhilosophy) return;
    setPending(id);
    updateTeam.mutate(
      { data: { trainingPhilosophy: id } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMyTeamQueryKey() });
          toast({ title: "Philosophy Set", description: `${id} is now your team's training approach.` });
          setPending(null);
        },
        onError: () => setPending(null),
      }
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" /> Team Philosophy
        </CardTitle>
        <CardDescription>Boosts related training programs for the whole team</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-2">
        {PHILOSOPHIES.map(p => {
          const isActive = currentPhilosophy === p.id;
          const isLoading = pending === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelect(p.id)}
              disabled={updateTeam.isPending}
              className={cn(
                "rounded-xl border p-3 text-left transition-all hover:shadow-sm focus:outline-none text-xs",
                isActive ? p.activeClass : "border-border hover:border-muted-foreground/40 bg-card"
              )}
            >
              <div className="text-base mb-1">{p.emoji}</div>
              <div className="font-semibold leading-tight">{p.label}</div>
              <div className="text-[10px] text-muted-foreground mt-1 leading-tight">{p.description}</div>
              {isLoading && <div className="text-[10px] text-primary mt-1">Saving…</div>}
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Training() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: plan,     isLoading: planLoading     } = useGetTrainingPlan({ query: { queryKey: getGetTrainingPlanQueryKey() } });
  const { data: sessions, isLoading: sessionsLoading } = useListTrainingSessions({ query: { queryKey: getListTrainingSessionsQueryKey() } });
  const { data: players }  = useListPlayers();
  const { data: staff }    = useListStaff();
  const { data: team }     = useGetMyTeam({ query: { queryKey: getGetMyTeamQueryKey() } });

  const completeMutation = useCompleteTraining();

  const handleComplete = (sessionId: number) => {
    completeMutation.mutate({ id: sessionId }, {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getListTrainingSessionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTrainingPlanQueryKey() });

        const gains = Object.entries(result.statGains ?? {})
          .filter(([_, val]) => (val as number) > 0)
          .map(([stat, val]) => `+${val} ${stat.charAt(0).toUpperCase() + stat.slice(1)}`)
          .join(", ");

        const xpLine = result.xpGained ? ` · ${result.xpGained} XP earned` : "";
        toast({
          title: "Training Complete!",
          description: gains ? `${gains}${xpLine}` : `Good session — keep it up!${xpLine}`,
        });
      }
    });
  };

  if (planLoading || sessionsLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const avgFatigue = (plan as any)?.averageFatigue ?? 0;
  const philosophy = (team as any)?.trainingPhilosophy ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Training Center</h2>
          <p className="text-muted-foreground">Develop your athletes with strategic training programs.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-schedule-training">
              <Dumbbell className="h-4 w-4" /> Schedule Training
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Schedule Training</DialogTitle>
              <DialogDescription>Choose a program for one player or the whole team.</DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="individual">
              <TabsList className="w-full mb-4">
                <TabsTrigger value="individual" className="flex-1 gap-2">
                  <User className="h-4 w-4" /> Individual
                </TabsTrigger>
                <TabsTrigger value="team" className="flex-1 gap-2">
                  <Users className="h-4 w-4" /> Team
                </TabsTrigger>
              </TabsList>
              <TabsContent value="individual">
                <TrainingForm scope="individual" players={players} staff={staff} philosophy={philosophy} onDone={() => setDialogOpen(false)} />
              </TabsContent>
              <TabsContent value="team">
                <TrainingForm scope="team" players={players} staff={staff} philosophy={philosophy} onDone={() => setDialogOpen(false)} />
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      <FacilityBonusBanner
        facilityType="training_complex"
        facilityName="Training Complex"
        getBonusText={(level) => `+${Math.round((level - 1) * (20 / 9))}% XP gain on all training sessions`}
      />

      {/* Philosophy + Plan row */}
      <div className="grid gap-4 md:grid-cols-2">
        <PhilosophyCard currentPhilosophy={philosophy} />

        <Card className="bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Training Plan
            </CardTitle>
            <CardDescription>Weekly Load Status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold uppercase">
                <span>Weekly Load</span>
                <Badge variant={loadColors[plan?.weeklyLoad ?? "light"] as any}>{plan?.weeklyLoad ?? "light"}</Badge>
              </div>
              <Progress value={loadValues[plan?.weeklyLoad ?? "light"]} className="h-2" />
            </div>
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div className="rounded-lg bg-background border p-2">
                <div className="font-bold text-lg text-primary">{plan?.averageFitness ?? 0}%</div>
                <div className="text-muted-foreground">Fitness</div>
              </div>
              <div className="rounded-lg bg-background border p-2">
                <div className="font-bold text-lg text-yellow-500">{plan?.averageMorale ?? 0}%</div>
                <div className="text-muted-foreground">Morale</div>
              </div>
              <div className={cn("rounded-lg bg-background border p-2", avgFatigue >= 60 ? "border-red-300" : "")}>
                <div className={cn("font-bold text-lg", avgFatigue >= 80 ? "text-red-500" : avgFatigue >= 60 ? "text-yellow-500" : "text-green-600")}>
                  {avgFatigue}%
                </div>
                <div className="text-muted-foreground flex items-center justify-center gap-0.5">
                  {avgFatigue >= 60 && <AlertTriangle className="h-3 w-3 text-red-400" />} Fatigue
                </div>
              </div>
            </div>
            {avgFatigue >= 60 && (
              <p className="text-[11px] text-yellow-600 font-medium bg-yellow-50 dark:bg-yellow-950/30 rounded p-2">
                Schedule Recovery Programs to reduce team fatigue.
              </p>
            )}
            <div className="flex items-center justify-between text-sm border-t pt-2">
              <span className="text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" /> Completed
              </span>
              <span className="font-bold">{plan?.completedThisWeek ?? 0} this week</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sessions list */}
      <Card>
        <CardHeader>
          <CardTitle>Training Sessions</CardTitle>
          <CardDescription>Active and completed sessions for all players.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sessions?.map((session) => {
              const program = PROGRAMS.find(p => p.id === session.type) ?? PROGRAMS[4];
              const coachData = (session as any).coach;
              return (
                <div
                  key={session.id}
                  data-testid={`session-row-${session.id}`}
                  className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={(session as any).player?.imageUrl ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {(session as any).player?.name?.[0] ?? "#"}
                        </AvatarFallback>
                      </Avatar>
                      <div className={cn("absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border border-background", programDotClass[session.type] ?? "bg-primary")} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                        {(session as any).player?.name ?? `Player #${session.playerId}`}
                        <Badge variant="outline" className="text-[9px] h-4 uppercase">
                          {program.emoji} {session.type}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {new Date(session.scheduledAt).toLocaleDateString()}
                        </span>
                        {coachData && (
                          <span className="flex items-center gap-1 text-primary font-medium">
                            <User className="h-3 w-3" />
                            {coachData.name}
                            {coachData.coachSpeciality && coachData.coachSpeciality !== "General" && (
                              <span className="text-muted-foreground font-normal">· {coachData.coachSpeciality}</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {session.status === "scheduled" ? (
                    <Button
                      size="sm"
                      onClick={() => handleComplete(session.id)}
                      disabled={completeMutation.isPending}
                      data-testid={`button-complete-${session.id}`}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Complete
                    </Button>
                  ) : (
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20">DONE</Badge>
                  )}
                </div>
              );
            })}
            {(!sessions || sessions.length === 0) && (
              <div className="text-center text-muted-foreground py-12">
                <Dumbbell className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No sessions scheduled yet.</p>
                <p className="text-sm">Use the button above to schedule training.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
