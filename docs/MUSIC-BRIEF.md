# Brief for Claude Code — R-79 in-game soundtrack with volume, mute and skip (16 Sep)

Repo: `C:\Users\rbonn\Documents\Volley-Ball-Empire` (branch main). Rob approves each step.

## Rules of engagement
- One step at a time. Show proof for each step (command output, file listing, screenshot).
- No guessing. If something below doesn't match what you find in the code, STOP and tell Rob.
- Do not touch the live save. Harness must stay green.
- Register this as **R-79** in `docs/REPAIR-REGISTER.md` before you start, and commit per step.

## What already exists (put there by the Cowork session, not yet committed)
Ten Suno tracks by Rob, in `artifacts/beach-volleyball/public/audio/music/`:

| File | Title | Length |
|---|---|---|
| beach-volleyball-empire.mp3 | Beach Volleyball Empire (title track) | 2:24 |
| built-for-this.mp3 | Built for This | 2:25 |
| champions.mp3 | Champions | 1:06 |
| championship-heat.mp3 | Championship Heat | 2:00 |
| endless-summer.mp3 | Endless Summer | 2:26 |
| golden-coast-break.mp3 | Golden Coast Break | 1:33 |
| rum-under-the-palms.mp3 | Rum Under the Palms | 2:00 |
| summer-by-the-sea.mp3 | Summer by the Sea | 3:10 |
| teeth-of-foam.mp3 | Teeth of Foam | 4:25 |
| volleyball-and-reggae.mp3 | Volleyball and Reggae | 2:52 |

About 32 MB in total, largest 5.5 MB, so plain git is fine (no LFS rule needed; `.gitattributes` only covers the Unity `.data` and `*.wasm`). Step 1 is to commit these.

Vite copies `public/` into `dist/public`, and `package.json` → `build.extraResources` already ships `artifacts/beach-volleyball/dist/public` as `public`, so the files should reach the installed game with no packaging change. **Prove it** in Step 5, don't assume it.

## What Rob wants
Background music that plays through the game, with three controls: **volume**, **mute** and **skip** (next track).

## Build it like this
1. **One player for the whole app.** The music must not restart or stop when the player changes page. In `src/App.tsx` the routes are: `/login`, `/new-career`, `/career-end`, `/court` (outside `Shell`) and everything else inside `AuthGuard` → `Shell`. So the audio can't live inside `Shell` or a page. Put one `HTMLAudioElement` in a small provider (e.g. `src/components/music/music-provider.tsx`) mounted **above** the top `<Switch>` in `App.tsx`, with a hook (`useMusic`) for the controls.
2. **Playlist.** The ten files above, as a plain list in `src/data/music-tracks.ts` (file + title). The title track plays first; after that, shuffle without repeating a song until all ten have played. When a song ends, the next one starts on its own.
3. **Controls.** A compact music bar: a skip button, a mute toggle, a volume slider (use the existing `components/ui/slider.tsx`), and the current song title. Put it where it is visible on every page inside `Shell` (the sidebar in `components/layout/shell.tsx` is the obvious place — check it fits on the `lg:` sidebar and the mobile layout) **and** on the title screen / profile picker. If placing it somewhere else is cleaner, say why before doing it.
4. **Remember the settings.** Volume and mute are saved in `localStorage` (one key, e.g. `bve.music`) and restored on launch. Default volume 40%, not muted. Wrap the reads and writes in try/catch so a blocked storage never breaks the game.
5. **Autoplay.** Chromium blocks audio until the user clicks. Pick one fix and prove it: either set `webPreferences.autoplayPolicy: 'no-user-gesture-required'` in `electron/main.js`, or start the music on the first click. Tell Rob which one you chose.
6. **The 3D Court (`/court`).** Check whether the Unity WebGL export plays any sound of its own. Report what you find. If it does, lower the music to about a third while on `/court` and restore it on leaving. If it doesn't, leave the music playing as normal.
7. **Missing file.** If a track fails to load, skip to the next one and log a warning. Never an error dialog.

## Proof required
- Harness green (`node harness/run-all.mjs`); add a small suite if a sensible one fits (e.g. the playlist file list matches the files on disk).
- Rob checks on screen, launched with `pnpm run electron:dev` in his own cmd window: music starts, keeps playing across Dashboard → Team → Finances without restarting, skip moves to the next title, mute silences it, volume slider works, settings survive a restart.
- Packaged proof: build the installer, install it, and confirm the ten mp3s are present under the install folder's `resources\public\audio\music\` and play in the installed game.

## Before the build goes to Steam
Rob to confirm which Suno plan the songs were made on. Only songs downloaded while on a paid plan (Pro/Premier) can be used commercially. Steam's AI content disclosure already says generative AI was used; it should also mention the music once this ships. That's a website change for Rob, not code.

Update `docs/RELEASE-STATUS.md`, commit, and stop.
