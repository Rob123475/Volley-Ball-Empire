/**
 * L-02a — every contract is one of three lengths, everyone has one, and staff
 * contracts end.
 *
 * Rob's rule (22 Sep, final): "EVERY player, staff member and medical staff
 * member has a contract. Allowed lengths are 6 months, 1 season, 2 seasons.
 * Nothing else." Plus: a contract ended early is paid out from the club
 * balance, and staff contracts expire like players' with a 4-week warning.
 *
 * What this exists to catch, all of it real before L-02a:
 *   - the signing route took an arbitrary endDate and capped it at ONE YEAR, so
 *     a 2-season deal could not be signed at all;
 *   - `career_staff_state.contract_length` was a months integer that NO code
 *     path read, so a coach hired in season 1 was still on the payroll in
 *     season 30 and the only exit was a manual termination;
 *   - tearing up a player's contract cost the club nothing;
 *   - the frontend computed the end date from `new Date()` — the real-world
 *     clock, not the game clock.
 *
 * Own throwaway database and server.
 *
 * Usage: node harness/contract-terms.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";
import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healAllSquads } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-contract-terms-"));
const PORT = 4521;

// READ, not restated. This suite used to say 28 in its own right, which would
// have kept asserting the old window - and passing - the day the server's
// constant moved. The same reason the retirement age is read from the server
// in harness/rollover.mjs.
const TERMS_SRC = fs.readFileSync(
  path.join(REPO, "artifacts/api-server/src/utils/contractTerms.ts"), "utf8");
const WARNING_DAYS = Number(/CONTRACT_WARNING_DAYS = (\d+)/.exec(TERMS_SRC)?.[1]);

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log("  L-02a CONTRACT LENGTHS, COVERAGE, STAFF EXPIRY, PAYOUT");
console.log("=".repeat(72));

const dbFile = path.join(WORK, "contracts.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const logFile = path.join(WORK, "server.log");
const out = fs.openSync(logFile, "w");

const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: {
    ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT),
    NODE_ENV: "development", SESSION_SECRET: "contract-terms-secret",
  },
});

const BASE = `http://localhost:${PORT}/api`;
let cookie = "";
const api = async (method, p, body) => {
  const res = await fetch(BASE + p, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const sc = res.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
};

const read = (q, ...a) => {
  const d = new DatabaseSync(dbFile, { readOnly: true });
  const r = d.prepare(q).all(...a);
  d.close();
  return r;
};

/**
 * A write straight into the throwaway database, for a situation the API cannot
 * reach quickly. Used once, to put a player in the academy: academy players
 * arrive through the season's youth intake, and walking a career to an intake
 * just to test a promotion would double this suite's running time.
 */
const write = (q, ...a) => {
  const d = new DatabaseSync(dbFile);
  d.prepare(q).run(...a);
  d.close();
};

