import { useGetTrophyCabinet, getGetTrophyCabinetQueryKey, useGetHallOfFame, useGetMyTeam } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Trophy,
  Medal,
  Award,
  Star,
  Crown,
  Flame,
  Globe,
  Calendar,
  Zap,
  TrendingUp,
  Search,
  Sparkles,
  UserCheck,
  Home,
  Lock,
  CheckCircle2,
  DollarSign,
  Shirt,
  Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Icon map for achievement icons ───────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  trophy:      Trophy,
  medal:       Medal,
  award:       Award,
  star:        Star,
  crown:       Crown,
  flame:       Flame,
  globe:       Globe,
  calendar:    Calendar,
  zap:         Zap,
  "trending-up": TrendingUp,
  search:      Search,
  sparkles:    Sparkles,
  "user-check":UserCheck,
  home:        Home,
};

// ── Tier config ───────────────────────────────────────────────────────────────

const TIER_CONFIG = {
  bronze:   { label: "Bronze",   bg: "bg-amber-800/10",  border: "border-amber-700/30",  text: "text-amber-700",  badge: "bg-amber-700/15 text-amber-700 border-amber-600/30" },
  silver:   { label: "Silver",   bg: "bg-zinc-400/10",   border: "border-zinc-400/30",   text: "text-zinc-400",   badge: "bg-zinc-400/15 text-zinc-400 border-zinc-400/30"   },
  gold:     { label: "Gold",     bg: "bg-yellow-400/10", border: "border-yellow-400/30", text: "text-yellow-500", badge: "bg-yellow-400/15 text-yellow-600 border-yellow-400/30"},
  platinum: { label: "Platinum", bg: "bg-purple-400/10", border: "border-purple-400/30", text: "text-purple-500", badge: "bg-purple-400/15 text-purple-600 border-purple-400/30"},
};

// ── Trophy display helpers ────────────────────────────────────────────────────

