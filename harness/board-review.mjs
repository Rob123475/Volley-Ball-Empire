/**
 * R-53 / R-55 — the board judges each season against a band of expectation.
 *
 * Replaces board-confidence-ladder.mjs (R-09), which tested a meter that moved
 * +3 on a win and -5 on a loss, was read through a money bracket that made a
 * club with $300k unsackable, and sacked at a read-time zero after any result.
 * Design: docs/r53-design.md, amended by R-55 (bands relative to the pair's
 * strength rank: within 3 places met, 4-7 below — a warning, no strike — 8 or
 * more failed — a strike; two strikes in a row sack, a met season clears them).
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 *   table      the six harness careers of the design's §5 and the §5.1 cases,
 *              re-judged under R-55's bands, plus R-55's own cases (6th-8th is
 *              a warning; two failed in a row sacks; a below season between
 *              them resets nothing; a met season clears the strike), an
 *              underdog judged at its level, money never an immunity, debt,
 *              a collapsing balance, half the season forfeited, season 5 as a
 *              verdict — all through the server's own rule functions
 *              (POST /dev/board/review-table, dev-only)
 *   monthly    the projection: below and failed warn; the freeze at 30, lifted
 *              above 35, held in between
 *   target     at the draw an established starting squad (strength #1) expects
 *              top 4 with 5th-8th below and 9th or worse failed; an underdog
 *              (strength #19) expects any finish; both in plain words
 *   sabotage   the old +3/-5 path is gone: a win, a loss and a forfeit each leave
 *              board confidence where it was; at confidence 0 more losses sack
 *              nobody; and the source no longer contains the old deltas, the
 *              post-result sacking, the forced sale or R-53's rank target — the
 *              scan is proven to fire on the old lines planted back in
 *   freeze     the real monthly check freezes a club at low confidence: a
 *              signing is refused, a renewal on the same terms goes through
 *   review     at the season boundary a club at confidence 0 is sacked by its
 *              review: the season closes, no next season opens, the career ends
 *   abandon    a club without two contracted players is not sacked for its
 *              forfeits inside 30 days, and is sacked at the first one after
 *   dashboard  the dashboard always shows the board's expectation and verdict
 *
 * Scene-setting writes (board confidence) go straight to the running server's
 * database and must change exactly one row.
 *
 * Usage: node harness/board-review.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healAllSquads } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-board-review-"));
const PORT = 4745;
const BASE = `http://localhost:${PORT}/api`;
const YEAR = 2026;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

// ── 0. The old code is gone (static; no server needed) ─────────────────────
console.log("=".repeat(72));
console.log("  R-53 / R-55 THE BOARD REVIEWS SEASONS AGAINST A BAND OF EXPECTATION");
console.log("=".repeat(72));

console.log("\n0. THE OLD +3/-5 PATH AND R-53'S RANK TARGET ARE GONE FROM THE SOURCE");
const OLD = [
  { name: "per-result confidence deltas", re: /confWinDelta|winConfidenceDelta|LOSS_CONFIDENCE_DELTA/ },
  { name: "arithmetic on board confidence", re: /boardConfidence\s*\?\?\s*60\)\s*[+-]/ },
  { name: "the read-time meter and its money bracket", re: /buildBoardConfidenceResult|financeAdjustment|stageForScore|CONFIDENCE_LADDER/ },
  { name: "the forced sale", re: /forcedSale|forced_sale|forcedSaleTarget/ },
  { name: "the R-09 widgets", re: /WarningBanner|BoardConfidenceBar|ConfidenceLadder/ },
  { name: "a write to board confidence outside the review", re: /\.set\(\{[^}]*\bboardConfidence\b/ },
  { name: "R-53's rank target", re: /targetFinish|moneyPlaces|money_places|MONEY_PER_PLACE|DIFFICULTY_ALLOWANCE|far_exceeded/ },
];
function scan(text, file = "") {
  return OLD.filter(({ name, re }) =>
    re.test(text) && !(name === "a write to board confidence outside the review" && file.endsWith(path.join("utils", "board-confidence.ts"))),
  ).map((o) => o.name);
}
function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== "dist") walk(p, exts, out); }
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}
const sources = [
  ...walk(path.join(REPO, "artifacts", "api-server", "src"), [".ts"]),
  ...walk(path.join(REPO, "artifacts", "beach-volleyball", "src"), [".ts", ".tsx"]),
  ...walk(path.join(REPO, "lib", "api-client-react", "src", "generated"), [".ts"]),
  ...walk(path.join(REPO, "lib", "api-zod", "src", "generated"), [".ts"]),
  path.join(REPO, "lib", "api-spec", "openapi.yaml"),
  path.join(REPO, "lib", "db", "src", "schema", "game.ts"),
];
const hits = sources.flatMap((f) => scan(fs.readFileSync(f, "utf8"), f).map((h) => `${path.relative(REPO, f)}: ${h}`));
check(`none of the old confidence code remains in ${sources.length} api, frontend, generated, spec and schema files`,
  hits.length === 0, hits.join("; ") || "clean");
const planted = [
  "        boardConfidence:   Math.min(100, (team.boardConfidence ?? 60) + confWinDelta),",
  "        boardConfidence:   Math.max(0, (team.boardConfidence ?? 60) - 5),",
  "    if (freshTeam && buildBoardConfidenceResult(freshTeam).stage === \"sacked\") {",
  "  forcedSale: { pending: true, player: forcedSaleTarget(team) },",
  "tx.update(teamsTable).set({\n  wins: newWins,\n  boardConfidence: 5,\n}).run();",
  "  const t = targetFinish(strengthRank, difficultyTx(tx, careerSaveId), row.seasonStartBalance);",
];
const caught = planted.map((p) => scan(p, "routes/matches.ts"));
check("the scan is real: each old line planted back is caught", caught.every((c) => c.length > 0),
  caught.map((c, i) => `#${i + 1} ${c.join("+") || "MISSED"}`).join(" | "));
check("the R-09 ladder harness is gone", !fs.existsSync(path.join(REPO, "harness", "board-confidence-ladder.mjs")));

const dashboard = fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", "pages", "dashboard.tsx"), "utf8");
const widget = fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", "components", "career", "board-confidence-widgets.tsx"), "utf8");
check("the dashboard always renders the board card (no 'only when not safe' guard)",
  /\{confidence && <BoardStatusCard board=\{confidence\} \/>\}/.test(dashboard) && !/stage !== "safe"/.test(dashboard));
check("the board card shows the expectation and the verdict in words",
  /\{board\.expectation\}/.test(widget) && /\{board\.verdict\}/.test(widget));

// ── Server ─────────────────────────────────────────────────────────────────
if (!fs.existsSync(SERVER)) {
  console.error(`[board-review] FAILED: ${SERVER} not built.`);
  process.exit(1);
}
const dbFile = path.join(WORK, "board.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: {
    ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT),
    NODE_ENV: "development", SESSION_SECRET: "board-review-secret",
  },
});
{
  const deadline = Date.now() + 60000;
  let up = false;
  while (Date.now() < deadline) {
    try { await fetch(`${BASE}/health`); up = true; break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  if (!up) {
    console.error("[board-review] server never came up");
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
async function newCareer(api, label, difficulty) {
  const prof = await api("POST", "/profiles", { name: label });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const c = await api("POST", "/careers", {
    slotNumber: 1, managerName: label, managerNationality: "Australia",
    clubName: `${label} FC`, originalClubName: `${label} FC`, season: "Season 1",
    budget: "500000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a", difficulty,
  });
  return { careerSaveId: c.data?.id, teamId: c.data?.teamId };
}
function read(sqlText, ...args) {
  const d = new DatabaseSync(dbFile, { readOnly: true });
  const rows = d.prepare(sqlText).all(...args);
  d.close();
  return rows;
}
function writeOne(sqlText, ...args) {
  const d = new DatabaseSync(dbFile);
  const { changes } = d.prepare(sqlText).run(...args);
  d.close();
  if (changes !== 1) throw new Error(`scene write changed ${changes} rows: ${sqlText}`);
}
const boardRow = (cid) => read(`SELECT * FROM board_seasons WHERE career_save_id = ? AND season_year = ?`, cid, YEAR)[0];
const confidenceOf = (teamId) => read(`SELECT board_confidence AS c FROM teams WHERE id = ?`, teamId)[0]?.c;
const days = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** Advance to the next match day without playing anything; returns the match id. */
async function nextMatchDay(api, maxDays = 200) {
  for (let i = 0; i < maxDays; i++) {
    const adv = await api("POST", "/calendar/advance", {});
    if (adv.status >= 400) return null;
    const id = adv.data?.matchDay?.matchId ?? (adv.data?.blocked === "pending_match" ? adv.data.pendingMatchId : null);
    if (id != null) return id;
  }
  return null;
}
/** Play a match as the arc does: simulate, or forfeit a final the bracket refuses. */
async function playMatch(api, id) {
  healAllSquads(dbFile); // R-80: a forfeit here would be measured as a played match
  const sim = await api("POST", `/matches/${id}/simulate`, {});
  if (sim.status < 400) return sim;
  return api("POST", `/matches/${id}/forfeit`, {});
}

