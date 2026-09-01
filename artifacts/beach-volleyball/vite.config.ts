import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import type { Plugin, UserConfig } from "vite";

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

/**
 * The public base path baked into index.html's asset URLs.
 *
 * Defaults to "/" so nobody has to pass it on the command line. It used to be
 * mandatory, which meant every build began with `BASE_PATH=/ ...` — and in Git
 * Bash on Windows, MSYS rewrites a bare "/" into the shell's install prefix.
 * The build then succeeded, exit 0, and emitted:
 *
 *   <script src="/Program Files/Git/assets/index-abc123.js">
 *
 * Nothing served that path, so the server's SPA catch-all answered with
 * index.html — 200, text/html — the browser refused to execute an HTML
 * document as a module, and the app was a white screen with a clean build log.
 *
 * So: a BASE_PATH that is not a URL path now aborts the build. A Windows path
 * is never what anyone meant, and failing here is far cheaper than shipping an
 * artifact that looks fine and cannot boot.
 */
const rawBasePath = process.env.BASE_PATH;
const basePath = rawBasePath === undefined || rawBasePath === "" ? "/" : rawBasePath;

if (!basePath.startsWith("/")) {
  throw new Error(
    `BASE_PATH must be a URL path starting with "/", got ${JSON.stringify(basePath)}. ` +
      `Leave it unset for the default "/".`,
  );
}

if (basePath.includes(":") || basePath.includes("\\")) {
  throw new Error(
    `BASE_PATH looks like a filesystem path, not a URL path: ${JSON.stringify(basePath)}. ` +
      `If you are in Git Bash on Windows, MSYS rewrote it — prefix the command with ` +
      `MSYS_NO_PATHCONV=1, or just leave BASE_PATH unset for the default "/".`,
  );
}

// The ":" and "\" tests above do NOT catch what actually happened here. MSYS
// rewrote a bare "/" into "/Program Files/Git/", which starts with a slash and
// contains neither character — it is a perfectly plausible-looking URL path.
// What gives it away is the whitespace, so the real guard is a positive one:
// the value must consist only of characters a URL path may safely carry.
if (!/^\/[A-Za-z0-9._~\-/]*$/.test(basePath)) {
  throw new Error(
    `BASE_PATH is not a usable URL path: ${JSON.stringify(basePath)}. ` +
      `Expected only letters, digits, "." "_" "~" "-" and "/". ` +
      `A value like "/Program Files/Git/" means MSYS rewrote your "/" — prefix ` +
      `the command with MSYS_NO_PATHCONV=1, or leave BASE_PATH unset (default "/").`,
  );
}

// Unity WebGL files need explicit MIME types that sirv doesn't know.
// We inject headers before sirv runs so it won't override them.
const unityMimePlugin: Plugin = {
  name: "unity-webgl-mime-types",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = req.url ?? "";
      if (url.includes("/unity-build/")) {
        if (url.endsWith(".data")) {
          res.setHeader("Content-Type", "application/octet-stream");
          // Allow range requests so large downloads resume properly
          res.setHeader("Accept-Ranges", "bytes");
        } else if (url.endsWith(".wasm")) {
          res.setHeader("Content-Type", "application/wasm");
        } else if (url.endsWith(".js")) {
          res.setHeader("Content-Type", "application/javascript");
        }
      }
      next();
    });
  },
};

export default defineConfig(async ({ command }): Promise<UserConfig> => ({
  base: basePath,
  plugins: [
    unityMimePlugin,
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
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: resolvePort(command),
    strictPort: true,
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
