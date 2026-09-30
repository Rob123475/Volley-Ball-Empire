/**
 * Unity match brief (29 Sep), item 16 — the staff slot count agrees everywhere.
 *
 * Rob, 29 Sep: My Staff said "2 of 4 staff slots filled", the Staff Market "1/8
 * staff slots used". The pages each had their own number (4 and 8); the server
 * refused the 9th hire of any kind (POST /staff counts every member of staff,
 * medical included), while the medical department's own hire checked only its
 * 4 medical places. And every Staff Market card showed "Scouting: Fair Scout
 * (50)", head coaches included.
 *
 * The rule, stated once (lib/db staff-roles.ts). Overnight brief 30 Sep,
 * item 33 (Rob, Q-11): two separate departments, 4 staff and 4 medical staff;
 * the old limit of 8 in all is gone; nobody is sacked, a department over 4
 * from an older save just cannot hire until it is under.
 *
 * Asserted: the medical department takes 4 and refuses the 5th; the staff
 * department takes 4 more alongside them (8 people) and refuses its 5th,
 * naming 4 of 4; a club made to hold 5 staff (an older save) keeps all 5 and
 * is refused; every page counts its own department ("2 of 4") from the one
 * constant and fetches the list afresh; the Scouting line is only on a
 * Scout's card.
 *
 * Usage: node harness/staff-slots.mjs
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
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-staff-slots-"));
const PORT = 4924;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  UNITY 16: ONE STAFF SLOT COUNT, AND SCOUTING ONLY ON SCOUTS");
console.log("=".repeat(72));
if (!fs.existsSync(SERVER)) { console.error(`[staff-slots] FAILED: ${SERVER} not built.`); process.exit(1); }

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
const dbFile = path.join(WORK, "staff.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "staff-slots" },
});

try {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  const prof = await api("POST", "/profiles", { name: "Staff Test" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", {
    slotNumber: 1, managerName: "Staff Test", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: 5000000, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0,
  });
  const teamId = (await api("GET", "/team")).data?.id;
  const careerSaveId = ((await api("GET", "/careers")).data?.saves ?? [])[0]?.id;
  const src = (p) => fs.readFileSync(path.join(REPO, p), "utf8");
  const roles = src("lib/db/src/schema/staff-roles.ts");
  const MAX = Number(roles.match(/export const MAX_STAFF = (\d+);/)?.[1]);
  const MED = Number(roles.match(/export const MAX_MEDICAL_STAFF = (\d+);/)?.[1]);
  check("the rule is stated once: 4 staff and 4 medical staff, separate departments", MAX === 4 && MED === 4, `MAX_STAFF ${MAX}, MAX_MEDICAL_STAFF ${MED}`);

  // Medical first: 4 places, then refused.
  const medMarket = (await api("GET", "/medical-staff/market")).data ?? [];
  const medList = Array.isArray(medMarket) ? medMarket : (medMarket.staff ?? []);
  let medHired = 0, medRefused = null;
  for (const m of medList.slice(0, MED + 1)) {
    const r = await api("POST", "/medical-staff", { staffId: m.id, length: "6m" });
    if (r.status < 300) medHired++; else { medRefused = r; break; }
  }
  check("the medical department takes 4, and refuses the 5th", medHired === MED && medRefused?.status === 400, `${medHired} hired; then ${medRefused?.status}: ${medRefused?.data?.error ?? ""}`);

  // Then the Staff Market: its own 4 places, alongside the 4 medical.
  const isMed = (s) => /doctor|physio|nutrition|scientist|massage|medical/i.test(s.role);
  const market = (await api("GET", "/staff/market")).data ?? [];
  let refused = null;
  for (const m of market) {
    const inDept = ((await api("GET", "/staff")).data ?? []).filter((s) => !isMed(s)).length;
    if (inDept > MAX) break;
    const r = await api("POST", "/staff", { staffId: m.id, length: "6m" });
    if (r.status >= 300) { refused = r; break; }
  }
  const mine = (await api("GET", "/staff")).data ?? [];
  const staffNow = mine.filter((s) => !isMed(s)).length, medNow = mine.filter(isMed).length;
  check("the staff department takes 4 more beside the 4 medical (8 people), and refuses its 5th, naming 4 of 4",
    staffNow === MAX && medNow === MED && refused?.status === 400 && /4 of 4/.test(refused?.data?.error ?? ""),
    `${staffNow} staff + ${medNow} medical; then ${refused?.status}: ${refused?.data?.error ?? ""}`);
  // An older save with 5 staff (the old limit allowed it): nobody is sacked, no hire.
  const extra = market.find((m) => !mine.some((s) => s.id === m.id));
  { const d = new DatabaseSync(dbFile); d.prepare(`UPDATE career_staff_state SET team_id = ? WHERE career_save_id = ? AND staff_id = ?`).run(teamId, careerSaveId, extra.id); d.close(); }
  const five = ((await api("GET", "/staff")).data ?? []).filter((s) => !isMed(s)).length;
  const another = market.find((m) => m.id !== extra.id && !mine.some((s) => s.id === m.id));
  const refusedOver = await api("POST", "/staff", { staffId: another?.id, length: "6m" });
  check("a club over 4 from an older save keeps all 5 and cannot hire until under 4",
    five === MAX + 1 && refusedOver.status === 400 && /5 of 4/.test(refusedOver.data?.error ?? ""), `${five} staff; ${refusedOver.status}: ${refusedOver.data?.error ?? ""}`);

  // The pages.
  const staffPage = src("artifacts/beach-volleyball/src/pages/staff.tsx");
  const marketPage = src("artifacts/beach-volleyball/src/pages/staff-market.tsx");
  check("My Staff and the Staff Market read the one constant (no page-local number) and fetch the list afresh",
    [staffPage, marketPage].every((t) => /MAX_STAFF[^\n]*from "@shared\/staff-roles"/.test(t) && !/const MAX_STAFF = \d/.test(t) && /refetchOnMount: "always"/.test(t))
    && /\{staffInDept\} of \{MAX_STAFF\} staff places filled/.test(staffPage) && /\{staffInDept\} of \{MAX_STAFF\} staff places filled/.test(marketPage)
    && /filter\(\(s\) => !isMedicalRole\(s\.role\)\)/.test(staffPage) && /filter\(\(s\) => !isMedicalRole\(s\.role\)\)/.test(marketPage));
  check("the medical pages say \"n of 4\" for the medical department",
    /\{myMedStaff\.length\} of \{MAX_MEDICAL_STAFF\} medical places filled/.test(src("artifacts/beach-volleyball/src/pages/medical-market.tsx"))
    && /\{medStaff\.length\} of \{MAX_MEDICAL_STAFF\} slots filled/.test(src("artifacts/beach-volleyball/src/pages/medical.tsx")));
  check("medical pages read the one medical constant", ["medical.tsx", "medical-market.tsx"].every((f) => !/const MAX_MEDICAL_STAFF = \d/.test(src(`artifacts/beach-volleyball/src/pages/${f}`))));
  check("the Scouting line is only on a Scout's card", /member\.scoutingRating != null && normaliseRole\(member\.role\) === "scout"/.test(marketPage));
  // Overnight 30 Sep, item 7: an unscouted card carries no scouting rating at all now.
  const unscouted = market.filter((m) => !m.isScoutRevealed);
  check("(and an unscouted card carries no scouting rating to show: item 7)", unscouted.length > 0 && unscouted.every((m) => m.scoutingRating == null),
    `${unscouted.filter((m) => m.scoutingRating != null).length} of ${unscouted.length} unscouted cards carry one`);
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  try { await stopServer(child); } catch { /* stopped */ }
  try { fs.closeSync(out); } catch { /* closed */ }
}
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
