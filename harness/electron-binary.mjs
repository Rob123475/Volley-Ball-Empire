/**
 * Where the Electron binary actually is, on whatever machine this is.
 *
 * The harness suites used to hardcode `node_modules/electron/dist/electron.exe`.
 * That is correct on Windows, which is the shipping platform, and wrong
 * everywhere else - the binary is `dist/electron` on Linux and
 * `dist/Electron.app/Contents/MacOS/Electron` on macOS. The failure is not a
 * clean "unsupported platform" message either; every suite dies with an
 * unhandled ENOENT from spawn, several screens of stack trace deep:
 *
 *   Error: spawn .../node_modules/electron/dist/electron.exe ENOENT
 *
 * which reads like a broken install rather than "this harness is Windows-only".
 *
 * The electron package already answers this: its postinstall writes
 * `path.txt` next to the module, containing the binary path relative to
 * `dist/` for the platform it just installed. Read that and the harness runs
 * anywhere, including CI and a Linux dev box, with no per-platform branching
 * to keep in sync.
 */
import fs from "node:fs";
import path from "node:path";

export function resolveElectronBinary(repoRoot) {
  const moduleDir = path.join(repoRoot, "node_modules", "electron");
  const pathTxt = path.join(moduleDir, "path.txt");

  if (fs.existsSync(pathTxt)) {
    const rel = fs.readFileSync(pathTxt, "utf8").trim();
    if (rel) {
      const resolved = path.join(moduleDir, "dist", rel);
      if (fs.existsSync(resolved)) return resolved;
    }
  }

  // path.txt missing or stale: fall back to the known per-platform layouts so
  // the caller still gets a real path to report rather than a bare ENOENT.
  const candidates =
    process.platform === "win32"
      ? ["electron.exe"]
      : process.platform === "darwin"
        ? ["Electron.app/Contents/MacOS/Electron"]
        : ["electron"];

  for (const c of candidates) {
    const p = path.join(moduleDir, "dist", c);
    if (fs.existsSync(p)) return p;
  }

  return path.join(moduleDir, "dist", candidates[0]);
}

/**
 * Resolve and fail loudly if it is not there, so a missing or half-finished
 * `pnpm install` says so in one line instead of an unhandled spawn error.
 */
export function requireElectronBinary(repoRoot, label = "[harness]") {
  const bin = resolveElectronBinary(repoRoot);
  if (!fs.existsSync(bin)) {
    console.error(
      `${label} FAILED: no Electron binary at ${bin}\n` +
        `${label} Run \`pnpm install\` (its postinstall downloads Electron for this platform).`,
    );
    process.exit(1);
  }
  return bin;
}
