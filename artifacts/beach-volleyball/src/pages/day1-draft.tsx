/**
 * Update 1, item 4b (Rob, 14 Oct, C-5 B): the Day 1 draft.
 *
 * After the wizard and before the first day: the player picks his seniors from
 * every senior in the world, the free agents and every AI club's seniors. On
 * Day 1 nobody owns anyone, so there is no fee, only the wage. Each card shows
 * her rating, nationality, age and monthly wage (after a Contracts Expert's
 * -10%); "Senior wages $X of $60,000" runs at the top; a pick that would break
 * the cap can't be made, and the card says why. He takes 2 or 3 (2 to play, an
 * optional interchange) and chooses each one's contract length. Each pick
 * signs through POST /contracts; one taken back is released (free in the
 * draft is open, an undo; an AI club's player goes back to her club).
 */
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CONTRACT_LENGTHS, CONTRACT_LENGTH_LABELS, type ContractLength } from "@/lib/contract-lengths";
import { capRefusalText, WAGE_CAP_QUERY_KEY, type WageCap } from "@/lib/wage-cap";
import { cn } from "@/lib/utils";

type Card_ = { id: number; name: string; nationality: string; age: number; rating: number; wage: number; club: string | null; imageUrl: string | null };
type Pick = { id: number; name: string; nationality: string; age: number; rating: number; wage: number; squadRole: string; imageUrl: string | null };
type Draft = { open: boolean; min?: number; max?: number; picks?: Pick[]; players?: Card_[]; wageCap?: WageCap };

export const DAY1_DRAFT_QUERY_KEY = ["day1-draft"] as const;

export function useDay1Draft() {
  return useQuery<Draft>({
    queryKey: DAY1_DRAFT_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/day1-draft", { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data;
}

export default function Day1Draft() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useDay1Draft();
  const [show, setShow] = useState<"all" | "free" | "ai">("all");
  const [search, setSearch] = useState("");
  const [lengths, setLengths] = useState<Record<number, ContractLength>>({});
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: DAY1_DRAFT_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: WAGE_CAP_QUERY_KEY });
  };

  const players = useMemo(() => (data?.players ?? [])
    .filter((p) => show === "all" || (show === "free" ? p.club == null : p.club != null))
    .filter((p) => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()) || p.nationality.toLowerCase().includes(search.trim().toLowerCase())),
  [data, show, search]);

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading the draft…</div>;
  if (!data?.open) {
    return (
      <div className="p-8 space-y-4">
        <p>The Day 1 draft is closed.</p>
        <Button onClick={() => navigate("/")}>Go to the dashboard</Button>
      </div>
    );
  }
  const picks = data.picks ?? [];
  const min = data.min ?? 2, max = data.max ?? 3;
  const full = picks.length >= max;

  const pick = async (p: Card_) => {
    setBusy(true);
    try {
      await post("/api/contracts", {
        playerId: p.id, salary: p.wage, bonusPerWin: 0, length: lengths[p.id] ?? "1s",
        squadRole: picks.length < 2 ? "starter" : "interchange", confirm: true,
      });
      toast({ title: `${p.name} signs`, description: `${money(p.wage)} a month, ${CONTRACT_LENGTH_LABELS[lengths[p.id] ?? "1s"]}.` });
    } catch (err) {
      toast({ title: "Pick refused", description: String((err as Error).message), variant: "destructive" });
    } finally { setBusy(false); refresh(); }
  };
  const unpick = async (p: Pick) => {
    setBusy(true);
    try { await post(`/api/players/${p.id}/release`, {}); } catch (err) {
      toast({ title: "Could not take her back", description: String((err as Error).message), variant: "destructive" });
    } finally { setBusy(false); refresh(); }
  };
  const finish = async () => {
    setBusy(true);
    try {
      await post("/api/day1-draft/finish", {});
      queryClient.removeQueries();
      navigate("/");
    } catch (err) {
      toast({ title: "Not yet", description: String((err as Error).message), variant: "destructive" });
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-primary">Day 1 draft</h1>
          <p className="text-muted-foreground">
            Pick your seniors from every senior in the world: {min} to play and an optional interchange. On Day 1 nobody owns anyone, so there is no
            transfer fee, only her wage. You can look round the game first; the calendar moves on from Day 1 once you have {min} or {max}, and playing on
            closes the draft.
          </p>
          <p className={cn("text-sm", (data.wageCap?.seniorWages ?? 0) > (data.wageCap?.cap ?? 0) ? "text-red-500" : "text-muted-foreground")} data-testid="draft-wage-cap">
            Senior wages <span className="font-semibold text-foreground">{money(data.wageCap?.seniorWages ?? 0)}</span> of {money(data.wageCap?.cap ?? 0)}
          </p>
        </div>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold">Your picks ({picks.length} of {max})</p>
              <Button onClick={finish} disabled={busy || picks.length < min || picks.length > max} data-testid="draft-finish">
                {picks.length < min ? `Pick ${min - picks.length} more to start` : "Close the draft"}
              </Button>
            </div>
            {picks.length === 0 && <p className="text-sm text-muted-foreground">Nobody yet.</p>}
            <div className="grid gap-2 md:grid-cols-3">
              {picks.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border p-2 text-sm" data-testid={`draft-pick-${p.id}`}>
                  <div>
                    <p className="font-semibold">{p.name} <Badge variant="outline" className="ml-1">{p.rating}</Badge></p>
                    <p className="text-xs text-muted-foreground">{p.nationality} · {p.age} · {money(p.wage)}/mo · {p.squadRole === "starter" ? "plays" : "interchange"}</p>
                  </div>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => unpick(p)}>Take back</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          {(["all", "free", "ai"] as const).map((k) => (
            <Button key={k} size="sm" variant={show === k ? "default" : "outline"} onClick={() => setShow(k)}>
              {k === "all" ? "Everyone" : k === "free" ? "Free agents" : "AI clubs' players"}
            </Button>
          ))}
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a name or nation"
            className="ml-auto rounded-md border bg-background px-3 py-1.5 text-sm" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((p) => {
            const overCap = capRefusalText(data.wageCap, p.wage);
            const len = lengths[p.id] ?? "1s";
            const why = full ? `You have ${max}: take one back to pick her.` : overCap;
            return (
              <Card key={p.id} data-testid={`draft-card-${p.id}`}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold leading-tight">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.nationality} · {p.age} · {p.club ?? "free agent"}</p>
                    </div>
                    <Badge variant="outline">{p.rating}</Badge>
                  </div>
                  <p className="text-sm"><span className="font-bold">{money(p.wage)}</span> a month</p>
                  <div className="grid grid-cols-3 gap-1">
                    {CONTRACT_LENGTHS.map((l) => (
                      <button key={l} type="button" onClick={() => setLengths((m) => ({ ...m, [p.id]: l }))}
                        className={cn("rounded border px-1 py-1 text-[11px] font-semibold", len === l ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/40")}>
                        {CONTRACT_LENGTH_LABELS[l]}
                      </button>
                    ))}
                  </div>
                  {why && <p className="text-[11px] text-red-500" data-testid={`draft-why-${p.id}`}>{why}</p>}
                  <Button size="sm" className="w-full" disabled={busy || !!why} onClick={() => pick(p)}>Pick</Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
