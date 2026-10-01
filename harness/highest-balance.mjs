/**
 * Overnight brief 1 Oct, N-45 (Rob, 1 Oct): "Making Money" read a highest
 * balance of $396,045 for a club that started on $500,000. The career stat only
 * noted the balance when the achievements were checked (after a match); the
 * starting balance and every balance in between were never counted.
 *
 * Asserted: a new career's highest balance is its starting money from the
 * start; after weeks of play it is the highest running balance on the club's
 * ledger (its start included), read straight from the copy. On a copy of Rob's
 * 1 Oct save (stored $396,045) one boot raises it to its ledger high, at least
 * the $500,000 it started on; the Trophy Cabinet's Making Money progress shows
 * it; a second boot changes nothing.
 *
 * Usage: node harness/highest-balance.mjs
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
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-highest-balance-"));
const PORT = 4569;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
const $ = (n) => "$" + Math.round(Number(n)).toLocaleString("en-US");
console.log("=".repeat(72));
console.log("  OVERNIGHT 1 OCT, N-45: THE HIGHEST BALANCE COUNTS THE START");
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
  child = forkServer({ server: SERVER, electron: ELECTRON, out,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "highest", STARTER_DB_PATH: SHIPPED } });
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) { try { if ((await fetch(`${BASE}/healthz`)).ok) return; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }
  throw new Error("server did not boot");
}
async function stop() { if (child) await stopServer(child); child = null; cookie = ""; }
const q = (db, sql, ...a) => { const d = new DatabaseSync(db, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
const stored = (db, id) => JSON.parse(q(db, `SELECT career_stats AS s FROM career_saves WHERE id = ?`, id)[0]?.s ?? "{}").highestBalanceReached ?? 0;
/** The ledger high, as the suite reads it: today's balance less every movement, then each running balance. */
const ledgerHigh = (db, teamId) => {
  const now = Number(q(db, `SELECT budget AS b FROM teams WHERE id = ?`, teamId)[0].b);
  const moves = q(db, `SELECT type, amount FROM finance_transactions WHERE team_id = ? ORDER BY date, id`, teamId)
    .map((r) => (r.type === "income" ? 1 : -1) * Math.abs(Number(r.amount)));
  let bal = now - moves.reduce((a, b) => a + b, 0), high = bal;
  const start = bal;
  for (const m of moves) { bal += m; high = Math.max(high, bal); }
  return { high: Math.round(Math.max(high, now)), start: Math.round(start) };
};

try {
  console.log("\n1. A NEW CAREER");
  const fresh = path.join(WORK, "fresh.sqlite");
  fs.copyFileSync(SHIPPED, fresh);
  await boot(fresh, "fresh");
  const prof = await api("POST", "/profiles", { name: "Highest" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", { slotNumber: 1, managerName: "Highest", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  const team = (await api("GET", "/team")).data;
  const cid = ((await api("GET", "/careers")).data?.saves ?? []).find((s) => s.teamId === team.id)?.id;
  check("a new career's highest balance is its starting money", stored(fresh, cid) === 500000, $(stored(fresh, cid)));
  for (let i = 0; i < 6; i++) {
    const r = await api("POST", "/calendar/next-match", {});
    const id = r.data?.matchDay?.matchId; if (!id) break;
    await api("POST", `/matches/${id}/simulate`, {}); await api("POST", "/calendar/dismiss-match", {});
  }
  const lh = ledgerHigh(fresh, team.id);
  check("after six matches it is the highest running balance on the ledger, the start included",
    stored(fresh, cid) === lh.high, `${$(stored(fresh, cid))} (ledger: start ${$(lh.start)}, high ${$(lh.high)}; today ${$((await api("GET", "/team")).data?.budget)})`);
  await stop();

  console.log("\n2. ROB'S 1 OCT SAVE (A COPY)");
  if (fs.existsSync(ROB)) {
    const copy = path.join(WORK, "rob.sqlite");
    fs.copyFileSync(ROB, copy);
    const save = q(copy, `SELECT id, team_id AS t FROM career_saves WHERE team_id IS NOT NULL`)[0];
    const before = stored(copy, save.id);
    await boot(copy, "rob-1");
    const profiles = (await api("GET", "/profiles")).data?.profiles ?? [];
    await api("POST", `/profiles/${profiles[0].id}/select`);
    await api("POST", `/careers/${save.id}/load`);
    const cab = (await api("GET", "/trophies/cabinet")).data;
    const mm = (cab?.achievements ?? []).find((a) => a.id === "making_money");
    await stop();
    const after = stored(copy, save.id), lh2 = ledgerHigh(copy, save.t);
    check("one boot raises it to the club's ledger high, at least the $500,000 it started on",
      after === lh2.high && after >= 500000 && after > before, `${$(before)} -> ${$(after)} (ledger start ${$(lh2.start)})`);
    check("the Trophy Cabinet's Making Money shows it", mm && Math.round(mm.progress) === Math.min(after, 1_000_000), `${$(mm?.progress ?? 0)} of $1,000,000`);
    await boot(copy, "rob-2");
    await stop();
    check("a second boot changes nothing", stored(copy, save.id) === after);
  } else check("Rob's 1 Oct backup is on this machine", false, ROB);
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  await stop();
}
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else fs.rmSync(WORK, { recursive: true, force: true });
process.exit(failures > 0 ? 1 : 0);
