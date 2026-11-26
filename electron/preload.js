/**
 * Update 1, overnight brief part 8: the Settings page's window settings
 * (fullscreen or windowed, the window's size, the zoom), through the main
 * process (electron/main.js, electron/window-settings.js), and since 16 Oct
 * the Exit game button's quit, and since 27 Nov the game's name and version
 * for the title screen (main.js passes them as arguments; see edition.js).
 * Nothing else is exposed to the page.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("vbeWindow", {
  get: () => ipcRenderer.invoke("window-settings:get"),
  set: (patch) => ipcRenderer.invoke("window-settings:set", patch),
});

const argValue = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

// Rob, 16 Oct: Settings' "Exit game". The main process quits the way closing
// the window does (before-quit: the server checkpoints the save and closes it).
// 27 Nov: the name and version, for the title screen.
contextBridge.exposeInMainWorld("vbeApp", {
  quit: () => ipcRenderer.invoke("app:quit"),
  name: argValue("vbe-name"),
  version: argValue("vbe-version"),
});
