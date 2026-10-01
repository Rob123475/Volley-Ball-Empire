/**
 * Overnight brief 1 Oct, N-31 (Rob, 1 Oct): the runner-up gets ONE THIRD of the
 * prize, the winner two thirds, in every tier (it was 30/70: a Silver club's
 * runner-up took $1,350 of a $45,000 Gold purse).
 *
 * An Established career (paid in full up to Silver in season 1, R-54) plays its
 * first ten World Tour events: five Bronze and two Silver paid in full, then
 * three Gold paid at the 10% a club above its access is paid. Its pair is made
 * strong for one match and weak for the next, so it both wins and loses. Every
 * prize line on the ledger must be purse x (2/3 won, 1/3 lost) x the access
 * share the fixture list shows, and the shares are read from the server's own
 * file.
 *
 * Usage: node harness/runner-up-prize.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healSquad } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-runner-up-"));
const PORT = 4553;
const BASE = `http://localhost:${PORT}/api`;

const SRC = fs.readFileSync(path.join(REPO, "artifacts/api-server/src/utils/prizeDistribution.ts"), "utf8");
const share = (name) => { const m = new RegExp(`${name} = ([\\d.]+)\\s*/\\s*([\\d.]+);`).exec(SRC); return m ? Number(m[1]) / Number(m[2]) : NaN; };
const WINNER = share("WINNER_SHARE"), RUNNER_UP = share("RUNNER_UP_SHARE");

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
console.log("=".repeat(72));
console.log("  OVERNIGHT 1 OCT, N-31: THE RUNNER-UP TAKES A THIRD");
console.log("=".repeat(72));
check("the server's shares are a third and two thirds", Math.abs(RUNNER_UP - 1 / 3) < 1e-12 && Math.abs(WINNER - 2 / 3) < 1e-12,
  `winner ${WINNER.toFixed(4)}, runner-up ${RUNNER_UP.toFixed(4)}`);

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
const dbFile = path.join(WORK, "save.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development",
    SESSION_SECRET: "runner-up", STARTER_DB_PATH: SHIPPED },
});

/** The squad's stats, all at one level: strong to win, weak to lose (the harness's own copy). */
function setSquad(careerSaveId, teamId, level) {
  const d = new DatabaseSync(dbFile);
  try {
    d.prepare(`UPDATE career_player_state SET speed = ?, power = ?, defense = ?, serve = ?, block = ?, stamina = ?
                WHERE career_save_id = ? AND team_id = ?`).run(level, level, level, level, level, level, careerSaveId, teamId);
  } finally { d.close(); }
}

try {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  const prof = await api("POST", "/profiles", { name: "Runner Up" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", {
    slotNumber: 1, managerName: "Runner Up", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0,
  });
  const team = (await api("GET", "/team")).data;
  const careerSaveId = ((await api("GET", "/careers")).data?.saves ?? []).find((s) => s.teamId === team.id)?.id;

  const rows = [];
  for (let played = 0; played < 10; ) {
    healSquad(dbFile, careerSaveId, team.id);
    setSquad(careerSaveId, team.id, played % 2 === 0 ? 99 : 15);
    const r = await api("POST", "/calendar/next-match", {});
    const matchId = r.data?.matchDay?.matchId;
    if (!matchId) { check("a match day came", false, JSON.stringify(r.data).slice(0, 120)); break; }
    await api("POST", `/matches/${matchId}/simulate`, {});
    await api("POST", "/calendar/dismiss-match", {});
    const m = ((await api("GET", "/matches")).data ?? []).find((x) => x.id === matchId);
    const d = new DatabaseSync(dbFile, { readOnly: true });
    const line = d.prepare(`SELECT amount, description FROM finance_transactions WHERE team_id = ? AND category = 'prize_money' ORDER BY id DESC LIMIT 1`).get(team.id);
    d.close();
    const won = Number(m.homeScore) > Number(m.awayScore);
    const want = Math.round(Number(m.prizeAmount) * (won ? WINNER : RUNNER_UP) * Number(m.purse.multiplier));
    rows.push({ round: m.round, tier: m.tier, purse: Number(m.prizeAmount), multiplier: m.purse.multiplier, won, paid: Number(line?.amount ?? 0), want, line: line?.description ?? "" });
    played++;
  }
  console.log("\n  round  tier     purse     paid at   result      paid      should be");
  for (const r of rows) console.log(`  ${String(r.round).padStart(5)}  ${r.tier.padEnd(7)}${money(r.purse).padStart(9)}  ${String(r.multiplier * 100).padStart(5)}%    ${(r.won ? "won" : "runner-up").padEnd(10)}${money(r.paid).padStart(9)}  ${money(r.want).padStart(9)}`);

  const ups = rows.filter((r) => !r.won), wins = rows.filter((r) => r.won);
  check("ten events played, won and lost", rows.length === 10 && ups.length > 0 && wins.length > 0, `${wins.length} won, ${ups.length} runner-up`);
  check("every runner-up line is a third of what the event pays the club", ups.length > 0 && ups.every((r) => r.paid === r.want && /^Runner-up prize/.test(r.line)),
    ups.map((r) => `${r.tier} ${money(r.paid)}`).join(", "));
  check("every winner's line is two thirds", wins.length > 0 && wins.every((r) => r.paid === r.want && /^Prize money/.test(r.line)),
    wins.map((r) => `${r.tier} ${money(r.paid)}`).join(", "));
  check("the same third in every tier: Bronze and Silver in full, Gold at the 10% above Silver access",
    ["Bronze", "Silver", "Gold"].every((t) => rows.some((r) => r.tier === t))
    && rows.filter((r) => r.tier === "Gold").every((r) => r.multiplier === 0.1)
    && rows.filter((r) => r.tier !== "Gold").every((r) => r.multiplier === 1),
    [...new Set(rows.map((r) => `${r.tier} x${r.multiplier}`))].join(", "));
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  await stopServer(child);
}
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else fs.rmSync(WORK, { recursive: true, force: true });
process.exit(failures > 0 ? 1 : 0);
