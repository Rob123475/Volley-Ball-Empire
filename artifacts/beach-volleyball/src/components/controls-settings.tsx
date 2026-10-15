/**
 * Settings > Controls: Auto or Manual on the 3D court, and the court's
 * controls. The same panel is on the Settings page and in the 3D court's
 * settings (pages/court.tsx, Rob, 16 Oct), where the choice goes to the court
 * at once. The caller stores the choice (lib/court-settings.ts saveControlMode).
 */
import { Button } from "@/components/ui/button";
import { COURT_CONTROLS, COURT_OTHER_CONTROLS, type ControlMode } from "@/lib/court-settings";

export function ControlsSettings({ mode, onChoose }: { mode: ControlMode; onChoose: (mode: ControlMode) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["auto", "manual"] as const).map((m) => (
          <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} onClick={() => onChoose(m)} data-testid={`controls-${m}`}>
            {m === "auto" ? "Auto: the AI plays" : "Manual: you play one of your pair"}
          </Button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="controls-table">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 pr-3 font-medium">In Manual</th><th className="py-1 pr-3 font-medium">Keyboard</th>
              <th className="py-1 pr-3 font-medium">Xbox pad</th><th className="py-1 font-medium">PlayStation pad</th>
            </tr>
          </thead>
          <tbody>
            {COURT_CONTROLS.map((c) => (
              <tr key={c.action} className="border-t border-border">
                <td className="py-1 pr-3">{c.action}</td><td className="py-1 pr-3 font-semibold">{c.keyboard}</td>
                <td className="py-1 pr-3">{c.xbox}</td><td className="py-1">{c.playstation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="text-xs text-muted-foreground space-y-1">
        {COURT_OTHER_CONTROLS.map((c) => <li key={c.action}><span className="font-semibold text-foreground">{c.action}:</span> {c.how}</li>)}
      </ul>
    </div>
  );
}
