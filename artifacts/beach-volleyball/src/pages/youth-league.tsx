import { useState } from "react";
import { cn } from "@/lib/utils";
import { Star, Calendar, CheckCircle2, BarChart2, Trophy, Users, Medal, Award } from "lucide-react";
import {
  useGetYouthLeagueResults,
  getGetYouthLeagueResultsQueryKey,
  useGetYouthLadder,
  getGetYouthLadderQueryKey,
  useGetYouthStars,
  getGetYouthStarsQueryKey,
  useGetYouthChampionship,
  getGetYouthChampionshipQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Tab = "overview" | "fixtures" | "results" | "ladder";

const TABS: Array<{ id: Tab; label: string; icon: any }> = [
  { id: "overview",  label: "Overview",  icon: Star        },
  { id: "fixtures",  label: "Fixtures",  icon: Calendar    },
  { id: "results",   label: "Results",   icon: CheckCircle2 },
  { id: "ladder",    label: "Ladder",    icon: BarChart2   },
];

const RESULT_COLORS: Record<string, string> = {
  win:  "bg-green-500",
  loss: "bg-red-500",
  draw: "bg-yellow-500",
};

const POTENTIAL_COLORS: Record<string, string> = {
  Low:          "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  Average:      "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  High:         "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Elite:        "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  Generational: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="text-center text-muted-foreground py-16">
      {icon}
      <p className="font-semibold text-sm">{title}</p>
      <p className="text-xs mt-1 max-w-xs mx-auto">{description}</p>
    </div>
  );
}

function ratingBar(value: number) {
  const pct = Math.min(100, Math.max(0, value));
  const colour =
    pct >= 80 ? "bg-emerald-500" :
    pct >= 65 ? "bg-blue-500" :
    pct >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", colour)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold w-6 text-right">{value}</span>
    </div>
  );
}

