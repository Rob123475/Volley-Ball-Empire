#!/usr/bin/env node
/**
 * Guard: building must never require a dev-server setting.
 *
 * `pnpm run build` was unrunnable as documented. Both vite configs read PORT at
 * module load and threw before compiling anything:
 *
 *   Error: PORT environment variable is required but was not provided.
 *
 * Nothing in the repo supplied one — no .env, and the only PORT= in version
 * control is an editor's saved permission entry. Every green build in this
 * project's history came from someone typing PORT=<n> in front of the command.
 *
 * The expensive part was not the failure, it was WHERE it failed. The chain is
 *
 *   build = typecheck && -r build && sync:public && test:harness
 *
 * and the throw landed in the first workspace project `pnpm -r` reached, so the
 * recursive run aborted and took the last two steps with it. The frontend was
 * never copied to where the server serves it from, and the five-suite harness
 * never ran. A build that stops before its own safety net looks identical to a
 * build that ran and passed, if all you check afterwards is the exit code.
 *
 * ── Why this guard clears PORT itself ──────────────────────────────────────
 *
 * The regression is invisible to anyone whose shell happens to export PORT, and
 * that is exactly the person most likely to reintroduce it. So this check does
 * not trust the ambient environment: it DELETES PORT before loading each config
 * and asserts the build path resolves anyway. The result is the same on a fresh
 * clone, on a CI runner, and in a terminal that has had PORT set all day.
 *
 * ── Why it also asserts the opposite ───────────────────────────────────────
 *
 * "Build no longer needs PORT" is trivially satisfiable by deleting the check
 * altogether, which would silently un-guard the dev server: `vite dev` would
 * bind an arbitrary port, the frontend would come up somewhere the API proxy is
 * not, and that failure is much harder to read than a missing variable. So the
 * serve path is asserted too — it MUST still refuse to start without PORT, and
 * MUST still honour a valid one. A guard that only tests the permissive
 * direction goes inert the moment someone removes what it was guarding.
 *
 * Each config is loaded through vite's own loader, so this exercises the real
 * file rather than a copy of its logic.
 *
 * Run: node scripts/check-build-env.mjs
 */
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const REPO = path.join(import.meta.dirname, "..");
const TAG = "[check-build-env]";

/** Every workspace artifact that carries a vite config. */
const ARTIFACTS = ["beach-volleyball", "mockup-sandbox"];

const failures = [];
function fail(msg) {
  failures.push(msg);
  console.error(`${TAG}   FAIL  ${msg}`);
}
function pass(msg) {
  console.log(`${TAG}   ok    ${msg}`);
}

/** Load a vite config with a controlled PORT, restoring the environment after. */
async function loadWith(vite, dir, configFile, command, portValue) {
  const had = Object.prototype.hasOwnProperty.call(process.env, "PORT");
  const previous = process.env.PORT;

  if (portValue === undefined) delete process.env.PORT;
  else process.env.PORT = portValue;

  try {
    return await vite.loadConfigFromFile(
      { command, mode: command === "build" ? "production" : "development" },
      configFile,
      dir,
      "silent",
    );
  } finally {
    if (had) process.env.PORT = previous;
    else delete process.env.PORT;
  }
}

for (const name of ARTIFACTS) {
  const dir = path.join(REPO, "artifacts", name);
  const configFile = path.join(dir, "vite.config.ts");

  if (!fs.existsSync(configFile)) {
    fail(`${name}: vite.config.ts not found at ${configFile}`);
    continue;
  }

  // Resolve vite from the artifact itself — pnpm does not hoist it to the root.
  let vite;
  try {
    const require = createRequire(path.join(dir, "package.json"));
    vite = await import(pathToFileURL(require.resolve("vite")).href);
  } catch (err) {
    fail(`${name}: could not resolve vite from the artifact (${err.message})`);
    continue;
  }

  console.log(`${TAG} ${name}`);

  // 1. THE REGRESSION. Building with no PORT in the environment must work.
  try {
    const loaded = await loadWith(vite, dir, configFile, "build", undefined);
    if (!loaded?.config) {
      fail(`${name}: build config resolved to nothing`);
    } else if (loaded.config.server?.port !== undefined) {
      fail(
        `${name}: build config pinned server.port to ${loaded.config.server.port} ` +
          `with PORT unset — a build must not resolve a dev-server port`,
      );
    } else {
      pass("builds with PORT unset");
    }
  } catch (err) {
    fail(
      `${name}: building with PORT unset threw — this is the exact regression ` +
        `this guard exists for.\n          ${String(err.message).split("\n")[0]}`,
    );
  }

  // 2. THE OPPOSITE. Serving with no PORT must still be refused, or the guard
  //    above has been satisfied by removing the requirement rather than scoping
  //    it.
  let refused = false;
  try {
    await loadWith(vite, dir, configFile, "serve", undefined);
  } catch (err) {
    refused = /PORT/.test(String(err.message));
    if (!refused) {
      fail(`${name}: serving without PORT failed for an unrelated reason: ${err.message}`);
    }
  }
  if (refused) pass("still refuses to serve without PORT");
  else if (!failures.some((f) => f.startsWith(`${name}: serving`))) {
    fail(
      `${name}: serving with PORT unset was ALLOWED. The dev server would bind ` +
        `an arbitrary port and the frontend would come up where the API is not.`,
    );
  }

  // 3. A valid PORT must still reach the dev server.
  try {
    const loaded = await loadWith(vite, dir, configFile, "serve", "5173");
    if (loaded?.config?.server?.port !== 5173) {
      fail(
        `${name}: PORT=5173 produced server.port=${loaded?.config?.server?.port} ` +
          `— the value is no longer wired through`,
      );
    } else {
      pass("honours a valid PORT when serving");
    }
  } catch (err) {
    fail(`${name}: serving with a valid PORT threw: ${err.message}`);
  }
}

if (failures.length > 0) {
  console.error(
    `\n${TAG} FAILED (${failures.length}).\n` +
      `  Building must not require PORT; serving must. See the note at the top\n` +
      `  of this file and artifacts/*/vite.config.ts.`,
  );
  process.exit(1);
}

console.log(`${TAG} OK - build needs no PORT, serve still demands one`);
