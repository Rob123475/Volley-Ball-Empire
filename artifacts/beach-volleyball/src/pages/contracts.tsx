import { 
  useListContracts, 
  useTerminateContract,
  getListContractsQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
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
import { AvatarPortrait } from "@/components/player-portrait";
import { FileText, AlertCircle, Trash2 } from "lucide-react";
import { format } from "date-fns";

const formatPosition = (pos: string | null | undefined): string => {
  if (!pos) return "—";
  const map: Record<string, string> = {
    setter: "Setter", spiker: "Spiker", defender: "Defender",
    blocker: "Blocker", server: "Server", all_rounder: "All-Rounder",
    opposite: "Spiker", universal: "All-Rounder",
  };
  return map[pos.toLowerCase()] ?? pos.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
};

export default function Contracts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: contracts, isLoading } = useListContracts({
    query: { queryKey: getListContractsQueryKey() }
  });

  const terminateMutation = useTerminateContract();

  const handleTerminate = (contractId: number) => {
    terminateMutation.mutate({ id: contractId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListContractsQueryKey() });
        toast({ title: "Contract Terminated" });
      }
    });
  };

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-48" /><Skeleton className="h-[400px] w-full" /></div>;
  }

  const getStatusColor = (days: number, status: string) => {
    if (status !== 'active') return "text-muted-foreground";
    if (days < 30) return "text-amber-500 font-bold";
    if (days < 0) return "text-red-500 font-bold";
    return "text-green-500 font-bold";
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
          <FileText className="h-8 w-8 text-secondary" />
          Contract Management
        </h2>
        <p className="text-muted-foreground">Monitor player obligations and payroll.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Salary/mo</TableHead>
                <TableHead>Bonus/win</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Days Remaining</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts?.map((c) => {
                const daysLeft = Math.ceil((new Date(c.endDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2.5">
                        <AvatarPortrait
                          name={c.player?.name ?? `Player #${c.playerId}`}
                          imageUrl={c.player?.imageUrl}
                          nationality={c.player?.nationality}
                          playerType="senior"
                          size={32}
                        />
                        <span>{c.player?.name ?? `Player #${c.playerId}`}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{formatPosition(c.player?.position)}</Badge></TableCell>
                    <TableCell>{formatCurrency(c.salary)}</TableCell>
                    <TableCell>{formatCurrency(c.bonusPerWin)}</TableCell>
                    <TableCell>{format(new Date(c.startDate), 'MMM d, yyyy')}</TableCell>
                    <TableCell>{format(new Date(c.endDate), 'MMM d, yyyy')}</TableCell>
                    <TableCell className={getStatusColor(daysLeft, c.status)}>
                      {daysLeft > 0 ? `${daysLeft} days` : 'Expired'}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Terminate Contract?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to terminate {c.player?.name ?? "this player"}'s contract? This may incur a penalty fee.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleTerminate(c.id)} className="bg-destructive text-destructive-foreground">
                              Terminate
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                );
              })}
              {contracts?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No active contracts found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
