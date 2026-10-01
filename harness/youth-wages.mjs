/**
 * Overnight brief 1 Oct, N-33 (Rob, 1 Oct): a youth's wage matches the rest of
 * the game. The contract box offered Eleni Stavrou $5,000 a month by default;
 * the academy pays (and the weekly run has always billed) $75-$150 a week for
 * talent, about $325-$650 a month, and that is what a youth is now paid,
 * shown in one unit everywhere: "$433 a month ($100 a week)".
 *
 * Asserted on a new career (starter save): every market youth asks the
 * academy's wage for her talent; signing one through the contract box with
 * $5,000 in the body stores the academy wage on her contract and her record;
 * the next salary week bills her that wage. On a copy of Rob's 1 Oct save,
 * every youth's stored wage is the academy wage after one boot (it was $0 for
 * the market's), and a second boot changes nothing. The pages show youth wages
 * through the one formatter.
 *
 * Usage: node harness/youth-wages.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const ROB = path.join(os.homedir(), "Downloads", "volleyball-empire-backup-01oct-1225.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-youth-wages-"));
const PORT = 4561;
const BASE = `http://localhost:${PORT}/api`;
const WEEKS_PER_MONTH = 52 / 12;
const ACADEMY_SRC = fs.readFileSync(path.join(REPO, "artifacts/api-server/src/utils/academy.ts"), "utf8");
const WEEKLY = Object.fromEntries([...ACADEMY_SRC.matchAll(/(Low|Average|High|Elite|Generational): (\d+)/g)].map((m) => [m[1], Number(m[2])]));
const monthly = (potential) => (WEEKLY[potential] ?? WEEKLY.Average) * WEEKS_PER_MONTH;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
const $ = (n) => "$" + Math.round(Number(n)).toLocaleString("en-US");
console.log("=".repeat(72));
console.log("  OVERNIGHT 1 OCT, N-33: A YOUTH'S WAGE");
console.log("=".repeat(72));

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
let child = null;
async function boot(dbFile, tag) {
  const out = fs.openSync(path.join(WORK, `server-${tag}.log`), "w");
  child = forkServer({
    server: SERVER, electron: ELECTRON, out,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development",
      SESSION_SECRET: "youth-wages", STARTER_DB_PATH: SHIPPED },
  });
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) return; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("server did not boot");
}
async function stop() { if (child) await stopServer(child); child = null; cookie = ""; }
const q = (db, sql, ...a) => { const d = new DatabaseSync(db, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
const youthRows = (db) => q(db, `SELECT s.career_save_id AS c, s.player_id AS id, s.team_id AS t, s.salary, p.potential FROM career_player_state s
  JOIN players p ON p.id = s.player_id WHERE p.player_type = 'youth' AND COALESCE(s.is_promoted, 0) = 0`);

try {
  console.log("\n1. A NEW CAREER");
  const fresh = path.join(WORK, "fresh.sqlite");
  fs.copyFileSync(SHIPPED, fresh);
  await boot(fresh, "fresh");
  const prof = await api("POST", "/profiles", { name: "Youth Wages" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", { slotNumber: 1, managerName: "Youth Wages", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  const team = (await api("GET", "/team")).data;
  const market = youthRows(fresh).filter((y) => y.t == null);
  check("every market youth asks the academy's wage for her talent", market.length > 0 && market.every((y) => Math.abs(y.salary - monthly(y.potential)) < 0.01),
    `${market.length} youths: ${[...new Set(market.map((y) => `${y.potential} ${$(y.salary)}`))].join(", ")}`);
  const pick = market[0];
  const signed = await api("POST", "/contracts", { playerId: pick.id, salary: 5000, length: "1s", squadRole: "reserve", confirm: true });
  const after = youthRows(fresh).find((y) => y.id === pick.id);
  const contract = q(fresh, `SELECT salary FROM contracts WHERE player_id = ? AND status = 'active'`, pick.id)[0];
  check("signing her with $5,000 in the box stores the academy wage on her record and her contract",
    signed.status < 300 && Math.abs(after.salary - monthly(pick.potential)) < 0.01 && Math.abs(Number(contract?.salary) - monthly(pick.potential)) < 0.01,
    `HTTP ${signed.status} ${signed.data?.error ?? ""}; ${pick.potential}: ${$(after?.salary)} a month, contract ${$(contract?.salary)}`);
  let line = null;
  for (let i = 0; i < 10 && !line; i++) {
    await api("POST", "/calendar/advance", {});
    line = q(fresh, `SELECT description, amount FROM finance_transactions WHERE team_id = ? AND category = 'salaries' AND description LIKE '%academy%'`, team.id)[0];
  }
  const seniors = q(fresh, `SELECT COALESCE(SUM(s.salary), 0) AS m FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.team_id = ? AND NOT (p.player_type = 'youth' AND COALESCE(s.is_promoted, 0) = 0)`, team.id)[0].m;
  const want = Math.round(Number(seniors) / WEEKS_PER_MONTH) + WEEKLY[pick.potential];
  check("the salary week bills her the academy's weekly wage", !!line && Number(line.amount) === want,
    line ? `${line.description}: ${$(line.amount)} = seniors ${$(Number(seniors) / WEEKS_PER_MONTH)} + her ${$(WEEKLY[pick.potential])}` : "no line");
  await stop();

  console.log("\n2. ROB'S 1 OCT SAVE (A COPY)");
  if (fs.existsSync(ROB)) {
    const copy = path.join(WORK, "rob.sqlite");
    fs.copyFileSync(ROB, copy);
    const before = youthRows(copy);
    const wrong = before.filter((y) => Math.abs(y.salary - monthly(y.potential)) >= 0.01);
    await boot(copy, "rob-1");
    await stop();
    const once = youthRows(copy);
    check("after one boot every youth is on the academy's wage for her talent", once.length > 0 && once.every((y) => Math.abs(y.salary - monthly(y.potential)) < 0.01),
      `${wrong.length} of ${before.length} were not (e.g. ${wrong.slice(0, 3).map((y) => $(y.salary)).join(", ")})`);
    await boot(copy, "rob-2");
    await stop();
    check("a second boot changes nothing", JSON.stringify(youthRows(copy)) === JSON.stringify(once));
  } else check("Rob's 1 Oct backup is on this machine", false, ROB);

  console.log("\n3. THE PAGES");
  const page = (f) => fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src", f), "utf8");
  check("the contract box shows a youth's wage (no $5,000 slider) and the market card and Youth Loans tab use the one formatter",
    // The box is the shared component since N-44 (b) (components/contract-offer-dialog.tsx).
    /isYouth \? \(/.test(page("components/contract-offer-dialog.tsx")) && /youthWageText\(asking\)/.test(page("components/contract-offer-dialog.tsx"))
    && /youthWageText\(Number\(player\.salary\)\)/.test(page("pages/players.tsx"))
    && (page("pages/youth-loans.tsx").match(/youthWageTextFromWeekly\(/g) ?? []).length >= 6 && !/a week<\/div>/.test(page("pages/youth-loans.tsx")));
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  await stop();
}
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else fs.rmSync(WORK, { recursive: true, force: true });
process.exit(failures > 0 ? 1 : 0);
