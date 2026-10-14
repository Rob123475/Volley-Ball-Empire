/**
 * Update 1, overnight brief part 8: the Settings page's window settings
 * (fullscreen or windowed, the window's size, the zoom), through the main
 * process (electron/main.js, electron/window-settings.js). Nothing else is
 * exposed to the page.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("vbeWindow", {
  get: () => ipcRenderer.invoke("window-settings:get"),
  set: (patch) => ipcRenderer.invoke("window-settings:set", patch),
});
