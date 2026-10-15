/**
 * Update 1, night 2 (O-8): the medical specialist and reconstructions.
 *
 *   1. a third ankle injury within 12 months (her history, game dates) is an
 *      ankle reconstruction: 30 base weeks, serious; the first two were not
 *   2. its time out: no medical staff 60, a doctor or physio 30, a specialist 15,
 *      a specialist with a doctor or physio about 8 (7.5)
 *   3. live like any injury: a specialist hired mid-reconstruction takes it from
 *      60 to 15 weeks at once
 *   4. two ankle injuries more than a year ago do not count: the third is a
 *      plain ankle injury
 *   5. her card says it: "Ankle: 3 in the last 12 months"
 */
import { createWorld } from "./night2-world.mjs";

const W = createWorld("reconstruction", 4972);
const { check } = W;
console.log("=".repeat(72));
console.log("  UPDATE 1, NIGHT 2 PART 4: THE MEDICAL SPECIALIST AND RECONSTRUCTIONS");
console.log("=".repeat(72));

try {
  await W.boot();
  const { teamId, cid } = await W.newCareer("Reconstruction");
  const players = W.q(`SELECT player_id AS id FROM career_player_state WHERE career_save_id = ? AND team_id = ? ORDER BY player_id`, cid, teamId).map((r) => r.id);
  const heal = (id) => W.w(`UPDATE career_player_state SET injury_status = 'Healthy', injury_weeks_remaining = 0, injury_base_weeks_left = 0, injury_area = NULL, is_injured = 0,
    on_injured_list = 0, injured_list_since = NULL, injured_list_squad = NULL, squad_role = 'starter', is_active = 1 WHERE career_save_id = ? AND player_id = ?`, cid, id);
  const start = async (id, injury) => (await W.api("POST", "/dev/injuries/start", { playerId: id, injury })).data;

  // ── 1. A third ankle in a year ─────────────────────────────────────────────
  console.log("\n1. A THIRD ANKLE INJURY WITHIN 12 MONTHS IS A RECONSTRUCTION");
  const her = players[0];
  const first = await start(her, "Sprained ankle"); heal(her);
  const second = await start(her, "Sprained ankle"); heal(her);
  const third = await start(her, "Sprained ankle");
  check("the first two ankle injuries are sprained ankles", first?.name === "Sprained ankle" && !first.reconstruction && second?.name === "Sprained ankle" && !second.reconstruction);
  check("the third is an ankle reconstruction: 30 base weeks, serious", third?.name === "Ankle reconstruction" && third.reconstruction && third.baseWeeks === 30 && third.serious === true,
    `${third?.name}, ${third?.baseWeeks} base weeks, serious ${third?.serious}`);
  const recHist = W.q(`SELECT injury, reconstruction AS r FROM career_injuries WHERE career_save_id = ? AND player_id = ? ORDER BY id`, cid, her);
  check("her history holds all three, the third marked a reconstruction", recHist.length === 3 && recHist[2].r === 1 && recHist[2].injury === "Ankle reconstruction");

  // ── 2. Its time out ────────────────────────────────────────────────────────
  console.log("\n2. A RECONSTRUCTION'S TIME OUT");
  const rec = async (team) => (await W.api("POST", "/dev/injuries/factor", { injury: "Ankle reconstruction", ...team })).data.weeks;
  const none = await rec({}), dr = await rec({ doctor: 80 }), ph = await rec({ physiotherapist: 60 }), sp = await rec({ specialist: 70 }), spd = await rec({ specialist: 70, doctor: 80 });
  check("no medical staff: 60 weeks", none === 60, `${none}`);
  check("a doctor or a physio: 30 weeks", dr === 30 && ph === 30, `${dr} / ${ph}`);
  check("a medical specialist: 15 weeks", sp === 15, `${sp}`);
  check("a specialist with a doctor or physio: about 8 weeks (7.5)", spd === 7.5, `${spd}`);
  const reconWeeks = W.q(`SELECT injury_weeks_remaining w FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, her)[0].w;
  check("her reconstruction at a club with no medical staff: 60 weeks", Math.abs(reconWeeks - 60) < 0.01, `${reconWeeks}`);

  // ── 3. Live ────────────────────────────────────────────────────────────────
  console.log("\n3. LIVE: A SPECIALIST HIRED MID-RECONSTRUCTION");
  const specialist = await W.hire("Medical Specialist", 80, cid);
  const w1 = W.q(`SELECT injury_weeks_remaining w FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, her)[0].w;
  check("a specialist hired: 60 weeks becomes 15 at once", Math.abs(w1 - 15) < 0.01, `${w1}`);
  const physio = await W.hire("Physiotherapist", 70, cid);
  const w2 = W.q(`SELECT injury_weeks_remaining w FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, her)[0].w;
  check("and a physio with the specialist: 7.5 (the pair halves it again)", Math.abs(w2 - 7.5) < 0.01, `${w2}`);
  await W.release(specialist); await W.release(physio);

  // ── 4. More than a year ago doesn't count ─────────────────────────────────
  console.log("\n4. TWO ANKLE INJURIES MORE THAN A YEAR AGO DO NOT COUNT");
  const other = players[1];
  W.w(`INSERT INTO career_injuries (career_save_id, player_id, injury, area, game_date, weeks_out, base_weeks, reconstruction, team_id) VALUES (?, ?, 'Sprained ankle', 'ankle', '2024-06-01', 3, 3, 0, ?)`, cid, other, teamId);
  W.w(`INSERT INTO career_injuries (career_save_id, player_id, injury, area, game_date, weeks_out, base_weeks, reconstruction, team_id) VALUES (?, ?, 'Sprained ankle', 'ankle', '2024-09-01', 3, 3, 0, ?)`, cid, other, teamId);
  const plain = await start(other, "Sprained ankle");
  check("the third ankle injury, two years after the others, is a plain sprained ankle", plain?.name === "Sprained ankle" && !plain.reconstruction, plain?.name);
  const elsewhere = players[2];
  await start(elsewhere, "Sprained ankle"); heal(elsewhere);
  await start(elsewhere, "Sprained ankle"); heal(elsewhere);
  const shoulder = await start(elsewhere, "Torn shoulder");
  check("a third injury in a year to a different area is the injury rolled, not a reconstruction", shoulder?.name === "Torn shoulder" && !shoulder.reconstruction);

  // ── 5. Her card ─────────────────────────────────────────────────────────────
  console.log("\n5. HER CARD MAKES A REPEAT AREA OBVIOUS");
  const card = (await W.api("GET", `/players/${her}/injuries`)).data;
  check("her card: \"Ankle: 3 in the last 12 months\", the reconstruction among them",
    card?.areasLast12Months?.[0]?.area === "Ankle" && card.areasLast12Months[0].count === 3 && card.injuries.some((i) => i.reconstruction),
    JSON.stringify(card?.areasLast12Months));
} catch (err) {
  W.fail(err);
} finally {
  await W.stop();
}
W.finish();
