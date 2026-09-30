/**
 * Overnight brief 30 Sep, item 26 — the ledger in plain words, scouting filed right.
 *
 * Rob, 30 Sep: Transaction History showed codes (PRIZE_MONEY, STAFF_SALARY,
 * RUNNING_COSTS); a scouting mission was filed as YOUTH_ACADEMY.
 *
 * Asserted: every category the server writes on the ledger (read from the
 * server's own code) has plain words in the UI's table (lib/ledger-categories.ts,
 * compiled as the UI compiles it), none of them a code; Transaction History
 * shows those words, not the stored code; a scouting mission and the old
 * youth scouting trip are filed as scouting; on a copy of Rob's 30 Sep save
 * (skipped when absent) his Europe mission's line is refiled as scouting at
 * boot, and a second boot has nothing to refile.
 *
 * Usage: node harness/ledger-words.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const ROB = path.join(os.homedir(), "Downloads", "volleyball-empire-backup-30sep-0921.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const PORT = 4938;
const BASE = `http://localhost:${PORT}/api`;
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-ledger-words-"));
let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  OVERNIGHT 30 SEP, 26: THE LEDGER IN PLAIN WORDS, SCOUTING FILED RIGHT");
console.log("=".repeat(72));

const esbuild = createRequire(path.join(REPO, "artifacts", "api-server", "package.json"))("esbuild");
const out = path.join(WORK, "labels.mjs");
esbuild.buildSync({ entryPoints: [path.join(REPO, "artifacts/beach-volleyball/src/lib/ledger-categories.ts")], outfile: out, format: "esm", bundle: true, logLevel: "silent" });
const { LEDGER_CATEGORY_LABELS, ledgerCategoryLabel } = await import(pathToFileURL(out).href);

// Every category a ledger row is written with: a `category:` beside a `type:` of expense or income.
const written = new Set();
const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith(".ts")) {
  const s = fs.readFileSync(p, "utf8");
  for (const m of s.matchAll(/category:\s*"([a-z_]+)"/g)) { const before = s.slice(Math.max(0, m.index - 500), m.index); if (/type:\s*"(expense|income)"/.test(before)) written.add(m[1]); }
} } };
walk(path.join(REPO, "artifacts/api-server/src"));
const missing = [...written].filter((c) => !LEDGER_CATEGORY_LABELS[c]);
const codeLike = Object.values(LEDGER_CATEGORY_LABELS).filter((l) => /_|^[A-Z_]+$/.test(l));
check("every category the server writes has plain words, none a code", written.size >= 12 && missing.length === 0 && codeLike.length === 0,
  `${written.size} categories: ${[...written].map((c) => `${c} -> ${ledgerCategoryLabel(c)}`).join(", ")}${missing.length ? `; no words: ${missing.join(", ")}` : ""}`);
check("an unknown code still reads as words", ledgerCategoryLabel("some_new_thing") === "Some new thing");
const fin = fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/pages/finances.tsx"), "utf8");
check("Transaction History shows the words, not the stored code", /\{ledgerCategoryLabel\(t\.category\)\}/.test(fin) && !/>\{t\.category\}</.test(fin));
const cont = fs.readFileSync(path.join(REPO, "artifacts/api-server/src/routes/continental-scouting.ts"), "utf8");
const youth = fs.readFileSync(path.join(REPO, "artifacts/api-server/src/routes/youth-scouting.ts"), "utf8");
check("a scouting mission and the old youth scouting trip are filed as scouting",
  /description: `Continental scouting — [^`]*`,\s*category:\s*"scouting"/.test(cont) && /description: `Youth scouting — [^`]*`,\s*category:\s*"scouting"/.test(youth));

if (!fs.existsSync(ROB)) console.log(`  NOTE  ${ROB} not on this machine: the refile check is skipped`);
else {
  const dbFile = path.join(WORK, "rob.sqlite");
  fs.copyFileSync(ROB, dbFile);
  const q = (sql) => { const d = new DatabaseSync(dbFile, { readOnly: true }); try { return d.prepare(sql).all(); } finally { d.close(); } };
  const before = q(`SELECT category FROM finance_transactions WHERE description LIKE 'Continental scouting — %'`);
  const boot = async (log) => {
    const fd = fs.openSync(path.join(WORK, log), "w");
    const child = forkServer({ server: SERVER, electron: requireElectronBinary(REPO), out: fd,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "ledger", STARTER_DB_PATH: SHIPPED } });
    for (let i = 0; i < 360; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }
    await new Promise((r) => setTimeout(r, 1000));
    try { await stopServer(child); } catch { /* stopped */ }
    try { fs.closeSync(fd); } catch { /* closed */ }
  };
  await boot("boot1.log");
  const after = q(`SELECT category FROM finance_transactions WHERE description LIKE 'Continental scouting — %'`);
  check("Rob's save: his Europe mission's line is refiled as scouting", before.length > 0 && before.every((r) => r.category === "youth_academy") && after.every((r) => r.category === "scouting"),
    `${before.map((r) => r.category).join(",")} -> ${after.map((r) => r.category).join(",")}`);
  await boot("boot2.log");
  check("a second boot has nothing to refile", !/refiled from youth academy/.test(fs.readFileSync(path.join(WORK, "boot2.log"), "utf8")));
}
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
