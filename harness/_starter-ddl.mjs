// Scratch: bring lib/db/volleyball-empire.sqlite up to the schema (Part 10's scouting_jobs, Part 11's
// staff budget columns) with exactly the DDL ensureSchema writes, without the data a boot fills in.
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { forkServer, stopServer } from "./server-harness.mjs";
import { requireElectronBinary } from "./electron-binary.mjs";
const REPO = path.join(import.meta.dirname, "..");
const STARTER = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const work = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-ddl-"));
const copy = path.join(work, "booted.sqlite");
fs.copyFileSync(STARTER, copy);
const port = 4457;
const child = forkServer({ server: path.join(REPO, "artifacts", "api-server", "dist", "index.mjs"), electron: requireElectronBinary(REPO), out: fs.openSync(path.join(work, "server.log"), "w"),
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: copy, PORT: String(port), NODE_ENV: "development", SESSION_SECRET: "ddl" } });
for (let i = 0; i < 240; i++) { try { if ((await fetch(`http://localhost:${port}/api/healthz`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 250)); }
await stopServer(child);
const booted = new DatabaseSync(copy, { readOnly: true });
const starter = new DatabaseSync(STARTER);
const objs = (d) => new Map(d.prepare(`SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL`).all().map((r) => [`${r.type}:${r.name}`, r]));
const have = objs(starter), want = objs(booted);
const applied = [];
// New tables first, then their indexes.
for (const kind of ["table", "index"]) for (const [k, r] of want) {
  if (r.type !== kind || have.has(k)) continue;
  starter.exec(r.sql); applied.push(r.sql.split("\n")[0]);
}
// New columns on tables both have.
for (const [k, r] of want) {
  if (r.type !== "table" || !have.has(k)) continue;
  const cols = new Set(starter.prepare(`PRAGMA table_info("${r.name}")`).all().map((c) => c.name));
  for (const c of booted.prepare(`PRAGMA table_info("${r.name}")`).all()) {
    if (cols.has(c.name)) continue;
    const ddl = `ALTER TABLE "${r.name}" ADD COLUMN "${c.name}" ${c.type}${c.notnull ? " NOT NULL" : ""}${c.dflt_value != null ? ` DEFAULT ${c.dflt_value}` : ""}`;
    starter.exec(ddl); applied.push(ddl);
  }
}
starter.close(); booted.close();
console.log(applied.length ? applied.join("\n") : "nothing to apply");
