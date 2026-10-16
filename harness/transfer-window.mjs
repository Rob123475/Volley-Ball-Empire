/**
 * 1.1.1, Part 2 (Rob, 16 Oct): the transfer window (api-server utils/transfers.ts,
 * utils/transferWindow.ts).
 *
 *   1. the window is the calendar's Off-Season (7 to 31 Dec 2026), on the calendar
 *   2. buy ahead: a bid in January for an AI club's senior is agreed; the fee is
 *      paid that day (both clubs' books) and she is locked to join on 7 Dec; she
 *      stays at her club on her old wage until then; the market says "Joins ..."
 *   3. the cap is checked against the buyer's bill on her arrival date: a
 *      contract ending before then doesn't count, a player bought ahead does
 *   4. no dumping: outside the window his seniors can't be released or
 *      terminated; a contract that simply runs out still ends
 *   5. AI clubs buy ahead too, from each other and from him (AC-9)
 *   6. renewal blocked once sold: his player sold ahead can't be renewed
 *   7. in the window she arrives: at his club on the bid's wage and length (a
 *      season's deal from the next season), her wage starting that day; and a
 *      senior can be released in the window
 */
import { createWorld } from "./night2-world.mjs";
import { makeCapRoom } from "./harness-club.mjs";

const W = createWorld("transfer-window", 4983);
const { check, info } = W;
console.log("=".repeat(72));
console.log("  1.1.1 PART 2: THE TRANSFER WINDOW, BUYING AHEAD, NO DUMPING");
console.log("=".repeat(72));

