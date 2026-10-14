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
 */
export type MatchVolume = { crowd: number; commentary: number };
export const MATCH_VOLUME_KEY = "vbe-court-volume";
/** Fired on this window when the volumes are saved (localStorage's own event only reaches other windows). */
export const MATCH_VOLUME_EVENT = "vbe-court-volume-changed";

const clamp01 = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;

export function readMatchVolume(): MatchVolume {
  try {
    const parsed = JSON.parse(localStorage.getItem(MATCH_VOLUME_KEY) ?? "null") as Partial<MatchVolume> | null;
    return { crowd: clamp01(parsed?.crowd, 1), commentary: clamp01(parsed?.commentary, 1) };
  } catch {
    return { crowd: 1, commentary: 1 };
  }
}

export function saveMatchVolume(volume: MatchVolume): void {
  try { localStorage.setItem(MATCH_VOLUME_KEY, JSON.stringify(volume)); } catch { /* not remembered, still used */ }
  window.dispatchEvent(new Event(MATCH_VOLUME_EVENT));
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
  { action: "Camera angles", how: "1, 2 and 3 (Auto: Space and the mouse wheel move the camera too)" },
  { action: "Boosts", how: "Auto: the A and D keys. Manual: click the boost buttons with the mouse" },
];
