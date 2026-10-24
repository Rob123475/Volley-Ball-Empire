/**
 * 1.1.1, Parts 2 and 3 (Rob, 16 Oct): the Team page's Transfers. Bids from
 * other clubs for his players, each with its full offer (wage, length, perks)
 * and his one chance to keep her: Counter (his own wage, length and perks) or
 * Let her go, before the deadline (no answer: she goes). The players he has
 * bought ahead and when they arrive, and his players sold ahead and when they
 * leave. Data: GET /api/transfers (api-server routes/transfers.ts).
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Handshake } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PerkPicker } from "@/components/perk-picker";
import { PERKS } from "@shared/transfers";
import { PLAYER_CONTRACT_LENGTHS, CONTRACT_LENGTH_LABELS, type ContractLength } from "@/lib/contract-lengths";

type Deal = {
  id: number; playerId: number; player: { n: string; img: string | null } | null; from: string; to: string;
  fee: number; wage: number; length: ContractLength; perks: string; perksMonthly: number; status: string;
  offeredOn: string; answerBy: string; arrivesOn: string | null;
  counter: { wage: number; length: string; perks: string } | null; moodDecided: boolean | null;
};
type Transfers = { today: string; window: { opens: string; closes: string }; answerDays: number; offers: Deal[]; incoming: Deal[]; outgoing: Deal[]; history: Deal[] };
export const TRANSFERS_QUERY_KEY = ["transfers"] as const;

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const dateText = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const perkNames = (keys: string) => PERKS.filter((p) => keys.split(",").includes(p.key)).map((p) => p.label).join(", ") || "none";
const terms = (d: { wage: number; length: string; perks: string }) =>
  `${money(d.wage)} a month, ${CONTRACT_LENGTH_LABELS[d.length as ContractLength] ?? d.length}, perks: ${perkNames(d.perks)}`;

export function useTransfers() {
  return useQuery<Transfers>({
    queryKey: TRANSFERS_QUERY_KEY,
    queryFn: async () => { const r = await fetch("/api/transfers"); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); },
  });
}

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
  return data;
}

function CounterDialog({ deal, onClose }: { deal: Deal; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [wage, setWage] = useState([Math.round(deal.wage)]);
  const [length, setLength] = useState<ContractLength>(deal.length);
  const [perks, setPerks] = useState<string[]>(deal.perks ? deal.perks.split(",") : []);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      const r = await post(`/api/transfers/${deal.id}/counter`, { wage: wage[0], length, perks });
      queryClient.invalidateQueries();
      toast(r.outcome === "kept"
        ? { title: `${deal.player?.n ?? "She"} stays`, description: "She accepted your counter-offer." }
        : { title: `${deal.player?.n ?? "She"} goes to ${deal.to}`, description: `She chose their offer. The fee of ${money(deal.fee)} is paid today; she leaves on ${dateText(r.deal?.arrivesOn ?? deal.arrivesOn)}.` });
      onClose();
    } catch (err) {
      toast({ title: "Counter-offer refused", description: (err as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md" data-testid="counter-dialog">
        <DialogHeader>
          <DialogTitle>Counter-offer: {deal.player?.n}</DialogTitle>
          <DialogDescription>{deal.to} offers {terms(deal)}. Your one chance to keep her: she takes the better offer, and when they are close her morale and your form decide.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium"><span>Monthly wage</span><span className="text-primary font-bold">{money(wage[0])}</span></div>
            <Slider min={Math.round(deal.wage * 0.5)} max={Math.round(deal.wage * 2)} step={100} value={wage} onValueChange={setWage} />
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {PLAYER_CONTRACT_LENGTHS.map((l) => (
              <Button key={l} size="sm" variant={length === l ? "default" : "outline"} onClick={() => setLength(l)} data-testid={`counter-length-${l}`}>{CONTRACT_LENGTH_LABELS[l]}</Button>
            ))}
          </div>
          <PerkPicker value={perks} onChange={setPerks} testIdPrefix="counter-perk" />
          <Button className="w-full" disabled={busy} onClick={send} data-testid="counter-send">Make the counter-offer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TransfersPanel() {
  const { data } = useTransfers();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [countering, setCountering] = useState<Deal | null>(null);
  if (!data) return null;
  const letGo = async (d: Deal) => {
    try {
      await post(`/api/transfers/${d.id}/let-go`, {});
      queryClient.invalidateQueries();
      toast({ title: `${d.player?.n ?? "She"} goes to ${d.to}`, description: `The fee of ${money(d.fee)} is paid today; she leaves on ${dateText(d.arrivesOn)}.` });
    } catch (err) { toast({ title: "Could not let her go", description: (err as Error).message, variant: "destructive" }); }
  };
  return (
    <div className="space-y-4" data-testid="transfers-panel">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Handshake className="h-4 w-4" /> Bids for your players</CardTitle>
          <CardDescription>
            The transfer window is {dateText(data.window.opens)} to {dateText(data.window.closes)}. A club may bid at any time; she moves in the window.
            You have {data.answerDays} days to answer a bid: counter once, or let her go. No answer means she goes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.offers.length === 0 && <p className="text-sm text-muted-foreground">No bids waiting.</p>}
          {data.offers.map((d) => (
            <div key={d.id} className="rounded-md border p-3 space-y-1" data-testid={`offer-${d.id}`}>
              <p className="text-sm"><span className="font-semibold">{d.to}</span> bids {money(d.fee)} for <span className="font-semibold">{d.player?.n}</span>: {terms(d)}.</p>
              <p className="text-xs text-muted-foreground">Answer by {dateText(d.answerBy)}. If she goes, she leaves on {dateText(d.arrivesOn)}.</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setCountering(d)} data-testid={`offer-counter-${d.id}`}>Counter</Button>
                <Button size="sm" variant="outline" onClick={() => letGo(d)} data-testid={`offer-let-go-${d.id}`}>Let her go</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ArrowDownLeft className="h-4 w-4" /> Arriving</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm" data-testid="transfers-incoming">
            {data.incoming.length === 0 ? <p className="text-muted-foreground">Nobody bought ahead.</p> : data.incoming.map((d) => (
              <p key={d.id}><span className="font-semibold">{d.player?.n}</span> from {d.from}: arrives {dateText(d.arrivesOn)} ({terms(d)}).</p>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ArrowUpRight className="h-4 w-4" /> Leaving</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm" data-testid="transfers-outgoing">
            {data.outgoing.length === 0 ? <p className="text-muted-foreground">Nobody sold ahead.</p> : data.outgoing.map((d) => (
              <p key={d.id}><span className="font-semibold">{d.player?.n}</span> to {d.to}: leaves {dateText(d.arrivesOn)} (fee {money(d.fee)} paid).</p>
            ))}
          </CardContent>
        </Card>
      </div>
      {data.history.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Recent deals</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            {data.history.map((d) => (
              <p key={d.id}>{d.player?.n}: {d.from} to {d.to}, {d.status === "kept" ? `kept by ${d.from}'s counter-offer${d.moodDecided ? " (her mood decided it)" : ""}` : d.status === "moved" ? "moved" : "fell through"}.</p>
            ))}
          </CardContent>
        </Card>
      )}
      {countering && <CounterDialog deal={countering} onClose={() => setCountering(null)} />}
    </div>
  );
}
