import {
  useListFreeAgents,
  useListTransferWindow,
  useSignContract,
  useScoutPlayer,
  useGetDraftPool,
  useDraftPick,
  useGenerateDraftClass,
  getListFreeAgentsQueryKey,
  getListTransferWindowQueryKey,
  getListContractsQueryKey,
  getGetDraftPoolQueryKey,
  getGetTeamRosterQueryKey,
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
  Globe,
  Box,
  RefreshCw,
  Lock,
  TrendingUp,
  Users,
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
import { PlayerPortrait } from "@/components/player-portrait";
import { FacilityBonusBanner } from "@/components/facility-bonus-banner";
import { format, addMonths } from "date-fns";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const CONTINENTS = ["ALL", "Africa & Middle East", "Asia", "Europe", "North America", "South America", "Oceania"] as const;
type ContinentFilter = typeof CONTINENTS[number];

const CONTINENT_FLAG: Record<string, string> = {
  "Africa & Middle East": "🌍", Asia: "🌏", Europe: "🌍", "North America": "🌎", "South America": "🌎", Oceania: "🌊",
};

const POSITIONS = ["ALL", "setter", "spiker", "defender", "blocker", "server", "all_rounder"] as const;
const POSITION_LABELS: Record<string, string> = {
  ALL: "All", setter: "Setter", spiker: "Spiker", defender: "Defender",
  blocker: "Blocker", server: "Server", all_rounder: "All-Rounder",
};

type MarketTab = "transfer" | "draft" | "youth" | "free-agents";

const TABS: { id: MarketTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: "transfer",    label: "Transfer Market", icon: TrendingUp as any },
  { id: "draft",       label: "Draft Pool",      icon: Box        as any },
  { id: "youth",       label: "Youth",           icon: Star       as any },
  { id: "free-agents", label: "Free Agents",     icon: Users      as any },
];

