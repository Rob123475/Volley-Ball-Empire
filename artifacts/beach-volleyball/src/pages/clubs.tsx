/**
 * 1.1.1, Part 1 (Rob, 16 Oct): the Clubs page. Every club, the player's
 * included: badge and name, continent, tier, World Tour ladder position, this
 * season's record, balance, senior wages against the cap and injuries this
 * season, with a Sort menu. Click an AI club for its Players (every senior,
 * shown on her Player Market card with its Watch star, Scout and Buy, and every
 * academy youth, who can be asked for on loan or to buy: 1.1.1 Part 5) or its Staff & Medical. The player's own club opens his Club page.
 * Data: GET /api/clubs and /api/clubs/:id (api-server routes/clubs.ts).
 */
import { useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Shield, Stethoscope, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ClubCrest } from "@/components/club-crest";
import { PlayerPortrait } from "@/components/player-portrait";
import { MarketPlayerCard, RevealedSigningDialog, useMarketActions } from "@/pages/players";
import { YouthDealDialog } from "@/components/youth-deal-dialog";
import { cn } from "@/lib/utils";

type Manager = { name: string; image: string; speciality: string; effect: string; isPlayer: boolean } | null;
type Wages = { seniorWages: number; cap: number; room: number };
type ClubRow = {
  kind: "mine" | "ai"; id: number; name: string; continent: string | null;
  primaryColor: string | null; secondaryColor: string | null; crestShapeIndex: number | null;
  balance: number; manager: Manager; tier: string; ladderPosition: number | null; regionalPosition: number | null; points: number;
  wins: number; losses: number; form: ("W" | "L")[]; wages: Wages; injuries: number;
};
type ClubsResponse = { today: string; seasonYear: number; clubs: ClubRow[] };
type ClubPlayer = {
  id: number; name: string; imageUrl: string | null; nationality: string | null; continent: string | null; age: number;
  youth: boolean; role: string; rating: number | null; revealed: boolean; wage: number; wagePer: "week" | "month";
  contractEndDate: string | null; injury: { name: string | null; weeksOut: number } | null;
};
type ClubStaff = { id: number; name: string; role: string; imageUrl: string | null; skill: number; wage: number; contractEndDate: string | null };
type ClubDetail = {
  club: { id: number; name: string; continent: string; primaryColor: string | null; secondaryColor: string | null; balance: number };
  manager: Manager; tier: string; ladderPosition: number | null; regionalPosition: number | null; points: number; wins: number; losses: number; seasonYear: number;
  lastFive: { seasonYear: number; round: number; tier: string; opponent: string; won: boolean; score: string }[];
  wages: Wages; seniors: ClubPlayer[]; youths: ClubPlayer[]; staff: ClubStaff[];
};

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const dateText = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const ROLE_LABEL: Record<string, string> = { starter: "Starter", interchange: "Interchange", reserve: "Reserve", injured: "Injured list", youth_team: "Youth team" };

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * The Clubs page's orders. "Most successful": the World Tour ladder first (the
 * clubs in this season's field, by rank), then World Tour ranking points, then
 * the regional league position.
 */
const CLUB_SORTS = {
  richest:        { label: "Richest",               cmp: (a: ClubRow, b: ClubRow) => b.balance - a.balance },
  poorest:        { label: "Poorest",               cmp: (a: ClubRow, b: ClubRow) => a.balance - b.balance },
  successful:     { label: "Most successful",       cmp: (a: ClubRow, b: ClubRow) => (a.ladderPosition ?? 999) - (b.ladderPosition ?? 999) || b.points - a.points || (a.regionalPosition ?? 999) - (b.regionalPosition ?? 999) },
  injuryProne:    { label: "Most injury-prone",     cmp: (a: ClubRow, b: ClubRow) => b.injuries - a.injuries },
  continent:      { label: "Continent",             cmp: (a: ClubRow, b: ClubRow) => (a.continent ?? "~").localeCompare(b.continent ?? "~") || a.name.localeCompare(b.name) },
  name:           { label: "Name",                  cmp: (a: ClubRow, b: ClubRow) => a.name.localeCompare(b.name) },
} as const;
type ClubSort = keyof typeof CLUB_SORTS;

function ManagerLine({ manager }: { manager: Manager }) {
  if (!manager) return <span className="text-xs text-muted-foreground">Manager's job vacant</span>;
  return (
    <span className="inline-flex items-center gap-2 text-xs" title={manager.effect}>
      <img src={manager.image} alt="" className="h-7 w-7 rounded-full object-cover" />
      <span><span className="font-semibold">{manager.isPlayer ? "You" : manager.name}</span> · {manager.speciality}</span>
    </span>
  );
}

