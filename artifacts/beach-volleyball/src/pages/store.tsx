/**
 * 1.2 D4 (Rob, 23 Nov): the Store. Its own money (the profile's wallet, never a career's), items
 * from the server's data file, each in the colour the buyer picks (a print takes two). Built but
 * closed: while data/store-settings.json says "open": false the side menu has no Store pill and
 * this page sends the player back to the dashboard. What is bought and worn goes on the player's
 * own side in an exhibition (D6).
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Coins, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type StoreItem = { id: string; name: string; slot: string; price: number; picture: string; colour: string };
type Owned = { id: number; itemId: string; colour: string; worn: boolean };
export type StoreState = { open: false } | { open: true; currency: string; balance: number; items: StoreItem[]; owned: Owned[] };

/** The store's state; the side menu shows the pill only when it says open. */
export function useStore() {
  return useQuery<StoreState>({
    queryKey: ["store"],
    queryFn: () => fetch("/api/store", { credentials: "same-origin" }).then((r) => r.json()),
    staleTime: 30_000,
  });
}

const SLOT_LABEL: Record<string, string> = {
  hat: "Hat", sunglasses: "Sunglasses", shoes: "Shoes", bracelet: "Bracelet", earrings: "Earrings", necklace: "Necklace", legpiece: "Leg piece", print: "Print",
};

async function post(path: string, body: unknown) {
  const r = await fetch(path, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error ?? "Something went wrong.");
  return data;
}

function ItemCard({ item, owned, currency, balance }: { item: StoreItem; owned: Owned[]; currency: string; balance: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const two = item.slot === "print";
  const [colours, setColours] = useState<string[]>(item.colour.split(","));
  const buy = useMutation({
    mutationFn: () => post("/api/store/buy", { itemId: item.id, colour: colours.join(",") }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["store"] }); toast({ title: `${item.name} bought` }); },
    onError: (e: Error) => toast({ title: "Not bought", description: e.message, variant: "destructive" }),
  });
  const wear = useMutation({
    mutationFn: (o: Owned) => post("/api/store/wear", { ownedId: o.id, worn: !o.worn }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["store"] }),
  });
  const mine = owned.filter((o) => o.itemId === item.id);
  return (
    <Card className="flex flex-col overflow-hidden" data-testid={`store-item-${item.id}`}>
      <div className="aspect-square bg-muted overflow-hidden">
        <img src={item.picture} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
      </div>
      <CardContent className="flex flex-col gap-3 p-4 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold">{item.name}</span>
          <span className="flex items-center gap-1 text-sm font-semibold"><Coins className="h-4 w-4" />{item.price}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary" className="shrink-0">{SLOT_LABEL[item.slot] ?? item.slot}</Badge>
          <span className="ml-auto">{two ? "Colours" : "Colour"}</span>
          {colours.map((c, i) => (
            <input key={i} type="color" value={c} aria-label={`${item.name} colour ${i + 1}`}
              onChange={(e) => setColours((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))}
              className="h-7 w-9 cursor-pointer rounded border border-border bg-transparent p-0" />
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-2">
          <Button onClick={() => buy.mutate()} disabled={buy.isPending || balance < item.price} data-testid={`buy-${item.id}`}>
            <ShoppingBag className="h-4 w-4 mr-2" />{balance < item.price ? `Needs ${item.price} ${currency}` : "Buy"}
          </Button>
          {mine.map((o) => (
            <Button key={o.id} variant={o.worn ? "default" : "outline"} size="sm" onClick={() => wear.mutate(o)} data-testid={`wear-${o.id}`}>
              {o.worn && <Check className="h-4 w-4 mr-1" />}
              <span className="flex items-center gap-1">
                {o.colour.split(",").map((c) => <span key={c} className="inline-block h-3 w-3 rounded-full border border-border" style={{ background: c }} />)}
              </span>
              <span className="ml-2">{o.worn ? "Wearing" : "Wear"}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function StorePage() {
  const { data } = useStore();
  const [, navigate] = useLocation();
  // Closed: no way in.
  useEffect(() => { if (data && !data.open) navigate("/"); }, [data, navigate]);
  if (!data || !data.open) return null;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Store</h1>
          <p className="text-muted-foreground">For exhibition games. Your own money: it never touches a career's.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border px-4 py-2 text-lg font-semibold" data-testid="store-balance">
          <Coins className="h-5 w-5" />{data.balance} {data.currency}
        </div>
      </div>
      <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
        {data.items.map((item) => <ItemCard key={item.id} item={item} owned={data.owned} currency={data.currency} balance={data.balance} />)}
      </div>
    </div>
  );
}
