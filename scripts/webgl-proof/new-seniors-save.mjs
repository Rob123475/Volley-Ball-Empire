/**
 * 1.1.2 (Rob, 21 Oct): a throwaway save that has reached its first season's turn, so the new seniors
 * (Rob's FIXED pictures, as installed) are on the free-agent market. For the packaged-game screenshots
 * (new-seniors-shots.mjs): a new career on a copy of the starter database, played day by day to the turn
 * by the built server (non-production, as the suites run it), then the save is copied out.
 *
 * Never touches Rob's save. Uses the installed picture list (no VBE_NEW_SENIOR_PICTURES override).
 *
 * Usage: node scripts/webgl-proof/new-seniors-save.mjs <outDir>
 *   writes <outDir>/volleyball-empire.sqlite and <outDir>/new-seniors.json
 */
import fs from "node:fs";
import path from "node:path";
import { createWorld } from "../../harness/night2-world.mjs";
import { turnDownBids, healAllSquads } from "../../harness/harness-club.mjs";

const outDir = path.resolve(process.argv[2]);
fs.mkdirSync(outDir, { recursive: true });
const W = createWorld("new-seniors-save", 4964);
try {
  await W.boot();
  const { profileId, cid } = await W.newCareer("Picture Check");
  let rolled = null;
  for (let d = 0; d < 420 && !rolled; d++) {
    turnDownBids(W.db);
    if (d % 7 === 0) healAllSquads(W.db);
    const r = await W.day();
    if (r.data?.seasonRollover?.kind === "rolled") rolled = r.data.seasonRollover;
  }
  if (!rolled) throw new Error("the season never turned");
  const arrived = W.q(`SELECT n.kind, n.nation, n.picture, n.image_url url, p.id, p.name, p.nationality, s.team_id t, s.age
    FROM career_new_seniors n JOIN players p ON p.id = n.player_id
    LEFT JOIN career_player_state s ON s.player_id = n.player_id AND s.career_save_id = n.career_save_id
    WHERE n.career_save_id = ? ORDER BY n.kind, n.nation`, cid);
  await W.stop();
  for (const ext of ["", "-wal", "-shm"]) {
    if (fs.existsSync(W.db + ext)) fs.copyFileSync(W.db + ext, path.join(outDir, `volleyball-empire.sqlite${ext}`));
  }
  fs.writeFileSync(path.join(outDir, "new-seniors.json"), JSON.stringify({ profileId, cid, rolled, arrived }, null, 1));
  console.log(JSON.stringify({ profileId, cid, rolled, pictures: arrived.filter((a) => a.kind === "picture"),
    youths: arrived.filter((a) => a.kind === "youth").map((a) => `${a.name} (${a.nation}, ${a.picture})`) }, null, 1));
  try { fs.rmSync(W.work, { recursive: true, force: true }); } catch { /* tmp */ }
} catch (err) {
  console.error(err?.stack ?? err);
  await W.stop();
  process.exit(1);
}
