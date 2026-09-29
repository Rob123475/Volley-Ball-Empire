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
 * The rule, now stated once (lib/db staff-roles.ts): 8 staff in all, medical
 * included, at most 4 of them medical. Nothing raises either number.
 *
 * Asserted: hiring from the Staff Market stops at exactly 8, and a medical hire
 * is refused at 8 too; the medical department stops at 4; both pages read the
 * one constant and fetch the staff list afresh; the Scouting line is only on a
 * Scout's card.
 *
 * Usage: node harness/staff-slots.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

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
  const src = (p) => fs.readFileSync(path.join(REPO, p), "utf8");
  const roles = src("lib/db/src/schema/staff-roles.ts");
  const MAX = Number(roles.match(/export const MAX_STAFF = (\d+);/)?.[1]);
  const MED = Number(roles.match(/export const MAX_MEDICAL_STAFF = (\d+);/)?.[1]);
  check("the rule is stated once: 8 staff in all, at most 4 medical", MAX === 8 && MED === 4, `MAX_STAFF ${MAX}, MAX_MEDICAL_STAFF ${MED}`);

  // Medical first: 4 places, then refused.
  const medMarket = (await api("GET", "/medical-staff/market")).data ?? [];
  const medList = Array.isArray(medMarket) ? medMarket : (medMarket.staff ?? []);
  let medHired = 0, medRefused = null;
  for (const m of medList.slice(0, MED + 1)) {
    const r = await api("POST", "/medical-staff", { staffId: m.id, length: "6m" });
    if (r.status < 300) medHired++; else { medRefused = r; break; }
  }
  check("the medical department takes 4, and refuses the 5th", medHired === MED && medRefused?.status === 400, `${medHired} hired; then ${medRefused?.status}: ${medRefused?.data?.error ?? ""}`);

  // Then the Staff Market: the club-wide limit counts the medical staff.
  const market = (await api("GET", "/staff/market")).data ?? [];
  let hired = (await api("GET", "/staff")).data?.length ?? 0, refused = null;
  for (const m of market) {
    if (hired >= MAX + 1) break;
    const r = await api("POST", "/staff", { staffId: m.id, length: "6m" });
    if (r.status < 300) hired++; else { refused = r; break; }
  }
  const mine = (await api("GET", "/staff")).data ?? [];
  check("hiring stops at exactly 8 staff in all, medical included", mine.length === MAX && refused?.status === 400 && /8 staff/.test(refused?.data?.error ?? ""),
    `${mine.length} on the books (${mine.filter((s) => /doctor|physio|nutrition|scientist|massage|medical/i.test(s.role)).length} medical); then ${refused?.status}: ${refused?.data?.error ?? ""}`);
  // Release a medic and hire another staffer, then a medical hire must be refused at 8.
  const medic = mine.find((s) => /doctor|physio|nutrition|scientist|massage|medical/i.test(s.role));
  const fire = await api("DELETE", `/medical-staff/${medic.id}`);
  const fire2 = fire.status < 300 ? fire : await api("DELETE", `/staff/${medic.id}`);
  const refill = market.find((m) => !mine.some((s) => s.id === m.id));
  await api("POST", "/staff", { staffId: refill?.id, length: "6m" });
  const med2 = (medList.find((m) => !mine.some((s) => s.id === m.id)));
  const medAt8 = await api("POST", "/medical-staff", { staffId: med2?.id, length: "6m" });
  check("at 8 staff, a medical hire is refused too (it used to count only the 4 medical places)",
    ((await api("GET", "/staff")).data?.length ?? 0) === MAX && medAt8.status === 400 && /8 staff/.test(medAt8.data?.error ?? ""),
    `release ${fire2.status}; medical hire ${medAt8.status}: ${medAt8.data?.error ?? ""}`);

  // The pages.
  const staffPage = src("artifacts/beach-volleyball/src/pages/staff.tsx");
  const marketPage = src("artifacts/beach-volleyball/src/pages/staff-market.tsx");
  check("My Staff and the Staff Market read the one constant (no page-local number) and fetch the list afresh",
    [staffPage, marketPage].every((t) => /MAX_STAFF[^\n]*from "@shared\/staff-roles"/.test(t) && !/const MAX_STAFF = \d/.test(t) && /refetchOnMount: "always"/.test(t))
    && /staff slots filled/.test(staffPage) && /staff slots filled/.test(marketPage));
  check("medical pages read the one medical constant", ["medical.tsx", "medical-market.tsx"].every((f) => !/const MAX_MEDICAL_STAFF = \d/.test(src(`artifacts/beach-volleyball/src/pages/${f}`))));
  check("the Scouting line is only on a Scout's card", /member\.scoutingRating != null && normaliseRole\(member\.role\) === "scout"/.test(marketPage));
  const nonScouts = market.filter((m) => !/scout/i.test(m.role));
  check("(the data behind it: non-scouts carry a scouting rating, which is why every card showed one)", nonScouts.some((m) => m.scoutingRating != null),
    `${nonScouts.filter((m) => m.scoutingRating != null).length} of ${nonScouts.length} non-scouts have one`);
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
