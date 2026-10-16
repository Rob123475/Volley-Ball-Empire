/**
 * 1.1.1, Part 5 (Rob, 16 Oct): ask an AI club for one of its academy youths,
 * on loan or to buy (api-server utils/youthDeals.ts). The dialog shows what
 * his scout makes of it this week: the chance her club sells (his scout's
 * skill against its position), her price, and the loan lengths she can go for.
 * A refused sale comes back with a loan offered instead.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type Ask = {
  chance: number; price: number; loanMonths: number[];
  scout: { skill: number; name: string | null; role: string | null };
  position: { ownYouths: number; inYouthTeam: boolean; needsCash: boolean };
};

const ROLE: Record<string, string> = { scout: "Scout", head_coach: "Head Coach", assistant_coach: "Assistant Coach" };

export function YouthDealDialog({ youth, club, onClose }: { youth: { id: number; name: string } | null; club: string; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [loanOnly, setLoanOnly] = useState(false);
  const { data, error } = useQuery<Ask>({
    queryKey: ["youth-deal", youth?.id],
    enabled: youth != null,
    queryFn: async () => {
      const r = await fetch(`/api/youth-deals/${youth!.id}`);
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
      return body as Ask;
    },
  });

  const send = async (kind: "loan" | "buy", months?: number) => {
    if (!youth) return;
    setBusy(true);
    try {
      const r = await fetch("/api/youth-deals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: youth.id, kind, months, confirm: true }),
      });
      const body = await r.json();
      if (!r.ok) { toast({ title: "No deal", description: body.error, variant: "destructive" }); return; }
      if (body.outcome === "loan_only") {
        setLoanOnly(true);
        toast({ title: `${club} won't sell ${youth.name}`, description: "They offer her on loan instead." });
        return;
      }
      toast({
        title: body.outcome === "bought" ? `${youth.name} joins your academy` : `${youth.name} joins you on loan`,
        description: body.outcome === "bought" ? `$${body.fee.toLocaleString()} paid to ${club}.` : `For ${body.months} months; you pay half her wage ($${body.yourHalf.toLocaleString()} a week).`,
      });
      qc.invalidateQueries();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={youth != null} onOpenChange={(o) => { if (!o) { setLoanOnly(false); onClose(); } }}>
      <DialogContent data-testid="youth-deal-dialog">
        <DialogHeader>
          <DialogTitle>{youth?.name} — {club}'s academy</DialogTitle>
          <DialogDescription>Ask her club for her on loan or to buy. Your scout does the talking.</DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{(error as Error).message}</p> : !data ? <p className="text-sm text-muted-foreground">Asking…</p> : (
          <div className="space-y-3 text-sm">
            <p data-testid="youth-deal-scout">
              {data.scout.name
                ? <>{ROLE[data.scout.role ?? ""] ?? "Staff"} {data.scout.name} (scouting {data.scout.skill}) negotiates.</>
                : <>You have no Scout or coach to negotiate: {club} will only lend her.</>}
            </p>
            <p data-testid="youth-deal-chance">
              Chance {club} sells her this week: <b>{Math.round(data.chance * 100)}%</b>
              <span className="text-muted-foreground"> ({data.position.ownYouths} youths of its own{data.position.inYouthTeam ? ", she plays in its youth team" : ""}{data.position.needsCash ? ", it needs cash" : ""})</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {!loanOnly && data.chance > 0 && (
                <Button disabled={busy} onClick={() => send("buy")} data-testid="youth-deal-buy">Offer to buy (${data.price.toLocaleString()})</Button>
              )}
              {data.loanMonths.map((m) => (
                <Button key={m} variant="outline" disabled={busy} onClick={() => send("loan", m)} data-testid={`youth-deal-loan-${m}`}>Loan for {m} months</Button>
              ))}
              {data.loanMonths.length === 0 && <p className="text-muted-foreground">She leaves the academy on 1 January: too late for a loan.</p>}
            </div>
            {loanOnly && <p className="text-muted-foreground" data-testid="youth-deal-loan-only">{club} won't sell her this week. A loan is on offer.</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
