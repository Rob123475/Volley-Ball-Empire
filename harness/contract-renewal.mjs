/**
 * R-51 — contracts can be renewed, and are warned about and dated on the game clock.
 *
 * ── The gap ─────────────────────────────────────────────────────────────────
 * There was no renew action anywhere: POST /contracts refused a squad player
 * with "use the Contracts page to renew", and that page could only terminate.
 * The "Contract Expiring" warning compared in-game end dates with the
 * computer's clock, and signing dated contracts from it too. Rob's condition
 * for R-48's empty-squad forfeit: it is only fair if the manager was told and
 * could act.
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 *   renew     a starting contract (ends at season end) renews to one year later,
 *             same salary, in the contracts table and in career state
 *   limits    a contract already past this season cannot be renewed again (409);
 *             another career's contract is not found (404); unauthenticated is
 *             401; a club whose board has blocked spending cannot renew (403)
 *   warning   with the game date at 1 Jan nothing warns; at 10 Dec the two
 *             unrenewed contracts warn orange (21 days) and the renewed one does
 *             not; at 20 Dec they warn red (11 days) — on the machine's clock the
 *             same contracts are months away, so these warnings can only come
 *             from the game clock
 *   signing   a contract signed on game day 20 Dec 2026 starts that day and is
 *             capped a year later, whatever the machine's date
 *   ui        the Contracts page renews and counts days on the game clock
 *
 * Scene-setting writes (game date, board confidence) go straight to the running
 * server's database, as board-confidence-ladder does, and must change exactly
 * one row — a write that silently changes nothing would fake the scenario.
 *
 * Usage: node harness/contract-renewal.mjs
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
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-contract-renewal-"));
const PORT = 4720;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

if (!fs.existsSync(SERVER)) {
  console.error(`[contract-renewal] FAILED: ${SERVER} not built.`);
  process.exit(1);
}

const dbFile = path.join(WORK, "renewal.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: {
    ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT),
    NODE_ENV: "development", SESSION_SECRET: "contract-renewal-secret",
  },
});

{
  const deadline = Date.now() + 60000;
  let up = false;
  while (Date.now() < deadline) {
    try { await fetch(`${BASE}/health`); up = true; break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  if (!up) {
    console.error("[contract-renewal] server never came up");
    console.error(fs.readFileSync(path.join(WORK, "server.log"), "utf8").slice(-3000));
    process.exit(1);
  }
}

function session() {
  let cookie = "";
  return async function api(method, p, body) {
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
}

async function newCareer(api, label) {
  const prof = await api("POST", "/profiles", { name: label });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const c = await api("POST", "/careers", {
    slotNumber: 1, managerName: label, managerNationality: "Australia",
    clubName: `${label} FC`, originalClubName: `${label} FC`, season: "Season 1",
    budget: "500000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a",
  });
  return { careerSaveId: c.data?.id, teamId: c.data?.teamId };
}

/** A scene-setting write that must change exactly one row. */
function writeOne(sqlText, ...args) {
  const d = new DatabaseSync(dbFile);
  const { changes } = d.prepare(sqlText).run(...args);
  d.close();
  if (changes !== 1) throw new Error(`scene write changed ${changes} rows: ${sqlText}`);
}
function read(sqlText, ...args) {
  const d = new DatabaseSync(dbFile, { readOnly: true });
  const rows = d.prepare(sqlText).all(...args);
  d.close();
  return rows;
}
// `current_date` is also SQLite's CURRENT_DATE keyword, so the column is quoted.
const setGameDate = (teamId, date) =>
  writeOne(`UPDATE calendar_state SET "current_date" = ? WHERE team_id = ?`, date, teamId);
const contractItems = (att) => (att.data?.items ?? []).filter((i) => i.category === "Contract");

console.log("=".repeat(72));
console.log("  R-51 CONTRACT RENEWAL, AND EXPIRY ON THE GAME CLOCK");
console.log("=".repeat(72));

