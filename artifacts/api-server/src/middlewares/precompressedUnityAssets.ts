import { type Request, type Response, type NextFunction } from "express";
import fs from "fs";
import path from "path";

// Unity's WebGL loader (Build/*.loader.js) fetches these two files by their
// exact configured URL — it has no notion of a ".br" suffix. To serve a
// Brotli-precompressed variant we keep the request path unchanged and
// respond with the .br sibling's bytes plus "Content-Encoding: br"; Chromium
// then decompresses transparently before handing the body to Unity's fetch/
// WebAssembly.instantiateStreaming calls. See docs/packaging.md for why this
// is safe (Unity's loader validates decompressed content against its own
// UnityWebData1.0 / wasm magic bytes, not against Content-Length or file
// extension) and what it looks like when it isn't (a very specific "still
// br-compressed" error naming the missing Content-Encoding header).
const PRECOMPRESSED_ASSETS: Record<string, string> = {
  "/unity-build/Build/Volleyball_WebGL_Uncompressed_2.data": "application/octet-stream",
  "/unity-build/Build/Volleyball_WebGL_Uncompressed_2.wasm": "application/wasm",
};

export function precompressedUnityAssets(staticDir: string) {
  return function (req: Request, res: Response, next: NextFunction) {
    if (req.method !== "GET" && req.method !== "HEAD") { next(); return; }

    const contentType = PRECOMPRESSED_ASSETS[req.path];
    if (!contentType) { next(); return; }

    const acceptEncoding = req.headers["accept-encoding"];
    const clientAcceptsBrotli = typeof acceptEncoding === "string" && acceptEncoding.includes("br");
    if (!clientAcceptsBrotli) { next(); return; }

    const brPath = path.join(staticDir, req.path + ".br");
    if (!fs.existsSync(brPath)) { next(); return; }

    const { size } = fs.statSync(brPath);
    res.set({
      "Content-Encoding": "br",
      "Content-Type": contentType,
      "Content-Length": String(size),
      "Accept-Ranges": "none",
      "Vary": "Accept-Encoding",
    });

    if (req.method === "HEAD") { res.end(); return; }

    fs.createReadStream(brPath).pipe(res);
  };
}
