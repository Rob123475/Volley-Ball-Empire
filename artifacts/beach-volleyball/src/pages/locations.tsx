import { useListMatches, getListMatchesQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Flag, Lock, Star, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Olympics constants ─────────────────────────────────────────────────────
const CURRENT_YEAR = 2026;
const OLYMPICS_BASE_YEAR = 2024;
const OLYMPICS_CYCLE = 4;

function getNextOlympicsYear(fromYear: number): number {
  let y = OLYMPICS_BASE_YEAR;
  while (y <= fromYear) y += OLYMPICS_CYCLE;
  return y;
}

const NEXT_OLYMPICS_YEAR = getNextOlympicsYear(CURRENT_YEAR); // 2028
const SEASONS_UNTIL_OLYMPICS = NEXT_OLYMPICS_YEAR - CURRENT_YEAR; // 2

const OLYMPICS_HOSTS: Record<number, { city: string; flag: string; country: string }> = {
  2024: { city: "Paris",        flag: "🇫🇷", country: "France" },
  2028: { city: "Los Angeles",  flag: "🇺🇸", country: "USA" },
  2032: { city: "Brisbane",     flag: "🇦🇺", country: "Australia" },
  2036: { city: "TBD",          flag: "🌍", country: "TBD" },
};

// ── Olympic nations (beach volleyball) ────────────────────────────────────
const OLYMPIC_NATIONS = [
  { flag: "🇧🇷", country: "Brazil",      players: "Silva / Agatha",         group: "A", seed: 1  },
  { flag: "🇺🇸", country: "USA",         players: "Ross / Walsh",            group: "A", seed: 2  },
  { flag: "🇦🇺", country: "Australia",   players: "Artacho / Clancy",        group: "B", seed: 3  },
  { flag: "🇩🇪", country: "Germany",     players: "Ludwig / Kozuch",         group: "B", seed: 4  },
  { flag: "🇳🇱", country: "Netherlands", players: "van Iersel / Ypma",       group: "C", seed: 5  },
  { flag: "🇨🇳", country: "China",       players: "Wang / Xia",              group: "C", seed: 6  },
  { flag: "🇨🇦", country: "Canada",      players: "Wilkerson / Pavan",       group: "A", seed: 7  },
  { flag: "🇨🇭", country: "Switzerland", players: "Heidrich / Vergé-Dépré",  group: "B", seed: 8  },
  { flag: "🇯🇵", country: "Japan",       players: "Ishijima / Murakami",     group: "C", seed: 9  },
  { flag: "🇪🇸", country: "Spain",       players: "Liliana / Elsa",          group: "A", seed: 10 },
  { flag: "🇳🇴", country: "Norway",      players: "Ingrid / Sanne",          group: "B", seed: 11 },
  { flag: "🇮🇹", country: "Italy",       players: "Gottardi / Menegatti",    group: "C", seed: 12 },
];

const GROUPS = ["A", "B", "C"] as const;

// ── Tournament stages ──────────────────────────────────────────────────────
const STAGES = [
  {
    id: "group",  label: "Group Stage",        sublabel: "12 teams · 3 groups of 4",
    medal: null,  emoji: "🏐",
  },
  {
    id: "qf",     label: "Quarter Finals",     sublabel: "Top 2 from each group + 2 best 3rd",
    medal: null,  emoji: "⚔️",
  },
  {
    id: "sf",     label: "Semi Finals",        sublabel: "4 teams compete for finals spots",
    medal: null,  emoji: "🔥",
  },
  {
    id: "bronze", label: "Bronze Medal Match", sublabel: "Semi-final losers compete for 🥉",
    medal: "bronze", emoji: "🥉",
  },
  {
    id: "gold",   label: "Gold Medal Match",   sublabel: "Champions crowned on the sand",
    medal: "gold",   emoji: "🥇",
  },
];

// ── Qualification points per win (derived from prize amount) ──────────────
function qualPointsForWin(prizeAmount: number | null | undefined): number {
  const p = prizeAmount ?? 0;
  if (p >= 500_000) return 200; // Grand Final
  if (p >= 80_000)  return 120; // Continental Final
  if (p >= 50_000)  return 80;  // Elite
  if (p >= 20_000)  return 40;  // Gold
  if (p >= 10_000)  return 20;  // Silver
  return 10;                    // Bronze
}

const QUAL_POINTS_LEGEND = [
  { label: "Bronze",            pts: 10  },
  { label: "Silver",            pts: 20  },
  { label: "Gold",              pts: 40  },
  { label: "Elite",             pts: 80  },
  { label: "Continental Final", pts: 120 },
];
const QUAL_TARGET = 400; // points needed over qualifying seasons

// ── Helpers ────────────────────────────────────────────────────────────────
function OlympicRings() {
  const rings = [
    { color: "#0085C7", x: 0   },
    { color: "#F4C300", x: 28  },
    { color: "#000000", x: 56  },
    { color: "#009F6B", x: 84  },
    { color: "#DF0024", x: 112 },
  ];
  return (
    <svg viewBox="0 0 152 60" className="h-8 w-auto opacity-80" aria-label="Olympic rings">
      {rings.map((r, i) => (
        <circle
          key={i}
          cx={r.x + 20}
          cy={i % 2 === 0 ? 20 : 40}
          r={18}
          fill="none"
          stroke={r.color}
          strokeWidth="5"
        />
      ))}
    </svg>
  );
}

function MedalBadge({ type }: { type: "gold" | "silver" | "bronze" }) {
  const cfg = {
    gold:   { bg: "bg-yellow-400/20 border-yellow-400/50", text: "text-yellow-600 dark:text-yellow-400", label: "GOLD",   emoji: "🥇" },
    silver: { bg: "bg-slate-300/20 border-slate-400/40",   text: "text-slate-600  dark:text-slate-400",  label: "SILVER", emoji: "🥈" },
    bronze: { bg: "bg-amber-700/15 border-amber-600/30",   text: "text-amber-700  dark:text-amber-500",  label: "BRONZE", emoji: "🥉" },
  }[type];
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border-2 py-6 px-4", cfg.bg)}>
      <span className="text-5xl mb-2">{cfg.emoji}</span>
      <span className={cn("text-xs font-black uppercase tracking-widest", cfg.text)}>{cfg.label}</span>
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={cn(
      "rounded-xl border p-4 text-center",
      accent ? "bg-primary/5 border-primary/30" : "bg-muted/30 border-border"
    )}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-black mt-1", accent && "text-primary")}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function WorldTourLocations() {
  const { data: matches, isLoading } = useListMatches({
    query: { queryKey: getListMatchesQueryKey() },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const completed = (matches ?? []).filter(m => m.status === "completed");
  const wins = completed.filter(m => (m.homeScore ?? 0) > (m.awayScore ?? 0));

  // Calculate qualification points from wins by prize amount
  const qualPoints = wins.reduce((acc, m) => acc + qualPointsForWin(m.prizeAmount), 0);
  const qualPct = Math.min(Math.round((qualPoints / QUAL_TARGET) * 100), 100);

  const nextHost = OLYMPICS_HOSTS[NEXT_OLYMPICS_YEAR];
  const isQualifyingSeason = true; // seasons 2026 & 2027 are qualifying seasons

  return (
    <div className="space-y-10">

      {/* ── Hero banner ─────────────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-6 py-8 shadow-xl">
        {/* Sand texture overlay */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='1.5'/%3E%3Ccircle cx='23' cy='23' r='1.5'/%3E%3C/g%3E%3C/svg%3E\")" }}
        />
        <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="mb-3">
              <OlympicRings />
            </div>
            <div className="text-blue-300 text-xs font-bold uppercase tracking-widest mb-1">Beach Volley Pro</div>
            <h1 className="text-3xl md:text-4xl font-black text-white leading-tight">
              Beach Volleyball<br />Olympics
            </h1>
            <p className="text-white/50 text-sm mt-2">
              {nextHost.flag} {nextHost.city} {NEXT_OLYMPICS_YEAR} · {SEASONS_UNTIL_OLYMPICS} seasons away
            </p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-2">
            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs px-3 py-1 font-bold">
              🏅 QUALIFYING PERIOD OPEN
            </Badge>
            <p className="text-white/40 text-xs">Seasons 2026–2027 count</p>
          </div>
        </div>
      </div>

      {/* ── Key stats ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Next Olympics"
          value={String(NEXT_OLYMPICS_YEAR)}
          sub={`${nextHost.flag} ${nextHost.city}, ${nextHost.country}`}
          accent
        />
        <StatCard
          label="Seasons Remaining"
          value={String(SEASONS_UNTIL_OLYMPICS)}
          sub="to qualify"
        />
        <StatCard
          label="Qual. Points"
          value={String(qualPoints)}
          sub={`of ${QUAL_TARGET} target`}
          accent={qualPoints >= QUAL_TARGET}
        />
        <StatCard
          label="Season Wins"
          value={String(wins.length)}
          sub={`from ${completed.length} played`}
        />
      </div>

      {/* ── Qualification progress ───────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black uppercase tracking-wide">Olympic Qualification</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Accumulate points across 2026 & 2027 World Tour seasons
            </p>
          </div>
          {qualPoints >= QUAL_TARGET ? (
            <Badge className="bg-emerald-500 text-white gap-1 px-3"><CheckCircle2 className="h-3 w-3" /> QUALIFIED</Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground gap-1 px-3"><Lock className="h-3 w-3" /> In Progress</Badge>
          )}
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>{qualPoints} pts earned</span>
            <span>{QUAL_TARGET} pts needed</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700",
                qualPct >= 100 ? "bg-emerald-500" : "bg-gradient-to-r from-blue-500 to-blue-400"
              )}
              style={{ width: `${qualPct}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">{qualPct}% of qualification target</p>
        </div>

        {/* Points legend */}
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2 pt-1">
          {QUAL_POINTS_LEGEND.map(({ label, pts }) => (
            <div key={label} className="rounded-lg bg-muted/40 p-2 text-center">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className="text-sm font-black text-primary">+{pts}</p>
              <p className="text-[9px] text-muted-foreground">pts/win</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tournament format ────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground px-1">
          Tournament Format
        </h2>
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {STAGES.map((stage, idx) => (
            <div key={stage.id} className={cn(
              "flex items-center gap-4 px-5 py-4 border-b last:border-b-0 border-border",
              stage.medal === "gold"   && "bg-yellow-400/5",
              stage.medal === "bronze" && "bg-amber-700/5",
            )}>
              {/* Stage number */}
              <div className={cn(
                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black",
                stage.medal === "gold"   ? "bg-yellow-400 text-yellow-900" :
                stage.medal === "bronze" ? "bg-amber-600 text-white" :
                "bg-muted text-muted-foreground"
              )}>
                {idx + 1}
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{stage.label}</span>
                  {stage.medal === "gold"   && <span className="text-base">🥇</span>}
                  {stage.medal === "bronze" && <span className="text-base">🥉</span>}
                </div>
                <p className="text-xs text-muted-foreground">{stage.sublabel}</p>
              </div>

              {/* Locked badge */}
              <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1 flex-shrink-0">
                <Lock className="h-2.5 w-2.5" /> {NEXT_OLYMPICS_YEAR}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {/* ── Medal cabinet ───────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground px-1">
          Medal Cabinet
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <MedalBadge type="gold" />
          <MedalBadge type="silver" />
          <MedalBadge type="bronze" />
        </div>
        <p className="text-center text-xs text-muted-foreground pt-1">
          No Olympic medals yet · Qualify for {NEXT_OLYMPICS_YEAR} to compete
        </p>
      </div>

      {/* ── Participating nations ────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground px-1">
          {NEXT_OLYMPICS_YEAR} Olympic Field · Group Draw
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {GROUPS.map(group => (
            <div key={group} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/40 border-b border-border">
                <span className="text-xs font-black uppercase tracking-widest">Group {group}</span>
              </div>
              <div className="divide-y divide-border">
                {OLYMPIC_NATIONS.filter(n => n.group === group).map(nation => (
                  <div key={nation.country} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-2xl flex-shrink-0">{nation.flag}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm">{nation.country}</p>
                      <p className="text-xs text-muted-foreground truncate">{nation.players}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-bold">#{nation.seed}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground text-center pt-1">
          Draw shown for {NEXT_OLYMPICS_YEAR} · Subject to qualification results
        </p>
      </div>

      {/* ── Past Olympics ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground px-1">
          Olympic History
        </h2>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
            <span className="text-3xl">🇫🇷</span>
            <div className="flex-1">
              <p className="font-black text-sm">Paris 2024</p>
              <p className="text-xs text-muted-foreground">Beach Volleyball completed · 24 nations competed</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-muted-foreground">YOUR RESULT</p>
              <Badge variant="outline" className="text-[10px] gap-1 mt-1">
                <Lock className="h-2.5 w-2.5" /> Pre-career
              </Badge>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
