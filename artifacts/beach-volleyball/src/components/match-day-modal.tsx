import { useState } from "react";
import { useCalendar, useRoundNames } from "@/hooks/use-calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Monitor,
  FastForward,
  Users,
  SkipForward,
  Trophy,
  MapPin,
  Loader2,
} from "lucide-react";
import { useLocation } from "wouter";
import { hideMatchDayBox, useMatchDayBoxHidden } from "@/hooks/use-match-day-box";

function formatGameDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const months = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function MatchDayModal() {
  const [, navigate] = useLocation();
  const {
    calendar,
    isSimulating,
    isDismissing,
    isSkipping,
    isStartingWatch,
    simulateMatchMutation,
    skipMatchMutation,
    dismissMatch,
    watchMatch,
  } = useCalendar();
  const roundName = useRoundNames();

  // If an action fails, this modal must stop being inescapable — it blocks
  // close, outside-click and Escape, so a failed simulate left the player
  // staring at a dialog that did nothing.
  const [actionError, setActionError] = useState<string | null>(null);
  const describe = (err: unknown) =>
    (err instanceof Error ? err.message : String(err)).replace(/^HTTP \d+ [^:]*: /, "");

  // Item 10: the player may close the box on match day; the dashboard's Next
  // Match card reopens it ("Play match").
  const closedByPlayer = useMatchDayBoxHidden(calendar?.pendingMatchId);
  const isOpen = !!calendar?.pendingMatchId && !!calendar?.pendingMatch && !closedByPlayer;

  if (!isOpen || !calendar?.pendingMatch) return null;

  const match = calendar.pendingMatch;
  // Item 14: GET /calendar's match-day squad (utils/matchDaySubstitution.ts on the server).
  const team = (calendar as { matchDayTeam?: { pair: { id: number; name: string; fitness: number }[]; substitutions: string[]; willForfeit: boolean } | null }).matchDayTeam ?? null;
  const isHome = match.homeTeamId !== undefined;

  // Determine opponent name from the pending match
  const opponentName = calendar.todayEvents?.[0]?.opponent ?? "Opponent";
  const isHomeTeam   = calendar.todayEvents?.[0]?.isHome ?? true;
  const userSide     = isHomeTeam ? "HOME" : "AWAY";
  // D-5: the club's own name, as the dashboard shows it (was a fixed placeholder).
  const clubName     = calendar.clubName;

  const tierLabel = match.tier ? match.tier.toUpperCase() : "WORLD TOUR";

  const handleWatchMatch = async () => {
    try {
      await watchMatch(match.id);
    } catch {
      // If the tick engine fails to start, Unity's /unity/match-state falls
      // back to its old "most recent match" behavior — still navigate so
      // the player isn't stuck, just without a live-driven view.
    }
    navigate(`/court?matchId=${match.id}`);
  };

  const handleSimResult = () => {
    setActionError(null);
    simulateMatchMutation.mutate(match.id, {
      onError: (err) => setActionError(describe(err) || "The match could not be simulated."),
    });
  };

  const handleManageTeam = () => {
    navigate("/team");
  };

  const handleSkipForNow = () => {
    setActionError(null);
    skipMatchMutation.mutate(match.id, {
      onError: (err) => setActionError(describe(err) || "The match could not be skipped."),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (open) return;
      // After a failed action the match can be let go of; otherwise closing
      // only hides the box - the match day stays, and the Next Match card
      // offers "Play match" (item 10).
      if (actionError) dismissMatch();
      else hideMatchDayBox(match.id);
    }}>
      <DialogContent
        className="max-w-sm"
        onInteractOutside={e => { if (!actionError) e.preventDefault(); }}
        data-testid="match-day-box"
      >
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-amber-500 hover:bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest">
              Match Day!
            </Badge>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide font-semibold">
              {roundName(match.round)}
            </Badge>
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
              {tierLabel}
            </Badge>
          </div>
          <DialogTitle className="text-xl font-black leading-tight">
            {isHomeTeam ? clubName : opponentName}
            <span className="mx-2 text-muted-foreground font-normal">vs</span>
            {isHomeTeam ? opponentName : clubName}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {match.locationName ?? "Venue TBC"}
            </span>
            <span>·</span>
            <span className="font-medium text-foreground">{userSide}</span>
            {match.prizeAmount && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Trophy className="h-3.5 w-3.5 text-amber-500" />
                  ${Number(match.prizeAmount).toLocaleString()}
                </span>
              </>
            )}
          </DialogDescription>
          {calendar.currentDate && (
            <p className="text-xs text-muted-foreground">
              {formatGameDate(calendar.currentDate)}
            </p>
          )}
        </DialogHeader>

        {/* Item 14: who plays, and who came in for an injured Match Player. */}
        {team && (
          <div className="rounded-lg border px-3 py-2 text-xs space-y-1" data-testid="match-day-team">
            {team.willForfeit ? (
              <p className="font-semibold text-red-600 dark:text-red-400">
                Not enough fit players: this match is forfeited when it is played.
              </p>
            ) : (
              <p>
                <span className="text-muted-foreground">Playing: </span>
                <span className="font-semibold">{team.pair.map(p => `${p.name} (fitness ${p.fitness}%)`).join(" & ")}</span>
              </p>
            )}
            {team.substitutions.map(line => (
              <p key={line} className="font-semibold text-amber-600 dark:text-amber-400" data-testid="match-day-substitution">
                {line}
              </p>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mt-2">
          <Button
            size="lg"
            className="h-auto py-3 flex-col gap-1.5 bg-primary hover:bg-primary/90 col-span-2"
            onClick={handleWatchMatch}
            disabled={isStartingWatch || isSimulating || isDismissing}
          >
            {isStartingWatch ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Monitor className="h-5 w-5" />
            )}
            <span className="font-bold">Watch Match</span>
            <span className="text-[10px] opacity-75 font-normal">Play on the 3D court</span>
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="h-auto py-3 flex-col gap-1.5"
            onClick={handleSimResult}
            disabled={isSimulating || isDismissing || isStartingWatch}
          >
            {isSimulating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FastForward className="h-4 w-4" />
            )}
            <span className="font-semibold text-sm">Sim Result</span>
            <span className="text-[10px] text-muted-foreground font-normal">Auto-simulate</span>
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="h-auto py-3 flex-col gap-1.5"
            onClick={handleManageTeam}
            disabled={isSimulating || isDismissing}
          >
            <Users className="h-4 w-4" />
            <span className="font-semibold text-sm">Manage Team</span>
            <span className="text-[10px] text-muted-foreground font-normal">Set lineup first</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="col-span-2 text-muted-foreground hover:text-foreground gap-2"
            onClick={handleSkipForNow}
            disabled={isSimulating || isDismissing || isSkipping}
          >
            {isSkipping ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <SkipForward className="h-3.5 w-3.5" />
            )}
            Skip for now (auto-sim in background)
          </Button>
        </div>

        {actionError && (
          <p className="text-sm text-destructive text-center" role="alert">
            {actionError} You can close this and try again.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
