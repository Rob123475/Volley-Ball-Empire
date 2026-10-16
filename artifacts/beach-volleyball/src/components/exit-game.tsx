/**
 * Rob, 16 Oct: "Exit game", on the Settings page and in the 3D court's
 * settings, so the game can be left from anywhere. It asks first, inside the
 * page (no browser dialog), then closes the desktop game the way closing its
 * window does (electron/preload.js vbeApp.quit, electron/main.js "app:quit"):
 * the server checkpoints the save and closes it before the app goes. Every
 * change is already saved as it is made, so the career is saved.
 *
 * During a 3D match the game's rule for a match left part-way applies, and the
 * question says so: it counts as a forfeit (pages/court.tsx Leave match; a
 * window closed mid-match is forfeited at the next start the same way, index.ts
 * forfeitAbandonedWatchedMatches). Exit records it through Leave match first,
 * so the save is complete when the app closes.
 */
import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type AppBridge = { quit: () => Promise<void> };
const appBridge = (): AppBridge | null => ((window as unknown as { vbeApp?: AppBridge }).vbeApp ?? null);

export function ExitGame({ matchId = null }: { matchId?: string | null }) {
  const [asking, setAsking] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const bridge = appBridge();
  if (!bridge) return <p className="text-sm text-muted-foreground">Exit is in the desktop game.</p>;

  const exit = async () => {
    setLeaving(true);
    // The match in play is forfeited, as leaving it is (a match already over answers 200, one not watched 409).
    if (matchId) await fetch(`/api/matches/${matchId}/leave`, { method: "POST", credentials: "same-origin" }).catch(() => null);
    await bridge.quit();
  };

  return (
    <>
      <Button variant="destructive" size="sm" className="gap-1" onClick={() => setAsking(true)} data-testid="settings-exit">
        <LogOut className="h-4 w-4" /> Exit game
      </Button>
      <AlertDialog open={asking} onOpenChange={(open) => { if (!leaving) setAsking(open); }}>
        <AlertDialogContent data-testid="dialog-exit-game">
          <AlertDialogHeader>
            <AlertDialogTitle>Exit Beach Volleyball Empire?</AlertDialogTitle>
            <AlertDialogDescription>
              Your career is saved.
              {matchId ? " The match in play counts as a forfeit, as leaving a match does: a loss with no prize money." : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaving} data-testid="exit-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={leaving} onClick={(e) => { e.preventDefault(); void exit(); }} data-testid="exit-confirm">
              Exit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
