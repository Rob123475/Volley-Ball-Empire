import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/authMiddleware";
import { precompressedUnityAssets } from "./middlewares/precompressedUnityAssets";
import path from "path";
import fs from "fs";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// `origin: true` reflects whatever Origin the request carries, so with
// credentials enabled ANY page open in the player's normal browser could make
// authenticated calls to the game server on localhost while the game is
// running. The packaged app serves its own frontend same-origin from this very
// server, so it needs no cross-origin access at all; dev keeps the loose
// setting for the standalone Vite dev server on a different port.
app.use(
  process.env.NODE_ENV === "production"
    ? cors({ credentials: true, origin: false })
    : cors({ credentials: true, origin: true }),
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

app.use("/api", router);
if (process.env.NODE_ENV === "production") {
  // PUBLIC_DIR is set explicitly by electron/main.js, computed the same
  // reliable way as the server-entry and DB paths. process.resourcesPath is
  // no longer used as the primary source here — it was observed to resolve
  // inconsistently across launches inside a forked child process. Still
  // falls back to the old logic for non-Electron production use (e.g. if
  // this server is ever run standalone without the desktop wrapper).
  const staticDir = process.env.PUBLIC_DIR || path.join((process as any).resourcesPath ?? __dirname, "public");
  console.log(`[static-debug] PUBLIC_DIR=${process.env.PUBLIC_DIR} staticDir=${staticDir} exists=${fs.existsSync(staticDir)}`);

  if (fs.existsSync(staticDir)) {
    app.use(precompressedUnityAssets(staticDir));
    app.use(express.static(staticDir));

    // The page's own routes (/court, /settings/rules) get the page. A file that
    // is not there (a last path segment with an extension) is a 404, never the
    // page: 1.2 demo, 27 Nov, the court asked for commentary clips not yet
    // recorded, got index.html with a 200, and the browser's failed decode of it
    // as audio stopped the court (CommentaryManager now asks only for its list).
    app.get(/^(?!\/api).*/, (req, res) => {
      if (/\.[A-Za-z0-9]+$/.test(req.path)) { res.status(404).end(); return; }
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }
}
export default app;
