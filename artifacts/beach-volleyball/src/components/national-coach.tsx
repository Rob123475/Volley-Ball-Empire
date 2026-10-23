/**
 * 1.1.3 (Rob, 23 Oct; brief A4c): the national coach job, on top of his club job.
 *
 *   NationalCoachOffers   the offers waiting (Career page, job market): each
 *                         nation's flag, strength and fixed monthly pay; accept
 *                         one for 3 or 5 years, or decline them all. While he
 *                         coaches a nation: his contract (nation, years left, pay).
 *   NationalCoachNotice   the Dashboard: an offer waiting, and today's Empire
 *                         Nations Cup matches with Watch.
 *
 * Server: routes/national-team.ts (utils/nationalCoach.ts).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flag } from "@/components/flag";
import { useToast } from "@/hooks/use-toast";
import { gameDateText } from "@/lib/game-date";
import { CupMatchRow, watchCupHref, type CupFixture } from "@/pages/competition/olympic-schedule";

export type NationalOffer = { id: number; nation: string; monthly: number; strengthRank: number; ranked: number; offeredOn: string; reason: string; cupYear: number };
export type NationalJob = { id: number; nation: string; years: number; monthly: number; startedOn: string; endsOn: string; paid: number; daysLeft: number };
export type NationalCoachStatus = {
  today: string; job: NationalJob | null; offers: NationalOffer[]; earned: number; contractYears: number[];
  nextCup: { year: number; startsOn: string }; todayCup: CupFixture[];
};

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export function useNationalCoach() {
  return useQuery<NationalCoachStatus>({
    queryKey: ["national-coach"],
    queryFn: () => fetch("/api/national-coach", { credentials: "same-origin" }).then((r) => r.json()),
    staleTime: 15_000,
  });
}

export function NationalCoachOffers() {
  const { data } = useNationalCoach();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [years, setYears] = useState<Record<number, number>>({});
  const accept = useMutation({
    mutationFn: async ({ id, y }: { id: number; y: number }) => {
      const r = await fetch(`/api/national-coach/offers/${id}/accept`, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ years: y }) });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error ?? `HTTP ${r.status}`);
      return body;
    },
    onSuccess: () => { qc.invalidateQueries(); toast({ title: "National coach", description: "You have a national team: see the National Team page." }); },
    onError: (e: Error) => toast({ title: "Not accepted", description: e.message, variant: "destructive" }),
  });
  const decline = useMutation({
    mutationFn: () => fetch("/api/national-coach/offers/decline", { method: "POST", credentials: "same-origin" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries(),
  });
  if (!data) return null;

  if (data.job) {
    const yearsLeft = Math.round((data.job.daysLeft / 365) * 10) / 10;
    return (
      <Card className="border-amber-500/40 bg-amber-500/5" data-testid="national-coach-contract">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Flag nation={data.job.nation} size={28} />
            <div>
              <p className="font-bold">National coach of {data.job.nation}</p>
              <p className="text-sm text-muted-foreground" data-testid="national-coach-pay">
                {money(data.job.monthly)} a month, your own (the club pays nothing) · {yearsLeft} years left, to {gameDateText(data.job.endsOn)} · {money(data.earned)} earned
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  if (data.offers.length === 0) return null;
  return (
    <Card className="border-amber-500/50 bg-amber-500/10" data-testid="national-coach-offers">
      <CardContent className="p-4 space-y-3">
        <div>
          <p className="font-bold">{data.offers.length === 1 ? "A nation wants you as its national coach" : `${data.offers.length} nations want you as their national coach`}</p>
          <p className="text-sm text-muted-foreground">
            On top of your club job. The pay is fixed: the weaker the nation, the more it pays. You choose 3 or 5 years.
            {" "}Next Empire Nations Cup: {data.nextCup.year}, from {gameDateText(data.nextCup.startsOn)}.
          </p>
        </div>
        <div className="space-y-2">
          {data.offers.map((o) => {
            const y = years[o.id] ?? data.contractYears[0]!;
            return (
              <div key={o.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2" data-testid="national-coach-offer">
                <Flag nation={o.nation} size={22} />
                <div className="min-w-[10rem]">
                  <div className="font-semibold">{o.nation}</div>
                  <div className="text-xs text-muted-foreground">Strength #{o.strengthRank} of {o.ranked} nations</div>
                </div>
                <Badge variant="outline" className="tabular-nums" data-testid="national-coach-offer-pay">{money(o.monthly)} / month</Badge>
                <div className="flex gap-1 ml-auto">
                  {data.contractYears.map((n) => (
                    <Button key={n} size="sm" variant={y === n ? "default" : "outline"} onClick={() => setYears((s) => ({ ...s, [o.id]: n }))} data-testid={`national-coach-years-${n}`}>
                      {n} years
                    </Button>
                  ))}
                  <Button size="sm" onClick={() => accept.mutate({ id: o.id, y })} disabled={accept.isPending} data-testid="national-coach-accept">Accept</Button>
                </div>
              </div>
            );
          })}
        </div>
        <Button variant="ghost" size="sm" onClick={() => decline.mutate()} disabled={decline.isPending} data-testid="national-coach-decline">Decline them all</Button>
      </CardContent>
    </Card>
  );
}

export function NationalCoachNotice() {
  const { data } = useNationalCoach();
  const [, navigate] = useLocation();
  if (!data) return null;
  return (
    <>
      {!data.job && data.offers.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/10" data-testid="national-coach-notice">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-1">{data.offers.map((o) => <Flag key={o.id} nation={o.nation} size={20} />)}</div>
              <div>
                <p className="font-bold">{data.offers.length === 1 ? `${data.offers[0]!.nation} want you as their national coach` : `${data.offers.length} nations want you as their national coach`}</p>
                <p className="text-sm text-muted-foreground">Accept one (3 or 5 years) or decline them all, on the Career page.</p>
              </div>
            </div>
            <Button onClick={() => navigate("/career")} data-testid="national-coach-notice-go">See the offers</Button>
          </CardContent>
        </Card>
      )}
      {data.todayCup.length > 0 && (
        <Card className="border-emerald-500/40 bg-emerald-500/5" data-testid="nations-cup-today">
          <CardContent className="p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold">Empire Nations Cup today</p>
              <Button size="sm" variant="ghost" onClick={() => navigate("/competition/olympic-schedule")}>Schedule</Button>
            </div>
            <p className="text-xs text-muted-foreground">Watch any match on the 3D court. A match not watched is decided at the end of the day.</p>
            <div className="space-y-1.5">
              {data.todayCup.map((m) => <CupMatchRow key={m.id} m={m} onWatch={(f) => navigate(watchCupHref(f))} />)}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
