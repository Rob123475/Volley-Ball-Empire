import { 
  useGetTeamRoster, 
  useListOutfits, 
  useUpdatePlayerOutfit, 
  useReleasePlayer,
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
  Wind
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

export default function TeamRoster() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: roster, isLoading } = useGetTeamRoster({
    query: { queryKey: getGetTeamRosterQueryKey() }
  });
  const { data: outfits } = useListOutfits();

  const releaseMutation = useReleasePlayer();
  const updateOutfitMutation = useUpdatePlayerOutfit();

  if (isLoading) {
    return <div className="space-y-8">
      <Skeleton className="h-10 w-48" />
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
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

  const activePlayers = roster?.activePlayers ?? [];
  const benchPlayers = roster?.benchPlayers ?? [];

  const PlayerCard = ({ player, isActive }: { player: any, isActive: boolean }) => {
    const rating = Math.round((player.power + player.speed + player.defense + player.serve + player.block) / 5);
    return (
      <Card data-testid={`card-player-${player.id}`} className="overflow-hidden group hover:shadow-md transition-all duration-300">
        <CardHeader className="p-4 pb-2">
          <div className="flex justify-between items-start">
            <div className="flex gap-2 items-center">
              <Badge className="bg-primary/10 text-primary border-primary/20">{player.position.replace(/_/g, " ")}</Badge>
              <span className="text-xl">{player.nationality}</span>
            </div>
            <div className="flex gap-1">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-outfit-${player.id}`}>
                    <Shirt className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Change Outfit — {player.name}</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-4 gap-4 py-4">
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
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    data-testid={`button-release-${player.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
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
          </div>
          <CardTitle className="text-xl font-bold mt-2">{player.name}</CardTitle>
          <div className="text-xs text-muted-foreground">{player.age} yrs • {player.height}cm • Overall: {rating}</div>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-4">
          <div className="grid grid-cols-1 gap-2">
            <StatBar label="Power" value={player.power} icon={Zap} />
            <StatBar label="Speed" value={player.speed} icon={Wind} />
            <StatBar label="Defense" value={player.defense} icon={Shield} />
            <StatBar label="Serve" value={player.serve} icon={Target} />
            <StatBar label="Block" value={player.block} icon={Shield} />
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
              <span className="font-medium">Morale: {player.morale ?? 80}%</span>
            </div>
            <Badge variant={isActive ? "default" : "secondary"} className="text-[10px]">
              {isActive ? "ACTIVE" : "BENCH"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary">Team Roster</h2>
        <p className="text-muted-foreground">Manage your athletes and customize their outfits.</p>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <Badge className="rounded-full h-6 w-6 flex items-center justify-center p-0">{activePlayers.length}</Badge>
          Active Lineup
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

      <div className="space-y-4 pt-8">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full h-6 w-6 flex items-center justify-center p-0">{benchPlayers.length}</Badge>
          Bench
        </h3>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {benchPlayers.map((p: any) => <PlayerCard key={p.id} player={p} isActive={false} />)}
          {benchPlayers.length === 0 && (
            <Card className="col-span-full border-dashed p-12 text-center text-muted-foreground">
              Bench is empty.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBar({ label, value, icon: Icon }: { label: string, value: number, icon: any }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
        <span className="flex items-center gap-1"><Icon className="h-3 w-3" /> {label}</span>
        <span>{value}</span>
      </div>
      <Progress value={value} className="h-1.5" />
    </div>
  );
}
