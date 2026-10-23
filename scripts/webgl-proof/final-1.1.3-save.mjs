/**
 * 1.1.3 (brief Part C.4): the throwaway saves the packaged-game proof opens (final-1.1.3-shots.mjs).
 *
 * One career played on the built server (artifacts/api-server/dist) from Day 1 to December 2028,
 * kept at three moments (each a checkpointed copy, the server stopped for it):
 *
 *   A  2028-05-25  national coach offers waiting (the Career page, the job market, the Dashboard notice)
 *   B  2028-11-24  the Nations Cup's group day: he coaches a nation in the Cup (set for the proof: a
 *                  top-8 qualifier, as the offers come from the weak end), its pair picked on the
 *                  National Team page with the training camp; today's 12 matches watchable
 *   C  2028-12-04  the Cup and the World Finals decided (the final is played on 3 Dec): both medal ceremonies waiting
 *
 * Usage: node scripts/webgl-proof/final-1.1.3-save.mjs <outDir>
 *   writes <outDir>/A|B|C/volleyball-empire.sqlite and <outDir>/final-1.1.3.json
 */
import fs from "node:fs";
import path from "node:path";
import { createWorld } from "../../harness/night2-world.mjs";
import { keepSideFielded, renewExpiringContracts, healSquadByTeam, turnDownBids } from "../../harness/harness-club.mjs";

const outDir = path.resolve(process.argv[2]);
fs.mkdirSync(outDir, { recursive: true });
const W = createWorld("final-1.1.3-save", 4994);
const info = { saves: {} };
try {
  await W.boot();
  const { profileId, teamId, cid } = await W.newCareer("Rob Proof");
  Object.assign(info, { profileId, teamId, careerSaveId: cid });
  const today = () => W.q(`SELECT "current_date" AS d FROM calendar_state WHERE team_id = ?`, teamId)[0]?.d ?? "";
  let guard = 0;
  const playTo = async (date) => {
    while (today() < date && guard++ < 1500) {
      healSquadByTeam(W.db, teamId);
      turnDownBids(W.db, teamId);
      if (guard % 7 === 1) { await keepSideFielded(W.api); await renewExpiringContracts(W.api); }
      const r = await W.day();
      if (r.status >= 400) throw new Error(`advance ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
      if (r.data?.seasonRollover && r.data.seasonRollover.kind !== "none") W.w(`UPDATE board_seasons SET grade = 'met' WHERE career_save_id = ? AND grade = 'failed'`, cid);
    }
  };
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

  await playTo("2028-05-25");
  info.offers = W.q(`SELECT nation, monthly, strength_rank r, ranked n FROM national_coach_offers WHERE career_save_id = ? AND status = 'open'`, cid);
  await keep("A");

  // Accept the first offer for 3 years, then (proof set-up) coach the top qualifier, so his nation plays the Cup.
  const offer = W.q(`SELECT id FROM national_coach_offers WHERE career_save_id = ? AND status = 'open' ORDER BY strength_rank LIMIT 1`, cid)[0];
  info.accepted = (await W.api("POST", `/national-coach/offers/${offer.id}/accept`, { years: 3 })).data?.job;
  await playTo("2028-11-10");
  // As harness/nations-cup.mjs does: a qualifying top-8 nation with 4 fit players or more.
  let top = null;
  for (const c of ((await W.api("GET", "/olympics/qualifiers")).data?.countries ?? []).slice(0, 8)) {
    W.w(`UPDATE national_coach_jobs SET nation = ? WHERE career_save_id = ? AND status = 'active'`, c.country, cid);
    if (((await W.api("GET", "/national-team")).data?.players ?? []).filter((p) => !p.injured).length >= 4) { top = c.country; break; }
  }
  if (!top) throw new Error("no qualifying top-8 nation with 4 fit players");
  const page = (await W.api("GET", "/national-team")).data;
  const fit = page.players.filter((p) => !p.injured);
  info.coached = top;
  info.picked = (await W.api("POST", "/national-team/pair", { pair: fit.slice(0, 2).map((p) => ({ kind: p.kind, id: p.id })) })).status;
  info.camp = (await W.api("POST", "/national-team/camp", { camp: "training" })).status;
  await playTo("2028-11-24");
  info.cupToday = W.q(`SELECT id, home_nation h, away_nation a FROM nations_cup_fixtures WHERE career_save_id = ? AND scheduled_on = ?`, cid, today());
  info.yourMatch = info.cupToday.find((f) => f.h === top || f.a === top) ?? null;
  await keep("B");

  await playTo("2028-12-04");
  info.ceremonies = W.q(`SELECT event, season_year y, ready_on r, seen_on s FROM career_ceremonies WHERE career_save_id = ?`, cid);
  await keep("C");
} catch (err) {
  info.error = String(err?.stack ?? err);
  W.fail(err);
} finally {
  await W.stop();
  fs.writeFileSync(path.join(outDir, "final-1.1.3.json"), JSON.stringify(info, null, 2));
  console.log(JSON.stringify(info, null, 1));
  W.finish();
}
