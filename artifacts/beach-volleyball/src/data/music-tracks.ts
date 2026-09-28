/**
 * R-79 — the in-game soundtrack.
 *
 * Eighteen tracks written by Rob in Suno (the 28 Sep set, which replaced the
 * first ten) and shipped as ordinary files under
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
  { file: "balls-out.mp3",               title: "Balls Out"               },
  { file: "barefoot-tonight.mp3",        title: "Barefoot Tonight"        },
  { file: "bobby-farquhar.mp3",          title: "Bobby Farquhar"          },
  { file: "built-for-this.mp3",          title: "Built for This"          },
  { file: "burn-under-the-sun.mp3",      title: "Burn Under the Sun"      },
  { file: "champions.mp3",               title: "Champions"               },
  { file: "championship-heat.mp3",       title: "Championship Heat"       },
  { file: "give-me-one-more-summer.mp3", title: "Give Me One More Summer" },
  { file: "golden-coast-break.mp3",      title: "Golden Coast Break"      },
  { file: "no-name-beach.mp3",           title: "No Name Beach"           },
  { file: "pineapple-morning.mp3",       title: "Pineapple Morning"       },
  { file: "queen-of-the-sand.mp3",       title: "Queen of the Sand"       },
  { file: "rum-under-the-palms.mp3",     title: "Rum Under the Palms"     },
  { file: "second-place-sucks.mp3",      title: "Second Place Sucks"      },
  { file: "sun-rum-ganja.mp3",           title: "Sun, Rum & Ganja"        },
  { file: "under-the-lights.mp3",        title: "Under the Lights"        },
  { file: "we-own-the-summer-sky.mp3",   title: "We Own the Summer Sky"   },
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
