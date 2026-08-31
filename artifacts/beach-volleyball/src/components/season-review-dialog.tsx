/**
 * Season Review — Phase 8 row 6.
 *
 * The rollover has returned `seasonRollover` and `careerComplete` since the
 * season boundary was built, and nothing in the client read either one. A
 * season ended, five players retired, the academy promoted a cohort and the
 * ladder finished — and the player saw the date change. This is the screen that
 * tells them what happened.
 *
 * It is deliberately a dialog rather than a route: a season boundary is an
 * event, not a place, and it must interrupt the auto-advance ticker rather than
 * wait to be navigated to.
 */
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trophy, TrendingUp, UserMinus, Wallet, Flag } from "lucide-react";

export type SeasonReview = {
  seasonYear: number;
  seasonNumber: number;
  name: string | null;
  status: string | null;
  record: { wins: number; losses: number };
  balance: number;
  ranking: { rankingPoints: number; eventsEntered: number; wins: number; losses: number };
  playerRank: number | null;
  standings: Array<{ rank: number; teamName: string | null; isPlayer: boolean; points: number | null }>;
  retired: Array<{ id: number; name: string | null; age: number | null }>;
  summary: string | null;
  isFinalSeason: boolean;
};

const money = (n: number) =>
  "$" + Math.round(n).toLocaleString();

function Stat({ icon: Icon, label, value, hint }: {
  icon: typeof Trophy; label: string; value: string; hint?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card/50 p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate text-lg font-semibold tabular-nums">{value}</div>
        {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
      </div>
    </div>
  );
}

export function SeasonReviewDialog({ year, onClose }: { year: number | null; onClose: () => void }) {
  const { data, isLoading, error } = useQuery<SeasonReview>({
    queryKey: ["season-review", year],
    queryFn: async () => {
      const res = await fetch(`/api/seasons/${year}/review`);
      if (!res.ok) throw new Error(`Season review unavailable (${res.status})`);
      return res.json();
    },
    enabled: year != null,
  });

  const open = year != null;
  const finished = data?.isFinalSeason ?? false;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl" data-testid="season-review">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {finished ? <Flag className="h-5 w-5" /> : <Trophy className="h-5 w-5" />}
            {finished
              ? "Career complete"
              : `${data?.name ?? `Season ${data?.seasonNumber ?? ""}`} complete`}
          </DialogTitle>
          <DialogDescription>
            {finished
              ? "This was the final season of your career. Here is how it ended."
              : "How the season finished, before the next one begins."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading the season…</div>
        ) : error ? (
          // A review that cannot load must say so. Silently showing an empty
          // season would read as "nothing happened", which is a lie.
          <div className="py-10 text-center text-sm text-destructive">
            {error instanceof Error ? error.message : "Could not load this season."}
          </div>
        ) : data ? (
          <ScrollArea className="max-h-[60vh] pr-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat
                icon={Trophy} label="Record"
                value={`${data.record.wins}W ${data.record.losses}L`}
                hint={data.playerRank ? `Finished ${data.playerRank} in the standings` : undefined}
              />
              <Stat
                icon={TrendingUp} label="Ranking points"
                value={String(data.ranking.rankingPoints)}
                hint={`${data.ranking.eventsEntered} events entered`}
              />
              <Stat icon={Wallet} label="Balance" value={money(data.balance)} />
              <Stat
                icon={UserMinus} label="Retired"
                value={String(data.retired.length)}
                hint={data.retired.length ? "Left the game this season" : "Nobody retired"}
              />
            </div>

            {data.summary ? (
              <>
                <Separator className="my-4" />
                <p className="text-sm text-muted-foreground">{data.summary}</p>
              </>
            ) : null}

            {data.standings.length > 0 ? (
              <>
                <Separator className="my-4" />
                <div className="mb-2 text-sm font-medium">Final standings</div>
                <div className="space-y-1">
                  {data.standings.map((row) => (
                    <div
                      key={`${row.rank}-${row.teamName ?? ""}`}
                      className={`flex items-center justify-between rounded px-2 py-1 text-sm ${
                        row.isPlayer ? "bg-primary/10 font-medium" : ""
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-6 text-right tabular-nums text-muted-foreground">{row.rank}</span>
                        <span className="truncate">{row.teamName ?? "—"}</span>
                        {row.isPlayer ? <Badge variant="secondary" className="h-4 px-1 text-[10px]">You</Badge> : null}
                      </span>
                      <span className="tabular-nums text-muted-foreground">{row.points ?? 0}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            {data.retired.length > 0 ? (
              <>
                <Separator className="my-4" />
                <div className="mb-2 text-sm font-medium">Retirements</div>
                <div className="flex flex-wrap gap-1.5">
                  {data.retired.map((p) => (
                    <Badge key={p.id} variant="outline" className="font-normal">
                      {p.name ?? `Player ${p.id}`}{p.age != null ? ` · ${p.age}` : ""}
                    </Badge>
                  ))}
                </div>
              </>
            ) : null}
          </ScrollArea>
        ) : null}

        <DialogFooter>
          <Button onClick={onClose} data-testid="season-review-continue">
            {finished ? "Close" : "Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
