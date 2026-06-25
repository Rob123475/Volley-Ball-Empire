import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Play, Zap, Loader2 } from "lucide-react";

interface MatchActionButtonsProps {
  activePlayers: any[];
  teamSize: number;
  matchLabel?: string;
  onSimulate: (playerIds: number[]) => void;
  isSimulating: boolean;
  onWatchMatch: () => void;
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
  matchLabel,
  onSimulate,
  isSimulating,
  onWatchMatch,
}: MatchActionButtonsProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const enoughPlayers = activePlayers.length >= teamSize;

  function handleConfirmSim() {
    onSimulate(autoPickIds(activePlayers, teamSize));
    setShowConfirm(false);
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-2 w-full">
        <Button
          className="gap-2 flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          onClick={onWatchMatch}
          disabled={isSimulating}
          data-testid="button-watch-match"
        >
          <Play className="h-4 w-4 fill-current" />
          Watch Match
        </Button>

        <Button
          variant="outline"
          className="gap-2 flex-1"
          onClick={() => setShowConfirm(true)}
          disabled={isSimulating || !enoughPlayers}
          data-testid="button-sim-result"
        >
          {isSimulating
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <><Zap className="h-4 w-4" /> Sim Result</>}
        </Button>
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
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
              onClick={() => setShowConfirm(false)}
              disabled={isSimulating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSim}
              disabled={isSimulating}
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
    </>
  );
}