try {
  // ── 1. The rules over fixed inputs ───────────────────────────────────────
  console.log("\n1. THE SIX HARNESS CAREERS, THE EARLIER CASES AND R-55'S BANDS, THROUGH THE SERVER'S RULES");
  const A = session();
  const s = (rank, start, end, finish, finals = null, forfeits = 0, matches = 54) =>
    ({ strengthRank: rank, seasonStartBalance: start, seasonEndBalance: end, finish, finalsResult: finals, forfeits, worldTourMatches: matches });
  const e = (grade, conf, strikes, outcome = "safe", money = 0) => ({ grade, conf, strikes, outcome, money });
  const SEMI = "semi-finalist", DNQ = "did not qualify", RU = "runner-up", CHAMP = "champion";
  const CASES = [
    // §5 — the six careers of the final R-52 run (established strength #1, underdog #19)
    { label: "RollStrong", seasons: [s(1, 500000, 1109559, 1, SEMI), s(1, 1109559, 1533058, 4, SEMI), s(1, 1533058, 1974077, 4, SEMI), s(1, 1974077, 2171485, 3, SEMI)],
      expect: [e("met", 69, 0), e("met", 78, 0), e("met", 87, 0), e("met", 96, 0)] },
    { label: "RollStrong2", seasons: [s(1, 500000, 1387354, 1, CHAMP), s(1, 1387354, 1932468, 2, RU), s(1, 1932468, 2264772, 10, DNQ), s(1, 2264772, 2400000, 4, SEMI)],
      expect: [e("met", 80, 0), e("met", 93, 0), e("failed", 68, 1, "final_warning"), e("met", 77, 0)] },
    { label: "RollStrong3", seasons: [s(1, 500000, 1336774, 1, RU), s(1, 1336774, 1704073, 5, DNQ), s(1, 1704073, 2042257, 6, DNQ), s(1, 2042257, 2200000, 4, SEMI)],
      expect: [e("met", 73, 0), e("below", 73, 0, "warning"), e("below", 73, 0, "warning"), e("met", 82, 0)] },
    { label: "RollWeak", seasons: [s(19, 150000, 532420, 8), s(19, 532420, 861040, 15), s(19, 861040, 1120200, 19), s(19, 1120200, 1300000, 18)],
      expect: [e("met", 65, 0), e("met", 70, 0), e("met", 75, 0), e("met", 80, 0)] },
    { label: "RollWeak2 (+ season 5)", seasons: [s(19, 150000, 485200, 12), s(19, 485200, 761920, 19), s(19, 761920, 1051680, 18), s(19, 1051680, 1200000, 19), s(19, 1200000, 1300000, 19)],
      expect: [e("met", 65, 0), e("met", 70, 0), e("met", 75, 0), e("met", 80, 0), e("met", 85, 0, "verdict")] },
    // §5.1 — the earlier cases, judged without the abandonment rule
    { label: "R-48 run 1 RollStrong", seasons: [s(1, 500000, 1100000, 1, RU), s(1, 1100000, 1600000, 11, DNQ), s(1, 1600000, 2300000, 6, DNQ), s(1, 2300000, 2350000, 19, DNQ, 54, 54)],
      expect: [e("met", 73, 0), e("failed", 48, 1, "final_warning"), e("below", 48, 1, "final_warning"), e("failed", 23, 2, "sacked")] },
    { label: "R-48 run 2 RollWeak2", seasons: [s(19, 150000, 456300, 19), s(19, 456300, 1060000, 19), s(19, 1060000, 1390000, 19, DNQ, 54, 54), s(19, 1390000, 1400000, 19, DNQ, 54, 54)],
      expect: [e("met", 65, 0), e("met", 70, 0), e("failed", 45, 1, "final_warning"), e("failed", 20, 2, "sacked")] },
    { label: "R-48 run 2 RollWeak3", seasons: [s(19, 150000, 510100, 7), s(19, 510100, 1160000, 16), s(19, 1160000, 1500000, 19, DNQ, 54, 54), s(19, 1500000, 1510000, 19, DNQ, 54, 54)],
      expect: [e("met", 65, 0), e("met", 70, 0), e("failed", 45, 1, "final_warning"), e("failed", 20, 2, "sacked")] },
    // R-55's bands
    { label: "R-55: 6th, 7th, 8th, 5th is four warnings and no strike (R-54's RollA went 7th, 7th and was sacked)",
      seasons: [s(1, 500000, 1000000, 6, DNQ), s(1, 1000000, 1500000, 7, DNQ), s(1, 1500000, 2000000, 8, DNQ), s(1, 2000000, 2500000, 5, DNQ)],
      expect: [e("below", 60, 0, "warning"), e("below", 60, 0, "warning"), e("below", 60, 0, "warning"), e("below", 60, 0, "warning")] },
    { label: "R-55: two failed seasons in a row still sack",
      seasons: [s(1, 500000, 1000000, 9, DNQ), s(1, 1000000, 1500000, 10, DNQ)],
      expect: [e("failed", 35, 1, "final_warning"), e("failed", 10, 2, "sacked")] },
    { label: "R-55: a below season between two failed seasons resets nothing and adds nothing",
      seasons: [s(1, 500000, 1000000, 9, DNQ), s(1, 1000000, 1500000, 6, DNQ), s(1, 1500000, 2000000, 12, DNQ)],
      expect: [e("failed", 35, 1, "final_warning"), e("below", 35, 1, "final_warning"), e("failed", 10, 2, "sacked")] },
    { label: "R-55: a season that meets expectations clears the strike",
      seasons: [s(1, 500000, 1000000, 9, DNQ), s(1, 1000000, 1500000, 1, CHAMP), s(1, 1500000, 2000000, 9, DNQ), s(1, 2000000, 2500000, 2, RU)],
      expect: [e("failed", 35, 1, "final_warning"), e("met", 55, 0), e("failed", 30, 1, "final_warning"), e("met", 43, 0)] },
    { label: "R-55: an underdog is judged at its level (a #10 squad: top 13 met, 14th-17th below, 18th or worse failed)",
      seasons: [s(10, 500000, 700000, 13), s(10, 700000, 900000, 15), s(10, 900000, 1100000, 18), s(10, 1100000, 1300000, 19)],
      expect: [e("met", 65, 0), e("below", 65, 0, "warning"), e("failed", 40, 1, "final_warning"), e("failed", 15, 2, "sacked")] },
    { label: "money is never an immunity: $5M, two failed seasons in a row",
      seasons: [s(1, 5000000, 5100000, 10, DNQ), s(1, 5100000, 5200000, 9, DNQ)],
      expect: [e("failed", 35, 1, "final_warning"), e("failed", 10, 2, "sacked")] },
    { label: "in debt at season end costs 15", seasons: [s(19, 150000, -20000, 19)], expect: [e("met", 50, 0, "safe", -15)] },
    { label: "a balance that fell more than 25% costs 5", seasons: [s(1, 1000000, 700000, 2)], expect: [e("met", 60, 0, "safe", -5)] },
    { label: "a balance that fell 20% costs nothing", seasons: [s(1, 1000000, 800000, 2)], expect: [e("met", 65, 0)] },
    { label: "half the season forfeited is a failed season, whatever the finish",
      seasons: [s(19, 150000, 160000, 19, DNQ, 27, 54)], expect: [e("failed", 35, 1, "final_warning")] },
    { label: "just under half forfeited is judged on the finish", seasons: [s(19, 150000, 160000, 19, DNQ, 26, 54)], expect: [e("met", 65, 0)] },
    { label: "confidence is clamped at 100", confidence: 95, seasons: [s(19, 150000, 160000, 8)], expect: [e("met", 100, 0)] },
  ];
  const table = await A("POST", "/dev/board/review-table", {
    careers: CASES.map(({ label, confidence, seasons }) => ({ label, confidence, seasons })),
    projections: [
      { confidence: 60, strengthRank: 19, rank: 19 },                  // RollWeak3 at 3W 14L; R-47's RollWeak at 4W 15L
      { confidence: 60, strengthRank: 1, rank: 6 },
      { confidence: 60, strengthRank: 1, rank: 9 },
      { confidence: 55, strengthRank: 1, rank: 9 },
      { confidence: 58, strengthRank: 1, rank: 9, wasFrozen: true },
      { confidence: 58, strengthRank: 1, rank: 9, wasFrozen: false },
      { confidence: 61, strengthRank: 1, rank: 9, wasFrozen: true },
    ],
  });
  check("the dev review-table endpoint answers", table.status === 200, `HTTP ${table.status}`);
  for (const [i, c] of CASES.entries()) {
    const rows = table.data?.careers?.[i]?.rows ?? [];
    const got = rows.map((r) => `S${r.season} R${r.strengthRank} #${r.finish} ${r.grade}${r.gradePoints ? ` ${r.gradePoints > 0 ? "+" : ""}${r.gradePoints}` : ""}${r.honoursPoints ? ` hon +${r.honoursPoints}` : ""}${r.moneyPoints ? ` money ${r.moneyPoints}` : ""} -> ${r.confidenceAfter}, ${r.strikes} strike(s), ${r.outcome}`);
    const ok = rows.length === c.expect.length && c.expect.every((x, k) => rows[k]
      && rows[k].grade === x.grade && rows[k].confidenceAfter === x.conf && rows[k].strikes === x.strikes
      && rows[k].outcome === x.outcome && rows[k].moneyPoints === x.money);
    check(c.label, ok, got.join(" | "));
  }
  const bands = table.data?.careers?.[0]?.rows?.[0];
  check("an established starting pair (strength #1): top 4 met, 5th-8th below, 9th or worse failed",
    bands?.metLine === 4 && bands?.belowFrom === 5 && bands?.failedFrom === 9, JSON.stringify({ metLine: bands?.metLine, belowFrom: bands?.belowFrom, failedFrom: bands?.failedFrom }));
  const weakBands = table.data?.careers?.[3]?.rows?.[0];
  check("the weakest squad (strength #19): any finish meets expectations, none fails",
    weakBands?.metLine === 19 && weakBands?.belowFrom === null && weakBands?.failedFrom === null, JSON.stringify({ metLine: weakBands?.metLine, belowFrom: weakBands?.belowFrom, failedFrom: weakBands?.failedFrom }));
  const proj = table.data?.projections ?? [];
  const pj = (p) => `${p?.confidence}+(${p?.grade} ${p?.points}) warn=${p?.warning} frozen=${p?.frozen}`;
  check("mid-season at #19 with the weakest squad (RollWeak3, R-47's RollWeak): met, no warning, no freeze, no sacking",
    proj[0]?.grade === "met" && proj[0]?.warning === false && proj[0]?.frozen === false, pj(proj[0]));
  check("projected 6th with the strongest squad: below expectations, a warning, no freeze", proj[1]?.grade === "below" && proj[1]?.warning === true && proj[1]?.frozen === false, pj(proj[1]));
  check("projected 9th at confidence 60: failed, a warning, confidence + projection 35 does not freeze", proj[2]?.grade === "failed" && proj[2]?.warning === true && proj[2]?.frozen === false, pj(proj[2]));
  check("projected 9th at confidence 55: 30 freezes spending", proj[3]?.frozen === true, pj(proj[3]));
  check("between 30 and 35 a freeze holds", proj[4]?.frozen === true, pj(proj[4]));
  check("between 30 and 35 an unfrozen club stays unfrozen", proj[5]?.frozen === false, pj(proj[5]));
  check("above 35 the freeze lifts", proj[6]?.frozen === false, pj(proj[6]));

  // ── 2. The expectation at the draw ───────────────────────────────────────
  console.log("\n2. THE EXPECTATION IS SET AT THE DRAW, FROM SQUAD STRENGTH");
  const EST = session(), UND = session();
  const est = await newCareer(EST, "BoardEst", "established");
  const und = await newCareer(UND, "BoardUnd", "underdog");
  const estBudget = read(`SELECT budget FROM teams WHERE id = ?`, est.teamId)[0]?.budget;
  const estRow0 = boardRow(est.careerSaveId);
  check("career creation opens the board's season on the starting budget, with no expectation yet",
    estRow0 && estRow0.season_start_balance === estBudget && estRow0.target == null,
    `start balance ${estRow0?.season_start_balance}, budget ${estBudget}, target ${estRow0?.target}`);
  const before = await EST("GET", "/board-confidence");
  check("before the draw: confidence 60, safe, no expectation, and it says so in words",
    before.status === 200 && before.data?.confidence === 60 && before.data?.stage === "safe" && before.data?.target === null
      && /when the World Tour is drawn/.test(before.data?.expectation ?? "") && /how your best pair ranks/.test(before.data?.expectation ?? "")
      && /No verdict yet/.test(before.data?.verdict ?? ""),
    `${before.data?.expectation} | ${before.data?.verdict}`);

  let estMatch = await nextMatchDay(EST);
  let undMatch = await nextMatchDay(UND);
  check("both careers reach the first World Tour match day", estMatch != null && undMatch != null, `est ${estMatch}, und ${undMatch}`);
  const estDraw = await EST("GET", "/board-confidence");
  const undDraw = await UND("GET", "/board-confidence");
  // R-57: the underdog's monthly clock. The board starts it (projected_on) the
  // first time its daily pass runs after the draw, and every monthly check then
  // OVERWRITES projected_on with the check's date. Sections 3 and 4 play this
  // career forward and can carry it past its first check, so the start is kept
  // the first time it is seen — after every step, never overwritten — instead of
  // being read once when section 5 begins.
  let undClockStart = null;
  const noteUndClock = () => { undClockStart ??= boardRow(und.careerSaveId)?.projected_on ?? null; };
  noteUndClock();
  check("established: strength #1 in the field; top 4 met, 5th-8th below, 9th or worse failed, in plain words",
    estDraw.data?.strengthRank === 1 && estDraw.data?.target === 4 && estDraw.data?.failedFrom === 9 && estDraw.data?.strikes === 0
      && /The board expects a top-4 finish this season/.test(estDraw.data?.expectation ?? "")
      && /5th-8th is below expectations/.test(estDraw.data?.expectation ?? "") && /9th or worse fails the season/.test(estDraw.data?.expectation ?? "")
      && /ranks 1st of the 19 clubs/.test(estDraw.data?.expectation ?? ""),
    estDraw.data?.expectation);
  check("underdog: strength #19 in the field; any finish meets expectations, in plain words",
    undDraw.data?.strengthRank === 19 && undDraw.data?.target === 19 && undDraw.data?.failedFrom === null
      && /The board expects any finish this season/.test(undDraw.data?.expectation ?? "")
      && /no finish counts against you/.test(undDraw.data?.expectation ?? "") && /ranks 19th of the 19 clubs/.test(undDraw.data?.expectation ?? ""),
    undDraw.data?.expectation);

  // ── 3. Sabotage: results no longer move confidence or sack ───────────────
  console.log("\n3. A WIN, A LOSS AND A FORFEIT LEAVE BOARD CONFIDENCE WHERE IT WAS");
  const results = { win: null, loss: null };
  const firedOnResult = [];
  for (const [label, api, career, getMatch, setMatch, want] of [
    ["established", EST, est, () => estMatch, (m) => { estMatch = m; }, "win"],
    ["underdog", UND, und, () => undMatch, (m) => { undMatch = m; }, "loss"],
  ]) {
    for (let n = 0; n < 25 && (results.win == null || results.loss == null); n++) {
      const id = getMatch();
      const conf0 = confidenceOf(career.teamId);
      healAllSquads(dbFile); // R-80: a forfeit here would be measured as a played match
      const played = await api("POST", `/matches/${id}/simulate`, {});
      const conf1 = confidenceOf(career.teamId);
      if (played.data?.fired) firedOnResult.push(`${label} match ${id}`);
      const won = (played.data?.homeScore ?? 0) > (played.data?.awayScore ?? 0);   // as the arc counts it
      const kind = won ? "win" : "loss";
      if (played.status === 200 && results[kind] == null) results[kind] = { label, match: id, before: conf0, after: conf1 };
      setMatch(await nextMatchDay(api));
      noteUndClock();
      if (results[want] != null && label === "established") break;
    }
  }
  check("a win leaves board confidence unchanged (R-09 added 3)", results.win != null && results.win.before === results.win.after,
    results.win ? `${results.win.label} match ${results.win.match}: ${results.win.before} -> ${results.win.after}` : "no win observed");
  check("a loss leaves board confidence unchanged (R-09 took 5)", results.loss != null && results.loss.before === results.loss.after,
    results.loss ? `${results.loss.label} match ${results.loss.match}: ${results.loss.before} -> ${results.loss.after}` : "no loss observed");
  check("no result sacked anyone", firedOnResult.length === 0, firedOnResult.join(", ") || "none");

  const forfeitsBefore = boardRow(est.careerSaveId)?.forfeits;
  const confBeforeForfeit = confidenceOf(est.teamId);
  const forfeit = await EST("POST", `/matches/${estMatch}/forfeit`, {});
  check("a forfeit leaves board confidence unchanged (R-09 took 5), is counted for the review, and sacks nobody",
    forfeit.status === 200 && forfeit.data?.fired === false && confidenceOf(est.teamId) === confBeforeForfeit
      && boardRow(est.careerSaveId)?.forfeits === forfeitsBefore + 1,
    `HTTP ${forfeit.status}, confidence ${confBeforeForfeit} -> ${confidenceOf(est.teamId)}, forfeits ${forfeitsBefore} -> ${boardRow(est.careerSaveId)?.forfeits}`);

  console.log("\n4. AT CONFIDENCE 0, MORE LOSSES SACK NOBODY MID-SEASON");
  writeOne(`UPDATE teams SET board_confidence = 0 WHERE id = ?`, und.teamId);
  const lowRuns = [];
  for (let n = 0; n < 5 && undMatch != null; n++) {
    const played = await playMatch(UND, undMatch);
    lowRuns.push(`${played.data?.homeScore}-${played.data?.awayScore}${played.data?.fired ? " FIRED" : ""}`);
    undMatch = await nextMatchDay(UND);
    noteUndClock();
  }
  const undTeam = await UND("GET", "/team");
  check("five more results at confidence 0: nobody fired, the career is still active, confidence still 0",
    lowRuns.length === 5 && !lowRuns.some((r) => r.includes("FIRED")) && undTeam.status === 200 && confidenceOf(und.teamId) === 0,
    `${lowRuns.join(", ")}; GET /team ${undTeam.status}; confidence ${confidenceOf(und.teamId)}`);

  // ── 5. The monthly check freezes spending ────────────────────────────────
  console.log("\n5. THE MONTHLY CHECK: A CLUB AT CONFIDENCE 0 IS FROZEN, AND CAN STILL RENEW");
  for (let n = 0; n < 40 && boardRow(und.careerSaveId)?.projected_grade == null && undMatch != null; n++) {
    await playMatch(UND, undMatch);
    undMatch = await nextMatchDay(UND);
    noteUndClock();
  }
  const clockStart = undClockStart;
  const checked = boardRow(und.careerSaveId);
  check("the first monthly check comes 30 game days after the draw",
    checked?.projected_grade != null && clockStart != null && days(clockStart, checked.projected_on) >= 30,
    `clock started ${clockStart}, checked ${checked?.projected_on} (${clockStart && checked?.projected_on ? days(clockStart, checked.projected_on) : "?"} days): #${checked?.projected_finish} ${checked?.projected_grade}`);
  check("at confidence 0 the projection freezes spending", checked?.spending_frozen === 1, `spending_frozen ${checked?.spending_frozen}`);
  const frozen = await UND("GET", "/board-confidence");
  check("the board says so: stage spending_freeze, spendingBlocked, the verdict names the projection and the freeze",
    frozen.data?.stage === "spending_freeze" && frozen.data?.spendingBlocked === true
      && /At its last monthly check you were/.test(frozen.data?.verdict ?? "") && /frozen/.test(frozen.data?.verdict ?? ""),
    frozen.data?.verdict);
  const market = (await UND("GET", "/players/market-all?playerType=senior")).data ?? [];
  const freeAgent = (Array.isArray(market) ? market : []).find((p) => p.teamId == null && p.age >= 19);
  const sign = await UND("POST", "/contracts", {
    playerId: freeAgent?.id, salary: freeAgent?.salary ?? 5000, endDate: `${YEAR}-12-31`, bonusPerWin: 0, squadRole: "interchange",
  });
  check("a signing is refused while frozen", sign.status === 403, `HTTP ${sign.status} ${JSON.stringify(sign.data)}`);
  const renewable = ((await UND("GET", "/contracts")).data ?? []).find((c) => c.endDate === `${YEAR}-12-31`);
  const renew = await UND("POST", `/contracts/${renewable?.id}/renew`);
  check("a renewal on the same terms goes through the freeze (R-52)", renew.status === 200, `HTTP ${renew.status} ${renew.data?.endDate}`);

  // ── 6. Abandonment ───────────────────────────────────────────────────────
  console.log("\n6. ABANDONMENT: 30 GAME DAYS WITHOUT A SIDE, SACKED AT THE NEXT FORFEIT");
  const AB = session();
  const ab = await newCareer(AB, "BoardAbandon", "established");
  let abMatch = await nextMatchDay(AB);
  await AB("GET", "/board-confidence");
  const abContracts = (await AB("GET", "/contracts")).data ?? [];
  for (const c of abContracts.slice(0, 2)) await AB("DELETE", `/contracts/${c.id}`);
  const able = read(`SELECT COUNT(*) AS n FROM career_player_state WHERE career_save_id = ? AND team_id = ? AND is_active = 1`, ab.careerSaveId, ab.teamId)[0].n;
  check("the club is down to one contracted player", able === 1, `${able} able`);
  const forfeits = [];
  for (let n = 0; n < 30 && abMatch != null; n++) {
    const date = (await AB("GET", "/calendar")).data?.currentDate;
    healAllSquads(dbFile); // R-80: a forfeit here would be measured as a played match
    const r = await AB("POST", `/matches/${abMatch}/simulate`, {});
    const since = boardRow(ab.careerSaveId)?.unfieldable_since;
    forfeits.push({ date, since, days: since ? days(since, date) : null, forfeit: r.data?.forfeit === true, fired: r.data?.fired === true });
    if (r.data?.fired) break;
    abMatch = await nextMatchDay(AB);
  }
  const early = forfeits.filter((f) => !f.fired);
  const firing = forfeits.find((f) => f.fired);
  check("every match is a forfeit", forfeits.length > 0 && forfeits.every((f) => f.forfeit), `${forfeits.length} matches`);
  check("forfeits inside 30 days do not sack", early.length > 0 && early.every((f) => f.days != null && f.days < 30),
    early.map((f) => `${f.date} day ${f.days}`).join(", "));
  check("the first forfeit 30 or more days in sacks the manager", firing != null && firing.days >= 30,
    firing ? `${firing.date}: day ${firing.days} since ${firing.since}` : "never sacked");
  const abSave = read(`SELECT id, retired_at FROM career_saves WHERE id = ?`, ab.careerSaveId)[0];
  const abHistory = read(`SELECT type, description FROM career_history_entries WHERE career_save_id = ? ORDER BY id DESC LIMIT 1`, ab.careerSaveId)[0];
  check("the career really ended: retired, with a dismissal that says why",
    !!abSave?.retired_at && abHistory?.type === "dismissal" && /days without two contracted players/.test(abHistory?.description ?? ""),
    abHistory?.description);

  // ── 7. The season review sacks ───────────────────────────────────────────
  console.log("\n7. THE SEASON REVIEW: A CLUB AT CONFIDENCE 0 IS SACKED AT THE BOUNDARY");
  let boundary = null;
  for (let n = 0; n < 400 && !boundary; n++) {
    const r = await UND("POST", "/calendar/advance", {});
    if (r.status >= 400) { boundary = { error: r }; break; }
    const id = r.data?.matchDay?.matchId ?? (r.data?.blocked === "pending_match" ? r.data.pendingMatchId : null);
    if (id != null) { await playMatch(UND, id); continue; }
    if (r.data?.seasonRollover && r.data.seasonRollover.kind !== "none") boundary = r;
  }
  const roll = boundary?.data?.seasonRollover;
  check("the boundary comes back as a sacking, with the review that decided it",
    roll?.kind === "sacked" && boundary.data?.fired === true && roll.review?.outcome === "sacked"
      && roll.review.confidenceBefore === 0 && roll.review.confidenceAfter <= 20 && /Sacked\./.test(roll.review.text ?? ""),
    roll?.review?.text ?? JSON.stringify(boundary?.data ?? boundary?.error?.data));
  const undBoard = boardRow(und.careerSaveId);
  check("the review is recorded on the season", undBoard?.outcome === "sacked" && undBoard?.reviewed_on === `${YEAR}-12-31`
    && undBoard?.finish != null && undBoard?.grade != null, `finish #${undBoard?.finish} vs top-${undBoard?.target}, ${undBoard?.grade}, ${undBoard?.confidence_before} -> ${undBoard?.confidence_after}`);
  const nextSeason = read(`SELECT COUNT(*) AS n FROM seasons WHERE career_save_id = ? AND year = ?`, und.careerSaveId, YEAR + 1)[0].n;
  const undSave = read(`SELECT retired_at FROM career_saves WHERE id = ?`, und.careerSaveId)[0];
  const undHistory = read(`SELECT type, description FROM career_history_entries WHERE career_save_id = ? AND type = 'dismissal'`, und.careerSaveId)[0];
  const afterTeam = await UND("GET", "/board-confidence");
  check("no next season opened, the career is retired, and the dismissal carries the review",
    nextSeason === 0 && !!undSave?.retired_at && /Season 1 review/.test(undHistory?.description ?? "") && afterTeam.status === 404,
    `${nextSeason} seasons in ${YEAR + 1}; retired ${!!undSave?.retired_at}; GET /board-confidence ${afterTeam.status}; ${undHistory?.description}`);
} finally {
  await stopServer(child);
  try { fs.closeSync(out); } catch { /* closed */ }
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
