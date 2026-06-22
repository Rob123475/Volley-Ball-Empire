import { useGetTrophyCabinet, getGetTrophyCabinetQueryKey } from "@workspace/api-client-react";
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

export default function TrophyCabinet() {
  const { data, isLoading } = useGetTrophyCabinet({
    query: { queryKey: getGetTrophyCabinetQueryKey() },
  });

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
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="honours"  className="gap-1.5"><Trophy className="h-3.5 w-3.5" /> Club Honours</TabsTrigger>
          <TabsTrigger value="olympics" className="gap-1.5"><Medal  className="h-3.5 w-3.5" /> Olympic Medals</TabsTrigger>
          <TabsTrigger value="achievements" className="gap-1.5"><Award className="h-3.5 w-3.5" /> Achievements</TabsTrigger>
          <TabsTrigger value="records"  className="gap-1.5"><Star   className="h-3.5 w-3.5" /> Records</TabsTrigger>
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
      </Tabs>
    </div>
  );
}