// Tab descriptions shown below the title
const TAB_DESC: Record<MarketTab, string> = {
  "transfer":    "Established players age 19+ available for immediate signing.",
  "draft":       "Young stars aged 20 and under. All rookies receive a 6-month contract on signing.",
  "youth":       "Emerging talent aged 18 and under — sign on a regular contract.",
  "free-agents": "All unsigned players available across every age group.",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizePosition(pos: string): string {
  const map: Record<string, string> = {
    opposite: "spiker", universal: "all_rounder", libero: "defender",
    outside_hitter: "spiker", middle_blocker: "blocker",
    Setter: "setter", Spiker: "spiker", Defender: "defender",
    Blocker: "blocker", Server: "server",
  };
  return map[pos] ?? pos;
}

const formatPosition = (pos: string | null | undefined): string => {
  if (!pos) return "—";
  const map: Record<string, string> = {
    setter: "Setter", spiker: "Spiker", defender: "Defender",
    blocker: "Blocker", server: "Server", all_rounder: "All-Rounder",
    opposite: "Spiker", universal: "All-Rounder",
  };
  return map[pos.toLowerCase()] ?? pos.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
};

// ── Potential display ─────────────────────────────────────────────────────────

type PotentialTier = "Low" | "Average" | "High" | "Elite" | "Generational";

const POTENTIAL_CONFIG: Record<PotentialTier, { label: string; emoji: string; badgeClass: string; description: string }> = {
  Low:          { label: "Low",          emoji: "◇", badgeClass: "bg-zinc-500/15 text-zinc-500 border-zinc-400/30",       description: "Limited development ceiling" },
  Average:      { label: "Average",      emoji: "◈", badgeClass: "bg-sky-500/15 text-sky-600 border-sky-400/30",          description: "Solid but unremarkable ceiling" },
  High:         { label: "High",         emoji: "◆", badgeClass: "bg-green-500/15 text-green-600 border-green-500/30",    description: "Strong long-term development" },
  Elite:        { label: "Elite",        emoji: "★", badgeClass: "bg-purple-500/15 text-purple-600 border-purple-400/30", description: "Exceptional development ceiling" },
  Generational: { label: "Generational", emoji: "✦", badgeClass: "bg-amber-400/20 text-amber-600 border-amber-400/40",   description: "Once-in-a-generation talent" },
};

const CONFIDENCE_LABEL: Record<string, string> = { uncertain: "Uncertain", likely: "Likely", confident: "Confident" };

function PotentialBadge({ potential, confidence, size = "sm" }: { potential: string; confidence?: string; size?: "xs" | "sm" }) {
  const cfg = POTENTIAL_CONFIG[potential as PotentialTier];
  if (!cfg) return null;
  return (
    <div className="flex items-center gap-1">
      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 font-semibold", size === "xs" ? "text-[9px] py-0.5" : "text-[10px] py-0.5", cfg.badgeClass)}>
        {cfg.emoji} {cfg.label}
      </span>
      {confidence && confidence !== "confident" && (
        <span className="text-[9px] text-muted-foreground italic">({CONFIDENCE_LABEL[confidence] ?? confidence})</span>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatMini({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
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

function LockedStatBar({ label, icon: Icon }: { label: string; icon: any }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3 w-3 text-muted-foreground/30 shrink-0" />
      <div className="flex-1">
        <div className="flex justify-between text-[10px] uppercase tracking-wider font-bold mb-0.5">
          <span className="text-muted-foreground/30">{label}</span>
          <Lock className="h-2.5 w-2.5 text-muted-foreground/30" />
        </div>
        <div className="h-1 w-full bg-muted/40 rounded-full overflow-hidden">
          <div className="h-full w-0 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// Shared name strip used in both market and draft cards
function NameStrip({ name }: { name: string }) {
  const parts = name.split(" ");
  const firstName = parts[0];
  const surname = parts.slice(1).join(" ");
  const nameStyle: React.CSSProperties = {
    fontFamily: "'Bebas Neue', sans-serif",
    writingMode: "vertical-rl",
    textOrientation: "upright",
    textTransform: "uppercase",
    fontSize: "14px",
    letterSpacing: "0.08em",
    lineHeight: 1.0,
    maxHeight: "252px",
    overflow: "hidden",
    whiteSpace: "nowrap",
    color: "#FBBF24",
    textShadow: "0 1px 6px rgba(0,0,0,0.9)",
  };
  return (
    <div className="absolute left-0 top-0 bottom-0 flex flex-row items-center justify-center z-10 gap-0.5" style={{ width: "22%" }}>
      <span className="font-bold select-none" style={nameStyle}>{firstName}</span>
      {surname && <span className="font-bold select-none" style={nameStyle}>{surname}</span>}
    </div>
  );
}

type SquadRole = "starter" | "interchange" | "reserve";

const SQUAD_DESTINATIONS: { role: SquadRole; label: string }[] = [
  { role: "starter",     label: "Main Team" },
  { role: "interchange", label: "Interchange" },
  { role: "reserve",     label: "Youth Team" },
];

function ContractModal({ player, onSign, isPending }: { player: any; onSign: (v: any) => void; isPending: boolean }) {
  const [salary, setSalary]   = useState([5000]);
  const [winBonus, setWinBonus] = useState([500]);
  const [months, setMonths]   = useState(6);
  const isYouth = player.age >= 14 && player.age <= 18;
  const defaultRole: SquadRole = isYouth ? "reserve" : "interchange";
  const [squadRole, setSquadRole] = useState<SquadRole>(defaultRole);
  const endDate = format(addMonths(new Date(), months), "yyyy-MM-dd");

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
          <div className="space-y-2">
            <p className="text-sm font-medium">Assign To</p>
            <div className="grid grid-cols-3 gap-1.5">
              {SQUAD_DESTINATIONS.map(({ role, label }) => {
                const youthOnly = role === "reserve";
                const disabled = youthOnly && !isYouth;
                return (
                  <div key={role} className="flex flex-col gap-1">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => !disabled && setSquadRole(role)}
                      className={[
                        "rounded-md border px-2 py-2 text-xs font-semibold transition-colors",
                        disabled
                          ? "cursor-not-allowed opacity-35 border-border text-muted-foreground bg-muted/30"
                          : squadRole === role
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-muted/40 text-foreground hover:border-primary/60 hover:bg-muted/70",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                    {disabled && <p className="text-[9px] text-muted-foreground text-center leading-tight">Ages 14–18 only</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <Button
          className="w-full"
          onClick={() => onSign({ salary: salary[0], winBonus: winBonus[0], endDate, squadRole })}
          disabled={isPending}
          data-testid="button-confirm-sign"
        >
          {isPending ? "Negotiating..." : "Finalize Contract"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// ── Market player card (Transfer Market / Youth / Free Agents tabs) ────────────

function MarketPlayerCard({
  player,
  onSign,
  onScout,
  isScoutingThis,
  signPending,
}: {
  player: any;
  onSign: (id: number, values: any) => void;
  onScout: (id: number) => void;
  isScoutingThis: boolean;
  signPending: boolean;
}) {
  const overall   = Math.round((player.power + player.speed + player.defense + player.serve + player.block) / 5);
  const isScouted = !!player.scoutedPotential;

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all group">
      <div className="relative h-72 overflow-hidden bg-slate-800">
        <PlayerPortrait
          name={player.name}
          imageUrl={player.imageUrl}
          continent={(player as any).continent}
          nationality={player.nationality}
          playerType={(player as any).playerType}
          heightClass="h-72"
        />
        <NameStrip name={player.name} />
        <div className="absolute right-0 top-0 bottom-0 flex flex-col items-center justify-center z-10" style={{ width: "19%", gap: "5px", padding: "8px 3px" }}>
          <div className="text-center">
            <div className="text-[22px] font-black text-white leading-none" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.95)" }}>{overall}</div>
            <div className="text-[7px] text-white/55 uppercase tracking-widest font-bold">OVR</div>
          </div>
          <div className="w-4/5 h-px bg-white/20" />
          {isScouted ? (
            <PotentialBadge potential={player.scoutedPotential!} size="xs" />
          ) : (
            <span className="text-[7px] text-white/40 italic text-center leading-tight">Unknown</span>
          )}
          <div className="w-4/5 h-px bg-white/20" />
          <div className="text-[8px] text-primary font-black uppercase text-center leading-tight">
            {POSITION_LABELS[normalizePosition(player.position)] ?? player.position.replace(/_/g, " ")}
          </div>
          <div className="w-4/5 h-px bg-white/20" />
          <div className="text-center" style={{ fontSize: "8px", lineHeight: 1.4 }}>
            <div className="text-white/80 font-medium leading-tight">{player.nationality}</div>
            <div className="text-white/55 mt-0.5">{player.age}y</div>
            <div className="text-white/55">{player.height}cm</div>
          </div>
        </div>
      </div>

      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <StatMini label="Power"   value={player.power}   icon={Zap}      color="text-orange-500" />
          <StatMini label="Speed"   value={player.speed}   icon={Wind}     color="text-blue-500"   />
          <StatMini label="Defense" value={player.defense} icon={Shield}   color="text-green-500"  />
          <StatMini label="Serve"   value={player.serve}   icon={Target}   color="text-purple-500" />
          <StatMini label="Block"   value={player.block}   icon={Shield}   color="text-red-500"    />
          <StatMini label="Stamina" value={player.stamina} icon={Activity} color="text-cyan-500"   />
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
            Morale: {player.morale ?? 80}%
          </span>
          <span className="text-muted-foreground">{player.nationality}</span>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-2">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            {isScouted ? (
              <>
                <span className="font-medium text-foreground">Potential</span>
                <PotentialBadge potential={player.scoutedPotential!} size="xs" />
              </>
            ) : (
              <span className="italic">Potential not assessed</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] gap-1"
            onClick={() => onScout(player.id)}
            disabled={isScoutingThis}
            data-testid={`button-scout-${player.id}`}
          >
            <Search className="h-3 w-3" />
            {isScoutingThis ? "Scouting…" : "Scout"}
          </Button>
        </div>

        {player.currentTeamName && (
          <div className="flex items-center justify-between text-xs border-t border-border pt-2">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Shield className="h-3 w-3 text-amber-500" />
              <span>Under contract at <span className="font-medium text-foreground">{player.currentTeamName}</span></span>
            </span>
            {player.contractEndDate && (
              <span className="text-amber-500 font-medium">
                Expires {new Date(player.contractEndDate).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-xs border-t border-border pt-2">
          <span className="flex items-center gap-1 text-muted-foreground">
            <DollarSign className="h-3 w-3" />
            Asking ${Number(player.salary).toLocaleString()}/mo
          </span>
        </div>

        <ContractModal player={player} onSign={(v) => onSign(player.id, v)} isPending={signPending} />
      </CardContent>
    </Card>
  );
}

// ── Draft player card ─────────────────────────────────────────────────────────

function DraftPlayerCard({
  player,
  onDraft,
  isDrafting,
}: {
  player: any;
  onDraft: (id: number) => void;
  isDrafting: boolean;
}) {
  return (
    <Card data-testid={`card-draft-${player.id}`} className="overflow-hidden hover:border-secondary hover:shadow-lg transition-all">
      <div className="relative h-72 overflow-hidden bg-slate-800">
        <PlayerPortrait
          name={player.name}
          imageUrl={player.imageUrl}
          continent={(player as any).continent}
          nationality={player.nationality}
          playerType={(player as any).playerType}
          heightClass="h-72"
        />
        <NameStrip name={player.name} />
        <div className="absolute right-0 top-0 bottom-0 flex flex-col items-center justify-center z-10" style={{ width: "19%", gap: "5px", padding: "8px 3px" }}>
          <div className="text-center">
            <div className="text-[22px] font-black text-white/30 leading-none" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.95)" }}>?</div>
            <div className="text-[7px] text-white/30 uppercase tracking-widest font-bold">OVR</div>
          </div>
          <div className="w-4/5 h-px bg-white/20" />
          <div className="text-[8px] text-secondary font-black uppercase text-center leading-tight">
            {formatPosition(player.position)}
          </div>
          <div className="w-4/5 h-px bg-white/20" />
          <div className="text-center" style={{ fontSize: "8px", lineHeight: 1.4 }}>
            <div className="text-white/80 font-medium leading-tight">{player.nationality}</div>
            <div className="text-white/55 mt-0.5">{player.age}y</div>
            <div className="text-white/55">{player.height}cm</div>
          </div>
        </div>
      </div>

      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-1 gap-1.5">
          <LockedStatBar label="Power"   icon={Zap}      />
          <LockedStatBar label="Speed"   icon={Wind}     />
          <LockedStatBar label="Defense" icon={Shield}   />
          <LockedStatBar label="Serve"   icon={Target}   />
          <LockedStatBar label="Block"   icon={Shield}   />
          <LockedStatBar label="Stamina" icon={Activity} />
        </div>

        <div className="flex items-center justify-center text-xs border-t border-border pt-2">
          <span className="flex items-center gap-1.5 text-muted-foreground/50">
            <Shield className="h-3 w-3" />
            Sign to reveal attributes
          </span>
        </div>

        <Button
          className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold"
          onClick={() => onDraft(player.id)}
          disabled={isDrafting || !player.available}
          data-testid={`button-draft-${player.id}`}
        >
          {!player.available ? "DRAFTED" : isDrafting ? "Drafting..." : "DRAFT PLAYER"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PlayerMarket() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [tab, setTab]           = useState<MarketTab>("transfer");
  const [posFilter, setPosFilter] = useState<string>("ALL");
  const [continent, setContinent] = useState<ContinentFilter>("ALL");
  const [search, setSearch]     = useState("");

  const { data: players, isLoading: playersLoading } = useListFreeAgents({
    query: { queryKey: getListFreeAgentsQueryKey() },
  });
  const { data: transferWindow, isLoading: transferWindowLoading } = useListTransferWindow({
    query: { queryKey: getListTransferWindowQueryKey() },
  });
  const { data: draftPool, isLoading: draftLoading } = useGetDraftPool({
    query: { queryKey: getGetDraftPoolQueryKey() },
  });

  const signMutation     = useSignContract();
  const scoutMutation    = useScoutPlayer();
  const draftMutation    = useDraftPick();
  const generateMutation = useGenerateDraftClass();

  const handleSign = (playerId: number, values: any) => {
    signMutation.mutate({ data: { playerId, salary: values.salary, endDate: values.endDate, bonusPerWin: values.winBonus, squadRole: values.squadRole } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFreeAgentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListTransferWindowQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListContractsQueryKey() });
        toast({ title: "Contract Signed!", description: "Welcome to the team!" });
      },
      onError: (err: any) => {
        toast({ title: "Cannot Sign Player", description: err?.response?.data?.error ?? "Unable to sign this player.", variant: "destructive" });
      },
    });
  };

  const handleScout = (playerId: number) => {
    scoutMutation.mutate({ id: playerId }, {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getListFreeAgentsQueryKey() });
        const cfg = POTENTIAL_CONFIG[result.scoutedPotential as PotentialTier];
        const confidenceText = CONFIDENCE_LABEL[result.confidence] ?? result.confidence;
        toast({ title: "Scout Report", description: `${result.scoutName} rates this player as ${cfg?.label ?? result.scoutedPotential} potential. (${confidenceText} assessment)` });
      },
      onError: (err: any) => {
        toast({ title: "No Scout Available", description: err?.response?.data?.error ?? "Hire a scout to assess player potential.", variant: "destructive" });
      },
    });
  };

  const handleDraft = (playerId: number) => {
    draftMutation.mutate({ data: { draftPlayerId: playerId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetDraftPoolQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTeamRosterQueryKey() });
        toast({ title: "Draft Pick Successful!", description: "The rookie has joined your team on a 6-month contract." });
      },
    });
  };

  const handleGenerate = () => {
    generateMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetDraftPoolQueryKey() });
        toast({ title: "New Draft Class Generated!", description: "30 fresh prospects are ready — quality influenced by your Youth Academy." });
      },
      onError: () => {
        toast({ title: "Error", description: "Could not generate a new class.", variant: "destructive" });
      },
    });
  };

  // Client-side filtering for market tabs
  const baseMarketPlayers  = players ?? [];
  const baseTransferPlayers = transferWindow ?? [];
  const applyFilters = (list: any[]) =>
    list
      .filter(p => posFilter === "ALL" || normalizePosition(p.position) === posFilter)
      .filter(p => continent === "ALL" || (p as any).continent === continent)
      .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  const transferPlayers  = applyFilters(baseTransferPlayers);
  const youthPlayers     = applyFilters(baseMarketPlayers.filter(p => p.age <= 18));
  const freeAgentPlayers = applyFilters(baseMarketPlayers);

  const visibleMarketPlayers =
    tab === "transfer"    ? transferPlayers  :
    tab === "youth"       ? youthPlayers     :
    tab === "free-agents" ? freeAgentPlayers : [];

  const isDraftTab    = tab === "draft";
  const isMarketTab   = !isDraftTab;
  const isLoadingMain = isDraftTab ? draftLoading : (tab === "transfer" ? transferWindowLoading : playersLoading);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
            <UserPlus className="h-8 w-8 text-secondary" />
            Player Market
          </h2>
          <p className="text-muted-foreground">{TAB_DESC[tab]}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Search — only for market tabs */}
          {isMarketTab && (
            <Input
              placeholder="Search players..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-44"
            />
          )}
          {/* Generate Class button — only for draft tab */}
          {isDraftTab && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              data-testid="button-generate-draft-class"
            >
              <RefreshCw className={`h-4 w-4 ${generateMutation.isPending ? "animate-spin" : ""}`} />
              {generateMutation.isPending ? "Generating…" : "Generate New Class"}
            </Button>
          )}
        </div>
      </div>

      {/* Tab pills */}
      <div className="flex gap-2 flex-wrap border-b border-border pb-4">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
              tab === id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {/* Live counts */}
            {id !== "draft" && (
              <Badge variant="secondary" className="ml-0.5 h-4 min-w-[1.2rem] px-1 text-[10px] rounded-full">
                {id === "transfer"    ? (transferWindow ? baseTransferPlayers.length : "…") :
                 id === "youth"       ? (players ? baseMarketPlayers.filter(p => p.age <= 18).length : "…") :
                 /* free-agents */      (players ? baseMarketPlayers.length : "…")}
              </Badge>
            )}
            {id === "draft" && (
              <Badge variant="secondary" className="ml-0.5 h-4 min-w-[1.2rem] px-1 text-[10px] rounded-full">
                {draftPool ? draftPool.filter(p => p.available).length : "…"}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Draft Pool: facility banner */}
      {isDraftTab && (
        <FacilityBonusBanner
          facilityType="youth_academy"
          facilityName="Youth Academy"
          getBonusText={(level) => {
            const elitePct = Math.round((0.12 + (level - 1) * (0.13 / 9)) * 100);
            const genPct   = Math.round((0.03 + (level - 1) * (0.09 / 9)) * 100);
            return `${elitePct}% Elite + ${genPct}% Generational prospect chance on Generate`;
          }}
        />
      )}

      {/* Market tabs: continent + position filters */}
      {isMarketTab && (
        <>
          <div className="flex gap-2 flex-wrap items-center">
            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
            {CONTINENTS.map((c) => (
              <Button key={c} variant={continent === c ? "default" : "outline"} size="sm" onClick={() => setContinent(c)}>
                {c === "ALL" ? "All Continents" : `${CONTINENT_FLAG[c]} ${c}`}
              </Button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {POSITIONS.map((pos) => (
              <Button
                key={pos}
                variant={posFilter === pos ? "default" : "outline"}
                size="sm"
                onClick={() => setPosFilter(pos)}
                data-testid={`filter-${pos.toLowerCase()}`}
              >
                {POSITION_LABELS[pos]}
              </Button>
            ))}
          </div>
        </>
      )}

      {/* Result count for market tabs */}
      {isMarketTab && (tab === "transfer" ? transferWindow : players) && (
        <p className="text-xs text-muted-foreground/70 font-medium -mt-4">
          {visibleMarketPlayers.length} of {
            tab === "transfer"    ? baseTransferPlayers.length :
            tab === "youth"       ? baseMarketPlayers.filter(p => p.age <= 18).length :
            baseMarketPlayers.length
          } shown
        </p>
      )}

      {/* Loading skeleton */}
      {isLoadingMain && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-96 w-full" />)}
        </div>
      )}

      {/* Draft Pool grid */}
      {!isLoadingMain && isDraftTab && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {draftPool?.map((player) => (
            <DraftPlayerCard
              key={player.id}
              player={player}
              onDraft={handleDraft}
              isDrafting={draftMutation.isPending && (draftMutation.variables as any)?.data?.draftPlayerId === player.id}
            />
          ))}
          {(!draftPool || draftPool.length === 0) && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <Box className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg">No rookies available in the draft pool.</p>
              <p className="text-sm">Generate a new class to see fresh prospects.</p>
            </div>
          )}
        </div>
      )}

      {/* Market (Transfer / Youth / Free Agents) grid */}
      {!isLoadingMain && isMarketTab && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visibleMarketPlayers.map((player) => (
            <MarketPlayerCard
              key={player.id}
              player={player}
              onSign={handleSign}
              onScout={handleScout}
              isScoutingThis={scoutMutation.isPending && scoutMutation.variables?.id === player.id}
              signPending={signMutation.isPending}
            />
          ))}
          {visibleMarketPlayers.length === 0 && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <UserPlus className="h-16 w-16 mx-auto mb-4 opacity-20" />
              {tab === "transfer" && !search && posFilter === "ALL" && continent === "ALL" ? (
                <>
                  <p className="text-lg">No players in the transfer window.</p>
                  <p className="text-sm">Players become approachable in their final 6 months of contract.</p>
                </>
              ) : (
                <>
                  <p className="text-lg">No players match your search.</p>
                  <p className="text-sm">Try adjusting your filters or search term.</p>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
