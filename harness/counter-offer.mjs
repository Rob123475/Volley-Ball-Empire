/**
 * 1.1.1, Part 3 (Rob, 16 Oct): one chance to keep her (api-server
 * utils/transfers.ts; COUNTER_OFFER in lib/db schema/transfers.ts).
 *
 *   1. an AI club bids for his star: he has 14 game days to answer, and sees
 *      the bidding club and its full offer (wage, length, perks)
 *   2. one bid, one counter: a counter that beats the bid keeps her (her new
 *      contract on its terms); the bid can't be answered twice
 *   3. no answer by the deadline: she goes, and the fee is his that day
 *   4. a close call (the counter worth about the bid): her mood decides, both
 *      ways (high morale stays, low morale goes)
 *   5. AI clubs counter too, by their money and cap: his bid at her asking wage
 *      is matched and her mood decides; a bid well over her worth beats the
 *      counter outright
 */
import { createWorld } from "./night2-world.mjs";
import { makeCapRoom } from "./harness-club.mjs";

const W = createWorld("counter-offer", 4984);
const { check, info } = W;
console.log("=".repeat(72));
console.log("  1.1.1 PART 3: ONE CHANCE TO KEEP HER");
console.log("=".repeat(72));

const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
try {
  await W.boot();
  const { teamId, cid } = await W.newCareer("Counter Offer");
  await W.day();
  makeCapRoom(W.db, teamId, 1000);
  const today = async () => (await W.api("GET", "/calendar")).data?.currentDate ?? "";
  const budget = () => Number(W.q(`SELECT budget b FROM teams WHERE id = ?`, teamId)[0].b);
  const state = (id) => W.q(`SELECT team_id t, pool_team_id p, salary, perks, contract_end_date e, morale FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, id)[0];
  const mine = W.q(`SELECT s.player_id id FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.team_id = ? AND p.player_type = 'senior' ORDER BY s.player_id`, cid, teamId).map((r) => r.id);
  const aiClub = W.q(`SELECT pool_team_id id FROM career_pool_team_state WHERE career_save_id = ? AND taken_over_at IS NULL ORDER BY pool_team_id LIMIT 1`, cid)[0].id;
  // A bid for one of his players, as an AI club's weekly step writes it.
  const plantBid = async (playerId, wage, length = "1s", perks = "") => {
    const d = await today();
    W.w(`INSERT INTO transfer_deals (career_save_id, player_id, from_team_id, to_pool_team_id, fee, wage, length, perks, status, offered_on, answer_by, arrives_on, created_at)
      VALUES (?, ?, ?, ?, 20000, ?, ?, ?, 'offered', ?, ?, '2026-12-07', ?)`, cid, playerId, teamId, aiClub, wage, length, perks, d, addDays(d, 14), Date.now());
    return W.q(`SELECT id FROM transfer_deals WHERE career_save_id = ? AND player_id = ? ORDER BY id DESC LIMIT 1`, cid, playerId)[0].id;
  };

  // ── 1. An AI club bids for his star ───────────────────────────────────────
  console.log("\n1. AN AI CLUB BIDS FOR HIS STAR: 14 DAYS, THE FULL OFFER");
  const star = mine[0];
  W.w(`UPDATE career_player_state SET speed = 99, power = 99, defense = 99, serve = 99, block = 99 WHERE career_save_id = ? AND player_id = ?`, cid, star);
  W.w(`UPDATE contracts SET start_date = '2025-01-01' WHERE player_id = ? AND team_id = ? AND status = 'active'`, star, teamId);
  let bid = null;
  for (let i = 0; i < 21 && !bid; i++) { await W.day(); bid = W.q(`SELECT * FROM transfer_deals WHERE career_save_id = ? AND player_id = ? AND status = 'offered'`, cid, star)[0] ?? null; }
  check("an AI club bids for him, with 14 game days to answer", !!bid && bid.to_pool_team_id != null && bid.answer_by === addDays(bid.offered_on, 14),
    bid ? `offered ${bid.offered_on}, answer by ${bid.answer_by}` : "no bid");
  const offer = (await W.api("GET", "/transfers")).data.offers.find((o) => o.playerId === star);
  check("he sees the bidding club and its full offer: wage, length (an AI club's: 1 or 2 seasons) and perks",
    !!offer && !!offer.to && offer.wage > 0 && ["1s", "2s"].includes(offer.length) && typeof offer.perks === "string" && offer.fee > 0,
    offer ? `${offer.to}: ${offer.wage}/month, ${offer.length}, perks "${offer.perks}", fee ${offer.fee}` : "");

  // ── 2. One counter ─────────────────────────────────────────────────────────
  console.log("\n2. ONE BID, ONE COUNTER");
  const wageBefore = state(star).salary;
  const counter = await W.api("POST", `/transfers/${bid.id}/counter`, { wage: Math.round(bid.wage * 1.3), length: "2s", perks: ["car"] });
  const kept = state(star);
  check("a counter clearly better than the bid keeps her, on its terms from today",
    counter.data?.outcome === "kept" && kept.t === teamId && Math.abs(kept.salary - Math.round(bid.wage * 1.3)) < 1 && kept.perks === "car" && kept.salary !== wageBefore,
    `${counter.data?.outcome ?? counter.data?.error}; wage ${wageBefore} -> ${kept.salary}, perks "${kept.perks}", ends ${kept.e}`);
  const again = await W.api("POST", `/transfers/${bid.id}/counter`, { wage: bid.wage * 2, length: "1s", perks: [] });
  const letGo = await W.api("POST", `/transfers/${bid.id}/let-go`, {});
  check("the bid is done: it can't be countered or answered again", again.status === 409 && letGo.status === 409, `${again.status} / ${letGo.status}`);

  // ── 3. No answer ──────────────────────────────────────────────────────────
  console.log("\n3. NO ANSWER BY THE DEADLINE: SHE GOES");
  const quiet = mine[1];
  const silent = await plantBid(quiet, 30000);
  W.w(`UPDATE transfer_deals SET answer_by = ? WHERE id = ?`, await today(), silent);
  const b0 = budget();
  await W.day();
  const after = W.q(`SELECT status, fee FROM transfer_deals WHERE id = ?`, silent)[0];
  check("the day after the deadline she goes: the deal is agreed and the fee is his",
    after.status === "agreed" && Math.abs(budget() - b0 - after.fee) < 50, `${after.status}; budget +${Math.round(budget() - b0)} (fee ${after.fee})`);

  // ── 4. A close call: her mood decides ─────────────────────────────────────
  console.log("\n4. A CLOSE CALL: HER MOOD DECIDES, BOTH WAYS");
  const third = mine[2];
  W.w(`UPDATE career_player_state SET morale = 95 WHERE career_save_id = ? AND player_id = ?`, cid, third);
  const happy = await plantBid(third, 20000);
  const r1 = await W.api("POST", `/transfers/${happy}/counter`, { wage: 20000, length: "1s", perks: [] });
  const d1 = W.q(`SELECT status, mood_decided m FROM transfer_deals WHERE id = ?`, happy)[0];
  check("the same offer back, high morale (95): she stays", r1.data?.outcome === "kept" && d1.status === "kept" && d1.m === 1, `${r1.data?.outcome ?? r1.data?.error}, mood decided ${d1.m}`);
  W.w(`UPDATE career_player_state SET morale = 5 WHERE career_save_id = ? AND player_id = ?`, cid, third);
  const unhappy = await plantBid(third, 20000);
  const r2 = await W.api("POST", `/transfers/${unhappy}/counter`, { wage: 20000, length: "1s", perks: [] });
  const d2 = W.q(`SELECT status, mood_decided m FROM transfer_deals WHERE id = ?`, unhappy)[0];
  check("the same offer back, low morale (5): she goes", r2.data?.outcome === "agreed" && d2.status === "agreed" && d2.m === 1, `${r2.data?.outcome ?? r2.data?.error}, mood decided ${d2.m}`);

  // ── 5. AI clubs counter ───────────────────────────────────────────────────
  console.log("\n5. AI CLUBS COUNTER, BY THEIR MONEY AND CAP");
  // Players with no deal of any kind yet (an AI club's bids run every week).
  const dealt = new Set(W.q(`SELECT player_id id FROM transfer_deals WHERE career_save_id = ?`, cid).map((r) => r.id));
  const market = (await W.api("GET", "/players/market-all")).data.filter((p) => p.status === "ai_club" && !p.joins && !dealt.has(p.id) && p.contractEndDate >= "2026-12-07")
    .sort((a, b) => a.salary - b.salary);
  // Three players at three different clubs.
  const p1 = market[0];
  const p2 = market.find((p) => p.aiClubId !== p1.aiClubId);
  const p3 = market.find((p) => p.aiClubId !== p1.aiClubId && p.aiClubId !== p2.aiClubId);
  W.w(`UPDATE career_player_state SET morale = 95 WHERE career_save_id = ? AND player_id = ?`, cid, p1.id);
  const at1 = await W.api("POST", "/contracts", { playerId: p1.id, salary: p1.salary, length: "1s", confirm: true, perks: [] });
  const k1 = W.q(`SELECT status, counter_wage cw, mood_decided m FROM transfer_deals WHERE career_save_id = ? AND player_id = ? ORDER BY id DESC`, cid, p1.id)[0];
  check("his bid at her asking wage: her club counters, the offers are close, and (high morale) she stays",
    at1.data?.transfer?.outcome === "kept" && k1.cw != null && k1.m === 1, `${at1.data?.transfer?.outcome ?? at1.data?.error}; counter ${k1?.cw}`);
  W.w(`UPDATE career_player_state SET morale = 5 WHERE career_save_id = ? AND player_id = ?`, cid, p2.id);
  const at2 = await W.api("POST", "/contracts", { playerId: p2.id, salary: p2.salary, length: "1s", confirm: true, perks: [] });
  const k2 = W.q(`SELECT status, counter_wage cw, mood_decided m FROM transfer_deals WHERE career_save_id = ? AND player_id = ? ORDER BY id DESC`, cid, p2.id)[0];
  check("the same, low morale: her club counters, and she goes all the same", at2.data?.transfer?.outcome === "agreed" && k2.cw != null && k2.m === 1,
    `${at2.data?.transfer?.outcome ?? at2.data?.error}; counter ${k2?.cw}`);
  W.w(`UPDATE career_player_state SET morale = 95 WHERE career_save_id = ? AND player_id = ?`, cid, p3.id);
  const at3 = await W.api("POST", "/contracts", { playerId: p3.id, salary: Math.round(p3.salary * 1.5), length: "1s", confirm: true, perks: [] });
  const k3 = W.q(`SELECT status, counter_wage cw, mood_decided m FROM transfer_deals WHERE career_save_id = ? AND player_id = ? ORDER BY id DESC`, cid, p3.id)[0];
  check("a bid 50% over her wage: her club can't match it (it counters at most 10% over her worth, or, short of money or cap room, not at all), and even a happy player goes",
    at3.data?.transfer?.outcome === "agreed" && (k3.cw == null || (k3.cw < Math.round(p3.salary * 1.5) && k3.m === 0)),
    `${at3.data?.transfer?.outcome ?? at3.data?.error}; counter ${k3?.cw} against ${Math.round(p3.salary * 1.5)}`);
  info(`"close" is 5% of the bid's value; her mood moves the counter's worth by up to 10% (COUNTER_OFFER)`);
} catch (err) {
  W.fail(err);
} finally {
  await W.stop();
}
W.finish();
