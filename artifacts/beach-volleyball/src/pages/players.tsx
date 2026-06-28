import { 
  useListFreeAgents, 
  useSignContract, 
  useScoutPlayer,
  getListFreeAgentsQueryKey,
  getListContractsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  UserPlus, 
  DollarSign,
  Zap,
  Wind,
  Shield,
  Target,
  Activity,
  Star,
  Search,
  HelpCircle,
  Globe,
} from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlayerPortrait } from "@/components/player-portrait";
import { format, addMonths } from "date-fns";
import { cn } from "@/lib/utils";

const CONTINENTS = ["ALL", "Africa", "Asia", "Europe", "North America", "South America", "Oceania"] as const;
type ContinentFilter = typeof CONTINENTS[number];

const CONTINENT_FLAG: Record<string, string> = {
  Africa: "🌍", Asia: "🌏", Europe: "🇪🇺", "North America": "🌎", "South America": "🌎", Oceania: "🌊",
};

const POSITIONS = ["ALL", "setter", "spiker", "defender", "blocker", "server", "all_rounder"] as const;
const POSITION_LABELS: Record<string, string> = {
  ALL:        "All",
  setter:     "Setter",
  spiker:     "Spiker",
  defender:   "Defender",
  blocker:    "Blocker",
  server:     "Server",
  all_rounder:"All-Rounder",
};

function normalizePosition(pos: string): string {
  const map: Record<string, string> = {
    opposite:     "spiker",
    universal:    "all_rounder",
    libero:       "defender",
    outside_hitter: "spiker",
    middle_blocker: "blocker",
    Setter: "setter",
    Spiker: "spiker",
    Defender: "defender",
    Blocker: "blocker",
    Server: "server",
  };
  return map[pos] ?? pos;
}

// ── Potential display helpers ─────────────────────────────────────────────────

type PotentialTier = "Low" | "Average" | "High" | "Elite" | "Generational";

const POTENTIAL_CONFIG: Record<PotentialTier, {
  label: string;
  emoji: string;
  badgeClass: string;
  description: string;
}> = {
  Low:          { label: "Low",          emoji: "◇", badgeClass: "bg-zinc-500/15 text-zinc-500 border-zinc-400/30",          description: "Limited development ceiling" },
  Average:      { label: "Average",      emoji: "◈", badgeClass: "bg-sky-500/15 text-sky-600 border-sky-400/30",             description: "Solid but unremarkable ceiling" },
  High:         { label: "High",         emoji: "◆", badgeClass: "bg-green-500/15 text-green-600 border-green-500/30",       description: "Strong long-term development" },
  Elite:        { label: "Elite",        emoji: "★", badgeClass: "bg-purple-500/15 text-purple-600 border-purple-400/30",    description: "Exceptional development ceiling" },
  Generational: { label: "Generational", emoji: "✦", badgeClass: "bg-amber-400/20 text-amber-600 border-amber-400/40",      description: "Once-in-a-generation talent" },
};

const CONFIDENCE_LABEL: Record<string, string> = {
  uncertain: "Uncertain",
  likely:    "Likely",
  confident: "Confident",
};

