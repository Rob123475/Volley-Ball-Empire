/**
 * Which build of the game this is: the real game, or a demo kept wholly apart
 * from it (1.2 demo, 27 Nov 2026, for Rob to show on his PC and a friend's,
 * where the Steam version may also be installed).
 *
 * The packaged package.json says which. Only the demo's packaging config
 * (electron-builder.demo.cjs) sets "vbeEdition": "demo" and its own version, through
 * electron-builder's extraMetadata; the repo's package.json never carries it,
 * so a dev run and the real game's package are the real game.
 *
 * What the demo changes, and why:
 *   - its own name, and so its own userData folder
 *     (AppData\Roaming\Beach Volleyball Empire 1.2 Demo): it can never open,
 *     copy, move or write the real save in AppData\Roaming\Beach Volleyball Empire;
 *   - no bringing saves forward from older folders: a demo's first run with no
 *     save of its own starts from the starter database;
 *   - no Steam: launched outside Steam, steamworks.js could still attach to the
 *     real app id and unlock the real game's achievements;
 *   - its own local port, so it runs even while the real game is open.
 */
const pkg = require("../package.json");

const demo = pkg.vbeEdition === "demo";

module.exports = {
  demo,
  appName: demo ? "Beach Volleyball Empire 1.2 Demo" : "Beach Volleyball Empire",
  version: pkg.version,
  serverPort: demo ? 4174 : 4173,
  steam: !demo,
  bringOldSavesForward: !demo,
};
