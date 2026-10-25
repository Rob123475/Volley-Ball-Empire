/**
 * 1.1.3 (Rob, 23 Oct; brief A3): the AI clubs' scouting and buying limits.
 *
 * Rob: "AI clubs can scout no more than 10 scouting missions in a year and no
 * more than 2 from 1 club; this applies for buying as well." AI_SEASON_LIMITS
 * (lib/db schema/transfers.ts), counted from ai_market_moves (utils/
 * aiMarketLimits.ts).
 *
 *   1. (source) the numbers are named constants beside AI_TRANSFER_TERMS; the
 *      senior bids and the youth buy offers both count and record; the counts
 *      come from the save's table
 *   2. planted: an AI club with 10 bids this season makes no more; one with 2
 *      reports on the player's club scouts none of his players again
 *   3. three seasons simmed (a server reboot in the middle): no AI club ever
 *      has more than 10 reports or 10 bids in a season, nor more than 2 of
 *      either at one club; the table agrees with the game's own records
 *      (scouting_jobs, transfer_deals); every senior bid followed a ready
 *      report on her by the bidder; youth buy offers are counted. 1.1.3 (Rob,
 *      25 Oct): senior bids are for the player's seniors only, and the AI
 *      clubs' signings from the free-agent market count with the bids (a free
 *      agent is at no club: toward no club's two)
 *
 * Usage: node harness/ai-market-limits.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createWorld, REPO } from "./night2-world.mjs";
import { keepSideFielded, renewExpiringContracts, healSquadByTeam } from "./harness-club.mjs";

const W = createWorld("ai-market-limits", 4991);
const { check, info } = W;
const SEASONS = Number(process.env.SEASONS ?? 3);
const LIMITS = { scoutingReports: 10, scoutingPerClub: 2, bids: 10, bidsPerClub: 2 };
console.log("=".repeat(72));
console.log("  1.1.3 (A3): AI SCOUTING AND BUYING LIMITS");
console.log("=".repeat(72));
const SRC = (p) => fs.readFileSync(path.join(REPO, p), "utf8");
const at = (r) => (r.target_team_id != null ? `his club` : `AI ${r.target_pool_team_id}`);

try {
  // ── 1. Source ──────────────────────────────────────────────────────────────
  console.log("\n1. (SOURCE) THE NUMBERS, WHERE THEY COUNT");
  const terms = SRC("lib/db/src/schema/transfers.ts");
  check("AI_SEASON_LIMITS = 10 reports, 2 at one club, 10 bids, 2 to one club, beside AI_TRANSFER_TERMS",
    /export const AI_TRANSFER_TERMS[\s\S]{0,900}export const AI_SEASON_LIMITS = \{ scoutingReports: 10, scoutingPerClub: 2, bids: 10, bidsPerClub: 2 \} as const;/.test(terms));
  const lim = SRC("artifacts/api-server/src/utils/aiMarketLimits.ts");
  check("the counts are read from the save's ai_market_moves table, by club and season", /tx\.select\(\)\.from\(aiMarketMovesTable\)/.test(lim) && /seasonYear, seasonYearOf\(today\)/.test(lim));
  const squads = SRC("artifacts/api-server/src/utils/aiSquadPolicy.ts"), youth = SRC("artifacts/api-server/src/utils/youthDeals.ts");
  check("a senior: scouted first (a scouting job and a 'scout' row), bid only once the report is ready, the bid recorded",
    /recordAiMoveTx\(w\.tx, careerSaveId, buyer, "scout"/.test(squads) && /if \(ready > today\) break;/.test(squads) && /recordAiMoveTx\(w\.tx, careerSaveId, buyer, "bid"/.test(squads));
  check("a youth buy offer is a bid too, limited and recorded", /mayBid\(moves, \{ poolTeamId: r\.poolTeamId \}\)/.test(youth) && /recordAiMoveTx\(tx, careerSaveId, poolTeamId, "bid"/.test(youth));
  check("a deleted career deletes its rows", /t\.delete\(aiMarketMovesTable\)/.test(SRC("artifacts/api-server/src/utils/deleteCareerSave.ts")));

  await W.boot();
  const { profileId, teamId, cid } = await W.newCareer("AI Limits");
  const today = () => W.q(`SELECT "current_date" AS d FROM calendar_state WHERE team_id = ?`, teamId)[0]?.d ?? "";
  const myTeam = () => W.q(`SELECT team_id t FROM career_saves WHERE id = ?`, cid)[0]?.t ?? teamId;
  const clubs = W.q(`SELECT pool_team_id c FROM career_pool_team_state WHERE career_save_id = ?`, cid).map((r) => r.c);

  // ── 2. Planted ─────────────────────────────────────────────────────────────
  console.log("\n2. PLANTED: A CLUB AT ITS LIMITS STOPS");
  const year = W.q(`SELECT MIN(year) y FROM seasons WHERE career_save_id = ?`, cid)[0].y;
  const [full, scoutedOut] = clubs.slice(0, 2);
  for (let i = 0; i < 10; i++) {
    W.w(`INSERT INTO ai_market_moves (career_save_id, pool_team_id, kind, player_id, target_team_id, target_pool_team_id, season_year, on_date)
      VALUES (?, ?, 'bid', -1, NULL, ?, ?, ?)`, cid, full, clubs[2 + (i % 5)], year, `${year}-01-01`);
  }
  for (let i = 0; i < 2; i++) {
    W.w(`INSERT INTO ai_market_moves (career_save_id, pool_team_id, kind, player_id, target_team_id, target_pool_team_id, season_year, on_date, ready_on)
      VALUES (?, ?, 'scout', -1, ?, NULL, ?, ?, ?)`, cid, scoutedOut, teamId, year, `${year}-01-01`, `${year}-01-06`);
  }

  // ── 3. Three seasons ───────────────────────────────────────────────────────
  console.log(`\n3. ${SEASONS} SEASONS`);
  let season = 1, rebooted = false, guard = 0;
  const started = Date.now();
  // AI squads sit near the cap, so in some seasons no AI club can afford to buy a senior at all (1.1.1). As in
  // ai-buyable and transfer-window, six clubs get room in this suite's own database, each season: the check is
  // that the limits hold while the AI clubs do scout and bid.
  const giveRoom = () => {
    for (const c of clubs.slice(10, 16)) W.w(`UPDATE career_player_state SET salary = 10000, perks = '' WHERE career_save_id = ? AND pool_team_id = ? AND team_id IS NULL`, cid, c);
  };
  giveRoom();
  while (season <= SEASONS && guard++ < 470 * SEASONS) {
    healSquadByTeam(W.db, myTeam());
    if (today().slice(5) === "02-01") giveRoom();
    if (guard % 7 === 1) { await keepSideFielded(W.api); await renewExpiringContracts(W.api); }
    const r = await W.day();
    if (r.status >= 400) { check("the calendar advances", false, `HTTP ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`); break; }
    if (r.data?.seasonRollover && r.data.seasonRollover.kind !== "none") {
      W.w(`UPDATE board_seasons SET grade = 'met' WHERE career_save_id = ? AND grade = 'failed'`, cid);
      info(`season ${season} done (${today()}, ${((Date.now() - started) / 60000).toFixed(1)} min)`);
      season++;
    }
    // Mid-run, the server restarts: the counts are the save's, not memory's.
    if (!rebooted && season === 2 && today().slice(5) >= "06-01") {
      const before = W.q(`SELECT COUNT(*) n FROM ai_market_moves WHERE career_save_id = ?`, cid)[0].n;
      await W.stop(); await W.boot(); rebooted = true;
      await W.select(profileId);
      const after = W.q(`SELECT COUNT(*) n FROM ai_market_moves WHERE career_save_id = ?`, cid)[0].n;
      check("a reboot keeps every scouting report and bid on record", after === before && before > 0, `${before} rows before, ${after} after (${today()})`);
    }
  }
  check(`${SEASONS} seasons played`, season > SEASONS, `reached season ${season} on ${today()}`);

  const moves = W.q(`SELECT * FROM ai_market_moves WHERE career_save_id = ?`, cid);
  const planted = (r) => r.player_id === -1;
  const real = moves.filter((r) => !planted(r));
  const plantedYear = moves.filter((r) => r.season_year === year);
  check("planted: the club with 10 bids made no more that season", plantedYear.filter((r) => r.pool_team_id === full && r.kind === "bid").length === 10,
    `${plantedYear.filter((r) => r.pool_team_id === full && r.kind === "bid").length} bids`);
  check("planted: the club with 2 reports on his club scouted none of his players again that season",
    plantedYear.filter((r) => r.pool_team_id === scoutedOut && r.kind === "scout" && r.target_team_id != null).length === 2);

  const group = (rows, key) => { const m = new Map(); for (const r of rows) { const k = key(r); m.set(k, (m.get(k) ?? 0) + 1); } return m; };
  const seasonsSeen = [...new Set(moves.map((r) => r.season_year))].sort();
  for (const y of seasonsSeen) {
    const ofYear = moves.filter((r) => r.season_year === y);
    // 1.1.3 (25 Oct): a signing from the free-agent market counts with the bids; a free agent is at no club, so a
    // report on her or her signing counts toward no club's two.
    const scouts = ofYear.filter((r) => r.kind === "scout"), bids = ofYear.filter((r) => r.kind === "bid" || r.kind === "sign");
    const atClub = (rows) => rows.filter((r) => r.target_team_id != null || r.target_pool_team_id != null);
    const sBy = group(scouts, (r) => r.pool_team_id), bBy = group(bids, (r) => r.pool_team_id);
    const sAt = group(atClub(scouts), (r) => `${r.pool_team_id}>${at(r)}`), bAt = group(atClub(bids), (r) => `${r.pool_team_id}>${at(r)}`);
    const max = (m) => Math.max(0, ...m.values());
    check(`season ${y}: no AI club ran more than 10 scouting reports, nor more than 2 at one club`,
      max(sBy) <= LIMITS.scoutingReports && max(sAt) <= LIMITS.scoutingPerClub, `${scouts.length} reports; most by one club ${max(sBy)}, most by one club on one club ${max(sAt)}`);
    check(`season ${y}: no AI club made more than 10 bids, nor more than 2 to one club`,
      max(bBy) <= LIMITS.bids && max(bAt) <= LIMITS.bidsPerClub, `${bids.length} bids; most by one club ${max(bBy)}, most by one club to one club ${max(bAt)}`);
  }

  // The game's own records agree with the table.
  const jobs = W.q(`SELECT * FROM scouting_jobs WHERE career_save_id = ? AND pool_team_id IS NOT NULL AND kind = 'player'`, cid);
  const scoutRows = real.filter((r) => r.kind === "scout");
  check("every AI scouting report is a Scout's or coach's job in scouting_jobs (and the other way round)", jobs.length === scoutRows.length && jobs.length > 0,
    `${jobs.length} jobs, ${scoutRows.length} rows`);
  const deals = W.q(`SELECT * FROM transfer_deals WHERE career_save_id = ? AND to_pool_team_id IS NOT NULL`, cid);
  const seniorDeals = deals.filter((d) => d.squad_role !== "academy");
  const bidRows = real.filter((r) => r.kind === "bid");
  const hasBid = (d) => bidRows.some((r) => r.pool_team_id === d.to_pool_team_id && r.player_id === d.player_id && r.on_date === d.offered_on);
  // 1.1.3 (Rob, 25 Oct): AI clubs bid only for his seniors (rare); they buy other AI clubs' players on the market.
  check("every AI senior bid in transfer_deals is on record as a bid, and is for his player", seniorDeals.every(hasBid) && seniorDeals.every((d) => d.from_team_id != null),
    `${seniorDeals.length} senior bids (${seniorDeals.filter((d) => d.status === "kept").length} kept by a counter)`);
  const signings = real.filter((r) => r.kind === "sign");
  check("the AI clubs bought on the market, each signing on record and counted with the bids", signings.length > 0, `${signings.length} signings from the free agents`);
  const scoutedFirst = (d) => scoutRows.some((r) => r.pool_team_id === d.to_pool_team_id && r.player_id === d.player_id && r.ready_on <= d.offered_on && r.season_year === Number(d.offered_on.slice(0, 4)));
  check("every AI senior bid came after the bidder's ready report on her", seniorDeals.every(scoutedFirst), `${seniorDeals.filter((d) => !scoutedFirst(d)).length} without`);
  const youthBuys = deals.filter((d) => d.squad_role === "academy");
  check("every AI youth buy is on record as a bid (and refused asks are counted too)", youthBuys.every(hasBid) && bidRows.length >= seniorDeals.length + youthBuys.length,
    `${youthBuys.length} youth buys; ${bidRows.length} bids recorded in all`);
  info(`seasons ${seasonsSeen.join(", ")}: ${scoutRows.length} AI scouting reports, ${bidRows.length} AI bids (${seniorDeals.length} senior, ${bidRows.length - seniorDeals.length} youth buy offers), ${signings.length} signings from the market`);
} catch (err) {
  W.fail(err);
} finally {
  await W.stop();
  W.finish();
}
