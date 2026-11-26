/**
 * 1.2 B5: Settings > Match presentation. Two switches so a long career is never
 * slowed down: "Skip to next serve" and "Skip replays". The same panel is on
 * the Settings page and in the 3D court's own settings (pages/court.tsx), where a
 * change goes to the court at once. The caller stores the choice
 * (lib/court-settings.ts saveCourtSkips).
 */
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { CourtSkips } from "@/lib/court-settings";

function Row({ id, label, hint, on, onChange }: { id: string; label: string; hint: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label htmlFor={id} className="text-sm font-semibold">{label}</Label>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <Switch id={id} checked={on} onCheckedChange={onChange} data-testid={id} />
    </div>
  );
}

export function SkipSettings({ skips, onChange }: { skips: CourtSkips; onChange: (skips: CourtSkips) => void }) {
  return (
    <div className="space-y-4">
      <Row id="skip-to-serve" label="Skip to next serve"
        hint="After a point, straight on to the next serve: the score shows for a moment, with no close-ups or replay. No walk-on before the match and no celebration after it."
        on={skips.skipToServe} onChange={(v) => onChange({ ...skips, skipToServe: v })} />
      <Row id="skip-replays" label="Skip replays"
        hint="Keep the reactions and close-ups between points, but no slow-motion replays."
        on={skips.skipReplays} onChange={(v) => onChange({ ...skips, skipReplays: v })} />
      <p className="text-xs text-muted-foreground">On the court, Enter (R3 on a pad) skips whatever is playing between points, whichever you choose here.</p>
    </div>
  );
}
