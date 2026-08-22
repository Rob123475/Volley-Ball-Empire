// Brotli-precompresses the large Unity WebGL build outputs so
// artifacts/api-server/src/middlewares/precompressedUnityAssets.ts can serve
// them with Content-Encoding: br. Run this whenever the Unity build under
// artifacts/beach-volleyball/public/unity-build/ changes - the .br outputs
// aren't committed to git (see .gitignore), they're regenerated locally
// before packaging. See docs/packaging.md for the full pipeline.
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const BUILD_DIR = path.join(
  __dirname, "..",
  "artifacts/beach-volleyball/public/unity-build/Build",
);

const TARGETS = [
  "Volleyball_WebGL_Uncompressed_2.data",
  "Volleyball_WebGL_Uncompressed_2.wasm",
];

function compressOne(src) {
  const dest = src + ".br";
  const inputSize = fs.statSync(src).size;

  if (fs.existsSync(dest) && fs.statSync(dest).mtimeMs >= fs.statSync(src).mtimeMs) {
    console.log(`Skipping ${path.basename(src)} - ${path.basename(dest)} is already up to date.`);
    return Promise.resolve();
  }

  console.log(`Compressing ${path.basename(src)} (${inputSize} bytes) at Brotli quality 11...`);
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const brotli = zlib.createBrotliCompress({
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: inputSize,
      },
    });

    const input = fs.createReadStream(src);
    const output = fs.createWriteStream(dest);

    input.pipe(brotli).pipe(output);

    output.on("finish", () => {
      const outputSize = fs.statSync(dest).size;
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`Done in ${elapsed}s. Output: ${outputSize} bytes (${(outputSize / inputSize * 100).toFixed(1)}% of original)`);
      resolve();
    });

    output.on("error", reject);
  });
}

async function main() {
  for (const name of TARGETS) {
    await compressOne(path.join(BUILD_DIR, name));
  }
}

main().catch((e) => { console.error("ERROR", e); process.exit(1); });
