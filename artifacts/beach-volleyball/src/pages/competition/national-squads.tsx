/**
 * National Squads — Olympic eligibility overview.
 *
 * Shows every nationality that has at least one active senior player,
 * colour-coded by eligibility status:
 *   ELIGIBLE   — ≥ 3 real players of national origin
 *   INELIGIBLE — < 3 real players of national origin
 *
 * Staff nationality never affects eligibility; players at foreign clubs
 * remain eligible for their country of origin.
 */

import { useState } from "react";
import { useQuery }    from "@tanstack/react-query";
import { Badge }       from "@/components/ui/badge";
import { Skeleton }    from "@/components/ui/skeleton";
import { cn }          from "@/lib/utils";
import { Flag, AlertCircle, CheckCircle2, Users, Globe } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type EligibilityStatus = "eligible" | "ineligible";

type CountryEntry = {
  country: string;
  flag: string;
  continent: string;
  playerCount: number;
  eligibilityStatus: EligibilityStatus;
  eligibilityReason?: string;
};

// ── Hook ──────────────────────────────────────────────────────────────────────

function useOlympicCountries() {
  return useQuery<CountryEntry[]>({
    queryKey: ["olympic-countries"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/olympics/countries", { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 60_000,
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

const MIN_PLAYERS = 3;

type FilterTab = "all" | "eligible" | "ineligible";

const FILTER_TABS: Array<{ id: FilterTab; label: string }> = [
  { id: "all",        label: "All"        },
  { id: "eligible",   label: "Eligible"   },
  { id: "ineligible", label: "Ineligible" },
];

function EligibilityBadge({ status }: { status: EligibilityStatus }) {
  if (status === "eligible") {
    return (
      <Badge className="gap-1 bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
        <CheckCircle2 className="h-3 w-3" />
        ELIGIBLE
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-red-500/40 text-red-400">
      <AlertCircle className="h-3 w-3" />
      INELIGIBLE
    </Badge>
  );
}

function PlayerCountPips({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: MIN_PLAYERS }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-2 w-2 rounded-full",
            i < count ? "bg-emerald-400" : "bg-muted-foreground/25",
          )}
        />
      ))}
      {count > MIN_PLAYERS && (
        <span className="ml-1 text-xs text-muted-foreground">+{count - MIN_PLAYERS}</span>
      )}
    </div>
  );
}

function CountryRow({ entry }: { entry: CountryEntry }) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors",
        entry.eligibilityStatus === "eligible"
          ? "border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10"
          : "border-border bg-card hover:bg-muted/30",
      )}
    >
      {/* Flag + country name */}
      <span className="text-2xl leading-none select-none w-8 shrink-0 text-center">
        {entry.flag}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{entry.country}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">{entry.continent}</span>
        </div>
      </div>

      {/* Player count pips */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <PlayerCountPips count={Math.min(entry.playerCount, MIN_PLAYERS)} />
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {entry.playerCount} player{entry.playerCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Eligibility badge */}
      <div className="shrink-0 w-32 flex justify-end">
        <EligibilityBadge status={entry.eligibilityStatus} />
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────

function EligibilityStats({ data }: { data: CountryEntry[] }) {
  const eligible   = data.filter((c) => c.eligibilityStatus === "eligible").length;
  const ineligible = data.length - eligible;
  return (
    <div className="grid grid-cols-3 gap-4">
      {[
        { label: "Total Countries",  value: data.length,    icon: Globe,         color: "text-muted-foreground" },
        { label: "Eligible",         value: eligible,       icon: CheckCircle2,  color: "text-emerald-400"      },
        { label: "Ineligible",       value: ineligible,     icon: AlertCircle,   color: "text-red-400"          },
      ].map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="rounded-xl border bg-card p-4 text-center">
          <Icon className={cn("h-5 w-5 mx-auto mb-1", color)} />
          <div className={cn("text-2xl font-bold", color)}>{value}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NationalSquads() {
  const { data, isLoading, isError } = useOlympicCountries();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  const filtered = (data ?? []).filter((c) => {
    if (filter === "eligible"   && c.eligibilityStatus !== "eligible")   return false;
    if (filter === "ineligible" && c.eligibilityStatus !== "ineligible") return false;
    if (search && !c.country.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">National Eligibility</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          A country must have at least {MIN_PLAYERS} eligible players of national origin to enter
          Olympic qualification. Club location does not affect nationality.
        </p>
      </div>

      {/* Stats */}
      {isLoading && (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      )}
      {data && <EligibilityStats data={data} />}

      {/* Eligibility rule callout */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3 items-start">
        <Users className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
        <div className="text-sm text-amber-200/80">
          <span className="font-semibold text-amber-300">Eligibility rule:</span>{" "}
          Players are eligible for their country of national origin regardless of which club they
          play for. No generated or temporary players are used. All squad members must be real,
          permanent players in the database.
        </div>
      </div>

      {/* Filter tabs + search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {FILTER_TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={cn(
                "rounded-full px-3.5 py-1 text-xs font-semibold transition-colors",
                filter === id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {label}
              {data && (
                <span className="ml-1.5 opacity-70">
                  (
                  {id === "all"
                    ? data.length
                    : id === "eligible"
                    ? data.filter((c) => c.eligibilityStatus === "eligible").length
                    : data.filter((c) => c.eligibilityStatus === "ineligible").length}
                  )
                </span>
              )}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search country…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto h-8 rounded-full border bg-muted/30 px-3.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-44"
        />
      </div>

      {/* Country list */}
      {isLoading && <SkeletonRows />}

      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
          <AlertCircle className="h-6 w-6 text-destructive mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Failed to load eligibility data.</p>
        </div>
      )}

      {data && !isLoading && (
        <>
          {filtered.length === 0 ? (
            <div className="rounded-xl border bg-card p-10 text-center">
              <Flag className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No countries match your filter.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((entry) => (
                <CountryRow key={entry.country} entry={entry} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
