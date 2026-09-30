/**
 * Overnight brief 30 Sep, C15 — Team > Youth Loans.
 *
 * The academy's court time (a youth team of 3 who play, reserves who do not),
 * listing a reserve for loan, the club's youths on loan out and in, and the
 * other clubs' listed youths to borrow for 6 or 12 months. The wage is split
 * 50/50 for the loan; there is no early recall (the server has no route for it).
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ArrowLeftRight, CalendarClock, Handshake, ListPlus, ListX, Shirt, Users } from "lucide-react";

type AcademyRow = {
  playerId: number; name: string; age: number; rating: number; academyRole: "youth_team" | "reserve";
  listed: boolean; onLoanFrom: { club: string; endsOn: string | null } | null; allowedMonths: number[];
};
type LoanRow = {
  loanId: number; playerId: number; name: string; age: number; position: string; rating: number; club: string;
  startsOn: string | null; endsOn: string | null; months: number | null; weeklyWage: number | null; yourHalf: number;
};
type Listed = {
  loanId: number; playerId: number; name: string; age: number; position: string; nationality: string | null; rating: number;
  club: string; weeklyWage: number; yourHalf: number; allowedMonths: number[];
};
type Loans = {
  today: string; youthTeamSize: number; cap: number; reserveShare: number; months: number[]; academySize: number;
  academy: AcademyRow[]; out: LoanRow[]; in: LoanRow[]; available: Listed[];
};

const POSITION: Record<string, string> = { setter: "Setter", spiker: "Spiker", defender: "Defender", blocker: "Blocker", all_rounder: "All-Rounder" };
const money = (n: number | null | undefined) => `$${Number(n ?? 0).toLocaleString()}`;
function addMonths(date: string, months: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}
async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "The club could not do that.");
  return data;
}

export default function YouthLoans() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery<Loans>({
    queryKey: ["youth-loans"],
    queryFn: () => fetch("/api/youth-loans").then((r) => r.json()),
  });
  const [borrowing, setBorrowing] = useState<{ listing: Listed; months: number } | null>(null);
  const [swapFor, setSwapFor] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const act = async (url: string, body: unknown, done: string) => {
    setBusy(true);
    try {
      await post(url, body);
      toast({ title: done });
      await qc.invalidateQueries();
    } catch (e) {
      toast({ title: "Not done", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  if (isLoading || !data) return <Skeleton className="h-64 w-full rounded-xl" />;
  const team = data.academy.filter((a) => a.academyRole === "youth_team");
  const reserves = data.academy.filter((a) => a.academyRole === "reserve");
  const share = Math.round(data.reserveShare * 100);

  return (
    <div className="space-y-6" data-testid="youth-loans">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-2"><ArrowLeftRight className="h-5 w-5 text-primary" /> Youth Loans</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Your youth team of {data.youthTeamSize} gets the court time and develops at the full rate; a reserve does not play and develops at {share}% of it.
          List a reserve and another club can take her on loan for 6 or 12 months: she plays for them, and each club pays half her wage.
          She comes back on the end date. Neither club can end a loan early.
        </p>
      </div>

      {/* The academy */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Your academy</h3>
          <span className="text-sm text-muted-foreground" data-testid="academy-count">{data.academySize} of {data.cap} places (your youths out on loan included)</span>
        </div>
        {data.academy.length === 0 && <p className="text-sm text-muted-foreground">No one in the academy yet.</p>}
        {[["Youth team", team], ["Reserves", reserves]].map(([label, rows]) => (
          <div key={label as string} className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label as string}</div>
            {(rows as AcademyRow[]).map((a) => (
              <div key={a.playerId} className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/40 px-3 py-2" data-testid={`academy-${a.playerId}`}>
                <div className="min-w-[180px]">
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs text-muted-foreground">Age {a.age} · Rating {a.rating}</div>
                </div>
                <Badge variant="outline" className={cn("border", a.academyRole === "youth_team" ? "border-primary text-primary" : "border-muted-foreground/40 text-muted-foreground")}>
                  <Shirt className="h-3 w-3 mr-1" />{a.academyRole === "youth_team" ? "Youth team" : "Reserve"}
                </Badge>
                {a.listed && <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">Listed for loan</Badge>}
                {a.onLoanFrom && <Badge variant="outline" className="border-sky-500 text-sky-600 dark:text-sky-400">On loan from {a.onLoanFrom.club} until {a.onLoanFrom.endsOn}</Badge>}
                <div className="ml-auto flex flex-wrap gap-2">
                  {a.academyRole === "youth_team" && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => act("/api/youth-loans/role", { playerId: a.playerId, role: "reserve" }, `${a.name} moves to the reserves`)}>To reserves</Button>
                  )}
                  {a.academyRole === "reserve" && !a.listed && (
                    swapFor === a.playerId && team.length >= data.youthTeamSize ? (
                      <div className="flex flex-wrap items-center gap-1 text-xs">
                        <span className="text-muted-foreground">In place of:</span>
                        {team.map((t) => (
                          <Button key={t.playerId} size="sm" variant="secondary" disabled={busy}
                            onClick={() => { setSwapFor(null); act("/api/youth-loans/role", { playerId: a.playerId, role: "youth_team", swapOut: t.playerId }, `${a.name} joins the youth team; ${t.name} to the reserves`); }}>
                            {t.name}
                          </Button>
                        ))}
                        <Button size="sm" variant="ghost" onClick={() => setSwapFor(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" disabled={busy}
                        onClick={() => team.length >= data.youthTeamSize ? setSwapFor(a.playerId) : act("/api/youth-loans/role", { playerId: a.playerId, role: "youth_team" }, `${a.name} joins the youth team`)}>
                        To youth team
                      </Button>
                    )
                  )}
                  {a.academyRole === "reserve" && !a.listed && !a.onLoanFrom && (
                    <Button size="sm" disabled={busy || a.allowedMonths.length === 0} title={a.allowedMonths.length === 0 ? "She leaves the academy at the season's end" : undefined}
                      onClick={() => act("/api/youth-loans/list", { playerId: a.playerId }, `${a.name} is listed for loan`)}>
                      <ListPlus className="h-3.5 w-3.5 mr-1" /> List for loan
                    </Button>
                  )}
                  {a.listed && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => act("/api/youth-loans/unlist", { playerId: a.playerId }, `${a.name} is off the loan list`)}>
                      <ListX className="h-3.5 w-3.5 mr-1" /> Take off the list
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* Loans out and in */}
      <div className="grid gap-4 md:grid-cols-2">
        {([["On loan to other clubs", data.out, "to"], ["On loan to you", data.in, "from"]] as const).map(([label, rows, word]) => (
          <section key={label} className="rounded-xl border border-border bg-card p-4 space-y-2" data-testid={word === "to" ? "loans-out" : "loans-in"}>
            <h3 className="font-semibold flex items-center gap-2"><CalendarClock className="h-4 w-4" /> {label}</h3>
            {rows.length === 0 && <p className="text-sm text-muted-foreground">None.</p>}
            {rows.map((l) => (
              <div key={l.loanId} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <div className="font-medium">{l.name} <span className="text-muted-foreground font-normal">· {word} {l.club}</span></div>
                <div className="text-xs text-muted-foreground">{l.months} months, {l.startsOn} to {l.endsOn} · you pay {money(l.yourHalf)} of her {money(l.weeklyWage)} a week</div>
              </div>
            ))}
          </section>
        ))}
      </div>

      {/* Other clubs' listed youths */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3" data-testid="loans-available">
        <h3 className="font-semibold flex items-center gap-2"><Handshake className="h-4 w-4" /> Listed by other clubs</h3>
        {data.available.length === 0 && <p className="text-sm text-muted-foreground">No club has a youth listed right now.</p>}
        <div className="grid gap-2 md:grid-cols-2">
          {data.available.map((l) => (
            <div key={l.loanId} className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{l.name}</div>
                <div className="text-xs text-muted-foreground">{l.club} · Age {l.age} · {POSITION[l.position] ?? l.position} · Rating {l.rating}{l.nationality ? ` · ${l.nationality}` : ""}</div>
                <div className="text-xs text-muted-foreground">Wage {money(l.weeklyWage)} a week: you would pay {money(l.yourHalf)}</div>
              </div>
              <Button size="sm" disabled={busy} onClick={() => setBorrowing({ listing: l, months: Math.max(...l.allowedMonths) })}>Borrow</Button>
            </div>
          ))}
        </div>
      </section>

      <AlertDialog open={!!borrowing} onOpenChange={(o) => { if (!o) setBorrowing(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Borrow {borrowing?.listing.name}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <div className="flex gap-2">
                  {data.months.map((m) => (
                    <Button key={m} size="sm" variant={borrowing?.months === m ? "default" : "outline"}
                      disabled={!borrowing?.listing.allowedMonths.includes(m)} onClick={() => borrowing && setBorrowing({ ...borrowing, months: m })}>
                      {m} months
                    </Button>
                  ))}
                </div>
                {borrowing && (
                  <p>
                    She plays for you from {borrowing.listing.club} for {borrowing.months} months, until {addMonths(data.today, borrowing.months)}
                    {team.length < data.youthTeamSize ? ", in your youth team" : ", in your reserves (your youth team is full: you choose who plays)"}, and you pay half her wage:
                    {" "}{money(borrowing.listing.yourHalf)} of {money(borrowing.listing.weeklyWage)} a week. She returns to {borrowing.listing.club} on that date; neither club can end the loan early.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => {
              const b = borrowing; setBorrowing(null);
              if (b) act("/api/youth-loans/borrow", { loanId: b.listing.loanId, months: b.months, confirm: true }, `${b.listing.name} joins you on loan for ${b.months} months`);
            }}>Borrow her</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
