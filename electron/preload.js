/**
 * Update 1, overnight brief part 8: the Settings page's window settings
 * (fullscreen or windowed, the window's size, the zoom), through the main
 * process (electron/main.js, electron/window-settings.js), and since 16 Oct
 * the Exit game button's quit. Nothing else is exposed to the page.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("vbeWindow", {
  get: () => ipcRenderer.invoke("window-settings:get"),
  set: (patch) => ipcRenderer.invoke("window-settings:set", patch),
});

// Rob, 16 Oct: Settings' "Exit game". The main process quits the way closing
// the window does (before-quit: the server checkpoints the save and closes it).
contextBridge.exposeInMainWorld("vbeApp", {
  quit: () => ipcRenderer.invoke("app:quit"),
});
