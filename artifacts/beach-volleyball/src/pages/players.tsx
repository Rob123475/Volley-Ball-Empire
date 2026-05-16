import { 
  useListFreeAgents, 
  useSignContract, 
  getListFreeAgentsQueryKey,
  getListContractsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Search, 
  UserPlus, 
  DollarSign, 
  Calendar, 
  ChevronRight,
  Filter
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
import { format, addMonths } from "date-fns";

export default function PlayerMarket() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("ALL");
  const { data: players, isLoading } = useListFreeAgents({
    query: { queryKey: getListFreeAgentsQueryKey() }
  });

  const signMutation = useSignContract();

  if (isLoading) {
    return <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
    </div>;
  }

  const filteredPlayers = filter === "ALL" 
    ? players 
    : players?.filter(p => p.position === filter);

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

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Free Agent Market</h2>
          <p className="text-muted-foreground">Scout and sign the best talent to improve your roster.</p>
        </div>
        <div className="flex gap-2">
          {["ALL", "S", "OH", "OPP", "MB", "L"].map((pos) => (
            <Button
              key={pos}
              variant={filter === pos ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(pos)}
              data-testid={`filter-${pos.toLowerCase()}`}
            >
              {pos}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredPlayers?.map((player) => (
          <Card key={player.id} className="overflow-hidden hover:shadow-lg transition-all group">
            <CardHeader className="bg-muted/30 p-4">
              <div className="flex justify-between items-start">
                <Badge className="bg-primary/10 text-primary border-primary/20">{player.position}</Badge>
                <span className="text-2xl">{player.nationality}</span>
              </div>
              <div className="mt-2">
                <CardTitle className="text-xl font-bold">{player.name}</CardTitle>
                <CardDescription>{player.age} yrs • {player.height}cm</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Overall Rating</div>
                <div className="text-2xl font-black text-primary">{Math.round((player.power + player.speed + player.defense + player.serve + player.block) / 5)}</div>
              </div>
              <Progress value={(player.power + player.speed + player.defense + player.serve + player.block) / 5} className="h-2" />
              
              <ContractModal player={player} onSign={(v) => handleSign(player.id, v)} isPending={signMutation.isPending} />
            </CardContent>
          </Card>
        ))}
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
          <DialogDescription>Negotiate terms for a new contract.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span>Monthly Salary</span>
              <span className="text-primary font-bold">${salary[0].toLocaleString()}</span>
            </div>
            <Slider
              min={1000}
              max={20000}
              step={100}
              value={salary}
              onValueChange={setSalary}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span>Win Bonus</span>
              <span className="text-secondary font-bold">${winBonus[0].toLocaleString()}</span>
            </div>
            <Slider
              min={0}
              max={5000}
              step={50}
              value={winBonus}
              onValueChange={setWinBonus}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span>Contract Duration</span>
              <span>{months} Months</span>
            </div>
            <Slider
              min={1}
              max={12}
              step={1}
              value={[months]}
              onValueChange={(v) => setMonths(v[0])}
            />
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
