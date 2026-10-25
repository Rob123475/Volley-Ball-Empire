/**
 * 1.1.3 market brief (Part C.4): the throwaway saves the packaged-game proof opens (market-1.1.3-shots.mjs).
 *
 * One career played on the built server (artifacts/api-server/dist) from Day 1, kept at three moments
 * (each a copy, the server stopped for it):
 *
 *   C  season 2's first match (squad policy brief, 26 Oct) item C: two of the 24 retoned on 26 Oct planted as his
 *                             pair (see below): the court draws them
 *   M  mid-season (15 June)   the Job Market reached mid-season (item 5): the Career page's tab, and the
 *                             page on its own with its Back link; a repointed pool player's card (item 2);
 *                             (26 Oct, item B) Malta's two and their cards
 *   N  2 January, season 2    the AI clubs' market seen by the player (item 1): Club News's items for the
 *                             days the AI clubs signed from the free agents in the window
 *
 * His own side is kept fielded and fit, and his board kept from sacking him, so the season runs.
 *
 * Usage: node scripts/webgl-proof/market-1.1.3-save.mjs <outDir>
 *   writes <outDir>/C|M|N/volleyball-empire.sqlite and <outDir>/market-1.1.3.json
 */
import fs from "node:fs";
import path from "node:path";
import { createWorld } from "../../harness/night2-world.mjs";
import { keepSideFielded, renewExpiringContracts, healSquadByTeam } from "../../harness/harness-club.mjs";

