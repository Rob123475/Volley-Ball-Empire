/**
 * P-05 — the starting squad can be changed for free in week 1, and only then.
 *
 * Rob's rule: in a new career, releasing any starting-squad player is free
 * until the first game week has passed. After week 1, releasing a contracted
 * player costs the contract payout, the same as any early release (the 22 Sep
 * rule: a club that axes a contract early pays it out).
 *
 * Before this there were two ways to drop a player and neither followed it:
 * Release (Team page, POST /players/:id/release) never charged anything, in
 * any week — the way round the 22 Sep rule — and Terminate (Contracts page,
 * DELETE /contracts/:id) always charged, week 1 included. Both now go through
 * releasePayout() (utils/contractTerms.ts), and the starting squad is marked
 * as such on its contracts (contracts.origin), because a start date cannot
 * tell it from a player signed on day one.
 *
 * Two careers, one per path. Every release is measured in the club's balance.
 *
 * Usage: node harness/starting-squad-release.mjs
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
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-starting-release-"));
const PORT = 4883;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log("  P-05 STARTING SQUAD: FREE CHANGES IN WEEK 1 ONLY");
console.log("=".repeat(72));

if (!fs.existsSync(SERVER)) { console.error(`[starting-squad-release] FAILED: ${SERVER} not built.`); process.exit(1); }

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

/** The payout rule, restated here from Rob's words so the suite does not read it from the code it tests. */
function expectedPayout(monthlySalary, today, endDate) {
  if (!endDate || endDate <= today) return 0;
  const days = (Date.parse(endDate) - Date.parse(today)) / 86_400_000;
  return Math.max(0, Math.round(monthlySalary * Math.ceil(days / 30.44)));
}

const dbFile = path.join(WORK, "release.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "starting-release" },
});

async function newCareer(name) {
  const api = session();
  const prof = await api("POST", "/profiles", { name });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const clubs = (await api("GET", "/club-templates")).data;
  const club = (Array.isArray(clubs) ? clubs : clubs?.clubs ?? [])[0];
  const c = await api("POST", "/careers", {
    slotNumber: 1, managerName: name, managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0,
  });
  if (c.status >= 300) throw new Error(`career for ${name}: HTTP ${c.status}`);
  return api;
}
const balance = async (api) => Number((await api("GET", "/team")).data?.budget ?? 0);
const gameDate = async (api) => (await api("GET", "/calendar")).data?.currentDate;
const contracts = async (api) => ((await api("GET", "/contracts")).data ?? []).filter((c) => c.status === "active");
async function advanceTo(api, date) {
  for (let i = 0; i < 40 && (await gameDate(api)) < date; i++) {
    const r = await api("POST", "/calendar/advance");
    if (r.status >= 400) await api("POST", "/calendar/dismiss-match");
  }
  return gameDate(api);
}

/** Release one way or the other and report what it cost, measured in the balance. */
async function release(api, how, contract) {
  const before = await balance(api);
  const today = await gameDate(api);
  const r = how === "release"
    ? await api("POST", `/players/${contract.playerId}/release`, {})
    : await api("DELETE", `/contracts/${contract.id}`);
  const after = await balance(api);
  const want = expectedPayout(Number(contract.salary), today, contract.endDate);
  return { status: r.status, reported: Number(r.data?.payout ?? NaN), charged: Math.round(before - after), want, today };
}
const fmt = (x) => `${x.today}: charged $${x.charged.toLocaleString()}, reported $${x.reported}`;

try {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }

  // ── A. Release (Team page) ───────────────────────────────────────────────
  console.log("\nA. RELEASE, FROM THE TEAM PAGE");
  const A = await newCareer("Release Path");
  const squadA = await contracts(A);
  const first = await gameDate(A);
  check("a new career opens with a contracted starting squad, marked as one",
    squadA.length >= 2 && squadA.every((c) => c.origin === "starting_squad"),
    `${squadA.length} contracts on ${first}: ${squadA.map((c) => c.origin).join(", ")}`);

  const a1 = await release(A, "release", squadA[0]);
  check("week 1: releasing a starting-squad player costs nothing", a1.status === 200 && a1.charged === 0 && a1.reported === 0, fmt(a1));

  const pool = ((await A("GET", "/players/market-all?playerType=senior")).data ?? []).filter((p) => p.teamId == null && p.age >= 19);
  // Into whichever squad place the week-1 release just opened.
  let signed;
  for (const squadRole of ["starter", "interchange", "reserve"]) {
    signed = await A("POST", "/contracts", { confirm: true, playerId: pool[0]?.id, salary: pool[0]?.salary ?? 5000, bonusPerWin: 0, squadRole, length: "1s" });
    if (signed.status === 201) break;
  }
  const signing = (await contracts(A)).find((c) => c.playerId === pool[0]?.id);
  check("a player signed in week 1 is not part of the starting squad", signed.status === 201 && signing && signing.origin == null,
    `HTTP ${signed.status}${signed.status >= 300 ? " " + JSON.stringify(signed.data) : ""}; ${pool.length} free agents; origin ${signing?.origin ?? "null"}`);
  const a2 = await release(A, "release", signing);
  check("so releasing them in week 1 pays their contract out", a2.status === 200 && a2.charged > 0 && a2.charged === a2.want && a2.reported === a2.want,
    `${fmt(a2)}, rule $${a2.want.toLocaleString()}`);

  const day8 = await advanceTo(A, "2026-01-08");
  const a3 = await release(A, "release", squadA[1]);
  check("after week 1: releasing a starting-squad player pays the contract out", day8 >= "2026-01-08" && a3.status === 200 && a3.charged > 0 && a3.charged === a3.want && a3.reported === a3.want,
    `${fmt(a3)}, rule $${a3.want.toLocaleString()}`);
  const ledgerA = ((await A("GET", "/finances")).data ?? []).filter((t) => /^Contract paid out/.test(t.description));
  check("and each payout is on the club's ledger", ledgerA.length === 2, ledgerA.map((t) => `$${t.amount}`).join(", "));

  // ── B. Terminate (Contracts page) ────────────────────────────────────────
  console.log("\nB. TERMINATE, FROM THE CONTRACTS PAGE");
  const B = await newCareer("Terminate Path");
  const squadB = await contracts(B);
  const b1 = await release(B, "terminate", squadB[0]);
  check("week 1, day 1: terminating a starting-squad contract costs nothing", b1.status === 200 && b1.charged === 0 && b1.reported === 0, fmt(b1));
  const day7 = await advanceTo(B, "2026-01-07");
  const b2 = await release(B, "terminate", squadB[1]);
  check("still week 1, day 7: still free", day7 === "2026-01-07" && b2.status === 200 && b2.charged === 0 && b2.reported === 0, fmt(b2));
  await advanceTo(B, "2026-01-08");
  const b3 = await release(B, "terminate", squadB[2]);
  check("day 8, the first week has passed: the contract is paid out", b3.status === 200 && b3.charged > 0 && b3.charged === b3.want && b3.reported === b3.want,
    `${fmt(b3)}, rule $${b3.want.toLocaleString()}`);
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
