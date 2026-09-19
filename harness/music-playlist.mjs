/**
 * R-79 — the soundtrack: the playlist matches the files, and the player is
 * wired where it cannot be unmounted.
 *
 * The check that earns its place is the first one. `src/data/music-tracks.ts`
 * is a hand-written list of file names; the files are ordinary assets copied by
 * Vite and shipped by electron-builder. Nothing in TypeScript connects the two,
 * so a renamed, deleted or newly added mp3 compiles perfectly and turns into a
 * silent gap — or a track that never plays — at runtime. This asserts the list
 * against the directory in BOTH directions, and again against the built bundle
 * and the directory the server actually serves, so the failure lands on the
 * build rather than on a player.
 *
 * The rest is static: the provider mounted above the top <Switch> rather than
 * inside Shell (the whole point of R-79 — /court and /login render outside
 * Shell, so music there would stop), the storage key and defaults, the /court
 * duck, the skip-on-failure path, and Electron's autoplay policy.
 *
 * The on-screen and packaged checks are Rob's (RELEASE-STATUS).
 *
 * Usage: node harness/music-playlist.mjs
 */
import fs from "node:fs";
import path from "node:path";

const REPO = path.join(import.meta.dirname, "..");
let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log("  R-79 SOUNDTRACK PLAYLIST AND PLAYER");
console.log("=".repeat(72));

const APP = path.join(REPO, "artifacts/beach-volleyball");
const read = (rel) => fs.readFileSync(path.join(REPO, rel), "utf8");

const tracksSrc = read("artifacts/beach-volleyball/src/data/music-tracks.ts");
const provider = read("artifacts/beach-volleyball/src/components/music/music-provider.tsx");
const bar = read("artifacts/beach-volleyball/src/components/music/music-bar.tsx");
const app = read("artifacts/beach-volleyball/src/App.tsx");
const shell = read("artifacts/beach-volleyball/src/components/layout/shell.tsx");
const picker = read("artifacts/beach-volleyball/src/pages/profile-picker.tsx");
const main = read("electron/main.js");

/** Source with comments removed, for checks that must not match prose. */
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// ── 1. The list matches the files ───────────────────────────────────────────

// Parsed rather than imported: this is a .ts file and the harness is plain node.
const listed = [...tracksSrc.matchAll(/\{\s*file:\s*"([^"]+)",\s*title:\s*"([^"]+)"\s*\}/g)]
  .map(([, file, title]) => ({ file, title }));

const MUSIC_REL = "public/audio/music";
const musicDir = path.join(APP, MUSIC_REL);
const onDisk = fs.existsSync(musicDir)
  ? fs.readdirSync(musicDir).filter((f) => f.toLowerCase().endsWith(".mp3")).sort()
  : [];

check("the playlist has tracks in it", listed.length > 0, `${listed.length} listed`);
check("the music folder has files in it", onDisk.length > 0, `${onDisk.length} on disk`);

const missing = listed.filter((t) => !onDisk.includes(t.file)).map((t) => t.file);
check("every track in the playlist has a file on disk", missing.length === 0,
  missing.length ? `missing: ${missing.join(", ")}` : `${listed.length} files`);

const listedFiles = new Set(listed.map((t) => t.file));
const orphans = onDisk.filter((f) => !listedFiles.has(f));
check("every file on disk is in the playlist", orphans.length === 0,
  orphans.length ? `not listed: ${orphans.join(", ")}` : "no orphans");

const empties = listed
  .filter((t) => onDisk.includes(t.file))
  .filter((t) => fs.statSync(path.join(musicDir, t.file)).size === 0)
  .map((t) => t.file);
check("no track is a zero-byte file", empties.length === 0,
  empties.length ? empties.join(", ") : "all non-empty");

const dupFiles = listed.map((t) => t.file).filter((f, i, a) => a.indexOf(f) !== i);
const dupTitles = listed.map((t) => t.title).filter((f, i, a) => a.indexOf(f) !== i);
check("no track is listed twice", dupFiles.length === 0 && dupTitles.length === 0,
  [...dupFiles, ...dupTitles].join(", "));

check("every track has a title", listed.every((t) => t.title.trim().length > 0));

check("the title track is first and is the one the game is named after",
  listed[0]?.file === "beach-volleyball-empire.mp3" && /FIRST_TRACK_INDEX = 0/.test(provider),
  listed[0]?.title ?? "(none)");

