/**
 * R-79 — one music player for the whole application.
 *
 * WHY IT LIVES HERE AND NOT IN A PAGE OR IN Shell
 * React unmounts a component when the route that renders it goes away, and an
 * unmounted <audio> stops. In App.tsx the routes are not all under one parent:
 * /login, /new-career, /career-end and /court render OUTSIDE Shell. Music put
 * in Shell would therefore cut out the moment the player opened the 3D Court,
 * and music put in a page would restart on every navigation. So the element is
 * created once, imperatively, by a provider mounted above the top <Switch> —
 * it is never re-created while the app is open, and no route change touches it.
 *
 * There is no <audio> in the JSX for the same reason: React owns the DOM it
 * renders, and a re-render of a JSX <audio> can reset its playback. The element
 * is made with document.createElement and kept in a ref.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "wouter";
import { MUSIC_TRACKS, musicTrackUrl, type MusicTrack } from "@/data/music-tracks";

// ── Tunables ────────────────────────────────────────────────────────────────

/** The title track. Always plays first; everything after it is shuffled. */
const FIRST_TRACK_INDEX = 0;

/** localStorage key. One key, one JSON object — see readSettings below. */
const STORAGE_KEY = "bve.music";

/** Brief: default 40%, not muted. */
const DEFAULT_VOLUME = 0.4;

/**
 * How loud the music is on /court, as a fraction of the player's own setting.
 * The Unity WebGL export has audio of its own — CrowdAmbience.wav,
 * CrowdCheer.wav and RefereeWhistle.wav, produced by its PlaceholderGenerator
 * and played through real AudioSources — so the brief asks for "about a third"
 * there.
 */
const COURT_DUCK = 1 / 3;

const COURT_PATH = "/court";

// ── Settings persistence ────────────────────────────────────────────────────

type MusicSettings = { volume: number; muted: boolean };

function clampVolume(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : DEFAULT_VOLUME;
  return Math.min(1, Math.max(0, n));
}

/**
 * Storage can be unavailable (a locked-down profile, a browser with site data
 * blocked) and throws rather than returning null when it is. Silent music is a
 * nuisance; a game that will not start because of a settings read is not, so
 * every access here is wrapped and falls back to the defaults.
 */
function readSettings(): MusicSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { volume: DEFAULT_VOLUME, muted: false };
    const parsed = JSON.parse(raw) as Partial<MusicSettings> | null;
    return {
      volume: clampVolume(parsed?.volume),
      muted: parsed?.muted === true,
    };
  } catch {
    return { volume: DEFAULT_VOLUME, muted: false };
  }
}

function writeSettings(settings: MusicSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* Settings simply do not persist this run. Not worth a message. */
  }
}

// ── Play order ──────────────────────────────────────────────────────────────

function shuffled(indexes: number[]): number[] {
  const out = indexes.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = out[i];
    out[i] = out[j];
    out[j] = swap;
  }
  return out;
}

/**
 * The first pass through the playlist: the title track, then the other nine in
 * a random order. Nothing repeats until all ten have played.
 */
function firstQueue(): number[] {
  const rest = MUSIC_TRACKS.map((_, i) => i).filter((i) => i !== FIRST_TRACK_INDEX);
  return [FIRST_TRACK_INDEX, ...shuffled(rest)];
}

/**
 * Every later pass: all ten shuffled again, never starting with the track that
 * just finished — otherwise a song can play twice in a row across the seam
 * between two passes, which sounds like a bug even though it is honest shuffle.
 */
function nextQueue(justPlayed: number): number[] {
  const all = MUSIC_TRACKS.map((_, i) => i);
  if (all.length < 2) return all;
  const q = shuffled(all);
  if (q[0] === justPlayed) {
    const swap = q[0];
    q[0] = q[1];
    q[1] = swap;
  }
  return q;
}

// ── Context ─────────────────────────────────────────────────────────────────

export type MusicState = {
  /** The track now loaded, or null before the first one starts. */
  track: MusicTrack | null;
  /** True while sound is actually coming out (not paused, not blocked). */
  playing: boolean;
  /** 0–1, the player's own setting, before any /court ducking. */
  volume: number;
  muted: boolean;
  /**
   * True when the browser refused to start audio and is waiting for a gesture.
   * The bar uses it to say so rather than looking broken.
   */
  blocked: boolean;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  skip: () => void;
};

const MusicContext = createContext<MusicState | null>(null);

/**
 * Controls for the music bar. Returns null outside the provider, so a component
 * that renders in both places (the profile picker is reachable directly at
 * /login) can simply render nothing rather than throwing.
 */
