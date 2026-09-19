/**
 * R-79 — the in-game soundtrack.
 *
 * Ten tracks written by Rob in Suno and shipped as ordinary files under
 * `public/audio/music/`. Vite copies `public/` into `dist/public`, and
 * package.json's `build.extraResources` ships that directory as `public`, so
 * these reach an installed game without a packaging change.
 *
 * This list is the single source of truth for what plays. `harness/music-
 * playlist.mjs` asserts it against the directory on disk in both directions —
 * a track listed here with no file, or a file with no entry here, fails the
 * build rather than turning into a silent gap at runtime.
 *
 * The title track is first deliberately: music-provider plays index 0 before
 * it shuffles anything (see FIRST_TRACK_INDEX there).
 */
export type MusicTrack = {
  /** File name inside `public/audio/music/`. */
  file: string;
  /** Shown in the music bar while it plays. */
  title: string;
};

export const MUSIC_TRACKS: MusicTrack[] = [
  { file: "beach-volleyball-empire.mp3", title: "Beach Volleyball Empire" },
  { file: "built-for-this.mp3",          title: "Built for This"          },
  { file: "champions.mp3",               title: "Champions"               },
  { file: "championship-heat.mp3",       title: "Championship Heat"       },
  { file: "endless-summer.mp3",          title: "Endless Summer"          },
  { file: "golden-coast-break.mp3",      title: "Golden Coast Break"      },
  { file: "rum-under-the-palms.mp3",     title: "Rum Under the Palms"     },
  { file: "summer-by-the-sea.mp3",       title: "Summer by the Sea"       },
  { file: "teeth-of-foam.mp3",           title: "Teeth of Foam"           },
  { file: "volleyball-and-reggae.mp3",   title: "Volleyball and Reggae"   },
];

/** Path under `public/`, relative — the harness resolves files from it too. */
export const MUSIC_DIR = "audio/music";

/**
 * The served URL for a track. BASE_URL carries the build's base path (it is "/"
 * in the packaged app and always ends in a slash), the same way pages/court.tsx
 * reaches the Unity build.
 */
export function musicTrackUrl(track: MusicTrack): string {
  return `${import.meta.env.BASE_URL}${MUSIC_DIR}/${track.file}`;
}
