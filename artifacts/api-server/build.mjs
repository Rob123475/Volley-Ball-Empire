import { createRequire, builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm, cp, mkdir, realpath, readFile, rename } from "node:fs/promises";
import { openSync, closeSync, existsSync, readdirSync } from "node:fs";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

// A handful of the `external` packages below are externalized because they're
// native addons or do dynamic/path-traversal loading esbuild can't bundle —
// but electron-builder's extraResources only ships dist/, so anything actually
// installed+imported among them needs its runtime files copied in by hand.
// Most of the external list is speculative ("in case we add it later") with
// nothing installed to vendor; only list packages here once you've confirmed
// (e.g. `grep` the actual imports in src/) that they're really used.
// @google-cloud/storage was dropped along with lib/objectStorage.ts and the
// storage router (it built a GCS client at import time pointed at the Replit
// sidecar, dead on a player machine). Vendoring a dependency that is no longer
// installed fails the build.
const EXTERNAL_DEPS_TO_VENDOR = ["better-sqlite3"];

// IMPORTANT (native ABI): better-sqlite3's compiled addon must be built for
// Electron's Node ABI, not the system Node used to run this build script.
// pnpm dedupes better-sqlite3 to one physical file in the pnpm store shared by
// every consumer (api-server, lib/db, scripts) — `pnpm electron:build` rebuilds
// that one file for Electron's ABI via @electron/rebuild, but a plain
// `pnpm install` or any system-Node script touching better-sqlite3 rebuilds it
// back to system-Node's ABI, silently breaking the packaged app. Always run
// `pnpm electron:build` immediately before packaging (never `pnpm install`
// afterward) and re-verify the shipped binary's ABI post-package.

// Resolves a package's real root directory the same way Node would search
// for it at runtime from `fromDir` (following pnpm's symlinked store layout
// via realpath in the caller) — using require.resolve.paths() to get the
// candidate node_modules directories and checking the filesystem directly,
// rather than require.resolve() itself. Some packages (e.g.
// @google-cloud/storage, xml-naming) have an "exports" map that blocks
// resolving "./package.json" or even the bare specifier, but the package
// still needs to be found and vendored wholesale.
function resolvePackageRoot(name, req) {
  const searchPaths = req.resolve.paths(name) ?? [];
  for (const base of searchPaths) {
    const candidate = path.join(base, name);
    if (existsSync(path.join(candidate, "package.json"))) {
      return candidate;
    }
  }
  throw new Error(`Could not locate package.json for "${name}" (searched ${searchPaths.length} node_modules dirs)`);
}

// Non-runtime cruft to prune while vendoring: nested private dep trees (we
// flatten dependencies ourselves, see below), test fixtures, native-addon
// build intermediates (obj/) and debug symbols (.pdb/.iobj/.ipdb/.exp/.lib),
// and source maps (never require()'d).
const PRUNE_DIR_NAMES = new Set(["node_modules", "test", "tests", "__tests__", "obj"]);
const PRUNE_EXTENSIONS = new Set([".pdb", ".iobj", ".ipdb", ".exp", ".lib", ".map"]);
const BUILTINS = new Set(builtinModules);

// Copies a package's real directory into dist/node_modules, then recurses
// into its declared `dependencies` (resolved from *its own* directory, so the
// chain follows pnpm's actual resolution path hop by hop) — flattening the
// whole runtime dependency closure into one self-contained node_modules next
// to index.mjs, since the packaged app has no pnpm store to resolve against.
async function vendorPackageTree(name, fromDir, distDir, visited) {
  if (visited.has(name)) return;
  visited.add(name);

  const req = createRequire(path.join(fromDir, "package.json"));
  const realDir = await realpath(resolvePackageRoot(name, req));

  const destDir = path.join(distDir, "node_modules", name);
  await rm(destDir, { recursive: true, force: true });
  await mkdir(destDir, { recursive: true });
  await cp(realDir, destDir, {
    recursive: true,
    dereference: true,
    filter: (src) => {
      const rel = path.relative(realDir, src);
      if (rel === "") return true;
      const parts = rel.split(path.sep);
      if (parts.some((p) => PRUNE_DIR_NAMES.has(p))) return false;
      return !PRUNE_EXTENSIONS.has(path.extname(rel));
    },
  });

  const pkgJson = JSON.parse(await readFile(path.join(realDir, "package.json"), "utf8"));
  for (const dep of Object.keys(pkgJson.dependencies ?? {})) {
    // Some packages list Node builtins (buffer, string_decoder, ...) as a
    // dependency for browser-polyfill fallback; in real Node these resolve to
    // the builtin regardless, and there's usually no npm package to vendor.
    if (BUILTINS.has(dep)) continue;
    try {
      await vendorPackageTree(dep, realDir, distDir, visited);
    } catch (err) {
      console.warn(`[vendor] WARNING: couldn't vendor transitive dep "${dep}" of "${name}": ${err.message}`);
    }
  }
}

