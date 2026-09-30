/**
 * Overnight brief 30 Sep, item 33b — a contract length for every staff and
 * medical hire.
 *
 * Rob, 30 Sep: when hiring, choose 6 months, 1 season or 2 seasons (cards
 * showed "12mo" with no choice); wage per month; a 4-week (28 game-day)
 * warning before a contract ends, with Renew at the same terms; not renewed,
 * she leaves and the place frees up; releasing early pays out the rest of the
 * contract; existing hires with no end date get one: the end of the season.
 *
 * Asserted on a starter-DB copy:
 *   - a staff hire on 6 months ends six months on; a medical hire on 2 seasons
 *     is a 2-season contract;
 *   - 28 game days before the end the warning is up; renewing at the same
 *     terms (6 months) moves the end on six months;
 *   - an unrenewed 6-month hire is gone the day after her end, her place is
 *     free (the staff count drops) and the weekly wage run counts one fewer;
 *   - releasing early pays out the rest (the whole remainder, a part month as
 *     a month; the server's rule, and the pages' copy gives the same figure),
 *     for staff and medical alike, with a ledger line; a medic who is not the
 *     club's cannot be released by it;
 *   - a hire with no end date (an older save) is given the end of the season
 *     at the next boot;
 *   - both hire dialogs offer the three lengths and send the choice.
 *
 * Usage: node harness/staff-contracts.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healAllSquads } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const PORT = 4937;
const BASE = `http://localhost:${PORT}/api`;
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-staff-contracts-"));
let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  OVERNIGHT 30 SEP, 33b: EVERY STAFF HIRE ON A CONTRACT OF ROB'S LENGTHS");
console.log("=".repeat(72));

const esbuild = createRequire(path.join(REPO, "artifacts", "api-server", "package.json"))("esbuild");
const build = (src, name) => { const o = path.join(WORK, name); esbuild.buildSync({ entryPoints: [path.join(REPO, src)], outfile: o, format: "esm", bundle: true, logLevel: "silent", platform: "node" }); return import(pathToFileURL(o).href); };
const { terminationPayout, addSixMonths } = await build("artifacts/api-server/src/utils/contractTerms.ts", "terms.mjs");
const { contractPayout } = await build("artifacts/beach-volleyball/src/lib/contract-payout.ts", "payout.mjs");

const dbFile = path.join(WORK, "contracts.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const q = (sql, ...a) => { const d = new DatabaseSync(dbFile, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
let cookie = "";
async function api(method, p, body) {
  const res = await fetch(BASE + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await res.text(); let data = null; try { data = t ? JSON.parse(t) : null; } catch { data = t; }
  return { status: res.status, data };
}
let logFd, child;
const boot = async (log) => {
  logFd = fs.openSync(path.join(WORK, log), "w");
  child = forkServer({ server: SERVER, electron: requireElectronBinary(REPO), out: logFd,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "staff-contracts" } });
  for (let i = 0; i < 240; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }
};
const stop = async () => { try { await stopServer(child); } catch { /* stopped */ } try { fs.closeSync(logFd); } catch { /* closed */ } };

