import { 
  useGetTrainingPlan, 
  useListTrainingSessions, 
  useScheduleTraining,
  useScheduleTeamTraining,
  useCompleteTraining, 
  useListStaff, 
  useListPlayers,
  getListTrainingSessionsQueryKey,
  getGetTrainingPlanQueryKey
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
  Zap,
  Users,
  AlertTriangle
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

const trainingTypes = ["strength", "agility", "serving", "blocking", "defense", "teamplay", "recovery"] as const;

const individualSchema = z.object({
  playerId: z.string().min(1, "Select a player"),
  type: z.enum(trainingTypes),
  focus: z.string().default("Individual training"),
  durationHours: z.string().default("2"),
  scheduledAt: z.string().min(1, "Required"),
  coachId: z.string().optional(),
});

const teamSchema = z.object({
  type: z.enum(trainingTypes),
  focus: z.string().default("Team training"),
  durationHours: z.string().default("2"),
  scheduledAt: z.string().min(1, "Required"),
  coachId: z.string().optional(),
});

type IndividualFormValues = z.infer<typeof individualSchema>;
type TeamFormValues = z.infer<typeof teamSchema>;

const loadColors: Record<string, string> = {
  light: "secondary", moderate: "secondary", intense: "destructive", peak: "destructive",
};
const loadValues: Record<string, number> = {
  light: 25, moderate: 50, intense: 75, peak: 95,
};

const typeColors: Record<string, string> = {
  strength: "bg-orange-500", agility: "bg-blue-500", serving: "bg-purple-500",
  blocking: "bg-red-500", defense: "bg-green-500", teamplay: "bg-cyan-500", recovery: "bg-emerald-500",
};

const getFatigueColor = (fatigue: number) => {
  if (fatigue < 30) return "text-green-600";
  if (fatigue < 60) return "text-yellow-600";
  return "text-red-500";
};

export default function Training() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: plan, isLoading: planLoading } = useGetTrainingPlan({
    query: { queryKey: getGetTrainingPlanQueryKey() }
  });
  const { data: sessions, isLoading: sessionsLoading } = useListTrainingSessions({
    query: { queryKey: getListTrainingSessionsQueryKey() }
  });
  const { data: players } = useListPlayers();
  const { data: staff } = useListStaff();

  const scheduleMutation = useScheduleTraining();
  const scheduleTeamMutation = useScheduleTeamTraining();
  const completeMutation = useCompleteTraining();

  const individualForm = useForm<IndividualFormValues>({
    resolver: zodResolver(individualSchema),
    defaultValues: {
      durationHours: "2",
      scheduledAt: new Date().toISOString().slice(0, 16),
      focus: "Individual training",
    }
  });

  const teamForm = useForm<TeamFormValues>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      durationHours: "2",
      scheduledAt: new Date().toISOString().slice(0, 16),
      focus: "Team training",
    }
  });

  const handleIndividual = (values: IndividualFormValues) => {
    scheduleMutation.mutate({
      data: {
        playerId: parseInt(values.playerId),
        type: values.type,
        focus: values.focus,
        durationHours: parseFloat(values.durationHours),
        scheduledAt: values.scheduledAt,
        coachId: values.coachId ? parseInt(values.coachId) : undefined,
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTrainingSessionsQueryKey() });
        toast({ title: "Session Scheduled", description: "Individual training session added." });
        individualForm.reset({ durationHours: "2", scheduledAt: new Date().toISOString().slice(0, 16), focus: "Individual training" });
      }
    });
  };

  const handleTeam = (values: TeamFormValues) => {
    scheduleTeamMutation.mutate({
      data: {
        type: values.type,
        focus: values.focus,
        durationHours: parseFloat(values.durationHours),
        scheduledAt: values.scheduledAt,
        coachId: values.coachId ? parseInt(values.coachId) : undefined,
      }
    }, {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getListTrainingSessionsQueryKey() });
        toast({ 
          title: "Team Training Scheduled", 
          description: `Sessions created for ${Array.isArray(result) ? result.length : 0} active players.` 
        });
        teamForm.reset({ durationHours: "2", scheduledAt: new Date().toISOString().slice(0, 16), focus: "Team training" });
      }
    });
  };

  const handleComplete = (sessionId: number) => {
    completeMutation.mutate({ id: sessionId }, {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getListTrainingSessionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTrainingPlanQueryKey() });
        const gains = Object.entries(result.statGains ?? {})
          .filter(([_, val]) => (val as number) > 0)
          .map(([stat, val]) => `+${val} ${stat.charAt(0).toUpperCase() + stat.slice(1)}`)
          .join(", ");
        toast({ 
          title: "Training Complete!", 
          description: gains ? `Stat gains: ${gains}` : "Good session — minimal gains this time.",
        });
      }
    });
  };

  const TrainingForm = ({ scope }: { scope: "individual" | "team" }) => {
    const isTeam = scope === "team";
    const form = isTeam ? teamForm : individualForm;
    const isPending = isTeam ? scheduleTeamMutation.isPending : scheduleMutation.isPending;

    return (
      <form onSubmit={form.handleSubmit(isTeam ? handleTeam as any : handleIndividual as any)} className="space-y-4">
        {!isTeam && (
          <FormField control={(individualForm as any).control} name="playerId" render={({ field }: any) => (
            <FormItem>
              <FormLabel>Player</FormLabel>
              <Select onValueChange={field.onChange} value={field.value?.toString()}>
                <FormControl><SelectTrigger data-testid="select-player"><SelectValue placeholder="Select Player" /></SelectTrigger></FormControl>
                <SelectContent>
                  {players?.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      <div className="flex items-center gap-2">
                        <span>{p.name}</span>
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
              <Users className="h-4 w-4" />
              Team Training
            </div>
            <p className="text-muted-foreground text-xs mt-1">
              Creates training sessions for all currently active players simultaneously.
            </p>
          </div>
        )}

        <FormField control={(form as any).control} name="type" render={({ field }: any) => (
          <FormItem>
            <FormLabel>Training Type</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger data-testid="select-type"><SelectValue placeholder="Select Type" /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="strength">💪 Strength — Improves Power</SelectItem>
                <SelectItem value="agility">⚡ Agility — Improves Speed</SelectItem>
                <SelectItem value="serving">🎯 Serving — Improves Serve</SelectItem>
                <SelectItem value="blocking">🛡️ Blocking — Improves Block</SelectItem>
                <SelectItem value="defense">🔰 Defense — Improves Defense</SelectItem>
                <SelectItem value="teamplay">🤝 Teamplay — Improves Stamina</SelectItem>
                <SelectItem value="recovery">🌿 Recovery — Reduces Fatigue</SelectItem>
              </SelectContent>
            </Select>
          </FormItem>
        )} />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={(form as any).control} name="durationHours" render={({ field }: any) => (
            <FormItem>
              <FormLabel>Duration (Hours)</FormLabel>
              <FormControl><Input type="number" min="1" max="4" {...field} data-testid="input-duration" /></FormControl>
            </FormItem>
          )} />
          <FormField control={(form as any).control} name="coachId" render={({ field }: any) => (
            <FormItem>
              <FormLabel>Coach (Optional)</FormLabel>
              <Select onValueChange={field.onChange} value={field.value?.toString()}>
                <FormControl><SelectTrigger><SelectValue placeholder="None" /></SelectTrigger></FormControl>
                <SelectContent>
                  {staff?.map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name} ({s.role.replace(/_/g, " ")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )} />
        </div>

        <FormField control={(form as any).control} name="scheduledAt" render={({ field }: any) => (
          <FormItem>
            <FormLabel>Scheduled At</FormLabel>
            <FormControl><Input type="datetime-local" {...field} data-testid="input-scheduled-at" /></FormControl>
          </FormItem>
        )} />

        <Button type="submit" className="w-full" disabled={isPending} data-testid="button-confirm-session">
          {isPending ? "Scheduling..." : isTeam ? "Schedule for Entire Team" : "Confirm Session"}
        </Button>
      </form>
    );
  };

  if (planLoading || sessionsLoading) {
    return <div className="space-y-8"><Skeleton className="h-64 w-full" /><Skeleton className="h-96 w-full" /></div>;
  }

  const avgFatigue = (plan as any)?.averageFatigue ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Training Center</h2>
          <p className="text-muted-foreground">Optimize your athletes' performance and manage fatigue.</p>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-schedule-training">
              <Dumbbell className="h-4 w-4" /> Schedule Training
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Schedule Training</DialogTitle>
              <DialogDescription>Train individual players or the entire active roster.</DialogDescription>
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
                <Form {...individualForm}>
                  <TrainingForm scope="individual" />
                </Form>
              </TabsContent>
              <TabsContent value="team">
                <Form {...teamForm}>
                  <TrainingForm scope="team" />
                </Form>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> Training Plan</CardTitle>
            <CardDescription>Weekly Load Status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold uppercase">
                <span>Weekly Load</span>
                <Badge variant={loadColors[plan?.weeklyLoad ?? "light"] as any}>{plan?.weeklyLoad ?? "light"}</Badge>
              </div>
              <Progress value={loadValues[plan?.weeklyLoad ?? "light"]} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold uppercase">
                <span>Avg Fitness</span>
                <span>{plan?.averageFitness ?? 0}%</span>
              </div>
              <Progress value={plan?.averageFitness ?? 0} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold uppercase">
                <span>Avg Morale</span>
                <span>{plan?.averageMorale ?? 0}%</span>
              </div>
              <Progress value={plan?.averageMorale ?? 0} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold uppercase">
                <span className={cn(avgFatigue >= 60 ? "text-red-500 flex items-center gap-1" : "")}>
                  {avgFatigue >= 60 && <AlertTriangle className="h-3 w-3" />}
                  Avg Fatigue
                </span>
                <span className={cn(avgFatigue >= 80 ? "text-red-500" : avgFatigue >= 60 ? "text-yellow-500" : "text-green-600")}>
                  {avgFatigue}%
                </span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full", avgFatigue >= 80 ? "bg-red-500" : avgFatigue >= 60 ? "bg-yellow-500" : "bg-green-500")}
                  style={{ width: `${avgFatigue}%` }}
                />
              </div>
              {avgFatigue >= 60 && (
                <p className="text-[10px] text-yellow-600 font-medium">
                  Schedule recovery sessions to reduce fatigue!
                </p>
              )}
            </div>
            <div className="flex items-center justify-between text-sm border-t border-border pt-3">
              <span className="text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" /> Completed
              </span>
              <span className="font-bold">{plan?.completedThisWeek ?? 0} this week</span>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Training Sessions</CardTitle>
            <CardDescription>Active and historical sessions for all players.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sessions?.map((session) => (
                <div key={session.id} data-testid={`session-row-${session.id}`} className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={(session as any).player?.imageUrl ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {(session as any).player?.name?.[0] ?? "#"}
                        </AvatarFallback>
                      </Avatar>
                      <div className={cn("absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border border-background", typeColors[session.type] ?? "bg-primary")} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm flex items-center gap-2">
                        {(session as any).player?.name ?? `Player #${session.playerId}`}
                        <Badge variant="outline" className="text-[9px] h-4 uppercase">{session.type}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {session.durationHours}h</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(session.scheduledAt).toLocaleDateString()}</span>
                        {session.coachId && <span className="flex items-center gap-1"><User className="h-3 w-3" /> Coached</span>}
                      </div>
                    </div>
                  </div>
                  
                  {session.status === 'scheduled' ? (
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
              ))}
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
    </div>
  );
}