async function vendorExternalDeps(distDir) {
  const visited = new Set();
  for (const name of EXTERNAL_DEPS_TO_VENDOR) {
    await vendorPackageTree(name, artifactDir, distDir, visited);
  }
}

import { execFileSync } from "node:child_process";

// The write-boundary guard runs before the bundle is produced: a build that
// ships a raw untyped write is worse than a build that fails.
function checkWriteBoundaries() {
  execFileSync(process.execPath,
    [path.join(import.meta.dirname, "..", "..", "scripts", "check-write-boundaries.cjs")],
    { stdio: "inherit" });
}

/**
 * Refuse to start while something is running the built server.
 *
 * Windows keeps a loaded native addon open, so any attempt to replace dist/
 * fails with EPERM partway through — after the old build is already gone. We
 * used to discover that by wiping dist/ and then hitting the error. It is one
 * check, and it costs nothing to do it first.
 *
 * Opening the .node for WRITE is the test that actually works: a loaded addon
 * is mapped in a way that permits further readers, so "r" succeeds even while
 * the app holds it and would tell us nothing. "r+" throws EBUSY. Nothing is
 * written — the handle is closed immediately — and no rename/unlink trick is
 * needed, so there is no state to restore if this process dies mid-check.
 */
function assertDistUnlocked(distDir) {
  const nodeModules = path.join(distDir, "node_modules");
  if (!existsSync(nodeModules)) return; // nothing vendored yet, nothing to lock

  const addons = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".node")) addons.push(full);
    }
  })(nodeModules);

  for (const addon of addons) {
    try {
      closeSync(openSync(addon, "r+"));
    } catch (err) {
      if (err.code !== "EBUSY" && err.code !== "EPERM" && err.code !== "EACCES") throw err;
      const line = "!".repeat(64);
      console.error("");
      console.error(line);
      console.error("  CLOSE THE APP FIRST - build not started");
      console.error(line);
      console.error("");
      console.error(`  ${path.relative(distDir, addon)} is locked (${err.code}).`);
      console.error("  Something is running the built server and holding it open,");
      console.error("  usually the game itself. Nothing has been changed.");
      console.error("");
      console.error("    taskkill /IM electron.exe /F");
      console.error("");
      console.error("  Closing the window is normally enough; use the command above");
      console.error("  if the process outlived it.");
      console.error(line);
      process.exit(1);
    }
  }
}

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  // dist/ used to be wiped as the FIRST step, so any later failure — a lock, a
  // bad vendor resolve, a compile error — left no server bundle and no frontend
  // at all, and the app was less runnable after a failed build than before it.
  // A failure must cost nothing.
  //
  // The obvious fix, building into dist.building/ and renaming it into place,
  // does NOT work here: esbuild-plugin-pino bakes the ABSOLUTE path of its
  // worker files into the bundle, so after the rename the server starts and
  // dies on "Cannot find module .../dist.building/thread-stream-worker.mjs".
  // Anything that embeds its own output path rules out a build-elsewhere-then-
  // move strategy.
  //
  // So the build still happens at the real path, and it is the PREVIOUS build
  // that moves aside. On success the backup is dropped; on any failure it is
  // put back, leaving dist/ exactly as it was.
  const backupDir = path.resolve(artifactDir, "dist.prev");

  assertDistUnlocked(distDir);
  await rm(backupDir, { recursive: true, force: true });
  const hadPrevious = existsSync(distDir);
  if (hadPrevious) await rename(distDir, backupDir);

  try {
    await buildInto(distDir);
  } catch (err) {
    // Roll back to the previous build, then let the failure surface.
    await rm(distDir, { recursive: true, force: true });
    if (hadPrevious) await rename(backupDir, distDir);
    throw err;
  }

  await rm(backupDir, { recursive: true, force: true });
}

