import { defineConfig } from "vite";
import type { UserConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { mockupPreviewPlugin } from "./mockupPreviewPlugin";

/**
 * The dev server's port.
 *
 * Required to SERVE, never to BUILD. `port` feeds `server.port` and
 * `preview.port` and nothing else — `vite build` binds no socket and never
 * reads it. It used to be validated at module load, which meant a bare
 * `pnpm run build` threw
 *
 *   Error: PORT environment variable is required but was not provided.
 *
 * before compiling a line. Nothing in the repo supplied a value: there is no
 * .env, and the only PORT= in version control is an editor's saved permission
 * entry. So the documented one-command build could not be run as documented —
 * and because the throw happened in the FIRST workspace project, `pnpm -r`
 * aborted the whole run, taking `sync:public` and `test:harness` with it. The
 * five-suite harness this project relies on to prove itself never executed,
 * and the failure said nothing about that.
 *
 * A build must not demand a dev-server setting. Serving still does.
 */
function resolvePort(command: "build" | "serve"): number | undefined {
  if (command !== "serve") return undefined;

  const raw = process.env.PORT;
  if (!raw) {
    throw new Error(
      "PORT environment variable is required to run the dev server or preview. " +
        "It is NOT required to build.",
    );
  }

  const port = Number(raw);
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: ${JSON.stringify(raw)}`);
  }
  return port;
}

// Same contract as artifacts/beach-volleyball/vite.config.ts — see the long
// note there for why. Kept in step deliberately: if this one still demanded
// BASE_PATH on the command line, every full build would go on passing
// `BASE_PATH=/`, and Git Bash would go on rewriting it into a Windows path.
// Defaulting one config and not the other would leave the hazard in place.
const rawBasePath = process.env.BASE_PATH;
const basePath = rawBasePath === undefined || rawBasePath === "" ? "/" : rawBasePath;

if (!basePath.startsWith("/")) {
  throw new Error(
    `BASE_PATH must be a URL path starting with "/", got ${JSON.stringify(basePath)}. ` +
      `Leave it unset for the default "/".`,
  );
}

if (!/^\/[A-Za-z0-9._~\-/]*$/.test(basePath)) {
  throw new Error(
    `BASE_PATH is not a usable URL path: ${JSON.stringify(basePath)}. ` +
      `A value like "/Program Files/Git/" means MSYS rewrote your "/" — prefix ` +
      `the command with MSYS_NO_PATHCONV=1, or leave BASE_PATH unset (default "/").`,
  );
}

export default defineConfig(async ({ command }): Promise<UserConfig> => ({
  base: basePath,
  plugins: [
    mockupPreviewPlugin(),
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port: resolvePort(command),
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port: resolvePort(command),
    host: "0.0.0.0",
    allowedHosts: true,
  },
}));
