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
const sentence = "This ends your career at {clubName}. There is no job market yet.";
check("both confirmation dialogs say it plainly",
  contractPage.split(sentence).length - 1 === 2 && /data-testid="resign-ends-career"/.test(contractPage) && /data-testid="break-ends-career"/.test(contractPage),
  `${contractPage.split(sentence).length - 1} dialog(s) carry "${sentence}"`);
check("both go to the finished screen, which names each ending",
  (contractPage.match(/window\.location\.href = "\/career-end"/g) ?? []).length === 2
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
const openClubless = () => read(`SELECT COUNT(*) AS n FROM career_saves WHERE team_id IS NULL AND retired_at IS NULL`)[0].n;

let server = await boot("main");
let legacy;
try {
  console.log("\n1. RESIGN ENDS THE CAREER");
  const R = session();
  const res = await newCareer(R, "Resigner");
  const resign = await R("POST", "/careers/resign", {});
  const rs = saveRow(res.careerSaveId);
  const rHistory = (await R("GET", "/careers/history")).data ?? [];
  const rHof = read(`SELECT COUNT(*) AS n FROM hall_of_fame WHERE user_id = ?`, res.userId)[0].n;
  check("the resignation is accepted and says the career ended", resign.status === 200 && resign.data?.careerEnded === true && resign.data?.clubName === "Resigner FC",
    `HTTP ${resign.status} ${JSON.stringify(resign.data)}`);
  check("the save is finished and keeps its club", rs?.retired_at != null && rs?.team_id === res.teamId,
    `retired_at ${rs?.retired_at}, team_id ${rs?.team_id} (club ${res.teamId})`);
  check("its own reason is recorded, first in the history, and it is archived to the Hall of Fame",
    rHistory[0]?.type === "resignation" && /resigned from Resigner FC/.test(rHistory[0]?.description ?? "") && /no job market yet/.test(rHistory[0]?.description ?? "") && rHof === 1,
    `"${rHistory[0]?.description}"; hall of fame ${rHof}`);
  const after = await R("GET", "/dashboard");
  const again = await R("POST", "/careers/resign", {});
  check("the session no longer has a career, and resigning again is refused", after.status === 404 && again.status === 400,
    `dashboard ${after.status}, second resign ${again.status}`);

  console.log("\n2. BREAK CONTRACT PAYS THE CLAUSE, THEN ENDS THE CAREER");
  const B = session();
  const brk = await newCareer(B, "Breaker");
  const budgetBefore = read(`SELECT budget FROM teams WHERE id = ?`, brk.teamId)[0].budget;
  const broke = await B("POST", "/careers/break-contract", {});
  const budgetAfter = read(`SELECT budget FROM teams WHERE id = ?`, brk.teamId)[0].budget;
  const bs = saveRow(brk.careerSaveId);
  const bHistory = (await B("GET", "/careers/history")).data ?? [];
  check("the release clause comes out of the club's budget", broke.status === 200 && broke.data?.feePaid === RELEASE_FEE && budgetBefore - budgetAfter === RELEASE_FEE,
    `HTTP ${broke.status}; budget ${budgetBefore} -> ${budgetAfter}`);
  check("the career is finished, keeps its club, and says why",
    broke.data?.careerEnded === true && bs?.retired_at != null && bs?.team_id === brk.teamId
      && bHistory[0]?.type === "contract_break" && /release clause/.test(bHistory[0]?.description ?? "") && /no job market yet/.test(bHistory[0]?.description ?? ""),
    `retired_at ${bs?.retired_at}, team_id ${bs?.team_id}; "${bHistory[0]?.description}"`);

  console.log("\n3. NO SAVE IS LEFT WITHOUT A CLUB");
  check("no open save has no club", openClubless() === 0, `${openClubless()} open save(s) without a club`);

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
