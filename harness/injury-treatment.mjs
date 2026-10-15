/**
 * Update 1, night 2 (O-7): real injuries, treated by the right person.
 *
 *   1. the named injuries and their shares, over 100,000 of the game's own rolls
 *   2. the four treatment factors on a broken leg: 40 / 20 / 12-14 / 8-10 weeks
 *   3. an older save's injuries become named ones of the same length, with no history
 *   4. live: a broken leg at a club with no medical staff (40 weeks); a doctor
 *      hired mid-injury shrinks what is left at once; released, it grows back;
 *      a week of rest with the doctor takes a week off at her factor
 *   5. a 4+ week injury is serious (speed and stamina -1, on her record), and the
 *      injury is in her history, on the Club News and on her card
 */
import { createWorld } from "./night2-world.mjs";
import { INJURY_TYPES } from "../lib/db/src/schema/injuries.ts";

const W = createWorld("injury-treatment", 4971);
const { check, info } = W;
console.log("=".repeat(72));
console.log("  UPDATE 1, NIGHT 2 PART 3: REAL INJURIES, TREATED BY THE RIGHT PERSON");
console.log("=".repeat(72));

try {
  await W.boot();
  const { profileId, teamId, cid } = await W.newCareer("Injury Treatment");
  const players = W.q(`SELECT player_id AS id FROM career_player_state WHERE career_save_id = ? AND team_id = ? ORDER BY player_id`, cid, teamId).map((r) => r.id);

  // ── 1. The named injuries and their shares ────────────────────────────────
  console.log("\n1. THE NAMED INJURIES AND THEIR SHARES");
  const roll = (await W.api("POST", "/dev/injuries/roll", { samples: 100000 })).data;
  const off = INJURY_TYPES.map((t) => {
    const got = (roll.counts[t.name] ?? 0) / roll.samples;
    const tol = Math.max(0.002, 5 * Math.sqrt((t.share * (1 - t.share)) / roll.samples));
    return { name: t.name, want: t.share, got, ok: Math.abs(got - t.share) <= tol };
  });
  check("over 100,000 of the game's rolls, every named injury comes up at its share (and nothing else does)",
    off.every((o) => o.ok) && Object.keys(roll.counts).length === INJURY_TYPES.length,
    off.map((o) => `${o.name} ${(o.got * 100).toFixed(1)}% (${(o.want * 100).toFixed(1)}%)`).join(", "));

  // ── 2. The four treatment factors on a broken leg ─────────────────────────
  console.log("\n2. THE FOUR TREATMENT FACTORS ON A BROKEN LEG (20 BASE WEEKS)");
  const leg = async (team) => (await W.api("POST", "/dev/injuries/factor", { injury: "Broken leg", ...team })).data.weeks;
  const none = await leg({}), wrong = await leg({ physiotherapist: 80 });
  const right50 = await leg({ doctor: 50 }), right95 = await leg({ doctor: 95 }), right72 = await leg({ doctor: 72 });
  const both50 = await leg({ doctor: 50, physiotherapist: 70 }), both95 = await leg({ doctor: 95, physiotherapist: 70 });
  check("no doctor and no physio: 40 weeks", Math.abs(none - 40) < 1e-9, `${none}`);
  check("only the wrong one (a physio, for a doctor's injury): 20 weeks", Math.abs(wrong - 20) < 1e-9, `${wrong}`);
  check("the right one (a doctor): 14 weeks at skill 50, 12 at 95, between them in between",
    Math.abs(right50 - 14) < 1e-9 && Math.abs(right95 - 12) < 1e-9 && right72 > 12 && right72 < 14, `${right50} / ${right72.toFixed(2)} / ${right95}`);
  check("both (a doctor and a physio): 10 weeks at the doctor's skill 50, 8 at 95",
    Math.abs(both50 - 10) < 1e-9 && Math.abs(both95 - 8) < 1e-9, `${both50} / ${both95}`);
  const ankleBoth = (await W.api("POST", "/dev/injuries/factor", { injury: "Sprained ankle", physiotherapist: 95, doctor: 60 })).data.weeks;
  check("a physio's injury takes the physio's skill for the right one (a sprained ankle, both: 3 x 0.4)", Math.abs(ankleBoth - 1.2) < 1e-9, `${ankleBoth}`);
  await W.stop();

  // ── 3. An older save's injuries ───────────────────────────────────────────
  console.log("\n3. AN OLDER SAVE'S INJURIES BECOME NAMED ONES OF THE SAME LENGTH");
  const legacy = [["Minor Injury", 1, "Cramp or strained muscle", "leg"], ["Major Injury", 3, "Sprained ankle", "ankle"], ["Unavailable", 6, "Torn hamstring", "hamstring"]];
  legacy.forEach(([status, weeks], i) => W.w(`UPDATE career_player_state SET injury_status = ?, injury_weeks_remaining = ?, is_injured = 1, injury_area = NULL, injury_base_weeks_left = 0
    WHERE career_save_id = ? AND player_id = ?`, status, weeks, cid, players[i]));
  await W.boot();
  await W.select(profileId);
  const conv = legacy.map(([, weeks, name, area], i) => {
    const r = W.q(`SELECT injury_status s, injury_area a, injury_weeks_remaining w, injury_base_weeks_left b FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, players[i])[0];
    return { ok: r.s === name && r.a === area && Math.abs(r.w - weeks) < 0.01 && Math.abs(r.b - weeks / 2) < 0.01, txt: `${r.s} (${r.a}) ${r.w} wk, base ${r.b}` };
  });
  check("Minor becomes a cramp, Major a sprained ankle, Unavailable a torn hamstring, each with her weeks out kept (base = weeks / 2 with no medical staff)",
    conv.every((c) => c.ok), conv.map((c) => c.txt).join(" · "));
  check("and none of them has any injury history", W.q(`SELECT COUNT(*) n FROM career_injuries WHERE career_save_id = ?`, cid)[0].n === 0);
  for (const id of players.slice(0, 3)) W.w(`UPDATE career_player_state SET injury_status = 'Healthy', injury_weeks_remaining = 0, injury_base_weeks_left = 0, injury_area = NULL, is_injured = 0 WHERE career_save_id = ? AND player_id = ?`, cid, id);

  // ── 4. Live ────────────────────────────────────────────────────────────────
  console.log("\n4. LIVE: HER TIME OUT FOLLOWS THE CLUB'S MEDICAL STAFF");
  const her = players[0];
  const before = W.q(`SELECT speed, stamina, serious_injuries AS si FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, her)[0];
  const hurt = (await W.api("POST", "/dev/injuries/start", { playerId: her, injury: "Broken leg" })).data;
  const state = () => W.q(`SELECT injury_status s, injury_weeks_remaining w, injury_base_weeks_left b, speed, stamina, serious_injuries AS si FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, her)[0];
  check("a broken leg at a club with no doctor and no physio: 40 weeks", hurt?.name === "Broken leg" && Math.abs(state().w - 40) < 0.01, `${state().s} ${state().w} wk`);
  const doctor = await W.hire("Doctor", 90, cid);
  const f = 0.7 - 0.1 * Math.min(1, (doctor.skill - 50) / 45);
  check("a doctor hired mid-injury shrinks what is left at once (20 base weeks x her factor)", Math.abs(state().w - 20 * f) < 0.02, `doctor skill ${doctor.skill}: ${state().w} wk (x${f.toFixed(3)})`);
  await W.release(doctor);
  check("released, it grows back (nothing was healed in between)", Math.abs(state().w - 40) < 0.02, `${state().w} wk`);
  const doctor2 = await W.hire("Doctor", 90, cid);
  const f2 = 0.7 - 0.1 * Math.min(1, (doctor2.skill - 50) / 45);
  const base0 = state().b;
  for (let i = 0; i < 7; i++) await W.day();
  const s7 = state();
  check("a week of rest with the doctor takes 1 / factor base weeks off, and her weeks out are what is left x the factor",
    Math.abs(s7.b - (base0 - 1 / f2)) < 0.02 && Math.abs(s7.w - s7.b * f2) < 0.02, `base ${base0} -> ${s7.b}, ${s7.w} wk`);

  // ── 5. Serious, history, news, card ────────────────────────────────────────
  console.log("\n5. SERIOUS, AND SEEN EVERYWHERE");
  check("a broken leg is serious: speed and stamina -1 and one more serious injury on her record",
    hurt.serious === true && s7.speed === Math.max(1, before.speed - 1) && s7.stamina === Math.max(1, before.stamina - 1) && s7.si === before.si + 1);
  const hist = W.q(`SELECT injury, area, weeks_out AS w, team_id AS t FROM career_injuries WHERE career_save_id = ? AND player_id = ?`, cid, her);
  check("it is in her injury history, with its area, time out and club", hist.length === 1 && hist[0].injury === "Broken leg" && hist[0].area === "leg" && hist[0].w === 40 && hist[0].t === teamId);
  const news = (await W.api("GET", "/news")).data?.items ?? [];
  check("the Club News names it, with the area and time out", news.some((n) => n.type === "injury" && /broken leg \(leg\)/.test(n.headline) && /40 weeks/.test(n.detail)),
    news.filter((n) => n.type === "injury").map((n) => `${n.headline}: ${n.detail}`).join(" | "));
  const card = (await W.api("GET", `/players/${her}/injuries`)).data;
  check("her card lists it with its date", card?.injuries?.[0]?.injury === "Broken leg" && card.injuries[0].area === "Leg" && /^\d{4}-\d{2}-\d{2}$/.test(card.injuries[0].gameDate));
  const roster = (await W.api("GET", "/team/roster")).data;
  const onCard = [...(roster.injuredList ?? []), ...(roster.starters ?? []), ...(roster.interchanges ?? [])].find((p) => p.id === her);
  check("the Team page's player carries the injury's name, area and live weeks", onCard?.injuryStatus === "Broken leg" && onCard.injuryArea === "leg" && Math.abs(onCard.injuryWeeksRemaining - s7.w) < 0.01);
  info(`staff on the books at the end: ${W.q(`SELECT COUNT(*) n FROM career_staff_state WHERE career_save_id = ? AND team_id = ?`, cid, teamId)[0].n}`);
} catch (err) {
  W.fail(err);
} finally {
  await W.stop();
}
W.finish();
