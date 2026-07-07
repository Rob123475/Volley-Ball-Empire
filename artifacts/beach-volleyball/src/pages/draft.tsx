import { 
  useGetDraftPool, 
  useDraftPick,
  useGenerateDraftClass,
  getGetDraftPoolQueryKey,
  getGetTeamRosterQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Box, Zap, Shield, Target, Wind, Activity, Star, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { FacilityBonusBanner } from "@/components/facility-bonus-banner";
import { PlayerPortrait } from "@/components/player-portrait";

export default function PlayerDraft() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: pool, isLoading } = useGetDraftPool({
    query: { queryKey: getGetDraftPoolQueryKey() }
  });

  const draftMutation    = useDraftPick();
  const generateMutation = useGenerateDraftClass();

  if (isLoading) {
    return <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-96 w-full" />)}
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

  const handleGenerate = () => {
    generateMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetDraftPoolQueryKey() });
        toast({ title: "New Draft Class Generated!", description: "30 fresh prospects are ready — quality influenced by your Youth Academy." });
      },
      onError: () => {
        toast({ title: "Error", description: "Could not generate a new class.", variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
            <Box className="h-8 w-8 text-secondary" />
            Rookie Draft Pool
          </h2>
          <p className="text-muted-foreground">
            Young stars aged 20 and under. All rookies receive a 6-month contract on signing.
          </p>
        </div>
        <Button
          variant="outline"
          className="shrink-0 gap-2"
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
          data-testid="button-generate-draft-class"
        >
          <RefreshCw className={`h-4 w-4 ${generateMutation.isPending ? "animate-spin" : ""}`} />
          {generateMutation.isPending ? "Generating…" : "Generate New Class"}
        </Button>
      </div>

      <FacilityBonusBanner
        facilityType="youth_academy"
        facilityName="Youth Academy"
        getBonusText={(level) => {
          const elitePct = Math.round((0.12 + (level - 1) * (0.13 / 9)) * 100);
          const genPct   = Math.round((0.03 + (level - 1) * (0.09 / 9)) * 100);
          return `${elitePct}% Elite + ${genPct}% Generational prospect chance on Generate`;
        }}
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {pool?.map((player, index) => {
          const avgRating = Math.round((player.power + player.speed + player.defense + player.serve + player.block) / 5);
          return (
            <Card key={player.id} data-testid={`card-draft-${player.id}`} className="overflow-hidden hover:border-secondary hover:shadow-lg transition-all">
              <div className="relative h-72 overflow-hidden bg-slate-800">
                <PlayerPortrait
                  name={player.name}
                  imageUrl={player.imageUrl}
                  continent={(player as any).continent}
                  nationality={player.nationality}
                  playerType={(player as any).playerType}
                  heightClass="h-72"
                />

                {/* Left strip — player name, reading bottom-to-top */}
                <div
                  className="absolute left-0 top-0 bottom-0 flex items-center justify-center z-10"
                  style={{ width: "19%" }}
                >
                  <span
                    className="text-white font-bold select-none"
                    style={{
                      writingMode: "vertical-rl",
                      ...(index === 0
                        ? { textOrientation: "upright", letterSpacing: "0.1em", lineHeight: 1.1 }
                        : { transform: "rotate(180deg)", letterSpacing: "0.05em", lineHeight: 1.2 }),
                      fontSize: "11px",
                      maxHeight: "252px",
                      overflow: "hidden",
                      textShadow: "0 1px 4px rgba(0,0,0,0.95)",
                    }}
                  >
                    {player.name}
                  </span>
                </div>

                {/* Right strip — OVR · position · nationality · age & height */}
                <div
                  className="absolute right-0 top-0 bottom-0 flex flex-col items-center justify-center z-10"
                  style={{ width: "19%", gap: "5px", padding: "8px 3px" }}
                >
                  <div className="text-center">
                    <div className="text-[22px] font-black text-white leading-none" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.95)" }}>
                      {avgRating}
                    </div>
                    <div className="text-[7px] text-white/55 uppercase tracking-widest font-bold">OVR</div>
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
                  <StatBar label="Power" value={player.power} icon={Zap} color="bg-orange-500" />
                  <StatBar label="Speed" value={player.speed} icon={Wind} color="bg-blue-500" />
                  <StatBar label="Defense" value={player.defense} icon={Shield} color="bg-green-500" />
                  <StatBar label="Serve" value={player.serve} icon={Target} color="bg-purple-500" />
                  <StatBar label="Block" value={player.block} icon={Shield} color="bg-red-500" />
                  <StatBar label="Stamina" value={player.stamina} icon={Activity} color="bg-cyan-500" />
                </div>

                <div className="flex items-center justify-between text-xs border-t border-border pt-2">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                    Morale: {(player as any).morale ?? 80}%
                  </span>
                  <span className="text-muted-foreground text-[10px] font-medium">
                    High Potential
                  </span>
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
            <p className="text-lg">No rookies available in the draft pool.</p>
            <p className="text-sm">All players aged 20 and under have been drafted.</p>
          </div>
        )}
      </div>
    </div>
  );
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

function StatBar({ label, value, icon: Icon, color }: { label: string, value: number, icon: any, color: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
      <div className="flex-1">
        <div className="flex justify-between text-[10px] uppercase tracking-wider font-bold mb-0.5">
          <span className="text-muted-foreground">{label}</span>
          <span>{value}</span>
        </div>
        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full`} style={{ width: `${value}%` }} />
        </div>
      </div>
    </div>
  );
}
