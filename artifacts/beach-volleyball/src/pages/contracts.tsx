import { useState } from "react";
import {
  CONTRACT_LENGTHS, CONTRACT_LENGTH_LABELS, type ContractLength,
} from "@/lib/contract-lengths";
import {
  useListContracts,
  useTerminateContract,
  useRenewContract,
  useGetCurrentSeason,
  getListContractsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
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
import { useCalendar } from "@/hooks/use-calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { AvatarPortrait } from "@/components/player-portrait";
import { FileText, Trash2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { serverMessage } from "@/lib/api-error";

const formatPosition = (pos: string | null | undefined): string => {
  if (!pos) return "—";
  const map: Record<string, string> = {
    setter: "Setter", spiker: "Spiker", defender: "Defender",
    blocker: "Blocker", server: "Server", all_rounder: "All-Rounder",
    opposite: "Spiker", universal: "All-Rounder",
  };
  return map[pos.toLowerCase()] ?? pos.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
};

/** Whole days from one `YYYY-MM-DD` date to another. */
const daysBetween = (from: string, to: string) =>
  Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);

const errorMessage = (err: unknown): string => {
  const e = err as { data?: { error?: string }; response?: { data?: { error?: string } }; message?: string };
  return serverMessage(e, "Something went wrong");
};

export default function Contracts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: contracts, isLoading } = useListContracts({
    query: { queryKey: getListContractsQueryKey() }
  });
  // R-51: days left are counted on the GAME clock, and a contract can be
  // renewed in its final season. This page used the computer's clock and could
  // only terminate, so a squad could lapse with nothing the manager could do.
  const { calendar } = useCalendar();
  const { data: season } = useGetCurrentSeason();

  const terminateMutation = useTerminateContract();
  const renewMutation = useRenewContract();
  const [renewing, setRenewing] = useState<number | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getListContractsQueryKey() });
    queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? "").includes("attention") });
  };

  const handleTerminate = (contractId: number) => {
    terminateMutation.mutate({ id: contractId }, {
      onSuccess: () => {
        refresh();
        toast({ title: "Contract Terminated" });
      }
    });
  };

  const handleRenew = (contractId: number, playerName: string, length: ContractLength) => {
    renewMutation.mutate({ id: contractId, data: { length } }, {
      onSuccess: (renewed) => {
        setRenewing(null);
        refresh();
        toast({ title: "Contract Renewed", description: `${playerName} is signed until ${format(new Date(`${renewed.endDate}T00:00:00Z`), "MMM d, yyyy")}.` });
      },
      onError: (err) => {
        toast({ title: "Renewal refused", description: errorMessage(err), variant: "destructive" });
      },
    });
  };

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-48" /><Skeleton className="h-[400px] w-full" /></div>;
  }

  const gameToday = calendar?.currentDate ?? null;
  const seasonEnd = (season as { endDate?: string } | undefined)?.endDate ?? null;

  const getStatusColor = (days: number | null, status: string) => {
    if (status !== 'active' || days == null) return "text-muted-foreground";
    if (days < 0) return "text-red-500 font-bold";
    if (days <= 30) return "text-amber-500 font-bold";
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
        <p className="text-muted-foreground">
          Monitor player obligations and payroll. A contract can be renewed for one more season once it is in its final season;
          a player whose contract runs out leaves the club, and a club without two contracted players forfeits its matches.
        </p>
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
                const daysLeft = gameToday ? daysBetween(gameToday, c.endDate) : null;
                const renewable = c.status === "active" && !!seasonEnd && c.endDate <= seasonEnd;
                const playerName = c.player?.name ?? `Player #${c.playerId}`;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2.5">
                        <AvatarPortrait
                          name={playerName}
                          imageUrl={c.player?.imageUrl}
                          nationality={c.player?.nationality}
                          playerType="senior"
                          size={32}
                        />
                        <span>{playerName}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{formatPosition(c.player?.position)}</Badge></TableCell>
                    <TableCell>{formatCurrency(c.salary)}</TableCell>
                    <TableCell>{formatCurrency(c.bonusPerWin)}</TableCell>
                    <TableCell>{format(new Date(`${c.startDate}T00:00:00Z`), 'MMM d, yyyy')}</TableCell>
                    <TableCell>{format(new Date(`${c.endDate}T00:00:00Z`), 'MMM d, yyyy')}</TableCell>
                    <TableCell className={getStatusColor(daysLeft, c.status)}>
                      {daysLeft == null ? "—" : daysLeft >= 0 ? `${daysLeft} days` : 'Expired'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {renewable ? (
                          renewing === c.id ? (
                            // L-02a: a renewal runs for one of Rob's three
                            // lengths, measured on from the day this contract
                            // ends. "+1 season" was the only option there was,
                            // because the route added a year and nothing else.
                            <div className="flex items-center gap-1">
                              {CONTRACT_LENGTHS.map((l) => (
                                <Button
                                  key={l}
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  disabled={renewMutation.isPending}
                                  onClick={() => handleRenew(c.id, playerName, l)}
                                  data-testid={`button-renew-${c.id}-${l}`}
                                >
                                  {CONTRACT_LENGTH_LABELS[l]}
                                </Button>
                              ))}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => setRenewing(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              disabled={renewMutation.isPending}
                              onClick={() => setRenewing(c.id)}
                              data-testid={`button-renew-${c.id}`}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              Renew
                            </Button>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground mr-2">Runs past this season</span>
                        )}
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
                      </div>
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
