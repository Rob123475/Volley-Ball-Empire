/**
 * Update 1, night 2 (O-6, O-9): every staff role does its own job, and the pairs.
 *
 *   1. (source) one constants block with Rob's numbers; every bonus on the
 *      "skill above 50, full at 95" scale; the old healer system gone
 *   2. the player's club: each role hired, its real effect (GET /staff/effects,
 *      the game's own functions) at its skill; the pairs, and a member who isn't
 *      the best of her role giving nothing
 *   3. the massage therapist, measured: every player loses 5 tiredness a day
 *      resting, and her skill's share of 5 more with her
 *   4. an AI club: its injury treated by its own medical staff (the player's
 *      rule), and its training, injury risk and treatment through the same functions
 */
import fs from "node:fs";
import path from "node:path";
import { createWorld, REPO } from "./night2-world.mjs";

const W = createWorld("staff-roles", 4974);
const { check, info } = W;
const SRC = (p) => fs.readFileSync(path.join(REPO, "artifacts", "api-server", "src", p), "utf8");
const scale = (skill) => Math.min(1, Math.max(0, (skill - 50) / 45));
const pct = (x) => `${Math.round(x * 100)}%`;
console.log("=".repeat(72));
console.log("  UPDATE 1, NIGHT 2 PARTS 2 AND 5: EVERY STAFF ROLE'S OWN JOB, AND THE PAIRS");
console.log("=".repeat(72));

