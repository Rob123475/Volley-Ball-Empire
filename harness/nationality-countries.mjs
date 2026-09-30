/**
 * Overnight brief 30 Sep, item 11 — nationality is the country, everywhere.
 *
 * Rob, 30 Sep: doctors showed "British", "Australian"; everyone else
 * "Germany". The staff and medical market generators wrote demonyms, and so
 * did the AI clubs' pool players (academy players inherit theirs).
 *
 * Asserted with the game's own table of nations (continents.ts nationName,
 * compiled as the server compiles it):
 *   - the shipped database holds no demonym in any nationality column;
 *   - both staff generators' lists are country names;
 *   - the one sanctioned write for a new player or staff member stores the
 *     country whatever it is handed;
 *   - on a copy of Rob's 30 Sep save (skipped with a note when absent): after
 *     one boot no nationality anywhere is a demonym (it had them in staff and
 *     players), the boot log says what it converted, the Staff and Medical
 *     Markets list countries only, and a second boot converts nothing.
 *
 * Usage: node harness/nationality-countries.mjs
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
const PORT = 4933;
const BASE = `http://localhost:${PORT}/api`;
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-nations-"));
let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  OVERNIGHT 30 SEP, 11: NATIONALITY IS THE COUNTRY, EVERYWHERE");
console.log("=".repeat(72));

const esbuild = createRequire(path.join(REPO, "artifacts", "api-server", "package.json"))("esbuild");
const out = path.join(WORK, "continents.mjs");
esbuild.buildSync({ entryPoints: [path.join(REPO, "lib/db/src/schema/continents.ts")], outfile: out, format: "esm", bundle: true, logLevel: "silent" });
const { nationName } = await import(pathToFileURL(out).href);

const COLS = [["staff", "nationality"], ["players", "nationality"], ["continental_pool_players", "nationality"], ["youth_prospects", "nationality"], ["player_retirements", "nationality"], ["career_saves", "manager_nationality"]];
function demonymsIn(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  const hits = [];
  try {
    for (const [t, c] of COLS) {
      if (!db.prepare(`PRAGMA table_info("${t}")`).all().some((x) => x.name === c)) continue;
      for (const { v, n } of db.prepare(`SELECT "${c}" AS v, COUNT(*) AS n FROM "${t}" WHERE "${c}" IS NOT NULL GROUP BY "${c}"`).all()) {
        const k = nationName(v);
        if (k && k !== v) hits.push(`${t}: ${v} -> ${k} (${n})`);
      }
    }
  } finally { db.close(); }
  return hits;
}

const shipped = demonymsIn(SHIPPED);
check("the shipped database holds country names only", shipped.length === 0, shipped.slice(0, 5).join("; ") || "no demonyms");
const lists = ["staff-generator.ts", "medical-staff-generator.ts"].map((f) => {
  const s = fs.readFileSync(path.join(REPO, "artifacts/api-server/src/utils", f), "utf8");
  return [...(/const NATIONALITIES = \[([\s\S]*?)\];/.exec(s)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);
});
const notCountry = lists.flat().filter((n) => nationName(n) !== n);
check("both staff generators draw from country names", lists.every((l) => l.length > 10) && notCountry.length === 0, notCountry.join(", ") || `${lists[0].length} + ${lists[1].length}`);
const dto = fs.readFileSync(path.join(REPO, "artifacts/api-server/src/lib/playerDto.ts"), "utf8");
check("a new player or staff member is stored with the country, whatever spelling is handed in",
  (dto.match(/nationality: asCountry\(reference\.nationality\)/g) ?? []).length === 3 && /nationName\(nationality\) \?\? nationality/.test(dto));

if (!fs.existsSync(ROB)) {
  console.log(`  NOTE  ${ROB} is not on this machine: the existing-save checks are skipped`);
} else {
  const dbFile = path.join(WORK, "rob.sqlite");
  fs.copyFileSync(ROB, dbFile);
  const before = demonymsIn(dbFile);
  let cookie = "";
  const api = async (method, p, body) => {
    const res = await fetch(BASE + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    const t = await res.text(); try { return t ? JSON.parse(t) : null; } catch { return t; }
  };
  const boot = async (log) => {
    const o = fs.openSync(path.join(WORK, log), "w");
    const child = forkServer({ server: SERVER, electron: requireElectronBinary(REPO), out: o,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "nations", STARTER_DB_PATH: SHIPPED } });
    for (let i = 0; i < 360; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }
    return async () => { try { await stopServer(child); } catch { /* stopped */ } try { fs.closeSync(o); } catch { /* closed */ } };
  };
  let stop = await boot("boot1.log");
  try {
    const after = demonymsIn(dbFile);
    check("Rob's save: every demonym it held is now its country (staff, players, pool players)",
      before.length > 0 && after.length === 0, `before: ${before.length} value(s), e.g. ${before.slice(0, 4).join("; ")}; after: ${after.length}`);
    await new Promise((r) => setTimeout(r, 1000));
    check("the boot log says what it converted", /nationalities stored as demonyms converted to country names/.test(fs.readFileSync(path.join(WORK, "boot1.log"), "utf8")));
    const profiles = (await api("GET", "/profiles"))?.profiles ?? [];
    await api("POST", `/profiles/${profiles[0].id}/select`);
    const save = ((await api("GET", "/careers"))?.saves ?? []).find((s) => s.teamId != null);
    await api("POST", `/careers/${save.id}/load`);
    const cards = [...((await api("GET", "/staff/market")) ?? []), ...((await api("GET", "/medical-staff/market")) ?? [])];
    const odd = cards.filter((m) => m.nationality && nationName(m.nationality) !== m.nationality);
    check("the Staff and Medical Markets list countries only", cards.length > 20 && odd.length === 0,
      `${cards.length} cards; e.g. ${cards.slice(0, 4).map((m) => `${m.name}: ${m.nationality}`).join(", ")}${odd.length ? `; not countries: ${odd.map((m) => m.nationality).join(", ")}` : ""}`);
  } catch (err) {
    check("the run completed", false, String(err?.stack ?? err));
  } finally { await stop(); }
  stop = await boot("boot2.log");
  await stop();
  check("a second boot has nothing left to convert", !/demonyms converted/.test(fs.readFileSync(path.join(WORK, "boot2.log"), "utf8")));
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
