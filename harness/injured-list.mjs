/**
 * Update 1, night 2 (O-10): the injured list, cover, and promotion at 16.
 *
 *   1. more than 6 weeks out puts her on the list at once (her match place
 *      freed: role "injured", not active); 6 weeks or less does not
 *   2. on the list she doesn't take a senior place: the club can sign cover
 *      with three seniors on the books; her wage still counts toward the cap
 *   3. the cover rule: fit again while the cover is still there, she can't play
 *      ("Fit, waiting for a place"); release the cover and she is back at once
 *   4. with no cover taken on, she is back in the squad as soon as she is fit
 *   5. promotion at 16: a 16-year-old academy player can be promoted into a
 *      match place, a 15-year-old can't
 *   6. an AI club: the same list; it covers the place, and releases its weakest
 *      when she is fit
 */
import fs from "node:fs";
import path from "node:path";
import { createWorld, REPO } from "./night2-world.mjs";

const W = createWorld("injured-list", 4976);
const { check, info } = W;
console.log("=".repeat(72));
console.log("  UPDATE 1, NIGHT 2 PART 6: THE INJURED LIST, COVER, AND PROMOTION AT 16");
console.log("=".repeat(72));

try {
  await W.boot();
  const { teamId, cid } = await W.newCareer("Injured List");
  W.w(`UPDATE teams SET budget = 5000000 WHERE id = ?`, teamId);
  const st = (id) => W.q(`SELECT injury_status s, injury_weeks_remaining w, on_injured_list l, squad_role r, is_active a, injured_list_squad sq FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, id)[0];
  const heal = (id) => W.w(`UPDATE career_player_state SET injury_status = 'Healthy', injury_weeks_remaining = 0, injury_base_weeks_left = 0, injury_area = NULL, is_injured = 0 WHERE career_save_id = ? AND player_id = ?`, cid, id);
  const seniors = () => W.q(`SELECT s.player_id id, s.squad_role r, s.salary FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.team_id = ? AND s.is_retired = 0 AND (p.player_type = 'senior' OR s.is_promoted = 1) ORDER BY s.player_id`, cid, teamId);
  info(`the club's seniors after the draft: ${seniors().length}`);
  // Three seniors on the books before anyone is hurt (so nobody signed now counts as cover).
  while (seniors().length < 3) {
    const fa = W.q(`SELECT s.player_id id, s.salary FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.career_save_id = ? AND s.team_id IS NULL AND s.pool_team_id IS NULL
      AND p.player_type = 'senior' AND s.is_retired = 0 AND s.injury_status = 'Healthy' ORDER BY s.salary LIMIT 1`, cid)[0];
    await W.api("POST", "/contracts", { playerId: fa.id, salary: fa.salary, bonusPerWin: 0, squadRole: "interchange", length: "1s", confirm: true });
  }

  // ── 1. On the list ─────────────────────────────────────────────────────────
  console.log("\n1. MORE THAN 6 WEEKS OUT PUTS HER ON THE LIST AT ONCE");
  const [a, b] = seniors().map((s) => s.id);
  const sprain = (await W.api("POST", "/dev/injuries/start", { playerId: b, injury: "Sprained ankle" })).data;
  check("6 weeks out (a sprained ankle, no medical staff) is not more than 6: she stays in her place", sprain.weeks === 6 && st(b).l === 0 && st(b).r !== "injured", `${sprain.weeks} wk, role ${st(b).r}`);
  heal(b);
  const leg = (await W.api("POST", "/dev/injuries/start", { playerId: a, injury: "Broken leg" })).data;
  check("a broken leg (40 weeks): on the injured list at once, her match place freed", leg.onInjuredList === true && st(a).l === 1 && st(a).r === "injured" && st(a).a === 0, `role ${st(a).r}, active ${st(a).a}`);
  const roster = (await W.api("GET", "/team/roster")).data;
  check("the Team page lists her under the injured list", (roster.injuredList ?? []).some((p) => p.id === a) && !(roster.starters ?? []).some((p) => p.id === a));

  // ── 2. Her place is free; her wage still counts ───────────────────────────
  console.log("\n2. HER PLACE IS FREE FOR COVER; HER WAGE STILL COUNTS TOWARD THE CAP");
  const before = seniors().map((s) => s.id);
  const cover = W.q(`SELECT s.player_id id, s.salary FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.career_save_id = ? AND s.team_id IS NULL AND s.pool_team_id IS NULL
    AND p.player_type = 'senior' AND s.is_retired = 0 AND s.injury_status = 'Healthy' ORDER BY s.salary LIMIT 1`, cid)[0];
  const signed = await W.api("POST", "/contracts", { playerId: cover.id, salary: cover.salary, bonusPerWin: 0, squadRole: "interchange", length: "1s", confirm: true });
  check("with three seniors on the books, one of them on the list, a fourth (cover) can be signed", signed.status < 300 && seniors().length === 4,
    `${signed.status}${signed.status >= 300 ? " " + JSON.stringify(signed.data) : ""}; seniors ${before.length} -> ${seniors().length}`);
  const capSrc = fs.readFileSync(path.join(REPO, "artifacts", "api-server", "src", "utils", "salaryCap.ts"), "utf8");
  check("(source) the cap's senior wage bill counts every senior, the injured list included", !/onInjuredList|on_injured_list/.test(capSrc) && /export function seniorWageBillTx/.test(capSrc));

  // ── 3. The cover rule ─────────────────────────────────────────────────────
  console.log("\n3. THE COVER RULE");
  heal(a);
  await W.day();
  check("fit again while the cover is still on the roster: still on the list, not active (\"Fit, waiting for a place\")", st(a).l === 1 && st(a).a === 0 && st(a).s === "Healthy");
  const dash = (await W.api("GET", "/dashboard")).data;
  const waitingLine = (dash?.nextMatchSelection?.unavailable ?? []).find((p) => p.id === a);
  check("the Dashboard says so plainly", !dash?.nextMatchSelection || waitingLine?.waiting === true, JSON.stringify(waitingLine ?? null));
  const blocked = await W.api("PATCH", `/team/roster/${a}/role`, { role: "starter" });
  check("her role can't be changed while she waits", blocked.status === 422 && /injured list/.test(blocked.data?.error ?? ""), blocked.data?.error);
  const rel = await W.api("POST", `/players/${cover.id}/release`, {});
  check("release the cover: she is back in the squad at once (a match place, active)", rel.status < 300 && st(a).l === 0 && st(a).a === 1 && ["starter", "interchange"].includes(st(a).r),
    `release ${rel.status}; role ${st(a).r}, active ${st(a).a}`);

  // ── 4. No cover ────────────────────────────────────────────────────────────
  console.log("\n4. WITH NO COVER TAKEN ON, SHE IS BACK AS SOON AS SHE IS FIT");
  const c = seniors().map((s) => s.id).find((id) => id !== a);
  await W.api("POST", "/dev/injuries/start", { playerId: c, injury: "Torn shoulder" });
  check("a torn shoulder (20 weeks with no staff) puts her on the list", st(c).l === 1);
  heal(c);
  await W.day();
  check("fit, with nobody taken on in her absence: back in the squad the next game day", st(c).l === 0 && st(c).a === 1, `role ${st(c).r}`);

  // ── 5. Promotion at 16 ────────────────────────────────────────────────────
  console.log("\n5. PROMOTION AT 16");
  // A new club's academy is empty until the season's intake: two free youths join it here.
  for (const y of W.q(`SELECT s.player_id id FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.career_save_id = ? AND s.team_id IS NULL AND s.pool_team_id IS NULL
    AND p.player_type = 'youth' AND s.is_promoted = 0 AND s.is_retired = 0 ORDER BY s.player_id LIMIT 2`, cid))
    W.w(`UPDATE career_player_state SET team_id = ?, squad_role = 'reserve', academy_contract_years = 2, is_active = 0 WHERE career_save_id = ? AND player_id = ?`, teamId, cid, y.id);
  const youths = W.q(`SELECT s.player_id id FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.career_save_id = ? AND s.team_id = ? AND p.player_type = 'youth' AND s.is_promoted = 0 ORDER BY s.player_id`, cid, teamId);
  if (youths.length >= 2) {
    W.w(`UPDATE career_player_state SET age = 16 WHERE career_save_id = ? AND player_id = ?`, cid, youths[0].id);
    W.w(`UPDATE career_player_state SET age = 15 WHERE career_save_id = ? AND player_id = ?`, cid, youths[1].id);
    const young = await W.api("PATCH", `/team/roster/${youths[1].id}/role`, { role: "interchange" });
    check("a 15-year-old can't be promoted into a match place", young.status === 422 && /under 16/.test(young.data?.error ?? ""), young.data?.error);
    const sixteen = await W.api("PATCH", `/team/roster/${youths[0].id}/role`, { role: "interchange" });
    check("a 16-year-old can (it was 18)", sixteen.status < 300 && W.q(`SELECT is_promoted p FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, youths[0].id)[0].p === 1,
      `${sixteen.status} ${sixteen.status >= 300 ? JSON.stringify(sixteen.data) : ""}`);
  } else check("the club has two academy youths to try promotion with", false, `${youths.length}`);
  const rules = fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", "pages", "rules.tsx"), "utf8");
  check("(source) the Rules page and the Team page read the promotion age from the one constant (16)",
    /PROMOTION_MIN_AGE/.test(rules) && /PROMOTION_MIN_AGE/.test(fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", "pages", "team.tsx"), "utf8"))
      && /export const PROMOTION_MIN_AGE = 16;/.test(fs.readFileSync(path.join(REPO, "lib", "db", "src", "schema", "injuries.ts"), "utf8")));

  // ── 6. An AI club ─────────────────────────────────────────────────────────
  console.log("\n6. AN AI CLUB: THE SAME LIST, COVER, AND ITS WEAKEST RELEASED");
  const aiSeniors = (club) => W.q(`SELECT s.player_id id, s.on_injured_list l FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.team_id IS NULL AND s.pool_team_id = ? AND s.is_retired = 0 AND (p.player_type = 'senior' OR s.is_promoted = 1)`, cid, club);
  const club = W.q(`SELECT s.pool_team_id c FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.career_save_id = ? AND s.team_id IS NULL AND s.pool_team_id IS NOT NULL
    AND s.is_retired = 0 AND (p.player_type = 'senior' OR s.is_promoted = 1) AND s.injury_status = 'Healthy' GROUP BY s.pool_team_id HAVING COUNT(*) = 3 LIMIT 1`, cid)[0]?.c;
  if (club == null) check("an AI club with three seniors", false);
  else {
    const victim = aiSeniors(club)[0].id;
    // Its academy (empty on Day 1, filled by the intake) gets a 17-year-old: the cover comes from there
    // first, and a promoted youth is never blocked by the cap (C-5), where a free agent may be (her wage still counts).
    const academyYouth = W.q(`SELECT s.player_id id FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.career_save_id = ? AND s.team_id IS NULL AND s.pool_team_id IS NULL
      AND p.player_type = 'youth' AND s.is_promoted = 0 AND s.is_retired = 0 ORDER BY s.player_id DESC LIMIT 1`, cid)[0].id;
    W.w(`UPDATE career_player_state SET pool_team_id = ?, age = 17 WHERE career_save_id = ? AND player_id = ?`, club, cid, academyYouth);
    await W.api("POST", "/dev/injuries/start", { playerId: victim, injury: "Broken leg" });
    check("an AI club's senior out more than 6 weeks goes on its injured list", W.q(`SELECT on_injured_list l FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, victim)[0].l === 1);
    await W.day();
    const covered = aiSeniors(club).filter((s) => !s.l).length;
    check("the next game day it has covered her place from its academy (three seniors not on the list, the 17-year-old promoted)",
      covered === 3 && W.q(`SELECT is_promoted p FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, academyYouth)[0].p === 1, `${covered} not on the list`);
    heal(victim);
    await W.day();
    const after = aiSeniors(club);
    check("fit again: she comes off the list and the club released its weakest to make room (three seniors)",
      after.every((s) => !s.l) && after.length === 3 && after.some((s) => s.id === victim), `${after.length} seniors, listed ${after.filter((s) => s.l).length}`);
  }
} catch (err) {
  W.fail(err);
} finally {
  await W.stop();
}
W.finish();
