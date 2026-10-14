/**
 * Update 1, overnight brief part 8 (Rob, 14 Oct, item 8): the window's
 * settings, remembered on this PC in a small JSON file in the app's user-data
 * folder (window-settings.json). Pure Node (no Electron), so the harness can
 * test it (harness/settings.mjs); electron/main.js applies what it returns.
 *
 *   mode   "windowed" or "fullscreen"
 *   size   one of SIZES ("1400x900" the default), for a windowed game; null
 *          (never picked) keeps the game as it has always opened: maximised
 *   zoom   0.8 to 1.5 (80% to 150%), the page's zoom
 */
const fs = require("fs");
const path = require("path");

const FILE = "window-settings.json";
const SIZES = ["1280x800", "1400x900", "1600x1000", "1920x1080"];
const DEFAULT_SIZE = "1400x900";
const ZOOM_MIN = 0.8;
const ZOOM_MAX = 1.5;
const DEFAULTS = { mode: "windowed", size: null, zoom: 1 };

/** Any stored or sent value -> a valid settings object. */
function normalise(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  const zoom = Number(s.zoom);
  return {
    mode: s.mode === "fullscreen" ? "fullscreen" : "windowed",
    size: SIZES.includes(s.size) ? s.size : null,
    zoom: Number.isFinite(zoom) ? Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom)) * 100) / 100 : 1,
  };
}

function readWindowSettings(dir) {
  try { return normalise(JSON.parse(fs.readFileSync(path.join(dir, FILE), "utf8"))); } catch { return { ...DEFAULTS }; }
}

/** Merge `patch` into what is stored, write it, and return the result. */
function writeWindowSettings(dir, patch) {
  const next = normalise({ ...readWindowSettings(dir), ...(patch && typeof patch === "object" ? patch : {}) });
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, FILE), JSON.stringify(next, null, 2));
  } catch { /* not remembered; still applied this run */ }
  return next;
}

/** "1400x900" -> { width, height }. */
function sizeOf(size) {
  const [w, h] = String(size ?? DEFAULT_SIZE).split("x").map(Number);
  return { width: w || 1400, height: h || 900 };
}

module.exports = { FILE, SIZES, DEFAULT_SIZE, ZOOM_MIN, ZOOM_MAX, DEFAULTS, normalise, readWindowSettings, writeWindowSettings, sizeOf };
