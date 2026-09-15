/**
 * National pairs — R-61.
 *
 * Every nation's Olympic pair as it stands today: its two highest-rated real
 * players at any club (the AI pool clubs and yours), injured players left out. A
 * nation with fewer than two cannot enter; if it qualifies it gives its place to
 * the next nation that can. This replaced a "national eligibility" view built on
 * three-player squads that the tournament never used.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Users } from "lucide-react";

type PairPlayer = { kind: "player" | "pool"; id: number; name: string; club: string; rating: number };
type Nation = { nation: string; flag: string; eligible: number; pair: PairPlayer[] };
type PairsData = { nations: Nation[]; canField: number; cannotField: number };

type Filter = "all" | "pair" | "short";

export default function NationalSquads() {
  const { data, isLoading, isError } = useQuery<PairsData>({
    queryKey: ["olympic-pairs"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/olympics/pairs", { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 60_000,
  });
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const nations = (data?.nations ?? []).filter((n) => {
    if (filter === "pair" && n.pair.length < 2) return false;
    if (filter === "short" && n.pair.length >= 2) return false;
    return !search || n.nation.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">National Pairs</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          At the Olympics each nation is represented by its two highest-rated players at any club.
          Injured players cannot be picked. A nation that cannot field two gives its place to the next nation that can.
        </p>
      </div>

      {data && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border bg-card p-4 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-emerald-400" />
            <div className="text-2xl font-bold text-emerald-400">{data.canField}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Can field a pair</div>
          </div>
          <div className="rounded-xl border bg-card p-4 text-center">
            <AlertCircle className="h-5 w-5 mx-auto mb-1 text-red-400" />
            <div className="text-2xl font-bold text-red-400">{data.cannotField}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Fewer than two players</div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {(["all", "pair", "short"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full px-3.5 py-1 text-xs font-semibold transition-colors",
              filter === f ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {f === "all" ? "All" : f === "pair" ? "Can field a pair" : "Fewer than two"}
          </button>
        ))}
        <input
          type="text"
          placeholder="Search nation…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto h-8 rounded-full border bg-muted/30 px-3.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-44"
        />
      </div>

      {isLoading && <div className="space-y-2">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>}
      {isError && <p className="text-sm text-destructive">Failed to load national pairs.</p>}

      <div className="space-y-2">
        {nations.map((n) => (
          <div
            key={n.nation}
            className={cn(
              "flex flex-wrap items-center gap-4 rounded-lg border px-4 py-3",
              n.pair.length >= 2 ? "border-emerald-500/20 bg-emerald-500/5" : "border-border bg-card",
            )}
          >
            <span className="text-2xl leading-none w-8 text-center">{n.flag}</span>
            <div className="min-w-[8rem]">
              <div className="font-semibold text-sm">{n.nation}</div>
              <div className="text-[11px] text-muted-foreground">{n.eligible} eligible player{n.eligible !== 1 ? "s" : ""}</div>
            </div>
            <div className="flex-1 min-w-0 space-y-0.5">
              {n.pair.map((p) => (
                <div key={`${p.kind}-${p.id}`} className="flex items-center gap-2 text-xs">
                  <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="font-semibold truncate">{p.name}</span>
                  <span className="text-muted-foreground truncate">{p.club}</span>
                  <span className="ml-auto tabular-nums text-muted-foreground">{p.rating.toFixed(1)}</span>
                </div>
              ))}
            </div>
            <Badge variant="outline" className={n.pair.length >= 2 ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400"}>
              {n.pair.length >= 2 ? "Pair" : "Cannot enter"}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