export default function ClubsPage() {
  const [, navigate] = useLocation();
  const [sort, setSort] = useState<ClubSort>("successful");
  const { data, isLoading } = useQuery<ClubsResponse>({ queryKey: ["clubs"], queryFn: () => getJson("/api/clubs") });
  const clubs = useMemo(() => [...(data?.clubs ?? [])].sort(CLUB_SORTS[sort].cmp), [data, sort]);

  return (
    <div className="space-y-5" data-testid="clubs-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3"><Shield className="h-8 w-8 text-secondary" /> Clubs</h2>
          <p className="text-muted-foreground text-sm">Every club this season{data ? ` (${data.seasonYear})` : ""}. Ladder: World Tour position for the clubs in this season's World Tour, and each AI club's regional league position. Record: World Tour.</p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as ClubSort)} data-testid="clubs-sort" aria-label="Sort"
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground">
            {(Object.keys(CLUB_SORTS) as ClubSort[]).map((k) => <option key={k} value={k}>{CLUB_SORTS[k].label}</option>)}
          </select>
        </label>
      </div>
      {isLoading ? <Skeleton className="h-96 w-full" /> : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm" data-testid="clubs-table">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="p-2">Club</th><th className="p-2">Continent</th><th className="p-2">Tier</th><th className="p-2">Ladder</th>
                  <th className="p-2">Record</th><th className="p-2 text-right">Balance</th><th className="p-2 text-right">Senior wages</th><th className="p-2 text-right">Injuries</th>
                </tr>
              </thead>
              <tbody>
                {clubs.map((c) => (
                  <tr key={`${c.kind}-${c.id}`} data-testid={`club-row-${c.kind}-${c.id}`}
                    onClick={() => navigate(c.kind === "mine" ? "/club" : `/clubs/${c.id}`)}
                    className={cn("border-b last:border-0 cursor-pointer hover:bg-muted/40", c.kind === "mine" && "bg-primary/5 font-semibold")}>
                    <td className="p-2">
                      <span className="inline-flex items-center gap-2">
                        <ClubCrest name={c.name} primaryColor={c.primaryColor ?? undefined} secondaryColor={c.secondaryColor ?? undefined} shapeIndex={c.crestShapeIndex ?? undefined} size={28} />
                        <span>{c.name}{c.kind === "mine" ? " (you)" : ""}</span>
                      </span>
                    </td>
                    <td className="p-2">{c.continent ?? "—"}</td>
                    <td className="p-2">{c.tier}</td>
                    <td className="p-2 whitespace-nowrap">{c.ladderPosition ? `WT #${c.ladderPosition}` : "—"}{c.regionalPosition ? ` · Reg #${c.regionalPosition}` : ""}</td>
                    <td className="p-2">{c.wins}-{c.losses}</td>
                    <td className={cn("p-2 text-right", c.balance < 0 && "text-destructive")}>{money(c.balance)}</td>
                    <td className="p-2 text-right whitespace-nowrap">{money(c.wages.seniorWages)} of {money(c.wages.cap)}</td>
                    <td className="p-2 text-right">{c.injuries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function ClubDetailPage() {
  const [, params] = useRoute("/clubs/:id");
  const [, navigate] = useLocation();
  const id = Number(params?.id);
  const [tab, setTab] = useState<"players" | "staff">("players");
  const { data, isLoading } = useQuery<ClubDetail>({ queryKey: ["club", id], queryFn: () => getJson(`/api/clubs/${id}`), enabled: Number.isFinite(id) });
  // Her Player Market card: the same Watch star, Scout and Buy, through the market's own routes.
  const { data: market } = useQuery<any[]>({ queryKey: ["players-market-all"], queryFn: () => getJson("/api/players/market-all"), staleTime: 30_000 });
  const marketById = useMemo(() => new Map((market ?? []).map((p) => [p.id, p])), [market]);
  const actions = useMarketActions();
  const [dealYouth, setDealYouth] = useState<{ id: number; name: string } | null>(null);

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;
  const { club } = data;
  return (
    <div className="space-y-5" data-testid="club-detail">
      <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/clubs")}><ArrowLeft className="h-4 w-4" /> Clubs</Button>
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-5">
          <ClubCrest name={club.name} primaryColor={club.primaryColor ?? undefined} secondaryColor={club.secondaryColor ?? undefined} size={56} />
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-primary" data-testid="club-name">{club.name}</h2>
            <p className="text-sm text-muted-foreground">
              {club.continent} · {data.tier} tier · World Tour {data.ladderPosition ? `#${data.ladderPosition}` : "—"} ({data.points} pts){data.regionalPosition ? ` · Regional #${data.regionalPosition}` : ""} · {data.wins}-{data.losses} in {data.seasonYear}
            </p>
            <p className="text-sm">Balance {money(club.balance)} · Senior wages {money(data.wages.seniorWages)} of {money(data.wages.cap)}</p>
            <ManagerLine manager={data.manager} />
          </div>
          <div className="ml-auto" data-testid="club-last-five">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Last 5 results</p>
            {data.lastFive.length === 0 ? <p className="text-xs text-muted-foreground">None yet</p> : (
              <ul className="space-y-0.5 text-xs">
                {data.lastFive.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <Badge variant={r.won ? "default" : "destructive"} className="h-5 w-5 justify-center p-0">{r.won ? "W" : "L"}</Badge>
                    <span>{r.score} v {r.opponent}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button size="sm" variant={tab === "players" ? "default" : "outline"} className="gap-1" onClick={() => setTab("players")} data-testid="club-tab-players"><Users className="h-4 w-4" /> Players</Button>
        <Button size="sm" variant={tab === "staff" ? "default" : "outline"} className="gap-1" onClick={() => setTab("staff")} data-testid="club-tab-staff"><Stethoscope className="h-4 w-4" /> Staff &amp; Medical</Button>
      </div>

      {tab === "players" ? (
        <div className="space-y-6">
          <h3 className="font-bold">Seniors ({data.seniors.length})</h3>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data.seniors.map((p) => {
              const card = marketById.get(p.id);
              return (
                <div key={p.id} className="space-y-1.5" data-testid={`club-senior-${p.id}`}>
                  <p className="text-xs text-muted-foreground">
                    {ROLE_LABEL[p.role] ?? p.role} · Contract ends {dateText(p.contractEndDate)}
                    {p.injury ? <span className="text-destructive"> · {p.injury.name}, out {p.injury.weeksOut} wk</span> : null}
                  </p>
                  {card ? (
                    <MarketPlayerCard player={card} onSign={actions.handleSign} onScout={actions.handleScout} onWatch={actions.handleWatch}
                      isScoutingThis={actions.scoutMutation.isPending && actions.scoutMutation.variables?.id === p.id}
                      signPending={actions.signMutation.isPending} hasScout={actions.hasScout} />
                  ) : <Skeleton className="h-80 w-full" />}
                </div>
              );
            })}
          </div>
          <h3 className="font-bold">Academy ({data.youths.length})</h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {data.youths.map((p) => (
              <Card key={p.id} data-testid={`club-youth-${p.id}`}>
                <CardContent className="p-3 space-y-2">
                  <PlayerPortrait name={p.name} imageUrl={p.imageUrl} continent={p.continent} nationality={p.nationality} playerType="youth" age={p.age} heightClass="h-40" />
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{p.name}</span>
                    <span className="text-lg font-black" data-testid={`club-youth-rating-${p.id}`}>{p.revealed ? p.rating : "?"}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Age {p.age} · {ROLE_LABEL[p.role] ?? p.role} · {money(p.wage)} a {p.wagePer}
                    {p.injury ? <span className="text-destructive"> · {p.injury.name}, out {p.injury.weeksOut} wk</span> : null}
                  </p>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => setDealYouth({ id: p.id, name: p.name })} data-testid={`club-youth-deal-${p.id}`}>Loan or buy</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm" data-testid="club-staff-table">
              <thead><tr className="text-left text-xs text-muted-foreground border-b"><th className="p-2">Name</th><th className="p-2">Role</th><th className="p-2">Skill</th><th className="p-2 text-right">Wage a month</th><th className="p-2">Contract ends</th></tr></thead>
              <tbody>
                {data.staff.length === 0 && <tr><td className="p-3 text-muted-foreground" colSpan={5}>No staff.</td></tr>}
                {data.staff.map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="p-2"><span className="inline-flex items-center gap-2">{m.imageUrl && <img src={m.imageUrl} alt="" className="h-7 w-7 rounded-full object-cover" />}{m.name}</span></td>
                    <td className="p-2">{m.role}</td><td className="p-2">{m.skill}</td>
                    <td className="p-2 text-right">{money(m.wage)}</td><td className="p-2">{dateText(m.contractEndDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
      <RevealedSigningDialog signing={actions.revealedSigning} onClose={() => actions.setRevealedSigning(null)} />
      <YouthDealDialog youth={dealYouth} club={club.name} onClose={() => setDealYouth(null)} />
    </div>
  );
}
