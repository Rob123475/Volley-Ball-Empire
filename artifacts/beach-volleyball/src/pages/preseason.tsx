/**
 * Update 1, overnight brief part 5 (Rob, 14 Oct, item 5): the pre-season
 * choice. On day 7 of the off-season: a camp (three places, three lengths), Rest
 * or Skip. The server decides what can be booked (GET /preseason): a camp must
 * end before the club's first match of the new season, and the club must be
 * able to pay for it.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { gameDateText } from "@/lib/game-date";

type LengthRow = { length: "1w" | "2w" | "4w"; endsOn: string; allowed: boolean; reason: string | null };
type Preseason = {
  offseason: boolean; today: string;
  seasonYear?: number; choiceOn?: string; firstMatchOn?: string; open?: boolean; balance?: number;
  choice?: { choice: string; location: string | null; length: string | null; startsOn: string | null; endsOn: string | null; cost: number; done: boolean } | null;
  lengths?: LengthRow[];
  locations?: Record<string, { name: string; builds: string }>;
  lengthTable?: Record<string, { label: string; days: number; sessions: number; xp: number; cost: number; fatigue: number }>;
};

export const PRESEASON_QUERY_KEY = ["preseason"] as const;

export function usePreseason() {
  return useQuery<Preseason>({
    queryKey: PRESEASON_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/preseason", { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export default function PreseasonPage() {
  const { data, isLoading } = usePreseason();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [location, setLocation] = useState<string>("altitude");
  const [busy, setBusy] = useState(false);

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!data?.offseason) {
    return (
      <div className="space-y-2">
        <h1 className="text-3xl font-black tracking-tight text-primary">Pre-season</h1>
        <p className="text-muted-foreground">The pre-season choice comes on day 7 of the off-season, after your last match of the season.</p>
      </div>
    );
  }

  const choose = async (body: Record<string, string>) => {
    setBusy(true);
    try {
      const res = await fetch("/api/preseason", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out?.error ?? `HTTP ${res.status}`);
      toast({ title: body.choice === "camp" ? "Camp booked" : body.choice === "rest" ? "The squad will rest" : "Skipped" });
      queryClient.invalidateQueries();
    } catch (err) {
      toast({ title: "Not booked", description: String((err as Error).message), variant: "destructive" });
    } finally { setBusy(false); }
  };

  const c = data.choice;
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-black tracking-tight text-primary">Pre-season</h1>
        <p className="text-muted-foreground">
          Your first match of next season is on {gameDateText(data.firstMatchOn)}. A camp must end before it. Seniors only: the academy carries on as normal.
          {!data.open && !c && ` The choice opens on ${gameDateText(data.choiceOn)}.`}
        </p>
      </div>

      {c && (
        <Card data-testid="preseason-chosen">
          <CardContent className="p-4">
            {c.choice === "camp" ? (
              <p><span className="font-bold">{data.locations?.[c.location ?? ""]?.name}</span>, {data.lengthTable?.[c.length ?? ""]?.label}: {gameDateText(c.startsOn)} to {gameDateText(c.endsOn)} ({money(c.cost)}).
                {c.done ? " Done." : " No normal training for your seniors while they are there."}</p>
            ) : c.choice === "rest" ? (
              <p><span className="font-bold">Rest.</span> No training for the rest of the off-season; every senior who isn't injured starts the season at fitness 100, fatigue 0 and morale +5.</p>
            ) : (
              <p><span className="font-bold">Skipped.</span> Nothing special this off-season.</p>
            )}
          </CardContent>
        </Card>
      )}

      {!c && data.open && (
        <>
          <Card>
            <CardContent className="p-4 space-y-4">
              <p className="font-bold">A camp</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {Object.entries(data.locations ?? {}).map(([key, loc]) => (
                  <button key={key} type="button" onClick={() => setLocation(key)} data-testid={`camp-${key}`}
                    className={cn("rounded-lg border p-3 text-left", location === key ? "border-primary bg-primary/10" : "border-border")}>
                    <p className="font-semibold">{loc.name}</p>
                    <p className="text-xs text-muted-foreground">Builds {loc.builds}</p>
                  </button>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {(data.lengths ?? []).map((l) => {
                  const t = data.lengthTable?.[l.length];
                  return (
                    <div key={l.length} className="rounded-lg border p-3 space-y-1 text-sm">
                      <p className="font-semibold">{t?.label}</p>
                      <p className="text-xs text-muted-foreground">{t?.sessions} sessions at ×{t?.xp} XP · {money(t?.cost ?? 0)} · fatigue +{t?.fatigue} at the end · ends {gameDateText(l.endsOn)}</p>
                      {l.reason && <p className="text-[11px] text-red-500">{l.reason}</p>}
                      <Button size="sm" className="w-full" disabled={busy || !l.allowed} onClick={() => choose({ choice: "camp", location, length: l.length })} data-testid={`book-${l.length}`}>
                        Book
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={() => choose({ choice: "rest" })} data-testid="preseason-rest">Rest (free)</Button>
            <Button variant="ghost" disabled={busy} onClick={() => choose({ choice: "skip" })} data-testid="preseason-skip">Skip</Button>
          </div>
        </>
      )}
    </div>
  );
}
