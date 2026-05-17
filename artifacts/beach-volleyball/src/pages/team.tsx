import { 
  useGetTeamRoster, 
  useListOutfits, 
  useUpdatePlayerOutfit, 
  useReleasePlayer,
  useSwapTeamPlayer,
  getGetTeamRosterQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  ArrowLeftRight,
  AlertTriangle,
  Users
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

const getFatigueColor = (fatigue: number) => {
  if (fatigue < 30) return "bg-green-500";
  if (fatigue < 60) return "bg-yellow-500";
  return "bg-red-500";
};

const getFatigueLabel = (fatigue: number) => {
  if (fatigue < 30) return "Fresh";
  if (fatigue < 60) return "Moderate";
  if (fatigue < 80) return "Tired";
  return "Exhausted";
};

export default function TeamRoster() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: roster, isLoading } = useGetTeamRoster({
    query: { queryKey: getGetTeamRosterQueryKey() }
  });
  const { data: outfits } = useListOutfits();

  const releaseMutation = useReleasePlayer();
  const updateOutfitMutation = useUpdatePlayerOutfit();
  const swapMutation = useSwapTeamPlayer();

  if (isLoading) {
    return <div className="space-y-8">
      <Skeleton className="h-10 w-48" />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-96 w-full" />)}
      </div>
    </div>;
  }

  const handleRelease = (playerId: number) => {
    releaseMutation.mutate({ id: playerId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTeamRosterQueryKey() });
        toast({ title: "Player Released", description: "Contract terminated." });
      }
    });
  };

  const handleOutfitChange = (playerId: number, outfitId: number) => {
    updateOutfitMutation.mutate({ id: playerId, data: { outfitId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTeamRosterQueryKey() });
        toast({ title: "Outfit Changed" });
      }
    });
  };

  const handleSwap = (playerInId: number, playerOutId: number) => {
    swapMutation.mutate({ data: { playerInId, playerOutId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTeamRosterQueryKey() });
        toast({ title: "Lineup Updated", description: "Players swapped successfully." });
      }
    });
  };

  const activePlayers = roster?.activePlayers ?? [];
  const benchPlayers = roster?.benchPlayers ?? [];

  const PlayerCard = ({ player, isActive }: { player: any, isActive: boolean }) => {
    const rating = Math.round((player.power + player.speed + player.defense + player.serve + player.block) / 5);
    const fatigue = player.fatigue ?? 0;
    const swapCandidates = isActive ? benchPlayers : activePlayers;
    
    return (
      <Card data-testid={`card-player-${player.id}`} className="overflow-hidden group hover:shadow-md transition-all duration-300">
        <div className="relative h-56 overflow-hidden">
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
            <span>{player.age} yrs • {player.height}cm</span>
            <span className="text-lg">{player.nationality}</span>
          </div>

          <div className="space-y-1.5">
            <StatBar label="Power" value={player.power} icon={Zap} />
            <StatBar label="Speed" value={player.speed} icon={Wind} />
            <StatBar label="Defense" value={player.defense} icon={Shield} />
            <StatBar label="Serve" value={player.serve} icon={Target} />
            <StatBar label="Block" value={player.block} icon={Shield} />
          </div>

          <div className="space-y-1 pt-1 border-t border-border">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
              <span className={cn("flex items-center gap-1", fatigue >= 80 ? "text-red-500" : "text-muted-foreground")}>
                {fatigue >= 80 && <AlertTriangle className="h-3 w-3" />}
                Fatigue
              </span>
              <span className={cn("font-bold", fatigue >= 80 ? "text-red-500" : fatigue >= 60 ? "text-yellow-500" : "text-green-600")}>
                {getFatigueLabel(fatigue)} ({fatigue}%)
              </span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", getFatigueColor(fatigue))}
                style={{ width: `${fatigue}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs">
              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
              <span>Morale: {player.morale ?? 80}%</span>
            </div>
            <Badge variant={isActive ? "default" : "secondary"} className="text-[10px]">
              {isActive ? "ACTIVE" : "RESERVE"}
            </Badge>
          </div>
          
          <div className="flex gap-1 pt-1 border-t border-border">
            {swapCandidates.length > 0 && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs" data-testid={`button-swap-${player.id}`}>
                    <ArrowLeftRight className="h-3 w-3" /> Swap
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Swap {player.name}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2 py-4">
                    <p className="text-sm text-muted-foreground">
                      Select a {isActive ? "reserve" : "active"} player to swap with:
                    </p>
                    {swapCandidates.map((candidate: any) => (
                      <button
                        key={candidate.id}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                        onClick={() => handleSwap(
                          isActive ? candidate.id : player.id,
                          isActive ? player.id : candidate.id
                        )}
                        data-testid={`swap-candidate-${candidate.id}`}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={candidate.imageUrl ?? undefined} />
                          <AvatarFallback>{candidate.name[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold">{candidate.name}</div>
                          <div className="text-xs text-muted-foreground">{candidate.position} • Fatigue: {candidate.fatigue ?? 0}%</div>
                        </div>
                        <ArrowLeftRight className="h-4 w-4 ml-auto text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            )}
            
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 text-xs" data-testid={`button-outfit-${player.id}`}>
                  <Shirt className="h-3 w-3" /> Outfit
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Change Outfit — {player.name}</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-5 gap-4 py-4">
                  {outfits?.map((outfit) => (
                    <button
                      key={outfit.id}
                      data-testid={`outfit-swatch-${outfit.id}`}
                      title={outfit.name}
                      className="h-14 w-14 rounded-full border-4 transition-all hover:scale-110 flex items-center justify-center text-xs font-bold text-white shadow-md"
                      style={{ 
                        background: `linear-gradient(135deg, ${outfit.primaryColor}, ${outfit.secondaryColor})`,
                        borderColor: player.outfitId === outfit.id ? 'var(--primary)' : 'transparent' 
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
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 text-xs" data-testid={`button-release-${player.id}`}>
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

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary">Team Roster</h2>
        <p className="text-muted-foreground">Manage your athletes, swap lineups, and customize outfits.</p>
      </div>

      <div className="grid gap-4 grid-cols-3 text-center">
        <div className="rounded-xl border p-4">
          <div className="text-2xl font-black text-primary">{activePlayers.length}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Active (2-3)</div>
        </div>
        <div className="rounded-xl border p-4">
          <div className="text-2xl font-black text-secondary">{benchPlayers.length}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Reserves (max 2)</div>
        </div>
        <div className="rounded-xl border p-4">
          <div className="text-2xl font-black">{activePlayers.length + benchPlayers.length}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Total Squad</div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Active Lineup
          <Badge className="rounded-full h-6 w-6 flex items-center justify-center p-0">{activePlayers.length}</Badge>
          <span className="text-sm font-normal text-muted-foreground ml-1">2-3 players</span>
        </h3>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {activePlayers.map((p: any) => <PlayerCard key={p.id} player={p} isActive={true} />)}
          {activePlayers.length === 0 && (
            <Card className="col-span-full border-dashed p-12 text-center text-muted-foreground">
              No players in active lineup. Sign players from the Free Agent Market.
            </Card>
          )}
        </div>
      </div>

      <div className="space-y-4 pt-4">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5 text-secondary" />
          Reserves
          <Badge variant="secondary" className="rounded-full h-6 w-6 flex items-center justify-center p-0">{benchPlayers.length}</Badge>
          <span className="text-sm font-normal text-muted-foreground ml-1">up to 2 players (injury cover)</span>
        </h3>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {benchPlayers.map((p: any) => <PlayerCard key={p.id} player={p} isActive={false} />)}
          {benchPlayers.length === 0 && (
            <Card className="col-span-full border-dashed p-12 text-center text-muted-foreground">
              <Shield className="h-8 w-8 mx-auto mb-2 opacity-20" />
              No reserves. Add bench players to cover injuries.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBar({ label, value, icon: Icon }: { label: string, value: number, icon: any }) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
        <span className="flex items-center gap-1"><Icon className="h-3 w-3" /> {label}</span>
        <span>{value}</span>
      </div>
      <Progress value={value} className="h-1.5" />
    </div>
  );
}
