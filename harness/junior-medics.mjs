/**
 * 1.1.1 (Rob, 17 Oct): junior medics (JUNIOR_MEDICS, JUNIOR_PROMOTION in lib/db
 * schema/staff-roles.ts; api-server utils/juniorMedics.ts; installed by
 * scripts/install-staff-portraits.cjs --juniors from docs/junior-medic-portrait-names.json).
 *
 *   1. the 37 are in the game: 14 Registrars (Doctors), 10 Physio Assistants
 *      (Physiotherapists), 13 Orthopaedic Surgeons (Medical Specialists), each
 *      with a portrait on disk
 *   2. a Registrar and a Physio Assistant are cheaper and weaker than the full
 *      role; a Surgeon a little stronger and dearer than a Medical Specialist
 *   3. hired, a Registrar works as a Doctor (her role) and counts under the staff budget
 *   4. not promoted before a year at the club; promoted on her day (within
 *      three years): the full role's title, more skill, the full role's wage, news
 *   5. AI clubs: the same promotion
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createWorld, REPO } from "./night2-world.mjs";

const W = createWorld("junior-medics", 4969);
const { check, info } = W;
console.log("=".repeat(72));
console.log("  1.1.1 (17 OCT): JUNIOR MEDICS");
console.log("=".repeat(72));
const median = (l) => { const s = [...l].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

try {
  // ── 1-2. In the game ──────────────────────────────────────────────────────
  console.log("\n1. THE 37, IN THE STARTER DATABASE, WITH THEIR PORTRAITS");
  const shipped = new DatabaseSync(path.join(REPO, "lib", "db", "volleyball-empire.sqlite"), { readOnly: true });
  const staff = shipped.prepare(`SELECT id, name, role, grade, skill_level k, base_salary w, image_url img FROM staff`).all();
  shipped.close();
  const of = (grade) => staff.filter((s) => s.grade === grade);
  const full = (role) => staff.filter((s) => s.role === role && !s.grade);
  const counts = { registrar: of("registrar").length, physio_assistant: of("physio_assistant").length, surgeon: of("surgeon").length };
  check("14 Registrars, 10 Physio Assistants, 13 Orthopaedic Surgeons", counts.registrar === 14 && counts.physio_assistant === 10 && counts.surgeon === 13, JSON.stringify(counts));
  check("as their full roles: Doctor, Physiotherapist, Medical Specialist",
    of("registrar").every((s) => s.role === "Doctor") && of("physio_assistant").every((s) => s.role === "Physiotherapist") && of("surgeon").every((s) => s.role === "Medical Specialist"));
  const juniors = [...of("registrar"), ...of("physio_assistant"), ...of("surgeon")];
  const missing = juniors.filter((s) => !fs.existsSync(path.join(REPO, "artifacts", "beach-volleyball", "public", s.img)));
  check("each with her own portrait on disk", missing.length === 0 && new Set(juniors.map((s) => s.img)).size === juniors.length, missing.map((s) => s.img).join(", "));
  console.log("\n2. CHEAPER AND WEAKER; A SURGEON A LITTLE STRONGER AND DEARER");
  const band = (l) => `skill ${Math.min(...l.map((s) => s.k))}-${Math.max(...l.map((s) => s.k))}, $${Math.min(...l.map((s) => s.w)).toLocaleString()}-$${Math.max(...l.map((s) => s.w)).toLocaleString()}`;
  check("a Registrar: below every Doctor in skill, and cheaper than every Doctor", Math.max(...of("registrar").map((s) => s.k)) < Math.min(...full("Doctor").map((s) => s.k))
    && Math.max(...of("registrar").map((s) => s.w)) < Math.min(...full("Doctor").map((s) => s.w)), `${band(of("registrar"))} against Doctors ${band(full("Doctor"))}`);
  check("a Physio Assistant: weaker and cheaper than the median Physiotherapist", Math.max(...of("physio_assistant").map((s) => s.k)) < median(full("Physiotherapist").map((s) => s.k))
    && Math.max(...of("physio_assistant").map((s) => s.w)) < median(full("Physiotherapist").map((s) => s.w)), `${band(of("physio_assistant"))} against ${band(full("Physiotherapist"))}`);
  check("an Orthopaedic Surgeon: stronger and dearer than the median Medical Specialist", median(of("surgeon").map((s) => s.k)) > median(full("Medical Specialist").map((s) => s.k))
    && median(of("surgeon").map((s) => s.w)) > median(full("Medical Specialist").map((s) => s.w)), `${band(of("surgeon"))} against ${band(full("Medical Specialist"))}`);
  info(`Registrars ${band(of("registrar"))}; Physio Assistants ${band(of("physio_assistant"))}; Surgeons ${band(of("surgeon"))}`);

  // ── 3. Hired ──────────────────────────────────────────────────────────────
  console.log("\n3. A REGISTRAR WORKS AS A DOCTOR, UNDER THE STAFF BUDGET");
  await W.boot({ VBE_STAFF_BUDGET: "on" });
  const { teamId, cid } = await W.newCareer("Junior Medics");
  await W.day();
  const reg = W.q(`SELECT st.id, st.name, s.salary w FROM career_staff_state s JOIN staff st ON st.id = s.staff_id WHERE s.career_save_id = ? AND st.grade = 'registrar' AND s.team_id IS NULL AND s.pool_team_id IS NULL ORDER BY st.skill_level LIMIT 1`, cid)[0];
  const hired = await W.api("POST", "/medical-staff", { staffId: reg.id, length: "2s" });
  const mine = (await W.api("GET", "/medical-staff")).data.find((m) => m.id === reg.id);
  const budget = (await W.api("GET", "/finances/main-sponsor")).data;
  check("hired: her role is Doctor and her grade Registrar (she treats as a Doctor); her wage is under the staff budget's wages",
    hired.status === 201 && mine?.role === "Doctor" && mine?.grade === "registrar" && budget.wages >= reg.w, `HTTP ${hired.status} ${hired.data?.error ?? ""}; ${mine?.role}/${mine?.grade}; wages ${budget.wages}`);
  const page = fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", "lib", "staff-title.ts"), "utf8");
  check("(source) her card reads \"Registrar · Team Doctor\"", /`\$\{staffTitle\(roleLabel, grade\)\} · \$\{roleLabel\}`/.test(page));

  // ── 4. Promotion ──────────────────────────────────────────────────────────
  console.log("\n4. PROMOTED ON HER DAY, BETWEEN ONE AND THREE YEARS AT THE CLUB");
  const today = (await W.api("GET", "/calendar")).data.currentDate;
  W.w(`UPDATE career_staff_state SET contract_start_date = ? WHERE career_save_id = ? AND staff_id = ?`, addDays(today, -300), cid, reg.id);
  await W.day();
  const early = W.q(`SELECT career_grade g FROM career_staff_state WHERE career_save_id = ? AND staff_id = ?`, cid, reg.id)[0];
  check("300 days at the club: not yet", early.g == null);
  W.w(`UPDATE career_staff_state SET contract_start_date = ? WHERE career_save_id = ? AND staff_id = ?`, addDays(today, -3 * 365 - 2), cid, reg.id);
  const r = await W.day();
  const after = W.q(`SELECT career_grade g, career_skill k, salary w, promoted_on d FROM career_staff_state WHERE career_save_id = ? AND staff_id = ?`, cid, reg.id)[0];
  const card = (await W.api("GET", "/medical-staff")).data.find((m) => m.id === reg.id);
  const regRef = staff.find((s) => s.id === reg.id);
  check("three years on: promoted to Doctor (no junior title), more skill, a Doctor's wage for it",
    after.g === "promoted" && after.k > regRef.k && after.w >= Math.min(...full("Doctor").map((s) => s.w)) && card?.grade == null && card?.skillLevel === after.k,
    `skill ${regRef.k} -> ${after.k}, wage ${reg.w} -> ${after.w}, on ${after.d}`);
  check("and the club's news says so", JSON.stringify(r.data ?? "").includes(`${reg.name} is promoted from Registrar to Doctor`));

  // ── 5. AI clubs ───────────────────────────────────────────────────────────
  console.log("\n5. AI CLUBS: THE SAME");
  const pa = W.q(`SELECT st.id FROM career_staff_state s JOIN staff st ON st.id = s.staff_id WHERE s.career_save_id = ? AND st.grade = 'physio_assistant' AND s.team_id IS NULL AND s.pool_team_id IS NULL LIMIT 1`, cid)[0];
  const club = W.q(`SELECT pool_team_id id FROM career_pool_team_state WHERE career_save_id = ? AND taken_over_at IS NULL LIMIT 1`, cid)[0].id;
  const day2 = (await W.api("GET", "/calendar")).data.currentDate;
  W.w(`UPDATE career_staff_state SET pool_team_id = ?, is_available = 0, contract_start_date = ?, contract_end_date = ? WHERE career_save_id = ? AND staff_id = ?`,
    club, addDays(day2, -3 * 365 - 2), addDays(day2, 300), cid, pa.id);
  await W.day();
  const aiAfter = W.q(`SELECT career_grade g, career_skill k FROM career_staff_state WHERE career_save_id = ? AND staff_id = ?`, cid, pa.id)[0];
  check("an AI club's Physio Assistant is promoted to Physiotherapist on her day too", aiAfter.g === "promoted" && aiAfter.k > 0, JSON.stringify(aiAfter));
} catch (err) {
  W.fail(err);
} finally {
  await W.stop();
}
W.finish();
