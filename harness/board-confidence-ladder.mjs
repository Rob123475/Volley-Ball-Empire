/**
 * R-09 — the board-confidence escalation ladder actually does something.
 *
 * `docs/economy-design.md` §5 "Fail state": warning -> spending blocked ->
 * forced player sales pending -> sacked, and "the player must always see it
 * coming." Before this fix `isJobAtRisk`/`boardConfidence` were computed
 * server-side with zero consumers — nothing blocked spending, nothing
 * queued a forced sale, and a manager could sit at 0% confidence forever
 * with no visible consequence.
 *
 * ── How the ladder is driven ────────────────────────────────────────────────
 * The ladder's stage boundaries are read-time (score = rawScore +
 * financeAdjustment, see utils/board-confidence.ts), so the fast, precise
 * way to land exactly on each boundary — the same reasoning
 * fixture-transaction.mjs gives for its own direct-DB sabotage rather than
 * trying to force the failure from outside the app — is writing
 * teams.board_confidence and teams.budget directly via node:sqlite, then
 * reading GET /board-confidence to assert the computed stage and its
 * effects. Driving every stage via real match losses would need a dozen-plus
 * simulated matches per stage and would still depend on the win/loss RNG
 * rather than proving the boundary itself.
 *
 * The final transition (spending_blocked -> sacked) is instead driven by a
 * REAL forfeit — a deterministic 0-21 loss through the actual
 * POST /matches/:id/forfeit code path — specifically to prove the fail
 * state fires from live gameplay, not only from the read endpoint.
 *
 * Usage: node harness/board-confidence-ladder.mjs
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
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-confidence-ladder-"));
const PORT = 4625;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

if (!fs.existsSync(SERVER)) {
  console.error(`[board-confidence-ladder] FAILED: ${SERVER} not built. Run the api-server build first.`);
  process.exit(1);
}

console.log("=".repeat(72));
console.log("  R-09 BOARD CONFIDENCE ESCALATION LADDER");
console.log("=".repeat(72));

const dbFile = path.join(WORK, "confidence-ladder.sqlite");
fs.copyFileSync(SHIPPED, dbFile);

const logFile = path.join(WORK, "server.log");
const out = fs.openSync(logFile, "w");
const child = forkServer({
  server: SERVER,
  electron: ELECTRON,
  out,
  env: {
    ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT),
    NODE_ENV: "development", SESSION_SECRET: "confidence-ladder-secret",
  },
});

const base = `http://localhost:${PORT}/api`;
let cookie = "";
const api = async (method, p, body) => {
  const res = await fetch(base + p, {
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

function setTeamState(teamId, boardConfidence, budget) {
  const db = new DatabaseSync(dbFile);
  db.prepare("UPDATE teams SET board_confidence = ?, budget = ? WHERE id = ?").run(boardConfidence, budget, teamId);
  db.close();
}

const deadline = Date.now() + 25000;
let up = false;
while (Date.now() < deadline) {
  try { await fetch(`${base}/health`); up = true; break; }
  catch { await new Promise((r) => setTimeout(r, 250)); }
}
if (!up) {
  console.error("[board-confidence-ladder] server never came up");
  console.error(fs.readFileSync(logFile, "utf8").slice(-2000));
  process.exit(1);
}

try {
  const profileRes = await api("POST", "/profiles", { name: "ConfidenceLadder" });
  await api("POST", `/profiles/${profileRes.data.id}/select`);
  const careerRes = await api("POST", "/careers", {
    slotNumber: 1, managerName: "ConfidenceLadder", managerNationality: "Australia",
    clubName: "Ladder FC", originalClubName: "Ladder FC", season: "Season 1",
    budget: "500000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a",
  });
  const teamId = careerRes.data.teamId;
  check("career created with a team", !!teamId, `teamId=${teamId}`);

  // ── Stage 0: safe (high confidence, healthy budget) ──────────────────────
  setTeamState(teamId, 60, 500_000);
  let conf = await api("GET", "/board-confidence");
  check("stage=safe at high confidence/budget", conf.data?.stage === "safe", `score=${conf.data?.score}`);
  check("spendingBlocked=false when safe", conf.data?.spendingBlocked === false);

  // ── Stage 1: warning ───────────────────────────────────────────────────
  setTeamState(teamId, 20, 500_000);
  conf = await api("GET", "/board-confidence");
  check("stage=warning", conf.data?.stage === "warning", `score=${conf.data?.score}`);
  check("spendingBlocked=false at warning (not yet gated)", conf.data?.spendingBlocked === false);
  check("warning text present", typeof conf.data?.warning === "string" && conf.data.warning.length > 0, conf.data?.warning);

  // ── Stage 2: spending blocked — the gate must actually refuse spending ───
  setTeamState(teamId, 5, 500_000);
  conf = await api("GET", "/board-confidence");
  check("stage=spending_blocked", conf.data?.stage === "spending_blocked", `score=${conf.data?.score}`);
  check("spendingBlocked=true", conf.data?.spendingBlocked === true);

  const signAttempt = await api("POST", "/contracts", {
    playerId: 1, salary: 1000, endDate: "2026-12-31", bonusPerWin: 0, squadRole: "interchange",
  });
  check("new signing refused while spending is blocked",
    signAttempt.status === 403, `HTTP ${signAttempt.status} ${JSON.stringify(signAttempt.data)}`);

  // ── Stage 3: forced sale pending — needs poor finances too (raw alone
  //    cannot reach this stage at a healthy budget: +5 finance adjustment
  //    floors the read-time score at 5, which is its own tested property) ──
  setTeamState(teamId, 27, -10_000);
  conf = await api("GET", "/board-confidence");
  check("stage=forced_sale_pending", conf.data?.stage === "forced_sale_pending", `score=${conf.data?.score}`);
  check("forced sale is queued with a named target",
    conf.data?.forcedSale?.pending === true && !!conf.data?.forcedSale?.player,
    JSON.stringify(conf.data?.forcedSale));
  // raw board confidence floors at 0; at a healthy budget (+5 finance
  // adjustment) that is score=5 (spending_blocked), never forced_sale_pending
  // or sacked — good finances protect against the worst two stages.
  setTeamState(teamId, 0, 500_000);
  const healthyFloor = await api("GET", "/board-confidence");
  check("a healthy budget alone cannot reach forced_sale_pending or sacked",
    healthyFloor.data?.stage === "spending_blocked" && healthyFloor.data?.score === 5,
    `stage=${healthyFloor.data?.stage} score=${healthyFloor.data?.score}`);

  // ── Stage 4: sacked — driven by a REAL forfeit, not a direct write ───────
  setTeamState(teamId, 5, 200_000); // score=5 (spending_blocked); one more loss reaches zero
  const upcoming = await api("GET", "/matches/upcoming");
  const nextMatch = Array.isArray(upcoming.data) ? upcoming.data[0] : null;
  check("an upcoming fixture exists to forfeit", !!nextMatch, JSON.stringify(upcoming.data?.[0] ?? upcoming.data));

  const forfeitRes = await api("POST", `/matches/${nextMatch?.id}/forfeit`);
  check("forfeit request succeeds", forfeitRes.status === 200, `HTTP ${forfeitRes.status} ${JSON.stringify(forfeitRes.data)}`);
  check("the forfeit that crossed zero ends the career (fired/careerEnded)",
    forfeitRes.data?.fired === true && forfeitRes.data?.careerEnded === true,
    JSON.stringify(forfeitRes.data));

  // ── Confirm the career is REALLY terminated (Hall of Fame archive,
  //    retired career save, history entry), not merely disconnected ────────
  const summaryAfter = await api("GET", "/careers/summary");
  check("no active career after being sacked", summaryAfter.status === 404, `HTTP ${summaryAfter.status}`);

  const confAfter = await api("GET", "/board-confidence");
  check("board-confidence also has no active career post-sacking", confAfter.status === 404, `HTTP ${confAfter.status}`);

  const db = new DatabaseSync(dbFile, { readOnly: true });
  const save = db.prepare("SELECT id, retired_at FROM career_saves WHERE team_id = ?").get(teamId);
  check("career save marked retired (career actually ended, not just disconnected)",
    !!save?.retired_at, JSON.stringify(save));
  const history = db.prepare(
    "SELECT type, description FROM career_history_entries WHERE career_save_id = ? ORDER BY id DESC LIMIT 1",
  ).get(save?.id ?? -1);
  check("dismissal history entry recorded", history?.type === "dismissal", JSON.stringify(history));
  const hof = db.prepare("SELECT COUNT(*) as n FROM hall_of_fame WHERE club_name = ?").get("Ladder FC");
  check("archived to Hall of Fame", (hof?.n ?? 0) >= 1, JSON.stringify(hof));
  db.close();
} finally {
  // R-36: quit through R-31's shutdown path rather than SIGKILL, so the
  // database is left checkpointed with no -wal sidecar. The settle sleep
  // that used to follow the kill was only covering for that.
  await stopServer(child);
  try { fs.closeSync(out); } catch {}
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch {} }
process.exit(failures > 0 ? 1 : 0);
