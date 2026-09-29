/**
 * D-4 — no facility text promises a bonus of zero.
 *
 * Rob, 29 Sep: Nutrition Centre, NEXT LEVEL, "−0 fatigue/session + −1 in
 * retreats". Level 2's session bonus is (2 − 1) × 3/9 = ⅓ of a fatigue point,
 * and a training session adds whole points of fatigue (routes/training.ts
 * rounds after the reduction), so on its own level 2 takes nothing off a
 * session: the "0" was true, not a rounding slip. A bonus part that comes to
 * zero is now left out of the text (artifacts/beach-volleyball/src/lib/
 * facility-benefits.ts, the one module both the Facilities page and the
 * dashboard read).
 *
 * Asserted:
 *   text    every facility at every level 1-10, both forms: no "−0"/"+0",
 *           never empty; Nutrition level 2 reads "−1 in retreats"; every text
 *           that had no zero in it is exactly what it was before
 *   game    a Power Camp measured at Nutrition levels 1, 2 and 3: level 2
 *           takes nothing off (as the text now says), level 3 takes 1
 *
 * Usage: node harness/facility-benefits.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { FACILITY_BENEFIT, FACILITY_BENEFIT_SHORT } from "../artifacts/beach-volleyball/src/lib/facility-benefits.ts";
import { FACILITY_PAGE_TYPES } from "../lib/db/src/schema/facility-names.ts";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-facility-benefits-"));
const PORT = 4913;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log("  D-4 NO ZERO BONUS IN A FACILITY'S TEXT");
console.log("=".repeat(72));

// ── The texts ──────────────────────────────────────────────────────────────
// The formulas exactly as facilities.tsx and dashboard.tsx had them on 28 Sep,
// so the suite can show nothing else moved.
const r = (l, k) => Math.round((l - 1) * (k / 9));
const YL = ["Basic prospects only", "Slightly improved prospects", "Improved prospect quality", "Better chance of High potential",
  "Good chance of High potential", "Higher chance of Elite prospects", "Regular Elite prospects", "Strong Elite prospects",
  "High chance of Elite & Generational", "Maximum — Elite & Generational prospects"];
const YS = ["Basic prospects", "Slightly improved", "Improved quality", "Better High potential", "Good High potential",
  "Higher Elite chance", "Regular Elite", "Strong Elite", "Elite & Generational", "Maximum"];
const OLD_LONG = {
  training_complex:      (l) => l === 1 ? "Base training effectiveness" : `+${r(l, 20)}% training XP`,
  medical_centre:        (l) => l === 1 ? "Base recovery speed" : `+${r(l, 25)}% recovery speed`,
  gymnasium:             (l) => l === 1 ? "Base strength training" : `+${r(l, 15)}% strength/power development`,
  nutrition_centre:      (l) => l === 1 ? "Base nutrition support" : `−${r(l, 3)} fatigue/session + −${r(l, 5)} in retreats`,
  youth_academy:         (l) => YL[l - 1],
  scouting_department:   (l) => l === 1 ? "Basic scouting capability" : `+${r(l, 30)}% scouting effectiveness`,
  sports_science_lab:    (l) => l === 1 ? "Base injury prevention" : `−${r(l, 20)}% injury risk`,
  commercial_department: (l) => l === 1 ? "Base commercial activity" : `+${r(l, 30)}% sponsorship value`,
  beach_resort:          (l) => l === 1 ? "Base morale environment" : `+${r(l, 8)} morale per camp`,
};
const OLD_SHORT = {
  training_complex:      (l) => l === 1 ? "Base training XP" : `+${r(l, 20)}% training XP`,
  medical_centre:        (l) => l === 1 ? "Base recovery speed" : `+${r(l, 25)}% recovery speed`,
  gymnasium:             (l) => l === 1 ? "Base strength training" : `+${r(l, 15)}% power dev.`,
  nutrition_centre:      (l) => l === 1 ? "Base nutrition support" : `−${r(l, 3)} fatigue/session`,
  youth_academy:         (l) => YS[l - 1],
  scouting_department:   (l) => l === 1 ? "Basic scouting" : `+${r(l, 30)}% effectiveness`,
  sports_science_lab:    (l) => l === 1 ? "Base injury prevention" : `−${r(l, 20)}% injury risk`,
  commercial_department: (l) => l === 1 ? "Base commercial" : `+${r(l, 30)}% sponsorship`,
  beach_resort:          (l) => l === 1 ? "Base morale boost" : `+${r(l, 8)} morale/camp`,
};
const ZERO = /[+−-]0(?![\d.])/;

console.log("\n1. THE TEXT, EVERY FACILITY, EVERY LEVEL");
for (const [form, now, old] of [["Facilities page", FACILITY_BENEFIT, OLD_LONG], ["dashboard tile", FACILITY_BENEFIT_SHORT, OLD_SHORT]]) {
  const zeros = [], empty = [], moved = [], changed = [];
  for (const t of FACILITY_PAGE_TYPES) {
    for (let l = 1; l <= 10; l++) {
      const txt = now[t](l), was = old[t](l);
      if (ZERO.test(txt)) zeros.push(`${t} L${l} "${txt}"`);
      if (!txt) empty.push(`${t} L${l}`);
      if (!ZERO.test(was) && txt !== was) moved.push(`${t} L${l} "${was}" -> "${txt}"`);
      if (ZERO.test(was)) changed.push(`${t} L${l} "${was}" -> "${txt}"`);
    }
  }
  check(`${form}: no zero bonus at any level (9 facilities x 10 levels)`, zeros.length === 0 && empty.length === 0, [...zeros, ...empty].join("; "));
  check(`${form}: every text that had no zero is unchanged`, moved.length === 0, moved.join("; "));
  console.log(`  REPORT  ${form}: texts that printed a zero before: ${changed.join("; ") || "none"}`);
}
check("Nutrition Centre, level 2 (NEXT LEVEL from 1): \"−1 in retreats\"", FACILITY_BENEFIT.nutrition_centre(2) === "−1 in retreats", FACILITY_BENEFIT.nutrition_centre(2));
check("Nutrition Centre, level 3: \"−1 fatigue/session + −1 in retreats\"", FACILITY_BENEFIT.nutrition_centre(3) === "−1 fatigue/session + −1 in retreats", FACILITY_BENEFIT.nutrition_centre(3));

for (const [page, table] of [["facilities.tsx", "FACILITY_BENEFIT"], ["dashboard.tsx", "FACILITY_BENEFIT_SHORT"]]) {
  const src = fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", "pages", page), "utf8");
  const uses = (src.match(new RegExp(`benefitAt: ${table}\\.\\w+`, "g")) ?? []).length;
  check(`${page}: all 9 texts come from the shared module`, uses === 9 && !/benefitAt: \(l\)/.test(src), `${uses} of 9`);
}

// ── The game ───────────────────────────────────────────────────────────────
console.log("\n2. WHAT THE NUTRITION CENTRE REALLY TAKES OFF A POWER CAMP");
if (!fs.existsSync(SERVER)) { console.error(`[facility-benefits] FAILED: ${SERVER} not built.`); process.exit(1); }

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

const dbFile = path.join(WORK, "benefits.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "facility-benefits" },
});

try {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ }
    await new Promise((res) => setTimeout(res, 250));
  }
  const prof = await api("POST", "/profiles", { name: "Benefit Test" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? [])[0];
  const c = await api("POST", "/careers", {
    slotNumber: 1, managerName: "Benefit Test", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0,
  });
  if (c.status >= 300) throw new Error(`career: HTTP ${c.status}`);
  const teamId = (await api("GET", "/team")).data?.id;
  await api("GET", "/facilities");

  const squad = (x) => [...(x?.starters ?? []), ...(x?.interchanges ?? []), ...(x?.reserves ?? [])];
  const players = squad((await api("GET", "/team/roster")).data).filter((p) => !p.isInjured).sort((a, b) => (a.fatigue ?? 0) - (b.fatigue ?? 0));

  function setNutrition(level) {
    const d = new DatabaseSync(dbFile);
    d.prepare("UPDATE facilities SET level = ? WHERE team_id = ? AND type = 'nutrition_centre'").run(level, teamId);
    d.close();
  }
  async function powerCamp(player) {
    const f0 = squad((await api("GET", "/team/roster")).data).find((p) => p.id === player.id).fatigue;
    const s = await api("POST", "/training", { playerId: player.id, type: "Power Camp", durationHours: 2, scheduledAt: new Date().toISOString() });
    const done = await api("POST", `/training/${s.data.id}/complete`);
    return { added: done.data?.newStats?.fatigue - f0, from: f0 };
  }

  // A fresh player per level, so fatigue is nowhere near the 100 cap.
  const added = {};
  for (const [i, level] of [1, 2, 3].entries()) {
    setNutrition(level);
    added[level] = await powerCamp(players[i]);
  }
  const fmt = (l) => `L${l}: +${added[l].added} (from ${added[l].from})`;
  check("level 1: a Power Camp adds its full 26", added[1].added === 26, fmt(1));
  check("level 2: it still adds 26 - the ⅓ point rounds away, so level 2 really gives 0 per session", added[2].added === 26, fmt(2));
  check("level 3: it adds 25 - the \"−1 fatigue/session\" the text promises", added[3].added === 25, fmt(3));
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
