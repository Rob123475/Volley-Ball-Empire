import { 
  useListMatches, 
  useScheduleMatch, 
  useSimulateMatch, 
  useUpdateMatchLineup, 
  useListLocations, 
  useListUpcomingMatches,
  useGetTeamRoster,
  getListMatchesQueryKey,
  getListUpcomingMatchesQueryKey,
  getGetDashboardQueryKey,
  getGetMyTeamQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Calendar, MapPin, Loader2, Play, Users, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const weatherIcons: Record<string, string> = {
  sunny: "☀️", windy: "💨", stormy: "⛈️", hot: "🔥", 
  cloudy: "☁️", overcast: "⛅", perfect: "✨",
};

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ");
}

export default function Matches() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [scheduleForm, setScheduleForm] = useState({ locationId: "", teamSize: "2", prizeAmount: "5000" });

  const { data: upcoming, isLoading: upcomingLoading } = useListUpcomingMatches({
    query: { queryKey: getListUpcomingMatchesQueryKey() }
  });
  const { data: results, isLoading: resultsLoading } = useListMatches({
    query: { queryKey: getListMatchesQueryKey() }
  });
  const { data: locations } = useListLocations();
  const { data: roster } = useGetTeamRoster();

  const scheduleMutation = useScheduleMatch();
  const simulateMutation = useSimulateMatch();
  const lineupMutation = useUpdateMatchLineup();

  const handleSchedule = () => {
    if (!scheduleForm.locationId) {
      toast({ title: "Select a location", variant: "destructive" });
      return;
    }
    const now = new Date();
    now.setDate(now.getDate() + 7);
    scheduleMutation.mutate({ 
      data: { 
        locationId: parseInt(scheduleForm.locationId),
        teamSize: parseInt(scheduleForm.teamSize),
        prizeAmount: parseInt(scheduleForm.prizeAmount),
        awayTeamId: 999,
        season: 1,
        round: 1,
        scheduledAt: now.toISOString(),
      } 
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUpcomingMatchesQueryKey() });
        toast({ title: "Match Scheduled!" });
        setScheduleForm({ locationId: "", teamSize: "2", prizeAmount: "5000" });
      }
    });
  };

  const handleSimulate = (matchId: number, playerIds: number[]) => {
    if (playerIds.length === 0) {
      toast({ title: "Error", description: "Select at least one player.", variant: "destructive" });
      return;
    }
    lineupMutation.mutate({ id: matchId, data: { playerIds } }, {
      onSuccess: () => {
        simulateMutation.mutate({ id: matchId }, {
          onSuccess: (res) => {
            setSimulationResult(res);
            queryClient.invalidateQueries({ queryKey: getListUpcomingMatchesQueryKey() });
            queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetMyTeamQueryKey() });
          }
        });
      }
    });
  };

  const activePlayers = roster?.activePlayers ?? [];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Match Center</h2>
          <p className="text-muted-foreground">Schedule and compete in world-class tournaments.</p>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-schedule-match">
              <Calendar className="h-4 w-4" /> Schedule Match
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Match Schedule</DialogTitle>
              <DialogDescription>Choose where and how your team will compete.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Location</Label>
                <Select value={scheduleForm.locationId} onValueChange={(v) => setScheduleForm(f => ({ ...f, locationId: v }))}>
                  <SelectTrigger data-testid="select-match-location"><SelectValue placeholder="Select Location" /></SelectTrigger>
                  <SelectContent>
                    {locations?.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.city}, {l.country}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Team Size</Label>
                <Select value={scheduleForm.teamSize} onValueChange={(v) => setScheduleForm(f => ({ ...f, teamSize: v }))}>
                  <SelectTrigger data-testid="select-team-size"><SelectValue placeholder="Select Size" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 vs 2</SelectItem>
                    <SelectItem value="3">3 vs 3</SelectItem>
                    <SelectItem value="4">4 vs 4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prize Amount ($)</Label>
                <Input 
                  type="number" 
                  value={scheduleForm.prizeAmount}
                  onChange={(e) => setScheduleForm(f => ({ ...f, prizeAmount: e.target.value }))}
                  data-testid="input-prize-amount"
                />
              </div>
              <Button className="w-full" onClick={handleSchedule} disabled={scheduleMutation.isPending} data-testid="button-confirm-schedule">
                {scheduleMutation.isPending ? "Scheduling..." : "Confirm Schedule"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>
        
        <TabsContent value="upcoming" className="mt-6 space-y-4">
          {upcomingLoading ? <Skeleton className="h-48 w-full" /> : 
            upcoming?.map(match => (
              <MatchCard 
                key={match.id} 
                match={match} 
                onSimulate={(ids) => handleSimulate(match.id, ids)} 
                isSimulating={simulateMutation.isPending || lineupMutation.isPending}
                activePlayers={activePlayers}
              />
            ))
          }
          {!upcomingLoading && (!upcoming || upcoming.length === 0) && (
            <div className="text-center text-muted-foreground py-12">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No upcoming matches. Schedule your next tournament!</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="results" className="mt-6 space-y-4">
          {resultsLoading ? <Skeleton className="h-48 w-full" /> : 
            results?.filter(m => m.status === 'completed').map(match => {
              const homeScore = match.homeScore ?? 0;
              const awayScore = match.awayScore ?? 0;
              const isWin = homeScore > awayScore;
              return (
                <Card key={match.id} data-testid={`card-result-${match.id}`} className="overflow-hidden">
                  <div className="flex items-center justify-between p-6">
                    <div className="flex items-center gap-4">
                      <div className="text-4xl">{weatherIcons[match.weather] || "☀️"}</div>
                      <div>
                        <div className="font-bold text-lg">{match.locationName ?? "Beach"}</div>
                        <div className="text-sm text-muted-foreground">vs Opponent #{match.awayTeamId}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-2xl font-black">{homeScore} – {awayScore}</div>
                      <Badge className={isWin ? 'bg-green-500' : 'bg-red-500'}>
                        {isWin ? 'WIN' : 'LOSS'}
                      </Badge>
                    </div>
                  </div>
                </Card>
              );
            })
          }
          {!resultsLoading && (!results || results.filter(m => m.status === 'completed').length === 0) && (
            <div className="text-center text-muted-foreground py-12">
              <Trophy className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No completed matches yet.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {simulationResult && (
        <Dialog open={!!simulationResult} onOpenChange={() => setSimulationResult(null)}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-3xl font-black text-center mb-4">MATCH RESULT</DialogTitle>
            </DialogHeader>
            <div className="space-y-8 py-4">
              <div className="flex items-center justify-center gap-12">
                <div className="text-center">
                  <div className="text-4xl font-bold mb-2">HOME</div>
                  <div className="text-6xl font-black text-primary">{simulationResult.homeScore}</div>
                </div>
                <div className="text-4xl font-black text-muted-foreground">VS</div>
                <div className="text-center">
                  <div className="text-4xl font-bold mb-2">AWAY</div>
                  <div className="text-6xl font-black text-secondary">{simulationResult.awayScore}</div>
                </div>
              </div>

              <div className="bg-primary/5 rounded-xl p-6 border border-primary/10">
                <h4 className="font-bold mb-4 flex items-center gap-2 text-primary">
                  <CheckCircle2 className="h-5 w-5" /> MATCH HIGHLIGHTS
                </h4>
                <ul className="space-y-2">
                  {simulationResult.highlights?.map((h: string, i: number) => (
                    <li key={i} className="text-sm flex gap-3">
                      <span className="text-primary font-bold">»</span> {h}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {simulationResult.mvp && (
                  <Card className="border-secondary/30 bg-secondary/5">
                    <CardHeader className="p-4 pb-0"><CardTitle className="text-sm uppercase text-secondary">MVP</CardTitle></CardHeader>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-bold">#</div>
                      <div>
                        <div className="font-bold">{simulationResult.mvp.name}</div>
                        <div className="text-xs text-muted-foreground">Game-changing performance</div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                <Card className="border-green-500/30 bg-green-500/5">
                  <CardHeader className="p-4 pb-0"><CardTitle className="text-sm uppercase text-green-600">Prize Earned</CardTitle></CardHeader>
                  <CardContent className="p-4">
                    <div className="text-2xl font-black text-green-600">${(simulationResult.prizeEarned || 0).toLocaleString()}</div>
                  </CardContent>
                </Card>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setSimulationResult(null)} className="w-full">Return to Office</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function MatchCard({ match, onSimulate, isSimulating, activePlayers }: { match: any, onSimulate: (ids: number[]) => void, isSimulating: boolean, activePlayers: any[] }) {
  const [selected, setSelected] = useState<number[]>([]);

  return (
    <Card data-testid={`card-match-${match.id}`} className="overflow-hidden hover-elevate group">
      <div className="flex flex-col md:flex-row">
        <div className="p-6 flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{weatherIcons[match.weather]}</span>
              <div>
                <Badge variant="outline" className="mb-1 text-xs uppercase tracking-tighter">{match.weather}</Badge>
                <div className="text-xl font-bold flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" /> {match.locationName ?? "TBD"}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground font-medium uppercase tracking-widest">Prize Pool</div>
              <div className="text-2xl font-black text-green-600">${(match.prizeAmount || 0).toLocaleString()}</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-bold flex items-center gap-2"><Users className="h-4 w-4" /> Select Lineup ({selected.length}/{match.teamSize})</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {activePlayers.map((p: any) => (
                <div 
                  key={p.id} 
                  data-testid={`player-select-${p.id}`}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer",
                    selected.includes(p.id) ? "bg-primary/10 border-primary" : "hover:bg-muted"
                  )}
                  onClick={() => {
                    if (selected.includes(p.id)) setSelected(selected.filter(id => id !== p.id));
                    else if (selected.length < match.teamSize) setSelected([...selected, p.id]);
                  }}
                >
                  <Checkbox checked={selected.includes(p.id)} />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-primary">{p.position}</span>
                    <span className="text-xs font-medium truncate w-20">{p.name}</span>
                  </div>
                </div>
              ))}
              {activePlayers.length === 0 && (
                <p className="col-span-4 text-xs text-muted-foreground">No active players on roster.</p>
              )}
            </div>
          </div>
        </div>
        <div className="bg-muted/30 p-6 flex items-center justify-center border-l">
          <Button 
            size="lg" 
            className="h-16 px-12 gap-3 text-lg font-black shadow-lg" 
            disabled={selected.length !== match.teamSize || isSimulating}
            onClick={() => onSimulate(selected)}
            data-testid={`button-simulate-${match.id}`}
          >
            {isSimulating ? <Loader2 className="h-6 w-6 animate-spin" /> : <><Play className="h-6 w-6 fill-current" /> SIMULATE!</>}
          </Button>
        </div>
      </div>
    </Card>
  );
}