const outDir = path.resolve(process.argv[2]);
fs.mkdirSync(outDir, { recursive: true });
const W = createWorld("market-1.1.3-save", 4962);
const info = { saves: {} };
try {
  await W.boot();
  const { profileId, teamId, cid } = await W.newCareer("Rob Proof");
  Object.assign(info, { profileId, teamId, careerSaveId: cid });
  const myTeam = () => W.q(`SELECT team_id t FROM career_saves WHERE id = ?`, cid)[0]?.t ?? teamId;
  const today = () => W.q(`SELECT "current_date" AS d FROM calendar_state WHERE team_id = ?`, myTeam())[0]?.d ?? "";
  const keep = async (name) => {
    await W.stop();
    const dir = path.join(outDir, name);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f));
    fs.copyFileSync(W.db, path.join(dir, "volleyball-empire.sqlite"));
    info.saves[name] = { date: today(), dir };
    console.error(JSON.stringify({ kept: name, date: today() }));
    await W.boot();
    await W.select(profileId);
  };
  const playTo = async (until) => {
    for (let i = 0; i < 800 && today() < until; i++) {
      healSquadByTeam(W.db, myTeam());
      if (i % 7 === 0) { await keepSideFielded(W.api); await renewExpiringContracts(W.api); }
      W.w(`UPDATE board_seasons SET grade = 'met' WHERE career_save_id = ? AND grade = 'failed'`, cid);
      const r = await W.day();
      if (r.status >= 400) throw new Error(`advance HTTP ${r.status} on ${today()}: ${JSON.stringify(r.data).slice(0, 200)}`);
    }
  };
  // (26 Oct) the career's first season: before the first day the calendar has no date yet, which made this 0 (the
  // script had never run: the 25 Oct brief stopped before its packaged proof).
  const year = Number(W.q(`SELECT MIN(year) y FROM seasons WHERE career_save_id = ?`, cid)[0]?.y);
  if (!(year > 2000)) throw new Error(`no first season for career ${cid}`);
  W.w(`UPDATE teams SET budget = 2000000 WHERE id = ?`, teamId);

  const cards = new Map(JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../portraits/ai-senior-cards.json"), "utf8")).players.map((c) => [c.stableId, c]));

  await playTo(`${year}-06-15`);
  // A repointed pool player still at her AI club (her card: a new-senior picture of her nation).
  info.repointed = W.q(`SELECT p.name, p.image_url img, cp.stable_id sid, s.pool_team_id club, t.team_name clubName FROM career_player_state s
    JOIN players p ON p.id = s.player_id JOIN continental_pool_players cp ON cp.id = s.pool_player_id
    JOIN continental_pool_teams t ON t.id = s.pool_team_id
    WHERE s.career_save_id = ? AND s.team_id IS NULL AND p.image_url LIKE '/images/players/new-seniors/%' AND s.is_retired = 0 ORDER BY cp.stable_id`, cid);
  // 26 Oct (item B): Malta's two, wherever they are (her card: one of Rob's Malta pictures).
  info.malta = W.q(`SELECT p.name, p.image_url img, cp.stable_id sid, s.pool_team_id club, s.team_id myClub FROM career_player_state s
    JOIN players p ON p.id = s.player_id JOIN continental_pool_players cp ON cp.id = s.pool_player_id
    WHERE s.career_save_id = ? AND cp.stable_id IN ('EUR_10_P1', 'EUR_10_P2') AND s.is_retired = 0 ORDER BY cp.stable_id`, cid);
  await keep("M");

  await playTo(`${year + 1}-01-02`);
  info.marketDays = W.q(`SELECT on_date d, COUNT(*) n FROM ai_market_moves WHERE career_save_id = ? AND kind IN ('sign', 'promote') AND season_year = ? GROUP BY on_date ORDER BY on_date`, cid, year);
  await keep("N");

  // C (1.1.3 squad policy brief, 26 Oct, Part C.4): two of the 24 retoned on 26 Oct, on the court. His club never meets
  // the 12 clubs whose pair they are (a whole season of this career: 118 matches, none against them), and a bid for one
  // can be kept by her club's counter-offer (it kept AUS_09_P1 on a try). So this throwaway save plants them as his pair
  // on 2 January, as the suites plant their clubs: two of the 24 whose tone changed, each still at an AI club that holds
  // three (so it keeps two), from different clubs, the furthest moved first. Each keeps her pool player (pool_player_id),
  // which is how the court finds a player from an AI club's tone; his own starters go to the bench.
  const BANDS = ["Light", "Medium Light", "Medium", "Medium Dark", "Dark"];
  const moved = [...cards.values()].filter((c) => c.kind === "repointed" && c.skinToneBefore26Oct !== c.skinTone)
    .sort((x, y) => Math.abs(BANDS.indexOf(y.skinTone) - BANDS.indexOf(y.skinToneBefore26Oct)) - Math.abs(BANDS.indexOf(x.skinTone) - BANDS.indexOf(x.skinToneBefore26Oct)));
  const plant = [];
  for (const c of moved) {
    if (plant.length === 2) break;
    const her = W.q(`SELECT s.player_id id, s.pool_team_id club, p.name FROM career_player_state s JOIN players p ON p.id = s.player_id
      JOIN continental_pool_players cp ON cp.id = s.pool_player_id
      WHERE s.career_save_id = ? AND cp.stable_id = ? AND s.team_id IS NULL AND s.pool_team_id IS NOT NULL AND s.is_retired = 0 AND s.on_injured_list = 0`, cid, c.stableId)[0];
    if (!her || plant.some((x) => x.club === her.club)) continue;
    const holding = W.q(`SELECT COUNT(*) n FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.career_save_id = ? AND s.pool_team_id = ?
      AND s.team_id IS NULL AND s.is_retired = 0 AND s.on_injured_list = 0 AND (p.player_type = 'senior' OR s.is_promoted = 1)`, cid, her.club)[0].n;
    if (holding < 3) continue;
    plant.push({ ...her, sid: c.stableId, card: c.card, band: c.skinTone, before: c.skinToneBefore26Oct });
  }
  for (const p of (await W.api("GET", "/players")).data) if (p.squadRole === "starter") await W.api("PATCH", `/team/roster/${p.id}/role`, { role: "interchange" });
  for (const p of plant) W.w(`UPDATE career_player_state SET team_id = ?, pool_team_id = NULL, squad_role = 'starter', is_active = 1, contract_end_date = ?
    WHERE career_save_id = ? AND player_id = ?`, myTeam(), `${year + 1}-12-31`, cid, p.id);
  const nm = await W.api("POST", "/calendar/next-match");
  const matchId = nm.data?.matchDay?.matchId ?? null;
  const ms = matchId ? (await W.api("GET", `/unity/match-state?careerSaveId=${cid}&matchId=${matchId}`)).data : null;
  const mine = W.q(`SELECT name n FROM teams WHERE id = ?`, myTeam())[0]?.n;
  info.court = { planted: plant, date: today(), matchId, myClub: mine,
    hisSide: (ms?.players ?? []).filter((p) => p.team === mine).map((p) => ({ name: p.name, skinTone: p.skinTone })) };
  if (matchId != null && plant.length === 2 && plant.every((p) => info.court.hisSide.some((h) => h.name === p.name && h.skinTone === p.band))) await keep("C");
} catch (err) {
  info.error = String(err?.stack ?? err);
  W.fail(err);
} finally {
  await W.stop();
  fs.writeFileSync(path.join(outDir, "market-1.1.3.json"), JSON.stringify(info, null, 2));
  console.log(JSON.stringify(info, null, 1));
  W.finish();
}
