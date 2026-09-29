/**
 * D-2 — the club picker shows the money the career will really start with.
 *
 * Rob, 29 Sep: "Choose Your Club" said "Sydney Riptide · Rating 62 · $400K
 * budget"; the Established career started with $500,000. The picker printed
 * the club template's own `starting_budget` (club_templates, $300K-$520K),
 * which nothing has used since R-11: a career's money is decided by its
 * difficulty alone (startingBudgetFor, careerDifficulty.ts — $150,000
 * Underdog, $500,000 Established), whatever club is chosen.
 *
 * Both now read one table, lib/db/src/schema/career-difficulty.ts: the server
 * when it opens the career, and both wizards (new-career.tsx,
 * career-management.tsx) when they show the club list.
 *
 * Asserted: every one of the 10 clubs x both difficulties starts on exactly
 * the figure the picker shows; and neither wizard prints the template figure.
 *
 * Usage: node harness/club-picker-budget.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
// The very table the picker renders (Node strips the types).
import { STARTING_BUDGET } from "../lib/db/src/schema/career-difficulty.ts";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-club-picker-"));
const PORT = 4911;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log("  D-2 THE CLUB PICKER SHOWS THE REAL STARTING MONEY");
console.log("=".repeat(72));

if (!fs.existsSync(SERVER)) { console.error(`[club-picker-budget] FAILED: ${SERVER} not built.`); process.exit(1); }

function session() {
  let cookie = "";
  return async function api(method, p, body) {
    const res = await fetch(BASE + p, {
      method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    const text = await res.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data };
  };
}

const dbFile = path.join(WORK, "picker.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "club-picker" },
});

try {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }

  check("the picker's table: Underdog $150,000, Established $500,000",
    STARTING_BUDGET.underdog === 150000 && STARTING_BUDGET.established === 500000, JSON.stringify(STARTING_BUDGET));

  const probe = session();
  const p0 = await probe("POST", "/profiles", { name: "Picker Probe" });
  await probe("POST", `/profiles/${p0.data.id}/select`);
  const clubs = (await probe("GET", "/club-templates")).data?.clubs ?? [];
  check("the picker lists 10 clubs", clubs.length === 10, clubs.map((c) => c.name).join(", "));

  let n = 0;
  const rows = [];
  for (const difficulty of ["underdog", "established"]) {
    for (const club of clubs) {
      const api = session();
      const prof = await api("POST", "/profiles", { name: `Picker ${++n}` });
      await api("POST", `/profiles/${prof.data.id}/select`);
      // Exactly what the wizard sends.
      const c = await api("POST", "/careers", {
        slotNumber: 1, managerName: `Picker ${n}`, managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
        budget: club.startingBudget, difficulty, primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0,
      });
      const team = (await api("GET", "/team")).data;
      const save = ((await api("GET", "/careers")).data?.saves ?? []).find((s) => s.slotNumber === 1) ?? null;
      const shown = STARTING_BUDGET[difficulty];
      const ok = c.status < 300 && Number(team?.budget) === shown && save != null && Number(save.budget) === shown;
      rows.push({ difficulty, club: club.name, shown, balance: Number(team?.budget), save: save ? Number(save.budget) : null, template: Number(club.startingBudget), ok });
    }
  }
  for (const r of rows) {
    check(`${r.difficulty.padEnd(11)} ${r.club.padEnd(22)} picker shows $${r.shown.toLocaleString()}; career starts on $${r.balance.toLocaleString()}`,
      r.ok, `career_saves.budget ${r.save}; old template figure $${r.template.toLocaleString()}`);
  }

  // Both wizards render the table, and neither prints the template's figure any more.
  for (const page of ["new-career.tsx", "career-management.tsx"]) {
    const src = fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", "pages", page), "utf8");
    check(`${page}: shows the difficulty's starting money, never the template's`,
      /@shared\/career-difficulty/.test(src) && !/formatBudget\((?:c|club|selectedClub)\.startingBudget\)/.test(src));
  }
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
