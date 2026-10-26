// Scratch: run harness/smoke.mjs alone, on its own server and a copy of the shipped database (as run-all does).
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { spawnSync } from "node:child_process";
import { forkServer, stopServer } from "./server-harness.mjs";
import { requireElectronBinary } from "./electron-binary.mjs";
const REPO = path.join(import.meta.dirname, "..");
const work = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-smoke-alone-"));
const db = path.join(work, "smoke.sqlite");
fs.copyFileSync(path.join(REPO, "lib", "db", "volleyball-empire.sqlite"), db);
const port = 4456;
const child = forkServer({ server: path.join(REPO, "artifacts", "api-server", "dist", "index.mjs"), electron: requireElectronBinary(REPO), out: fs.openSync(path.join(work, "server.log"), "w"),
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: db, PORT: String(port), NODE_ENV: "development", SESSION_SECRET: "harness-smoke-secret", VBE_STAFF_ABSENCES: "off", VBE_STAFF_BUDGET: "off" } });
for (let i = 0; i < 120; i++) { try { await fetch(`http://localhost:${port}/api/health`); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
const r = spawnSync(process.execPath, [path.join(REPO, "harness", process.env.SUITE ?? "smoke.mjs"), `http://localhost:${port}`, db], { stdio: "inherit", cwd: REPO, env: { ...process.env, VBE_STAFF_ABSENCES: "off", VBE_STAFF_BUDGET: "off" } });
await stopServer(child);
process.exit(r.status ?? 1);
