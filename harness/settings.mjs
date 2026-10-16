/**
 * Update 1, overnight brief part 8 (Rob, 14 Oct, item 8): Settings, what can
 * be tested headless (no Electron window is opened: Rob's Steam game is on
 * this PC, and this touches no save).
 *
 *   1. the window settings file (electron/window-settings.js): defaults, every
 *      bad value made good, the sizes and the zoom's range, remembered across
 *      a "relaunch" (read back from the folder)
 *   2. (source) Electron applies them at launch and at once, through a preload
 *      that exposes only get/set (and, since 16 Oct, Exit game's quit)
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
 *   7. (source) Rob, 16 Oct: a master volume at the top of Sound, over the music,
 *      the crowd and the commentary, applied on the page side (no Unity change)
 *   8. (source) Rob, 16 Oct: Settings on the match screen without leaving the
 *      match: a gear above the court opens Sound and Controls over it, changes go
 *      to the court at once, and the court keeps playing (and is heard) with the
 *      focus off it. What is heard is proved by scripts/webgl-proof/
 *      package-sound-proof.mjs and sound-volume-proof.mjs
 *   9. (source) Rob, 16 Oct: a Pause button above the court, in Auto and Manual
 *      (heard and seen paused, and resumed, in the same two proofs)
 *  10. (source) Rob, 16 Oct: Exit game in Settings and over the 3D match: asks
 *      in the page, says a match in play is forfeited (the game's rule), and
 *      closes the app through Electron's shutdown, which saves first (proved in
 *      scripts/webgl-proof/package-proof.mjs)
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
check("(source) the preload exposes only get and set (and Exit game's quit), and the window loads it with context isolation on",
  /exposeInMainWorld\("vbeWindow", \{\s*get:[^\n]*\n\s*set:[^\n]*\n\}\);/.test(PRELOAD)
    && (PRELOAD.match(/exposeInMainWorld\(/g) ?? []).length === 2 && /exposeInMainWorld\("vbeApp", \{\s*quit: \(\) => ipcRenderer\.invoke\("app:quit"\),\s*\}\);/.test(PRELOAD) && /preload: path\.join\(__dirname, "preload\.js"\)/.test(MAIN) && /contextIsolation: true/.test(MAIN));

// ── 3. Controls ──────────────────────────────────────────────────────────────
console.log("\n3. AUTO / MANUAL IN SETTINGS; THE MATCH SCREEN'S BUTTON IS GONE");
const lib = FE("lib/court-settings.ts"), court = FE("pages/court.tsx"), settings = FE("pages/settings.tsx");
// Since 16 Oct the Sound and Controls panels are shared by Settings and the court's own settings.
const soundPanel = FE("components/sound-settings.tsx"), controlsPanel = FE("components/controls-settings.tsx");
check("the same stored key as before (vbe-court-control-mode), read by the court and set by Settings",
  /CONTROL_MODE_KEY = "vbe-court-control-mode"/.test(lib) && /readControlMode/.test(court) && /saveControlMode\(m\)/.test(settings));
check("the match screen's bar has no Auto/Manual button (it is in the court's settings since 16 Oct, section 8)", !/button-control-mode/.test(court) && !/toggleMode/.test(court));
const keys = ["W A S D", "J", "K", "L", "Space", "Q", "Tab", "Esc", "H"];
check("the controls panel lists the court's keyboard and pad controls", keys.every((k) => lib.includes(`keyboard: "${k}"`)) && /xbox: "LB"/.test(lib) && /playstation: "L1"/.test(lib)
  && /COURT_CONTROLS\.map/.test(controlsPanel) && /<ControlsSettings mode=\{mode\} onChoose=\{chooseMode\} \/>/.test(settings));

// ── 4. The gear ──────────────────────────────────────────────────────────────
console.log("\n4. THE GEAR, IN THE SIDEBAR AND ON THE TITLE SCREEN");
check("(source) a Settings entry in the sidebar and a gear on the title screen", /href: "\/settings"/.test(FE("components/layout/shell.tsx")) && /navigate\("\/settings"\)/.test(FE("pages/profile-picker.tsx")));
const app = FE("App.tsx");
check("(source) Settings and its Rules page need no career (outside the guard)", app.indexOf('<Route path="/settings" component={SettingsPage} />') > 0
  && app.indexOf('<Route path="/settings" component={SettingsPage} />') < app.indexOf("<AuthGuard>") && /<Route path="\/settings\/rules">/.test(app));
check("(source) the music volume and mute are the music bar's own (useMusic)", /music\.setVolume\(/.test(soundPanel) && /music\.toggleMute/.test(soundPanel) && /<SoundSettings \/>/.test(settings));

// ── 5. The Rules ─────────────────────────────────────────────────────────────
console.log("\n5. THE RULES NAME EVERYTHING NEW");
const rules = FE("pages/rules.tsx");
const topics = ["The Day 1 draft", "The salary cap", "Hire your staff and medical in your first week", "Injured players come cheap", "Pre-season camps",
  "Difficulty", "Ageing and injuries", "Scouting and the Watch list", "Manager specialities",
  // Night 2 (O-6 to O-10): the staff roles, real injuries, and the injured list.
  "Every staff role has its own job", "Real injuries", "The injured list, cover and promotion at ",
  // 1.1.1 (part 7): transfers, perks, youth deals and the Clubs page.
  "The transfer window", "Buying ahead", "No dumping", "One chance to keep her", "Perks", "Youth deals and scouts", "The Clubs page"];
const missing = topics.filter((t) => !rules.includes(`title: "${t}"`));
check("each of the nineteen topics is on the Rules page", missing.length === 0, missing.join(", ") || "all nineteen");
// 1.1.0 (Rob, 16 Oct): the AI clubs take staff on 8 January every season (Day 8 of a new career).
check("and \"On 8 January every season the AI clubs take\" staff is said in plain words", /On 8 January every season \(Day 8 of a new career\) the AI clubs take a coach and a medical member each/.test(rules));

// ── 6. Match sound ───────────────────────────────────────────────────────────
console.log("\n6. MATCH SOUND");
const unityHtml = fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "public", "unity-build", "index.html"), "utf8");
const courtSettings = FE("lib/court-settings.ts"), courtPage = FE("pages/court.tsx");
check("(source) Settings > Sound has a crowd and a commentary slider, stored in one JSON object like the music's volume",
  soundPanel.includes("saveMatchVolume(next)") && soundPanel.includes(`["crowd", "Crowd volume"`) && soundPanel.includes(`["commentary", "Commentary volume"`)
    && courtSettings.includes("localStorage.setItem(MATCH_VOLUME_KEY, JSON.stringify(volume))"));
check("(source) the court page sends them when the court has loaded and whenever they change",
  /if \(e\.data === "unity-loaded"\) \{\s*setUnityLoaded\(true\);\s*sendMatchVolume\(\);/.test(courtPage)
    && courtPage.includes("addEventListener(MATCH_VOLUME_EVENT, sendMatchVolume)") && courtPage.includes(`postMessage({ type: "vbe-volume", ...courtVolumes() }`));
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

// ── 7. The master volume (Rob, 16 Oct) ───────────────────────────────────────
console.log("\n7. THE MASTER VOLUME");
const provider = FE("components/music/music-provider.tsx");
check("(source) Sound starts with a master volume, stored with the court's volumes (100% if never set)",
  soundPanel.indexOf('data-testid="sound-master-volume"') > 0 && soundPanel.indexOf('data-testid="sound-master-volume"') < soundPanel.indexOf('data-testid="sound-mute"')
    && /master: clamp01\(parsed\?\.master, 1\)/.test(courtSettings));
check("(source) the court is sent each of its volumes times the master",
  /crowd: volume\.crowd \* volume\.master, commentary: volume\.commentary \* volume\.master/.test(courtSettings));
check("(source) the music plays at its own volume times the master, and follows the master live",
  /const level = volume \* master;/.test(provider) && /if \(!onCourt\) audio\.volume = level;/.test(provider)
    && provider.includes("window.addEventListener(MATCH_VOLUME_EVENT, read)") && !/audio\.volume = volume;/.test(provider));
check("(source) the music's mute is the music element's own flag: it mutes only the songs",
  /audio\.muted = muted;/.test(provider) && !/\bmuted\b/.test(courtSettings.replace(/\/\*[\s\S]*?\*\//g, "")) && !/useMusic|\.muted\b|toggleMute/.test(courtPage));

// ── 8. Settings on the match screen (Rob, 16 Oct) ────────────────────────────
console.log("\n8. SETTINGS ON THE MATCH SCREEN, WITHOUT LEAVING THE MATCH");
const overlay = courtPage.slice(courtPage.indexOf("{settingsOpen && ("), courtPage.indexOf("<iframe"));
check("(source) a Settings gear in the bar above the court, beside Leave match",
  /data-testid="button-court-settings"/.test(courtPage) && courtPage.indexOf('data-testid="button-court-settings"') < courtPage.indexOf('data-testid="button-leave-match"'));
check("(source) it opens Sound (master, music, crowd, commentary) and Controls (Auto / Manual and the controls table) over the court",
  /data-testid="court-settings-overlay"/.test(overlay) && /<SoundSettings onCourt \/>/.test(overlay) && /<ControlsSettings mode=\{mode\} onChoose=\{chooseMode\} \/>/.test(overlay));
check("(source) nothing in it leaves the court (no navigation, no leave) but Exit game, which asks first (section 10)", overlay.length > 0 && !/navigate\(|leaveMatch/.test(overlay));
check("(source) Auto / Manual chosen there goes to the court at once, and is remembered",
  /function chooseMode\(m: ControlMode\) \{\s*setMode\(m\);\s*saveControlMode\(m\);\s*iframeRef\.current\?\.contentWindow\?\.postMessage\(\{ type: "vbe-control-mode", mode: m \}, "\*"\);/.test(courtPage)
    && unityHtml.includes(`d.type !== "vbe-control-mode"`));
check("(source) the volumes chosen there go to the court at once (saved, the event, sent)",
  soundPanel.includes("saveMatchVolume(next)") && courtSettings.includes("window.dispatchEvent(new Event(MATCH_VOLUME_EVENT))"));
check("(source) closing it gives the keyboard back to the court",
  /function closeSettings\(\) \{\s*setSettingsOpen\(false\);[\s\S]{0,120}iframeRef\.current\?\.focus\(\);/.test(courtPage));
check("(source) the court keeps playing with the focus off it: its page keeps the window's blur from Unity, before Unity loads",
  /window\.addEventListener\("blur", function \(e\) \{ if \(!e\.vbePause\) e\.stopImmediatePropagation\(\); \}, true\);/.test(unityHtml)
    && unityHtml.indexOf('window.addEventListener("blur"') < unityHtml.indexOf("createUnityInstance("));

// ── 9. The Pause button (Rob, 16 Oct) ────────────────────────────────────────
console.log("\n9. THE PAUSE BUTTON ABOVE THE COURT, IN AUTO AND MANUAL");
check("(source) a Pause button beside Settings and Leave match, once the court has loaded; it says Resume while paused",
  /data-testid="button-court-pause"/.test(courtPage) && courtPage.indexOf('data-testid="button-court-pause"') < courtPage.indexOf('data-testid="button-leave-match"')
    && /\{unityLoaded && \(/.test(courtPage) && /\{paused \? "Resume" : "Pause"\}/.test(courtPage));
check("(source) it asks the court's page, which pauses in either mode by Unity's own stop on losing focus, and says so back",
  courtPage.includes(`postMessage({ type: "vbe-pause", paused: !paused }, "*")`) && unityHtml.includes(`d.type !== "vbe-pause"`)
    && /new FocusEvent\(on \? "blur" : "focus"\)/.test(unityHtml) && unityHtml.includes(`"unity-paused:" + (vbePaused ? "1" : "0")`)
    && /e\.data === "unity-paused:1"/.test(courtPage));
check("(source) while paused only Resume starts it: a real focus (a click on the court) is kept from Unity",
  /window\.addEventListener\("focus", function \(e\) \{ if \(vbePaused && !e\.vbePause\) e\.stopImmediatePropagation\(\); \}, true\);/.test(unityHtml));

// ── 10. Exit game (Rob, 16 Oct) ──────────────────────────────────────────────
console.log("\n10. EXIT GAME, FROM SETTINGS AND FROM THE 3D MATCH");
const exitGame = FE("components/exit-game.tsx");
check("(source) Exit game is on the Settings page and in the settings over the 3D match (with the match's id)",
  /<ExitGame \/>/.test(settings) && /<ExitGame matchId=\{matchId\} \/>/.test(overlay));
check("(source) it asks inside the page, Exit or Cancel: \"Exit Beach Volleyball Empire? Your career is saved.\" (no browser dialog)",
  /<AlertDialogTitle>Exit Beach Volleyball Empire\?<\/AlertDialogTitle>/.test(exitGame) && /Your career is saved\./.test(exitGame)
    && /data-testid="exit-cancel">Cancel</.test(exitGame) && /data-testid="exit-confirm"/.test(exitGame) && />\s*Exit\s*</.test(exitGame)
    && !/window\.confirm|confirm\(|alert\(/.test(exitGame));
check("(source) during a match it says the game's rule (a forfeit, as leaving does) and records it through Leave match before closing",
  /The match in play counts as a forfeit, as leaving a match does/.test(exitGame)
    && exitGame.indexOf("/api/matches/${matchId}/leave") > 0 && exitGame.indexOf("/api/matches/${matchId}/leave") < exitGame.indexOf("await bridge.quit()")
    && /forfeitAbandonedWatchedMatches\(\)/.test(fs.readFileSync(path.join(REPO, "artifacts", "api-server", "src", "index.ts"), "utf8")));
check("(source) Exit closes through Electron as closing the window does: app.quit, whose before-quit checkpoints and closes the save",
  /ipcMain\.handle\("app:quit", \(\) => \{ app\.quit\(\); \}\);/.test(MAIN) && /app\.on\("before-quit"/.test(MAIN) && /type: "shutdown"/.test(MAIN));

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
