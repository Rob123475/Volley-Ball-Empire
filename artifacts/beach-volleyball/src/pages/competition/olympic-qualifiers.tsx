import { Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Medal, Globe } from "lucide-react";

type QualPlayer = {
  kind: "player" | "pool";
  id: number;
  name: string;
  nationality: string;
  clubs: string[];
  points: number;
  matches: number;
};

type QualCountry = {
  rank: number;
  country: string;
  flag: string;
  continent: string | null;
  points: number;
  bestPlayerPoints: number;
  qualified: boolean;
  resolved: boolean;
  players: QualPlayer[];
};

type QualData = {
  olympicsYear: number;
  seasonYear: number;
  totalSpots: number;
  countries: QualCountry[];
};

/**
 * R-46: Olympic qualifying is national. A country's total is the World Tour
 * ranking points its players earned this season, whichever club they play for;
 * the top 12 qualify, ties broken by the best single-player total. Ratings play
 * no part — this replaced per-continent spots decided by player ratings.
 */
export default function OlympicQualifiers() {
  const { data, isLoading } = useQuery<QualData>({
    queryKey: ["olympic-qualifiers"],
    queryFn: () => fetch("/api/olympics/qualifiers").then(r => r.json()),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div>
    );
  }

  if (!data || !Array.isArray(data.countries)) return null;

  const qualifiedCount = data.countries.filter(c => c.qualified).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Medal className="h-5 w-5 text-amber-400" />
            <h2 className="text-xl font-bold">{data.olympicsYear} Olympic Qualifying</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            National teams qualify on the World Tour ranking points their players earned in the {data.seasonYear} season:
            the sum across all of a country's players, whichever club they play for.
          </p>
          <p className="text-sm text-muted-foreground">
            The top {data.totalSpots} countries qualify; ties are broken by the best single-player total.
            Player ratings play no part.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-center">
            <div className="text-2xl font-black text-emerald-400">{qualifiedCount}</div>
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">Qualified</div>
          </div>
          <div className="text-muted-foreground">/</div>
          <div className="text-center">
            <div className="text-2xl font-black text-foreground">{data.totalSpots}</div>
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">Spots</div>
          </div>
        </div>
      </div>

      {data.countries.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          No World Tour ranking points have been earned this season yet. Qualifying starts with the first World Tour match.
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden divide-y" data-testid="olympic-qualifying-table">
          {data.countries.map(c => (
            <Fragment key={c.country}>
              {c.rank === data.totalSpots + 1 && (
                <div className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-muted/40">
                  Qualification line — top {data.totalSpots}
                </div>
              )}
              <div className={cn("flex items-center gap-3 px-4 py-2.5", c.qualified && "bg-emerald-950/10")}>
                <div className="text-xs font-black text-muted-foreground/60 w-6 shrink-0 tabular-nums">{c.rank}</div>
                <span className="text-base leading-none shrink-0">{c.flag}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">
                    {c.country}
                    {!c.resolved && <span className="ml-2 text-[10px] text-amber-400">(unrecognised nationality)</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {c.players.filter(p => p.points > 0)
                      .map(p => `${p.name} ${p.points} (${p.clubs.join(", ")})`)
                      .join(" · ") || "No points yet this season"}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold tabular-nums">{c.points} pts</div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">best {c.bestPlayerPoints}</div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] shrink-0 font-bold px-1.5",
                    c.qualified
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : "bg-muted text-muted-foreground border-muted",
                  )}
                >
                  {c.qualified ? "Qualified" : "Out"}
                </Badge>
              </div>
            </Fragment>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
        <Globe className="h-3 w-3" />
        The table moves with every World Tour result, and starts again from zero each season.
      </p>
    </div>
  );
}
