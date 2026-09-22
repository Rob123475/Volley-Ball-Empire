/**
 * The club's Hall of Fame, and the window where the manager fills it.
 *
 * Rob's rule (22 Sep): every two seasons a club may honour up to six players,
 * current or retired, and may honour nobody. The panel shows what the club
 * already has on its board, who the game recommends, and the full list of
 * everyone eligible — the manager is not made to take the recommendation.
 *
 * This replaced a tab that listed "retired players at the club", which was
 * always empty: retiring a player is what takes her off the club.
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetClubHallOfFame, useInductIntoHallOfFame, getGetClubHallOfFameQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Crown, Medal, Trophy, CalendarClock, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Candidate = {
  playerId: number;
  name: string;
  nationality?: string | null;
  imageUrl?: string | null;
  retired: boolean;
  olympicGolds: number;
  worldTitles: number;
  seasonsAtClub: number;
  rankingPoints: number;
};

function Why({ c }: { c: Candidate }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {c.olympicGolds > 0 && (
        <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-700 text-[10px]">
          <Medal className="h-2.5 w-2.5" />
          {c.olympicGolds} Olympic {c.olympicGolds === 1 ? "gold" : "golds"}
        </Badge>
      )}
      {c.worldTitles > 0 && (
        <Badge variant="outline" className="gap-1 border-yellow-500/50 text-yellow-700 text-[10px]">
          <Trophy className="h-2.5 w-2.5" />
          {c.worldTitles} World {c.worldTitles === 1 ? "Final" : "Finals"}
        </Badge>
      )}
      <Badge variant="outline" className="gap-1 text-[10px]">
        <CalendarClock className="h-2.5 w-2.5" />
        {c.seasonsAtClub} {c.seasonsAtClub === 1 ? "season" : "seasons"} here
      </Badge>
      {c.rankingPoints > 0 && (
        <Badge variant="outline" className="gap-1 text-[10px]">
          <Star className="h-2.5 w-2.5" />
          {c.rankingPoints} ranking pts
        </Badge>
      )}
      {c.retired && <Badge variant="secondary" className="text-[10px]">Retired</Badge>}
    </div>
  );
}

export function ClubHallOfFame() {
  const { data, isLoading } = useGetClubHallOfFame();
  const induct = useInductIntoHallOfFame();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [picked, setPicked] = useState<number[]>([]);
  const [showAll, setShowAll] = useState(false);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!data) return null;

  const max = data.window?.maxThisWindow ?? 6;
  const every = data.window?.everySeasons ?? 2;
  const open = data.window?.open === true;
  const inducted = data.inducted ?? [];
  const recommendations = (data.recommendations ?? []) as Candidate[];
  const eligible = (data.eligible ?? []) as Candidate[];
  const shown = showAll ? eligible : recommendations;

  const toggle = (id: number) => {
    setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : p.length >= max ? p : [...p, id]);
  };

  const submit = (ids: number[]) => {
    induct.mutate({ data: { playerIds: ids } }, {
      onSuccess: () => {
        setPicked([]);
        queryClient.invalidateQueries({ queryKey: getGetClubHallOfFameQueryKey() });
        toast({
          title: ids.length === 0 ? "Nobody inducted" : "Inducted",
          description: ids.length === 0
            ? `The board stays as it is until the next window.`
            : `${ids.length} ${ids.length === 1 ? "player is" : "players are"} in the club's Hall of Fame.`,
        });
      },
      onError: () => toast({ title: "Could not induct", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6">
      {/* ── The board ── */}
      <div>
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
          <Crown className="h-5 w-5 text-amber-400" />
          {data.clubName} Hall of Fame
        </h3>
        {inducted.length === 0 ? (
          <Card className="border-2 border-dashed text-center p-10">
            <Crown className="h-10 w-10 mx-auto mb-3 text-amber-400 opacity-40" />
            <p className="font-semibold text-muted-foreground">Nobody honoured yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              The club may induct up to {max} players every {every} seasons.
            </p>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {inducted.map((p) => (
              <Card key={p.playerId} className="border-2 border-amber-400/40 bg-amber-50/30 dark:bg-amber-950/10">
                <CardContent className="p-4 flex items-center gap-3">
                  <Crown className="h-6 w-6 text-amber-500 shrink-0" />
                  <div>
                    <div className="font-bold leading-tight">{p.name}</div>
                    <div className="text-xs text-muted-foreground">Inducted after season {p.seasonInducted}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── The window ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold">
            {open ? "Induction window is open" : "Induction window"}
          </h3>
          <span className="text-sm text-muted-foreground">
            {open
              ? `Choose up to ${max}, or none`
              : `Opens every ${every} seasons — ${data.window?.seasonsUntilNext ?? 0} to go`}
          </span>
        </div>

        {open && (
          <div className="flex items-center gap-2 mb-3">
            <Button
              size="sm"
              disabled={picked.length === 0 || induct.isPending}
              onClick={() => submit(picked)}
              data-testid="button-induct"
            >
              Induct {picked.length > 0 ? `${picked.length} of ${max}` : ""}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={induct.isPending}
              onClick={() => submit([])}
              data-testid="button-induct-nobody"
            >
              Honour nobody this time
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show recommendations" : `Show all ${eligible.length} eligible`}
            </Button>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((c) => (
            <Card
              key={c.playerId}
              onClick={() => open && toggle(c.playerId)}
              data-testid={`card-candidate-${c.playerId}`}
              className={cn(
                "transition-colors",
                open && "cursor-pointer hover:border-primary/60",
                picked.includes(c.playerId) && "border-2 border-primary bg-primary/5",
              )}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold leading-tight">{c.name}</span>
                  {c.nationality && <span className="text-xs text-muted-foreground">{c.nationality}</span>}
                </div>
                <Why c={c} />
              </CardContent>
            </Card>
          ))}
          {shown.length === 0 && (
            <Card className="border-2 border-dashed text-center p-8 md:col-span-2 lg:col-span-3">
              <p className="text-sm text-muted-foreground">Nobody to honour yet.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
