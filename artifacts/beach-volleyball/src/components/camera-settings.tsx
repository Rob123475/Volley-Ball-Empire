/**
 * 1.2 B1: Settings > Camera. The court's two looks, one choice for each kind of
 * match (a played match: Manual; a watched match: Auto), and for the Game look
 * which of the six views it opens on. The same panel is on the Settings page and
 * in the 3D court's own settings (pages/court.tsx), where a change goes to the
 * court at once. The caller stores the choice (lib/court-settings.ts saveCourtCamera).
 */
import { Button } from "@/components/ui/button";
import { CAMERA_VIEWS, type CameraChoice, type CourtCamera } from "@/lib/court-settings";

function Row({ label, hint, choice, onChoose, id }: { label: string; hint: string; choice: CameraChoice; onChoose: (c: CameraChoice) => void; id: string }) {
  return (
    <div className="space-y-2" data-testid={`camera-${id}`}>
      <div>
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={choice.look === "tv" ? "default" : "outline"} onClick={() => onChoose({ ...choice, look: "tv" })} data-testid={`camera-${id}-tv`}>
          TV: the camera roams
        </Button>
        <Button size="sm" variant={choice.look === "game" ? "default" : "outline"} onClick={() => onChoose({ ...choice, look: "game" })} data-testid={`camera-${id}-game`}>
          Game: a fixed view
        </Button>
      </div>
      {choice.look === "game" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CAMERA_VIEWS.map((name, i) => (
            <Button key={name} size="sm" variant={choice.view === i + 1 ? "default" : "outline"} className="justify-start"
              onClick={() => onChoose({ look: "game", view: i + 1 })} data-testid={`camera-${id}-view-${i + 1}`}>
              {i + 1}. {name}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CameraSettings({ camera, onChange }: { camera: CourtCamera; onChange: (camera: CourtCamera) => void }) {
  return (
    <div className="space-y-5">
      <Row id="played" label="When you play (Manual)" hint="Opens on the Game look, behind your own baseline, unless you choose otherwise."
        choice={camera.played} onChoose={(c) => onChange({ ...camera, played: c })} />
      <Row id="watched" label="When you watch (Auto)" hint="Opens on the TV look, unless you choose otherwise."
        choice={camera.watched} onChoose={(c) => onChange({ ...camera, watched: c })} />
      <p className="text-xs text-muted-foreground">
        On the court: V (L3 on a pad) switches look, 1 to 6 pick a view, the D-pad steps through them. What you pick there is remembered here.
        Replays and the moments between points use the TV camera in both looks.
      </p>
    </div>
  );
}
