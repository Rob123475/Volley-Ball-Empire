/**
 * R-50 — injuries and fitness decide who plays, and how well.
 *
 * Before: every contracted, active player was "the side", rated on full stats;
 * all of them "played" every match, so injured players never rested or healed.
 * R-48's diagnosis found three injured players at fitness 0 playing at full
 * rating. Design and numbers: utils/condition.ts.
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 *   source     the old paths are gone: the whole active squad rated on full
 *              stats, the tick engine's "top two active seniors", fitness
 *              recovery gated on low fatigue, playing through an injury — the
 *              scan is proven to fire on the old lines planted back in
 *   sample     the same pair at fitness 0 loses far more often than at 100 over
 *              5,000 matches each, through the engine and the rating /simulate
 *              uses (POST /dev/condition/win-rate, dev-only)
 *   selection  an injured starter is never in a lineup: not auto-selected by
 *              /simulate, refused in a manual lineup, absent from the Unity
 *              side, not charged for the match; the dashboard says who plays
 *              and who cannot
 *   fitness    /simulate rates the pair at 0.6 of its stats at fitness 0, and at
 *              its full stats at fitness 100
 *   rest       the calendar leaves rest days between World Tour matches; a rest
 *              day restores fitness +2 / fatigue -5 (+1 / -3 injured)
 *   injury     injuries heal on the calendar's weekly tick; with two of three
 *              injured the match is forfeited, and the dashboard said it would be
 *   ui         the Team page shows fitness and injury; the Next Match card names
 *              the pair; the match screens cannot pick an injured player
 *
 * Scene-setting writes (injuries, fitness) go straight to the running server's
 * database and must change exactly one row.
 *
 * Usage: node harness/condition.mjs
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
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-condition-"));
const PORT = 4750;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
const src = (...p) => fs.readFileSync(path.join(REPO, ...p), "utf8");

console.log("=".repeat(72));
console.log("  R-50 INJURIES AND FITNESS DECIDE WHO PLAYS, AND HOW WELL");
console.log("=".repeat(72));

// ── 0. The old paths are gone ──────────────────────────────────────────────
console.log("\n0. THE OLD 'IGNORE FITNESS AND INJURIES' PATHS ARE GONE");
const OLD = [
  { name: "the whole active squad rated on full stats", re: /sideRating\(activePlayers\)/ },
  { name: "the whole active squad as the side", re: /activePlayers = players\.filter\(p => p\.isActive\)/ },
  { name: "the top two active seniors, injured or not", re: /isActive: true, playerType: "senior",?\s*\}\)\)\s*\.sort/ },
  { name: "fitness recovery gated on low fatigue", re: /fatigue < 30/ },
  { name: "playing through an injury", re: /Already hurt and still playing|Playing through injury/ },
];
const scan = (text) => OLD.filter(({ re }) => re.test(text)).map((o) => o.name);
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}
const apiFiles = walk(path.join(REPO, "artifacts", "api-server", "src"));
const hits = apiFiles.flatMap((f) => scan(fs.readFileSync(f, "utf8")).map((h) => `${path.relative(REPO, f)}: ${h}`));
check(`none of the old paths remain in ${apiFiles.length} api source files`, hits.length === 0, hits.join("; ") || "clean");
const planted = [
  "  const squadRating = sideRating(activePlayers);",
  "  const activePlayers = players.filter(p => p.isActive);",
  "  const rows = (await loadPlayers(cid, { teamId, isActive: true, playerType: \"senior\" }))\n    .sort((a, b) => sideRating([b]) - sideRating([a]))",
  "    and(eq(careerPlayerStateTable.injuryStatus, \"Healthy\"), sql`fatigue < 30`)!);",
  "  // Already hurt and still playing — 2.5× multiplier",
];
const caught = planted.map(scan);
check("the scan is real: each old line planted back is caught", caught.every((c) => c.length > 0),
  caught.map((c, i) => `#${i + 1} ${c.join("+") || "MISSED"}`).join(" | "));
check("every match path picks the side through selectPair",
  /selectPair\(/.test(src("artifacts/api-server/src/routes/matches.ts"))
    && /selectPair\(/.test(src("artifacts/api-server/src/utils/match-tick-engine.ts"))
    && /selectPair\(/.test(src("artifacts/api-server/src/routes/unity.ts"))
    && /selectPair\(/.test(src("artifacts/api-server/src/routes/game-api.ts")));
check("the board's able-to-play check excludes the injured",
  /eq\(careerPlayerStateTable\.isInjured, false\)/.test(src("artifacts/api-server/src/utils/board-confidence.ts")));

console.log("\n1. THE SCREENS");
const team = src("artifacts/beach-volleyball/src/pages/team.tsx");
const dash = src("artifacts/beach-volleyball/src/pages/dashboard.tsx");
const buttons = src("artifacts/beach-volleyball/src/components/match/MatchActionButtons.tsx");
const matchesPage = src("artifacts/beach-volleyball/src/pages/matches.tsx");
check("the Team page shows each player's fitness, what she plays at, and an injury that rules her out",
  /Fitness \{player\.fitness/.test(team) && /plays at/.test(team) && /cannot be selected/.test(team));
check("the Next Match card names the pair, their fitness, and who cannot be selected",
  /data-testid="next-match-selection"/.test(dash) && /plays at \{p\.contribution\}%/.test(dash) && /cannot be selected/.test(dash));
check("Sim Result's auto-pick leaves injured players out",
  /players\.filter\(isFitToPlay\)/.test(buttons) && /activePlayers\.filter\(isFitToPlay\)\.length >= teamSize/.test(buttons));
check("the lineup pickers refuse an injured player",
  (matchesPage.match(/R-50: an injured player cannot be selected/g) ?? []).length === 2);

// ── Server ─────────────────────────────────────────────────────────────────
if (!fs.existsSync(SERVER)) { console.error(`[condition] FAILED: ${SERVER} not built.`); process.exit(1); }
const dbFile = path.join(WORK, "condition.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "condition-secret" },
});
{
  const deadline = Date.now() + 60000;
  let up = false;
  while (Date.now() < deadline) { try { await fetch(`${BASE}/health`); up = true; break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  if (!up) { console.error("[condition] server never came up"); console.error(fs.readFileSync(path.join(WORK, "server.log"), "utf8").slice(-3000)); process.exit(1); }
}

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
function writeOne(sqlText, ...args) {
  const d = new DatabaseSync(dbFile);
  const { changes } = d.prepare(sqlText).run(...args);
  d.close();
  if (changes !== 1) throw new Error(`scene write changed ${changes} rows: ${sqlText}`);
}
const days = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const mean6 = (p) => (p.speed + p.power + p.defense + p.serve + p.block + p.stamina) / 6;

try {
  // ── 2. The sample ────────────────────────────────────────────────────────
  console.log("\n2. THE SAME PAIR, 5,000 MATCHES AT EACH FITNESS");
  const A0 = session();
  const star = { speed: 90, power: 89, defense: 90, serve: 89, block: 90, stamina: 89 };   // rated 89.5
  const sample = await A0("POST", "/dev/condition/win-rate", { pair: [star, star], opponentRating: 80, samples: 5000, fitness: [100, 50, 0] });
  const [f100, f50, f0] = sample.data?.results ?? [];
  check("the dev win-rate endpoint answers", sample.status === 200 && !!f0, `HTTP ${sample.status}`);
  check("the rating /simulate uses is the pair's stats × (0.6 + 0.4 × fitness/100): 89.5, 71.6, 53.7",
    Math.abs(f100?.rating - 89.5) < 1e-9 && Math.abs(f50?.rating - 89.5 * 0.8) < 1e-9 && Math.abs(f0?.rating - 89.5 * 0.6) < 1e-9,
    `${f100?.rating} / ${f50?.rating} / ${f0?.rating}`);
  const n = sample.data?.samples ?? 0;
  const pooled = ((f100?.wins ?? 0) + (f0?.wins ?? 0)) / (2 * n);
  const z = ((f100?.winRate ?? 0) - (f0?.winRate ?? 0)) / Math.sqrt(pooled * (1 - pooled) * (2 / n));
  check("a fitness-0 pair loses far more often than the same pair at 100 (z > 10), and 50 sits between",
    f0?.winRate < f50?.winRate && f50?.winRate < f100?.winRate && z > 10,
    `win rate vs an 80-rated side: fitness 100 ${(100 * f100?.winRate).toFixed(1)}%, 50 ${(100 * f50?.winRate).toFixed(1)}%, 0 ${(100 * f0?.winRate).toFixed(1)}% over ${n} each (z = ${z.toFixed(1)})`);

  // ── 3. Selection ─────────────────────────────────────────────────────────
  console.log("\n3. AN INJURED STARTER IS NEVER IN A LINEUP");
  const api = session();
  const prof = await api("POST", "/profiles", { name: "CondEst" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const created = await api("POST", "/careers", {
    slotNumber: 1, managerName: "CondEst", managerNationality: "Australia", clubName: "CondEst FC", originalClubName: "CondEst FC",
    season: "Season 1", budget: "500000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a", difficulty: "established",
  });
  const cid = created.data.id, teamId = created.data.teamId;
  const squadRows = () => read(`SELECT s.player_id AS id, p.name, s.squad_role AS role, s.fitness, s.fatigue, s.injury_status AS injury,
      s.is_injured AS injured, s.injury_weeks_remaining AS weeks, s.consecutive_matches_played AS consecutive,
      s.speed, s.power, s.defense, s.serve, s.block, s.stamina
    FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.team_id = ? AND s.is_active = 1`, cid, teamId);
  const byId = (id) => squadRows().find((r) => r.id === id);
  const squad0 = squadRows();
  const starters = squad0.filter((r) => r.role === "starter");
  const inter = squad0.find((r) => r.role === "interchange");
  check("the established starting squad: two starters and an interchange", starters.length === 2 && !!inter,
    squad0.map((r) => `${r.name} (${r.role})`).join(", "));
  const [A, B] = starters, C = inter;
  const setInjury = (id, status, weeks) => writeOne(
    `UPDATE career_player_state SET injury_status = ?, is_injured = ?, injury_weeks_remaining = ? WHERE career_save_id = ? AND player_id = ?`,
    status, status === "Healthy" ? 0 : 1, weeks, cid, id);
  const setCondition = (id, fitness, fatigue) => writeOne(
    `UPDATE career_player_state SET fitness = ?, fatigue = ? WHERE career_save_id = ? AND player_id = ?`, fitness, fatigue, cid, id);

  const matchDates = [];
  async function nextMatchDay(maxDays = 200) {
    for (let i = 0; i < maxDays; i++) {
      const adv = await api("POST", "/calendar/advance", {});
      if (adv.status >= 400) return null;
      const id = adv.data?.matchDay?.matchId ?? (adv.data?.blocked === "pending_match" ? adv.data.pendingMatchId : null);
      if (id != null) { matchDates.push(adv.data.currentDate); return id; }
    }
    return null;
  }

  let matchId = await nextMatchDay();
  check("the career reaches its first World Tour match day", matchId != null, `match ${matchId}`);
  // Injured on the match day itself: an injury set on 1 January heals on the
  // calendar's weekly tick long before the World Tour starts in February.
  setInjury(A.id, "Major Injury", 3);
  const sel1 = (await api("GET", "/dashboard")).data?.nextMatchSelection;
  check("the dashboard's next match names the fit pair and says the injured starter cannot be selected",
    sel1 && sel1.willForfeit === false && sel1.players.map((p) => p.id).sort().join() === [B.id, C.id].sort().join()
      && sel1.unavailable.some((u) => u.id === A.id && u.injuryStatus === "Major Injury" && u.weeksOut === 3),
    JSON.stringify(sel1));
  const unityState = await api("GET", `/unity/match-state?careerSaveId=${cid}&matchId=${matchId}`);
  const unityIds = (unityState.data?.players ?? []).map((p) => p.id);
  check("the Unity payload sends the fit pair, never the injured starter",
    unityState.status === 200 && !unityIds.includes(A.id) && unityIds.includes(B.id) && unityIds.includes(C.id),
    `HTTP ${unityState.status}, players ${unityIds.join(", ")}`);
  const refused = await api("PATCH", `/matches/${matchId}/lineup`, { playerIds: [A.id, B.id] });
  check("a manual lineup with the injured starter is refused, and says why",
    refused.status === 400 && /injured/.test(refused.data?.error ?? ""), `HTTP ${refused.status} ${refused.data?.error}`);

  const aBefore = byId(A.id), bBefore = byId(B.id), cBefore = byId(C.id);
  const sim1 = await api("POST", `/matches/${matchId}/simulate`, {});
  const lineup1 = sim1.data?.lineup ?? [];
  const row1 = read(`SELECT lineup FROM matches WHERE id = ?`, matchId)[0];
  check("auto-selection skips her: the pair that played is the other starter and the interchange",
    sim1.status === 200 && lineup1.length === 2 && !lineup1.includes(A.id) && lineup1.includes(B.id) && lineup1.includes(C.id)
      && JSON.stringify(JSON.parse(row1?.lineup ?? "[]").sort()) === JSON.stringify([...lineup1].sort()),
    `HTTP ${sim1.status}, lineup ${lineup1.join(", ")}, stored ${row1?.lineup}`);
  const aAfter = byId(A.id), bAfter = byId(B.id), cAfter = byId(C.id);
  check("the injured starter was not charged for the match; the pair was",
    aAfter.fitness === aBefore.fitness && aAfter.consecutive === 0
      && bAfter.fitness < bBefore.fitness && cAfter.fitness < cBefore.fitness && bAfter.consecutive === 1 && cAfter.consecutive === 1,
    `A fitness ${aBefore.fitness}->${aAfter.fitness}; B ${bBefore.fitness}->${bAfter.fitness}; C ${cBefore.fitness}->${cAfter.fitness}`);

  // ── 4. Fitness in /simulate ──────────────────────────────────────────────
  console.log("\n4. /SIMULATE RATES THE PAIR BY ITS FITNESS");
  for (const [fitness, factor] of [[0, 0.6], [100, 1.0]]) {
    matchId = await nextMatchDay();
    for (const p of [A, B, C]) setCondition(p.id, fitness, 0);
    const sim = await api("POST", `/matches/${matchId}/simulate`, {});
    const pair = (sim.data?.lineup ?? []).map(byId);
    const raw = pair.reduce((s, p) => s + mean6(p), 0) / pair.length;
    check(`at fitness ${fitness} the side is rated at ${factor} of the pair's stats`,
      sim.status === 200 && pair.length === 2 && Math.abs(sim.data?.squadRating - raw * factor) < 1e-6,
      `squadRating ${sim.data?.squadRating?.toFixed(3)}, pair stats ${raw.toFixed(3)} × ${factor} = ${(raw * factor).toFixed(3)}`);
  }

  // ── 5. Rest ──────────────────────────────────────────────────────────────
  console.log("\n5. REST DAYS EXIST, AND A REST DAY RECOVERS");
  const aNow = byId(A.id);
  setCondition(C.id, 50, 40);
  setCondition(A.id, 50, 40);
  const restDay = await api("POST", "/calendar/advance", {});
  const cRest = byId(C.id), aRest = byId(A.id);
  check("a rest day: a fit player +2 fitness, -5 fatigue",
    restDay.status === 200 && !restDay.data?.matchDay && cRest.fitness === 52 && cRest.fatigue === 35, `C ${cRest.fitness}% / fatigue ${cRest.fatigue}`);
  check("an injured player recovers more slowly: +1 fitness, -3 fatigue",
    aNow.injured === 1 ? aRest.fitness === 51 && aRest.fatigue === 37 : aRest.fitness === 52 && aRest.fatigue === 35,
    `A (${aNow.injury}) ${aRest.fitness}% / fatigue ${aRest.fatigue}`);
  for (let i = 0; i < 3; i++) {
    const id = await nextMatchDay();
    if (id != null) await api("POST", `/matches/${id}/simulate`, {});
  }
  const gaps = matchDates.slice(1).map((d, i) => days(matchDates[i], d));
  check("the calendar leaves at least one rest day between the club's World Tour matches",
    gaps.length >= 4 && gaps.every((g) => g >= 2), `match days ${matchDates.join(", ")}; gaps ${gaps.join(", ")} days`);

  // ── 6. Injuries heal on the calendar; two out forfeits ───────────────────
  console.log("\n6. INJURIES HEAL WEEKLY; TWO OF THREE OUT FORFEITS");
  setInjury(A.id, "Minor Injury", 1);
  let healed = false;
  for (let i = 0; i < 12 && !healed; i++) {
    const adv = await api("POST", "/calendar/advance", {});
    const pending = adv.data?.matchDay?.matchId ?? (adv.data?.blocked === "pending_match" ? adv.data.pendingMatchId : null);
    if (pending != null) { await api("POST", `/matches/${pending}/simulate`, {}); continue; }
    healed = byId(A.id).injury === "Healthy";
  }
  const aHealed = byId(A.id);
  check("a one-week injury heals on the calendar's weekly tick, with no match rested required",
    aHealed.injury === "Healthy" && aHealed.injured === 0, `A ${aHealed.injury}, weeks ${aHealed.weeks}`);

  setInjury(B.id, "Minor Injury", 2);
  setInjury(C.id, "Major Injury", 3);
  const dash2 = (await api("GET", "/dashboard")).data?.nextMatchSelection;
  check("with two of three injured the dashboard says the next match will be forfeited",
    dash2?.willForfeit === true && dash2.unavailable.length === 2, JSON.stringify(dash2));
  const attention = (await api("GET", "/attention-items")).data?.items ?? [];
  check("and the attention panel says why", attention.some((i) => i.id === "squad-unfit" && /Injured players cannot be selected/.test(i.description)),
    JSON.stringify(attention.find((i) => i.id === "squad-unfit") ?? null));
  matchId = await nextMatchDay();
  const forfeit = await api("POST", `/matches/${matchId}/simulate`, {});
  check("the match is forfeited: one fit player cannot take the court",
    forfeit.status === 200 && forfeit.data?.forfeit === true && forfeit.data?.squadIncomplete === true && /injured players cannot be selected/.test(forfeit.data?.reason ?? ""),
    `HTTP ${forfeit.status} ${forfeit.data?.reason}`);
} finally {
  await stopServer(child);
  try { fs.closeSync(out); } catch { /* closed */ }
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
