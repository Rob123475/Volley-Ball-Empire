/**
 * The job market — where a manager goes when the club is sold.
 *
 * L-02e, Rob's rule: five loss-making seasons and the club is sold. The
 * manager is shown real clubs with vacancies and may take one, keeping
 * everything that is theirs; declining them all is retirement.
 *
 * This is the only screen that works while a career has no club: every club
 * route answers "no team" until one is taken, which is why the calendar sends
 * the player straight here (hooks/use-calendar.ts) rather than to the
 * career-end screen. The career is not over.
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Globe, TrendingUp, DoorOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Vacancy = {
  poolTeamId: number;
  name: string;
  continent: string;
  continentName: string;
  rating: number;
  // Daytime 2 Oct, U-3: a real vacancy (its AI manager was sacked).
  budget: number;
  tier: string;
  expectation: string;
  reason: string | null;
  levelNeeded: number;
  levelNeededName: string;
  /** Whether the club would have this manager, and why (in plain words). */
  accepted: boolean;
  answer: string;
  inWorldTourNow: boolean;
};

type Offer = { poolTeamId: number; name: string; rating: number; why: string };

type JobMarket = {
  employed: boolean;
  window: boolean;
  windowText: string;
  verdict: string | null;
  leaving: string | null;
  pending: { poolTeamId: number; name: string } | null;
  offers: Offer[];
  seeking: boolean;
  managerName: string;
  formerClub: string;
  managerLevel: number;
  managerLevelName: string;
  vacancies: Vacancy[];
};

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(String(res.status));
  return res.json() as Promise<T>;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? String(res.status));
  return res.json() as Promise<T>;
}

export default function JobMarketPage() {
  const { toast } = useToast();
  const [picked, setPicked] = useState<number | null>(null);
  const { data, isLoading, refetch } = useQuery<JobMarket>({
    queryKey: ["job-market"],
    queryFn: () => get<JobMarket>("/api/job-market"),
  });

  // Afternoon 2 Oct (J-3): an application or an offer accepted in the window
  // is a move agreed for the start of next season.
  const apply = useMutation({
    mutationFn: (poolTeamId: number) => post<{ accepted: boolean; reason: string }>("/api/job-market/apply", { poolTeamId }),
    onSuccess: (r) => { toast({ title: r.accepted ? "Agreed: you move at the start of next season" : "Turned down", description: r.reason, variant: r.accepted ? undefined : "destructive" }); refetch(); },
    onError: (err: Error) => toast({ title: "Not now", description: err.message, variant: "destructive" }),
  });
  const answer = useMutation({
    mutationFn: ({ id, yes }: { id: number; yes: boolean }) => post<{ club: string }>(`/api/job-market/offers/${id}/${yes ? "accept" : "decline"}`, {}),
    onSuccess: (r, v) => { toast({ title: v.yes ? `Agreed with ${r.club}: you move at the start of next season` : `Declined ${r.club}` }); refetch(); },
    onError: (err: Error) => toast({ title: "Not now", description: err.message, variant: "destructive" }),
  });
  const retire = useMutation({
    mutationFn: () => post<{ retired: boolean }>("/api/job-market/retire", {}),
    onSuccess: () => { window.location.href = "/career-end"; },
    onError: (err: Error) => toast({ title: "Could not retire", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="mx-auto max-w-4xl p-8 space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }
  if (!data) return null;
  const pick = data.vacancies.find((v) => v.poolTeamId === picked) ?? null;

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-black tracking-tight">Job Market</h1>
        <p className="text-muted-foreground" data-testid="job-market-window">{data.windowText}</p>
        <p className="text-muted-foreground">You manage {data.formerClub}. You are Level {data.managerLevel} ({data.managerLevelName}).</p>
        {data.verdict && <p className="text-red-500 font-semibold" data-testid="job-market-verdict">{data.verdict}</p>}
        {data.leaving && <p className="text-amber-500">You are leaving {data.formerClub} at the end of the season ({data.leaving.replace("_", " ")}).</p>}
        {data.pending && <p className="text-emerald-500 font-semibold" data-testid="job-market-pending">Agreed: you join {data.pending.name} at the start of next season.</p>}
      </div>

      {data.window && data.offers.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-bold">Offers</h2>
          {data.offers.map((o) => (
            <Card key={o.poolTeamId} data-testid={`card-offer-${o.poolTeamId}`}>
              <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1"><span className="font-bold">{o.name}</span> <Badge variant="outline">{o.rating}</Badge><p className="text-xs text-muted-foreground">{o.why}</p></div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => answer.mutate({ id: o.poolTeamId, yes: true })}>Accept</Button>
                  <Button size="sm" variant="outline" onClick={() => answer.mutate({ id: o.poolTeamId, yes: false })}>Decline</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <h2 className="text-xl font-bold">Vacancies</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {data.vacancies.map((v) => (
          <Card key={v.poolTeamId} onClick={() => setPicked(v.poolTeamId)} data-testid={`card-vacancy-${v.poolTeamId}`}
            className={cn("cursor-pointer transition-colors hover:border-primary/60", picked === v.poolTeamId && "border-2 border-primary bg-primary/5")}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold leading-tight">{v.name}</span>
                <Badge variant="outline" className="gap-1 text-[10px] shrink-0"><TrendingUp className="h-2.5 w-2.5" />{v.rating}</Badge>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Globe className="h-3 w-3" />{v.continentName} · {v.tier} · ${v.budget.toLocaleString("en-US")} in the bank</div>
              <p className="text-xs">The board expects {v.expectation}.</p>
              {v.reason && <p className="text-xs text-muted-foreground">{v.reason}</p>}
              <p className={cn("text-xs font-medium", v.accepted ? "text-emerald-500" : "text-red-500")} data-testid={`vacancy-answer-${v.poolTeamId}`}>{v.answer}</p>
            </CardContent>
          </Card>
        ))}
        {data.vacancies.length === 0 && (
          <Card className="border-2 border-dashed p-8 text-center md:col-span-2">
            <p className="text-sm text-muted-foreground">No club has a vacancy right now. AI managers are sacked at their season's end, by their boards (two failed seasons running).</p>
          </Card>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" disabled={!data.window || !pick || apply.isPending} onClick={() => pick && apply.mutate(pick.poolTeamId)} data-testid="button-apply">
          {apply.isPending ? "Applying…" : "Apply"}
        </Button>
        {data.window && (
          <Button size="lg" variant="outline" className="gap-2" disabled={retire.isPending} onClick={() => { if (window.confirm("Retire at the end of this season? Your career ends.")) retire.mutate(); }} data-testid="button-retire">
            <DoorOpen className="h-4 w-4" />{retire.isPending ? "Retiring…" : "Retire"}
          </Button>
        )}
      </div>
    </div>
  );
}
