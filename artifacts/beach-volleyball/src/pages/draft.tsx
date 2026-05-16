import { 
  useGetDraftPool, 
  useDraftPick, 
  getGetDraftPoolQueryKey,
  getGetTeamRosterQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Box, Zap, Shield, Target, Wind } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function PlayerDraft() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: pool, isLoading } = useGetDraftPool({
    query: { queryKey: getGetDraftPoolQueryKey() }
  });

  const draftMutation = useDraftPick();

  if (isLoading) {
    return <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-80 w-full" />)}
    </div>;
  }

  const handleDraft = (playerId: number) => {
    draftMutation.mutate({ data: { draftPlayerId: playerId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetDraftPoolQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTeamRosterQueryKey() });
        toast({ title: "Draft Pick Successful!", description: "The rookie has joined your team on a 6-month contract." });
      }
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
          <Box className="h-8 w-8 text-secondary" />
          Rookie Draft Pool
        </h2>
        <p className="text-muted-foreground">Select the future of your franchise. 6-month rookie contracts apply immediately.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {pool?.map((player) => {
          const avgRating = Math.round((player.power + player.speed + player.defense + player.serve + player.block) / 5);
          return (
            <Card key={player.id} data-testid={`card-draft-${player.id}`} className="overflow-hidden hover:border-secondary transition-all">
              <CardHeader className="bg-secondary/10 p-4">
                <div className="flex justify-between items-start">
                  <Badge className="bg-secondary text-secondary-foreground">{player.position}</Badge>
                  <span className="text-2xl font-bold text-secondary">{avgRating}</span>
                </div>
                <div className="mt-2">
                  <CardTitle className="text-xl font-bold">{player.name}</CardTitle>
                  <CardDescription>{player.nationality} • {player.age} yrs • {player.height}cm</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 gap-2">
                  <StatBar label="Power" value={player.power} icon={Zap} color="bg-orange-500" />
                  <StatBar label="Speed" value={player.speed} icon={Wind} color="bg-blue-500" />
                  <StatBar label="Defense" value={player.defense} icon={Shield} color="bg-green-500" />
                  <StatBar label="Serve" value={player.serve} icon={Target} color="bg-purple-500" />
                  <StatBar label="Block" value={player.block} icon={Shield} color="bg-red-500" />
                </div>

                <Button 
                  className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold"
                  onClick={() => handleDraft(player.id)}
                  disabled={draftMutation.isPending || !player.available}
                  data-testid={`button-draft-${player.id}`}
                >
                  {!player.available ? "DRAFTED" : draftMutation.isPending ? "Drafting..." : "DRAFT PLAYER"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
        {(!pool || pool.length === 0) && (
          <div className="col-span-full text-center py-16 text-muted-foreground">
            <Box className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg">No players available in the draft pool.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBar({ label, value, icon: Icon, color }: { label: string, value: number, icon: any, color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] uppercase tracking-wider font-bold">
        <span className="flex items-center gap-1 text-muted-foreground"><Icon className="h-3 w-3" /> {label}</span>
        <span>{value}</span>
      </div>
      <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
