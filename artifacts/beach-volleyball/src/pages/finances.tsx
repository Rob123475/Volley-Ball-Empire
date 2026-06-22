import { 
  useGetFinanceSummary, 
  useListFinances, 
  useListPromoDeals, 
  useAcceptPromoDeal,
  useGetSponsorProgress,
  useGetPrizeMoneySummary,
  useGetWageBill,
  useGetStaffWageBill,
  getGetFinanceSummaryQueryKey,
  getListFinancesQueryKey,
  getListPromoDealsQueryKey,
  getGetSponsorProgressQueryKey,
  type FinanceSummary,
  type SponsorProgress,
  type PrizeMoneySummary,
  type WageBill,
  type StaffWageBill,
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
  Medal,
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
  const { data: sponsorProgress, isLoading: progressLoading } = useGetSponsorProgress({
    query: { queryKey: getGetSponsorProgressQueryKey() }
  });
  const { data: prizeMoneyData, isLoading: prizeMoneyLoading } = useGetPrizeMoneySummary();
  const { data: wageBill, isLoading: wageBillLoading } = useGetWageBill();
  const { data: staffWageBill, isLoading: staffWageBillLoading } = useGetStaffWageBill();

  const acceptDealMutation = useAcceptPromoDeal();

  const handleAcceptDeal = (dealId: number, isSeason = false) => {
    acceptDealMutation.mutate({ id: dealId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPromoDealsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetFinanceSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSponsorProgressQueryKey() });
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

      {/* Financial Health Rating */}
      <FinancialHealthRatingCard summary={summary} isLoading={summaryLoading} />

      {/* Player Wage Bill */}
      <PlayerWageBillCard data={wageBill} isLoading={wageBillLoading} />

      {/* Staff Wage Bill */}
      <StaffWageBillCard data={staffWageBill} isLoading={staffWageBillLoading} />

      {/* Cashflow Forecast */}
      <CashflowForecastCard summary={summary} isLoading={summaryLoading} />

      {/* Prize Money Tracker */}
      <PrizeMoneyTrackerCard data={prizeMoneyData} isLoading={prizeMoneyLoading} />

      {/* Sponsor Progress */}
      <SponsorProgressCard deals={sponsorProgress ?? []} isLoading={progressLoading} />

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
              {(() => {
                const prizeMoney   = summary?.incomeSources?.prizeMoney   || 0;
                const sponsorships = summary?.incomeSources?.sponsorships || 0;
                const promoDeals   = summary?.incomeSources?.promoDeals   || 0;
                const hasIncome    = prizeMoney + sponsorships + promoDeals > 0;
                return hasIncome ? (
                  <div className="space-y-2">
                    <BreakdownRow label="Prize Money" amount={prizeMoney} total={summary?.monthlyIncome || 1} color="bg-green-500" />
                    <BreakdownRow label="Sponsorships" amount={sponsorships} total={summary?.monthlyIncome || 1} color="bg-blue-500" />
                    <BreakdownRow label="Promo Deals" amount={promoDeals} total={summary?.monthlyIncome || 1} color="bg-gray-500" />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No income recorded yet.</p>
                );
              })()}
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Expense Breakdown</h4>
              {(() => {
                const playerSalaries = summary?.expenseBreakdown?.playerSalaries || 0;
                const staffSalaries  = summary?.expenseBreakdown?.staffSalaries  || 0;
                const trainingCosts  = summary?.expenseBreakdown?.trainingCosts  || 0;
                const other          = summary?.expenseBreakdown?.other          || 0;
                const hasExpenses    = playerSalaries + staffSalaries + trainingCosts + other > 0;
                return hasExpenses ? (
                  <div className="space-y-2">
                    <BreakdownRow label="Player Salaries" amount={playerSalaries} total={summary?.monthlyExpenses || 1} color="bg-red-500" />
                    <BreakdownRow label="Staff" amount={staffSalaries} total={summary?.monthlyExpenses || 1} color="bg-orange-500" />
                    <BreakdownRow label="Training" amount={trainingCosts} total={summary?.monthlyExpenses || 1} color="bg-purple-500" />
                    <BreakdownRow label="Other" amount={other} total={summary?.monthlyExpenses || 1} color="bg-gray-500" />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No expenses recorded yet.</p>
                );
              })()}
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

/* ── Player Wage Bill Card ──────────────────────────────────── */

const TIER_BADGE_STYLES: Record<string, string> = {
  "Elite Player":    "bg-violet-500/10 text-violet-700 border-violet-500/20",
  "Star Player":     "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  "Regular Player":  "bg-blue-500/10 text-blue-700 border-blue-500/20",
  "Developing Player": "bg-slate-500/10 text-slate-600 border-slate-400/20",
  "Rookie":          "bg-muted text-muted-foreground border-border",
};

function PlayerWageBillCard({ data, isLoading }: { data: WageBill | undefined; isLoading: boolean }) {
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4 text-red-500" />
            Player Wages
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  const weeklyWages  = data?.weeklyWages  ?? 0;
  const monthlyWages = data?.monthlyWages ?? 0;
  const players      = data?.players      ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4 text-red-500" />
            Player Wages
          </CardTitle>
          <Badge variant="outline" className="text-xs">{players.length} players</Badge>
        </div>
        <CardDescription>Live wage bill based on player ratings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Totals */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="text-xs text-muted-foreground mb-1">Weekly Wages</div>
            <div className="text-xl font-bold text-red-600">{formatCurrency(weeklyWages)}</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="text-xs text-muted-foreground mb-1">Monthly Wages</div>
            <div className="text-xl font-bold text-red-600">{formatCurrency(monthlyWages)}</div>
          </div>
        </div>

        {/* Expand toggle */}
        {players.length > 0 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")} />
            {expanded ? "Hide" : "Show"} per-player breakdown
          </button>
        )}

        {expanded && players.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Player</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Tier</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Weekly</th>
                </tr>
              </thead>
              <tbody>
                {[...players]
                  .sort((a, b) => b.weeklySalary - a.weeklySalary)
                  .map((p, i) => (
                    <tr key={p.id} className={cn("border-b last:border-0", i % 2 === 0 ? "bg-background" : "bg-muted/20")}>
                      <td className="px-3 py-2 font-medium">{p.name}</td>
                      <td className="px-3 py-2 hidden sm:table-cell">
                        <Badge className={cn("text-xs border", TIER_BADGE_STYLES[p.tier] ?? "bg-muted")}>{p.tier}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-red-600 font-medium">
                        {formatCurrency(p.weeklySalary)}
                      </td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/40">
                  <td className="px-3 py-2 font-semibold" colSpan={2}>Total</td>
                  <td className="px-3 py-2 text-right font-bold text-red-600 tabular-nums">{formatCurrency(weeklyWages)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {players.length === 0 && (
          <p className="text-sm text-muted-foreground italic">No players on the roster yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Staff Wage Bill Card ───────────────────────────────────── */

const ROLE_ICON: Record<string, string> = {
  Coach:           "🧠",
  "Fitness Trainer": "💪",
  Physiotherapist: "🩺",
  Scout:           "🔭",
  Doctor:          "👩‍⚕️",
  Psychologist:    "🧘",
};

function StaffWageBillCard({ data, isLoading }: { data: StaffWageBill | undefined; isLoading: boolean }) {
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="h-4 w-4 text-orange-500" />
            Staff Wages
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  const weeklyWages  = data?.weeklyWages  ?? 0;
  const monthlyWages = data?.monthlyWages ?? 0;
  const members      = data?.staff        ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="h-4 w-4 text-orange-500" />
            Staff Wages
          </CardTitle>
          <Badge variant="outline" className="text-xs">{members.length} staff</Badge>
        </div>
        <CardDescription>Weekly salaries for all hired staff members</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No staff wages currently active.</p>
        ) : (
          <>
            {/* Totals */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground mb-1">Weekly Wages</div>
                <div className="text-xl font-bold text-orange-600">{formatCurrency(weeklyWages)}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground mb-1">Monthly Wages</div>
                <div className="text-xl font-bold text-orange-600">{formatCurrency(monthlyWages)}</div>
              </div>
            </div>

            {/* Expand toggle */}
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")} />
              {expanded ? "Hide" : "Show"} per-staff breakdown
            </button>

            {expanded && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Staff Member</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Role</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Weekly</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...members]
                      .sort((a, b) => b.weeklySalary - a.weeklySalary)
                      .map((s, i) => (
                        <tr key={s.id} className={cn("border-b last:border-0", i % 2 === 0 ? "bg-background" : "bg-muted/20")}>
                          <td className="px-3 py-2 font-medium">
                            <span className="mr-1.5">{ROLE_ICON[s.role] ?? "👤"}</span>
                            {s.name}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{s.role}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-orange-600 font-medium">
                            {formatCurrency(s.weeklySalary)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/40">
                      <td className="px-3 py-2 font-semibold" colSpan={2}>Total</td>
                      <td className="px-3 py-2 text-right font-bold text-orange-600 tabular-nums">{formatCurrency(weeklyWages)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Financial Health Rating Card ──────────────────────────── */

type HealthRating = "Excellent" | "Stable" | "Warning" | "Critical";

function computeHealthRating(balance: number, netPosition: number): {
  rating: HealthRating;
  emoji: string;
  explanation: string;
} {
  const lowBalance   = balance < 100_000;
  const veryLow      = balance < 25_000;
  const negativeNet  = netPosition < 0;

  if (veryLow && negativeNet) {
    return {
      rating: "Critical",
      emoji: "🔴",
      explanation: "Your balance is critically low and monthly expenses are exceeding income — act now.",
    };
  }
  if (lowBalance || negativeNet) {
    if (lowBalance && negativeNet) {
      return {
        rating: "Warning",
        emoji: "🟠",
        explanation: "Low balance combined with negative cash flow is putting your finances under pressure.",
      };
    }
    if (lowBalance) {
      return {
        rating: "Warning",
        emoji: "🟠",
        explanation: "Your balance is running low — consider securing new sponsorship or reducing expenses.",
      };
    }
    return {
      rating: "Warning",
      emoji: "🟠",
      explanation: "Monthly expenses are exceeding income — review your spending to restore a positive cash flow.",
    };
  }
  if (balance >= 250_000 && netPosition > 0) {
    return {
      rating: "Excellent",
      emoji: "🟢",
      explanation: "Your finances are in great shape — strong balance with positive monthly cash flow.",
    };
  }
  return {
    rating: "Stable",
    emoji: "🟡",
    explanation: "Your team is financially healthy with a solid balance and sustainable cash flow.",
  };
}

const RATING_STYLES: Record<HealthRating, { border: string; badge: string; label: string }> = {
  Excellent: { border: "border-green-500/30",  badge: "bg-green-500/10 text-green-700 border-green-500/20",  label: "text-green-700"  },
  Stable:    { border: "border-yellow-400/30", badge: "bg-yellow-400/10 text-yellow-700 border-yellow-400/20", label: "text-yellow-700" },
  Warning:   { border: "border-orange-400/30", badge: "bg-orange-400/10 text-orange-700 border-orange-400/20", label: "text-orange-700" },
  Critical:  { border: "border-red-500/30",    badge: "bg-red-500/10 text-red-700 border-red-500/20",          label: "text-red-700"   },
};

function FinancialHealthRatingCard({
  summary,
  isLoading,
}: {
  summary: FinanceSummary | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  const balance     = summary?.totalBalance    ?? 0;
  const income      = summary?.monthlyIncome   ?? 0;
  const expenses    = summary?.monthlyExpenses ?? 0;
  const netPosition = income - expenses;

  const { rating, emoji, explanation } = computeHealthRating(balance, netPosition);
  const styles = RATING_STYLES[rating];

  return (
    <Card className={cn("border-2", styles.border)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-2xl" role="img" aria-label={rating}>{emoji}</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Financial Health</span>
                <Badge className={cn("text-xs font-semibold border", styles.badge)}>{rating}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{explanation}</p>
            </div>
          </div>
          <div className="flex gap-4 shrink-0 text-right">
            <div>
              <div className="text-xs text-muted-foreground">Balance</div>
              <div className="text-sm font-semibold">{formatCompact(balance)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Net / month</div>
              <div className={cn("text-sm font-semibold", netPosition >= 0 ? "text-green-600" : "text-red-600")}>
                {netPosition >= 0 ? "+" : ""}{formatCompact(netPosition)}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Prize Money Tracker Card ───────────────────────────────── */

const TOUR_COLORS: Record<string, string> = {
  "Local Tour":        "bg-slate-400",
  "Continental Tour":  "bg-blue-500",
  "World Tour":        "bg-violet-500",
  "World Championship":"bg-yellow-500",
  "Olympics":          "bg-rose-500",
};

function PrizeMoneyTrackerCard({
  data,
  isLoading,
}: {
  data: PrizeMoneySummary | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Medal className="h-4 w-4 text-yellow-500" />
            Prize Money Tracker
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  const isEmpty = !data || data.breakdown.length === 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Medal className="h-4 w-4 text-yellow-500" />
          Prize Money Tracker
        </CardTitle>
        <CardDescription>Season prize money earned by tour</CardDescription>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <p className="text-sm text-muted-foreground italic">No prize money earned yet.</p>
        ) : (
          <div className="space-y-3">
            {data.breakdown.map(row => {
              const pct = data.total > 0 ? Math.round((row.amount / data.total) * 100) : 0;
              const barColor = TOUR_COLORS[row.category] ?? "bg-primary";
              return (
                <div key={row.category} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", barColor)} />
                      <span className="font-medium">{row.category}</span>
                      <span className="text-xs text-muted-foreground">
                        ({row.matches} {row.matches === 1 ? "win" : "wins"})
                      </span>
                    </div>
                    <span className="font-semibold tabular-nums">{formatCurrency(row.amount)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", barColor)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}

            <div className="mt-4 pt-3 border-t flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground">Total Season Prize Money</span>
              <span className="text-lg font-bold text-green-600">{formatCurrency(data.total)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Sponsor Progress Card ──────────────────────────────────── */

function SponsorProgressCard({
  deals,
  isLoading,
}: {
  deals: SponsorProgress[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-yellow-500" />
            Sponsor Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (deals.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-yellow-500" />
            Sponsor Progress
          </CardTitle>
          <CardDescription>Track win targets for your active sponsorship deals</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">No active sponsor deals yet — accept a deal to start tracking progress.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4 text-yellow-500" />
          Sponsor Progress
        </CardTitle>
        <CardDescription>Win targets for your active sponsorship deals</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {deals.map(deal => (
          <div key={deal.id} className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm truncate">{deal.sponsor}</span>
                  {deal.isComplete ? (
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs shrink-0">
                      ✓ Target Reached
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs shrink-0">
                      In Progress
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{deal.description}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold text-green-600">{formatCompact(deal.amount)}</div>
                <div className="text-xs text-muted-foreground">reward</div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {deal.currentWins} / {deal.requirementWins} wins
                </span>
                <span>{deal.progressPct}%</span>
              </div>
              <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    deal.isComplete ? "bg-green-500" : "bg-yellow-500"
                  )}
                  style={{ width: `${deal.progressPct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Expires {deal.expiresAt}</span>
                {!deal.isComplete && (
                  <span>{deal.requirementWins - deal.currentWins} wins to go</span>
                )}
              </div>
            </div>
          </div>
        ))}
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