try {
  // ── 1. Source ──────────────────────────────────────────────────────────────
  console.log("\n1. ONE CONSTANTS BLOCK, AND THE OLD HEALER GONE");
  const sb = SRC("utils/staffBonuses.ts");
  check("(source) STAFF_EFFECTS holds Rob's numbers: +15% / +8% XP, -5 tiredness, +18% sponsors, +10% power and block, +10% stamina, 5 a day, -15% risk; the pairs 0.8 and +5%",
    /headCoachXp: 0\.15/.test(sb) && /assistantCoachXp: 0\.08/.test(sb) && /fitnessTrainerFatigue: 5/.test(sb) && /promotionsSponsor: 0\.18/.test(sb)
      && /strengthCoachXp: 0\.10/.test(sb) && /strengthCoachStats: \["power", "block"\]/.test(sb) && /nutritionistXp: 0\.10/.test(sb) && /nutritionistStats: \["stamina"\]/.test(sb)
      && /massageDailyFatigue: 5/.test(sb) && /sportsScientistRiskCut: 0\.15/.test(sb) && /fatigueFactor: 0\.8/.test(sb) && /scienceAndNutrition: \{ xp: 0\.05 \}/.test(sb)
      && /from: 50/.test(sb) && /fullAt: 95/.test(sb));
  const all = ["utils", "routes", "lib"].flatMap((d) => fs.readdirSync(path.join(REPO, "artifacts", "api-server", "src", d)).filter((f) => f.endsWith(".ts")).map((f) => SRC(`${d}/${f}`))).join("\n");
  check("(source) the old healer system is gone: no healingBonus, healerKeys or heal chance anywhere in the server",
    !/healingBonus|healerKeys|healChanceDivisor|healChanceFor/.test(all));
  check("(source) the strength coach and nutritionist reach every training's XP by the programme's main stat (the player's, the AI clubs', the camps')",
    /m\.statStaff\?\.\[program\.primaryStat\]/.test(SRC("utils/trainingXp.ts")) && /statStaff: bonus\.statXp/.test(SRC("utils/aiSquads.ts"))
      && /statStaff: staff\.statXp/.test(SRC("utils/preseasonCamp.ts")) && /staffBonuses\.statXp, staffBonuses\.fatigueFactor/.test(SRC("routes/training.ts")));
  check("(source) the sports scientist cuts every club's match injury risk (the player's and the AI clubs'); the massage therapist's daily rest is the calendar's",
    /sports_scientist/.test(sb.slice(sb.indexOf("export function injuryRiskStaffFactor"))) && /staffFactor = injuryRiskStaffFactor\(await loadStaff\(cid, \{ teamId \}\)\)/.test(SRC("routes/matches.ts"))
      && /staffFactor = injuryRiskStaffFactor\(loadStaffTx\(w\.tx, careerSaveId, \{ poolTeamId \}\)\)/.test(SRC("utils/aiSquads.ts")) && /dailyRestBonus\(await loadStaff\(careerSaveId, \{ teamId: team\.id \}\)\)/.test(SRC("routes/calendar.ts")));

  // ── 2. The player's club ────────────────────────────────────────────────────
  console.log("\n2. THE PLAYER'S CLUB: EACH ROLE'S REAL EFFECT, AND THE PAIRS");
  await W.boot();
  const { teamId, cid } = await W.newCareer("Staff Roles");
  W.w(`UPDATE teams SET budget = 5000000 WHERE id = ?`, teamId);
  const effectOf = async (member) => ((await W.api("GET", "/staff/effects")).data?.members ?? []).find((m) => m.id === member.id)?.effect ?? "";
  const pairs = async () => Object.fromEntries(((await W.api("GET", "/staff/effects")).data?.pairs ?? []).map((p) => [p.key, p.has]));

  // Massage measured before anyone is hired: the rest alone.
  const restDrop = async () => {
    W.w(`UPDATE career_player_state SET fatigue = 80 WHERE career_save_id = ? AND team_id = ? AND injury_status = 'Healthy'`, cid, teamId);
    const before = new Map(W.q(`SELECT player_id id, fatigue f FROM career_player_state WHERE career_save_id = ? AND team_id = ? AND injury_status = 'Healthy'`, cid, teamId).map((r) => [r.id, r.f]));
    await W.day();
    const after = W.q(`SELECT player_id id, fatigue f FROM career_player_state WHERE career_save_id = ? AND team_id = ?`, cid, teamId);
    return Math.max(...after.filter((r) => before.has(r.id)).map((r) => before.get(r.id) - r.f));
  };
  const drop0 = await restDrop();

  const head = await W.hire("Head Coach", 80, cid), asst = await W.hire("Assistant Coach", 77, cid);
  const strength = await W.hire("Strength Coach", 86, cid), trainer = await W.hire("Fitness Trainer", 80, cid);
  check("Head Coach: her real effect is +15% XP at her skill's share", (await effectOf(head)) === `+${pct(scale(head.skill) * 0.15)} training XP`, `${head.skill}: ${await effectOf(head)}`);
  check("Assistant Coach: +8% XP at her share", (await effectOf(asst)) === `+${pct(scale(asst.skill) * 0.08)} training XP`, `${asst.skill}: ${await effectOf(asst)}`);
  check("Strength Coach: power and block training XP, +10% at her share", (await effectOf(strength)) === `+${pct(scale(strength.skill) * 0.10)} power and block training XP`, `${strength.skill}: ${await effectOf(strength)}`);
  check("Fitness Trainer: tiredness off each training session, 5 at her share", (await effectOf(trainer)).startsWith(`−${Math.round(scale(trainer.skill) * 5 * 10) / 10} tiredness`), `${trainer.skill}: ${await effectOf(trainer)}`);
  check("pair: a Strength Coach and a Fitness Trainer on the books", (await pairs()).strength_fitness === true);

  const doctor = await W.hire("Doctor", 88, cid), physio = await W.hire("Physiotherapist", 75, cid);
  const scientist = await W.hire("Sports Scientist", 85, cid), nutritionist = await W.hire("Nutritionist", 80, cid);
  const fx = (await W.api("GET", "/staff/effects")).data;
  check("Sports Scientist: the whole squad's injury risk, -15% at her share (and the factor the matches use)",
    (await effectOf(scientist)) === `−${pct(scale(scientist.skill) * 0.15)} injury risk for the whole squad` && Math.abs(fx.injuryRiskFactor - (1 - scale(scientist.skill) * 0.15)) < 1e-9,
    `${scientist.skill}: ${await effectOf(scientist)}`);
  check("Nutritionist: stamina training XP, +10% at her share", (await effectOf(nutritionist)) === `+${pct(scale(nutritionist.skill) * 0.10)} stamina training XP`, `${nutritionist.skill}: ${await effectOf(nutritionist)}`);
  const both = 0.5 - 0.1 * scale(doctor.skill);
  check("Doctor and Physio: treat injuries, at the \"both\" factor together (the pair)",
    (await effectOf(doctor)).includes(`×${both.toFixed(2)}`) && Math.abs(fx.treatment.doctorInjuries - both) < 1e-9 && Math.abs(fx.treatment.physioInjuries - (0.5 - 0.1 * scale(physio.skill))) < 1e-9,
    `${await effectOf(doctor)} | ${await effectOf(physio)}`);
  const p2 = await pairs();
  check("pairs: Doctor + Physio, and Sports Scientist + Nutritionist, on the books", p2.doctor_physio === true && p2.science_nutrition === true && p2.specialist_doctor_or_physio === false);

  await W.release(nutritionist); await W.release(doctor);
  const massage = await W.hire("Massage Therapist", 85, cid), specialist = await W.hire("Medical Specialist", 80, cid);
  check("Massage Therapist: more tiredness off every day, 5 at her share", (await effectOf(massage)) === `−${Math.round(scale(massage.skill) * 5 * 10) / 10} more tiredness every day`, `${massage.skill}: ${await effectOf(massage)}`);
  check("Medical Specialist: reconstructions (x0.25 with the physio there)", (await effectOf(specialist)).startsWith("Reconstructions: time out ×0.25"), await effectOf(specialist));
  const p3 = await pairs();
  check("pairs: Specialist + Physio on; Doctor + Physio and Scientist + Nutritionist off once the doctor and nutritionist have gone",
    p3.specialist_doctor_or_physio === true && p3.doctor_physio === false && p3.science_nutrition === false);
  const physio2Id = W.q(`SELECT st.id FROM career_staff_state s JOIN staff st ON st.id = s.staff_id WHERE s.career_save_id = ? AND s.team_id IS NULL AND s.pool_team_id IS NULL AND st.role = 'Physiotherapist' AND st.skill_level < ? ORDER BY st.skill_level DESC LIMIT 1`, cid, physio.skill)[0]?.id;
  if (physio2Id) {
    W.w(`UPDATE career_staff_state SET team_id = ? WHERE career_save_id = ? AND staff_id = ?`, teamId, cid, physio2Id);
    const weaker = ((await W.api("GET", "/staff/effects")).data?.members ?? []).find((m) => m.id === physio2Id);
    check("a second physio, weaker than the first, gives nothing (the best of each role counts)", weaker?.counts === false && /Gives nothing while a better Physiotherapist/.test(weaker.effect), weaker?.effect);
    W.w(`UPDATE career_staff_state SET team_id = NULL WHERE career_save_id = ? AND staff_id = ?`, cid, physio2Id);
  }
  W.w(`UPDATE career_staff_state SET off_days_left = 5, off_cause = 'flu' WHERE career_save_id = ? AND staff_id = ?`, cid, specialist.id);
  check("a member off ill gives nothing", ((await W.api("GET", "/staff/effects")).data?.members ?? []).find((m) => m.id === specialist.id)?.effect === "Off: gives nothing until back");
  W.w(`UPDATE career_staff_state SET off_days_left = 0, off_cause = NULL WHERE career_save_id = ? AND staff_id = ?`, cid, specialist.id);

  // ── 3. The massage therapist, measured ────────────────────────────────────
  console.log("\n3. THE MASSAGE THERAPIST, MEASURED");
  const drop1 = await restDrop();
  const want = 5 + Math.round(scale(massage.skill) * 5);
  check("resting with no massage therapist, a fit player loses the day's 5 tiredness", drop0 === 5, `${drop0}`);
  check("with her, 5 and her share of 5 more (whole points)", drop1 === want, `skill ${massage.skill}: ${drop1} (want ${want})`);

  // ── 4. An AI club ─────────────────────────────────────────────────────────
  console.log("\n4. AN AI CLUB: THE SAME FUNCTIONS");
  for (let i = 0; i < 10; i++) await W.day();   // past Day 8: the AI clubs have their staff
  const aiPlayer = W.q(`SELECT s.player_id id, s.pool_team_id club FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.team_id IS NULL AND s.pool_team_id IS NOT NULL AND s.is_retired = 0 AND s.injury_status = 'Healthy'
      AND (p.player_type = 'senior' OR s.is_promoted = 1)
      AND s.pool_team_id IN (SELECT pool_team_id FROM career_staff_state cs JOIN staff st ON st.id = cs.staff_id WHERE cs.career_save_id = ? AND st.role IN ('Doctor', 'Physiotherapist'))
    LIMIT 1`, cid, cid)[0];
  if (!aiPlayer) { check("an AI club with a doctor or physio after Day 8", false); }
  else {
    const medics = W.q(`SELECT st.role, st.skill_level s FROM career_staff_state cs JOIN staff st ON st.id = cs.staff_id WHERE cs.career_save_id = ? AND cs.pool_team_id = ? AND (cs.off_days_left IS NULL OR cs.off_days_left = 0)`, cid, aiPlayer.club);
    const best = (role) => Math.max(-1, ...medics.filter((m) => m.role === role).map((m) => m.s));
    const d = best("Doctor"), p = best("Physiotherapist");
    const want = d >= 0 && p >= 0 ? 0.5 - 0.1 * scale(d) : d >= 0 ? 0.7 - 0.1 * scale(d) : p >= 0 ? 1 : 2;
    const hurt = (await W.api("POST", "/dev/injuries/start", { playerId: aiPlayer.id, injury: "Broken leg" })).data;
    check("an AI club's broken leg is treated by its own medical staff, on the player's rule", Math.abs(hurt.weeks - 20 * want) < 0.02,
      `club ${aiPlayer.club}: doctor ${d < 0 ? "none" : d}, physio ${p < 0 ? "none" : p}: ${hurt.weeks} wk (x${want.toFixed(3)})`);
    const hist = W.q(`SELECT pool_team_id c FROM career_injuries WHERE career_save_id = ? AND player_id = ?`, cid, aiPlayer.id);
    check("and it is in her history, at her AI club", hist.some((h) => h.c === aiPlayer.club));
    info(`AI clubs with a doctor and a physio both: ${W.q(`SELECT COUNT(*) n FROM (SELECT pool_team_id FROM career_staff_state cs JOIN staff st ON st.id = cs.staff_id WHERE cs.career_save_id = ? AND cs.pool_team_id IS NOT NULL AND st.role IN ('Doctor','Physiotherapist') GROUP BY pool_team_id HAVING COUNT(DISTINCT st.role) = 2)`, cid)[0].n}`);
  }
} catch (err) {
  W.fail(err);
} finally {
  await W.stop();
}
W.finish();
