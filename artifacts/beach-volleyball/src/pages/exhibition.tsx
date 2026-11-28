/**
 * 1.2 D6 (Rob, 23 Nov): the Exhibition Game's pick screen, from the title screen's pill.
 *
 * Two teams (any of the game's 60 continental clubs, or a custom team) and their two players each,
 * names changed at will; who plays each player (the AI, or person 1-4 on this PC: the keyboard and
 * up to three pads); the venue, time of day, weather and difficulty. A custom team has no club's
 * colours, so its swimwear is free: a cut, plain or a print, and both of the print's colours. Every
 * venue, item, cut and print is open and free here. What the profile bought in the Store and wears
 * goes on the home team's first player to start with.
 *
 * The game touches nothing in a career. It goes to the server as one block of data (the same block
 * online play would send to another PC), and the court plays it.
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Play, Users } from "lucide-react";

type Player = { id: number; name: string; nationality: string; skinTone: string; imageUrl: string | null; overall: number };
type Team = { id: number; name: string; continent: string; primary: string; secondary: string; players: number[] };
type Item = { id: string; name: string; slot: string; picture: string; colour: string; lens: string | null; lenses?: string[] };
/** 1.2 9a: an accessory as worn: its colour, and for the sunglasses the lens tint. */
type Worn = { itemId: string; colour: string; lens?: string };
type Options = {
  teams: Team[]; players: Player[]; venues: { key: string; label: string }[];
  times: string[]; weathers: string[]; difficulties: string[]; cuts: string[]; prints: string[]; items: Item[];
  worn: (Worn & { lens: string | null })[];
};
type Swim = { cut: string; print: string; colourA: string; colourB: string };
type PickPlayer = { poolPlayerId: number; name: string; seat: number; swimwear: Swim; wear: Worn[] };
type PickTeam = { poolTeamId: number | null; name: string; primary: string; secondary: string; players: [PickPlayer, PickPlayer] };

