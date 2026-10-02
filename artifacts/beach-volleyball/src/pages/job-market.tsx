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

type JobMarket = {
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
  const { data, isLoading } = useQuery<JobMarket>({
    queryKey: ["job-market"],
    queryFn: () => get<JobMarket>("/api/job-market"),
  });

  const accept = useMutation({
    // U-3: a manager in a job resigns to take one (he is asked first).
    mutationFn: (poolTeamId: number) => post<{ clubName: string }>("/api/job-market/accept", { poolTeamId, resign: !data?.seeking }),
    onSuccess: (r) => {
      toast({ title: `You are the manager of ${r.clubName}`, description: "Your record comes with you." });
      window.location.href = "/";
    },
    onError: (err: Error) => toast({ title: "Could not take that job", description: err.message, variant: "destructive" }),
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
  const canTake = !!pick && pick.accepted && !pick.inWorldTourNow;

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-black tracking-tight">{data.seeking ? `${data.managerName} is looking for a club` : "Job Market"}</h1>
        <p className="text-muted-foreground">
          {data.seeking
            ? `${data.formerClub} is behind you. These clubs have no manager: their boards sacked the last one. Take a job and everything you have done comes with you (your seasons, achievements and reputation); the club comes with its own players and its own bank balance.`
            : `You manage ${data.formerClub}. These clubs have no manager. You can apply; taking one means resigning from ${data.formerClub}.`}
          {" "}You are Level {data.managerLevel} ({data.managerLevelName}).
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {data.vacancies.map((v) => (
          <Card
            key={v.poolTeamId}
            onClick={() => setPicked(v.poolTeamId)}
            data-testid={`card-vacancy-${v.poolTeamId}`}
            className={cn(
              "cursor-pointer transition-colors hover:border-primary/60",
              picked === v.poolTeamId && "border-2 border-primary bg-primary/5",
            )}
          >
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold leading-tight">{v.name}</span>
                <Badge variant="outline" className="gap-1 text-[10px] shrink-0">
                  <TrendingUp className="h-2.5 w-2.5" />{v.rating}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Globe className="h-3 w-3" />
                {v.continentName} · {v.tier} · ${v.budget.toLocaleString("en-US")} in the bank
              </div>
              <p className="text-xs">The board expects {v.expectation}.</p>
              {v.reason && <p className="text-xs text-muted-foreground">{v.reason}</p>}
              <p className={cn("text-xs font-medium", v.accepted && !v.inWorldTourNow ? "text-emerald-500" : "text-red-500")} data-testid={`vacancy-answer-${v.poolTeamId}`}>
                {v.inWorldTourNow ? "Playing this season's World Tour: the job can be taken once its season is over." : v.answer}
              </p>
            </CardContent>
          </Card>
        ))}
        {data.vacancies.length === 0 && (
          <Card className="border-2 border-dashed p-8 text-center md:col-span-2">
            <p className="text-sm text-muted-foreground">No club has a vacancy right now. AI managers are sacked at the season's end, by their boards (two failed seasons running).</p>
          </Card>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="lg"
          disabled={!canTake || accept.isPending}
          onClick={() => {
            if (!pick || !canTake) return;
            if (!data.seeking && !window.confirm(`Resign from ${data.formerClub} to take the ${pick.name} job?`)) return;
            accept.mutate(pick.poolTeamId);
          }}
          data-testid="button-take-job"
        >
          {accept.isPending ? "Taking the job…" : data.seeking ? "Take the job" : "Resign and take the job"}
        </Button>
        {data.seeking && <Button
          size="lg"
          variant="outline"
          className="gap-2"
          disabled={retire.isPending}
          onClick={() => retire.mutate()}
          data-testid="button-retire"
        >
          <DoorOpen className="h-4 w-4" />
          {retire.isPending ? "Retiring…" : "Retire instead"}
        </Button>}
        {data.seeking && <span className="text-xs text-muted-foreground">
          Retiring ends your career.
        </span>}
      </div>
    </div>
  );
}
