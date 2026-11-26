/**
 * Update 1, overnight brief part 8 (Rob, 14 Oct, item 8): the court's
 * settings, remembered on this PC (localStorage), and the controls it uses.
 *
 * Auto or Manual (Final brief 5 Oct, Part C): who plays your side on the 3D
 * court. Auto (the AI) is the default; Manual is a choice. It is chosen on the
 * Settings page now (the match screen's button is gone), under the same stored
 * key as before, and goes to the court in its URL when the court opens. The
 * court can still switch it during a match (Tab / View / Share) and tells the
 * court page, which stores it here.
 */
export type ControlMode = "auto" | "manual";
export const CONTROL_MODE_KEY = "vbe-court-control-mode";

export function readControlMode(): ControlMode {
  try { return localStorage.getItem(CONTROL_MODE_KEY) === "manual" ? "manual" : "auto"; } catch { return "auto"; }
}

export function saveControlMode(mode: ControlMode): void {
  try { localStorage.setItem(CONTROL_MODE_KEY, mode); } catch { /* not remembered, still used */ }
}

/**
 * Update 1, 15 Oct (O-5): the court's match sound, two volumes from 0 to 1:
 * the crowd (its murmur, reactions and the buzzer) and the commentary. Chosen
 * on the Settings page and remembered like the music's volume (one JSON object
 * in localStorage); the court page sends them to the court when it has loaded
 * and whenever they change (court.tsx, through the court's own page,
 * unity-build/index.html, to MatchManager.SetCrowdVolume / SetCommentaryVolume).
 *
 * Rob, 16 Oct: a master volume over everything, kept in the same object. It is
 * applied on the page side: the court is sent crowd x master and commentary x
 * master (courtVolumes), and the music plays at its own volume x master
 * (components/music/music-provider.tsx). The music's mute mutes only the songs.
 */
export type MatchVolume = { master: number; crowd: number; commentary: number };
export const MATCH_VOLUME_KEY = "vbe-court-volume";
/** Fired on this window when the volumes are saved (localStorage's own event only reaches other windows). */
export const MATCH_VOLUME_EVENT = "vbe-court-volume-changed";

const clamp01 = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;

export function readMatchVolume(): MatchVolume {
  try {
    const parsed = JSON.parse(localStorage.getItem(MATCH_VOLUME_KEY) ?? "null") as Partial<MatchVolume> | null;
    return { master: clamp01(parsed?.master, 1), crowd: clamp01(parsed?.crowd, 1), commentary: clamp01(parsed?.commentary, 1) };
  } catch {
    return { master: 1, crowd: 1, commentary: 1 };
  }
}

/** What the court plays at: its two volumes, each times the master. */
export function courtVolumes(volume: MatchVolume = readMatchVolume()): { crowd: number; commentary: number } {
  return { crowd: volume.crowd * volume.master, commentary: volume.commentary * volume.master };
}

export function saveMatchVolume(volume: MatchVolume): void {
  try { localStorage.setItem(MATCH_VOLUME_KEY, JSON.stringify(volume)); } catch { /* not remembered, still used */ }
  window.dispatchEvent(new Event(MATCH_VOLUME_EVENT));
}

/**
 * 1.2 B1 (Rob, 23 Nov): the court's two camera looks, chosen at any time in
 * the match and in Settings, and remembered here, one for each kind of match:
 *   - TV: the roaming director (always moving; replays and reactions);
 *   - Game: six fixed views of the court (1 behind your baseline ... 6 low
 *     courtside), the one remembered with it.
 * Defaults (the brief): a played match (Manual) opens on Game, behind your own
 * baseline; a watched match (Auto) on TV. The court page sends both to the court
 * when it has loaded and whenever they change (unity-build/index.html,
 * CourtCamera.SetCameraPrefs); a change made on the court (keys 1-6, V, the pad)
 * comes back as "unity-camera:played:game:3" and is stored here.
 */
export type CameraLook = "tv" | "game";
export type CameraChoice = { look: CameraLook; view: number };
export type CourtCamera = { played: CameraChoice; watched: CameraChoice };
export const COURT_CAMERA_KEY = "vbe-court-camera";
export const COURT_CAMERA_DEFAULTS: CourtCamera = { played: { look: "game", view: 1 }, watched: { look: "tv", view: 1 } };
/** The six Game views, as the court numbers them (CourtCamera.ViewNames). */
export const CAMERA_VIEWS = ["Behind your baseline", "Behind the far baseline", "Side-on at the net", "High sideline", "Overhead", "Low courtside"] as const;

function cameraChoice(v: unknown, fallback: CameraChoice): CameraChoice {
  const c = v as Partial<CameraChoice> | null | undefined;
  const look: CameraLook = c?.look === "tv" || c?.look === "game" ? c.look : fallback.look;
  const view = typeof c?.view === "number" && Number.isInteger(c.view) && c.view >= 1 && c.view <= 6 ? c.view : fallback.view;
  return { look, view };
}

