import { 
  useGetFinanceSummary, 
  useListFinances, 
  useListPromoDeals, 
  useAcceptPromoDeal,
  getGetFinanceSummaryQueryKey,
  getListFinancesQueryKey,
  getListPromoDealsQueryKey,
  type FinanceSummary,
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
  Star,
  Trophy,
  PieChart,
  CalendarDays,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useState } from "react";

function formatCompact(val: number): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

export default function Finances() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedSponsorId, setSelectedSponsorId] = useState<number | null>(null);

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

  const handleAcceptDeal = (dealId: number, isSeason = false) => {
    acceptDealMutation.mutate({ id: dealId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPromoDealsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetFinanceSummaryQueryKey() });
        toast({
          title: isSeason ? "Season Sponsor Activated!" : "Deal Accepted!",
          description: isSeason
            ? "Your season partner is locked in. Let's win together."
            : "Sponsorship funds have been secured.",
        });
      }
    });
  };

  if (summaryLoading || transLoading || dealsLoading) {
    return <div className="space-y-8"><Skeleton className="h-32 w-full" /><Skeleton className="h-96 w-full" /></div>;
  }

  // Top 3 by value → Season Sponsors; rest → regular deals
  const sortedDeals = [...(deals ?? [])].sort((a, b) => b.amount - a.amount);
  const seasonSponsors = sortedDeals.slice(0, 3);
  const otherDeals = sortedDeals.slice(3);

  const netPosition = (summary?.monthlyIncome || 0) - (summary?.monthlyExpenses || 0);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary">Financial Office</h2>
        <p className="text-muted-foreground">Manage your team's budget, transactions, and sponsorships.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Total Balance" value={formatCompact(summary?.totalBalance || 0)} icon={Wallet} />
        <KPICard title="Monthly Income" value={formatCompact(summary?.monthlyIncome || 0)} icon={TrendingUp} color="text-green-500" />
        <KPICard title="Monthly Expenses" value={formatCompact(summary?.monthlyExpenses || 0)} icon={TrendingDown} color="text-red-500" />
        <KPICard
          title="Net Position"
          value={formatCompact(netPosition)}
          icon={PieChart}
          color={netPosition >= 0 ? "text-green-500" : "text-red-500"}
        />
      </div>

      {/* Cashflow Forecast */}
      <CashflowForecastCard summary={summary} isLoading={summaryLoading} />

      {/* Season Sponsors */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <h3 className="text-xl font-bold">Season Sponsors</h3>
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Choose 1</Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {seasonSponsors.map((deal) => {
            const isSelected = selectedSponsorId === deal.id;
            return (
              <div
                key={deal.id}
                onClick={() => setSelectedSponsorId(deal.id)}
                className={cn(
                  "relative overflow-hidden rounded-xl border-2 cursor-pointer transition-all duration-200 group",
                  isSelected
                    ? "border-primary shadow-lg shadow-primary/20 scale-[1.02]"
                    : "border-border hover:border-primary/50"
                )}
              >
                {/* Image banner */}
                <div className="relative h-36 overflow-hidden">
                  <img
                    src={deal.imageUrl ?? undefined}
                    alt={deal.sponsor}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-primary rounded-full p-1">
                      <Star className="h-4 w-4 text-white fill-white" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <div className="text-white font-bold text-base leading-tight drop-shadow">{deal.sponsor}</div>
                    <div className="text-white/70 text-xs">Requires {deal.requirementWins} wins • Expires {format(new Date(deal.expiresAt), "MMM d")}</div>
                  </div>
                </div>

                {/* Card footer */}
                <div className="p-3 flex items-center justify-between bg-card">
                  <div className="text-2xl font-black text-primary">{formatCompact(deal.amount)}</div>
                  <Button
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    onClick={(e) => { e.stopPropagation(); handleAcceptDeal(deal.id, true); }}
                    disabled={acceptDealMutation.isPending}
                    data-testid={`button-accept-deal-${deal.id}`}
                    className={isSelected ? "" : "opacity-0 group-hover:opacity-100 transition-opacity"}
                  >
                    {isSelected ? "Activate" : "Select"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        {selectedSponsorId && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Click <span className="font-bold text-foreground">Activate</span> on your chosen sponsor to secure the deal.
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Income & Expenses */}
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

        {/* Other Promo Deals */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Promo Deals</CardTitle>
            <CardDescription>Smaller sponsorship opportunities available to accept.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {otherDeals.map((deal) => (
              <div key={deal.id} className="flex items-center gap-3 p-3 rounded-xl border border-primary/10 bg-primary/5 hover:bg-primary/10 transition-all group">
                <div className="h-14 w-14 rounded-lg overflow-hidden flex-shrink-0 border border-primary/20">
                  <img
                    src={deal.imageUrl ?? undefined}
                    alt={deal.sponsor}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{deal.sponsor}</div>
                  <div className="text-xs text-muted-foreground">{deal.requirementWins} wins req • Exp {format(new Date(deal.expiresAt), "MMM d")}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-black text-primary text-base">{formatCompact(deal.amount)}</div>
                  <Button size="sm" className="h-7 text-xs mt-1" onClick={() => handleAcceptDeal(deal.id)} disabled={acceptDealMutation.isPending} data-testid={`button-accept-deal-${deal.id}`}>
                    Accept
                  </Button>
                </div>
              </div>
            ))}
            {otherDeals.length === 0 && <p className="text-center text-muted-foreground py-6 text-sm">All available deals are featured above.</p>}
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
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
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(t.createdAt), "MMM d, yyyy HH:mm")}</TableCell>
                  <TableCell>
                    {t.type === "income" ? (
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/20 gap-1"><ArrowUpRight className="h-3 w-3" /> INCOME</Badge>
                    ) : (
                      <Badge className="bg-red-500/10 text-red-600 border-red-500/20 gap-1"><ArrowDownRight className="h-3 w-3" /> EXPENSE</Badge>
                    )}
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="uppercase text-[10px]">{t.category}</Badge></TableCell>
                  <TableCell className="font-medium">{t.description}</TableCell>
                  <TableCell className={cn("text-right font-bold", t.type === "income" ? "text-green-600" : "text-red-600")}>
                    {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount)}
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

/* ── Cashflow Forecast Card ──────────────────────────────────── */

function CashflowForecastCard({
  summary,
  isLoading,
}: {
  summary: FinanceSummary | undefined;
  isLoading: boolean;
}) {
  const currentBalance    = summary?.totalBalance    ?? 0;
  const expectedIncome    = summary?.monthlyIncome   ?? 0;
  const expectedExpenses  = summary?.monthlyExpenses ?? 0;
  const projectedBalance  = currentBalance + expectedIncome - expectedExpenses;
  const net               = expectedIncome - expectedExpenses;
  const isPositive        = net >= 0;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Cashflow Forecast</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">Based on this month's activity</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            {/* Four stat blocks */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Current Balance */}
              <div className="rounded-lg border bg-card p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" />
                  Current Balance
                </div>
                <p className="text-lg font-bold text-primary truncate">
                  {formatCompact(currentBalance)}
                </p>
                <p className="text-[10px] text-muted-foreground">Available now</p>
              </div>

              {/* Expected Income */}
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Expected Income
                </div>
                <p className="text-lg font-bold text-green-600 truncate">
                  +{formatCompact(expectedIncome)}
                </p>
                <p className="text-[10px] text-muted-foreground">Next 30 days</p>
              </div>

              {/* Expected Expenses */}
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-400">
                  <TrendingDown className="h-3.5 w-3.5" />
                  Expected Expenses
                </div>
                <p className="text-lg font-bold text-red-600 truncate">
                  -{formatCompact(expectedExpenses)}
                </p>
                <p className="text-[10px] text-muted-foreground">Next 30 days</p>
              </div>

              {/* Projected Balance */}
              <div className={cn(
                "rounded-lg border p-3 space-y-1",
                isPositive
                  ? "border-blue-500/20 bg-blue-500/5"
                  : "border-orange-500/20 bg-orange-500/5"
              )}>
                <div className={cn(
                  "flex items-center gap-1.5 text-xs",
                  isPositive ? "text-blue-700 dark:text-blue-400" : "text-orange-700 dark:text-orange-400"
                )}>
                  <DollarSign className="h-3.5 w-3.5" />
                  Projected Balance
                </div>
                <p className={cn(
                  "text-lg font-bold truncate",
                  isPositive ? "text-blue-600" : "text-orange-600"
                )}>
                  {formatCompact(projectedBalance)}
                </p>
                <p className={cn(
                  "text-[10px] font-medium flex items-center gap-0.5",
                  isPositive ? "text-green-600" : "text-red-600"
                )}>
                  {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {isPositive ? "+" : ""}{formatCompact(net)} net
                </p>
              </div>
            </div>

            {/* Income vs Expense bar */}
            {(expectedIncome > 0 || expectedExpenses > 0) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
                    Income
                  </span>
                  <span className="font-medium">vs</span>
                  <span className="flex items-center gap-1">
                    Expenses
                    <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
                  </span>
                </div>
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted gap-0.5">
                  {(() => {
                    const total = expectedIncome + expectedExpenses;
                    const incomePct = total > 0 ? (expectedIncome / total) * 100 : 50;
                    const expensePct = 100 - incomePct;
                    return (
                      <>
                        <div className="h-full rounded-l-full bg-green-500 transition-all" style={{ width: `${incomePct}%` }} />
                        <div className="h-full rounded-r-full bg-red-500 transition-all"   style={{ width: `${expensePct}%` }} />
                      </>
                    );
                  })()}
                </div>

                {/* Breakdown detail rows */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 pt-1">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Income sources</p>
                    {[
                      { label: "Prize Money",   value: summary?.incomeSources.prizeMoney   ?? 0 },
                      { label: "Sponsorships",  value: summary?.incomeSources.sponsorships ?? 0 },
                      { label: "Promo Deals",   value: summary?.incomeSources.promoDeals   ?? 0 },
                    ].filter(r => r.value > 0).map(row => (
                      <div key={row.label} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <ChevronRight className="h-3 w-3 text-green-500" />{row.label}
                        </span>
                        <span className="font-semibold text-green-600">{formatCompact(row.value)}</span>
                      </div>
                    ))}
                    {expectedIncome === 0 && (
                      <p className="text-xs text-muted-foreground italic">No income this month</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Expense breakdown</p>
                    {[
                      { label: "Player Salaries", value: summary?.expenseBreakdown.playerSalaries ?? 0 },
                      { label: "Staff",            value: summary?.expenseBreakdown.staffSalaries  ?? 0 },
                      { label: "Training",         value: summary?.expenseBreakdown.trainingCosts  ?? 0 },
                      { label: "Other",            value: summary?.expenseBreakdown.other          ?? 0 },
                    ].filter(r => r.value > 0).map(row => (
                      <div key={row.label} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <ChevronRight className="h-3 w-3 text-red-500" />{row.label}
                        </span>
                        <span className="font-semibold text-red-600">{formatCompact(row.value)}</span>
                      </div>
                    ))}
                    {expectedExpenses === 0 && (
                      <p className="text-xs text-muted-foreground italic">No expenses this month</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function KPICard({ title, value, icon: Icon, color = "text-primary" }: {
  title: string; value: string; icon: any; color?: string;
}) {
  return (
    <Card className="hover-elevate transition-all">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn("h-4 w-4 flex-shrink-0", color)} />
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold truncate", color)}>{value}</div>
      </CardContent>
    </Card>
  );
}

function BreakdownRow({ label, amount, total, color }: {
  label: string; amount: number; total: number; color: string;
}) {
  const percentage = Math.round((amount / total) * 100) || 0;
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
