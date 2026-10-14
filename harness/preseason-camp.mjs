/**
 * Update 1, overnight brief part 5 (Rob, 14 Oct, item 5): the pre-season camp.
 *
 *   1. (source) nothing at the season rollover heals, rests or resets injury,
 *      fatigue or fitness; every game day the whole club rests (the bench too)
 *   2. the choice opens on day 7 of the off-season (not before), with a Dashboard line
 *   3. a camp length is offered only if it ends before the club's first match
 *      of next season and the club can pay; a refused length says why
 *   4. a camp: paid from the balance with a "Pre-season camp" ledger line; no
 *      normal training for seniors while there; on its last day every senior's
 *      XP rose by its sessions, and fatigue went up by its amount
 *   5. the AI clubs chose too (Medium: a coin flip each, only if they can
 *      afford it), camps ending before the first match, paid from their balance
 *   6. Rest: no senior training; the new season opens with every fit senior at
 *      fitness 100, fatigue 0, morale +5
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healAllSquads, startCareer, keepClubSolvent, keepSideFielded, renewExpiringContracts } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-preseason-"));
const DB = path.join(WORK, "save.sqlite");
const PORT = 4990;
const BASE = `http://localhost:${PORT}/api`;
const SRC = (p) => fs.readFileSync(path.join(REPO, "artifacts", "api-server", "src", p), "utf8");
const { PRESEASON } = await import(pathToFileURL(path.join(REPO, "lib", "db", "src", "schema", "preseason.ts")).href);

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
const info = (s) => console.log(`  INFO  ${s}`);
console.log("=".repeat(72));
console.log("  UPDATE 1, OVERNIGHT PART 5: THE PRE-SEASON CAMP");
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
const q = (sql, ...a) => { const d = new DatabaseSync(DB, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
const w = (sql, ...a) => { const d = new DatabaseSync(DB); try { return d.prepare(sql).run(...a); } finally { d.close(); } };

let teamId = null, cid = null;
const today = () => q(`SELECT current_date AS d FROM calendar_state WHERE team_id = ?`, teamId)[0]?.d;
async function day() {
  healAllSquads(DB);
  keepClubSolvent(DB, teamId);
  await keepSideFielded(api);
  await renewExpiringContracts(api);
  const r = await api("POST", "/calendar/advance", {});
  const id = r.data?.blocked === "pending_match" ? r.data.pendingMatchId : r.data?.matchDay?.matchId;
  if (id) { await api("POST", `/matches/${id}/simulate`); await api("POST", r.data?.blocked === "pending_match" ? "/calendar/skip-match" : "/calendar/dismiss-match"); }
  return r;
}
const seniors = () => q(`SELECT s.player_id AS id, s.training_points AS tp, s.fatigue, s.fitness, s.morale, s.is_injured AS inj, s.injury_status AS status
  FROM career_player_state s JOIN players p ON p.id = s.player_id
  WHERE s.team_id = ? AND s.is_retired = 0 AND (p.player_type = 'senior' OR s.is_promoted = 1)`, teamId);

let child = null;
try {
  fs.copyFileSync(SHIPPED, DB);
  const out = fs.openSync(path.join(WORK, "server.log"), "w");
  child = forkServer({ server: SERVER, electron: ELECTRON, out,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: DB, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "preseason", STARTER_DB_PATH: SHIPPED } });
  for (let i = 0; i < 360; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }

  // ── 1. The rollover and the bench ──────────────────────────────────────────
  console.log("\n1. NOTHING AT THE ROLLOVER HEALS OR RESTS; THE BENCH RESTS EVERY GAME DAY");
  const roll = SRC("utils/seasonRollover.ts");
  check("(source) the season rollover writes no injury, fatigue or fitness", !/injuryStatus|injuryWeeksRemaining|isInjured|fatigue|fitness/.test(roll));
  check("(source) every game day the whole club rests (REST_RECOVERY on every player of the team, the bench included)",
    /updateTeamPlayerState\(careerSaveId, team\.id,\s*\{\s*fatigue: sql`MAX\(0, fatigue - \$\{REST_RECOVERY\.healthy\.fatigue\}\)`/.test(SRC("routes/calendar.ts")));

  const prof = await api("POST", "/profiles", { name: "Preseason" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? [])[0];
  await startCareer(api, { managerFaceId: 8, slotNumber: 1, managerName: "Preseason", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  teamId = (await api("GET", "/team")).data?.id;
  cid = q(`SELECT id FROM career_saves WHERE team_id = ?`, teamId)[0].id;

  // ── 2. Day 7 of the off-season ─────────────────────────────────────────────
  console.log("\n2. THE CHOICE OPENS ON DAY 7 OF THE OFF-SEASON");
  let st = null, sawLine = false, before7 = null;
  for (let i = 0; i < 400; i++) {
    const r = await day();
    if ((r.data?.events ?? []).some((e) => /^Pre-season: choose a camp/.test(e))) sawLine = true;
    st = (await api("GET", "/preseason")).data;
    if (st?.offseason && !st.open && before7 == null) before7 = { today: st.today, choiceOn: st.choiceOn };
    if (st?.offseason && st.open) break;
  }
  const started = q(`SELECT offseason_started_on AS d FROM career_saves WHERE id = ?`, cid)[0]?.d;
  const dayN = started ? Math.round((Date.parse(`${st?.today}T00:00:00Z`) - Date.parse(`${started}T00:00:00Z`)) / 86_400_000) + 1 : null;
  check("the off-season began with the club's last match and the choice opened on its day 7", st?.open === true && dayN === PRESEASON.choiceDay,
    `off-season from ${started}, open on ${st?.today} (day ${dayN})`);
  check("before day 7 it was the off-season but not open yet", before7 != null && before7.today < before7.choiceOn, JSON.stringify(before7));
  check("the day's lines said so (the Dashboard shows a notice from the same state)", sawLine);

  // ── 3. Lengths ─────────────────────────────────────────────────────────────
  console.log("\n3. A LENGTH IS OFFERED ONLY IF IT ENDS BEFORE THE FIRST MATCH AND THE CLUB CAN PAY");
  const okRule = (st?.lengths ?? []).every((l) => l.allowed === (l.endsOn < st.firstMatchOn && st.balance >= PRESEASON.lengths[l.length].cost));
  check("each length's offer matches the rule; a refused one says why", okRule && (st?.lengths ?? []).every((l) => l.allowed || !!l.reason),
    (st?.lengths ?? []).map((l) => `${l.length} ends ${l.endsOn} ${l.allowed ? "ok" : "no"}`).join(", ") + ` (first match ${st?.firstMatchOn})`);
  info(`Olympics: never in the off-season (played between round 70 and the World Finals): no length withheld for them`);
  const refusedLen = (st?.lengths ?? []).find((l) => !l.allowed);
  if (refusedLen) {
    const r = await api("POST", "/preseason", { choice: "camp", location: "power_house", length: refusedLen.length });
    check("booking a refused length is refused with the reason", r.status === 409 && r.data?.error === refusedLen.reason, `${r.status}: ${r.data?.error}`);
  }

  // ── 4. A camp ──────────────────────────────────────────────────────────────
  console.log("\n4. A CAMP: PAID, NO TRAINING WHILE THERE, XP AND FATIGUE AT THE END");
  const len = [...(st?.lengths ?? [])].reverse().find((l) => l.allowed);
  const L = PRESEASON.lengths[len?.length ?? "1w"];
  const budget0 = q(`SELECT budget FROM teams WHERE id = ?`, teamId)[0].budget;
  const booked = await api("POST", "/preseason", { choice: "camp", location: "power_house", length: len?.length });
  const budget1 = q(`SELECT budget FROM teams WHERE id = ?`, teamId)[0].budget;
  const ledger = q(`SELECT amount, description FROM finance_transactions WHERE team_id = ? AND description LIKE 'Pre-season camp%'`, teamId);
  check("the camp is booked and paid from the balance, with a \"Pre-season camp\" ledger line",
    booked.status === 200 && Math.round(budget0 - budget1) === L.cost && ledger.length === 1 && ledger[0].amount === L.cost, `${booked.status}, ${ledger[0]?.description}`);
  const s0 = seniors();
  const train = await api("POST", "/training", { playerId: s0[0].id, type: "Power Camp", durationHours: 2 });
  check("a senior can't book normal training while at camp", train.status === 409 && train.data?.preseason === true, `${train.status}: ${train.data?.error}`);
  const again = await api("POST", "/preseason", { choice: "rest" });
  check("and the club can't choose twice", again.status === 409);
  let s1 = null, prevFat = null;
  for (let i = 0; i < L.days + 2; i++) {
    const was = seniors();
    const r = await day();
    if ((r.data?.events ?? []).some((e) => /^Pre-season camp over/.test(e))) { s1 = seniors(); prevFat = was; break; }
  }
  const tpOk = s1 && s0.every((a) => { const b = s1.find((x) => x.id === a.id); return b && b.tp - a.tp >= L.sessions * 25 * 0.5; });
  const fatOk = s1 && prevFat.every((a) => { const b = s1.find((x) => x.id === a.id); return b && b.fatigue >= Math.min(100, Math.max(0, a.fatigue - 5) + L.fatigue); });
  check(`on its last day every senior's XP rose by ${L.sessions} camp sessions (at least ${L.sessions} x 25 x 0.5)`, !!tpOk,
    s1 ? s0.map((a) => `${s1.find((x) => x.id === a.id)?.tp - a.tp}`).join(", ") : "the camp never ended");
  check(`and fatigue went up by ${L.fatigue} (after the day's rest)`, !!fatOk, s1 ? prevFat.map((a) => `${a.fatigue}->${s1.find((x) => x.id === a.id)?.fatigue}`).join(", ") : "");

  // ── 5. The AI clubs ────────────────────────────────────────────────────────
  console.log("\n5. THE AI CLUBS CHOSE TOO (MEDIUM: A COIN FLIP EACH, ONLY IF THEY CAN AFFORD IT)");
  const ai = q(`SELECT pool_team_id AS club, choice, length, ends_on AS ends, cost, done FROM preseason_choices WHERE career_save_id = ? AND pool_team_id IS NOT NULL`, cid);
  const clubs = q(`SELECT COUNT(*) n FROM career_pool_team_state WHERE career_save_id = ? AND taken_over_at IS NULL`, cid)[0].n;
  const camps = ai.filter((c) => c.choice === "camp");
  check("every AI club chose once (a camp or skip)", ai.length === clubs, `${ai.length} of ${clubs}`);
  check("some went, some didn't (a coin flip each on Medium)", camps.length > 0 && camps.length < ai.length, `${camps.length} camps`);
  check("every AI camp ends before the first match of next season", camps.every((c) => c.ends < st.firstMatchOn));
  check("(source) an AI club goes only if it has 3x the cost in the bank, and pays from its balance",
    /Number\(c\.balance\) >= PRESEASON\.aiAffordTimes \* PRESEASON\.lengths\[l\]\.cost/.test(SRC("utils/preseasonCamp.ts")) && PRESEASON.aiAffordTimes === 3);
  check("the AI camps that ended ran", camps.filter((c) => c.ends <= today()).every((c) => c.done === 1));

  // ── 6. Rest ────────────────────────────────────────────────────────────────
  console.log("\n6. REST: NO TRAINING, AND THE SEASON OPENS FRESH");
  // The camp is done; to try Rest in the same off-season the camp's row is taken away (a harness step).
  w(`DELETE FROM preseason_choices WHERE career_save_id = ? AND team_id = ?`, cid, teamId);
  const rest = await api("POST", "/preseason", { choice: "rest" });
  const trainR = await api("POST", "/training", { playerId: s0[0].id, type: "Power Camp", durationHours: 2 });
  check("Rest is chosen, and seniors can't train for the rest of the off-season", rest.status === 200 && trainR.status === 409, `${rest.status} / ${trainR.status}`);
  const preMorale = new Map(seniors().map((s) => [s.id, s.morale]));
  let rolled = false;
  for (let i = 0; i < 60 && !rolled; i++) {
    const r = await day();
    if (r.data?.seasonRollover?.kind === "rolled") rolled = true;
  }
  const fresh = seniors().filter((s) => !(s.inj === 1 || (s.status ?? "Healthy") !== "Healthy"));
  check("the new season opened with every fit senior at fitness 100, fatigue 0, morale up 5 (to 100 at most)",
    rolled && fresh.length > 0 && fresh.every((s) => s.fitness === 100 && s.fatigue === 0 && s.morale >= Math.min(100, (preMorale.get(s.id) ?? 0))),
    fresh.map((s) => `${s.fitness}/${s.fatigue}/${s.morale}`).join(", "));
} catch (err) {
  failures++;
  console.log(`  FAIL  the suite threw: ${err?.stack ?? err}`);
} finally {
  if (child) await stopServer(child);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
