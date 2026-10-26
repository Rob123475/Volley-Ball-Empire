// Scratch: smoke then rollover on ONE server and database, exactly as run-all runs them, to time rollover after smoke.
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { spawnSync } from "node:child_process";
import { forkServer, stopServer } from "./server-harness.mjs";
import { requireElectronBinary } from "./electron-binary.mjs";
const REPO = path.join(import.meta.dirname, "..");
const work = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-smoke-roll-"));
const db = path.join(work, "smoke.sqlite");
fs.copyFileSync(path.join(REPO, "lib", "db", "volleyball-empire.sqlite"), db);
const port = 4459;
const env = { ...process.env, VBE_STAFF_ABSENCES: "off", VBE_STAFF_BUDGET: "off" };
const child = forkServer({ server: path.join(REPO, "artifacts", "api-server", "dist", "index.mjs"), electron: requireElectronBinary(REPO), out: fs.openSync(path.join(work, "server.log"), "w"),
  env: { ...env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: db, PORT: String(port), NODE_ENV: "development", SESSION_SECRET: "harness-smoke-secret" } });
for (let i = 0; i < 120; i++) { try { await fetch(`http://localhost:${port}/api/health`); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
for (const suite of (process.env.SUITES ?? "smoke.mjs,rollover.mjs").split(",")) {
  console.log(`\n### ${suite} start ${new Date().toISOString()}`);
  spawnSync(process.execPath, [path.join(REPO, "harness", suite), `http://localhost:${port}`, db], { stdio: "inherit", cwd: REPO, env });
  console.log(`### ${suite} end ${new Date().toISOString()}`);
}
await stopServer(child);
console.log(`db kept: ${db}`);
