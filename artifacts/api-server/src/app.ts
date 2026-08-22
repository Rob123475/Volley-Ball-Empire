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
app.use(cors({ credentials: true, origin: true }));
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

    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }
}
export default app;
