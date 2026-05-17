import { useListLocations, getListLocationsQueryKey, useListMatches, getListMatchesQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { MapPin, Wind, CloudSun, Trophy, CheckCircle2, Lock, ChevronRight, Star, Flag } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// The 11-stop World Tour in order — locId maps to locations.id in the DB
const TOUR_STOPS = [
  { round: 1,  locId: 1,  opponent: "Sand Queens AU",     prize: 5000,  date: "Jan 15" },
  { round: 2,  locId: 2,  opponent: "Pacific Storm USA",  prize: 6000,  date: "Feb 12" },
  { round: 3,  locId: 3,  opponent: "Tropical Blaze CUB", prize: 7000,  date: "Mar 19" },
  { round: 4,  locId: 4,  opponent: "Rio Serpents BRA",   prize: 8500,  date: "Apr 16" },
  { round: 5,  locId: 5,  opponent: "Sydney Sharks AU",   prize: 10000, date: "May 21" },
  { round: 6,  locId: 6,  opponent: "Greek Fire GRE",     prize: 12000, date: "Jun 18" },
  { round: 7,  locId: 7,  opponent: "Bali Tigers IDN",    prize: 14000, date: "Jul 16" },
  { round: 8,  locId: 8,  opponent: "Island Aces THA",    prize: 16000, date: "Aug 13" },
  { round: 9,  locId: 9,  opponent: "French Riviera FRA", prize: 18000, date: "Sep 17" },
  { round: 10, locId: 10, opponent: "Storm Queens USA",   prize: 22000, date: "Oct 15" }, // Matira Beach, Bora Bora
  { round: 11, locId: 1,  opponent: "World All-Stars",    prize: 50000, date: "Dec 10", isFinal: true },
];

function formatPrize(n: number) {
  return n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`;
}

function cn(...args: (string | false | null | undefined)[]) {
  return args.filter(Boolean).join(" ");
}

export default function WorldTourLocations() {
  const { data: locations, isLoading: locsLoading } = useListLocations({
    query: { queryKey: getListLocationsQueryKey() },
  });
  const { data: matches, isLoading: matchLoading } = useListMatches({
    query: { queryKey: getListMatchesQueryKey() },
  });

  const isLoading = locsLoading || matchLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
        </div>
      </div>
    );
  }

  // Build a map: round → match status
  const matchByRound = Object.fromEntries(
    (matches ?? []).map((m) => [m.round, m])
  );

  // Completed rounds
  const completedRounds = new Set(
    (matches ?? []).filter((m) => m.status === "completed").map((m) => m.round)
  );

  // Current round = lowest scheduled round
  const currentRound = (matches ?? [])
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => (a.round ?? 0) - (b.round ?? 0))[0]?.round ?? null;

  // Build a map: locId → location record
  const locById: Record<number, any> = Object.fromEntries(
    (locations ?? []).map((l) => [l.id, l])
  );

  return (
    <div className="space-y-10">

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-primary to-sky-900 px-6 py-8 shadow-xl">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}
        />
        <div className="relative flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="h-4 w-4 text-secondary" />
              <span className="text-secondary text-xs font-bold uppercase tracking-widest">Beach Volley Pro</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white">World Tour 2026</h1>
            <p className="text-white/60 text-sm mt-1">11 stops across 9 countries · Grand Final in Rio</p>
          </div>
          <div className="hidden md:flex flex-col items-end gap-1">
            <span className="text-white/50 text-xs uppercase tracking-wider">Progress</span>
            <span className="text-white font-black text-2xl">{completedRounds.size}<span className="text-white/40 font-normal text-base"> / 11</span></span>
          </div>
        </div>
        {/* progress bar */}
        <div className="relative mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-secondary to-amber-300 transition-all duration-700"
            style={{ width: `${(completedRounds.size / 11) * 100}%` }}
          />
        </div>
      </div>

      {/* ── Journey map ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground px-1">Tour Journey</h2>

        <div className="relative">
          {TOUR_STOPS.map((stop, idx) => {
            const loc = locById[stop.locId];
            const isDone    = completedRounds.has(stop.round);
            const isCurrent = stop.round === currentRound;
            const isLocked  = !isDone && !isCurrent;
            const match     = matchByRound[stop.round];
            const homeScore = match?.homeScore;
            const awayScore = match?.awayScore;
            const won       = isDone && (homeScore ?? 0) > (awayScore ?? 0);

            return (
              <div key={stop.round} className="relative">
                {/* connector line down to next stop */}
                {idx < TOUR_STOPS.length - 1 && (
                  <div className={cn(
                    "absolute left-[28px] top-[72px] w-0.5 h-8 z-0",
                    isDone ? "bg-emerald-500" : isCurrent ? "bg-secondary" : "bg-border"
                  )} />
                )}

                <Dialog>
                  <DialogTrigger asChild>
                    <div className={cn(
                      "relative flex items-center gap-4 p-3 rounded-2xl border transition-all cursor-pointer hover:shadow-md group",
                      isDone && won  && "bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/60",
                      isDone && !won && "bg-rose-500/5 border-rose-500/20 hover:border-rose-500/40",
                      isCurrent      && "bg-secondary/10 border-secondary/40 hover:border-secondary shadow-[0_0_16px_rgba(244,162,97,0.15)]",
                      isLocked       && "bg-card border-border/50 opacity-60 hover:opacity-80"
                    )}>

                      {/* Round badge / status icon */}
                      <div className={cn(
                        "relative flex-shrink-0 flex items-center justify-center w-14 h-14 rounded-xl font-black text-lg z-10",
                        stop.isFinal   && "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg",
                        !stop.isFinal && isDone && won  && "bg-emerald-500 text-white",
                        !stop.isFinal && isDone && !won && "bg-rose-500 text-white",
                        isCurrent      && !stop.isFinal && "bg-secondary text-white animate-pulse",
                        isLocked       && !stop.isFinal && "bg-muted text-muted-foreground"
                      )}>
                        {stop.isFinal ? (
                          <Trophy className="h-6 w-6" />
                        ) : isDone ? (
                          <CheckCircle2 className="h-6 w-6" />
                        ) : isLocked ? (
                          <Lock className="h-5 w-5" />
                        ) : (
                          <span>{stop.round}</span>
                        )}
                      </div>

                      {/* Location photo thumbnail */}
                      {loc?.imageUrl && (
                        <div className={cn(
                          "flex-shrink-0 w-20 h-14 rounded-xl overflow-hidden",
                          isLocked && "grayscale"
                        )}>
                          <img
                            src={loc.imageUrl}
                            alt={loc.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            "font-black text-base truncate",
                            stop.isFinal && "text-amber-500",
                            isCurrent && !stop.isFinal && "text-secondary"
                          )}>
                            {stop.isFinal ? "🏆 GRAND FINAL — " : ""}{loc?.name ?? `Stop ${stop.round}`}
                          </span>
                          {isCurrent && <Badge className="bg-secondary text-white text-[10px] h-4 px-1.5 animate-pulse">NEXT UP</Badge>}
                          {stop.isFinal && <Badge className="bg-amber-400/20 text-amber-600 border-amber-400/30 text-[10px] h-4">CHAMPIONSHIP</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {loc?.country} · {stop.date} · vs {stop.opponent}
                        </div>
                      </div>

                      {/* Right: score or prize */}
                      <div className="flex-shrink-0 text-right">
                        {isDone ? (
                          <div className={cn("font-black text-lg", won ? "text-emerald-500" : "text-rose-500")}>
                            {homeScore}–{awayScore}
                            <div className="text-[10px] font-normal text-muted-foreground">{won ? "WIN" : "LOSS"}</div>
                          </div>
                        ) : (
                          <div className={cn("font-bold text-sm", stop.isFinal ? "text-amber-500" : "text-muted-foreground")}>
                            {formatPrize(stop.prize)}
                            <div className="text-[10px] font-normal text-muted-foreground">prize</div>
                          </div>
                        )}
                      </div>

                      <ChevronRight className="flex-shrink-0 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </DialogTrigger>

                  {/* Location detail dialog */}
                  <DialogContent className="max-w-2xl p-0 overflow-hidden">
                    {loc?.imageUrl && (
                      <div className="relative h-52 overflow-hidden">
                        <img src={loc.imageUrl} alt={loc.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                        <div className="absolute bottom-0 left-0 p-5">
                          <p className="text-white/70 text-xs font-bold uppercase tracking-widest">{loc.country} · Round {stop.round}</p>
                          <h2 className="text-white font-black text-2xl">{stop.isFinal ? "🏆 Grand Final — " : ""}{loc.name}</h2>
                        </div>
                        {isDone && (
                          <div className={cn(
                            "absolute top-4 right-4 px-3 py-1.5 rounded-full font-black text-sm",
                            won ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                          )}>
                            {won ? `WON ${homeScore}–${awayScore}` : `LOST ${homeScore}–${awayScore}`}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <StatBox label="Date" value={stop.date} />
                        <StatBox label="Opponent" value={stop.opponent} small />
                        <StatBox label="Prize" value={formatPrize(stop.prize)} highlight={stop.isFinal} />
                      </div>
                      {loc?.description && (
                        <p className="text-sm text-muted-foreground leading-relaxed">{loc.description}</p>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {loc?.weatherPattern && (
                          <Badge variant="secondary" className="gap-1">
                            <CloudSun className="h-3 w-3" />{loc.weatherPattern}
                          </Badge>
                        )}
                        {loc?.courtType && (
                          <Badge variant="secondary" className="gap-1">
                            <Wind className="h-3 w-3" />{loc.courtType}
                          </Badge>
                        )}
                        {stop.isFinal && (
                          <Badge className="bg-amber-400/20 text-amber-600 border-amber-400/30 gap-1">
                            <Star className="h-3 w-3 fill-current" />Championship Stage
                          </Badge>
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Location photo gallery ──────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground px-1">All Venues</h2>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {(locations ?? []).map((loc) => (
            <div key={loc.id} className="group relative rounded-xl overflow-hidden aspect-[4/3] shadow-md cursor-pointer">
              <img
                src={loc.imageUrl}
                alt={loc.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-white font-black text-sm leading-tight">{loc.name}</p>
                <p className="text-white/60 text-[10px] uppercase tracking-wide">{loc.country}</p>
              </div>
              {/* completed overlay */}
              {[...completedRounds].some(r => TOUR_STOPS.find(s => s.round === r && s.locId === loc.id)) && (
                <div className="absolute top-2 right-2">
                  <div className="bg-emerald-500 rounded-full p-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

function StatBox({ label, value, small, highlight }: { label: string; value: string; small?: boolean; highlight?: boolean }) {
  return (
    <div className="rounded-xl bg-muted/40 border border-border p-3 text-center">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("font-black mt-0.5 leading-tight", small ? "text-xs" : "text-base", highlight && "text-amber-500")}>
        {value}
      </p>
    </div>
  );
}