try {
  const A = session(), B = session();
  const a = await newCareer(A, "RenewA");
  const b = await newCareer(B, "RenewB");
  // The calendar row (the game clock) is created on first read.
  const cal = await A("GET", "/calendar");
  check("career A's game clock exists", cal.status === 200 && !!cal.data?.currentDate, `game date ${cal.data?.currentDate}`);

  console.log("\n1. RENEWING A CONTRACT");
  const contractsA = (await A("GET", "/contracts")).data ?? [];
  check("career A has its 3 starting contracts, ending at the season's end",
    contractsA.length === 3 && contractsA.every((c) => c.endDate === "2026-12-31"),
    contractsA.map((c) => c.endDate).join(", "));
  const first = contractsA[0];
  const renew = await A("POST", `/contracts/${first?.id}/renew`);
  check("renewing succeeds", renew.status === 200, `HTTP ${renew.status} ${JSON.stringify(renew.data)}`);
  check("the contract now ends one season later, same salary",
    renew.data?.endDate === "2027-12-31" && Number(renew.data?.salary) === Number(first?.salary),
    `${first?.endDate} -> ${renew.data?.endDate}, salary ${first?.salary} -> ${renew.data?.salary}`);
  const stateRow = read(`SELECT contract_end_date, team_id FROM career_player_state WHERE career_save_id = ? AND player_id = ?`,
    a.careerSaveId, first?.playerId)[0];
  check("career state carries the new end date, and the player is still in the club",
    stateRow?.contract_end_date === "2027-12-31" && stateRow?.team_id === a.teamId, JSON.stringify(stateRow));

  console.log("\n2. WHAT RENEWAL REFUSES");
  const again = await A("POST", `/contracts/${first?.id}/renew`);
  check("a contract already past this season cannot be renewed again (no stacking)",
    again.status === 409, `HTTP ${again.status} ${JSON.stringify(again.data)}`);
  const bContract = ((await B("GET", "/contracts")).data ?? [])[0];
  const cross = await A("POST", `/contracts/${bContract?.id}/renew`);
  check("another career's contract is not found", cross.status === 404, `HTTP ${cross.status}`);
  const noAuth = await fetch(`${BASE}/contracts/${first?.id}/renew`, { method: "POST" });
  check("unauthenticated renewal is refused", noAuth.status === 401, `HTTP ${noAuth.status}`);
  writeOne(`UPDATE teams SET board_confidence = 5 WHERE id = ?`, a.teamId);
  const blocked = await A("POST", `/contracts/${contractsA[1]?.id}/renew`);
  check("with the board blocking spending, renewal is refused", blocked.status === 403, `HTTP ${blocked.status} ${JSON.stringify(blocked.data)}`);
  writeOne(`UPDATE teams SET board_confidence = 60 WHERE id = ?`, a.teamId);

  console.log("\n3. THE EXPIRY WARNING RUNS ON THE GAME CLOCK");
  const realToday = new Date().toISOString().slice(0, 10);
  const realDaysToEnd = Math.round((Date.parse("2026-12-31T00:00:00Z") - Date.parse(`${realToday}T00:00:00Z`)) / 86_400_000);
  const att0 = await A("GET", "/attention-items");
  check(`game day ${cal.data?.currentDate}: no contract warning`, contractItems(att0).length === 0, `${contractItems(att0).length} items`);

  setGameDate(a.teamId, "2026-12-10");
  const att1 = await A("GET", "/attention-items");
  const orange = contractItems(att1);
  check("game day 10 Dec: the two unrenewed contracts warn orange, 21 days, pointing at the Contracts page",
    orange.length === 2 && orange.every((i) => i.priority === "orange" && /21 days/.test(i.description) && i.navigateTo === "/contracts"),
    JSON.stringify(orange.map((i) => [i.priority, i.description])));
  check("the renewed contract does not warn", !orange.some((i) => i.id === `contract-${first?.playerId}`));

  setGameDate(a.teamId, "2026-12-20");
  const att2 = await A("GET", "/attention-items");
  const red = contractItems(att2);
  check("game day 20 Dec: they warn red, 11 days, and say to renew",
    red.length === 2 && red.every((i) => i.priority === "red" && /11 days/.test(i.description) && /renew/i.test(i.description)),
    JSON.stringify(red.map((i) => [i.priority, i.description])));
  check(`on the machine's clock (${realToday}) the same contracts are ${realDaysToEnd} days away, so these warnings come from the game clock`,
    realDaysToEnd > 30 || realDaysToEnd < 0, `${realDaysToEnd} days on the real clock`);

  console.log("\n4. SIGNING IS DATED ON THE GAME CLOCK");
  const squad = (await A("GET", "/contracts")).data ?? [];
  const release = squad.find((c) => c.id !== first?.id);
  await A("POST", `/players/${release?.playerId}/release`, {});
  const market = (await A("GET", "/players/market-all?playerType=senior")).data ?? [];
  const target = (Array.isArray(market) ? market : []).find((p) => p.teamId == null && p.age >= 19);
  const sign = await A("POST", "/contracts", {
    playerId: target?.id, salary: target?.salary ?? 5000, endDate: "2030-12-31", bonusPerWin: 0, squadRole: "starter",
  });
  check("signing on game day 20 Dec 2026 succeeds", sign.status === 201, `HTTP ${sign.status} ${JSON.stringify(sign.data)}`);
  check("the contract starts on the game date and is capped one year after it",
    sign.data?.startDate === "2026-12-20" && sign.data?.endDate === "2027-12-20",
    `start ${sign.data?.startDate}, end ${sign.data?.endDate}`);
} finally {
  await stopServer(child);
  try { fs.closeSync(out); } catch { /* closed */ }
}

console.log("\n5. THE CONTRACTS PAGE");
const page = fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", "pages", "contracts.tsx"), "utf8");
check("the page renews through the API (useRenewContract) and offers a Renew button",
  /useRenewContract/.test(page) && /Renew \+1 season/.test(page));
check("the page counts days from the game date, not the machine's clock",
  /calendar\?\.currentDate/.test(page) && !/new Date\(\)\.getTime\(\)/.test(page));

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
