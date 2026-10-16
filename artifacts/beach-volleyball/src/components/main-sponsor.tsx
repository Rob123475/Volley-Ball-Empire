/**
 * 1.1.1, Part 11 (Rob, SB-2/SB-5): the main sponsor and the staff budget.
 * Finances and the Day 1 draft page show the card: at choosing time (Day 1 and
 * each season's start) its three offers, each a staff budget and a bonus;
 * once chosen, the sponsor, its bonus and what it has paid, and "Staff wages
 * $X of $Y" with the room left. The Staff and Medical markets show the line.
 * Sponsors have no logos: name and type. Data: GET /api/finances/main-sponsor.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Handshake } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export type MainSponsor = {
  seasonYear: number | null; budget: number; wages: number; room: number; over: boolean;
  sponsor: { name: string; type: string | null; tier: string | null; bonus: string; paid: number } | null;
  offers: Array<{ id: number; sponsor: string; tier: string | null; type: string | null; staffBudget: number; bonus: string }>;
};
export const MAIN_SPONSOR_KEY = ["main-sponsor"];
const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export function useMainSponsor() {
  return useQuery<MainSponsor>({
    queryKey: MAIN_SPONSOR_KEY,
    queryFn: async () => { const r = await fetch("/api/finances/main-sponsor"); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); },
  });
}

/** "Staff wages $X of $Y, $Z left" (red when over). */
export function StaffBudgetLine({ className = "" }: { className?: string }) {
  const { data } = useMainSponsor();
  if (!data) return null;
  return (
    <p className={`text-sm ${data.over ? "text-destructive font-semibold" : "text-muted-foreground"} ${className}`} data-testid="staff-budget-line">
      Staff wages <b>{money(data.wages)}</b> of <b>{money(data.budget)}</b> a month
      {data.over ? ` — ${money(data.wages - data.budget)} over your staff budget: no hiring or renewing until you're back under.` : ` — ${money(data.room)} room left`}
      {data.sponsor ? ` (staff budget from ${data.sponsor.name})` : data.offers.length > 0 ? " (choose your main sponsor on the Finances page)" : ""}
    </p>
  );
}

export function MainSponsorCard() {
  const { data } = useMainSponsor();
  const qc = useQueryClient();
  const { toast } = useToast();
  if (!data) return null;
  const choose = async (id: number) => {
    const r = await fetch(`/api/finances/main-sponsor/${id}/choose`, { method: "POST" });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) { toast({ title: "Could not choose", description: body.error, variant: "destructive" }); return; }
    qc.invalidateQueries();
    toast({ title: "Main sponsor signed", description: `Your staff budget is ${money(body.budget)} a month this season.` });
  };
  return (
    <Card data-testid="main-sponsor">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Handshake className="h-4 w-4" /> Main sponsor</CardTitle>
        <CardDescription>Your main sponsor sets your staff budget: all your staff and medical wages together must stay under it.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.offers.length > 0 ? (
          <>
            <p className="text-sm font-semibold" data-testid="main-sponsor-choose">Choose your main sponsor for {data.seasonYear}: one of three offers.</p>
            <div className="grid gap-3 md:grid-cols-3">
              {data.offers.map((o) => (
                <div key={o.id} className="rounded-lg border p-3 space-y-1.5" data-testid={`main-sponsor-offer-${o.id}`}>
                  <p className="font-bold">{o.sponsor}</p>
                  <p className="text-xs text-muted-foreground">{o.type ?? "Sponsor"}{o.tier ? ` · ${o.tier}` : ""}</p>
                  <p className="text-sm">Staff budget <b>{money(o.staffBudget)}</b> a month</p>
                  <p className="text-sm">Bonus: <b>{o.bonus}</b></p>
                  <Button size="sm" className="w-full" onClick={() => choose(o.id)} data-testid={`main-sponsor-choose-${o.id}`}>Choose</Button>
                </div>
              ))}
            </div>
          </>
        ) : data.sponsor ? (
          <div className="space-y-1" data-testid="main-sponsor-current">
            <p className="font-bold text-lg">{data.sponsor.name} <Badge variant="outline" className="ml-1 align-middle">{data.sponsor.type ?? "Sponsor"}{data.sponsor.tier ? ` · ${data.sponsor.tier}` : ""}</Badge></p>
            <p className="text-sm">Bonus: <b>{data.sponsor.bonus}</b> · paid so far this season: <b>{money(data.sponsor.paid)}</b></p>
          </div>
        ) : null}
        <StaffBudgetLine />
      </CardContent>
    </Card>
  );
}
