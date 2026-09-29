/**
 * D-6 — the game's money is dollars, and every amount a player sees says $.
 *
 * Rob, 29 Sep: the MATCH DAY box showed the prize as "€6,500"; the dashboard's
 * Next Match card "$6,500". Two places printed €: the box's prize, and the
 * clock's salary-week line ("Salary week: €… wages, €… sponsor income"),
 * which the server returns from every salary-week advance.
 *
 * Asserted: no € or £ in the client, the server, the shared schema, the
 * Electron shell or the starter database's text; the box prints its prize
 * with $; and a real salary week's line reads in dollars.
 *
 * Usage: node harness/currency.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-currency-"));
const PORT = 4915;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log("  D-6 EVERY AMOUNT IN DOLLARS");
console.log("=".repeat(72));

// ── Source ─────────────────────────────────────────────────────────────────
const OTHER = /[€£]|&euro;|&pound;|\\u20[aA][cC]|\\u00[aA]3|currency:\s*["'](?:EUR|GBP)["']/;
const hits = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === "dist") continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f);
    else if (/\.(tsx?|jsx?|mjs|cjs|html|json|css)$/.test(e.name)) {
      fs.readFileSync(f, "utf8").split("\n").forEach((l, i) => { if (OTHER.test(l)) hits.push(`${path.relative(REPO, f)}:${i + 1}`); });
    }
  }
};
for (const d of [["artifacts", "beach-volleyball", "src"], ["artifacts", "api-server", "src"], ["lib", "db", "src"], ["electron"]]) walk(path.join(REPO, ...d));
check("no € or £ anywhere in the client, server, shared schema or shell", hits.length === 0, hits.join(", "));

{
  const d = new DatabaseSync(SHIPPED, { readOnly: true });
  const found = [];
  for (const { name } of d.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()) {
    for (const c of d.prepare(`PRAGMA table_info("${name}")`).all()) {
      if (!/TEXT/i.test(c.type) && c.type !== "") continue;
      const n = d.prepare(`SELECT COUNT(*) AS n FROM "${name}" WHERE "${c.name}" LIKE '%€%' OR "${c.name}" LIKE '%£%'`).get().n;
      if (n) found.push(`${name}.${c.name} (${n})`);
    }
  }
  d.close();
  check("no € or £ in the starter database's text", found.length === 0, found.join(", "));
}

const modal = fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", "components", "match-day-modal.tsx"), "utf8");
check("the MATCH DAY box prints its prize in dollars", /\$\{?Number\(match\.prizeAmount\)\.toLocaleString\(\)/.test(modal) || /formatMoney\(match\.prizeAmount\)/.test(modal),
  (modal.match(/.*prizeAmount\).*/) ?? [""])[0].trim());

// ── A real salary week ─────────────────────────────────────────────────────
if (!fs.existsSync(SERVER)) { console.error(`[currency] FAILED: ${SERVER} not built.`); process.exit(1); }
let cookie = "";
async function api(method, p, body) {
  const res = await fetch(BASE + p, {
    method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const text = await res.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}
const dbFile = path.join(WORK, "currency.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "currency" },
});
try {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  const prof = await api("POST", "/profiles", { name: "Currency" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? [])[0];
  const c = await api("POST", "/careers", {
    slotNumber: 1, managerName: "Currency", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0,
  });
  if (c.status >= 300) throw new Error(`career: HTTP ${c.status}`);
  let line = null;
  for (let i = 0; i < 10 && !line; i++) {
    const r = await api("POST", "/calendar/advance");
    line = (r.data?.events ?? []).find((e) => /^Salary week/.test(e)) ?? null;
  }
  check("a salary week's line reads in dollars", !!line && /\$\d/.test(line) && !/[€£]/.test(line), JSON.stringify(line));
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  try { await stopServer(child); } catch { /* already stopped */ }
  try { fs.closeSync(out); } catch { /* closed */ }
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
