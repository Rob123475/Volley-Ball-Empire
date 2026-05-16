import { 
  useGetFinanceSummary, 
  useListFinances, 
  useListPromoDeals, 
  useAcceptPromoDeal,
  getGetFinanceSummaryQueryKey,
  getListFinancesQueryKey,
  getListPromoDealsQueryKey
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
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight,
  Handshake,
  PieChart
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function Finances() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: summary, isLoading: summaryLoading } = useGetFinanceSummary({
    query: { queryKey: getGetFinanceSummaryQueryKey() }
  });
  const { data: transactions, isLoading: transLoading } = useListFinances({
    query: { queryKey: getListFinancesQueryKey() }
  });
  const { data: deals, isLoading: dealsLoading } = useListPromoDeals({
    query: { queryKey: getListPromoDealsQueryKey() }
  });

  const acceptDealMutation = useAcceptPromoDeal();

  const handleAcceptDeal = (dealId: number) => {
    acceptDealMutation.mutate({ id: dealId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPromoDealsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetFinanceSummaryQueryKey() });
        toast({ title: "Deal Accepted!", description: "Sponsorship funds have been secured." });
      }
    });
  };

  if (summaryLoading || transLoading || dealsLoading) {
    return <div className="space-y-8"><Skeleton className="h-32 w-full" /><Skeleton className="h-96 w-full" /></div>;
  }

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary">Financial Office</h2>
        <p className="text-muted-foreground">Manage your team's budget, transactions, and sponsorships.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Total Balance" value={formatCurrency(summary?.totalBalance || 0)} icon={Wallet} />
        <KPICard title="Monthly Income" value={formatCurrency(summary?.monthlyIncome || 0)} icon={TrendingUp} color="text-green-500" />
        <KPICard title="Monthly Expenses" value={formatCurrency(summary?.monthlyExpenses || 0)} icon={TrendingDown} color="text-red-500" />
        <KPICard 
          title="Net Position" 
          value={formatCurrency((summary?.monthlyIncome || 0) - (summary?.monthlyExpenses || 0))} 
          icon={PieChart}
          color={(summary?.monthlyIncome || 0) - (summary?.monthlyExpenses || 0) >= 0 ? "text-green-500" : "text-red-500"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Income & Expenses</CardTitle>
            <CardDescription>Visual breakdown of your cashflow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Income Sources</h4>
              <div className="space-y-2">
                <BreakdownRow label="Prize Money" amount={summary?.incomeSources.prizeMoney || 0} total={summary?.monthlyIncome || 1} color="bg-green-500" />
                <BreakdownRow label="Sponsorships" amount={summary?.incomeSources.sponsorships || 0} total={summary?.monthlyIncome || 1} color="bg-blue-500" />
                <BreakdownRow label="Promo Deals" amount={summary?.incomeSources.promoDeals || 0} total={summary?.monthlyIncome || 1} color="bg-gray-500" />
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Expense Breakdown</h4>
              <div className="space-y-2">
                <BreakdownRow label="Player Salaries" amount={summary?.expenseBreakdown.playerSalaries || 0} total={summary?.monthlyExpenses || 1} color="bg-red-500" />
                <BreakdownRow label="Staff" amount={summary?.expenseBreakdown.staffSalaries || 0} total={summary?.monthlyExpenses || 1} color="bg-orange-500" />
                <BreakdownRow label="Training" amount={summary?.expenseBreakdown.trainingCosts || 0} total={summary?.monthlyExpenses || 1} color="bg-purple-500" />
                <BreakdownRow label="Other" amount={summary?.expenseBreakdown.other || 0} total={summary?.monthlyExpenses || 1} color="bg-gray-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Available Promo Deals</CardTitle>
            <CardDescription>Sponsorship opportunities based on your reputation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {deals?.map((deal) => (
              <div key={deal.id} className="flex items-center justify-between p-4 rounded-xl border border-primary/10 bg-primary/5 hover:bg-primary/10 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center border border-primary/20 shadow-sm">
                    <Handshake className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="font-bold text-lg">{deal.sponsor}</div>
                    <div className="text-xs text-muted-foreground">Requires {deal.requirementWins} wins • Expires {format(new Date(deal.expiresAt), 'MMM d')}</div>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                  <div className="text-xl font-black text-primary">{formatCurrency(deal.amount)}</div>
                  <Button size="sm" onClick={() => handleAcceptDeal(deal.id)} disabled={acceptDealMutation.isPending} data-testid={`button-accept-deal-${deal.id}`}>
                    Accept Deal
                  </Button>
                </div>
              </div>
            ))}
            {deals?.length === 0 && <p className="text-center text-muted-foreground py-8">No deals currently available.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>Complete log of your team's financial movements.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions?.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(t.createdAt), 'MMM d, yyyy HH:mm')}</TableCell>
                  <TableCell>
                    {t.type === 'income' ? (
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/20 gap-1"><ArrowUpRight className="h-3 w-3" /> INCOME</Badge>
                    ) : (
                      <Badge className="bg-red-500/10 text-red-600 border-red-500/20 gap-1"><ArrowDownRight className="h-3 w-3" /> EXPENSE</Badge>
                    )}
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="uppercase text-[10px]">{t.category}</Badge></TableCell>
                  <TableCell className="font-medium">{t.description}</TableCell>
                  <TableCell className={cn("text-right font-bold", t.type === 'income' ? 'text-green-600' : 'text-red-600')}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function KPICard({ title, value, icon: Icon, color = "text-primary" }: { title: string, value: string, icon: any, color?: string }) {
  return (
    <Card className="hover-elevate transition-all">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn("h-4 w-4", color)} />
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold", color)}>{value}</div>
      </CardContent>
    </Card>
  );
}

function BreakdownRow({ label, amount, total, color }: { label: string, amount: number, total: number, color: string }) {
  const percentage = Math.round((amount / total) * 100) || 0;
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-medium">
        <span>{label}</span>
        <span className="text-muted-foreground">{formatCurrency(amount)} ({percentage}%)</span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full", color)} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
