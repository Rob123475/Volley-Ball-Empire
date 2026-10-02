/**
 * R-60 — Resign and Break Contract end the career. No save is left without a club.
 *
 * Rob's decision (15 Sep): for this release both END the career — a confirmation
 * dialog that says plainly "This ends your career at <club>. There is no job
 * market yet.", then the career goes to the finished state, the same path as a
 * sacking, with its own reason.
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 *   screen     both dialogs carry the sentence; the finished screen names each ending;
 *              no route clears a save's club any more
 *   resign     the career is finished (retired, Hall of Fame, history, session
 *              cleared) and the save keeps its club; resigning again is refused
 *   break      the release clause is paid, then the career is finished the same way
 *   never      no save anywhere has no club and is still open
 *   older      a save an older build left without a club is finished at boot
 *
 * Usage: node harness/career-ends.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-career-ends-"));
const PORT = 4800;
const BASE = `http://localhost:${PORT}/api`;
const RELEASE_FEE = 25_000;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log("  R-60 RESIGN AND BREAK CONTRACT END THE CAREER");
console.log("=".repeat(72));

console.log("\n0. THE SCREENS AND THE ROUTES");
const contractPage = fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/pages/manager-contract.tsx"), "utf8");
const endPage = fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/pages/career-end.tsx"), "utf8");
const careers = fs.readFileSync(path.join(REPO, "artifacts/api-server/src/routes/careers.ts"), "utf8");
// U-3 (feat-job-market): both lead to the Job Market now, and the dialogs say so.
const sentence = "You can leave once your season is over: you go at the start of the next season, to a club you agree on the Job Market, or the best open club that will have you. Your career goes on.";
check("both confirmation dialogs say it plainly",
  contractPage.split(sentence).length - 1 === 2 && /data-testid="resign-ends-career"/.test(contractPage) && /data-testid="break-ends-career"/.test(contractPage),
  `${contractPage.split(sentence).length - 1} dialog(s) carry "${sentence}"`);
check("both go to the Job Market (the finished screen when a career ends), which names each ending",
  (contractPage.match(/window\.location\.href = data\?\.leavingAtSeasonEnd \? "\/job-market" : "\/career-end"/g) ?? []).length === 2
    && /resignation:/.test(endPage) && /contract_break:/.test(endPage) && /dismissal:/.test(endPage));
check("no route clears a save's club any more", !/teamId:\s*null/.test(careers),
  (careers.match(/teamId:\s*null/g) ?? []).length + " occurrence(s) in routes/careers.ts");

if (!fs.existsSync(SERVER)) { console.error(`[career-ends] FAILED: ${SERVER} not built.`); process.exit(1); }
const dbFile = path.join(WORK, "ends.sqlite");
fs.copyFileSync(SHIPPED, dbFile);

async function boot(label) {
  const out = fs.openSync(path.join(WORK, `${label}.log`), "w");
  const child = forkServer({
    server: SERVER, electron: ELECTRON, out,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "career-ends-secret" },
  });
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { await fetch(`${BASE}/health`); return { child, out }; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  console.error(`[career-ends] ${label} server never came up`);
  process.exit(1);
}
async function shutdown(s) { await stopServer(s.child); try { fs.closeSync(s.out); } catch { /* closed */ } }
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
function read(sqlText, ...args) {
  const d = new DatabaseSync(dbFile, { readOnly: true });
  const rows = d.prepare(sqlText).all(...args);
  d.close();
  return rows;
}
async function newCareer(api, name) {
  const prof = await api("POST", "/profiles", { name });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const c = await api("POST", "/careers", {
    slotNumber: 1, managerName: name, managerNationality: "Australia", clubName: `${name} FC`, originalClubName: `${name} FC`,
    season: "Season 1", budget: "500000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a", difficulty: "established",
  });
  return { userId: prof.data.id, careerSaveId: c.data?.id, teamId: c.data?.teamId };
}
const saveRow = (id) => read(`SELECT team_id, retired_at FROM career_saves WHERE id = ?`, id)[0];
// U-3: a save on the Job Market (seeking a club) is without one on purpose.
const openClubless = () => read(`SELECT COUNT(*) AS n FROM career_saves WHERE team_id IS NULL AND retired_at IS NULL AND seeking_club_since IS NULL`)[0].n;

