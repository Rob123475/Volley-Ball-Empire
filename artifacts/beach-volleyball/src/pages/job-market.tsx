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
  inRegionalLeague: boolean;
};

type JobMarket = {
  seeking: boolean;
  managerName: string;
  formerClub: string;
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
    mutationFn: (poolTeamId: number) => post<{ clubName: string }>("/api/job-market/accept", { poolTeamId }),
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

  if (!data?.seeking) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center space-y-4">
        <Building2 className="mx-auto h-10 w-10 text-muted-foreground opacity-40" />
        <h1 className="text-2xl font-bold">You have a club</h1>
        <p className="text-muted-foreground">The job market opens when you do not.</p>
        <Button onClick={() => { window.location.href = "/"; }}>Back to the club</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-black tracking-tight">{data.formerClub} has been sold</h1>
        <p className="text-muted-foreground">
          Five seasons of losses and the owners are out — and so are you. {data.managerName}, these clubs
          have no manager. Take one and everything you have done comes with you: your seasons, your
          achievements, your reputation. The squad, the academy and the trophies stay with the club
          you have left.
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
                {v.continentName}
                {v.inRegionalLeague && <span>· in its regional league</span>}
              </div>
            </CardContent>
          </Card>
        ))}
        {data.vacancies.length === 0 && (
          <Card className="border-2 border-dashed p-8 text-center md:col-span-2">
            <p className="text-sm text-muted-foreground">No club has a vacancy. That is the end of it.</p>
          </Card>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="lg"
          disabled={picked == null || accept.isPending}
          onClick={() => picked != null && accept.mutate(picked)}
          data-testid="button-take-job"
        >
          {accept.isPending ? "Taking the job…" : "Take the job"}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="gap-2"
          disabled={retire.isPending}
          onClick={() => retire.mutate()}
          data-testid="button-retire"
        >
          <DoorOpen className="h-4 w-4" />
          {retire.isPending ? "Retiring…" : "Retire instead"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Turning them all down ends your career.
        </span>
      </div>
    </div>
  );
}
