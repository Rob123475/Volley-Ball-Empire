import {
  useSignContract,
  useScoutPlayer,
  useDraftPick,
  useGenerateDraftClass,
  getListFreeAgentsQueryKey,
  getListTransferWindowQueryKey,
  getListContractsQueryKey,
  getGetDraftPoolQueryKey,
  getGetTeamRosterQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
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
  CheckCircle2,
  Package,
  Handshake,
  ArrowDown,
  ArrowUp,
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

const POSITIONS = ["ALL", "setter", "spiker", "defender", "blocker", "all_rounder"] as const;
const POSITION_LABELS: Record<string, string> = {
  ALL: "All", setter: "Setter", spiker: "Spiker", defender: "Defender",
  blocker: "Blocker", all_rounder: "All-Rounder",
};

type PageSection = "senior" | "youth";
type MarketFilter = "all" | "available" | "free_agents" | "player_pool" | "signed" | "transfer";
type PlayerStatus = "signed" | "free_agent" | "player_pool" | "transfer_available";

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PlayerStatus, { label: string; badgeClass: string; icon: React.FC<{ className?: string }> }> = {
  signed:            { label: "Signed",            badgeClass: "bg-blue-500/15 text-blue-500 border-blue-400/30",      icon: CheckCircle2 as any },
  free_agent:        { label: "Free Agent",        badgeClass: "bg-emerald-500/15 text-emerald-500 border-emerald-400/30", icon: Users as any },
  player_pool:       { label: "Player Pool",       badgeClass: "bg-amber-500/15 text-amber-600 border-amber-400/30",  icon: Package as any },
  transfer_available:{ label: "Transfer Available",badgeClass: "bg-purple-500/15 text-purple-500 border-purple-400/30", icon: Handshake as any },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizePosition(pos: string): string {
  const map: Record<string, string> = {
    opposite: "spiker", universal: "all_rounder", libero: "defender",
    outside_hitter: "spiker", middle_blocker: "blocker",
    Setter: "setter", Spiker: "spiker", Defender: "defender",
    Blocker: "blocker", Server: "all_rounder",
  };
  return map[pos] ?? pos;
}

const formatPosition = (pos: string | null | undefined): string => {
  if (!pos) return "—";
  const map: Record<string, string> = {
    setter: "Setter", spiker: "Spiker", defender: "Defender",
    blocker: "Blocker", server: "All-Rounder", all_rounder: "All-Rounder",
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
  const isYouth = player.age >= 14 && player.age <= 17;
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
                    {disabled && <p className="text-[9px] text-muted-foreground text-center leading-tight">Ages 14–17 only</p>}
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

// ── Player card with full stats (free agents, transfer, signed) ───────────────

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
  const status: PlayerStatus = player.status ?? (player.currentTeamName ? "signed" : "free_agent");
  const statusCfg = STATUS_CONFIG[status];
  const canSign = status === "free_agent" || status === "transfer_available";

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all group">
      <div className="relative h-72 overflow-hidden bg-slate-800">
        <PlayerPortrait
          name={player.name}
          imageUrl={player.imageUrl}
          continent={player.continent}
          nationality={player.nationality}
          playerType={player.playerType}
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
        {/* Status badge */}
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className={cn("text-[10px] gap-1 font-bold", statusCfg.badgeClass)}>
            <statusCfg.icon className="h-2.5 w-2.5" />
            {statusCfg.label}
          </Badge>
          {player.currentTeamName && (
            <span className="text-xs text-muted-foreground truncate">at {player.currentTeamName}</span>
          )}
        </div>

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

        {player.contractEndDate && player.currentTeamName && (
          <div className="flex items-center justify-between text-xs border-t border-border pt-2">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Shield className="h-3 w-3 text-amber-500" />
              <span>Under contract at <span className="font-medium text-foreground">{player.currentTeamName}</span></span>
            </span>
            <span className="text-amber-500 font-medium">
              Expires {new Date(player.contractEndDate).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-xs border-t border-border pt-2">
          <span className="flex items-center gap-1 text-muted-foreground">
            <DollarSign className="h-3 w-3" />
            Asking ${Number(player.salary).toLocaleString()}/mo
          </span>
        </div>

        {canSign && (
          <ContractModal player={player} onSign={(v) => onSign(player.id, v)} isPending={signPending} />
        )}
      </CardContent>
    </Card>
  );
}

// ── Player Pool card (locked stats, sign on set terms) ────────────────────────

function PlayerPoolCard({
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
          continent={player.continent}
          nationality={player.nationality}
          playerType={player.playerType}
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
        {/* Status badge */}
        <Badge variant="outline" className={cn("text-[10px] gap-1 font-bold", STATUS_CONFIG.player_pool.badgeClass)}>
          <Package className="h-2.5 w-2.5" />
          Player Pool
        </Badge>

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
          disabled={isDrafting}
          data-testid={`button-draft-${player.id}`}
        >
          {isDrafting ? "Signing..." : "SIGN TO SQUAD"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Youth pool card (same as MarketPlayerCard but for youth players) ───────────

function YouthPoolCard({
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
          continent={player.continent}
          nationality={player.nationality}
          playerType={player.playerType}
          heightClass="h-72"
        />
        <NameStrip name={player.name} />
        <div className="absolute right-0 top-0 bottom-0 flex flex-col items-center justify-center z-10" style={{ width: "19%", gap: "5px", padding: "8px 3px" }}>
          <div className="text-center">
            <div className="text-[22px] font-black text-white leading-none" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.95)" }}>{overall}</div>
            <div className="text-[7px] text-white/55 uppercase tracking-widest font-bold">OVR</div>
          </div>
          <div className="w-4/5 h-px bg-white/20" />
          {isScouted ? <PotentialBadge potential={player.scoutedPotential!} size="xs" /> : (
            <span className="text-[7px] text-white/40 italic text-center leading-tight">Unknown</span>
          )}
          <div className="w-4/5 h-px bg-white/20" />
          <div className="text-[8px] text-primary font-black uppercase text-center leading-tight">
            {POSITION_LABELS[normalizePosition(player.position)] ?? player.position}
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
        <Badge variant="outline" className="bg-star-500/15 text-amber-600 border-amber-400/30 text-[10px] gap-1 font-bold">
          <Star className="h-2.5 w-2.5" />
          Youth Player • Age {player.age}
        </Badge>
        <div className="grid grid-cols-2 gap-2">
          <StatMini label="Power"   value={player.power}   icon={Zap}      color="text-orange-500" />
          <StatMini label="Speed"   value={player.speed}   icon={Wind}     color="text-blue-500"   />
          <StatMini label="Defense" value={player.defense} icon={Shield}   color="text-green-500"  />
          <StatMini label="Serve"   value={player.serve}   icon={Target}   color="text-purple-500" />
          <StatMini label="Block"   value={player.block}   icon={Shield}   color="text-red-500"    />
          <StatMini label="Stamina" value={player.stamina} icon={Activity} color="text-cyan-500"   />
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            {isScouted ? (
              <><span className="font-medium text-foreground">Potential</span><PotentialBadge potential={player.scoutedPotential!} size="xs" /></>
            ) : <span className="italic">Potential not assessed</span>}
          </div>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1"
            onClick={() => onScout(player.id)} disabled={isScoutingThis}
            data-testid={`button-scout-${player.id}`}>
            <Search className="h-3 w-3" />
            {isScoutingThis ? "Scouting…" : "Scout"}
          </Button>
        </div>
        <ContractModal player={player} onSign={(v) => onSign(player.id, v)} isPending={signPending} />
      </CardContent>
    </Card>
  );
}

// ── Filter pill config ────────────────────────────────────────────────────────

type FilterPillConfig = {
  id: MarketFilter;
  label: string;
  icon: React.FC<{ className?: string }>;
  desc: string;
};

const FILTER_PILLS: FilterPillConfig[] = [
  { id: "all",         label: "All Players",        icon: Users       as any, desc: "All senior players in the game." },
  { id: "available",   label: "Available",           icon: UserPlus    as any, desc: "All unsigned players — free agents and player pool combined." },
  { id: "free_agents", label: "Free Agents",         icon: Users       as any, desc: "Unsigned players not in any pool. Sign on negotiated terms." },
  { id: "player_pool", label: "Player Pool",         icon: Package     as any, desc: "Unsigned players in the Player Pool. Sign on a 6-month development contract." },
  { id: "signed",      label: "Signed Players",      icon: CheckCircle2 as any, desc: "Players currently under contract with a club." },
  { id: "transfer",    label: "Transfer Available",  icon: Handshake   as any, desc: "Signed players whose contract expires within 6 months — approachable now." },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PlayerMarket() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [section, setSection]     = useState<PageSection>("senior");
  const [filter, setFilter]       = useState<MarketFilter>("all");
  const [posFilter, setPosFilter] = useState<string>("ALL");
  const [continent, setContinent] = useState<ContinentFilter>("ALL");
  const [search, setSearch]       = useState("");
  const [statSort, setStatSort]   = useState<{ stat: string; dir: "desc" | "asc" } | null>(null);

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: marketAll, isLoading: marketLoading } = useQuery<any[]>({
    queryKey: ["players-market-all"],
    queryFn: () => fetch("/api/players/market-all").then(r => r.json()),
    staleTime: 30_000,
  });

  const { data: youthPool, isLoading: youthLoading } = useQuery<any[]>({
    queryKey: ["players-youth-pool"],
    queryFn: () => fetch("/api/players/youth-pool").then(r => r.json()),
    staleTime: 30_000,
  });

  const { data: generateResult } = useQuery<any[]>({
    queryKey: [getGetDraftPoolQueryKey()],
    queryFn: () => fetch("/api/draft").then(r => r.json()),
    staleTime: 30_000,
    enabled: false,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const signMutation     = useSignContract();
  const scoutMutation    = useScoutPlayer();
  const draftMutation    = useDraftPick();
  const generateMutation = useGenerateDraftClass();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["players-market-all"] });
    queryClient.invalidateQueries({ queryKey: ["players-youth-pool"] });
    queryClient.invalidateQueries({ queryKey: getListFreeAgentsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListTransferWindowQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListContractsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDraftPoolQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetTeamRosterQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["players-summary"] });
  };

  const handleSign = (playerId: number, values: any) => {
    signMutation.mutate({ data: { playerId, salary: values.salary, endDate: values.endDate, bonusPerWin: values.winBonus, squadRole: values.squadRole } }, {
      onSuccess: () => {
        invalidateAll();
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
        invalidateAll();
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
        invalidateAll();
        toast({ title: "Signed to Squad!", description: "The player has joined your team on a 6-month contract." });
      },
      onError: (err: any) => {
        toast({ title: "Cannot Sign", description: err?.response?.data?.error ?? "Unable to sign this player.", variant: "destructive" });
      },
    });
  };

  const handleGenerate = () => {
    generateMutation.mutate(undefined, {
      onSuccess: () => {
        invalidateAll();
        toast({ title: "Player Pool Refreshed!", description: "New players are available in the Player Pool." });
      },
      onError: () => {
        toast({ title: "Error", description: "Could not refresh the player pool.", variant: "destructive" });
      },
    });
  };

  // ── Filtering ─────────────────────────────────────────────────────────────

  const all = marketAll ?? [];

  const counts = {
    all:         all.length,
    available:   all.filter(p => !p.currentTeamId).length,
    free_agents: all.filter(p => p.status === "free_agent").length,
    player_pool: all.filter(p => p.status === "player_pool").length,
    signed:      all.filter(p => p.status === "signed" || p.status === "transfer_available").length,
    transfer:    all.filter(p => p.status === "transfer_available").length,
  };

  const applySearch = (list: any[]) =>
    list
      .filter(p => posFilter === "ALL" || normalizePosition(p.position) === posFilter)
      .filter(p => continent === "ALL" || p.continent === continent)
      .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  const baseFiltered = (() => {
    switch (filter) {
      case "all":         return all;
      case "available":   return all.filter(p => !p.currentTeamId);
      case "free_agents": return all.filter(p => p.status === "free_agent");
      case "player_pool": return all.filter(p => p.status === "player_pool");
      case "signed":      return all.filter(p => p.status === "signed" || p.status === "transfer_available");
      case "transfer":    return all.filter(p => p.status === "transfer_available");
      default:            return all;
    }
  })();

  const visiblePlayers = (() => {
    const list = applySearch(baseFiltered);
    if (!statSort) return list;
    const { stat, dir } = statSort;
    return [...list].sort((a, b) =>
      dir === "desc" ? (b[stat] ?? 0) - (a[stat] ?? 0) : (a[stat] ?? 0) - (b[stat] ?? 0)
    );
  })();

  const youthFiltered = applySearch(
    (youthPool ?? []).filter(p => p.age >= 14 && p.age <= 17)
  );

  const activeDesc = FILTER_PILLS.find(f => f.id === filter)?.desc ?? "";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
            <UserPlus className="h-8 w-8 text-secondary" />
            Player Market
          </h2>
          <p className="text-muted-foreground mt-1">
            {section === "senior"
              ? (filter === "all" ? `All ${counts.all} senior players in the game.` : activeDesc)
              : "Emerging talent aged 14–17 — sign on a regular contract."}
          </p>
          {/* Live database summary */}
          {marketAll && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{counts.all}</span> total senior players
              </span>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{counts.available}</span> available
              </span>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{counts.player_pool}</span> in Player Pool
              </span>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{counts.signed}</span> signed to teams
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Input
            placeholder="Search players..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-44"
          />
          {section === "senior" && filter === "player_pool" && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              data-testid="button-generate-draft-class"
            >
              <RefreshCw className={`h-4 w-4 ${generateMutation.isPending ? "animate-spin" : ""}`} />
              {generateMutation.isPending ? "Refreshing…" : "Refresh Pool"}
            </Button>
          )}
        </div>
      </div>

      {/* Section toggle: SENIOR / YOUTH */}
      <div className="flex gap-2 border-b border-border pb-4">
        <button
          onClick={() => setSection("senior")}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition-colors",
            section === "senior"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Senior Players
          {marketAll && (
            <Badge variant="secondary" className="ml-0.5 h-4 min-w-[1.5rem] px-1.5 text-[10px] rounded-full">
              {counts.all}
            </Badge>
          )}
        </button>
        <button
          onClick={() => setSection("youth")}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition-colors",
            section === "youth"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Star className="h-3.5 w-3.5" />
          Youth Players
          {youthPool && (
            <Badge variant="secondary" className="ml-0.5 h-4 min-w-[1.5rem] px-1.5 text-[10px] rounded-full">
              {youthPool.filter(p => p.age >= 14 && p.age <= 17).length}
            </Badge>
          )}
        </button>
      </div>

      {/* ── SENIOR section ── */}
      {section === "senior" && (
        <>
          {/* Filter pills */}
          <div className="flex gap-2 flex-wrap">
            {FILTER_PILLS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                  filter === id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                <Badge variant="secondary" className="ml-0.5 h-4 min-w-[1.5rem] px-1.5 text-[10px] rounded-full">
                  {marketAll ? counts[id] : "…"}
                </Badge>
              </button>
            ))}
          </div>

          {/* Player Pool facility banner */}
          {filter === "player_pool" && (
            <FacilityBonusBanner
              facilityType="youth_academy"
              facilityName="Youth Academy"
              getBonusText={(level) => {
                const elitePct = Math.round((0.12 + (level - 1) * (0.13 / 9)) * 100);
                const genPct   = Math.round((0.03 + (level - 1) * (0.09 / 9)) * 100);
                return `${elitePct}% Elite + ${genPct}% Generational prospect chance on pool refresh`;
              }}
            />
          )}

          {/* Continent + position filters */}
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

          {/* Stat sort pills */}
          <div className="flex gap-2 flex-wrap items-center">
            {([
              { stat: "power",   label: "Power",   icon: Zap,      color: "text-orange-500" },
              { stat: "speed",   label: "Speed",   icon: Wind,     color: "text-blue-500"   },
              { stat: "defense", label: "Defense", icon: Shield,   color: "text-green-500"  },
              { stat: "serve",   label: "Serve",   icon: Target,   color: "text-purple-500" },
              { stat: "block",   label: "Block",   icon: Shield,   color: "text-red-500"    },
              { stat: "stamina", label: "Stamina", icon: Activity, color: "text-cyan-500"   },
            ] as const).map(({ stat, label, icon: Icon, color }) => {
              const active = statSort?.stat === stat;
              const dir    = active ? statSort!.dir : null;
              return (
                <button
                  key={stat}
                  onClick={() => {
                    if (!active) {
                      setStatSort({ stat, dir: "desc" });
                    } else if (dir === "desc") {
                      setStatSort({ stat, dir: "asc" });
                    } else {
                      setStatSort(null);
                    }
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors border",
                    active
                      ? "bg-secondary/20 border-secondary text-foreground"
                      : "bg-muted/40 border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className={cn("h-3 w-3", active ? color : "")} />
                  {label}
                  {active && (
                    dir === "desc"
                      ? <ArrowDown className="h-3 w-3" />
                      : <ArrowUp   className="h-3 w-3" />
                  )}
                </button>
              );
            })}
            {statSort && (
              <button
                onClick={() => setStatSort(null)}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1"
              >
                Clear sort
              </button>
            )}
          </div>

          {/* Result count */}
          {marketAll && (
            <p className="text-xs text-muted-foreground/70 font-medium -mt-4">
              {visiblePlayers.length} of {baseFiltered.length} shown
            </p>
          )}

          {/* Loading skeleton */}
          {marketLoading && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-96 w-full" />)}
            </div>
          )}

          {/* Player grid */}
          {!marketLoading && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {visiblePlayers.map((player) =>
                player.status === "player_pool" ? (
                  <PlayerPoolCard
                    key={player.id}
                    player={player}
                    onDraft={handleDraft}
                    isDrafting={draftMutation.isPending && (draftMutation.variables as any)?.data?.draftPlayerId === player.id}
                  />
                ) : (
                  <MarketPlayerCard
                    key={player.id}
                    player={player}
                    onSign={handleSign}
                    onScout={handleScout}
                    isScoutingThis={scoutMutation.isPending && scoutMutation.variables?.id === player.id}
                    signPending={signMutation.isPending}
                  />
                )
              )}
              {visiblePlayers.length === 0 && !marketLoading && (
                <div className="col-span-full text-center py-16 text-muted-foreground">
                  <Box className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  {filter === "transfer" && !search && posFilter === "ALL" && continent === "ALL" ? (
                    <>
                      <p className="text-lg">No players in the transfer window.</p>
                      <p className="text-sm">Players become approachable in their final 6 months of contract.</p>
                    </>
                  ) : filter === "player_pool" && !search && posFilter === "ALL" && continent === "ALL" ? (
                    <>
                      <p className="text-lg">Player pool is empty.</p>
                      <p className="text-sm">Click "Refresh Pool" to add new prospects (influenced by your Youth Academy).</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg">No players match your filters.</p>
                      <p className="text-sm">Try adjusting your search, position or continent.</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── YOUTH section ── */}
      {section === "youth" && (
        <>
          {/* Continent + position filters */}
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
              <Button key={pos} variant={posFilter === pos ? "default" : "outline"} size="sm" onClick={() => setPosFilter(pos)}>
                {POSITION_LABELS[pos]}
              </Button>
            ))}
          </div>

          {youthPool && (
            <p className="text-xs text-muted-foreground/70 font-medium -mt-4">
              {youthFiltered.length} of {youthPool.filter(p => p.age >= 14 && p.age <= 17).length} shown
            </p>
          )}

          {youthLoading && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-96 w-full" />)}
            </div>
          )}

          {!youthLoading && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {youthFiltered.map((player) => (
                <YouthPoolCard
                  key={player.id}
                  player={player}
                  onSign={handleSign}
                  onScout={handleScout}
                  isScoutingThis={scoutMutation.isPending && scoutMutation.variables?.id === player.id}
                  signPending={signMutation.isPending}
                />
              ))}
              {youthFiltered.length === 0 && (
                <div className="col-span-full text-center py-16 text-muted-foreground">
                  <Star className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg">No youth players match your filters.</p>
                  <p className="text-sm">Try adjusting your continent or position filter.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
