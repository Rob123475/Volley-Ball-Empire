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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy, Calendar, MapPin, Loader2, Play, Users, CheckCircle2,
  Lock, Star, Swords, Flag
} from "lucide-react";
import { PlayerStatusBadge } from "@/components/player-status-badge";
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

const tierColors: Record<string, string> = {
  Bronze: "text-amber-700  border-amber-400  bg-amber-50  dark:text-amber-400  dark:border-amber-700  dark:bg-amber-950/30",
  Silver: "text-slate-600  border-slate-400  bg-slate-50  dark:text-slate-300  dark:border-slate-600  dark:bg-slate-900/30",
  Gold:   "text-yellow-600 border-yellow-400 bg-yellow-50 dark:text-yellow-400 dark:border-yellow-600 dark:bg-yellow-950/30",
  Elite:  "text-purple-700 border-purple-400 bg-purple-50 dark:text-purple-400 dark:border-purple-700 dark:bg-purple-950/30",
};

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ");
}

function formatCurrency(val: number) {
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
  return `$${val}`;
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

  const { data: fixture, isLoading: fixtureLoading, refetch: refetchFixture } = useQuery({
    queryKey: ["matches", "fixture"],
    queryFn: async () => {
      const res = await fetch("/api/matches/fixture");
      if (!res.ok) throw new Error("Failed to fetch fixture");
      return res.json() as Promise<any[]>;
    },
  });

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
            refetchFixture();
          }
        });
      }
    });
  };

  const activePlayers = roster?.activePlayers ?? [];

  // First scheduled fixture match is the "next to play"
  const nextFixtureMatchId = fixture?.find(m => m.status === "scheduled")?.id ?? null;

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

      <Tabs defaultValue="fixture" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-[480px]">
          <TabsTrigger value="fixture">📅 Season Fixture</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        {/* ── FIXTURE TAB ── */}
        <TabsContent value="fixture" className="mt-6">
          {fixtureLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Season banner */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-primary/10 via-secondary/5 to-transparent border border-primary/20 mb-6">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-primary/60">2026 World Tour</div>
                  <div className="text-xl font-black">Beach Volley World Tour</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">
                    {fixture?.filter(m => m.status === "completed").length ?? 0} / {fixture?.length ?? 17} played
                  </div>
                  <div className="text-sm font-bold text-primary">
                    {fixture?.filter(m => m.status === "completed" && (m.homeScore ?? 0) > (m.awayScore ?? 0)).length ?? 0}W –{" "}
                    {fixture?.filter(m => m.status === "completed" && (m.homeScore ?? 0) <= (m.awayScore ?? 0)).length ?? 0}L
                  </div>
                </div>
              </div>

              {fixture?.map((match) => {
                const isFinal = match.tier === "Grand Final" || match.round === 61;
                const isCompleted = match.status === "completed";
                const isNext = match.id === nextFixtureMatchId && !isFinal;
                const isNextFinal = match.id === nextFixtureMatchId && isFinal;
                const homeWon = (match.homeScore ?? 0) > (match.awayScore ?? 0);

                if (isFinal) {
                  return (
                    <FinalCard
                      key={match.id}
                      match={match}
                      isCompleted={isCompleted}
                      isPlayable={!!isNextFinal}
                      homeWon={homeWon}
                      onSimulate={(ids) => handleSimulate(match.id, ids)}
                      isSimulating={simulateMutation.isPending || lineupMutation.isPending}
                      activePlayers={activePlayers}
                    />
                  );
                }

                return (
                  <FixtureRoundCard
                    key={match.id}
                    match={match}
                    isCompleted={isCompleted}
                    isNext={isNext}
                    homeWon={homeWon}
                    onSimulate={(ids) => handleSimulate(match.id, ids)}
                    isSimulating={simulateMutation.isPending || lineupMutation.isPending}
                    activePlayers={activePlayers}
                  />
                );
              })}

              {(!fixture || fixture.length === 0) && (
                <div className="text-center text-muted-foreground py-12">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Generating your season fixture…</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── UPCOMING TAB ── */}
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

        {/* ── RESULTS TAB ── */}
        <TabsContent value="results" className="mt-6 space-y-4">
          {resultsLoading ? <Skeleton className="h-48 w-full" /> :
            results?.filter(m => m.status === "completed").map(match => {
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
                        <div className="text-sm text-muted-foreground">vs {match.awayTeamName ?? `Opponent #${match.awayTeamId}`}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-2xl font-black">{homeScore} – {awayScore}</div>
                      <Badge className={isWin ? "bg-green-500" : "bg-red-500"}>
                        {isWin ? "WIN" : "LOSS"}
                      </Badge>
                    </div>
                  </div>
                </Card>
              );
            })
          }
          {!resultsLoading && (!results || results.filter(m => m.status === "completed").length === 0) && (
            <div className="text-center text-muted-foreground py-12">
              <Trophy className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No completed matches yet.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Simulation result dialog */}
      {simulationResult && (
        <Dialog open={!!simulationResult} onOpenChange={() => setSimulationResult(null)}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-3xl font-black text-center mb-4">
                {simulationResult.isFinal ? "🏆 GRAND FINAL RESULT" : "MATCH RESULT"}
              </DialogTitle>
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

// ── Regular fixture round card ──
function FixtureRoundCard({ match, isCompleted, isNext, homeWon, onSimulate, isSimulating, activePlayers }: {
  match: any; isCompleted: boolean; isNext: boolean; homeWon: boolean;
  onSimulate: (ids: number[]) => void; isSimulating: boolean; activePlayers: any[];
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [expanded, setExpanded] = useState(false);
  const date = match.scheduledAt ? new Date(match.scheduledAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "TBD";

  return (
    <div className={cn(
      "rounded-xl border transition-all",
      isCompleted && homeWon ? "border-green-500/30 bg-green-500/5" :
      isCompleted && !homeWon ? "border-red-500/30 bg-red-500/5" :
      isNext ? "border-primary shadow-md shadow-primary/10" :
      "border-border bg-card opacity-80"
    )}>
      <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => isNext && setExpanded(e => !e)}>
        {/* Round badge */}
        <div className={cn(
          "flex-shrink-0 h-12 w-12 rounded-full flex flex-col items-center justify-center text-xs font-black",
          isCompleted && homeWon ? "bg-green-500 text-white" :
          isCompleted && !homeWon ? "bg-red-500 text-white" :
          isNext ? "bg-primary text-primary-foreground" :
          "bg-muted text-muted-foreground"
        )}>
          <span className="text-[9px] leading-none">RND</span>
          <span className="text-base leading-tight">{match.round}</span>
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">{date}</span>
            <span className="text-xs">{weatherIcons[match.weather] ?? "☀️"}</span>
            {match.continent && (
              <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide">{match.continent}</span>
            )}
          </div>
          <div className="font-bold truncate">{match.locationName ?? "TBD"}</div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Swords className="h-3 w-3" /> vs <span className="font-medium">{match.awayTeamName ?? "Opponent"}</span>
            </div>
            {match.tier && (
              <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 font-bold border", tierColors[match.tier as keyof typeof tierColors] ?? "")}>
                {match.tier}
              </Badge>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex-shrink-0 text-right space-y-1">
          <div className="text-sm font-black text-green-600">{formatCurrency(match.prizeAmount ?? 0)}</div>
          {isCompleted ? (
            <div className="flex items-center gap-1 justify-end">
              <span className="text-lg font-black">{match.homeScore} – {match.awayScore}</span>
              <Badge className={cn("text-[10px]", homeWon ? "bg-green-500" : "bg-red-500")}>{homeWon ? "W" : "L"}</Badge>
            </div>
          ) : isNext ? (
            <Badge className="bg-primary text-primary-foreground animate-pulse text-[10px]">PLAY NOW</Badge>
          ) : (
            <div className="flex items-center gap-1 justify-end text-muted-foreground">
              <Lock className="h-3 w-3" /><span className="text-xs">Upcoming</span>
            </div>
          )}
        </div>
      </div>

      {/* Expandable lineup for next match */}
      {isNext && expanded && (
        <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-3">
          <div className="text-sm font-bold flex items-center gap-2">
            <Users className="h-4 w-4" /> Select Lineup ({selected.length}/{match.teamSize ?? 2})
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {activePlayers.map((p: any) => (
              <div
                key={p.id}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer",
                  selected.includes(p.id) ? "bg-primary/10 border-primary" : "hover:bg-muted"
                )}
                onClick={() => {
                  if (selected.includes(p.id)) setSelected(selected.filter(id => id !== p.id));
                  else if (selected.length < (match.teamSize ?? 2)) setSelected([...selected, p.id]);
                }}
              >
                <Checkbox checked={selected.includes(p.id)} />
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium truncate w-20">{p.name}</span>
                  <PlayerStatusBadge player={p} size="xs" />
                </div>
              </div>
            ))}
          </div>
          <Button
            className="w-full gap-2"
            disabled={selected.length !== (match.teamSize ?? 2) || isSimulating}
            onClick={() => onSimulate(selected)}
            data-testid={`button-simulate-${match.id}`}
          >
            {isSimulating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Play className="h-4 w-4 fill-current" /> Simulate Round {match.round}</>}
          </Button>
        </div>
      )}
      {isNext && !expanded && (
        <div className="px-4 pb-3 text-xs text-primary cursor-pointer hover:underline" onClick={() => setExpanded(true)}>
          ▸ Click to select lineup & play
        </div>
      )}
    </div>
  );
}

// ── Grand Final card ──
function FinalCard({ match, isCompleted, isPlayable, homeWon, onSimulate, isSimulating, activePlayers }: {
  match: any; isCompleted: boolean; isPlayable: boolean; homeWon: boolean;
  onSimulate: (ids: number[]) => void; isSimulating: boolean; activePlayers: any[];
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [expanded, setExpanded] = useState(false);
  const date = match.scheduledAt ? new Date(match.scheduledAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "10 Dec 2026";
  const year = match.scheduledAt ? new Date(match.scheduledAt).getFullYear() : 2026;
  const locationParts = (match.locationName ?? "Copacabana Beach • Brazil").split(" • ");
  const hostBeach = locationParts[0] ?? "Copacabana Beach";
  const hostCountry = locationParts[1] ?? "Brazil";

  return (
    <div className={cn(
      "rounded-2xl border-2 overflow-hidden mt-6 transition-all",
      isCompleted && homeWon ? "border-yellow-500 shadow-lg shadow-yellow-500/20" :
      isCompleted && !homeWon ? "border-red-500/50" :
      isPlayable ? "border-yellow-500 shadow-xl shadow-yellow-500/30 animate-pulse" :
      "border-yellow-500/30 opacity-60"
    )}>
      {/* Header banner */}
      <div className="bg-gradient-to-r from-yellow-500 via-yellow-400 to-amber-500 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="h-8 w-8 text-yellow-900" />
          <div>
            <div className="text-xs font-bold text-yellow-900/70 uppercase tracking-widest">World Beach Pro Series Grand Final</div>
            <div className="text-xl font-black text-yellow-900">{year}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-yellow-900">{formatCurrency(match.prizeAmount ?? 500000)}</div>
          <div className="text-xs text-yellow-900/70">Championship Prize</div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 bg-gradient-to-b from-yellow-500/5 to-transparent">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">{date} • {weatherIcons[match.weather] ?? "☀️"}</div>
            <div className="font-bold flex items-center gap-1">
              <Flag className="h-4 w-4 text-yellow-500" /> {hostBeach}
            </div>
            <div className="text-sm text-muted-foreground">{hostCountry}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Swords className="h-3.5 w-3.5" /> vs <span className="font-bold text-foreground ml-1">{match.awayTeamName ?? "World All-Stars"}</span>
            </div>
          </div>
          <div className="text-right">
            {isCompleted ? (
              <div className="space-y-1">
                <div className="text-3xl font-black">{match.homeScore} – {match.awayScore}</div>
                <Badge className={cn("text-sm px-3", homeWon ? "bg-yellow-500 text-yellow-900" : "bg-red-500")}>
                  {homeWon ? "🏆 CHAMPIONS!" : "RUNNER UP"}
                </Badge>
              </div>
            ) : isPlayable ? (
              <Badge className="bg-yellow-500 text-yellow-900 text-sm px-3 animate-pulse">READY TO PLAY</Badge>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Lock className="h-4 w-4" /> <span className="text-sm">Locked until qualification</span>
              </div>
            )}
          </div>
        </div>

        {/* Lineup for final */}
        {isPlayable && (
          <div className="mt-4 space-y-3 border-t border-yellow-500/20 pt-3">
            <div className="text-sm font-bold flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" /> Select Championship Lineup ({selected.length}/{match.teamSize ?? 2})
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {activePlayers.map((p: any) => (
                <div
                  key={p.id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer",
                    selected.includes(p.id) ? "bg-yellow-500/20 border-yellow-500" : "hover:bg-muted"
                  )}
                  onClick={() => {
                    if (selected.includes(p.id)) setSelected(selected.filter(id => id !== p.id));
                    else if (selected.length < (match.teamSize ?? 2)) setSelected([...selected, p.id]);
                  }}
                >
                  <Checkbox checked={selected.includes(p.id)} />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium truncate w-20">{p.name}</span>
                    <PlayerStatusBadge player={p} size="xs" />
                  </div>
                </div>
              ))}
            </div>
            <Button
              className="w-full gap-2 bg-yellow-500 hover:bg-yellow-600 text-yellow-900 font-black text-base h-12"
              disabled={selected.length !== (match.teamSize ?? 2) || isSimulating}
              onClick={() => onSimulate(selected)}
              data-testid={`button-simulate-${match.id}`}
            >
              {isSimulating
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : <><Trophy className="h-5 w-5" /> PLAY THE FINAL</>}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Generic match card (used in Upcoming tab) ──
function MatchCard({ match, onSimulate, isSimulating, activePlayers }: {
  match: any; onSimulate: (ids: number[]) => void; isSimulating: boolean; activePlayers: any[];
}) {
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
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium truncate w-20">{p.name}</span>
                    <PlayerStatusBadge player={p} size="xs" />
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
