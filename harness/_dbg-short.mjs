// Scratch: play a season (as ai-buyable section 6 does) and report each day an AI club holds fewer than two seniors.
import { createWorld } from "./night2-world.mjs";
import { healAllSquads, keepSideFielded, renewExpiringContracts } from "./harness-club.mjs";
const W = createWorld("dbg-short", 4987);
try {
  await W.boot();
  const { cid } = await W.newCareer("Dbg");
  const seniors = () => W.q(`SELECT cps.pool_team_id AS c, cps.player_id AS id, cps.contract_end_date e, cps.on_injured_list l, cps.is_injured i FROM career_player_state cps JOIN players p ON p.id = cps.player_id
      WHERE cps.career_save_id = ? AND cps.pool_team_id IS NOT NULL AND cps.team_id IS NULL AND cps.is_retired = 0 AND (p.player_type = 'senior' OR cps.is_promoted = 1)`, cid);
  let prev = new Map(), reported = 0;
  for (let i = 0; i < 380 && reported < 4; i++) {
    healAllSquads(W.db);
    if (i % 7 === 0) { await keepSideFielded(W.api); await renewExpiringContracts(W.api); }
    const r = await W.day();
    const d = (await W.api("GET", "/calendar")).data.currentDate;
    const now = seniors(); const by = new Map();
    for (const s of now) by.set(s.c, [...(by.get(s.c) ?? []), s]);
    for (const [c, l] of prev) {
      const n = (by.get(c) ?? []).length;
      if (n < 2) {
        reported++;
        const gone = l.filter((s) => !(by.get(c) ?? []).some((x) => x.id === s.id));
        const where = gone.map((g) => ({ ...g, now: W.q(`SELECT team_id t, pool_team_id p, is_retired r, contract_end_date e FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, g.id)[0],
          deals: W.q(`SELECT id, status, from_pool_team_id f, to_pool_team_id t, to_team_id tt, agreed_on a, arrives_on ar, moved_on m FROM transfer_deals WHERE career_save_id = ? AND player_id = ?`, cid, g.id) }));
        console.log(`${d}: club ${c} has ${n} (had ${l.length}); left: ${JSON.stringify(where)}`);
        console.log(`   club's deals: ${JSON.stringify(W.q(`SELECT id, player_id, status, from_pool_team_id f, to_pool_team_id t, arrives_on ar FROM transfer_deals WHERE career_save_id = ? AND (from_pool_team_id = ? OR to_pool_team_id = ?) AND status IN ('agreed','offered')`, cid, c, c))}`);
        console.log(`   youths: ${W.q(`SELECT COUNT(*) n FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.career_save_id = ? AND s.pool_team_id = ? AND p.player_type = 'youth' AND s.is_promoted = 0`, cid, c)[0].n}, balance ${W.q(`SELECT balance b FROM career_pool_team_state WHERE career_save_id = ? AND pool_team_id = ?`, cid, c)[0].b}`);
      }
    }
    prev = by;
    if (r.data?.seasonRollover && r.data.seasonRollover.kind !== "none") { console.log("rolled", d); break; }
  }
  console.log("done, reported", reported);
} catch (e) { console.log(e); } finally { await W.stop(); }
process.exit(0);