const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
try {
  await W.boot();
  const { teamId, cid } = await W.newCareer("Transfer Window");
  const today = async () => (await W.api("GET", "/calendar")).data?.currentDate ?? "";
  const budget = () => Number(W.q(`SELECT budget b FROM teams WHERE id = ?`, teamId)[0].b);
  const state = (id) => W.q(`SELECT team_id t, pool_team_id p, salary, perks, contract_end_date e FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, id)[0];
  const balanceOf = (pool) => Number(W.q(`SELECT balance b FROM career_pool_team_state WHERE career_save_id = ? AND pool_team_id = ?`, cid, pool)[0].b);
  await W.day();
  // Room under the cap for the bids below (the cap itself is salary-cap's subject).
  makeCapRoom(W.db, teamId, 5000);

  // ── 1. The window ─────────────────────────────────────────────────────────
  console.log("\n1. THE WINDOW IS THE CALENDAR'S OFF-SEASON");
  const t = (await W.api("GET", "/transfers")).data;
  const cal = (await W.api("GET", "/calendar/annual?year=2026")).data;
  const off = (cal?.events ?? []).filter((e) => e.type === "holiday").map((e) => e.date).sort();
  check("the window is 7 Dec to 31 Dec 2026, the calendar's first and last Off-Season dates",
    t?.window?.opens === "2026-12-07" && t.window.closes === "2026-12-31" && off[0] === t.window.opens && off.at(-1) === t.window.closes,
    `${t?.window?.opens} to ${t?.window?.closes}; Off-Season events ${off[0]} to ${off.at(-1)}`);

  const market = (await W.api("GET", "/players/market-all")).data;
  const mine = W.q(`SELECT s.player_id id, s.salary FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.team_id = ? AND p.player_type = 'senior' ORDER BY s.player_id`, cid, teamId);

  // ── 3 (first). The cap on her arrival date ────────────────────────────────
  console.log("\n3. THE CAP IS CHECKED AGAINST HIS BILL ON HER ARRIVAL DATE");
  // One of his seniors is on $45,000 to June: today she is on his books, on 7 Dec she is not.
  const ending = mine[0];
  W.w(`UPDATE career_player_state SET salary = 45000, contract_end_date = '2026-06-30' WHERE career_save_id = ? AND player_id = ?`, cid, ending.id);
  W.w(`UPDATE contracts SET salary = 45000, end_date = '2026-06-30' WHERE player_id = ? AND team_id = ? AND status = 'active'`, ending.id, teamId);
  const billNow = (await W.api("GET", "/contracts/wage-cap")).data.seniorWages;
  const billOnArrival = billNow - 45000;
  const second = market.filter((p) => p.status === "ai_club" && p.contractEndDate >= "2026-12-07" && billNow + p.salary > 60000 && billOnArrival + p.salary <= 60000)
    .sort((a, b) => b.salary - a.salary)[0];
  const over = await W.api("POST", "/contracts", { playerId: second.id, salary: 60000 - billOnArrival + 500, length: "1s", confirm: true, perks: [] });
  check("a bid over the cap on her arrival date is refused, in words naming that date",
    over.status === 422 && /On 7 December 2026, when she would arrive/.test(over.data?.error ?? ""), over.data?.error);
  const fits = await W.api("POST", "/contracts", { playerId: second.id, salary: second.salary, length: "1s", confirm: true, perks: [] });
  check("one that breaks the cap today but fits on 7 Dec (her contract ending in June doesn't count) is made",
    fits.status === 201 && ["agreed", "kept"].includes(fits.data?.transfer?.outcome),
    `today ${money(billNow)} + ${money(second.salary)}; on 7 Dec ${money(billOnArrival)} + ${money(second.salary)}: ${fits.data?.transfer?.outcome ?? fits.data?.error}`);
  const secondAgreed = fits.data?.transfer?.outcome === "agreed";
  if (secondAgreed) {
    const third = market.filter((p) => p.status === "ai_club" && p.contractEndDate >= "2026-12-07" && p.id !== second.id && p.aiClubId !== second.aiClubId
      && billOnArrival + second.salary + p.salary > 60000).sort((a, b) => a.salary - b.salary)[0];
    const counted = third ? await W.api("POST", "/contracts", { playerId: third.id, salary: third.salary, length: "1s", confirm: true, perks: [] }) : null;
    check("and a player bought ahead counts on her arrival date: the next bid that would break it then is refused",
      !third || (counted.status === 422 && /On 7 December 2026/.test(counted.data?.error ?? "")), counted?.data?.error ?? "no such player");
    // 1.1.1 (the soak, 17 Oct): the bid counted the June contract as gone on 7 Dec, so renewing her must fit on
    // that day, even at her ask (no raise); before, a renewal at no more than her wage always passed.
    const endingContract = W.q(`SELECT id FROM contracts WHERE player_id = ? AND team_id = ? AND status = 'active'`, ending.id, teamId)[0];
    const renew = await W.api("POST", `/contracts/${endingContract.id}/renew`);
    check("and renewing the senior whose contract ends in June (counted gone on 7 Dec) is refused while the bought player is to come, even with no raise",
      renew.status === 422 && /On 7 December 2026, when a player bought ahead arrives/.test(renew.data?.error ?? ""), `HTTP ${renew.status} ${renew.data?.error ?? ""}`);
  } else info("her club kept her with its counter-offer: the bought-ahead count is checked below");

  // ── 2. Buy ahead ──────────────────────────────────────────────────────────
  console.log("\n2. BUY AHEAD: AGREED IN JANUARY, SHE JOINS ON 7 DEC");
  const arrivalBill = billOnArrival + (secondAgreed ? second.salary : 0);
  const target = market.filter((p) => p.status === "ai_club" && p.contractEndDate >= "2026-12-07" && !p.joins && p.id !== second.id
    && p.aiClubId !== second.aiClubId && arrivalBill + Math.round(p.salary * 1.4) <= 60000).sort((a, b) => b.salary - a.salary)[0];
  const club = target.aiClubId;
  const wage = Math.round(target.salary * 1.4);
  const b0 = budget(), c0 = balanceOf(club), s0 = state(target.id);
  const bid = await W.api("POST", "/contracts", { playerId: target.id, salary: wage, length: "1s", squadRole: "starter", confirm: true, perks: [] });
  const deal = W.q(`SELECT * FROM transfer_deals WHERE career_save_id = ? AND player_id = ?`, cid, target.id)[0];
  check("a bid 40% over her wage is agreed: her club's counter can't match it", bid.status === 201 && bid.data?.transfer?.outcome === "agreed" && deal?.status === "agreed",
    `HTTP ${bid.status} ${bid.data?.transfer?.outcome ?? bid.data?.error}`);
  check("she joins on 7 Dec (her contract runs past it)", deal?.arrives_on === "2026-12-07", deal?.arrives_on);
  const fee = Number(deal?.fee ?? 0);
  const ledger = W.q(`SELECT amount FROM finance_transactions WHERE team_id = ? AND category = 'transfer_fee' AND type = 'expense'`, teamId);
  check("the fee is paid the day the deal is agreed: his budget down, her club's balance up, on the ledger",
    fee > 0 && Math.abs(b0 - budget() - fee) < 1 && Math.abs(balanceOf(club) - c0 - fee) < 1 && ledger.some((r) => Math.abs(r.amount - fee) < 1),
    `fee ${money(fee)}; budget ${money(b0)} -> ${money(budget())}; club ${money(c0)} -> ${money(balanceOf(club))}`);
  const s1 = state(target.id);
  check("until then she stays at her club on her old wage", s1.p === club && s1.t == null && s1.salary === s0.salary, JSON.stringify(s1));
  const listed = (await W.api("GET", "/players/market-all")).data.find((p) => p.id === target.id);
  const teamName = W.q(`SELECT name FROM teams WHERE id = ?`, teamId)[0].name;
  check("the Player Market says she joins his club on 7 Dec, and she can't be bid for again",
    listed?.joins?.club === teamName && listed.joins.on === "2026-12-07"
      && (await W.api("POST", "/contracts", { playerId: target.id, salary: wage, length: "1s", confirm: true })).status === 422);
  check("the Team page lists her arriving", (await W.api("GET", "/transfers")).data.incoming.some((d) => d.playerId === target.id && d.arrivesOn === "2026-12-07"));
  // A player bought ahead counts on the arrival date: one who would fit without her is refused with her.
  const fourth = market.filter((p) => p.status === "ai_club" && p.contractEndDate >= "2026-12-07" && ![target.id, second.id].includes(p.id)
    && p.aiClubId !== club && arrivalBill + p.salary <= 60000 && arrivalBill + wage + p.salary > 60000).sort((a, b) => a.salary - b.salary)[0];
  const counted = fourth ? await W.api("POST", "/contracts", { playerId: fourth.id, salary: fourth.salary, length: "1s", confirm: true, perks: [] }) : null;
  check("a player bought ahead counts on her arrival date: a bid that would fit without her is refused with her",
    !!fourth && counted.status === 422 && /On 7 December 2026/.test(counted.data?.error ?? ""), counted?.data?.error ?? "no such player");

  // ── 4. No dumping ─────────────────────────────────────────────────────────
  console.log("\n4. NO DUMPING OUTSIDE THE WINDOW");
  const keep = mine[1];
  const rel = await W.api("POST", `/players/${keep.id}/release`, {});
  const contract = W.q(`SELECT id FROM contracts WHERE player_id = ? AND team_id = ? AND status = 'active'`, keep.id, teamId)[0];
  const term = await W.api("DELETE", `/contracts/${contract.id}`);
  check("a senior can't be released outside the window, nor her contract terminated", rel.status === 409 && term.status === 409
    && /until the transfer window opens on 7 December 2026/.test(rel.data?.error ?? ""), rel.data?.error);
  check("and she is still his", state(keep.id).t === teamId);

  // ── 5 and 6. AI clubs buy ahead, from each other and from him ─────────────
  console.log("\n5-6. AI CLUBS BUY AHEAD (FROM EACH OTHER AND FROM HIM); A PLAYER SOLD AHEAD CAN'T BE RENEWED");
  // His star: held a year (her contract started last season) and the best in the world.
  const star = mine[1];
  W.w(`UPDATE career_player_state SET speed = 99, power = 99, defense = 99, serve = 99, block = 99 WHERE career_save_id = ? AND player_id = ?`, cid, star.id);
  W.w(`UPDATE contracts SET start_date = '2025-01-01' WHERE player_id = ? AND team_id = ? AND status = 'active'`, star.id, teamId);
  let forHim = null;
  for (let i = 0; i < 21 && !forHim; i++) {
    await W.day();
    forHim = W.q(`SELECT * FROM transfer_deals WHERE career_save_id = ? AND from_team_id = ? AND to_pool_team_id IS NOT NULL`, cid, teamId)[0] ?? null;
  }
  check("an AI club bids for his star", !!forHim && forHim.status === "offered", forHim ? `${forHim.status}, answer by ${forHim.answer_by}` : "no bid in 3 weeks");
  if (forHim) {
    const go = await W.api("POST", `/transfers/${forHim.id}/let-go`, {});
    check("he lets her go: the deal is agreed and the fee is his", go.status === 200 && go.data?.outcome === "agreed", JSON.stringify(go.data?.outcome ?? go.data));
    const c = W.q(`SELECT id FROM contracts WHERE player_id = ? AND team_id = ? AND status = 'active'`, star.id, teamId)[0];
    W.w(`UPDATE contracts SET end_date = '2026-12-31' WHERE id = ?`, c.id);
    const renew = await W.api("POST", `/contracts/${c.id}/renew`, { length: "1s" });
    check("her club can't renew her once she is sold ahead", renew.status === 409 && /has agreed to join/.test(renew.data?.error ?? ""), renew.data?.error);
  }

  // ── 7. The window opens ───────────────────────────────────────────────────
  console.log("\n7. THE WINDOW OPENS: SHE ARRIVES");
  W.w(`UPDATE board_seasons SET grade = 'met' WHERE career_save_id = ?`, cid);
  for (let i = 0; i < 400 && (await today()) < "2026-12-07"; i++) {
    const r = await W.day();
    if (r.status >= 400) { info(`advance HTTP ${r.status} on ${await today()}: ${JSON.stringify(r.data).slice(0, 160)}`); break; }
  }
  // (Counted over the year: an AI club counts a contract ending before the arrival as room only while two
  // of its seniors run past it, the soak 17 Oct, so in the first weeks few fit.)
  const aiToAi = W.q(`SELECT COUNT(*) n FROM transfer_deals WHERE career_save_id = ? AND from_pool_team_id IS NOT NULL AND to_pool_team_id IS NOT NULL`, cid)[0].n;
  check("AI clubs bid for each other's seniors during the year", aiToAi > 0, `${aiToAi} AI-to-AI bids`);
  const after = state(target.id);
  const moved = W.q(`SELECT status, moved_on FROM transfer_deals WHERE id = ?`, deal.id)[0];
  check("on 7 Dec she is his, on the bid's wage, from that day", (await today()) >= "2026-12-07" && after.t === teamId && after.p == null
    && Math.abs(after.salary - Number(deal.wage)) < 1 && moved.status === "moved" && moved.moved_on === "2026-12-07", `${JSON.stringify(after)} ${JSON.stringify(moved)}`);
  check("a 1-season deal starting in the window runs to the end of the next season", after.e === "2027-12-31", after.e);
  const spare = W.q(`SELECT s.player_id id FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.team_id = ? AND p.player_type = 'senior' AND s.player_id <> ?`, cid, teamId, target.id)[0];
  const relIn = await W.api("POST", `/players/${spare.id}/release`, {});
  check("in the window a senior can be released", relIn.status === 200, `HTTP ${relIn.status} ${relIn.data?.error ?? ""}`);
} catch (err) {
  W.fail(err);
} finally {
  await W.stop();
}
W.finish();
