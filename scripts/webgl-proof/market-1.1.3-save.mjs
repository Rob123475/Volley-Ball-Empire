/**
 * 1.1.3 market brief (Part C.4): the throwaway saves the packaged-game proof opens (market-1.1.3-shots.mjs).
 *
 * One career played on the built server (artifacts/api-server/dist) from Day 1, kept at two moments
 * (each a copy, the server stopped for it):
 *
 *   M  mid-season (15 June)   the Job Market reached mid-season (item 5): the Career page's tab, and the
 *                             page on its own with its Back link; a repointed pool player's card (item 2)
 *   N  2 January, season 2    the AI clubs' market seen by the player (item 1): Club News's items for the
 *                             days the AI clubs signed from the free agents in the window
 *
 * His own side is kept fielded and fit, and his board kept from sacking him, so the season runs.
 *
 * Usage: node scripts/webgl-proof/market-1.1.3-save.mjs <outDir>
 *   writes <outDir>/M|N/volleyball-empire.sqlite and <outDir>/market-1.1.3.json
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
  const year = Number(today().slice(0, 4));
  W.w(`UPDATE teams SET budget = 2000000 WHERE id = ?`, teamId);

  await playTo(`${year}-06-15`);
  // A repointed pool player still at her AI club (her card: a new-senior picture of her nation).
  info.repointed = W.q(`SELECT p.name, p.image_url img, cp.stable_id sid, s.pool_team_id club, t.team_name clubName FROM career_player_state s
    JOIN players p ON p.id = s.player_id JOIN continental_pool_players cp ON cp.id = s.pool_player_id
    JOIN continental_pool_teams t ON t.id = s.pool_team_id
    WHERE s.career_save_id = ? AND s.team_id IS NULL AND p.image_url LIKE '/images/players/new-seniors/%' AND s.is_retired = 0 ORDER BY cp.stable_id`, cid);
  await keep("M");

  await playTo(`${year + 1}-01-02`);
  info.marketDays = W.q(`SELECT on_date d, COUNT(*) n FROM ai_market_moves WHERE career_save_id = ? AND kind IN ('sign', 'promote') AND season_year = ? GROUP BY on_date ORDER BY on_date`, cid, year);
  await keep("N");
} catch (err) {
  info.error = String(err?.stack ?? err);
  W.fail(err);
} finally {
  await W.stop();
  fs.writeFileSync(path.join(outDir, "market-1.1.3.json"), JSON.stringify(info, null, 2));
  console.log(JSON.stringify(info, null, 1));
  W.finish();
}
