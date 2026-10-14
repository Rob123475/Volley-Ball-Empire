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
