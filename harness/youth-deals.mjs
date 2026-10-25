/**
 * 1.1.1, Part 5 (Rob, 16 Oct): the AI clubs' youths (api-server
 * utils/youthDeals.ts; YOUTH_DEALS in lib/db schema/transfers.ts).
 *
 *   1. with no Scout or coach to negotiate, a sale is never on: her club offers a loan
 *   2. the scout skill table: 50 / 70 / 90 against a club with few or many youths
 *      (and her place in its youth team, and its need for cash)
 *   3. a buy: she joins his academy, her youth price paid to her club, the deal on record;
 *      a refused sale offers a loan, and the answer holds for the week
 *   4. a loan at any time: a youth-team player, never listed, goes on loan
 *   5. a full academy can't take another
 *   6. AI clubs buy each other's youths
 */
import { createWorld } from "./night2-world.mjs";

const W = createWorld("youth-deals", 4986);
const { check, info } = W;
console.log("=".repeat(72));
console.log("  1.1.1 PART 5: YOUTH DEALS AND SCOUTS");
console.log("=".repeat(72));

// YOUTH_DEALS: scout share 0 at 40 rising to 0.8 at 90; few (no spare youth) x0.25, one spare x0.5, many (2+ spare) x1.
const TABLE = { 50: { few: 0.04, many: 0.16 }, 70: { few: 0.12, many: 0.48 }, 90: { few: 0.2, many: 0.8 } };
try {
  await W.boot();
  const { teamId, cid } = await W.newCareer("Youth Deals");
  await W.day();
  const youthsAt = (pool) => W.q(`SELECT s.player_id id, s.academy_role role FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.pool_team_id = ? AND p.player_type = 'youth' AND s.is_promoted = 0 ORDER BY s.player_id`, cid, pool);
  const budget = () => Number(W.q(`SELECT budget b FROM teams WHERE id = ?`, teamId)[0].b);
  const balance = (pool) => Number(W.q(`SELECT balance b FROM career_pool_team_state WHERE career_save_id = ? AND pool_team_id = ?`, cid, pool)[0].b);
  // The AI academies are filled when the Day 1 draft closes (1.1.3, 25 Oct; before, in the first salary week).
  for (let i = 0; i < 8 && W.q(`SELECT COUNT(*) n FROM career_player_state WHERE career_save_id = ? AND pool_team_id IS NOT NULL AND academy_role IS NOT NULL`, cid)[0].n === 0; i++) await W.day();
  const clubs = W.q(`SELECT pool_team_id id FROM career_pool_team_state WHERE career_save_id = ? AND taken_over_at IS NULL ORDER BY pool_team_id`, cid).map((r) => r.id)
    .filter((id) => youthsAt(id).length >= 4
      && W.q(`SELECT id FROM youth_loans WHERE career_save_id = ? AND status = 'active' AND (owner_pool_team_id = ? OR borrower_pool_team_id = ?)`, cid, id, id).length === 0);
  for (const c of clubs) W.w(`UPDATE career_pool_team_state SET balance = 1000000 WHERE career_save_id = ? AND pool_team_id = ?`, cid, c);
  // His academy with room for what follows.
  const mine = W.q(`SELECT s.player_id id FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.team_id = ? AND p.player_type = 'youth' AND s.is_promoted = 0`, cid, teamId).map((r) => r.id);
  for (const id of mine.slice(2)) W.w(`UPDATE career_player_state SET team_id = NULL, academy_role = NULL WHERE career_save_id = ? AND player_id = ?`, cid, id);
  // His staff out of the way: the negotiator is set by hand below.
  W.w(`UPDATE career_staff_state SET team_id = NULL WHERE career_save_id = ? AND team_id = ?`, cid, teamId);

  // ── 1. No one to negotiate ────────────────────────────────────────────────
  console.log("\n1. NO SCOUT, NO COACH: ONLY A LOAN IS OFFERED");
  const A = clubs[0], B = clubs[1], C = clubs[2];
  const reserveOf = (pool) => youthsAt(pool).find((y) => y.role === "reserve")?.id ?? youthsAt(pool)[0].id;
  const none = await W.api("GET", `/youth-deals/${reserveOf(A)}`);
  const noBuy = await W.api("POST", "/youth-deals", { playerId: reserveOf(A), kind: "buy", confirm: true });
  check("with no Scout or coach his chance of a sale is 0, and asking to buy is answered with a loan", none.data?.chance === 0 && noBuy.data?.outcome === "loan_only",
    `chance ${none.data?.chance}; ${noBuy.data?.outcome ?? noBuy.data?.error}`);

  // ── 2. The table ──────────────────────────────────────────────────────────
  console.log("\n2. THE SCOUT SKILL TABLE: 50 / 70 / 90, FEW OR MANY YOUTHS");
  const scout = await W.hire("Scout", 80, cid);
  // Few: club A with 3 of its own (a youth leaves). Many: club B with 5 (one of C's joins it).
  const leave = youthsAt(A).find((y) => y.role === "reserve") ?? youthsAt(A)[0];
  W.w(`UPDATE career_player_state SET pool_team_id = NULL, academy_role = NULL WHERE career_save_id = ? AND player_id = ?`, cid, leave.id);
  while (youthsAt(A).length > 3) W.w(`UPDATE career_player_state SET pool_team_id = NULL, academy_role = NULL WHERE career_save_id = ? AND player_id = ?`, cid, youthsAt(A).at(-1).id);
  while (youthsAt(B).length < 5) W.w(`UPDATE career_player_state SET pool_team_id = ?, academy_role = 'reserve' WHERE career_save_id = ? AND player_id = ?`, B, cid, youthsAt(C).at(-1).id);
  // The youth asked for is a reserve at each (no plans for her).
  const fewYouth = youthsAt(A)[0].id, manyYouth = youthsAt(B).at(-1).id;
  W.w(`UPDATE career_player_state SET academy_role = 'reserve' WHERE career_save_id = ? AND player_id IN (?, ?)`, cid, fewYouth, manyYouth);
  const rows = [];
  let tableOk = true;
  for (const skill of [50, 70, 90]) {
    W.w(`UPDATE staff SET scouting_rating = ? WHERE id = ?`, skill, scout.id);
    const few = (await W.api("GET", `/youth-deals/${fewYouth}`)).data?.chance;
    const many = (await W.api("GET", `/youth-deals/${manyYouth}`)).data?.chance;
    rows.push(`scout ${skill}: few ${Math.round(few * 100)}%, many ${Math.round(many * 100)}%`);
    if (Math.abs(few - TABLE[skill].few) > 0.001 || Math.abs(many - TABLE[skill].many) > 0.001) tableOk = false;
  }
  check("the sale chance by his scout's skill and the club's youths, as the constants' table", tableOk, rows.join("; "));
  for (const r of rows) info(r);
  W.w(`UPDATE staff SET scouting_rating = 30 WHERE id = ?`, scout.id);
  check("a scout below the floor (30): no sale at all, only a loan", (await W.api("GET", `/youth-deals/${manyYouth}`)).data?.chance === 0);
  W.w(`UPDATE staff SET scouting_rating = 70 WHERE id = ?`, scout.id);
  W.w(`UPDATE career_player_state SET academy_role = 'youth_team' WHERE career_save_id = ? AND player_id = ?`, cid, manyYouth);
  const plans = (await W.api("GET", `/youth-deals/${manyYouth}`)).data?.chance;
  W.w(`UPDATE career_player_state SET academy_role = 'reserve' WHERE career_save_id = ? AND player_id = ?`, cid, manyYouth);
  W.w(`UPDATE career_pool_team_state SET balance = 1000 WHERE career_save_id = ? AND pool_team_id = ?`, cid, B);
  const cash = (await W.api("GET", `/youth-deals/${manyYouth}`)).data?.chance;
  W.w(`UPDATE career_pool_team_state SET balance = 1000000 WHERE career_save_id = ? AND pool_team_id = ?`, cid, B);
  check("her club's plans for her (its youth team) halve it; its need for cash raises it by half", Math.abs(plans - 0.24) < 0.001 && Math.abs(cash - 0.72) < 0.001,
    `scout 70, many youths: youth team ${plans}, short of cash ${cash}`);

  // ── 3. A buy ──────────────────────────────────────────────────────────────
  console.log("\n3. A BUY: HIS ACADEMY, HER PRICE TO HER CLUB; A REFUSAL OFFERS A LOAN");
  W.w(`UPDATE staff SET scouting_rating = 95 WHERE id = ?`, scout.id);
  let sold = null, refused = null;
  // Each ask is a negotiation on his Scout's list, two at a time (utils/scoutingWork.ts; its own suites test that):
  // his list is cleared before each ask here, and her club's reserves (no plans for them) are asked for first.
  // (1.1.3, 25 Oct: the AI academies fill on Day 1 now, so this starts a week sooner, with other youths in other roles.)
  const freeScout = () => W.w(`DELETE FROM scouting_jobs WHERE career_save_id = ? AND staff_id = ?`, cid, scout.id);
  for (const y of [...youthsAt(B)].sort((a, b) => (a.role === "reserve" ? 0 : 1) - (b.role === "reserve" ? 0 : 1))) {
    freeScout();
    const ask = (await W.api("GET", `/youth-deals/${y.id}`)).data;
    const b0 = budget(), s0 = balance(B);
    const r = await W.api("POST", "/youth-deals", { playerId: y.id, kind: "buy", confirm: true });
    if (r.data?.outcome === "bought" && !sold) sold = { id: y.id, r: r.data, ask, b0, s0 };
    else if (r.data?.outcome === "loan_only" && !refused) refused = { id: y.id };
    if (sold) break;
  }
  if (sold) {
    const st = W.q(`SELECT team_id t, pool_team_id p, academy_role a FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, sold.id)[0];
    const deal = W.q(`SELECT * FROM transfer_deals WHERE id = ?`, sold.r.dealId)[0];
    const contract = W.q(`SELECT id FROM contracts WHERE player_id = ? AND team_id = ? AND status = 'active'`, sold.id, teamId)[0];
    check("her club sells: she is in his academy, on an academy contract", st.t === teamId && st.p == null && ["youth_team", "reserve"].includes(st.a) && !!contract, JSON.stringify(st));
    check("her youth price is paid: his budget down by it, her club's balance up by it", Math.abs(sold.b0 - budget() - sold.ask.price) < 1 && Math.abs(balance(B) - sold.s0 - sold.ask.price) < 1
      && sold.ask.price >= 500 && sold.ask.price <= 2000, `price $${sold.ask.price}`);
    check("the deal is on record: from her club to his, an academy move", deal?.status === "moved" && deal.squad_role === "academy" && deal.from_pool_team_id === B && deal.to_team_id === teamId);
  } else check("her club sells one of its youths to a scout of 95 (80% each)", false, "no sale in the club's youths");
  W.w(`UPDATE staff SET scouting_rating = 45 WHERE id = ?`, scout.id);
  freeScout();
  const low = youthsAt(A)[0].id;
  const first = await W.api("POST", "/youth-deals", { playerId: low, kind: "buy", confirm: true });
  const second = await W.api("POST", "/youth-deals", { playerId: low, kind: "buy", confirm: true });
  check("a weak scout (45) against a club with few youths: refused, a loan offered, and asking again this week gets the same answer",
    first.data?.outcome === "loan_only" && second.data?.outcome === "loan_only" && first.data.loanMonths?.length > 0, `${first.data?.outcome} / ${second.data?.outcome}; chance ${first.data?.chance}`);

  // ── 4. A loan at any time ─────────────────────────────────────────────────
  console.log("\n4. A LOAN AT ANY TIME");
  const yt = youthsAt(C).find((y) => y.role === "youth_team");
  const listed = W.q(`SELECT id FROM youth_loans WHERE career_save_id = ? AND player_id = ? AND status = 'listed'`, cid, yt.id).length;
  const loan = await W.api("POST", "/youth-deals", { playerId: yt.id, kind: "loan", months: 6, confirm: true });
  const ls = W.q(`SELECT status, owner_pool_team_id o, borrower_team_id b, months FROM youth_loans WHERE id = ?`, loan.data?.loanId ?? -1)[0];
  const where = W.q(`SELECT team_id t FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, yt.id)[0];
  check("a youth-team player never listed: her club lends her for 6 months; she plays for him, still its own", listed === 0 && loan.data?.outcome === "loaned"
    && ls?.status === "active" && ls.o === C && ls.b === teamId && ls.months === 6 && where.t === teamId, `${loan.data?.outcome ?? loan.data?.error}`);
  const twice = await W.api("POST", "/youth-deals", { playerId: yt.id, kind: "buy", confirm: true });
  check("a youth out on loan can't be asked for until she is back", twice.status === 400 && /on loan/.test(twice.data?.error ?? ""), twice.data?.error);

  // ── 5. A full academy ─────────────────────────────────────────────────────
  console.log("\n5. A FULL ACADEMY");
  const free = W.q(`SELECT s.player_id id FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.team_id IS NULL AND s.pool_team_id IS NULL AND p.player_type = 'youth' AND s.is_promoted = 0 AND s.is_retired = 0 LIMIT 6`, cid).map((r) => r.id);
  let n = Number((await W.api("GET", "/team/roster")).data?.academy?.size ?? 0);
  for (const id of free) { if (n >= 6) break; W.w(`UPDATE career_player_state SET team_id = ?, academy_role = 'reserve' WHERE career_save_id = ? AND player_id = ?`, teamId, cid, id); n++; }
  const full = await W.api("POST", "/youth-deals", { playerId: youthsAt(A)[0].id, kind: "loan", months: 6, confirm: true });
  check("his academy full (6): no loan or buy", full.status === 400 && /full/i.test(full.data?.error ?? ""), full.data?.error);

  // ── 6. AI clubs buy from each other ───────────────────────────────────────
  console.log("\n6. AI CLUBS BUY EACH OTHER'S YOUTHS");
  const aiSale = () => W.q(`SELECT * FROM transfer_deals WHERE career_save_id = ? AND squad_role = 'academy' AND from_pool_team_id IS NOT NULL AND to_pool_team_id IS NOT NULL LIMIT 1`, cid)[0];
  // An AI club with a Scout (scouting 90) and room in its academy: it asks first each week.
  const buyer = clubs.find((c) => c !== A && c !== B && c !== C && youthsAt(c).length <= 4);
  const aiScout = W.q(`SELECT s.staff_id id FROM career_staff_state s JOIN staff st ON st.id = s.staff_id
    WHERE s.career_save_id = ? AND s.team_id IS NULL AND s.pool_team_id IS NULL AND st.role = 'Scout' LIMIT 1`, cid)[0].id;
  W.w(`UPDATE career_staff_state SET pool_team_id = ?, is_available = 0 WHERE career_save_id = ? AND staff_id = ?`, buyer, cid, aiScout);
  W.w(`UPDATE staff SET scouting_rating = 90 WHERE id = ?`, aiScout);
  for (let i = 0; i < 70 && !aiSale(); i++) await W.day();
  const s = aiSale();
  if (s) {
    // Hers now: at the buyer, or out on loan from it (its reserves are listed every week), unless sold on since.
    const at = W.q(`SELECT pool_team_id p, team_id t FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, s.player_id)[0];
    const lent = W.q(`SELECT owner_pool_team_id o FROM youth_loans WHERE career_save_id = ? AND player_id = ? AND status = 'active'`, cid, s.player_id)[0];
    const later = W.q(`SELECT id FROM transfer_deals WHERE career_save_id = ? AND player_id = ? AND id > ?`, cid, s.player_id, s.id).length;
    check("an AI club bought another's youth: she is the buyer's (in its academy, or lent out by it), her price paid",
      s.status === "moved" && s.fee >= 500 && (at?.p === s.to_pool_team_id || lent?.o === s.to_pool_team_id || later > 0 || at == null),
      `deal ${s.id}: ${s.from_pool_team_id} -> ${s.to_pool_team_id}, $${s.fee}, on ${s.moved_on}; now ${JSON.stringify(at)}, loan owner ${lent?.o ?? "-"}`);
  } else check("an AI club with a Scout bought another's youth within 10 weeks", false);
} catch (err) {
  W.fail(err);
} finally {
  await W.stop();
}
W.finish();