export default function YouthLeagueHub() {
  const [tab, setTab] = useState<Tab>("overview");

  const { data: results, isLoading: resultsLoading } = useGetYouthLeagueResults({
    query: { queryKey: getGetYouthLeagueResultsQueryKey() },
  });
  const { data: ladder, isLoading: ladderLoading } = useGetYouthLadder({
    query: { queryKey: getGetYouthLadderQueryKey() },
  });
  const { data: stars, isLoading: starsLoading } = useGetYouthStars({
    query: { queryKey: getGetYouthStarsQueryKey() },
  });
  const { data: championship, isLoading: championshipLoading } = useGetYouthChampionship({
    query: { queryKey: getGetYouthChampionshipQueryKey() },
  });

  const rankedLadder = (ladder ?? [])
    .slice()
    .sort((a, b) => b.points - a.points || b.wins - a.wins);

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap border-b border-border pb-4">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
              tab === id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === "overview" && (
        <div className="space-y-8">
          {/* Stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Academy Players",  value: stars?.length ?? "—",                                              icon: Users,  accent: false },
              { label: "Trophies Won",     value: championship?.filter(t => t.isPlayerWin).length ?? "—",            icon: Trophy, accent: true  },
              { label: "League Wins",      value: rankedLadder.find(e => e.isPlayer)?.wins ?? "—",                   icon: Award,  accent: false },
              { label: "League Position",  value: rankedLadder.findIndex(e => e.isPlayer) + 1 || "—",                icon: Medal,  accent: false },
            ].map(s => {
              const Icon = s.icon;
              return (
                <Card key={s.label} className={cn("border", s.accent && "border-primary/30 bg-primary/5")}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                      s.accent ? "bg-primary/15" : "bg-muted")}>
                      <Icon className={cn("h-4 w-4", s.accent ? "text-primary" : "text-muted-foreground")} />
                    </div>
                    <div>
                      <p className="text-2xl font-black leading-none">{s.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Youth Stars */}
          <div>
            <h3 className="font-bold text-base mb-3 flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" /> Youth Stars
            </h3>
            {starsLoading ? (
              <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : !stars || stars.length === 0 ? (
              <EmptyState
                icon={<Star className="h-12 w-12 mx-auto mb-3 opacity-20" />}
                title="No youth players"
                description="Sign youth prospects through the Youth Academy to see them here."
              />
            ) : (
              <div className="space-y-3">
                {stars.map((player, idx) => (
                  <Card key={player.id} className={cn(
                    "overflow-hidden transition-all",
                    idx === 0 && "border-yellow-400/40 bg-yellow-400/5",
                  )}>
                    <div className="flex items-center gap-4 p-4">
                      <div className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center text-sm font-black shrink-0",
                        idx === 0 ? "bg-yellow-400 text-yellow-900" :
                        idx === 1 ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200" :
                        idx === 2 ? "bg-amber-600 text-white" : "bg-muted text-muted-foreground"
                      )}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold truncate">{player.name}</span>
                          {idx === 0 && <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500 shrink-0" />}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                          <span>Age {player.age}</span>
                          <span>·</span>
                          <span>{player.nationality}</span>
                          {player.speciality && (
                            <>
                              <span>·</span>
                              <span className="capitalize">{player.speciality}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0 w-36">
                        {ratingBar(player.rating)}
                        <Badge className={cn("text-[10px]", POTENTIAL_COLORS[player.potential] ?? "")}>
                          {player.potential}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Championship format */}
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-amber-400/20 flex items-center justify-center shrink-0">
                  <Trophy className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Youth Championship</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    At the end of each season, the top 4 teams from the Youth Development League qualify for a knockout tournament.
                    The winner is crowned Youth Champion and awarded a trophy.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {["Semi-Final 1: 1st vs 4th", "Semi-Final 2: 2nd vs 3rd", "Grand Final"].map(s => (
                      <Badge key={s} variant="outline" className="border-amber-500/30 text-amber-700 dark:text-amber-400">{s}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Past championships */}
          {!championshipLoading && championship && championship.length > 0 && (
            <div>
              <h3 className="font-bold text-base mb-3 flex items-center gap-2">
                <Medal className="h-4 w-4 text-amber-500" /> Youth Trophy Cabinet
              </h3>
              <div className="space-y-3">
                {championship.map(trophy => (
                  <Card key={trophy.id} className={cn(
                    "overflow-hidden",
                    trophy.isPlayerWin ? "border-amber-400/40 bg-amber-400/5" : "opacity-75",
                  )}>
                    <div className="flex items-center gap-4 p-4">
                      <div className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                        trophy.isPlayerWin ? "bg-amber-400/20" : "bg-muted",
                      )}>
                        <Trophy className={cn("h-5 w-5", trophy.isPlayerWin ? "text-amber-500" : "text-muted-foreground")} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold flex items-center gap-2">
                          Youth Championship
                          {trophy.isPlayerWin && (
                            <Badge className="bg-amber-400 text-amber-900 text-[10px]">YOUR WIN!</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Season {trophy.season}{trophy.year ? ` · ${trophy.year}` : ""}
                          {" · "}Winner: <span className="font-medium">{trophy.winningTeamName}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── FIXTURES ── */}
      {tab === "fixtures" && (
        <div className="space-y-4">
          <Card className="border-dashed">
            <CardContent className="p-8 text-center space-y-3">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground/30" />
              <p className="font-semibold text-muted-foreground">Youth Fixtures are Simulated</p>
              <p className="text-sm text-muted-foreground/70 max-w-sm mx-auto">
                Youth league matches run automatically alongside each senior match. Advance the calendar on the Dashboard to generate the next round of youth fixtures and results.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── RESULTS ── */}
      {tab === "results" && (
        <div className="space-y-4">
          {resultsLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : !results || results.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-20" />}
              title="No results yet"
              description="Youth league results appear here automatically after each senior match simulation."
            />
          ) : (
            (() => {
              const weeks = new Map<number, typeof results>();
              for (const r of results) {
                if (!weeks.has(r.weekNumber)) weeks.set(r.weekNumber, []);
                weeks.get(r.weekNumber)!.push(r);
              }
              return [...weeks.entries()]
                .sort(([a], [b]) => b - a)
                .map(([week, rows]) => (
                  <div key={week}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Week {week}</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                    <div className="space-y-2">
                      {rows.map(r => (
                        <Card key={r.id} className="overflow-hidden">
                          <div className="flex items-center gap-4 p-4">
                            <div className={cn("w-1 self-stretch rounded-full shrink-0",
                              r.result === "win" ? "bg-green-500" : r.result === "loss" ? "bg-red-500" : "bg-yellow-500")} />
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold truncate">{r.playerName}</div>
                              <div className="text-xs text-muted-foreground">
                                vs <span className="font-medium">{r.oppositionName}</span>
                                {" · "}Rating {r.playerRatingAtTime}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <Badge className={cn("text-[10px] uppercase", RESULT_COLORS[r.result])}>
                                {r.result}
                              </Badge>
                              <div className="text-[11px] text-muted-foreground">
                                +{r.xpGained} XP · +{r.devPointsGained} dev
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                ));
            })()
          )}
        </div>
      )}

      {/* ── LADDER ── */}
      {tab === "ladder" && (
        <div>
          {ladderLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !rankedLadder.length ? (
            <EmptyState
              icon={<Users className="h-12 w-12 mx-auto mb-3 opacity-20" />}
              title="Ladder not yet generated"
              description="Simulate a match to initialise the Youth Development League ladder."
            />
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Youth Development League</CardTitle>
                <CardDescription>Season standings · 3 pts per win</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide w-8">#</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Team</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide">W</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide">L</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankedLadder.map((entry, idx) => {
                        const pos = idx + 1;
                        const isTop4 = pos <= 4;
                        return (
                          <tr
                            key={entry.id}
                            className={cn(
                              "border-b border-border/50 last:border-0 transition-colors",
                              entry.isPlayer
                                ? "bg-primary/5 font-semibold"
                                : "hover:bg-muted/30",
                            )}
                          >
                            <td className="px-4 py-3">
                              <span className={cn(
                                "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                                pos === 1 ? "bg-yellow-400 text-yellow-900" :
                                pos === 2 ? "bg-slate-300 text-slate-800" :
                                pos === 3 ? "bg-amber-600 text-white" :
                                isTop4 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" :
                                "bg-muted text-muted-foreground"
                              )}>
                                {pos}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="flex items-center gap-1.5">
                                {entry.competitorName}
                                {entry.isPlayer && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-primary border-primary/30">YOU</Badge>
                                )}
                                {isTop4 && (
                                  <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wide">Q</span>
                                )}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center font-mono">{entry.wins}</td>
                            <td className="px-3 py-3 text-center font-mono text-muted-foreground">{entry.losses}</td>
                            <td className="px-3 py-3 text-center font-black text-primary">{entry.points}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 border-t border-border/50 text-[11px] text-muted-foreground">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">Q</span> = qualifies for Youth Championship (top 4)
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
