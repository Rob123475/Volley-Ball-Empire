/**
 * 1.2 D5: Settings > Match presentation: the player's own banner. The crowd holds up ten
 * banners of its own; this is the eleventh, in the player's words (up to BANNER_MAX letters),
 * shown on the court from the next match. Empty: none.
 */
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BANNER_MAX, readCourtBanner, saveCourtBanner, readCourtGuests, saveCourtGuests } from "@/lib/court-settings";

export function BannerSetting() {
  const [text, setText] = useState(readCourtBanner);
  return (
    <div className="space-y-1">
      <Label htmlFor="crowd-banner" className="text-sm font-semibold">Your banner in the crowd</Label>
      <div className="text-xs text-muted-foreground">A fan holds it up with the crowd's own ten. Up to {BANNER_MAX} letters; leave it empty for none.</div>
      <Input id="crowd-banner" data-testid="crowd-banner" value={text} maxLength={BANNER_MAX} placeholder="e.g. WE LOVE THE RIPTIDE"
        onChange={(e) => { setText(e.target.value); saveCourtBanner(e.target.value); }} className="uppercase" />
    </div>
  );
}

/** 1.2 section 5: Settings > Match presentation: a celebrity guest in the commentary booth for career matches. */
export function GuestsSetting() {
  const [on, setOn] = useState(readCourtGuests);
  return (
    <label className="flex items-start gap-3">
      <input type="checkbox" data-testid="guest-commentators" checked={on} className="mt-1 h-4 w-4"
        onChange={(e) => { setOn(e.target.checked); saveCourtGuests(e.target.checked); }} />
      <span>
        <span className="block text-sm font-semibold">Guest commentators</span>
        <span className="block text-xs text-muted-foreground">A celebrity guest joins Kailey and Hukum in the booth for each career match (Roxy Calderwood or Kai Brennock). Off: the two of them alone.</span>
      </span>
    </label>
  );
}
