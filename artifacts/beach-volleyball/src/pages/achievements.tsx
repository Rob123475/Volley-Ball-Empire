import { useState, useRef, useEffect } from "react";
import {
  useGetAchievements,
  getGetAchievementsQueryKey,
} from "@workspace/api-client-react";
import type { AchievementStatus } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Trophy,
  Lock,
  CheckCircle2,
  Star,
  DollarSign,
  Users,
  Globe,
  Flame,
} from "lucide-react";

// ── Category config ───────────────────────────────────────────────────────────

type Category = "all" | "career" | "finance" | "youth" | "competition" | "legacy";

const CATEGORIES: { id: Category; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "all",         label: "All",         icon: Trophy    },
  { id: "career",      label: "Career",      icon: Star      },
  { id: "finance",     label: "Finance",     icon: DollarSign },
  { id: "youth",       label: "Youth",       icon: Users     },
  { id: "competition", label: "Competition", icon: Trophy    },
  { id: "legacy",      label: "Legacy",      icon: Flame     },
];

const CATEGORY_COLORS: Record<string, string> = {
  career:      "bg-blue-500/10 text-blue-400 border-blue-500/20",
  finance:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  youth:       "bg-purple-500/10 text-purple-400 border-purple-500/20",
  competition: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  legacy:      "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatProgress(current: number, target: number): string {
  if (target >= 1_000_000) return `$${(current / 1_000_000).toFixed(2)}M / $${(target / 1_000_000).toFixed(0)}M`;
  if (target >= 100_000)   return `$${Math.round(current / 1000)}k / $${Math.round(target / 1000)}k`;
  return `${current} / ${target}`;
}

function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return "";
  const d = new Date(isoString);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── Achievement card ──────────────────────────────────────────────────────────

function AchievementCard({ a }: { a: AchievementStatus }) {
  const pct = Math.min(100, Math.round((a.progress.current / a.progress.target) * 100));
  const categoryStyle = CATEGORY_COLORS[a.category] ?? "";

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-all",
        a.unlocked
          ? "bg-card border-border shadow-sm"
          : "bg-muted/30 border-border/40 opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            "mt-0.5 h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
            a.unlocked ? "bg-yellow-500/15" : "bg-muted",
          )}
        >
          {a.unlocked ? (
            <Trophy className="h-5 w-5 text-yellow-400" />
          ) : (
            <Lock className="h-4 w-4 text-muted-foreground/50" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={cn("text-sm font-semibold", a.unlocked ? "text-foreground" : "text-muted-foreground")}>
              {a.name}
            </h3>
            {a.unlocked && <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />}
            <Badge variant="outline" className={cn("text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0 border", categoryStyle)}>
              {a.category}
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{a.description}</p>

          {/* Unlock date / season */}
          {a.unlocked && (a.unlockedAt || a.seasonUnlocked) && (
            <p className="text-[11px] text-green-400/80 mt-1 font-medium">
              {a.seasonUnlocked ? `Season ${a.seasonUnlocked}` : ""}
              {a.seasonUnlocked && a.unlockedAt ? " · " : ""}
              {a.unlockedAt ? formatDate(a.unlockedAt) : ""}
            </p>
          )}

          {/* Progress */}
          {!a.unlocked && a.progress.target > 1 && (
            <div className="mt-2 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-muted-foreground">Progress</span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {formatProgress(a.progress.current, a.progress.target)}
                </span>
              </div>
              <Progress value={pct} className="h-1.5" />
            </div>
          )}
          {a.unlocked && a.progress.target > 1 && (
            <div className="mt-2 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-muted-foreground">Completed</span>
                <span className="text-[11px] font-mono text-green-400">
                  {formatProgress(a.progress.target, a.progress.target)}
                </span>
              </div>
              <Progress value={100} className="h-1.5 [&>div]:bg-green-500" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Achievements() {
  const [activeCategory, setActiveCategory] = useState<Category>("all");

  const { data: achievements, isLoading } = useGetAchievements({
    query: { queryKey: getGetAchievementsQueryKey() },
  });

  const filtered = achievements?.filter(
    (a) => activeCategory === "all" || a.category === activeCategory,
  ) ?? [];

  const unlockedCount = achievements?.filter((a) => a.unlocked).length ?? 0;
  const total = achievements?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Trophy className="h-6 w-6 text-yellow-400" />
          Achievements
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Long-term goals for your beach volleyball career.
        </p>
      </div>

      {/* Summary bar */}
      <div className="rounded-xl border bg-card p-4 flex items-center gap-4">
        <div className="flex-1">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm font-mono text-muted-foreground">
              {unlockedCount} / {total} unlocked
            </span>
          </div>
          <Progress value={total > 0 ? Math.round((unlockedCount / total) * 100) : 0} className="h-2" />
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-bold text-yellow-400">{total > 0 ? Math.round((unlockedCount / total) * 100) : 0}%</p>
          <p className="text-[11px] text-muted-foreground uppercase tracking-widest">Complete</p>
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => {
          const CatIcon = cat.icon;
          const count = cat.id === "all"
            ? achievements?.length ?? 0
            : achievements?.filter((a) => a.category === cat.id).length ?? 0;
          const unlockedInCat = cat.id === "all"
            ? unlockedCount
            : achievements?.filter((a) => a.category === cat.id && a.unlocked).length ?? 0;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                activeCategory === cat.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground",
              )}
            >
              <CatIcon className="h-3 w-3" />
              {cat.label}
              <span className={cn(
                "text-[10px] rounded-full px-1.5 py-0 font-mono",
                activeCategory === cat.id ? "bg-primary-foreground/20" : "bg-muted",
              )}>
                {unlockedInCat}/{count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Achievement grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-muted/30 h-24 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Globe className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>No achievements in this category yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Unlocked first */}
          {[...filtered].sort((a, b) => {
            if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
            return 0;
          }).map((a) => (
            <AchievementCard key={a.key} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}
