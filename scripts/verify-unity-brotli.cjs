// Wired as electron-builder's "beforePack" hook (see package.json's
// build.beforePack) so it runs no matter how packaging is invoked -
// `pnpm run electron:build` AND the documented `npx electron-builder --win
// dir` fallback both go through electron-builder's own pack lifecycle.
// Exists to make it structurally impossible to accidentally ship the raw,
// uncompressed Unity .data/.wasm:
//
//   1. Refuses to package at all if the source .br files (in
//      artifacts/beach-volleyball/public/unity-build/Build/) are missing or
//      older than the .data/.wasm they're derived from - that means nobody
//      ran scripts/compress-unity-data.cjs since the Unity build last
//      changed, and there is nothing safe to auto-fix here (regenerating a
//      636 MB Brotli file takes minutes and belongs in an explicit step,
//      not a silent side effect of packaging).
//   2. Strips the raw .data/.wasm from the frontend's build output
//      (artifacts/beach-volleyball/dist/public/.../Build/) if present - this
//      part *is* safe to automate deterministically, so packaging no longer
//      depends on remembering the manual "strip before you package" step.
//      See "The Unity double-ship trap" in docs/packaging.md.
//
// Throwing here aborts electron-builder before it packs anything.
const fs = require("fs");
const path = require("path");

const SOURCE_BUILD_DIR = path.join(
  __dirname, "..",
  "artifacts/beach-volleyball/public/unity-build/Build",
);
const DIST_BUILD_DIR = path.join(
  __dirname, "..",
  "artifacts/beach-volleyball/dist/public/unity-build/Build",
);

const TARGETS = [
  "Volleyball_WebGL_Uncompressed_2.data",
  "Volleyball_WebGL_Uncompressed_2.wasm",
];

async function verifyUnityBrotli() {
  const problems = [];

  // --- 1. Source .br files must exist and be up to date ---
  for (const name of TARGETS) {
    const src = path.join(SOURCE_BUILD_DIR, name);
    const br = src + ".br";

    if (!fs.existsSync(src)) {
      problems.push(`Missing Unity build source file: ${src}`);
      continue;
    }
    if (!fs.existsSync(br)) {
      problems.push(
        `Missing ${path.basename(br)} - packaging would ship the raw ` +
        `(uncompressed) ${name} instead. Run: node scripts/compress-unity-data.cjs`,
      );
      continue;
    }
    if (fs.statSync(br).mtimeMs < fs.statSync(src).mtimeMs) {
      problems.push(
        `${path.basename(br)} is older than ${name} - the Unity build changed ` +
        `since it was last compressed. Run: node scripts/compress-unity-data.cjs`,
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(
      "[verify-unity-brotli] Aborting package - see docs/packaging.md " +
      "(\"Brotli-precompressed Unity assets\"):\n  - " + problems.join("\n  - "),
    );
  }

  // --- 2. Strip raw originals from the packaging input, if present ---
  if (!fs.existsSync(DIST_BUILD_DIR)) {
    throw new Error(
      `[verify-unity-brotli] Aborting package - ${DIST_BUILD_DIR} does not ` +
      `exist. Run "pnpm run build" (the frontend build) before packaging, so ` +
      `the .br files get copied into dist/public. See docs/packaging.md ` +
      "(\"Full rebuild + repackage, in order\").",
    );
  }

  for (const name of TARGETS) {
    const distOriginal = path.join(DIST_BUILD_DIR, name);
    const distBr = path.join(DIST_BUILD_DIR, name + ".br");

    if (!fs.existsSync(distBr)) {
      throw new Error(
        `[verify-unity-brotli] Aborting package - ${distBr} is missing. The ` +
        `frontend build output is stale (built before the .br files existed). ` +
        'Run "pnpm run build" again. See docs/packaging.md ("Full rebuild + ' +
        'repackage, in order").',
      );
    }
    if (fs.existsSync(distOriginal)) {
      fs.rmSync(distOriginal);
      console.log(`[verify-unity-brotli] Stripped raw ${name} from packaging input (double-ship trap).`);
    }
  }

  console.log("[verify-unity-brotli] OK - only Brotli-compressed Unity assets will be packaged.");
}

module.exports = verifyUnityBrotli;

if (require.main === module) {
  verifyUnityBrotli().catch((e) => { console.error(e.message); process.exit(1); });
}
