import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Star, Lock, Globe, AlertCircle, CheckCircle2 } from "lucide-react";

const CONTINENTS = [
  "Europe", "Asia", "North America", "South America",
  "Africa and Middle East", "Australia and Pacific Islands",
] as const;

type Qualification = {
  id: number;
  seasonYear: number;
  continent: string;
  poolTeamId: number;
  teamName: string;
  qualifyingPosition: number;
};

type QualificationsData = {
  seasonYear: number | null;
  qualifications: Qualification[];
};

function useQualifications() {
  return useQuery<QualificationsData>({
    queryKey: ["regional-league-qualifications"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/regional-league/qualifications", { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 30_000,
  });
}

const MEDAL_ICONS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function posLabel(pos: number) {
  if (pos === 1) return "1st";
  if (pos === 2) return "2nd";
  return "3rd";
}

export default function QualifiedTeams() {
  const { data, isLoading, isError } = useQualifications();

  const byContinent = new Map<string, Qualification[]>();
  for (const q of data?.qualifications ?? []) {
    if (!byContinent.has(q.continent)) byContinent.set(q.continent, []);
    byContinent.get(q.continent)!.push(q);
  }

  const totalQualified = data?.qualifications.length ?? 0;
  const allComplete = totalQualified >= 18;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">World Tour Qualified Teams</h1>
        <p className="text-muted-foreground mt-1">
          18 teams (3 per continent) advance from regional leagues to the World Tour
        </p>
      </div>

      {/* Status banner */}
      {!isLoading && !isError && (
        <div className={cn(
          "flex items-center gap-3 rounded-lg border p-4",
          allComplete
            ? "bg-emerald-500/5 border-emerald-500/30"
            : "bg-muted/30 border-border",
        )}>
          {allComplete ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          ) : (
            <Lock className="h-5 w-5 text-muted-foreground shrink-0" />
          )}
          <div>
            <p className="text-sm font-medium">
              {allComplete
                ? "All 18 qualifiers confirmed — World Tour is open"
                : `${totalQualified} / 18 qualifiers confirmed`}
            </p>
            {!allComplete && (
              <p className="text-xs text-muted-foreground mt-0.5">
                All six regional leagues must complete Round 10 before the full list is confirmed.
              </p>
            )}
          </div>
          {data?.seasonYear && (
            <Badge variant="secondary" className="ml-auto shrink-0">Season {data.seasonYear}</Badge>
          )}
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CONTINENTS.map(c => (
            <div key={c} className="rounded-xl border bg-card p-4 space-y-3">
              <Skeleton className="h-5 w-40" />
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 text-destructive text-sm p-3 rounded-lg border border-destructive/30 bg-destructive/5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load qualification data.
        </div>
      )}

      {!isLoading && !isError && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CONTINENTS.map(continent => {
            const quals = (byContinent.get(continent) ?? []).sort(
              (a, b) => a.qualifyingPosition - b.qualifyingPosition,
            );
            const filled = quals.length;
            return (
              <div key={continent} className="rounded-xl border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">{continent}</h3>
                  </div>
                  <Badge
                    variant={filled >= 3 ? "default" : "outline"}
                    className={cn(
                      "text-xs",
                      filled >= 3 && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20",
                    )}
                  >
                    {filled}/3
                  </Badge>
                </div>

                <div className="divide-y">
                  {[1, 2, 3].map(pos => {
                    const q = quals.find(q => q.qualifyingPosition === pos);
                    return (
                      <div
                        key={pos}
                        className={cn(
                          "px-4 py-3 flex items-center gap-3",
                          q ? "opacity-100" : "opacity-40",
                        )}
                      >
                        <span className="text-lg w-7 shrink-0 text-center">
                          {MEDAL_ICONS[pos]}
                        </span>
                        <div className="flex-1 min-w-0">
                          {q ? (
                            <>
                              <p className="text-sm font-medium truncate">{q.teamName}</p>
                              <p className="text-xs text-muted-foreground">Regional {posLabel(pos)}</p>
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">
                              Pending regional round 10
                            </p>
                          )}
                        </div>
                        {q ? (
                          <Badge className="text-xs shrink-0 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
                            <Star className="h-2.5 w-2.5 mr-1" />
                            Qualified
                          </Badge>
                        ) : (
                          <Lock className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
