/**
 * Replaces the 8 auto-generated Sports Scientists with the real 10 from card images.
 * Run: pnpm --filter @workspace/scripts run seed-sports-scientists
 */
import { copyFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { DatabaseSync } from "node:sqlite";

// NOTE: writes via Node's built-in node:sqlite instead of the shared
// @workspace/db (better-sqlite3) client — same crash (native Statement
// destructor firing during isolate/env teardown, SIGABRT) that seed-staff.ts
// hit under Node 24 on Windows. See seed-staff.ts for the full writeup.
if (!process.env.DB_PATH) {
  throw new Error("DB_PATH must be set. Did you forget to pass the SQLite file path?");
}
const sqlite = new DatabaseSync(process.env.DB_PATH);
sqlite.exec("PRAGMA journal_mode = WAL;");

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = process.env.SEED_WORKSPACE_ROOT
  ? resolve(process.env.SEED_WORKSPACE_ROOT)
  : resolve(__dirname, "../../");
const PUBLIC_IMAGES_ROOT = resolve(WORKSPACE_ROOT, "artifacts/beach-volleyball/public/images");
const ATTACHED_ASSETS_ROOT = resolve(WORKSPACE_ROOT, "attached_assets");
const ATTACHED_ASSETS_FILES = readdirSync(ATTACHED_ASSETS_ROOT);

// Same stale-filename problem as seed-staff.ts: the imageFile timestamps
// recorded below don't match what's actually on disk (portraits were
// re-uploaded/renamed since). Fall back to a prefix match on the recorded
// slot number so every scientist still resolves to a real local portrait.
function resolveLocalImagePath(roleSlug: string, imageFile: string): string {
  const exact = resolve(ATTACHED_ASSETS_ROOT, imageFile);
  if (existsSync(exact)) return exact;

  const match = imageFile.match(/_(\d{2})(?:_\d+)?\.\w+$/);
  if (!match) {
    throw new Error(`Could not parse slot index from imageFile "${imageFile}"`);
  }
  const idx = match[1];
  const candidates = ATTACHED_ASSETS_FILES.filter((f) => f.startsWith(`staff_${roleSlug}_${idx}`)).sort();

  if (candidates.length === 0) {
    throw new Error(`No local image found for ${roleSlug} #${idx} (expected ${imageFile})`);
  }
  const chosen = candidates[candidates.length - 1];
  console.log(`  (image mismatch: "${imageFile}" not found, using "${chosen}" instead)`);
  return resolve(ATTACHED_ASSETS_ROOT, chosen);
}

async function upload(localFile: string, entityId: string): Promise<string> {
  const destPath = join(PUBLIC_IMAGES_ROOT, entityId);
  mkdirSync(dirname(destPath), { recursive: true });
  copyFileSync(localFile, destPath);
  console.log(`  copied → /images/${entityId}`);
  return `/images/${entityId}`;
}

// Shared salary scale across all 5 medical seed scripts (Doctor, Physiotherapist,
// Nutritionist, Sports Scientist, Medical Specialist) — one linear map from skill
// level to salary so the same skill level pays the same regardless of which
// script/role generated it. Bounds are the global min/max skill_level across all
// 50 medical staff as seeded by these 5 scripts combined (currently 55-97).
const MEDICAL_SALARY_SKILL_MIN = 55;
const MEDICAL_SALARY_SKILL_MAX = 97;
function medicalSalaryFromSkill(skill: number): number {
  const t = (skill - MEDICAL_SALARY_SKILL_MIN) / (MEDICAL_SALARY_SKILL_MAX - MEDICAL_SALARY_SKILL_MIN);
  return Math.round((100000 + t * 100000) / 1000) * 1000;
}

const SCIENTISTS = [
  { name: "Dr. Matthew Anderson",  nationality: "Australian",    age: 38, exp: 12, specialty: "Team Sports Scientist",        coachSpeciality: "Performance Analysis",    skill: 85, imageFile: "staff_medical_science_01_1783426769412.webp",  slot: "staff-01" },
  { name: "Dr. Emma Clarke",       nationality: "Australian",    age: 33, exp:  8, specialty: "Team Sports Scientist",        coachSpeciality: "Athlete Monitoring",      skill: 80, imageFile: "staff_medical_science_02_1783426774476.webp",  slot: "staff-02" },
  { name: "Dr. Zandile Mokwena",   nationality: "South African", age: 36, exp: 11, specialty: "Team Sports Scientist",        coachSpeciality: "Performance Analysis",    skill: 84, imageFile: "staff_medical_science_03_1783426780943.webp",  slot: "staff-03" },
  { name: "Dr. Luca Moretti",      nationality: "Italian",       age: 33, exp:  8, specialty: "Team Sports Scientist",        coachSpeciality: "Strength & Conditioning", skill: 80, imageFile: "staff_medical_science_04_1783426790962.webp",  slot: "staff-04" },
  { name: "Dr. Marta García",      nationality: "Spanish",       age: 31, exp:  7, specialty: "Performance Analyst",          coachSpeciality: "Data Analysis",           skill: 78, imageFile: "staff_medical_science_05_1783426793545.webp",  slot: "staff-05" },
  { name: "Dr. James O'Connor",    nationality: "Australian",    age: 34, exp:  9, specialty: "Performance Specialist",       coachSpeciality: "Athletic Performance",    skill: 82, imageFile: "staff_medical_science_06_1783426805383.webp",  slot: "staff-06" },
  { name: "Dr. Takashi Mori",      nationality: "Japanese",      age: 38, exp: 12, specialty: "Biomechanics Specialist",      coachSpeciality: "Biomechanics",            skill: 85, imageFile: "staff_medical_science_07_1783426808116.webp",  slot: "staff-07" },
  { name: "Dr. Emily Thompson",    nationality: "Canadian",      age: 29, exp:  6, specialty: "Exercise Physiologist",        coachSpeciality: "Exercise Physiology",     skill: 77, imageFile: "staff_medical_science_08_1783426831041.webp",  slot: "staff-08" },
  { name: "Dr. Larissa Almeida",   nationality: "Brazilian",     age: 28, exp:  5, specialty: "Human Performance Specialist", coachSpeciality: "Human Performance",       skill: 75, imageFile: "staff_medical_science_09_1783426833952.webp",  slot: "staff-09" },
  { name: "Dr. Andrea Bianchi",    nationality: "Italian",       age: 42, exp: 14, specialty: "Data & Analytics Specialist",  coachSpeciality: "Sports Analytics",        skill: 88, imageFile: "staff_medical_science_10_1783426836339.webp",  slot: "staff-10" },
];

const insertStmt = sqlite.prepare(`
  INSERT INTO staff (
    name, role, specialty, base_salary, skill_level, nationality, image_url,
    base_age, overall_rating, coach_speciality, personality,
    attributes, special_trait, scouting_rating, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

async function main() {
  // ── Step 1: delete the 8 fake auto-generated Sports Scientists ─────────────
  console.log("Removing 8 auto-generated Sports Scientists...");
  const existing = sqlite
    .prepare(`SELECT id, name FROM staff WHERE role = ?`)
    .all("Sports Scientist") as { id: number; name: string }[];

  if (existing.length > 0) {
    const ids = existing.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(",");
    // Null out any FK references first
    sqlite.prepare(`UPDATE training_sessions SET coach_id = NULL WHERE coach_id IN (${placeholders})`).run(...ids);
    sqlite
      .prepare(`UPDATE continental_scouting_missions SET assigned_staff_id = NULL WHERE assigned_staff_id IN (${placeholders})`)
      .run(...ids);
    sqlite.prepare(`DELETE FROM staff WHERE id IN (${placeholders})`).run(...ids);
    console.log(`  deleted ${ids.length} rows.\n`);
  }

  // ── Step 2: upload images and insert real 10 ───────────────────────────────
  for (const [i, s] of SCIENTISTS.entries()) {
    console.log(`[${i + 1}/10] ${s.name} (${s.nationality}, ${s.exp} yrs)`);
    const localPath = resolveLocalImagePath("medical_science", s.imageFile);
    const imageUrl = await upload(localPath, `staff/sports_scientist/${s.slot}.webp`);

    const attributes = {
      experience:  s.exp,
      starRating:  4,
      specialties: [s.specialty, s.coachSpeciality],
    };

    insertStmt.run(
      s.name,
      "Sports Scientist",
      s.specialty,
      medicalSalaryFromSkill(s.skill),
      s.skill,
      s.nationality,
      imageUrl,
      s.age,
      s.skill,
      s.coachSpeciality,
      "Analytical",
      JSON.stringify(attributes),
      s.specialty,
      s.skill - 5,
      Math.floor(Date.now() / 1000),
    );
    console.log(`  ✓ inserted → ${imageUrl}`);
  }

  console.log(`\nDone — Sports Scientists now at 10. ✅`);
  sqlite.close();
}

main().catch((err) => {
  console.error(err);
  sqlite.close();
  process.exitCode = 1;
});
