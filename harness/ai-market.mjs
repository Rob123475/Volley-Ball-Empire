/**
 * 1.1.3 (Rob, 25 Oct; AI market brief item 1): AI clubs trade on the market.
 *
 * Rob's rule: an AI club with a senior contract ending this season signs a
 * replacement for it during that season; it may renew ONE player, its best by
 * overall rating, and every other contract runs out and that player leaves;
 * it buys from the free-agent market at her price, never from another club; a
 * club that can't afford like for like signs a cheaper free agent, else
 * promotes from its academy, and only then leaves the place open, with the
 * reason recorded. The A3 limits still hold (10 reports and 10 bids a season,
 * 2 of each at one club) and the salary cap is never breached.
 *
 * Asserted, on a copy of the starter DB with a new career, over SEASONS (5)
 * seasons played headless:
 *   1. (source) the rule where the game keeps it (utils/aiSquadPolicy.ts, the squad policy)
 *   2. planted before the first window: club P1 with room under its cap only
 *      for players weaker than the one it loses signs cheaper free agents;
 *      club P2 with no money promotes its academy's best youth; club P3 with no
 *      room under its cap for anyone leaves the place open, recording "open:cap"
 *   3. every season, every AI club: a contract ending that season (seen on 6
 *      December, before the window) is replaced that season (a signing or a
 *      promotion in the window) unless the place is recorded open with its
 *      reason; at most one renewal, and the one renewed was its best on the
 *      day; every expiring player not renewed has left by the turn; the A3
 *      limits held; no AI club bid for another AI club's player
 *   4. every day, every AI club's senior wages (and perks) are within the cap
 *
 * Usage: node harness/ai-market.mjs   (SEASONS=n for more)
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import { createWorld, REPO } from "./night2-world.mjs";
import { keepSideFielded, renewExpiringContracts, healSquadByTeam } from "./harness-club.mjs";

const W = createWorld("ai-market", 4966);
const { check, info } = W;
const SEASONS = Number(process.env.SEASONS ?? 5);
const lib = (p) => import(pathToFileURL(path.join(REPO, p)).href);
const { overallRating } = await lib("artifacts/api-server/src/utils/overallRating.ts");
const { MONEY, playerWageRise } = await lib("lib/db/src/schema/money.ts");
// A senior's wage for her rating, what a free agent asks: utils/clubFinances.ts monthlySalaryFor, its numbers read from its source.
const FIN = fs.readFileSync(path.join(REPO, "artifacts/api-server/src/utils/clubFinances.ts"), "utf8");
const num = (k) => Number(FIN.match(new RegExp(`export const ${k} = (-?[\\d_]+);`))[1].replace(/_/g, ""));
const wage = (r) => Math.max(num("MIN_MONTHLY_SALARY"), Math.min(num("MAX_MONTHLY_SALARY"), Math.round((num("ASK_PER_RATING_POINT") * r + num("ASK_INTERCEPT")) / 12))) + playerWageRise(r);
const { PERKS } = await lib("lib/db/src/schema/transfers.ts");
const CAP = MONEY.salaryCap.monthlyCap;
const PERK_COST = Object.fromEntries(PERKS.map((k) => [k.key, k.monthly]));
const perkBill = (t) => String(t ?? "").split(",").filter(Boolean).reduce((s, k) => s + (PERK_COST[k] ?? 0), 0);
const LIMITS = { scoutingReports: 10, scoutingPerClub: 2, bids: 10, bidsPerClub: 2 };
const SRC = (p) => fs.readFileSync(path.join(REPO, p), "utf8");
console.log("=".repeat(72));
console.log("  1.1.3 (25 OCT): AI CLUBS TRADE ON THE MARKET");
console.log("=".repeat(72));

try {
  // ── 1. Source ──────────────────────────────────────────────────────────────
  console.log("\n1. (SOURCE) THE RULE, WHERE THE GAME KEEPS IT");
  // 1.1.3 (Rob, 26 Oct): the squad policy (utils/aiSquadPolicy.ts) is the one place these rules live.
  const ai = SRC("artifacts/api-server/src/utils/aiSquadPolicy.ts");
  check("a contract that ran out is renewed only for the club's best, and only once a season",
    /const isBest = squad\[0\]\?\.id === m\.id && squad\[0\]\?\.kind === "player";/.test(ai)
      && /const mayRenew = isBest && !longInjured && \(expired \|\| !m\.onList\) && aiRenewalsTx\(w\.tx, careerSaveId, club, seasonYearOf\(m\.contractEndDate\)\) === 0;/.test(ai));
  check("the weekly block runs the market (scouting through the year, signing in the window) before any bid",
    /marketScoutingTx\(ctx, clubs\);\s*marketWindowTx\(ctx, clubs\);\s*bidsForHisSeniorsTx\(ctx, clubs\);/.test(ai));
  check("AI clubs bid only for the player's seniors (no AI club's player is a bid candidate)",
    /const candidates = robs\b/.test(ai) && !/const theirs = /.test(ai));
  check("a market signing pays her price and is recorded; the fallbacks are the academy, then an open place with its reason",
    /signTx\(ctx, club, pick\.f, "sign", pick\.price, moves\);/.test(ai)
      && /if \(price > 0\) addToBalance\(w\.tx, careerSaveId, club, -price\);\s*recordAiMoveTx\(w\.tx, careerSaveId, club, kind,/.test(ai)
      && /recordAiMoveTx\(ctx\.w\.tx, ctx\.careerSaveId, club, "promote"/.test(ai) && /recordAiMoveTx\(w\.tx, careerSaveId, club, `open:\$\{why\}`/.test(ai));

  await W.boot();
  const { teamId, cid } = await W.newCareer("AI Market");
  // The career's own club: a sacked manager is moved to an AI club at the turn (routes/job-market.ts), a new teams row.
  const myTeam = () => W.q(`SELECT team_id t FROM career_saves WHERE id = ?`, cid)[0]?.t ?? teamId;
  const today = () => W.q(`SELECT "current_date" AS d FROM calendar_state WHERE team_id = ?`, myTeam())[0]?.d ?? "";
  const careerStart = today();
  const seniors = () => W.q(`SELECT s.player_id id, p.name, p.player_type ptype, s.pool_team_id club, s.salary, s.perks, s.contract_end_date ends, s.pool_joined_on joined,
      s.on_injured_list listed, s.speed, s.power, s.defense, s.serve, s.block, s.stamina
    FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.pool_team_id IS NOT NULL AND s.team_id IS NULL AND s.is_retired = 0 AND (p.player_type = 'senior' OR s.is_promoted = 1)`, cid)
    .map((r) => ({ ...r, rating: overallRating(r) }));
  const byClub = (rows) => { const m = new Map(); for (const r of rows) m.set(r.club, [...(m.get(r.club) ?? []), r]); return m; };
  const freeAgents = () => W.q(`SELECT COUNT(*) n FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.career_save_id = ? AND s.team_id IS NULL
    AND s.pool_team_id IS NULL AND s.is_retired = 0 AND (p.player_type = 'senior' OR s.is_promoted = 1)`, cid)[0].n;
  const clubs = () => W.q(`SELECT pool_team_id c FROM career_pool_team_state WHERE career_save_id = ? AND taken_over_at IS NULL`, cid).map((r) => r.c);
  const youthsOf = (club) => W.q(`SELECT s.player_id id, s.age FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.pool_team_id = ? AND s.team_id IS NULL AND s.is_retired = 0 AND p.player_type = 'youth' AND s.is_promoted = 0`, cid, club);
  const moves = (where = "", ...a) => W.q(`SELECT * FROM ai_market_moves WHERE career_save_id = ? ${where}`, cid, ...a);

  // ── 2. The planted clubs (set up on 30 November of the first season) ─────
  const planted = {};
  const plant = (year) => {
    const sq = byClub(seniors());
    const full = [...sq].filter(([c, l]) => l.length === 3 && l.every((m) => !m.listed)).map(([c, l]) => ({ c, l: [...l].sort((a, b) => b.rating - a.rating) }));
    const end = `${year}-12-31`, past = `${year + 1}-12-31`;
    // P1: its best stays (her contract runs on), its other two leave; its room next season only fits players weaker
    // than the better of them by more than AI_BUY_GAP (5): the cheapest free agent, and one rated 6 below her.
    const p1 = full.find(({ l }) => l[1].rating >= 72);
    const room = wage(p1.l[1].rating - 6);
    const cheapest = Math.min(...W.q(`SELECT s.player_id, s.speed, s.power, s.defense, s.serve, s.block, s.stamina, s.injury_status st FROM career_player_state s JOIN players p ON p.id = s.player_id
      WHERE s.career_save_id = ? AND s.team_id IS NULL AND s.pool_team_id IS NULL AND s.is_retired = 0 AND p.player_type = 'senior' AND COALESCE(s.injury_status, 'Healthy') = 'Healthy'`, cid).map((r) => wage(overallRating(r))));
    const s1 = CAP - cheapest - room;
    W.w(`UPDATE career_player_state SET contract_end_date = ?, salary = ?, perks = '' WHERE career_save_id = ? AND player_id = ?`, past, s1, cid, p1.l[0].id);
    for (const m of p1.l.slice(1)) W.w(`UPDATE career_player_state SET contract_end_date = ?, salary = 10000, perks = '' WHERE career_save_id = ? AND player_id = ?`, end, cid, m.id);
    W.w(`UPDATE career_pool_team_state SET balance = 5000000 WHERE career_save_id = ? AND pool_team_id = ?`, cid, p1.c);
    planted.P1 = { club: p1.c, replacing: p1.l[1].rating, leavers: p1.l.slice(1).map((m) => m.id), best: p1.l[0].id, s1, room, cheapest };
    // P2: two stay, one leaves; no money (its balance held below zero), two academy youths of 16 or more.
    const p2 = full.find(({ c }) => c !== p1.c && youthsOf(c).filter((y) => y.age >= 16).length >= 2);
    for (const m of p2.l.slice(0, 2)) W.w(`UPDATE career_player_state SET contract_end_date = ?, salary = 15000, perks = '' WHERE career_save_id = ? AND player_id = ?`, past, cid, m.id);
    W.w(`UPDATE career_player_state SET contract_end_date = ?, salary = 15000, perks = '' WHERE career_save_id = ? AND player_id = ?`, end, cid, p2.l[2].id);
    planted.P2 = { club: p2.c, leavers: [p2.l[2].id] };
    // P3: two stay on $25,000 each, so next season nobody fits in the room left under its cap (every senior asks at
    // least the minimum wage, a free agent or a youth); one leaves. Money is no object.
    const p3 = full.find(({ c }) => c !== p1.c && c !== p2.c);
    for (const m of p3.l.slice(0, 2)) W.w(`UPDATE career_player_state SET contract_end_date = ?, salary = 25000, perks = '' WHERE career_save_id = ? AND player_id = ?`, past, cid, m.id);
    W.w(`UPDATE career_player_state SET contract_end_date = ?, salary = 8000, perks = '' WHERE career_save_id = ? AND player_id = ?`, end, cid, p3.l[2].id);
    W.w(`UPDATE career_pool_team_state SET balance = 5000000 WHERE career_save_id = ? AND pool_team_id = ?`, cid, p3.c);
    planted.P3 = { club: p3.c, leavers: [p3.l[2].id] };
    info(`planted on ${today()}: P1 club ${p1.c} (best ${p1.l[0].name} on $${s1} to ${past}; leaving ${p1.l.slice(1).map((m) => `${m.name} ${m.rating}`).join(", ")}; room for $${room} after the cheapest $${cheapest}), P2 club ${p2.c} (broke, ${youthsOf(p2.c).length} youths), P3 club ${p3.c} ($10,000 of room next season; the least a senior asks is $${wage(0)})`);
  };
  const holdPlanted = () => {
    if (!planted.P2 || planted.done) return;
    W.w(`UPDATE career_pool_team_state SET balance = -100000 WHERE career_save_id = ? AND pool_team_id = ?`, cid, planted.P2.club);
  };

  // ── 3 and 4. Seasons ───────────────────────────────────────────────────────
  console.log(`\n3-4. ${SEASONS} SEASONS`);
  let season = 1, guard = 0;
  const started = Date.now();
  let snap = null;            // 6 December: each club's seniors, before the window
  const renewChecks = [];     // each renewal: was she the club's best that day?
  const overCap = [];         // any day any AI club over the cap (bar C-5, below)
  const shortDays = [];       // item 4: any day any AI club with fewer than two seniors holding a place
  const overByPromotion = new Set();   // club-seasons over it only through a promoted youth (C-5)
  const shippedOver = new Set();   // clubs over it on the first day with the starter DB's own seniors (C-5)
  const seasonRows = [];
  let faStart = freeAgents();
  while (season <= SEASONS && guard++ < 470 * SEASONS) {
    healSquadByTeam(W.db, myTeam());
    if (guard % 7 === 1) { await keepSideFielded(W.api); await renewExpiringContracts(W.api); }
    const d0 = today();
    if (season === 1 && d0.slice(5) === "11-30" && !planted.P1) plant(Number(d0.slice(0, 4)));
    holdPlanted();
    if (d0.slice(5) === "12-06") snap = { year: Number(d0.slice(0, 4)), squads: byClub(seniors()) };
    const r = await W.day();
    if (r.status >= 400) { check("the calendar advances", false, `HTTP ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`); break; }
    const d = today();
    const rolled = r.data?.seasonRollover && r.data.seasonRollover.kind !== "none";
    const all = seniors(), sq = byClub(all);
    // Item 4: any AI club with fewer than two seniors holding a place (one on the injured list holds none).
    for (const c of clubs()) {
      const placed = (sq.get(c) ?? []).filter((m) => !m.listed).length;
      if (placed < 2) shortDays.push(`${d} club ${c}: ${placed} placed of ${(sq.get(c) ?? []).length}`);
    }
    // 4. The cap, every day, every AI club. A club the starter DB puts over it (two shipped seniors on more than
    // $60,000 between them) keeps them (C-5) and is counted apart; any club over it with a senior it signed,
    // promoted or renewed in this career has breached it.
    for (const [c, l] of sq) {
      const bill = l.reduce((t, m) => t + Number(m.salary) + perkBill(m.perks), 0);
      if (bill <= CAP) continue;
      // C-5 (Rob, 14 Oct): a youth promoted into the seniors is never blocked (the injured list's cover, two on the
      // sand); she counts and the club can then add nobody. Counted apart, as the soak counts it.
      const signedBill = l.filter((m) => m.ptype === "senior").reduce((t, m) => t + Number(m.salary) + perkBill(m.perks), 0);
      if (signedBill <= CAP) { overByPromotion.add(`${c} ${d.slice(0, 4)}`); continue; }
      // Shipped over it: its own seniors alone (none joined in this career) are over the cap on the first day. (A youth
      // promoted as cover on the career's first day, C-5, may already be beside them.)
      if (guard === 1 && l.filter((m) => m.joined == null).reduce((t, m) => t + Number(m.salary) + perkBill(m.perks), 0) > CAP) shippedOver.add(c);
      const renewed = new Set(moves(`AND kind = 'renew' AND pool_team_id = ?`, c).map((x) => x.player_id));
      const line = `${d} club ${c} $${bill}: ${l.map((m) => `${m.name} $${m.salary}${m.perks ? `+${m.perks}` : ""} joined ${m.joined}${renewed.has(m.id) ? " renewed" : ""}`).join("; ")}`;
      // A shipped club over it may renew one of its own at a lower wage (C-5: no new spending); it may add nobody.
      if (!shippedOver.has(c) || l.some((m) => m.joined != null && m.ptype === "senior")) overCap.push(line);
    }
    // Renewals today (a renewal at the turn is dated 31 December, the day her contract ended).
    for (const rw of moves(`AND kind = 'renew' AND on_date IN (?, ?)`, d, rolled ? `${Number(d.slice(0, 4)) - 1}-12-31` : d)) {
      if (renewChecks.some((x) => x.id === rw.id)) continue;
      const before = (sq.get(rw.pool_team_id) ?? []).filter((m) => m.joined == null || m.joined < rw.on_date);
      const her = before.find((m) => m.id === rw.player_id);
      renewChecks.push({ id: rw.id, ok: !!her && before.every((m) => m.rating <= her.rating), detail: `${rw.on_date} club ${rw.pool_team_id}: ${her ? `${her.name} ${her.rating}` : `player ${rw.player_id} gone`} of ${before.map((m) => m.rating).join("/")}` });
    }
    if (rolled) {
      W.w(`UPDATE board_seasons SET grade = 'met' WHERE career_save_id = ? AND grade = 'failed'`, cid);
      const year = Number(d.slice(0, 4)) - 1;
      const ofYear = moves(`AND season_year = ?`, year);
      const inWindow = ofYear.filter((m) => m.on_date >= `${year}-12-07` && ["sign", "promote", "refill"].includes(m.kind));
      const opens = ofYear.filter((m) => m.kind.startsWith("open:"));
      const renews = ofYear.filter((m) => m.kind === "renew");
      // 3. Every club with a contract ending this season (seen on 6 December).
      const missing = [], stayed = [], twoRenewals = [];
      let expiringClubs = 0, leaversAll = 0;
      for (const [c, l] of snap?.year === year ? snap.squads : new Map()) {
        const expiring = l.filter((m) => m.ends != null && m.ends <= `${year}-12-31`);
        if (expiring.length === 0) continue;
        expiringClubs++;
        const renewed = new Set(renews.filter((x) => x.pool_team_id === c).map((x) => x.player_id));
        if (renewed.size > 1) twoRenewals.push(`club ${c}: ${renewed.size}`);
        const leavers = expiring.filter((m) => !renewed.has(m.id));
        // Its places for next season: three, less those holding a place who stay (a senior on the injured list holds
        // none; her cover does). It replaces every leaver up to that.
        const staying = l.filter((m) => !m.listed && (m.ends == null || m.ends > `${year}-12-31` || renewed.has(m.id))).length;
        const required = Math.min(leavers.length, Math.max(0, 3 - staying));
        leaversAll += leavers.length;
        // A signing, promotion or refill in the window, or one of the player's seniors it bought, arriving in it.
        const replaced = inWindow.filter((x) => x.pool_team_id === c).length
          + W.q(`SELECT COUNT(*) n FROM transfer_deals WHERE career_save_id = ? AND to_pool_team_id = ? AND status IN ('moved', 'agreed') AND COALESCE(squad_role, '') <> 'academy'
            AND COALESCE(moved_on, arrives_on) BETWEEN ? AND ?`, cid, c, `${year}-12-07`, `${year + 1}-01-01`)[0].n;
        const open = opens.filter((x) => x.pool_team_id === c).length;
        if (replaced + open < required) missing.push(`club ${c}: ${leavers.length} leaving (${required} places), ${replaced} signed, ${open} open [${ofYear.filter((x) => x.pool_team_id === c && x.kind !== "scout").map((x) => `${x.kind} ${x.player_id} ${x.on_date}`).join(", ")}; ${l.map((m) => `${m.name} ${m.rating} to ${m.ends}${m.listed ? " listed" : ""}`).join(", ")}]`);
        for (const m of leavers) {
          const now = W.q(`SELECT pool_team_id c, team_id t, is_retired x FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, m.id)[0];
          if (now && !now.x && now.c === c) stayed.push(`${m.name} at club ${c} (to ${W.q(`SELECT contract_end_date e FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, m.id)[0]?.e})`);
        }
      }
      check(`season ${year}: every AI club with a contract ending replaced it in the window (or recorded the place open, with why)`,
        snap?.year === year && expiringClubs > 0 && missing.length === 0, `${expiringClubs} clubs, ${leaversAll} leaving; ${inWindow.filter((x) => x.kind === "sign").length} signed, ${inWindow.filter((x) => x.kind === "promote").length} promoted, ${inWindow.filter((x) => x.kind === "refill").length} refills; open ${opens.length} (${[...new Set(opens.map((x) => x.kind))].join(", ") || "none"})${missing.length ? `; MISSING ${missing.slice(0, 5).join("; ")}` : ""}`);
      check(`season ${year}: no club renewed more than one player`, twoRenewals.length === 0, `${renews.length} renewals${twoRenewals.length ? `; ${twoRenewals.join("; ")}` : ""}`);
      check(`season ${year}: every expiring player not renewed has left her club`, stayed.length === 0, stayed.slice(0, 5).join("; ") || `${leaversAll} left`);
      const group = (rows, key) => { const m = new Map(); for (const x of rows) m.set(key(x), (m.get(key(x)) ?? 0) + 1); return Math.max(0, ...m.values()); };
      const at = (x) => `${x.pool_team_id}>${x.target_team_id != null ? `t${x.target_team_id}` : x.target_pool_team_id != null ? `p${x.target_pool_team_id}` : "free"}`;
      const scouts = ofYear.filter((x) => x.kind === "scout"), buys = ofYear.filter((x) => x.kind === "bid" || x.kind === "sign");
      const clubBound = (rows) => rows.filter((x) => x.target_team_id != null || x.target_pool_team_id != null);
      check(`season ${year}: the A3 limits held (10 reports, 2 on one club; 10 bids and signings, 2 to one club)`,
        group(scouts, (x) => x.pool_team_id) <= LIMITS.scoutingReports && group(clubBound(scouts), at) <= LIMITS.scoutingPerClub
          && group(buys, (x) => x.pool_team_id) <= LIMITS.bids && group(clubBound(buys), at) <= LIMITS.bidsPerClub,
        `${scouts.length} reports (most by one club ${group(scouts, (x) => x.pool_team_id)}, on one club ${group(clubBound(scouts), at)}); ${buys.length} bids and signings (most ${group(buys, (x) => x.pool_team_id)}, to one club ${group(clubBound(buys), at)})`);
      const aiToAi = W.q(`SELECT COUNT(*) n FROM transfer_deals WHERE career_save_id = ? AND from_pool_team_id IS NOT NULL AND to_pool_team_id IS NOT NULL
        AND COALESCE(squad_role, '') <> 'academy' AND substr(offered_on, 1, 4) = ?`, cid, String(year))[0].n;
      check(`season ${year}: no AI club bid for another AI club's senior`, aiToAi === 0, `${aiToAi} AI-to-AI senior bids`);
      const long = [...byClub(seniors())].map(([c, l]) => l.filter((m) => year - Number((m.joined ?? careerStart).slice(0, 4)) + (m.joined && m.joined.slice(5) >= "12-07" ? 0 : 1) >= 3).length);
      // Item 4: the clubs starting the new season on two seniors, and their bills (are they near the cap?).
      const onTwo = [...byClub(seniors())].filter(([, l]) => l.filter((m) => !m.listed).length < 3)
        .map(([c, l]) => `club ${c} ${l.filter((m) => !m.listed).length} ($${l.reduce((t, m) => t + Number(m.salary) + perkBill(m.perks), 0)}${shippedOver.has(c) ? ", shipped over the cap" : ""})`);
      info(`season ${year}: clubs starting ${year + 1} with fewer than three seniors holding a place: ${onTwo.length}${onTwo.length ? ` (${onTwo.slice(0, 8).join("; ")})` : ""}`);
      seasonRows.push({ year, onTwo: onTwo.length, faStart, faEnd: freeAgents(), signed: inWindow.filter((x) => x.kind === "sign").length, promoted: ofYear.filter((x) => x.kind === "promote").length, open: opens.length, renewals: renews.length });
      info(`season ${year}: free agents ${faStart} at the start, ${seasonRows.at(-1).faEnd} at the turn; players 3+ seasons at their club: most at one club ${Math.max(0, ...long)}, clubs with 2+ ${long.filter((n) => n >= 2).length}; ${((Date.now() - started) / 60000).toFixed(1)} min`);
      faStart = freeAgents();
      if (season === 1) {
        // 2. The planted clubs, in this first window.
        planted.done = true;
        const signedBy = (c) => inWindow.filter((x) => x.pool_team_id === c && x.kind === "sign").map((x) => {
          const p = W.q(`SELECT p.name, s.salary, s.speed, s.power, s.defense, s.serve, s.block, s.stamina FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.career_save_id = ? AND s.player_id = ?`, cid, x.player_id)[0];
          return { name: p.name, rating: overallRating(p), salary: Number(p.salary) };
        });
        const p1 = signedBy(planted.P1.club);
        // 1.1.3 (26 Oct): "cheaper" is her wage, signed in the window, below the wage of a player within AI_BUY_GAP of the
        // one she replaces (what its room was planted on). Her rating at the turn is a month of training and a birthday
        // later than the planting, and could cross the line on its own (a 72 against 77 - 5 on 26 Oct).
        check("P1, too poor under its cap for like for like, signed cheaper free agents for both places (no place left open)",
          p1.length === 2 && p1.every((s) => s.salary < wage(planted.P1.replacing - 5)) && opens.filter((x) => x.pool_team_id === planted.P1.club).length === 0,
          `replacing ${planted.P1.replacing} (like for like from $${wage(planted.P1.replacing - 5)}): signed ${p1.map((s) => `${s.name} ${s.rating} on $${s.salary}`).join(", ") || "none"}`);
        const p2 = inWindow.filter((x) => x.pool_team_id === planted.P2.club);
        check("P2, with no money, promoted its academy's best youth (no place left open)",
          p2.some((x) => x.kind === "promote") && opens.filter((x) => x.pool_team_id === planted.P2.club).length === 0, p2.map((x) => `${x.kind} ${x.on_date}`).join(", ") || "nothing");
        const p3 = opens.filter((x) => x.pool_team_id === planted.P3.club);
        check("P3, with no room under its cap for anyone (a free agent or a youth), left the place open and recorded why (open:cap)", p3.length === 1 && p3[0].kind === "open:cap",
          p3.map((x) => `${x.kind} ${x.on_date}`).join(", ") || "no open place recorded");
      }
      season++;
    }
  }
  check(`${SEASONS} seasons played`, season > SEASONS, `reached season ${season} on ${today()}`);
  const badRenewals = renewChecks.filter((x) => !x.ok);
  check("every renewal was of the club's best on the day", renewChecks.length > 0 && badRenewals.length === 0, `${renewChecks.length} renewals${badRenewals.length ? `; NOT THE BEST: ${badRenewals.slice(0, 5).map((x) => x.detail).join("; ")}` : ""}`);
  check("no AI club went over the salary cap on any day (a club the starter DB puts over it keeps its own and adds nobody, C-5)", overCap.length === 0, overCap.slice(0, 5).join("\n        ") || "none");
  // 1.1.3 (Rob, 25 Oct; item 4): holding a third senior, and the injured list's cover the same day.
  check("item 4: no AI club was ever without two seniors holding a place, on any day", shortDays.length === 0, shortDays.slice(0, 8).join("; ") || "none");
  info(`club-seasons over the cap only through a youth promoted to cover (C-5, allowed): ${overByPromotion.size}`);
  info(`clubs the starter DB puts over the cap with its own seniors on the first day: ${shippedOver.size} (${[...shippedOver].join(", ")})`);
  info(`seasons: ${seasonRows.map((s) => `${s.year} renewed ${s.renewals}, signed ${s.signed}, promoted ${s.promoted}, open ${s.open}, free agents ${s.faStart}->${s.faEnd}`).join("; ")}`);
} catch (err) {
  W.fail(err);
} finally {
  await W.stop();
  // KEEP_DB=<file>: a copy of the save, to look into.
  if (process.env.KEEP_DB) fs.copyFileSync(W.db, process.env.KEEP_DB);
  W.finish();
}
