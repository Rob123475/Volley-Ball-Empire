/**
 * Replaces all existing Physiotherapists with the real 10 from card images.
 * Includes full JSON attributes from the Physiotherapist schema.
 * Run: pnpm --filter @workspace/scripts run seed-physiotherapists
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
// slot number so every physio still resolves to a real local portrait.
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

// Star → skill level range (mid-point used, adjusted by experience)
function skillFromStars(stars: number, expYears: number): number {
  const base = { 1.5: 45, 2: 55, 2.5: 62, 3: 68, 3.5: 74, 4: 79, 4.5: 86, 5: 92 }[stars] ?? 70;
  return Math.min(99, Math.round(base + expYears * 0.3));
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

const PHYSIOS = [
  {
    name: "Dr. Isabella Conti",
    nationality: "Italy", gender: "Female",
    age: 38, stars: 4, experienceYears: 10,
    specialty: "Injury & Rehab Specialist",
    coachSpeciality: "Injury Rehabilitation",
    specialties: ["Injury Rehabilitation", "Sports Physiotherapy", "Recovery Protocols"],
    description: "Italian physiotherapist with 10 years of elite sports experience. Specialises in comprehensive injury rehabilitation and return-to-play protocols for beach volleyball athletes.",
    attributes: { injuryRecovery: 86, injuryPrevention: 82, mobility: 80, rehabilitation: 88, manualTherapy: 84, fitnessSupport: 78, playerCare: 85, professionalism: 86 },
    imageFile: "staff_medical_physiotherapist_01_1783427455027.webp", slot: "staff-01",
  },
  {
    name: "Dr. Sipho Dlamini",
    nationality: "South Africa", gender: "Male",
    age: 37, stars: 4, experienceYears: 12,
    specialty: "Team Physiotherapist",
    coachSpeciality: "Team Physiotherapy",
    specialties: ["Team Physiotherapy", "Musculoskeletal Therapy", "Sports Injury Management"],
    description: "Experienced South African team physiotherapist with 12 years working with elite athletes. Expert in musculoskeletal therapy and comprehensive injury management.",
    attributes: { injuryRecovery: 85, injuryPrevention: 84, mobility: 82, rehabilitation: 86, manualTherapy: 85, fitnessSupport: 80, playerCare: 84, professionalism: 85 },
    imageFile: "staff_medical_physiotherapist_02_1783427463131.webp", slot: "staff-02",
  },
  {
    name: "Dr. Anastasia Ivanova",
    nationality: "Russia", gender: "Female",
    age: 42, stars: 4, experienceYears: 17,
    specialty: "Team Physiotherapist",
    coachSpeciality: "Team Physiotherapy",
    specialties: ["Team Physiotherapy", "Manual Therapy", "Long-Term Athlete Development"],
    description: "A highly seasoned Russian physiotherapist with 17 years at the elite level. Renowned for her manual therapy expertise and long-term athlete development programmes.",
    attributes: { injuryRecovery: 88, injuryPrevention: 86, mobility: 84, rehabilitation: 90, manualTherapy: 92, fitnessSupport: 82, playerCare: 88, professionalism: 90 },
    imageFile: "staff_medical_physiotherapist_03_1783427469244.webp", slot: "staff-03",
  },
  {
    name: "Dr. Nattaya Somboon",
    nationality: "Thailand", gender: "Female",
    age: 29, stars: 4, experienceYears: 7,
    specialty: "Team Physiotherapist",
    coachSpeciality: "Team Physiotherapy",
    specialties: ["Team Physiotherapy", "Recovery & Mobility", "Soft Tissue Therapy"],
    description: "A dedicated Thai team physiotherapist with a focus on recovery optimisation and soft tissue work. Highly regarded for her patient-centred approach to athlete care.",
    attributes: { injuryRecovery: 80, injuryPrevention: 79, mobility: 84, rehabilitation: 80, manualTherapy: 82, fitnessSupport: 77, playerCare: 86, professionalism: 80 },
    imageFile: "staff_medical_physiotherapist_04_1783427473605.webp", slot: "staff-04",
  },
  {
    name: "Dr. Anita Sharma",
    nationality: "India", gender: "Female",
    age: 52, stars: 4, experienceYears: 23,
    specialty: "Team Physiotherapist",
    coachSpeciality: "Team Physiotherapy",
    specialties: ["Team Physiotherapy", "Chronic Injury Management", "Athlete Longevity"],
    description: "One of the most experienced physiotherapists in the game, with 23 years of elite sport behind her. Dr. Sharma specialises in chronic injury management and extending athlete careers.",
    attributes: { injuryRecovery: 90, injuryPrevention: 92, mobility: 86, rehabilitation: 91, manualTherapy: 90, fitnessSupport: 84, playerCare: 92, professionalism: 94 },
    imageFile: "staff_medical_physiotherapist_05_1783427484813.webp", slot: "staff-05",
  },
  {
    name: "Dr. Emily Harrison",
    nationality: "Australia", gender: "Female",
    age: 31, stars: 4, experienceYears: 6,
    specialty: "Musculoskeletal Specialist",
    coachSpeciality: "Musculoskeletal Physiotherapy",
    specialties: ["Musculoskeletal Physiotherapy", "Sports Injury Rehabilitation", "Movement Assessment"],
    description: "Australian musculoskeletal specialist with 6 years of focused experience in beach volleyball. Known for precise movement assessments and evidence-based rehabilitation programmes.",
    attributes: { injuryRecovery: 79, injuryPrevention: 80, mobility: 86, rehabilitation: 80, manualTherapy: 81, fitnessSupport: 78, playerCare: 82, professionalism: 80 },
    imageFile: "staff_medical_physiotherapist_06_1783427487485.webp", slot: "staff-06",
  },
  {
    // ★2 — lower tier
    name: "Irina Morozova",
    nationality: "Russia", gender: "Female",
    age: 29, stars: 2, experienceYears: 7,
    specialty: "Movement. Recovery. Performance.",
    coachSpeciality: "Sports Rehabilitation",
    specialties: ["Sports Injury Rehabilitation", "Mobility & Flexibility", "Manual Therapy & Massage"],
    description: "A developing Russian physiotherapist with broad rehabilitation skills. Strong in mobility work and manual therapy, she is building her reputation on the World Tour circuit.",
    attributes: { injuryRecovery: 60, injuryPrevention: 58, mobility: 68, rehabilitation: 62, manualTherapy: 65, fitnessSupport: 60, playerCare: 64, professionalism: 62 },
    imageFile: "staff_medical_physiotherapist_07_1783427498249.webp", slot: "staff-07",
  },
  {
    // ★5 — top tier
    name: "Alexei Mironov",
    nationality: "Russia", gender: "Male",
    age: 34, stars: 5, experienceYears: 9,
    specialty: "Rehabilitate. Restore. Perform.",
    coachSpeciality: "Sports Injury Rehabilitation",
    specialties: ["Sports Injury Rehabilitation", "Manual Therapy & Mobilisation", "Kinesio Taping"],
    description: "An elite 5-star Russian physiotherapist with a stellar reputation for rehabilitating complex sports injuries. His combination of manual therapy, kinesio taping and spinal rehab makes him one of the best available.",
    attributes: { injuryRecovery: 94, injuryPrevention: 90, mobility: 88, rehabilitation: 95, manualTherapy: 94, fitnessSupport: 88, playerCare: 90, professionalism: 92 },
    imageFile: "staff_medical_physiotherapist_08_1783427501091.webp", slot: "staff-08",
  },
  {
    // ★4
    name: "Mei Ling Tan",
    nationality: "Singapore", gender: "Female",
    age: 27, stars: 4, experienceYears: 5,
    specialty: "Move Well. Recover Stronger.",
    coachSpeciality: "Sports Rehabilitation",
    specialties: ["Sports Injury Rehabilitation", "Kinesiotaping & Strapping", "Post-Operative Rehabilitation"],
    description: "A talented young Singaporean physiotherapist focused on helping athletes move better and recover faster. Specialises in kinesiotaping, post-operative rehab and pain management.",
    attributes: { injuryRecovery: 78, injuryPrevention: 77, mobility: 82, rehabilitation: 80, manualTherapy: 79, fitnessSupport: 76, playerCare: 84, professionalism: 78 },
    imageFile: "staff_medical_physiotherapist_09_1783427512066.webp", slot: "staff-09",
  },
  {
    // ★5 Extra Specialist
    name: "Nikita Belyakov",
    nationality: "Russia", gender: "Male",
    age: 31, stars: 5, experienceYears: 7,
    specialty: "Restore. Rehabilitate. Perform.",
    coachSpeciality: "Sports Injury Rehabilitation",
    specialties: ["Manual Therapy & Mobilisation", "Spinal & Joint Rehabilitation", "Injury Prevention & Performance"],
    description: "A 5-star extra specialist and one of the most complete physiotherapists on the market. Nikita's mastery of spinal rehabilitation, soft tissue therapy and kinesiotaping makes him an invaluable asset to any elite squad.",
    attributes: { injuryRecovery: 93, injuryPrevention: 92, mobility: 90, rehabilitation: 94, manualTherapy: 96, fitnessSupport: 88, playerCare: 88, professionalism: 90 },
    imageFile: "staff_medical_physiotherapist_10_1783427514345.webp", slot: "staff-10",
  },
];

const insertStmt = sqlite.prepare(`
  INSERT INTO staff (
    name, role, specialty, base_salary, skill_level, nationality, image_url,
    base_age, overall_rating, coach_speciality, personality,
    attributes, special_trait, scouting_rating, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

async function main() {
  // ── Step 1: delete all existing Physiotherapists ──────────────────────────
  console.log("Removing existing Physiotherapists...");
  const existing = sqlite
    .prepare(`SELECT id, name FROM staff WHERE role = ?`)
    .all("Physiotherapist") as { id: number; name: string }[];

  if (existing.length > 0) {
    const ids = existing.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(",");
    sqlite.prepare(`UPDATE training_sessions SET coach_id = NULL WHERE coach_id IN (${placeholders})`).run(...ids);
    sqlite
      .prepare(`UPDATE continental_scouting_missions SET assigned_staff_id = NULL WHERE assigned_staff_id IN (${placeholders})`)
      .run(...ids);
    sqlite.prepare(`DELETE FROM staff WHERE id IN (${placeholders})`).run(...ids);
    console.log(`  deleted ${ids.length} rows.\n`);
  }

  // ── Step 2: upload & insert all 10 ───────────────────────────────────────
  for (const [i, p] of PHYSIOS.entries()) {
    const skill = skillFromStars(p.stars, p.experienceYears);
    const salary = medicalSalaryFromSkill(skill);
    console.log(`[${i + 1}/10] ${p.name} (${p.nationality}, ★${p.stars}, ${p.experienceYears} yrs) — skill ${skill}`);

    const localPath = resolveLocalImagePath("medical_physiotherapist", p.imageFile);
    const imageUrl = await upload(localPath, `staff/physiotherapist/${p.slot}.webp`);

    const attributes = {
      schema:          "beach_volleyball_staff",
      version:         "1.0",
      staffType:       "Physiotherapist",
      nationality:     p.nationality,
      age:             p.age,
      gender:          p.gender,
      stars:           p.stars,
      experienceYears: p.experienceYears,
      salary,
      specialties:     p.specialties,
      description:     p.description,
      // Physiotherapist-specific attributes
      injuryRecovery:  p.attributes.injuryRecovery,
      injuryPrevention:p.attributes.injuryPrevention,
      mobility:        p.attributes.mobility,
      rehabilitation:  p.attributes.rehabilitation,
      manualTherapy:   p.attributes.manualTherapy,
      fitnessSupport:  p.attributes.fitnessSupport,
      playerCare:      p.attributes.playerCare,
      professionalism: p.attributes.professionalism,
    };

    insertStmt.run(
      p.name,
      "Physiotherapist",
      p.specialty,
      salary,
      skill,
      p.nationality,
      imageUrl,
      p.age,
      skill,
      p.coachSpeciality,
      "Caring",
      JSON.stringify(attributes),
      p.specialties[0],
      skill - 5,
      Math.floor(Date.now() / 1000),
    );

    console.log(`  ✓ inserted → ${imageUrl}`);
  }

  // ── verify ────────────────────────────────────────────────────────────────
  const final = sqlite
    .prepare(`SELECT name, skill_level FROM staff WHERE role = ?`)
    .all("Physiotherapist") as { name: string; skill_level: number }[];

  console.log(`\nDone — ${final.length} Physiotherapists now in DB:`);
  final.forEach((r) => console.log(`  ${r.name} (skill ${r.skill_level})`));
  sqlite.close();
}

main().catch((err) => {
  console.error(err);
  sqlite.close();
  process.exitCode = 1;
});