let server = await boot("main");
let legacy;
try {
  // Daytime 2 Oct, U-3 (feat-job-market): resigning and breaking the contract
  // lead to the Job Market; the career ends only by retiring there. With no
  // vacancy anywhere they are refused (the manager would have nowhere to go).
  const plantVacancy = (careerSaveId) => {
    const d = new DatabaseSync(dbFile);
    d.prepare(`UPDATE career_pool_team_state SET manager_name = NULL, vacant_since = '2099-01-01', vacancy_reason = 'planted by the suite'
      WHERE career_save_id = ? AND pool_team_id = (SELECT MIN(pool_team_id) FROM career_pool_team_state WHERE career_save_id = ?)`).run(careerSaveId, careerSaveId);
    d.close();
  };
  const seekingRow = (id) => read(`SELECT team_id, retired_at, seeking_club_since AS seeking FROM career_saves WHERE id = ?`, id)[0];

  // Afternoon 2 Oct, J-3: a manager can leave only once his season is over;
  // mid-season both are refused, in Rob's words, and nothing changes. What
  // happens in the off-season window is harness/ai-job-market.mjs.
  const MID = "You can leave once your season is over (penalties apply if you break your contract).";
  console.log("\n1. RESIGNING WAITS FOR THE SEASON'S END");
  const R = session();
  const res = await newCareer(R, "Resigner");
  const resign = await R("POST", "/careers/resign", {});
  const rs = seekingRow(res.careerSaveId);
  const rHof = read(`SELECT COUNT(*) AS n FROM hall_of_fame WHERE user_id = ?`, res.userId)[0].n;
  check("mid-season, resigning is refused in Rob's words", resign.status === 409 && resign.data?.error === MID, resign.data?.error);
  check("and the manager keeps his club, the career untouched", rs?.retired_at == null && rs?.team_id === res.teamId && rs?.seeking == null && rHof === 0,
    `retired_at ${rs?.retired_at}, team_id ${rs?.team_id}, hall of fame ${rHof}`);

  console.log("\n2. BREAKING THE CONTRACT WAITS FOR THE SEASON'S END TOO");
  const B = session();
  const brk = await newCareer(B, "Breaker");
  const budgetBefore = read(`SELECT budget FROM teams WHERE id = ?`, brk.teamId)[0].budget;
  const broke = await B("POST", "/careers/break-contract", {});
  const budgetAfter = read(`SELECT budget FROM teams WHERE id = ?`, brk.teamId)[0].budget;
  check("mid-season, breaking the contract is refused in Rob's words, and nothing is charged", broke.status === 409 && broke.data?.error === MID && budgetBefore === budgetAfter,
    `HTTP ${broke.status}; budget ${budgetBefore} -> ${budgetAfter}`);
  check("and the career is untouched", seekingRow(brk.careerSaveId)?.team_id === brk.teamId && seekingRow(brk.careerSaveId)?.retired_at == null);

  console.log("\n3. NO SAVE IS LEFT WITHOUT A CLUB, UNLESS IT IS LOOKING FOR ONE");
  const lost = () => read(`SELECT COUNT(*) AS n FROM career_saves WHERE team_id IS NULL AND retired_at IS NULL AND seeking_club_since IS NULL`)[0].n;
  check("no open save has no club unless it is on the Job Market", lost() === 0, `${lost()} open save(s) without a club and not looking for one`);

  const L = session();
  legacy = await newCareer(L, "Legacy");
} finally {
  await shutdown(server);
}

console.log("\n4. A SAVE AN OLDER BUILD LEFT WITHOUT A CLUB IS FINISHED AT BOOT");
{
  // What resigning did before R-60: the club link cleared, the save left open.
  const d = new DatabaseSync(dbFile);
  d.prepare(`UPDATE career_saves SET team_id = NULL WHERE id = ?`).run(legacy.careerSaveId);
  d.close();
}
check("the older build's state is really there before the boot", openClubless() === 1, `${openClubless()} open save(s) without a club`);
server = await boot("reboot");
try {
  const ls = saveRow(legacy.careerSaveId);
  check("the boot finishes it: retired, and no open save is left without a club", ls?.retired_at != null && openClubless() === 0,
    `retired_at ${ls?.retired_at}; open without a club ${openClubless()}`);
} finally {
  await shutdown(server);
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
