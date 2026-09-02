import { continentKeyFrom, continentLabel, type ContinentKey } from "@shared/continents";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Medal, Trophy, Globe } from "lucide-react";

type QualTeam = {
  country: string;
  flag: string;
  continent: string;
  teamRating: number;
  rank: number;
  qualStatus: "qualified" | "bubble" | "not_qualified";
  topPlayers: Array<{ name: string; rating: number; imageUrl: string | null }>;
};

type QualContinent = {
  continent: string;
  spots: number;
  teams: QualTeam[];
};

type QualData = {
  olympicsYear: number;
  totalSpots: number;
  continents: QualContinent[];
};

const STATUS_CONFIG = {
  qualified:    { label: "Qualified",    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",  dot: "bg-emerald-400" },
  bubble:       { label: "Bubble",       badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",         dot: "bg-amber-400"   },
  not_qualified:{ label: "Out",          badge: "bg-muted text-muted-foreground border-muted",                dot: "bg-muted-foreground/30" },
};

// Keyed by ContinentKey so a spelling change cannot quietly blank the flags.
const CONTINENT_FLAG: Record<ContinentKey, string> = {
  europe:             "🌍",
  asia:               "🌏",
  north_america:      "🌎",
  south_america:      "🌎",
  africa_middle_east: "🌍",
  oceania:            "🌊",
};

/** Flag for any continent value, canonical or not — an unknown one still renders. */
function continentFlag(value: string | null | undefined): string {
  const key = continentKeyFrom(value);
  return key ? CONTINENT_FLAG[key] : "🌍";
}

export default function OlympicQualifiers() {
  const { data, isLoading } = useQuery<QualData>({
    queryKey: ["olympic-qualifiers"],
    queryFn: () => fetch("/api/olympics/qualifiers").then(r => r.json()),
    staleTime: 120_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1,2,3].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
      </div>
    );
  }

  if (!data) return null;

  const olympicsYear = data.olympicsYear;
  const totalQualified = data.continents.reduce((sum, c) => sum + c.teams.filter(t => t.qualStatus === "qualified").length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Medal className="h-5 w-5 text-amber-400" />
            <h2 className="text-xl font-bold">{olympicsYear} Olympic Qualifying</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Top-ranked national pairs per continent qualify for the Olympic Games.
            Rankings based on combined player ratings.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-center">
            <div className="text-2xl font-black text-emerald-400">{totalQualified}</div>
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">Qualified</div>
          </div>
          <div className="text-muted-foreground">/</div>
          <div className="text-center">
            <div className="text-2xl font-black text-foreground">{data.totalSpots}</div>
            <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">Total Spots</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {(Object.entries(STATUS_CONFIG) as [string, typeof STATUS_CONFIG[keyof typeof STATUS_CONFIG]][]).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={cn("h-2 w-2 rounded-full", cfg.dot)} />
            {cfg.label}
          </div>
        ))}
      </div>

      {/* Per-continent standings */}
      <div className="grid gap-4 md:grid-cols-2">
        {data.continents.map(cont => (
          <div key={cont.continent} className="rounded-xl border bg-card overflow-hidden">
            {/* Continent header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <span className="text-base">{continentFlag(cont.continent)}</span>
                <span className="font-bold text-sm">{continentLabel(cont.continent)}</span>
              </div>
              <Badge variant="outline" className="text-[11px]">
                <Trophy className="h-2.5 w-2.5 mr-1 text-amber-400" />
                {cont.spots} spot{cont.spots !== 1 ? "s" : ""}
              </Badge>
            </div>

            {/* Teams table */}
            <div className="divide-y">
              {cont.teams.slice(0, cont.spots + 3).map(team => {
                const cfg = STATUS_CONFIG[team.qualStatus];
                return (
                  <div
                    key={team.country}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 transition-colors",
                      team.qualStatus === "qualified" ? "bg-emerald-950/10" :
                      team.qualStatus === "bubble"    ? "bg-amber-950/10"   : "",
                    )}
                  >
                    {/* Rank */}
                    <div className="text-xs font-black text-muted-foreground/60 w-5 shrink-0 tabular-nums">
                      {team.rank}
                    </div>

                    {/* Flag + country */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-base leading-none">{team.flag}</span>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{team.country}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {team.topPlayers.map(p => p.name).join(" / ")}
                        </div>
                      </div>
                    </div>

                    {/* Rating */}
                    <div className="text-sm font-bold tabular-nums shrink-0 text-muted-foreground">
                      {team.teamRating}
                    </div>

                    {/* Status badge */}
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] shrink-0 font-bold px-1.5", cfg.badge)}
                    >
                      {cfg.label}
                    </Badge>
                  </div>
                );
              })}
              {cont.teams.length > cont.spots + 3 && (
                <div className="px-4 py-2 text-xs text-muted-foreground">
                  +{cont.teams.length - cont.spots - 3} more countries
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Allocation footnote */}
      <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
        <Globe className="h-3 w-3" />
        Qualifying rankings update as players develop throughout the season.
        Final spots confirmed at season end.
      </p>
    </div>
  );
}
