/**
 * Unity match brief (29 Sep), item 21 — achievements check.
 *
 * Rob's career (2 wins, 2 losses: W L W L): "Unstoppable, win 5 consecutive
 * matches" at 4/5 and Records "Best Winning Streak: 4 in a row"; "Most Prize
 * Money Earned: $95,150" (all income); "First Tournament Win" whose rule was
 * "win your first match"; "Develop the Best" unlocked on day 1 by a starting
 * 90; the Trophy Cabinet's own 18 achievements beside Steam's 29.
 *
 * Asserted:
 *   A. The Trophy Cabinet lists exactly Steam's 29 (GET /achievements, the list
 *      the server announces to Steam): same keys, names, descriptions, order;
 *      no in-game-only achievement; no "Sold On". Every one of the 29 rules
 *      is locked one step below its threshold and unlocks at it (counters set
 *      on a starter-DB copy, the game's own check run by a dev-only route).
 *   B. A real career: four matches forced to W L W L -> best streak 1 (the old
 *      count gave 4); Most Prize Money = the prize_money ledger rows only; a
 *      starting squad player already at 85+ does not unlock Future Superstar,
 *      a squad player who joined under 85 and reaches 85 does.
 *
 * Usage: node harness/achievements-29.mjs
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
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-achievements-29-"));
const PORT = 4929;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  UNITY 21: ACHIEVEMENTS - ONE LIST OF 29, HONEST RULES AND RECORDS");
console.log("=".repeat(72));
if (!fs.existsSync(SERVER)) { console.error(`[achievements-29] FAILED: ${SERVER} not built.`); process.exit(1); }

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
const dbFile = path.join(WORK, "ach.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const sql = (q, ...a) => { const d = new DatabaseSync(dbFile); try { return q.trim().toUpperCase().startsWith("SELECT") ? d.prepare(q).all(...a) : d.prepare(q).run(...a); } finally { d.close(); } };
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "achievements-29" },
});

async function newCareer(slot, name) {
  const prof = await api("POST", "/profiles", { name });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
  const c = await api("POST", "/careers", {
    slotNumber: slot, managerName: name, managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0,
  });
  return { careerSaveId: c.data?.id, teamId: c.data?.teamId };
}

try {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }

  // ── A. One list, and every rule unlocks at its threshold ────────────────────
  console.log("\nA. THE 29");
  const A = await newCareer(1, "Ach Rules");
  const steam = (await api("GET", "/achievements")).data ?? [];
  const steamList = Array.isArray(steam) ? steam : (steam.achievements ?? []);
  const cabinet = (await api("GET", "/trophies/cabinet")).data?.achievements ?? [];
  const same = steamList.length === 29 && cabinet.length === 29 && steamList.every((s, i) =>
    cabinet[i]?.id === s.key && cabinet[i]?.title === s.name && cabinet[i]?.description === s.description);
  check("the Trophy Cabinet lists exactly Steam's 29: same keys, names, descriptions, order", same,
    `cabinet ${cabinet.length}, Steam list ${steamList.length}; first ${cabinet[0]?.id}/${steamList[0]?.key}, last ${cabinet.at(-1)?.id}/${steamList.at(-1)?.key}`);
  const oldIds = ["first_win", "five_wins", "winning_streak_5", "first_continental", "high_ovr", "seasons_20_town", "elite_staff", "hidden_gem"];
  check("no in-game-only achievement is left, and no \"Sold On\"", !cabinet.some((a) => oldIds.includes(a.id)) && !steamList.some((s) => s.key === "sold_on"));
  check("the cabinet page keeps that order (no unlocked-first sort)",
    !/\.sort\(\(a, b\) => Number\(b\.unlocked\) - Number\(a\.unlocked\)\)/.test(fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/pages/trophy-cabinet.tsx"), "utf8")));

  const readStats = () => JSON.parse(sql(`SELECT career_stats AS s FROM career_saves WHERE id = ?`, A.careerSaveId)[0].s ?? "{}");
  const writeStats = (patch) => { const s = { ...readStats(), ...patch }; sql(`UPDATE career_saves SET career_stats = ? WHERE id = ?`, JSON.stringify(s), A.careerSaveId); };
  const setTeam = (col, v) => sql(`UPDATE teams SET ${col} = ? WHERE id = ?`, v, A.teamId);
  const setSeasonsAtClub = (n) => {
    sql(`DELETE FROM season_final_standings WHERE team_id = ?`, A.teamId);
    for (let y = 0; y < n; y++) sql(`INSERT INTO season_final_standings (team_id, season_year, rank, competitor_name, is_player, created_at) VALUES (?, ?, 1, 'Ach Rules', 1, 0)`, A.teamId, 1990 + y);
  };
  const continents = ["europe", "asia", "oceania", "north_america", "south_america", "africa_middle_east"];
  // Every rule: how to move its counter, and its threshold. Grouped by counter, ascending.
  const RULES = [
    ["first_steps", (v) => setTeam("wins", v), 1],
    ["battle_hardened", (v) => writeStats({ matchesWon: v }), 50], ["century_wins", (v) => writeStats({ matchesWon: v }), 100],
    ["perfect_season", (v) => writeStats({ perfectSeasons: v }), 1],
    ["tournament_winner", (v) => writeStats({ goldEventsWon: v }), 1],
    ["champion", (v) => setTeam("titles_won", v), 1], ["world_champion", (v) => setTeam("titles_won", v), 2],
    ["dynasty_begins", (v) => setTeam("titles_won", v), 3], ["volleyball_empire", (v) => setTeam("titles_won", v), 10],
    ["olympic_gold", (v) => writeStats({ olympicGolds: v }), 1], ["double_olympic_gold", (v) => writeStats({ olympicGolds: v }), 2],
    ["making_money", (v) => writeStats({ highestBalanceReached: v }), 1_000_000], ["millionaires_club", (v) => writeStats({ highestBalanceReached: v }), 5_000_000],
    ["debt_free", (v) => writeStats({ debtFreeSeasons: v }), 1], ["financially_secure", (v) => writeStats({ debtFreeSeasons: v }), 5],
    ["talent_spotter", (v) => writeStats({ youthSigned: v }), 1], ["youth_pipeline", (v) => writeStats({ youthSigned: v }), 20],
    ["youth_graduate", (v) => writeStats({ youthPromoted: v }), 1], ["youth_factory", (v) => writeStats({ youthPromoted: v }), 10],
    ["future_superstar", (v) => writeStats({ playersDevelopedToFiveStar: v }), 1], ["star_factory", (v) => writeStats({ playersDevelopedToFiveStar: v }), 3],
    ["local_legend", setSeasonsAtClub, 5], ["mr_loyalty", setSeasonsAtClub, 10],
    ["decade_in_sand", (v) => writeStats({ seasonsCompleted: v }), 10], ["veteran_coach", (v) => writeStats({ seasonsCompleted: v }), 20],
    ["hall_of_fame", (v) => writeStats({ seasonsCompleted: v }), 30],
    ["globe_trotter", (v) => writeStats({ continentsVisited: continents.slice(0, v) }), 4], ["world_traveller", (v) => writeStats({ continentsVisited: continents.slice(0, v) }), 6],
    ["first_inductee", (v) => writeStats({ hallOfFameInductions: v }), 1],
  ];
  check("the harness covers every one of the 29 keys", RULES.length === 29 && steamList.every((s) => RULES.some(([k]) => k === s.key)));
  const unlocked = async () => new Set(((await api("GET", "/achievements")).data ?? []).filter((a) => a.unlocked).map((a) => a.key));
  const results = [];
  for (const [key, set, threshold] of RULES) {
    set(threshold - 1);
    await api("POST", "/dev/achievements/check");
    const below = (await unlocked()).has(key);
    set(threshold);
    const r = await api("POST", "/dev/achievements/check");
    const at = (await unlocked()).has(key);
    results.push({ key, threshold, below, at, announced: (r.data?.newlyUnlocked ?? []).includes(key) });
  }
  const bad = results.filter((r) => r.below || !r.at || !r.announced);
  check("each of the 29 is locked one below its threshold and unlocks (and is announced to Steam) at it", bad.length === 0,
    bad.length ? bad.map((r) => `${r.key}: below ${r.below}, at ${r.at}, announced ${r.announced}`).join("; ") : "29 of 29");
  const cab2 = (await api("GET", "/trophies/cabinet")).data?.achievements ?? [];
  check("the cabinet shows them unlocked too (29/29)", cab2.filter((a) => a.unlocked).length === 29);

  // ── B. A real career ───────────────────────────────────────────────────────
  console.log("\nB. A CAREER: STREAK, PRIZE MONEY, FUTURE SUPERSTAR");
  const B = await newCareer(2, "Ach Career");
  const squad = () => sql(`SELECT s.player_id AS id, p.name, s.speed, s.power, s.defense, s.serve, s.block, s.stamina, s.rating_at_join AS joined
      FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.career_save_id = ? AND s.team_id = ?`, B.careerSaveId, B.teamId);
  const ovr = (p) => Math.round((p.speed + p.power + p.defense + p.serve + p.block + p.stamina) / 6);
  const s0 = squad();
  check("a new career records each starting player's rating as she joins", s0.length > 0 && s0.every((p) => p.joined === ovr(p)),
    s0.map((p) => `${p.name} ${ovr(p)}`).join(", "));
  const played = [];
  for (let i = 0; i < 4; i++) {
    const id = (await api("POST", "/calendar/next-match")).data?.matchDay?.matchId;
    healSquadByTeam(dbFile, B.teamId);
    await api("POST", `/matches/${id}/simulate`); await api("POST", "/calendar/dismiss-match");
    played.push(id);
  }
  // Rob's results: W L W L.
  [[2, 0], [0, 2], [2, 1], [1, 2]].forEach(([h, a], i) => sql(`UPDATE matches SET home_score = ?, away_score = ? WHERE id = ?`, h, a, played[i]));
  const rec = (await api("GET", "/trophies/cabinet")).data?.records;
  check("W L W L: Best Winning Streak 1 (the old count, which read every decisive match as a win, gave 4)", rec?.bestWinStreak === 1, `${rec?.bestWinStreak} in a row`);
  const prize = Number(sql(`SELECT COALESCE(SUM(amount), 0) AS t FROM finance_transactions WHERE team_id = ? AND type = 'income' AND category = 'prize_money'`, B.teamId)[0].t);
  const allIncome = Number(sql(`SELECT COALESCE(SUM(amount), 0) AS t FROM finance_transactions WHERE team_id = ? AND type = 'income'`, B.teamId)[0].t);
  check("Most Prize Money Earned = the prize money on the ledger, not all income", Number(rec?.mostPrizeMoney) === prize && allIncome > prize,
    `record $${Number(rec?.mostPrizeMoney).toLocaleString()}, prizes $${prize.toLocaleString()}, all income $${allIncome.toLocaleString()}`);

  // Future Superstar: an 85+ from the start does not count; one developed to 85 does.
  const star = s0.find((p) => ovr(p) >= 85);
  await api("POST", "/dev/achievements/check");
  const ach = async () => new Set(((await api("GET", "/achievements")).data ?? []).filter((a) => a.unlocked).map((a) => a.key));
  check("a starting player already rated 85 or more does not unlock Future Superstar", !(await ach()).has("future_superstar"),
    star ? `${star.name} joined at ${ovr(star)}` : "no 85+ starter in this squad");
  const grower = s0.find((p) => ovr(p) < 85);
  sql(`UPDATE career_player_state SET speed = 88, power = 88, defense = 88, serve = 88, block = 88, stamina = 88 WHERE career_save_id = ? AND player_id = ?`, B.careerSaveId, grower.id);
  const r = await api("POST", "/dev/achievements/check");
  check("a player who joined under 85 and reaches 85 in the squad unlocks it (and Steam is told)", (await ach()).has("future_superstar") && (r.data?.newlyUnlocked ?? []).includes("future_superstar"),
    `${grower.name}: joined at ${ovr(grower)}, now 88`);
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
