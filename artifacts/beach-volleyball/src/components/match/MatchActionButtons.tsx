import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Play, Zap, Loader2, Flag } from "lucide-react";

interface MatchActionButtonsProps {
  activePlayers: any[];
  teamSize: number;
  matchId: number;
  matchLabel?: string;
  onSimulate: (playerIds: number[]) => void;
  isSimulating: boolean;
  onWatchMatch: () => void;
  onForfeit: (matchId: number) => void;
  isForfeiting?: boolean;
}

function autoPickIds(players: any[], count: number): number[] {
  return [...players]
    .sort((a, b) => {
      const ha = (a.injuryStatus === "Healthy" || !a.injuryStatus) ? 1 : 0;
      const hb = (b.injuryStatus === "Healthy" || !b.injuryStatus) ? 1 : 0;
      if (ha !== hb) return hb - ha;
      const ra = ((a.speed ?? 50) + (a.power ?? 50) + (a.defense ?? 50) + (a.serve ?? 50) + (a.block ?? 50)) / 5;
      const rb = ((b.speed ?? 50) + (b.power ?? 50) + (b.defense ?? 50) + (b.serve ?? 50) + (b.block ?? 50)) / 5;
      return rb - ra;
    })
    .slice(0, count)
    .map(p => p.id);
}

export function MatchActionButtons({
  activePlayers,
  teamSize,
  matchId,
  matchLabel,
  onSimulate,
  isSimulating,
  onWatchMatch,
  onForfeit,
  isForfeiting = false,
}: MatchActionButtonsProps) {
  const [showSimConfirm, setShowSimConfirm] = useState(false);
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false);

  const enoughPlayers = activePlayers.length >= teamSize;
  const busy = isSimulating || isForfeiting;

  function handleConfirmSim() {
    onSimulate(autoPickIds(activePlayers, teamSize));
    setShowSimConfirm(false);
  }

  function handleConfirmForfeit() {
    onForfeit(matchId);
    setShowForfeitConfirm(false);
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-2 w-full">
        <Button
          className="gap-2 flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          onClick={onWatchMatch}
          disabled={busy}
          data-testid="button-watch-match"
        >
          <Play className="h-4 w-4 fill-current" />
          Watch Match
        </Button>

        <Button
          variant="outline"
          className="gap-2 flex-1"
          onClick={() => setShowSimConfirm(true)}
          disabled={busy || !enoughPlayers}
          data-testid="button-sim-result"
        >
          {isSimulating
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <><Zap className="h-4 w-4" /> Sim Result</>}
        </Button>

        <Button
          variant="outline"
          className="gap-2 border-red-500/40 text-red-500 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/60"
          onClick={() => setShowForfeitConfirm(true)}
          disabled={busy}
          data-testid="button-forfeit"
        >
          {isForfeiting
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <><Flag className="h-4 w-4" /> Forfeit</>}
        </Button>
      </div>

      {/* Sim confirmation dialog */}
      <Dialog open={showSimConfirm} onOpenChange={setShowSimConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Sim this match now?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <p className="text-sm text-muted-foreground">
              You won't watch the live match. The best available players will be
              auto-selected and the result simulated immediately.
            </p>
            {matchLabel && (
              <p className="text-xs font-semibold text-muted-foreground/60">{matchLabel}</p>
            )}
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowSimConfirm(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSim}
              disabled={busy}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              data-testid="button-confirm-sim"
            >
              {isSimulating
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><Zap className="h-4 w-4" /> Sim Match</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Forfeit confirmation dialog */}
      <Dialog open={showForfeitConfirm} onOpenChange={setShowForfeitConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-red-500" />
              Forfeit this match?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">
              Your team will concede the match 0–21. The opponent wins automatically.
            </p>
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-400/80 space-y-1">
              <div>• Recorded as a loss in the season standings</div>
              <div>• Board confidence –5</div>
              <div>• Sponsor reputation –1</div>
              <div>• Win streak reset to 0</div>
            </div>
            {matchLabel && (
              <p className="text-xs font-semibold text-muted-foreground/60">{matchLabel}</p>
            )}
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowForfeitConfirm(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmForfeit}
              disabled={busy}
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
              data-testid="button-confirm-forfeit"
            >
              {isForfeiting
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><Flag className="h-4 w-4" /> Yes, Forfeit</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
