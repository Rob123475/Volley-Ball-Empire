/**
 * Overnight brief 30 Sep, item 12 — the youth market by the senior rules.
 *
 * Rob, 30 Sep: unscouted youth show a price range, "?" rating and hidden
 * stats; prices $500-$2,000 by talent; scouting (5 days) reveals stats, the
 * exact price and a development potential rating, and potential must really
 * drive growth; a confirm step before signing.
 *
 * Asserted on a starter-DB copy:
 *   - every unscouted youth on the market: a price range inside $500-$2,000,
 *     no exact price, no stats, no potential of any kind sent (her true
 *     potential was never shown, but the senior market sent it: neither does now);
 *   - prices follow talent: the higher her true potential, the higher her range;
 *   - scouting her (a hired Scout, $500 since overnight 1 Oct N-34): nothing on day 4; on day 5 her
 *     stats, her exact price inside the range and the scout's reading of her
 *     development potential;
 *   - signing: refused without the confirm step (which names the price); with
 *     it, the exact price is charged and on the ledger;
 *   - potential drives growth: two academy youths given the same stats, XP and
 *     focus, one Low and one Generational potential, after the same matches
 *     have gained XP and focus points in the ratio of their potentials
 *     (0.8 : 1.3), not the same.
 *
 * Usage: node harness/youth-market.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healAllSquads } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const PORT = 4934;
const BASE = `http://localhost:${PORT}/api`;
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-youth-market-"));
let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  OVERNIGHT 30 SEP, 12: THE YOUTH MARKET BY THE SENIOR RULES");
console.log("=".repeat(72));
if (!fs.existsSync(SERVER)) { console.error(`[youth-market] FAILED: ${SERVER} not built.`); process.exit(1); }

const dbFile = path.join(WORK, "youth.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const q = (sql, ...a) => { const d = new DatabaseSync(dbFile, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
const w = (sql, ...a) => { const d = new DatabaseSync(dbFile); try { d.prepare(sql).run(...a); } finally { d.close(); } };
let cookie = "";
async function api(method, p, body) {
  const res = await fetch(BASE + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await res.text(); let data = null; try { data = t ? JSON.parse(t) : null; } catch { data = t; }
  return { status: res.status, data };
}
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({ server: SERVER, electron: requireElectronBinary(REPO), out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "youth-market" } });

try {
  for (let i = 0; i < 240; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }
  const prof = await api("POST", "/profiles", { name: "Youth Market" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", { slotNumber: 1, managerName: "Youth Market", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  const teamId = (await api("GET", "/team")).data?.id;
  const careerSaveId = ((await api("GET", "/careers")).data?.saves ?? [])[0]?.id;
  const budget = async () => Number((await api("GET", "/team")).data?.budget);
  let gameDay = null;
  const readDay = async () => { gameDay = (await api("GET", "/calendar")).data?.currentDate ?? null; return gameDay; };
  const today = () => gameDay;
  const truePot = (id) => q(`SELECT potential FROM players WHERE id = ?`, id)[0]?.potential;

  // 1. The unscouted youth market.
  const pool = (await api("GET", "/players/youth-pool")).data ?? [];
  const unscouted = pool.filter((p) => !p.revealed);
  const bad = unscouted.filter((p) => !(p.priceRange && p.priceRange.low >= 500 && p.priceRange.high <= 2000 && p.priceRange.low < p.priceRange.high && p.price == null
    && p.power == null && p.speed == null && p.defense == null && p.serve == null && p.block == null && p.stamina == null && p.scoutedPotential == null && !("potential" in p)));
  check("every unscouted youth: a price range inside $500-$2,000, no exact price, no stats, no potential sent",
    unscouted.length >= 10 && bad.length === 0, `${unscouted.length} unscouted; e.g. ${unscouted[0]?.name} $${unscouted[0]?.priceRange?.low}-$${unscouted[0]?.priceRange?.high}; wrong: ${bad.slice(0, 3).map((p) => p.name).join(", ") || "none"}`);
  const tiers = ["Low", "Average", "High", "Elite", "Generational"];
  const mids = {};
  for (const p of unscouted) { const t = truePot(p.id); (mids[t] ??= []).push((p.priceRange.low + p.priceRange.high) / 2); }
  const avg = tiers.filter((t) => mids[t]).map((t) => [t, mids[t].reduce((a, b) => a + b, 0) / mids[t].length]);
  check("prices follow talent: the higher her true potential, the higher her range",
    avg.length >= 2 && avg.every(([, m], i) => i === 0 || m > avg[i - 1][1]), avg.map(([t, m]) => `${t} ~$${Math.round(m)}`).join(", "));
  const senior = ((await api("GET", "/players/market-all")).data ?? []).slice(0, 50);
  check("the senior market does not send a player's true potential either", senior.length > 0 && senior.every((p) => !("potential" in p)));

  // 2. Scouting her: a hired Scout, 5 game days.
  if (!((await api("GET", "/staff")).data ?? []).some((s) => /^scout$/i.test(s.role))) {
    const offer = ((await api("GET", "/staff/market?role=scout")).data ?? []).find((m) => /scout/i.test(m.role));
    await api("POST", "/staff", { staffId: offer?.id, length: "6m" });
  }
  const Y = unscouted[0];
  const b0 = await budget();
  const sc = await api("POST", `/players/${Y.id}/scout`);
  const sentOn = await readDay();
  // Overnight 1 Oct, N-34: a youth's scout costs $500 (a senior's, staff's and medical's stay $1,500).
  const scoutCharged = b0 - (await budget());
  check("scouting a youth: 5 game days, $500, on the ledger", sc.status === 200 && sc.data?.scouting?.daysLeft === 5 && scoutCharged === 500 && sc.data?.cost === 500,
    `HTTP ${sc.status} ${sc.data?.error ?? ""}; -$${scoutCharged}`);
  const dayAfter = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const advanceTo = async (date) => {
    for (let i = 0; i < 40 && (await readDay()) < date; i++) {
      healAllSquads(dbFile);
      const r = await api("POST", "/calendar/advance", {});
      if (r.data?.blocked === "pending_match") { await api("POST", `/matches/${r.data.pendingMatchId}/simulate`); await api("POST", "/calendar/dismiss-match"); continue; }
      if (r.data?.matchDay?.matchId) { await api("POST", `/matches/${r.data.matchDay.matchId}/simulate`); await api("POST", "/calendar/dismiss-match"); }
    }
    await readDay();
  };
  const byId = async (id) => ((await api("GET", "/players/youth-pool")).data ?? []).find((p) => p.id === id);
  await advanceTo(dayAfter(sentOn, 4));
  const y4 = await byId(Y.id);
  check("day 4: still hidden", y4 && !y4.revealed && y4.power == null && y4.price == null && y4.scouting?.daysLeft === 1, JSON.stringify(y4?.scouting));
  await advanceTo(dayAfter(sentOn, 5));
  const y5 = await byId(Y.id);
  check("day 5: her stats, her exact price inside the range, and the scout's reading of her development potential",
    y5?.revealed === true && y5.power > 0 && y5.price >= y5.priceRange.low && y5.price <= y5.priceRange.high && tiers.includes(y5.scoutedPotential) && !("potential" in y5),
    `${y5?.name}: power ${y5?.power}, price $${y5?.price} in $${y5?.priceRange?.low}-$${y5?.priceRange?.high}, potential ${y5?.scoutedPotential} (true ${truePot(Y.id)})`);

  // 3. Signing: a confirm step, then her price.
  const terms = { playerId: Y.id, salary: 800, bonusPerWin: 0, squadRole: "youth", length: "1s" };
  const noConfirm = await api("POST", "/contracts", terms);
  check("signing her is refused without the confirm step, which names her price",
    noConfirm.status === 400 && noConfirm.data?.needsConfirm === true && noConfirm.data?.price === y5.price, `${noConfirm.status}: ${noConfirm.data?.error}`);
  const bSign = await budget();
  const signed = await api("POST", "/contracts", { ...terms, confirm: true });
  const fee = ((await api("GET", "/finances")).data ?? []).filter((t) => t.category === "signing_fee" && t.description.startsWith(`Signing fee: ${Y.name}`));
  check("confirmed: her exact price is charged and on the ledger",
    signed.status === 201 && signed.data?.fee === y5.price && bSign - (await budget()) === y5.price && fee.length === 1,
    `HTTP ${signed.status} ${signed.data?.error ?? ""}; fee $${signed.data?.fee}; ledger ${fee.map((t) => `$${t.amount}`).join(", ")}`);

  // 4. Potential drives growth: two youths alike in every way but potential.
  const second = unscouted.find((p) => p.id !== Y.id);
  await api("POST", "/contracts", { playerId: second.id, salary: 800, bonusPerWin: 0, squadRole: "youth", length: "1s", confirm: true });
  const academy = q(`SELECT s.player_id AS id FROM career_player_state s JOIN players p ON p.id = s.player_id
                      WHERE s.career_save_id = ? AND s.team_id = ? AND p.player_type = 'youth' AND COALESCE(s.is_promoted, 0) = 0 ORDER BY s.player_id LIMIT 2`, careerSaveId, teamId).map((r) => r.id);
  if (academy.length < 2) check("two academy youths to compare", false, `found ${academy.length}`);
  else {
    const [lo, hi] = academy;
    for (const [id, pot] of [[lo, "Low"], [hi, "Generational"]]) {
      w(`UPDATE players SET potential = ? WHERE id = ?`, pot, id);
      w(`UPDATE career_player_state SET power = 60, speed = 60, defense = 60, serve = 60, block = 60, stamina = 60, training_points = 0, focus_xp = 0, training_focus = 'Attack'
          WHERE career_save_id = ? AND player_id = ?`, careerSaveId, id);
    }
    for (let i = 0; i < 6; i++) {
      healAllSquads(dbFile);
      const md = (await api("POST", "/calendar/next-match")).data?.matchDay;
      if (md?.matchId) { await api("POST", `/matches/${md.matchId}/simulate`); await api("POST", "/calendar/dismiss-match"); }
    }
    const [a, b] = [lo, hi].map((id) => q(`SELECT training_points AS xp, focus_xp AS fx FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, careerSaveId, id)[0]);
    const ratio = a.xp > 0 ? b.xp / a.xp : 0;
    check("potential drives growth: same stats, same matches, Generational gains ~1.3/0.8 of Low's XP and focus",
      a.xp > 0 && b.xp > a.xp && Math.abs(ratio - 1.3 / 0.8) < 0.12 && b.fx > a.fx,
      `Low: ${a.xp} XP, ${a.fx} focus; Generational: ${b.xp} XP, ${b.fx} focus (ratio ${ratio.toFixed(2)}, expected ${(1.3 / 0.8).toFixed(2)})`);
  }
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
