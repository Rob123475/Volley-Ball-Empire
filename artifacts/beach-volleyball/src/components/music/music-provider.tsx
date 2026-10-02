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
 * Unity brief item 9 (Rob, 29 Sep): the soundtrack does not play under the 3D
 * match. The court has its own crowd sound, so on /court the music fades out
 * over COURT_FADE_MS and stops; when the player leaves the court, the
 * soundtrack carries on with the next song at the normal volume. This replaced
 * a duck to a third of the volume.
 */
const COURT_FADE_MS = 1500;

/**
 * Rob, 2 Oct: the only songs that fade out, over their last FADE_OUT_SECONDS.
 * Every other song plays to its natural end, untouched.
 */
const FADE_OUT_FILES = new Set(["barefoot-tonight.mp3", "burn-under-the-sun.mp3", "rum-under-the-palms.mp3"]);
const FADE_OUT_SECONDS = 5;

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
 * The first pass through the playlist: the title track, then all the others in
 * a random order. Nothing repeats until every track has played.
 */
function firstQueue(): number[] {
  const rest = MUSIC_TRACKS.map((_, i) => i).filter((i) => i !== FIRST_TRACK_INDEX);
  return [FIRST_TRACK_INDEX, ...shuffled(rest)];
}

/**
 * Every later pass: every track shuffled again, never starting with the track that
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

  // ── Volume and mute ───────────────────────────────────────────────────────
  //
  // Mute uses the element's own flag rather than volume 0, so unmuting comes
  // back at exactly the level the player set. On /court the fade below owns
  // the volume instead.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = muted;
    if (!onCourt) audio.volume = volume;
  }, [volume, muted, onCourt]);

  // ── Three songs fade out over their last seconds (Rob, 2 Oct) ─────────────
  //
  // These three end on a hard cut in Rob's own files; only they are faded, in
  // the player, over their last FADE_OUT_SECONDS. The files are never touched,
  // and every other song plays to its end exactly as written (many are meant to
  // stop abruptly). The level is the slider's, times what is left of the fade,
  // so the slider and Mute keep working during it, and the next song (after the
  // end, or a skip mid-fade) starts at the slider's volume.
  useEffect(() => {
    const audio = audioRef.current;
    const track = trackIndex === null ? null : MUSIC_TRACKS[trackIndex];
    if (!audio || onCourt || !track || !FADE_OUT_FILES.has(track.file)) return undefined;
    // A timer, not animation frames: the fade must run with the window hidden too.
    const timer = window.setInterval(() => {
      const left = audio.duration - audio.currentTime;
      if (!Number.isFinite(left)) return;
      audio.volume = left < FADE_OUT_SECONDS ? volume * Math.max(0, left / FADE_OUT_SECONDS) : volume;
    }, 50);
    return () => {
      window.clearInterval(timer);
      if (!wasOnCourt.current) audio.volume = volume;
    };
  }, [trackIndex, volume, onCourt]);

  // ── The 3D match: fade out, then the next song after it (item 9) ──────────
  const wasOnCourt = useRef(onCourt);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const was = wasOnCourt.current;
    wasOnCourt.current = onCourt;

    if (onCourt && !was) {
      const from = audio.volume;
      const started = performance.now();
      let raf = 0;
      const step = () => {
        const t = Math.min(1, (performance.now() - started) / COURT_FADE_MS);
        audio.volume = from * (1 - t);
        if (t < 1) raf = requestAnimationFrame(step);
        else audio.pause();
      };
      raf = requestAnimationFrame(step);
      return () => cancelAnimationFrame(raf);
    }
    if (!onCourt && was) {
      audio.volume = volume;
      failuresRef.current = 0;
      advance();
    }
    return undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCourt]);

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
