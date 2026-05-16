import { 
  useGetTrainingPlan, 
  useListTrainingSessions, 
  useScheduleTraining, 
  useCompleteTraining, 
  useListStaff, 
  useListPlayers,
  getListTrainingSessionsQueryKey,
  getGetTrainingPlanQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Activity, 
  Calendar, 
  Clock, 
  User, 
  CheckCircle2, 
  Dumbbell,
  Zap,
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

const trainingSchema = z.object({
  playerId: z.string().min(1, "Select a player"),
  type: z.enum(["strength", "agility", "serving", "blocking", "defense", "teamplay", "recovery"]),
  focus: z.string().default("General training"),
  durationHours: z.string().default("2"),
  scheduledAt: z.string().min(1, "Required"),
  coachId: z.string().optional(),
});

type TrainingFormValues = z.infer<typeof trainingSchema>;

const loadColors: Record<string, string> = {
  light: "secondary",
  moderate: "secondary",
  intense: "destructive",
  peak: "destructive",
};

const loadValues: Record<string, number> = {
  light: 25,
  moderate: 50,
  intense: 75,
  peak: 95,
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
  const completeMutation = useCompleteTraining();

  const form = useForm<TrainingFormValues>({
    resolver: zodResolver(trainingSchema),
    defaultValues: {
      durationHours: "2",
      scheduledAt: new Date().toISOString().slice(0, 16),
      focus: "General training",
    }
  });

  const handleSchedule = (values: TrainingFormValues) => {
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
        toast({ title: "Session Scheduled", description: "Training session has been added to the calendar." });
        form.reset({ durationHours: "2", scheduledAt: new Date().toISOString().slice(0, 16), focus: "General training" });
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

  if (planLoading || sessionsLoading) {
    return <div className="space-y-8"><Skeleton className="h-64 w-full" /><Skeleton className="h-96 w-full" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Training Center</h2>
          <p className="text-muted-foreground">Optimize your athletes' performance and recovery.</p>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-schedule-training">
              <Dumbbell className="h-4 w-4" /> Schedule Session
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule Training Session</DialogTitle>
              <DialogDescription>Assign a player and a coach to a specific drill.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSchedule)} className="space-y-4">
                <FormField control={form.control} name="playerId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Player</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value?.toString()}>
                      <FormControl><SelectTrigger data-testid="select-player"><SelectValue placeholder="Select Player" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {players?.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name} ({p.position})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Training Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-type"><SelectValue placeholder="Select Type" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="strength">Strength</SelectItem>
                        <SelectItem value="agility">Agility</SelectItem>
                        <SelectItem value="serving">Serving</SelectItem>
                        <SelectItem value="blocking">Blocking</SelectItem>
                        <SelectItem value="defense">Defense</SelectItem>
                        <SelectItem value="teamplay">Teamplay</SelectItem>
                        <SelectItem value="recovery">Recovery</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="durationHours" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (Hours)</FormLabel>
                      <FormControl><Input type="number" min="1" max="4" {...field} data-testid="input-duration" /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="coachId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Coach (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value?.toString()}>
                        <FormControl><SelectTrigger><SelectValue placeholder="None" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {staff?.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="scheduledAt" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scheduled At</FormLabel>
                    <FormControl><Input type="datetime-local" {...field} data-testid="input-scheduled-at" /></FormControl>
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={scheduleMutation.isPending} data-testid="button-confirm-session">
                  {scheduleMutation.isPending ? "Scheduling..." : "Confirm Session"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> Training Plan</CardTitle>
            <CardDescription>Weekly Load Status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" /> Completed This Week
              </span>
              <span className="font-bold">{plan?.completedThisWeek ?? 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Training Sessions</CardTitle>
            <CardDescription>Active and historical sessions.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sessions?.map((session) => (
                <div key={session.id} data-testid={`session-row-${session.id}`} className="flex items-center justify-between p-4 rounded-xl border border-border hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-bold flex items-center gap-2">
                        {session.player?.name ?? `Player #${session.playerId}`}
                        <Badge variant="outline" className="text-[10px] h-4">{session.type}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {session.durationHours}h</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(session.scheduledAt).toLocaleDateString()}</span>
                        {session.coachId && <span className="flex items-center gap-1"><User className="h-3 w-3" /> Coach assigned</span>}
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
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Complete
                    </Button>
                  ) : (
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20">COMPLETED</Badge>
                  )}
                </div>
              ))}
              {(!sessions || sessions.length === 0) && (
                <div className="text-center text-muted-foreground py-12">
                  <Dumbbell className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>No sessions scheduled yet. Start training your players!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