try {
  await boot("boot1.log");
  const prof = await api("POST", "/profiles", { name: "Staff Contracts" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", { slotNumber: 1, managerName: "Staff Contracts", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: 5000000, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  const teamId = (await api("GET", "/team")).data?.id;
  const careerSaveId = ((await api("GET", "/careers")).data?.saves ?? [])[0]?.id;
  { const d = new DatabaseSync(dbFile); d.prepare(`UPDATE teams SET budget = 5000000 WHERE id = ?`).run(teamId); d.close(); }
  const today = async () => (await api("GET", "/calendar")).data?.currentDate;
  const state = (id) => q(`SELECT team_id AS teamId, contract_term AS term, contract_start_date AS start, contract_end_date AS ends, salary FROM career_staff_state WHERE career_save_id = ? AND staff_id = ?`, careerSaveId, id)[0];
  const isMed = (s) => /doctor|physio|nutrition|scientist|massage|medical/i.test(s.role);
  const myStaff = async () => ((await api("GET", "/staff")).data ?? []).filter((s) => !isMed(s));

  // Make room: the staff department is 4; release anyone the club starts with.
  for (const s of await myStaff()) await api("DELETE", `/staff/${s.id}`);
  const market = ((await api("GET", "/staff/market")).data ?? []);
  const [A, B, C] = market;
  const day0 = await today();
  const hireA = await api("POST", "/staff", { staffId: A.id, length: "6m" });
  const hireB = await api("POST", "/staff", { staffId: B.id, length: "6m" });
  const sA = state(A.id);
  check("a staff hire on 6 months ends six months on", hireA.status === 201 && sA.term === "6m" && sA.start === day0 && sA.ends === addSixMonths(day0), JSON.stringify(sA));
  const med = ((await api("GET", "/medical-staff/market")).data ?? [])[0];
  const hireM = await api("POST", "/medical-staff", { staffId: med.id, length: "2s" });
  check("a medical hire on 2 seasons is a 2-season contract", hireM.status < 300 && state(med.id)?.term === "2s", JSON.stringify(state(med.id)));

  // Release early: the rest of the contract, for staff and medical alike.
  await api("POST", "/staff", { staffId: C.id, length: "1s" });
  const sC = state(C.id), tC = await today();
  const bC = Number((await api("GET", "/team")).data?.budget);
  const relC = await api("DELETE", `/staff/${C.id}`);
  const owedC = terminationPayout(Number(sC.salary), tC, sC.ends);
  const rowC = q(`SELECT amount FROM finance_transactions WHERE team_id = ? AND category = 'staff_termination' ORDER BY id DESC LIMIT 1`, teamId)[0];
  check("releasing a staff member early pays out the rest of her contract, on the ledger, and her contract is cleared",
    relC.status === 200 && relC.data?.terminationFee === owedC && owedC > 0 && bC - Number((await api("GET", "/team")).data?.budget) === owedC && Number(rowC?.amount) === owedC && state(C.id).teamId == null && state(C.id).ends == null,
    `owed $${owedC} (to ${sC.ends}, $${sC.salary}/mo); charged $${relC.data?.terminationFee}`);
  check("the pages' copy of the rule gives the same figure", contractPayout(Number(sC.salary), tC, sC.ends) === owedC);
  const sM = state(med.id);
  const bM = Number((await api("GET", "/team")).data?.budget);
  const relM = await api("DELETE", `/medical-staff/${med.id}`);
  const owedM = terminationPayout(Number(sM.salary), await today(), sM.ends);
  check("releasing a medic early pays out the rest of hers too (it cost nothing)", relM.status === 200 && owedM > 0 && relM.data?.terminationFee === owedM && bM - Number((await api("GET", "/team")).data?.budget) === owedM,
    `owed $${owedM}; charged $${relM.data?.terminationFee}`);
  const notMine = ((await api("GET", "/medical-staff/market")).data ?? [])[0];
  const relNot = await api("DELETE", `/medical-staff/${notMine.id}`);
  check("a medic who is not the club's cannot be released by it", relNot.status === 403, `${relNot.status}`);

  // To 28 days before the 6-month end: the warning; renew B at the same terms.
  const advanceTo = async (date) => {
    for (let i = 0; i < 400 && (await today()) < date; i++) {
      healAllSquads(dbFile);
      const r = await api("POST", "/calendar/advance", {});
      if (r.data?.blocked === "pending_match") { await api("POST", `/matches/${r.data.pendingMatchId}/simulate`); await api("POST", "/calendar/dismiss-match"); continue; }
      if (r.data?.matchDay?.matchId) { await api("POST", `/matches/${r.data.matchDay.matchId}/simulate`); await api("POST", "/calendar/dismiss-match"); }
      if (r.data?.blocked === "season_end") break;
    }
  };
  const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  await advanceTo(addDays(sA.ends, -28));
  const items = (await api("GET", "/attention-items")).data?.items ?? (await api("GET", "/attention-items")).data ?? [];
  const warnA = (Array.isArray(items) ? items : []).find((i) => i.id === `staff-contract-${A.id}`);
  check("28 game days before her end, the warning is up", !!warnA && /28 days remaining|renew/.test(warnA.description), `${await today()}: ${warnA?.title} — ${warnA?.description}`);
  const endB = state(B.id).ends;
  const renewB = await api("POST", `/staff/${B.id}/renew`, { length: "6m" });
  check("renewing at the same terms (6 months) moves her end on six months", renewB.status === 200 && state(B.id).ends === addSixMonths(endB) && state(B.id).term === "6m", `${endB} -> ${state(B.id).ends}`);

  // Past A's end: she is gone, her place is free, the wage run counts one fewer.
  const countBefore = (await myStaff()).length;
  await advanceTo(addDays(sA.ends, 8));
  const countAfter = (await myStaff()).length;
  const lastWages = q(`SELECT description, date FROM finance_transactions WHERE team_id = ? AND category = 'staff_salary' AND description LIKE 'Weekly staff wages%' ORDER BY id DESC LIMIT 1`, teamId)[0];
  check("an unrenewed hire is gone after her end, and her place is free", state(A.id).teamId == null && countAfter === countBefore - 1, `A ${JSON.stringify(state(A.id))}; staff ${countBefore} -> ${countAfter}`);
  check("the weekly wage run counts one fewer", !!lastWages && new RegExp(`\\(${countAfter + ((await api("GET", "/staff")).data ?? []).filter(isMed).length} staff\\)`).test(lastWages.description),
    `${lastWages?.date}: ${lastWages?.description}`);

  // An older save: a hire with no end date gets the end of the season at boot.
  const D = ((await api("GET", "/staff/market")).data ?? [])[0];
  await api("POST", "/staff", { staffId: D.id, length: "2s" });
  await stop();
  { const d = new DatabaseSync(dbFile); d.prepare(`UPDATE career_staff_state SET contract_term = NULL, contract_start_date = NULL, contract_end_date = NULL WHERE career_save_id = ? AND staff_id = ?`).run(careerSaveId, D.id); d.close(); }
  await boot("boot2.log");
  cookie = "";
  await api("POST", `/profiles/${prof.data.id}/select`);
  await api("POST", `/careers/${careerSaveId}/load`);
  const seasonEnd = (await api("GET", "/seasons/current")).data?.endDate?.slice(0, 10);
  check("a hire with no end date (an older save) is given the end of the season at boot", state(D.id).ends === seasonEnd && state(D.id).term === "1s", `${JSON.stringify(state(D.id))}; season ends ${seasonEnd}`);

  const src = (f) => fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/pages", f), "utf8");
  check("both hire dialogs offer the three lengths and send the choice",
    ["staff-market.tsx", "medical-market.tsx"].every((f) => { const s = src(f); return /<ContractLengthPicker value=\{term\} onChange=\{setTerm\} \/>/.test(s) && /onHire\(member\.id, term\)/.test(s) && /data: \{ staffId, length \}/.test(s) && !/\{member\.contractLength\}mo/.test(s); }));
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  await stop();
}
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
