import { useCalendar } from "@/hooks/use-calendar";
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
    simulateMatch,
    skipMatch,
    dismissMatch,
  } = useCalendar();

  const isOpen = !!calendar?.pendingMatchId && !!calendar?.pendingMatch;

  if (!isOpen || !calendar?.pendingMatch) return null;

  const match = calendar.pendingMatch;
  const isHome = match.homeTeamId !== undefined;

  // Determine opponent name from the pending match
  const opponentName = calendar.todayEvents?.[0]?.opponent ?? "Opponent";
  const isHomeTeam   = calendar.todayEvents?.[0]?.isHome ?? true;
  const userSide     = isHomeTeam ? "HOME" : "AWAY";

  const tierLabel = match.tier ? match.tier.toUpperCase() : "WORLD TOUR";

  const handleWatchMatch = () => {
    navigate("/court");
  };

  const handleSimResult = () => {
    simulateMatch(match.id);
  };

  const handleManageTeam = () => {
    navigate("/team");
  };

  const handleSkipForNow = () => {
    skipMatch();
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-sm [&>button:first-child]:hidden"
        onInteractOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
      >
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-amber-500 hover:bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest">
              Match Day!
            </Badge>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide font-semibold">
              Round {match.round}
            </Badge>
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
              {tierLabel}
            </Badge>
          </div>
          <DialogTitle className="text-xl font-black leading-tight">
            {isHomeTeam ? "Your Team" : opponentName}
            <span className="mx-2 text-muted-foreground font-normal">vs</span>
            {isHomeTeam ? opponentName : "Your Team"}
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
                  €{Number(match.prizeAmount).toLocaleString()}
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

        <div className="grid grid-cols-2 gap-2 mt-2">
          <Button
            size="lg"
            className="h-auto py-3 flex-col gap-1.5 bg-primary hover:bg-primary/90 col-span-2"
            onClick={handleWatchMatch}
          >
            <Monitor className="h-5 w-5" />
            <span className="font-bold">Watch Match</span>
            <span className="text-[10px] opacity-75 font-normal">Play on the 3D court</span>
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="h-auto py-3 flex-col gap-1.5"
            onClick={handleSimResult}
            disabled={isSimulating || isDismissing}
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
            disabled={isSimulating || isDismissing}
          >
            {isDismissing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <SkipForward className="h-3.5 w-3.5" />
            )}
            Skip for now (auto-sim in background)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