const SEATS = [{ v: -1, label: "AI" }, { v: 0, label: "Person 1 (keyboard)" }, { v: 1, label: "Person 2 (pad 1)" }, { v: 2, label: "Person 3 (pad 2)" }, { v: 3, label: "Person 4 (pad 3)" }];
const CUT_LABEL: Record<string, string> = { "bikini-1": "Bikini 1 (with wrap)", "bikini-2": "Bikini 2", "bikini-3": "Bikini 3", "swimsuit-1": "Swimsuit 1", "swimsuit-2": "Swimsuit 2", "swimsuit-3": "Swimsuit 3" };
const PRINT_LABEL: Record<string, string> = { plain: "Plain", leopard: "Leopard", hibiscus: "Hibiscus", stripes: "Stripes", polkadots: "Polka dots", palmleaves: "Palm leaves", camouflage: "Camouflage", tiedye: "Tie-dye", zebra: "Zebra" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const LENS_LABEL: Record<string, string> = { black: "Black lenses", brown: "Brown lenses", "blue-mirror": "Blue mirror", amber: "Amber lenses", rose: "Rose lenses" };
const selectClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

function playerFor(p: Player, seat: number): PickPlayer {
  return { poolPlayerId: p.id, name: p.name, seat, swimwear: { cut: "bikini-2", print: "plain", colourA: "#1e3a8a", colourB: "#ffffff" }, wear: [] };
}
function teamFrom(t: Team, players: Player[], seats: [number, number]): PickTeam {
  const [a, b] = t.players.map((id) => players.find((p) => p.id === id)!);
  return { poolTeamId: t.id, name: t.name, primary: t.primary, secondary: t.secondary, players: [playerFor(a, seats[0]), playerFor(b, seats[1])] };
}

function PlayerPicker({ o, team, idx, onChange, taken }: { o: Options; team: PickTeam; idx: 0 | 1; onChange: (p: PickPlayer) => void; taken: Set<number> }) {
  const p = team.players[idx];
  const custom = team.poolTeamId == null;
  const bySlot = useMemo(() => o.items.reduce<Record<string, Item[]>>((m, i) => { (m[i.slot] ??= []).push(i); return m; }, {}), [o.items]);
  const worn = (slot: string) => p.wear.find((w) => o.items.find((i) => i.id === w.itemId)?.slot === slot);
  const setWear = (slot: string, itemId: string, colour?: string, lens?: string) => {
    const rest = p.wear.filter((w) => o.items.find((i) => i.id === w.itemId)?.slot !== slot);
    const item = o.items.find((i) => i.id === itemId);
    onChange({ ...p, wear: item ? [...rest, { itemId, colour: colour ?? item.colour, ...(item.lenses ? { lens: lens ?? item.lens ?? item.lenses[0] } : {}) }] : rest });
  };
  const pl = o.players.find((x) => x.id === p.poolPlayerId);
  return (
    <div className="space-y-2 rounded-lg border p-3" data-testid={`ex-player-${idx}`}>
      <div className="flex items-center gap-3">
        {pl?.imageUrl && <img src={pl.imageUrl} alt="" className="h-12 w-12 rounded-md object-cover" />}
        <div className="grid flex-1 grid-cols-2 gap-2">
          <select className={selectClass} value={p.poolPlayerId} aria-label="Player"
            onChange={(e) => { const np = o.players.find((x) => x.id === Number(e.target.value))!; onChange({ ...p, poolPlayerId: np.id, name: np.name }); }}>
            {o.players.filter((x) => x.id === p.poolPlayerId || !taken.has(x.id)).map((x) => <option key={x.id} value={x.id}>{x.name} ({x.overall})</option>)}
          </select>
          <select className={selectClass} value={p.seat} aria-label="Who plays her" onChange={(e) => onChange({ ...p, seat: Number(e.target.value) })}>
            {SEATS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <Input value={p.name} maxLength={30} aria-label="Her name" onChange={(e) => onChange({ ...p, name: e.target.value })} />
      {custom && (
        <div className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2">
          <select className={selectClass} value={p.swimwear.cut} aria-label="Cut" onChange={(e) => onChange({ ...p, swimwear: { ...p.swimwear, cut: e.target.value } })}>
            {o.cuts.map((c) => <option key={c} value={c}>{CUT_LABEL[c] ?? c}</option>)}
          </select>
          <select className={selectClass} value={p.swimwear.print} aria-label="Print" onChange={(e) => onChange({ ...p, swimwear: { ...p.swimwear, print: e.target.value } })}>
            {["plain", ...o.prints].map((c) => <option key={c} value={c}>{PRINT_LABEL[c] ?? c}</option>)}
          </select>
          <input type="color" aria-label="Colour A" value={p.swimwear.colourA} onChange={(e) => onChange({ ...p, swimwear: { ...p.swimwear, colourA: e.target.value } })} className="h-9 w-10 rounded border" />
          <input type="color" aria-label="Colour B" disabled={p.swimwear.print === "plain"} value={p.swimwear.colourB} onChange={(e) => onChange({ ...p, swimwear: { ...p.swimwear, colourB: e.target.value } })} className="h-9 w-10 rounded border disabled:opacity-30" />
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {Object.entries(bySlot).map(([slot, items]) => {
          const w = worn(slot);
          return (
            <div key={slot} className="flex items-center gap-1">
              <select className={selectClass} value={w?.itemId ?? ""} aria-label={slot} onChange={(e) => setWear(slot, e.target.value)}>
                <option value="">{cap(slot === "legpiece" ? "leg piece" : slot)}: none</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              {w && <input type="color" aria-label={`${slot} colour`} value={w.colour} onChange={(e) => setWear(slot, w.itemId, e.target.value, w.lens)} className="h-9 w-9 shrink-0 rounded border" />}
              {w?.lens && (
                <select className={`${selectClass} w-auto shrink-0`} value={w.lens} aria-label={`${slot} lenses`} onChange={(e) => setWear(slot, w.itemId, w.colour, e.target.value)}>
                  {(o.items.find((i) => i.id === w.itemId)?.lenses ?? []).map((l) => <option key={l} value={l}>{LENS_LABEL[l] ?? l}</option>)}
                </select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TeamPicker({ o, side, team, onChange, taken }: { o: Options; side: string; team: PickTeam; onChange: (t: PickTeam) => void; taken: Set<number> }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{side}</CardTitle>
        <div className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2">
          <select className={selectClass} value={team.poolTeamId ?? "custom"} aria-label={`${side} team`}
            onChange={(e) => {
              if (e.target.value === "custom") onChange({ ...team, poolTeamId: null, name: "Custom Team" });
              else onChange(teamFrom(o.teams.find((t) => t.id === Number(e.target.value))!, o.players, [team.players[0].seat, team.players[1].seat]));
            }}>
            <option value="custom">Custom team</option>
            {o.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <Input value={team.name} maxLength={30} aria-label={`${side} team name`} onChange={(e) => onChange({ ...team, name: e.target.value })} />
          <input type="color" aria-label={`${side} colour`} value={team.primary} onChange={(e) => onChange({ ...team, primary: e.target.value })} className="h-9 w-10 rounded border" />
          <input type="color" aria-label={`${side} second colour`} value={team.secondary} onChange={(e) => onChange({ ...team, secondary: e.target.value })} className="h-9 w-10 rounded border" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {([0, 1] as const).map((i) => (
          <PlayerPicker key={i} o={o} team={team} idx={i} taken={taken}
            onChange={(p) => onChange({ ...team, players: (i === 0 ? [p, team.players[1]] : [team.players[0], p]) as [PickPlayer, PickPlayer] })} />
        ))}
      </CardContent>
    </Card>
  );
}

export default function ExhibitionPage() {
  const [, navigate] = useLocation();
  const { data: o } = useQuery<Options>({ queryKey: ["exhibition-options"], queryFn: () => fetch("/api/exhibition/options", { credentials: "same-origin" }).then((r) => r.json()) });
  const [home, setHome] = useState<PickTeam | null>(null);
  const [away, setAway] = useState<PickTeam | null>(null);
  const [venue, setVenue] = useState("oceania");
  const [time, setTime] = useState("sunset");
  const [weather, setWeather] = useState("sunny");
  const [difficulty, setDifficulty] = useState("medium");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!o || home) return;
    const h = teamFrom(o.teams[0], o.players, [0, -1]);
    h.players[0].wear = o.worn.filter((w) => w.itemId).map(({ lens, ...w }) => (lens ? { ...w, lens } : w));   // D4: what the profile bought and wears
    setHome(h);
    setAway(teamFrom(o.teams[Math.min(1, o.teams.length - 1)], o.players, [-1, -1]));
  }, [o, home]);

  if (!o || !home || !away) return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  const taken = new Set([...home.players, ...away.players].map((p) => p.poolPlayerId));
  const seats = [...home.players, ...away.players].map((p) => p.seat) as [number, number, number, number];
  const people = new Set(seats.filter((s) => s >= 0)).size;

  async function play() {
    setError(null); setStarting(true);
    const team = (t: PickTeam) => ({ ...t, players: t.players.map(({ seat: _seat, swimwear, ...p }) => ({ ...p, swimwear: t.poolTeamId == null ? swimwear : undefined })) });
    const r = await fetch("/api/exhibition", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
      body: JSON.stringify({ home: team(home!), away: team(away!), venue, timeOfDay: time, weather, difficulty, seats }) });
    const d = await r.json();
    if (!r.ok) { setError(d.error ?? "Could not start the game."); setStarting(false); return; }
    navigate(`/exhibition/court?exhibitionId=${d.id}${people > 0 ? "&played=1" : ""}`);
  }

  const pick = (label: string, value: string, set: (v: string) => void, list: string[], show: (v: string) => string) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <select className={selectClass} value={value} aria-label={label} onChange={(e) => set(e.target.value)}>
        {list.map((v) => <option key={v} value={v}>{show(v)}</option>)}
      </select>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <button type="button" className="mb-1 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" onClick={() => navigate("/")}><ArrowLeft className="h-4 w-4" /> Back</button>
            <h1 className="text-3xl font-bold tracking-tight">Exhibition Game</h1>
            <p className="text-muted-foreground">One game, anyone against anyone, up to four people on this PC. Everything is open, and nothing in your career changes.</p>
          </div>
          <Button size="lg" onClick={play} disabled={starting} data-testid="exhibition-play"><Play className="mr-2 h-5 w-5" />Play</Button>
        </div>
        {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">{error}</div>}
        <Card>
          <CardContent className="grid grid-cols-2 gap-3 pt-6 sm:grid-cols-4">
            {pick("Venue", venue, setVenue, o.venues.map((v) => v.key), (k) => o.venues.find((v) => v.key === k)?.label ?? k)}
            {pick("Time of day", time, setTime, o.times, cap)}
            {pick("Weather", weather, setWeather, o.weathers, (w) => (w === "rain" ? "Light rain" : cap(w)))}
            {pick("Difficulty", difficulty, setDifficulty, o.difficulties, cap)}
          </CardContent>
          <CardDescription className="flex items-center gap-2 px-6 pb-4"><Users className="h-4 w-4" />
            {people === 0 ? "Nobody plays: you watch the AI." : `${people} ${people === 1 ? "person plays" : "people play"}. Person 1 has the keyboard; persons 2 to 4 a pad each. Whoever has a whole team, control follows the ball for her.`}
          </CardDescription>
        </Card>
        <div className="grid gap-4 lg:grid-cols-2">
          <TeamPicker o={o} side="Home" team={home} onChange={setHome} taken={taken} />
          <TeamPicker o={o} side="Away" team={away} onChange={setAway} taken={taken} />
        </div>
      </div>
    </div>
  );
}
