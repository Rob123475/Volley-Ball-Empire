#!/usr/bin/env node
/**
 * Put the built frontend where the server will actually serve it from.
 *
 * artifacts/api-server/build.mjs wipes its whole dist/ on every build, and
 * nothing ever put dist/public back. In an unpackaged run electron/main.js
 * points PUBLIC_DIR at artifacts/api-server/dist/public, so after any
 * api-server build the app started cleanly, logged nothing wrong, and served
 * "Cannot GET /" — Express's own 404, which looks like a routing bug rather
 * than a missing directory.
 *
 * That is the silent-success pattern this project has spent weeks removing: a
 * process that exits 0 having produced something broken. So this runs as a
 * build step and FAILS the build rather than leaving a 404 to be discovered by
 * launching the app.
 *
 * It runs AFTER all workspace builds, not inside build.mjs, because pnpm -r
 * does not guarantee the frontend is built before the api-server. Copying from
 * inside build.mjs would either deadlock a clean checkout or silently copy a
 * stale frontend, which is worse than copying none.
 *
 * Run: node scripts/sync-public.cjs
 */
const fs = require("fs");
const path = require("path");

const REPO = path.join(__dirname, "..");
const SRC = path.join(REPO, "artifacts", "beach-volleyball", "dist", "public");
const DEST = path.join(REPO, "artifacts", "api-server", "dist", "public");

const bar = "!".repeat(72);
function fail(lines) {
  console.error("");
  console.error(bar);
  console.error("  FRONTEND NOT SERVED - the app would return 404 at /");
  console.error(bar);
  for (const l of lines) console.error("  " + l);
  console.error(bar);
  process.exit(1);
}

if (!fs.existsSync(path.join(SRC, "index.html"))) {
  fail([
    `No built frontend at ${path.relative(REPO, SRC)}`,
    "",
    "The frontend build produces it. vite needs PORT and BASE_PATH even for a",
    "one-shot build (see docs/packaging.md), so a bare `pnpm -r run build`",
    "without them leaves this missing:",
    "",
    "  PORT=5173 BASE_PATH=/ pnpm run build",
  ]);
}

fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(path.dirname(DEST), { recursive: true });
fs.cpSync(SRC, DEST, { recursive: true });

// Verify the RESULT, not the operation. cpSync succeeding is not evidence the
// server can serve an app from it.
const index = path.join(DEST, "index.html");
if (!fs.existsSync(index)) {
  fail([`Copy reported success but ${path.relative(REPO, index)} is not there.`]);
}

let files = 0;
(function count(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) count(path.join(dir, e.name));
    else files++;
  }
})(DEST);

if (files < 2) {
  fail([`Only ${files} file(s) copied — an index.html with no assets is not an app.`]);
}

console.log(
  `[sync-public] OK - ${files} files -> ${path.relative(REPO, DEST).split(path.sep).join("/")}`,
);
