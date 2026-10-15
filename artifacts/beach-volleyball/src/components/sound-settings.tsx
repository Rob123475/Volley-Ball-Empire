/**
 * Settings > Sound (Rob, 16 Oct): the master volume over everything, then the
 * music (its mute and volume, the music bar's own), the crowd and the
 * commentary. The same panel is on the Settings page and in the 3D court's
 * settings (pages/court.tsx), where a change applies at once without leaving
 * the match. Stored in lib/court-settings.ts; the music's mute mutes only the songs.
 */
import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMusic } from "@/components/music/music-provider";
import { readMatchVolume, saveMatchVolume, MATCH_VOLUME_EVENT, type MatchVolume } from "@/lib/court-settings";

const COURT_ROWS = [
  ["crowd", "Crowd volume", "The crowd, its cheers and the buzzer."],
  ["commentary", "Commentary volume", "The two commentators."],
] as const;

const pct = (v: number) => Math.round(v * 100);

export function SoundSettings({ onCourt = false }: { onCourt?: boolean }) {
  const music = useMusic();
  const [matchVolume, setMatchVolume] = useState<MatchVolume>(readMatchVolume);
  // Saved anywhere (this panel, another copy of it): read back, so every copy shows the same.
  useEffect(() => {
    const read = () => setMatchVolume(readMatchVolume());
    window.addEventListener(MATCH_VOLUME_EVENT, read);
    return () => window.removeEventListener(MATCH_VOLUME_EVENT, read);
  }, []);
  const setMatch = (patch: Partial<MatchVolume>) => {
    const next = { ...matchVolume, ...patch };
    setMatchVolume(next);
    saveMatchVolume(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold w-40">Master volume {pct(matchVolume.master)}%</span>
        <input type="range" min={0} max={100} step={5} value={pct(matchVolume.master)}
          onChange={(e) => setMatch({ master: Number(e.target.value) / 100 })} className="w-full max-w-xs"
          aria-label="Master volume" data-testid="sound-master-volume" />
        <span className="text-xs text-muted-foreground">Everything: the music, the crowd and the commentary.</span>
      </div>
      {music ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="outline" onClick={music.toggleMute} className="gap-1" data-testid="sound-mute">
            {music.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />} {music.muted ? "Unmute" : "Mute"}
          </Button>
          <span className="text-sm">Music volume {pct(music.volume)}%</span>
          <input type="range" min={0} max={100} step={5} value={pct(music.volume)}
            onChange={(e) => music.setVolume(Number(e.target.value) / 100)} className="w-full max-w-xs"
            aria-label="Music volume" data-testid="sound-volume" />
          <span className="text-xs text-muted-foreground">
            {onCourt ? "The songs stop during a match and come back after it. Mute mutes only the songs." : "Mute mutes only the songs."}
          </span>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">The music isn't playing here.</p>
      )}
      {COURT_ROWS.map(([key, label, about]) => (
        <div key={key} className="flex flex-wrap items-center gap-3">
          <span className="text-sm w-40">{label} {pct(matchVolume[key])}%</span>
          <input type="range" min={0} max={100} step={5} value={pct(matchVolume[key])}
            onChange={(e) => setMatch({ [key]: Number(e.target.value) / 100 })} className="w-full max-w-xs"
            aria-label={label} data-testid={`sound-${key}-volume`} />
          <span className="text-xs text-muted-foreground">{about}</span>
        </div>
      ))}
    </div>
  );
}
