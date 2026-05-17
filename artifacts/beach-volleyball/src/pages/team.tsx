import {
  useGetTeamRoster,
  useListOutfits,
  useUpdatePlayerOutfit,
  useReleasePlayer,
  useSetPlayerRole,
  getGetTeamRosterQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Shirt,
  Trash2,
  Star,
  Zap,
  Shield,
  Target,
  Wind,
  AlertTriangle,
  Users,
  ArrowUp,
  ChevronsUp,
  ChevronsDown,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Role = "starter" | "interchange" | "reserve";

const ROLE_CONFIG: Record<Role, { label: string; color: string; bg: string; border: string; maxSlots: number }> = {
  starter:     { label: "Match Player",    color: "text-emerald-700", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-400", maxSlots: 2 },
  interchange: { label: "Interchange",     color: "text-amber-700",   bg: "bg-amber-50 dark:bg-amber-950/30",   border: "border-amber-400",   maxSlots: 3 },
  reserve:     { label: "Reserve",         color: "text-slate-600",   bg: "bg-slate-50 dark:bg-slate-950/30",   border: "border-slate-300",   maxSlots: Infinity },
};

const getFatigueColor = (f: number) => f < 30 ? "bg-green-500" : f < 60 ? "bg-yellow-500" : "bg-red-500";
const getFatigueLabel = (f: number) => f < 30 ? "Fresh" : f < 60 ? "Moderate" : f < 80 ? "Tired" : "Exhausted";

function StatBar({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
        <span className="flex items-center gap-1"><Icon className="h-3 w-3" />{label}</span>
        <span>{value}</span>
      </div>
      <Progress value={value} className="h-1.5" />
    </div>
  );
}

function SlotBar({ filled, max, role }: { filled: number; max: number; role: Role }) {
  const cfg = ROLE_CONFIG[role];
  if (max === Infinity) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-2.5 flex-1 rounded-full border transition-colors",
            i < filled
              ? role === "starter" ? "bg-emerald-500 border-emerald-500"
                : "bg-amber-400 border-amber-400"
              : "bg-muted border-border"
          )}
        />
      ))}
      <span className="text-xs text-muted-foreground font-semibold ml-1">{filled}/{max}</span>
    </div>
  );
}

