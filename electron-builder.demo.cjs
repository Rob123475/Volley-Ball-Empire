/**
 * The 1.2 demo's packaging (27 Nov 2026): the real game's config from
 * package.json "build", with its own identity so it installs beside the real
 * game (and the Steam version) and never touches the real save.
 *
 *   npx electron-builder --win --config electron-builder.demo.cjs
 *
 * - productName and appId of its own: its own install folder, Start-menu and
 *   desktop shortcuts, and uninstall entry (NSIS keys them on the appId);
 * - extraMetadata writes "vbeEdition": "demo" and the version 1.2.0-demo1 into the
 *   packaged package.json, which electron/edition.js reads: its own userData
 *   folder (AppData\Roaming\Beach Volleyball Empire 1.2 Demo), no save brought
 *   forward from any other folder, no Steam, its own port;
 * - its own output folder.
 */
const base = require("./package.json").build;

const PRODUCT = "Beach Volleyball Empire 1.2 Demo";
const VERSION = "1.2.0-demo2";

module.exports = {
  ...base,
  appId: "com.volleyballempire.desktop.demo-1-2",
  productName: PRODUCT,
  extraMetadata: { version: VERSION, vbeEdition: "demo" },
  directories: { output: "C:\\build\\vbe-1.2-demo-2026-11-27b" },
  nsis: {
    ...base.nsis,
    artifactName: "Beach Volleyball Empire 1.2 Demo Setup ${version}.${ext}",
    shortcutName: PRODUCT,
    uninstallDisplayName: PRODUCT,
  },
};
