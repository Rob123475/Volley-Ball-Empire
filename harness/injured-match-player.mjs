/**
 * Unity match brief (29 Sep), item 14 — an injured Match Player: the game says so.
 *
 * Rob, 4 Mar 2026 in his career: Nyasha Ncube injured (Minor, 1 week, "cannot be
 * selected") yet still in a Match Player slot; the dashboard said "All Fit,
 * Squad available", the Next Match card listed her at fitness 100%, and
 * Attention Required had no injury card.
 *
 * Today's code (before this item): the match itself already left an injured
 * player out (utils/condition.ts selectPair) and brought the interchange on,
 * silently; her squad role never changed. Two injury tests disagreed: the
 * dashboard's Fitness tile and the Attention card read is_injured alone, GET
 * /calendar and the medical count injury_status alone. The Team page let her be
 * made a Match Player. And after a Sim Result or Skip only the calendar was
 * fetched again (item 12), so the dashboard kept the pre-match picture.
 *
 * Asserted, on a starter-DB copy (Sydney Riptide: two Match Players and an
 * interchange):
 *   - injure Match Player A (and, separately, flags that disagree): the
 *     dashboard's injured count and GET /calendar's agree, the Attention list
 *     has "A is injured and still a Match Player" pointing to the Team page, and
 *     A cannot be made a Match Player again;
 *   - match day: the interchange C comes in for A automatically, the roles swap,
 *     the MATCH DAY box data says who and why, and the card goes;
 *   - the match is played: A did not play, C did;
 *   - two injured with no healthy interchange: the box says the match is
 *     forfeited, and it is.
 *
 * Usage: node harness/injured-match-player.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healSquadByTeam } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-injured-mp-"));
const PORT = 4922;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  UNITY 14: AN INJURED MATCH PLAYER - THE GAME SAYS SO");
console.log("=".repeat(72));
if (!fs.existsSync(SERVER)) { console.error(`[injured-match-player] FAILED: ${SERVER} not built.`); process.exit(1); }

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
const dbFile = path.join(WORK, "inj.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
function read(q, ...a) { const d = new DatabaseSync(dbFile, { readOnly: true }); try { return d.prepare(q).all(...a); } finally { d.close(); } }
function write(q, ...a) { const d = new DatabaseSync(dbFile); try { return d.prepare(q).run(...a).changes; } finally { d.close(); } }

const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "injured-mp" },
});

try {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  const prof = await api("POST", "/profiles", { name: "Injury Test" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", {
    slotNumber: 1, managerName: "Injury Test", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0,
  });
  const teamId = (await api("GET", "/team")).data?.id;
  const cid = ((await api("GET", "/careers")).data?.saves ?? []).find((s) => s.slotNumber === 1)?.id;
  const squad = () => read(`SELECT s.player_id AS id, p.name, s.squad_role AS role, s.is_injured AS injured, s.injury_status AS status
      FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.career_save_id = ? AND s.team_id = ? AND s.is_active = 1`, cid, teamId);
  const role = (id) => squad().find((r) => r.id === id)?.role;
  const s0 = squad();
  const [A, B] = s0.filter((r) => r.role === "starter");
  const C = s0.find((r) => r.role === "interchange");
  check("the starting squad: two Match Players and an interchange", !!A && !!B && !!C, s0.map((r) => `${r.name} (${r.role})`).join(", "));
  const setInjury = (id, status, weeks, flag = status === "Healthy" ? 0 : 1) => write(
    `UPDATE career_player_state SET injury_status = ?, is_injured = ?, injury_weeks_remaining = ? WHERE career_save_id = ? AND player_id = ?`,
    status, flag, weeks, cid, id);
  const injured = async () => ({ dash: (await api("GET", "/dashboard")).data?.injuredCount, cal: (await api("GET", "/calendar")).data?.teamFitness?.injuredCount });

  // 1. One test for injured: both flags, and flags that disagree.
  setInjury(B.id, "Minor Injury", 1, 0);
  let n = await injured();
  check("flags that disagree (is_injured 0, status Minor Injury): the dashboard and the calendar both count her injured", n.dash === 1 && n.cal === 1, `dashboard ${n.dash}, calendar ${n.cal}`);
  setInjury(B.id, "Healthy", 0);
  // Long enough to last to match day (the first is weeks away; injuries heal weekly).
  setInjury(A.id, "Minor Injury", 20);
  n = await injured();
  check(`Match Player ${A.name} injured: the dashboard is not "All Fit"`, n.dash === 1 && n.cal === 1, `dashboard ${n.dash} injured, calendar ${n.cal}`);
  const dash = (await api("GET", "/dashboard")).data;
  check("the Next Match card does not list her as playing; it lists her as unavailable",
    !(dash?.nextMatchSelection?.players ?? []).some((p) => p.id === A.id) && (dash?.nextMatchSelection?.unavailable ?? []).some((p) => p.id === A.id),
    `plays: ${(dash?.nextMatchSelection?.players ?? []).map((p) => p.name).join(", ")}; unavailable: ${(dash?.nextMatchSelection?.unavailable ?? []).map((p) => p.name).join(", ")}`);
  let items = (await api("GET", "/attention-items")).data?.items ?? [];
  const card = items.find((i) => i.id === `match-player-injured-${A.id}`);
  check("Attention Required: she is injured and still a Match Player, with a link to the Team page",
    !!card && card.priority === "red" && card.navigateTo === "/team", card ? `"${card.title}" -> ${card.navigateTo}` : `items: ${items.map((i) => i.id).join(", ")}`);
  // Moving her out and back in: the interchange slot is fine, the Match Player slot is refused.
  const toInter = await api("PATCH", `/team/roster/${A.id}/role`, { role: "interchange" });
  const backIn = await api("PATCH", `/team/roster/${A.id}/role`, { role: "starter" });
  check("an injured player cannot be made a Match Player", backIn.status === 422 && /injured/i.test(backIn.data?.error ?? ""), `interchange ${toInter.status}, starter ${backIn.status}: ${backIn.data?.error ?? ""}`);
  // Put the squad back as Rob had it: A in a Match Player slot while injured.
  write(`UPDATE career_player_state SET squad_role = 'starter' WHERE career_save_id = ? AND player_id = ?`, cid, A.id);
  write(`UPDATE career_player_state SET squad_role = 'interchange' WHERE career_save_id = ? AND player_id = ?`, cid, C.id);

  // 2. Match day: the interchange comes in, and the box says so.
  const nm = await api("POST", "/calendar/next-match");
  const matchId = nm.data?.matchDay?.matchId;
  const cal = (await api("GET", "/calendar")).data;
  const team = cal?.matchDayTeam;
  check("match day: the fittest healthy interchange came in, the roles are swapped", role(A.id) === "interchange" && role(C.id) === "starter",
    `${A.name}: ${role(A.id)}, ${C.name}: ${role(C.id)}`);
  check("the MATCH DAY box data says who plays and who came in for whom",
    (team?.pair ?? []).map((p) => p.id).sort().join() === [B.id, C.id].sort().join()
    && (team?.substitutions ?? []).some((l) => l.includes(C.name) && l.includes(A.name) && /minor injury/i.test(l)) && team?.willForfeit === false,
    `playing ${(team?.pair ?? []).map((p) => p.name).join(" & ")}; ${(team?.substitutions ?? []).join(" | ")}`);
  check("the day's events say it too", (nm.data?.events ?? []).some((e) => e.includes(`${C.name} comes in for ${A.name}`)), (nm.data?.events ?? []).join(" | "));
  items = (await api("GET", "/attention-items")).data?.items ?? [];
  check("the Attention card has gone (she is no longer a Match Player); her injury card remains",
    !items.some((i) => i.id === `match-player-injured-${A.id}`) && items.some((i) => i.id === `injured-${A.id}`));

  // 3. The match: she did not play, the interchange did.
  const sim = await api("POST", `/matches/${matchId}/simulate`);
  const played = read(`SELECT lineup, status FROM matches WHERE id = ?`, matchId)[0];
  const lineup = JSON.parse(played?.lineup ?? "[]");
  check("the match was played without her, and with the interchange", played?.status === "completed" && !lineup.includes(A.id) && lineup.includes(C.id) && lineup.includes(B.id),
    `status ${played?.status}, played: ${lineup.join(", ")} (A ${A.id}, B ${B.id}, C ${C.id}); simulate ${sim.status}`);
  await api("POST", "/calendar/dismiss-match");

  // 4. Nobody healthy left: the forfeit rule.
  healSquadByTeam(dbFile, teamId);
  write(`UPDATE career_player_state SET squad_role = 'starter' WHERE career_save_id = ? AND player_id IN (?, ?)`, cid, A.id, B.id);
  write(`UPDATE career_player_state SET squad_role = 'interchange' WHERE career_save_id = ? AND player_id = ?`, cid, C.id);
  setInjury(A.id, "Major Injury", 20);
  setInjury(C.id, "Minor Injury", 20);
  const nm2 = await api("POST", "/calendar/next-match");
  const m2 = nm2.data?.matchDay?.matchId;
  const t2 = (await api("GET", "/calendar")).data?.matchDayTeam;
  check("no healthy interchange: nobody is swapped, and the box says the match is forfeited", role(A.id) === "starter" && t2?.willForfeit === true && (t2?.substitutions ?? []).length === 0,
    `${A.name}: ${role(A.id)}, willForfeit ${t2?.willForfeit}`);
  const sim2 = await api("POST", `/matches/${m2}/simulate`);
  const f = read(`SELECT status, home_score AS h, away_score AS a FROM matches WHERE id = ?`, m2)[0];
  check("the existing forfeit rule applies", f?.status === "completed" && sim2.data?.squadIncomplete === true && f.h === 0,
    `simulate ${sim2.status}: ${(sim2.data?.highlights ?? []).join(" ")} (${f?.h}-${f?.a})`);

  // 5. The client: one test, and the box shows it.
  const read_ = (p) => fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", p), "utf8");
  check("Team page: an injured card says \"does not play\", and its Match Player button is locked", /injured \? "does not play"/.test(read_("pages/team.tsx")) && /isInjuryLocked = r === "starter" && injured/.test(read_("pages/team.tsx")));
  check("MATCH DAY box: shows who plays and the substitution", /data-testid="match-day-substitution"/.test(read_("components/match-day-modal.tsx")));
  const srv = (p) => fs.readFileSync(path.join(REPO, "artifacts", "api-server", "src", p), "utf8");
  check("server: every injured count uses the one test (no is_injured-only or status-only count left)",
    !/players\.filter\(p => p\.isInjured\)/.test(srv("routes/dashboard.ts")) && !/players\.filter\(p => p\.isInjured\)/.test(srv("routes/attention.ts"))
    && !/p\.injuryStatus !== "Healthy"\)\.length/.test(srv("routes/calendar.ts") + srv("routes/medical.ts")));
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  try { await stopServer(child); } catch { /* stopped */ }
  try { fs.closeSync(out); } catch { /* closed */ }
}
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