function PotentialBadge({
  potential,
  confidence,
  size = "sm",
}: {
  potential: string;
  confidence?: string;
  size?: "xs" | "sm";
}) {
  const cfg = POTENTIAL_CONFIG[potential as PotentialTier];
  if (!cfg) return null;
  return (
    <div className="flex items-center gap-1">
      <span className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 font-semibold",
        size === "xs" ? "text-[9px] py-0.5" : "text-[10px] py-0.5",
        cfg.badgeClass,
      )}>
        {cfg.emoji} {cfg.label}
      </span>
      {confidence && confidence !== "confident" && (
        <span className="text-[9px] text-muted-foreground italic">
          ({CONFIDENCE_LABEL[confidence] ?? confidence})
        </span>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PlayerMarket() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("ALL");
  const [continent, setContinent] = useState<ContinentFilter>("ALL");
  const [search, setSearch] = useState("");
  const { data: players, isLoading } = useListFreeAgents({
    query: { queryKey: getListFreeAgentsQueryKey() }
  });

  const signMutation  = useSignContract();
  const scoutMutation = useScoutPlayer();

  if (isLoading) {
    return <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-96 w-full" />)}
    </div>;
  }

  const filteredPlayers = players
    ?.filter(p => filter === "ALL" || normalizePosition(p.position) === filter)
    ?.filter(p => continent === "ALL" || (p as any).continent === continent)
    ?.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  const handleSign = (playerId: number, values: any) => {
    signMutation.mutate({ 
      data: { 
        playerId, 
        salary: values.salary, 
        endDate: values.endDate, 
        bonusPerWin: values.winBonus 
      } 
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFreeAgentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListContractsQueryKey() });
        toast({ title: "Contract Signed!", description: "Welcome to the team!" });
      }
    });
  };

  const handleScout = (playerId: number) => {
    scoutMutation.mutate({ id: playerId }, {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getListFreeAgentsQueryKey() });
        const cfg = POTENTIAL_CONFIG[result.scoutedPotential as PotentialTier];
        const confidenceText = CONFIDENCE_LABEL[result.confidence] ?? result.confidence;
        toast({
          title: `Scout Report`,
          description: `${result.scoutName} rates this player as ${cfg?.label ?? result.scoutedPotential} potential. (${confidenceText} assessment)`,
        });
      },
      onError: (err: any) => {
        toast({
          title: "No Scout Available",
          description: err?.response?.data?.error ?? "Hire a scout to assess player potential.",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Senior Free Agents</h2>
          <p className="text-muted-foreground">
            Scout and sign elite talent from all 6 continents.
            {players && <span className="ml-2 text-xs font-semibold text-muted-foreground/70">{filteredPlayers?.length ?? 0} of {players.length} shown</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search players..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      {/* Continent filter */}
      <div className="flex gap-2 flex-wrap items-center">
        <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
        {CONTINENTS.map((c) => (
          <Button
            key={c}
            variant={continent === c ? "default" : "outline"}
            size="sm"
            onClick={() => setContinent(c)}
          >
            {c === "ALL" ? "All Continents" : `${CONTINENT_FLAG[c]} ${c}`}
          </Button>
        ))}
      </div>

      {/* Position filter */}
      <div className="flex gap-2 flex-wrap">
        {POSITIONS.map((pos) => (
          <Button
            key={pos}
            variant={filter === pos ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(pos)}
            data-testid={`filter-${pos.toLowerCase()}`}
          >
            {POSITION_LABELS[pos]}
          </Button>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredPlayers?.map((player) => {
          const overall = Math.round((player.power + player.speed + player.defense + player.serve + player.block) / 5);
          const isScouted = !!player.scoutedPotential;
          const isScoutingThis = scoutMutation.isPending && scoutMutation.variables?.id === player.id;

          return (
            <Card key={player.id} className="overflow-hidden hover:shadow-lg transition-all group">
              <div className="relative h-72 overflow-hidden bg-slate-800">
                <PlayerPortrait
                  name={player.name}
                  imageUrl={player.imageUrl}
                  continent={(player as any).continent}
                  nationality={player.nationality}
                  playerType={(player as any).playerType}
                  heightClass="h-72"
                  objectPosition="object-top"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Potential badge — top-right overlay */}
                <div className="absolute top-2 right-2">
                  {isScouted ? (
                    <PotentialBadge
                      potential={player.scoutedPotential!}
                      size="xs"
                    />
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/40 px-2 py-0.5 text-[9px] text-white/60">
                      <HelpCircle className="h-2.5 w-2.5" /> Unknown
                    </span>
                  )}
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-between">
                  <div>
                    <Badge className="bg-primary text-white border-0 text-[10px] mb-1">
                      {POSITION_LABELS[normalizePosition(player.position)] ?? player.position.replace(/_/g, " ").toUpperCase()}
                    </Badge>
                    <div className="font-bold text-base leading-tight text-white drop-shadow">{player.name}</div>
                    <div className="text-xs text-white/70">{player.nationality} • {player.age} yrs • {player.height}cm</div>
                    {(player as any).continent && (
                      <div className="text-[10px] text-white/50 mt-0.5">{CONTINENT_FLAG[(player as any).continent]} {(player as any).continent}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black text-white drop-shadow">{overall}</div>
                    <div className="text-[10px] text-white/70">OVR</div>
                  </div>
                </div>
              </div>

              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <StatMini label="Power" value={player.power} icon={Zap} color="text-orange-500" />
                  <StatMini label="Speed" value={player.speed} icon={Wind} color="text-blue-500" />
                  <StatMini label="Defense" value={player.defense} icon={Shield} color="text-green-500" />
                  <StatMini label="Serve" value={player.serve} icon={Target} color="text-purple-500" />
                  <StatMini label="Block" value={player.block} icon={Shield} color="text-red-500" />
                  <StatMini label="Stamina" value={player.stamina} icon={Activity} color="text-cyan-500" />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                    Morale: {player.morale ?? 80}%
                  </span>
                  <span className="text-muted-foreground">{player.nationality}</span>
                </div>

                {/* Potential row */}
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    {isScouted ? (
                      <>
                        <span className="font-medium text-foreground">Potential</span>
                        <PotentialBadge
                          potential={player.scoutedPotential!}
                          size="xs"
                        />
                      </>
                    ) : (
                      <span className="italic">Potential not assessed</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] gap-1"
                    onClick={() => handleScout(player.id)}
                    disabled={isScoutingThis}
                    data-testid={`button-scout-${player.id}`}
                  >
                    <Search className="h-3 w-3" />
                    {isScoutingThis ? "Scouting…" : "Scout"}
                  </Button>
                </div>

                <div className="flex items-center justify-between text-xs border-t border-border pt-2">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <DollarSign className="h-3 w-3" />
                    Asking ${Number(player.salary).toLocaleString()}/mo
                  </span>
                </div>

                <ContractModal player={player} onSign={(v) => handleSign(player.id, v)} isPending={signMutation.isPending} />
              </CardContent>
            </Card>
          );
        })}
        {(!filteredPlayers || filteredPlayers.length === 0) && (
          <div className="col-span-full text-center py-16 text-muted-foreground">
            <UserPlus className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg">No free agents match your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatMini({ label, value, icon: Icon, color }: { label: string, value: number, icon: any, color: string }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
      <Icon className={`h-3.5 w-3.5 ${color} shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
          <span className="text-muted-foreground truncate">{label}</span>
          <span>{value}</span>
        </div>
        <Progress value={value} className="h-1 mt-0.5" />
      </div>
    </div>
  );
}

function ContractModal({ player, onSign, isPending }: { player: any, onSign: (v: any) => void, isPending: boolean }) {
  const [salary, setSalary] = useState([5000]);
  const [winBonus, setWinBonus] = useState([500]);
  const [months, setMonths] = useState(6);

  const endDate = format(addMonths(new Date(), months), 'yyyy-MM-dd');

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full gap-2" data-testid={`button-sign-${player.id}`}>
          <UserPlus className="h-4 w-4" />
          Sign Contract
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contract Offer: {player.name}</DialogTitle>
          <DialogDescription>Negotiate terms. Max contract is 12 months.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span>Monthly Salary</span>
              <span className="text-primary font-bold">${salary[0].toLocaleString()}</span>
            </div>
            <Slider min={1000} max={20000} step={100} value={salary} onValueChange={setSalary} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span>Win Bonus</span>
              <span className="text-secondary font-bold">${winBonus[0].toLocaleString()}</span>
            </div>
            <Slider min={0} max={5000} step={50} value={winBonus} onValueChange={setWinBonus} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span>Contract Duration</span>
              <span>{months} Months</span>
            </div>
            <Slider min={1} max={12} step={1} value={[months]} onValueChange={(v) => setMonths(v[0])} />
            <p className="text-[10px] text-muted-foreground text-right">Ends: {endDate}</p>
          </div>
        </div>
        <Button 
          className="w-full" 
          onClick={() => onSign({ salary: salary[0], winBonus: winBonus[0], endDate })}
          disabled={isPending}
          data-testid="button-confirm-sign"
        >
          {isPending ? "Negotiating..." : "Finalize Contract"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
