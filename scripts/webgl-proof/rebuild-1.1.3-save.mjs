/**
 * 1.1.3 rebuild (brief Part E.4): the throwaway saves the packaged-game proof opens (rebuild-1.1.3-shots.mjs).
 *
 * One career played on the built server (artifacts/api-server/dist) from Day 1, kept at two moments
 * (each a copy, the server stopped for it):
 *
 *   D  Day 2 (2 January)  before the AI clubs' 8 January staff deal: Rob's new head coaches, assistant
 *                         coaches and scouts on the Staff Market; free agents to offer a contract to
 *                         (his club: 6 months, 1 season, 2 seasons); youths on the youth card
 *   E  an AI club's bid   his star (stats set to 99 for the proof, as harness/counter-offer.mjs does)
 *                         drew a bid from an AI club: its offer is 1 or 2 seasons, never 6 months
 *
 * Usage: node scripts/webgl-proof/rebuild-1.1.3-save.mjs <outDir>
 *   writes <outDir>/D|E/volleyball-empire.sqlite and <outDir>/rebuild-1.1.3.json
 */
import fs from "node:fs";
import path from "node:path";
import { createWorld } from "../../harness/night2-world.mjs";
import { makeCapRoom } from "../../harness/harness-club.mjs";

const outDir = path.resolve(process.argv[2]);
fs.mkdirSync(outDir, { recursive: true });
const W = createWorld("rebuild-1.1.3-save", 4970);
const info = { saves: {} };
try {
  await W.boot();
  const { profileId, teamId, cid } = await W.newCareer("Rob Proof");
  Object.assign(info, { profileId, teamId, careerSaveId: cid });
  const today = () => W.q(`SELECT "current_date" AS d FROM calendar_state WHERE team_id = ?`, teamId)[0]?.d ?? "";
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

  await W.day();
  W.w(`UPDATE teams SET budget = 2000000 WHERE id = ?`, teamId);
  info.newFacesOnMarket = W.q(`SELECT st.role, COUNT(*) n FROM career_staff_state s JOIN staff st ON st.id = s.staff_id
    WHERE s.career_save_id = ? AND s.team_id IS NULL AND s.pool_team_id IS NULL AND st.id >= 10210 GROUP BY st.role`, cid);
  await keep("D");

  // E: his star draws an AI club's bid.
  makeCapRoom(W.db, teamId, 1000);
  const star = W.q(`SELECT s.player_id id FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.team_id = ? AND p.player_type = 'senior' ORDER BY s.player_id LIMIT 1`, cid, teamId)[0].id;
  W.w(`UPDATE career_player_state SET speed = 99, power = 99, defense = 99, serve = 99, block = 99 WHERE career_save_id = ? AND player_id = ?`, cid, star);
  W.w(`UPDATE contracts SET start_date = '2025-01-01' WHERE player_id = ? AND team_id = ? AND status = 'active'`, star, teamId);
  let bid = null;
  for (let i = 0; i < 60 && !bid; i++) {
    await W.day();
    bid = W.q(`SELECT id, to_pool_team_id club, wage, length, offered_on FROM transfer_deals WHERE career_save_id = ? AND player_id = ? AND status = 'offered'`, cid, star)[0] ?? null;
  }
  if (!bid) throw new Error("no AI club bid for his star in 60 days");
  info.bid = { ...bid, star };
  await keep("E");
} catch (err) {
  info.error = String(err?.stack ?? err);
  W.fail(err);
} finally {
  await W.stop();
  fs.writeFileSync(path.join(outDir, "rebuild-1.1.3.json"), JSON.stringify(info, null, 2));
  console.log(JSON.stringify(info, null, 1));
  W.finish();
}
