import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { mockupPreviewPlugin } from "./mockupPreviewPlugin";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
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

export default defineConfig({
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
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
