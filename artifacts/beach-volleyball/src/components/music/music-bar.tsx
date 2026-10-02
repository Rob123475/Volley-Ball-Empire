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
import { useEffect, useRef, useState } from "react";
import { SkipForward, Volume2, VolumeX, Music2, Play, Pause, ListMusic } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { useMusic } from "@/components/music/music-provider";

type Variant = "sidebar" | "dark";

/**
 * The volume slider has to be re-coloured per skin, not left as ui/slider.tsx
 * ships it. That slider paints its track `bg-primary/20` and its filled range
 * `bg-primary` — and in this theme `--primary` and `--sidebar` are the SAME
 * value (200 100% 36%), so in the sidebar the filled part of the bar is
 * painted in the sidebar's own background colour and the volume level is
 * invisible. Both skins therefore set the track, the range and the thumb
 * explicitly. The selectors follow Radix's structure: Root > Track > Range,
 * with the thumb the element carrying role="slider".
 */
const SLIDER_PARTS = {
  sidebar: [
    "[&>span:first-child]:bg-sidebar-foreground/25",
    "[&>span:first-child>span]:bg-sidebar-primary",
    "[&_[role=slider]]:bg-sidebar-foreground",
    "[&_[role=slider]]:border-sidebar-primary",
  ].join(" "),
  dark: [
    "[&>span:first-child]:bg-white/15",
    "[&>span:first-child>span]:bg-secondary",
    "[&_[role=slider]]:bg-white",
    "[&_[role=slider]]:border-secondary",
  ].join(" "),
};

const SKIN = {
  sidebar: {
    wrap: "border-t border-sidebar-border/60",
    title: "text-sidebar-foreground/70",
    icon: "text-sidebar-primary",
    button:
      "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40",
    slider: SLIDER_PARTS.sidebar,
  },
  dark: {
    wrap: "border-t border-white/10",
    title: "text-white/60",
    icon: "text-secondary",
    button: "text-white/40 hover:text-white hover:bg-white/10",
    slider: SLIDER_PARTS.dark,
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
  // Rob, 2 Oct: the song list, opened from the title (or the list icon).
  const [listOpen, setListOpen] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!listOpen) return;
    const close = (e: MouseEvent) => { if (listRef.current && !listRef.current.contains(e.target as Node)) setListOpen(false); };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [listOpen]);
  if (!music) return null;

  const skin = SKIN[variant];
  const { track, muted, volume, blocked, setVolume, toggleMute, skip, paused, togglePause, tracks, playTrack, trackIndex } = music;

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
      {/* Now playing: the title opens the song list */}
      <div className="relative" ref={listRef}>
        <button
          type="button"
          onClick={() => setListOpen((o) => !o)}
          className="flex w-full items-center gap-2 px-1 min-w-0 text-left"
          aria-haspopup="listbox"
          aria-expanded={listOpen}
          title="Choose a song"
          data-testid="button-music-list"
        >
          <Music2 className={cn("h-3.5 w-3.5 shrink-0", skin.icon)} />
          <span className={cn("text-[11px] font-medium truncate flex-1", skin.title)} title={label} data-testid="music-title">
            {label}
          </span>
          <ListMusic className={cn("h-3.5 w-3.5 shrink-0", skin.title)} />
        </button>
        {listOpen && (
          <ul
            role="listbox"
            aria-label="Songs"
            data-testid="music-song-list"
            className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-72 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg"
          >
            {tracks.map((t, i) => (
              <li key={t.file}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === trackIndex}
                  onClick={() => { playTrack(i); setListOpen(false); }}
                  data-testid={`music-song-${i}`}
                  className={cn(
                    "w-full rounded px-2 py-1 text-left text-xs hover:bg-accent hover:text-accent-foreground",
                    i === trackIndex && "bg-primary/15 font-semibold text-primary",
                  )}
                >
                  {t.title}
                </button>
              </li>
            ))}
          </ul>
        )}
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

        <button
          type="button"
          onClick={togglePause}
          title={paused ? "Play music" : "Pause music"}
          aria-label={paused ? "Play music" : "Pause music"}
          aria-pressed={paused}
          data-testid="button-music-pause"
          className={cn("shrink-0 rounded-md p-1.5 transition-colors", skin.button)}
        >
          {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
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
