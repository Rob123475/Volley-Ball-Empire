/**
 * 1.1.3 (Rob, 23 Oct; brief A4c): the National Team page, in the side menu under
 * Empire Nations Cup while the player coaches a nation.
 *
 *   - his nation's available players: every player of that nationality at any
 *     club (never a free agent), with injuries and fitness; an injured player
 *     can't be picked
 *   - pick the pair for the next Cup; not picked by the Cup's first day, the
 *     best two fit players play, as for every other nation
 *   - the short pre-Cup camp: training (a small rating bonus for the Cup, some
 *     fatigue) or recovery (fitness back up)
 *   - his contract: nation, years left, pay
 *
 * Server: GET/POST /national-team (routes/national-team.ts, utils/nationalCoach.ts).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Flag } from "@/components/flag";
import { useToast } from "@/hooks/use-toast";
import { gameDateText } from "@/lib/game-date";
import { cn } from "@/lib/utils";
import { Dumbbell, HeartPulse, Lock, Users } from "lucide-react";

type Kind = "player" | "pool";
type NationalPlayer = { kind: Kind; id: number; name: string; club: string; rating: number; injured: boolean; injuryWeeks: number; fitness: number | null; fatigue: number | null };
type Job = { nation: string; years: number; monthly: number; startedOn: string; endsOn: string; paid: number; yearsLeft: number; daysLeft: number };
type View = {
  today: string; job: Job; players: NationalPlayer[]; cupYear: number; cupStartsOn: string; locked: boolean;
  pair: Array<{ kind: Kind; id: number }> | null; camp: "training" | "recovery" | null;
  camps: { trainingBonus: number; trainingFatigue: number; recoveryFitness: number };
};

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const key = (p: { kind: Kind; id: number }) => `${p.kind}:${p.id}`;

export default function NationalTeam() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, error } = useQuery<View>({
    queryKey: ["national-team"],
    queryFn: async () => { const r = await fetch("/api/national-team", { credentials: "same-origin" }); if (!r.ok) throw new Error((await r.json())?.error ?? `HTTP ${r.status}`); return r.json(); },
  });
  const [chosen, setChosen] = useState<string[] | null>(null);
  const post = (path: string, body: unknown) => fetch(path, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    .then(async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b?.error ?? `HTTP ${r.status}`); return b; });
  const savePair = useMutation({
    mutationFn: (pair: Array<{ kind: Kind; id: number }>) => post("/api/national-team/pair", { pair }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["national-team"] }); setChosen(null); toast({ title: "Pair picked", description: "They play the Cup for you, if both are still fit on its first day." }); },
    onError: (e: Error) => toast({ title: "Not picked", description: e.message, variant: "destructive" }),
  });
  const saveCamp = useMutation({
    mutationFn: (camp: "training" | "recovery") => post("/api/national-team/camp", { camp }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["national-team"] }),
    onError: (e: Error) => toast({ title: "Not chosen", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="space-y-4">{[1, 2].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}</div>;
  if (error || !data) return <Card><CardContent className="p-6 text-muted-foreground">{(error as Error)?.message ?? "You don't coach a nation."}</CardContent></Card>;

  const saved = data.pair?.map(key) ?? [];
  const picked = chosen ?? saved;
  const fit = data.players.filter((p) => !p.injured);
  const defaultPair = fit.slice(0, 2).map(key);
  const toggle = (p: NationalPlayer) => {
    if (p.injured || data.locked) return;
    const k = key(p);
    const now = picked.includes(k) ? picked.filter((x) => x !== k) : [...picked, k].slice(-2);
    setChosen(now);
  };

  return (
    <div className="space-y-6" data-testid="national-team-page">
      <div className="flex flex-wrap items-center gap-4">
        <Flag nation={data.job.nation} size={44} />
        <div>
          <h1 className="text-2xl font-black tracking-tight">{data.job.nation} National Team</h1>
          <p className="text-sm text-muted-foreground" data-testid="national-team-contract">
            Your contract: {data.job.years} years, {data.job.yearsLeft} left (to {gameDateText(data.job.endsOn)}) · {money(data.job.monthly)} a month, your own pay · {money(data.job.paid)} earned so far
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex flex-wrap items-center gap-2">
            <Users className="h-4 w-4" /> The pair for the {data.cupYear} Empire Nations Cup
            <Badge variant="outline">from {gameDateText(data.cupStartsOn)}</Badge>
            {data.locked && <Badge className="gap-1"><Lock className="h-3 w-3" /> Drawn: the pairs are set</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Every {data.job.nation} player at a club. Pick two fit players. If you don't pick by the Cup's first day, the best two fit players play
            {defaultPair.length === 2 ? ` (now ${fit[0]!.name} and ${fit[1]!.name})` : ""}. {data.players.length < 2 ? `${data.job.nation} has too few players at clubs to field a pair.` : ""}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.players.map((p) => {
              const on = picked.includes(key(p));
              return (
                <button
                  key={key(p)}
                  type="button"
                  onClick={() => toggle(p)}
                  disabled={p.injured || data.locked}
                  data-testid="national-player"
                  data-injured={p.injured ? "1" : "0"}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                    on ? "border-amber-400 bg-amber-400/10" : "border-border bg-card hover:bg-muted/40",
                    (p.injured || data.locked) && "opacity-60 cursor-not-allowed",
                  )}
                >
                  <Flag nation={data.job.nation} size={14} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{p.name} <span className="text-muted-foreground font-normal">· {p.club}</span></div>
                    <div className="text-xs text-muted-foreground">
                      Rating {Math.round(p.rating)}
                      {p.fitness != null && ` · fitness ${Math.round(p.fitness)}`}
                      {p.fatigue != null && ` · fatigue ${Math.round(p.fatigue)}`}
                    </div>
                  </div>
                  {p.injured
                    ? <Badge variant="destructive" data-testid="national-player-injured">Injured{p.injuryWeeks > 0 ? `, ${p.injuryWeeks} wk` : ""}</Badge>
                    : on ? <Badge>Picked</Badge> : null}
                </button>
              );
            })}
          </div>
          {!data.locked && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => {
                  const pair = picked.map((k) => { const [kind, id] = k.split(":"); return { kind: kind as Kind, id: Number(id) }; });
                  savePair.mutate(pair);
                }}
                disabled={picked.length !== 2 || savePair.isPending || (chosen == null && saved.length === 2)}
                data-testid="national-pair-save"
              >
                Pick this pair
              </Button>
              <span className="text-xs text-muted-foreground">{saved.length === 2 ? "Your pair is picked." : "No pair picked yet: the best two fit play."}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">The pre-Cup camp</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">A short camp before the Cup. Its effect lasts for the Cup only.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              { id: "training", icon: Dumbbell, title: "Training", text: `The pair plays the Cup ${data.camps.trainingBonus} better, and comes out with ${data.camps.trainingFatigue} more fatigue.` },
              { id: "recovery", icon: HeartPulse, title: "Recovery", text: `The pair starts the Cup at fitness ${data.camps.recoveryFitness}, with no fatigue.` },
            ] as const).map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={data.locked || saveCamp.isPending}
                onClick={() => saveCamp.mutate(c.id)}
                data-testid={`national-camp-${c.id}`}
                className={cn("rounded-lg border p-3 text-left", data.camp === c.id ? "border-amber-400 bg-amber-400/10" : "border-border bg-card hover:bg-muted/40", data.locked && "opacity-60")}
              >
                <div className="flex items-center gap-2 font-semibold"><c.icon className="h-4 w-4" /> {c.title} {data.camp === c.id && <Badge>Chosen</Badge>}</div>
                <p className="text-xs text-muted-foreground mt-1">{c.text}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
