// Single electron-builder "beforePack" entry point (see package.json's
// build.beforePack). electron-builder only calls one script for this hook,
// so every pre-pack check has to be chained through here rather than each
// having its own hook registration — running order only matters in that
// both must complete before packaging proceeds; each aborts independently
// with its own diagnostic if it fails.
const verifyUnityBrotli = require("./verify-unity-brotli.cjs");
const verifyNativeAbi = require("./verify-native-abi.cjs");

async function beforePack(context) {
  await verifyUnityBrotli(context);
  await verifyNativeAbi(context);
}

module.exports = beforePack;

if (require.main === module) {
  beforePack().catch((e) => { console.error(e.message); process.exit(1); });
}