// ── 2. The files reach the build and the served directory ───────────────────

for (const [label, dir] of [
  ["the frontend build output", path.join(APP, "dist/public/audio/music")],
  ["the directory the server serves", path.join(REPO, "artifacts/api-server/dist/public/audio/music")],
]) {
  if (!fs.existsSync(dir)) {
    check(`${label} carries all ${listed.length} tracks`, false,
      `${path.relative(REPO, dir).split(path.sep).join("/")} not built — run the build first`);
    continue;
  }
  const built = fs.readdirSync(dir);
  const gone = listed.filter((t) => !built.includes(t.file)).map((t) => t.file);
  check(`${label} carries all ${listed.length} tracks`, gone.length === 0,
    gone.length ? `missing: ${gone.join(", ")}` : `${built.length} files`);
}

// ── 3. One player, above the routes ─────────────────────────────────────────

check("the provider is mounted inside WouterRouter and wraps the whole Router",
  /<MusicProvider>\s*<Router \/>\s*<\/MusicProvider>/.test(app));

check("nothing renders the provider inside Shell or a page",
  !/MusicProvider/.test(shell) && !/MusicProvider/.test(picker));

check("the audio element is created once, not rendered as JSX",
  /document\.createElement\("audio"\)/.test(provider) && !/<audio[\s/>]/.test(stripComments(provider)));

// ── 4. Playlist behaviour ───────────────────────────────────────────────────

check("the first pass is the title track then the rest shuffled",
  /function firstQueue\(\)/.test(provider)
  && /\[FIRST_TRACK_INDEX, \.\.\.shuffled\(rest\)\]/.test(provider));

check("a later pass reshuffles all ten and never repeats across the seam",
  /function nextQueue\(justPlayed: number\)/.test(provider) && /q\[0\] === justPlayed/.test(provider));

check("the next track starts on its own when one ends",
  /addEventListener\("ended", onEnded\)/.test(provider) && /const onEnded = \(\) => \{[\s\S]*?advance\(\);/.test(provider));

check("a track that will not load is skipped with a warning, never a dialog",
  /addEventListener\("error", onError\)/.test(provider)
  && /console\.warn\(`\[music\] could not load/.test(provider)
  && !/alert\(|toast\(/.test(provider));

check("a whole folder of failures stops instead of looping forever",
  /failuresRef\.current >= MUSIC_TRACKS\.length/.test(provider));

// ── 5. Controls, persistence, ducking, autoplay ─────────────────────────────

check("the bar has skip, mute and a volume slider",
  /data-testid="button-music-skip"/.test(bar)
  && /data-testid="button-music-mute"/.test(bar)
  && /data-testid="slider-music-volume"/.test(bar)
  && /from "@\/components\/ui\/slider"/.test(bar));

check("the bar shows the song now playing", /data-testid="music-title"/.test(bar));

check("the bar is in the sidebar (desktop rail and mobile sheet) and on the title screen",
  /<MusicBar variant="sidebar" \/>/.test(shell) && /<MusicBar variant="dark" \/>/.test(picker));

check("volume and mute are saved under one key and restored on launch",
  /STORAGE_KEY = "bve\.music"/.test(provider)
  && /localStorage\.getItem\(STORAGE_KEY\)/.test(provider)
  && /localStorage\.setItem\(STORAGE_KEY/.test(provider));

check("every storage access is wrapped so blocked storage cannot break the game",
  (provider.match(/try \{[\s\S]*?localStorage[\s\S]*?\} catch/g) ?? []).length === 2);

check("the defaults are 40% and not muted",
  /DEFAULT_VOLUME = 0\.4/.test(provider) && /muted: false/.test(provider));

check("the music ducks to about a third on /court and is restored on leaving",
  /COURT_DUCK = 1 \/ 3/.test(provider)
  && /COURT_PATH = "\/court"/.test(provider)
  && /audio\.volume = volume \* \(onCourt \? COURT_DUCK : 1\)/.test(provider));

check("Electron lifts Chromium's autoplay block so the music starts on its own",
  /autoplayPolicy: "no-user-gesture-required"/.test(main));

check("a plain browser still gets a first-gesture retry",
  /addEventListener\("pointerdown", start/.test(provider));

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
process.exit(failures > 0 ? 1 : 0);
