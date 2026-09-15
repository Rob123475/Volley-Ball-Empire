/**
 * The Olympic Games — R-61: the tournament this career actually played.
 *
 * Played in Olympic years, after the last regular World Tour round and before the
 * World Finals (utils/olympics.ts). Everything here is read from what was played:
 * the field and its pairs, group tables, the knockout and the medals. Before the
 * first Games of a career there is nothing to show but when they are.
 */
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Trophy, Medal, Flame, CalendarDays } from "lucide-react";

type Side = { nation: string; flag: string; seed: number };
type SetScore = { home: number; away: number };
type MatchView = {
  id: number; stage: string; label: string; groupName: string | null;
  home: Side; away: Side; homeSets: number; awaySets: number; sets: SetScore[]; winner: string;
};
type Player = { kind: "player" | "pool"; id: number; name: string; club: string; rating: number };
type Entry = { seed: number; nation: string; flag: string; points: number; qualifyingRank: number; rating: number; pair: Player[] };
type Standing = { nation: string; flag: string; seed: number; played: number; won: number; lost: number; setsFor: number; setsAgainst: number };
type Tournament = {
  seasonYear: number;
  playedOn: string;
  field: Entry[];
  passedOver: Array<{ nation: string; flag: string; qualifyingRank: number; eligible: number }>;
  groups: Array<{ name: string; standings: Standing[]; matches: MatchView[] }>;
  knockout: { quarterFinals: MatchView[]; semiFinals: MatchView[]; bronze: MatchView; gold: MatchView };
  medals: { gold: Entry; silver: Entry; bronze: Entry };
};
type ScheduleData = {
  seasonYear: number;
  isOlympicYear: boolean;
  olympicsYear: number;
  olympicsDate: string;
  tournament: Tournament | null;
};

function MatchRow({ m }: { m: MatchView }) {
  const homeWon = m.winner === m.home.nation;
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/30" data-testid="olympic-match">
      <div className={cn("flex items-center gap-1.5 flex-1 justify-end min-w-0", homeWon && "font-bold")}>
        <span className="text-sm truncate text-right">{m.home.nation}</span>
        <span className="text-base leading-none shrink-0">{m.home.flag}</span>
      </div>
      <div className="shrink-0 text-center min-w-[6rem]">
        <div className="font-black text-sm tabular-nums">{m.homeSets}–{m.awaySets}</div>
        <div className="text-[10px] text-muted-foreground tabular-nums">
          {m.sets.map((s) => `${s.home}-${s.away}`).join(", ")}
        </div>
      </div>
      <div className={cn("flex items-center gap-1.5 flex-1 min-w-0", !homeWon && "font-bold")}>
        <span className="text-base leading-none shrink-0">{m.away.flag}</span>
        <span className="text-sm truncate">{m.away.nation}</span>
      </div>
    </div>
  );
}

function Podium({ t }: { t: Tournament }) {
  const place = [
    { key: "gold",   label: "Gold",   entry: t.medals.gold,   tone: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300" },
    { key: "silver", label: "Silver", entry: t.medals.silver, tone: "border-zinc-300/40 bg-zinc-300/10 text-zinc-200" },
    { key: "bronze", label: "Bronze", entry: t.medals.bronze, tone: "border-amber-700/40 bg-amber-700/10 text-amber-500" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3" data-testid="olympic-medals">
      {place.map(({ key, label, entry, tone }) => (
        <div key={key} className={cn("rounded-xl border p-4", tone)}>
          <div className="text-[10px] font-black uppercase tracking-widest">{label}</div>
          <div className="mt-1 text-lg font-bold">{entry.flag} {entry.nation}</div>
          <div className="text-xs text-muted-foreground">{entry.pair.map((p) => `${p.name} (${p.club})`).join(" · ")}</div>
        </div>
      ))}
    </div>
  );
}

export default function OlympicSchedule() {
  const { data, isLoading } = useQuery<ScheduleData>({
    queryKey: ["olympic-schedule"],
    queryFn: () => fetch("/api/olympics/schedule").then((r) => r.json()),
    staleTime: 60_000,
  });

  if (isLoading) {
    return <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}</div>;
  }
  if (!data) return null;

  const t = data.tournament;
  if (!t) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center space-y-2" data-testid="olympic-not-played">
        <CalendarDays className="h-8 w-8 text-muted-foreground mx-auto" />
        <h2 className="text-lg font-bold">Olympic Games {data.olympicsYear}</h2>
        <p className="text-sm text-muted-foreground">
          {data.isOlympicYear
            ? `Played this season on ${data.olympicsDate}, after the last regular World Tour round and before the World Finals.`
            : `The next Games are in ${data.olympicsYear}, played after the last regular World Tour round and before the World Finals.`}
          {" "}The 12 nations with the most World Tour ranking points that season qualify.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="olympic-tournament">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Flame className="h-5 w-5 text-amber-400" />
          <h2 className="text-xl font-bold">{t.seasonYear} Olympic Beach Volleyball</h2>
          <Badge variant="outline">Played {t.playedOn}</Badge>
        </div>
        {t.passedOver.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Passed over — could not field two fit players at any club:{" "}
            {t.passedOver.map((p) => `${p.flag} ${p.nation} (${p.eligible})`).join(", ")}.
          </p>
        )}
      </div>

      <Podium t={t} />

      <div>
        <h3 className="text-base font-bold mb-3 flex items-center gap-2">
          <Medal className="h-4 w-4 text-muted-foreground" /> Group Stage
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {t.groups.map((g) => (
            <div key={g.name} className="rounded-xl border bg-card overflow-hidden">
              <div className="px-4 py-2.5 border-b bg-muted/30 font-black text-sm">Group {g.name}</div>
              <div className="px-3 pt-2 pb-1">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 text-[10px] font-black uppercase tracking-wide text-muted-foreground/60 px-1 mb-1">
                  <span>Nation</span><span>W</span><span>L</span><span>Sets</span>
                </div>
                {g.standings.map((s, i) => (
                  <div key={s.nation} className={cn("grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center px-1 py-1 text-sm", i < 2 ? "text-foreground" : "text-muted-foreground")}>
                    <span className="truncate text-xs font-semibold">{s.flag} {s.nation}</span>
                    <span className="text-xs tabular-nums">{s.won}</span>
                    <span className="text-xs tabular-nums">{s.lost}</span>
                    <span className="text-xs tabular-nums">{s.setsFor}-{s.setsAgainst}</span>
                  </div>
                ))}
              </div>
              <div className="px-3 pb-3 space-y-1 border-t pt-2">
                {g.matches.map((m) => <MatchRow key={m.id} m={m} />)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-base font-bold mb-3 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400" /> Knockout
        </h3>
        <div className="space-y-4">
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">Quarter-Finals</div>
            <div className="grid gap-2 sm:grid-cols-2">{t.knockout.quarterFinals.map((m) => <MatchRow key={m.id} m={m} />)}</div>
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">Semi-Finals</div>
            <div className="grid gap-2 sm:grid-cols-2">{t.knockout.semiFinals.map((m) => <MatchRow key={m.id} m={m} />)}</div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wide mb-1 text-amber-400">🥇 Gold Medal Match</div>
              <MatchRow m={t.knockout.gold} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wide mb-1 text-orange-600/80">🥉 Bronze Medal Match</div>
              <MatchRow m={t.knockout.bronze} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
