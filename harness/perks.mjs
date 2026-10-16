/**
 * 1.1.1, Part 4 (Rob, 16 Oct): perks (lib/db schema/transfers.ts PERKS).
 *
 *   1. the ten perks and their monthly costs (all ten = $10,000 a month)
 *   2. a signing with perks: on her contract, and counted toward the cap with
 *      her wage; one whose perks would break the cap is refused
 *   3. paid every week with the wages, on their own ledger line, and shown in
 *      Finances as "Player perks"
 *   4. a bought-ahead player's perks start the day she arrives
 *   5. a renewal can carry perks; existing contracts have none
 */
import fs from "node:fs";
import path from "node:path";
import { createWorld, REPO } from "./night2-world.mjs";
import { makeCapRoom } from "./harness-club.mjs";

const W = createWorld("perks", 4985);
const { check } = W;
const FE = (p) => fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", p), "utf8");
console.log("=".repeat(72));
console.log("  1.1.1 PART 4: PERKS");
console.log("=".repeat(72));

const COST = { phone: 220, gym: 270, car: 450, clothing: 540, salon: 670, flights: 900, media_agent: 900, chef: 1120, trainer: 1350, beach_house: 3580 };
try {
  await W.boot();
  const { teamId, cid } = await W.newCareer("Perks");
  await W.day();
  const state = (id) => W.q(`SELECT team_id t, pool_team_id p, salary, perks FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, id)[0];
  const cap = async () => (await W.api("GET", "/contracts/wage-cap")).data.seniorWages;

  // ── 1. The perks ──────────────────────────────────────────────────────────
  console.log("\n1. THE TEN PERKS");
  const src = fs.readFileSync(path.join(REPO, "lib", "db", "src", "schema", "transfers.ts"), "utf8");
  const declared = Object.fromEntries([...src.matchAll(/key: "([a-z_]+)",\s+label: "[^"]+",\s+monthly: (\d+)/g)].map((m) => [m[1], Number(m[2])]));
  check("ten perks at Rob's monthly costs, $10,000 a month for all ten", JSON.stringify(declared) === JSON.stringify(COST)
    && Object.values(declared).reduce((t, n) => t + n, 0) === 10000, JSON.stringify(declared));
  const drafted = W.q(`SELECT perks FROM career_player_state WHERE career_save_id = ? AND team_id = ?`, cid, teamId);
  check("contracts made before (the Day 1 draft's) have no perks", drafted.length > 0 && drafted.every((r) => r.perks === ""));

  // ── 2. A signing with perks ───────────────────────────────────────────────
  console.log("\n2. A SIGNING WITH PERKS: ON HER CONTRACT, IN THE CAP");
  makeCapRoom(W.db, teamId, 1000);
  // Room for a fourth senior: one of the drafted three goes (the Day 1 draft is closed, so in the window only... release a youth-free spot by the database).
  const drop = W.q(`SELECT player_id id FROM career_player_state WHERE career_save_id = ? AND team_id = ? AND squad_role = 'interchange'`, cid, teamId)[0]
    ?? W.q(`SELECT player_id id FROM career_player_state WHERE career_save_id = ? AND team_id = ? ORDER BY player_id DESC LIMIT 1`, cid, teamId)[0];
  W.w(`UPDATE career_player_state SET team_id = NULL, contract_end_date = NULL, is_active = 0 WHERE career_save_id = ? AND player_id = ?`, cid, drop.id);
  W.w(`UPDATE contracts SET status = 'terminated' WHERE player_id = ? AND team_id = ?`, drop.id, teamId);
  const free = (await W.api("GET", "/players/market-all")).data.filter((p) => (p.status === "free_agent" || p.status === "player_pool") && !p.isInjured)
    .sort((a, b) => a.salary - b.salary);
  const fa = free[0];
  const before = await cap();
  const signed = await W.api("POST", "/contracts", { playerId: fa.id, salary: fa.salary, length: "1s", squadRole: "interchange", confirm: true, perks: ["car", "chef"] });
  const after = await cap();
  check("signed with a new car and a private chef: on her contract", signed.status === 201 && state(fa.id).perks === "car,chef", `HTTP ${signed.status} ${signed.data?.error ?? ""}; perks "${state(fa.id).perks}"`);
  check("and counted toward the cap with her wage ($1,570 a month)", Math.abs(after - before - (fa.salary + 1570)) < 1, `${before} -> ${after} (wage ${fa.salary})`);
  // A signing whose wage fits but whose perks would break the cap is refused: his bill set $5,000 under it with her wage.
  const next = free.find((p) => p.id !== fa.id);
  // A place for her (three seniors is a full squad): one of the drafted pair leaves, by the database.
  const out = W.q(`SELECT player_id id FROM career_player_state WHERE career_save_id = ? AND team_id = ? AND player_id <> ? ORDER BY player_id LIMIT 1`, cid, teamId, fa.id)[0];
  W.w(`UPDATE career_player_state SET team_id = NULL, contract_end_date = NULL, is_active = 0 WHERE career_save_id = ? AND player_id = ?`, cid, out.id);
  W.w(`UPDATE contracts SET status = 'terminated' WHERE player_id = ? AND team_id = ?`, out.id, teamId);
  const room0 = 60000 - (await cap());
  W.w(`UPDATE career_player_state SET salary = salary + ? WHERE career_save_id = ? AND player_id = ?`, room0 - next.salary - 5000, cid, fa.id);
  const heavy = await W.api("POST", "/contracts", { playerId: next.id, salary: next.salary, length: "1s", squadRole: "starter", confirm: true,
    perks: ["phone", "gym", "car", "clothing", "salon", "flights", "media_agent", "chef", "trainer", "beach_house"] });
  check("a signing whose wage fits but whose perks ($10,000) break the cap is refused", heavy.status === 422 && heavy.data?.wageCap === true,
    `${await cap()} + ${next.salary} + $10,000 perks: HTTP ${heavy.status} ${heavy.data?.error ?? ""}`);
  makeCapRoom(W.db, teamId, 1000);

  // ── 3. Paid every week ────────────────────────────────────────────────────
  console.log("\n3. PAID EVERY WEEK, ON THEIR OWN LINE; FINANCES \"PLAYER PERKS\"");
  let line = null;
  for (let i = 0; i < 9 && !line; i++) { await W.day(); line = W.q(`SELECT amount, description FROM finance_transactions WHERE team_id = ? AND category = 'player_perks' ORDER BY id DESC LIMIT 1`, teamId)[0] ?? null; }
  check("the salary week pays her perks: $1,570 a month, weekly", !!line && Math.abs(line.amount - Math.round(1570 / (52 / 12))) <= 1, line ? `${line.amount}: ${line.description}` : "no line");
  const summary = (await W.api("GET", "/finances/summary")).data;
  check("Finances shows them as their own line, \"Player perks\"", summary?.expenseBreakdown?.playerPerks >= line?.amount
    && /label="Player perks"/.test(FE("pages/finances.tsx")) && /player_perks:\s+"Player perks"/.test(FE("lib/ledger-categories.ts")),
    `playerPerks ${summary?.expenseBreakdown?.playerPerks}`);

  // ── 4. From the day she arrives ───────────────────────────────────────────
  console.log("\n4. A BOUGHT-AHEAD PLAYER'S PERKS START THE DAY SHE ARRIVES");
  makeCapRoom(W.db, teamId, 1000);
  const dealt = new Set(W.q(`SELECT player_id id FROM transfer_deals WHERE career_save_id = ?`, cid).map((r) => r.id));
  const room = 60000 - (await cap());
  const target = (await W.api("GET", "/players/market-all")).data.filter((p) => p.status === "ai_club" && !dealt.has(p.id) && p.contractEndDate >= "2026-12-07"
    && Math.round(p.salary * 1.5) + 3580 <= room).sort((a, b) => b.salary - a.salary)[0];
  const bid = await W.api("POST", "/contracts", { playerId: target.id, salary: Math.round(target.salary * 1.5), length: "1s", confirm: true, perks: ["beach_house"] });
  const deal = W.q(`SELECT id, status, perks FROM transfer_deals WHERE career_save_id = ? AND player_id = ? ORDER BY id DESC`, cid, target.id)[0];
  check("bought ahead with a beach house: agreed, and until she arrives her club pays her, with no perk", bid.data?.transfer?.outcome === "agreed"
    && deal.perks === "beach_house" && state(target.id).perks === "" && state(target.id).t == null, `${bid.data?.transfer?.outcome ?? bid.data?.error}; ${JSON.stringify(state(target.id))}`);
  const d = (await W.api("GET", "/calendar")).data.currentDate;
  const tomorrow = new Date(`${d}T00:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  W.w(`UPDATE transfer_deals SET arrives_on = ? WHERE id = ?`, tomorrow.toISOString().slice(0, 10), deal.id);
  const capBefore = await cap();
  await W.day();
  check("the day she arrives her perks are on her contract and in his cap", state(target.id).t === teamId && state(target.id).perks === "beach_house"
    && Math.abs((await cap()) - capBefore - (Math.round(target.salary * 1.5) + 3580)) < 1, `${JSON.stringify(state(target.id))}; cap ${capBefore} -> ${await cap()}`);

  // ── 5. Renewals ───────────────────────────────────────────────────────────
  console.log("\n5. A RENEWAL CAN CARRY PERKS");
  makeCapRoom(W.db, teamId, 1000);
  const c = W.q(`SELECT c.id, c.player_id p FROM contracts c WHERE c.team_id = ? AND c.status = 'active' AND c.player_id <> ? ORDER BY c.id LIMIT 1`, teamId, target.id)[0];
  W.w(`UPDATE contracts SET end_date = '2026-12-31' WHERE id = ?`, c.id);
  W.w(`UPDATE career_player_state SET contract_end_date = '2026-12-31' WHERE career_save_id = ? AND player_id = ?`, cid, c.p);
  const renewed = await W.api("POST", `/contracts/${c.id}/renew`, { length: "1s", perks: ["gym", "phone"] });
  check("renewed with a phone and a gym membership: on her contract", renewed.status === 200 && state(c.p).perks === "phone,gym", `HTTP ${renewed.status} ${renewed.data?.error ?? ""}; "${state(c.p).perks}"`);
} catch (err) {
  W.fail(err);
} finally {
  await W.stop();
}
W.finish();