try {
  const dl = Date.now() + 30000;
  for (;;) {
    if (Date.now() > dl) throw new Error("server never came up");
    try { await fetch(`${BASE}/healthz`); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }

  // ── a career ──────────────────────────────────────────────────────────────
  const prof = await api("POST", "/profiles", { name: "ContractTerms" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const clubs = (await api("GET", "/club-templates")).data;
  const club = (Array.isArray(clubs) ? clubs : clubs?.clubs ?? [])[0];
  const career = await api("POST", "/careers", {
    slotNumber: 1, managerName: "ContractTerms", managerNationality: "Australia",
    clubName: "ContractTerms FC", originalClubName: "ContractTerms FC",
    budget: club?.startingBudget ?? "500000", difficulty: "established",
    primaryColor: "#0a0", secondaryColor: "#00a", crestShapeIndex: 0,
    season: "Season 1", locationId: 1,
  });
  check("a career was created", career.status === 200, `HTTP ${career.status}`);
  const careerSaveId = career.data?.id;
  const teamId = career.data?.teamId;

  const season = (await api("GET", "/seasons/current")).data;
  const seasonEnds = read(
    `SELECT end_date AS e FROM seasons WHERE career_save_id = ? ORDER BY end_date ASC`, careerSaveId,
  ).map((r) => r.e);

  // ── 1. THE ONLY THREE LENGTHS ─────────────────────────────────────────────
  console.log("\n1. THE ONLY THREE LENGTHS");

  const freeAgents = (await api("GET", "/players/free-agents")).data ?? [];
  check("there are free agents to sign", freeAgents.length >= 4, `${freeAgents.length}`);

  // Anything not one of the three is refused, by name.
  const badLength = await api("POST", "/contracts", {
    playerId: freeAgents[0].id, salary: 5000, bonusPerWin: 0, squadRole: "interchange", length: "5s",
  });
  check("a 5-season contract is refused, and the message says what is allowed",
    badLength.status === 400 && /6m/.test(badLength.data?.error ?? "") && /2s/.test(badLength.data?.error ?? ""),
    `HTTP ${badLength.status} ${String(badLength.data?.error ?? "").slice(0, 90)}`);

  const badMonths = await api("POST", "/contracts", {
    playerId: freeAgents[0].id, salary: 5000, bonusPerWin: 0, squadRole: "interchange", length: 12,
  });
  check("a numeric month count is refused too", badMonths.status === 400, `HTTP ${badMonths.status}`);

  // ── 2. EACH LENGTH ENDS WHERE IT SHOULD ───────────────────────────────────
  console.log("\n2. EACH LENGTH ENDS WHERE IT SHOULD");

  const signed = {};
  for (const [i, length] of ["6m", "1s", "2s"].entries()) {
    // Release anyone already signed so the squad cap never refuses the next one.
    const roster = (await api("GET", "/team/roster")).data ?? {};
    for (const p of [...(roster.activePlayers ?? []), ...(roster.benchPlayers ?? [])]) {
      const c = read(`SELECT id FROM contracts WHERE player_id = ? AND status = 'active'`, p.id)[0];
      if (c) await api("DELETE", `/contracts/${c.id}`);
    }
    const r = await api("POST", "/contracts", {
      playerId: freeAgents[i].id, salary: 5000, bonusPerWin: 0, squadRole: "interchange", length,
    });
    signed[length] = r;
    check(`a ${length} contract is accepted`, r.status === 201, `HTTP ${r.status} ${JSON.stringify(r.data).slice(0, 80)}`);
  }

  const today = (await api("GET", "/calendar")).data?.currentDate ?? season?.startDate;
  const sixMonthEnd = signed["6m"].data?.endDate;
  check("6m ends six months after the GAME date, not the real-world date",
    typeof sixMonthEnd === "string" && sixMonthEnd > today && sixMonthEnd.slice(0, 4) >= today.slice(0, 4),
    `signed ${today} -> ends ${sixMonthEnd}`);

  check("1s ends on the end of the season being played",
    signed["1s"].data?.endDate === seasonEnds.filter((e) => e >= today)[0],
    `${signed["1s"].data?.endDate} vs season end ${seasonEnds.filter((e) => e >= today)[0]}`);

  // Seasons are created one at a time by the rollover (R-35), so in season 1
  // only this season's row exists and a 2-season deal is projected a year on.
  const future = seasonEnds.filter((e) => e >= today);
  const twoSeasonExpected = future[1]
    ?? (() => { const [y, m, d] = future[0].split("-"); return `${Number(y) + 1}-${m}-${d}`; })();
  check("2s ends on the end of the season after that",
    signed["2s"].data?.endDate === twoSeasonExpected,
    `${signed["2s"].data?.endDate} vs ${twoSeasonExpected}`);

  check("a 2-season contract is LONGER than a 1-season one (the old one-year cap made them equal)",
    signed["2s"].data?.endDate > signed["1s"].data?.endDate,
    `${signed["1s"].data?.endDate} -> ${signed["2s"].data?.endDate}`);

  // ── 3. NOBODY AT A CLUB WITHOUT A CONTRACT ────────────────────────────────
  console.log("\n3. NOBODY AT A CLUB WITHOUT A CONTRACT (fresh career)");

  const contractless = read(
    `SELECT COUNT(*) AS n FROM career_player_state ps
       JOIN players p ON p.id = ps.player_id
      WHERE ps.career_save_id = ? AND ps.team_id IS NOT NULL
        AND ps.is_retired = 0
        AND (p.player_type <> 'youth' OR ps.is_promoted = 1)
        AND NOT EXISTS (SELECT 1 FROM contracts c
                         WHERE c.player_id = ps.player_id AND c.team_id = ps.team_id
                           AND c.status = 'active')`, careerSaveId)[0].n;
  check("zero contract-less players at the club", contractless === 0, `${contractless}`);

  // ── 4. STAFF AND MEDICAL GET A CONTRACT, AND IT ENDS ──────────────────────
  console.log("\n4. STAFF AND MEDICAL CONTRACTS EXIST AND EXPIRE");

  const market = (await api("GET", "/staff/market")).data ?? [];
  check("the staff market has people", market.length > 0, `${market.length}`);
  const hire = await api("POST", "/staff", { staffId: market[0].id, length: "6m" });
  check("a staff member can be hired on a 6m contract", hire.status === 201, `HTTP ${hire.status}`);

  const staffRow = read(
    `SELECT contract_term AS term, contract_start_date AS start, contract_end_date AS end
       FROM career_staff_state WHERE career_save_id = ? AND staff_id = ?`,
    careerSaveId, market[0].id)[0];
  check("the staff contract has a term and real dates (contract_length alone never ended anything)",
    staffRow?.term === "6m" && !!staffRow?.start && !!staffRow?.end && staffRow.end > staffRow.start,
    `term ${staffRow?.term}, ${staffRow?.start} -> ${staffRow?.end}`);

  const badStaffLength = await api("POST", "/staff", { staffId: market[1].id, length: "3s" });
  check("a staff contract of any other length is refused", badStaffLength.status === 400,
    `HTTP ${badStaffLength.status}`);

  const medMarket = (await api("GET", "/medical-staff/market")).data ?? [];
  const medHire = await api("POST", "/medical-staff", { staffId: medMarket[0]?.id, length: "1s" });
  check("a medical staff member is hired on a contract too", medHire.status === 201, `HTTP ${medHire.status}`);
  const medRow = read(
    `SELECT contract_term AS term, contract_end_date AS end FROM career_staff_state
      WHERE career_save_id = ? AND staff_id = ?`, careerSaveId, medMarket[0]?.id)[0];
  check("the medical contract carries its term and end date",
    medRow?.term === "1s" && !!medRow?.end, `term ${medRow?.term}, ends ${medRow?.end}`);

  // Put a fieldable pair back on the books before running the clock.
  //
  // Section 2 released each signing to keep the 3-senior cap clear, which left
  // the club unable to field two players — and R-48's abandonment rule then
  // SACKED the manager 30 game days later, ending the career. That is the game
  // working; the suite just has to stop creating an abandoned club.
  const forSquad = ((await api("GET", "/players/free-agents")).data ?? []).filter((p) => !p.teamId);
  for (const p of forSquad.slice(0, 2)) {
    await api("POST", "/contracts", {
      playerId: p.id, salary: 5000, bonusPerWin: 0, squadRole: "starter", length: "2s",
    });
  }
  const squadNow = (await api("GET", "/team/roster")).data ?? {};
  check("the club can field a pair before the clock runs (R-48 abandonment otherwise ends the career)",
    ((squadNow.activePlayers ?? []).length + (squadNow.benchPlayers ?? []).length) >= 2,
    `${(squadNow.activePlayers ?? []).length + (squadNow.benchPlayers ?? []).length} contracted`);

  // Run the clock past the 6m staff deal: the coach must leave on his own.
  const staffEnd = staffRow.end;
  let advanced = 0, stopped = "reached the end date";
  // L-02a: Rob's rule is four weeks' notice on the GAME clock before a coach
  // walks. Captured as the clock passes through the window rather than after,
  // because after the release there is nothing left to warn about.
  let warned = null, warnedAt = null;
  for (let i = 0; i < 600; i++) {
    healAllSquads(dbFile);
    const r = await api("POST", "/calendar/advance", {});
    if (r.status >= 400) { stopped = `advance HTTP ${r.status} ${JSON.stringify(r.data).slice(0, 80)}`; break; }
    advanced++;
    const mid = r.data?.blocked === "pending_match" ? r.data.pendingMatchId : r.data?.matchDay?.matchId;
    if (mid) { await api("POST", `/matches/${mid}/simulate`, {}); await api("POST", "/calendar/dismiss-match", {}); }
    const now = (await api("GET", "/calendar")).data?.currentDate;
    if (now && warned === null) {
      const daysLeft = Math.round((Date.parse(staffEnd) - Date.parse(now)) / 86_400_000);
      if (daysLeft >= 0 && daysLeft <= WARNING_DAYS) {
        const attn = (await api("GET", "/attention-items")).data;
        const list = Array.isArray(attn) ? attn : (attn?.items ?? []);
        const hit = list.find((it) => it.id === `staff-contract-${market[0].id}`);
        if (hit) { warned = hit; warnedAt = `${daysLeft} days out`; }
      }
    }
    if (now && now > staffEnd) break;
  }
  check("the harness knows the real warning window", Number.isFinite(WARNING_DAYS) && WARNING_DAYS > 0,
    `CONTRACT_WARNING_DAYS = ${WARNING_DAYS}`);
  check("the club was warned four weeks before the coach's contract ran out",
    warned !== null, warned ? `"${warned.title}" (${warned.priority}, ${warnedAt})` : `no attention item appeared inside the ${WARNING_DAYS}-day window`);
  const afterRow = read(
    `SELECT team_id AS team, is_available AS avail, contract_end_date AS end
       FROM career_staff_state WHERE career_save_id = ? AND staff_id = ?`,
    careerSaveId, market[0].id)[0];
  check("past its end date the staff contract expired and returned him to the pool",
    afterRow?.team === null && afterRow?.end === null,
    `after ${advanced} days (${stopped}): team ${afterRow?.team}, ends ${afterRow?.end}`);

  // ── 5. ENDING A CONTRACT EARLY COSTS THE REMAINDER ────────────────────────
  console.log("\n5. ENDING A CONTRACT EARLY IS PAID OUT");

  const poolRes = await api("GET", "/players/free-agents");
  const pool = Array.isArray(poolRes.data) ? poolRes.data : (poolRes.data?.players ?? []);
  check("the free agent pool is readable for the payout scene", Array.isArray(pool) && pool.length > 0,
    `HTTP ${poolRes.status}, ${Array.isArray(pool) ? pool.length : typeof poolRes.data}`);
  const target = pool.find((p) => !p.teamId);
  const roster2 = (await api("GET", "/team/roster")).data ?? {};
  for (const p of [...(roster2.activePlayers ?? []), ...(roster2.benchPlayers ?? [])]) {
    const c = read(`SELECT id FROM contracts WHERE player_id = ? AND status = 'active'`, p.id)[0];
    if (c) await api("DELETE", `/contracts/${c.id}`);
  }
  const long = await api("POST", "/contracts", {
    playerId: target.id, salary: 8000, bonusPerWin: 0, squadRole: "interchange", length: "2s",
  });
  check("a 2-season deal to pay out was signed", long.status === 201, `HTTP ${long.status}`);

  const balBefore = Number((await api("GET", "/team")).data?.budget ?? 0);
  const killed = await api("DELETE", `/contracts/${long.data.id}`);
  const balAfter = Number((await api("GET", "/team")).data?.budget ?? 0);
  check("terminating it early charged the club the remainder",
    killed.status === 200 && killed.data?.payout > 0 && Math.round(balBefore - balAfter) === Math.round(killed.data.payout),
    `payout ${killed.data?.payout}; balance ${Math.round(balBefore)} -> ${Math.round(balAfter)}`);

  const txt = read(
    `SELECT description AS d, amount AS a FROM finance_transactions
      WHERE team_id = ? ORDER BY id DESC LIMIT 1`, teamId)[0];
  check("and the ledger says what it was for",
    /paid out/i.test(txt?.d ?? ""), `${txt?.d} $${Math.round(Number(txt?.a ?? 0))}`);

  // ── 6. THE FRONTEND OFFERS EXACTLY THE SAME THREE ─────────────────────────
  console.log("\n6. THE FRONTEND'S LIST CANNOT DRIFT FROM THE SERVER'S");

  const serverSrc = fs.readFileSync(
    path.join(REPO, "artifacts/api-server/src/utils/contractTerms.ts"), "utf8");
  const uiSrc = fs.readFileSync(
    path.join(REPO, "artifacts/beach-volleyball/src/lib/contract-lengths.ts"), "utf8");
  const keysOf = (s) => (s.match(/CONTRACT_LENGTHS = \[([^\]]+)\]/)?.[1] ?? "")
    .split(",").map((x) => x.trim().replace(/['"]/g, "")).filter(Boolean);
  const labelsOf = (s) => [...(s.match(/"(6m|1s|2s)":\s*"([^"]+)"/g) ?? [])].join("|");
  check("the two CONTRACT_LENGTHS lists are identical",
    keysOf(serverSrc).join(",") === keysOf(uiSrc).join(",") && keysOf(uiSrc).length === 3,
    `server [${keysOf(serverSrc)}] ui [${keysOf(uiSrc)}]`);
  check("and so are the labels the player reads",
    labelsOf(serverSrc) === labelsOf(uiSrc), labelsOf(uiSrc));

  // The renew bar colours the end date orange inside the same window and has
  // its own copy of the number, for the reason the lengths above have one: the
  // browser cannot import lib/db. So the copy is allowed and the drift is not.
  const barSrc = fs.readFileSync(
    path.join(REPO, "artifacts/beach-volleyball/src/components/contract-renew-bar.tsx"), "utf8");
  const barDays = Number(/daysLeft <= (\d+)/.exec(barSrc)?.[1]);
  check("the renew bar warns on the server's window, not a number of its own",
    barDays === WARNING_DAYS, `bar ${barDays}, server ${WARNING_DAYS}`);

  check("no screen offers a month-count contract any more",
    !/Max contract is 12 months/.test(
      fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/pages/players.tsx"), "utf8")));

  // ── 7. PROMOTION OUT OF THE ACADEMY IS A SIGNING ──────────────────────────
  // Rob's rule lists youth promotion among the places a contract length is
  // offered. Promotion used to end the academy deal and write nothing, which
  // left a senior at the club on no terms: he could not expire, could not be
  // renewed and could not be paid out.
  console.log("\n7. PROMOTING A YOUTH PLAYER WRITES HIS SENIOR CONTRACT");

  // Section 5 pays off the whole squad, so this brings in its own player.
  const pool3 = (await api("GET", "/players/free-agents")).data;
  const free3 = (Array.isArray(pool3) ? pool3 : (pool3?.players ?? [])).filter((p) => !p.teamId);
  const signed3 = await api("POST", "/contracts", {
    playerId: free3[0]?.id, salary: 5000, bonusPerWin: 0, squadRole: "interchange", length: "1s",
  });
  const spare = signed3.status === 201 ? { id: free3[0].id } : null;
  if (!spare) {
    check("a player was available to promote", false, `HTTP ${signed3.status} ${JSON.stringify(signed3.data).slice(0, 90)}`);
  } else {
    // Put him in the academy: 18 years old, on an academy deal, no senior one.
    write(`DELETE FROM contracts WHERE player_id = ? AND team_id = ?`, spare.id, teamId);
    write(`UPDATE career_player_state SET age = 18, academy_contract_years = 2,
             squad_role = 'reserve', is_active = 0, contract_end_date = NULL
            WHERE career_save_id = ? AND player_id = ?`, careerSaveId, spare.id);

    const before = read(`SELECT COUNT(*) AS n FROM contracts
                          WHERE player_id = ? AND status = 'active'`, spare.id)[0].n;
    const promoted = await api("PATCH", `/team/roster/${spare.id}/role`,
      { role: "interchange", length: "2s" });
    const after = read(`SELECT end_date AS end, salary AS pay FROM contracts
                         WHERE player_id = ? AND team_id = ? AND status = 'active'`,
      spare.id, teamId)[0];

    check("promoting him to the senior squad was accepted",
      promoted.status === 200, `HTTP ${promoted.status}`);
    check("and it wrote the senior contract that promotion used to skip",
      before === 0 && !!after?.end, `${before} before -> ${after?.end ?? "none"} after`);

    const todayNow = (await api("GET", "/calendar")).data?.currentDate;
    const endsNow = read(`SELECT end_date AS e FROM seasons WHERE career_save_id = ?
                           ORDER BY end_date`, careerSaveId)
      .map((r) => r.e).filter((e) => e >= todayNow);
    const expect2s = endsNow[1]
      ?? (() => { const [y, m, d] = endsNow[0].split("-"); return `${Number(y) + 1}-${m}-${d}`; })();
    check("on the length the promotion asked for, not a length of its own",
      after?.end === expect2s, `${after?.end} vs 2s = ${expect2s}`);

    const badPromote = await api("PATCH", `/team/roster/${spare.id}/role`,
      { role: "starter", length: "4s" });
    check("a promotion on a length that does not exist is refused",
      badPromote.status === 400, `HTTP ${badPromote.status} ${badPromote.data?.error ?? ""}`);
  }

} finally {
  await stopServer(child);
  try { fs.closeSync(out); } catch { /* already closed */ }
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
