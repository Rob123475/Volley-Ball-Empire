/**
 * Replaces all existing Doctors with the real 10 from card images.
 * Run: pnpm --filter @workspace/scripts run seed-doctors
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
// slot number so every doctor still resolves to a real local portrait.
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

// All 10 cards are ★4. Skill calibrated by experience.
function skillFromExp(exp: number): number {
  return Math.min(94, 78 + Math.round(exp * 0.55));
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

// Doctor attributes: all ★4, adjusted by specialty/experience
function attrs(
  exp: number,
  overrides: Partial<Record<"injuryDiagnosis"|"injuryRecovery"|"playerHealth"|"emergencyCare"|"fatigueManagement"|"rehabilitationSupport"|"medicalKnowledge"|"professionalism", number>>
) {
  const base = 75 + Math.round(exp * 0.5);
  return {
    injuryDiagnosis:       overrides.injuryDiagnosis       ?? Math.min(94, base + 2),
    injuryRecovery:        overrides.injuryRecovery         ?? Math.min(92, base),
    playerHealth:          overrides.playerHealth           ?? Math.min(92, base + 1),
    emergencyCare:         overrides.emergencyCare          ?? Math.min(90, base - 1),
    fatigueManagement:     overrides.fatigueManagement      ?? Math.min(90, base),
    rehabilitationSupport: overrides.rehabilitationSupport  ?? Math.min(90, base - 2),
    medicalKnowledge:      overrides.medicalKnowledge       ?? Math.min(94, base + 3),
    professionalism:       overrides.professionalism        ?? Math.min(94, base + 2),
  };
}

const DOCTORS = [
  {
    name: "Dr. Alessandro Bianchi", nationality: "Italy", gender: "Male",
    age: 42, stars: 4, experienceYears: 15,
    specialty: "Team Doctor",
    coachSpeciality: "Sports Medicine",
    specialties: ["Sports Medicine", "Injury Diagnosis", "Athlete Health Management"],
    description: "An experienced Italian team doctor with 15 years on the elite circuit. Dr. Bianchi is known for his rapid and accurate injury diagnosis and comprehensive athlete health programmes.",
    attributes: attrs(15, { injuryDiagnosis: 90, medicalKnowledge: 92 }),
    imageFile: "staff_medical_doctor_01_1783428250581.webp", slot: "staff-01",
  },
  {
    name: "Dr. Sofia Petrova", nationality: "Bulgaria", gender: "Female",
    age: 38, stars: 4, experienceYears: 12,
    specialty: "Team Doctor",
    coachSpeciality: "Sports Medicine",
    specialties: ["Sports Medicine", "Fatigue Management", "Player Wellness"],
    description: "A sharp Bulgarian team doctor with 12 years of elite sports experience. Dr. Petrova specialises in fatigue management and the long-term wellness of beach volleyball athletes.",
    attributes: attrs(12, { fatigueManagement: 90, playerHealth: 89 }),
    imageFile: "staff_medical_doctor_02_1783428260713.webp", slot: "staff-02",
  },
  {
    name: "Dr. Hiroshi Tanaka", nationality: "Japan", gender: "Male",
    age: 51, stars: 4, experienceYears: 20,
    specialty: "Team Doctor",
    coachSpeciality: "Sports Medicine",
    specialties: ["Sports Medicine", "Medical Knowledge", "Injury Rehabilitation"],
    description: "A highly respected Japanese team doctor with two decades at the top of elite sport. Dr. Tanaka's encyclopaedic medical knowledge and calm approach make him a cornerstone of any medical team.",
    attributes: attrs(20, { medicalKnowledge: 94, injuryRecovery: 91, professionalism: 93 }),
    imageFile: "staff_medical_doctor_03_1783428264232.webp", slot: "staff-03",
  },
  {
    name: "Dr. Anna Kowalska", nationality: "Poland", gender: "Female",
    age: 46, stars: 4, experienceYears: 18,
    specialty: "Team Doctor",
    coachSpeciality: "Sports Medicine",
    specialties: ["Sports Medicine", "Rehabilitation Support", "Emergency Care"],
    description: "A distinguished Polish team doctor with 18 years in elite sport. Dr. Kowalska excels in rehabilitation support and is one of the most reliable emergency care practitioners on the tour.",
    attributes: attrs(18, { rehabilitationSupport: 93, emergencyCare: 92, professionalism: 93 }),
    imageFile: "staff_medical_doctor_04_1783428268278.webp", slot: "staff-04",
  },
  {
    name: "Dr. Karim Hassan", nationality: "Egypt", gender: "Male",
    age: 57, stars: 4, experienceYears: 25,
    specialty: "Team Doctor",
    coachSpeciality: "Sports Medicine",
    specialties: ["Sports Medicine", "Chronic Injury Management", "Athlete Longevity"],
    description: "One of the most experienced team doctors in the game with 25 years of elite service. Dr. Hassan's expertise in chronic injury management and athlete longevity is unparalleled.",
    attributes: attrs(25, { injuryDiagnosis: 94, medicalKnowledge: 95, professionalism: 95, playerHealth: 93 }),
    imageFile: "staff_medical_doctor_05_1783428289569.webp", slot: "staff-05",
  },
  {
    name: "Dr. Sarah Mitchell", nationality: "Australia", gender: "Female",
    age: 38, stars: 4, experienceYears: 12,
    specialty: "Team Doctor",
    coachSpeciality: "Sports Medicine",
    specialties: ["Sports Medicine", "Player Health Monitoring", "Fatigue Recovery"],
    description: "An energetic Australian team doctor with 12 years on the World Tour. Dr. Mitchell is lauded for her player health monitoring systems and proactive approach to fatigue recovery.",
    attributes: attrs(12, { playerHealth: 90, fatigueManagement: 89 }),
    imageFile: "staff_medical_doctor_06_1783428292716.webp", slot: "staff-06",
  },
  {
    name: "Dr. James O'Connor", nationality: "Australia", gender: "Male",
    age: 45, stars: 4, experienceYears: 17,
    specialty: "Team Doctor",
    coachSpeciality: "Sports Medicine",
    specialties: ["Sports Medicine", "Emergency Care", "Injury Diagnosis"],
    description: "A dependable Australian team doctor with 17 years of elite experience. Dr. O'Connor is highly regarded for his composure in emergency situations and precise injury diagnosis.",
    attributes: attrs(17, { emergencyCare: 92, injuryDiagnosis: 91 }),
    imageFile: "staff_medical_doctor_07_1783428305309.webp", slot: "staff-07",
  },
  {
    name: "Dr. Emily Harrison", nationality: "United Kingdom", gender: "Female",
    age: 43, stars: 4, experienceYears: 14,
    specialty: "Team Doctor",
    coachSpeciality: "Sports Medicine",
    specialties: ["Sports Medicine", "Medical Knowledge", "Rehabilitation Support"],
    description: "A highly competent British team doctor with 14 years at elite level. Dr. Harrison brings strong medical knowledge and a methodical approach to rehabilitation support.",
    attributes: attrs(14, { medicalKnowledge: 91, rehabilitationSupport: 90 }),
    imageFile: "staff_medical_doctor_08_1783428307486.webp", slot: "staff-08",
  },
  {
    name: "Dr. Priya Sharma", nationality: "India", gender: "Female",
    age: 39, stars: 4, experienceYears: 11,
    specialty: "Team Doctor",
    coachSpeciality: "Sports Medicine",
    specialties: ["Sports Medicine", "Player Wellness", "Injury Recovery"],
    description: "An engaging and dedicated Indian team doctor with 11 years in elite sport. Dr. Sharma's warm player-centric approach and strong diagnostic skills make her a favourite among athletes.",
    attributes: attrs(11, { playerHealth: 88, injuryRecovery: 87 }),
    imageFile: "staff_medical_doctor_09_1783428316377.webp", slot: "staff-09",
  },
  {
    name: "Dr. Michael Anderson", nationality: "USA", gender: "Male",
    age: 54, stars: 4, experienceYears: 22,
    specialty: "Team Doctor",
    coachSpeciality: "Sports Medicine",
    specialties: ["Sports Medicine", "Fatigue Management", "Athlete Health Management"],
    description: "A highly experienced American team doctor with 22 years in professional sport. Dr. Anderson's deep understanding of fatigue management and athlete health makes him a senior presence in any medical staff.",
    attributes: attrs(22, { fatigueManagement: 93, playerHealth: 92, medicalKnowledge: 93, professionalism: 94 }),
    imageFile: "staff_medical_doctor_10_1783428318510.webp", slot: "staff-10",
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
  console.log("Removing existing Doctors...");
  const existing = sqlite
    .prepare(`SELECT id, name FROM staff WHERE role = ?`)
    .all("Doctor") as { id: number; name: string }[];

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

  for (const [i, d] of DOCTORS.entries()) {
    const skill = skillFromExp(d.experienceYears);
    const salary = medicalSalaryFromSkill(skill);
    console.log(`[${i + 1}/10] ${d.name} (${d.nationality}, ★${d.stars}, ${d.experienceYears} yrs) — skill ${skill}`);

    const localPath = resolveLocalImagePath("medical_doctor", d.imageFile);
    const imageUrl = await upload(localPath, `staff/medical_doctor/${d.slot}.webp`);

    const attributes = {
      schema:           "beach_volleyball_staff",
      version:          "1.0",
      staffType:        "Doctor",
      regenerationSeed: "BVM_DOCTOR_V1_2026_07_07",
      nationality:      d.nationality,
      age:              d.age,
      gender:           d.gender,
      stars:            d.stars,
      experienceYears:  d.experienceYears,
      salary,
      specialties:      d.specialties,
      description:      d.description,
      ...d.attributes,
    };

    insertStmt.run(
      d.name,
      "Doctor",
      d.specialty,
      salary,
      skill,
      d.nationality,
      imageUrl,
      d.age,
      skill,
      d.coachSpeciality,
      "Caring",
      JSON.stringify(attributes),
      d.specialties[0],
      skill - 5,
      Math.floor(Date.now() / 1000),
    );

    console.log(`  ✓ inserted → ${imageUrl}`);
  }

  const final = sqlite
    .prepare(`SELECT name, skill_level FROM staff WHERE role = ?`)
    .all("Doctor") as { name: string; skill_level: number }[];

  console.log(`\nDone — ${final.length} Doctors now in DB:`);
  final.forEach((r) => console.log(`  ${r.name} (skill ${r.skill_level})`));
  sqlite.close();
}

main().catch((err) => {
  console.error(err);
  sqlite.close();
  process.exitCode = 1;
});
