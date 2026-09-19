/**
 * R-79 — the music controls: skip, mute, volume, and the song now playing.
 *
 * Two skins of one component, because it appears in two places that look
 * nothing alike:
 *  - "sidebar" sits in the Shell sidebar footer, above the manager and Logout,
 *    and inherits the sidebar palette. It renders in the desktop rail and in
 *    the mobile sheet, because both render the same NavContent.
 *  - "dark" sits on the profile picker, which is its own dark title screen with
 *    white-on-transparent styling rather than theme tokens.
 *
 * It renders nothing at all outside MusicProvider, so it is safe to drop into
 * any screen.
 */
import { SkipForward, Volume2, VolumeX, Music2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { useMusic } from "@/components/music/music-provider";

type Variant = "sidebar" | "dark";

const SKIN = {
  sidebar: {
    wrap: "border-t border-sidebar-border/60",
    title: "text-sidebar-foreground/70",
    icon: "text-sidebar-primary",
    button:
      "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40",
    slider: "",
  },
  dark: {
    wrap: "border-t border-white/10",
    title: "text-white/60",
    icon: "text-secondary",
    button: "text-white/40 hover:text-white hover:bg-white/10",
    slider: "[&_[data-orientation]]:bg-white/15",
  },
} satisfies Record<Variant, Record<string, string>>;

export function MusicBar({
  variant = "sidebar",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const music = useMusic();
  if (!music) return null;

  const skin = SKIN[variant];
  const { track, muted, volume, blocked, setVolume, toggleMute, skip } = music;

  // What the line of text says. `blocked` only happens in a browser, where
  // audio waits for the first click; the packaged game sets Chromium's
  // autoplay policy and starts on its own.
  const label = blocked
    ? "Click anywhere to start the music"
    : track
      ? track.title
      : "Loading music…";

  return (
    <div
      className={cn("px-2 pt-2 pb-1 space-y-1.5", skin.wrap, className)}
      data-testid="music-bar"
    >
      {/* Now playing */}
      <div className="flex items-center gap-2 px-1 min-w-0">
        <Music2 className={cn("h-3.5 w-3.5 shrink-0", skin.icon)} />
        <span
          className={cn("text-[11px] font-medium truncate", skin.title)}
          title={label}
          data-testid="music-title"
        >
          {label}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggleMute}
          title={muted ? "Unmute music" : "Mute music"}
          aria-label={muted ? "Unmute music" : "Mute music"}
          aria-pressed={muted}
          data-testid="button-music-mute"
          className={cn(
            "shrink-0 rounded-md p-1.5 transition-colors",
            skin.button,
          )}
        >
          {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </button>

        <Slider
          value={[muted ? 0 : Math.round(volume * 100)]}
          onValueChange={([v]) => setVolume((v ?? 0) / 100)}
          min={0}
          max={100}
          step={1}
          aria-label="Music volume"
          data-testid="slider-music-volume"
          className={cn("flex-1 min-w-0", skin.slider)}
        />

        <button
          type="button"
          onClick={skip}
          title="Next track"
          aria-label="Next track"
          data-testid="button-music-skip"
          className={cn(
            "shrink-0 rounded-md p-1.5 transition-colors",
            skin.button,
          )}
        >
          <SkipForward className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