export function readCourtCamera(): CourtCamera {
  try {
    const parsed = JSON.parse(localStorage.getItem(COURT_CAMERA_KEY) ?? "null") as Partial<CourtCamera> | null;
    return { played: cameraChoice(parsed?.played, COURT_CAMERA_DEFAULTS.played), watched: cameraChoice(parsed?.watched, COURT_CAMERA_DEFAULTS.watched) };
  } catch {
    return { ...COURT_CAMERA_DEFAULTS };
  }
}

export function saveCourtCamera(camera: CourtCamera): void {
  try { localStorage.setItem(COURT_CAMERA_KEY, JSON.stringify(camera)); } catch { /* not remembered, still used */ }
}

/** What the court is sent: "played=game:1;watched=tv:1". */
export function cameraPrefs(camera: CourtCamera = readCourtCamera()): string {
  const one = (c: CameraChoice) => `${c.look}:${c.view}`;
  return `played=${one(camera.played)};watched=${one(camera.watched)}`;
}

/** A change made on the court ("unity-camera:played:game:3"), stored; null if the message is not one. */
export function cameraFromCourt(message: string, camera: CourtCamera = readCourtCamera()): CourtCamera | null {
  const m = /^unity-camera:(played|watched):(tv|game):([1-6])$/.exec(message);
  if (!m) return null;
  const next: CourtCamera = { ...camera, [m[1]]: { look: m[2] as CameraLook, view: Number(m[3]) } };
  saveCourtCamera(next);
  return next;
}

/**
 * 1.2 B5 (Rob, 23 Nov): so a long career is never slowed down, two switches, in
 * Settings and in the court's own settings, remembered here:
 *   - skipToServe: straight on to the next serve after a point (the score shows
 *     briefly; no close-ups, no replay), and no walk-on or winners' celebration;
 *   - skipReplays: the between-points sequence plays, without its replays.
 * Both off by default (the full presentation). Sent to the court when it has
 * loaded and whenever they change (unity-build/index.html, PointPresenter.SetSkips).
 * Enter (R3 on a pad) still skips the one that is playing.
 */
export type CourtSkips = { skipToServe: boolean; skipReplays: boolean };
export const COURT_SKIPS_KEY = "vbe-court-skips";
export const COURT_SKIPS_DEFAULTS: CourtSkips = { skipToServe: false, skipReplays: false };

export function readCourtSkips(): CourtSkips {
  try {
    const parsed = JSON.parse(localStorage.getItem(COURT_SKIPS_KEY) ?? "null") as Partial<CourtSkips> | null;
    return { skipToServe: parsed?.skipToServe === true, skipReplays: parsed?.skipReplays === true };
  } catch {
    return { ...COURT_SKIPS_DEFAULTS };
  }
}

export function saveCourtSkips(skips: CourtSkips): void {
  try { localStorage.setItem(COURT_SKIPS_KEY, JSON.stringify(skips)); } catch { /* not remembered, still used */ }
}

/** What the court is sent: "serve=1;replays=0". */
export function skipsPrefs(skips: CourtSkips = readCourtSkips()): string {
  return `serve=${skips.skipToServe ? 1 : 0};replays=${skips.skipReplays ? 1 : 0}`;
}

/**
 * The 3D court's controls in Manual, as the court itself binds them (Unity
 * ManualControl.cs, Input System; proved key by key and button by button on 5
 * Oct, docs/STATUS-05OCT.md item C, and listed for Rob's check on 6 Oct). In
 * Auto the AI plays your pair and only the camera and boost keys apply.
 */
export const COURT_CONTROLS: ReadonlyArray<{ action: string; keyboard: string; xbox: string; playstation: string }> = [
  { action: "Move",                       keyboard: "W A S D",  xbox: "Left stick", playstation: "Left stick" },
  { action: "Dig",                        keyboard: "J",        xbox: "A",          playstation: "Cross" },
  { action: "Set",                        keyboard: "K",        xbox: "X",          playstation: "Square" },
  { action: "Spike, block or serve",      keyboard: "L",        xbox: "Y",          playstation: "Triangle" },
  { action: "Dive",                       keyboard: "Space",    xbox: "B",          playstation: "Circle" },
  { action: "Switch to your partner",     keyboard: "Q",        xbox: "LB",         playstation: "L1" },
  { action: "Auto / Manual",              keyboard: "Tab",      xbox: "View",       playstation: "Share" },
  { action: "Pause",                      keyboard: "Esc",      xbox: "Menu",       playstation: "Options" },
  { action: "Controls help",              keyboard: "H",        xbox: "D-pad down", playstation: "D-pad down" },
];

/** In both modes: the camera and the boosts. */
export const COURT_OTHER_CONTROLS: ReadonlyArray<{ action: string; how: string }> = [
  { action: "Camera look", how: "V (L3 on a pad) switches between TV and Game" },
  { action: "Game views", how: "1 to 6 pick a view (and the Game look); the D-pad's left and right step through them" },
  { action: "Zoom", how: "+ and - (and the mouse wheel when watching) move in and out; the 1x, 2x and 4x buttons on the court" },
  { action: "Skip", how: "Enter (R3 on a pad) skips what is playing between points: the close-ups, the replay, the walk-on, the celebration" },
  { action: "Boosts", how: "Auto: the A and D keys. Manual: click the boost buttons with the mouse" },
];
