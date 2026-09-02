import { CONTINENT_KEYS, continentLabel } from "@shared/continents";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, Trophy, AlertCircle } from "lucide-react";

/**
 * Driven by the canonical KEYS. Each of these screens used to declare its own
 * array of continent LABELS; the copies drifted, and any screen whose spelling
 * did not match the data silently rendered nothing for that region. Labels are
 * looked up at render time via continentLabel().
 */
const CONTINENTS = CONTINENT_KEYS;

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
    staleTime: 60_000,
  });
}

export default function RegionalHistory() {
  const { data, isLoading, isError } = useQualifications();

  const byContinent = new Map<string, Qualification[]>();
  for (const q of data?.qualifications ?? []) {
    if (!byContinent.has(q.continent)) byContinent.set(q.continent, []);
    byContinent.get(q.continent)!.push(q);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Regional History</h1>
        <p className="text-muted-foreground mt-1">
          World Tour qualifiers produced by each continental league
        </p>
      </div>

      {isLoading && (
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 text-destructive text-sm p-3 rounded-lg border border-destructive/30 bg-destructive/5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load qualification history.
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {data?.seasonYear && (
            <div className="flex items-center gap-2 text-sm">
              <Trophy className="h-4 w-4 text-primary" />
              <span className="font-medium">Season {data.seasonYear} Qualifiers</span>
              <Badge variant="secondary">{data.qualifications.length} of 18</Badge>
            </div>
          )}

          {data?.qualifications.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No qualification history yet</p>
              <p className="text-sm mt-1 opacity-70">
                History will appear here after the first regional season completes.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CONTINENTS.map(continent => {
                const quals = byContinent.get(continent) ?? [];
                if (quals.length === 0) return (
                  <div key={continent} className="rounded-xl border bg-card p-4">
                    <h3 className="font-semibold text-sm mb-3">{continentLabel(continent)}</h3>
                    <p className="text-sm text-muted-foreground italic">No qualifiers yet</p>
                  </div>
                );
                return (
                  <div key={continent} className="rounded-xl border bg-card overflow-hidden">
                    <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
                      <h3 className="font-semibold text-sm">{continentLabel(continent)}</h3>
                      <Badge variant="secondary">{quals.length} qualifier{quals.length !== 1 ? "s" : ""}</Badge>
                    </div>
                    <div className="divide-y">
                      {quals
                        .sort((a, b) => a.qualifyingPosition - b.qualifyingPosition)
                        .map(q => (
                          <div key={q.id} className="px-4 py-2.5 flex items-center gap-3">
                            <span className={[
                              "text-sm font-bold w-6 text-center",
                              q.qualifyingPosition === 1 ? "text-yellow-500" :
                              q.qualifyingPosition === 2 ? "text-slate-400" :
                              "text-amber-700 dark:text-amber-500",
                            ].join(" ")}>
                              {q.qualifyingPosition === 1 ? "🥇" : q.qualifyingPosition === 2 ? "🥈" : "🥉"}
                            </span>
                            <span className="text-sm font-medium flex-1 truncate">{q.teamName}</span>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {q.qualifyingPosition === 1 ? "1st" : q.qualifyingPosition === 2 ? "2nd" : "3rd"}
                            </Badge>
                          </div>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
