/**
 * Update 1, overnight brief part 8 (Rob, 14 Oct, item 8): Settings, what can
 * be tested headless (no Electron window is opened: Rob's Steam game is on
 * this PC, and this touches no save).
 *
 *   1. the window settings file (electron/window-settings.js): defaults, every
 *      bad value made good, the sizes and the zoom's range, remembered across
 *      a "relaunch" (read back from the folder)
 *   2. (source) Electron applies them at launch and at once, through a preload
 *      that exposes only get/set
 *   3. (source) Auto/Manual: chosen in Settings under the same stored key; the
 *      match screen's button is gone; the controls panel lists the court's keys
 *   4. (source) the gear in the sidebar and on the title screen; Settings needs no career
 *   5. the Rules page names everything new in Update 1
 *   6. (source) match sound (Update 1, 15 Oct, O-5): a crowd and a commentary
 *      slider in Settings > Sound, stored like the music's volume; the court page
 *      sends both when the court has loaded and when they change, and the
 *      court's page passes them to MatchManager.SetCrowdVolume /
 *      SetCommentaryVolume the way it passes the control mode (the Unity side is
 *      proved by its batch proof SoundVolumeProof)
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const REPO = path.join(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const ws = require(path.join(REPO, "electron", "window-settings.js"));
const FE = (p) => fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", p), "utf8");
const MAIN = fs.readFileSync(path.join(REPO, "electron", "main.js"), "utf8");
const PRELOAD = fs.readFileSync(path.join(REPO, "electron", "preload.js"), "utf8");

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
const info = (s) => console.log(`  INFO  ${s}`);
console.log("=".repeat(72));
console.log("  UPDATE 1, OVERNIGHT PART 8: SETTINGS");
console.log("=".repeat(72));

// ── 1. The window settings file ──────────────────────────────────────────────
console.log("\n1. THE WINDOW SETTINGS, REMEMBERED ON THIS PC");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-settings-"));
const fresh = ws.readWindowSettings(dir);
check("no file yet: windowed, no size (the game opens maximised as it always has), zoom 100%",
  fresh.mode === "windowed" && fresh.size === null && fresh.zoom === 1, JSON.stringify(fresh));
check("the sizes are 1280x800, 1400x900 (default), 1600x1000 and 1920x1080; zoom 80% to 150%",
  ws.SIZES.join(",") === "1280x800,1400x900,1600x1000,1920x1080" && ws.DEFAULT_SIZE === "1400x900" && ws.ZOOM_MIN === 0.8 && ws.ZOOM_MAX === 1.5);
const bad = ws.normalise({ mode: "huge", size: "800x600", zoom: 9 });
check("bad values are made good (mode windowed, an unknown size none, zoom held to 150%)", bad.mode === "windowed" && bad.size === null && bad.zoom === 1.5, JSON.stringify(bad));
check("and a zoom below 80% is held to 80%", ws.normalise({ zoom: 0.2 }).zoom === 0.8);
ws.writeWindowSettings(dir, { mode: "fullscreen" });
ws.writeWindowSettings(dir, { size: "1600x1000", zoom: 1.25 });
const back = ws.readWindowSettings(dir);
check("a change is merged into what is stored, and read back after a \"relaunch\"", back.mode === "fullscreen" && back.size === "1600x1000" && back.zoom === 1.25, JSON.stringify(back));
fs.writeFileSync(path.join(dir, ws.FILE), "{ not json");
check("a broken file reads as the defaults", JSON.stringify(ws.readWindowSettings(dir)) === JSON.stringify(ws.DEFAULTS));
check("\"1920x1080\" is 1920 by 1080", ws.sizeOf("1920x1080").width === 1920 && ws.sizeOf("1920x1080").height === 1080);
fs.rmSync(dir, { recursive: true, force: true });

// ── 2. Electron ──────────────────────────────────────────────────────────────
console.log("\n2. ELECTRON APPLIES THEM AT LAUNCH AND AT ONCE");
check("(source) the window reads them at launch and applies them when it shows; the zoom after every load",
  /const settings = windowSettings\.readWindowSettings\(userDataPath\);/.test(MAIN) && /applyWindowSettings\(mainWindow, settings, \{ atLaunch: true \}\)/.test(MAIN)
    && /did-finish-load[\s\S]{0,200}setZoomFactor/.test(MAIN));
check("(source) a change is written and applied at once (fullscreen, size, zoom)",
  /ipcMain\.handle\("window-settings:set"[\s\S]{0,200}writeWindowSettings\(userDataPath, patch\)[\s\S]{0,80}applyWindowSettings\(mainWindow, next\)/.test(MAIN)
    && /setFullScreen\(settings\.mode === "fullscreen"\)/.test(MAIN) && /setZoomFactor\(settings\.zoom\)/.test(MAIN));
check("(source) the preload exposes only get and set, and the window loads it with context isolation on",
  /exposeInMainWorld\("vbeWindow", \{\s*get:[^\n]*\n\s*set:[^\n]*\n\}\);/.test(PRELOAD) && /preload: path\.join\(__dirname, "preload\.js"\)/.test(MAIN) && /contextIsolation: true/.test(MAIN));

// ── 3. Controls ──────────────────────────────────────────────────────────────
console.log("\n3. AUTO / MANUAL IN SETTINGS; THE MATCH SCREEN'S BUTTON IS GONE");
const lib = FE("lib/court-settings.ts"), court = FE("pages/court.tsx"), settings = FE("pages/settings.tsx");
check("the same stored key as before (vbe-court-control-mode), read by the court and set by Settings",
  /CONTROL_MODE_KEY = "vbe-court-control-mode"/.test(lib) && /readControlMode/.test(court) && /saveControlMode\(m\)/.test(settings));
check("the match screen has no Auto/Manual button any more", !/button-control-mode/.test(court) && !/toggleMode/.test(court));
const keys = ["W A S D", "J", "K", "L", "Space", "Q", "Tab", "Esc", "H"];
check("the controls panel lists the court's keyboard and pad controls", keys.every((k) => lib.includes(`keyboard: "${k}"`)) && /xbox: "LB"/.test(lib) && /playstation: "L1"/.test(lib) && /COURT_CONTROLS\.map/.test(settings));

// ── 4. The gear ──────────────────────────────────────────────────────────────
console.log("\n4. THE GEAR, IN THE SIDEBAR AND ON THE TITLE SCREEN");
check("(source) a Settings entry in the sidebar and a gear on the title screen", /href: "\/settings"/.test(FE("components/layout/shell.tsx")) && /navigate\("\/settings"\)/.test(FE("pages/profile-picker.tsx")));
const app = FE("App.tsx");
check("(source) Settings and its Rules page need no career (outside the guard)", app.indexOf('<Route path="/settings" component={SettingsPage} />') > 0
  && app.indexOf('<Route path="/settings" component={SettingsPage} />') < app.indexOf("<AuthGuard>") && /<Route path="\/settings\/rules">/.test(app));
check("(source) the music volume and mute are the music bar's own (useMusic)", /music\.setVolume\(/.test(settings) && /music\.toggleMute/.test(settings));

// ── 5. The Rules ─────────────────────────────────────────────────────────────
console.log("\n5. THE RULES NAME EVERYTHING NEW");
const rules = FE("pages/rules.tsx");
const topics = ["The Day 1 draft", "The salary cap", "Hire your staff and medical in your first week", "Injured players come cheap", "Pre-season camps",
  "Difficulty", "Ageing and injuries", "Scouting and the Watch list", "Manager specialities",
  // Night 2 (O-6 to O-10): the staff roles, real injuries, and the injured list.
  "Every staff role has its own job", "Real injuries", "The injured list, cover and promotion at "];
const missing = topics.filter((t) => !rules.includes(`title: "${t}"`));
check("each of the twelve topics is on the Rules page", missing.length === 0, missing.join(", ") || "all twelve");
check("and \"On Day 8 the AI clubs take\" staff is said in plain words", /On Day 8 the AI clubs take a coach and a medical member each/.test(rules));

// ── 6. Match sound ───────────────────────────────────────────────────────────
console.log("\n6. MATCH SOUND");
const unityHtml = fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "public", "unity-build", "index.html"), "utf8");
const courtSettings = FE("lib/court-settings.ts"), courtPage = FE("pages/court.tsx");
check("(source) Settings > Sound has a crowd and a commentary slider, stored in one JSON object like the music's volume",
  settings.includes("saveMatchVolume(next)") && settings.includes(`["crowd", "Crowd volume"`) && settings.includes(`["commentary", "Commentary volume"`)
    && courtSettings.includes("localStorage.setItem(MATCH_VOLUME_KEY, JSON.stringify(volume))"));
check("(source) the court page sends them when the court has loaded and whenever they change",
  /if \(e\.data === "unity-loaded"\) \{\s*setUnityLoaded\(true\);\s*sendMatchVolume\(\);/.test(courtPage)
    && courtPage.includes("addEventListener(MATCH_VOLUME_EVENT, sendMatchVolume)") && courtPage.includes(`postMessage({ type: "vbe-volume", ...readMatchVolume() }`));
check("(source) the court's page passes them to MatchManager the way it passes the control mode",
  unityHtml.includes(`SendMessage("MatchManager", "SetControlMode"`) && unityHtml.includes(`d.type !== "vbe-volume"`)
    && unityHtml.includes(`SendMessage("MatchManager", "SetCrowdVolume"`) && unityHtml.includes(`SendMessage("MatchManager", "SetCommentaryVolume"`));
// The court's WebGL build must carry the two methods the page calls (Unity's
// method names are in the metadata inside the .data file).
const unityBuild = path.join(REPO, "artifacts", "beach-volleyball", "public", "unity-build", "Build");
const dataFile = fs.readdirSync(unityBuild).find((f) => f.endsWith(".data"));
const data = dataFile ? fs.readFileSync(path.join(unityBuild, dataFile)) : Buffer.alloc(0);
check("the court's WebGL build carries SetCrowdVolume and SetCommentaryVolume",
  data.indexOf("SetCrowdVolume") >= 0 && data.indexOf("SetCommentaryVolume") >= 0, dataFile ?? "no .data");

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