function HonourRow({ icon: Icon, label, count, colour, items }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  colour: string;
  items?: { name: string; year?: number | null; continent?: string | null }[];
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon className={cn("h-4 w-4", colour)} />
          {label}
        </div>
        <span className={cn("text-lg font-black tabular-nums", count > 0 ? colour : "text-muted-foreground/40")}>
          {count}
        </span>
      </div>
      {items && items.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-6">
          {items.map((t, i) => (
            <Badge key={i} variant="outline" className="text-[10px] font-normal">
              {t.name}{t.year ? ` '${String(t.year).slice(2)}` : ""}{t.continent ? ` · ${t.continent}` : ""}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function MedalCircle({ label, count, colour, ring }: { label: string; count: number; colour: string; ring: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn("h-16 w-16 rounded-full flex items-center justify-center border-4 shadow-md", ring, count > 0 ? colour : "bg-muted/30 border-muted")}>
        <span className={cn("text-2xl font-black", count > 0 ? "text-white" : "text-muted-foreground/30")}>{count}</span>
      </div>
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
    </div>
  );
}

// ── Achievement card ──────────────────────────────────────────────────────────

function AchievementCard({ achievement }: { achievement: {
  id: string; title: string; description: string; icon: string;
  tier: string; unlocked: boolean; progress: number; target: number;
}}) {
  const tier = TIER_CONFIG[achievement.tier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG.bronze;
  const Icon = ICON_MAP[achievement.icon] ?? Award;
  const pct  = Math.round((achievement.progress / achievement.target) * 100);

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all",
      achievement.unlocked
        ? cn("border", tier.border, tier.bg)
        : "border-border/50 bg-muted/20 opacity-70",
    )}>
      {achievement.unlocked && (
        <div className="absolute top-2 right-2">
          <CheckCircle2 className={cn("h-4 w-4", tier.text)} />
        </div>
      )}
      {!achievement.unlocked && (
        <div className="absolute top-2 right-2">
          <Lock className="h-3.5 w-3.5 text-muted-foreground/40" />
        </div>
      )}
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0",
            achievement.unlocked ? cn("border", tier.border, tier.bg) : "bg-muted/40 border border-border/40",
          )}>
            <Icon className={cn("h-5 w-5", achievement.unlocked ? tier.text : "text-muted-foreground/30")} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm leading-tight">{achievement.title}</span>
              <span className={cn("inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide", tier.badge)}>
                {tier.label}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{achievement.description}</p>
          </div>
        </div>

        {!achievement.unlocked && achievement.target > 1 && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Progress</span>
              <span>{achievement.progress} / {achievement.target}</span>
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Records row ───────────────────────────────────────────────────────────────

function RecordRow({ icon: Icon, label, value, colour }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  colour?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className={cn("h-4 w-4", colour ?? "text-muted-foreground")} />
        {label}
      </div>
      <span className="font-bold text-sm tabular-nums">{value}</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

// ── Legend Score bar ─────────────────────────────────────────────────────────

function LegendScoreBar({ score }: { score: number }) {
  const max = 200;
  const pct = Math.min(100, Math.round((score / max) * 100));
  const colour =
    score >= 150 ? "bg-purple-500" :
    score >= 100 ? "bg-yellow-500" :
    score >= 50  ? "bg-blue-500"   : "bg-slate-400";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground font-medium">Legend Score</span>
        <span className="font-black tabular-nums">{score}</span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", colour)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function TrophyCabinet() {
  const { data, isLoading } = useGetTrophyCabinet({
    query: { queryKey: getGetTrophyCabinetQueryKey() },
  });
  const { data: hofPlayers, isLoading: hofLoading } = useGetHallOfFame();
  const { data: team } = useGetMyTeam();

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      </div>
    );
  }

  const { honours, olympicMedals, achievements, records } = data!;

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount    = achievements.length;

  const totalClubHonours =
    honours.worldChampionships.length +
    honours.continentalChampionships.length +
    honours.grandFinals.length +
    honours.runnerUps.length +
    honours.bronzes.length;

  const continentEntries = Object.entries(honours.continentalFinalsByContinent ?? {});

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
            <Trophy className="h-8 w-8 text-yellow-500" />
            Trophy Cabinet
          </h2>
          <p className="text-muted-foreground mt-1">Your career legacy — every title, medal, and milestone.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center px-4 py-2 rounded-xl border bg-card">
            <div className="text-2xl font-black text-primary">{totalClubHonours}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Club Honours</div>
          </div>
          <div className="text-center px-4 py-2 rounded-xl border bg-card">
            <div className="text-2xl font-black text-yellow-500">{olympicMedals.gold + olympicMedals.silver + olympicMedals.bronze}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Olympic Medals</div>
          </div>
          <div className="text-center px-4 py-2 rounded-xl border bg-card">
            <div className="text-2xl font-black text-purple-500">{unlockedCount}<span className="text-base font-normal text-muted-foreground">/{totalCount}</span></div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Achievements</div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="honours">
        <TabsList className="w-full md:w-auto flex-wrap">
          <TabsTrigger value="honours"  className="gap-1.5"><Trophy className="h-3.5 w-3.5" /> Club Honours</TabsTrigger>
          <TabsTrigger value="olympics" className="gap-1.5"><Medal  className="h-3.5 w-3.5" /> Olympic Medals</TabsTrigger>
          <TabsTrigger value="achievements" className="gap-1.5"><Award className="h-3.5 w-3.5" /> Achievements</TabsTrigger>
          <TabsTrigger value="records"  className="gap-1.5"><Star   className="h-3.5 w-3.5" /> Records</TabsTrigger>
          <TabsTrigger value="hall-of-fame" className="gap-1.5"><Crown className="h-3.5 w-3.5" /> Hall of Fame</TabsTrigger>
          <TabsTrigger value="manager"  className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Manager</TabsTrigger>
        </TabsList>

        {/* ── Club Honours ── */}
        <TabsContent value="honours" className="mt-6">
          <div className="grid gap-5 md:grid-cols-2">
            {/* Major Titles */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Crown className="h-4 w-4 text-yellow-500" /> Major Titles
                </CardTitle>
                <CardDescription>World championships and continental glory</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <HonourRow icon={Trophy} label="World Tour Championships" count={honours.worldChampionships.length} colour="text-yellow-500" items={honours.worldChampionships} />
                <HonourRow icon={Globe}  label="Continental Championships" count={honours.continentalChampionships.length} colour="text-blue-500" items={honours.continentalChampionships} />
                <HonourRow icon={Star}   label="World Grand Final Wins"   count={honours.grandFinals.length}           colour="text-purple-500" items={honours.grandFinals} />
              </CardContent>
            </Card>

            {/* Other Results */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="h-4 w-4 text-zinc-400" /> Other Honours
                </CardTitle>
                <CardDescription>Runner-up and bronze finishes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <HonourRow icon={Award}  label="Tournament Runner-Ups" count={honours.runnerUps.length} colour="text-zinc-400" items={honours.runnerUps} />
                <HonourRow icon={Medal}  label="Bronze Finishes"        count={honours.bronzes.length}  colour="text-amber-700" items={honours.bronzes} />
              </CardContent>
            </Card>

            {/* Continental Finals by Continent */}
            {continentEntries.length > 0 && (
              <Card className="md:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-500" /> Continental Finals by Continent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {continentEntries.map(([continent, wins]) => (
                      <div key={continent} className="text-center p-3 rounded-xl border bg-muted/20">
                        <div className="text-2xl font-black text-blue-500">{wins}</div>
                        <div className="text-[11px] font-medium text-muted-foreground mt-0.5">{continent}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {totalClubHonours === 0 && (
              <div className="md:col-span-2 flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Trophy className="h-16 w-16 opacity-10 mb-4" />
                <p className="text-lg font-medium">The cabinet is empty for now.</p>
                <p className="text-sm opacity-60">Win tournaments to start filling it up.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Olympic Medals ── */}
        <TabsContent value="olympics" className="mt-6">
          <div className="grid gap-5 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Medal className="h-4 w-4 text-yellow-400" /> Medal Haul
                </CardTitle>
                <CardDescription>Your Olympic medal record as national coach</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-around py-4">
                  <MedalCircle label="Gold"   count={olympicMedals.gold}   colour="bg-yellow-400" ring="border-yellow-500" />
                  <MedalCircle label="Silver" count={olympicMedals.silver} colour="bg-zinc-300"   ring="border-zinc-400"  />
                  <MedalCircle label="Bronze" count={olympicMedals.bronze} colour="bg-amber-600"  ring="border-amber-700" />
                </div>
                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Olympic Appearances</span>
                  <span className="font-bold">{olympicMedals.appearances}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-400" /> Olympic Campaigns
                </CardTitle>
                <CardDescription>Years and locations you've competed</CardDescription>
              </CardHeader>
              <CardContent>
                {olympicMedals.hosts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Globe className="h-10 w-10 opacity-10 mb-3" />
                    <p className="text-sm">No Olympic campaigns yet</p>
                    <p className="text-xs opacity-60 mt-1">Select your country in the Olympics section</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {olympicMedals.hosts.map((h, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                        <span className="font-semibold text-sm">{h.year}</span>
                        <span className="text-sm text-muted-foreground">{h.location}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Achievements ── */}
        <TabsContent value="achievements" className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              <span className="font-bold text-foreground">{unlockedCount}</span> of <span className="font-bold text-foreground">{totalCount}</span> achievements unlocked
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Progress value={Math.round((unlockedCount / totalCount) * 100)} className="h-2 w-32" />
              <span>{Math.round((unlockedCount / totalCount) * 100)}%</span>
            </div>
          </div>

          {/* Unlocked first */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...achievements]
              .sort((a, b) => Number(b.unlocked) - Number(a.unlocked))
              .map(a => <AchievementCard key={a.id} achievement={a} />)}
          </div>
        </TabsContent>

        {/* ── Records ── */}
        <TabsContent value="records" className="mt-6">
          <div className="grid gap-5 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" /> Career Statistics
                </CardTitle>
                <CardDescription>Your all-time best numbers</CardDescription>
              </CardHeader>
              <CardContent>
                <RecordRow icon={Trophy}     label="Most Titles Won"        value={records.mostTitles}    colour="text-yellow-500" />
                <RecordRow icon={Star}       label="Total Match Wins"        value={records.mostWins}      colour="text-green-500"  />
                <RecordRow icon={Flame}      label="Best Winning Streak"     value={`${records.bestWinStreak} in a row`} colour="text-orange-500" />
                <RecordRow icon={DollarSign} label="Most Prize Money Earned" value={`$${Number(records.mostPrizeMoney).toLocaleString()}`} colour="text-emerald-500" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-500" /> Career Longevity
                </CardTitle>
                <CardDescription>Milestones across your managerial career</CardDescription>
              </CardHeader>
              <CardContent>
                <RecordRow icon={Calendar} label="Seasons Managed"      value={records.seasonsManaged} colour="text-blue-500"   />
                <RecordRow icon={Medal}    label="Olympic Medals Total"  value={records.olympicMedals}  colour="text-yellow-400" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Hall of Fame ── */}
        <TabsContent value="hall-of-fame" className="mt-6">
          {hofLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
            </div>
          ) : !hofPlayers || hofPlayers.length === 0 ? (
            <Card className="border-2 border-dashed text-center p-12">
              <Crown className="h-10 w-10 mx-auto mb-3 text-amber-400 opacity-40" />
              <p className="font-semibold text-muted-foreground">No legends yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Retire a player from the Team &amp; Roster page to induct them here.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {hofPlayers.map((p) => (
                <Card key={p.id} className="overflow-hidden border-2 border-amber-400/40 bg-amber-50/30 dark:bg-amber-950/10">
                  <div className="relative h-40 overflow-hidden bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/30 dark:to-amber-800/20">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover object-[center_20%]" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Crown className="h-16 w-16 text-amber-400/40" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-amber-500 text-white border-0 font-black text-sm px-2">{p.peakOverallRating} OVR</Badge>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <div className="text-lg font-black text-white leading-tight drop-shadow">{p.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Flag className="h-3 w-3 text-white/70" />
                        <span className="text-xs text-white/80">{p.nationality}</span>
                        <span className="text-white/40 text-xs">·</span>
                        <span className="text-xs text-white/80">{p.position.replace(/_/g, " ")}</span>
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-muted/50 p-2">
                        <div className="text-base font-black text-yellow-600">{p.careerTitles}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Titles</div>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2">
                        <div className="text-base font-black text-green-600">{p.careerWins}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Wins</div>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2">
                        <div className="text-base font-black text-blue-600">{p.olympicMedalsCount}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Olympics</div>
                      </div>
                    </div>

                    {(p.worldTitles > 0 || p.continentalTitles > 0) && (
                      <div className="flex gap-1.5 flex-wrap">
                        {p.worldTitles > 0 && (
                          <Badge variant="outline" className="text-[10px] gap-1 border-yellow-500/50 text-yellow-700">
                            <Trophy className="h-2.5 w-2.5" /> {p.worldTitles} World {p.worldTitles === 1 ? "Title" : "Titles"}
                          </Badge>
                        )}
                        {p.continentalTitles > 0 && (
                          <Badge variant="outline" className="text-[10px] gap-1 border-blue-500/50 text-blue-700">
                            <Globe className="h-2.5 w-2.5" /> {p.continentalTitles} Continental
                          </Badge>
                        )}
                      </div>
                    )}

                    <LegendScoreBar score={p.legendScore} />

                    {p.retiredSeasonYear && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                        <Shirt className="h-3 w-3" />
                        <span>Retired {p.retiredSeasonYear}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Manager Reputation ── */}
        <TabsContent value="manager" className="mt-6">
          {(() => {
            const REP_LEVELS = [
              { level: 1, name: "Local Coach",       min: 0,    next: 100,  colour: "text-zinc-400",   ring: "border-zinc-500",     bg: "bg-zinc-500",     desc: "Just getting started. Players and staff take a chance on you." },
              { level: 2, name: "Regional Coach",    min: 100,  next: 300,  colour: "text-green-400",  ring: "border-green-500",    bg: "bg-green-500",    desc: "Your results are turning heads. Better signings become possible." },
              { level: 3, name: "National Coach",    min: 300,  next: 700,  colour: "text-blue-400",   ring: "border-blue-500",     bg: "bg-blue-500",     desc: "Respected on the national circuit. Top staff want to work with you." },
              { level: 4, name: "World Class Coach", min: 700,  next: 1500, colour: "text-purple-400", ring: "border-purple-500",   bg: "bg-purple-500",   desc: "Elite players seek you out. Premium sponsors come calling." },
              { level: 5, name: "Legend",            min: 1500, next: null, colour: "text-yellow-400", ring: "border-yellow-400",   bg: "bg-yellow-400",   desc: "The pinnacle. Unlocks the best national team offers and sponsorships." },
            ];
            const EARN_WAYS = [
              { icon: "🏆", label: "Tournament win",       pts: "+10"  },
              { icon: "🌍", label: "Continental title",    pts: "+25"  },
              { icon: "🎖️", label: "Grand Final title",   pts: "+50"  },
              { icon: "🔥", label: "Win streak (3+)",      pts: "+5/win" },
              { icon: "🏗️", label: "Facility upgrade",    pts: "+5"   },
              { icon: "🌱", label: "Develop young player (≤22)", pts: "+5"   },
            ];
            const EFFECTS = [
              { level: 1, text: "Baseline — players and staff judge you on results alone" },
              { level: 2, text: "Better free-agent players more likely to sign" },
              { level: 3, text: "Top-tier staff more likely to accept offers" },
              { level: 4, text: "Premium sponsorship deals become available" },
              { level: 5, text: "Best national team offers unlock" },
            ];

            const pts    = team?.managerRepPoints ?? 0;
            const streak = team?.winStreak ?? 0;
            const lvl    = REP_LEVELS.slice().reverse().find(l => pts >= l.min) ?? REP_LEVELS[0]!;
            const pct    = lvl.next === null ? 100 : Math.round(((pts - lvl.min) / (lvl.next - lvl.min)) * 100);
            const ptsToNext = lvl.next !== null ? lvl.next - pts : 0;

            return (
              <div className="grid gap-6 md:grid-cols-2">

                {/* ── Current level card ── */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" /> Manager Reputation
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {/* Level badge */}
                    <div className="flex items-center gap-4">
                      <div className={`h-16 w-16 rounded-full flex items-center justify-center border-4 shadow-md ${lvl.ring} ${lvl.bg}/20`}>
                        <span className={`text-2xl font-black ${lvl.colour}`}>{lvl.level}</span>
                      </div>
                      <div>
                        <p className={`text-lg font-bold ${lvl.colour}`}>{lvl.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{pts.toLocaleString()} reputation points</p>
                        {streak >= 3 && (
                          <p className="text-xs text-amber-400 mt-0.5">🔥 {streak}-win streak active</p>
                        )}
                      </div>
                    </div>

                    {/* Progress to next level */}
                    {lvl.next !== null ? (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Progress to {REP_LEVELS[lvl.level]?.name}</span>
                          <span>{pct}%</span>
                        </div>
                        <Progress value={pct} className="h-2" />
                        <p className="text-xs text-muted-foreground">{ptsToNext.toLocaleString()} pts to next level</p>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-yellow-400/30 bg-yellow-400/5 px-3 py-2 text-xs text-yellow-400">
                        ✦ Maximum level reached — you are a Legend
                      </div>
                    )}

                    {/* Level milestones */}
                    <div className="space-y-2 pt-1">
                      {REP_LEVELS.map(l => {
                        const unlocked = pts >= l.min;
                        const current  = l.level === lvl.level;
                        return (
                          <div key={l.level} className={`flex items-center gap-2 text-xs ${unlocked ? l.colour : "text-muted-foreground/40"}`}>
                            <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${unlocked ? `${l.bg}/20 border ${l.ring}` : "bg-muted/20 border border-border"}`}>
                              {l.level}
                            </div>
                            <span className={current ? "font-semibold" : ""}>{l.name}</span>
                            {current && <Badge variant="outline" className="ml-auto text-[9px] py-0">Current</Badge>}
                            {!unlocked && <span className="ml-auto text-[10px]">{l.min.toLocaleString()} pts</span>}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* ── Right column ── */}
                <div className="space-y-6">
                  {/* How to earn rep */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" /> How to Earn Reputation
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {EARN_WAYS.map(w => (
                          <div key={w.label} className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <span>{w.icon}</span>
                              <span className="text-muted-foreground">{w.label}</span>
                            </span>
                            <Badge variant="outline" className="text-xs text-green-400 border-green-500/30 bg-green-500/5">
                              {w.pts}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Rep effects */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" /> Level Effects
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {EFFECTS.map(e => {
                          const unlocked = pts >= (REP_LEVELS[e.level - 1]?.min ?? 0);
                          const l        = REP_LEVELS[e.level - 1]!;
                          return (
                            <div key={e.level} className={`flex items-start gap-2 text-xs ${unlocked ? "" : "opacity-40"}`}>
                              <div className={`h-4 w-4 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold mt-0.5 ${l.bg}/20 border ${l.ring}`}>
                                {e.level}
                              </div>
                              <span className="text-muted-foreground">{e.text}</span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>

              </div>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