export default function TeamRoster() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: roster, isLoading } = useGetTeamRoster({ query: { queryKey: getGetTeamRosterQueryKey() } });
  const { data: outfits } = useListOutfits();
  const releaseMutation = useReleasePlayer();
  const outfitMutation  = useUpdatePlayerOutfit();
  const roleMutation    = useSetPlayerRole();

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-96 w-full" />)}
        </div>
      </div>
    );
  }

  const starters     = roster?.starters     ?? [];
  const interchanges = roster?.interchanges  ?? [];
  const reserves     = roster?.reserves     ?? [];
  const allPlayers   = [...starters, ...interchanges, ...reserves];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetTeamRosterQueryKey() });

  const handleRelease = (playerId: number) => {
    releaseMutation.mutate({ id: playerId }, {
      onSuccess: () => { invalidate(); toast({ title: "Player Released", description: "Contract terminated." }); },
    });
  };

  const handleOutfitChange = (playerId: number, outfitId: number) => {
    outfitMutation.mutate({ id: playerId, data: { outfitId } }, {
      onSuccess: () => { invalidate(); toast({ title: "Outfit Changed" }); },
    });
  };

  const handleRoleChange = (playerId: number, role: Role) => {
    const limitWarnings: Record<Role, string | null> = {
      starter:     starters.length     >= 2 && !starters.find(p => p.id === playerId)     ? "Only 2 match player slots. Move another player first." : null,
      interchange: interchanges.length >= 3 && !interchanges.find(p => p.id === playerId)  ? "Only 3 interchange slots. Move another player first." : null,
      reserve:     null,
    };
    const warning = limitWarnings[role];
    if (warning) { toast({ title: "Slot Full", description: warning, variant: "destructive" }); return; }

    roleMutation.mutate({ id: playerId, data: { role } }, {
      onSuccess: () => {
        invalidate();
        toast({ title: "Squad Updated", description: `Player moved to ${ROLE_CONFIG[role].label}.` });
      },
    });
  };

  const PlayerCard = ({ player, role }: { player: any; role: Role }) => {
    const rating  = Math.round((player.power + player.speed + player.defense + player.serve + player.block) / 5);
    const fatigue = player.fatigue ?? 0;
    const cfg     = ROLE_CONFIG[role];

    // What moves are available from this role
    const canMoveUp   = role === "reserve" || role === "interchange";
    const canMoveDown = role === "starter"  || role === "interchange";
    const upRole   = role === "reserve" ? "interchange" : "starter";
    const downRole = role === "starter"  ? "interchange" : "reserve";

    return (
      <Card
        data-testid={`card-player-${player.id}`}
        className={cn("overflow-hidden border-2 transition-all duration-200 hover:shadow-lg", cfg.border, cfg.bg)}
      >
        {/* Role badge strip */}
        <div className={cn("flex items-center justify-between px-3 py-1.5 border-b", cfg.bg)}>
          <Badge
            variant="outline"
            className={cn("text-[10px] font-black uppercase tracking-widest border-current", cfg.color)}
          >
            {cfg.label}
          </Badge>
          {player.isInjured && (
            <Badge variant="destructive" className="text-[10px] gap-1">
              <AlertTriangle className="h-3 w-3" /> Injured
            </Badge>
          )}
        </div>

        <div className="relative h-64 overflow-hidden">
          <img
            src={player.imageUrl ?? undefined}
            alt={player.name}
            className="w-full h-full object-cover object-[center_20%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-between">
            <div>
              <div className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-0.5">
                {player.position.replace(/_/g, " ")}
              </div>
              <div className="text-lg font-black leading-tight text-white drop-shadow">{player.name}</div>
              <div className="text-xs text-white/70 mt-0.5">{player.nationality}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-white drop-shadow">{rating}</div>
              <div className="text-[10px] text-white/70">OVR</div>
            </div>
          </div>
        </div>

        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{player.age} yrs · {player.height}cm</span>
            <div className="flex items-center gap-1 text-xs">
              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
              <span>Morale {player.morale ?? 80}%</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <StatBar label="Power"   value={player.power}   icon={Zap}    />
            <StatBar label="Speed"   value={player.speed}   icon={Wind}   />
            <StatBar label="Defense" value={player.defense} icon={Shield} />
            <StatBar label="Serve"   value={player.serve}   icon={Target} />
            <StatBar label="Block"   value={player.block}   icon={Shield} />
          </div>

          <div className="space-y-1 pt-1 border-t border-border">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
              <span className={cn("flex items-center gap-1", fatigue >= 80 ? "text-red-500" : "text-muted-foreground")}>
                {fatigue >= 80 && <AlertTriangle className="h-3 w-3" />} Fatigue
              </span>
              <span className={cn("font-bold", fatigue >= 80 ? "text-red-500" : fatigue >= 60 ? "text-yellow-500" : "text-green-600")}>
                {getFatigueLabel(fatigue)} ({fatigue}%)
              </span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all", getFatigueColor(fatigue))} style={{ width: `${fatigue}%` }} />
            </div>
          </div>

          {/* ── Role swap buttons ─────────────────────────────────── */}
          <div className="pt-1 border-t border-border space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Move to</p>
            <div className="flex gap-1 flex-wrap">
              {(["starter", "interchange", "reserve"] as Role[]).filter(r => r !== role).map(r => {
                const c = ROLE_CONFIG[r];
                const isFull =
                  r === "starter"     && starters.length     >= 2 && !starters.find((p: any)     => p.id === player.id) ||
                  r === "interchange" && interchanges.length >= 3 && !interchanges.find((p: any)  => p.id === player.id);
                return (
                  <Button
                    key={r}
                    variant="outline"
                    size="sm"
                    disabled={isFull || roleMutation.isPending}
                    className={cn(
                      "flex-1 text-xs gap-1 font-semibold border-2",
                      isFull ? "opacity-40" : cn(c.color, c.border, "hover:" + c.bg)
                    )}
                    onClick={() => handleRoleChange(player.id, r)}
                    data-testid={`role-btn-${player.id}-${r}`}
                  >
                    {r === "starter"     && <ChevronsUp   className="h-3 w-3" />}
                    {r === "interchange" && (role === "reserve" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                    {r === "reserve"     && <ChevronsDown className="h-3 w-3" />}
                    {c.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* ── Other actions ─────────────────────────────────────── */}
          <div className="flex gap-1 pt-1">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 text-xs" data-testid={`button-outfit-${player.id}`}>
                  <Shirt className="h-3 w-3" /> Outfit
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Change Outfit — {player.name}</DialogTitle></DialogHeader>
                <div className="grid grid-cols-5 gap-4 py-4">
                  {outfits?.map((outfit) => (
                    <button
                      key={outfit.id}
                      data-testid={`outfit-swatch-${outfit.id}`}
                      title={outfit.name}
                      className="h-14 w-14 rounded-full border-4 transition-all hover:scale-110 flex items-center justify-center text-xs font-bold text-white shadow-md"
                      style={{
                        background: `linear-gradient(135deg, ${outfit.primaryColor}, ${outfit.secondaryColor})`,
                        borderColor: player.outfitId === outfit.id ? "var(--primary)" : "transparent",
                      }}
                      onClick={() => handleOutfitChange(player.id, outfit.id)}
                    >
                      {player.outfitId === outfit.id ? "✓" : ""}
                    </button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 text-xs ml-auto"
                  data-testid={`button-release-${player.id}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Release {player.name}?</AlertDialogTitle>
                  <AlertDialogDescription>This will terminate their contract immediately.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleRelease(player.id)} className="bg-destructive text-destructive-foreground">Release</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    );
  };

  const SectionHeader = ({
    title, subtitle, icon: Icon, count, role,
  }: { title: string; subtitle: string; icon: any; count: number; role: Role }) => {
    const cfg = ROLE_CONFIG[role];
    return (
      <div className="flex items-start gap-3">
        <div className={cn("p-2 rounded-lg border-2", cfg.bg, cfg.border)}>
          <Icon className={cn("h-5 w-5", cfg.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xl font-bold">{title}</h3>
            <Badge variant="outline" className={cn("font-bold", cfg.color, cfg.border)}>
              {count}{cfg.maxSlots !== Infinity ? `/${cfg.maxSlots}` : ""}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          {cfg.maxSlots !== Infinity && (
            <div className="mt-2 max-w-xs">
              <SlotBar filled={count} max={cfg.maxSlots} role={role} />
            </div>
          )}
        </div>
      </div>
    );
  };

  const EmptySection = ({ role }: { role: Role }) => {
    const cfg = ROLE_CONFIG[role];
    return (
      <Card className={cn("col-span-full border-2 border-dashed p-10 text-center", cfg.border)}>
        <Users className={cn("h-8 w-8 mx-auto mb-2 opacity-30", cfg.color)} />
        <p className="text-muted-foreground text-sm">
          {role === "starter"
            ? "No match players set. Promote players from Interchange or Reserves."
            : role === "interchange"
            ? "No interchange players. Add from Reserves for mid-match cover."
            : "No reserve players."}
        </p>
      </Card>
    );
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary">Team Roster</h2>
        <p className="text-muted-foreground">
          Manage match players, interchange, and reserves. All swaps work live — even during a match.
        </p>
      </div>

      {/* Squad summary strip */}
      <div className="grid gap-3 grid-cols-3">
        <div className={cn("rounded-xl border-2 p-4 text-center", ROLE_CONFIG.starter.border, ROLE_CONFIG.starter.bg)}>
          <div className={cn("text-3xl font-black", ROLE_CONFIG.starter.color)}>{starters.length}<span className="text-base font-normal text-muted-foreground">/2</span></div>
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-0.5">Match Players</div>
        </div>
        <div className={cn("rounded-xl border-2 p-4 text-center", ROLE_CONFIG.interchange.border, ROLE_CONFIG.interchange.bg)}>
          <div className={cn("text-3xl font-black", ROLE_CONFIG.interchange.color)}>{interchanges.length}<span className="text-base font-normal text-muted-foreground">/3</span></div>
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-0.5">Interchange</div>
        </div>
        <div className={cn("rounded-xl border-2 p-4 text-center", ROLE_CONFIG.reserve.border, ROLE_CONFIG.reserve.bg)}>
          <div className={cn("text-3xl font-black", ROLE_CONFIG.reserve.color)}>{reserves.length}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-0.5">Reserves</div>
        </div>
      </div>

      {/* ── Match Players (starters) ─────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeader
          title="Match Players"
          subtitle="2 slots — the players who take the court from the first whistle."
          icon={ChevronsUp}
          count={starters.length}
          role="starter"
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {starters.map((p: any) => <PlayerCard key={p.id} player={p} role="starter" />)}
          {starters.length === 0 && <EmptySection role="starter" />}
        </div>
      </section>

      {/* ── Interchange Players ──────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeader
          title="Interchange Players"
          subtitle="3 slots — ready to replace starters for injuries, fatigue, or tactics."
          icon={ArrowUp}
          count={interchanges.length}
          role="interchange"
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {interchanges.map((p: any) => <PlayerCard key={p.id} player={p} role="interchange" />)}
          {interchanges.length === 0 && <EmptySection role="interchange" />}
        </div>
      </section>

      {/* ── Reserves ─────────────────────────────────────────────── */}
      <section className="space-y-4 pb-8">
        <SectionHeader
          title="Reserves"
          subtitle="All remaining signed players. Promote to Interchange or Match Player at any time."
          icon={Shield}
          count={reserves.length}
          role="reserve"
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reserves.map((p: any) => <PlayerCard key={p.id} player={p} role="reserve" />)}
          {reserves.length === 0 && <EmptySection role="reserve" />}
        </div>
      </section>
    </div>
  );
}