async function buildInto(distDir) {
  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    // Some packages may not be bundleable, so we externalize them, we can add more here as needed.
    // Some of the packages below may not be imported or installed, but we're adding them in case they are in the future.
    // Examples of unbundleable packages:
    // - uses native modules and loads them dynamically (e.g. sharp)
    // - use path traversal to read files (e.g. @google-cloud/secret-manager loads sibling .proto files)
    external: [
      "*.node",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "re2",
      "farmhash",
      "xxhash-addon",
      "bufferutil",
      "utf-8-validate",
      "ssh2",
      "cpu-features",
      "dtrace-provider",
      "isolated-vm",
      "lightningcss",
      "pg-native",
      "oracledb",
      "mongodb-client-encryption",
      "nodemailer",
      "handlebars",
      "knex",
      "typeorm",
      "protobufjs",
      "onnxruntime-node",
      "@tensorflow/*",
      "@prisma/client",
      "@mikro-orm/*",
      "@grpc/*",
      "@swc/*",
      "@aws-sdk/*",
      "@azure/*",
      "@opentelemetry/*",
      "@google-cloud/*",
      "@google/*",
      "googleapis",
      "firebase-admin",
      "@parcel/watcher",
      "@sentry/profiling-node",
      "@tree-sitter/*",
      "aws-sdk",
      "classic-level",
      "dd-trace",
      "ffi-napi",
      "grpc",
      "hiredis",
      "kerberos",
      "leveldown",
      "miniflare",
      "mysql2",
      "newrelic",
      "odbc",
      "piscina",
      "realm",
      "ref-napi",
      "rocksdb",
      "sass-embedded",
      "sequelize",
      "serialport",
      "snappy",
      "tinypool",
      "usb",
      "workerd",
      "wrangler",
      "zeromq",
      "zeromq-prebuilt",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron",
    ],
    sourcemap: "linked",
    plugins: [
      // pino relies on workers to handle logging, instead of externalizing it we use a plugin to handle it
      esbuildPluginPino({ transports: ["pino-pretty"] })
    ],
    // Make sure packages that are cjs only (e.g. express) but are bundled continue to work in our esm output file
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  });

  checkWriteBoundaries();
  await vendorExternalDeps(distDir);
}

// esbuild prints its own bundle summary ending in a cheerful "Done in NNNms"
// BEFORE the vendoring step runs, so a failure after that point scrolls in
// underneath a line that reads like success. Anyone tailing the output — or
// reading $? from a pipeline, which reports the LAST command's status, not
// node's — concludes the build passed when it did not. So: fail with a banner
// that cannot be mistaken for anything else, and print an explicit success
// line as the final word, so its absence is itself the signal.
buildAll().then(
  () => {
    console.log("");
    console.log("=".repeat(64));
    console.log("  BUILD OK - bundle written and all external deps vendored");
    console.log("=".repeat(64));
  },
  (err) => {
    const line = "!".repeat(64);
    console.error("");
    console.error(line);
    console.error("  BUILD FAILED - the bundle summary above is NOT success");
    console.error(line);
    console.error("");
    console.error(err && err.stack ? err.stack : String(err));
    console.error("");
    // A locked native addon is not a build bug, and the raw EPERM does not say
    // so. assertDistUnlocked() should now catch this before any work starts,
    // so reaching here means a process took the lock DURING the build — the
    // swap at the end hit it rather than the preflight. Still worth naming.
    if (String(err && err.code) === "EPERM" || /EPERM/.test(String(err && err.message))) {
      console.error("  This is a FILE LOCK, not a compile error.");
      console.error("");
      console.error("  Something is running the built server and holding");
      console.error("  dist/node_modules/better-sqlite3 open - usually the app");
      console.error("  itself. Close it and build again:");
      console.error("");
      console.error("    taskkill /IM electron.exe /F");
      console.error("");
    }
    console.error(line);
    console.error("  BUILD FAILED - exiting 1");
    console.error(line);
    process.exit(1);
  },
);