export function useMusic(): MusicState | null {
  return useContext(MusicContext);
}

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<number[]>(firstQueue());
  const positionRef = useRef(0);

  /**
   * Consecutive load failures. A missing or unreadable file skips to the next
   * track (brief item 7); if every file is missing that would spin through the
   * playlist forever, so the run gives up once it has tried them all.
   */
  const failuresRef = useRef(0);

  const initial = useRef<MusicSettings>(readSettings()).current;

  const [trackIndex, setTrackIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [volume, setVolumeState] = useState(initial.volume);
  const [muted, setMuted] = useState(initial.muted);

  const [location] = useLocation();
  const onCourt = location === COURT_PATH;

  // ── The element ───────────────────────────────────────────────────────────
  // Created once. Everything below reaches it through the ref.
  if (audioRef.current === null && typeof document !== "undefined") {
    const el = document.createElement("audio");
    el.preload = "auto";
    el.volume = initial.volume;
    el.muted = initial.muted;
    audioRef.current = el;
  }

  /** Point the element at a track and try to start it. */
  const load = useCallback((index: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const track = MUSIC_TRACKS[index];
    if (!track) return;
    setTrackIndex(index);
    audio.src = musicTrackUrl(track);
    const attempt = audio.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(() => {
        // Autoplay refused. Not an error the player should see — the first
        // gesture starts it (see the listener below).
        setPlaying(false);
        setBlocked(true);
      });
    }
  }, []);

  /** Advance one place in the queue, refilling it when it runs out. */
  const advance = useCallback(() => {
    const finished = queueRef.current[positionRef.current];
    positionRef.current += 1;
    if (positionRef.current >= queueRef.current.length) {
      queueRef.current = nextQueue(finished);
      positionRef.current = 0;
    }
    load(queueRef.current[positionRef.current]);
  }, [load]);

  const skip = useCallback(() => {
    failuresRef.current = 0;
    setBlocked(false);
    advance();
  }, [advance]);

  // ── Start the first track, and keep the queue moving ──────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => {
      failuresRef.current = 0;
      advance();
    };

    const onError = () => {
      const src = audio.currentSrc || audio.src;
      failuresRef.current += 1;
      if (failuresRef.current >= MUSIC_TRACKS.length) {
        // Every track has failed in a row — the whole folder is missing or
        // unreadable. Stop rather than loop. A warning, never a dialog.
        console.warn(
          `[music] no track could be loaded (last: ${src}) — music off for this session`,
        );
        setPlaying(false);
        return;
      }
      console.warn(`[music] could not load ${src} — skipping to the next track`);
      advance();
    };

    const onPlaying = () => {
      setPlaying(true);
      setBlocked(false);
      failuresRef.current = 0;
    };
    const onPause = () => setPlaying(false);

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);

    load(queueRef.current[positionRef.current]);

    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
      audio.pause();
      audio.src = "";
    };
  }, [advance, load]);

  // ── Autoplay fallback ─────────────────────────────────────────────────────
  //
  // The packaged game does not need this: electron/main.js sets
  // autoplayPolicy "no-user-gesture-required" and audio starts on its own. A
  // plain browser (vite dev, or anything opening the served bundle) still
  // blocks it, so the first real gesture retries once. Costs nothing when
  // autoplay was allowed, because `blocked` is never set in that case.
  useEffect(() => {
    if (!blocked) return;
    const audio = audioRef.current;
    if (!audio) return;
    const start = () => {
      const attempt = audio.play();
      if (attempt && typeof attempt.catch === "function") attempt.catch(() => {});
    };
    window.addEventListener("pointerdown", start, { once: true });
    window.addEventListener("keydown", start, { once: true });
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
    };
  }, [blocked]);

  // ── Volume, mute, and the /court duck ─────────────────────────────────────
  //
  // One effect owns the element's volume so the three inputs cannot fight over
  // it. Mute uses the element's own flag rather than volume 0, so unmuting
  // comes back at exactly the level the player set.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = muted;
    audio.volume = volume * (onCourt ? COURT_DUCK : 1);
  }, [volume, muted, onCourt]);

  const setVolume = useCallback((v: number) => {
    const next = clampVolume(v);
    setVolumeState(next);
    setMuted((wasMuted) => {
      // Dragging the slider up from zero is an unmute. Dragging it down to zero
      // is not a mute — the mute button is the control that remembers a level
      // to come back to.
      const nowMuted = wasMuted && next === 0;
      writeSettings({ volume: next, muted: nowMuted });
      return nowMuted;
    });
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((wasMuted) => {
      const next = !wasMuted;
      writeSettings({ volume, muted: next });
      return next;
    });
  }, [volume]);

  const value = useMemo<MusicState>(
    () => ({
      track: trackIndex === null ? null : MUSIC_TRACKS[trackIndex] ?? null,
      playing,
      volume,
      muted,
      blocked,
      setVolume,
      toggleMute,
      skip,
    }),
    [trackIndex, playing, volume, muted, blocked, setVolume, toggleMute, skip],
  );

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
}
