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
  getGetMyTeamQueryKey,
  getGetSponsorProgressQueryKey,
  useGetCurrentSeason,
  getGetCurrentSeasonQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy, Calendar, MapPin, Loader2, Play, Users, CheckCircle2,
  Lock, Star, Swords, Flag, AlertOctagon
} from "lucide-react";
import { PlayerStatusBadge } from "@/components/player-status-badge";
import { MatchActionButtons } from "@/components/match/MatchActionButtons";
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
  sunny:        "☀️",
  clear:        "🌤️",
  windy:        "💨",
  stormy:       "⛈️",
  rain:         "🌧️",
  hot:          "🔥",
  extreme_heat: "🌡️",
  cloudy:       "☁️",
  overcast:     "⛅",
  perfect:      "✨",
};

const weatherSeverity: Record<string, { label: string; cls: string }> = {
  perfect:      { label: "Perfect",      cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  clear:        { label: "Clear",        cls: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  sunny:        { label: "Sunny",        cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  cloudy:       { label: "Cloudy",       cls: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
  overcast:     { label: "Overcast",     cls: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
  hot:          { label: "Hot",          cls: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  windy:        { label: "Windy",        cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  rain:         { label: "Rain",         cls: "bg-blue-600/15 text-blue-300 border-blue-600/30" },
  stormy:       { label: "Storm",        cls: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  extreme_heat: { label: "Extreme Heat", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
};

const tierColors: Record<string, string> = {
  Bronze:             "text-amber-700  border-amber-400  bg-amber-50  dark:text-amber-400  dark:border-amber-700  dark:bg-amber-950/30",
  Silver:             "text-slate-600  border-slate-400  bg-slate-50  dark:text-slate-300  dark:border-slate-600  dark:bg-slate-900/30",
  Gold:               "text-yellow-600 border-yellow-400 bg-yellow-50 dark:text-yellow-400 dark:border-yellow-600 dark:bg-yellow-950/30",
  Elite:              "text-purple-700 border-purple-400 bg-purple-50 dark:text-purple-400 dark:border-purple-700 dark:bg-purple-950/30",
  "Continental Final":"text-emerald-700 border-emerald-400 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:bg-emerald-950/30",
};

/**
 * The active season's year, for headings that used to hardcode "2026" — a
 * player in their third season saw the wrong year on the front of the game.
 */
function useSeasonLabel(): string {
  const { data } = useGetCurrentSeason({
    query: { queryKey: getGetCurrentSeasonQueryKey(), retry: false },
  });
  return data?.year != null ? String(data.year) : "";
}

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ");
}

function formatCurrency(val: number) {
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
  return `$${val}`;
}

export default function Matches() {
  const seasonLabel = useSeasonLabel();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
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
        // The server models the opponent as the player's own team plus a name
        // label and derives the season from the active season, so these are
        // placeholders it overrides rather than a real team id and season.
        awayTeamId: 0,
        season: 0,
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
            queryClient.invalidateQueries({ queryKey: getGetSponsorProgressQueryKey() });
            refetchFixture();
          }
        });
      }
    });
  };

  const [isForfeiting, setIsForfeiting] = useState(false);

  const handleForfeit = async (matchId: number) => {
    setIsForfeiting(true);
    try {
      const res = await fetch(`/api/matches/${matchId}/forfeit`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Forfeit failed", description: (err as any).error ?? "Unknown error", variant: "destructive" });
        return;
      }
      toast({ title: "Match forfeited", description: "Recorded as a 0–21 loss.", variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: getListUpcomingMatchesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetMyTeamQueryKey() });
      refetchFixture();
    } catch {
      toast({ title: "Forfeit failed", description: "Network error.", variant: "destructive" });
    } finally {
      setIsForfeiting(false);
    }
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
                  <div className="text-xs font-bold uppercase tracking-widest text-primary/60">{seasonLabel} World Tour</div>
                  <div className="text-xl font-black">Volleyball Empire World Tour</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">
                    {fixture?.filter(m => m.status === "completed").length ?? 0} / {fixture?.length ?? 73} played
                  </div>
                  <div className="text-sm font-bold text-primary">
                    {fixture?.filter(m => m.status === "completed" && (m.homeScore ?? 0) > (m.awayScore ?? 0)).length ?? 0}W –{" "}
                    {fixture?.filter(m => m.status === "completed" && (m.homeScore ?? 0) <= (m.awayScore ?? 0)).length ?? 0}L
                  </div>
                </div>
              </div>

              {(() => {
                const WORLD_FINALS_TIERS = new Set(["World Semi Final", "All-Star Match", "World Final"]);
                const regularFixture = fixture?.filter(m => !WORLD_FINALS_TIERS.has(m.tier ?? "")) ?? [];
                const finalsMatches  = fixture?.filter(m => WORLD_FINALS_TIERS.has(m.tier ?? "")) ?? [];
                // The World Finals unlock when the regular World Tour season is
                // done — the same signal the server uses to resolve the semi
                // final opponent (routes/matches.ts). This used to gate on six
                // "Continental Final" matches, a tier worldTour.ts stopped
                // producing, so the condition was permanently false and the
                // entire World Finals bracket — including the 500,000 Grand
                // Final — could never be played.
                const worldFinalsUnlocked =
                  regularFixture.length > 0 && regularFixture.every(m => m.status === "completed");

                return (
                  <>
                    {regularFixture.map((match, idx) => {
                      const prevMatch = idx > 0 ? regularFixture[idx - 1] : null;
                      const isContFinal = match.tier === "Continental Final";
                      const isCompleted = match.status === "completed";
                      const isNext = match.id === nextFixtureMatchId;
                      const homeWon = (match.homeScore ?? 0) > (match.awayScore ?? 0);

                      const showTourHeader = !prevMatch || (
                        match.continent !== prevMatch.continent && !isContFinal
                      );

                      return (
                        <div key={match.id}>
                          {showTourHeader && (
                            <div className="flex items-center gap-3 mt-6 mb-2 first:mt-0">
                              <div className="h-px flex-1 bg-border" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
                                🏖 {match.continent} Tour
                              </span>
                              <div className="h-px flex-1 bg-border" />
                            </div>
                          )}
                          {isContFinal && (
                            <div className="flex items-center gap-3 mt-4 mb-2">
                              <div className="h-px flex-1 bg-emerald-500/40" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 px-2">
                                🏆 {match.continent} Continental Final
                              </span>
                              <div className="h-px flex-1 bg-emerald-500/40" />
                            </div>
                          )}
                          <FixtureRoundCard
                            match={match}
                            isCompleted={isCompleted}
                            isNext={isNext}
                            homeWon={homeWon}
                            onSimulate={(ids) => handleSimulate(match.id, ids)}
                            isSimulating={simulateMutation.isPending || lineupMutation.isPending}
                            activePlayers={activePlayers}
                            onForfeit={handleForfeit}
                            isForfeiting={isForfeiting}
                          />
                        </div>
                      );
                    })}

                    <WorldFinalsSection
                      matches={finalsMatches}
                      nextMatchId={nextFixtureMatchId}
                      worldFinalsUnlocked={worldFinalsUnlocked}
                      onSimulate={handleSimulate}
                      isSimulating={simulateMutation.isPending || lineupMutation.isPending}
                      activePlayers={activePlayers}
                    />
                  </>
                );
              })()}

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
        <Dialog open={!!simulationResult} onOpenChange={() => {
          if (simulationResult?.fired) {
            queryClient.clear();
            navigate("/career");
          }
          setSimulationResult(null);
        }}>
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

              {/* Weather conditions strip */}
              {simulationResult.weather && (
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-muted/30 px-4 py-2.5">
                  <span className="text-2xl">{weatherIcons[simulationResult.weather] ?? "☀️"}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold capitalize">{simulationResult.locationName ?? "Match"}</span>
                      {weatherSeverity[simulationResult.weather] && (
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${weatherSeverity[simulationResult.weather].cls}`}>
                          {weatherSeverity[simulationResult.weather].label}
                        </span>
                      )}
                    </div>
                    {(simulationResult.windSpeed || simulationResult.temperature) && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {simulationResult.temperature && `${simulationResult.temperature}°C`}
                        {simulationResult.temperature && simulationResult.windSpeed && " · "}
                        {simulationResult.windSpeed && `Wind ${simulationResult.windSpeed} km/h`}
                      </div>
                    )}
                  </div>
                </div>
              )}

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

              {/* ── Dismissal notice (only when fired after Grand Final) ── */}
              {simulationResult.fired && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/8 p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center mt-0.5">
                      <AlertOctagon className="h-5 w-5 text-rose-400" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-rose-300 uppercase tracking-wide">
                        You have been dismissed
                      </p>
                      <p className="text-sm text-rose-300/70 mt-1 leading-relaxed">
                        Following the end-of-season board review,{" "}
                        <span className="font-bold text-rose-200">
                          {simulationResult.dismissalClubName ?? "the club"}
                        </span>{" "}
                        has decided to terminate your contract. Board confidence fell below the minimum threshold.
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-rose-500/15 bg-rose-500/5 px-4 py-3 text-xs text-rose-300/60 leading-relaxed">
                    Your career history has been updated. The club and your squad remain intact.
                    You are now unemployed — return to your career saves to start fresh or wait for the Job Market.
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              {simulationResult.fired ? (
                <Button
                  onClick={() => {
                    queryClient.clear();
                    setSimulationResult(null);
                    navigate("/career");
                  }}
                  className="w-full bg-rose-600 hover:bg-rose-500 text-white border border-rose-500"
                >
                  Return to Career Saves
                </Button>
              ) : (
                <Button onClick={() => setSimulationResult(null)} className="w-full">Return to Office</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ── Regular fixture round card ──
function FixtureRoundCard({ match, isCompleted, isNext, homeWon, onSimulate, isSimulating, activePlayers, onForfeit, isForfeiting }: {
  match: any; isCompleted: boolean; isNext: boolean; homeWon: boolean;
  onSimulate: (ids: number[]) => void; isSimulating: boolean; activePlayers: any[];
  onForfeit: (matchId: number) => void; isForfeiting: boolean;
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
          <div className="grid grid-cols-3 gap-2">
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
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-xs font-medium truncate">{p.name}</span>
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
        <div className="px-4 pb-3">
          <MatchActionButtons
            activePlayers={activePlayers}
            teamSize={match.teamSize ?? 2}
            matchId={match.id}
            matchLabel={`Round ${match.round} vs ${match.awayTeamName ?? "Opponent"}`}
            onSimulate={onSimulate}
            isSimulating={isSimulating}
            onWatchMatch={() => setExpanded(true)}
            onForfeit={onForfeit}
            isForfeiting={isForfeiting}
          />
        </div>
      )}
    </div>
  );
}

// ── World Finals Section ──────────────────────────────────────────────────────
function WorldFinalsSection({ matches, nextMatchId, worldFinalsUnlocked, onSimulate, isSimulating, activePlayers }: {
  matches: any[];
  nextMatchId: number | null;
  worldFinalsUnlocked: boolean;
  onSimulate: (matchId: number, ids: number[]) => void;
  isSimulating: boolean;
  activePlayers: any[];
}) {
  const seasonLabel = useSeasonLabel();
  if (matches.length === 0) return null;

  // worldTour.ts schedules exactly one semi final (slot 71) and one final
  // (slot 72). This looked for two semis at rounds 73/74 and an "All-Star
  // Match" — all leftovers from an older bracket design that the schedule no
  // longer produces, so none of these cards ever rendered.
  const semiFinal  = matches.find(m => m.tier === "World Semi Final");
  const worldFinal = matches.find(m => m.tier === "World Final");

  const semiDone   = semiFinal?.status === "completed";
  const semiWinner = semiDone
    ? ((semiFinal.homeScore ?? 0) > (semiFinal.awayScore ?? 0) ? semiFinal.homeTeamName : semiFinal.awayTeamName)
    : null;

  return (
    <div className="mt-8 space-y-3">
      {/* World Finals header */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-yellow-500/40" />
        <span className="text-[10px] font-black uppercase tracking-widest text-yellow-600 dark:text-yellow-400 px-2">
          🏆 World Beach Pro Series Finals — {seasonLabel}
        </span>
        <div className="h-px flex-1 bg-yellow-500/40" />
      </div>

      {/* Lock notice */}
      {!worldFinalsUnlocked && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-center gap-3">
          <Lock className="h-4 w-4 shrink-0 text-yellow-500/70" />
          <span className="text-sm text-muted-foreground">
            Complete your World Tour season to unlock the Finals and reveal your semi final opponent.
          </span>
        </div>
      )}

      {/* Semi Final */}
      {semiFinal && (
        <WorldFinalsMatchCard
          label="World Semi Final"
          subtitle="Top 4 seeds · winner advances to the Grand Final"
          match={semiFinal}
          locked={!worldFinalsUnlocked}
          isPlayable={worldFinalsUnlocked && semiFinal.id === nextMatchId}
          onSimulate={onSimulate}
          isSimulating={isSimulating}
          activePlayers={activePlayers}
        />
      )}

      {/* World Championship Final */}
      {worldFinal && (
        <>
          <div className="flex items-center gap-3 pt-2">
            <div className="h-px flex-1 bg-yellow-500/60" />
            <span className="text-[10px] font-black uppercase tracking-widest text-yellow-500 px-2">
              ⚡ Championship Final
            </span>
            <div className="h-px flex-1 bg-yellow-500/60" />
          </div>
          <WorldFinalsMatchCard
            label="World Championship Final"
            subtitle={semiWinner ? `${semiWinner} contests the title` : "Semi Final winner"}
            match={worldFinal}
            locked={!semiDone}
            isPlayable={semiDone && worldFinal.id === nextMatchId}
            onSimulate={onSimulate}
            isSimulating={isSimulating}
            activePlayers={activePlayers}
            isFinalMatch
          />
        </>
      )}
    </div>
  );
}

// ── Individual World Finals match card ────────────────────────────────────────
function WorldFinalsMatchCard({ label, subtitle, match, locked, isPlayable, onSimulate, isSimulating, activePlayers, isAutoMatch, isExhibition, isFinalMatch }: {
  label: string; subtitle: string; match: any; locked: boolean; isPlayable: boolean;
  onSimulate: (matchId: number, ids: number[]) => void; isSimulating: boolean; activePlayers: any[];
  isAutoMatch?: boolean; isExhibition?: boolean; isFinalMatch?: boolean;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [lineupOpen, setLineupOpen] = useState(false);

  const isCompleted = match.status === "completed";
  const homeWon = (match.homeScore ?? 0) > (match.awayScore ?? 0);
  const date = match.scheduledAt
    ? new Date(match.scheduledAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "";
  const locationParts = (match.locationName ?? "Copacabana Beach • Brazil").split(" • ");
  const hostBeach   = locationParts[0] ?? "Copacabana Beach";
  const hostCountry = locationParts[1] ?? "Brazil";

  const awayDisplay = locked ? "TBD" : (match.awayTeamName === "TBD" ? "TBD" : (match.awayTeamName ?? "TBD"));

  const autoSimulate = () => {
    const ids = activePlayers.slice(0, match.teamSize ?? 2).map((p: any) => p.id);
    if (ids.length === 0) return;
    onSimulate(match.id, ids);
  };

  return (
    <div className={cn(
      "rounded-xl border-2 overflow-hidden transition-all",
      isCompleted && homeWon  ? (isFinalMatch ? "border-yellow-500 shadow-lg shadow-yellow-500/20" : "border-green-500/60") :
      isCompleted && !homeWon ? "border-red-500/40" :
      isPlayable              ? "border-yellow-500 shadow-md shadow-yellow-500/20 animate-pulse" :
      locked                  ? "border-border/30 opacity-50" :
                                "border-border/60"
    )}>
      {/* Header */}
      <div className={cn(
        "px-4 py-3 flex items-center justify-between",
        isFinalMatch  ? "bg-gradient-to-r from-yellow-500 via-yellow-400 to-amber-500" :
        isExhibition  ? "bg-gradient-to-r from-blue-600/80 to-indigo-600/80" :
                        "bg-muted/40"
      )}>
        <div className="flex items-center gap-2">
          {isFinalMatch
            ? <Trophy className="h-5 w-5 text-yellow-900" />
            : isExhibition
              ? <Star className="h-5 w-5 text-white" />
              : <Swords className="h-5 w-5 text-muted-foreground" />}
          <div>
            <div className={cn("text-xs font-black uppercase tracking-widest",
              isFinalMatch ? "text-yellow-900/70" : isExhibition ? "text-white/70" : "text-muted-foreground"
            )}>{label}</div>
            <div className={cn("text-sm font-bold",
              isFinalMatch ? "text-yellow-900" : isExhibition ? "text-white" : "text-foreground"
            )}>{subtitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isExhibition && (
            <Badge className="bg-white/20 text-white border-0 text-[10px]">Exhibition</Badge>
          )}
          {Number(match.prizeAmount) > 0 && (
            <div className={cn("text-right", isFinalMatch ? "text-yellow-900" : "")}>
              <div className="text-base font-black">{formatCurrency(match.prizeAmount ?? 0)}</div>
              <div className={cn("text-[10px]", isFinalMatch ? "text-yellow-900/70" : "text-muted-foreground")}>Prize</div>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className={cn(
        "p-4",
        isFinalMatch ? "bg-gradient-to-b from-yellow-500/8 to-transparent" : ""
      )}>
        <div className="flex items-center justify-between gap-4">
          {/* Teams + location */}
          <div className="space-y-1 min-w-0">
            <div className="text-xs text-muted-foreground">
              {date && <>{date} · </>}{weatherIcons[match.weather] ?? "☀️"} · {hostBeach}, {hostCountry}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="font-bold text-sm">{match.homeTeamName ?? "—"}</span>
              <span className="text-muted-foreground text-xs">vs</span>
              <span className={cn("font-bold text-sm", awayDisplay === "TBD" ? "text-muted-foreground italic" : "")}>
                {awayDisplay}
              </span>
            </div>
          </div>

          {/* Result / status */}
          <div className="shrink-0 text-right">
            {isCompleted ? (
              <div className="space-y-1">
                <div className={cn("font-black", isFinalMatch ? "text-3xl" : "text-2xl")}>
                  {match.homeScore} – {match.awayScore}
                </div>
                <Badge className={cn(
                  homeWon
                    ? (isFinalMatch ? "bg-yellow-500 text-yellow-900" : "bg-green-500")
                    : "bg-red-500"
                )}>
                  {homeWon
                    ? (isFinalMatch ? "🏆 CHAMPIONS!" : "WIN")
                    : (isFinalMatch ? "RUNNER UP"    : "LOSS")}
                </Badge>
              </div>
            ) : isPlayable ? (
              <Badge className="bg-yellow-500 text-yellow-900 text-xs animate-pulse">READY</Badge>
            ) : locked ? (
              <div className="flex items-center gap-1 text-muted-foreground/50">
                <Lock className="h-3.5 w-3.5" />
                <span className="text-xs">Locked</span>
              </div>
            ) : (
              <Badge variant="outline" className="text-xs">Upcoming</Badge>
            )}
          </div>
        </div>

        {/* Action area */}
        {isPlayable && !isCompleted && (
          <div className="mt-4 pt-3 border-t border-border/30">
            {isAutoMatch || isExhibition ? (
              <Button
                className={cn("w-full gap-2 font-bold",
                  isExhibition ? "bg-blue-600 hover:bg-blue-700 text-white" : ""
                )}
                disabled={isSimulating || activePlayers.length === 0}
                onClick={autoSimulate}
                data-testid={`button-simulate-${match.id}`}
              >
                {isSimulating
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Play className="h-4 w-4" />}
                {isExhibition ? "Watch All-Star Match" : "Simulate Result"}
              </Button>
            ) : !lineupOpen ? (
              <MatchActionButtons
                activePlayers={activePlayers}
                teamSize={match.teamSize ?? 2}
                matchId={match.id}
                matchLabel={label}
                onSimulate={(ids) => onSimulate(match.id, ids)}
                isSimulating={isSimulating}
                onWatchMatch={() => setLineupOpen(true)}
                onForfeit={() => {}}
                isForfeiting={false}
              />
            ) : (
              <div className="space-y-3">
                <div className="text-sm font-bold flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  Select Lineup ({selected.length}/{match.teamSize ?? 2})
                </div>
                <div className="grid grid-cols-3 gap-2">
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
                        <span className="text-xs font-medium truncate">{p.name}</span>
                        <PlayerStatusBadge player={p} size="xs" />
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  className={cn(
                    "w-full gap-2 font-black text-base h-12",
                    isFinalMatch ? "bg-yellow-500 hover:bg-yellow-600 text-yellow-900" : ""
                  )}
                  disabled={selected.length !== (match.teamSize ?? 2) || isSimulating}
                  onClick={() => onSimulate(match.id, selected)}
                  data-testid={`button-simulate-${match.id}`}
                >
                  {isSimulating
                    ? <Loader2 className="h-5 w-5 animate-spin" />
                    : isFinalMatch
                      ? <><Trophy className="h-5 w-5" /> PLAY THE FINAL</>
                      : <><Play className="h-5 w-5" /> Play Match</>}
                </Button>
              </div>
            )}
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
  const [expanded, setExpanded] = useState(false);

  return (
    <Card data-testid={`card-match-${match.id}`} className="overflow-hidden hover-elevate group">
      <div className="flex flex-col md:flex-row">
        <div className="p-6 flex-1 space-y-4">
          {/* Match info — always visible */}
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

          {/* Lineup selector — shown after "Watch Match" is selected */}
          {expanded && (
            <div className="space-y-3">
              <div className="text-sm font-bold flex items-center gap-2"><Users className="h-4 w-4" /> Select Lineup ({selected.length}/{match.teamSize})</div>
              <div className="grid grid-cols-3 gap-2">
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
                      <span className="text-xs font-medium truncate">{p.name}</span>
                      <PlayerStatusBadge player={p} size="xs" />
                    </div>
                  </div>
                ))}
                {activePlayers.length === 0 && (
                  <p className="col-span-4 text-xs text-muted-foreground">No active players on roster.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="bg-muted/30 p-4 flex items-center justify-center border-l min-w-[160px]">
          {!expanded ? (
            <MatchActionButtons
              activePlayers={activePlayers}
              teamSize={match.teamSize}
              matchId={match.id}
              matchLabel={match.locationName ?? "Scheduled Match"}
              onSimulate={onSimulate}
              isSimulating={isSimulating}
              onWatchMatch={() => setExpanded(true)}
              onForfeit={() => {}}
              isForfeiting={false}
            />
          ) : (
            <Button
              size="default"
              className="h-10 px-6 gap-2 text-sm font-black shadow-lg"
              disabled={selected.length !== match.teamSize || isSimulating}
              onClick={() => onSimulate(selected)}
              data-testid={`button-simulate-${match.id}`}
            >
              {isSimulating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Play className="h-4 w-4 fill-current" /> SIMULATE!</>}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
