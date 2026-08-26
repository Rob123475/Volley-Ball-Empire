// Wired as part of electron-builder's "beforePack" hook (chained from
// scripts/before-pack.cjs — see package.json's build.beforePack) so it runs
// no matter how packaging is invoked.
//
// Native addons like better-sqlite3 are compiled against a specific Node/V8
// ABI. Electron ships its own ABI, different from the system Node.js used to
// run this repo's build scripts (see docs/packaging.md, "Native module
// ABI"). artifacts/api-server/build.mjs vendors better-sqlite3 into
// artifacts/api-server/dist/node_modules from whatever happens to be in the
// pnpm store when "pnpm run build" runs — if that copy was built for system
// Node instead of Electron (a plain `pnpm install` does this, and so does
// `@electron/rebuild` silently no-opping: it can print "Rebuild Complete"
// without producing a new file — this has happened), the packaged app looks
// completely fine at build/package time and then crashes the instant it
// tries to open the database, because electron/main.js forks the server
// with ELECTRON_RUN_AS_NODE=1 (set automatically by Electron's own
// child_process.fork patch).
//
// This check catches that before packaging happens, by doing the same thing
// for real: loading the exact file that will be shipped, in the exact
// runtime that will load it — the real Electron binary, run as plain Node.
//
// Throwing here aborts electron-builder before it packs anything.
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const VENDORED_DIR = path.join(
  __dirname, "..",
  "artifacts/api-server/dist/node_modules/better-sqlite3",
);

function rebuildInstructions() {
  let electronVersion = "<electron version>";
  try {
    electronVersion = require("electron/package.json").version;
  } catch {
    // best-effort only — fall back to the placeholder above
  }

  return `
  electron-rebuild can silently no-op — it may print "Rebuild Complete"
  without actually recompiling, leaving a stale/wrong-ABI binary in place.
  If deleting and re-running it doesn't produce a freshly-timestamped .node
  file, drive node-gyp directly instead:

    find node_modules artifacts/api-server/dist -name better_sqlite3.node -delete
    cd node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3
    pnpm exec node-gyp rebuild --target=${electronVersion} --arch=x64 \\
      --dist-url=https://electronjs.org/headers
    cd -

  Then rebuild the vendored copy (order matters — build.mjs vendors from the
  pnpm store, so the native rebuild above must happen BEFORE this):

    pnpm run build
    pnpm run electron:build

  See docs/packaging.md ("Native module ABI").`;
}

async function verifyNativeAbi() {
  if (!fs.existsSync(VENDORED_DIR)) {
    throw new Error(
      `[verify-native-abi] Aborting package - ${VENDORED_DIR} does not ` +
      'exist. Run "pnpm run build" first so better-sqlite3 gets vendored ' +
      "into artifacts/api-server/dist/node_modules/.",
    );
  }

  const electronPath = require("electron");
  const probe = [
    `const Database = require(${JSON.stringify(VENDORED_DIR)});`,
    'new Database(":memory:").close();',
  ].join("\n");

  try {
    execFileSync(electronPath, ["-e", probe], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      stdio: "pipe",
    });
  } catch (err) {
    const detail = (err.stderr && err.stderr.toString()) || err.message;
    throw new Error(
      "[verify-native-abi] Aborting package - the vendored better-sqlite3 " +
      `native binary (${VENDORED_DIR}) failed to load under Electron's own ` +
      "runtime. The shipped app would crash on launch the moment it tries " +
      "to open the database - this is almost always a Node ABI mismatch " +
      "(the binary was compiled for system Node instead of Electron)." +
      rebuildInstructions() +
      `\n\nOriginal error:\n${detail}`,
    );
  }

  console.log("[verify-native-abi] OK - better-sqlite3 loads correctly under Electron's runtime.");
}

module.exports = verifyNativeAbi;

if (require.main === module) {
  verifyNativeAbi().catch((e) => { console.error(e.message); process.exit(1); });
}
